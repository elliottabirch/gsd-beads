#!/usr/bin/env bash
# Tests for scripts/regen-requirements.sh
# Tests 5 behavioral cases using ephemeral bd fixture directories.
#
# Usage: bash tests/hook-tests/regen-requirements.test.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGEN_REQS="$REPO_ROOT/scripts/regen-requirements.sh"
FIXTURE_BUILDER="$REPO_ROOT/tests/fixtures/bd-helpers/3-level-hierarchy.sh"

pass=0
fail=0

echo "[regen-requirements.test.sh] Running 5 test cases..."

# ---------------------------------------------------------------------------
# CASE 1: byte-stable output across two runs on identical bd state
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
  bash "$REGEN_REQS"
  first_md=$(cat "$fixture/.planning/REQUIREMENTS.md")

  # Second run
  bash "$REGEN_REQS"
  second_md=$(cat "$fixture/.planning/REQUIREMENTS.md")

  if [ "$first_md" != "$second_md" ]; then
    case1_ok=0
    echo "  detail: two consecutive runs produced different output"
    diff <(printf '%s' "$first_md") <(printf '%s' "$second_md") | head -10
  fi

  rm -rf "$fixture"
}
if [ "$case1_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: two consecutive runs produce identical REQUIREMENTS.md"
else
  fail=$((fail + 1))
  echo "  FAIL: two consecutive runs produced different REQUIREMENTS.md"
fi

# ---------------------------------------------------------------------------
# CASE 2: ## v1 Requirements grouping correctly partitions by version:v1 label
# ---------------------------------------------------------------------------
echo ""
echo "CASE 2: ## v1 Requirements grouping from version:v1 label"
case2_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  bash "$REGEN_REQS"
  reqs=$(cat "$fixture/.planning/REQUIREMENTS.md")

  # Must contain ## v1 Requirements section
  if ! printf '%s' "$reqs" | grep -q '^## v1 Requirements$'; then
    case2_ok=0
    echo "  detail: missing '## v1 Requirements' section"
    printf '%s' "$reqs" | grep '^## ' || echo "  (sections found: none)"
  fi

  # The REQ-042 bead (version:v1) should appear under v1 section
  if ! printf '%s' "$reqs" | grep -q 'REQ-042'; then
    case2_ok=0
    echo "  detail: REQ-042 not found in output"
  fi

  rm -rf "$fixture"
}
if [ "$case2_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: ## v1 Requirements section contains REQ-042"
else
  fail=$((fail + 1))
  echo "  FAIL: ## v1 Requirements grouping incorrect"
fi

# ---------------------------------------------------------------------------
# CASE 3: ## <Category> sub-headers from category:* labels
# ---------------------------------------------------------------------------
echo ""
echo "CASE 3: ### <Category> sub-headers from category:auth label"
case3_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  bash "$REGEN_REQS"
  reqs=$(cat "$fixture/.planning/REQUIREMENTS.md")

  # Should have a ### sub-header for the auth category
  # The category:auth label should produce a ### header (Auth or Authentication)
  if ! printf '%s' "$reqs" | grep -qE '^### [Aa]uth'; then
    case3_ok=0
    echo "  detail: no ### Auth* sub-header found for category:auth label"
    printf '%s' "$reqs" | grep '^### ' || echo "  (no ### headers found)"
  fi

  rm -rf "$fixture"
}
if [ "$case3_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: ### category sub-header appears for category:auth label"
else
  fail=$((fail + 1))
  echo "  FAIL: ### category sub-header missing for category:auth"
fi

# ---------------------------------------------------------------------------
# CASE 4: ## Out of Scope rows from status=closed + close_reason=out-of-scope
# ---------------------------------------------------------------------------
echo ""
echo "CASE 4: ## Out of Scope rows from closed beads with close_reason=out-of-scope"
case4_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  # Add a second requirement and close it out-of-scope
  OOS_REQ=$(bd q "OOS-001: Out of scope feature" -t epic -p 4)
  bd label add "$OOS_REQ" gsd:requirement >/dev/null 2>&1
  bd label add "$OOS_REQ" req-id:OOS-001 >/dev/null 2>&1
  bd label add "$OOS_REQ" version:v1 >/dev/null 2>&1
  bd close "$OOS_REQ" --reason out-of-scope >/dev/null 2>&1

  bash "$REGEN_REQS"
  reqs=$(cat "$fixture/.planning/REQUIREMENTS.md")

  # Must have ## Out of Scope section
  if ! printf '%s' "$reqs" | grep -q '^## Out of Scope$'; then
    case4_ok=0
    echo "  detail: missing ## Out of Scope section"
  fi

  # Must have OOS-001 in the Out of Scope table
  if ! printf '%s' "$reqs" | grep -q 'OOS-001'; then
    case4_ok=0
    echo "  detail: OOS-001 not found in Out of Scope table"
    printf '%s' "$reqs" | grep 'Out of Scope' -A 10 || true
  fi

  rm -rf "$fixture"
}
if [ "$case4_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: ## Out of Scope table contains closed bead with close_reason=out-of-scope"
else
  fail=$((fail + 1))
  echo "  FAIL: ## Out of Scope table missing or incorrect"
fi

# ---------------------------------------------------------------------------
# CASE 5: ## Traceability table maps requirement → phases via parent-child
# ---------------------------------------------------------------------------
echo ""
echo "CASE 5: ## Traceability table maps REQ-042 → Phase 12, Phase 13"
case5_ok=1
{
  fixture=$(mktemp -d)
  bash "$FIXTURE_BUILDER" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p "$fixture/.planning"

  bash "$REGEN_REQS"
  reqs=$(cat "$fixture/.planning/REQUIREMENTS.md")

  # Must have ## Traceability section
  if ! printf '%s' "$reqs" | grep -q '^## Traceability$'; then
    case5_ok=0
    echo "  detail: missing ## Traceability section"
  fi

  # REQ-042 must appear in the Traceability table with phase references
  if ! printf '%s' "$reqs" | grep -q 'REQ-042.*Phase'; then
    case5_ok=0
    echo "  detail: REQ-042 not mapped to phases in Traceability table"
    printf '%s' "$reqs" | grep 'Traceability' -A 10 || true
  fi

  # Must have both Phase 12 and Phase 13 in the traceability row
  if ! printf '%s' "$reqs" | grep -q 'REQ-042.*Phase 12'; then
    case5_ok=0
    echo "  detail: Phase 12 not found in REQ-042 traceability row"
  fi

  if ! printf '%s' "$reqs" | grep -q 'REQ-042.*Phase 13'; then
    case5_ok=0
    echo "  detail: Phase 13 not found in REQ-042 traceability row"
  fi

  rm -rf "$fixture"
}
if [ "$case5_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: ## Traceability table maps REQ-042 → Phase 12 and Phase 13"
else
  fail=$((fail + 1))
  echo "  FAIL: ## Traceability table mapping incorrect"
fi

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
  # bd priority range is 0-4 (Rule 1: plan-text said -p 5 but bd rejects)
  MW_REQ=$(bd q "REQ-077: Multi-word category test" -t epic -p 4)
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

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
