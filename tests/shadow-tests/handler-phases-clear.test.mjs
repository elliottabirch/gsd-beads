import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');

function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-handler-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

function runShadow(args, dir) {
  return spawnSync('node', [SHADOW, ...args], { encoding: 'utf-8', cwd: dir });
}

// CASE 1: happy path — all gsd:phase beads become status=closed
test('phases.clear CASE 1: happy path — all gsd:phase beads are closed', () => {
  const dir = setupFixture();
  try {
    // Create a couple of phases
    runShadow(['query', 'phase.add', 'Phase To Clear 1', '--project-dir', dir], dir);
    runShadow(['query', 'phase.add', 'Phase To Clear 2', '--project-dir', dir], dir);

    const result = runShadow(['query', 'phases.clear', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.ok(parsed.data.cleared_count >= 2, `Expected ≥2 cleared, got: ${parsed.data.cleared_count}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: returns count and backend
test('phases.clear CASE 2: returns cleared_count and backend', () => {
  const dir = setupFixture();
  try {
    runShadow(['query', 'phase.add', 'Phase For Count', '--project-dir', dir], dir);
    const result = runShadow(['query', 'phases.clear', '--project-dir', dir], dir);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.ok(typeof parsed.data.cleared_count === 'number', 'cleared_count should be a number');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: no phases → returns count 0
test('phases.clear CASE 3: no phases → returns cleared_count 0', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phases.clear', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.cleared_count, 0);
    assert.equal(parsed.data.backend, 'beads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
