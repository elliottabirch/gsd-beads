#!/usr/bin/env bash
# Tests for scripts/cascade-loop.sh
# Tests 4 behavioral cases using ephemeral bd fixture directories.
#
# Usage: bash tests/hook-tests/cascade-loop.test.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASCADE_LOOP="$REPO_ROOT/scripts/cascade-loop.sh"
FIXTURE_BUILDER="$REPO_ROOT/tests/fixtures/bd-helpers/3-level-hierarchy.sh"

pass=0
fail=0

echo "[cascade-loop.test.sh] Running 4 test cases..."

# ---------------------------------------------------------------------------
# CASE 1: cascade closes parent when all children closed (1 round)
# ---------------------------------------------------------------------------
echo ""
echo "CASE 1: cascade closes parent when all children closed"
case1_ok=1
{
  fixture=$(mktemp -d)

  # Build 3-level hierarchy
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"

  # Get all tasks (type=task) and close them
  task_ids=$(bd list --type=task --status=all -n 0 --json | jq -r '.[].id')
  for tid in $task_ids; do
    bd close "$tid" >/dev/null 2>&1
  done

  # Run cascade-loop — should close the 2 phase epics and the req epic
  bash "$CASCADE_LOOP" >/dev/null 2>&1

  # Check that epics were closed (cascade fired)
  closed_epics=$(bd list --type=epic --status=closed -n 0 --json | jq 'length')
  if [ "$closed_epics" -lt 2 ]; then
    case1_ok=0
    echo "  detail: closed=$closed_epics epics, expected >=2"
  fi

  rm -rf "$fixture"
}
if [ "$case1_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: cascade closes phase epics when all tasks closed"
else
  fail=$((fail + 1))
  echo "  FAIL: cascade closes phase epics when all tasks closed"
fi

# ---------------------------------------------------------------------------
# CASE 2: cascade is idempotent (2nd run = no-op)
# ---------------------------------------------------------------------------
echo ""
echo "CASE 2: cascade is idempotent (2nd run is no-op)"
case2_ok=1
{
  fixture=$(mktemp -d)

  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"

  # Close all tasks
  task_ids=$(bd list --type=task --status=all -n 0 --json | jq -r '.[].id')
  for tid in $task_ids; do
    bd close "$tid" >/dev/null 2>&1
  done

  # First cascade run — fires and closes epics
  bash "$CASCADE_LOOP" >/dev/null 2>&1

  # Count closed before second run
  before=$(bd list --type=epic --status=closed -n 0 --json | jq 'length')

  # Second cascade run — should be no-op
  bash "$CASCADE_LOOP" >/dev/null 2>&1

  # Count closed after second run — must be same
  after=$(bd list --type=epic --status=closed -n 0 --json | jq 'length')

  if [ "$before" -ne "$after" ]; then
    case2_ok=0
    echo "  detail: before=$before, after=$after (should be equal)"
  fi

  rm -rf "$fixture"
}
if [ "$case2_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: second cascade run is no-op (closed count unchanged)"
else
  fail=$((fail + 1))
  echo "  FAIL: second cascade run is no-op (closed count changed)"
fi

# ---------------------------------------------------------------------------
# CASE 3: max-iteration cap at 20 prevents infinite loop
# ---------------------------------------------------------------------------
echo ""
echo "CASE 3: max-iteration cap prevents infinite loop"
case3_ok=1
{
  fixture=$(mktemp -d)

  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"

  # Run with MAX_ITER=2 — must exit cleanly within timeout
  timeout 10 env MAX_ITER=2 bash "$CASCADE_LOOP" >/dev/null 2>&1
  exit_code=$?

  if [ "$exit_code" -ne 0 ]; then
    case3_ok=0
    echo "  detail: exit code=$exit_code, expected 0"
  fi

  rm -rf "$fixture"
}
if [ "$case3_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: cascade with MAX_ITER=2 exits 0 cleanly (no infinite loop)"
else
  fail=$((fail + 1))
  echo "  FAIL: cascade with MAX_ITER=2 should exit 0"
fi

# ---------------------------------------------------------------------------
# CASE 4: --quiet flag suppresses stdout when nothing closed
# ---------------------------------------------------------------------------
echo ""
echo "CASE 4: --quiet flag suppresses stdout when nothing closed"
case4_ok=1
{
  fixture=$(mktemp -d)

  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"

  # Run with --quiet on a graph where nothing is eligible (no tasks closed)
  out=$(bash "$CASCADE_LOOP" --quiet 2>/dev/null)

  if [ -n "$out" ]; then
    case4_ok=0
    echo "  detail: expected empty stdout, got: $out"
  fi

  rm -rf "$fixture"
}
if [ "$case4_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: --quiet suppresses stdout when no epics eligible"
else
  fail=$((fail + 1))
  echo "  FAIL: --quiet should suppress stdout when nothing closed"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
