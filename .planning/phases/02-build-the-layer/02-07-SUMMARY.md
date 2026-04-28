---
phase: 02-build-the-layer
plan: "07"
subsystem: gap-closure
tags: [gap-closure, portability, hook-paths, install-sh, regen-requirements, tdd]

# Dependency graph
requires:
  - phase: 02-build-the-layer
    plan: "01"
    provides: [scripts/regen-requirements.sh, tests/hook-tests/regen-requirements.test.sh, tests/fixtures/bd-helpers/3-level-hierarchy.sh]
  - phase: 02-build-the-layer
    plan: "02"
    provides: [settings.fragment.json]
  - phase: 02-build-the-layer
    plan: "05"
    provides: [install.sh, tests/install-tests/settings-merge.test.sh]
provides:
  - install.sh path substitution stanza (substitutes $CLAUDE_PROJECT_DIR/.claude/hooks → $HOOKS_DEST in-flight before jq deep-merge)
  - tests/install-tests/settings-merge.test.sh CASE 6 (a/b/c/d) — sandboxed end-to-end install.sh regression guard
  - scripts/regen-requirements.sh portable tr|awk Title-Case pipeline (POSIX-only, BSD/macOS-equivalent by construction)
  - tests/hook-tests/regen-requirements.test.sh CASE 6 — multi-word category capitalization + standalone-pipeline portability proof
affects:
  - REQ-04 (hook gate now actually fires in user projects after install.sh)
  - REQ-06 (macOS BSD sed compatibility for category headers in REQUIREMENTS.md)
  - 02-VERIFICATION.md re-run readiness (11/13 → 13/13 truths verified)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-flight `sed` substitution for placeholder paths before jq deep-merge — repo file untouched on disk; substituted bytes only flow through jq"
    - "Portable `tr | awk` Title-Case capitalization (no GNU sed extensions, BSD-equivalent by construction since both are POSIX-mandated)"
    - "End-to-end install.sh sandbox testing: redirect $HOME to a mktemp dir, pre-seed `{}` settings.json, capture install.sh exit code separately so vacuous passes against the baseline are detectable"
    - "Vacuous-pass guard: assert `hook_count >= 1` from the post-install settings.json before running sub-assertions, so if install.sh aborts before Step 3 the test fails loudly instead of green-on-empty"

key-files:
  created:
    - .planning/phases/02-build-the-layer/02-07-SUMMARY.md
    - .planning/phases/02-build-the-layer/deferred-items.md
  modified:
    - install.sh
    - scripts/regen-requirements.sh
    - tests/install-tests/settings-merge.test.sh
    - tests/hook-tests/regen-requirements.test.sh

key-decisions:
  - "Used `|` as sed delimiter (not `/`) to avoid escaping path slashes in the substitution"
  - "Substituted in-flight via mktemp tempfile — never modify settings.fragment.json on disk (matches verification report's directive verbatim)"
  - "CASE 6 invokes `bash install.sh` end-to-end (sandboxed $HOME) rather than re-implementing the substitution stanza — this means a future regression that removes the sed line in install.sh is caught (re-implementation would defeat the purpose)"
  - "Removed sed entirely from regen-requirements.sh:105 (per CR-04) instead of trying to make sed portable — the awk pipeline that follows already does word-by-word Title-Case, so prepending `tr '-' ' '` was sufficient"
  - "Comment text was rewritten to avoid the literal `\\U` token to satisfy the strict acceptance criterion `! grep -q '\\\\U' scripts/regen-requirements.sh`"
  - "bd priority in CASE 6 fixture changed from -p 5 to -p 4 (Rule 1 auto-fix) — bd CLI's valid range is 0-4; the plan's snippet had -p 5 which bd rejects"

# Metrics
metrics:
  duration: "~25 minutes"
  completed: 2026-04-28T17:15:51Z
  tasks_completed: 2
  files_modified_count: 4
  files_created_count: 2
  test_cases_added: 8 (4 sub-assertions per CASE 6 in two test files)
  commits: 4
---

# Phase 02 Plan 07: Gap Closure Summary

