#!/usr/bin/env bash
# Source-of-truth bash script for tests/fixtures/seed.jsonl.
# CONVENTION (Pitfall 7): seed.jsonl is regenerated from this script,
# NOT hand-edited. PRs change THIS file + commit the regenerated JSONL.
#
# Output: tests/fixtures/seed.jsonl (multi-milestone bd state)
#   - v0.1: 2 phases, all closed
#   - v0.2: 3 phases, in-progress (open)
#   - v0.3: 2 phases, planned (open)
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
# v0.1 milestone — 2 phases, closed
# ---------------------------------------------------------------------------
P11=$(BEADS_ACTOR=seed bd q "v0.1 Phase A: Spike" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P11" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P11" version:v0.1 >/dev/null
BEADS_ACTOR=seed bd close "$P11" >/dev/null

P12=$(BEADS_ACTOR=seed bd q "v0.1 Phase B: Build the layer" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P12" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P12" version:v0.1 >/dev/null
BEADS_ACTOR=seed bd close "$P12" >/dev/null

# ---------------------------------------------------------------------------
# v0.2 milestone — 3 phases, in-progress (open)
# ---------------------------------------------------------------------------
P21=$(BEADS_ACTOR=seed bd q "v0.2 Phase A: findBeadsRoot" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P21" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P21" version:v0.2 >/dev/null

P22=$(BEADS_ACTOR=seed bd q "v0.2 Phase B: roadmap reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P22" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P22" version:v0.2 >/dev/null

P23=$(BEADS_ACTOR=seed bd q "v0.2 Phase C: progress reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P23" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P23" version:v0.2 >/dev/null

# ---------------------------------------------------------------------------
# v0.3 milestone — 2 phases, planned (open)
# ---------------------------------------------------------------------------
P31=$(BEADS_ACTOR=seed bd q "v0.3 Phase A: caching" -t epic -p 2)
BEADS_ACTOR=seed bd label add "$P31" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P31" version:v0.3 >/dev/null

P32=$(BEADS_ACTOR=seed bd q "v0.3 Phase B: query optimization" -t epic -p 2)
BEADS_ACTOR=seed bd label add "$P32" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P32" version:v0.3 >/dev/null

# ---------------------------------------------------------------------------
# Export to canonical JSONL (committed)
# ---------------------------------------------------------------------------
BEADS_ACTOR=seed bd export --json -o "$REPO_ROOT/tests/fixtures/seed.jsonl" >/dev/null
echo "[build-seed] seed.jsonl regenerated at $REPO_ROOT/tests/fixtures/seed.jsonl"
echo "[build-seed] IDs: P11=$P11 P12=$P12 P21=$P21 P22=$P22 P23=$P23 P31=$P31 P32=$P32"
