---
phase: 6
plan: 02
type: execute
wave: 1
depends_on: [01]
files_modified:
  - bin/gsd-sdk-shadow.mjs
  - bin/wrap-mutation.mjs
  - hooks/block-gsd-sdk-mutation.sh
  - hooks/block-state-md.sh
  - hooks/bd-sync.sh
  - hooks/worktree-post-checkout.sh
  - scripts/regen-roadmap.sh
  - scripts/regen-requirements.sh
  - scripts/regen-state.sh
  - scripts/cascade-loop.sh
  - install.sh
  - tests/run-all.sh
  - tests/run-quick.sh
  - tests/scripts/update-snapshots.mjs
  - archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs
  - archive/v0.2-shadow/bin/wrap-mutation.mjs
  - archive/v0.2-shadow/hooks/block-gsd-sdk-mutation.sh
  - archive/v0.2-shadow/hooks/block-state-md.sh
  - archive/v0.2-shadow/hooks/bd-sync.sh
  - archive/v0.2-shadow/hooks/worktree-post-checkout.sh
  - archive/v0.2-shadow/scripts/regen-roadmap.sh
  - archive/v0.2-shadow/scripts/regen-requirements.sh
  - archive/v0.2-shadow/scripts/regen-state.sh
  - archive/v0.2-shadow/scripts/cascade-loop.sh
  - archive/v0.2-shadow/tests/scripts/update-snapshots.mjs
autonomous: true
requirements:
  - CLEAN-01
  - CLEAN-02
  - CLEAN-04
must_haves:
  truths:
    - "bin/{gsd-sdk-shadow,wrap-mutation}.mjs do not exist; archive/v0.2-shadow/bin/ contains both"
    - "hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,worktree-post-checkout}.sh do not exist; archive/v0.2-shadow/hooks/ contains all 4"
    - "scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh do not exist; archive/v0.2-shadow/scripts/ contains all 4"
    - "install.sh does not exist (deleted, not archived)"
    - "git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs returns the original file's commit history"
    - "tests/run-all.sh and tests/run-quick.sh removed (use npm test instead)"
  artifacts:
    - path: "archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs"
      provides: "v0.2 shadow binary preserved with git history"
    - path: "archive/v0.2-shadow/hooks/bd-sync.sh"
      provides: "post-cleanup historical reference"
    - path: "archive/v0.2-shadow/scripts/cascade-loop.sh"
      provides: "carry-forward cascade logic preserved (Phase 8 JS rewrite)"
  key_links:
    - from: "archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs"
      to: "git history"
      via: "git mv (not cp+rm)"
      pattern: "git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs"
---

<objective>
Archive all v0.2 shadow source files (bin/, hooks/, scripts/) to
`archive/v0.2-shadow/` using `git mv` to preserve history. Delete
install.sh per CLEAN-04. Remove obsolete test driver scripts.

