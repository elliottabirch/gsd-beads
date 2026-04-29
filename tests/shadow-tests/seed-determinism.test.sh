#!/usr/bin/env bash
# seed-determinism.test.sh
#
# Asserts seeder reproducibility (D-07): two `bd init --from-jsonl`
# invocations produce byte-identical `bd export --json` output.
# Asserts multi-milestone content (D-08): seed contains v0.1-closed (2),
# v0.2-open (3), v0.3-open (2) phases.
#
# Pitfall 5: determinism contract is on bd state (via `bd export --json`),
# NOT on filesystem mtimes. Do NOT compare .beads/issues.jsonl directly —
# auto-export mtimes will diverge.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_FIXTURE="$REPO_ROOT/tests/fixtures/seed-fixture.sh"

pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[seed-determinism.test.sh] Running 2 test cases..."
echo ""

# ---------------------------------------------------------------------------
# CASE 1: byte-identical bd export across two seeds (D-07)
# ---------------------------------------------------------------------------
case1_ok=1
{
  fixture_a=$(mktemp -d)
  fixture_b=$(mktemp -d)
  bash "$SEED_FIXTURE" "$fixture_a" >/dev/null 2>&1
  bash "$SEED_FIXTURE" "$fixture_b" >/dev/null 2>&1
  export_a=$(cd "$fixture_a" && BEADS_ACTOR=seed bd export --json)
  export_b=$(cd "$fixture_b" && BEADS_ACTOR=seed bd export --json)
  if [ "$export_a" != "$export_b" ]; then
    case1_ok=0
    diff <(printf '%s' "$export_a") <(printf '%s' "$export_b") | head -10
  fi
  rm -rf "$fixture_a" "$fixture_b"
}
if [ "$case1_ok" -eq 1 ]; then
  _pass "CASE 1 (D-07): seed-fixture produces byte-identical bd state"
else
  _fail "CASE 1 (D-07): seed-fixture produces non-deterministic state"
fi

# ---------------------------------------------------------------------------
# CASE 2: multi-milestone content (D-08)
# ---------------------------------------------------------------------------
case2_ok=1
{
  fixture=$(mktemp -d)
  bash "$SEED_FIXTURE" "$fixture" >/dev/null 2>&1
  v01_count=$(cd "$fixture" && BEADS_ACTOR=seed bd list --status=closed -l version:v0.1 --type=epic --json | jq 'length')
  v02_count=$(cd "$fixture" && BEADS_ACTOR=seed bd list --status=open -l version:v0.2 --type=epic --json | jq 'length')
  v03_count=$(cd "$fixture" && BEADS_ACTOR=seed bd list --status=open -l version:v0.3 --type=epic --json | jq 'length')
  if [ "$v01_count" -ne 2 ] || [ "$v02_count" -ne 3 ] || [ "$v03_count" -ne 2 ]; then
    case2_ok=0
    echo "  v0.1 closed=$v01_count (expected 2), v0.2 open=$v02_count (expected 3), v0.3 open=$v03_count (expected 2)"
  fi
  rm -rf "$fixture"
}
if [ "$case2_ok" -eq 1 ]; then
  _pass "CASE 2 (D-08): seed contains v0.1-closed (2), v0.2-open (3), v0.3-open (2)"
else
  _fail "CASE 2 (D-08): multi-milestone content mismatch"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
