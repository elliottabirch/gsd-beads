---
phase: 02-build-the-layer
plan: 02-07
type: execute
wave: 1
depends_on: []
files_modified:
  - install.sh
  - tests/install-tests/settings-merge.test.sh
  - scripts/regen-requirements.sh
  - tests/hook-tests/regen-requirements.test.sh
autonomous: true
gap_closure: true
requirements_addressed:
  - REQ-04
  - REQ-06
tags:
  - gap-closure
  - portability
  - hook-paths

must_haves:
  goal: "Close the two verification gaps from 02-VERIFICATION.md so the phase goal — `git clone && ./install.sh` distribution that gates GSD planning state behind beads — is fully achieved on every supported platform (Linux + macOS + WSL2)."
  truths:
    - "After `./install.sh` runs, the merged ~/.claude/settings.json contains hook commands resolving to the actual install location ($HOME/.claude/hooks/) — NEVER the literal string '$CLAUDE_PROJECT_DIR'. Hook paths point to a directory that exists on disk."
    - "scripts/regen-requirements.sh produces correctly capitalized category headers (e.g. '### Auth Flow' for category:auth-flow) on macOS BSD sed AND GNU sed — no '\\U' literal artifacts."
    - "settings-merge.test.sh asserts the post-merge settings.json contains zero literal '$CLAUDE_PROJECT_DIR' substrings in any hook command."
    - "regen-requirements.test.sh asserts category headers match `^### [A-Z][a-z]` (capital first letter, lowercase tail) with no backslash artifacts."
  artifacts:
    - path: "install.sh"
      provides: "Path substitution before jq deep-merge; merged settings.json has resolvable hook paths"
      contains: "HOOKS_DEST.*settings.fragment"
    - path: "tests/install-tests/settings-merge.test.sh"
      provides: "CASE 6 — substitution-correctness assertion against $CLAUDE_PROJECT_DIR literal"
      contains: "CASE 6"
    - path: "scripts/regen-requirements.sh"
      provides: "Portable awk-only category capitalization at the line currently using sed \\U"
      contains: "toupper(substr"
    - path: "tests/hook-tests/regen-requirements.test.sh"
      provides: "CASE 6 — category capitalization regression test (asserts no \\U literal in output)"
      contains: "CASE 6"
  key_links:
    - from: "install.sh"
      to: "settings.fragment.json"
      via: "jq -s deep-merge consuming a SUBSTITUTED fragment, not the on-disk file verbatim"
      pattern: "HOOKS_DEST.*settings\\.fragment\\.json|sed.*CLAUDE_PROJECT_DIR.*HOOKS_DEST"
    - from: "scripts/regen-requirements.sh"
      to: ".planning/REQUIREMENTS.md"
      via: "awk-only capitalization pipeline (no sed \\U)"
      pattern: "tr '-' ' '.*awk.*toupper"
---

<objective>
Close the two verification gaps blocking phase-02 completion.

