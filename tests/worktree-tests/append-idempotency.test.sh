#!/usr/bin/env bash
# Tests for the install-time append of worktree-post-checkout.sh into .beads/hooks/post-checkout.
# Note: the SCRIPT itself is idempotent via marker file. This test covers the APPEND idempotency (Pitfall 7).
# B6 note: the load-bearing T-02-06 mitigation (no `sed -i`, atomic mktemp+mv) lives on install.sh in Plan 02-05.
# The actual append helper lives in Plan 02-05's install.sh; this test exercises just the append logic with a defensive in-test helper.
set -euo pipefail
echo "[append-idempotency.test.sh] STUB — append helper not yet written"
# CASE 1: appending the BEGIN..END block to an empty post-checkout file → exactly 1 block
# CASE 2: appending TWICE to the same file → still exactly 1 block (sed /BEGIN/,/END/d then re-append)
# CASE 3: appending into a file that already has bd's BEGIN BEADS INTEGRATION block → coexists; both blocks present
# CASE 4: appending with newer version (`v2`) → old `v1` block removed first
exit 1
