#!/usr/bin/env bash
# Tests for scripts/regen-roadmap.sh
# Tests 5 behavioral cases using ephemeral bd fixture directories.
#
# Usage: bash tests/hook-tests/regen-roadmap.test.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGEN_ROADMAP="$REPO_ROOT/scripts/regen-roadmap.sh"
FIXTURE_BUILDER="$REPO_ROOT/tests/fixtures/bd-helpers/3-level-hierarchy.sh"

pass=0
fail=0

echo "[regen-roadmap.test.sh] Running 5 test cases..."

# ---------------------------------------------------------------------------
# CASE 1: byte-stable output across two runs on identical bd state (determinism)
# ---------------------------------------------------------------------------
echo ""
echo "CASE 1: byte-stable output (determinism)"
case1_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  # First run
  bash "$REGEN_ROADMAP"
  first_md=$(cat "$fixture/.planning/ROADMAP.md")

  # Second run
  bash "$REGEN_ROADMAP"
  second_md=$(cat "$fixture/.planning/ROADMAP.md")

  if [ "$first_md" != "$second_md" ]; then
    case1_ok=0
    echo "  detail: two consecutive runs produced different output"
    diff <(printf '%s' "$first_md") <(printf '%s' "$second_md") | head -10
  fi

  rm -rf "$fixture"
}
if [ "$case1_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: two consecutive runs produce identical ROADMAP.md"
else
  fail=$((fail + 1))
  echo "  FAIL: two consecutive runs produced different ROADMAP.md"
fi

# ---------------------------------------------------------------------------
# CASE 2: ## Progress table column-order matches gsd-progress parser expectations
# ---------------------------------------------------------------------------
echo ""
echo "CASE 2: ## Progress table column-order"
case2_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  bash "$REGEN_ROADMAP"
  roadmap=$(cat "$fixture/.planning/ROADMAP.md")

  # Must have ## Progress header
  if ! printf '%s' "$roadmap" | grep -q '^## Progress$'; then
    case2_ok=0
    echo "  detail: missing ## Progress header"
  fi

  # Must have a table with Phase and Status as first two columns
  if ! printf '%s' "$roadmap" | grep -q '| Phase | Status |'; then
    case2_ok=0
    echo "  detail: table header does not start with '| Phase | Status |'"
  fi

  # Must also have Plans Done and Plans Total columns
  if ! printf '%s' "$roadmap" | grep -q '| Plans Done | Plans Total |'; then
    case2_ok=0
    echo "  detail: table missing Plans Done / Plans Total columns"
  fi

  rm -rf "$fixture"
}
if [ "$case2_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: ## Progress table has correct column order (Phase, Status, Plans Done, Plans Total)"
else
  fail=$((fail + 1))
  echo "  FAIL: ## Progress table column-order mismatch"
fi

# ---------------------------------------------------------------------------
# CASE 3: phases sorted by priority then bead-creation-order
# ---------------------------------------------------------------------------
echo ""
echo "CASE 3: phases sorted by priority (P1=priority:1 before P2=priority:2)"
case3_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  bash "$REGEN_ROADMAP"
  roadmap=$(cat "$fixture/.planning/ROADMAP.md")

  # Phase 12 (p=1) should appear before Phase 13 (p=2)
  line_p12=$(printf '%s' "$roadmap" | grep -n 'Phase 12:' | head -1 | cut -d: -f1)
  line_p13=$(printf '%s' "$roadmap" | grep -n 'Phase 13:' | head -1 | cut -d: -f1)

  if [ -z "$line_p12" ] || [ -z "$line_p13" ]; then
    case3_ok=0
    echo "  detail: could not find phase headings (P12_line=$line_p12, P13_line=$line_p13)"
  elif [ "$line_p12" -ge "$line_p13" ]; then
    case3_ok=0
    echo "  detail: Phase 12 (line $line_p12) should appear before Phase 13 (line $line_p13)"
  fi

  rm -rf "$fixture"
}
if [ "$case3_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: Phase 12 (priority 1) appears before Phase 13 (priority 2)"
else
  fail=$((fail + 1))
  echo "  FAIL: phase sort order incorrect"
fi

# ---------------------------------------------------------------------------
# CASE 4: requirements line lists parent-req IDs from req-id:* labels
# ---------------------------------------------------------------------------
echo ""
echo "CASE 4: requirements line shows [REQ-042] from req-id:REQ-042 label"
case4_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  bash "$REGEN_ROADMAP"
  roadmap=$(cat "$fixture/.planning/ROADMAP.md")

  # Phase 12 block should contain **Requirements**: [REQ-042]
  if ! printf '%s' "$roadmap" | grep -q '\*\*Requirements\*\*:.*REQ-042'; then
    case4_ok=0
    echo "  detail: could not find **Requirements**: [REQ-042] in output"
    printf '%s' "$roadmap" | grep 'Requirements' || echo "  (no Requirements line found)"
  fi

  rm -rf "$fixture"
}
if [ "$case4_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: **Requirements**: [REQ-042] appears in phase blocks"
else
  fail=$((fail + 1))
  echo "  FAIL: requirements line does not list REQ-042"
fi

# ---------------------------------------------------------------------------
# CASE 5: missing PROJECT.md does not crash (informational fallback)
# ---------------------------------------------------------------------------
echo ""
echo "CASE 5: missing PROJECT.md does not crash"
case5_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  # Ensure no PROJECT.md exists
  rm -f "$fixture/.planning/PROJECT.md"

  # Should not crash and should produce a file
  bash "$REGEN_ROADMAP" 2>/dev/null

  if [ ! -f "$fixture/.planning/ROADMAP.md" ]; then
    case5_ok=0
    echo "  detail: ROADMAP.md was not created when PROJECT.md is missing"
  else
    # Should still have ## Overview header
    if ! grep -q '^## Overview$' "$fixture/.planning/ROADMAP.md"; then
      case5_ok=0
      echo "  detail: ## Overview header missing in fallback output"
    fi
  fi

  rm -rf "$fixture"
}
if [ "$case5_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: missing PROJECT.md produces valid ROADMAP.md with ## Overview placeholder"
else
  fail=$((fail + 1))
  echo "  FAIL: missing PROJECT.md caused crash or missing ## Overview"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
