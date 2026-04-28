#!/usr/bin/env bash
# idempotency.test.sh — STUB (Wave 0 marker)
# Tests that install.sh is idempotent: running twice produces zero diff.
set -euo pipefail

# CASE 1: snapshot ~/.claude/settings.json before, run install.sh, run again, diff before-after-2 == after-1
# CASE 2: marker block in .beads/hooks/post-checkout count == 1 after running install twice
# CASE 3: ~/.local/bin/gsd-sdk symlink exists and points at same target after both runs
# CASE 4: 7 bd memories present after both runs (idempotent forget+remember)

echo "STUB: idempotency.test.sh not yet implemented"
exit 1
