#!/usr/bin/env node
// Y1 (shadow gsd-sdk) — registry-override variant.
// GSD core unmodified per REQ-02; uses dynamic import of upstream's dist/.
// D-02 invariant: 13 mutation entries (BEADS_OVERRIDES) live here.
//                 Reads (BEADS_READ_OVERRIDES) register separately; empty in Phase 4
//                 (test stub registers only when GSD_SHADOW_TEST_STUB=1).
// D-09 / W3 invariant: production eventStream=null → wrapMutation is a no-op (MVP).

import { spawnSync, execSync } from 'node:child_process';
import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
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
    if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
    const gitMarker = join(dir, '.git');
    if (existsSync(gitMarker)) {
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
      }
      return null;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ─── BEADS_READ_OVERRIDES table ────────────────────────────────────────────
// Phase 4: empty by default. Test stub registers ONLY when GSD_SHADOW_TEST_STUB=1.
// Phases 5–9 add real read handlers. Registered WITHOUT wrapMutation —
// reads do NOT emit GSDEvent.StateMutation (D-09 forward-compat).
export const BEADS_READ_OVERRIDES = {};

// _phase4-test-stub: lifecycle-bound to Phase 4. Phase 5 deletes this block + the stub registration.
if (process.env.GSD_SHADOW_TEST_STUB === '1') {
  BEADS_READ_OVERRIDES['_phase4-test-stub'] = async function phase4TestStub(args, projectDir) {
    const throwMode = process.env.GSD_SHADOW_TEST_STUB_THROW;
    if (throwMode === 'not-installed')    throw new BeadsNotInstalled('test-stub: simulated bd missing');
    if (throwMode === 'corrupt')          throw new BeadsCorrupt('test-stub: simulated metadata.json corruption');
    if (throwMode === 'version-mismatch') throw new BeadsVersionMismatch('test-stub: simulated bd version out of range');
    if (throwMode === 'empty')            throw new BeadsEmpty('test-stub: simulated empty .beads/');
    if (throwMode === 'typeerror')        throw new TypeError('test-stub: real bug');
    return { data: { ok: true, backend: 'beads' } };
  };
}

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
