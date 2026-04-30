#!/usr/bin/env bash
# handler-roadmap-determinism.test.sh — REQ-QUAL-06 precursor.
# Asserts roadmap.analyze and roadmap.get-phase produce byte-identical
# stdout across 5 consecutive invocations on the same fixture.
# Phase 11 extends this pattern to other read handlers as they ship.
#
# D-28: sort by priority desc, created_at asc, id asc is deterministic.
# This test catches regressions (e.g. Map insertion order flapping,
# drift[] re-ordering, memory key iteration variance).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHADOW="$REPO_ROOT/bin/gsd-sdk-shadow.mjs"
pass=0; fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[handler-roadmap-determinism.test.sh] Running 2 test cases..."
echo ""

# ---------------------------------------------------------------------------
# Fixture setup: bd-managed tempdir from seed.jsonl + git + .planning/phases
# dirs to satisfy disk_status derivation (handler reads disk for has_context/
# has_research/disk counts) + worktree config for milestone read (D-19).
# ---------------------------------------------------------------------------
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

bash "$REPO_ROOT/tests/fixtures/seed-fixture.sh" "$fixture" >/dev/null

# Initialize git (required for worktree-config milestone read — D-19).
cd "$fixture"
git init -q
git config user.email t@t.t
git config user.name t
git config extensions.worktreeConfig true   # T-04-19 mitigation
git commit -q --allow-empty -m init
git config --worktree gsd-beads.milestone v0.2

# Seed phase directories so disk_status resolves (handler reads disk).
mkdir -p .planning/phases/{01-spike,02-build-the-layer,03-findbeadsroot,04-parity-infra,05-roadmap-reads,06-cache,07-query-opt,08-state-reads,09-phase-resolution,10-init-reads,11-hook-audit}

# ---------------------------------------------------------------------------
# CASE 1: 5x byte-identical roadmap.analyze stdout (REQ-QUAL-06 precursor).
# D-28: priority/created_at/id sort must be stable; drift[] order must be
# stable; memory key iteration must produce same heading every run.
# ---------------------------------------------------------------------------
out1=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
out2=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
out3=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
out4=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
out5=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)

if [ "$out1" = "$out2" ] && [ "$out2" = "$out3" ] && [ "$out3" = "$out4" ] && [ "$out4" = "$out5" ]; then
  _pass "CASE 1: roadmap.analyze byte-identical across 5 consecutive runs"
else
  _fail "CASE 1: roadmap.analyze NOT byte-identical across 5 runs"
  echo "  run1 vs run2 diff:"
  diff <(echo "$out1") <(echo "$out2") || true
fi

# ---------------------------------------------------------------------------
# CASE 2: 5x byte-identical roadmap.get-phase stdout (REQ-QUAL-06 precursor).
# Probes phase 5 (present in seed fixture as v0.2 phase with phase-id:05).
# D-28: same sort guarantees apply; single bd export path must be stable.
# ---------------------------------------------------------------------------
g1=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
g2=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
g3=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
g4=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
g5=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)

if [ "$g1" = "$g2" ] && [ "$g2" = "$g3" ] && [ "$g3" = "$g4" ] && [ "$g4" = "$g5" ]; then
  _pass "CASE 2: roadmap.get-phase byte-identical across 5 consecutive runs"
else
  _fail "CASE 2: roadmap.get-phase NOT byte-identical across 5 runs"
  echo "  run1 vs run2 diff:"
  diff <(echo "$g1") <(echo "$g2") || true
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
