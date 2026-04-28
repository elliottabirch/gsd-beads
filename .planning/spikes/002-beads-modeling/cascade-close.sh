#!/usr/bin/env bash
# Recursive parent-child cascade close.
#
# Beads ships `bd epic close-eligible` which only closes parents of type 'epic'.
# gsd-beads needs the same behavior for ANY parent-child relationship —
# including custom types like 'requirement' and 'phase'.
#
# This script:
#   1. Lists every parent-child parent in the store that is currently open
#      AND whose every parent-child child is closed.
#   2. Closes those parents.
#   3. Repeats until no new closures (cascade up through arbitrary levels).
#
# Intended invocation: from bd-sync.sh after every `bd close` (or any `bd ` write).
# Idempotent — safe to call repeatedly.
set -euo pipefail

# Optional dry-run mode
DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

iteration=0
total_closed=0

while :; do
  iteration=$((iteration + 1))

  # Get list of all open issue ids
  open_ids=$(bd list --status=open --json 2>/dev/null | jq -r '.[].id')
  [ -z "$open_ids" ] && break

  to_close=()
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    # Get parent-child children (dependents with dependency_type=parent-child)
    children_json=$(bd show "$id" --json 2>/dev/null \
      | jq -c '.[0].dependents // [] | map(select(.dependency_type=="parent-child"))')

    child_count=$(echo "$children_json" | jq 'length')
    [ "$child_count" -eq 0 ] && continue  # no children = leaf, not a parent to close

    open_children=$(echo "$children_json" | jq '[.[] | select(.status != "closed")] | length')
    if [ "$open_children" -eq 0 ]; then
      to_close+=("$id")
    fi
  done <<< "$open_ids"

  if [ ${#to_close[@]} -eq 0 ]; then
    break
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Would close ${#to_close[@]} parent(s) at iteration $iteration:"
    for id in "${to_close[@]}"; do
      title=$(bd show "$id" --json | jq -r '.[0].title')
      echo "  - $id: $title"
    done
    break
  fi

  echo "Iteration $iteration: closing ${#to_close[@]} parent(s) whose children are all complete"
  bd close "${to_close[@]}"
  total_closed=$((total_closed + ${#to_close[@]}))
done

if [ "$DRY_RUN" -eq 0 ]; then
  echo ""
  echo "Cascade complete: $total_closed parent(s) closed across $((iteration - 1)) iteration(s)"
fi
