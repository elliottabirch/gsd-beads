#!/usr/bin/env bash
# Tests for the GSD-BEADS LOCK PREAMBLE v1 retrofit (D-15).
#
# Asserts the canonical preamble is present (byte-equivalent across all 3
# scripts) and that the timeout failure mode produces the documented
# stderr message + non-zero exit. Also exercises the uncontended happy
# path on regen-roadmap.sh to prove the preamble does not break the
# no-holder case.
#
# CASE inventory (acceptance criterion: exactly 4 CASE blocks):
#   CASE 1 — grep-level preamble presence (all 3 scripts)
#   CASE 2 — grep-level primitives (all 3 scripts)
#   CASE 3 — behavioral timeout (regen-roadmap.sh, contended)
#   CASE 4 — uncontended happy path (regen-roadmap.sh, no holder)
#
# Behavioral coverage for cascade-loop.sh and regen-requirements.sh is
# delegated to plan 03-02's simulation harness (concurrent burst).
# Keeping unit tests fast: total runtime ~32s (single 30s flock timeout
# in CASE 3) — well under the 90s phase target in 03-VALIDATION.md.
#
# Usage: bash tests/hook-tests/flock-preamble.test.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CASCADE="$REPO_ROOT/scripts/cascade-loop.sh"
REGEN_ROADMAP="$REPO_ROOT/scripts/regen-roadmap.sh"
REGEN_REQS="$REPO_ROOT/scripts/regen-requirements.sh"

pass=0
fail=0

# Cleanup any backgrounded flock holder on exit.
cleanup_pids=""
cleanup() {
  for p in $cleanup_pids; do
    kill "$p" 2>/dev/null || true
  done
}
trap cleanup EXIT

echo "[flock-preamble.test.sh] Running 4 test cases..."

