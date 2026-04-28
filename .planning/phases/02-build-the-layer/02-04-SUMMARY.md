---
phase: 02-build-the-layer
plan: "04"
subsystem: worktree
tags: [bash, git, worktree, post-checkout, sentinel-marker, idempotency]

# Dependency graph
requires: []
provides:
  - "hooks/worktree-post-checkout.sh: sentinel-marked shim that auto-configures git config --worktree gsd-beads.dir in new worktrees"
  - "tests/worktree-tests/auto-config.test.sh: 5 cases verifying worktree auto-configuration"
  - "tests/worktree-tests/append-idempotency.test.sh: 6 cases verifying append-idempotency contract (Plan 02-05 must honor)"
affects: [02-05-install-script, 02-06-e2e-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sentinel-marker block (v1): # --- BEGIN GSD-BEADS WORKTREE INIT v1 --- / # --- END GSD-BEADS WORKTREE INIT ---"
    - "marker-file idempotency: <gitdir>/info/.gsd-beads-configured guards re-entry"
    - "atomic append: mktemp + mv (no sed -i) for T-02-06 compliance"
    - "extensions.worktreeConfig: must be enabled in fixture for git config --worktree to work"
    - "count_pattern helper: { grep ... || true; } | wc -l to avoid set -euo pipefail killing on 0-match grep"

key-files:
  created:
    - hooks/worktree-post-checkout.sh
    - tests/worktree-tests/auto-config.test.sh
    - tests/worktree-tests/append-idempotency.test.sh
  modified: []

key-decisions:
  - "extensions.worktreeConfig true must be set in test fixtures before git worktree add for git config --worktree to succeed (git 2.43.0 requirement)"
  - "Shim falls back from git config --worktree to git config --local when worktreeConfig extension is absent — both paths tested"
  - "count_pattern uses { grep ... || true; } | wc -l rather than grep -c to avoid set -euo pipefail failures on 0-match grep"
  - "T-02-06: append helper uses mktemp+mv (atomic rename); grep -c 'sed -i' returns 0"

patterns-established:
  - "Sentinel-marker append pattern: strip /BEGIN/,/END/ via sed then re-append (v1-agnostic strip regex covers future versions)"
  - "Git worktree fixture: mktemp -d + git config extensions.worktreeConfig true + bd init + append shim + git config core.hooksPath + git worktree add --detach"

requirements-completed: [REQ-03]

# Metrics
duration: 35min
completed: 2026-04-28
---

# Phase 02 Plan 04: Worktree Init Summary

**Sentinel-marked `worktree-post-checkout.sh` shim auto-configures `git config --worktree gsd-beads.dir` in new worktrees; 5+6 test cases pass including worktreeConfig, idempotency, and append strip-and-replace**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-28T07:20:00Z
- **Completed:** 2026-04-28T07:57:57Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments

- `hooks/worktree-post-checkout.sh` production-ready: sentinel-marked block (v1), marker-file idempotency, bd source detection with stderr warning, flag=0 early exit
- `tests/worktree-tests/auto-config.test.sh` all 5 CASEs pass: happy-path worktree add, marker file creation, no-op re-run (marker present), missing .beads/ warning, file-checkout skip
- `tests/worktree-tests/append-idempotency.test.sh` all 6 CASEs pass: first append, double-append still 1 block, bd block coexistence, v1-to-v2 upgrade removes old block
- T-02-06 mitigated: in-test append helper uses `mktemp + mv`; `grep -c 'sed -i' tests/worktree-tests/append-idempotency.test.sh` returns 0

## Task Commits

1. **Task 1: Wave 0 stub test files** - `d5b9651` (test)
2. **Task 2: Shim implementation + complete tests** - `8cb3650` (feat)

## Files Created/Modified

- `hooks/worktree-post-checkout.sh` - Sentinel-marked shim: sets `git config --worktree gsd-beads.dir <source>/.beads`, creates marker file, falls back to `--local` when worktreeConfig extension absent
- `tests/worktree-tests/auto-config.test.sh` - 5 integration test cases covering the shim's 5 behavioral branches; uses ephemeral fixture with `extensions.worktreeConfig true`
- `tests/worktree-tests/append-idempotency.test.sh` - 6 unit test cases for the `append_shim` helper's atomic strip-then-append contract; documents what Plan 02-05's install.sh MUST replicate

## Decisions Made

1. **extensions.worktreeConfig required in test fixtures** — git 2.43.0 refuses `git config --worktree` in multi-worktree repos unless `extensions.worktreeConfig true` is set. Shim falls back to `--local` when absent; test enables the extension to exercise the `--worktree` path.
2. **count_pattern uses `{ grep ... || true; } | wc -l`** — `grep -c` with 0 matches exits 1, which under `set -euo pipefail` kills the script even inside `$(...)`. Wrapping with `|| true` before the pipe absorbs the failure without producing a double-output (the `|| echo 0` pattern causes two lines when grep outputs `0` AND the fallback echoes `0`).
3. **Shim uses `--detach` worktree in tests** — `git worktree add <path> main` fails if `main` is the current branch; `--detach` creates a detached-HEAD worktree reliably.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] git worktree add with branch name fails when branch is current**
- **Found during:** Task 2 (implementing auto-config.test.sh)
- **Issue:** `git worktree add <path> main` fails with "fatal: 'main' is already used by worktree" since main is the current branch in a fresh init
- **Fix:** Used `git worktree add --detach <path>` to create a detached-HEAD worktree that bypasses the branch restriction
- **Files modified:** tests/worktree-tests/auto-config.test.sh
- **Verification:** CASE 1 now passes with detached worktree; worktree path using mktemp -d + rm -rf avoids path collision
- **Committed in:** 8cb3650

