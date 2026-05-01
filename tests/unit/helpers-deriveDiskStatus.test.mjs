// tests/unit/helpers-deriveDiskStatus.test.mjs
// Unit tests for deriveDiskStatus helper (D-07).
// Wave 0 RED stubs — fail until deriveDiskStatus is exported from gsd-sdk-shadow.mjs.
// 8 cases: one per D-07 priority case + 1 priority-order verification.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveDiskStatus } from '../../src/helpers/deriveDiskStatus.mjs';

// CASE 1: dirExists=false → 'no_directory' (lowest priority — phase dir absent)
test('CASE 1: deriveDiskStatus — no_directory when dirExists=false', () => {
  assert.equal(deriveDiskStatus({ planCount: 0, summaryCount: 0, hasContext: false, hasResearch: false, dirExists: false }), 'no_directory');
});

// CASE 2: complete — planCount>0 AND summaryCount >= planCount
test('CASE 2: deriveDiskStatus — complete when planCount=2, summaryCount=2', () => {
  assert.equal(deriveDiskStatus({ planCount: 2, summaryCount: 2, hasContext: true, hasResearch: true, dirExists: true }), 'complete');
});

// CASE 3: partial — summaryCount>0 but summaryCount < planCount
test('CASE 3: deriveDiskStatus — partial when planCount=2, summaryCount=1', () => {
  assert.equal(deriveDiskStatus({ planCount: 2, summaryCount: 1, hasContext: false, hasResearch: false, dirExists: true }), 'partial');
});

// CASE 4: planned — planCount>0 but summaryCount=0
test('CASE 4: deriveDiskStatus — planned when planCount=2, summaryCount=0', () => {
  assert.equal(deriveDiskStatus({ planCount: 2, summaryCount: 0, hasContext: false, hasResearch: false, dirExists: true }), 'planned');
});

// CASE 5: researched — planCount=0, hasResearch=true
test('CASE 5: deriveDiskStatus — researched when planCount=0, hasResearch=true', () => {
  assert.equal(deriveDiskStatus({ planCount: 0, summaryCount: 0, hasContext: false, hasResearch: true, dirExists: true }), 'researched');
});

// CASE 6: discussed — planCount=0, hasResearch=false, hasContext=true
test('CASE 6: deriveDiskStatus — discussed when planCount=0, hasResearch=false, hasContext=true', () => {
  assert.equal(deriveDiskStatus({ planCount: 0, summaryCount: 0, hasContext: true, hasResearch: false, dirExists: true }), 'discussed');
});

// CASE 7: empty — phase dir exists but nothing else matches
test('CASE 7: deriveDiskStatus — empty when dir exists but all counts=0 and no narrative files', () => {
  assert.equal(deriveDiskStatus({ planCount: 0, summaryCount: 0, hasContext: false, hasResearch: false, dirExists: true }), 'empty');
});

// CASE 8: priority order verification — complete wins even when hasContext+hasResearch present
test('CASE 8: deriveDiskStatus — complete wins over all lower-priority conditions', () => {
  assert.equal(
    deriveDiskStatus({ planCount: 2, summaryCount: 2, hasContext: true, hasResearch: true, dirExists: true }),
    'complete',
    'complete should win when summaryCount >= planCount > 0, even with context + research present'
  );
});
