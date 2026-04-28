#!/usr/bin/env bash
# PostToolUse hook for `bd *` Bash commands.
# Filters READ-only bd commands; runs cascade + regen on state-changing only.
# T-02-03 mitigation: only run cascade/regen on `bd ` prefix; never execute payload contents.
set -euo pipefail

payload="$(cat)"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
[ -z "$command" ] && exit 0

# Confirm bd prefix before extracting subcommand (T-02-03 mitigation).
case "$command" in
  "bd "*) ;;
  *) exit 0 ;;
esac

# Extract bd subcommand (the token after `bd `)
sub="${command#*bd }"
sub="${sub%% *}"

# Read-only filter — skip regen for read-only bd commands (Pitfall 3)
case "$sub" in
  list|show|ready|memories|status|prime|export|deps|children|search|help|version|"--version"|"--help")
    exit 0 ;;
esac

# Debounce — if last regen <1s ago, skip (idempotency)
ROADMAP_PATH="${CLAUDE_PROJECT_DIR:-$PWD}/.planning/ROADMAP.md"
if [ -f "$ROADMAP_PATH" ]; then
  age=$(( $(date +%s) - $(stat -c %Y "$ROADMAP_PATH" 2>/dev/null || stat -f %m "$ROADMAP_PATH" 2>/dev/null || echo 0) ))
  [ "$age" -lt 1 ] && exit 0
fi

# Run cascade then regen
# SCRIPTS env var can be overridden by tests to inject stubs
if [ -z "${SCRIPTS:-}" ]; then
  SCRIPTS="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/scripts"
  if [ ! -d "$SCRIPTS" ]; then
    # Fallback: scripts may live at repo-root scripts/ during dev
    SCRIPTS="${CLAUDE_PROJECT_DIR:-$PWD}/scripts"
  fi
fi

"$SCRIPTS/cascade-loop.sh" --quiet || true
"$SCRIPTS/regen-roadmap.sh" || true
"$SCRIPTS/regen-requirements.sh" || true

exit 0
