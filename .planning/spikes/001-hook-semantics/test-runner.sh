#!/usr/bin/env bash
# Test harness for spike 001.
#
# Drives synthetic Claude Code hook payloads through the two hook scripts and
# asserts the right decisions come out. Writes results/results.json (consumed
# by view.html) and prints a summary table.
set -uo pipefail

cd "$(dirname "$0")"

BLOCK_HOOK="./hooks/block-state-md.sh"
SYNC_HOOK="./hooks/bd-sync.sh"
RESULTS_JSON="./results/results.json"

# Marker file for bd-sync tests
MARKER="$(mktemp)"
export BD_SYNC_MARKER="$MARKER"

# Project root used in synthetic file_paths (a fake GSD project shipped with the spike)
FAKE_ROOT="$(pwd)/fixtures/fake-gsd-project"

pass=0
fail=0
results='[]'

# ---------- helper: run one PreToolUse(Edit|Write) test ----------
run_block_test() {
  local name="$1"; local tool="$2"; local file_path="$3"; local expect="$4"
  # expect: "deny" or "allow"

  local payload
  payload=$(jq -n \
    --arg tool "$tool" \
    --arg file_path "$file_path" \
    '{
      session_id: "spike-test",
      transcript_path: "/tmp/x.jsonl",
      cwd: "/tmp",
      permission_mode: "default",
      hook_event_name: "PreToolUse",
      tool_name: $tool,
      tool_input: { file_path: $file_path, content: "anything" },
      tool_use_id: "toolu_test"
    }')

  local stdout
  stdout=$(printf '%s' "$payload" | "$BLOCK_HOOK" 2>/dev/null) || true

  local got
  if [ -z "$stdout" ]; then
    got="allow"
  else
    got=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecision // "allow"')
  fi

  local reason
  reason=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecisionReason // ""' 2>/dev/null || echo "")

  local status
  if [ "$got" = "$expect" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi

  results=$(printf '%s' "$results" | jq \
    --arg suite "block-state-md" \
    --arg name "$name" \
    --arg tool "$tool" \
    --arg fp "$file_path" \
    --arg expect "$expect" \
    --arg got "$got" \
    --arg reason "$reason" \
    --arg status "$status" \
    '. += [{suite:$suite,name:$name,tool:$tool,file_path:$fp,expect:$expect,got:$got,reason:$reason,status:$status}]')

  printf '  [%s] %-48s tool=%-5s expect=%-5s got=%-5s\n' "$status" "$name" "$tool" "$expect" "$got"
}

# ---------- helper: run one PostToolUse(bd-sync) test ----------
run_sync_test() {
  local name="$1"; local command="$2"; local expect_fired="$3"
  # expect_fired: "yes" (script should append a line) or "n/a"

  : > "$MARKER"  # truncate

  local payload
  payload=$(jq -n \
    --arg cmd "$command" \
    '{
      session_id: "spike-test",
      transcript_path: "/tmp/x.jsonl",
      cwd: "/tmp",
      permission_mode: "default",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: $cmd, description: "test" },
      tool_response: { stdout: "", stderr: "", interrupted: false },
      tool_use_id: "toolu_test",
      duration_ms: 1
    }')

  printf '%s' "$payload" | "$SYNC_HOOK" 2>/dev/null || true

  local lines; lines=$(wc -l < "$MARKER" | tr -d ' ')
  local fired; if [ "$lines" -ge 1 ]; then fired="yes"; else fired="no"; fi

  local status
  if [ "$fired" = "$expect_fired" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi

  results=$(printf '%s' "$results" | jq \
    --arg suite "bd-sync" \
    --arg name "$name" \
    --arg cmd "$command" \
    --arg expect "$expect_fired" \
    --arg got "$fired" \
    --arg status "$status" \
    '. += [{suite:$suite,name:$name,command:$cmd,expect:$expect,got:$got,status:$status}]')

  printf '  [%s] %-48s cmd="%s" fired=%s\n' "$status" "$name" "$command" "$fired"
}

# ---------- helper: 'if' filter simulation ----------
# The 'if: "Bash(bd *)"' filter is enforced by Claude Code itself before the
# hook script runs. We simulate that here so the test reflects the
# end-to-end outcome the agent will see.
matches_bd_filter() {
  case "$1" in
    "bd "*) return 0 ;;
    *) return 1 ;;
  esac
}

