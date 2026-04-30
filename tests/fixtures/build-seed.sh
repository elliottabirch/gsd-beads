#!/usr/bin/env bash
# Source-of-truth bash script for tests/fixtures/seed.jsonl.
# CONVENTION (Pitfall 7): seed.jsonl is regenerated from this script,
# NOT hand-edited. PRs change THIS file + commit the regenerated JSONL.
#
# Output: tests/fixtures/seed.jsonl (multi-milestone bd state)
#   - v0.1: 2 phases (phase-id:01..02), all closed
#   - v0.2: 7 phases (phase-id:03..09), in-progress (open) + 24 plan children
#   - v0.3: 2 phases (phase-id:10..11), planned (open)
#   - memories: gsd-beads:milestone:v0.1:heading + gsd-beads:milestone:v0.2:heading
#     (v0.3 deliberately omitted to exercise D-17 fallback path)
#
# Pitfall 8 mitigation: BEADS_ACTOR=seed on every bd invocation (prevents
# dev's actor identity from leaking into the committed seed).
# D-07 determinism contract: byte-identical bd state across runs via
# `bd init --from-jsonl` reproduction.
#
# Stack: bash + bd CLI only.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"

# Build multi-milestone bd state in an isolated tempdir.
BEADS_ACTOR=seed bd init --non-interactive --skip-agents --prefix sd --quiet >/dev/null