Closed both 02-VERIFICATION.md gaps with surgical edits — install.sh now substitutes `$CLAUDE_PROJECT_DIR/.claude/hooks` → `$HOOKS_DEST` in-flight before the jq deep-merge so REQ-04 hooks actually fire post-install, and `scripts/regen-requirements.sh:105` swaps GNU-only `sed '\U'` for a POSIX-portable `tr | awk` pipeline so REQ-06 category headers render correctly on macOS BSD sed.

## What Changed

### Gap 1 — install.sh hook-path resolution (BLOCKER, REQ-04)

`settings.fragment.json` carries `$CLAUDE_PROJECT_DIR/.claude/hooks/...` placeholders. Claude Code expands `$CLAUDE_PROJECT_DIR` to the user's project directory, NOT to `~/.claude/`. Hooks live at `~/.claude/hooks/` (per install.sh:8 `HOOKS_DEST="$HOME/.claude/hooks"`). Before this plan, the merged settings.json contained literal `$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh` — Claude Code resolved that to `~/<user-project>/.claude/hooks/block-state-md.sh` (a directory that does not exist). Hooks did not fire. The entire REQ-04 hook gate was silently broken.

**Fix:** In install.sh Step 3, materialize the substituted fragment to a tempfile via:

```bash
fragment_resolved="$(mktemp)"
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST|g" "$FRAGMENT" > "$fragment_resolved"
# ... jq -s ... "$SETTINGS" "$fragment_resolved" > "$tmp" ...
rm -f "$fragment_resolved"
```

The `|` delimiter avoids escaping path slashes, `\$CLAUDE_PROJECT_DIR` is shell-escaped so sed sees the literal token, and `$HOOKS_DEST` is shell-expanded into the absolute path. The on-disk `settings.fragment.json` is byte-untouched.

### Gap 2 — regen-requirements.sh portability (WARNING, REQ-06)

`scripts/regen-requirements.sh:105` used `sed 's/^./\U&/; s/-/ /g'` to uppercase the first letter and convert dashes to spaces. The `\U` escape is a GNU sed extension; BSD sed (macOS) interprets it literally, so `auth` rendered as `\Uauth` and the Spike 007 REQUIREMENTS.md format contract broke on a primary supported platform.

**Fix:** Drop the sed call entirely. The awk pipeline already does word-by-word Title-Case; prepend `tr '-' ' '` to handle the dash→space step. Both `tr` and `awk` are POSIX-mandated and behave identically on BSD and GNU.

```bash
cat_header=$(printf '%s' "$cat" \
  | tr '-' ' ' \
  | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
```

## Test Coverage Added

### CASE 6 in tests/install-tests/settings-merge.test.sh

Sandboxed end-to-end regression guard: redirects `$HOME` to a mktemp dir, runs `bash install.sh` end-to-end inside that sandbox, then asserts:

