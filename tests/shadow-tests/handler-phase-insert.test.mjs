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

// CASE 1: happy path — phase.insert creates bead with gsd:phase + inserted labels
test('phase.insert CASE 1: happy path — creates bead with gsd:phase + inserted labels', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.insert', 'Inserted Phase', '2', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.title, 'Inserted Phase');
    assert.equal(parsed.data.status, 'inserted');
    assert.equal(parsed.data.priority, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: label assertion — gsd:phase AND inserted labels applied
test('phase.insert CASE 2: label assertion — gsd:phase + inserted labels applied', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.insert', 'Label Insert Phase', '1', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    const beadJson = execSync(`bd show ${parsed.data.phase_id} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.ok(bead[0].labels.includes('gsd:phase'), `Missing gsd:phase label`);
    assert.ok(bead[0].labels.includes('inserted'), `Missing inserted label`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — invalid priority (out of 0-4 range) → exit 1
test('phase.insert CASE 3: invalid priority → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.insert', 'Bad Priority Phase', '99', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
    assert.ok(
      result.stderr.includes('priority') || result.stderr.includes('dispatch failed'),
      `Expected priority error, got: ${result.stderr}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
