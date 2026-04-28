#!/usr/bin/env bash
# Cascade-close loop using bd's built-in `bd epic close-eligible`.
#
# Approach B (chosen): both requirement-level and phase-level beads use
# type=epic, distinguished by labels (gsd:requirement / gsd:phase). This
# means `bd epic close-eligible` cascades up through ALL parent levels
# automatically — we just call it in a loop until no more epics are
# eligible.
#
# Empirical timing (Spike 002): ~0.85s on a 7-issue / 2-iteration fixture.
# Compare to cascade-close.sh (custom-type approach): ~2.7s. ~3x faster.
#
# Intended invocation: from bd-sync.sh after every `bd ` Bash command.
# Idempotent — safe to call repeatedly.
#
# Phase 2 deltas: max-iteration cap (env: MAX_ITER, default 20) + --quiet flag.
# T-02-03 mitigation: only calls `bd epic close-eligible`; no dynamic execution of bd output.
set -euo pipefail

QUIET=0
if [ "${1:-}" = "--quiet" ]; then QUIET=1; fi
MAX_ITER="${MAX_ITER:-20}"

iter=0
total_closed=0

while [ "$iter" -lt "$MAX_ITER" ]; do
  iter=$((iter + 1))
  out=$(bd epic close-eligible 2>&1)

  if echo "$out" | grep -q 'No epics eligible'; then
    break
  fi

  [ "$QUIET" -eq 0 ] && echo "$out"
  closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
  total_closed=$((total_closed + ${closed:-0}))
done

if [ "$iter" -ge "$MAX_ITER" ]; then
  echo "[cascade-loop] WARNING: hit max iteration cap ($MAX_ITER); stopping" >&2
fi

if [ "$total_closed" -gt 0 ] && [ "$QUIET" -eq 0 ]; then
  echo ""
  echo "Cascade complete: $total_closed epic(s) closed across $((iter - 1)) iteration(s)"
fi