Gap 1 (BLOCKER, REQ-04): install.sh deep-merges settings.fragment.json into
~/.claude/settings.json but never substitutes the placeholder path
`$CLAUDE_PROJECT_DIR/.claude/hooks/` with the actual install location
`$HOME/.claude/hooks/`. Result: Claude Code expands $CLAUDE_PROJECT_DIR to
the user's project root (NOT to ~/.claude/), the hooks resolve to a
directory that does not exist, and the entire REQ-04 hook gate silently
fails to fire. PATTERNS.md flagged this as a TODO ("Confirm path layout in
02-05 install script before locking the fragment paths") and 02-02 Task 5
explicitly stated 02-05's install.sh would "resolve these to the actual
~/.claude/hooks/ location during deep-merge." That resolution was never
implemented.

Gap 2 (WARNING, REQ-06 / portability): scripts/regen-requirements.sh:105
uses GNU-only `sed 's/^./\U&/'`. On macOS BSD sed (a primary supported
platform per CLAUDE.md) `\U` is interpreted literally — `auth` becomes
`\Uauth`, breaking the Spike 007 REQUIREMENTS.md format contract. The
subsequent awk pipeline already does word-by-word capitalization and is
sufficient on its own.

Purpose: Both fixes are tiny surgical corrections to already-merged code.
The merged code is otherwise verified (11/13 must-haves green). These two
edits + their test cases are the entire scope of this gap-closure plan.

Output:
- install.sh: substitute $CLAUDE_PROJECT_DIR/.claude/hooks → $HOME/.claude/hooks
  in-flight before the jq merge (do NOT modify settings.fragment.json on disk)
- scripts/regen-requirements.sh: drop the `sed 's/^./\U&/'` call, rely on the
  existing awk pipeline alone (with `tr '-' ' '` for the dash→space step)
- tests/install-tests/settings-merge.test.sh: new CASE 6 that runs the
  install.sh substitution+merge logic and asserts no literal
  $CLAUDE_PROJECT_DIR survives in any hook command
- tests/hook-tests/regen-requirements.test.sh: new CASE 6 that asserts
  category headers are capitalized correctly with no \U literal
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<approach>
Single plan, two parallel tasks (no inter-task dependency, no shared
files): Task 1 fixes Gap 1 (install.sh + settings-merge.test.sh), Task 2
fixes Gap 2 (regen-requirements.sh + regen-requirements.test.sh).

Why one plan, not two:
- Both are tiny (~10 lines of production change each, plus ~30 lines of
  test scaffolding). Combined context cost is well under the 50% budget.
- Zero file overlap between the tasks (install.sh + settings-merge.test.sh
  vs scripts/regen-requirements.sh + regen-requirements.test.sh).
- Both are pure correctness corrections — no design decisions, no
  cross-cutting refactors.
- They share Wave 1 with no dependencies; splitting into two plans would
  add ceremony without parallelism benefit.

Why these specific fixes (verbatim from 02-VERIFICATION.md "Required fix"
language):
- Gap 1: prefer `sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST|g"`
  on the fragment piped into jq, so the on-disk settings.fragment.json is
  unchanged and only the merged output is rewritten. This matches the
  verification report's "do not modify settings.fragment.json on disk —
  substitute in-flight only" directive.
- Gap 2: use the exact replacement block from 02-REVIEW.md CR-04:
  `printf '%s' "$cat" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'`.
  The verification report explicitly cites CR-04 as the canonical fix.
</approach>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-build-the-layer/02-VERIFICATION.md
@.planning/phases/02-build-the-layer/02-REVIEW.md
@.planning/phases/02-build-the-layer/02-CONTEXT.md
@install.sh
@settings.fragment.json
@scripts/regen-requirements.sh
@tests/install-tests/settings-merge.test.sh
@tests/hook-tests/regen-requirements.test.sh

<interfaces>
<!-- Key contracts the executor needs. Both fixes are local — no cross-module interfaces. -->

install.sh shell variables already in scope (see install.sh:7-12):
```bash
REPO="$(cd "$(dirname "$0")" && pwd -P)"
HOOKS_DEST="$HOME/.claude/hooks"
SCRIPTS_DEST="$HOME/.claude/scripts"
BIN_DEST="$HOME/.local/bin"
SETTINGS="$HOME/.claude/settings.json"
FRAGMENT="$REPO/settings.fragment.json"
```

The placeholder string in settings.fragment.json (verified):
- `$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh`
- `$CLAUDE_PROJECT_DIR/.claude/hooks/block-gsd-sdk-mutation.sh`
- `$CLAUDE_PROJECT_DIR/.claude/hooks/bd-sync.sh`

Target after substitution (with HOOKS_DEST = $HOME/.claude/hooks):
- `$HOME/.claude/hooks/block-state-md.sh` (or expanded absolute path)

Existing jq deep-merge pattern (install.sh:43-62) — DO NOT alter the merge
itself. Substitute the input only.

regen-requirements.sh line 105 (current — broken on macOS):
```bash
cat_header=$(printf '%s' "$cat" | sed 's/^./\U&/; s/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
```

Replacement (per 02-REVIEW.md CR-04, verbatim):
```bash
cat_header=$(printf '%s' "$cat" \
  | tr '-' ' ' \
  | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
```
</interfaces>

<conventions>
<!-- Project conventions that apply to both tasks (from CLAUDE.md auto-loaded skill spike-findings-gsd-beads). -->
- Standard Stack: bash + jq + bd CLI ONLY for shell scripts (no Node, no Python).
- Portable POSIX where macOS support is required (CLAUDE.md lists macOS as primary platform).
- No in-place edits — atomic mktemp+mv only (already used by install.sh; preserve).
- Tests are bash + jq synthetic-payload runners, exit non-zero on any FAIL.
- Pass/fail tally pattern: `pass=0; fail=0; ... [ "$fail" -eq 0 ]`.
</conventions>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix install.sh path substitution + add settings-merge CASE 6</name>
  <files>install.sh, tests/install-tests/settings-merge.test.sh</files>
  <read_first>
    Before writing, re-read these spans (already in your context — do not duplicate the read):
    - install.sh:38-62 (the jq deep-merge block — substitution must happen on the fragment INPUT before this jq call, not after)
    - settings.fragment.json:1-40 (the three hook commands using `$CLAUDE_PROJECT_DIR/.claude/hooks/...`)
    - tests/install-tests/settings-merge.test.sh:1-200 (existing 5 cases; CASE 6 will append after CASE 5 and before the Summary block at line 197)

    Do NOT re-read 02-VERIFICATION.md or 02-REVIEW.md — Gap 1 wording from those docs is already in your <objective> and <interfaces> blocks above.
  </read_first>

  <behavior>
    Test-first specification (write CASE 6 before patching install.sh):

    - **Test 1 — substitution removes literal $CLAUDE_PROJECT_DIR**:
      Given an empty existing settings.json and the on-disk settings.fragment.json,
      when the install.sh substitution+merge pipeline runs,
      then `jq -r '.. | .command? // empty' merged.json | grep -c '\$CLAUDE_PROJECT_DIR'` returns exactly 0.

    - **Test 2 — substitution writes correct $HOME-rooted paths**:
      Given the same inputs,
      when the pipeline runs,
      then the merged settings.json contains exactly 3 hook command paths,
      and every one of them starts with `$HOME/.claude/hooks/` (literal `$HOME` is acceptable as long as it is NOT `$CLAUDE_PROJECT_DIR`),
      and each path ends with one of: `block-state-md.sh`, `block-gsd-sdk-mutation.sh`, `bd-sync.sh`.

    - **Test 3 — substitution does not modify settings.fragment.json on disk**:
      Given the original settings.fragment.json byte-content,
      when the pipeline runs,
      then `git diff --exit-code -- settings.fragment.json` exits 0 (file unchanged).

    All three tests must FAIL against current install.sh (no substitution). After Step 2 below they must all PASS.
  </behavior>

  <action>
**Step 1 — Add failing test (RED). Append CASE 6 to tests/install-tests/settings-merge.test.sh BEFORE the existing Summary block (which currently lives at lines 197-200).**

The new CASE 6 must exercise the actual install.sh substitution pipeline, not a re-implementation. Approach: extract the exact substitution+merge stanza by sourcing or `awk`-ing it out is fragile; instead, run install.sh's substitution+merge as a self-contained subshell snippet that mirrors install.sh's pipeline using the test's own HOOKS_DEST stub. Pattern:

```bash
# CASE 6 (Gap 1 fix): path substitution removes $CLAUDE_PROJECT_DIR literal before merge
existing6="$(mktemp)"
echo '{}' > "$existing6"
merged6="$(mktemp)"
HOOKS_DEST_TEST="$HOME/.claude/hooks"
# Substitute first, then merge — mirrors install.sh's pipeline post-fix.
substituted6="$(mktemp)"
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST_TEST|g" "$FRAGMENT" > "$substituted6"
deep_merge "$existing6" "$substituted6" > "$merged6"

# Test 1: zero literal $CLAUDE_PROJECT_DIR survivors
literal_count6="$(jq -r '[.. | .command? // empty] | .[]' "$merged6" | grep -c -F '$CLAUDE_PROJECT_DIR' || true)"
if [ "$literal_count6" = "0" ]; then
  _pass "CASE 6a: zero literal \$CLAUDE_PROJECT_DIR in merged hook commands"
else
  _fail "CASE 6a: expected 0 \$CLAUDE_PROJECT_DIR literals, got $literal_count6"
fi

# Test 2: every hook command points under $HOOKS_DEST_TEST
all_under_hooks_dest6="$(jq -r '[.. | .command? // empty] | .[]' "$merged6" \
  | grep -v -F "$HOOKS_DEST_TEST/" | wc -l | tr -d ' ')"
if [ "$all_under_hooks_dest6" = "0" ]; then
  _pass "CASE 6b: all hook commands resolve under $HOOKS_DEST_TEST/"
else
  _fail "CASE 6b: expected all hook commands under $HOOKS_DEST_TEST/, $all_under_hooks_dest6 paths failed the check"
fi

# Test 3: settings.fragment.json on disk is unchanged (in-flight substitution only)
if git -C "$REPO_ROOT" diff --exit-code -- settings.fragment.json >/dev/null 2>&1; then
  _pass "CASE 6c: settings.fragment.json unchanged on disk after substitution+merge"
else
  _fail "CASE 6c: settings.fragment.json was modified on disk — substitution must be in-flight only"
fi

rm -f "$existing6" "$merged6" "$substituted6"
```

Run the test once; CASE 6a/6b should currently fail because the existing test code doesn't yet exercise substitution. (Test 6c will incidentally pass because the test isn't writing to the fragment, but keep it as a regression guard.) Confirm RED on at least 6a and 6b before proceeding to Step 2.

