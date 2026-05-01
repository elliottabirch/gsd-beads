// tests/unit/pathRouter.test.mjs
// Verifies D-01 closed-enum routing registry per Phase 7 Plan 01.
// Tests `resolve(path)` shape descriptors + NAMED_DOC_CATEGORIES enum (D-10).

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('resolve: ROADMAP.md singleton', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(resolve('.planning/ROADMAP.md'), {
    kind: 'roadmap',
    tier: 'bd',
    label: 'gsd:roadmap',
    singleton: true,
  });
});

test('resolve: REQUIREMENTS.md singleton', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(resolve('.planning/REQUIREMENTS.md'), {
    kind: 'requirements',
    tier: 'bd',
    label: 'gsd:requirement',
  });
});

test('resolve: phase plan path → disk-routed plan kind', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/phases/07-foo/07-01-PLAN.md'),
    { kind: 'plan', tier: 'disk', phase: '07', plan: '07-01-PLAN.md' }
  );
});

test('resolve: namedDoc — intel category', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/intel/foo.md'),
    { kind: 'namedDoc', tier: 'hybrid', category: 'intel', key: 'foo' }
  );
});

test('resolve: namedDoc — learnings category', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/learnings/bar.md'),
    { kind: 'namedDoc', tier: 'hybrid', category: 'learnings', key: 'bar' }
  );
});

test('resolve: unrecognized .planning category falls through to opaque/disk', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/random-cat/foo.md'),
    { kind: 'opaque', tier: 'disk' }
  );
});

test('resolve: outside-.planning path is opaque/disk', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('docs/api.md'),
    { kind: 'opaque', tier: 'disk' }
  );
});

test('resolve: todos collection prefix', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/todos/foo.md'),
    { kind: 'todo', tier: 'bd', label: 'gsd:todo', collection: true }
  );
});

test('resolve: seeds collection prefix', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/seeds/foo.md'),
    { kind: 'seed', tier: 'bd', label: 'gsd:seed', collection: true }
  );
});

test('resolve: phases collection prefix', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.deepEqual(
    resolve('.planning/phases'),
    { kind: 'phase', tier: 'bd', label: 'gsd:phase', collection: true }
  );
});

test('resolve: TypeError on empty string and null input', async () => {
  const { resolve } = await import('../../src/adapter/pathRouter.mjs');
  assert.throws(() => resolve(''), TypeError);
  assert.throws(() => resolve(null), TypeError);
});

test('NAMED_DOC_CATEGORIES: frozen 9-element D-10 allowlist', async () => {
  const { NAMED_DOC_CATEGORIES } = await import('../../src/adapter/pathRouter.mjs');
  assert.ok(Object.isFrozen(NAMED_DOC_CATEGORIES));
  assert.equal(NAMED_DOC_CATEGORIES.length, 9);
  assert.deepEqual([...NAMED_DOC_CATEGORIES].sort(), [
    'archived-milestone',
    'codebase',
    'debug-knowledge-base',
    'discovery',
    'discussion-log',
    'intel',
    'learnings',
    'methodology',
    'research',
  ]);
});
