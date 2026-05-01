import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BeadsCause,
  BeadsUnavailableError,
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsVersionMismatch,
  BeadsEmpty,
  UnsupportedOperationError,
} from '../../src/bd/errors.mjs';

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

test('CASE 5: UnsupportedOperationError instanceof hierarchy + cause', () => {
  const e = new UnsupportedOperationError('writeBinaryAsset', 'binaryAsset');
  assert.ok(e instanceof BeadsUnavailableError);
  assert.ok(e instanceof Error);
  assert.equal(e.cause, BeadsCause.Unsupported);
});

test('CASE 6: BeadsCause.Unsupported entry present and frozen', () => {
  assert.equal(BeadsCause.Unsupported, 'unsupported');
  assert.ok(Object.isFrozen(BeadsCause));
});

test('CASE 7: UnsupportedOperationError sets its own .name', () => {
  assert.equal(new UnsupportedOperationError('m', 'f').name, 'UnsupportedOperationError');
});

test('CASE 8: D-16 locked throw-message format byte-equal (with hint)', () => {
  const e = new UnsupportedOperationError(
    'writeBinaryAsset',
    'binaryAsset',
    'bd has no binary blob store; configure an external sink in v1.1.'
  );
  assert.equal(
    e.message,
    'BeadsAdapter.writeBinaryAsset: not supported (capabilities.binaryAsset=false). bd has no binary blob store; configure an external sink in v1.1.'
  );
});

test('CASE 9: omitting hint produces no trailing space', () => {
  const e = new UnsupportedOperationError('m', 'f');
  assert.equal(e.message, 'BeadsAdapter.m: not supported (capabilities.f=false).');
});

test('CASE 10: structured method + flag fields preserved', () => {
  const e = new UnsupportedOperationError('writeBinaryAsset', 'binaryAsset');
  assert.equal(e.method, 'writeBinaryAsset');
  assert.equal(e.flag, 'binaryAsset');
});
