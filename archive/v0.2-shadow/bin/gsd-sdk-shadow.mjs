#!/usr/bin/env node
// Y1 (shadow gsd-sdk) — registry-override variant.
// GSD core unmodified per REQ-02; uses dynamic import of upstream's dist/.
// D-02 invariant: 13 mutation entries (BEADS_OVERRIDES) live here.
//                 Reads (BEADS_READ_OVERRIDES) register separately; roadmap.analyze
//                 is the first real read handler (Phase 5).
// D-09 / W3 invariant: production eventStream=null → wrapMutation is a no-op (MVP).

import { spawnSync, execSync } from 'node:child_process';
import { existsSync, realpathSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapMutation } from './wrap-mutation.mjs';
import {
  BeadsUnavailableError,
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsVersionMismatch,
  BeadsEmpty,
} from './beads-errors.mjs';
import { bd } from './bd-helper.mjs';

const DEBUG = process.env.GSD_BEADS_DEBUG === '1';
const log = (...a) => { if (DEBUG) console.error('[gsd-sdk-shadow]', ...a); };

const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;
const QUERY_INDEX_PATH = `${SDK_BASE}/sdk/dist/query/index.js`;
const REGISTRY_PATH = `${SDK_BASE}/sdk/dist/query/registry.js`;

// ─── beads-backed handlers ─────────────────────────────────────────────────
// QueryHandler signature: (args: string[], projectDir: string) => Promise<QueryResult>
// QueryResult shape: { data: any } (upstream's printers expect exactly this shape)

// Budget ~150ms (2 bd calls × ~75ms)
async function beadsPhaseAdd(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
  return { data: { phase_id: beadId, title, status: 'added', backend: 'beads' } };
}

// Budget ~150ms × N (Pitfall 5 — batch cost scales with number of phases)
async function beadsPhaseAddBatch(args, projectDir) {
  let phases;
  try {
    phases = JSON.parse(args[0] ?? '[]');
    if (!Array.isArray(phases)) throw new Error('not an array');
  } catch (err) {
    throw new Error(`phase.add-batch requires args[0] to be a JSON array of phase titles: ${err.message}`);
  }
  const phaseIds = [];
  for (const title of phases) {
    const beadId = execSync(
      `bd q ${JSON.stringify(String(title))} -t epic -p 1`,
      { cwd: projectDir, encoding: 'utf-8' }
    ).trim();
    execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
    phaseIds.push(beadId);
  }
  return { data: { phase_ids: phaseIds, count: phaseIds.length, backend: 'beads' } };
}

// Budget ~200ms (3 bd calls)
async function beadsPhaseInsert(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  const priority = args[1] !== undefined ? parseFloat(args[1]) : 1;
  if (isNaN(priority) || priority < 0 || priority > 4) {
    throw new Error(`phase.insert: priority must be a number 0-4, got: ${args[1]}`);
  }
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p ${priority}`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
  execSync(`bd label add ${beadId} inserted`, { cwd: projectDir });
  return { data: { phase_id: beadId, title, priority, status: 'inserted', backend: 'beads' } };
}

// Budget ~100ms (1 bd call)
async function beadsPhaseComplete(args, projectDir) {
  const phaseId = args[0];
  if (!phaseId) throw new Error('phase.complete: requires args[0] = phase-id');
  execSync(`bd close ${phaseId}`, { cwd: projectDir });
  return { data: { phase_id: phaseId, status: 'closed', backend: 'beads' } };
}

// Budget ~100ms (1 bd call)
async function beadsPhaseRemove(args, projectDir) {
  const phaseId = args[0];
  if (!phaseId) throw new Error('phase.remove: requires args[0] = phase-id');
  execSync(`bd close ${phaseId} --reason removed`, { cwd: projectDir });
  return { data: { phase_id: phaseId, status: 'removed', backend: 'beads' } };
}

// Budget ~150ms + (150ms × N tasks) (Pitfall 5 — tasks scale cost)
async function beadsPhaseScaffold(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  let tasks = [];
  if (args[1]) {
    try {
      const parsed = JSON.parse(args[1]);
      if (Array.isArray(parsed)) tasks = parsed;
    } catch {
      // If args[1] is not JSON, treat as single task title
      tasks = [args[1]];
    }
  }
  const phaseId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${phaseId} gsd:phase`, { cwd: projectDir });
  const taskIds = [];
  for (let i = 0; i < tasks.length; i++) {
    const taskId = execSync(
      `bd q ${JSON.stringify(String(tasks[i]))} -t task -p ${Math.min(i + 1, 4)}`,
      { cwd: projectDir, encoding: 'utf-8' }
    ).trim();
    execSync(`bd link ${taskId} ${phaseId} --type parent-child`, { cwd: projectDir });
    taskIds.push(taskId);
  }
  return { data: { phase_id: phaseId, task_ids: taskIds, backend: 'beads' } };
}

