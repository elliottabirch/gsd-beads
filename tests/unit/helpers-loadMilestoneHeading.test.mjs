// tests/unit/helpers-loadMilestoneHeading.test.mjs
// Unit tests for loadMilestoneHeading helper (D-15..D-17).
// Wave 0 RED stubs — fail until loadMilestoneHeading is exported from gsd-sdk-shadow.mjs.
// 4 cases: memory hit, missing memory fallback (stderr note), unrelated key fallback, idempotency.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMilestoneHeading } from '../../src/helpers/loadMilestoneHeading.mjs';

// CASE 1: memory hit — key present in memories → returns formatted heading
test('CASE 1: loadMilestoneHeading — returns formatted heading when memory key present', () => {
  const memories = { 'gsd-beads:milestone:v0.2:heading': 'Beads-backed reads' };
  const result = loadMilestoneHeading(memories, 'v0.2');
  assert.equal(result, 'Milestone v0.2 — Beads-backed reads');
});

// CASE 2: missing memory key → returns bare version + emits stderr note (D-17)
test('CASE 2: loadMilestoneHeading — bare fallback when memory key absent + stderr note', (t) => {
  const errLogs = [];
  t.mock.method(console, 'error', (msg) => errLogs.push(msg));

  const memories = {};
  const result = loadMilestoneHeading(memories, 'v0.3');

  assert.equal(result, 'v0.3', 'should return bare version string as fallback');
  assert.ok(errLogs.length >= 1, 'should emit at least one stderr message');
  assert.match(errLogs[0], /no milestone heading memory for v0\.3/);
});

// CASE 3: memories has unrelated keys only → bare fallback + stderr
test('CASE 3: loadMilestoneHeading — unrelated keys do not match; falls back to bare version', (t) => {
  const errLogs = [];
  t.mock.method(console, 'error', (msg) => errLogs.push(msg));

  const memories = {
    'gsd-beads:milestone:v0.1:heading': 'Foundation',
    'gsd-beads:milestone:v0.2:heading': 'Beads-backed reads',
  };
  const result = loadMilestoneHeading(memories, 'v0.4');

  assert.equal(result, 'v0.4');
  assert.ok(errLogs.length >= 1, 'should emit stderr note for missing v0.4 memory');
  assert.match(errLogs[0], /no milestone heading memory for v0\.4/);
});

// CASE 4: idempotency — calling with same args twice returns identical result both times
test('CASE 4: loadMilestoneHeading — idempotent (same result on repeated calls)', () => {
  const memories = { 'gsd-beads:milestone:v0.1:heading': 'Foundation' };
  const result1 = loadMilestoneHeading(memories, 'v0.1');
  const result2 = loadMilestoneHeading(memories, 'v0.1');
  assert.equal(result1, result2);
  assert.equal(result1, 'Milestone v0.1 — Foundation');
});
