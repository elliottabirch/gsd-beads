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

# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---
# Resolve source repo's .beads/ from any worktree, absolutize via cd+pwd -P.
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"

# Pre-flight: flock present? (Pitfall 1 — macOS users must brew install flock)
if ! command -v flock >/dev/null 2>&1; then
  echo "[gsd-beads] ERROR: flock not installed (macOS: brew install flock)" >&2
  exit 1
fi

# Lazy-create lock file (zero bytes, never deleted; *.lock is already in .beads/.gitignore).
mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"

# Acquire exclusive lock (30s timeout matches bd-sync.sh hook timeout in settings.fragment.json).
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen is in progress at $LOCK — retry shortly" >&2
  exit 1
fi
# Lock auto-released when fd 9 closes (script exit).
# --- END GSD-BEADS LOCK PREAMBLE v1 ---

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
