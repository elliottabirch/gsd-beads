// tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs
// SC #2 verification: total_plans matches bd count -l gsd:plan;
// completed_phases matches count of closed phase epics (D-14).
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
  });
}

function beadsFixtureWithRoadmap() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-ra-counts-'));
  execSync(`bash ${SEED_FIXTURE_SH} ${dir}`, { encoding: 'utf-8' });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n## Milestone v0.2 — Beads-backed reads\n\n### Phase 3: findBeadsRoot\n\n### Phase 4: roadmap reads\n\n### Phase 5: progress reads\n\n### Phase 6: state reads\n\n### Phase 7: phase resolution\n\n### Phase 8: init reads\n\n### Phase 9: hook audit\n`);
  writeFileSync(join(dir, '.planning', 'STATE.md'), `---\nmilestone: v0.2\n---\n`);
  return dir;
}

// CASE 1: total_plans matches the sum of gsd:plan children under v0.2 phase epics
test('roadmap.analyze-counts CASE 1: total_plans matches bd gsd:plan children count', (t) => {
  const dir = beadsFixtureWithRoadmap();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Get the bd export to count gsd:plan beads in v0.2 scope independently.
  // bd export --json outputs JSONL (one JSON object per line), not a JSON array.
  const bdExportRaw = execSync('bd export --json', { cwd: dir, encoding: 'utf-8' });
  const allBeads = bdExportRaw.trim().split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

  // Find v0.2 phase epic IDs
  const v02PhaseIds = new Set(
    allBeads
      .filter(b => Array.isArray(b.labels) && b.labels.includes('gsd:phase') && b.labels.includes('version:v0.2'))
      .map(b => b.id),
  );

  // Count gsd:plan children whose parent is a v0.2 phase epic
  const bdPlanCount = allBeads.filter(b => {
    if (!Array.isArray(b.labels) || !b.labels.includes('gsd:plan')) return false;
    if (!Array.isArray(b.dependencies)) return false;
    return b.dependencies.some(d => d.type === 'parent-child' && v02PhaseIds.has(d.depends_on_id));
  }).length;

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  assert.equal(
    parsed.data.total_plans,
    bdPlanCount,
    `total_plans (${parsed.data.total_plans}) should equal bd plan count (${bdPlanCount})`,
  );
});

// CASE 2: completed_phases matches count of closed v0.2 phase epics (D-14)
test('roadmap.analyze-counts CASE 2: completed_phases matches closed bd phase epic count', (t) => {
  const dir = beadsFixtureWithRoadmap();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Get bd export to count closed v0.2 phase epics independently.
  // bd export --json outputs JSONL (one JSON object per line), not a JSON array.
  const bdExportRaw = execSync('bd export --json', { cwd: dir, encoding: 'utf-8' });
  const allBeads = bdExportRaw.trim().split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

  const closedV02Phases = allBeads.filter(b =>
    Array.isArray(b.labels) &&
    b.labels.includes('gsd:phase') &&
    b.labels.includes('version:v0.2') &&
    b.status === 'closed',
  ).length;

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  assert.equal(
    parsed.data.completed_phases,
    closedV02Phases,
    `completed_phases (${parsed.data.completed_phases}) should equal closed bd phase count (${closedV02Phases})`,
  );
});

// CASE 3: phase_count equals number of v0.2 phase epics in seed (should be 7: phases 3-9)
test('roadmap.analyze-counts CASE 3: phase_count equals v0.2 phase epic count from seed', (t) => {
  const dir = beadsFixtureWithRoadmap();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  // seed.jsonl has 7 v0.2 phases: phase-id:03 through phase-id:09
  assert.equal(parsed.data.phase_count, 7, `phase_count should be 7 (v0.2 phases 3-9 in seed)`);
  assert.equal(parsed.data.phases.length, 7, `phases array should have 7 entries`);
});

// CASE 4: total_summaries = sum of closed gsd:plan children (refined D-06 source of truth)
test('roadmap.analyze-counts CASE 4: total_summaries is bd-derived (closed plan children)', (t) => {
  const dir = beadsFixtureWithRoadmap();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Compute expected total_summaries from bd data.
  // bd export --json outputs JSONL (one JSON object per line), not a JSON array.
  const bdExportRaw = execSync('bd export --json', { cwd: dir, encoding: 'utf-8' });
  const allBeads = bdExportRaw.trim().split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

  const v02PhaseIds = new Set(
    allBeads
      .filter(b => Array.isArray(b.labels) && b.labels.includes('gsd:phase') && b.labels.includes('version:v0.2'))
      .map(b => b.id),
  );

  const bdSummaryCount = allBeads.filter(b => {
    if (!Array.isArray(b.labels) || !b.labels.includes('gsd:plan')) return false;
    if (b.status !== 'closed') return false;
    if (!Array.isArray(b.dependencies)) return false;
    return b.dependencies.some(d => d.type === 'parent-child' && v02PhaseIds.has(d.depends_on_id));
  }).length;

  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], {
    env: { GSD_MILESTONE: 'v0.2' },
  });
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);

  assert.equal(
    parsed.data.total_summaries,
    bdSummaryCount,
    `total_summaries (${parsed.data.total_summaries}) should equal bd closed plan count (${bdSummaryCount})`,
  );
});
