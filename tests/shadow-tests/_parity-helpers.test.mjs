// tests/shadow-tests/_parity-helpers.test.mjs
// Unit tests for the snapshot-parity helper module (D-09).
// 6 cases: missing-key / missing-nested / type-mismatch / null-snapshot-allows-anything
//          / array-shape / recursion.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertKeySetParity, assertTypeParity, assertKeySetParityWithExt } from './_parity-helpers.mjs';

// CASE 1: assertKeySetParity — missing key throws with path containing the missing key name
test('CASE 1: assertKeySetParity — missing key throws with path', () => {
  assert.throws(
    () => assertKeySetParity({}, { foo: 1 }),
    /missing keys: foo/,
  );
});

// CASE 2: assertKeySetParity — missing key in NESTED object throws with dotted path
test('CASE 2: assertKeySetParity — missing nested key surfaces dotted path', () => {
  assert.throws(
    () => assertKeySetParity(
      { outer: { other: 1 } },
      { outer: { inner: 'expected' } },
    ),
    /\.outer.*missing keys:.*inner/,
  );
});

// CASE 3: assertTypeParity — type mismatch throws with snapshot=<ts>, actual=<ta> message
test('CASE 3: assertTypeParity — type mismatch throws with vocab message', () => {
  assert.throws(
    () => assertTypeParity('a string', 42),
    /type mismatch — snapshot=number, actual=string/,
  );
});

// CASE 4: assertTypeParity — null in snapshot allows any actual type (wildcard)
test('CASE 4: assertTypeParity — null snapshot allows any actual type', () => {
  assert.doesNotThrow(() => assertTypeParity(42, null));
  assert.doesNotThrow(() => assertTypeParity('s', null));
  assert.doesNotThrow(() => assertTypeParity({}, null));
  assert.doesNotThrow(() => assertTypeParity([], null));
});

// CASE 5: assertKeySetParity — array shape check uses element-0 only
test('CASE 5: assertKeySetParity — array element-0 shape comparison', () => {
  // Mismatching length: no throw (we only check element-0 shape)
  assert.doesNotThrow(() => assertKeySetParity(
    [{ a: 1 }, { a: 2 }, { a: 3 }],
    [{ a: 1 }],
  ));
  // Mismatching shape inside element-0: throws
  assert.throws(
    () => assertKeySetParity([{}], [{ a: 1 }]),
    /missing keys: a/,
  );
});

// CASE 6: assertKeySetParity — 3-level recursion surfaces correct dotted path
test('CASE 6: assertKeySetParity — nested missing key surfaces dotted path', () => {
  assert.throws(
    () => assertKeySetParity(
      { phases: [{ id: 'p1' }] },
      { phases: [{ id: 'p1', disk_status: 'open' }] },
    ),
    /\.phases\[0\].*missing keys:.*disk_status/,
  );
});

// CASE 7: assertKeySetParityWithExt allows whitelisted bd-only keys (drift, backend)
test('CASE 7: assertKeySetParityWithExt allows whitelisted bd-only keys (drift)', () => {
  const snapshot = { phases: [], phase_count: 0 };
  const actual = { phases: [], phase_count: 0, drift: [], backend: 'beads' };
  // Should NOT throw — both `drift` and `backend` are extensions
  assert.doesNotThrow(() => assertKeySetParityWithExt(actual, snapshot, ['drift', 'backend']));
});

// CASE 8: assertKeySetParityWithExt still catches non-whitelisted missing keys
test('CASE 8: assertKeySetParityWithExt still catches non-whitelisted missing keys', () => {
  const snapshot = { phases: [], phase_count: 0, milestones: [] };
  const actual = { phases: [], phase_count: 0, drift: [] }; // missing milestones (NOT an extension)
  assert.throws(
    () => assertKeySetParityWithExt(actual, snapshot, ['drift']),
    /missing keys.*milestones/,
  );
});