// Budget ~100ms + (100ms × N phases) (Pitfall 5 — scales with phase count)
async function beadsPhasesClear(args, projectDir) {
  const listOut = execSync(
    `bd list --type=epic -l gsd:phase --json`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  let phases = [];
  try { phases = JSON.parse(listOut); } catch { phases = []; }
  // Filter to open phases only (don't double-close)
  const openPhases = phases.filter(p => p.status !== 'closed');
  for (const phase of openPhases) {
    execSync(`bd close ${phase.id} --reason cleared`, { cwd: projectDir });
  }
  return { data: { cleared_count: openPhases.length, backend: 'beads' } };
}

// Budget ~100ms + (100ms × N phases) (Pitfall 5 — scales with phase count)
async function beadsPhasesArchive(args, projectDir) {
  const listOut = execSync(
    `bd list --type=epic -l gsd:phase --json`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  let phases = [];
  try { phases = JSON.parse(listOut); } catch { phases = []; }
  for (const phase of phases) {
    execSync(`bd label add ${phase.id} archived`, { cwd: projectDir });
  }
  return { data: { archived_count: phases.length, backend: 'beads' } };
}

// Budget ~100ms (1 bd call)
async function beadsRoadmapUpdatePlanProgress(args, projectDir) {
  const planId = args[0];
  const status = args[1];
  if (!planId) throw new Error('roadmap.update-plan-progress: requires args[0] = plan-id');
  if (!status) throw new Error('roadmap.update-plan-progress: requires args[1] = status');
  execSync(`bd update ${planId} --status ${JSON.stringify(status)}`, { cwd: projectDir });
  return { data: { plan_id: planId, status, backend: 'beads' } };
}

// Budget ~100ms × N deps (Pitfall 5 — scales with dependency count)
async function beadsRoadmapAnnotateDependencies(args, projectDir) {
  const phaseId = args[0];
  if (!phaseId) throw new Error('roadmap.annotate-dependencies: requires args[0] = phase-id');
  const depIds = args.slice(1).filter(Boolean);
  for (const depId of depIds) {
    execSync(`bd link ${phaseId} ${depId} --type blocks`, { cwd: projectDir });
  }
  return { data: { phase_id: phaseId, deps_added: depIds.length, backend: 'beads' } };
}

// Budget ~100ms (1 bd call)
async function beadsRequirementsMarkComplete(args, projectDir) {
  const reqId = args[0];
  if (!reqId) throw new Error('requirements.mark-complete: requires args[0] = req-id');
  execSync(`bd close ${reqId}`, { cwd: projectDir });
  return { data: { req_id: reqId, status: 'completed', backend: 'beads' } };
}

// Budget ~100ms (1 bd call)
async function beadsTodoComplete(args, projectDir) {
  const todoId = args[0];
  if (!todoId) throw new Error('todo.complete: requires args[0] = todo-id');
  execSync(`bd close ${todoId}`, { cwd: projectDir });
  return { data: { todo_id: todoId, status: 'completed', backend: 'beads' } };
}

// Budget ~200ms (3 bd calls: show + label remove + label add)
async function beadsMilestoneComplete(args, projectDir) {
  const milestoneId = args[0];
  if (!milestoneId) throw new Error('milestone.complete: requires args[0] = milestone-id');
  // Validate bead exists before attempting label operations (bd label commands exit 0 on missing IDs)
  try {
    execSync(`bd show ${milestoneId} --json`, { cwd: projectDir, encoding: 'utf-8' });
  } catch (err) {
    throw new Error(`milestone.complete: bead not found: ${milestoneId}`);
  }
  execSync(`bd label remove ${milestoneId} active`, { cwd: projectDir });
  execSync(`bd label add ${milestoneId} completed`, { cwd: projectDir });
  return { data: { milestone_id: milestoneId, status: 'completed', backend: 'beads' } };
}

// ─── BEADS_OVERRIDES table ─────────────────────────────────────────────────
// D-02 invariant: exactly 13 entries, all in this single file.
// T-02-05 threat mitigation: explicit allow-list; unknown commands → spawnUpstream.
export const BEADS_OVERRIDES = {
  'phase.add': beadsPhaseAdd,
  'phase.add-batch': beadsPhaseAddBatch,
  'phase.insert': beadsPhaseInsert,
  'phase.complete': beadsPhaseComplete,
  'phase.remove': beadsPhaseRemove,
  'phase.scaffold': beadsPhaseScaffold,
  'phases.clear': beadsPhasesClear,
  'phases.archive': beadsPhasesArchive,
  'roadmap.update-plan-progress': beadsRoadmapUpdatePlanProgress,
  'roadmap.annotate-dependencies': beadsRoadmapAnnotateDependencies,
  'requirements.mark-complete': beadsRequirementsMarkComplete,
  'todo.complete': beadsTodoComplete,
  'milestone.complete': beadsMilestoneComplete,
};

// ─── findBeadsRoot — read-side project-root discovery ──────────────────────
// D-01..D-04 + REQ-QUAL-03. Symmetric with hooks fix b51abbc.
// Returns null on no-bd (NOT throws — D-13). Honors BEADS_DIR first (D-01),
// follows symlinks via realpathSync (D-03), bounded parent-walk halts at .git
// or filesystem root (D-02). Worktree handling: when .git is a FILE (not dir),
// reads it to find the source repo and returns source root if it owns .beads/.
export function findBeadsRoot(start) {
  const envDir = process.env.BEADS_DIR;
  if (envDir) {
    let resolved;
    try { resolved = realpathSync(resolve(envDir)); } catch { resolved = null; }
    if (resolved && existsSync(join(resolved, 'metadata.json'))) {
      return dirname(resolved);
    }
  }
  let dir;
  try { dir = realpathSync(resolve(start)); } catch { return null; }
  while (true) {
    const gitMarker = join(dir, '.git');
    const hasGit = existsSync(gitMarker);
    if (hasGit) {
      // Check worktree first: bd init commits .beads/metadata.json into git, so a
      // worktree always has its own (transitive) .beads/metadata.json copy — but the
      // real bd state (Dolt store, etc.) lives only in the source repo. We must
      // resolve to the source repo per REQ-QUAL-03 plan contract.
      const stat = statSync(gitMarker);
      if (stat.isFile()) {
        // Worktree: .git file contains "gitdir: /path/to/source/.git/worktrees/<name>"
        const content = readFileSync(gitMarker, 'utf-8').trim();
        const m = content.match(/^gitdir:\s*(.+)$/m);
        if (m) {
          const sourceGitDir = m[1].trim();
          // sourceGitDir ends in /.git/worktrees/<name>; walk up three dirnames to source root
          const sourceRoot = dirname(dirname(dirname(sourceGitDir)));
          if (existsSync(join(sourceRoot, '.beads', 'metadata.json'))) {
            return sourceRoot;
          }
        }
        return null;
      }
      // Regular git repo (.git is a directory): check for .beads/ at this level
      // (D-02: halt walk at git root). Return dir if bd-managed, else null.
      if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
      return null;
    }
    // No .git at this level — check for .beads/ then walk up
    if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ─── Phase 5 read-handler shared helpers ───────────────────────────────────
// D-02 / D-07 / D-10..D-12 / D-15..D-17. Used by beadsRoadmapAnalyze and
// beadsRoadmapGetPhase (Plans 03/04). Exported so tests cover them directly.

/**
 * D-02: Strip "phase-id:" prefix and zero-padding; preserve decimal segments.
 * @param {string|null|undefined} label - e.g. "phase-id:05" or "phase-id:72.1"
 * @returns {string|null} - e.g. "5" or "72.1" or null
 */
export function parsePhaseId(label) {
  if (!label) return null;
  return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
}

/**
 * D-07: 7-value disk_status enum priority chain.
 * planCount/summaryCount come from bd (D-06); hasContext/hasResearch from disk.
 * Priority: no_directory → complete → partial → planned → researched → discussed → empty.
 * @param {{planCount:number, summaryCount:number, hasContext:boolean, hasResearch:boolean, dirExists:boolean}} opts
 * @returns {'complete'|'partial'|'planned'|'researched'|'discussed'|'empty'|'no_directory'}
 */
export function deriveDiskStatus({ planCount, summaryCount, hasContext, hasResearch, dirExists }) {
  if (!dirExists) return 'no_directory';
  if (planCount > 0 && summaryCount >= planCount) return 'complete';
  if (summaryCount > 0) return 'partial';
  if (planCount > 0) return 'planned';
  if (hasResearch) return 'researched';
  if (hasContext) return 'discussed';
  return 'empty';
}

/**
 * D-09/D-10 + refined D-06: Drift kinds — plan_count, summary_count, closed_without_summary.
 * Aggregate kind `completed_phases_mismatch` is computed at handler-level (post-loop), not here.
 *
 * Per refined D-06 (commit 7feccb8): summary_count is LIVE — bd's "summarized plan count"
 * (closed gsd:plan children) is compared against disk *-SUMMARY.md count. The handler
 * MUST pass distinct bd_summary_count and disk_summary_count values for this comparison
 * to be meaningful (do NOT pass the same value for both).
 *
 * Emits stderr line per drift case (D-09 channel 1) and returns array (channel 2).
 *
 * @param {string} phase - phase number (e.g. "5")
 * @param {{plan_count:number, summary_count:number, bd_status:string}} bdState - bd-derived counts (summary_count = closed gsd:plan child count)
 * @param {{disk_plan_count:number, disk_summary_count:number}} diskState - filesystem-derived counts
 * @returns {{phase:string, kind:string, bd_value:number|string, disk_value:number}[]}
 */
export function detectDrift(phase, bdState, diskState) {
  const entries = [];
  if (bdState.plan_count !== diskState.disk_plan_count) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} plan_count bd=${bdState.plan_count} disk=${diskState.disk_plan_count}`);
    entries.push({ phase, kind: 'plan_count', bd_value: bdState.plan_count, disk_value: diskState.disk_plan_count });
  }
  if (bdState.summary_count !== diskState.disk_summary_count) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} summary_count bd=${bdState.summary_count} disk=${diskState.disk_summary_count}`);
    entries.push({ phase, kind: 'summary_count', bd_value: bdState.summary_count, disk_value: diskState.disk_summary_count });
  }
  if (bdState.bd_status === 'closed' && diskState.disk_summary_count === 0) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} closed_without_summary`);
    entries.push({ phase, kind: 'closed_without_summary', bd_value: 'closed', disk_value: 0 });
  }
  return entries;
}

/**
 * D-15..D-17: Format milestone heading from bd memory or fall back to bare version.
 * Heading format mirrors upstream's milestonePattern capture: "Milestone <version> — <heading>".
 * Logs a stderr note exactly once per call when the memory is absent (D-17).
 * @param {Record<string,string>} memories - kv object from `bd memories --json`
 * @param {string} version - milestone version string (e.g. "v0.2")
 * @returns {string} - formatted heading or bare version string
 */
export function loadMilestoneHeading(memories, version) {
  const key = `gsd-beads:milestone:${version}:heading`;
  const heading = memories?.[key];
  if (heading) {
    return `Milestone ${version} — ${heading}`;
  }
  console.error(`[gsd-shadow] note: no milestone heading memory for ${version}`);
  return version;
}

// ─── readGitConfigMilestone ─────────────────────────────────────────────────
// D-19: read current milestone from worktree-local git config, then GSD_MILESTONE
// env override, then fallback to "v0.2". Used by beadsRoadmapAnalyze.
function readGitConfigMilestone(projectDir) {
  const result = spawnSync('git', ['config', '--worktree', 'gsd-beads.milestone'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  if (process.env.GSD_MILESTONE) return process.env.GSD_MILESTONE;
  return 'v0.2';
}

// ─── beadsRoadmapAnalyze ────────────────────────────────────────────────────
// REQ-READ-01: first real bd-backed read handler.
// D-22: registered in BEADS_READ_OVERRIDES without wrapMutation.
// D-24: calls findBeadsRoot before any bd invocation.
// D-25: handler is clean — does NOT catch BeadsUnavailableError.
// D-27: single bd(['export','--json']) + single bd(['memories','--json']) per invocation.
// D-28: sort by priority desc, created_at asc, id asc (deterministic).
async function beadsRoadmapAnalyze(_args, projectDir) {
  // D-24: find bd root or throw BeadsEmpty (dispatcher catches and falls through).
  const root = findBeadsRoot(projectDir);
  if (!root) throw new BeadsEmpty('roadmap.analyze: project is not bd-managed');

  // D-27: SINGLE export call — no per-phase fan-out.
  const allBeads = bd(['export', '--json'], { cwd: root });

  // D-27: memories call — second of 2 allowed spawns.
  const memories = bd(['memories', '--json'], { cwd: root });

  // D-19: current milestone from worktree git config / env / fallback.
  const currentMilestone = readGitConfigMilestone(projectDir);

  // Filter phase epics for current milestone.
  const phaseBeads = allBeads.filter(b =>
    Array.isArray(b.labels) &&
    b.labels.includes('gsd:phase') &&
    b.labels.includes(`version:${currentMilestone}`)
  );

  // D-28: sort by priority desc, created_at asc, id asc.
  phaseBeads.sort((a, b) =>
    (b.priority - a.priority) ||
    (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  // Build parent→children index from allBeads dependency edges.
  // Each child bead has a dependencies[] array; find parent-child edges.
  const childrenByParent = {};  // parentId → [childBead, ...]
  for (const bead of allBeads) {
    if (!Array.isArray(bead.dependencies)) continue;
    for (const dep of bead.dependencies) {
      if (dep.type === 'parent-child' && dep.depends_on_id) {
        const parentId = dep.depends_on_id;
        if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
        childrenByParent[parentId].push(bead);
      }
    }
  }

  // Locate the .planning/phases dir for disk I/O.
  const phasesDir = join(projectDir, '.planning', 'phases');
  let phaseDirEntries = null;
  try {
    phaseDirEntries = readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch { /* phases dir absent — all phases will be no_directory */ }

  // D-02: phase number helper (imported from module scope).
  // Collect phases with scratch fields for drift detection.
  const phasesWithScratch = [];
  for (const bead of phaseBeads) {
    const phaseIdLabel = bead.labels.find(l => l.startsWith('phase-id:'));
    const phaseNum = parsePhaseId(phaseIdLabel);

    // Disk I/O: find phase directory via upstream's phaseTokenMatches logic.
    // We implement a simplified version: match dir name starting with the
    // zero-padded phase number (e.g. "05-...").
    let phaseFiles = null;
    if (phaseDirEntries) {
      const normalized = phaseNum ? phaseNum.padStart(2, '0') : null;
      if (normalized) {
        const dirMatch = phaseDirEntries.find(d => {
          // Match: "05-name" or "5-name" or just "05"
          const token = d.match(/^(\d+[A-Z]?(?:\.\d+)*)(?:-|$)/i)?.[1];
          return token && token.padStart(2, '0') === normalized;
        });
        if (dirMatch) {
          try {
            phaseFiles = readdirSync(join(phasesDir, dirMatch));
          } catch { /* ignore */ }
        }
      }
    }

    const planCount = (childrenByParent[bead.id] ?? [])
      .filter(c => Array.isArray(c.labels) && c.labels.includes('gsd:plan')).length;

    // D-06 refined: summary_count = count of CLOSED gsd:plan children.
    const bdSummaryCount = (childrenByParent[bead.id] ?? [])
      .filter(c => Array.isArray(c.labels) && c.labels.includes('gsd:plan') && c.status === 'closed').length;

    const diskPlanCount = phaseFiles
      ? phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length
      : 0;
    const diskSummaryCount = phaseFiles
      ? phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length
      : 0;
    const hasContext = phaseFiles
      ? phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md')
      : false;
    const hasResearch = phaseFiles
      ? phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md')
      : false;

    const diskStatus = deriveDiskStatus({
      planCount,
      summaryCount: bdSummaryCount,
      hasContext,
      hasResearch,
      dirExists: phaseFiles !== null,
    });

    // Extract name and goal from bead title/description.
    // Title format: "v0.2 Phase A: findBeadsRoot" → name = "v0.2 Phase A: findBeadsRoot"
    // (upstream uses full heading text; we use title as-is per D-05 parity).
    // Goal and depends_on are not stored in bd beads — emit null (D-06 disk-only fields).
    phasesWithScratch.push({
      number: phaseNum,
      name: bead.title ?? '',
      goal: null,
      depends_on: null,
      plan_count: planCount,
      summary_count: bdSummaryCount,     // D-06 refined: bd source of truth
      has_context: hasContext,
      has_research: hasResearch,
      disk_status: diskStatus,
      roadmap_complete: bead.status === 'closed',
      // Scratch fields for drift computation — stripped before emit.
      _bdStatus: bead.status,
      _bdSummaryCount: bdSummaryCount,
      _diskSummaryCount: diskSummaryCount,
      _diskPlanCount: diskPlanCount,
    });
  }

  // D-21: current_phase = first planned or partial; next_phase = first empty/no_directory/discussed/researched.
  const currentPhaseObj = phasesWithScratch.find(
    p => p.disk_status === 'planned' || p.disk_status === 'partial'
  ) ?? null;
  const nextPhaseObj = phasesWithScratch.find(
    p => p.disk_status === 'empty' || p.disk_status === 'no_directory' ||
         p.disk_status === 'discussed' || p.disk_status === 'researched'
  ) ?? null;
  const currentPhase = currentPhaseObj ? currentPhaseObj.number : null;
  const nextPhase = nextPhaseObj ? nextPhaseObj.number : null;

  // D-15..D-17: milestones[] — one entry for current milestone.
  const heading = loadMilestoneHeading(memories, currentMilestone);
  const milestones = [{ heading, version: currentMilestone }];

  // Aggregates.
  const totalPlans = phasesWithScratch.reduce((s, p) => s + p.plan_count, 0);
  const totalSummaries = phasesWithScratch.reduce((s, p) => s + p.summary_count, 0);
  const completedPhases = phasesWithScratch.filter(p => p._bdStatus === 'closed').length;  // D-14
  const progressPercent = totalPlans > 0
    ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100))
    : 0;

  // D-08..D-12: drift detection (channel 2 — array) + channel 1 (stderr per entry in detectDrift).
  const driftEntries = [];
  for (const p of phasesWithScratch) {
    driftEntries.push(...detectDrift(
      p.number,
      { plan_count: p.plan_count, summary_count: p._bdSummaryCount, bd_status: p._bdStatus },
      { disk_plan_count: p._diskPlanCount, disk_summary_count: p._diskSummaryCount }
    ));
  }
  // Aggregate-level drift: completed_phases_mismatch.
  const diskCompleted = phasesWithScratch.filter(p => p.disk_status === 'complete').length;
  if (completedPhases !== diskCompleted) {
    console.error(`[gsd-shadow] DRIFT: completed_phases bd=${completedPhases} disk=${diskCompleted}`);
    driftEntries.push({
      phase: '*',
      kind: 'completed_phases_mismatch',
      bd_value: completedPhases,
      disk_value: diskCompleted,
    });
  }

  // Strip scratch fields before emit.
  const phases = phasesWithScratch.map(({
    _bdStatus, _bdSummaryCount, _diskSummaryCount, _diskPlanCount,
    ...rest
  }) => rest);

  return {
    data: {
      milestones,
      phases,
      phase_count: phases.length,
      completed_phases: completedPhases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      progress_percent: progressPercent,
      current_phase: currentPhase,
      next_phase: nextPhase,
      missing_phase_details: null,  // N/A for bd-backed (no checklist parsing)
      backend: 'beads',
      drift: driftEntries,
    },
  };
}

// ─── beadsRoadmapGetPhase ───────────────────────────────────────────────────
// REQ-READ-02: Single-phase view from bd.
// D-20: numeric phase identifiers only (whole or decimal). Fuzzy/title matching
// is Phase 8's find-phase responsibility.
//
// Returns {data:{found,phase_number,phase_name,goal,success_criteria,section,backend}}
// on FOUND case; {data:{found:false,phase_number:arg,backend:'beads'}} on UNMATCHED.
//
// Cross-handler parity (SC #3): the overlapping semantic fields (phase_number,
// phase_name, goal) MUST match roadmap.analyze.phases[N] byte-for-byte. The
// non-overlapping fields (success_criteria, section) are unique to get-phase.
// KEY REMAP: roadmap.analyze emits `number`/`name`; this handler emits `phase_number`/`phase_name`.
// The cross-handler-parity test asserts SAME VALUES under DIFFERENT keys.
async function beadsRoadmapGetPhase(args, projectDir) {
  // Argument validation (graceful — return {found:false} rather than throw, so
  // upstream-shape parity is preserved on usage errors)
  const phaseArg = args[0];
  if (!phaseArg) {
    return { data: { found: false, error: 'Usage: roadmap.get-phase <phase-number>', backend: 'beads' } };
  }

  // D-24: find bd root or throw BeadsEmpty (dispatcher catches and falls through).
  const root = findBeadsRoot(projectDir);
  if (!root) throw new BeadsEmpty('roadmap.get-phase: project is not bd-managed');

  // D-27: SINGLE bd export call — no per-phase fan-out (one spawn budget for get-phase).
  const allBeads = bd(['export', '--json'], { cwd: root });
  if (!Array.isArray(allBeads)) {
    throw new BeadsCorrupt(`bd export --json returned non-array: ${typeof allBeads}`);
  }

  // D-19: current milestone from worktree git config / env / fallback.
  const currentMilestone = readGitConfigMilestone(projectDir);

  // D-20 lookup: find phase bead with phase-id:<arg> label.
  // parsePhaseId normalizes zero-padding: input '5' matches label 'phase-id:05'.
  // Decimal IDs work: input '72.1' matches label 'phase-id:72.1' (D-02).
  const phaseBead = allBeads.find(b => {
    if (!Array.isArray(b.labels)) return false;
    if (!b.labels.includes('gsd:phase')) return false;
    if (!b.labels.includes(`version:${currentMilestone}`)) return false;
    const phaseIdLabel = b.labels.find(l => l.startsWith('phase-id:'));
    const num = parsePhaseId(phaseIdLabel);
    return num === phaseArg;
  });

  if (!phaseBead) {
    return { data: { found: false, phase_number: phaseArg, backend: 'beads' } };
  }

  // Extract goal and success_criteria from bead description (Spike 007 format contract).
  // Currently build-seed.sh creates phases without description body, so both are empty/null.
  const desc = phaseBead.description ?? '';
  // Goal: line-based match (e.g. "Goal: Read-side detection...")
  const goalMatch = desc.match(/^Goal:\s*(.+)$/m);
  const goal = goalMatch ? goalMatch[1].trim() : null;

  // Success Criteria: capture bulleted/numbered list after "Success Criteria:" heading
  const success_criteria = [];
  const scMatch = desc.match(/^Success Criteria:?\s*\n([\s\S]*?)(?:\n\s*\n|\n#|$)/m);
  if (scMatch) {
    for (const line of scMatch[1].split('\n')) {
      const itemMatch = line.match(/^\s*(?:[-*]|\d+[.)])\s*(.+)$/);
      if (itemMatch) success_criteria.push(itemMatch[1].trim());
    }
  }

  // SC #3 cross-handler parity: phase_name MUST match analyze's `name` field byte-for-byte.
  // analyze uses `bead.title ?? ''` without stripping; get-phase mirrors this exactly.
  // KEY REMAP: analyze→`name`, get-phase→`phase_name`; VALUES must be equal.
  const phase_number = parsePhaseId(phaseBead.labels.find(l => l.startsWith('phase-id:')));
  const phase_name = phaseBead.title ?? '';

  // Synthesize section as markdown (bd is source of truth — do NOT read .planning/ROADMAP.md).
  // Format: "### Phase <N>: <name>\n\n<description>"
  const section = `### Phase ${phase_number}: ${phase_name}\n\n${desc}`.trimEnd();

  return {
    data: {
      found: true,
      phase_number,
      phase_name,
      goal,
      success_criteria,
      section,
      backend: 'beads',
    },
  };
}

