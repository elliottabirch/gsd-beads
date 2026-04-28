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
  [ -d "${sandbox}.renamed" ] && rm -rf "${sandbox}.renamed" 2>/dev/null || true
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
# Day-by-day flow + assertions + injections — filled in by Task 3.
# ===========================================================================
# === Day 1: from src (main) — create epic + 3 leaves ===
# === Day 2: from wt-feature — close 2 of 3 leaves ===
# === Day 3: from wt-feature — close last leaf; cascade fires; verify cross-wt visibility ===
# === Day 4: concurrent burst (D-13.2 injection + invariant 4) ===
# === Day 5: from wt-hotfix — urgent epic + leaf, close immediately ===
# === D-13.4 (BEADS_DIR unset): non-destructive; runs early ===
# === Invariants 1-3 (run BEFORE destructive injections) ===
# === D-13.1 (source .beads/ deleted): destructive ===
# === D-13.3 (source repo renamed): runs LAST ===
# ===========================================================================

# Final summary.
SIM_END=$(date +%s)
elapsed=$((SIM_END - SIM_START))
echo ""
echo "Wall time: ${elapsed}s"
[ "$elapsed" -gt 90 ] && echo "WARNING: simulation exceeded 90s soft budget (per 03-VALIDATION.md)"
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