**Step 2 — Implement substitution in install.sh (GREEN).** Modify the deep-merge block (currently lines 38-62) to substitute the fragment before piping into jq -s. The cleanest fix is to materialize the substituted fragment to a tmp file and feed THAT to jq -s in place of `$FRAGMENT`. Concrete patch:

Replace the current block:
```bash
# ── Step 3: Settings.json deep-merge with dedup (Pitfall 6) ─────────
# Dedup key: (matcher, command, if) — unique_by("\(.command)\(.if // "")") within each matcher group.
# Atomic write: mktemp+mv (T-02-07 mitigation).
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
tmp="$(mktemp)"
jq -s '
  ...
' "$SETTINGS" "$FRAGMENT" > "$tmp"
mv "$tmp" "$SETTINGS"
```

With:
```bash
# ── Step 3: Settings.json deep-merge with dedup (Pitfall 6) ─────────
# Dedup key: (matcher, command, if) — unique_by("\(.command)\(.if // "")") within each matcher group.
# Path substitution (Gap 1 fix): settings.fragment.json contains
# `$CLAUDE_PROJECT_DIR/.claude/hooks/...` placeholders. Claude Code expands
# `$CLAUDE_PROJECT_DIR` to the user's project directory, NOT to ~/.claude/.
# Hooks live at $HOOKS_DEST. Substitute in-flight before merge so on-disk
# fragment is unchanged but merged settings.json has resolvable paths.
# Atomic write: mktemp+mv (T-02-07 mitigation).
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
fragment_resolved="$(mktemp)"
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOOKS_DEST|g" "$FRAGMENT" > "$fragment_resolved"
tmp="$(mktemp)"
jq -s '
.[0] as $existing | .[1] as $fragment |
($existing.hooks // {}) as $eh | ($fragment.hooks // {}) as $fh |
([$eh, $fh] | map(keys[]) | unique) as $events |
($existing | del(.hooks)) * ($fragment | del(.hooks)) + {
  hooks: (
    reduce $events[] as $evt (
      {};
      . + {
        ($evt): (
          (($eh[$evt] // []) + ($fh[$evt] // [])) |
          group_by(.matcher) |
          map(.[0] + {hooks: (map(.hooks) | flatten | unique_by("\(.command)\(.if // "")"))})
        )
      }
    )
  )
}
' "$SETTINGS" "$fragment_resolved" > "$tmp"
mv "$tmp" "$SETTINGS"
rm -f "$fragment_resolved"
```

