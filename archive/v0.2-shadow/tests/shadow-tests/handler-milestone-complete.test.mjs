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

// CASE 1: happy path — 'active' label removed, 'completed' label applied
test('milestone.complete CASE 1: happy path — completed label applied, active removed', () => {
  const dir = setupFixture();
  try {
    const msId = execSync(`bd q "Milestone v1.0" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    execSync(`bd label add ${msId} active`, { cwd: dir });

    const result = runShadow(['query', 'milestone.complete', msId, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.milestone_id, msId);
    assert.equal(parsed.data.status, 'completed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: label assertion — 'completed' applied, 'active' removed
test('milestone.complete CASE 2: label assertion — completed applied, active removed', () => {
  const dir = setupFixture();
  try {
    const msId = execSync(`bd q "Milestone v2.0" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    execSync(`bd label add ${msId} active`, { cwd: dir });

    runShadow(['query', 'milestone.complete', msId, '--project-dir', dir], dir);

    const beadJson = execSync(`bd show ${msId} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.ok(bead[0].labels.includes('completed'), `Missing 'completed' label`);
    assert.ok(!bead[0].labels.includes('active'), `'active' label should be removed`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — unknown milestone-id → exit 1
test('milestone.complete CASE 3: unknown milestone-id → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'milestone.complete', 'nonexistent-ms-xyz', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
