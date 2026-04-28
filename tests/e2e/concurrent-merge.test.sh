#!/usr/bin/env bash
# REQ-05: Two worktrees writing same bead ID concurrently merge without conflict.
# B1 fix: REQ-05 interpretation per Pitfall 8 — last-writer-wins acceptable.
# Acceptance: (a) both writers commit (non-empty stdout), (b) final state=closed,
# close_reason in {wt-source, wt-secondary}, (c) bd list succeeds (no DB corruption).
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-cmerge-${RANDOM}"
wt="${fixture}-wt"
trap "rm -rf '$fixture' '$wt'" EXIT  # T-02-10 cleanup

pass=0; fail=0
mkdir -p "$fixture" && cd "$fixture"
git init -q
git config user.email "e2e@test.local"
git config user.name "E2E Test"
git commit -q --allow-empty -m init
bd init --non-interactive --skip-agents >/dev/null 2>&1
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

# CASE 1: create a second worktree (post-checkout shim should auto-configure it)
git worktree add "$wt" -q 2>/dev/null || git worktree add "$wt" HEAD -q 2>/dev/null
if [ -d "$wt" ]; then
  echo "[CASE 1] PASS — worktree created at $wt"
  pass=$((pass+1))
else
  echo "[CASE 1] FAIL — could not create worktree at $wt"
  fail=$((fail+1))
fi

# CASE 2 (B1 fix): create a target bead, then 2 parallel processes close it from different cwds.
# Acceptance: BOTH writers' bd close stdout must be non-empty (proves transaction committed,
# no exception thrown). Last-writer-wins on close_reason is acceptable per Pitfall 8.
BEAD=$(bd q "concurrent target" -t task -p 1)
out1_file=$(mktemp); out2_file=$(mktemp)
rc1_file=$(mktemp); rc2_file=$(mktemp)

(cd "$fixture" && bd close "$BEAD" --reason "wt-source" > "$out1_file" 2>&1; echo $? > "$rc1_file") &
pid1=$!
# Give the secondary writer a slight head start to race properly
(cd "$wt" && BEADS_DIR="$fixture/.beads" bd close "$BEAD" --reason "wt-secondary" > "$out2_file" 2>&1; echo $? > "$rc2_file") &
pid2=$!
wait $pid1; wait $pid2

rc1=$(cat "$rc1_file"); rc2=$(cat "$rc2_file")
out1=$(cat "$out1_file"); out2=$(cat "$out2_file")
rm -f "$out1_file" "$out2_file" "$rc1_file" "$rc2_file"

# Both writers committed: rc=0 AND non-empty output
if [ "$rc1" = "0" ] && [ "$rc2" = "0" ] && [ -n "$out1" ] && [ -n "$out2" ]; then
  echo "[CASE 2] PASS — both writers committed (rc1=$rc1, rc2=$rc2; outputs non-empty)"
  pass=$((pass+1))
else
  echo "[CASE 2] FAIL — rc1=$rc1, rc2=$rc2"
  echo "[CASE 2]   out1: $out1"
  echo "[CASE 2]   out2: $out2"
  fail=$((fail+1))
fi

# CASE 3 (B1 fix): final state — bead is closed AND close_reason ∈ {wt-source, wt-secondary}.
# Last-writer-wins is acceptable per Pitfall 8 / Spike 005;
# recovering the overwritten value is OUT OF SCOPE for MVP.
final_json=$(bd show "$BEAD" --json 2>&1)
final_status=$(echo "$final_json" | jq -r '.[0].status' 2>/dev/null || echo "")
final_reason=$(echo "$final_json" | jq -r '.[0].close_reason // ""' 2>/dev/null || echo "")
if [ "$final_status" = "closed" ] && \
   { [ "$final_reason" = "wt-source" ] || [ "$final_reason" = "wt-secondary" ]; }; then
  echo "[CASE 3] PASS — status=closed, close_reason=$final_reason (one of two writer values; last-writer-wins per Pitfall 8 acceptable)"
  pass=$((pass+1))
else
  echo "[CASE 3] FAIL — status=$final_status close_reason=$final_reason"
  echo "[CASE 3]   raw json: $final_json"
  fail=$((fail+1))
fi

# CASE 4: no corruption — bd list --json parses successfully
if bd list --json 2>/dev/null | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "[CASE 4] PASS — bd list --json parses (no DB corruption)"
  pass=$((pass+1))
else
  echo "[CASE 4] FAIL — bd list output not valid JSON array"
  fail=$((fail+1))
fi

echo ""
echo "Passed: $pass / $((pass+fail))"
[ "$fail" -eq 0 ]
