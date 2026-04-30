---
phase: 05-roadmap-read-handlers
plan: "02"
subsystem: helpers
tags:
  - helpers
  - parity-extension
  - parsePhaseId
  - deriveDiskStatus
  - detectDrift
  - loadMilestoneHeading
dependency_graph:
  requires:
    - "05-01 (seed.jsonl with phase-id labels + milestone memories)"
    - "bin/gsd-sdk-shadow.mjs (findBeadsRoot, Phase 4 plumbing)"
    - "tests/shadow-tests/_parity-helpers.mjs (existing assertKeySetParity/assertTypeParity)"
  provides:
    - "parsePhaseId (D-02) exported from bin/gsd-sdk-shadow.mjs"
    - "deriveDiskStatus (D-07) exported from bin/gsd-sdk-shadow.mjs"
    - "detectDrift (D-09/D-10/D-06) exported from bin/gsd-sdk-shadow.mjs"
    - "loadMilestoneHeading (D-15..D-17) exported from bin/gsd-sdk-shadow.mjs"
    - "assertKeySetParityWithExt (D-13) exported from tests/shadow-tests/_parity-helpers.mjs"
    - "5 helper test files covering 32 cases total"
  affects:
    - "Plans 03/04 handler bodies (consume helpers directly)"
    - "Full Phase 5+ parity tests (use assertKeySetParityWithExt with drift extension)"
tech_stack:
  added:
    - "node:test t.mock.method pattern for stderr capture in helper unit tests"
  patterns:
    - "Pure-function helpers exported from shadow module (D-25: no sentinel catching)"
    - "Wave 0 RED/GREEN TDD: test files committed before implementation"
    - "assertKeySetParityWithExt(actual, snapshot, extensions) for bd-only key whitelisting"
key_files:
  created:
    - tests/shadow-tests/helpers-parsePhaseId.test.mjs
    - tests/shadow-tests/helpers-deriveDiskStatus.test.mjs
    - tests/shadow-tests/helpers-detectDrift.test.mjs
    - tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs
  modified:
    - bin/gsd-sdk-shadow.mjs
    - tests/shadow-tests/_parity-helpers.mjs
    - tests/shadow-tests/_parity-helpers.test.mjs
decisions:
  - "All 4 helpers inserted in bin/gsd-sdk-shadow.mjs at lines 283-367 (between findBeadsRoot end and BEADS_READ_OVERRIDES block)"
  - "assertKeySetParityWithExt added to _parity-helpers.mjs as additive export (Option B); existing API unchanged"
  - "Refined D-06 honored: detectDrift summary_count comparison takes distinct bd_summary_count (closed gsd:plan children) vs disk_summary_count (filesystem *-SUMMARY.md count); Plan 03 Task 3 handler must pass these as distinct values"
  - "helpers-detectDrift CASE 3 is the LIVE summary_count divergence proof (bd_summary_count=2, disk_summary_count=1 → drift entry emitted)"
  - "ESM import of assertKeySetParityWithExt moved to file top-level in _parity-helpers.test.mjs (not inside test body) — ESM requires top-level imports"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-30"
  tasks: 2
  files: 7
---

# Phase 5 Plan 02: Shared Helpers Summary

Added 4 shared helper functions to `bin/gsd-sdk-shadow.mjs` and extended `tests/shadow-tests/_parity-helpers.mjs` with `assertKeySetParityWithExt`. Each helper was covered by a Wave 0 RED test stub before implementation (TDD).

## What Was Built

### Task 1: Wave 0 RED test stubs

Five test files created/extended with failing tests:

| File | Cases | Covers |
|------|-------|--------|
| `helpers-parsePhaseId.test.mjs` | 6 | D-02 zero-pad strip, decimal preservation, null/undefined, no-prefix passthrough |
| `helpers-deriveDiskStatus.test.mjs` | 8 | All 7 D-07 priority values + priority-order verification |
| `helpers-detectDrift.test.mjs` | 6 | no-drift, plan_count, LIVE summary_count (refined D-06), closed_without_summary, natural asymmetry, multiple simultaneous |
| `helpers-loadMilestoneHeading.test.mjs` | 4 | Memory hit, missing fallback + stderr, unrelated key fallback, idempotency |
| `_parity-helpers.test.mjs` (extended) | +2 | CASE 7 (assertKeySetParityWithExt whitelist), CASE 8 (non-whitelisted catch) |

All 5 files were RED before Task 2 implementation.

### Task 2: Implementations

**Helper insertion location:** `bin/gsd-sdk-shadow.mjs` lines 283–367, between `findBeadsRoot` end (line 281) and `BEADS_READ_OVERRIDES` block (line 369).

**Exported helper signatures:**

```javascript
// D-02
export function parsePhaseId(label: string | null | undefined): string | null

// D-07
export function deriveDiskStatus({
  planCount, summaryCount, hasContext, hasResearch, dirExists
}): 'complete' | 'partial' | 'planned' | 'researched' | 'discussed' | 'empty' | 'no_directory'

// D-09/D-10 + refined D-06
export function detectDrift(
  phase: string,
  bdState: { plan_count, summary_count, bd_status },
  diskState: { disk_plan_count, disk_summary_count }
): Array<{ phase, kind, bd_value, disk_value }>

// D-15..D-17
export function loadMilestoneHeading(
  memories: Record<string, string>,
  version: string
): string
```

**`_parity-helpers.mjs` extension:**

```javascript
// D-13
export function assertKeySetParityWithExt(
  actual: object,
  snapshot: object,
  extensions: string[] = [],
  path?: string
): void
```

Keys in `extensions` are silently allowed in `actual` even when absent from `snapshot`. Non-whitelisted missing keys still throw. Existing `assertKeySetParity` and `assertTypeParity` exports untouched.

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "^export function parsePhaseId" bin/gsd-sdk-shadow.mjs` = 1 | 1 |
| `grep -c "^export function deriveDiskStatus" bin/gsd-sdk-shadow.mjs` = 1 | 1 |
| `grep -c "^export function detectDrift" bin/gsd-sdk-shadow.mjs` = 1 | 1 |
| `grep -c "^export function loadMilestoneHeading" bin/gsd-sdk-shadow.mjs` = 1 | 1 |
| `grep -c "^export function assertKeySetParityWithExt" _parity-helpers.mjs` = 1 | 1 |
| `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => ...)"` prints `function function function function` | PASS |
| All 5 test files green (pass 32, fail 0) | PASS |
| Full suite `node --test tests/shadow-tests/*.test.mjs` exits 0 | 109/109 PASS |
| `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0 | 2/2 PASS |
| `bash tests/shadow-tests/seed-determinism.test.sh` exits 0 | 2/2 PASS |
| `bash tests/install-tests/upstream-version-pin.test.sh` exits 0 | 2/2 PASS |
| `node --test tests/fixtures/memories-seeded.test.mjs` exits 0 | 3/3 PASS |
| `grep -c "BeadsUnavailableError" bin/gsd-sdk-shadow.mjs` unchanged | 3 (same as Phase 4) |

## Deviations from Plan

None — plan executed exactly as written.

The one structural note: the ESM `import` for `assertKeySetParityWithExt` was placed at the top of `_parity-helpers.test.mjs` (as required by ESM module semantics) rather than inline before CASE 7. This matches ESM requirements and the existing import pattern in that file.

## Known Stubs

None. All 4 helpers are fully implemented pure functions; no hardcoded empty values or TODOs.

## Self-Check: PASSED
