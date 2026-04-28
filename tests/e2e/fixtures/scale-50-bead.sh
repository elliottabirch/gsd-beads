#!/usr/bin/env bash
# Build a 50-bead hierarchy: 1 requirement → 5 phases × 10 tasks each = 56 beads.
# Usage: scale-50-bead.sh <project-dir>
set -euo pipefail
cd "${1:?usage: scale-50-bead.sh <project-dir>}"

REQ=$(bd q "REQ-100: scale test" -t epic -p 0)
bd label add "$REQ" gsd:requirement >/dev/null
bd label add "$REQ" req-id:REQ-100 >/dev/null
bd label add "$REQ" version:v1 >/dev/null

for p in 1 2 3 4 5; do
  # bd priority must be 0-4; cap at 4 for phase 5
  pp=$(( p < 5 ? p : 4 ))
  P=$(bd q "Phase $p: scale" -t epic -p $pp)
  bd label add "$P" gsd:phase >/dev/null
  bd link "$P" "$REQ" --type parent-child >/dev/null
  for t in 1 2 3 4 5 6 7 8 9 10; do
    # bd priority must be 0-4; use modulo for tasks 5-10
    tp=$(( (t - 1) % 4 + 1 ))
    T=$(bd q "Phase-$p task-$t" -t task -p $tp)
    bd link "$T" "$P" --type parent-child >/dev/null
  done
done

echo "[scale-50-bead] built 56 beads"
