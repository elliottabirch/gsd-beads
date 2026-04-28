#!/usr/bin/env bash
# memory-seeding.test.sh — REQ-08 memory seeding verification
# Tests that install.sh seeds all 8 bd memories under gsd-beads:* namespace idempotently.
# (Memory #8 `gsd-beads:worktrees` added by Phase 03 Plan 03-03.)
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# Run install.sh to seed memories (uses real bd since memories are global)
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

# CASE 1-8: each key must be present after install
expected_keys=(
  "gsd-beads:vocabulary"
  "gsd-beads:state-paths"
  "gsd-beads:type-strategy"
  "gsd-beads:link-default"
  "gsd-beads:discovered-from"
  "gsd-beads:todowrite"
  "gsd-beads:dolt-push"
  "gsd-beads:worktrees"
)

for key in "${expected_keys[@]}"; do
  case_num=$((pass + fail + 1))
  if bd memories 2>/dev/null | grep -qF "$key"; then
    _pass "CASE $case_num: $key present after install"
  else
    _fail "CASE $case_num: $key MISSING after install"
  fi
done

# CASE 9: re-running install does not duplicate (still exactly 8 gsd-beads:* keys)
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1
# bd memories output uses 2-space-indented keys ("  gsd-beads:...") and 4-space-indented values.
# Use ^[2-spaces]gsd-beads: to count only KEY lines — guards against values that happen to
# contain the literal substring `gsd-beads:` (e.g., a stray pre-existing memory whose value
# is `gsd-beads:vocabulary`).
count=$({ bd memories 2>/dev/null | grep -cE '^  gsd-beads:'; } || echo 0)
if [ "$count" = "8" ]; then
  _pass "CASE 9: idempotent — exactly 8 gsd-beads:* keys after second install (count=$count)"
else
  _fail "CASE 9: expected 8 gsd-beads:* keys after second install, got $count"
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