- **6a:** zero literal `$CLAUDE_PROJECT_DIR` survivors in any hook command
- **6b:** every hook command resolves under the sandboxed `$HOME/.claude/hooks/` absolute path
- **6c:** `git diff --exit-code -- settings.fragment.json` is clean (on-disk fragment unchanged — real regression guard against future code that writes back)
- **6d:** post-Step-3 settings.json contains zero `$CLAUDE_PROJECT_DIR` placeholders (Warning #2 invariant restated for traceability)

Includes a vacuous-pass guard: requires `hook_count >= 1` in the post-install settings.json before running sub-assertions, so if install.sh aborts before Step 3 the suite fails loudly instead of green-on-baseline-`{}`.

### CASE 6 in tests/hook-tests/regen-requirements.test.sh

Adds a multi-word `category:auth-flow` requirement to the fixture, runs regen-requirements.sh, then asserts:

- 6.1: zero literal `\U` tokens anywhere in REQUIREMENTS.md
- 6.2: `### Auth Flow` header (multi-word capitalization)
- 6.3: `### Auth` header (single-word capitalization, exact)
- 6.4: standalone `tr | awk` pipeline produces `Auth Flow` from `auth-flow` (BSD-equivalent by construction proof — runs the post-fix pipeline directly with no platform-dependent intermediate)

## Test Results

```
tests/install-tests/settings-merge.test.sh   Passed: 9 / 9   (5 original + CASE 6 a/b/c/d)
tests/hook-tests/regen-requirements.test.sh  Passed: 6 / 6   (5 original + CASE 6)
```

Regression sweep (no new breakage caused by 02-07):

```
tests/install-tests/settings-merge.test.sh        PASS   (9/9)
tests/install-tests/path-precedence.test.sh        PASS
tests/install-tests/no-gsd-core-mutation.test.sh   PASS
tests/hook-tests/block-state-md.test.sh            PASS
tests/hook-tests/bd-sync.test.sh                   PASS
tests/hook-tests/block-gsd-sdk-mutation.test.sh    PASS
tests/hook-tests/cascade-loop.test.sh              PASS
tests/hook-tests/regen-roadmap.test.sh             PASS
tests/hook-tests/regen-requirements.test.sh        PASS   (6/6)
```

## Diff Size

| File | Insertions | Deletions |
|------|-----------:|----------:|
| install.sh | 9 | 1 |
| scripts/regen-requirements.sh | 6 | 2 |
| tests/install-tests/settings-merge.test.sh | 87 | 0 |
| tests/hook-tests/regen-requirements.test.sh | 70 | 0 |

Production code: ~13 lines net change. Test code: ~157 lines added (the bulk is sandbox setup + 4 sub-assertions × 2 cases + standalone-pipeline portability proof).

## Commits

| Step | Hash | Message |
|------|------|---------|
| Task 1 RED | `4d8f1e0` | `test(02-07): add CASE 6 sandbox test for install.sh path substitution` |
| Task 1 GREEN | `c75ab78` | `fix(02-07): substitute $CLAUDE_PROJECT_DIR placeholders before deep-merge` |
| Task 2 RED | `efbe57c` | `test(02-07): add CASE 6 portable category capitalization test` |
| Task 2 GREEN | `ffe6aba` | `fix(02-07): replace GNU-only sed \U with portable tr|awk pipeline` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] CASE 6 fixture: bd priority `-p 5` rejected by bd CLI**

- **Found during:** Task 2, first run of CASE 6 (RED phase verification).
- **Issue:** Plan-text snippet for CASE 6 used `bd q ... -t epic -p 5`. bd CLI rejects priority values > 4 with "invalid priority \"5\" (expected 0-4 or P0-P4...)" — same constraint already known from 02-06's scale-50-bead.sh (capped at 4).
- **Fix:** Changed to `-p 4` (highest valid bd priority).
- **Files modified:** `tests/hook-tests/regen-requirements.test.sh`.
- **Commit:** Folded into `efbe57c` (the CASE 6 test commit; -p 4 was the as-committed value, never landed broken in main).

**2. [Rule 2 — Critical correctness] Strict no-`\U`-anywhere requirement extended to comments**

- **Found during:** Task 2, post-fix grep check.
- **Issue:** My initial GREEN comment in scripts/regen-requirements.sh said `# macOS BSD sed does not support GNU '\U' — drop sed entirely...`. The plan's acceptance criterion specifies `! grep -q '\\U' scripts/regen-requirements.sh` succeeds (no literal `\U` escape anywhere — including comments).
- **Fix:** Rewrote the comment to `# macOS BSD sed does not support the GNU uppercase escape — drop sed entirely...` (avoids the `\U` literal).
- **Files modified:** `scripts/regen-requirements.sh`.
- **Commit:** Folded into `ffe6aba` (the GREEN commit; final state contains no `\U` anywhere).

### No Other Code Deviations

The two install-tests failures discovered during the regression sweep (idempotency CASE 4, memory-seeding CASE 8 — both `expected 7 got 8`) are pre-existing failures on the dev machine's bd memory store (verified by stashing 02-07 changes and re-running on baseline `e5aeadf` — same FAIL). They are out of scope for this gap-closure plan and logged in `.planning/phases/02-build-the-layer/deferred-items.md` per the SCOPE BOUNDARY rule.

### State-Update Path Blocked by Project's Own Hooks (Meta-Validation)

The plan's `<state_updates>` step calls for `gsd-sdk query state.advance-plan`, `state.update-progress`, `roadmap.update-plan-progress`, and `requirements.mark-complete`. Three of these are blocked in this very project — and that is the entire point of REQ-04. The chain:

1. `state.advance-plan` / `state.update-progress` returned `{"error": "Cannot parse Current Plan or Total Plans in Phase from STATE.md"}` and `{"updated": false, "reason": "Progress field not found in STATE.md"}` because gsd-beads's STATE.md schema is intentionally minimal frontmatter-only (driven from bd state, not from the standard gsd-sdk markdown sections). This is the gsd-beads design — STATE.md is regenerated from beads, not directly mutated.

