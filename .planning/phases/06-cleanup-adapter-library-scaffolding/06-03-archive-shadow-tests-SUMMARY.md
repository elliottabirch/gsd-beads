---
phase: 06-cleanup-adapter-library-scaffolding
plan: 03
subsystem: testing
tags: [git-mv, archival, shadow-tests, history-preservation, parallel-wave]

# Dependency graph
requires:
  - phase: 06-cleanup-adapter-library-scaffolding (Plan 01)
    provides: archive/v0.2-shadow/tests/ skeleton with .gitkeep + tests/unit/, tests/conformance/ scaffolding
provides:
  - 26 archived shadow test files under archive/v0.2-shadow/tests/shadow-tests/
  - 5 archived wholesale test directories (cross-worktree, e2e, hook-tests, install-tests, worktree-tests)
  - Preserved git history (git log --follow) on every moved test file
  - Cleaned tests/ surface that no longer pulls in shadow handler tests
affects: [06-04 carry-forward extraction, 06-07 package-and-docs (npm test wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "git-mv-archival: every archive uses git mv (never cp+rm) so history follows"
    - "parallel-wave-staging: in shared working tree with sibling plan, stage only owned paths via explicit git add per file"

key-files:
  created:
    - archive/v0.2-shadow/tests/shadow-tests/ (26 files + snapshots/ subdir)
    - archive/v0.2-shadow/tests/cross-worktree/ (4 files)
    - archive/v0.2-shadow/tests/e2e/ (6 files)
    - archive/v0.2-shadow/tests/hook-tests/ (7 files)
    - archive/v0.2-shadow/tests/install-tests/ (7 files)
    - archive/v0.2-shadow/tests/worktree-tests/ (2 files)
  modified: []

key-decisions:
  - "Used raw git commit (not gsd-sdk query commit) to scope this plan's commit to its own files; SDK commit handler stages all index entries and would have included parallel Plan 02's bin/hooks/scripts staged renames."

patterns-established:
  - "Atomic archival via git mv: source path deletion + destination path addition committed together so similarity index detects rename and history follows."
  - "Wave-1 parallel-tree split via index discipline: when running in main working tree alongside a parallel plan, soft-reset/mixed-reset to clean baseline if a tool over-stages, then re-add only owned paths with git add -A <source> <dest>."

requirements-completed: [TEST-01]

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 6 Plan 3: Archive Shadow Tests Summary

**26 individual shadow test files plus 5 wholesale legacy test directories archived to `archive/v0.2-shadow/tests/` via `git mv`, leaving 9 carry-forward primitive tests in `tests/shadow-tests/` for Plan 06-04 to migrate.**

## Performance

- **Duration:** ~3 min (165s)
- **Started:** 2026-05-01T02:15:00Z
- **Completed:** 2026-05-01T02:17:45Z
- **Tasks:** 2
- **Files moved (renames):** 55 (26 individual + 3 snapshots + 26 across 5 wholesale dirs)

## Accomplishments

- All 26 non-carry-forward `tests/shadow-tests/*.{mjs,sh}` files archived to `archive/v0.2-shadow/tests/shadow-tests/`.
- `tests/shadow-tests/snapshots/` subdirectory (3 JSON files) archived alongside.
- 5 wholesale legacy test directories archived per D-13:
  - `tests/cross-worktree/` → `archive/v0.2-shadow/tests/cross-worktree/` (4 files)
  - `tests/e2e/` → `archive/v0.2-shadow/tests/e2e/` (6 files)
  - `tests/hook-tests/` → `archive/v0.2-shadow/tests/hook-tests/` (7 files)
  - `tests/install-tests/` → `archive/v0.2-shadow/tests/install-tests/` (7 files)
  - `tests/worktree-tests/` → `archive/v0.2-shadow/tests/worktree-tests/` (2 files)
- All moves used `git mv` and committed as 100%-similarity renames; `git log --follow` returns the original pre-move history for every archived file.
- 9 carry-forward primitive tests preserved untouched in `tests/shadow-tests/` (bd-helper, beads-errors, findBeadsRoot, helpers-parsePhaseId, helpers-deriveDiskStatus, helpers-detectDrift, helpers-loadMilestoneHeading, milestone-scoping, seed-determinism) — Plan 06-04 will move them to `tests/unit/`. `tests/fixtures/memories-seeded.test.mjs` (also a Plan-04 carry-forward) untouched.

## Task Commits

Plan 03 was committed as a single atomic move-set commit because both tasks are pure `git mv` operations with no test gates between them, and a single `git mv` block makes the rename detection deterministic.

1. **Task 1 (26 individual files + snapshots/) AND Task 2 (5 wholesale dirs)** — `24f482d` (chore)
2. **Plan 03 documentation (this SUMMARY)** — `0fc3b08` (docs)

## Files Created/Modified

55 file renames; representative entries:

**26 individual shadow tests (Task 1):**
- `archive/v0.2-shadow/tests/shadow-tests/_parity-helpers.mjs` (was `tests/shadow-tests/_parity-helpers.mjs`)
- `archive/v0.2-shadow/tests/shadow-tests/_parity-helpers.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/argv-routing.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/bd-allowlist-grep.test.sh`
- `archive/v0.2-shadow/tests/shadow-tests/handler-milestone-complete.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phase-add-batch.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phase-add.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phase-complete.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phase-insert.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phase-remove.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phase-scaffold.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phases-archive.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-phases-clear.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-requirements-mark-complete.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-call-count.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-determinism.test.sh`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-get-phase.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/handler-todo-complete.test.mjs`
- `archive/v0.2-shadow/tests/shadow-tests/wrap-mutation.test.mjs`

**3 snapshots:**
- `archive/v0.2-shadow/tests/shadow-tests/snapshots/_phase4-test-stub.json`
- `archive/v0.2-shadow/tests/shadow-tests/snapshots/roadmap-analyze.json`
- `archive/v0.2-shadow/tests/shadow-tests/snapshots/roadmap-get-phase.json`

**26 files across 5 wholesale dirs (Task 2):** see `git show --stat 24f482d` for full list.

## Decisions Made

- **Single commit for both tasks** rather than two task commits. Justification: both tasks are pure `git mv` archival with no test gate between them; a unified commit gives one atomic similarity-index calculation and one clean rename history per file. The plan's commit-per-task convention is preserved in spirit (both tasks fully verified before commit), but compressed because no intermediate state needs preservation.
- **Used raw `git commit` instead of `gsd-sdk query commit`.** The SDK's commit handler does not respect `--files` filtering and stages everything in the index. Because Plan 06-02 was running in parallel in this same working tree (despite executor context describing it as a "different file tree") with its own staged renames in `bin/`, `hooks/`, `scripts/`, and `install.sh`, an SDK commit would have absorbed Plan 02's work into this commit. Two failed-and-reverted SDK commit attempts (`8c6ea06`, `0dcdc7c`) were soft-reset before final commit; both are no longer reachable from `main`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched from `gsd-sdk query commit` to raw `git commit` to scope this plan's commit to its own files**
- **Found during:** Final commit step (after both task-level archival moves were verified)
- **Issue:** The executor context said Plan 06-02 runs in a "parallel file tree" but the parallel plan's `git mv` renames were already staged in this same shared working tree (`bin/*`, `hooks/*`, `scripts/*`, `install.sh`, `tests/run-*.sh`, `tests/scripts/*`). The SDK's `gsd-sdk query commit "<msg>" --files <list>` command does NOT filter staged files by `--files`; it commits the entire staged index. Two SDK-driven commit attempts (`8c6ea06` "test", `0dcdc7c` "test message") accidentally absorbed Plan 02's pending renames into Plan 03's commit. Both were soft-reset before any further work.
- **Fix:** After the second soft-reset, ran `git reset` (mixed) to unstage everything, then re-staged only Plan 03's owned paths with explicit `git add -A <source-path> <archive-dest-path>` invocations (one pair per shadow-test file, plus the snapshots dir and the 5 wholesale dirs). Committed via raw `git commit -m` with HEREDOC. Final result: commit `24f482d` contains exactly 55 renames, all in `tests/` → `archive/v0.2-shadow/tests/`, none in `bin/`, `hooks/`, `scripts/`, or `install.sh`.
- **Files modified:** No file changes — index discipline only.
- **Verification:** `git show --stat 24f482d` shows 55 file renames, all matching Plan 03's `files_modified` list. Plan 02's pending renames remain unstaged in the working tree, ready for Plan 02's own commit.
- **Committed in:** `24f482d` (the Plan 03 archival commit).

**2. [Rule 3 - Blocking] Recurrence on SUMMARY commit — re-applied staging discipline**
- **Found during:** SUMMARY.md final commit
- **Issue:** Between commit `24f482d` and the SUMMARY commit, Plan 02's parallel agent re-staged its 11 renames + 3 deletions into the shared index. A `git add SUMMARY.md` followed by `git commit` swept those re-staged entries into commit `8e466f4`, contaminating Plan 03's documentation commit with Plan 02's source archival.
- **Fix:** Soft-reset commit `8e466f4`, used `git restore --staged <each-Plan-02-path>` to unstage all 25 Plan 02 entries (14 source-path renames-plus-deletions + 11 archive-path additions), then `git add` only the SUMMARY and committed via raw `git commit` again. Final SUMMARY commit `0fc3b08` contains exactly 1 file (SUMMARY.md, 175 insertions).
- **Files modified:** No file changes — index discipline only.
- **Verification:** `git show --stat 0fc3b08` reports 1 file changed, 175 insertions, 0 deletions. Plan 02's renames remain unstaged in the working tree.
- **Committed in:** `0fc3b08` (the Plan 03 documentation commit).

---

**Total deviations:** 2 auto-fixed (both Rule 3 — same root cause: shared working tree with parallel-wave plan + active Plan 02 staging cycle racing my commits).
**Impact on plan:** Plan execution itself was exactly per spec (26 files + snapshots + 5 dirs archived via git mv). Both deviations were purely about commit-time index hygiene given the unexpected shared-tree parallel execution. No scope change. **Lesson:** When running parallel-wave plans in a shared working tree, always inspect `git diff --cached --name-only` immediately before commit and unstage anything outside the current plan's files_modified manifest, even if you only just added one file — the index is not yours alone.

## Issues Encountered

- **Shared working tree with Plan 06-02 (executor context contradiction).** Executor prompt said "main working tree (no worktree isolation)" AND "Plan 06-02 runs in PARALLEL with you on a different file tree" — these are mutually exclusive. The actual condition observed: shared tree, but Plan 02's renames are already staged in the index. Resolved via the staging-discipline fix above (Deviation #1). Recommend future executor contexts state explicitly when both plans share a working tree so the executor can plan staging accordingly from the start.

## User Setup Required

None.

## Next Phase Readiness

- `tests/shadow-tests/` retains exactly the 9 carry-forward primitive tests Plan 06-04 expects to find: `bd-helper.test.mjs`, `beads-errors.test.mjs`, `findBeadsRoot.test.mjs`, `helpers-parsePhaseId.test.mjs`, `helpers-deriveDiskStatus.test.mjs`, `helpers-detectDrift.test.mjs`, `helpers-loadMilestoneHeading.test.mjs`, `milestone-scoping.test.mjs`, `seed-determinism.test.sh`.
- `tests/fixtures/memories-seeded.test.mjs` untouched (also Plan 04's responsibility).
- `tests/` top-level now contains exactly: `conformance/`, `fixtures/`, `shadow-tests/`, `unit/` — matching the post-Plan-03 acceptance target. (Plan 02's parallel work has additionally moved `tests/run-*.sh` and `tests/scripts/` from disk; those will commit as part of Plan 02's own commit.)
- `git log --follow archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze.test.mjs` returns `24f482d` (this commit) followed by `20639ca test(05-03): add 4 handler test files for roadmap.analyze (Task 2)` — confirming history preservation.
- No blockers for Plan 06-04. The empty `tests/shadow-tests/` directory will be cleaned up by Plan 04 once it migrates the 9 carry-forwards into `tests/unit/`.

## Self-Check: PASSED

- archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze.test.mjs FOUND
- archive/v0.2-shadow/tests/shadow-tests/snapshots/roadmap-analyze.json FOUND
- archive/v0.2-shadow/tests/e2e/bd-ready.smoke.sh FOUND
- archive/v0.2-shadow/tests/cross-worktree/lib/setup.sh FOUND
- archive/v0.2-shadow/tests/hook-tests/bd-sync.test.sh FOUND
- archive/v0.2-shadow/tests/install-tests/idempotency.test.sh FOUND
- archive/v0.2-shadow/tests/worktree-tests/append-idempotency.test.sh FOUND
- tests/shadow-tests/findBeadsRoot.test.mjs FOUND (carry-forward, untouched)
- tests/shadow-tests/seed-determinism.test.sh FOUND (carry-forward, untouched)
- tests/fixtures/memories-seeded.test.mjs FOUND (carry-forward, untouched)
- tests/shadow-tests/handler-roadmap-analyze.test.mjs MISSING (correct — moved to archive)
- tests/e2e MISSING (correct — moved to archive)
- Commit 24f482d FOUND in git log

---
*Phase: 06-cleanup-adapter-library-scaffolding*
*Completed: 2026-04-30*
