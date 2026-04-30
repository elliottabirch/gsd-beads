// tests/shadow-tests/handler-roadmap-get-phase.test.mjs
// Per-handler test for beadsRoadmapGetPhase (REQ-READ-02, D-20, SC #4, SC #5).
// Plan 05-04 Task 2: 6 cases
//   CASE 1: parity snapshot — key set matches upstream shape (extensions whitelisted)
//   CASE 2: happy path — found=true, phase_number='5', correct types, backend='beads'
//   CASE 3: decimal phase — phase-id:72.1 label lookup works (D-02 preservation)
//   CASE 4: unmatched phase — found=false, phase_number='99', backend='beads' (D-20)
//   CASE 5: non-bd passthrough — no backend='beads' in response (SC #5)
//   CASE 6: usage error (empty arg) — graceful found=false shape, no throw

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
const SNAPSHOT_FILE = join(dirname(__filename), 'snapshots/roadmap-get-phase.json');

function runShadow(args, opts = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd ?? process.cwd(),
  });
}

// Build a beads-managed fixture with multi-milestone seed + minimal .planning files.
// Milestone set to v0.2 so the 7 v0.2 phase beads (phase-id:03..09) are in scope.
// Returns the fixture directory path (caller MUST teardown via t.after).
function setupBdFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-rgp-test-'));
  execSync(`bash ${SEED_FIXTURE_SH} ${dir}`, { encoding: 'utf-8' });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(
    join(dir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Milestone v0.2 — Beads-backed reads\n\n### Phase 3: findBeadsRoot\n\n### Phase 5: progress reads\n`,
  );
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);
  return dir;
}

// CASE 1: parity snapshot — key set of beads handler output matches upstream snapshot shape
test('roadmap.get-phase CASE 1: parity snapshot — key set matches upstream shape', (t) => {
  const dir = setupBdFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf-8'));

  const result = runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.data, 'response should have data key');

  // snap is the upstream data object (no outer {data:...} wrapper in snapshot file).
  // parsed.data is the handler's output. 'backend' is the bd-only extension.
  assert.doesNotThrow(
    () => assertKeySetParityWithExt(parsed.data, snap, ['backend']),
    'handler output should have all upstream keys plus allowed extensions',
  );
});

// CASE 2: happy path — found=true, phase_number='5', correct types, backend='beads'
test('roadmap.get-phase CASE 2: happy path — found=true, correct shape', (t) => {
  const dir = setupBdFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  const d = parsed.data;

  assert.equal(d.found, true, 'found should be true for existing phase');
  assert.equal(d.phase_number, '5', 'phase_number should be "5"');
  assert.equal(typeof d.phase_name, 'string', 'phase_name should be a string');
  assert.ok(Array.isArray(d.success_criteria), 'success_criteria should be an array');
  assert.equal(typeof d.section, 'string', 'section should be a string');
  assert.equal(d.backend, 'beads', 'backend should be "beads"');
  // goal is null for seed beads (no description set by build-seed.sh)
  assert.ok(d.goal === null || typeof d.goal === 'string', 'goal should be null or string');
});

// CASE 3: decimal phase — add a bead with phase-id:72.1 label and verify lookup works
// D-02: decimal phase IDs are preserved through parsePhaseId normalization.
// Note: this test creates extra bd state in the test tempdir only; canonical seed.jsonl unmodified.
test('roadmap.get-phase CASE 3: decimal phase-id:72.1 lookup works (D-02)', (t) => {
  const dir = setupBdFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Add a decimal-phase bead to the fixture
  const beadIdRaw = execSync(
    `BEADS_ACTOR=test bd q "Decimal test phase" -t epic -p 1`,
    { cwd: dir, encoding: 'utf-8' },
  ).trim();
  // bd q outputs e.g. "sd-xxx" with trailing newline; grab the last non-empty token
  const beadId = beadIdRaw.split(/\s+/).filter(Boolean).pop();
  execSync(`BEADS_ACTOR=test bd label add ${beadId} gsd:phase`, { cwd: dir });
  execSync(`BEADS_ACTOR=test bd label add ${beadId} phase-id:72.1`, { cwd: dir });
  execSync(`BEADS_ACTOR=test bd label add ${beadId} version:v0.2`, { cwd: dir });

  const result = runShadow(['query', 'roadmap.get-phase', '72.1', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.found, true, 'decimal phase bead should be found');
  assert.equal(parsed.data.phase_number, '72.1', 'phase_number should preserve decimal "72.1"');
  assert.equal(parsed.data.backend, 'beads', 'backend should be "beads"');
});

// CASE 4: unmatched phase — phase-id:99 absent → found=false, phase_number='99' (D-20)
test('roadmap.get-phase CASE 4: unmatched phase → found=false, phase_number=arg (D-20)', (t) => {
  const dir = setupBdFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.get-phase', '99', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow should exit 0 on unmatched phase`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.found, false, 'found should be false for nonexistent phase');
  assert.equal(parsed.data.phase_number, '99', 'phase_number should echo back the arg "99"');
  assert.equal(parsed.data.backend, 'beads', 'backend should be "beads"');
});

// CASE 5: non-bd passthrough — SC #5: upstream handles non-bd projects
test('roadmap.get-phase CASE 5: non-bd fixture → falls through to upstream', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-non-beads-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(
    join(dir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Milestone v0.2 — Test\n\n### Phase 1: something\n`,
  );
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);

  const result = runShadow(['query', 'roadmap.get-phase', '1', '--project-dir', dir]);
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  // Upstream may wrap or not wrap in { data: ... }; in either case backend !== 'beads'
  const dataObj = parsed.data ?? parsed;
  assert.notEqual(dataObj.backend, 'beads', 'non-bd fixture should NOT return backend=beads');
});

// CASE 6: usage error — no phase number arg → graceful found=false, no crash
test('roadmap.get-phase CASE 6: empty arg → graceful found=false shape, exit 0', (t) => {
  const dir = setupBdFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Query with no positional argument after 'roadmap.get-phase'
  const result = runShadow(['query', 'roadmap.get-phase', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  // Handler returns {found:false, error:'Usage:...', backend:'beads'} — no throw, exit 0
  assert.equal(result.status, 0, `shadow should exit 0 on missing arg (graceful usage error)`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.found, false, 'found should be false on missing arg');
  assert.equal(parsed.data.backend, 'beads', 'backend should be beads even on usage error');
});
