---
phase: 02-build-the-layer
reviewed: 2026-04-28T17:24:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - install.sh
  - scripts/regen-requirements.sh
  - tests/install-tests/settings-merge.test.sh
  - tests/hook-tests/regen-requirements.test.sh
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 02 (gap-closure 02-07): Code Review Report

**Reviewed:** 2026-04-28T17:24:00Z
**Depth:** standard
**Scope:** the four files modified by gap-closure plan 02-07 (commits since 98f7bd5).
**Status:** issues_found (3 WARNING, 4 INFO; 0 BLOCKER)

## Summary

Both gap fixes are correctly implemented in spirit and the new CASE 6 tests do
catch the regressions they advertise. CASE 6 in `settings-merge.test.sh` is
particularly strong — it runs the real `install.sh` end-to-end inside a
sandboxed `$HOME` rather than re-implementing the substitution stanza, and the
"vacuous-pass guard" (lines 225-237) correctly prevents the test from passing
silently when install.sh aborts before Step 3.

No BLOCKER-class defects were found. The findings below are robustness and
hygiene gaps in the new install.sh substitution path and a few small
observations on the test cases. The two most worth fixing are:

1. **WR-01 — tempfile leak on error.** install.sh creates two `mktemp` files
   in Step 3 and only cleans them up on the happy path. With `set -e`, a
   `sed` or `jq` failure between lines 47 and 70 leaks both files into
   `/tmp`. A single `trap` in Step 3 closes this for less than two lines of
   code.
2. **WR-02 — sed-replacement metacharacter handling.** The `sed` substitution
   at install.sh:48 expands `$HOOKS_DEST` directly into the replacement
   string. If `$HOME` contains any of `\`, `&`, or the delimiter `|`
   (vanishingly rare but not impossible — e.g., a CI runner with a contrived
   home path), the substitution silently produces wrong output and CASE 6b
   fails non-obviously. Escaping the replacement is one extra `sed` call.

## Warnings

### WR-01: install.sh leaks tempfiles on Step 3 failure

**File:** `install.sh:47-70`
**Issue:** Step 3 creates two `mktemp` tempfiles (`fragment_resolved` at
line 47, `tmp` at line 49) and cleans them up explicitly only on the happy
path. With `set -euo pipefail` (line 5), any failure in the intervening
`sed` (line 48), `jq` (lines 50-68), or `mv` (line 69) causes the script to
abort before the `rm -f "$fragment_resolved"` at line 70 runs, leaking
`$fragment_resolved`. `tmp` was already at risk pre-02-07 — the new code
doubles the leak surface. T-02-07-02 in the plan acknowledges this risk and
asserts mode-0600 on the tempfile is sufficient mitigation, but cleanup is
still hygienic and trivially cheap.

**Fix:** Add a localized trap that runs only for Step 3:
```bash
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
fragment_resolved="$(mktemp)"
tmp="$(mktemp)"
trap 'rm -f "$fragment_resolved" "$tmp"' EXIT
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST|g" "$FRAGMENT" > "$fragment_resolved"
jq -s '
  ...
' "$SETTINGS" "$fragment_resolved" > "$tmp"
mv "$tmp" "$SETTINGS"
trap - EXIT
rm -f "$fragment_resolved"
```
The explicit `rm -f` after `trap - EXIT` keeps the happy-path semantics
unchanged.

---

### WR-02: install.sh sed substitution does not escape replacement metacharacters in $HOOKS_DEST

**File:** `install.sh:48`
**Issue:** The substitution
```bash
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST|g" "$FRAGMENT" > "$fragment_resolved"
```
expands `$HOOKS_DEST` (= `$HOME/.claude/hooks` from line 8) directly into the
sed replacement string. In sed's replacement string, the characters `\`, `&`,
and the chosen delimiter `|` are all special. If `$HOME` ever contains any of
those (unusual but legal — for example a CI runner with `HOME=/tmp/build|1`,
or a Windows-side path that survived a misconfigured WSL env import like
`HOME=/c\\Users\\me`), the substitution silently produces a broken settings.json.
CASE 6 would catch the resulting failure (6b's "every command starts with
`$HOME/.claude/hooks/`" assertion would fire), but the failure mode is opaque
and depends on the user's environment.

The likelihood is low — most posix `$HOME` values are safe — but defensively
escaping the replacement is a one-liner.

**Fix:** Pre-escape the replacement before interpolation:
```bash
# Escape sed-replacement metacharacters in $HOOKS_DEST
hooks_dest_escaped=$(printf '%s' "$HOOKS_DEST" | sed 's/[\&|]/\\&/g')
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$hooks_dest_escaped|g" "$FRAGMENT" > "$fragment_resolved"
```
Alternative (cleaner): use `awk` or do the substitution in `jq` itself so no
shell-interpolated string ever reaches sed's replacement parser. Example:
```bash
jq --arg hooks_dest "$HOOKS_DEST" '
  walk(if type == "string"
       then sub("\\$CLAUDE_PROJECT_DIR/.claude/hooks"; $hooks_dest)
       else . end)
