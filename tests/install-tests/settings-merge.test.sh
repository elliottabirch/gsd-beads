#!/usr/bin/env bash
# settings-merge.test.sh — STUB (Wave 0 marker)
# Tests all 5 deep-merge cases for settings.json.
set -euo pipefail

# CASE 1: empty existing settings.json + fragment -> fragment becomes the entire hooks block
# CASE 2: existing has different hooks (no overlap) -> both sets present after merge
# CASE 3: partial overlap (existing has same matcher, different command) -> both retained, no dedup
# CASE 4: full conflict (same matcher + command + if) -> deduped to one entry
# CASE 5: same command + same `if` filter, but DIFFERENT matchers -> both retained (W6 fix)

echo "STUB: settings-merge.test.sh not yet implemented"
exit 1
