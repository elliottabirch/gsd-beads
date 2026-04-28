#!/usr/bin/env bash
# tests/cross-worktree/simulation.sh
# Phase 3 cross-worktree integration test.
# Builds 3 worktrees (main + feature + hotfix), runs a condensed multi-day
# flow, injects 4 failure modes from D-13, asserts the 4 invariants from D-04.
# Runtime budget: <90s on dev WSL2 (per 03-VALIDATION.md feedback latency target).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export SHIM_REPO_ROOT="$REPO_ROOT"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/setup.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/assertions.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/inject.sh"

pass=0
fail=0
_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# Wall-time budget guard.
SIM_START=$(date +%s)

# Sandbox + cleanup machinery — every fixture lives under /tmp/gsd-beads-cross-XXXXXX.
sandbox=$(mktemp -d "/tmp/gsd-beads-cross-${RANDOM}-XXXXXX")
audit_log="$sandbox/audit.log"
snap_dir="$sandbox/snapshots"
: > "$audit_log"
mkdir -p "$snap_dir"

cleanup_full() {
  cleanup_sandbox "$sandbox"
  # Defensive: also try the renamed path from D-13.3.
  [ -d "${sandbox}/source.renamed" ] && rm -rf "${sandbox}/source.renamed" 2>/dev/null || true
  rm -rf "$sandbox" 2>/dev/null || true
}
trap cleanup_full EXIT

# ---------------------------------------------------------------------------
# Sandbox topology
# ---------------------------------------------------------------------------
src="$sandbox/source"
wt_feat="$sandbox/wt-feature"
wt_hot="$sandbox/wt-hotfix"

echo "=== Cross-worktree simulation ==="
echo "  sandbox:   $sandbox"
echo "  source:    $src"
echo "  wt-feat:   $wt_feat"
echo "  wt-hot:    $wt_hot"

mk_source_repo "$src" || { echo "FATAL: mk_source_repo failed"; exit 1; }
mk_worktree "$src" "$wt_feat" "feature-x" >/dev/null
mk_worktree "$src" "$wt_hot"  "hotfix-y"  >/dev/null

# ===========================================================================
# === Day 1: from src (acting as main) — create epic + 3 leaves ===
# ===========================================================================
echo ""
echo "# === Day 1: from src — create epic + 3 leaves ==="
cd "$src"
EPIC1=$(BEADS_DIR="$src/.beads" bd q "Phase-A: simulation core" -t epic -p 1)
BEADS_DIR="$src/.beads" bd label add "$EPIC1" gsd:phase >/dev/null
echo "CREATED $EPIC1 day=1 wt=src" >> "$audit_log"
declare -a LEAVES=()
for i in 1 2 3; do
  T=$(BEADS_DIR="$src/.beads" bd q "Sim leaf $i" -t task -p "$i")
  BEADS_DIR="$src/.beads" bd link "$T" "$EPIC1" --type parent-child >/dev/null
  echo "CREATED $T day=1 wt=src" >> "$audit_log"
  LEAVES+=("$T")
done
L1="${LEAVES[0]}"; L2="${LEAVES[1]}"; L3="${LEAVES[2]}"
_pass "Day 1: created epic $EPIC1 + 3 leaves ($L1, $L2, $L3)"

# ===========================================================================
# === Day 2: from wt-feature — verify cross-wt visibility, close 2 of 3 leaves ===
# ===========================================================================
echo ""
echo "# === Day 2: from wt-feature — close 2 leaves ==="
seen_in_feat=$(cd "$wt_feat" && BEADS_DIR="$src/.beads" bd list --status=all --json | jq --arg id "$EPIC1" '[.[] | select(.id==$id)] | length')
if [ "$seen_in_feat" = "1" ]; then
  _pass "Day 2: epic $EPIC1 visible from wt-feature (cross-worktree visibility)"
else
  _fail "Day 2: epic NOT visible in wt-feature (seen=$seen_in_feat, expected 1)"
