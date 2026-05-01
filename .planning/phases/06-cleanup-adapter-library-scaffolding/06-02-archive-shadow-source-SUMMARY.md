---
phase: 06-cleanup-adapter-library-scaffolding
plan: 02
subsystem: infra

tags: [git-mv, archive, history-preservation, cleanup, shadow-architecture]

# Dependency graph
requires:
  - phase: 06-cleanup-adapter-library-scaffolding (Plan 01)
    provides: archive/v0.2-shadow/{bin,hooks,scripts,tests/scripts} skeleton with .gitkeep + README
provides:
  - "v0.2 shadow source archived under archive/v0.2-shadow/ with full git history (12 files via git mv)"
  - "install.sh deleted (CLEAN-04 — repo no longer self-installs)"
  - "tests/run-{all,quick}.sh deleted (npm test is the new contract per RESEARCH §10 Risk #8)"
  - "tests/scripts/update-snapshots.mjs archived alongside shadow snapshots"
  - "structural-cleanup.test.mjs flips 4/5 green (CLEAN-01, CLEAN-02, CLEAN-03 file moves, CLEAN-04)"
affects: [06-04-carry-forward-extraction, 06-07-package-and-docs, 06-cleanup-adapter-library-scaffolding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "git mv (never cp+rm) for any archival relocation — preserves history per ROADMAP SC #1"
    - "Pre-existing rmdir-after-move pattern: rmdir hooks/ scripts/ once empty"

key-files:
  created:
    - archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs
    - archive/v0.2-shadow/bin/wrap-mutation.mjs
    - archive/v0.2-shadow/hooks/bd-sync.sh
    - archive/v0.2-shadow/hooks/block-gsd-sdk-mutation.sh
    - archive/v0.2-shadow/hooks/block-state-md.sh
    - archive/v0.2-shadow/hooks/worktree-post-checkout.sh
    - archive/v0.2-shadow/scripts/cascade-loop.sh
    - archive/v0.2-shadow/scripts/regen-requirements.sh
    - archive/v0.2-shadow/scripts/regen-roadmap.sh
    - archive/v0.2-shadow/scripts/regen-state.sh
    - archive/v0.2-shadow/tests/scripts/update-snapshots.mjs
  modified:
    - bin/ (now contains only bd-helper.mjs + beads-errors.mjs; awaiting Plan 06-04)
    - hooks/ (removed entirely)
    - scripts/ (removed entirely)
    - tests/scripts/ (removed entirely)

key-decisions:
  - "git mv (not cp+rm) for every archival move — required by ROADMAP SC #1 and threat T-6.02-01"
  - "install.sh deleted, NOT archived (CLEAN-04 + CONTEXT.md confirms delete)"
  - "tests/run-{all,quick}.sh deleted (RESEARCH §10 Risk #8 + Plan 07's npm test contract)"
  - "worktree-post-checkout.sh archived per D-12 (originally not in CLEAN-02 scope)"
  - "cascade-loop.sh archived per D-12 (overrides REQUIREMENTS.md CLEAN-03 wording — wording fix is Plan 07's responsibility)"

patterns-established:
  - "Archival rule: every move is `git mv source archive/v0.2-shadow/<subdir>/source` so `git log --follow archive/...` returns the original commits"

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-04]

# Metrics
duration: 6min
completed: 2026-05-01
---

# Phase 6 Plan 02: Archive shadow source Summary

**Twelve v0.2 shadow files relocated to `archive/v0.2-shadow/{bin,hooks,scripts,tests/scripts}/` via `git mv` (full history preserved); `install.sh` and the `tests/run-{all,quick}.sh` orphan drivers deleted; structural-cleanup test flipped 4/5 green.**

## Performance

- **Duration:** ~6 min (including parallel-execution conflict recovery — see Issues)
- **Started:** 2026-05-01T02:15:06Z
- **Completed:** 2026-05-01T02:21:02Z
- **Tasks:** 5 (all autonomous, no checkpoints)
- **Files in commit:** 14 (11 renames + 3 deletes)

## Accomplishments

