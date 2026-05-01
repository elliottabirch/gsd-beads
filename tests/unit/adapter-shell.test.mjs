// tests/unit/adapter-shell.test.mjs
// Verifies ARCH-04 BeadsAdapter shell + capabilities + stub pattern.
// Wave 0 file: red until Plan 06 lands src/adapter.mjs + 8 cluster files.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const STUB_RE = /^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/;

test('ARCH-04: constructor accepts string projectRoot', async () => {
  const { BeadsAdapter } = await import('../../src/adapter.mjs');
  assert.doesNotThrow(() => new BeadsAdapter('/tmp/anywhere'));
});

test('ARCH-04: constructor rejects empty/non-string projectRoot', async () => {
  const { BeadsAdapter } = await import('../../src/adapter.mjs');
  assert.throws(() => new BeadsAdapter(), TypeError);
  assert.throws(() => new BeadsAdapter(''), TypeError);
  assert.throws(() => new BeadsAdapter(null), TypeError);
});

test('ARCH-04: capabilities flag readable WITHOUT instantiation', async () => {
  const { BeadsAdapter } = await import('../../src/adapter.mjs');
  const c = BeadsAdapter.capabilities;
  assert.equal(typeof c, 'object');
  for (const k of ['record', 'section', 'binaryAsset', 'snapshot', 'transaction', 'namedDoc', 'commitPlanningState']) {
    assert.equal(typeof c[k], 'boolean', `capabilities.${k} must be a boolean`);
  }
});

test('ARCH-04: capabilities is frozen (Object.isFrozen)', async () => {
  const { BeadsAdapter } = await import('../../src/adapter.mjs');
  assert.ok(Object.isFrozen(BeadsAdapter.capabilities),
    "BeadsAdapter.capabilities must be Object.freeze'd");
});

test('ARCH-04: stub methods throw canonical message format', async () => {
  const { BeadsAdapter } = await import('../../src/adapter.mjs');
  const adapter = new BeadsAdapter('/tmp/anywhere');

  // Spot-check one method from each of the 8 cluster files.
  const samples = [
    ['getRecord', '/tmp/foo'],            // primitives
    ['addPhase', { description: 'x' }],   // phaseLifecycle
    ['getRoadmap'],                       // roadmapMilestone
    ['getStateSnapshot'],                 // state
    ['getVerification', '6'],             // verifyReviews
    ['getTodo', 'todo-1'],                // discussTodos
    ['getConfig'],                        // longTail
    ['getProgressInit'],                  // initBundlers
  ];

  for (const [name, ...args] of samples) {
    await assert.rejects(
      async () => adapter[name](...args),
      (err) => {
        assert.match(err.message, STUB_RE,
          `${name} should throw canonical "BeadsAdapter.<name>: not implemented (Phase N / (PRIM|IMPL)-NN)" — got: ${err.message}`);
        return true;
      }
    );
  }
});

test('ARCH-04: stub methods include the method name in the error', async () => {
  const { BeadsAdapter } = await import('../../src/adapter.mjs');
  const adapter = new BeadsAdapter('/tmp/anywhere');
  await assert.rejects(
    async () => adapter.addPhase({}),
    (err) => err.message.includes('BeadsAdapter.addPhase')
  );
});