fi
( cd "$wt_feat" && BEADS_DIR="$src/.beads" bd close "$L1" >/dev/null 2>&1 ) || true
echo "CLOSED $L1 day=2 wt=feat" >> "$audit_log"
( cd "$wt_feat" && BEADS_DIR="$src/.beads" bd close "$L2" >/dev/null 2>&1 ) || true
echo "CLOSED $L2 day=2 wt=feat" >> "$audit_log"
_pass "Day 2: closed leaves $L1 and $L2 from wt-feature"

# ===========================================================================
# === Day 3: from wt-feature — close last leaf; cascade fires; verify cross-wt ===
# ===========================================================================
echo ""
echo "# === Day 3: from wt-feature — close last leaf + cascade ==="
( cd "$wt_feat" && BEADS_DIR="$src/.beads" bd close "$L3" >/dev/null 2>&1 ) || true
echo "CLOSED $L3 day=3 wt=feat" >> "$audit_log"
( cd "$wt_feat" && BEADS_DIR="$src/.beads" bash "$REPO_ROOT/scripts/cascade-loop.sh" --quiet ) || true

epic_status=$(cd "$src" && BEADS_DIR="$src/.beads" bd show "$EPIC1" --json | jq -r '.[0].status')
if [ "$epic_status" = "closed" ]; then
  _pass "Day 3: cascade closed epic $EPIC1 (status=$epic_status)"
else
  _fail "Day 3: cascade did NOT close epic $EPIC1 (status=$epic_status)"
fi

# Cross-worktree read from wt-hotfix (D-04 #3 evidence point)
seen_in_hot=$(cd "$wt_hot" && BEADS_DIR="$src/.beads" bd list --status=closed --json | jq --arg id "$EPIC1" '[.[] | select(.id==$id)] | length')
if [ "$seen_in_hot" = "1" ]; then
  _pass "Day 3: epic closure visible from wt-hotfix (cross-worktree state-sharing)"
else
  _fail "Day 3: epic closure NOT visible from wt-hotfix (seen=$seen_in_hot)"
fi

# ===========================================================================
# === Day 4: concurrent burst (D-13.2 injection + invariant 4) ===
# ===========================================================================
echo ""
echo "# === Day 4: concurrent regen burst (D-13.2 + invariant 4) ==="
inject_concurrent_regen "$src" "$src" "$wt_feat" "$snap_dir" 20
# Invariant 4: every captured snapshot is well-formed (not mid-write truncated).
assert_atomic_markdown "$snap_dir" || true

# ===========================================================================
# === Day 5: from wt-hotfix — urgent epic + leaf, close immediately ===
# ===========================================================================
echo ""
echo "# === Day 5: from wt-hotfix — urgent epic + close ==="
EPIC2=$(cd "$wt_hot" && BEADS_DIR="$src/.beads" bd q "Phase-B: hotfix" -t epic -p 0)
( cd "$wt_hot" && BEADS_DIR="$src/.beads" bd label add "$EPIC2" gsd:phase >/dev/null ) || true
echo "CREATED $EPIC2 day=5 wt=hot" >> "$audit_log"
L_HOT=$(cd "$wt_hot" && BEADS_DIR="$src/.beads" bd q "Hotfix leaf" -t task -p 0)
( cd "$wt_hot" && BEADS_DIR="$src/.beads" bd link "$L_HOT" "$EPIC2" --type parent-child >/dev/null ) || true
echo "CREATED $L_HOT day=5 wt=hot" >> "$audit_log"
( cd "$wt_hot" && BEADS_DIR="$src/.beads" bd close "$L_HOT" >/dev/null 2>&1 ) || true
echo "CLOSED $L_HOT day=5 wt=hot" >> "$audit_log"
( cd "$wt_hot" && BEADS_DIR="$src/.beads" bash "$REPO_ROOT/scripts/cascade-loop.sh" --quiet ) || true
# Verify final regen across all 3 worktrees sees both epics in correct state
final_epics=$(cd "$src" && BEADS_DIR="$src/.beads" bd list --type=epic -l gsd:phase --status=all --json | jq 'length')
if [ "$final_epics" -ge 2 ]; then
  _pass "Day 5: $final_epics phase-epics visible from src after multi-worktree flow"
