#!/usr/bin/env bash
# PreToolUse hook for Edit|Write — blocks writes to state-bearing markdown.
#
# State-bearing paths (relative to project root):
#   .planning/ROADMAP.md
#   .planning/REQUIREMENTS.md
#   .planning/todos/**
#   .planning/seeds/**
#
# Narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md,
# DISCUSSION-LOG.md) is NOT blocked (REQ-07).
#
# Returns exit 0 with hookSpecificOutput JSON.
# permissionDecision="deny" → blocks; reason is shown to Claude.
# When path doesn't match, prints nothing (implicit allow).
set -euo pipefail

# Read tool payload from stdin
payload="$(cat)"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"

# If no file_path (shouldn't happen for Edit/Write), pass through
if [ -z "$file_path" ]; then
  exit 0
fi

# Beads-managed-only: when registered globally in ~/.claude/settings.json
# this hook fires on every project. Without this guard, plain GSD projects
# and git worktrees that don't carry .beads/ get their state writes blocked
# spuriously. Pass through when project root has no .beads/.
project_dir="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$payload" | jq -r '.cwd // empty')}"
[ -z "$project_dir" ] && project_dir="$PWD"
[ -d "$project_dir/.beads" ] || exit 0

# Normalize to a project-relative form by stripping a known prefix if present.
# Hook receives absolute paths; we match by suffix.
# Both absolute (*/.planning/X) and relative (.planning/X) forms are matched
# per Spike 001 iter-2 finding — do not regress.
case "$file_path" in
  */.planning/ROADMAP.md|*/.planning/REQUIREMENTS.md|*/.planning/todos/*|*/.planning/seeds/*\
  |.planning/ROADMAP.md|.planning/REQUIREMENTS.md|.planning/todos/*|.planning/seeds/*)
    target="${file_path##*.planning/}"
    jq -n --arg target "$target" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("State-bearing markdown is generated from beads — direct edits to .planning/" + $target + " are blocked. Use upstream /gsd-* commands (they route through the gsd-sdk shadow into beads transparently) or run `bd` directly to mutate state, then `bd-sync.sh` regenerates the markdown.")
      }
    }'
    exit 0
    ;;
  *)
    # Allow (narrative markdown, source code, anything else)
    exit 0
    ;;
esac
