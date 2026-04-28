#!/usr/bin/env bash
# REQ-08: bd ready works as-is in a beads-managed project.
# B2 fix: D-07 verification — bd prime surfaces gsd-beads:vocabulary at session-start.
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-ready-${RANDOM}"
trap "rm -rf '$fixture'" EXIT  # T-02-10 cleanup

# CASE 1: build 3-level fixture with 1 ready task (no blocks deps)
# CASE 2: run bd ready, assert output mentions the ready task ID
# CASE 3: run bd memories gsd-beads:vocabulary, assert output mentions string bd ready
# CASE 4 (B2 fix — D-07 verification): run bd prime in the fixture, assert stdout/stderr contains a literal string from the vocabulary memory (e.g., gsd-beads:vocabulary key name OR the literal Upstream keyword from the vocabulary memory). Validates D-07: agents see vocabulary at session start via bd prime.

echo "[STUB] bd-ready.smoke.sh not yet implemented"
exit 1
