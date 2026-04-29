import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BeadsCause,
  BeadsUnavailableError,
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsVersionMismatch,
  BeadsEmpty,
} from '../../bin/beads-errors.mjs';

// CASE 1: subtype is instanceof base
test('CASE 1: BeadsNotInstalled instanceof BeadsUnavailableError', () => {
  const e = new BeadsNotInstalled('bd missing');
  assert.ok(e instanceof BeadsUnavailableError);
  assert.ok(e instanceof Error);
  assert.equal(e.cause, BeadsCause.NotInstalled);
});

// CASE 2: cause enum is frozen
test('CASE 2: BeadsCause is frozen — mutation throws or no-op', () => {
  assert.ok(Object.isFrozen(BeadsCause));
});

// CASE 3: name is set per subtype (Pitfall 1 fallback for ESM split)
test('CASE 3: each subtype sets its own .name', () => {
  assert.equal(new BeadsNotInstalled('').name, 'BeadsNotInstalled');
  assert.equal(new BeadsCorrupt('').name, 'BeadsCorrupt');
  assert.equal(new BeadsVersionMismatch('').name, 'BeadsVersionMismatch');
  assert.equal(new BeadsEmpty('').name, 'BeadsEmpty');
});

// CASE 4: originalError preserved
test('CASE 4: originalError preserved on construction', () => {
  const inner = new Error('boom');
  const e = new BeadsCorrupt('wrapper', { originalError: inner });
  assert.equal(e.originalError, inner);
});
