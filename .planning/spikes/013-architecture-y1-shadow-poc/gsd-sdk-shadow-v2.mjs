#!/usr/bin/env node
// Y1 (shadow gsd-sdk) — registry-override variant.
//
// Imports createRegistry() and the registry primitives from the SDK,
// overrides state-bearing mutation handlers via registry.register(),
// then dispatches through the SDK's own machinery. For non-query and
// unknown commands, spawns the upstream binary.
//
// vs. the argv-intercept variant in gsd-sdk-shadow.js: this one uses
// the SDK's typed QueryHandler interface, the SDK's argv resolver
// (resolveQueryArgv handles dotted/space-aliased forms automatically),
// and the SDK's mutation event wrapper. Cleaner integration; fewer
// places where our argv parsing could drift from upstream.

import { spawnSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// SDK module paths — could be resolved via require.resolve in distribution
const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;

const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;
const QUERY_INDEX_PATH = `${SDK_BASE}/sdk/dist/query/index.js`;
const REGISTRY_PATH = `${SDK_BASE}/sdk/dist/query/registry.js`;

// ─── beads-backed handlers ──────────────────────────────────────────────────
// QueryHandler signature: (args: string[], projectDir: string) => Promise<QueryResult>
// QueryResult shape: { data: any } (matches upstream's convention)

async function beadsPhaseAdd(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  // Step 1: create bead with type=epic + label gsd:phase
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
  // (Phase 2 would also trigger bd-sync.sh to regenerate ROADMAP.md)
  return { data: { phase_id: beadId, title, status: 'added', backend: 'beads' } };
}

// Stubs for the other 12 state-bearing mutations.
const stub = (name) => async () => {
  throw new Error(`beads handler ${name} not yet implemented (POC)`);
};

const BEADS_OVERRIDES = {
  'phase.add': beadsPhaseAdd,
  'phase.add-batch': stub('phase.add-batch'),
  'phase.insert': stub('phase.insert'),
  'phase.complete': stub('phase.complete'),
  'phase.remove': stub('phase.remove'),
  'phase.scaffold': stub('phase.scaffold'),
  'phases.clear': stub('phases.clear'),
  'phases.archive': stub('phases.archive'),
  'roadmap.update-plan-progress': stub('roadmap.update-plan-progress'),
  'roadmap.annotate-dependencies': stub('roadmap.annotate-dependencies'),
  'requirements.mark-complete': stub('requirements.mark-complete'),
  'todo.complete': stub('todo.complete'),
  'milestone.complete': stub('milestone.complete'),
};

// ─── Argv routing ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function isBeadsManaged(projectDir) {
  return existsSync(resolve(projectDir, '.beads/metadata.json'));
}

function getProjectDir(argv) {
  const idx = argv.indexOf('--project-dir');
  if (idx !== -1 && argv[idx + 1]) return resolve(argv[idx + 1]);
  return process.cwd();
}

function spawnUpstream(argv) {
  const result = spawnSync(UPSTREAM_BIN, argv, { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}

// Find the index of `query` in argv; everything before is flags, after is tokens
const queryIdx = argv.indexOf('query');
if (queryIdx === -1) {
  spawnUpstream(argv);
}

const projectDir = getProjectDir(argv);
if (!isBeadsManaged(projectDir)) {
  console.error(`[gsd-sdk-shadow-v2] ${projectDir} is not beads-managed; passing to upstream.`);
  spawnUpstream(argv);
}

// Beads-managed + query subcommand. Use the SDK's primitives.
const queryModule = await import(QUERY_INDEX_PATH);
const registryModule = await import(REGISTRY_PATH);

const registry = queryModule.createRegistry();

// Override state-bearing mutations
for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, handler);
}

// Use the SDK's own argv resolver — handles dotted vs space-aliased forms
const queryArgv = argv.slice(queryIdx + 1);

// Strip --pick if present (SDK convention: extract before dispatch)
const pickIdx = queryArgv.indexOf('--pick');
let pickField;
if (pickIdx !== -1) {
  pickField = queryArgv[pickIdx + 1];
  queryArgv.splice(pickIdx, 2);
}

// resolveQueryArgv expects (tokens, registry) and returns { command, args } or null
const matched = registryModule.resolveQueryArgv(queryArgv, registry);
if (!matched) {
  // Unknown command — let upstream handle (it has its own fallback to gsd-tools.cjs)
  spawnUpstream(argv);
}

// Dispatch through the SDK's own dispatch — our overrides are picked up automatically
try {
  const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
  if (pickField !== undefined) {
    console.log(registryModule.extractField(result.data, pickField));
  } else {
    console.log(JSON.stringify(result));
  }
  process.exit(0);
} catch (err) {
  console.error(`[gsd-sdk-shadow-v2] dispatch failed: ${err.message}`);
  process.exit(1);
}
