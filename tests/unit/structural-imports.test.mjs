// tests/unit/structural-imports.test.mjs
// Verifies ARCH-01 (src/bd/) + ARCH-02 (src/helpers/).
// Wave 0 file: red until Plan 04 lands the source files.

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ARCH-01: src/bd/helper.mjs exports bd()', async () => {
  const mod = await import('../../src/bd/helper.mjs');
  assert.equal(typeof mod.bd, 'function', 'src/bd/helper.mjs must export bd()');
});

test('ARCH-01: src/bd/errors.mjs exports BeadsUnavailableError + BeadsCause', async () => {
  const mod = await import('../../src/bd/errors.mjs');
  assert.equal(typeof mod.BeadsUnavailableError, 'function',
    'src/bd/errors.mjs must export BeadsUnavailableError class');
  assert.ok(mod.BeadsCause, 'src/bd/errors.mjs must export BeadsCause enum');
});

test('ARCH-01: src/bd/findRoot.mjs exports findBeadsRoot()', async () => {
  const mod = await import('../../src/bd/findRoot.mjs');
  assert.equal(typeof mod.findBeadsRoot, 'function',
    'src/bd/findRoot.mjs must export findBeadsRoot()');
});

test('ARCH-02: src/helpers/index.mjs barrel exports all 4 helpers', async () => {
  const mod = await import('../../src/helpers/index.mjs');
  for (const name of ['parsePhaseId', 'deriveDiskStatus', 'detectDrift', 'loadMilestoneHeading']) {
    assert.equal(typeof mod[name], 'function',
      `src/helpers/index.mjs must export ${name}()`);
  }
});

test('ARCH-02: src/helpers/parsePhaseId.mjs leaf module', async () => {
  const mod = await import('../../src/helpers/parsePhaseId.mjs');
  assert.equal(typeof mod.parsePhaseId, 'function');
});

test('ARCH-02: src/helpers/deriveDiskStatus.mjs leaf module', async () => {
  const mod = await import('../../src/helpers/deriveDiskStatus.mjs');
  assert.equal(typeof mod.deriveDiskStatus, 'function');
});

test('ARCH-02: src/helpers/detectDrift.mjs leaf module', async () => {
  const mod = await import('../../src/helpers/detectDrift.mjs');
  assert.equal(typeof mod.detectDrift, 'function');
});

test('ARCH-02: src/helpers/loadMilestoneHeading.mjs leaf module', async () => {
  const mod = await import('../../src/helpers/loadMilestoneHeading.mjs');
  assert.equal(typeof mod.loadMilestoneHeading, 'function');
});