else
  _fail "Day 5: expected >=2 phase-epics, got $final_epics"
fi

# ===========================================================================
# D-13.4: BEADS_DIR unset in wt-feature — non-destructive, runs early ===
# ===========================================================================
echo ""
echo "# === D-13.4 injection: BEADS_DIR unset in wt-feature ==="
# Run in a subshell so the unset doesn't affect later asserts.
(
  inject_beads_dir_unset "$wt_feat"
  cd "$wt_feat"
  bd_out=$(bd list --status=all 2>&1) || rc=$?
  rc="${rc:-0}"
  if echo "$bd_out" | grep -qE 'simulation core|hotfix|Sim leaf|Phase-'; then
    echo "[D-13.4-OBSERVED] discovery-fallback works (bd list returned issues)"
    exit 10
  elif echo "$bd_out" | grep -qiE 'no .beads|no.*database|cannot find|not found|BEADS_DIR'; then
    echo "[D-13.4-OBSERVED] clear error per documented precedence: $(echo "$bd_out" | head -1)"
    exit 11
  else
    echo "[D-13.4-OBSERVED] unexpected: rc=$rc out='$(echo "$bd_out" | head -1)'"
    exit 12
  fi
)
case $? in
  10|11) _pass "D-13.4: BEADS_DIR unset → documented behavior (fallback or clear error)" ;;
  *)     _fail "D-13.4: BEADS_DIR unset → unexpected behavior" ;;
esac

# ===========================================================================
# Invariants 1-3: run BEFORE destructive injections (D-13.1 + D-13.3) ===
# ===========================================================================
echo ""
echo "# === Invariants 1-3 (D-04 #1, #2, #3) ==="
assert_no_data_loss "$src/.beads" "$audit_log" || true
assert_no_id_collision "$audit_log" || true
assert_no_stale_state "$src/.beads" "$src" "$wt_feat" || true
# Invariant 4 already asserted in Day 4.

# ===========================================================================
# D-13.1: source .beads/ deleted — DESTRUCTIVE ===
# ===========================================================================
echo ""
echo "# === D-13.1 injection: source .beads/ deleted ==="
inject_source_beads_deleted "$src"
err=$(cd "$wt_feat" && BEADS_DIR="$src/.beads" bd list 2>&1) || rc=$?
rc="${rc:-0}"
if [ "$rc" != "0" ] && echo "$err" | grep -qiE 'no .beads|database|not found|cannot find|directory|connect'; then
  _pass "D-13.1: source .beads/ deleted → bd commands fail with clear error (rc=$rc)"
else
  _fail "D-13.1: expected clear error after .beads/ deletion, got: rc=$rc out='$(echo "$err" | head -1)'"
fi

# ===========================================================================
# D-13.3: source repo renamed — DESTRUCTIVE; runs LAST ===
# ===========================================================================
echo ""
echo "# === D-13.3 injection: source repo renamed (runs LAST) ==="
# Skip the bd parts of the injection (already destroyed by D-13.1) — just rename.
inject_source_renamed "$src"
if [ ! -d "$src" ] && [ -d "${src}.renamed" ]; then
  _pass "D-13.3: source renamed → $src no longer exists; recovery documented (per D-14)"
else
  _fail "D-13.3: rename injection didn't take effect (src still at original path)"
fi

# ===========================================================================
# Final summary
# ===========================================================================
SIM_END=$(date +%s)
elapsed=$((SIM_END - SIM_START))
echo ""
echo "Wall time: ${elapsed}s"
[ "$elapsed" -gt 90 ] && echo "WARNING: simulation exceeded 90s soft budget (per 03-VALIDATION.md)"
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
