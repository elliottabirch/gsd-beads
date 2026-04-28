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
fixes Gap 2 (scripts/regen-requirements.sh + regen-requirements.test.sh).

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

install.sh sandbox-friendliness (verified by reading install.sh):
- Step 2 (mkdir -p HOOKS_DEST/SCRIPTS_DEST/BIN_DEST) honors $HOME — safe in sandbox.
- Step 3 (settings.json deep-merge) writes only to $SETTINGS=$HOME/.claude/settings.json — safe.
- Step 4 (ln -sfn shadow binary) writes to $BIN_DEST=$HOME/.local/bin — safe.
- Step 5 (bd remember) WILL FAIL in a sandbox without `bd init` — must tolerate via `|| true`.
- Step 6 (worktree shim append) is gated by `[ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]`. If the test runs install.sh from a $PWD that is NOT a beads project (e.g., the sandbox temp dir), Step 6 is skipped entirely.
- Step 7 (`bd setup --add ...`) is already wrapped in `|| true` — safe.
The CASE 6 sandbox test must (a) run from a $PWD without `.beads/`, and
(b) tolerate Step 5's bd-remember failure. Easiest pattern: `bash install.sh || true`
since CASE 6 only asserts the post-Step-3 settings.json state.
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

    CASE 6 is an end-to-end regression guard against install.sh itself —
    NOT a re-implementation of install.sh's substitution logic. The test
    creates a sandboxed $HOME, invokes `bash install.sh` end-to-end inside
    that sandbox, then asserts on the resulting merged settings.json.

    - **Test 6a — substitution removes literal $CLAUDE_PROJECT_DIR**:
      Given a sandboxed $HOME with a pre-seeded baseline ~/.claude/settings.json,
      when `bash install.sh` runs end-to-end (Step 3 substitutes + merges),
      then `jq -r '[.. | .command? // empty] | .[]' "$HOME/.claude/settings.json" | grep -c -F '$CLAUDE_PROJECT_DIR'` returns exactly 0.

    - **Test 6b — every hook command resolves under sandboxed $HOME/.claude/hooks/**:
      Given the same sandboxed invocation,
      when install.sh exits,
      then every hook `command` value in the merged settings.json starts with the sandboxed `$HOME/.claude/hooks/` absolute path,
      and each path ends with one of: `block-state-md.sh`, `block-gsd-sdk-mutation.sh`, `bd-sync.sh`.

    - **Test 6c — settings.fragment.json on disk is byte-unchanged after install.sh runs**:
      Given the original settings.fragment.json byte-content (in the gsd-beads repo, NOT in the sandbox — install.sh reads $REPO/settings.fragment.json which is the test repo root),
      when `bash install.sh` runs end-to-end,
      then `git -C "$REPO_ROOT" diff --exit-code -- settings.fragment.json` exits 0 (file unchanged on disk in the repo). This is a real regression guard against install.sh accidentally writing back to the on-disk fragment.

    - **Test 6d — standalone-pipeline portability assertion (also Warning #2 reinforcement)**:
      Asserts that for every hook command in the merged settings.json, the literal token `$CLAUDE_PROJECT_DIR` does not appear anywhere — same primary check as 6a but stated explicitly as the regression-permanent invariant: "post-Step-3 ~/.claude/settings.json contains zero `$CLAUDE_PROJECT_DIR` literal placeholders."

    All four tests must FAIL when run against the current (pre-fix) install.sh because Step 3 has no substitution. After Step 2 below they must all PASS.

    Sandbox setup contract (so install.sh's bd-dependent and worktree-dependent
    steps don't blow up the test):
    - `SANDBOX=$(mktemp -d)`
    - Pre-create `$SANDBOX/.claude/` and `$SANDBOX/.local/bin/`
    - Pre-seed `$SANDBOX/.claude/settings.json` with `{}` baseline
    - Run install.sh from a $PWD that does NOT contain `.beads/` (so Step 6 worktree append is skipped via the `[ -d "$PWD/.beads" ]` gate)
    - Tolerate Step 5 `bd remember` failures (no `bd init` in sandbox) via `|| true` after `bash install.sh`
    - Cleanup: `rm -rf "$SANDBOX"`
  </behavior>

  <action>
**Step 1 — Add failing test (RED). Append CASE 6 to tests/install-tests/settings-merge.test.sh BEFORE the existing Summary block (which currently lives at lines 197-200).**

The new CASE 6 invokes install.sh end-to-end in a sandboxed `$HOME`. This is the only way for CASE 6c to be a real regression guard — re-implementing install.sh's substitution stanza inline would defeat the purpose (the test must catch a future regression where someone removes the substitution from install.sh, not a future regression where the test re-implementation is wrong).

```bash
# CASE 6 (Gap 1 fix): end-to-end regression guard against install.sh.
# Runs `bash install.sh` in a sandboxed HOME and asserts the merged
# ~/.claude/settings.json has hook paths substituted (no $CLAUDE_PROJECT_DIR
# literals) and the on-disk settings.fragment.json is unchanged.
SANDBOX="$(mktemp -d)"
SAVED_HOME="$HOME"
SAVED_PWD="$PWD"
{
  # Sandbox setup: pretend $HOME is a fresh user dir.
  export HOME="$SANDBOX"
  mkdir -p "$HOME/.claude" "$HOME/.local/bin"
  echo '{}' > "$HOME/.claude/settings.json"

  # When the test runs install.sh from $REPO_ROOT, $PWD equals $REPO, so
  # install.sh's Step 6 predicate `[ "$PWD" != "$REPO" ]` evaluates false
  # and Step 6 is skipped regardless of .beads/ presence in the repo root.
  # Tolerate Step 5 bd-remember failures (no bd init in sandbox) by capturing
  # install.sh's exit code separately — CASE 6 only asserts post-Step-3
  # state, not bd-memory state, but a non-zero exit BEFORE Step 3 would
  # leave the pre-seeded {} baseline intact and let 6a-6d pass vacuously.
  cd "$REPO_ROOT"

  # Capture install.sh exit code separately so vacuous passes are caught
  install_rc=0
  bash install.sh >/dev/null 2>&1 || install_rc=$?

  # Sentinel: Step 3 must have produced at least one hook entry, otherwise
  # all four sub-tests below would pass vacuously on the pre-seeded {} baseline.
  hook_count=$(jq '[.hooks // {} | .. | .command? // empty] | length' "$HOME/.claude/settings.json" 2>/dev/null || echo 0)
  if [ "$install_rc" -ne 0 ] && [ "$hook_count" -eq 0 ]; then
    echo "FAIL: install.sh exited $install_rc and produced no hook entries — sub-tests would pass vacuously"
    rm -rf "$SANDBOX"
    HOME="$SAVED_HOME"
    exit 1
  fi
  if [ "$hook_count" -lt 1 ]; then
    echo "FAIL: install.sh Step 3 deep-merge produced 0 hook entries (expected >= 1) — vacuous-pass guard tripped"
    rm -rf "$SANDBOX"
    HOME="$SAVED_HOME"
    exit 1
  fi

  # Test 6a: zero literal $CLAUDE_PROJECT_DIR survivors in merged settings.
  literal_count6="$(jq -r '[.. | .command? // empty] | .[]' "$HOME/.claude/settings.json" \
    | grep -c -F '$CLAUDE_PROJECT_DIR' || true)"
  if [ "$literal_count6" = "0" ]; then
    _pass "CASE 6a: zero literal \$CLAUDE_PROJECT_DIR in merged hook commands (post-install.sh)"
  else
    _fail "CASE 6a: expected 0 \$CLAUDE_PROJECT_DIR literals in $HOME/.claude/settings.json, got $literal_count6"
  fi

  # Test 6b: every hook command resolves under sandboxed $HOME/.claude/hooks/.
  # Filter to commands containing "hooks/" then assert all start with $HOME/.claude/hooks/.
  bad_paths6="$(jq -r '[.. | .command? // empty] | .[] | select(contains("hooks/"))' "$HOME/.claude/settings.json" \
    | grep -v "^$HOME/.claude/hooks/" || true)"
  if [ -z "$bad_paths6" ]; then
    _pass "CASE 6b: all hook commands resolve under $HOME/.claude/hooks/ (sandboxed install)"
  else
    _fail "CASE 6b: hook commands not under $HOME/.claude/hooks/ — got: $bad_paths6"
  fi

  # Test 6c (real regression guard): on-disk settings.fragment.json is unchanged.
  # If install.sh ever writes back to the fragment, this fails. The fragment
  # path here is $REPO_ROOT/settings.fragment.json (the gsd-beads repo file,
  # not anything in the sandbox).
  if git -C "$REPO_ROOT" diff --exit-code -- settings.fragment.json >/dev/null 2>&1; then
    _pass "CASE 6c: settings.fragment.json unchanged on disk after install.sh end-to-end"
  else
    _fail "CASE 6c: install.sh modified settings.fragment.json on disk — substitution must be in-flight only"
  fi

  # Test 6d (Warning #2 reinforcement, post-Step-3 invariant):
  # Re-states 6a as the regression-permanent invariant for Warning #2.
  # Identical assertion mechanism but distinct test name for traceability.
  literal_count6d="$(jq -r '[.. | .command? // empty] | .[]' "$HOME/.claude/settings.json" \
    | grep -c -F '$CLAUDE_PROJECT_DIR' || true)"
  if [ "$literal_count6d" = "0" ]; then
    _pass "CASE 6d: post-Step-3 settings.json has zero \$CLAUDE_PROJECT_DIR placeholders (Warning #2 invariant)"
  else
    _fail "CASE 6d: post-Step-3 settings.json contains $literal_count6d \$CLAUDE_PROJECT_DIR placeholders"
  fi
}
# Restore environment regardless of test outcome.
export HOME="$SAVED_HOME"
cd "$SAVED_PWD"
rm -rf "$SANDBOX"
```

Run the test once. CASE 6a/6b/6d will FAIL on the current install.sh (because Step 3 has no substitution — `$CLAUDE_PROJECT_DIR` literals will survive). CASE 6c may incidentally pass (current install.sh does not modify the fragment), but it is the regression guard for the post-fix state. Confirm RED on at least 6a/6b/6d before proceeding to Step 2.

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

**Step 3 — Re-run CASE 6 (GREEN).** Run `bash tests/install-tests/settings-merge.test.sh` and confirm CASE 6a/6b/6c/6d all PASS plus CASES 1-5 still PASS (9 sub-assertions total: 5 original CASES + 4 new CASE 6 tests). Confirm `bash -n install.sh` syntax-checks clean.
  </action>

  <verify>
    <automated>bash tests/install-tests/settings-merge.test.sh && bash -n install.sh && bash -n scripts/regen-requirements.sh</automated>
  </verify>

  <acceptance_criteria>
    - tests/install-tests/settings-merge.test.sh exits 0; "Passed: 9 / 9" (5 original CASES + 4 CASE 6 sub-assertions: 6a, 6b, 6c, 6d).
    - `grep -c -F '$CLAUDE_PROJECT_DIR' install.sh` returns >= 1 (the literal string still appears as the sed search pattern — that is correct).
    - `git diff -- settings.fragment.json` is empty (the on-disk fragment is byte-identical).
    - `bash -n install.sh` exits 0.
    - The new sed substitution line in install.sh contains both `\$CLAUDE_PROJECT_DIR/.claude/hooks` and `$HOOKS_DEST`, in that order, and uses `|` as the sed delimiter (not `/`).
    - The fragment_resolved tmp file is `rm -f`'d after the merge — no leftover tempfiles.
    - **(Warning #2 closure)** After CASE 6 runs against a sandboxed HOME, `jq -r '[.. | .command? // empty] | .[]' "$HOME/.claude/settings.json" | grep -c -F '$CLAUDE_PROJECT_DIR'` returns 0 (zero literal placeholders in merged settings.json).
    - **(Warning #4 closure)** CASE 6 invokes install.sh end-to-end (not a re-implemented substitution pipeline) — `grep -c "bash install.sh" tests/install-tests/settings-merge.test.sh` returns >= 1.
    - CASE 6 sentinel asserts hook_count >= 1 from $HOME/.claude/settings.json after install.sh exits, preventing vacuous pass when install.sh aborts before Step 3 (closes Warning #2 from iteration 2).
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

    - **Test 4 — standalone-pipeline portability assertion (Warning #3 closure)**:
      Independent of regen-requirements.sh, pipe the literal string `auth-flow` through the post-fix portable pipeline `tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}'` and assert the output is exactly `Auth Flow`. This proves BSD-equivalence by construction: `tr` and `awk` are POSIX-mandated and behave identically on macOS BSD and GNU. The assertion does not require regen-requirements.sh to run — it is a direct pipeline check that holds on any POSIX platform.

    All four tests serve as a permanent regression guard. On Linux/GNU sed, Tests 1 + 3 pass on the current (broken) script too (because GNU `\U` works), so they go straight to GREEN after the awk-only fix lands. On macOS BSD sed, Tests 1 + 3 currently FAIL (literal `\U` survives), and the awk-only fix flips them to GREEN. Test 2 (multi-word) is the load-bearing portability check that exercises the dash-to-space transition on both platforms. Test 4 is the BSD-equivalence proof — it runs the post-fix pipeline directly with no platform-dependent intermediate.
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

  # Test 4 (Warning #3 closure): standalone-pipeline portability proof.
  # Runs the post-fix capitalization pipeline directly on the literal
  # input "auth-flow" — bypasses regen-requirements.sh entirely. Uses
  # only POSIX-mandated tr and awk, so the result is BSD-equivalent
  # by construction. Asserts output is exactly "Auth Flow".
  pipeline_out="$(printf '%s' 'auth-flow' \
    | tr '-' ' ' \
    | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')"
  if [ "$pipeline_out" != "Auth Flow" ]; then
    case6_ok=0
    echo "  detail: standalone tr|awk pipeline produced '$pipeline_out' instead of 'Auth Flow'"
  fi

  rm -rf "$fixture"
}
if [ "$case6_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: category headers portable (no \\U literal, multi-word handled, BSD-equivalent pipeline)"
else
  fail=$((fail + 1))
  echo "  FAIL: category capitalization not portable"
fi
```

Run the test once. On Linux/GNU sed, Tests 1, 3, and 4 will already PASS (GNU `\U` works for 1+3; Test 4 has no dependency on regen-requirements.sh and uses only POSIX tools so it always passes). Test 2 (multi-word) currently passes on GNU sed by accident (sed uppercases first char `\U`, replaces dashes with spaces, then awk word-capitalizes — the chain produces "Auth Flow"). On macOS/BSD sed, Tests 1, 2, 3 currently FAIL (literal `\Uauth-flow` survives sed → after `s/-/ /` becomes `\Uauth flow` → awk capitalizes first char of each word but `\` is already not lowercase so result is `\Uauth Flow`). Test 4 is platform-stable because it bypasses sed entirely.

CASE 6 is a permanent regression guard. The RED proof on the executor's Linux box may be limited (only Test 2 is fragile on GNU sed; the others may already be GREEN). Test 4 is the BSD-equivalence proof — it holds on any POSIX platform regardless of which sed dialect the host uses, satisfying the verification report's BSD-portability requirement without needing macOS hardware.

```bash
# NOTE: on GNU sed, the current (broken) regen-requirements.sh:105 may
# produce output that already passes Tests 1 + 3 (GNU correctly expands \U)
# and accidentally passes Test 2 (the dash→space + awk word-cap chain
# happens to produce the right result via different intermediate steps).
# Test 4 is the standalone-pipeline portability proof — it bypasses
# regen-requirements.sh and asserts BSD-equivalence by construction
# (tr + awk are POSIX-mandated, identical on BSD and GNU). After the
# awk-only fix lands, ALL four sub-tests pass on every POSIX platform
# and CASE 6 serves as a permanent regression guard.
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
    - `! grep -q '\\U' scripts/regen-requirements.sh` succeeds (no literal `\U` escape anywhere in the file — including comments, since the post-fix script should not reference the GNU-only escape at all).
    - `grep -c "tr '-' ' '" scripts/regen-requirements.sh` returns 1 (the new tr-based pipeline is present).
    - `bash -n scripts/regen-requirements.sh` exits 0.
    - The replacement is on the same logical line(s) as the original (no other parts of the script touched).
    - **(Warning #3 closure)** CASE 6 includes a standalone-pipeline assertion that produces 'Auth Flow' from 'auth-flow' using only tr and awk (POSIX-portable, BSD-equivalent by construction).
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
   - `bash tests/install-tests/settings-merge.test.sh` exits 0 with all CASES 1-5 + CASE 6 (sub-assertions 6a/6b/6c/6d) passing.
   - `bash -n install.sh` exits 0.
   - Manual smoke: `bash install.sh` (in a sandbox / dry-run) followed by
     `jq -r '[.. | .command? // empty] | .[]' ~/.claude/settings.json | grep -c CLAUDE_PROJECT_DIR` returns 0.
   - `git diff -- settings.fragment.json` is empty.

2. **Gap 2 closed:**
   - `bash tests/hook-tests/regen-requirements.test.sh` exits 0 with all 6 CASES passing.
   - `bash -n scripts/regen-requirements.sh` exits 0.
   - `! grep -q '\\U' scripts/regen-requirements.sh` succeeds.

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
- [ ] tests/install-tests/settings-merge.test.sh CASE 6 (a/b/c/d) passes.
- [ ] scripts/regen-requirements.sh:105 uses `tr '-' ' ' | awk '...'` (no sed `\U`).
- [ ] tests/hook-tests/regen-requirements.test.sh CASE 6 passes (including the standalone-pipeline assertion).
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
  regen-requirements.sh, ~50 lines added to settings-merge.test.sh
  (sandboxed end-to-end CASE 6 with 4 sub-assertions),
  ~50 lines added to regen-requirements.test.sh (CASE 6 with 4 sub-assertions
  including standalone-pipeline portability proof).
- Patterns established: in-flight `sed` substitution for placeholder paths
  before jq deep-merge (reusable for any future placeholder-bearing
  fragment); portable `tr | awk` Title-Case capitalization (reusable
  for any future macOS-portable shell capitalization need); end-to-end
  install.sh sandbox testing via $HOME redirection (reusable for any
  future install.sh-related regression test).
- No new external dependencies, no new files outside `files_modified`,
  no decisions deferred.
- Suggest re-running `/gsd-verify-phase 02-build-the-layer` to flip
  the score from 11/13 to 13/13.
</output>
</output>
