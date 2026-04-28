#!/usr/bin/env node
// Shadow gsd-sdk binary — proof of concept for Architecture Y1.
//
// Intercepts state-bearing mutation commands and routes them to bd-backed
// handlers. For everything else, spawns the upstream gsd-sdk binary
// transparently.
//
// Install: chmod +x this file, symlink to ~/.local/bin/gsd-sdk (in PATH
// ahead of upstream's). Original at ~/.volta/bin/gsd-sdk is shadowed.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Locate upstream binary (volta-managed in this dev env)
const UPSTREAM_BIN = process.env.GSD_SDK_UPSTREAM
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/bin/gsd-sdk.js`;

// State-bearing mutation commands → beads-backed handlers
// (handlers return null/string-shape compatible with QueryResult)
const STATE_BEARING_HANDLERS = {
  'phase.add': beadsPhaseAdd,
  'phase add': beadsPhaseAdd,
  'phase.add-batch': beadsPhaseAddBatch,
  'phase add-batch': beadsPhaseAddBatch,
  'phase.insert': beadsPhaseInsert,
  'phase insert': beadsPhaseInsert,
  'phase.complete': beadsPhaseComplete,
  'phase complete': beadsPhaseComplete,
  'phase.remove': beadsPhaseRemove,
  'phase remove': beadsPhaseRemove,
  'phase.scaffold': beadsPhaseScaffold,
  'phase scaffold': beadsPhaseScaffold,
  'phases.clear': beadsPhasesClear,
  'phases clear': beadsPhasesClear,
  'phases.archive': beadsPhasesArchive,
  'phases archive': beadsPhasesArchive,
  'roadmap.update-plan-progress': beadsRoadmapUpdatePlanProgress,
  'roadmap update-plan-progress': beadsRoadmapUpdatePlanProgress,
  'roadmap.annotate-dependencies': beadsRoadmapAnnotateDeps,
  'roadmap annotate-dependencies': beadsRoadmapAnnotateDeps,
  'requirements.mark-complete': beadsRequirementsMarkComplete,
  'requirements mark-complete': beadsRequirementsMarkComplete,
  'todo.complete': beadsTodoComplete,
  'todo complete': beadsTodoComplete,
  'milestone.complete': beadsMilestoneComplete,
  'milestone complete': beadsMilestoneComplete,
};

// ─── Argv routing ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function isBeadsManaged(projectDir) {
  return existsSync(resolve(projectDir, '.beads/metadata.json'));
}

function findQueryCommand(argv) {
  // Find `query` flag, return [cmd, restArgs] or null
  // Handles: gsd-sdk [--project-dir x] query <cmd> [args...]
  const idx = argv.indexOf('query');
  if (idx === -1) return null;

  // Look ahead 1 or 2 tokens for the command (handles space-aliased like "phase add")
  const first = argv[idx + 1];
  if (!first) return null;
  const second = argv[idx + 2];
  const twoWord = second && !second.startsWith('-') ? `${first} ${second}` : null;

  // Prefer two-word match if it's in the handler set
  if (twoWord && STATE_BEARING_HANDLERS[twoWord]) {
    return { cmd: twoWord, args: argv.slice(idx + 3), tokensConsumed: 2 };
  }
  if (STATE_BEARING_HANDLERS[first]) {
    return { cmd: first, args: argv.slice(idx + 2), tokensConsumed: 1 };
  }
  return { cmd: first, args: argv.slice(idx + 2), tokensConsumed: 1, passthrough: true };
}

function getProjectDir(argv) {
  const idx = argv.indexOf('--project-dir');
  if (idx !== -1 && argv[idx + 1]) return resolve(argv[idx + 1]);
  return process.cwd();
}

function spawnUpstream(argv) {
  const result = spawnSync(UPSTREAM_BIN, argv, {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const projectDir = getProjectDir(argv);
const matched = findQueryCommand(argv);

if (!matched || matched.passthrough) {
  // Not a query, or query command we don't override — pass through
  spawnUpstream(argv);
} else if (!isBeadsManaged(projectDir)) {
  // We have a beads handler for this command, but project isn't beads-managed
  console.error(`[gsd-sdk-shadow] Project ${projectDir} is not beads-managed (.beads/metadata.json missing); passing to upstream.`);
  spawnUpstream(argv);
} else {
  // Run our beads-backed handler
  const handler = STATE_BEARING_HANDLERS[matched.cmd];
  try {
    const result = await handler(matched.args, projectDir);
    if (result !== undefined) console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error(`[gsd-sdk-shadow] beads handler failed: ${err.message}`);
    process.exit(1);
  }
}

// ─── Beads handlers (POC: only phase.add fully implemented) ──────────────────

async function beadsPhaseAdd(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  const { execSync } = await import('node:child_process');
  // Step 1: create the bead with type=epic + label gsd:phase
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(
    `bd label add ${beadId} gsd:phase`,
    { cwd: projectDir }
  );
  // Step 2: would normally trigger bd-sync.sh to regenerate ROADMAP.md
  return { phase_id: beadId, title, status: 'added', backend: 'beads' };
}

async function beadsPhaseAddBatch() { throw new Error('Not yet implemented'); }
async function beadsPhaseInsert() { throw new Error('Not yet implemented'); }
async function beadsPhaseComplete() { throw new Error('Not yet implemented'); }
async function beadsPhaseRemove() { throw new Error('Not yet implemented'); }
async function beadsPhaseScaffold() { throw new Error('Not yet implemented'); }
async function beadsPhasesClear() { throw new Error('Not yet implemented'); }
async function beadsPhasesArchive() { throw new Error('Not yet implemented'); }
async function beadsRoadmapUpdatePlanProgress() { throw new Error('Not yet implemented'); }
async function beadsRoadmapAnnotateDeps() { throw new Error('Not yet implemented'); }
async function beadsRequirementsMarkComplete() { throw new Error('Not yet implemented'); }
async function beadsTodoComplete() { throw new Error('Not yet implemented'); }
async function beadsMilestoneComplete() { throw new Error('Not yet implemented'); }
