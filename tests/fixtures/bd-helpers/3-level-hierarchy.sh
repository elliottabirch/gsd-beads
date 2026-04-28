#!/usr/bin/env bash
# Shared test fixture builder for bd-helpers tests.
# Builds the canonical Spike 002 3-level hierarchy:
#   1 requirement epic → 2 phase epics → 3 task beads
#
# Usage: ./3-level-hierarchy.sh <directory>
#   <directory> must be a path where bd init will be run.
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <directory>" >&2
  exit 1
fi

TARGET_DIR="$1"
mkdir -p "$TARGET_DIR"

# Initialize beads if not already initialized
if [ ! -d "$TARGET_DIR/.beads" ]; then
  (cd "$TARGET_DIR" && bd init --non-interactive --skip-agents)
fi

cd "$TARGET_DIR"

# Build canonical 3-level hierarchy (Spike 002 fixture)

# Level 1: Requirement epic
REQ=$(bd q "REQ-042: Email/password auth" -t epic -p 0)
bd label add "$REQ" gsd:requirement
bd label add "$REQ" req-id:REQ-042
bd label add "$REQ" version:v1
bd label add "$REQ" category:auth

# Level 2: Phase epics
P1=$(bd q "Phase 12: Auth backend" -t epic -p 1)
bd label add "$P1" gsd:phase
bd label add "$P1" milestone:v1.0
bd link "$P1" "$REQ" --type parent-child

P2=$(bd q "Phase 13: Auth UI" -t epic -p 2)
bd label add "$P2" gsd:phase
bd label add "$P2" milestone:v1.0
bd link "$P2" "$REQ" --type parent-child

# Level 3: Task beads under P1
T1=$(bd q "Hash passwords" -t task -p 1)
bd link "$T1" "$P1" --type parent-child

T2=$(bd q "Verify JWT" -t task -p 2)
bd link "$T2" "$P1" --type parent-child

# Level 3: Task bead under P2
T3=$(bd q "Login form" -t task -p 1)
bd link "$T3" "$P2" --type parent-child

echo "[fixture] built 3-level hierarchy: 1 req → 2 phases → 3 tasks"
echo "[fixture] IDs: REQ=$REQ P1=$P1 P2=$P2 T1=$T1 T2=$T2 T3=$T3"
