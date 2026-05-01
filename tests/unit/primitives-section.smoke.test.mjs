// tests/unit/primitives-section.smoke.test.mjs
// Phase 7 Plan 05 — smoke test for getSection / updateSection on disk-routed paths.
// Wave 4 conformance is canonical for bd-routed; this just verifies the import
// wiring + disk-routed code paths against `src/format/section.mjs` (Plan 02)
// + `_atomicWrite.mjs` (Plan 04).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BeadsAdapter } from '../../src/adapter.mjs';

function freshDocsFixture(t, body) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-section-smoke-'));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/foo.md'), body);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('SMOKE: getSection returns body for known anchor', async (t) => {
  const root = freshDocsFixture(t, '# A\n## B\nbody\n');
  const a = new BeadsAdapter(root);
  assert.equal(await a.getSection('docs/foo.md', 'a/b'), 'body');
});

test('SMOKE: getSection returns null on missing anchor', async (t) => {
  const root = freshDocsFixture(t, '# A\nonly\n');
  const a = new BeadsAdapter(root);
  assert.equal(await a.getSection('docs/foo.md', 'no/such'), null);
});

test('SMOKE: updateSection overwrite preserves heading line', async (t) => {
  const root = freshDocsFixture(t, '# A\n## B\nold\n## C\nc-body\n');
  const a = new BeadsAdapter(root);
  await a.updateSection('docs/foo.md', 'a/b', 'NEW', 'overwrite');
  const result = readFileSync(join(root, 'docs/foo.md'), 'utf-8');
  // ## B heading must still be present, body replaced, ## C untouched
  assert.match(result, /## B\nNEW\n## C\nc-body\n/);
});

test('SMOKE: updateSection append inserts before next sibling', async (t) => {
  const root = freshDocsFixture(t, '# A\n## B\nold\n## C\nc\n');
  const a = new BeadsAdapter(root);
  await a.updateSection('docs/foo.md', 'a/b', 'EXTRA', 'append');
  const result = readFileSync(join(root, 'docs/foo.md'), 'utf-8');
  assert.match(result, /## B\nold\nEXTRA\n## C\nc\n/);
});

test('SMOKE: updateSection prepend inserts after heading', async (t) => {
  const root = freshDocsFixture(t, '# A\n## B\nold\n');
  const a = new BeadsAdapter(root);
  await a.updateSection('docs/foo.md', 'a/b', 'TOP', 'prepend');
  const result = readFileSync(join(root, 'docs/foo.md'), 'utf-8');
  assert.match(result, /## B\nTOP\nold\n/);
});

test('SMOKE: updateSection throws on missing anchor', async (t) => {
  const root = freshDocsFixture(t, '# A\nbody\n');
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.updateSection('docs/foo.md', 'no/such', 'x', 'overwrite'),
    /section not found/,
  );
});