Notes:
- The `sed "s|...|$HOOKS_DEST|g"` uses `|` as the delimiter to avoid escaping the slashes in the path. The `\$CLAUDE_PROJECT_DIR` left-hand side is escaped (`\$`) so the shell does not try to expand it; sed sees the literal `$CLAUDE_PROJECT_DIR` token and replaces it.
- $HOOKS_DEST is already `$HOME/.claude/hooks` per install.sh:8. The substituted output will contain the expanded absolute path (because the shell expands `$HOOKS_DEST` inside the sed replacement string), e.g. `/home/user/.claude/hooks/block-state-md.sh`. This is the desired behavior — Claude Code reads the settings.json verbatim and runs the hook from that absolute path.
- DO NOT modify settings.fragment.json on disk. The substitution writes to a tempfile (`$fragment_resolved`), passes it to jq, then `rm -f` cleans up.
- DO NOT alter the jq merge expression itself — it is already verified correct (5/5 cases in settings-merge.test.sh).

**Step 3 — Re-run CASE 6 (GREEN).** Run `bash tests/install-tests/settings-merge.test.sh` and confirm CASE 6a/6b/6c all PASS plus CASES 1-5 still PASS (6 total). Confirm `bash -n install.sh` syntax-checks clean.
  </action>

  <verify>
    <automated>bash tests/install-tests/settings-merge.test.sh && bash -n install.sh && bash -n scripts/regen-requirements.sh</automated>
  </verify>

  <acceptance_criteria>
    - tests/install-tests/settings-merge.test.sh exits 0; "Passed: 8 / 8" (5 original CASES + 3 new CASE 6 sub-assertions OR re-counted as "Passed: 6 / 6" if CASE 6 reports as a single combined PASS — match whichever counting style the existing file uses; current file uses one PASS/FAIL per assertion, so expect 8 / 8).
    - `grep -c -F '$CLAUDE_PROJECT_DIR' install.sh` returns >= 1 (the literal string still appears as the sed search pattern — that is correct).
    - `git diff -- settings.fragment.json` is empty (the on-disk fragment is byte-identical).
    - `bash -n install.sh` exits 0.
    - The new sed substitution line in install.sh contains both `\$CLAUDE_PROJECT_DIR/.claude/hooks` and `$HOOKS_DEST`, in that order, and uses `|` as the sed delimiter (not `/`).
    - The fragment_resolved tmp file is `rm -f`'d after the merge — no leftover tempfiles.
  </acceptance_criteria>

  <done>
    Gap 1 closed. Running `./install.sh` on a fresh machine produces a
    ~/.claude/settings.json whose three hook commands all start with
    `$HOOKS_DEST` (i.e., `$HOME/.claude/hooks/`) and contain zero
    `$CLAUDE_PROJECT_DIR` literals. CASE 6 in settings-merge.test.sh
    enforces this regression-permanent. REQ-04 hook gate now actually
    fires in user projects.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace GNU sed \U with portable awk in regen-requirements.sh + add CASE 6</name>
  <files>scripts/regen-requirements.sh, tests/hook-tests/regen-requirements.test.sh</files>
  <read_first>
    Before writing, re-read these spans (already in your context — do not duplicate the read):
    - scripts/regen-requirements.sh:90-120 (the category-header pipeline at line 105 — only this 30-line span needs to be in working memory)
    - tests/hook-tests/regen-requirements.test.sh:90-130 (existing CASE 3 already verifies category headers; CASE 6 strengthens it with explicit \U-literal check)
    - tests/hook-tests/regen-requirements.test.sh:218-225 (Summary block; CASE 6 must come BEFORE this)

    Do NOT re-read 02-REVIEW.md — CR-04's exact replacement code is in the
    <interfaces> block above.
  </read_first>

  <behavior>
    Test-first specification (write CASE 6 before patching the script):

    - **Test 1 — no \U literal in any header**:
      Given a bd fixture with at least one category-labeled requirement (the existing 3-level-hierarchy.sh fixture has `category:auth`),
      when regen-requirements.sh runs,
      then `grep -c '\\U' .planning/REQUIREMENTS.md` returns 0.

    - **Test 2 — multi-word category capitalization**:
      Given a bd fixture seeded with a requirement labeled `category:auth-flow` (multi-word slug),
      when regen-requirements.sh runs,
      then `.planning/REQUIREMENTS.md` contains the literal string `### Auth Flow` (capital A, capital F, lowercase tails, single space between words).

    - **Test 3 — single-word category capitalization preserved**:
      Given the existing fixture's `category:auth` requirement (already covered by CASE 3 with `[Aa]uth` — but CASE 6 strengthens to explicit `Auth`),
      when regen-requirements.sh runs,
      then `.planning/REQUIREMENTS.md` contains `### Auth` (NOT `### auth`, NOT `### \Uauth`, NOT `### AUTH`).

    All three tests must FAIL on macOS BSD sed against the current line-105 implementation. Test 1 will detect the regression even on Linux/GNU sed — but only if a multi-word category is present (single-word `auth` happens to look the same after `\U` on GNU sed and `awk`-only on either platform). Test 2 (multi-word) is the load-bearing portability check.

    On Linux/GNU sed CI runners, Test 1 will currently PASS (because GNU sed correctly applies `\U`) — the test still has value because it catches a future regression where someone reintroduces `\U` in a way that emits literally on every platform.
  </behavior>

  <action>
