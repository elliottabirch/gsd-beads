#!/usr/bin/env bash
# Restores canonical multi-milestone bd fixture into $1.
#
# Determinism contract (D-07): byte-identical state across runs.
# Strategy: `bd init --from-jsonl` preserves IDs and created_at/updated_at
# exactly, so two invocations against the same seed.jsonl produce
# byte-identical bd state.
#
# Used by every Phase 4-9 fixture that needs multi-milestone bd content.
#
# Pitfall 8 mitigation: BEADS_ACTOR=seed isolates the seed-restore from the
# dev's actor identity (no leakage into restored bd state).
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <directory>" >&2
  exit 1
fi

target="$1"
seed_jsonl="${SEED_JSONL:-$(dirname "$0")/seed.jsonl}"
prefix="${SEED_PREFIX:-sd}"

[ -f "$seed_jsonl" ] || { echo "seed JSONL not found: $seed_jsonl" >&2; exit 1; }

mkdir -p "$target/.beads"
cp "$seed_jsonl" "$target/.beads/issues.jsonl"
( cd "$target" && BEADS_ACTOR=seed bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents >/dev/null 2>&1 )
chmod 700 "$target/.beads"  # bd warns at 0755
