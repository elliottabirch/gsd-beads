// tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs
// SC #3: cross-handler parity between roadmap.analyze.phases[N] and roadmap.get-phase N.
// Plan 05-04 Task 2: 2 cases
//   CASE 1: overlapping semantic fields byte-equal with EXPLICIT KEY REMAP
//           - roadmap.analyze emits `number`/`name`; roadmap.get-phase emits `phase_number`/`phase_name`
//           - Values under different key names must agree for same bd source bead
//   CASE 2: deterministic consistency — run each handler twice; all 4 outputs agree on overlapping fields

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');
const SHADOW = join(REPO_ROOT, 'bin/gsd-sdk-shadow.mjs');
const SEED_FIXTURE_SH = join(REPO_ROOT, 'tests/fixtures/seed-fixture.sh');

function runShadow(args, opts = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd ?? process.cwd(),
  });
}

// Build a shared beads-managed fixture. Reuse across both cases in the same test file.
// Milestone v0.2 → 7 phase beads (phase-id:03..09).
function setupSharedFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-xh-parity-'));
  execSync(`bash ${SEED_FIXTURE_SH} ${dir}`, { encoding: 'utf-8' });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(
    join(dir, '.planning', 'ROADMAP.md'),
    [
      '# Roadmap',
      '',
      '## Milestone v0.2 — Beads-backed reads',
      '',
      '### Phase 3: findBeadsRoot',
      '### Phase 4: roadmap reads',
      '### Phase 5: progress reads',
      '### Phase 6: state reads',
      '### Phase 7: phase resolution',
      '### Phase 8: init reads',
      '### Phase 9: hook audit',
      '',
    ].join('\n'),
  );
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);
  return dir;
}

// CASE 1: overlapping keys byte-equal with EXPLICIT KEY REMAP (SC #3)
//
// roadmap.analyze emits phases[] where each entry has:
//   { number: string, name: string, goal: string|null, ... }
//
// roadmap.get-phase emits:
//   { found: true, phase_number: string, phase_name: string, goal: string|null, ... }
//
// EXPLICIT REMAP: `number` ↔ `phase_number` and `name` ↔ `phase_name`
// The SC #3 invariant asserts SAME VALUES under DIFFERENT keys.
// Both handlers read from the same bd bead source, so the overlapping semantic
// fields (phase_number/number, phase_name/name, goal) must be byte-equal.
test('roadmap cross-handler CASE 1: overlapping keys byte-equal with explicit key remap (SC #3)', (t) => {
  const dir = setupSharedFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Run roadmap.analyze
  const analyzeResult = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(analyzeResult.status, 0, `roadmap.analyze failed: ${analyzeResult.stderr}`);
  const analyzeParsed = JSON.parse(analyzeResult.stdout);
  assert.equal(analyzeParsed.data.backend, 'beads', 'analyze should use beads backend');

  // Run roadmap.get-phase 5 (phase 5 = "progress reads" in v0.2 seed)
  const getPhaseResult = runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(getPhaseResult.status, 0, `roadmap.get-phase failed: ${getPhaseResult.stderr}`);
  const getPhaseParsed = JSON.parse(getPhaseResult.stdout);
  assert.equal(getPhaseParsed.data.backend, 'beads', 'get-phase should use beads backend');
  assert.equal(getPhaseParsed.data.found, true, 'phase 5 should be found');

  // Locate phase 5 in analyze output
  const analyzePhase5 = analyzeParsed.data.phases.find(p => p.number === '5');
  assert.ok(analyzePhase5, 'analyze phases array should contain phase 5');

  const getPhase5 = getPhaseParsed.data;

  // EXPLICIT REMAP: roadmap.analyze emits `number`/`name`; roadmap.get-phase emits `phase_number`/`phase_name`.
  // The cross-handler-parity invariant asserts SAME VALUES under DIFFERENT keys.
  // Construct remapped comparison objects for strict equality on overlapping semantic fields.
  const analyzeRemapped = {
    phase_number: analyzePhase5.number,   // remap: number → phase_number
    phase_name: analyzePhase5.name,       // remap: name → phase_name
    goal: analyzePhase5.goal,
  };
  const getPhaseSubset = {
    phase_number: getPhase5.phase_number,
    phase_name: getPhase5.phase_name,
    goal: getPhase5.goal,
  };
  assert.deepStrictEqual(
    analyzeRemapped,
    getPhaseSubset,
    'overlapping semantic fields should be byte-equal after key remap (SC #3)',
  );
});

// CASE 2: deterministic consistency — run each handler twice, all 4 outputs agree on overlapping fields
// Tests REQ-QUAL-06 (deterministic ordering) precursor: same bead → same values on repeated queries.
test('roadmap cross-handler CASE 2: deterministic — repeated queries agree on overlapping fields', (t) => {
  const dir = setupSharedFixture();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const queryOpts = { env: { GSD_MILESTONE: 'v0.2' } };

  // Run both handlers twice (4 total spawns)
  const analyze1 = JSON.parse(runShadow(['query', 'roadmap.analyze', '--project-dir', dir], queryOpts).stdout);
  const analyze2 = JSON.parse(runShadow(['query', 'roadmap.analyze', '--project-dir', dir], queryOpts).stdout);
  const getPhase1 = JSON.parse(runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', dir], queryOpts).stdout);
  const getPhase2 = JSON.parse(runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', dir], queryOpts).stdout);

  // Extract phase 5 from both analyze runs (EXPLICIT REMAP: number → phase_number, name → phase_name)
  const a1p5 = analyze1.data.phases.find(p => p.number === '5');
  const a2p5 = analyze2.data.phases.find(p => p.number === '5');

  assert.ok(a1p5 && a2p5, 'phase 5 must be present in both analyze runs');

  // All 4 views of the overlapping semantic fields must agree
  const views = [
    { phase_number: a1p5.number, phase_name: a1p5.name, goal: a1p5.goal },    // analyze run 1 (remapped)
    { phase_number: a2p5.number, phase_name: a2p5.name, goal: a2p5.goal },    // analyze run 2 (remapped)
    { phase_number: getPhase1.data.phase_number, phase_name: getPhase1.data.phase_name, goal: getPhase1.data.goal },
    { phase_number: getPhase2.data.phase_number, phase_name: getPhase2.data.phase_name, goal: getPhase2.data.goal },
  ];

  for (let i = 1; i < views.length; i++) {
    assert.deepStrictEqual(
      views[i],
      views[0],
      `view[${i}] should match view[0] on overlapping fields (deterministic consistency)`,
    );
  }
});
