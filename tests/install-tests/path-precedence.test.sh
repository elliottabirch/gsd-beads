#!/usr/bin/env bash
# path-precedence.test.sh — STUB (Wave 0 marker)
# Tests PATH-precedence detection and warning behavior for gsd-sdk shadow.
set -euo pipefail

# CASE 1: PATH has ~/.local/bin first -> `command -v gsd-sdk` resolves to it; install.sh prints "shadow active"
# CASE 2: PATH has ~/.volta/bin first -> install.sh prints warning about shadow being shadowed (does NOT abort)
# CASE 3: ~/.local/bin not in PATH at all -> warns + suggests adding to ~/.profile

echo "STUB: path-precedence.test.sh not yet implemented"
exit 1
