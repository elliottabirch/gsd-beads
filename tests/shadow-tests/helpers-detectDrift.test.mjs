// tests/shadow-tests/helpers-detectDrift.test.mjs
// Unit tests for detectDrift helper (D-09/D-10 + refined D-06).
// Wave 0 RED stubs — fail until detectDrift is exported from gsd-sdk-shadow.mjs.
// 6 cases: no-drift, plan_count drift, LIVE summary_count divergence (refined D-06),
//          closed_without_summary, natural-asymmetry exclusion, multiple-kinds simultaneous.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDrift } from '../../bin/gsd-sdk-shadow.mjs';

// CASE 1: no drift when bd.plan_count === disk.disk_plan_count and all other counts match
test('CASE 1: detectDrift — returns [] when all counts match (no drift)', () => {
  const result = detectDrift(
    '5',
    { plan_count: 3, summary_count: 1, bd_status: 'open' },
    { disk_plan_count: 3, disk_summary_count: 1 }
  );
  assert.deepEqual(result, []);
});

// CASE 2: plan_count drift → entry + stderr line
test('CASE 2: detectDrift — plan_count drift emits entry and stderr', (t) => {
  const errLogs = [];
  t.mock.method(console, 'error', (msg) => errLogs.push(msg));

  const result = detectDrift(
    '5',
    { plan_count: 3, summary_count: 1, bd_status: 'open' },
    { disk_plan_count: 2, disk_summary_count: 1 }
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'plan_count');
  assert.equal(result[0].phase, '5');
  assert.equal(result[0].bd_value, 3);
  assert.equal(result[0].disk_value, 2);
  assert.ok(errLogs.length >= 1, 'should emit at least one stderr message');
  assert.match(errLogs[0], /DRIFT: phase 5 plan_count bd=3 disk=2/);
});

// CASE 3: LIVE summary_count divergence (refined D-06)
// bd has 2 closed gsd:plan children; disk has 1 *-SUMMARY.md file.
// Proves the summary_count drift kind is real and not dead code.
test('CASE 3: detectDrift — LIVE summary_count drift (bd_summary_count=2, disk_summary_count=1)', (t) => {
  const errLogs = [];
  t.mock.method(console, 'error', (msg) => errLogs.push(msg));

  const result = detectDrift(
    '5',
    { plan_count: 2, summary_count: 2, bd_status: 'open' },
    { disk_plan_count: 2, disk_summary_count: 1 }
  );

  assert.equal(result.length, 1, 'should emit exactly 1 drift entry');
  // Verify kind: 'summary_count' — the LIVE drift kind per refined D-06
  assert.equal(result[0].kind, 'summary_count', "expected kind: 'summary_count'");
  assert.equal(result[0].phase, '5');
  assert.equal(result[0].bd_value, 2);
  assert.equal(result[0].disk_value, 1);
  assert.ok(errLogs.length >= 1, 'should emit at least one stderr message');
  assert.match(errLogs[0], /DRIFT: phase 5 summary_count bd=2 disk=1/);
});

// CASE 4: closed_without_summary — bd_status='closed' AND disk_summary_count=0
test('CASE 4: detectDrift — closed_without_summary when bd_status=closed and no summary on disk', (t) => {
  const errLogs = [];
  t.mock.method(console, 'error', (msg) => errLogs.push(msg));

  const result = detectDrift(
    '5',
    { plan_count: 2, summary_count: 2, bd_status: 'closed' },
    { disk_plan_count: 2, disk_summary_count: 0 }
  );

  // Should have at minimum the closed_without_summary entry (may also have summary_count drift)
  const closedEntry = result.find(e => e.kind === 'closed_without_summary');
  assert.ok(closedEntry, 'should include closed_without_summary entry');
  assert.equal(closedEntry.phase, '5');
  assert.ok(errLogs.some(msg => /closed_without_summary/.test(msg)), 'should emit closed_without_summary stderr');
});

// CASE 5: natural asymmetry — counts equal + bd_status=open → no drift even if dir absent
// detectDrift itself is "dumb" — it just compares counts. When all match, no entries.
test('CASE 5: detectDrift — no drift when all counts match regardless of bd_status=open', () => {
  const result = detectDrift(
    '5',
    { plan_count: 0, summary_count: 0, bd_status: 'open' },
    { disk_plan_count: 0, disk_summary_count: 0 }
  );
  assert.deepEqual(result, []);
});

// CASE 6: multiple drift kinds firing simultaneously
// plan_count diverges + summary_count diverges + closed_without_summary → array length 3
test('CASE 6: detectDrift — multiple drift kinds simultaneously (array length >= 3)', (t) => {
  const errLogs = [];
  t.mock.method(console, 'error', (msg) => errLogs.push(msg));

  const result = detectDrift(
    '5',
    { plan_count: 3, summary_count: 2, bd_status: 'closed' },
    { disk_plan_count: 2, disk_summary_count: 0 }
  );

  // plan_count drift: 3 vs 2
  // summary_count drift: 2 vs 0
  // closed_without_summary: bd_status=closed + disk_summary_count=0
  assert.ok(result.length >= 3, `expected >= 3 drift entries, got ${result.length}: ${JSON.stringify(result)}`);
  assert.ok(result.some(e => e.kind === 'plan_count'), 'should have plan_count entry');
  assert.ok(result.some(e => e.kind === 'summary_count'), 'should have summary_count entry');
  assert.ok(result.some(e => e.kind === 'closed_without_summary'), 'should have closed_without_summary entry');
  assert.ok(errLogs.length >= 3, 'should emit 3+ stderr messages');
});
