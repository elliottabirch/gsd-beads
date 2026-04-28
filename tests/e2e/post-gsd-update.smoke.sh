#!/usr/bin/env bash
# REQ-02: After running gsd-update on upstream package, shadow imports still resolve.
# W8 fix: shadow exercised via direct node invocation to bypass PATH lookup.
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-postupd-${RANDOM}"
trap "rm -rf '$fixture'" EXIT  # T-02-10 cleanup

# CASE 1: capture current upstream version via node -e "console.log(require('get-shit-done-cc/package.json').version)"
# CASE 2: simulate gsd-update by volta install get-shit-done-cc@latest (or skip if version already latest; print SKIPPED)
# CASE 3: run shadow with node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query phase (read-only) on fixture; assert exit 0 (REQ-02 — shadow's dynamic import still resolves after upstream upgrade)
# CASE 4: run shadow with node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query phase.add "Test phase" --project-dir <fixture>; assert exit 0 + JSON has backend:'beads'

echo "[STUB] post-gsd-update.smoke.sh not yet implemented"
exit 1
