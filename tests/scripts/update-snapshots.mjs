#!/usr/bin/env node
// tests/scripts/update-snapshots.mjs
// Regenerates tests/shadow-tests/snapshots/<cmd>.json from upstream gsd-sdk-cc.
// Pre-checks gsd-sdk-cc.version.lock to prevent version drift (Pitfall 3 / D-10).
//
// Phase 4: only the `_phase4-test-stub` literal snapshot is regenerated.
// Phases 5-9 each push an additional entry into SNAPSHOTS that runs the upstream
// binary against tests/fixtures/seed.jsonl and captures stdout.
//
// Note: invokes the UPSTREAM binary directly (not the gsd-sdk PATH-shim) to
// avoid recursing through the gsd-beads shadow during version checks.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '../..');
const LOCK = join(REPO_ROOT, 'gsd-sdk-cc.version.lock');
const SNAPSHOT_DIR = join(REPO_ROOT, 'tests/shadow-tests/snapshots');

// Upstream binary discovery (mirrors bin/gsd-sdk-shadow.mjs SDK_BASE pattern).
const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
const UPSTREAM_BIN = process.env.GSD_SDK_UPSTREAM_BIN ?? `${SDK_BASE}/bin/gsd-sdk.js`;

// ─── Lockfile pre-check (Pitfall 3 mitigation) ─────────────────────────────
if (!existsSync(LOCK)) {
  console.error(`ERROR: ${LOCK} missing — refusing to write snapshots without pin`);
  process.exit(1);
}
const expected = readFileSync(LOCK, 'utf-8').trim();
if (!expected) {
  console.error(`ERROR: ${LOCK} is empty — refusing to write snapshots without pin`);
  process.exit(1);
}

// Invoke upstream binary directly (NOT `gsd-sdk` from PATH — that's the shadow).
const v = spawnSync(UPSTREAM_BIN, ['--version'], { encoding: 'utf-8' });
const actual = (v.stdout ?? '').match(/(\d+\.\d+\.\d+)/)?.[1];
if (actual !== expected) {
  console.error(`ERROR: gsd-sdk version mismatch — expected=${expected}, installed=${actual ?? '<none>'}`);
  process.exit(1);
}

// ─── Snapshot table (Phase 5+ extends this) ────────────────────────────────
// Phase 4 ships a single literal snapshot; the `_phase4-test-stub` handler
// returns a fixed shape and is wired through the shadow's GSD_SHADOW_TEST_STUB
// env var (NOT through upstream). Phases 5-9 add entries that spawnSync upstream
// against a seeded fixture and capture stdout.
const SNAPSHOTS = [
  {
    cmd: '_phase4-test-stub',
    out: join(SNAPSHOT_DIR, '_phase4-test-stub.json'),
    literal: { data: { ok: true, backend: 'beads' } },
  },
];

mkdirSync(SNAPSHOT_DIR, { recursive: true });
for (const s of SNAPSHOTS) {
  if (s.literal) {
    writeFileSync(s.out, `${JSON.stringify(s.literal, null, 2)}\n`);
    console.log(`wrote ${s.out} (literal)`);
  } else {
    // Phase 5+ branch: seed fixture, run upstream against it, capture stdout, write.
    // Reserved for downstream phases.
  }
}
console.log(`update-snapshots: wrote ${SNAPSHOTS.length} snapshot(s) at version ${expected}`);