- **CLEAN-01:** `bin/gsd-sdk-shadow.mjs` and `bin/wrap-mutation.mjs` archived to `archive/v0.2-shadow/bin/` — `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` traces back through Phase 5 commits (`72340ed`, `a1d190a`, `a3987bb`, `346962c`, `c53ebe3`).
- **CLEAN-02 + D-12:** All four shadow hooks archived to `archive/v0.2-shadow/hooks/` (block-gsd-sdk-mutation, block-state-md, bd-sync, worktree-post-checkout). `bd-sync.sh` traces back to `a13707c feat(02-02)`; `worktree-post-checkout.sh` traces back to `8cb3650 feat(02-04)`. `hooks/` removed.
- **CLEAN-03 file moves + D-12:** All four scripts archived (regen-roadmap, regen-requirements, regen-state, cascade-loop). `cascade-loop.sh` traces back to `18c2da1 feat(02-01)`. `scripts/` removed. (REQUIREMENTS.md wording fix per D-12 deferred to Plan 06-07 per plan split.)
- **CLEAN-04:** `install.sh` deleted (NOT archived per CONTEXT.md). `install/memories/` (8 seed files) untouched.
- **RESEARCH §10 Risk #8:** `tests/run-all.sh` and `tests/run-quick.sh` deleted (npm test is the new contract); `tests/scripts/update-snapshots.mjs` archived (preserved). `tests/scripts/` removed.
- **Wave 0 test progress:** `tests/unit/structural-cleanup.test.mjs` flips from 0/5 green to 4/5 green; the remaining failure (CLEAN-03 wording) is reserved for Plan 06-07.

## Task Commits

All 5 tasks landed in a single atomic commit (the plan-level guidance instructed "DO NOT commit yet — Plan execution will commit after the full plan succeeds. The two `git mv` commands are atomic in the index.") so all 12 archival moves + 3 deletes ship together with consistent history-preservation guarantees.

1. **Task 1: Archive bin/ shadow files (CLEAN-01)** — `git mv` × 2
2. **Task 2: Archive hooks/ shadow scripts (CLEAN-02 + D-12)** — `git mv` × 4 + rmdir hooks/
3. **Task 3: Archive scripts/ regen + cascade-loop (CLEAN-03 file moves; D-12)** — `git mv` × 4 + rmdir scripts/
4. **Task 4: Delete install.sh (CLEAN-04)** — `git rm` × 1
5. **Task 5: Remove obsolete test drivers** — `git rm` × 2 + `git mv` × 1 + rmdir tests/scripts/

**Plan commit:** `5353930 chore(06-02): archive v0.2 shadow source (bin/hooks/scripts) + delete install.sh`

## Files Created/Modified

### Created (via git mv — full history preserved)

| Archive path | Source | Earliest commit (via --follow) |
|--------------|--------|-------------------------------|
| `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` | `bin/gsd-sdk-shadow.mjs` | `c53ebe3 feat(04-02)` |
| `archive/v0.2-shadow/bin/wrap-mutation.mjs` | `bin/wrap-mutation.mjs` | `3edc1fa feat(02-03)` |
| `archive/v0.2-shadow/hooks/bd-sync.sh` | `hooks/bd-sync.sh` | `a13707c feat(02-02)` |
| `archive/v0.2-shadow/hooks/block-gsd-sdk-mutation.sh` | `hooks/block-gsd-sdk-mutation.sh` | `b51abbc fix(hooks)` |
| `archive/v0.2-shadow/hooks/block-state-md.sh` | `hooks/block-state-md.sh` | `4f794ae feat(02-02)` |
| `archive/v0.2-shadow/hooks/worktree-post-checkout.sh` | `hooks/worktree-post-checkout.sh` | `8cb3650 feat(02-04)` |
| `archive/v0.2-shadow/scripts/cascade-loop.sh` | `scripts/cascade-loop.sh` | `18c2da1 feat(02-01)` |
| `archive/v0.2-shadow/scripts/regen-requirements.sh` | `scripts/regen-requirements.sh` | `1bb6dd2 feat(03-01)` |
| `archive/v0.2-shadow/scripts/regen-roadmap.sh` | `scripts/regen-roadmap.sh` | `a3be6c3 feat(02-01)` |
| `archive/v0.2-shadow/scripts/regen-state.sh` | `scripts/regen-state.sh` | (Phase 3 cascade preamble) |
| `archive/v0.2-shadow/tests/scripts/update-snapshots.mjs` | `tests/scripts/update-snapshots.mjs` | `a8d9c6a feat(05-03)` |

### Deleted

- `install.sh` — repo no longer self-installs into `~/.claude/`
- `tests/run-all.sh` — orphan driver referencing now-archived test dirs
- `tests/run-quick.sh` — same as above

### Empty parent directories removed

- `hooks/` (removed)
- `scripts/` (removed)
- `tests/scripts/` (removed)
- `bin/` retained (still contains `bd-helper.mjs` + `beads-errors.mjs`; Plan 06-04 will move both to `src/bd/`)

## Decisions Made

