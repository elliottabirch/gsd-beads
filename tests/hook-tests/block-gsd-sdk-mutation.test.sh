#!/usr/bin/env bash
# Test suite for hooks/block-gsd-sdk-mutation.sh
# 43 cases verbatim from Spike 012 test-runner.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/hooks/block-gsd-sdk-mutation.sh"

if [ ! -f "$HOOK" ]; then
  echo "ERROR: $HOOK not found"
  exit 1
fi

# The hook now passes through when the project root has no .beads/ — that
# guards the global-install case where it would otherwise fire on every
# project. Tests construct a real temp dir with .beads/ to exercise the
# state-bearing branch and a separate dir without .beads/ for the guard.
BEADS_PROJECT=$(mktemp -d)
mkdir -p "$BEADS_PROJECT/.beads"
NON_BEADS_PROJECT=$(mktemp -d)
trap 'rm -rf "$BEADS_PROJECT" "$NON_BEADS_PROJECT"' EXIT

pass=0
fail=0

run_test() {
  local name="$1"; local cmd="$2"; local expect="$3"
  # expect: "deny" or "allow"

  local payload
  payload=$(jq -n \
    --arg cmd "$cmd" \
    --arg cwd "$BEADS_PROJECT" \
    '{
      session_id: "spike12",
      transcript_path: "/tmp/x.jsonl",
      cwd: $cwd,
      permission_mode: "default",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: $cmd, description: "test" },
      tool_use_id: "toolu_test"
    }')

  local stdout
  stdout=$(printf '%s' "$payload" | env -u CLAUDE_PROJECT_DIR "$HOOK" 2>/dev/null) || true

  local got
  if [ -z "$stdout" ]; then
    got="allow"
  else
    got=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecision // "allow"')
  fi

  local status
  if [ "$got" = "$expect" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi

  printf '  [%s] %-40s expect=%-5s got=%-5s "%s"\n' "$status" "$name" "$expect" "$got" "$cmd"
}

echo "=== State-bearing mutations: should DENY ==="
# phase.* (ROADMAP.md)
run_test "deny-phase.add"               "gsd-sdk query phase.add 'Phase 5: New feature'"            "deny"
run_test "deny-phase add (space alias)" "gsd-sdk query phase add 'Phase 5'"                         "deny"
run_test "deny-phase.add-batch"         "gsd-sdk query phase.add-batch --json @phases.json"         "deny"
run_test "deny-phase add-batch alias"   "gsd-sdk query phase add-batch --json @phases.json"         "deny"
run_test "deny-phase.insert"            "gsd-sdk query phase.insert --after 2 'Critical fix'"       "deny"
run_test "deny-phase insert alias"      "gsd-sdk query phase insert --after 2 'Critical fix'"       "deny"
run_test "deny-phase.remove"            "gsd-sdk query phase.remove 5"                              "deny"
run_test "deny-phase remove alias"      "gsd-sdk query phase remove 5"                              "deny"
run_test "deny-phase.complete"          "gsd-sdk query phase.complete 3"                            "deny"
run_test "deny-phase complete alias"    "gsd-sdk query phase complete 3"                            "deny"
run_test "deny-phase.scaffold"          "gsd-sdk query phase.scaffold 5"                            "deny"
run_test "deny-phase scaffold alias"    "gsd-sdk query phase scaffold 5"                            "deny"

# phases.* (ROADMAP.md)
run_test "deny-phases.clear"            "gsd-sdk query phases.clear --confirm"                      "deny"
run_test "deny-phases.archive"          "gsd-sdk query phases.archive 1-4 --milestone v1.0"         "deny"

# roadmap.* (ROADMAP.md)
run_test "deny-roadmap.update-plan"     "gsd-sdk query roadmap.update-plan-progress --plan 03-02 --status complete"  "deny"
run_test "deny-roadmap update alias"    "gsd-sdk query roadmap update-plan-progress --plan 03-02"   "deny"
run_test "deny-roadmap.annotate"        "gsd-sdk query roadmap.annotate-dependencies"               "deny"

# requirements.* (REQUIREMENTS.md)
run_test "deny-requirements.mark"       "gsd-sdk query requirements.mark-complete AUTH-01"          "deny"
run_test "deny-requirements mark alias" "gsd-sdk query requirements mark-complete AUTH-01"          "deny"

