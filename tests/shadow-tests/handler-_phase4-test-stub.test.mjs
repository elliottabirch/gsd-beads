// tests/shadow-tests/handler-_phase4-test-stub.test.mjs
// REQ-QUAL-02 — proves dispatch wiring + sentinel fall-through end-to-end.
// 6 cases: happy path + 4 sentinel subtypes (BeadsNotInstalled, BeadsCorrupt,
// BeadsVersionMismatch, BeadsEmpty) + real-bug TypeError (loud-fail).
//
// CASE 6 (TypeError) asserts BOTH non-zero exit AND dispatch-failed marker
// per BLOCKER-1 — both conditions together prove the structural contract is
// exercised, not just side-effect ordering.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');

function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-stub-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

function runShadow(args, dir, env = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    cwd: dir,
    env: { ...process.env, ...env },
  });
}

// CASE 1: happy path — stub registered + dispatched, returns {data:{ok:true,backend:'beads'}}
test('_phase4-test-stub CASE 1: happy path — dispatch reaches read handler', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1' }
    );
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.ok, true);
    assert.equal(parsed.data.backend, 'beads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: BeadsNotInstalled subtype → dispatcher falls through to upstream
test('_phase4-test-stub CASE 2: BeadsNotInstalled — dispatcher falls through', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'not-installed' }
    );
    assert.doesNotMatch(result.stderr,
      /\[gsd-sdk-shadow\] dispatch failed/,
      `expected fall-through, got dispatch-failed: ${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: BeadsCorrupt subtype → dispatcher falls through to upstream
test('_phase4-test-stub CASE 3: BeadsCorrupt — dispatcher falls through', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'corrupt' }
    );
    assert.doesNotMatch(result.stderr,
      /\[gsd-sdk-shadow\] dispatch failed/,
      `expected fall-through, got dispatch-failed: ${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 4: BeadsVersionMismatch subtype → dispatcher falls through to upstream
test('_phase4-test-stub CASE 4: BeadsVersionMismatch — dispatcher falls through', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'version-mismatch' }
    );
    assert.doesNotMatch(result.stderr,
      /\[gsd-sdk-shadow\] dispatch failed/,
      `expected fall-through, got dispatch-failed: ${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 5: BeadsEmpty subtype → dispatcher falls through to upstream
test('_phase4-test-stub CASE 5: BeadsEmpty — dispatcher falls through', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'empty' }
    );
    assert.doesNotMatch(result.stderr,
      /\[gsd-sdk-shadow\] dispatch failed/,
      `expected fall-through, got dispatch-failed: ${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 6: real TypeError — preserves v0.1 loud-fail.
// BLOCKER-1: assert BOTH non-zero exit AND dispatch-failed marker.
// Asserting BOTH ensures a regression in the BLOCKER-1 `return;` (which would
// cause sentinel paths to also reach the dispatch-failed line) is caught —
// not just an exit-code regression.
test('_phase4-test-stub CASE 6: real TypeError — exits non-zero AND emits dispatch-failed', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'typeerror' }
    );
    assert.notEqual(result.status, 0,
      `real bug must exit non-zero, got status=${result.status}, stderr=${result.stderr}`);
    assert.match(result.stderr, /\[gsd-sdk-shadow\] dispatch failed/,
      `real bug must emit dispatch-failed marker; stderr=${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