' "$FRAGMENT" > "$fragment_resolved"
```
The jq-based variant has no metacharacter footgun at all and removes the
sed dependency in this stanza.

---

### WR-03: settings-merge.test.sh CASE 6c is a tautological pass for fragments staged but not committed

**File:** `tests/install-tests/settings-merge.test.sh:262-266`
**Issue:** CASE 6c asserts that `settings.fragment.json` is byte-identical
on disk after install.sh runs by checking
```bash
git -C "$REPO_ROOT" diff --exit-code -- settings.fragment.json
```
`git diff` (with no commit args) compares the **working tree** against the
**index**. If a future change has already `git add`-ed a modified
`settings.fragment.json` to the index but not yet committed, the test
passes vacuously even if install.sh subsequently corrupts the working-tree
copy in a way that reverses the staged change. The check should be against
HEAD (or against a checksum captured at the start of the test) so it
catches working-tree mutations regardless of staging state.

**Fix:** Either:
```bash
# Compare working tree against HEAD, ignoring index state
git -C "$REPO_ROOT" diff --exit-code HEAD -- settings.fragment.json
```
Or capture-and-compare a hash:
```bash
fragment_sha_before=$(sha256sum "$REPO_ROOT/settings.fragment.json" | cut -d' ' -f1)
# ... run install.sh ...
fragment_sha_after=$(sha256sum "$REPO_ROOT/settings.fragment.json" | cut -d' ' -f1)
if [ "$fragment_sha_before" = "$fragment_sha_after" ]; then
  _pass "CASE 6c: settings.fragment.json byte-identical after install.sh"
else
  _fail "CASE 6c: install.sh modified settings.fragment.json on disk"
fi
```
The hash variant has the additional advantage of working in non-git
environments (e.g., a tarball install).

## Info

### IN-01: install.sh sed pattern does not escape `.` in `\.claude`

**File:** `install.sh:48`
**Issue:** The sed search pattern `\$CLAUDE_PROJECT_DIR/.claude/hooks` uses
unescaped `.` characters which match any single character in basic regex.
The pattern would also match `$CLAUDE_PROJECT_DIR/Xclaude/hooks` or
`$CLAUDE_PROJECT_DIR/_claudeXhooks`. In practice the on-disk
`settings.fragment.json` only contains the literal string, so this never
matters today. Still, escape for hygiene and to make the intent
unambiguous.

**Fix:**
```bash
sed "s|\$CLAUDE_PROJECT_DIR/\.claude/hooks|$hooks_dest_escaped|g" "$FRAGMENT" > "$fragment_resolved"
```

---

### IN-02: install.sh sed pattern lacks trailing-slash anchor — would mangle `hooks-suffix` paths

**File:** `install.sh:48`
**Issue:** Pattern `\$CLAUDE_PROJECT_DIR/.claude/hooks` (no trailing `/` or
boundary) would also match `$CLAUDE_PROJECT_DIR/.claude/hooks-suffix` and
yield `$HOOKS_DEST-suffix`. settings.fragment.json today only has the form
`$CLAUDE_PROJECT_DIR/.claude/hooks/<file>.sh` so all existing matches are
safe (the trailing `/` is preserved by the rest of the path). If anyone
ever adds a non-canonical placeholder like
`$CLAUDE_PROJECT_DIR/.claude/hooks-extra/foo.sh`, the substitution will
mangle it without warning.

**Fix:** Anchor the pattern so it only matches a directory boundary:
```bash
sed "s|\$CLAUDE_PROJECT_DIR/\.claude/hooks/|$hooks_dest_escaped/|g" "$FRAGMENT" > "$fragment_resolved"
```
The trailing `/` makes the match unambiguous and is safe because every
intended hook path already begins `.../hooks/<file>`.

---

### IN-03: regen-requirements.sh capitalization pipeline is locale-sensitive for non-ASCII categories

**File:** `scripts/regen-requirements.sh:107-109`
**Issue:** `awk`'s `toupper()` and `tolower()` operate byte-by-byte, not
codepoint-by-codepoint, when the awk implementation is not Unicode-aware.
A category label like `category:café` would yield `Café` on systems where
awk's locale is `C` or `POSIX`, but on systems where awk uses a UTF-8
locale and treats the multibyte `é` correctly, the result is the same. On
mixed-locale systems (mawk on Debian uses byte semantics), the output is
deterministic but may differ from BSD awk. None of the current category
slugs are non-ASCII, so this is a non-issue today. Note for the future
when category labels accept user-input strings.

**Fix:** Either constrain category labels to ASCII at the bd-label layer,
or normalize input via `LC_ALL=C` before piping to awk for guaranteed
byte-stable output.

---

### IN-04: regen-requirements.test.sh CASE 6 depends on the existing fixture seeding `category:auth`

**File:** `tests/hook-tests/regen-requirements.test.sh:259-263`
**Issue:** Test 3 asserts `^### Auth$` exists in the output, which
implicitly depends on `tests/fixtures/bd-helpers/3-level-hierarchy.sh`
seeding at least one requirement with `category:auth`. CASE 3 (line 108)
already relies on the same assumption, so the coupling is consistent —
just worth noting that if the fixture is ever changed to use a different
single-word category (e.g., `category:core`), both CASE 3 and CASE 6's
Test 3 will fail in tandem and the failure message in CASE 6 ("missing
exact '### Auth' header") may be confusing.

**Fix:** Either (a) add a `bd label add ... category:auth` step inside
CASE 6 itself to make the test self-contained, or (b) leave a comment
above Test 3 noting the fixture dependency. Either is fine; the current
implicit coupling is acceptable for an internal test suite.

---

_Reviewed: 2026-04-28T17:24:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Scope: gap-closure plan 02-07 only — the 6 prior plans in phase 02 were reviewed in commit 60cde88_