- **All moves use `git mv`** — no `cp + git rm`. Verified by `git log --follow` returning each file's pre-archive commit history (table above) and `git status` reporting `R` (rename), not `D + ??`.
- **Single atomic commit for the whole plan** — the plan instructed staging-only commits per task and a final unified commit. Renames + deletes ship together so the log shows one self-contained "archive" commit rather than 5 partial commits, each of which would be confusing to bisect.
- **D-12 honored on file-move side** — `cascade-loop.sh` and `worktree-post-checkout.sh` archived even though REQUIREMENTS.md still says cascade-loop "stays" and worktree-post-checkout was originally outside CLEAN-02. The wording fix in REQUIREMENTS.md is Plan 06-07's responsibility per the plan split, so the structural-cleanup test's "CLEAN-03 wording" assertion legitimately remains red after this plan.

## Deviations from Plan

None — plan executed as written. The 5 tasks ran in order; every `git mv` succeeded; every acceptance check passed; the structural-cleanup test landed in the predicted 4/5 green state.

## Issues Encountered

**Parallel-execution race with Plan 06-03's index activity.** Plan 06-03 ran concurrently in the same working tree (the prompt described disjoint file sets but a single git index). When 06-03 staged its renames, my `git mv` results coexisted in the index correctly; however when 06-03 committed, its commit-pipeline appears to have unstaged my work twice (the index dropped from "11 R + 3 D + 06-03's renames" to a state where my moves showed as `D + ??` instead of `R`). 06-03's `git commit` invocation is the suspect; whichever helper it used selectively staged only its own pathspecs, but in doing so it cleared the rest of the index.

**Resolution:** I let 06-03 finish entirely (verified via `git log` showing `0fc3b08 docs(06-03): complete archive-shadow-tests plan summary`), then re-staged my files via `git add -A bin/ hooks archive/v0.2-shadow/bin ...` and `git rm install.sh tests/run-all.sh tests/run-quick.sh`. Once the race window closed, the `git commit` ran cleanly and produced the rename-detected commit `5353930`.

**Lesson for future parallel waves:** Even with disjoint `files_modified` sets, the single git index makes "stage now, commit at the end" fragile under concurrency. Two safer patterns exist: (a) commit-per-task (each task commits its own subset immediately, no cross-task index state to lose), or (b) worktree-per-plan isolation. The orchestrator note about "no worktree isolation" should perhaps be paired with "commit per task to avoid index races," but that's a process tweak for Phase 7 to consider, not a deviation in this plan.

## User Setup Required

None — purely internal cleanup.

## Next Phase Readiness

- **Plan 06-04 unblocked:** `findBeadsRoot()` extraction can now cite `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` as its source location with `git log --follow` history intact (RESEARCH.md §10 Risk #5 mitigation in place). `bin/bd-helper.mjs` and `bin/beads-errors.mjs` remain in `bin/` for 06-04 to verbatim-relocate to `src/bd/`.
- **Plan 06-07 has the open work item:** edit `.planning/REQUIREMENTS.md` CLEAN-03 wording so the assertion `assert.match(req, /scripts\/cascade-loop\.sh also archives/)` flips green. The other four structural-cleanup assertions are already green and will stay green.
- **bin/ retains exactly two files** (`bd-helper.mjs`, `beads-errors.mjs`) — matches the "bin/ not fully empty after this plan" guidance in the executor prompt; Plan 06-04 will remove them after relocation.

## TDD Gate Compliance

Not applicable — plan type is `execute`, not `tdd`. The Wave 0 structural-cleanup test (added by Plan 06-01) acts as a regression gate that this plan partially flips green; Plan 06-07 finishes the flip.

## Self-Check: PASSED

Verified:
- `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` FOUND
- `archive/v0.2-shadow/bin/wrap-mutation.mjs` FOUND
- `archive/v0.2-shadow/hooks/{bd-sync,block-gsd-sdk-mutation,block-state-md,worktree-post-checkout}.sh` ALL FOUND
- `archive/v0.2-shadow/scripts/{cascade-loop,regen-requirements,regen-roadmap,regen-state}.sh` ALL FOUND
- `archive/v0.2-shadow/tests/scripts/update-snapshots.mjs` FOUND
- `bin/gsd-sdk-shadow.mjs`, `bin/wrap-mutation.mjs` GONE
- `hooks/`, `scripts/`, `tests/scripts/` GONE
- `install.sh`, `tests/run-all.sh`, `tests/run-quick.sh` GONE
- Commit `5353930` FOUND in git log
- `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` returns 5+ commits (history preserved)
- `node --test tests/unit/structural-cleanup.test.mjs` reports 4/5 pass, 1/5 fail (CLEAN-03 wording — expected, deferred to 06-07)

---
*Phase: 06-cleanup-adapter-library-scaffolding*
*Completed: 2026-05-01*
