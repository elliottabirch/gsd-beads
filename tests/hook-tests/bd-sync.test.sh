#!/usr/bin/env bash
# Test suite for hooks/bd-sync.sh
# 17 cases: 7 Spike 001 parity + 8 read-only filter + 2 cascade-fired
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYNC_HOOK="$REPO_ROOT/hooks/bd-sync.sh"

if [ ! -f "$SYNC_HOOK" ]; then
  echo "ERROR: $SYNC_HOOK not found"
  exit 1
fi

pass=0
fail=0

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

# ---------- helper: run a Bash PostToolUse payload ----------
run_bd_payload() {
  local cmd="$1"
  local payload
  payload=$(jq -n \
    --arg cmd "$cmd" \
    '{
      session_id: "test-runner",
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
}

# ---------- helper: run a Bash PostToolUse payload, propagating exit ----------
# WR-03 fix: run_bd_payload swallows the hook's exit via `|| true`, so any
# `rc=$?` assertion against it is a tautology. Use this strict variant when
# the test needs to observe the hook's actual exit code (e.g. CASE 18's
# fail-soft contract: the hook must return 0 even when cascade exits 1).
run_bd_payload_strict() {
  local cmd="$1"
  local payload
  payload=$(jq -n \
    --arg cmd "$cmd" \
    '{
      session_id: "test-runner",
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
  printf '%s' "$payload" | "$SYNC_HOOK" 2>/dev/null
  return $?
}

# ---------- helper: build stub scripts in tmpdir ----------
make_stubs() {
  local tmpdir="$1"
  # cascade-loop stub
  cat > "$tmpdir/cascade-loop.sh" <<'STUB'
#!/usr/bin/env bash
touch "${CASCADE_MARKER:-/tmp/cascade-stub-fired}"
STUB
  chmod +x "$tmpdir/cascade-loop.sh"
  # regen-roadmap stub
  cat > "$tmpdir/regen-roadmap.sh" <<'STUB'
#!/usr/bin/env bash
touch "${REGEN_ROADMAP_MARKER:-/tmp/regen-roadmap-stub-fired}"
STUB
  chmod +x "$tmpdir/regen-roadmap.sh"
  # regen-requirements stub
  cat > "$tmpdir/regen-requirements.sh" <<'STUB'
#!/usr/bin/env bash
touch "${REGEN_REQUIREMENTS_MARKER:-/tmp/regen-requirements-stub-fired}"
STUB
  chmod +x "$tmpdir/regen-requirements.sh"
}

# ---------- Spike 001 parity tests (Cases 1-7) ----------
# These use the if-filter simulation. Cases 1-4 fire the hook script (which
# internally reads SCRIPTS env to find stubs). Cases 5-7 are filtered by
# the `if: "Bash(bd *)"` filter simulation — script never runs.
echo "=== Suite: Spike 001 parity (7 cases) ==="

run_filtered_parity_test() {
  local name="$1"; local command="$2"; local expect_fired="$3"
  # For non-bd commands the if-filter prevents hook from running
  # For bd commands with read-only subcommands, the hook runs but skips regen
  # expect_fired: "yes" if the hook should run cascade/regen, "no" if not
  if ! matches_bd_filter "$command"; then
    # Filtered out — hook never runs
    local status; if [ "$expect_fired" = "no" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
    printf '  [%s] %-50s cmd="%s" (if-filter blocked, fired=no)\n' "$status" "$name" "$command"
  else
    # Hook runs — test via tmp dir
    local tmpdir
    tmpdir=$(mktemp -d)
    make_stubs "$tmpdir"
    local marker_c="$tmpdir/cascade.marker"
    export CASCADE_MARKER="$marker_c"
    export REGEN_ROADMAP_MARKER="$tmpdir/rr.marker"
    export REGEN_REQUIREMENTS_MARKER="$tmpdir/rreq.marker"
    export SCRIPTS="$tmpdir"
    run_bd_payload "$command"
    unset CASCADE_MARKER REGEN_ROADMAP_MARKER REGEN_REQUIREMENTS_MARKER SCRIPTS
    local fired="no"
    [ -f "$marker_c" ] && fired="yes"
    local status; if [ "$fired" = "$expect_fired" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
    printf '  [%s] %-50s cmd="%s" fired=%s\n' "$status" "$name" "$command" "$fired"
    rm -rf "$tmpdir"
  fi
}

# Note: Spike 001's CASES 1-4 used "bd list", "bd create ...", "bd export ...", "bd ready ..."
# In Phase 2, bd list/export/ready are READ-ONLY (filter skips cascade). However these cases
# verified the hook FIRES (i.e. the script is invoked). We test that "fires=yes" means
# hook is invoked, but for read-only, cascade is NOT invoked. Separate sub-tests for that.
# For parity with Spike 001: these cases test that non-bd commands don't fire at all.
run_filtered_parity_test "CASE01-skips-non-bd-ls"         "ls -la"                 "no"
run_filtered_parity_test "CASE02-skips-non-bd-grep"       "grep -r foo ."          "no"
run_filtered_parity_test "CASE03-skips-bd-substring"      "echo bd not at start"   "no"
# These bd commands have state-changing subcommands — cascade should fire
run_filtered_parity_test "CASE04-fires-bd-close"          "bd close abc-1"         "yes"
run_filtered_parity_test "CASE05-fires-bd-q"              "bd q 'New task' -t task" "yes"
run_filtered_parity_test "CASE06-fires-bd-label-add"      "bd label add abc-1 gsd:phase" "yes"
run_filtered_parity_test "CASE07-fires-bd-link"           "bd link x y --type parent-child" "yes"

echo ""
echo "=== Suite: Read-only filter (8 cases) ==="

# For each read-only bd command, hook script runs but cascade/regen must NOT fire
run_readonly_test() {
  local name="$1"; local command="$2"
  local tmpdir
  tmpdir=$(mktemp -d)
  make_stubs "$tmpdir"
  local marker_c="$tmpdir/cascade.marker"
  export CASCADE_MARKER="$marker_c"
  export REGEN_ROADMAP_MARKER="$tmpdir/rr.marker"
  export REGEN_REQUIREMENTS_MARKER="$tmpdir/rreq.marker"
  export SCRIPTS="$tmpdir"
  run_bd_payload "$command"
  unset CASCADE_MARKER REGEN_ROADMAP_MARKER REGEN_REQUIREMENTS_MARKER SCRIPTS
  local cascade_fired="no"
  [ -f "$marker_c" ] && cascade_fired="yes"
  local status; if [ "$cascade_fired" = "no" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
  printf '  [%s] %-50s cmd="%s" cascade_fired=%s\n' "$status" "$name" "$command" "$cascade_fired"
  rm -rf "$tmpdir"
}

run_readonly_test "CASE08-readonly-bd-list"       "bd list"
run_readonly_test "CASE09-readonly-bd-show"       "bd show abc-1"
run_readonly_test "CASE10-readonly-bd-ready"      "bd ready"
run_readonly_test "CASE11-readonly-bd-memories"   "bd memories"
run_readonly_test "CASE12-readonly-bd-status"     "bd status"
run_readonly_test "CASE13-readonly-bd-prime"      "bd prime"
run_readonly_test "CASE14-readonly-bd-export"     "bd export"
run_readonly_test "CASE15-readonly-bd-help"       "bd help"

echo ""
echo "=== Suite: Cascade-fired on state change (2 cases) ==="

run_state_change_test() {
  local name="$1"; local command="$2"
  local tmpdir
  tmpdir=$(mktemp -d)
  make_stubs "$tmpdir"
  local marker_c="$tmpdir/cascade.marker"
  local marker_rr="$tmpdir/rr.marker"
  local marker_rreq="$tmpdir/rreq.marker"
  export CASCADE_MARKER="$marker_c"
  export REGEN_ROADMAP_MARKER="$marker_rr"
  export REGEN_REQUIREMENTS_MARKER="$marker_rreq"
  export SCRIPTS="$tmpdir"
  run_bd_payload "$command"
  unset CASCADE_MARKER REGEN_ROADMAP_MARKER REGEN_REQUIREMENTS_MARKER SCRIPTS
  local cascade_fired="no"; [ -f "$marker_c" ] && cascade_fired="yes"
  local regen_fired="no"; [ -f "$marker_rr" ] && [ -f "$marker_rreq" ] && regen_fired="yes"
  local status
  if [ "$cascade_fired" = "yes" ] && [ "$regen_fired" = "yes" ]; then
    status="PASS"; pass=$((pass+1))
  else
    status="FAIL"; fail=$((fail+1))
  fi
  printf '  [%s] %-50s cmd="%s" cascade=%s regen=%s\n' "$status" "$name" "$command" "$cascade_fired" "$regen_fired"
  rm -rf "$tmpdir"
}

run_state_change_test "CASE16-cascade-fired-bd-close"  "bd close abc-1"
run_state_change_test "CASE17-cascade-fired-bd-q"      "bd q 'X' -t epic"

echo ""
echo "=== Suite: Flock-failure fail-soft (D-15, 1 case) ==="

# Proves bd-sync.sh's `|| true` chain still fires regen-roadmap and
# regen-requirements when cascade-loop returns non-zero (e.g. a flock
# timeout). Regression guard for the D-15 fail-soft contract.
run_flock_failure_test() {
  local name="$1"; local command="$2"
  local tmpdir
  tmpdir=$(mktemp -d)
  # Failing cascade stub (simulates flock timeout exit 1)
  cat > "$tmpdir/cascade-loop.sh" <<'STUB'
#!/usr/bin/env bash
echo "[gsd-beads] another regen is in progress at /fake/.gsd-beads.lock — retry shortly" >&2
exit 1
STUB
  chmod +x "$tmpdir/cascade-loop.sh"
  # regen-roadmap stub: still records being fired (proves || true gates each)
  cat > "$tmpdir/regen-roadmap.sh" <<'STUB'
#!/usr/bin/env bash
touch "${REGEN_ROADMAP_MARKER:-/tmp/regen-roadmap-stub-fired}"
STUB
  chmod +x "$tmpdir/regen-roadmap.sh"
  cat > "$tmpdir/regen-requirements.sh" <<'STUB'
#!/usr/bin/env bash
touch "${REGEN_REQUIREMENTS_MARKER:-/tmp/regen-requirements-stub-fired}"
STUB
  chmod +x "$tmpdir/regen-requirements.sh"
  local marker_rr="$tmpdir/rr.marker"
  local marker_rreq="$tmpdir/rreq.marker"
  export REGEN_ROADMAP_MARKER="$marker_rr"
  export REGEN_REQUIREMENTS_MARKER="$marker_rreq"
  export SCRIPTS="$tmpdir"
  # WR-03 fix: use the strict variant so rc actually reflects the hook's
  # exit (not the wrapper's `|| true`). The fail-soft contract requires
  # bd-sync.sh to absorb cascade-loop's exit 1 and still return 0.
  # Safe under `set -uo pipefail` (no -e) — a non-zero rc does not abort.
  run_bd_payload_strict "$command"
  rc=$?
  unset REGEN_ROADMAP_MARKER REGEN_REQUIREMENTS_MARKER SCRIPTS
  local rr_fired="no"; [ -f "$marker_rr" ] && rr_fired="yes"
  local rreq_fired="no"; [ -f "$marker_rreq" ] && rreq_fired="yes"
  local status
  if [ "$rc" = "0" ] && [ "$rr_fired" = "yes" ] && [ "$rreq_fired" = "yes" ]; then
    status="PASS"; pass=$((pass+1))
  else
    status="FAIL"; fail=$((fail+1))
  fi
  printf '  [%s] %-50s rc=%s rr=%s rreq=%s\n' "$status" "$name" "$rc" "$rr_fired" "$rreq_fired"
  rm -rf "$tmpdir"
}

run_flock_failure_test "CASE18-flock-failure-still-fires-chain-and-returns-0" "bd close abc-1"

echo ""
total=$((pass+fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
