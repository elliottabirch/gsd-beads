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
# DISCUSSION-LOG.md) is NOT blocked.
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

# Normalize to a project-relative form by stripping a known prefix if present.
# Hook receives absolute paths; we match by suffix.
case "$file_path" in
  */.planning/ROADMAP.md|*/.planning/REQUIREMENTS.md|*/.planning/todos/*|*/.planning/seeds/*\
  |.planning/ROADMAP.md|.planning/REQUIREMENTS.md|.planning/todos/*|.planning/seeds/*)
    target="${file_path##*.planning/}"
    jq -n --arg target "$target" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("State-bearing markdown is generated from beads — direct edits to .planning/" + $target + " are blocked. Use one of: /gsd-beads-add-phase, /gsd-beads-add-todo, /gsd-beads-plant-seed, /gsd-beads-new-milestone, or run `bd` directly. Run `bd-sync.sh` to regenerate.")
      }
    }'
    exit 0
    ;;
  *)
    # Allow (narrative markdown, source code, anything else)
    exit 0
    ;;
esac
