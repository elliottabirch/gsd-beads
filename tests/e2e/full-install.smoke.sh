#!/usr/bin/env bash
# End-to-end happy path: fresh project + install + hierarchy + cascade + regen + parser-compat
# Exercises REQ-01, REQ-02, REQ-04, REQ-06, REQ-07, REQ-08.
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-${RANDOM}"
trap "rm -rf '$fixture'" EXIT  # T-02-10 cleanup

# CASE 1: fresh /tmp fixture builds successfully (bd init + install.sh exit 0)
# CASE 2: build 3-level hierarchy via shadow's phase.add + bd link
# CASE 3: close all 6 leaf tasks → cascade-loop closes 2 phases + 1 requirement (3 epic closures)
# CASE 4: regen-roadmap.sh produces .planning/ROADMAP.md with ## Progress table
# CASE 5 (W8 fix): node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query progress --project-dir "$fixture" returns non-empty parser-compat output (bypasses PATH lookup so Volta-trap machines exercise the shadow explicitly)
# CASE 6: regen-requirements.sh produces .planning/REQUIREMENTS.md with version + traceability sections
# CASE 7: idempotent regen — running regen twice produces zero diff

echo "[STUB] full-install.smoke.sh not yet implemented"
exit 1
