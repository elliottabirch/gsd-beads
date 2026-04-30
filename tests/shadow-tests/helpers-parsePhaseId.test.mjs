// tests/shadow-tests/helpers-parsePhaseId.test.mjs
// Unit tests for parsePhaseId helper (D-02).
// Wave 0 RED stubs — fail until helpers-parsePhaseId is exported from gsd-sdk-shadow.mjs.
// 6 cases: zero-padded, unpadded, decimal, 3-digit, null/undefined, no-prefix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhaseId } from '../../bin/gsd-sdk-shadow.mjs';

// CASE 1: parsePhaseId strips 'phase-id:' prefix and removes zero-padding
test('CASE 1: parsePhaseId — zero-padded phase-id:05 → "5"', () => {
  assert.equal(parsePhaseId('phase-id:05'), '5');
});

// CASE 2: parsePhaseId — unpadded input passes through unchanged (minus prefix)
test('CASE 2: parsePhaseId — unpadded phase-id:5 → "5"', () => {
  assert.equal(parsePhaseId('phase-id:5'), '5');
});

// CASE 3: parsePhaseId — decimal preserved (phase-id:72.1 → "72.1")
test('CASE 3: parsePhaseId — decimal phase-id:72.1 → "72.1" (preserves decimal segment)', () => {
  assert.equal(parsePhaseId('phase-id:72.1'), '72.1');
});

// CASE 4: parsePhaseId — 3-digit phase number (no padding stripping needed)
test('CASE 4: parsePhaseId — 3-digit phase-id:100 → "100"', () => {
  assert.equal(parsePhaseId('phase-id:100'), '100');
});

// CASE 5: parsePhaseId — null + undefined both return null
test('CASE 5: parsePhaseId — null returns null; undefined returns null', () => {
  assert.equal(parsePhaseId(null), null);
  assert.equal(parsePhaseId(undefined), null);
});

// CASE 6: parsePhaseId — label without 'phase-id:' prefix returns as-is (no prefix strip, no pad strip)
test('CASE 6: parsePhaseId — label without prefix returned as-is (no phase-id: prefix)', () => {
  // 'not-a-phase-label' has no leading zeros to strip and no prefix
  assert.equal(parsePhaseId('not-a-phase-label'), 'not-a-phase-label');
});
