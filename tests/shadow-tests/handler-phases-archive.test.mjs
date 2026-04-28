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

// CASE 1: happy path — all gsd:phase beads get 'archived' label
test('phases.archive CASE 1: happy path — all gsd:phase beads get archived label', () => {
  const dir = setupFixture();
  try {
    const addResult = runShadow(['query', 'phase.add', 'Phase To Archive', '--project-dir', dir], dir);
    const phaseId = JSON.parse(addResult.stdout).data.phase_id;

    const result = runShadow(['query', 'phases.archive', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.ok(parsed.data.archived_count >= 1, `Expected ≥1 archived, got: ${parsed.data.archived_count}`);

    // Verify the label was applied
    const beadJson = execSync(`bd show ${phaseId} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.ok(bead[0].labels.includes('archived'), `Missing archived label on ${phaseId}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: returns archived_count and backend
test('phases.archive CASE 2: returns archived_count and backend', () => {
  const dir = setupFixture();
  try {
    runShadow(['query', 'phase.add', 'Archive Count Phase', '--project-dir', dir], dir);
    const result = runShadow(['query', 'phases.archive', '--project-dir', dir], dir);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.ok(typeof parsed.data.archived_count === 'number', 'archived_count should be a number');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: no phases → returns count 0
test('phases.archive CASE 3: no phases → returns archived_count 0', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phases.archive', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.archived_count, 0);
    assert.equal(parsed.data.backend, 'beads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