Purpose: This is the foundational cleanup that unblocks Wave 2's
extraction work — Plan 04 needs `bin/gsd-sdk-shadow.mjs` to live at
its archive path so `findBeadsRoot()` extraction can cite the source
location with preserved history (per RESEARCH.md §10 Risk #5).

Output: All shadow code lives at archive/v0.2-shadow/* with full git
history; top-level bin/, hooks/, scripts/ directories empty (or
non-existent); install.sh gone.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-VALIDATION.md

<interfaces>
<!-- Files to archive: each is a `git mv` from origin to archive/v0.2-shadow/<subdir>/. -->

CLEAN-01: bin/ archive (4 files total — 2 archived + 2 verbatim moves owned by Plan 04)
- bin/gsd-sdk-shadow.mjs    → archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs
- bin/wrap-mutation.mjs     → archive/v0.2-shadow/bin/wrap-mutation.mjs
- bin/bd-helper.mjs         → handled by Plan 04 (verbatim → src/bd/helper.mjs)
- bin/beads-errors.mjs      → handled by Plan 04 (verbatim → src/bd/errors.mjs)

CLEAN-02: hooks/ archive (4 files)
- hooks/block-gsd-sdk-mutation.sh
- hooks/block-state-md.sh
- hooks/bd-sync.sh
- hooks/worktree-post-checkout.sh    (D-12 expanded scope)

CLEAN-03 file moves (4 files; REQUIREMENTS.md edit owned by Plan 07)
- scripts/regen-roadmap.sh
- scripts/regen-requirements.sh
- scripts/regen-state.sh
- scripts/cascade-loop.sh             (D-12 OVERRIDES original "stays")

CLEAN-04
- install.sh                          → DELETE (CONTEXT.md confirms delete, not archive)

Shadow-test driver cleanup (per RESEARCH.md §10 Risk #8):
- tests/run-all.sh                    → DELETE (npm test is the new contract)
- tests/run-quick.sh                  → DELETE
- tests/scripts/update-snapshots.mjs  → archive/v0.2-shadow/tests/scripts/

Files NOT in this plan's scope:
- bin/bd-helper.mjs / bin/beads-errors.mjs — Plan 04 (verbatim move to src/bd/)
- tests/shadow-tests/* — Plan 03 archives the non-migrated tests
- tests/{e2e,hook-tests,install-tests,cross-worktree,worktree-tests}/ — Plan 03
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Archive bin/ shadow files (CLEAN-01)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 lines 79-82 for the file disposition rows for bin/
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #5 (lines 1204-1219) for the "git mv" requirement
  </read_first>
  <files>
    - bin/gsd-sdk-shadow.mjs
    - bin/wrap-mutation.mjs
    - archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs
    - archive/v0.2-shadow/bin/wrap-mutation.mjs
  </files>
  <action>
    Use `git mv` (NOT `cp + git rm` — history MUST be preserved per
    ROADMAP SC #1 and RESEARCH.md §10 Risk #5):

    ```bash
    git mv bin/gsd-sdk-shadow.mjs archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs
    git mv bin/wrap-mutation.mjs archive/v0.2-shadow/bin/wrap-mutation.mjs
    ```

    DO NOT touch `bin/bd-helper.mjs` or `bin/beads-errors.mjs` — those
    are handled by Plan 04 (verbatim move to `src/bd/`). Plan 04 will
    remove them from `bin/` AFTER this plan completes.

    DO NOT remove `bin/` as a directory — Plan 04 will check it after
    its own moves and remove if empty.

    Keep the .gitkeep file from Plan 01 in archive/v0.2-shadow/bin/ for
    now; it's harmless once real files land alongside it. (Optional:
    `git rm archive/v0.2-shadow/bin/.gitkeep` since the dir is no longer
    empty.)

    Stage the moves but DO NOT commit yet — Plan execution will commit
    after the full plan succeeds. The two `git mv` commands are atomic
    in the index.
  </action>
  <verify>
    <automated>test -f archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs &amp;&amp; test -f archive/v0.2-shadow/bin/wrap-mutation.mjs &amp;&amp; ! test -f bin/gsd-sdk-shadow.mjs &amp;&amp; ! test -f bin/wrap-mutation.mjs &amp;&amp; git log --follow --oneline archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs | head -1</automated>
  </verify>
  <acceptance_criteria>
    - `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` exists
    - `archive/v0.2-shadow/bin/wrap-mutation.mjs` exists
    - `bin/gsd-sdk-shadow.mjs` does NOT exist
    - `bin/wrap-mutation.mjs` does NOT exist
    - `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` returns at least one commit (proves history preserved via git mv)
    - `git status` shows the moves as renames (R), not adds + deletes
  </acceptance_criteria>
  <done>Shadow binaries archived with history; CLEAN-01 file-move portion satisfied</done>
</task>

<task type="auto">
  <name>Task 2: Archive hooks/ shadow scripts (CLEAN-02 + D-12)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 lines 83-86 for hooks file disposition
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-12 (worktree-post-checkout.sh expansion)
  </read_first>
  <files>
    - hooks/block-gsd-sdk-mutation.sh
    - hooks/block-state-md.sh
    - hooks/bd-sync.sh
    - hooks/worktree-post-checkout.sh
    - archive/v0.2-shadow/hooks/block-gsd-sdk-mutation.sh
    - archive/v0.2-shadow/hooks/block-state-md.sh
    - archive/v0.2-shadow/hooks/bd-sync.sh
    - archive/v0.2-shadow/hooks/worktree-post-checkout.sh
  </files>
  <action>
    Use `git mv` for all 4 hook files:

    ```bash
    git mv hooks/block-gsd-sdk-mutation.sh archive/v0.2-shadow/hooks/block-gsd-sdk-mutation.sh
    git mv hooks/block-state-md.sh archive/v0.2-shadow/hooks/block-state-md.sh
    git mv hooks/bd-sync.sh archive/v0.2-shadow/hooks/bd-sync.sh
    git mv hooks/worktree-post-checkout.sh archive/v0.2-shadow/hooks/worktree-post-checkout.sh
    ```

    `worktree-post-checkout.sh` is included per D-12 even though it was
    not in the original CLEAN-02 scope. The directory `hooks/` will be
    empty after this; remove it:

    ```bash
    rmdir hooks/ 2>/dev/null || true
    ```

    (`rmdir` only succeeds if the directory is empty; that's the desired
    behavior — if any unexpected file remains, the rmdir silently fails
    and the directory stays.)
  </action>
  <verify>
    <automated>for h in block-gsd-sdk-mutation block-state-md bd-sync worktree-post-checkout; do test -f "archive/v0.2-shadow/hooks/$h.sh" || { echo "MISSING archive/$h"; exit 1; }; test ! -f "hooks/$h.sh" || { echo "STILL EXISTS hooks/$h"; exit 1; }; done; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - All 4 archived hook files exist at `archive/v0.2-shadow/hooks/<name>.sh`
    - All 4 originals at `hooks/<name>.sh` do NOT exist
    - `git log --follow archive/v0.2-shadow/hooks/bd-sync.sh` returns at least one commit (history preserved)
    - `hooks/` directory is empty or removed
  </acceptance_criteria>
  <done>All v0.2 hooks archived with history; CLEAN-02 + D-12 hooks portion satisfied</done>
</task>

<task type="auto">
  <name>Task 3: Archive scripts/ regen + cascade-loop (CLEAN-03 file moves; D-12)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 lines 87-90 for scripts disposition
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-12 (cascade-loop.sh archives, OVERRIDES REQUIREMENTS.md)
    - NOTE: REQUIREMENTS.md text edit is owned by Plan 07. This plan only does the file moves.
  </read_first>
  <files>
    - scripts/regen-roadmap.sh
    - scripts/regen-requirements.sh
    - scripts/regen-state.sh
    - scripts/cascade-loop.sh
    - archive/v0.2-shadow/scripts/regen-roadmap.sh
    - archive/v0.2-shadow/scripts/regen-requirements.sh
    - archive/v0.2-shadow/scripts/regen-state.sh
    - archive/v0.2-shadow/scripts/cascade-loop.sh
  </files>
  <action>
    Use `git mv` for all 4 scripts (cascade-loop.sh is included per D-12,
    overriding the original REQUIREMENTS.md CLEAN-03 wording — the
    REQUIREMENTS.md text fix is Plan 07's responsibility):

    ```bash
    git mv scripts/regen-roadmap.sh archive/v0.2-shadow/scripts/regen-roadmap.sh
    git mv scripts/regen-requirements.sh archive/v0.2-shadow/scripts/regen-requirements.sh
    git mv scripts/regen-state.sh archive/v0.2-shadow/scripts/regen-state.sh
    git mv scripts/cascade-loop.sh archive/v0.2-shadow/scripts/cascade-loop.sh
    ```

    Remove the now-empty `scripts/` directory:

    ```bash
    rmdir scripts/ 2>/dev/null || true
    ```

    DO NOT edit `.planning/REQUIREMENTS.md` here — Plan 07 owns the
    wording fix per the plan split.
  </action>
  <verify>
    <automated>for s in regen-roadmap regen-requirements regen-state cascade-loop; do test -f "archive/v0.2-shadow/scripts/$s.sh" || { echo "MISSING $s"; exit 1; }; test ! -f "scripts/$s.sh" || { echo "STILL EXISTS scripts/$s"; exit 1; }; done; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - All 4 scripts at `archive/v0.2-shadow/scripts/<name>.sh` exist
    - All 4 originals at `scripts/<name>.sh` do NOT exist
    - `git log --follow archive/v0.2-shadow/scripts/cascade-loop.sh` returns at least one commit (proves history preserved despite D-12 override)
    - `scripts/` directory is empty or removed
  </acceptance_criteria>
  <done>All regen + cascade scripts archived; CLEAN-03 file-move portion satisfied (REQUIREMENTS.md text fix is Plan 07)</done>
</task>

<task type="auto">
  <name>Task 4: Delete install.sh (CLEAN-04)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 line 91 ("install.sh DELETE — CONTEXT.md confirms delete, not archive")
    - .planning/REQUIREMENTS.md CLEAN-04 ("install.sh removed")
  </read_first>
  <files>
    - install.sh
  </files>
  <action>
    Per CLEAN-04 and CONTEXT.md, `install.sh` is DELETED, not archived.
    Use `git rm`:

    ```bash
    git rm install.sh
    ```

    Do NOT move it to `archive/v0.2-shadow/` — it's not "preserved as
    historical reference," it's removed because the repo is no longer a
    system layer.

    The file `install/memories/*.md` directory is NOT affected — those
    are seed memory references kept per RESEARCH.md §1 lines 92-94.
  </action>
  <verify>
    <automated>test ! -f install.sh &amp;&amp; ! test -f archive/v0.2-shadow/install.sh &amp;&amp; test -d install/memories</automated>
  </verify>
  <acceptance_criteria>
    - `install.sh` does NOT exist at repo root
    - `install.sh` is NOT inside `archive/v0.2-shadow/` (delete, not archive)
    - `install/memories/` directory still exists and contains its 8 seed files (untouched)
    - `git status` shows install.sh as deleted (D)
  </acceptance_criteria>
  <done>install.sh deleted per CLEAN-04</done>
</task>

<task type="auto">
  <name>Task 5: Remove obsolete test drivers (run-all.sh, run-quick.sh, update-snapshots.mjs)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 lines 101-103 (run-all.sh, run-quick.sh)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #8 lines 1247-1256 (delete recommendation)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 line 103 (update-snapshots.mjs ARCHIVE)
  </read_first>
  <files>
    - tests/run-all.sh
    - tests/run-quick.sh
    - tests/scripts/update-snapshots.mjs
    - archive/v0.2-shadow/tests/scripts/update-snapshots.mjs
  </files>
  <action>
    `tests/run-all.sh` and `tests/run-quick.sh` reference archived directories
    (e2e, hook-tests, install-tests, cross-worktree, worktree-tests) and
    will print errors after the archival. `npm test` is the new contract
    per package.json scripts (Plan 07). Per RESEARCH.md §10 Risk #8
    recommendation, DELETE both:

    ```bash
    git rm tests/run-all.sh tests/run-quick.sh
    ```

    `tests/scripts/update-snapshots.mjs` was used by archived shadow
    snapshots — it's no longer needed but archive (don't delete) per
    RESEARCH.md §1 line 103:

    ```bash
    git mv tests/scripts/update-snapshots.mjs archive/v0.2-shadow/tests/scripts/update-snapshots.mjs
    ```

    The `tests/scripts/` directory may be empty after this — if it has no
    other contents, remove it:

    ```bash
    rmdir tests/scripts/ 2>/dev/null || true
    ```
  </action>
  <verify>
    <automated>test ! -f tests/run-all.sh &amp;&amp; test ! -f tests/run-quick.sh &amp;&amp; test -f archive/v0.2-shadow/tests/scripts/update-snapshots.mjs &amp;&amp; test ! -f tests/scripts/update-snapshots.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `tests/run-all.sh` does NOT exist (deleted)
    - `tests/run-quick.sh` does NOT exist (deleted)
    - `archive/v0.2-shadow/tests/scripts/update-snapshots.mjs` exists with preserved git history
    - `tests/scripts/update-snapshots.mjs` does NOT exist
  </acceptance_criteria>
  <done>Obsolete test drivers removed; npm test is the new contract</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem → git history | git mv operations preserve history; cp+rm would lose it. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.02-01 | Tampering | git mv vs cp+rm history loss (RESEARCH.md §10 Risk #5) | mitigate | Every archival task EXPLICITLY uses `git mv` (not `cp` then `git rm`). Verification asserts `git log --follow archive/...` returns the original file's commit history. |
| T-6.02-02 | Repudiation | Archived shadow code re-execution (someone runs `bash archive/v0.2-shadow/hooks/bd-sync.sh` not realizing it's archived) | mitigate | archive/v0.2-shadow/README.md (Plan 01) documents inert status. Future enhancement: add `# ARCHIVED — do not run` header to scripts (deferred to v1.1). |
| T-6.02-03 | Denial of Service | tests/run-all.sh references archived dirs; muscle-memory invocations break | mitigate | Delete the orphan drivers in Task 5; CONTRIBUTING.md (Plan 07) documents `npm test` as the canonical entry point. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- All paths in `<files_modified>` resolve correctly post-execution (originals gone, archives present)
- `git status -s` shows renames (R) for the moves and deletions (D) for install.sh / run-all.sh / run-quick.sh
- `node --test tests/unit/structural-cleanup.test.mjs` advances from red toward green: CLEAN-01, CLEAN-02, CLEAN-03 file-move tests pass; CLEAN-04 passes; the REQUIREMENTS.md wording test still fails (Plan 07 fixes it)
- `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs | head -5` returns ≥1 commit
</verification>

<success_criteria>
- 12 files moved to `archive/v0.2-shadow/{bin,hooks,scripts,tests/scripts}/`
- 3 files deleted (install.sh, tests/run-all.sh, tests/run-quick.sh)
- All moves done via `git mv` (history preserved)
- Top-level `bin/` retains only bd-helper.mjs + beads-errors.mjs (Plan 04 owns those)
- Top-level `hooks/`, `scripts/` directories empty or removed
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-02-SUMMARY.md` listing every git-mv operation performed and the resulting hashes from `git log --follow` proofs.
</output>
