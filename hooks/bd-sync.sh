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
# SCRIPTS env var can be overridden by tests to inject stubs.
# Resolution order:
#   1. $PROJECT/.claude/scripts/   — project-local override (rare)
#   2. $PROJECT/scripts/           — dev/repo-root layout (gsd-beads itself)
#   3. $HOME/.claude/scripts/      — install.sh canonical install location
# A directory existing is not enough — it must contain an executable
# cascade-loop.sh. Otherwise real-world deploys (where install.sh writes to
# ~/.claude/scripts/ and most projects have an unrelated $PROJECT/scripts/
# directory) silently fall through to a path with no regen scripts.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
if [ -z "${SCRIPTS:-}" ]; then
  SCRIPTS="$PROJECT_DIR/.claude/scripts"
  if [ ! -d "$SCRIPTS" ] || [ ! -x "$SCRIPTS/cascade-loop.sh" ]; then
    # Fallback: scripts may live at repo-root scripts/ during dev
    SCRIPTS="$PROJECT_DIR/scripts"
  fi
  if [ ! -d "$SCRIPTS" ] || [ ! -x "$SCRIPTS/cascade-loop.sh" ]; then
    # Final fallback: install.sh-canonical location.
    SCRIPTS="$HOME/.claude/scripts"
  fi
fi

"$SCRIPTS/cascade-loop.sh" --quiet || true
"$SCRIPTS/regen-roadmap.sh" || true
"$SCRIPTS/regen-requirements.sh" || true

# Opportunistic project-local STATE.md regen.
# Some projects (e.g. tstl-sylvanas) ship a project-local regen-state.sh that
# rebuilds STATE.md from .planning/ artifacts. Prefer the project-local copy
# (where tstl-sylvanas keeps it) over the gsd-beads-shipped SCRIPTS dir.
# Fail-soft: skip silently if no copy exists; this is opt-in per-project.
if [ -x "$PROJECT_DIR/scripts/regen-state.sh" ]; then
  "$PROJECT_DIR/scripts/regen-state.sh" || true
elif [ -x "$SCRIPTS/regen-state.sh" ]; then
  "$SCRIPTS/regen-state.sh" || true
fi

exit 0
