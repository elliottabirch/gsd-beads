---
phase: 05-roadmap-read-handlers
plan: "05"
subsystem: quality-gates
tags:
  - quality-gates
  - determinism-precursor
  - call-count-precursor
  - allowlist-verification
  - phase-11-precursor
dependency_graph:
  requires:
    - 05-01 (seed.jsonl with 11 phases + 24 plans + milestone memories)
    - 05-02 (assertKeySetParityWithExt helper)
    - 05-03 (beadsRoadmapAnalyze handler)
    - 05-04 (beadsRoadmapGetPhase handler)
  provides:
    - tests/shadow-tests/handler-roadmap-determinism.test.sh: 5x byte-identical assertion for both handlers (REQ-QUAL-06 precursor)
    - tests/shadow-tests/handler-roadmap-call-count.test.mjs: <=2 spawns for analyze / <=1 for get-phase (REQ-QUAL-07 precursor)
  affects:
    - Phase 11 test template: both new test files establish the per-handler quality gate pattern
tech_stack:
  added: []
  patterns:
    - handler-roadmap-determinism.test.sh: bash test mirroring seed-determinism.test.sh structure (setup, 2 cases, pass/fail counters)
    - handler-roadmap-call-count.test.mjs: PATH-mock bd shim with flock-protected counter file; t.after() for cleanup
    - withMockBd(t): node:test-integrated helper (vs bd-helper.test.mjs's callback-style helper); returns {counterFile} not a restore fn
key_files:
  created:
    - tests/shadow-tests/handler-roadmap-determinism.test.sh
    - tests/shadow-tests/handler-roadmap-call-count.test.mjs
  modified: []
decisions:
  - "These tests are PRECURSORS — Phase 11 owns REQ-QUAL-04..07 formal enforcement. Plan 05 lands per-handler gates so Phase 6-9 handlers inherit the test-file-naming pattern and Phase 11 extends rather than builds from scratch."
  - "call-count CASE 3 asserts exactly 2 spawns (not just <=2) to make the constant-in-phase-count property explicit as a regression guard against future N+1 fan-out."
  - "determinism test redirects handler stderr to /dev/null (2>/dev/null) to capture clean JSON stdout only; drift[] order is implicitly tested because the full stdout comparison includes it."
metrics:
  duration: ~9 minutes
  completed: "2026-04-29"
  tasks: 3
  files_modified: 0
  files_created: 2
  tests_added: 5
  tests_total: 131
---

# Phase 5 Plan 05: Quality Gates Summary

Lands per-handler quality gates (determinism + call-count) as REQ-QUAL-06 and REQ-QUAL-07 precursors, completing Phase 5. These tests protect REQ-READ-01 (roadmap.analyze) and REQ-READ-02 (roadmap.get-phase) against future ordering regressions and N+1 spawn regressions. Phase 11 will extend the pattern to other read handlers as they ship in Phases 6-9.

## What Was Delivered

### Task 1 — Determinism Precursor

`tests/shadow-tests/handler-roadmap-determinism.test.sh` (2 cases):

- **CASE 1:** 5x `roadmap.analyze` on canonical 11-phase seed fixture — all 5 stdout captures byte-identical
- **CASE 2:** 5x `roadmap.get-phase 5` on same fixture — all 5 stdout captures byte-identical

Design:
- Captures stdout with `2>/dev/null` (stderr suppressed) so drift warnings don't contaminate the comparison
- Uses bash string equality chained across all 5 captures (`[ "$out1" = "$out2" ] && ...`)
- On failure: diffs run1 vs run2 for debugging; continues to collect all failures
- Fixture includes git init + worktree config + 11 phase directories (mirrors handler integration test setup)
- Protects D-28 (priority/created_at/id sort) and drift[] ordering against regressions

### Task 2 — Call-Count Precursor

`tests/shadow-tests/handler-roadmap-call-count.test.mjs` (3 cases):

- **CASE 1:** `roadmap.analyze` <=2 bd spawns on 11-phase fixture (sanity: >=1 also checked)
- **CASE 2:** `roadmap.get-phase` <=1 bd spawn on 11-phase fixture (sanity: >=1 also checked)
- **CASE 3:** `roadmap.analyze` spawns EXACTLY 2 — constant in phase count (N+1 regression guard)

Design:
- `withMockBd(t)`: t.after()-based cleanup (node:test convention); returns `{counterFile}` so caller can read count before/after
- PATH-mock bd shim: delegates to real `which bd` binary so handler output is correct; increments counter file via `flock`-protected atomic write (T-05-10 mitigation)
- `setupBdFixture(t)`: shared helper seeds an 11-phase bd fixture with git + worktree config + .planning/phases dirs
- `readCount(counterFile)`: parses integer from counter file
- `runShadow(args, dir)`: spreads `process.env` (inherits patched PATH) to child process

### Task 3 — Regression Sweep + Stub Absence Verification

No code added. All 7 test runners confirmed green:

| Test Runner | Cases | Result |
|-------------|-------|--------|
| `bd-allowlist-grep.test.sh` | 2/2 | PASS |
| `seed-determinism.test.sh` | 2/2 | PASS |
| `upstream-version-pin.test.sh` | 2/2 | PASS |
| `node --test tests/shadow-tests/*.test.mjs` | 131/131 | PASS |
| `node --test tests/fixtures/memories-seeded.test.mjs` | 3/3 | PASS |
| `handler-roadmap-determinism.test.sh` | 2/2 | PASS |
| `handler-roadmap-call-count.test.mjs` | 3/3 | PASS |

Stub absence verified:
- `! grep -q "_phase4-test-stub" bin/gsd-sdk-shadow.mjs` — PASS (deleted in Plan 03)
- `GSD_SHADOW_TEST_STUB=1 node -e "import('./bin/gsd-sdk-shadow.mjs')..."` — PASS (no underscore keys in BEADS_READ_OVERRIDES)

Carry-forward grep gates (D-22..D-29):
- `findBeadsRoot` count: 6 (>=2 required) — PASS
- `wrapMutation` count: 7 (unchanged from Phase 4 baseline) — PASS
- `BeadsUnavailableError` count: 4 (unchanged) — PASS
- Read-handler bd calls: only `bd(['export','--json'])` and `bd(['memories','--json'])` in production read handlers (both within allowlist) — PASS

## REQ-QUAL-05 Allowlist Sanity Check

`bd-allowlist-grep.test.sh` (2 cases) confirms the canonical allowlist string `list|show|ready|memories|status|prime|export|deps|children|search|help|version` is intact at `hooks/bd-sync.sh:23`. The Plans 03/04 additions of `bd export` and `bd memories` calls in the read handlers are both within this allowlist — no violation. The test is the source-of-truth gate; Phase 11 extends per-read-handler enforcement.

## Phase 11 Inheritance

`handler-roadmap-determinism.test.sh` and `handler-roadmap-call-count.test.mjs` establish the naming convention and test structure for future per-handler quality gates. Phase 11 will:
1. Extend `handler-roadmap-determinism.test.sh` to add CASE 3+N for `progress.*`, `state.*`, etc.
2. Extend `handler-roadmap-call-count.test.mjs` to add CASE 4+N for those same handlers
3. Add cross-handler perf tests (500ms budget) and 50-phase fixture runs per REQ-QUAL-07 formal spec

## Phase 5 Completion Summary

All 5 plans complete. 5 waves, all wave dependencies satisfied:

| Plan | Name | Tests Added | Total |
|------|------|-------------|-------|
| 05-01 | fixture-migration | - | baseline |
| 05-02 | shared-helpers | 4 helpers + parity ext | baseline |
| 05-03 | roadmap-analyze | 20+ cases | 120 |
| 05-04 | roadmap-get-phase | 8 cases | 128 |
| 05-05 | quality-gates | 5 cases (3 mjs + 2 bash) | 131 mjs |

Requirements satisfied: REQ-READ-01 (Plan 03), REQ-READ-02 (Plan 04). All 29 CONTEXT decisions honored. 5 ROADMAP success criteria met. Phase 5 is ready for `/gsd-verify-work`.

## Deviations from Plan

None — plan executed exactly as written. Both test files matched the plan's pseudocode structure without correction. The 3 call-count test cases aligned exactly with the D-27 budget contract.

## Known Stubs

None — both test files are complete with live fixture data.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both new files are test-only artifacts with no production code path.

## Self-Check: PASSED

Commits verified:
- ab9f6ad (Task 1: determinism test)
- e2f0100 (Task 2: call-count test)

Files verified:
- tests/shadow-tests/handler-roadmap-determinism.test.sh: FOUND
- tests/shadow-tests/handler-roadmap-call-count.test.mjs: FOUND
