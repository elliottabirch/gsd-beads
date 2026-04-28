#!/usr/bin/env bash
# tests/cross-worktree/lib/setup.sh
# Pure-function library for cross-worktree integration tests.
# Sourced by simulation.sh and worktree-backfill.test.sh.
#
# Functions defined:
#   mk_source_repo   <dir>                            -> bootstraps a beads-managed source repo
#   mk_worktree      <source_dir> <wt_path> <branch>  -> creates a worktree (post-checkout fires)
#   bd_in_worktree   <wt_path> <bd args...>           -> runs bd from a worktree, scoped to source .beads/
#   cleanup_sandbox  <root>                           -> tears down all worktrees + the sandbox tree
#
# Conventions:
#   - All functions use BEADS_DIR scoped explicitly to the sandbox source repo so the
#     dev's real bd store is never touched (T-03-06 mitigation).
#   - mk_source_repo creates `.planning/` so regen-roadmap.sh / regen-requirements.sh's
#     mktemp+mv pattern succeeds in the sandbox (the production source always has it).
#   - The shim is appended into `.beads/hooks/post-checkout` so subsequent
#     `git worktree add` invocations auto-configure the new worktree (mirrors install.sh Step 6).

# Bail-out under set -u if SHIM_REPO_ROOT not provided by the caller; default to repo root if invoked standalone.
: "${SHIM_REPO_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

# ---------------------------------------------------------------------------
# mk_source_repo <dir>
# Creates a fresh beads-managed source repo at $dir with the gsd-beads worktree
# shim appended to .beads/hooks/post-checkout (so subsequent `git worktree add`
# invocations auto-configure the new worktree).
# ---------------------------------------------------------------------------
mk_source_repo() {
  local dir="$1"
  mkdir -p "$dir"
  (
    cd "$dir"
    git init -q
    git config user.email "cross-worktree@test.local"
    git config user.name "Cross Worktree Test"
    git config extensions.worktreeConfig true
    git commit -q --allow-empty -m "init"
    bd init --non-interactive --skip-agents >/dev/null 2>&1 || return 1
    # Production source always has .planning/ — ensure regen-* scripts can mv into it.
    mkdir -p "$dir/.planning"
    # Append the worktree shim into .beads/hooks/post-checkout (mirrors install.sh Step 6).
    local target="$dir/.beads/hooks/post-checkout"
    mkdir -p "$(dirname "$target")"
    [ -f "$target" ] || { printf '#!/usr/bin/env bash\n' > "$target"; chmod +x "$target"; }
    cat "$SHIM_REPO_ROOT/hooks/worktree-post-checkout.sh" >> "$target"
    chmod +x "$target"
    git -C "$dir" config core.hooksPath .beads/hooks
  )
}

# ---------------------------------------------------------------------------
# mk_worktree <source_dir> <wt_path> <branch_name>
# Adds a new worktree at $wt_path, checking out a new branch $branch_name.
# Triggers post-checkout (which fires the appended shim → wt gets gsd-beads.dir + marker).
# ---------------------------------------------------------------------------
mk_worktree() {
  local source_dir="$1" wt_path="$2" branch="$3"
  git -C "$source_dir" worktree add "$wt_path" -b "$branch" 2>&1 | grep -v '^Preparing\|^HEAD' || true
}

# ---------------------------------------------------------------------------
# bd_in_worktree <wt_path> <bd args...>
# Runs `bd <args>` from inside $wt_path with BEADS_DIR scoped to the source repo's .beads/.
# Resolves source via `git rev-parse --git-common-dir` (matches the post-checkout shim).
# ---------------------------------------------------------------------------
bd_in_worktree() {
  local wt_path="$1"; shift
  local common source_root source_beads
  common=$(git -C "$wt_path" rev-parse --git-common-dir 2>/dev/null) || return 1
  source_root="$(dirname "$(cd "$wt_path/$common" 2>/dev/null && pwd -P || cd "$common" && pwd -P)")"
  source_beads="$source_root/.beads"
  ( cd "$wt_path" && BEADS_DIR="$source_beads" bd "$@" )
}

# ---------------------------------------------------------------------------
# cleanup_sandbox <root>
# Removes all worktrees registered to a sandbox source repo, then deletes the tree.
# Used in `trap EXIT` so the dev's filesystem stays clean even on test abort.
# ---------------------------------------------------------------------------
cleanup_sandbox() {
  local root="$1"
  [ -d "$root" ] || return 0
  # If $root/source exists and is a git repo, prune its worktrees first.
  if [ -d "$root/source/.git" ] || [ -f "$root/source/.git" ]; then
    git -C "$root/source" worktree list --porcelain 2>/dev/null \
      | awk '/^worktree / { print substr($0, 10) }' \
      | while IFS= read -r wt; do
          [ "$wt" = "$root/source" ] && continue
          git -C "$root/source" worktree remove --force "$wt" 2>/dev/null || true
        done
  fi
  rm -rf "$root" 2>/dev/null || true
}
