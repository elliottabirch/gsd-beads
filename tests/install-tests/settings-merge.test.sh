#!/usr/bin/env bash
# settings-merge.test.sh — deep-merge dedup correctness (Pitfall 6 + W6 fix)
# Tests all 5 settings.json deep-merge cases including W6 CASE 5 (different-matchers).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
FRAGMENT="$REPO_ROOT/settings.fragment.json"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# Helper: run the deep-merge jq transform on two json files, output to stdout
# Concatenates hook arrays across event keys (not replace), then groups by matcher and deduplicates
# within each matcher by (command, if) key.
deep_merge() {
  local existing="$1" frag="$2"
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
' "$existing" "$frag"
}

# CASE 1: empty existing settings.json + fragment -> fragment becomes the entire hooks block
existing1="$(mktemp)"
echo '{}' > "$existing1"
result1="$(deep_merge "$existing1" "$FRAGMENT")"
rm -f "$existing1"
# Fragment has 3 hook entries across 3 matchers: PreToolUse(Edit|Write), PreToolUse(Bash), PostToolUse(Bash)
pre_count1="$(echo "$result1" | jq '[.hooks.PreToolUse[].hooks[]] | length')"
post_count1="$(echo "$result1" | jq '[.hooks.PostToolUse[].hooks[]] | length')"
if [ "$pre_count1" = "2" ] && [ "$post_count1" = "1" ]; then
  _pass "CASE 1: empty + fragment = 2 PreToolUse hooks + 1 PostToolUse hook"
else
  _fail "CASE 1: expected pre=2 post=1, got pre=$pre_count1 post=$post_count1"
fi

# CASE 2: existing has different hooks (no overlap) -> both sets present after merge
existing2="$(mktemp)"
cat > "$existing2" <<'ENDJSON'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/local/bin/my-read-hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
ENDJSON
result2="$(deep_merge "$existing2" "$FRAGMENT")"
rm -f "$existing2"
# After merge, PreToolUse should have 3 matchers: Read (existing), Edit|Write, Bash (from fragment)
pre_matcher_count2="$(echo "$result2" | jq '.hooks.PreToolUse | length')"
if [ "$pre_matcher_count2" = "3" ]; then
  _pass "CASE 2: no-overlap merge retains all 3 PreToolUse matcher groups"
else
  _fail "CASE 2: expected 3 PreToolUse matcher groups, got $pre_matcher_count2"
fi

# CASE 3: partial overlap (existing has same matcher, different command) -> both retained, no dedup
existing3="$(mktemp)"
cat > "$existing3" <<'ENDJSON'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/some/other/hook.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
ENDJSON
result3="$(deep_merge "$existing3" "$FRAGMENT")"
rm -f "$existing3"
# Same matcher "Edit|Write", different commands — both should be retained (dedup key is command+if)
ew_hook_count3="$(echo "$result3" | jq '[.hooks.PreToolUse[] | select(.matcher=="Edit|Write") | .hooks[]] | length')"
if [ "$ew_hook_count3" = "2" ]; then
  _pass "CASE 3: partial overlap retains both hooks for Edit|Write matcher (command differs)"
else
  _fail "CASE 3: expected 2 hooks for Edit|Write after partial overlap, got $ew_hook_count3"
fi

# CASE 4: full conflict (same matcher + command + if) -> deduped to one entry
existing4="$(mktemp)"
# Use the exact same entry as the fragment's block-state-md hook
cat > "$existing4" <<'ENDJSON'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
ENDJSON
result4="$(deep_merge "$existing4" "$FRAGMENT")"
rm -f "$existing4"
ew_hook_count4="$(echo "$result4" | jq '[.hooks.PreToolUse[] | select(.matcher=="Edit|Write") | .hooks[]] | length')"
if [ "$ew_hook_count4" = "1" ]; then
  _pass "CASE 4: full conflict deduped to 1 entry for Edit|Write matcher"
else
  _fail "CASE 4: expected 1 deduped hook for Edit|Write, got $ew_hook_count4"
fi

# CASE 5 (W6 fix): same command + same `if` filter, but DIFFERENT matchers -> both retained (no merge)
# Hook entry: command=/foo/bar.sh, if=Bash(*) under PreToolUse Edit|Write vs PostToolUse Bash
existing5="$(mktemp)"
cat > "$existing5" <<'ENDJSON'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/foo/bar.sh",
            "if": "Bash(*)",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
ENDJSON
frag5="$(mktemp)"
cat > "$frag5" <<'ENDJSON'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/foo/bar.sh",
            "if": "Bash(*)",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
ENDJSON
result5="$(deep_merge "$existing5" "$frag5")"
rm -f "$existing5" "$frag5"
# PreToolUse Edit|Write hook retained (1 entry), PostToolUse Bash hook also present (1 entry)
pre_count5="$(echo "$result5" | jq '[.hooks.PreToolUse[] | select(.matcher=="Edit|Write") | .hooks[]] | length')"
post_count5="$(echo "$result5" | jq '[.hooks.PostToolUse[] | select(.matcher=="Bash") | .hooks[]] | length')"
if [ "$pre_count5" = "1" ] && [ "$post_count5" = "1" ]; then
  _pass "CASE 5 (W6): different-matchers both retained (pre=$pre_count5, post=$post_count5)"
else
  _fail "CASE 5 (W6): expected pre=1 post=1 (different matchers), got pre=$pre_count5 post=$post_count5"
fi

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

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
