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
set -euo pipefail

iter=0
total_closed=0

while :; do
  iter=$((iter + 1))
  out=$(bd epic close-eligible 2>&1)

  if echo "$out" | grep -q 'No epics eligible'; then
    break
  fi

  echo "$out"
  # Count "✓ Closed N epic(s)" lines and accumulate
  closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
  total_closed=$((total_closed + ${closed:-0}))
done

if [ "$total_closed" -gt 0 ]; then
  echo ""
  echo "Cascade complete: $total_closed epic(s) closed across $((iter - 1)) iteration(s)"
fi