2. `roadmap.update-plan-progress` was blocked by `block-gsd-sdk-mutation.sh` (the very hook this plan helps productionize): _"State-bearing gsd-sdk mutations route through the gsd-sdk shadow at ~/.local/bin/gsd-sdk in beads-managed projects... use `bd` directly to mutate state."_ Same applies to `requirements.mark-complete`.

3. Direct `Edit` of `.planning/ROADMAP.md` or `.planning/REQUIREMENTS.md` is blocked by `block-state-md.sh` for the same reason.

4. Routing through `bd` is also a no-op here because this project's local `.beads/` has zero plan/requirement beads (`bd list` returns empty). gsd-beads itself hasn't yet migrated its own meta-tracking into bd — `ROADMAP.md` and the Plan list are still hand-edited in narrative form. This is appropriate: a layer that productionizes beads-driven workflows for downstream projects is itself in the bootstrap phase.

5. `STATE.md` was nonetheless auto-updated mid-execution: it now shows `completed_plans: 7, completed_phases: 1` because `bd-sync.sh` (PostToolUse) regenerated it from bd state during my test runs. So STATE.md is already in the post-02-07 state, just via a different code path than the plan's `<state_updates>` step described.

**Net effect:** The plan's standard state-update mechanics don't apply here because gsd-beads's own architecture replaces them. STATE.md is current. ROADMAP.md plan-list checkbox toggle is left for a follow-up that either (a) hand-edits via narrative-bypass or (b) migrates the gsd-beads project's own meta-tracking into beads (a Phase 3 or v0.2 concern). This is a documentation deviation, not a code/correctness gap. All Phase 02 verifiable artifacts are complete and tested.

## TDD Gate Compliance

Both tasks followed RED → GREEN. RED commits and GREEN commits are present in git log:

- Task 1: RED `4d8f1e0` (test before fix), GREEN `c75ab78` (fix); CASE 6a/6b/6d failed at RED (3 surviving placeholders), all pass after GREEN.
- Task 2: RED `efbe57c` (test before fix), GREEN `ffe6aba` (fix). On Linux/GNU sed (executor's platform) RED was "limited green" — Tests 1, 3, 4 already passed because GNU sed honors `\U` and Test 4 has no dependency on regen-requirements.sh. Test 2 (multi-word) passed by accident on GNU sed via the dash-then-cap chain. The plan explicitly anticipated this: "On macOS/BSD sed, Tests 1, 2, 3 currently FAIL." CASE 6 is a permanent regression guard that flips macOS BSD from FAIL to PASS once the awk-only fix lands.

No REFACTOR commits — both fixes were small enough that the GREEN code is final.

## Self-Check: PASSED

- [x] `install.sh` path substitution present (`grep -n 'sed.*CLAUDE_PROJECT_DIR' install.sh` → line 48 with `s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST|g`)
- [x] `scripts/regen-requirements.sh:105+` uses portable `tr '-' ' ' | awk` (no `\U` anywhere in the file, comments included)
- [x] `tests/install-tests/settings-merge.test.sh` CASE 6 a/b/c/d added (87 insertions; tests pass 9/9)
- [x] `tests/hook-tests/regen-requirements.test.sh` CASE 6 added (70 insertions; tests pass 6/6)
- [x] `git diff -- settings.fragment.json` is empty (on-disk fragment byte-unchanged)
- [x] `bash -n install.sh` exits 0
- [x] `bash -n scripts/regen-requirements.sh` exits 0
- [x] All 4 commits present in `git log`: `4d8f1e0`, `c75ab78`, `efbe57c`, `ffe6aba`
- [x] No upstream GSD core files modified (REQ-02 hard constraint preserved)
- [x] No new files outside the four files_modified + this SUMMARY + deferred-items.md
- [x] `.planning/phases/02-build-the-layer/02-07-SUMMARY.md` exists at this path

## Suggested Next Step

Re-run `/gsd-verify-phase 02-build-the-layer` — the verification report should flip from 11/13 to 13/13 truths verified, since both blocking gaps are now closed and CASE 6 in both test files serves as a permanent regression guard.
