---
phase: 6
plan: 03
type: execute
wave: 1
depends_on: [01]
files_modified:
  - tests/shadow-tests/_parity-helpers.mjs
  - tests/shadow-tests/_parity-helpers.test.mjs
  - tests/shadow-tests/argv-routing.test.mjs
  - tests/shadow-tests/bd-allowlist-grep.test.sh
  - tests/shadow-tests/handler-milestone-complete.test.mjs
  - tests/shadow-tests/handler-phase-add-batch.test.mjs
  - tests/shadow-tests/handler-phase-add.test.mjs
  - tests/shadow-tests/handler-phase-complete.test.mjs
  - tests/shadow-tests/handler-phase-insert.test.mjs
  - tests/shadow-tests/handler-phase-remove.test.mjs
  - tests/shadow-tests/handler-phase-scaffold.test.mjs
  - tests/shadow-tests/handler-phases-archive.test.mjs
  - tests/shadow-tests/handler-phases-clear.test.mjs
  - tests/shadow-tests/handler-requirements-mark-complete.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze.test.mjs
  - tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs
  - tests/shadow-tests/handler-roadmap-call-count.test.mjs
  - tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs
  - tests/shadow-tests/handler-roadmap-determinism.test.sh
  - tests/shadow-tests/handler-roadmap-get-phase.test.mjs
  - tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs
  - tests/shadow-tests/handler-todo-complete.test.mjs
  - tests/shadow-tests/wrap-mutation.test.mjs
  - tests/shadow-tests/snapshots/
  - tests/cross-worktree/
  - tests/e2e/
  - tests/hook-tests/
  - tests/install-tests/
  - tests/worktree-tests/
  - archive/v0.2-shadow/tests/shadow-tests/
  - archive/v0.2-shadow/tests/cross-worktree/
  - archive/v0.2-shadow/tests/e2e/
  - archive/v0.2-shadow/tests/hook-tests/
  - archive/v0.2-shadow/tests/install-tests/
  - archive/v0.2-shadow/tests/worktree-tests/
autonomous: true
requirements:
  - TEST-01
must_haves:
  truths:
    - "All 26 non-migrated tests/shadow-tests/ files moved to archive/v0.2-shadow/tests/shadow-tests/"
    - "5 wholesale test directories (cross-worktree, e2e, hook-tests, install-tests, worktree-tests) moved to archive/v0.2-shadow/tests/"
    - "tests/shadow-tests/snapshots/ moved to archive/v0.2-shadow/tests/shadow-tests/snapshots/"
    - "11 carry-forward tests REMAIN in tests/shadow-tests/ (Plan 04 migrates them)"
    - "git log --follow on any archived test file returns its original history"
  artifacts:
    - path: "archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze.test.mjs"
      provides: "preserved handler-test as reference"
    - path: "archive/v0.2-shadow/tests/e2e/"
      provides: "preserved e2e test suite"
  key_links:
    - from: "archive/v0.2-shadow/tests/shadow-tests/"
      to: "git history of original tests/shadow-tests/handler-* files"
      via: "git mv per file"
      pattern: "git log --follow archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze.test.mjs"
---

<objective>
Archive every test file in `tests/shadow-tests/` that is NOT a
carry-forward target (per RESEARCH.md §7 file-by-file table). Plan 04
will then `git mv` the 11 carry-forward tests into `tests/unit/`.
Also archive 5 wholesale test directories per D-13.

