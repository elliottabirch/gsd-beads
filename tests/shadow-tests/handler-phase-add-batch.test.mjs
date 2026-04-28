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

// CASE 1: happy path — N beads created, all labeled gsd:phase
test('phase.add-batch CASE 1: happy path — N beads created with gsd:phase labels', () => {
  const dir = setupFixture();
  try {
    const phases = JSON.stringify(['Phase A', 'Phase B', 'Phase C']);
    const result = runShadow(['query', 'phase.add-batch', phases, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.count, 3);
    assert.equal(parsed.data.phase_ids.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: label assertion — each created bead has gsd:phase label
test('phase.add-batch CASE 2: label assertion — all beads have gsd:phase label', () => {
  const dir = setupFixture();
  try {
    const phases = JSON.stringify(['Batch Phase 1', 'Batch Phase 2']);
    const result = runShadow(['query', 'phase.add-batch', phases, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    for (const id of parsed.data.phase_ids) {
      const beadJson = execSync(`bd show ${id} --json`, { cwd: dir, encoding: 'utf-8' });
      const bead = JSON.parse(beadJson);
      assert.ok(bead[0].labels.includes('gsd:phase'), `Bead ${id} missing gsd:phase label`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — non-array JSON → handler throws
test('phase.add-batch CASE 3: non-array JSON → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.add-batch', '{"not":"array"}', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
    assert.ok(
      result.stderr.includes('not an array') || result.stderr.includes('dispatch failed'),
      `Expected error message, got: ${result.stderr}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
