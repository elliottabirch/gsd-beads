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

// CASE 1: happy path — phase.add creates a bead with gsd:phase label
test('phase.add CASE 1: happy path — creates bead with gsd:phase label', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.add', 'My Test Phase', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.title, 'My Test Phase');
    assert.equal(parsed.data.status, 'added');
    assert.ok(parsed.data.phase_id, 'phase_id should be set');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: label assertion — gsd:phase label applied to bead
test('phase.add CASE 2: label assertion — gsd:phase label applied', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.add', 'Label Test Phase', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    const beadJson = execSync(`bd show ${parsed.data.phase_id} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.ok(bead[0].labels.includes('gsd:phase'), `Expected gsd:phase label, got: ${JSON.stringify(bead[0].labels)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — empty args defaults to 'Untitled phase'
test('phase.add CASE 3: empty args defaults to "Untitled phase"', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'phase.add', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.title, 'Untitled phase');
    assert.equal(parsed.data.backend, 'beads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
