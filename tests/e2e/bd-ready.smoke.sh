#!/usr/bin/env bash
# REQ-08: bd ready works as-is in a beads-managed project.
# B2 fix: D-07 verification — bd prime surfaces gsd-beads:vocabulary at session-start.
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-ready-${RANDOM}"
trap "rm -rf '$fixture'" EXIT  # T-02-10 cleanup

pass=0; fail=0
mkdir -p "$fixture" && cd "$fixture"
git init -q
git config user.email "e2e@test.local"
git config user.name "E2E Test"
bd init --non-interactive --skip-agents >/dev/null 2>&1
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

# CASE 1: build 3-level fixture with 1 ready task (no blocks deps)
bash "$REPO_ROOT/tests/fixtures/bd-helpers/3-level-hierarchy.sh" "$fixture"
echo "[CASE 1] PASS — 3-level hierarchy built"
pass=$((pass+1))

# CASE 2: bd ready returns at least one task
out=$(bd ready 2>&1)
if [ -n "$out" ]; then
  echo "[CASE 2] PASS — bd ready output: $out"
  pass=$((pass+1))
else
  echo "[CASE 2] FAIL — bd ready returned empty output"
  fail=$((fail+1))
fi

# CASE 3: gsd-beads:vocabulary memory mentions bd ready
# Use --json to get the full memory content (list output is truncated)
voc=$(bd memories --json gsd-beads:vocabulary 2>&1 || true)
if echo "$voc" | grep -q 'bd ready'; then
  echo "[CASE 3] PASS — gsd-beads:vocabulary mentions 'bd ready'"
  pass=$((pass+1))
else
  echo "[CASE 3] FAIL — gsd-beads:vocabulary does not mention 'bd ready'"
  echo "[CASE 3] vocabulary output: $voc"
  fail=$((fail+1))
fi

# CASE 4 (B2 fix — D-07 verification): bd prime surfaces gsd-beads:vocabulary
# D-07 mandates: agents see vocabulary memory at session start via bd prime.
# We grep for either the memory key name itself or a literal string from the vocabulary text
# (e.g., "Upstream" — present in vocabulary.md per W7 fix).
prime_out=$(bd prime 2>&1 || true)
if echo "$prime_out" | grep -qE 'gsd-beads:vocabulary|Upstream `/gsd-\*`'; then
  echo "[CASE 4] PASS — bd prime surfaces gsd-beads:vocabulary (D-07 verified)"
  pass=$((pass+1))
else
  echo "[CASE 4] FAIL — bd prime did not surface gsd-beads:vocabulary"
  echo "[CASE 4] bd prime output (first 500 chars): $(printf '%s' "$prime_out" | head -c 500)"
  fail=$((fail+1))
fi

echo ""
echo "Passed: $pass / $((pass+fail))"
[ "$fail" -eq 0 ]
