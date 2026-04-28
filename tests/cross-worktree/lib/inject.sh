#!/usr/bin/env bash
# tests/cross-worktree/lib/inject.sh
# Pure-function library: 4 D-13 failure-mode injections for the cross-worktree simulation.
#
# Each injection:
#   - Takes context args (sandbox paths).
#   - Performs the failure (delete/rename/unset/spawn).
#   - Echoes a recognizable signature line to stdout/stderr so the simulation log proves
#     the injection actually fired (per success criteria).
#
# The 4 injections (from 03-CONTEXT.md D-13):
#   1. inject_source_beads_deleted   — `rm -rf <src>/.beads`; bd commands should fail clearly.
#   2. inject_concurrent_regen       — burst regen-roadmap.sh from 2 worktrees concurrently
#                                       + capture roadmap snapshots every 0.1s for invariant 4.
#   3. inject_source_renamed         — mv <src> <src>.renamed; documented recovery via git config.
#   4. inject_beads_dir_unset        — unset BEADS_DIR + git config in a wt; observe fallback.

# ---------------------------------------------------------------------------
# inject_source_beads_deleted <source_root>
# Destructive: removes the source repo's .beads/ directory.
# Expected observable: subsequent bd invocations fail with a clear error.
# D-13 #1.
# ---------------------------------------------------------------------------
inject_source_beads_deleted() {
  local source_root="$1"
  echo "[INJECT D-13.1] removing $source_root/.beads (DESTRUCTIVE)"
  rm -rf "$source_root/.beads"
  # Caller asserts: bd commands now fail with "no .beads/" / "database not found" / similar.
}

# ---------------------------------------------------------------------------
# inject_concurrent_regen <source_root> <wt_a> <wt_b> <snap_dir> <burst_n>
# Spawns `regen-roadmap.sh` invocations from $wt_a AND $wt_b concurrently
# ($burst_n from each); captures roadmap snapshots every 0.1s into $snap_dir
# (for invariant 4: atomic markdown).
# D-13 #2 — exercises Plan 03-01's flock preamble end-to-end.
# ---------------------------------------------------------------------------
inject_concurrent_regen() {
  local source_root="$1" wt_a="$2" wt_b="$3" snap_dir="$4" burst_n="${5:-20}"
  local source_beads="$source_root/.beads"
  local roadmap="$source_root/.planning/ROADMAP.md"
  local repo_root="${SHIM_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
  echo "[INJECT D-13.2] concurrent regen burst: $burst_n × 2 worktrees → $snap_dir"

  mkdir -p "$snap_dir"

  # Background snapshot capture loop (every 0.1s).
  # Records signal in a file we wait on at the end.
  # Portability (WR-01 fix): use a monotonic counter rather than `date +%s%N`.
  # `%N` is GNU coreutils-only; on macOS BSD `date` it is emitted literally,
  # causing every snapshot in the same second to collide on the same filename
  # and silently overwrite. A zero-padded counter + epoch suffix is strictly
  # portable and guarantees a unique filename per snapshot.
  ( snap_n=0
    while [ ! -f "$snap_dir/.stop" ]; do
      if [ -f "$roadmap" ]; then
        cp "$roadmap" "$(printf '%s/roadmap-snap-%06d-%s.md' "$snap_dir" "$snap_n" "$(date +%s)")" 2>/dev/null || true
        snap_n=$((snap_n + 1))
      fi
      sleep 0.1
    done
  ) &
  local snap_pid=$!

  # Burst from wt_a and wt_b in parallel.
  local pids=()
  local i
  for i in $(seq 1 "$burst_n"); do
    ( cd "$wt_a" && BEADS_DIR="$source_beads" bash "$repo_root/scripts/regen-roadmap.sh" >/dev/null 2>&1 ) &
    pids+=($!)
    ( cd "$wt_b" && BEADS_DIR="$source_beads" bash "$repo_root/scripts/regen-roadmap.sh" >/dev/null 2>&1 ) &
    pids+=($!)
  done

  # Wait for all burst invocations to complete.
  local pid
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done

  # Stop the snapshot capture loop.
  touch "$snap_dir/.stop"
  wait "$snap_pid" 2>/dev/null || true
  rm -f "$snap_dir/.stop"

  local captured
  captured=$(ls -1 "$snap_dir"/roadmap-snap-*.md 2>/dev/null | wc -l)
  echo "[INJECT D-13.2] burst complete: $((burst_n * 2)) regen invocations, $captured snapshots captured"
}

# ---------------------------------------------------------------------------
# inject_source_renamed <source_root>
# Destructive: renames the source repo to <source_root>.renamed.
# Worktree configs now point at a non-existent path — recovery is documented:
#   git config --worktree gsd-beads.dir <new>/.beads
# D-13 #3.
# ---------------------------------------------------------------------------
inject_source_renamed() {
  local source_root="$1"
  echo "[INJECT D-13.3] renaming $source_root → ${source_root}.renamed (DESTRUCTIVE)"
  mv "$source_root" "${source_root}.renamed"
  echo "[INJECT D-13.3] recovery hint (per D-14): \`git config --worktree gsd-beads.dir ${source_root}.renamed/.beads\`"
}

# ---------------------------------------------------------------------------
# inject_beads_dir_unset <wt_path>
# Unsets BEADS_DIR and removes the per-worktree gsd-beads.dir config in $wt_path.
# Caller invokes `bd list` and observes the discovery fallback (cwd-scan via
# `git rev-parse --git-common-dir` → source) OR a clear error.
# D-13 #4.
# ---------------------------------------------------------------------------
inject_beads_dir_unset() {
  local wt_path="$1"
  echo "[INJECT D-13.4] unsetting BEADS_DIR + per-worktree gsd-beads.dir in $wt_path"
  unset BEADS_DIR
  git -C "$wt_path" config --worktree --unset gsd-beads.dir 2>/dev/null || \
    git -C "$wt_path" config --unset gsd-beads.dir 2>/dev/null || true
}
