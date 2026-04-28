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

// CASE 1: happy path — phase.complete closes the bead
test('phase.complete CASE 1: happy path — bead is closed', () => {
  const dir = setupFixture();
  try {
    // Create a phase to complete
    const addResult = runShadow(['query', 'phase.add', 'Phase To Complete', '--project-dir', dir], dir);
    assert.equal(addResult.status, 0);
    const phaseId = JSON.parse(addResult.stdout).data.phase_id;

    const result = runShadow(['query', 'phase.complete', phaseId, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.phase_id, phaseId);
    assert.equal(parsed.data.status, 'closed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: label/status assertion — bead status is closed in bd
test('phase.complete CASE 2: bead status is closed in bd', () => {
  const dir = setupFixture();
  try {
    const addResult = runShadow(['query', 'phase.add', 'Status Check Phase', '--project-dir', dir], dir);
    const phaseId = JSON.parse(addResult.stdout).data.phase_id;

    runShadow(['query', 'phase.complete', phaseId, '--project-dir', dir], dir);

    const beadJson = execSync(`bd show ${phaseId} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.equal(bead[0].status, 'closed', `Expected status=closed, got: ${bead[0].status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — unknown phase-id → bd error → handler exits 1
test('phase.complete CASE 3: unknown phase-id → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.complete', 'nonexistent-id-xyz', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