**2. [Rule 1 - Bug] git config --worktree fails without extensions.worktreeConfig**
- **Found during:** Task 2 (CASE 1 failing)
- **Issue:** git 2.43.0: `git config --worktree` fails with "cannot be used with multiple working trees unless the config extension worktreeConfig is enabled"
- **Fix:** Added `git config extensions.worktreeConfig true` to test fixture setup; shim's fallback to `--local` still exercised as well
- **Files modified:** tests/worktree-tests/auto-config.test.sh
- **Verification:** CASE 1 passes; `git config --worktree --get gsd-beads.dir` returns expected value
- **Committed in:** 8cb3650

**3. [Rule 1 - Bug] grep -c + set -euo pipefail double-output bug**
- **Found during:** Task 2 (CASE 4 of append-idempotency.test.sh failing with expected=0 actual="0\n0")**
- **Issue:** `$(grep -c ... || echo 0)` captures BOTH grep's "0" output and the echo "0" fallback when grep finds 0 matches and exits 1
- **Fix:** Changed `count_pattern` helper to `{ grep ... || true; } | wc -l | tr -d ' '` — grep exit 1 absorbed by `|| true`, wc counts lines safely
- **Files modified:** tests/worktree-tests/append-idempotency.test.sh
- **Verification:** All 6 CASE 4 assertions now pass
- **Committed in:** 8cb3650

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bug fixes)
**Impact on plan:** All fixes required for tests to pass on git 2.43.0 / bash with set -euo pipefail. No scope creep.

## Issues Encountered

None beyond the 3 auto-fixed bugs above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `hooks/worktree-post-checkout.sh` is ready for Plan 02-05's `install.sh` to append it into `.beads/hooks/post-checkout` using the same `mktemp + mv` atomic pattern demonstrated in `append-idempotency.test.sh`'s `append_shim` helper
- Plan 02-05 MUST: (a) strip existing v1 block before re-appending (idempotent install), (b) use mktemp+mv not sed -i (T-02-06), (c) enable `extensions.worktreeConfig true` for the target repo if per-worktree config is desired
- REQ-03 satisfied: new worktrees auto-configure `gsd-beads.dir` via `git worktree add` triggering post-checkout

## Self-Check: PASSED

- FOUND: hooks/worktree-post-checkout.sh
- FOUND: tests/worktree-tests/auto-config.test.sh
- FOUND: tests/worktree-tests/append-idempotency.test.sh
- FOUND: .planning/phases/02-build-the-layer/02-04-SUMMARY.md
- FOUND: d5b9651 (Task 1 commit)
- FOUND: 8cb3650 (Task 2 commit)

---
*Phase: 02-build-the-layer*
*Completed: 2026-04-28*