# ---------------------------------------------------------------------------
# v0.1 milestone — 2 phases, closed (phase-id:01..02)
# ---------------------------------------------------------------------------
P11=$(BEADS_ACTOR=seed bd q "v0.1 Phase A: Spike" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P11" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P11" version:v0.1 >/dev/null
BEADS_ACTOR=seed bd label add "$P11" phase-id:01 >/dev/null
BEADS_ACTOR=seed bd close "$P11" >/dev/null

P12=$(BEADS_ACTOR=seed bd q "v0.1 Phase B: Build the layer" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P12" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P12" version:v0.1 >/dev/null
BEADS_ACTOR=seed bd label add "$P12" phase-id:02 >/dev/null
BEADS_ACTOR=seed bd close "$P12" >/dev/null

# ---------------------------------------------------------------------------
# v0.2 milestone — 7 phases, in-progress (open) (phase-id:03..09)
# ---------------------------------------------------------------------------
P21=$(BEADS_ACTOR=seed bd q "v0.2 Phase A: findBeadsRoot" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P21" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P21" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P21" phase-id:03 >/dev/null

P22=$(BEADS_ACTOR=seed bd q "v0.2 Phase B: roadmap reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P22" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P22" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P22" phase-id:04 >/dev/null

P23=$(BEADS_ACTOR=seed bd q "v0.2 Phase C: progress reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P23" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P23" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P23" phase-id:05 >/dev/null

P24=$(BEADS_ACTOR=seed bd q "v0.2 Phase D: state reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P24" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P24" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P24" phase-id:06 >/dev/null

P25=$(BEADS_ACTOR=seed bd q "v0.2 Phase E: phase resolution" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P25" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P25" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P25" phase-id:07 >/dev/null

P26=$(BEADS_ACTOR=seed bd q "v0.2 Phase F: init reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P26" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P26" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P26" phase-id:08 >/dev/null

P27=$(BEADS_ACTOR=seed bd q "v0.2 Phase G: hook audit" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P27" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P27" version:v0.2 >/dev/null
BEADS_ACTOR=seed bd label add "$P27" phase-id:09 >/dev/null

# ---------------------------------------------------------------------------
# v0.3 milestone — 2 phases, planned (open) (phase-id:10..11)
# ---------------------------------------------------------------------------
P31=$(BEADS_ACTOR=seed bd q "v0.3 Phase A: caching" -t epic -p 2)
BEADS_ACTOR=seed bd label add "$P31" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P31" version:v0.3 >/dev/null
BEADS_ACTOR=seed bd label add "$P31" phase-id:10 >/dev/null

P32=$(BEADS_ACTOR=seed bd q "v0.3 Phase B: query optimization" -t epic -p 2)
BEADS_ACTOR=seed bd label add "$P32" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P32" version:v0.3 >/dev/null
BEADS_ACTOR=seed bd label add "$P32" phase-id:11 >/dev/null

# ---------------------------------------------------------------------------
# Plan children for v0.2 phases (D-03 substrate; SC #2 count parity)
# 24 plans distributed: P21=4, P22=5, P23=4, P24=3, P25=3, P26=3, P27=2
#
# Pitfall 8: BEADS_ACTOR=seed on every bd call inside the loop,
# including bd link (parent-child links).
# ---------------------------------------------------------------------------
seed_plans() {
  local phase_var="$1"
  local phase_id="$2"   # padded form e.g. "03"
  local count="$3"
  local closed_count="${4:-0}"  # number of plans to close (for summary_count substrate)
  local i
  for i in $(seq 1 "$count"); do
    local pid_padded
    pid_padded=$(printf "%02d" "$i")
    local plan_id
    plan_id=$(BEADS_ACTOR=seed bd q "v0.2 Plan ${phase_id}-${pid_padded}" -t task -p 1)
    BEADS_ACTOR=seed bd label add "$plan_id" gsd:plan >/dev/null
    BEADS_ACTOR=seed bd label add "$plan_id" version:v0.2 >/dev/null
    BEADS_ACTOR=seed bd label add "$plan_id" "plan-id:${phase_id}-${pid_padded}" >/dev/null
    BEADS_ACTOR=seed bd link "$plan_id" "$phase_var" --type parent-child >/dev/null
    if [ "$i" -le "$closed_count" ]; then
      BEADS_ACTOR=seed bd close "$plan_id" >/dev/null
    fi
  done
}

# P21 (phase-id:03): 4 plans, 2 closed (exercises summary_count substrate)
seed_plans "$P21" "03" 4 2
# P22 (phase-id:04): 5 plans, 0 closed
seed_plans "$P22" "04" 5 0
# P23 (phase-id:05): 4 plans, 0 closed
seed_plans "$P23" "05" 4 0
# P24 (phase-id:06): 3 plans, 0 closed
seed_plans "$P24" "06" 3 0
# P25 (phase-id:07): 3 plans, 0 closed
seed_plans "$P25" "07" 3 0
# P26 (phase-id:08): 3 plans, 0 closed
seed_plans "$P26" "08" 3 0
# P27 (phase-id:09): 2 plans, 0 closed
seed_plans "$P27" "09" 2 0

# ---------------------------------------------------------------------------
# Milestone heading memories (D-18)
# Seeded so Phase 5 tests cover happy-path (v0.1, v0.2) + fallback (v0.3 absent).
# Pitfall 8: BEADS_ACTOR=seed on bd remember calls.
# Syntax: bd remember "<value>" --key "<key>"
# ---------------------------------------------------------------------------
BEADS_ACTOR=seed bd remember "Foundation" --key "gsd-beads:milestone:v0.1:heading" >/dev/null
BEADS_ACTOR=seed bd remember "Beads-backed reads" --key "gsd-beads:milestone:v0.2:heading" >/dev/null
# v0.3 deliberately omitted to test the fallback path (D-17: fallback to bare "v0.3")

# ---------------------------------------------------------------------------
# Export to canonical JSONL (committed)
# ---------------------------------------------------------------------------
BEADS_ACTOR=seed bd export --json -o "$REPO_ROOT/tests/fixtures/seed.jsonl" >/dev/null
echo "[build-seed] seed.jsonl regenerated at $REPO_ROOT/tests/fixtures/seed.jsonl"
echo "[build-seed] IDs: P11=$P11 P12=$P12 P21=$P21 P22=$P22 P23=$P23 P31=$P31 P32=$P32"
echo "[build-seed] New v0.2: P24=$P24 P25=$P25 P26=$P26 P27=$P27"
echo "[build-seed] Phase-ids: 01(P11) 02(P12) 03(P21) 04(P22) 05(P23) 06(P24) 07(P25) 08(P26) 09(P27) 10(P31) 11(P32)"
