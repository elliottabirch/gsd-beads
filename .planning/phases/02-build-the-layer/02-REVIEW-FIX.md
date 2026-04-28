---
phase: 02-build-the-layer
fixed_at: 2026-04-28T00:00:00Z
review_path: .planning/phases/02-build-the-layer/02-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-28
**Source review:** .planning/phases/02-build-the-layer/02-REVIEW.md
**Iteration:** 1
**Fix scope:** critical_warning (CR-* + WR-*; IN-* findings out of scope)

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0

All three WARNING findings were applied cleanly with no rollbacks. Each
fix was committed atomically and verified with `bash -n` syntax checks
and the affected test suites
(`tests/install-tests/settings-merge.test.sh`,
`tests/hook-tests/regen-requirements.test.sh`). All 9 settings-merge
cases and all 6 regen-requirements cases continue to pass after the
three fixes are applied in sequence.

## Fixed Issues

### WR-01: install.sh leaks tempfiles on Step 3 failure

**Files modified:** `install.sh`
**Commit:** b9c9fbd
**Applied fix:** Added a localized `EXIT` trap covering the entire
Step 3 substitution+merge block (between the two `mktemp` calls and
the `mv` of the merge result). The trap clears both `$fragment_resolved`
and `$tmp` if any of `sed`/`jq`/`mv` aborts under `set -euo pipefail`.
On the happy path the trap is cleared with `trap - EXIT` and
`$fragment_resolved` is removed explicitly, preserving the prior
post-Step-3 environment exactly. (`$tmp` no longer needs an explicit
`rm` because `mv "$tmp" "$SETTINGS"` consumes it; the trap covers the
case where `mv` itself fails.)

### WR-02: install.sh sed substitution does not escape replacement metacharacters in $HOOKS_DEST

**Files modified:** `install.sh`
**Commit:** e5ad12b
**Applied fix:** Pre-escape sed-replacement metacharacters in
`$HOOKS_DEST` before interpolation, using
`hooks_dest_escaped=$(printf '%s' "$HOOKS_DEST" | sed 's/[\&|]/\\&/g')`.
The `sed` substitution on the next line now references the escaped
form. This closes the silent-corruption footgun for pathological
`$HOME` values containing `\`, `&`, or the chosen delimiter `|`. Chose
the printf+sed pre-escape variant over the alternative jq/`walk()`
rewrite to keep the diff minimal and the existing pipeline structure
unchanged. All 9 settings-merge.test.sh cases continue to pass with
the standard non-pathological sandbox `$HOME`.

### WR-03: settings-merge.test.sh CASE 6c is a tautological pass for fragments staged but not committed

**Files modified:** `tests/install-tests/settings-merge.test.sh`
**Commit:** d7b0d2b
**Applied fix:** Changed the regression guard from
`git -C "$REPO_ROOT" diff --exit-code -- settings.fragment.json` to
`git -C "$REPO_ROOT" diff --exit-code HEAD -- settings.fragment.json`.
The new form compares the working tree against committed state,
ignoring the index, so a future staged-but-uncommitted modification
to `settings.fragment.json` cannot cause the assertion to pass
vacuously when install.sh exactly reverses the staged change. Chose
the `git diff HEAD` variant over the sha256 capture-and-compare
alternative for minimal-diff reasons; the project always runs this
test from a git worktree, so the non-git-environment advantage of the
hash variant is not needed today.

---

_Fixed: 2026-04-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
