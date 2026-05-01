#!/usr/bin/env bash
# idempotency.test.sh — REQ-06 idempotency verification
# Tests that running install.sh twice produces the same state as running it once.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# Setup a sandbox HOME with bd/jq/node/git available
BD_REAL="$(command -v bd)"
JQ_REAL="$(command -v jq)"
NODE_REAL="$(command -v node)"
GIT_REAL="$(command -v git)"

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/.local/bin" "$SANDBOX/.claude" "$SANDBOX/stub-tools"
ln -sf "$BD_REAL"   "$SANDBOX/stub-tools/bd"
ln -sf "$JQ_REAL"   "$SANDBOX/stub-tools/jq"
ln -sf "$NODE_REAL" "$SANDBOX/stub-tools/node"
ln -sf "$GIT_REAL"  "$SANDBOX/stub-tools/git"

saved_home="$HOME"
export HOME="$SANDBOX"
TEST_PATH="$SANDBOX/.local/bin:$SANDBOX/stub-tools:/usr/local/bin:/usr/bin:/bin"

# First install
PATH="$TEST_PATH" bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

# CASE 1: snapshot ~/.claude/settings.json after first install, run install again, settings must not change
snapshot1="$(sha256sum "$SANDBOX/.claude/settings.json" | awk '{print $1}')"
PATH="$TEST_PATH" bash "$REPO_ROOT/install.sh" >/dev/null 2>&1
snapshot2="$(sha256sum "$SANDBOX/.claude/settings.json" | awk '{print $1}')"
if [ "$snapshot1" = "$snapshot2" ]; then
  _pass "CASE 1: settings.json unchanged after second install (hash stable)"
else
  _fail "CASE 1: settings.json hash changed: before=$snapshot1 after=$snapshot2"
fi

# CASE 2: marker block in .beads/hooks/post-checkout count == 1 after running the append logic twice
# This replicates install.sh's Step 6 append logic directly (since full install requires a real bd project)
target="$SANDBOX/fake-checkout"
printf '#!/usr/bin/env bash\n' > "$target"
chmod +x "$target"

# Helper replicating install.sh's atomic append step (Step 6)
append_shim_once() {
  local pc_target="$1"
  local tmp_pc
  tmp_pc="$(mktemp)"
  sed '/^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$/,/^# --- END GSD-BEADS WORKTREE INIT ---$/d' \
    "$pc_target" > "$tmp_pc"
  cat "$REPO_ROOT/hooks/worktree-post-checkout.sh" >> "$tmp_pc"
  mv "$tmp_pc" "$pc_target"
  chmod +x "$pc_target"
}

append_shim_once "$target"
append_shim_once "$target"

begin_count=$({ grep -c 'BEGIN GSD-BEADS WORKTREE INIT v1' "$target" 2>/dev/null || echo 0; } || echo 0)
if [ "$begin_count" = "1" ]; then
  _pass "CASE 2: exactly 1 sentinel block in post-checkout after two appends (count=$begin_count)"
else
  _fail "CASE 2: expected 1 sentinel block after double-append, got $begin_count"
fi

# CASE 3: ~/.local/bin/gsd-sdk symlink exists and points at the same target after both runs
symlink="$SANDBOX/.local/bin/gsd-sdk"
if [ -L "$symlink" ]; then
  target1="$(readlink "$symlink")"
  PATH="$TEST_PATH" bash "$REPO_ROOT/install.sh" >/dev/null 2>&1
  target2="$(readlink "$symlink")"
  if [ "$target1" = "$target2" ]; then
    _pass "CASE 3: symlink target stable after second install ($target1)"
  else
    _fail "CASE 3: symlink target changed: before=$target1 after=$target2"
  fi
else
  _fail "CASE 3: $symlink is not a symlink after install"
fi

# CASE 4: 8 bd memories present after both runs (idempotent forget+remember)
# Memory #8 `gsd-beads:worktrees` added by Phase 03 Plan 03-03.
# bd memories output uses 2-space-indented keys; tighter regex avoids counting value lines
# that contain a literal `gsd-beads:` substring (pre-existing dev-env stray-key guard).
count=$({ bd memories 2>/dev/null | grep -cE '^  gsd-beads:'; } || echo 0)
if [ "$count" = "8" ]; then
  _pass "CASE 4: exactly 8 gsd-beads:* memories after second install (count=$count)"
else
  _fail "CASE 4: expected 8 gsd-beads:* memories, got $count"
fi

export HOME="$saved_home"

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
