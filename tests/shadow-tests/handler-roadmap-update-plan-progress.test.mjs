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

// CASE 1: happy path — bead status is updated
test('roadmap.update-plan-progress CASE 1: happy path — bead status updated', () => {
  const dir = setupFixture();
  try {
    // Create a bead to update
    const beadId = execSync(`bd q "Plan Bead" -t task -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();

    const result = runShadow(['query', 'roadmap.update-plan-progress', beadId, 'closed', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.plan_id, beadId);
    assert.equal(parsed.data.status, 'closed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: status assertion — bead status is updated in bd
test('roadmap.update-plan-progress CASE 2: bead status confirmed in bd', () => {
  const dir = setupFixture();
  try {
    const beadId = execSync(`bd q "Status Plan" -t task -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    runShadow(['query', 'roadmap.update-plan-progress', beadId, 'closed', '--project-dir', dir], dir);

    const beadJson = execSync(`bd show ${beadId} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.equal(bead[0].status, 'closed', `Expected status=closed, got: ${bead[0].status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — missing args → exit 1
test('roadmap.update-plan-progress CASE 3: missing args → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'roadmap.update-plan-progress', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
