// tests/unit/primitives-snapshot.smoke.test.mjs
// Phase 7 Plan 07 Task 1 — smoke tests for snapshot + restore (PRIM-02).
//
// Pattern: per-test fresh bd fixture via mkdtempSync + bd init --from-jsonl
// from tests/fixtures/seed.jsonl, mirroring tests/unit/primitives-events.smoke.test.mjs.
//
// Verifies RESEARCH §Pattern 5 round-trip:
//   - snapshot returns a path to a non-empty JSONL file
//   - file is parseable JSONL containing memories from seed.jsonl
//   - restore round-trips: snapshot, mutate, restore — mutation absent
//   - restore applies chmod 0o700 to .beads (Pitfall 6)
//   - restore validates snapshotRef as non-empty string

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, rmSync, copyFileSync, chmodSync, readFileSync, statSync, existsSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../fixtures/seed.jsonl');

function freshBdFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-snap-smoke-'));
  spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root, stdio: 'ignore' });
  mkdirSync(join(root, '.beads'));
  copyFileSync(SEED, join(root, '.beads/issues.jsonl'));
  const init = spawnSync(
    'bd',
    ['init', '--from-jsonl', '--prefix', 'sd', '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'],
    { cwd: root, env: { ...process.env, BEADS_ACTOR: 'seed' }, encoding: 'utf-8' },
  );
  if (init.status !== 0) {
    t.diagnostic(`bd init failed: ${init.stderr}`);
    throw new Error(`bd init failed: ${init.stderr}`);
  }
  chmodSync(join(root, '.beads'), 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('SMOKE: snapshot returns path to non-empty JSONL file', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const snap = await a.snapshot();
  assert.ok(typeof snap === 'string' && snap.length > 0);
  assert.ok(existsSync(snap));
  assert.ok(statSync(snap).size > 0);
  t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
});

test('SMOKE: snapshot file is parseable JSONL', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const snap = await a.snapshot();
  const text = readFileSync(snap, 'utf-8');
  const lines = text.split('\n').filter(Boolean);
  assert.ok(lines.length > 0);
  for (const line of lines) {
    // Each line MUST be JSON-parseable
    assert.doesNotThrow(() => JSON.parse(line), `bad JSONL line: ${line}`);
  }
  t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
});

test('SMOKE: snapshot includes memories from seed.jsonl', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const snap = await a.snapshot();
  const text = readFileSync(snap, 'utf-8');
  const memoryLines = text.split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((obj) => obj._type === 'memory');
  // seed.jsonl has 2 milestone-heading memories
  assert.ok(memoryLines.length >= 2, `expected >=2 memories, got ${memoryLines.length}`);
  t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
});

test('SMOKE: snapshot then mutate then restore — mutation absent in restored root', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  // 1. snapshot
  const snap = await a.snapshot();
  // 2. mutate via direct bd remember
  const remember = spawnSync('bd', ['remember', 'mutation-marker', '--key', 'gsd-beads:test:smoke-marker'], {
    cwd: root,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  });
  assert.equal(remember.status, 0, `bd remember failed: ${remember.stderr}`);
  // 3. confirm mutation present in original
  const recallOrig = spawnSync('bd', ['recall', 'gsd-beads:test:smoke-marker'], {
    cwd: root, encoding: 'utf-8',
  });
  assert.equal(recallOrig.status, 0, 'mutation should be present in original root');
  // 4. restore from snapshot
  const restoredRoot = await a.restore(snap);
  // 5. mutation must be ABSENT in restored
  const recallRestored = spawnSync('bd', ['recall', 'gsd-beads:test:smoke-marker'], {
    cwd: restoredRoot, encoding: 'utf-8',
  });
  assert.notEqual(recallRestored.status, 0, 'mutation must NOT be in restored root');
  // Cleanup
  t.after(() => rmSync(restoredRoot, { recursive: true, force: true }));
  t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
});

test('SMOKE: restore applies chmod 0o700 to .beads (Pitfall 6)', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const snap = await a.snapshot();
  const restoredRoot = await a.restore(snap);
  const beadsStat = statSync(join(restoredRoot, '.beads'));
  // Mask off non-permission bits; check 0o700
  assert.equal(beadsStat.mode & 0o777, 0o700, 'restored .beads must be 0700');
  t.after(() => rmSync(restoredRoot, { recursive: true, force: true }));
  t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
});

test('SMOKE: restore throws TypeError on non-string snapshotRef', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(() => a.restore(null), TypeError);
  await assert.rejects(() => a.restore(undefined), TypeError);
  await assert.rejects(() => a.restore(42), TypeError);
});