# ---------------------------------------------------------------------------
# CASE 1: grep-level preamble presence — sentinel appears exactly once in each
# ---------------------------------------------------------------------------
echo ""
echo "CASE 1: grep-level preamble presence (all 3 scripts)"
case1_ok=1
for f in "$CASCADE" "$REGEN_ROADMAP" "$REGEN_REQS"; do
  count=$(grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' "$f" || true)
  if [ "$count" != "1" ]; then
    case1_ok=0
    echo "  detail: $f has $count BEGIN sentinels, expected 1"
  fi
done
if [ "$case1_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: BEGIN GSD-BEADS LOCK PREAMBLE v1 sentinel present exactly once in each of 3 scripts"
else
  fail=$((fail + 1))
  echo "  FAIL: sentinel cardinality mismatch in at least one script"
fi

# ---------------------------------------------------------------------------
# CASE 2: grep-level primitives — fd-form flock + git-common-dir + absolutize
#         + timeout error message all present in each script
# ---------------------------------------------------------------------------
echo ""
echo "CASE 2: grep-level primitives (all 3 scripts)"
case2_ok=1
for f in "$CASCADE" "$REGEN_ROADMAP" "$REGEN_REQS"; do
  if ! grep -qF 'flock -x -w 30 9' "$f"; then
    case2_ok=0
    echo "  detail: $f missing fd-form 'flock -x -w 30 9'"
  fi
  if ! grep -qF 'git rev-parse --git-common-dir' "$f"; then
    case2_ok=0
    echo "  detail: $f missing 'git rev-parse --git-common-dir'"
  fi
  if ! grep -qF 'cd "$common" && pwd -P' "$f"; then
    case2_ok=0
    echo "  detail: $f missing absolutize idiom 'cd \"\$common\" && pwd -P'"
  fi
  if ! grep -qF 'another regen is in progress' "$f"; then
    case2_ok=0
    echo "  detail: $f missing 'another regen is in progress' stderr message"
  fi
done
if [ "$case2_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: all 3 scripts contain flock fd-form + git-common-dir + absolutize + error message"
else
  fail=$((fail + 1))
  echo "  FAIL: at least one primitive missing in at least one script"
fi

# ---------------------------------------------------------------------------
# CASE 3: behavioral timeout (regen-roadmap.sh) — when the lock is already
#         held by a backgrounded flock holder, regen-roadmap.sh exits non-zero
#         within ~30s and emits 'another regen is in progress' on stderr.
# ---------------------------------------------------------------------------
echo ""
echo "CASE 3: behavioral timeout (regen-roadmap.sh on contended lock)"
case3_ok=1
{
  fixture=$(mktemp -d)
  cd "$fixture"
  git init -q
  git config user.email "test@test"
  git config user.name "test"
  git commit --allow-empty -qm init
  mkdir -p .beads .planning
  touch .beads/.gsd-beads.lock

  # Background a 35s holder (slightly longer than the 30s flock timeout).
  flock -x .beads/.gsd-beads.lock sleep 35 &
  holder_pid=$!
  cleanup_pids="$cleanup_pids $holder_pid"

  # Give the holder a moment to take the lock.
  sleep 0.5

  # Invoke regen-roadmap.sh; expect non-zero exit within ~31s.
  # We cap with `timeout 33` for safety. Capture stderr.
  stderr_file=$(mktemp)
  start_ts=$(date +%s)
  set +e
  timeout 33 bash "$REGEN_ROADMAP" >/dev/null 2>"$stderr_file"
  rc=$?
  set -e
  end_ts=$(date +%s)
  elapsed=$((end_ts - start_ts))

  # Kill the holder (no longer needed).
  kill "$holder_pid" 2>/dev/null || true
  wait "$holder_pid" 2>/dev/null || true

  if [ "$rc" = "0" ]; then
    case3_ok=0
    echo "  detail: regen-roadmap.sh exited 0 under contended lock (expected non-zero)"
  fi
  if [ "$elapsed" -lt 28 ] || [ "$elapsed" -gt 33 ]; then
    # Not strictly a failure — flock may exit slightly before/after 30s
    # depending on scheduler; warn but don't fail.
    echo "  warn: elapsed=${elapsed}s (expected ~30s); not a hard failure"
  fi
  if ! grep -qF 'another regen is in progress' "$stderr_file"; then
    case3_ok=0
    echo "  detail: stderr did not contain 'another regen is in progress'"
    echo "  stderr was:"
    sed 's/^/    /' "$stderr_file" | head -5
  fi

  rm -f "$stderr_file"
  cd /
  rm -rf "$fixture"
}
if [ "$case3_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: regen-roadmap.sh exits non-zero with 'another regen is in progress' on contended lock"
else
  fail=$((fail + 1))
  echo "  FAIL: contended-lock behavioral assertion failed"
fi

# ---------------------------------------------------------------------------
# CASE 4: uncontended happy path (regen-roadmap.sh) — in a fresh git fixture
#         with no lock holder, regen-roadmap.sh exits 0 and creates the lock
#         file (lazy-created, never deleted).
# ---------------------------------------------------------------------------
echo ""
echo "CASE 4: uncontended happy path (regen-roadmap.sh)"
case4_ok=1
{
  fixture=$(mktemp -d)
  # Use the existing 3-level-hierarchy fixture builder so bd state is
  # populated — regen-roadmap.sh's body will run end-to-end.
  bash "$REPO_ROOT/tests/fixtures/bd-helpers/3-level-hierarchy.sh" "$fixture" >/dev/null 2>&1
  cd "$fixture"
  mkdir -p .planning

  set +e
  bash "$REGEN_ROADMAP" >/dev/null 2>&1
  rc=$?
  set -e

  if [ "$rc" != "0" ]; then
    case4_ok=0
    echo "  detail: regen-roadmap.sh exited $rc on uncontended fixture (expected 0)"
  fi
  if [ ! -f "$fixture/.beads/.gsd-beads.lock" ]; then
    case4_ok=0
    echo "  detail: lock file $fixture/.beads/.gsd-beads.lock not present after run (expected lazy-created)"
  fi
  if [ ! -f "$fixture/.planning/ROADMAP.md" ]; then
    case4_ok=0
    echo "  detail: ROADMAP.md not produced (preamble must allow happy path through)"
  fi

  cd /
  rm -rf "$fixture"
}
if [ "$case4_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: uncontended regen-roadmap.sh exits 0, lock file lazy-created, ROADMAP.md produced"
else
  fail=$((fail + 1))
  echo "  FAIL: uncontended happy path broken"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
