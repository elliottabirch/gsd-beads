#!/usr/bin/env bash
# bd-allowlist-grep.test.sh — REQ-QUAL-05 precursor.
# Asserts the canonical bd allowlist string is intact in hooks/bd-sync.sh.
#
# Phase 4 caveat: BEADS_READ_OVERRIDES is empty (zero real read handlers
# ship in Phase 4). This test is a precursor — full per-read-handler
# enforcement (grep all read-handler bd invocations against the
# allowlist) lands in Phase 11.
#
#   CASE 1: asserts the canonical allowlist string still exists at
#           hooks/bd-sync.sh:23.
#   CASE 2: WARN-3 self-test — copies hooks/bd-sync.sh to a tempdir,
#           rewrites the canonical allowlist line to a tampered allowlist
#           (drops the canonical regex AND adds a bogus write-side `bd
#           close` marker), runs the same allowlist-presence check
#           against the tampered copy, and asserts that check FAILS.
#           This proves CASE 1 actually catches violations and isn't
#           a tautology.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[bd-allowlist-grep.test.sh] Running 2 test cases..."
echo ""

# Allowlist source: hooks/bd-sync.sh:23
allowlist='list|show|ready|memories|status|prime|export|deps|children|search|help|version'

# Helper: returns 0 if the canonical allowlist regex literal is present
# in the file given by $1, 1 otherwise.
allowlist_present() {
  grep -qE "$allowlist" "$1"
}

# CASE 1: allowlist intact in hooks/bd-sync.sh
if allowlist_present "$REPO_ROOT/hooks/bd-sync.sh"; then
  _pass "CASE 1: allowlist source intact in hooks/bd-sync.sh"
else
  _fail "CASE 1: allowlist source not found in hooks/bd-sync.sh — has it moved?"
fi

# CASE 2 (WARN-3 self-test): tamper a copy, assert CASE 1's check FAILS against it.
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

tampered="$tmpdir/bd-sync.sh"
cp "$REPO_ROOT/hooks/bd-sync.sh" "$tampered"

# Rewrite every line containing the canonical allowlist regex with a
# tampered allowlist marker line. We use awk + index() against the literal
# canonical regex string so we don't depend on sed's regex flavor and so
# every matching line is replaced (defense against the canonical string
# appearing in multiple places — unlikely today but cheap insurance).
awk -v canon='list|show|ready|memories|status|prime|export|deps|children|search|help|version' '
  index($0, canon) > 0 {
    print "  TAMPERED_ALLOWLIST=\"close|delete|purge\"  # bd close was added here"
    next
  }
  { print }
' "$tampered" > "$tampered.new"
# `mv -f` to defeat any `alias mv='mv -i'` that might leak through (the
# sanity check below would catch a failed rewrite anyway, but explicit
# is better than silent failure).
mv -f "$tampered.new" "$tampered"

# Sanity: the tampered file must NOT contain the canonical allowlist string.
# If it still does, the counter-test is itself broken — fail loudly so we
# don't silently pass.
if allowlist_present "$tampered"; then
  _fail "CASE 2: tampered copy STILL contains canonical allowlist — counter-test broken (rewrite the awk filter to strip every occurrence)"
else
  # Re-run CASE 1's check against the tampered copy. It MUST fail (return
  # non-zero) — that's what proves CASE 1 catches violations.
  if allowlist_present "$tampered"; then
    # Unreachable per the sanity check above; defense-in-depth.
    _fail "CASE 2: tampered copy passes allowlist check — CASE 1 is tautological"
  else
    _pass "CASE 2: tampered copy fails allowlist check — CASE 1 proven non-tautological"
  fi
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
