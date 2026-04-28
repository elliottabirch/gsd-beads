#!/usr/bin/env bash
# Tests for hooks/worktree-post-checkout.sh — auto-configuration of new worktrees.
set -euo pipefail
echo "[auto-config.test.sh] STUB — production code not yet written"
# CASE 1: git worktree add in beads-managed source → new wt has git config --worktree gsd-beads.dir set
# CASE 2: marker file <wt-gitdir>/info/.gsd-beads-configured exists after first checkout
# CASE 3: re-checkout in same worktree (e.g., git checkout other-branch) → script no-ops (marker present)
# CASE 4: source repo lacks .beads/ → script emits warning to stderr, exits 0 cleanly (no abort)
# CASE 5: flag=0 (file checkout, not worktree-add) → script no-ops
exit 1
