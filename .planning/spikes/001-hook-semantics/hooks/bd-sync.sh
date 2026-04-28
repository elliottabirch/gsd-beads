#!/usr/bin/env bash
# PostToolUse hook for `bd *` Bash commands.
#
# This is a stub for the spike — the real implementation will regenerate
# state-bearing markdown views from the bead store. Here, we just touch
# a marker file with the bd command and timestamp so the test harness
# can verify the hook fired reliably for every `bd` invocation.
set -euo pipefail

payload="$(cat)"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
session_id="$(printf '%s' "$payload" | jq -r '.session_id // "unknown"')"

# Default marker path can be overridden by env var (used by test harness)
marker="${BD_SYNC_MARKER:-/tmp/bd-sync-marker.log}"

# Append a line per fire — test harness counts lines per scenario
printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$session_id" "$command" >> "$marker"

# Exit 0 with no JSON output → no-op decision, tool result passes through
exit 0
