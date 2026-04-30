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
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '../..');
const LOCK = join(REPO_ROOT, 'gsd-sdk-cc.version.lock');
const SNAPSHOT_DIR = join(REPO_ROOT, 'tests/shadow-tests/snapshots');
const SEED_FIXTURE_SH = join(REPO_ROOT, 'tests/fixtures/seed-fixture.sh');

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

// ─── Phase 5+ synthetic-fixture builder (Q2 Option B) ─────────────────────
// Builds a tempdir with .beads/ (seeded via seed-fixture.sh) AND a synthetic
// .planning/ROADMAP.md mirroring the v0.2 phases in seed.jsonl, then runs
// upstream gsd-sdk against it and captures stdout as the parity snapshot.
//
// The synthetic ROADMAP.md uses ### Phase N: headings matching the seed phase
// titles so upstream's phasePattern regex picks them up. STATE.md declares
// milestone: v0.2 so extractCurrentMilestone slices to the v0.2 section.
//
// No .planning/phases/ directory is created, so all phases have disk_status
// 'no_directory' from upstream's perspective (which is fine — parity test only
// checks key shapes, not values).

function buildSyntheticRoadmapMd() {
  // Mirrors v0.2 phases from seed.jsonl (phases 3-9 of v0.2 milestone).
  // Format: upstream phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi
  // Upstream milestonePattern = /##\s*(.*v(\d+(?:\.\d+)+)[^(\n]*)/gi
  return `# Roadmap

## Milestone v0.1 — Foundation

### Phase 1: Spike

**Goal:** Throwaway test of architectural assumptions.

### Phase 2: Build the layer

**Goal:** Productionize the spike POCs.

---

## Milestone v0.2 — Beads-backed reads

Extend the gsd-sdk shadow with read-side handlers.

### Phase 3: findBeadsRoot

**Goal:** Read-side detection and shared test harness.

### Phase 4: roadmap reads

**Goal:** roadmap.analyze + roadmap.get-phase.
**Depends on:** Phase 3

### Phase 5: progress reads

**Goal:** progress.json + progress + progress.bar + progress.table.
**Depends on:** Phase 4

### Phase 6: state reads

**Goal:** state-snapshot + state.json + state.load.
**Depends on:** Phase 5

### Phase 7: phase resolution

**Goal:** find-phase + phases.list + phase.next-decimal + phase-plan-index.
**Depends on:** Phase 6

### Phase 8: init reads

**Goal:** init.progress + init.milestone-op + init.todos.
**Depends on:** Phase 7

### Phase 9: hook audit

**Goal:** Verify the 12 state.* mutation handlers.
**Depends on:** Phase 8

---

## Milestone v0.3 — Optimization

### Phase 10: caching

**Goal:** Cache layer for read handlers.

### Phase 11: query optimization

**Goal:** Query optimizer for bd export calls.

`;
}

function buildSyntheticStateMd() {
  // Minimal STATE.md with milestone: v0.2 so extractCurrentMilestone slices correctly.
  return `---
milestone: v0.2
---

# Project State

**Current Milestone:** v0.2
`;
}

// Runs upstream roadmap.analyze against a synthetic fixture and returns stdout.
function captureRoadmapAnalyze() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-snapshot-'));
  try {
    // Seed bd state from seed.jsonl.
    const seed = spawnSync('bash', [SEED_FIXTURE_SH, dir], { encoding: 'utf-8' });
    if (seed.status !== 0) throw new Error(`seed-fixture.sh failed: ${seed.stderr}`);

    // Write synthetic .planning/ROADMAP.md and STATE.md.
    mkdirSync(join(dir, '.planning'), { recursive: true });
    writeFileSync(join(dir, '.planning', 'ROADMAP.md'), buildSyntheticRoadmapMd());
    writeFileSync(join(dir, '.planning', 'STATE.md'), buildSyntheticStateMd());

    // Run upstream gsd-sdk query roadmap.analyze against the synthetic fixture.
    const result = spawnSync('node', [UPSTREAM_BIN, 'query', 'roadmap.analyze', '--project-dir', dir], {
      encoding: 'utf-8',
      env: { ...process.env, GSD_MILESTONE: 'v0.2' },
    });
    if (result.status !== 0) throw new Error(`upstream roadmap.analyze failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    return parsed;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  {
    cmd: 'roadmap.analyze',
    out: join(SNAPSHOT_DIR, 'roadmap-analyze.json'),
    // Phase 5: synthetic-fixture capture (Q2 Option B).
    // Upstream runs against .beads/ (from seed.jsonl) + synthetic ROADMAP.md.
    capture: captureRoadmapAnalyze,
  },
];

mkdirSync(SNAPSHOT_DIR, { recursive: true });
for (const s of SNAPSHOTS) {
  if (s.literal) {
    writeFileSync(s.out, `${JSON.stringify(s.literal, null, 2)}\n`);
    console.log(`wrote ${s.out} (literal)`);
  } else if (s.capture) {
    // Phase 5+ branch: seed fixture, run upstream against it, capture stdout, write.
    const captured = s.capture();
    writeFileSync(s.out, `${JSON.stringify(captured, null, 2)}\n`);
    console.log(`wrote ${s.out} (captured from upstream)`);
  }
}
console.log(`update-snapshots: wrote ${SNAPSHOTS.length} snapshot(s) at version ${expected}`);
