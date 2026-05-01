// tests/unit/primitives-records.smoke.test.mjs
// Phase 7 Plan 04 — smoke test for getRecord/putRecord/removeRecord/exists/listCollection
// on disk-routed paths. Wave 4 conformance is canonical; this just verifies the
// import wiring and disk-routed code paths work without bd setup.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BeadsAdapter } from '../../src/adapter.mjs';

function freshNonBdProject(t) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-prim-smoke-'));
  // No .beads/ — disk-routed paths must work without _ensureBd() being called.
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('SMOKE: getRecord returns null for missing disk-routed path', async (t) => {
  const root = freshNonBdProject(t);
  const a = new BeadsAdapter(root);
  assert.equal(await a.getRecord('docs/missing.md'), null);
});

test('SMOKE: putRecord then getRecord round-trips on disk-routed path', async (t) => {
  const root = freshNonBdProject(t);
  const a = new BeadsAdapter(root);
  await a.putRecord('docs/foo.md', 'body');
  assert.equal(await a.getRecord('docs/foo.md'), 'body');
});

test('SMOKE: exists returns false for missing disk-routed', async (t) => {
  const root = freshNonBdProject(t);
  const a = new BeadsAdapter(root);
  assert.equal(await a.exists('docs/missing.md'), false);
});

test('SMOKE: removeRecord is no-op on missing disk-routed file', async (t) => {
  const root = freshNonBdProject(t);
  const a = new BeadsAdapter(root);
  await a.removeRecord('docs/missing.md');  // must not throw
  assert.equal(await a.exists('docs/missing.md'), false);
});

test('SMOKE: listCollection on missing disk-routed prefix returns []', async (t) => {
  const root = freshNonBdProject(t);
  const a = new BeadsAdapter(root);
  const result = await a.listCollection('docs/missing-prefix');
  assert.deepEqual(result, []);
});
