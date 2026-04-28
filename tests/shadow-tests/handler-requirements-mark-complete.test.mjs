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

// CASE 1: happy path — requirement bead is closed
test('requirements.mark-complete CASE 1: happy path — bead is closed', () => {
  const dir = setupFixture();
  try {
    // Create a requirement bead
    const reqId = execSync(`bd q "REQ-01: Auth" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    execSync(`bd label add ${reqId} gsd:requirement`, { cwd: dir });

    const result = runShadow(['query', 'requirements.mark-complete', reqId, '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.req_id, reqId);
    assert.equal(parsed.data.status, 'completed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: status assertion — bead status is closed in bd
test('requirements.mark-complete CASE 2: bead status is closed in bd', () => {
  const dir = setupFixture();
  try {
    const reqId = execSync(`bd q "REQ-02: Profiles" -t epic -p 1`, { cwd: dir, encoding: 'utf-8' }).trim();
    execSync(`bd label add ${reqId} gsd:requirement`, { cwd: dir });

    runShadow(['query', 'requirements.mark-complete', reqId, '--project-dir', dir], dir);

    const beadJson = execSync(`bd show ${reqId} --json`, { cwd: dir, encoding: 'utf-8' });
    const bead = JSON.parse(beadJson);
    assert.equal(bead[0].status, 'closed', `Expected status=closed, got: ${bead[0].status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: error path — unknown req-id → exit 1
test('requirements.mark-complete CASE 3: unknown req-id → exit 1', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'requirements.mark-complete', 'nonexistent-req-xyz', '--project-dir', dir], dir);
    assert.equal(result.status, 1, `Expected exit 1, got: ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
