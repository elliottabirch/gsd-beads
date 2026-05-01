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

// CASE 1: happy path — blocks dep link created
test('roadmap.annotate-dependencies CASE 1: happy path — blocks dep link created', () => {
  const dir = setupFixture();
  try {
    // Create two phases
    const p1 = execSync(`bd q "Phase 1" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    const p2 = execSync(`bd q "Phase 2" -t epic -p 2`, { cwd: dir, encoding: 'utf-8' }).trim();

    const result = runShadow(['query', 'roadmap.annotate-dependencies', p1, p2, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.phase_id, p1);
    assert.equal(parsed.data.deps_added, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: deps_added assertion — correct count returned
test('roadmap.annotate-dependencies CASE 2: multiple deps counted correctly', () => {
  const dir = setupFixture();
  try {
    const p1 = execSync(`bd q "Main Phase" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    const p2 = execSync(`bd q "Dep A" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    const p3 = execSync(`bd q "Dep B" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();

    const result = runShadow(['query', 'roadmap.annotate-dependencies', p1, p2, p3, '--project-dir', dir], dir);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.deps_added, 2);
    assert.equal(parsed.data.backend, 'beads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — missing phase-id → exit 1
test('roadmap.annotate-dependencies CASE 3: missing phase-id → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'roadmap.annotate-dependencies', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
