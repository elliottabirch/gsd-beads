#!/usr/bin/env bash
# REQ-05: Two worktrees writing same bead ID concurrently merge without conflict.
# B1 fix: REQ-05 interpretation per Pitfall 8 — last-writer-wins acceptable.
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-cmerge-${RANDOM}"
wt="${fixture}-wt"
trap "rm -rf '$fixture' '$wt'" EXIT  # T-02-10 cleanup

# CASE 1: build fixture, add second worktree via git worktree add
# CASE 2: spawn 2 parallel processes that each bd close <bead> --reason wt-X on the same bead. Both invocations return a non-empty bead ID and exit 0 (proves no exception thrown / both transactions committed).
# CASE 3: wait for both, bd show <bead> --json returns state=closed AND close_reason is one of {wt-source, wt-secondary} (not null, not corrupted JSON). Last-writer-wins is acceptable per Pitfall 8.
# CASE 4: assert no .beads/embeddeddolt corruption (run bd list --json post-merge, jq-parses successfully).

echo "[STUB] concurrent-merge.test.sh not yet implemented"
exit 1
