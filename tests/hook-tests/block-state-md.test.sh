#!/usr/bin/env bash
# Test suite for hooks/block-state-md.sh
# 30 cases: 20 from Spike 001 + 8 narrative-allow (REQ-07) + 2 edge cases
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BLOCK_HOOK="$REPO_ROOT/hooks/block-state-md.sh"

if [ ! -f "$BLOCK_HOOK" ]; then
  echo "ERROR: $BLOCK_HOOK not found"
  exit 1
fi

FAKE_ROOT="/work/fake-gsd-project"

# Tests must simulate a beads-managed project root; the hook now passes
# through when no .beads/ exists at the project root (so the global-
# installed hook doesn't fire on plain GSD projects). We construct a real
# temp dir with .beads/ and pass it as the payload's cwd.
BEADS_PROJECT=$(mktemp -d)
mkdir -p "$BEADS_PROJECT/.beads"
NON_BEADS_PROJECT=$(mktemp -d)
trap 'rm -rf "$BEADS_PROJECT" "$NON_BEADS_PROJECT"' EXIT

pass=0
fail=0

# ---------- helper: run one PreToolUse(Edit|Write) test ----------
run_block_test() {
  local name="$1"; local tool="$2"; local file_path="$3"; local expect="$4"
  # expect: "deny" or "allow"

  local payload
  payload=$(jq -n \
    --arg tool "$tool" \
    --arg file_path "$file_path" \
    --arg cwd "$BEADS_PROJECT" \
    '{
      session_id: "test-runner",
      transcript_path: "/tmp/x.jsonl",
      cwd: $cwd,
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

  local status
  if [ "$got" = "$expect" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi

  printf '  [%s] %-52s tool=%-5s expect=%-5s got=%s\n' "$status" "$name" "$tool" "$expect" "$got"
}

echo "=== Suite: block-state-md.sh (30 cases) ==="

echo ""
echo "--- DENY ABS (10 cases) ---"
# CASE 01-04: Edit on absolute-path state-bearing files → deny
run_block_test "CASE01-deny-edit-roadmap"        "Edit"  "$FAKE_ROOT/.planning/ROADMAP.md"               "deny"
run_block_test "CASE02-deny-edit-requirements"   "Edit"  "$FAKE_ROOT/.planning/REQUIREMENTS.md"          "deny"
run_block_test "CASE03-deny-edit-todo"           "Edit"  "$FAKE_ROOT/.planning/todos/pending/foo.md"     "deny"
run_block_test "CASE04-deny-edit-seed"           "Edit"  "$FAKE_ROOT/.planning/seeds/idea.md"            "deny"
# CASE 05-08: Write on absolute-path state-bearing files → deny
run_block_test "CASE05-deny-write-roadmap"       "Write" "$FAKE_ROOT/.planning/ROADMAP.md"               "deny"
run_block_test "CASE06-deny-write-requirements"  "Write" "$FAKE_ROOT/.planning/REQUIREMENTS.md"          "deny"
run_block_test "CASE07-deny-write-todo"          "Write" "$FAKE_ROOT/.planning/todos/pending/foo.md"     "deny"
run_block_test "CASE08-deny-write-seed"          "Write" "$FAKE_ROOT/.planning/seeds/idea.md"            "deny"
# CASE 09-10: Deeper absolute paths
run_block_test "CASE09-deny-deep-nested-roadmap" "Edit"  "/deep/nested/proj/.planning/ROADMAP.md"        "deny"
run_block_test "CASE10-deny-spaces-in-path"      "Edit"  "$FAKE_ROOT/.planning/todos/pending/some idea.md" "deny"

echo ""
echo "--- DENY REL (10 cases) ---"
# CASE 11-18: Relative path forms (Spike 001 iter-2 regression guard)
run_block_test "CASE11-deny-rel-edit-roadmap"    "Edit"  ".planning/ROADMAP.md"                          "deny"
run_block_test "CASE12-deny-rel-edit-reqs"       "Edit"  ".planning/REQUIREMENTS.md"                     "deny"
run_block_test "CASE13-deny-rel-edit-todo"       "Edit"  ".planning/todos/pending/foo.md"                "deny"
run_block_test "CASE14-deny-rel-edit-seed"       "Edit"  ".planning/seeds/idea.md"                       "deny"
run_block_test "CASE15-deny-rel-write-roadmap"   "Write" ".planning/ROADMAP.md"                          "deny"
run_block_test "CASE16-deny-rel-write-reqs"      "Write" ".planning/REQUIREMENTS.md"                     "deny"
run_block_test "CASE17-deny-rel-write-todo"      "Write" ".planning/todos/pending/foo.md"                "deny"
run_block_test "CASE18-deny-rel-write-seed"      "Write" ".planning/seeds/idea.md"                       "deny"
# CASE 19-20: Deeply nested absolute paths
run_block_test "CASE19-deny-nested-todo"         "Edit"  "$FAKE_ROOT/.planning/todos/deeply/nested/file.md" "deny"
run_block_test "CASE20-deny-nested-seed"         "Edit"  "$FAKE_ROOT/.planning/seeds/some/nested/seed.md"   "deny"

echo ""
echo "--- ALLOW NARRATIVE / REQ-07 (8 cases) ---"
# CASE 21-28: Narrative markdown must NOT be blocked (REQ-07)
run_block_test "CASE21-allow-plan-md"            "Edit"  "$FAKE_ROOT/.planning/phases/01-x/01-PLAN.md"           "allow"
run_block_test "CASE22-allow-research-md"        "Edit"  "$FAKE_ROOT/.planning/phases/01-x/01-RESEARCH.md"       "allow"
run_block_test "CASE23-allow-ai-spec"            "Edit"  "$FAKE_ROOT/.planning/phases/01-x/01-AI-SPEC.md"        "allow"
run_block_test "CASE24-allow-ui-spec"            "Edit"  "$FAKE_ROOT/.planning/phases/01-x/01-UI-SPEC.md"        "allow"
run_block_test "CASE25-allow-discussion-log"     "Edit"  "$FAKE_ROOT/.planning/phases/01-x/01-DISCUSSION-LOG.md" "allow"
run_block_test "CASE26-allow-source-ts"          "Edit"  "$FAKE_ROOT/src/index.ts"                               "allow"
run_block_test "CASE27-allow-readme"             "Edit"  "$FAKE_ROOT/README.md"                                  "allow"
run_block_test "CASE28-allow-claude-md"          "Edit"  "$FAKE_ROOT/CLAUDE.md"                                  "allow"

echo ""
echo "--- EDGE CASES (2 cases) ---"
# CASE 29: Path traversal (T-02-01) — ../../escape/.planning/ROADMAP.md
# Matches */.planning/ROADMAP.md pattern — deny is SAFE (we are writing, not reading)
run_block_test "CASE29-path-traversal-deny"      "Edit"  "../../escape/.planning/ROADMAP.md"             "deny"
# CASE 30: missing file_path → silent allow
empty_payload='{"session_id":"test","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{}}'
empty_stdout=$(printf '%s' "$empty_payload" | "$BLOCK_HOOK" 2>/dev/null) || true
if [ -z "$empty_stdout" ]; then
  echo "  [PASS] CASE30-missing-file-path                          → allow (silent)"
  pass=$((pass+1))
else
  echo "  [FAIL] CASE30-missing-file-path expected silent allow, got: $empty_stdout"
  fail=$((fail+1))
fi

echo ""
echo "--- NON-BEADS PROJECT GUARD (3 cases) ---"
# CASE 31-33: When cwd has no .beads/, the hook must pass through. This
# guards the global-install bug where ~/.claude/hooks/block-state-md.sh
# fired on every project including plain GSD projects without beads.
run_non_beads_test() {
  local name="$1"; local file_path="$2"
  local payload
  payload=$(jq -n \
    --arg file_path "$file_path" \
    --arg cwd "$NON_BEADS_PROJECT" \
    '{
      session_id: "test-runner",
      transcript_path: "/tmp/x.jsonl",
      cwd: $cwd,
      permission_mode: "default",
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: $file_path, content: "anything" },
      tool_use_id: "toolu_test"
    }')
  # Ensure CLAUDE_PROJECT_DIR doesn't override our cwd-based detection
  local stdout
  stdout=$(printf '%s' "$payload" | env -u CLAUDE_PROJECT_DIR "$BLOCK_HOOK" 2>/dev/null) || true
  local got
  if [ -z "$stdout" ]; then got="allow"; else got=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecision // "allow"'); fi
  local status; if [ "$got" = "allow" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
  printf '  [%s] %-52s expect=allow got=%s\n' "$status" "$name" "$got"
}
run_non_beads_test "CASE31-non-beads-roadmap-allows"    "$FAKE_ROOT/.planning/ROADMAP.md"
run_non_beads_test "CASE32-non-beads-todo-allows"       "$FAKE_ROOT/.planning/todos/pending/foo.md"
run_non_beads_test "CASE33-non-beads-rel-roadmap-allow" ".planning/ROADMAP.md"

echo ""
total=$((pass+fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