# todo.* (.planning/todos/)
run_test "deny-todo.complete"           "gsd-sdk query todo.complete TODO-042"                      "deny"
run_test "deny-todo complete alias"     "gsd-sdk query todo complete TODO-042"                      "deny"

# milestone.complete (dual: ROADMAP + REQUIREMENTS)
run_test "deny-milestone.complete"      "gsd-sdk query milestone.complete v1.0"                     "deny"
run_test "deny-milestone alias"         "gsd-sdk query milestone complete v1.0"                     "deny"

echo ""
echo "=== Read-only queries: should ALLOW ==="
run_test "allow-list.todos"             "gsd-sdk query list.todos --json"                           "allow"
run_test "allow-progress"               "gsd-sdk query progress"                                    "allow"
run_test "allow-config-get"             "gsd-sdk query config-get commit_docs"                      "allow"
run_test "allow-audit-open"             "gsd-sdk query audit-open --json"                           "allow"
run_test "allow-decisions"              "gsd-sdk query decisions"                                   "allow"

echo ""
echo "=== Non-state-bearing mutations: should ALLOW (we only block state-bearing) ==="
run_test "allow-state.update"           "gsd-sdk query state.update --phase 3"                      "allow"
run_test "allow-state.patch"            "gsd-sdk query state.patch --field foo"                     "allow"
run_test "allow-frontmatter.set"        "gsd-sdk query frontmatter.set PLAN.md status active"       "allow"
run_test "allow-config-set"             "gsd-sdk query config-set commit_docs true"                 "allow"
run_test "allow-commit"                 "gsd-sdk query commit 'docs: update'"                       "allow"
run_test "allow-template.fill"          "gsd-sdk query template.fill plan 03-02"                    "allow"
run_test "allow-workstream.create"      "gsd-sdk query workstream.create feature-x"                 "allow"
run_test "allow-intel.snapshot"         "gsd-sdk query intel.snapshot"                              "allow"

echo ""
echo "=== Non-gsd-sdk Bash calls: should ALLOW (hook only fires under if-filter) ==="
# These wouldn't actually reach this script in real Claude Code (the
# `if: 'Bash(gsd-sdk *)'` filter would skip them) but the script must
# pass through cleanly if invoked outside that filter.
run_test "allow-ls"                     "ls -la"                                                    "allow"
run_test "allow-bd-list"                "bd list"                                                   "allow"
run_test "allow-grep"                   "grep -r foo ."                                             "allow"

echo ""
echo "=== Edge cases ==="
run_test "allow-gsd-sdk-no-query"       "gsd-sdk init"                                              "allow"
run_test "allow-gsd-sdk-help"           "gsd-sdk --help"                                            "allow"
run_test "allow-gsd-sdk-with-flags"     "gsd-sdk --project-dir /x query progress"                   "allow"
run_test "deny-with-flags"              "gsd-sdk --project-dir /x query phase.add 'New phase'"      "deny"

echo ""
echo "=== Non-beads project guard: should ALLOW (regression for global-install bug) ==="
# When the hook is registered globally in ~/.claude/settings.json it fires
# in every project. These cases would otherwise hit the deny-list, but with
# no .beads/ at the project root the hook must pass through.
run_non_beads_test() {
  local name="$1"; local cmd="$2"
  local payload
  payload=$(jq -n \
    --arg cmd "$cmd" \
    --arg cwd "$NON_BEADS_PROJECT" \
    '{
      session_id: "spike12",
      transcript_path: "/tmp/x.jsonl",
      cwd: $cwd,
      permission_mode: "default",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: $cmd, description: "test" },
      tool_use_id: "toolu_test"
    }')
  local stdout
  stdout=$(printf '%s' "$payload" | env -u CLAUDE_PROJECT_DIR "$HOOK" 2>/dev/null) || true
  local got
  if [ -z "$stdout" ]; then got="allow"; else got=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecision // "allow"'); fi
  local status; if [ "$got" = "allow" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
  printf '  [%s] %-40s expect=allow got=%-5s "%s"\n' "$status" "$name" "$got" "$cmd"
}
run_non_beads_test "non-beads-phase.add"            "gsd-sdk query phase.add 'Phase 5: New feature'"
run_non_beads_test "non-beads-roadmap.update-plan"  "gsd-sdk query roadmap.update-plan-progress --plan 81-01 --status complete"
run_non_beads_test "non-beads-milestone.complete"   "gsd-sdk query milestone.complete v1.0"

echo ""
echo "=== Summary ==="
total=$((pass+fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
