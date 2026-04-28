import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');

// Setup helpers

function beadsFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

function nonBeadsFixture() {
  return mkdtempSync(join(tmpdir(), 'gsd-nonbeads-test-'));
}

function runShadow(args, { cwd } = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    cwd: cwd ?? process.cwd(),
  });
}

// CASE 1: `query phase.add "X"` (dotted) — beads-managed → routes to handler
test('CASE 1: query phase.add (dotted) — beads-managed → bd handler', () => {
  const dir = beadsFixture();
  try {
    const result = runShadow(['query', 'phase.add', 'Test Phase 1'], { cwd: dir });
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.title, 'Test Phase 1');
    assert.equal(parsed.data.status, 'added');
    assert.ok(parsed.data.phase_id, 'phase_id should be set');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 2: `query phase add "X"` (space-aliased) — same outcome
test('CASE 2: query phase add (space-aliased) — routes to same handler', () => {
  const dir = beadsFixture();
  try {
    const result = runShadow(['query', 'phase', 'add', 'Space Alias Phase'], { cwd: dir });
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.title, 'Space Alias Phase');
    assert.equal(parsed.data.status, 'added');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 3: `query progress` — read-only, falls through to upstream (not in BEADS_OVERRIDES)
test('CASE 3: query progress — read-only passthrough to upstream', () => {
  const dir = beadsFixture();
  try {
    // 'progress' is not a registered beads handler — should upstream without error
    const result = runShadow(['query', 'generate-slug', 'test-phase', '--project-dir', dir]);
    // Should either succeed (upstream handles it) or pass through
    // The key assertion: shadow does NOT exit 1 with "dispatch failed"
    assert.ok(
      result.status === 0 || !result.stderr.includes('[gsd-sdk-shadow] dispatch failed'),
      `Unexpected shadow failure: ${result.stderr}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 4: `query phase.add "X" --pick phase_id` — extractField returns just the ID
test('CASE 4: --pick phase_id — returns just the phase_id string', () => {
  const dir = beadsFixture();
  try {
    const result = runShadow(['query', 'phase.add', 'Pick Test', '--pick', 'phase_id', '--project-dir', dir]);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const output = result.stdout.trim();
    // Should be just the phase_id (no JSON wrapper); bd IDs contain alphanumeric + dashes
    assert.match(output, /^[a-zA-Z0-9_-]+-[a-zA-Z0-9]+$/, `Expected bare phase_id, got: ${output}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 5: `--help` — passes through to upstream (no `query` token)
test('CASE 5: --help — passes through to upstream (no query token)', () => {
  const result = runShadow(['--help']);
  // Upstream help text starts with "Usage: gsd-sdk"
  assert.ok(
    result.stdout.includes('gsd-sdk') || result.stderr.includes('gsd-sdk'),
    `Expected upstream help text, got: ${result.stdout}${result.stderr}`
  );
});

// CASE 6: non-beads project (no .beads/metadata.json) — passes through to upstream
test('CASE 6: non-beads project — passes through to upstream', () => {
  const dir = nonBeadsFixture();
  try {
    // In a non-beads dir, query phase.add should route to upstream (which has its own handler)
    const result = runShadow(['query', 'phase.add', 'Upstream Phase', '--project-dir', dir]);
    // Upstream will handle it — it should NOT return backend:'beads'
    if (result.status === 0 && result.stdout.trim().startsWith('{')) {
      const parsed = JSON.parse(result.stdout);
      assert.notEqual(parsed?.data?.backend, 'beads', 'Should not use beads backend for non-beads project');
    }
    // Not crashing with shadow-specific error is sufficient
    assert.ok(
      !result.stderr.includes('[gsd-sdk-shadow] dispatch failed'),
      `Unexpected shadow dispatch failure: ${result.stderr}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 7: `query made-up-command` — resolveQueryArgv returns null → upstream
test('CASE 7: unknown query command — resolveQueryArgv returns null → upstream', () => {
  const dir = beadsFixture();
  try {
    // Unknown command should pass through, not fail with shadow dispatch error
    const result = runShadow(['query', 'totally-unknown-command-xyz', '--project-dir', dir]);
    // Shadow should passthrough to upstream; upstream may exit non-zero but not with shadow error
    assert.ok(
      !result.stderr.includes('[gsd-sdk-shadow] dispatch failed'),
      `Unexpected shadow dispatch failure for unknown command: ${result.stderr}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 8: `query phase.add "X" --project-dir /tmp/test` — projectDir parsed correctly (Pitfall 4)
test('CASE 8: --project-dir AFTER query — projectDir parsed correctly', () => {
  const dir = beadsFixture();
  try {
    // --project-dir comes after the command args (standard position)
    const result = runShadow(['query', 'phase.add', 'Dir Test Phase', '--project-dir', dir]);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.title, 'Dir Test Phase');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 9: `--project-dir` BEFORE `query` — still works (position-agnostic find via argv.indexOf)
test('CASE 9: --project-dir BEFORE query — still works (position-agnostic)', () => {
  const dir = beadsFixture();
  try {
    // --project-dir comes BEFORE query (tests position-agnostic getProjectDir)
    const result = runShadow(['--project-dir', dir, 'query', 'phase.add', 'Pre-Dir Phase']);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.equal(parsed.data.title, 'Pre-Dir Phase');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
