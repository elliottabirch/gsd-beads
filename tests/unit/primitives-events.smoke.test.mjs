// tests/unit/primitives-events.smoke.test.mjs
// Phase 7 Plan 06 — smoke tests for recordStateEvent (memory dispatch only,
// per plan; the COMMENT_EVENT_TYPES path requires a milestone bead which
// the current seed.jsonl lacks — Wave 5 conformance covers it) and
// writeBinaryAsset.
//
// Pattern: per-test fresh bd fixture via mkdtempSync + bd init --from-jsonl
// from tests/fixtures/seed.jsonl, mirroring tests/unit/findBeadsRoot.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';
import { UnsupportedOperationError } from '../../src/bd/errors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../fixtures/seed.jsonl');

function freshBdFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-events-smoke-'));
  spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root, stdio: 'ignore' });
  mkdirSync(join(root, '.beads'));
  copyFileSync(SEED, join(root, '.beads/issues.jsonl'));
  const init = spawnSync(
    'bd',
    ['init', '--from-jsonl', '--prefix', 'sd', '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'],
    { cwd: root, env: { ...process.env, BEADS_ACTOR: 'seed' }, encoding: 'utf-8' }
  );
  if (init.status !== 0) {
    t.diagnostic(`bd init failed: ${init.stderr}`);
    throw new Error(`bd init failed: ${init.stderr}`);
  }
  chmodSync(join(root, '.beads'), 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('SMOKE: recordStateEvent decision writes bd memory under v1.0:decision:<id>', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const ret = await a.recordStateEvent({
    type: 'decision',
    payload: { id: 'd-smoke-1', milestone: 'v1.0', body: 'smoke decision' },
  });
  assert.equal(ret.storage, 'memory');
  assert.equal(ret.key, 'v1.0:decision:d-smoke-1');
  // Verify via direct bd recall
  const recall = spawnSync('bd', ['recall', 'v1.0:decision:d-smoke-1'], {
    cwd: root, encoding: 'utf-8',
  });
  assert.equal(recall.status, 0, `bd recall failed: ${recall.stderr}`);
  const stored = JSON.parse(recall.stdout);
  assert.equal(stored.id, 'd-smoke-1');
  assert.equal(stored.body, 'smoke decision');
});

test('SMOKE: recordStateEvent metric writes bd memory under v1.0:metric:<id>', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const ret = await a.recordStateEvent({
    type: 'metric',
    payload: { id: 'm-smoke-1', milestone: 'v1.0', value: 42 },
  });
  assert.equal(ret.storage, 'memory');
  assert.equal(ret.key, 'v1.0:metric:m-smoke-1');
  const recall = spawnSync('bd', ['recall', 'v1.0:metric:m-smoke-1'], {
    cwd: root, encoding: 'utf-8',
  });
  assert.equal(recall.status, 0, `bd recall failed: ${recall.stderr}`);
  const stored = JSON.parse(recall.stdout);
  assert.equal(stored.id, 'm-smoke-1');
  assert.equal(stored.value, 42);
});

test('SMOKE: recordStateEvent throws on unknown type', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.recordStateEvent({ type: 'unknown_type_xyz', payload: { id: 'x', milestone: 'v1.0' } }),
    /recordStateEvent: unknown type/
  );
});

test('SMOKE: recordStateEvent throws on missing payload.id (memory types)', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.recordStateEvent({ type: 'metric', payload: { milestone: 'v1.0' } }),
    /requires payload\.id/
  );
});

test('SMOKE: recordStateEvent throws on missing payload.milestone (memory types)', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.recordStateEvent({ type: 'decision', payload: { id: 'd-1' } }),
    /requires payload\.milestone/
  );
});

test('SMOKE: writeBinaryAsset throws UnsupportedOperationError with locked message', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.writeBinaryAsset('docs/foo.png', new Uint8Array([1, 2, 3])),
    (err) => {
      assert.ok(err instanceof UnsupportedOperationError, 'must be UnsupportedOperationError');
      assert.match(
        err.message,
        /^BeadsAdapter\.writeBinaryAsset: not supported \(capabilities\.binaryAsset=false\)\./
      );
      return true;
    }
  );
});