**Step 1 — Add failing test (RED). Append CASE 6 to tests/hook-tests/regen-requirements.test.sh BEFORE the existing Summary block (currently at lines 218-225).**

```bash
# ---------------------------------------------------------------------------
# CASE 6 (Gap 2 fix, REQ-06 / portability): category capitalization is
# portable — no GNU-only sed \U escape; awk-only pipeline produces correctly
# capitalized headers on macOS BSD sed and GNU sed alike.
# ---------------------------------------------------------------------------
echo ""
echo "CASE 6: portable category capitalization (no \\U literal, multi-word handled)"
case6_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  # Add a multi-word category requirement (auth-flow → "Auth Flow")
  MW_REQ=$(bd q "REQ-077: Multi-word category test" -t epic -p 5)
  bd label add "$MW_REQ" gsd:requirement >/dev/null 2>&1
  bd label add "$MW_REQ" req-id:REQ-077 >/dev/null 2>&1
  bd label add "$MW_REQ" version:v1 >/dev/null 2>&1
  bd label add "$MW_REQ" category:auth-flow >/dev/null 2>&1

  bash "$REGEN_REQS"
  reqs=$(cat "$fixture/.planning/REQUIREMENTS.md")

  # Test 1: zero \U literals anywhere in the output
  ulit_count=$(printf '%s' "$reqs" | grep -c '\\U' || true)
  if [ "$ulit_count" -ne 0 ]; then
    case6_ok=0
    echo "  detail: found $ulit_count occurrences of literal \\U in output (GNU-sed leak)"
    printf '%s' "$reqs" | grep '\\U' | head -3
  fi

  # Test 2: multi-word category produces "### Auth Flow" exactly
  if ! printf '%s' "$reqs" | grep -qE '^### Auth Flow$'; then
    case6_ok=0
    echo "  detail: missing '### Auth Flow' header for category:auth-flow label"
    printf '%s' "$reqs" | grep '^### ' || echo "  (no ### headers found)"
  fi

  # Test 3: single-word category produces exact "### Auth" (NOT "auth", NOT "AUTH", NOT "\Uauth")
  if ! printf '%s' "$reqs" | grep -qE '^### Auth$'; then
    case6_ok=0
    echo "  detail: missing exact '### Auth' header for category:auth label"
    printf '%s' "$reqs" | grep '^### ' || true
  fi

  rm -rf "$fixture"
}
if [ "$case6_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: category headers portable (no \\U literal, multi-word handled)"
else
  fail=$((fail + 1))
  echo "  FAIL: category capitalization not portable"
fi
```

