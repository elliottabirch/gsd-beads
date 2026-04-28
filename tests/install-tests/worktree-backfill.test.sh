#!/usr/bin/env bash
# tests/install-tests/worktree-backfill.test.sh
# Verifies install.sh enumerates pre-existing worktrees and fires the shim
# against each (D-08). Tests the canonical backfill loop in install.sh Step 6.5.
#
# CASE 1: install.sh backfills 2 pre-existing worktrees → both gain
#         per-worktree gsd-beads.dir config + .gsd-beads-configured marker.
# CASE 2: re-running install.sh is idempotent → markers persist, no errors.
# CASE 3: bare worktree records are skipped by the awk parser.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
pass=0; fail=0
_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# --- Helper: build a sandbox source repo + N worktrees BEFORE install.sh runs ---
make_sandbox_with_worktrees() {
  local sandbox="$1" n_worktrees="$2"
  mkdir -p "$sandbox/source"
  (
    cd "$sandbox/source"
    git init -q
    git config user.email "backfill@test.local"
    git config user.name "Backfill Test"
    git config extensions.worktreeConfig true
    git commit -q --allow-empty -m "init"
    bd init --non-interactive --skip-agents >/dev/null 2>&1 || true
  )
  # Create N pre-existing worktrees BEFORE install.sh runs (so they have NO marker yet).
  local i
  for i in $(seq 1 "$n_worktrees"); do
    git -C "$sandbox/source" worktree add "$sandbox/wt-$i" -b "branch-$i" >/dev/null 2>&1
  done
}

# Run install.sh in a sandboxed HOME so install side-effects don't leak.
run_install_in_sandbox() {
  local sandbox="$1"
  local saved_home="$HOME"
  export HOME="$sandbox/.home"
  mkdir -p "$HOME/.claude" "$HOME/.local/bin"
  (
    cd "$sandbox/source"
    bash "$REPO_ROOT/install.sh" >"$sandbox/install.log" 2>&1
  ) || true
  export HOME="$saved_home"
}

# === CASE 1: install.sh backfills 2 pre-existing worktrees ===
sandbox=$(mktemp -d /tmp/gsd-beads-backfill.XXXXXX)
saved_home="$HOME"
trap 'export HOME="$saved_home"; for wt in "$sandbox/source" "$sandbox/wt-1" "$sandbox/wt-2"; do git -C "$sandbox/source" worktree remove --force "$wt" 2>/dev/null || true; done; rm -rf "$sandbox" "${sandbox3:-}"' EXIT

make_sandbox_with_worktrees "$sandbox" 2
run_install_in_sandbox "$sandbox"

# Assert both worktrees gained the per-worktree config + marker.
for i in 1 2; do
  wt="$sandbox/wt-$i"
  gitdir=$(git -C "$wt" rev-parse --git-dir 2>/dev/null || echo "")
  if [ -n "$gitdir" ]; then
    case "$gitdir" in
      /*) abs_gitdir="$gitdir" ;;
      *)  abs_gitdir="$wt/$gitdir" ;;
    esac
  else
    abs_gitdir=""
  fi
  marker_path="$abs_gitdir/info/.gsd-beads-configured"
  config_val=$(git -C "$wt" config --worktree --get gsd-beads.dir 2>/dev/null \
    || git -C "$wt" config --get gsd-beads.dir 2>/dev/null \
    || echo "MISSING")
  if [ -f "$marker_path" ]; then
    _pass "CASE 1.$i.a: worktree $i has marker at $marker_path"
  else
    _fail "CASE 1.$i.a: worktree $i missing marker at $marker_path"
  fi
  if [ "$config_val" = "$sandbox/source/.beads" ]; then
    _pass "CASE 1.$i.b: worktree $i has gsd-beads.dir=$config_val"
  else
    _fail "CASE 1.$i.b: worktree $i config wrong: '$config_val' (expected '$sandbox/source/.beads')"
  fi
done

# === CASE 2: re-running install.sh is idempotent ===
run_install_in_sandbox "$sandbox"
for i in 1 2; do
  wt="$sandbox/wt-$i"
  gitdir=$(git -C "$wt" rev-parse --git-dir 2>/dev/null || echo "")
  case "$gitdir" in
    /*) abs_gitdir="$gitdir" ;;
    *)  abs_gitdir="$wt/$gitdir" ;;
  esac
  marker_path="$abs_gitdir/info/.gsd-beads-configured"
  if [ -f "$marker_path" ]; then
    _pass "CASE 2.$i: worktree $i marker still present after re-install (idempotent)"
  else
    _fail "CASE 2.$i: worktree $i marker disappeared after re-install"
  fi
done

# === CASE 3: bare worktree record is skipped by awk parser ===
# Build a separate sandbox with a bare clone + linked worktree (which produces a 'bare' line).
sandbox3=$(mktemp -d /tmp/gsd-beads-backfill-bare.XXXXXX)

# Build a non-bare source first for cloning.
mkdir -p "$sandbox3/origin"
(
  cd "$sandbox3/origin"
  git init -q
  git config user.email "bare@test.local"
  git config user.name "Bare Test"
  git commit -q --allow-empty -m "init"
)
# Make a bare clone + add a linked worktree (produces a 'bare' record on the bare side).
git clone --bare "$sandbox3/origin" "$sandbox3/source-bare" >/dev/null 2>&1
git -C "$sandbox3/source-bare" worktree add "$sandbox3/wt-from-bare" -b feature >/dev/null 2>&1 || true

# CASE 3.a: bare line observable in --porcelain output (fixture sanity check).
if git -C "$sandbox3/source-bare" worktree list --porcelain | grep -q '^bare$'; then
  _pass "CASE 3.a: bare worktree record observable in --porcelain output"
else
  _fail "CASE 3.a: bare worktree record NOT observable — fixture broken"
fi

# CASE 3.b: install.sh's awk parser contains the bare-skip rule (grep-level guard).
if grep -F '/^bare$/' "$REPO_ROOT/install.sh" >/dev/null; then
  _pass "CASE 3.b: install.sh awk parser contains bare-skip rule"
else
  _fail "CASE 3.b: install.sh awk parser missing bare-skip rule"
fi

# CASE 3.c: install.sh's awk parser contains the prunable-skip rule.
if grep -F '/^prunable/' "$REPO_ROOT/install.sh" >/dev/null; then
  _pass "CASE 3.c: install.sh awk parser contains prunable-skip rule"
else
  _fail "CASE 3.c: install.sh awk parser missing prunable-skip rule"
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
