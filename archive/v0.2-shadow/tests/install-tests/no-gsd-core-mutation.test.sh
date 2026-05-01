#!/usr/bin/env bash
# no-gsd-core-mutation.test.sh — T-02-09 mitigation
# Verifies install.sh never writes under ~/.claude/get-shit-done/ (REQ-02).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# CASE 1: static grep guard — install.sh must not reference the gsd core path
if grep -qE '(~|/home/[^/]+)/\.claude/get-shit-done|\.claude/get-shit-done/' "$REPO_ROOT/install.sh" 2>/dev/null; then
  _fail "CASE 1: install.sh references gsd core path (REQ-02 violation)"
else
  _pass "CASE 1: install.sh has no reference to gsd core path"
fi

# CASE 2: sentinel sandbox test — run install in isolated HOME, verify sentinel file untouched
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.claude/get-shit-done"
sentinel="$SANDBOX/.claude/get-shit-done/SENTINEL"
echo "untouched" > "$sentinel"
chmod 444 "$sentinel"
# Record mtime before install
sent_mtime_before=$(stat -c %Y "$sentinel" 2>/dev/null || stat -f %m "$sentinel" 2>/dev/null)
# Run install in sandbox HOME (bd will have its own home, but HOME affects mkdir/ln/cp)
# We export HOME so install.sh writes to sandbox; bd still uses real BD home (ok for this test)
export HOME="$SANDBOX"
mkdir -p "$SANDBOX/.local/bin"
# install.sh will fail on settings merge if fragment path wrong — capture exit but check sentinel only
bash "$REPO_ROOT/install.sh" >/dev/null 2>&1 || true
sent_mtime_after=$(stat -c %Y "$sentinel" 2>/dev/null || stat -f %m "$sentinel" 2>/dev/null)

if [ "$sent_mtime_before" = "$sent_mtime_after" ]; then
  _pass "CASE 2: sentinel file untouched by install.sh"
else
  _fail "CASE 2: sentinel file was modified by install.sh (REQ-02 violation)"
fi

# CASE 3: cross-grep — no other test files reference gsd core path (excluding this file)
this_file="$(realpath "$0")"
violations="$(grep -rlE '\.claude/get-shit-done' "$REPO_ROOT/tests/install-tests/" 2>/dev/null \
              | grep -v "$(basename "$this_file")" || true)"
if [ -n "$violations" ]; then
  _fail "CASE 3: other test files reference gsd core path: $violations"
else
  _pass "CASE 3: no cross-references to gsd core path in install-tests/"
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
