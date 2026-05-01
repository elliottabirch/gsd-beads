// tests/unit/primitives-frontmatter.smoke.test.mjs
// Phase 7 Plan 05 — smoke test for getFrontmatter / updateFrontmatter /
// mergeFrontmatter on disk-routed paths. Wave 4 conformance is canonical for
// bd-routed; this verifies the import wiring + disk-routed code paths against
// `src/format/frontmatter.mjs` (Plan 03) + `_atomicWrite.mjs` (Plan 04).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BeadsAdapter } from '../../src/adapter.mjs';

function freshDocsFixture(t, body) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-fm-smoke-'));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/foo.md'), body);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('SMOKE: getFrontmatter on disk-routed returns scalar field', async (t) => {
  const root = freshDocsFixture(t, '---\nphase: 7\n---\nbody\n');
  const a = new BeadsAdapter(root);
  assert.equal(await a.getFrontmatter('docs/foo.md', 'phase'), 7);
});

test('SMOKE: getFrontmatter without field returns full object', async (t) => {
  const root = freshDocsFixture(t, '---\nphase: 7\nname: foo\n---\nbody\n');
  const a = new BeadsAdapter(root);
  const fm = await a.getFrontmatter('docs/foo.md');
  assert.deepEqual(fm, { phase: 7, name: 'foo' });
});

test('SMOKE: getFrontmatter on file without delimiters returns undefined', async (t) => {
  const root = freshDocsFixture(t, 'just a body\n');
  const a = new BeadsAdapter(root);
  assert.equal(await a.getFrontmatter('docs/foo.md', 'phase'), undefined);
});

test('SMOKE: updateFrontmatter mutates field; getFrontmatter sees new value', async (t) => {
  const root = freshDocsFixture(t, '---\nphase: 7\n---\nbody\n');
  const a = new BeadsAdapter(root);
  await a.updateFrontmatter('docs/foo.md', 'phase', 8);
  assert.equal(await a.getFrontmatter('docs/foo.md', 'phase'), 8);
});

test('SMOKE: updateFrontmatter preserves body verbatim', async (t) => {
  const root = freshDocsFixture(t, '---\nphase: 7\n---\nbody-line-1\nbody-line-2\n');
  const a = new BeadsAdapter(root);
  await a.updateFrontmatter('docs/foo.md', 'phase', 8);
  const text = readFileSync(join(root, 'docs/foo.md'), 'utf-8');
  assert.match(text, /body-line-1\nbody-line-2/);
});

test('SMOKE: mergeFrontmatter merges shallow patch', async (t) => {
  const root = freshDocsFixture(t, '---\nphase: 7\nname: foo\n---\nbody\n');
  const a = new BeadsAdapter(root);
  await a.mergeFrontmatter('docs/foo.md', { phase: 8, status: 'open' });
  const fm = await a.getFrontmatter('docs/foo.md');
  assert.deepEqual(fm, { phase: 8, name: 'foo', status: 'open' });
});