Purpose: Cleans the test surface so `npm test` (which `node --test
tests/unit/ tests/conformance/` invokes per Plan 07's package.json) does
not pick up shadow handler tests that depend on the archived shadow
binary.

Output: 26 archived shadow test files + 5 archived test directories,
all under `archive/v0.2-shadow/tests/`. tests/shadow-tests/ retains only
the 11 carry-forward files and tests/scripts/ (already handled by Plan 02).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-VALIDATION.md

<interfaces>
<!-- Disposition table per RESEARCH.md §7 lines 788-832. -->

ARCHIVE (26 files in tests/shadow-tests/):
  _parity-helpers.mjs
  _parity-helpers.test.mjs
  argv-routing.test.mjs
  bd-allowlist-grep.test.sh
  handler-milestone-complete.test.mjs
  handler-phase-add-batch.test.mjs
  handler-phase-add.test.mjs
  handler-phase-complete.test.mjs
  handler-phase-insert.test.mjs
  handler-phase-remove.test.mjs
  handler-phase-scaffold.test.mjs
  handler-phases-archive.test.mjs
  handler-phases-clear.test.mjs
  handler-requirements-mark-complete.test.mjs
  handler-roadmap-analyze-counts.test.mjs
  handler-roadmap-analyze-drift.test.mjs
  handler-roadmap-analyze-milestone-scoping.test.mjs
  handler-roadmap-analyze.test.mjs
  handler-roadmap-annotate-dependencies.test.mjs
  handler-roadmap-call-count.test.mjs
  handler-roadmap-cross-handler-parity.test.mjs
  handler-roadmap-determinism.test.sh
  handler-roadmap-get-phase.test.mjs
  handler-roadmap-update-plan-progress.test.mjs
  handler-todo-complete.test.mjs
  wrap-mutation.test.mjs
  snapshots/   (3 snapshot files inside; archive whole dir)

DO NOT TOUCH (Plan 04 migrates these to tests/unit/):
  bd-helper.test.mjs
  beads-errors.test.mjs
  findBeadsRoot.test.mjs
  helpers-deriveDiskStatus.test.mjs
  helpers-detectDrift.test.mjs
  helpers-loadMilestoneHeading.test.mjs
  helpers-parsePhaseId.test.mjs
  milestone-scoping.test.mjs
  seed-determinism.test.sh

ALSO archive (5 wholesale dirs per D-13):
  tests/cross-worktree/        → archive/v0.2-shadow/tests/cross-worktree/
  tests/e2e/                    → archive/v0.2-shadow/tests/e2e/
  tests/hook-tests/             → archive/v0.2-shadow/tests/hook-tests/
  tests/install-tests/          → archive/v0.2-shadow/tests/install-tests/
  tests/worktree-tests/         → archive/v0.2-shadow/tests/worktree-tests/

Also note: tests/fixtures/memories-seeded.test.mjs is migrated by Plan 04
to tests/unit/memories-seeded.test.mjs (NOT this plan).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Archive 26 non-carry-forward shadow test files</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §7 lines 786-832 (file-by-file disposition)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-10 (test triage policy)
  </read_first>
  <files>
    See files_modified above — 26 individual files under tests/shadow-tests/ + the snapshots/ subdir
  </files>
  <action>
    Use `git mv` for each archived test file. Group as a single shell
    command list to keep the index atomic. The carry-forward 11 files
    listed in <interfaces> are NOT touched — Plan 04 owns them.

    ```bash
    # Top-level shadow tests to archive (26 files)
    for f in \
        _parity-helpers.mjs \
        _parity-helpers.test.mjs \
        argv-routing.test.mjs \
        bd-allowlist-grep.test.sh \
        handler-milestone-complete.test.mjs \
        handler-phase-add-batch.test.mjs \
        handler-phase-add.test.mjs \
        handler-phase-complete.test.mjs \
        handler-phase-insert.test.mjs \
        handler-phase-remove.test.mjs \
        handler-phase-scaffold.test.mjs \
        handler-phases-archive.test.mjs \
        handler-phases-clear.test.mjs \
        handler-requirements-mark-complete.test.mjs \
        handler-roadmap-analyze-counts.test.mjs \
        handler-roadmap-analyze-drift.test.mjs \
        handler-roadmap-analyze-milestone-scoping.test.mjs \
        handler-roadmap-analyze.test.mjs \
        handler-roadmap-annotate-dependencies.test.mjs \
        handler-roadmap-call-count.test.mjs \
        handler-roadmap-cross-handler-parity.test.mjs \
        handler-roadmap-determinism.test.sh \
        handler-roadmap-get-phase.test.mjs \
        handler-roadmap-update-plan-progress.test.mjs \
        handler-todo-complete.test.mjs \
        wrap-mutation.test.mjs ; do
      git mv "tests/shadow-tests/$f" "archive/v0.2-shadow/tests/shadow-tests/$f"
    done

    # snapshots/ subdirectory: archive whole directory
    git mv tests/shadow-tests/snapshots archive/v0.2-shadow/tests/shadow-tests/snapshots
    ```

    DO NOT touch the 11 carry-forward files (bd-helper.test.mjs,
    beads-errors.test.mjs, findBeadsRoot.test.mjs, helpers-*, milestone-scoping,
    seed-determinism.test.sh) — Plan 04 owns them.

    DO NOT remove `tests/shadow-tests/` directory — it still has the 11
    carry-forward files in it; Plan 04 deletes the empty dir after migrating.
  </action>
  <verify>
    <automated>ARCHIVED_COUNT=$(ls archive/v0.2-shadow/tests/shadow-tests/handler-*.{mjs,sh} archive/v0.2-shadow/tests/shadow-tests/_parity-helpers* archive/v0.2-shadow/tests/shadow-tests/argv-routing.test.mjs archive/v0.2-shadow/tests/shadow-tests/bd-allowlist-grep.test.sh archive/v0.2-shadow/tests/shadow-tests/wrap-mutation.test.mjs 2>/dev/null | wc -l); test "$ARCHIVED_COUNT" -ge 26 &amp;&amp; test -d archive/v0.2-shadow/tests/shadow-tests/snapshots &amp;&amp; test -f tests/shadow-tests/bd-helper.test.mjs &amp;&amp; test -f tests/shadow-tests/findBeadsRoot.test.mjs &amp;&amp; ! test -f tests/shadow-tests/handler-roadmap-analyze.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - At least 26 archived files exist under `archive/v0.2-shadow/tests/shadow-tests/`
    - `archive/v0.2-shadow/tests/shadow-tests/snapshots/` exists as a directory
    - All 11 carry-forward files (bd-helper, beads-errors, findBeadsRoot, 4 helpers-*, milestone-scoping, seed-determinism + memories-seeded which is in tests/fixtures/) STILL EXIST in their original locations
    - `git log --follow archive/v0.2-shadow/tests/shadow-tests/handler-roadmap-analyze.test.mjs` returns at least one commit (history preserved)
    - `tests/shadow-tests/handler-roadmap-analyze.test.mjs` does NOT exist (moved out)
    - `tests/shadow-tests/_parity-helpers.mjs` does NOT exist (moved out)
  </acceptance_criteria>
  <done>26 shadow tests archived; tests/shadow-tests/ contains only the 11 carry-forwards Plan 04 will migrate</done>
</task>

<task type="auto">
  <name>Task 2: Archive 5 wholesale test directories (D-13)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-13 (e2e/hook-tests/install-tests/cross-worktree/worktree-tests archive wholesale)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §7 lines 836-843 (git mv per directory)
  </read_first>
  <files>
    - tests/cross-worktree/
    - tests/e2e/
    - tests/hook-tests/
    - tests/install-tests/
    - tests/worktree-tests/
    - archive/v0.2-shadow/tests/cross-worktree/
    - archive/v0.2-shadow/tests/e2e/
    - archive/v0.2-shadow/tests/hook-tests/
    - archive/v0.2-shadow/tests/install-tests/
    - archive/v0.2-shadow/tests/worktree-tests/
  </files>
  <action>
    `git mv` accepts directory arguments and moves the entire tree:

    ```bash
    git mv tests/cross-worktree archive/v0.2-shadow/tests/cross-worktree
    git mv tests/e2e            archive/v0.2-shadow/tests/e2e
    git mv tests/hook-tests     archive/v0.2-shadow/tests/hook-tests
    git mv tests/install-tests  archive/v0.2-shadow/tests/install-tests
    git mv tests/worktree-tests archive/v0.2-shadow/tests/worktree-tests
    ```

    These are wholesale archives per D-13 — none of these dirs have
    carry-forward content; the carry-forward worktree-symlink case is
    already covered by `tests/shadow-tests/findBeadsRoot.test.mjs` (Plan
    04 migrates).

    Skip the move for any directory that doesn't exist (already empty).
    The `git mv` command will fail loudly if a destination already exists
    — this should not happen because Plan 01 only created `archive/v0.2-shadow/tests/`
    as a parent (with .gitkeep) and `archive/v0.2-shadow/tests/shadow-tests/`
    inside it; the 5 wholesale dirs being moved here are NOT pre-created.
  </action>
  <verify>
    <automated>for d in cross-worktree e2e hook-tests install-tests worktree-tests; do test -d "archive/v0.2-shadow/tests/$d" || { echo "MISSING archive/$d"; exit 1; }; test ! -d "tests/$d" || { echo "STILL EXISTS tests/$d"; exit 1; }; done; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - All 5 archived test directories exist at `archive/v0.2-shadow/tests/<name>/`
    - All 5 originals at `tests/<name>/` do NOT exist
    - At least one file in each archived dir has preserved git history (e.g., `git log --follow archive/v0.2-shadow/tests/e2e/<any-file>` returns commits)
    - `tests/` directory still contains: `fixtures/`, `shadow-tests/` (carry-forwards), `unit/` (Plan 01 created), `conformance/` (Plan 01 created)
  </acceptance_criteria>
  <done>5 wholesale test directories archived per D-13</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem → git history | Same as Plan 02 — `git mv` preserves history; cp+rm loses it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.03-01 | Tampering | Accidental archival of carry-forward test (e.g., `git mv tests/shadow-tests/findBeadsRoot.test.mjs` instead of leaving it) | mitigate | Task 1 enumerates the EXACT 26 filenames to archive and explicitly lists the 11 carry-forward files to leave untouched. Plan 04's verifications will fail loudly if any carry-forward file is missing from `tests/shadow-tests/` when Plan 04 runs. |
| T-6.03-02 | Information Disclosure | Archived test files contain fixture paths / seed actor names | accept | The fixtures referenced (e.g., `BEADS_ACTOR=seed`) are deterministic project artifacts, not secrets. |
| T-6.03-03 | Denial of Service | `git mv` on a non-existent source dir fails the whole task | mitigate | Each `git mv` in Task 2 is for a directory we just verified exists in the working tree (per `ls` in load_codebase_context). If absent, the task fails fast and the executor must investigate. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- `find archive/v0.2-shadow/tests -type f | wc -l` returns >= 26 + (size of e2e/hook-tests/install-tests/cross-worktree/worktree-tests)
- Carry-forward files (11) STILL exist in `tests/shadow-tests/` post-Plan-03
- `tests/{cross-worktree,e2e,hook-tests,install-tests,worktree-tests}/` do NOT exist post-Plan-03
- Wave 0 tests still parse without changes (no test file under `tests/unit/` was touched by this plan)
</verification>

<success_criteria>
- 26 individual shadow test files archived
- 5 wholesale test directories archived
- 1 snapshots subdirectory archived
- All moves done via `git mv` (history preserved)
- Carry-forward 11 files (bd-helper, beads-errors, findBeadsRoot, 4 helpers, milestone-scoping, seed-determinism + memories-seeded in tests/fixtures/) UNTOUCHED — Plan 04 migrates them
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-03-SUMMARY.md` listing every git-mv operation and recording counts (e.g., "26 individual files archived; 5 directories archived; tests/shadow-tests/ now contains 11 carry-forward files awaiting Plan 04 migration").
</output>
