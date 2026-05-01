// tests/unit/memories-seeded.test.mjs
// D-18: validates that build-seed.sh seeds milestone-heading memories.
// D-17 fallback: validates v0.3 memory is deliberately absent.
//
// Wave 0 stub: runs RED before Task 2 edits build-seed.sh,
// runs GREEN after Task 2 regenerates seed.jsonl with memory entries.
//
// Test structure uses t.after() teardown per PITFALLS migration recommendation
// (milestone-scoping.test.mjs lines 63, 73 pattern).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * buildSeedFixture(t)
 * Runs build-seed.sh (regenerates seed.jsonl), then restores via seed-fixture.sh
 * into a fresh tempdir so bd memories --json reflects the seeded content.
 * Registers t.after() cleanup so tempdir is removed when the test finishes.
 */
function buildSeedFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-memories-'));
  // Regenerate seed.jsonl (includes memory entries after Task 2)
  execSync(`bash ${REPO_ROOT}/tests/fixtures/build-seed.sh`, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  // Restore via bd init --from-jsonl so bd memories --json is queryable
  execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${dir}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// CASE 1 (D-18 v0.1 happy path): v0.1 milestone-heading memory present with value "Foundation"
test('memories-seeded CASE 1: v0.1 milestone heading memory present', (t) => {
  const dir = buildSeedFixture(t);
  const out = execSync('bd memories --json', { cwd: dir, encoding: 'utf-8' });
  const memories = JSON.parse(out);
  assert.equal(
    memories['gsd-beads:milestone:v0.1:heading'],
    'Foundation',
    `expected v0.1 heading "Foundation", got: ${memories['gsd-beads:milestone:v0.1:heading']}`
  );
});

// CASE 2 (D-18 v0.2 happy path): v0.2 milestone-heading memory present with value "Beads-backed reads"
test('memories-seeded CASE 2: v0.2 milestone heading memory present', (t) => {
  const dir = buildSeedFixture(t);
  const out = execSync('bd memories --json', { cwd: dir, encoding: 'utf-8' });
  const memories = JSON.parse(out);
  assert.equal(
    memories['gsd-beads:milestone:v0.2:heading'],
    'Beads-backed reads',
    `expected v0.2 heading "Beads-backed reads", got: ${memories['gsd-beads:milestone:v0.2:heading']}`
  );
});

// CASE 3 (D-17 fallback exercise): v0.3 milestone-heading memory deliberately absent
// Build-seed.sh omits v0.3 so Phase 5 handlers exercise the fallback path (bare "v0.3").
test('memories-seeded CASE 3: v0.3 milestone heading memory absent (D-17 fallback substrate)', (t) => {
  const dir = buildSeedFixture(t);
  const out = execSync('bd memories --json', { cwd: dir, encoding: 'utf-8' });
  const memories = JSON.parse(out);
  assert.equal(
    memories['gsd-beads:milestone:v0.3:heading'],
    undefined,
    `expected v0.3 heading to be absent (fallback substrate), got: ${memories['gsd-beads:milestone:v0.3:heading']}`
  );
});
