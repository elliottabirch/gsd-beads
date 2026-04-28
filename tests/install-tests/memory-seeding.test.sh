#!/usr/bin/env bash
# memory-seeding.test.sh — REQ-08 memory seeding verification
# Tests that install.sh seeds all 7 bd memories under gsd-beads:* namespace idempotently.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# Run install.sh to seed memories (uses real bd since memories are global)
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

# CASE 1-7: each key must be present after install
expected_keys=(
  "gsd-beads:vocabulary"
  "gsd-beads:state-paths"
  "gsd-beads:type-strategy"
  "gsd-beads:link-default"
  "gsd-beads:discovered-from"
  "gsd-beads:todowrite"
  "gsd-beads:dolt-push"
)

for key in "${expected_keys[@]}"; do
  case_num=$((pass + fail + 1))
  if bd memories 2>/dev/null | grep -qF "$key"; then
    _pass "CASE $case_num: $key present after install"
  else
    _fail "CASE $case_num: $key MISSING after install"
  fi
done

# CASE 8: re-running install does not duplicate (still exactly 7 gsd-beads:* keys)
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1
# bd memories output uses indented keys: "  gsd-beads:..." — grep for the pattern anywhere in line
count=$({ bd memories 2>/dev/null | grep -cF 'gsd-beads:'; } || echo 0)
if [ "$count" = "7" ]; then
  _pass "CASE 8: idempotent — exactly 7 gsd-beads:* keys after second install (count=$count)"
else
  _fail "CASE 8: expected 7 gsd-beads:* keys after second install, got $count"
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