// ─── BEADS_READ_OVERRIDES table ────────────────────────────────────────────
// Phase 5+: real read handlers. Registered WITHOUT wrapMutation —
// reads do NOT emit GSDEvent.StateMutation (D-09 forward-compat).
export const BEADS_READ_OVERRIDES = {
  'roadmap.analyze': beadsRoadmapAnalyze,
  'roadmap.get-phase': beadsRoadmapGetPhase,
};

// isKnownBdCliError — D-12: bd-CLI failures (binary missing, ENOENT) fall through to upstream
// alongside BeadsUnavailableError. Real bugs (TypeError etc.) keep v0.1 loud-fail behavior.
function isKnownBdCliError(err) {
  if (err && err.code === 'ENOENT') return true;
  return /command not found|bd: not found|ENOENT/i.test(err?.message ?? '');
}

// ─── CLI main — only runs when executed directly (not imported as module) ──
// This guard allows tests to import BEADS_OVERRIDES without triggering CLI logic.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  await main();
}

async function main() {
  // ─── Argv routing ────────────────────────────────────────────────────────
  const argv = process.argv.slice(2);

  function isBeadsManaged(projectDir) {
    return existsSync(resolve(projectDir, '.beads/metadata.json'));
  }

  // T-02-04 mitigation: getProjectDir validates path with existsSync before returning.
  // Pitfall 4: --project-dir is position-agnostic find; value valid in either position.
  function getProjectDir(argv) {
    const idx = argv.indexOf('--project-dir');
    if (idx !== -1 && argv[idx + 1]) {
      const v = resolve(argv[idx + 1]);
      // Validate it's a real directory before using it.
      if (existsSync(v)) return v;
    }
    return process.cwd();
  }

  function spawnUpstream(argv) {
    log('passthrough →', UPSTREAM_BIN, argv.join(' '));
    const result = spawnSync(UPSTREAM_BIN, argv, { stdio: 'inherit', env: process.env });
    process.exit(result.status ?? 1);
  }

  // If no 'query' token → not a query command, pass through to upstream
  const queryIdx = argv.indexOf('query');
  if (queryIdx === -1) spawnUpstream(argv);

  // T-02-04: using resolveQueryArgv (SDK primitive), not naive split
  const projectDir = getProjectDir(argv);
  if (!isBeadsManaged(projectDir)) {
    log(`${projectDir} is not beads-managed; passing to upstream.`);
    spawnUpstream(argv);
  }

  // Beads-managed + query — use SDK primitives via dynamic import (REQ-02: no fork).
  const queryModule = await import(QUERY_INDEX_PATH);
  const registryModule = await import(REGISTRY_PATH);

  // sessionId: best-effort from env or random per-process value
  const sessionId = process.env.GSD_SESSION_ID ?? `shadow-${process.pid}-${Date.now()}`;
  // MVP: eventStream = null → wrapMutation is a no-op (W3 invariant; D-09 forward-compat preserved).
  const eventStream = null;

  const registry = queryModule.createRegistry(eventStream, sessionId);

  // Register and re-wrap each override with GSDEvent emission (D-09).
  for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
    registry.register(cmd, wrapMutation(handler, cmd, eventStream, sessionId));
  }

  // Register read overrides WITHOUT wrapMutation (D-09: reads don't emit StateMutation events).
  for (const [cmd, handler] of Object.entries(BEADS_READ_OVERRIDES)) {
    registry.register(cmd, handler);
  }

  // Build queryArgv: strip --project-dir <value> (handled above) from slice after 'query'
  const queryArgv = argv.slice(queryIdx + 1).filter((a, i, arr) => {
    if (a === '--project-dir') return false;
    if (i > 0 && arr[i - 1] === '--project-dir') return false;
    return true;
  });

  // Strip --pick before resolveQueryArgv (SDK convention: extract before dispatch)
  const pickIdx = queryArgv.indexOf('--pick');
  let pickField;
  if (pickIdx !== -1) {
    pickField = queryArgv[pickIdx + 1];
    queryArgv.splice(pickIdx, 2);
  }

  // T-02-04: resolveQueryArgv handles dotted + space-aliased forms via longest-prefix scan.
  const matched = registryModule.resolveQueryArgv(queryArgv, registry);
  if (!matched) {
    log(`unknown command "${queryArgv.join(' ')}"; passing to upstream.`);
    spawnUpstream(argv);
  }

  try {
    const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
    console.log(pickField !== undefined
      ? registryModule.extractField(result.data, pickField)
      : JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    if (err instanceof BeadsUnavailableError || isKnownBdCliError(err)) {
      log(`read fall-through (${err?.name ?? 'bd CLI error'}): ${err?.message}`);
      spawnUpstream(argv);
      return;  // BLOCKER-1: explicit return so dispatch-failed branch is structurally
               // unreachable for sentinel/bd-CLI errors, independent of spawnUpstream's
               // process.exit side effect. Without this, a future refactor that makes
               // spawnUpstream return (e.g., Promise-based, or test-harness mock of
               // process.exit) would silently double-emit and defeat the contract.
    }
    console.error(`[gsd-sdk-shadow] dispatch failed: ${err.message}`);
    process.exit(1);
  }
}
