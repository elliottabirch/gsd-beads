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

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
