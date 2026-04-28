#!/usr/bin/env bash
# Build a 50-bead hierarchy: 1 requirement → 5 phases × 10 tasks each = 56 beads.
# Stub: production code creates the requirement+phases+tasks via bd CLI.
# Usage: scale-50-bead.sh <project-dir>
set -euo pipefail
cd "${1:?usage: scale-50-bead.sh <project-dir>}"
echo "[scale-50-bead] STUB"
exit 1
