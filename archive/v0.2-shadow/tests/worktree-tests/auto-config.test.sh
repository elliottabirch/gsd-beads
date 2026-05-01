#!/usr/bin/env bash
# Tests for hooks/worktree-post-checkout.sh — auto-configuration of new worktrees.
# CASE 1: git worktree add in beads-managed source → new wt has git config --worktree gsd-beads.dir set
# CASE 2: marker file <wt-gitdir>/info/.gsd-beads-configured exists after first checkout
# CASE 3: re-checkout in same worktree (e.g., git checkout other-branch) → script no-ops (marker present)
# CASE 4: source repo lacks .beads/ → script emits warning to stderr, exits 0 cleanly (no abort)
# CASE 5: flag=0 (file checkout, not worktree-add) → script no-ops
set -euo pipefail

SHIM="$(cd "$(dirname "$0")/../.." && pwd)/hooks/worktree-post-checkout.sh"

if [ ! -f "$SHIM" ]; then
  echo "ERROR: shim not found at $SHIM" >&2
  exit 1
fi

pass=0
fail=0

case_run() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    status=PASS
    pass=$((pass + 1))
  else
    status=FAIL
    fail=$((fail + 1))
  fi
  printf '  [%s] %-60s expected=%-30s actual=%s\n' "$status" "$name" "$expected" "$actual"
}

# Helper to make a git repo with worktreeConfig enabled and .beads/hooks/post-checkout + shim appended
make_fixture() {
  local dir="$1"
  cd "$dir"
  git init -q
  git config user.email "test@test.com"
  git config user.name "Test"
  # Enable per-worktree config so git config --worktree works correctly
  git config extensions.worktreeConfig true
  git commit -q --allow-empty -m "init"
}

append_shim_to_fixture() {
  local dir="$1"
  local post_checkout="$dir/.beads/hooks/post-checkout"
  mkdir -p "$(dirname "$post_checkout")"
  if [ ! -f "$post_checkout" ]; then
    echo '#!/usr/bin/env bash' > "$post_checkout"
  fi
  cat "$SHIM" >> "$post_checkout"
  chmod +x "$post_checkout"
  git -C "$dir" config core.hooksPath .beads/hooks
}

# --- CASE 1 + 2 + 3: fixture with .beads/ ---
fixture=$(mktemp -d /tmp/gsdtest.XXXXXX)
wt_path=$(mktemp -d /tmp/gsdwt.XXXXXX)
rm -rf "$wt_path"

cleanup() {
  cd /tmp
  git -C "$fixture" worktree remove --force "$wt_path" 2>/dev/null || true
  rm -rf "$fixture" "$wt_path" 2>/dev/null || true
}
trap cleanup EXIT

make_fixture "$fixture"
mkdir -p "$fixture/.beads"
append_shim_to_fixture "$fixture"
cd "$fixture"

# Create a detached worktree (triggers post-checkout with flag=1)
git worktree add --detach "$wt_path" 2>/dev/null

cd "$wt_path"

# CASE 1: gsd-beads.dir is set to source/.beads
got=$(git config --worktree --get gsd-beads.dir 2>/dev/null || git config --get gsd-beads.dir 2>/dev/null || echo "MISSING")
case_run "CASE 1: worktree add sets gsd-beads.dir" "$fixture/.beads" "$got"

# CASE 2: marker file exists
wt_gitdir=$(git rev-parse --git-dir)
marker_status="$([ -f "$wt_gitdir/info/.gsd-beads-configured" ] && echo "yes" || echo "no")"
case_run "CASE 2: marker file .gsd-beads-configured present" "yes" "$marker_status"

# CASE 3: re-running shim (marker present) → no-ops, exits 0
# Remove config to verify it does NOT get re-written
git config --worktree --unset gsd-beads.dir 2>/dev/null || git config --unset gsd-beads.dir 2>/dev/null || true
# Run shim — marker is present, should exit 0 without touching config
bash "$SHIM" "aaa" "bbb" "1" 2>/dev/null
config_after_noop=$(git config --worktree --get gsd-beads.dir 2>/dev/null || git config --get gsd-beads.dir 2>/dev/null || echo "NOT_SET")
case_run "CASE 3: re-run with marker exits 0, config unchanged (not reset)" "NOT_SET" "$config_after_noop"

# --- CASE 4: source repo lacks .beads/ ---
fixture2=$(mktemp -d /tmp/gsdtest.XXXXXX)
cleanup2() {
  rm -rf "$fixture2" 2>/dev/null || true
}
trap "cleanup; cleanup2" EXIT

cd "$fixture2"
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git commit -q --allow-empty -m "init"
git config extensions.worktreeConfig true
# NO .beads/ dir

# Remove marker if any
mkdir -p "$(git rev-parse --git-dir)/info"
rm -f "$(git rev-parse --git-dir)/info/.gsd-beads-configured"

stderr_output=$(bash "$SHIM" "aaa" "bbb" "1" 2>&1 1>/dev/null || true)
case_run "CASE 4: no .beads/ → stderr warning contains 'no .beads/'" "yes" \
  "$(echo "$stderr_output" | grep -q 'no .beads/' && echo yes || echo no)"

# --- CASE 5: flag=0 (file checkout) → script exits 0 silently, no marker created ---
fixture3=$(mktemp -d /tmp/gsdtest.XXXXXX)
cleanup3() {
  rm -rf "$fixture3" 2>/dev/null || true
}
trap "cleanup; cleanup2; cleanup3" EXIT

cd "$fixture3"
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git commit -q --allow-empty -m "init"
git config extensions.worktreeConfig true
mkdir -p .beads

# Run shim with flag=0 (file checkout — should no-op)
mkdir -p "$(git rev-parse --git-dir)/info"
rm -f "$(git rev-parse --git-dir)/info/.gsd-beads-configured"
bash "$SHIM" "aaa" "bbb" "0" 2>/dev/null
marker_after_flag0="$([ -f "$(git rev-parse --git-dir)/info/.gsd-beads-configured" ] && echo "yes" || echo "no")"
case_run "CASE 5: flag=0 → no-op, marker NOT created" "no" "$marker_after_flag0"

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
