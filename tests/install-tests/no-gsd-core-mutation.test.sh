#!/usr/bin/env bash
# no-gsd-core-mutation.test.sh — STUB (Wave 0 marker)
# Tests that install.sh never writes under ~/.claude/get-shit-done/ (REQ-02 / T-02-09).
set -euo pipefail

# CASE 1: `grep -r '~/.claude/get-shit-done/' install.sh` -> 0 matches (T-02-09 static check)
# CASE 2: drop a sentinel file ~/.claude/get-shit-done/SENTINEL (in sandboxed HOME), run install.sh, verify sentinel untouched (mtime unchanged)
# CASE 3: `grep -r '\.claude/get-shit-done' tests/install-tests/` (excluding self) -> only 0 (no cross-references)

echo "STUB: no-gsd-core-mutation.test.sh not yet implemented"
exit 1