run_filtered_sync_test() {
  local name="$1"; local command="$2"; local expect_fired="$3"
  : > "$MARKER"
  if matches_bd_filter "$command"; then
    run_sync_test "$name" "$command" "$expect_fired"
  else
    # 'if' filter rejects → script never runs → marker stays empty
    local lines; lines=$(wc -l < "$MARKER" | tr -d ' ')
    local fired; if [ "$lines" -ge 1 ]; then fired="yes"; else fired="no"; fi
    local status; if [ "$fired" = "$expect_fired" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
    results=$(printf '%s' "$results" | jq \
      --arg suite "bd-sync (if-filter)" \
      --arg name "$name" \
      --arg cmd "$command" \
      --arg expect "$expect_fired" \
      --arg got "$fired" \
      --arg status "$status" \
      '. += [{suite:$suite,name:$name,command:$cmd,expect:$expect,got:$got,status:$status}]')
    printf '  [%s] %-48s cmd="%s" fired=%s (filtered out by `if`)\n' "$status" "$name" "$command" "$fired"
  fi
}

echo "=== Suite 1: block-state-md.sh (PreToolUse on Edit|Write) ==="
run_block_test "block-edit-roadmap"          "Edit"  "$FAKE_ROOT/.planning/ROADMAP.md"               "deny"
run_block_test "block-edit-requirements"     "Edit"  "$FAKE_ROOT/.planning/REQUIREMENTS.md"          "deny"
run_block_test "block-edit-todo"             "Edit"  "$FAKE_ROOT/.planning/todos/pending/foo.md"     "deny"
run_block_test "block-edit-seed"             "Edit"  "$FAKE_ROOT/.planning/seeds/idea.md"            "deny"
run_block_test "block-write-roadmap"         "Write" "$FAKE_ROOT/.planning/ROADMAP.md"               "deny"
run_block_test "allow-edit-narrative-plan"   "Edit"  "$FAKE_ROOT/.planning/phase-1/PLAN.md"          "allow"
run_block_test "allow-edit-narrative-research" "Edit" "$FAKE_ROOT/.planning/phase-1/RESEARCH.md"     "allow"
run_block_test "allow-edit-source"           "Edit"  "$FAKE_ROOT/src/index.ts"                       "allow"
run_block_test "allow-edit-readme"           "Edit"  "$FAKE_ROOT/README.md"                          "allow"
run_block_test "block-relative-roadmap"      "Edit"  ".planning/ROADMAP.md"                          "deny"
run_block_test "block-relative-todo"         "Write" ".planning/todos/pending/foo.md"                "deny"
run_block_test "block-spaces-in-path"        "Edit"  "$FAKE_ROOT/.planning/todos/pending/some idea.md" "deny"

echo ""
echo "=== Suite 2: bd-sync.sh (PostToolUse on Bash with if=\"Bash(bd *)\") ==="
run_filtered_sync_test "fires-on-bd-list"        "bd list"                "yes"
run_filtered_sync_test "fires-on-bd-create"      "bd create -t task --title hello"  "yes"
run_filtered_sync_test "fires-on-bd-export"      "bd export -o issues.jsonl"        "yes"
run_filtered_sync_test "fires-on-bd-with-flags"  "bd ready --json"                  "yes"
run_filtered_sync_test "skips-on-non-bd"         "ls -la"                            "no"
run_filtered_sync_test "skips-on-grep"           "grep -r foo ."                     "no"
run_filtered_sync_test "skips-on-bd-substring"   "echo bd not at start"              "no"

echo ""
echo "=== Suite 3: high-volume reliability (50 fires) ==="
: > "$MARKER"
volume_count=0
for i in $(seq 1 50); do
  payload=$(jq -n --arg cmd "bd list --iter $i" '{
    session_id:"vol", transcript_path:"x", cwd:"/tmp", permission_mode:"default",
    hook_event_name:"PostToolUse", tool_name:"Bash",
    tool_input:{command:$cmd, description:"vol"},
    tool_response:{stdout:"",stderr:"",interrupted:false},
    tool_use_id:"t", duration_ms:1
  }')
  printf '%s' "$payload" | "$SYNC_HOOK" 2>/dev/null || true
  volume_count=$((volume_count+1))
done
got_lines=$(wc -l < "$MARKER" | tr -d ' ')
if [ "$got_lines" = "50" ]; then
  vol_status="PASS"; pass=$((pass+1))
else
  vol_status="FAIL"; fail=$((fail+1))
fi
results=$(printf '%s' "$results" | jq \
  --arg status "$vol_status" \
  --arg got "$got_lines" \
  '. += [{suite:"reliability",name:"50-fires-all-recorded",expect:"50",got:$got,status:$status}]')
printf '  [%s] 50-fires-all-recorded                    expect=50 got=%s\n' "$vol_status" "$got_lines"

echo ""
echo "=== Summary ==="
total=$((pass+fail))
echo "Passed: $pass / $total"
echo "Failed: $fail / $total"

# Write structured results
mkdir -p ./results
printf '%s' "$results" | jq --arg passed "$pass" --arg failed "$fail" --arg total "$total" '{
  passed: ($passed | tonumber),
  failed: ($failed | tonumber),
  total: ($total | tonumber),
  generated_at: now | todate,
  cases: .
}' > "$RESULTS_JSON"

echo ""
echo "Wrote $RESULTS_JSON"
echo "Open view.html in a browser to see the visual report."

# Exit non-zero if any test failed
[ "$fail" -eq 0 ]
