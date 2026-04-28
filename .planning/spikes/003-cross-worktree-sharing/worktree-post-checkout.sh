#!/usr/bin/env sh
# gsd-beads worktree-init shim. Designed to be appended to the
# bd-managed `.beads/hooks/post-checkout` script (which itself is
# wrapped by `.git/hooks/post-checkout` via core.hooksPath).
#
# Sentinel-marked so gsd-beads' install/uninstall can manage it cleanly
# without disturbing bd's own integration block.
#
# Job: when `git worktree add <path>` creates a new worktree, persist
# the source repo's .beads/ location into that worktree's per-worktree
# git config (`git config --worktree gsd-beads.dir <path>`) so any
# wrapper or env-var loader knows where the canonical store lives.
# Idempotent via a marker file in the worktree's git-dir.

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
