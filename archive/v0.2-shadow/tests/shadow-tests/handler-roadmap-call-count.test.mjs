// tests/shadow-tests/handler-roadmap-call-count.test.mjs
// REQ-QUAL-07 precursor: assert each handler stays within the spawn budget
// regardless of phase count. Uses PATH-mock bd that increments a counter.
//
// Budget contract (D-27):
// - roadmap.analyze: <=2 bd spawns (1 export + 1 memories)
// - roadmap.get-phase: <=1 bd spawn (1 export; no memories needed)
//
// T-05-10 mitigation: flock on counter file inside the shim ensures atomic
// increment under parallel calls (rare but possible if a future test
// parallelizes shadow invocations).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Build a PATH-mock bd shim that:
 *   - increments a counter file on every invocation (flock-protected, T-05-10)
 *   - delegates to the real bd binary so handler logic still works
 *
 * Uses t.after() for cleanup (node:test teardown convention from _parity-helpers.mjs).
 * Returns { counterFile }.
 *
 * @param {import('node:test').TestContext} t
 * @returns {{ counterFile: string }}
 */
function withMockBd(t) {
  const mockDir = mkdtempSync(join(tmpdir(), 'gsd-bd-mock-'));
  const counterFile = join(mockDir, 'counter');
  writeFileSync(counterFile, '0\n');
  const realBd = execSync('which bd', { encoding: 'utf-8' }).trim();
  const shim = `#!/usr/bin/env bash
set -euo pipefail
# Increment counter (exclusive lock to avoid races on parallel calls, T-05-10)
{
  flock 9
  n=$(cat "${counterFile}")
  echo $((n + 1)) > "${counterFile}"
} 9>"${counterFile}.lock"
exec "${realBd}" "$@"
`;
  const shimPath = join(mockDir, 'bd');
  writeFileSync(shimPath, shim);
  chmodSync(shimPath, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${mockDir}:${oldPath}`;
  t.after(() => {
    process.env.PATH = oldPath;
    rmSync(mockDir, { recursive: true, force: true });
  });
  return { counterFile };
}

/**
 * Read the current call counter value from the mock shim's counter file.
 */
function readCount(counterFile) {
  return parseInt(readFileSync(counterFile, 'utf-8').trim(), 10);
}

/**
 * Seed a bd-managed fixture with git + .planning/phases dirs.
 * Mirrors the fixture setup in handler-roadmap-determinism.test.sh.
 * Uses t.after() for cleanup.
 *
 * @param {import('node:test').TestContext} t
 * @returns {string} fixture directory path
 */
function setupBdFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-callcount-'));
  execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${dir}`, { stdio: 'pipe' });
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email t@t.t', { cwd: dir });
  execSync('git config user.name t', { cwd: dir });
  execSync('git config extensions.worktreeConfig true', { cwd: dir });
  execSync('git commit -q --allow-empty -m init', { cwd: dir });
  execSync('git config --worktree gsd-beads.milestone v0.2', { cwd: dir });
  const phasesDir = join(dir, '.planning', 'phases');
  mkdirSync(phasesDir, { recursive: true });
  // Mirror the 11 phase dirs from build-seed.sh (seed has 11 v0.2 phases)
  const phaseDirs = [
    '01-spike', '02-build-the-layer', '03-findbeadsroot', '04-parity-infra',
    '05-roadmap-reads', '06-cache', '07-query-opt', '08-state-reads',
    '09-phase-resolution', '10-init-reads', '11-hook-audit',
  ];
  for (const d of phaseDirs) {
    mkdirSync(join(phasesDir, d), { recursive: true });
  }
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * Run shadow with the given query args in the given directory.
 * The PATH is already patched by withMockBd at this point.
 */
function runShadow(args, dir) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    cwd: dir,
    env: { ...process.env },
  });
}

// CASE 1: roadmap.analyze invokes bd <=2 times on 11-phase fixture
test('call-count CASE 1: roadmap.analyze invokes bd <=2 times on 11-phase fixture', (t) => {
  const fixture = setupBdFixture(t);
  const { counterFile } = withMockBd(t);
  const before = readCount(counterFile);
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', fixture], fixture);
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const after = readCount(counterFile);
  const calls = after - before;
  assert.ok(calls >= 1, `expected >=1 bd spawn (handler must call bd), got ${calls}`);
  assert.ok(calls <= 2, `expected <=2 bd spawns (REQ-QUAL-07 budget: export + memories), got ${calls}`);
});

// CASE 2: roadmap.get-phase invokes bd <=1 time on 11-phase fixture
test('call-count CASE 2: roadmap.get-phase invokes bd <=1 time on 11-phase fixture', (t) => {
  const fixture = setupBdFixture(t);
  const { counterFile } = withMockBd(t);
  const before = readCount(counterFile);
  const result = runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', fixture], fixture);
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const after = readCount(counterFile);
  const calls = after - before;
  assert.ok(calls >= 1, `expected >=1 bd spawn (handler must call bd), got ${calls}`);
  assert.ok(calls <= 1, `expected <=1 bd spawn (REQ-QUAL-07 budget; get-phase needs no memories), got ${calls}`);
});

// CASE 3: roadmap.analyze call count does NOT scale with phase count
// Documentary case: same 11-phase fixture, asserts EXACTLY 2 spawns.
// If a future regression introduces N+1 fan-out (e.g. per-phase bd children
// call), CASE 1 catches it because count would be 2+N where N=11 → 13 > 2.
// This case makes the exact expected count explicit as a regression guard.
test('call-count CASE 3: roadmap.analyze spawns exactly 2 (export + memories) — constant in phase count', (t) => {
  const fixture = setupBdFixture(t);
  const { counterFile } = withMockBd(t);
  const before = readCount(counterFile);
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', fixture], fixture);
  assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
  const after = readCount(counterFile);
  const calls = after - before;
  assert.equal(calls, 2, `expected exactly 2 bd spawns (export + memories), got ${calls}`);
});
