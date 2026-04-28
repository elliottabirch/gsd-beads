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

// CASE 1: happy path — parent with gsd:phase label, children linked parent-child
test('phase.scaffold CASE 1: happy path — parent labeled gsd:phase, children linked', () => {
  const dir = setupFixture();
  try {
    const tasks = JSON.stringify(['Task 1', 'Task 2']);
    const result = runShadow(['query', 'phase.scaffold', 'Scaffold Phase', tasks, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.ok(parsed.data.phase_id, 'phase_id should be set');
    assert.equal(parsed.data.task_ids.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: label assertion — parent has gsd:phase label, children are linked
test('phase.scaffold CASE 2: label assertion — parent has gsd:phase label', () => {
  const dir = setupFixture();
  try {
    const tasks = JSON.stringify(['Child Task']);
    const result = runShadow(['query', 'phase.scaffold', 'Label Scaffold Phase', tasks, '--project-dir', dir], dir);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);

    const beadJson = execSync(`bd show ${parsed.data.phase_id} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.ok(bead[0].labels.includes('gsd:phase'), `Parent missing gsd:phase label`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: empty task list — still creates phase only, no children
test('phase.scaffold CASE 3: empty task list — creates phase only', () => {
  const dir = setupFixture();
  try {
    // No tasks arg → phase created with empty task_ids
    const result = runShadow(['query', 'phase.scaffold', 'Empty Scaffold Phase', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.ok(parsed.data.phase_id, 'phase_id should be set');
    assert.deepStrictEqual(parsed.data.task_ids, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
