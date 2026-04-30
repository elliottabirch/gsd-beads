// tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs
// D-19: roadmap.analyze filters phases by current milestone.
// Topology mirrors milestone-scoping.test.mjs: two worktrees (WT-A=v0.2, WT-B=v0.3)
// sharing one bd store; each worktree has git config --worktree gsd-beads.milestone set.
// Plan 05-03 Task 2.

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

function writeMinimalRoadmap(dir) {
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(
    join(dir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Milestone v0.2 — Beads-backed reads\n\n### Phase 3: findBeadsRoot\n\n## Milestone v0.3 — Optimization\n\n### Phase 10: caching\n`,
  );
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);
}

// Build two-worktree topology sharing one bd store (mirrors milestone-scoping.test.mjs).
// T-04-19 mitigation: extensions.worktreeConfig=true set BEFORE git worktree add.
function multiMilestoneFixture() {
  const root = mkdtempSync(join(tmpdir(), 'gsd-ra-ms-'));
  const src = join(root, 'source');
  const wtA = join(root, 'wt-a');
  const wtB = join(root, 'wt-b');
  mkdirSync(src);

  execSync('git init -q', { cwd: src });
  execSync('git config user.email t@t.t', { cwd: src });
  execSync('git config user.name t', { cwd: src });
  execSync('git config extensions.worktreeConfig true', { cwd: src });
  execSync('git commit -q --allow-empty -m init', { cwd: src });

  // Seed multi-milestone bd state (v0.1 + v0.2 + v0.3 phases).
  execSync(`bash ${SEED_FIXTURE_SH} ${src}`);

  // Add 2 worktrees.
  execSync(`git -C ${src} worktree add ${wtA} -b ms-v0.2`, { stdio: 'ignore' });
  execSync(`git -C ${src} worktree add ${wtB} -b ms-v0.3`, { stdio: 'ignore' });

  // Set worktree-local milestone (D-19).
  execSync(`git -C ${wtA} config --worktree gsd-beads.milestone v0.2`);
  execSync(`git -C ${wtB} config --worktree gsd-beads.milestone v0.3`);

  // Write minimal ROADMAP.md and STATE.md to each worktree.
  writeMinimalRoadmap(wtA);
  writeMinimalRoadmap(wtB);

  return { root, src, wtA, wtB };
}

// CASE 1: WT-A (milestone=v0.2) — phases[] contains only v0.2 phases (3-9)
test('roadmap.analyze milestone-scoping CASE 1: WT-A v0.2 → only v0.2 phases (3-9)', (t) => {
  const { root, wtA } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', wtA], { cwd: wtA });
  assert.equal(result.status, 0, `shadow failed (WT-A): ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.data.backend, 'beads', 'WT-A result should be beads-backed');
  assert.ok(parsed.data.phases.length > 0, 'WT-A should have phases');

  // All returned phases must be v0.2 phase numbers (3-9 per seed)
  const phaseNums = parsed.data.phases.map(p => p.number);
  for (const num of phaseNums) {
    assert.ok(
      ['3', '4', '5', '6', '7', '8', '9'].includes(num),
      `Phase ${num} is not a v0.2 phase; should only see phases 3-9`,
    );
  }

  // Must NOT include v0.3 phases (10, 11) or v0.1 phases (1, 2)
  assert.ok(!phaseNums.includes('1'), 'v0.1 Phase 1 should NOT appear in v0.2 view');
  assert.ok(!phaseNums.includes('2'), 'v0.1 Phase 2 should NOT appear in v0.2 view');
  assert.ok(!phaseNums.includes('10'), 'v0.3 Phase 10 should NOT appear in v0.2 view');
  assert.ok(!phaseNums.includes('11'), 'v0.3 Phase 11 should NOT appear in v0.2 view');
});

// CASE 2: WT-B (milestone=v0.3) — phases[] contains only v0.3 phases (10, 11)
test('roadmap.analyze milestone-scoping CASE 2: WT-B v0.3 → only v0.3 phases (10, 11)', (t) => {
  const { root, wtB } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', wtB], { cwd: wtB });
  assert.equal(result.status, 0, `shadow failed (WT-B): ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.data.backend, 'beads', 'WT-B result should be beads-backed');
  assert.ok(parsed.data.phases.length > 0, 'WT-B should have phases');

  // All returned phases must be v0.3 phase numbers (10-11 per seed)
  const phaseNums = parsed.data.phases.map(p => p.number);
  for (const num of phaseNums) {
    assert.ok(
      ['10', '11'].includes(num),
      `Phase ${num} is not a v0.3 phase; should only see phases 10-11`,
    );
  }

  // Must NOT include v0.2 or v0.1 phases
  assert.ok(!phaseNums.includes('3'), 'v0.2 Phase 3 should NOT appear in v0.3 view');
  assert.ok(!phaseNums.includes('9'), 'v0.2 Phase 9 should NOT appear in v0.3 view');
  assert.ok(!phaseNums.includes('1'), 'v0.1 Phase 1 should NOT appear in v0.3 view');
});

// CASE 3: WT-A and WT-B return disjoint phase sets
test('roadmap.analyze milestone-scoping CASE 3: WT-A (v0.2) and WT-B (v0.3) return disjoint phases', (t) => {
  const { root, wtA, wtB } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const resA = runShadow(['query', 'roadmap.analyze', '--project-dir', wtA], { cwd: wtA });
  const resB = runShadow(['query', 'roadmap.analyze', '--project-dir', wtB], { cwd: wtB });

  assert.equal(resA.status, 0, `shadow failed (WT-A): ${resA.stderr}`);
  assert.equal(resB.status, 0, `shadow failed (WT-B): ${resB.stderr}`);

  const parsedA = JSON.parse(resA.stdout);
  const parsedB = JSON.parse(resB.stdout);

  const numsA = new Set(parsedA.data.phases.map(p => p.number));
  const numsB = new Set(parsedB.data.phases.map(p => p.number));

  // Disjoint: no phase number should appear in both
  for (const num of numsA) {
    assert.ok(!numsB.has(num), `Phase ${num} appears in both v0.2 and v0.3 views — should be disjoint`);
  }
});

// CASE 4: GSD_MILESTONE env var overrides git config (fallback chain test)
test('roadmap.analyze milestone-scoping CASE 4: GSD_MILESTONE env override works', (t) => {
  // Use a fresh beads fixture without git worktree config — rely on GSD_MILESTONE env.
  const dir = mkdtempSync(join(tmpdir(), 'gsd-ra-ms-env-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  execSync(`bash ${SEED_FIXTURE_SH} ${dir}`);
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(
    join(dir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Milestone v0.2 — Beads-backed reads\n\n### Phase 3: findBeadsRoot\n\n## Milestone v0.3 — Optimization\n\n### Phase 10: caching\n`,
  );
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);

  // GSD_MILESTONE=v0.3 should override and return only v0.3 phases
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.3' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.data.backend, 'beads', 'should be beads-backed');
  const phaseNums = parsed.data.phases.map(p => p.number);
  assert.ok(!phaseNums.includes('3'), 'v0.2 phases should NOT appear when GSD_MILESTONE=v0.3');
  assert.ok(phaseNums.some(n => ['10', '11'].includes(n)), 'v0.3 phases should appear when GSD_MILESTONE=v0.3');
});
