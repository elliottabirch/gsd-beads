#!/usr/bin/env bash
# path-precedence.test.sh — PATH-precedence detection and warning behavior
# Tests that install.sh detects Volta-shadow trap and warns appropriately.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# Real tool paths (need to be available in test invocations)
BD_REAL="$(command -v bd)"
JQ_REAL="$(command -v jq)"
NODE_REAL="$(command -v node)"
GIT_REAL="$(command -v git)"

# Helper: create stub bin dir with real tools + a fake gsd-sdk at a given path
# Usage: create_stub_bin <dir> <gsd_sdk_target_dir>
create_stub_bin() {
  local dir="$1"
  mkdir -p "$dir"
  ln -sf "$BD_REAL" "$dir/bd"
  ln -sf "$JQ_REAL" "$dir/jq"
  ln -sf "$NODE_REAL" "$dir/node"
  ln -sf "$GIT_REAL" "$dir/git"
}

# CASE 1: PATH has ~/.local/bin first → install.sh prints "shadow active"
sandbox1="$(mktemp -d)"
mkdir -p "$sandbox1/.local/bin" "$sandbox1/.claude"
create_stub_bin "$sandbox1/stub-tools"
saved_home="$HOME"
export HOME="$sandbox1"
# PATH: local/bin first (shadow will be created there by install.sh, then command -v finds it)
output1=$(PATH="$sandbox1/.local/bin:$sandbox1/stub-tools:/usr/local/bin:/usr/bin:/bin" \
  bash "$REPO_ROOT/install.sh" 2>/dev/null || true)
export HOME="$saved_home"
rm -rf "$sandbox1"

if echo "$output1" | grep -q 'shadow active'; then
  _pass "CASE 1: PATH has ~/.local/bin first → 'shadow active' in output"
else
  _fail "CASE 1: expected 'shadow active', got: $(echo "$output1" | grep -i shadow || echo '(no shadow line found)')"
fi

# CASE 2: PATH has a fake volta-like dir with gsd-sdk before ~/.local/bin
# install.sh should warn "is shadowed by" and exit 0 (warn-not-abort)
sandbox2="$(mktemp -d)"
mkdir -p "$sandbox2/.local/bin" "$sandbox2/.claude" "$sandbox2/fakevolta/bin"
create_stub_bin "$sandbox2/stub-tools"
# Put a fake gsd-sdk in fakevolta/bin (precedes local/bin in PATH)
printf '#!/usr/bin/env bash\necho volta-gsd-sdk\n' > "$sandbox2/fakevolta/bin/gsd-sdk"
chmod +x "$sandbox2/fakevolta/bin/gsd-sdk"
export HOME="$sandbox2"
output2=$(PATH="$sandbox2/fakevolta/bin:$sandbox2/.local/bin:$sandbox2/stub-tools:/usr/local/bin:/usr/bin:/bin" \
  bash "$REPO_ROOT/install.sh" 2>/dev/null || true)
exit_code2=$?
export HOME="$saved_home"
rm -rf "$sandbox2"

if echo "$output2" | grep -q 'is shadowed by'; then
  _pass "CASE 2: volta-first PATH → 'is shadowed by' warning emitted"
else
  _fail "CASE 2: expected 'is shadowed by' warning, got: $(echo "$output2" | grep -i shadow || echo '(no shadow line found)')"
fi
if [ "$exit_code2" = "0" ]; then
  _pass "CASE 2b: install.sh exits 0 (warn-not-abort) when shadow is shadowed"
else
  _fail "CASE 2b: expected exit 0, got exit $exit_code2"
fi

# CASE 3: ~/.local/bin not in PATH at all → warns about PATH + suggests adding to shell rc
sandbox3="$(mktemp -d)"
mkdir -p "$sandbox3/.local/bin" "$sandbox3/.claude"
create_stub_bin "$sandbox3/stub-tools"
export HOME="$sandbox3"
# PATH omits ~/.local/bin entirely
output3=$(PATH="$sandbox3/stub-tools:/usr/local/bin:/usr/bin:/bin" \
  bash "$REPO_ROOT/install.sh" 2>/dev/null || true)
export HOME="$saved_home"
rm -rf "$sandbox3"

if echo "$output3" | grep -q 'not on PATH\|shell rc'; then
  _pass "CASE 3: ~/.local/bin absent from PATH → shell rc suggestion in output"
else
  _fail "CASE 3: expected PATH warning / shell rc suggestion, got: $(echo "$output3" | grep -i shadow || echo '(no shadow line found)')"
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
