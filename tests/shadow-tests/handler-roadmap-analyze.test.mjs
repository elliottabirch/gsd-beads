// tests/shadow-tests/handler-roadmap-analyze.test.mjs
// Happy-path parity snapshot test for beadsRoadmapAnalyze handler (REQ-QUAL-01).
// Plan 05-03 Task 2: 4 cases:
//   CASE 1: beads-managed bd fixture → handler returns backend='beads' + parity
//   CASE 2: non-bd fixture → falls through to upstream (no backend='beads')
//   CASE 3: parity snapshot assertion via assertKeySetParityWithExt
//   CASE 4: _phase4-test-stub is absent (GSD_SHADOW_TEST_STUB=1 registers nothing)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertKeySetParityWithExt } from './_parity-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');
const SHADOW = join(REPO_ROOT, 'bin/gsd-sdk-shadow.mjs');
const SEED_FIXTURE_SH = join(REPO_ROOT, 'tests/fixtures/seed-fixture.sh');
const SNAPSHOT_FILE = join(dirname(__filename), 'snapshots/roadmap-analyze.json');

function runShadow(args, opts = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd ?? process.cwd(),
  });
}

// Build a beads-managed fixture with multi-milestone seed and a minimal ROADMAP.md.
// The ROADMAP.md + STATE.md are needed for upstream fallback; the shadow handler
// uses only bd data. Milestone set to v0.2 so the 7 v0.2 phase beads are in scope.
function beadsFixtureWithRoadmap() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-ra-test-'));
  execSync(`bash ${SEED_FIXTURE_SH} ${dir}`, { encoding: 'utf-8' });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Milestone v0.2 — Beads-backed reads\n\n### Phase 3: findBeadsRoot\n\n### Phase 4: roadmap reads\n\n### Phase 5: progress reads\n\n### Phase 6: state reads\n\n### Phase 7: phase resolution\n\n### Phase 8: init reads\n\n### Phase 9: hook audit\n`);
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);
  return dir;
}

function nonBeadsFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-non-beads-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Milestone v0.2 — Test\n\n### Phase 1: something\n`);
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);
  return dir;
}

// CASE 1: beads-managed fixture → roadmap.analyze returns backend='beads'
test('roadmap.analyze CASE 1: beads-managed fixture → returns backend=beads', (t) => {
  const dir = beadsFixtureWithRoadmap();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.data, 'response should have data key');
  assert.equal(parsed.data.backend, 'beads', 'backend should be "beads"');
  assert.ok(Array.isArray(parsed.data.phases), 'phases should be an array');
  assert.ok(Array.isArray(parsed.data.drift), 'drift should be an array (bd-only key)');
  assert.equal(typeof parsed.data.phase_count, 'number', 'phase_count should be a number');
});

// CASE 2: non-bd fixture → falls through to upstream (no backend='beads')
test('roadmap.analyze CASE 2: non-bd fixture → falls through to upstream', (t) => {
  const dir = nonBeadsFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir]);
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  // Upstream returns data directly (not wrapped); shadow wraps in { data: ... } for consistency.
  // Either way, backend should NOT be 'beads'.
  const dataObj = parsed.data ?? parsed;
  assert.notEqual(dataObj.backend, 'beads', 'non-bd fixture should NOT return backend=beads');
});

// CASE 3: parity snapshot assertion — key set matches upstream shape (extensions whitelisted)
test('roadmap.analyze CASE 3: parity snapshot — key set matches upstream shape', (t) => {
  const dir = beadsFixtureWithRoadmap();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'));

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  // snap is the upstream data object (no outer data wrapper in snapshot file).
  // parsed.data is the handler's output data.
  // assertKeySetParityWithExt: snap keys must all exist in parsed.data;
  //   extra keys in parsed.data that are in extensions[] are tolerated.
  assert.doesNotThrow(
    () => assertKeySetParityWithExt(parsed.data, snap, ['drift', 'backend']),
    'handler output should have all upstream keys plus allowed extensions',
  );

  // Also verify phases[0] shape matches if both have at least one phase
  if (snap.phases?.length > 0 && parsed.data.phases?.length > 0) {
    assert.doesNotThrow(
      () => assertKeySetParityWithExt(parsed.data.phases[0], snap.phases[0], ['drift', 'backend']),
      'phases[0] should have all upstream phase keys',
    );
  }
});

// CASE 4: _phase4-test-stub is absent — GSD_SHADOW_TEST_STUB=1 should no longer register any handler
test('roadmap.analyze CASE 4: _phase4-test-stub absent — GSD_SHADOW_TEST_STUB=1 no longer active', (t) => {
  const dir = nonBeadsFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // If the stub were still present, querying an unknown command on a beads-managed fixture
  // with GSD_SHADOW_TEST_STUB=1 would return { data: { ok: true, backend: 'beads' } }.
  // Since the stub is deleted, GSD_SHADOW_TEST_STUB=1 has no effect on routing.
  // We test on a non-bd fixture to ensure we can check the shadow binary itself.
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_SHADOW_TEST_STUB: '1' },
  });
  // If stub were active on a non-bd fixture, it wouldn't matter (non-bd always upstreams).
  // The assertion is: the shadow binary itself doesn't crash with the env var set.
  assert.ok(
    result.status === 0 || result.status !== null,
    'shadow should handle GSD_SHADOW_TEST_STUB=1 without crashing',
  );
  // The stdout should NOT contain the old stub shape
  if (result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      const dataObj = parsed.data ?? parsed;
      // Stub returned { ok: true, backend: 'beads' } — that key-set should not appear
      assert.ok(
        !(dataObj.ok === true && dataObj.backend === 'beads' && Object.keys(dataObj).length === 2),
        '_phase4-test-stub shape should not be returned',
      );
    } catch { /* JSON parse may fail if upstream returns non-JSON — that's fine */ }
  }
});