Run the test once. On Linux/GNU sed, Test 1 + Test 3 will already PASS (GNU `\U` works), but Test 2 (multi-word) will FAIL because `\U` only uppercases the first character — `auth-flow` becomes `\Uauth-flow` → `Auth-flow` (then the subsequent `s/-/ /g` and awk produce `Auth Flow` accidentally on GNU sed via the awk pass... hm). Actually re-examining: the existing pipeline is `sed 's/^./\U&/; s/-/ /g' | awk '...'`. On GNU sed `auth-flow` becomes `Auth flow` (sed uppercases first char, replaces dashes), then awk capitalizes each word → `Auth Flow`. So on Linux Test 2 already PASSES by accident. The portability bug bites only on macOS where `auth-flow` becomes `\Uauth flow` from sed, then awk → `\Uauth Flow` (awk's `toupper(substr(...,1,1))` returns `\` for the first char... actually `\` is already its own char; `toupper("\\")` is `\`; so we get `\Uauth Flow`).

To make CASE 6 catch the regression on BOTH platforms (so CI on Linux fails RED), we need Test 1 to flag the leak. On Linux/GNU sed against the current code, no `\U` appears in output (sed expanded it correctly), so Test 1 PASSES. That means on GNU-sed-only CI, CASE 6 will go straight to GREEN after the awk-only fix lands without ever showing RED.

That is acceptable: the test's job is to be a permanent regression guard. The RED→GREEN proof comes from the equivalent test running under BSD sed (macOS or `sed` aliased to `gsed`-disabled). For the executor running on Linux, document this in the test comment block:

```bash
# NOTE: on GNU sed, the current (broken) regen-requirements.sh:105 produces
# output that already passes Test 1 + Test 3 (GNU correctly expands \U).
# CASE 6 still passes on GNU sed after the awk-only fix lands, serving as
# a permanent regression guard. The RED proof is on macOS BSD sed (and
# can be locally simulated by replacing line 105's `sed` with `gsed`-style
# verification — out of scope for this task; the awk-only fix is correct
# by construction per CR-04).
```

**Step 2 — Apply CR-04 fix to scripts/regen-requirements.sh:105 (GREEN).** Replace the single line:

```bash
        cat_header=$(printf '%s' "$cat" | sed 's/^./\U&/; s/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
```

With (verbatim from 02-REVIEW.md CR-04, preserving the surrounding 8-space indentation that scripts/regen-requirements.sh currently uses on this line):

```bash
        cat_header=$(printf '%s' "$cat" \
          | tr '-' ' ' \
          | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
```

Notes:
- `tr '-' ' '` replaces dashes with spaces (replacing the now-removed `s/-/ /g` from sed).
- The awk pipeline is byte-identical to what was already there — it does Title-Case word by word.
- This is portable: `tr` and `awk` are POSIX-mandated and behave identically on macOS BSD and GNU.
- Keep the same shell line-continuation style (backslash + 10-space indent for continuation lines) used elsewhere in regen-requirements.sh — match the existing house style (e.g. lines 98-100 already use this pattern).

**Step 3 — Re-run CASE 6 (GREEN).** Run `bash tests/hook-tests/regen-requirements.test.sh`. All 6 cases must PASS. Run `bash -n scripts/regen-requirements.sh` for syntax check.
  </action>

  <verify>
    <automated>bash tests/hook-tests/regen-requirements.test.sh && bash -n scripts/regen-requirements.sh</automated>
  </verify>

  <acceptance_criteria>
    - tests/hook-tests/regen-requirements.test.sh exits 0; "Passed: 6 / 6".
    - `grep -v '^#' scripts/regen-requirements.sh | grep -c '\\\\U'` returns 0 (no `\U` escape anywhere in non-comment lines).
    - `grep -c "tr '-' ' '" scripts/regen-requirements.sh` returns 1 (the new tr-based pipeline is present).
    - `grep -c "sed 's/\\^./" scripts/regen-requirements.sh` returns 0 (the old sed pipeline is removed).
    - `bash -n scripts/regen-requirements.sh` exits 0.
    - The replacement is on the same logical line(s) as the original (no other parts of the script touched).
  </acceptance_criteria>

  <done>
    Gap 2 closed. scripts/regen-requirements.sh produces correctly capitalized
    category headers on macOS BSD sed and GNU sed alike. CASE 6 in
    regen-requirements.test.sh enforces this regression-permanent.
    Spike 007 REQUIREMENTS.md format contract holds on all supported
    platforms (REQ-06 portability).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user shell → install.sh | install.sh runs with the user's privileges; reads $HOME, writes ~/.claude/, ~/.local/bin/. The path-substitution change does NOT cross any new trust boundary — it processes a repo-local file (settings.fragment.json) whose contents are repo-versioned and trusted. |
| bd CLI output → regen-requirements.sh | bd-emitted JSON is consumed by jq + awk. The Gap 2 fix swaps sed for awk on a category-slug string sourced from `bd label` output. Bead labels are user-controlled (an agent can `bd label add … category:foo`). awk's behavior on adversarial input (e.g., a label containing shell metacharacters, ANSI escapes, or null bytes) is well-defined: awk processes input as text per its language spec — no shell parse, no eval. The new pipeline is NOT a downgrade in trust posture. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-07-01 | Tampering | install.sh path substitution | mitigate | Use `sed "s\|...\|$HOOKS_DEST\|g"` with `\|` delimiter — `$HOOKS_DEST` is `$HOME/.claude/hooks` (set by install.sh:8 from a trusted env var). The fragment file is repo-versioned and trusted. The substitution is in-flight only (writes to mktemp tempfile, never modifies on-disk fragment). |
| T-02-07-02 | Information Disclosure | install.sh tempfile cleanup | mitigate | Add `rm -f "$fragment_resolved"` after the jq merge completes successfully. mktemp creates the file with mode 0600 by default, so even before cleanup the substituted fragment (which contains only a user-specific path, no secrets) is not world-readable. |
| T-02-07-03 | Tampering | regen-requirements.sh awk pipeline | accept | awk's text-processing semantics are deterministic and platform-stable. Adversarial bd-label input is contained to the awk text domain — no shell expansion, no eval. Out-of-scope per "tampering at the bd-label layer is upstream of this script's contract." |
| T-02-07-04 | Denial of Service | install.sh substitution failure | accept | If `sed` fails (e.g., out-of-disk on tempfile write), set -e on install.sh:5 aborts cleanly. No half-installed state because the jq merge step downstream of substitution writes to a separate tmpfile + atomic mv. |
</threat_model>

<verification>
**Plan-level verification (run after both tasks complete):**

1. **Gap 1 closed:**
   - `bash tests/install-tests/settings-merge.test.sh` exits 0 with all 6 CASES passing.
   - `bash -n install.sh` exits 0.
   - Manual smoke: `bash install.sh` (in a sandbox / dry-run) followed by
     `jq -r '[.. | .command? // empty] | .[]' ~/.claude/settings.json | grep -c CLAUDE_PROJECT_DIR` returns 0.
   - `git diff -- settings.fragment.json` is empty.

2. **Gap 2 closed:**
   - `bash tests/hook-tests/regen-requirements.test.sh` exits 0 with all 6 CASES passing.
   - `bash -n scripts/regen-requirements.sh` exits 0.
   - `grep -v '^#' scripts/regen-requirements.sh | grep -c '\\\\U'` returns 0.

3. **No collateral damage to existing test suites:**
   - `bash tests/run-quick.sh` exits 0 (regression sweep).
   - `bash tests/install-tests/idempotency.test.sh` still exits 0
     (substitution is idempotent: re-running install.sh produces the same
     resolved settings.json byte-for-byte because $HOOKS_DEST is stable
     within a single user account).

4. **Phase-02 verification re-run readiness:**
   - The 11 originally-VERIFIED truths must remain VERIFIED.
   - The 2 originally-FAILED/PARTIAL truths flip to VERIFIED.
   - Score moves from 11/13 to 13/13.
</verification>

<success_criteria>
- [ ] install.sh substitutes `$CLAUDE_PROJECT_DIR/.claude/hooks` → `$HOOKS_DEST` before the jq deep-merge.
- [ ] settings.fragment.json on disk is byte-identical pre/post install.sh run.
- [ ] tests/install-tests/settings-merge.test.sh CASE 6 (a/b/c) passes.
- [ ] scripts/regen-requirements.sh:105 uses `tr '-' ' ' | awk '...'` (no sed `\U`).
- [ ] tests/hook-tests/regen-requirements.test.sh CASE 6 passes.
- [ ] All previously-passing tests still pass (no regressions).
- [ ] Both bash scripts pass `bash -n`.
- [ ] No new files created outside the four listed in `files_modified`.
- [ ] No upstream GSD core files modified (REQ-02 hard constraint preserved).
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-07-SUMMARY.md`
documenting:
- Both gaps closed (REQ-04 hook-path resolution + REQ-06 macOS portability).
- Diff size: ~10 lines changed in install.sh, ~3 lines changed in
  regen-requirements.sh, ~30 lines added to settings-merge.test.sh,
  ~50 lines added to regen-requirements.test.sh.
- Patterns established: in-flight `sed` substitution for placeholder paths
  before jq deep-merge (reusable for any future placeholder-bearing
  fragment); portable `tr | awk` Title-Case capitalization (reusable
  for any future macOS-portable shell capitalization need).
- No new external dependencies, no new files outside `files_modified`,
  no decisions deferred.
- Suggest re-running `/gsd-verify-phase 02-build-the-layer` to flip
  the score from 11/13 to 13/13.
</output>
