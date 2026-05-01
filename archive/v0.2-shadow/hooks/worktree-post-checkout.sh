#!/usr/bin/env bash
# gsd-beads worktree-init shim — wrapped in sentinel-marker block.
# Designed to be APPENDED into .beads/hooks/post-checkout by install.sh.
# Idempotent via marker file in worktree gitdir.
# T-02-06 mitigation: marker check uses `[ -f ... ]` only (no symlink follow risk because the dir is git-managed).

# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---
old_sha=$1; new_sha=$2; flag=$3
# flag=1 means branch checkout (this is what `git worktree add` triggers).
# flag=0 means file-only checkout — skip.
[ "$flag" = "1" ] || exit 0

gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
marker="$gitdir/info/.gsd-beads-configured"
[ -f "$marker" ] && exit 0

# git-common-dir resolves to the source repo's .git/ even from a worktree.
# Source repo's .beads/ is one directory up from .git/.
common=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0
source_root="$(dirname "$(cd "$common" && pwd -P)")"
source_beads="$source_root/.beads"

if [ ! -d "$source_beads" ]; then
  printf '[gsd-beads] ⚠ Source repo at %s has no .beads/ — run `bd init` in source first\n' "$source_root" >&2
  exit 0
fi

# Persist the discovery into per-worktree git config.
git config --worktree gsd-beads.dir "$source_beads" 2>/dev/null || \
  git config gsd-beads.dir "$source_beads"

mkdir -p "$gitdir/info"
touch "$marker"
printf '[gsd-beads] ✓ Worktree configured (gsd-beads.dir=%s)\n' "$source_beads"
# --- END GSD-BEADS WORKTREE INIT ---
