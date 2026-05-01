#!/usr/bin/env bash
# upstream-version-pin.test.sh — D-10 lockfile drift detection.
# Asserts gsd-sdk-cc.version.lock matches what the installed upstream
# gsd-sdk binary reports.
#
# Important: this script invokes the UPSTREAM binary directly (not the
# `gsd-sdk` PATH-shim), to avoid recursing through the gsd-beads shadow
# during version checks. The shadow forwards `--version` to upstream
# anyway, but pinning to the upstream binary directly keeps the contract
# explicit and immune to PATH shuffling.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOCK="$REPO_ROOT/gsd-sdk-cc.version.lock"

# Upstream binary discovery — mirrors bin/gsd-sdk-shadow.mjs SDK_BASE pattern.
SDK_BASE="${GSD_SDK_PATH:-$HOME/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc}"
UPSTREAM_BIN="${GSD_SDK_UPSTREAM_BIN:-$SDK_BASE/bin/gsd-sdk.js}"

pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[upstream-version-pin.test.sh] Running 2 test cases..."
echo ""

# CASE 1: lockfile exists and is non-empty
if [ ! -s "$LOCK" ]; then
  _fail "CASE 1: $LOCK missing or empty"
else
  _pass "CASE 1: $LOCK present and non-empty"
fi

# CASE 2: lockfile matches installed gsd-sdk version
expected=$(head -1 "$LOCK" | tr -d '[:space:]')
if [ ! -x "$UPSTREAM_BIN" ]; then
  _fail "CASE 2: upstream binary not found at $UPSTREAM_BIN (set GSD_SDK_PATH or GSD_SDK_UPSTREAM_BIN)"
else
  actual=$("$UPSTREAM_BIN" --version 2>/dev/null || true)
  actual_semver=$(printf '%s' "$actual" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -z "$actual_semver" ]; then
    _fail "CASE 2: upstream gsd-sdk --version returned no parseable semver (got: $actual)"
  elif [ "$expected" = "$actual_semver" ]; then
    _pass "CASE 2: lockfile $expected matches installed $actual_semver"
  else
    _fail "CASE 2: drift — lockfile=$expected, installed=$actual_semver"
  fi
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
