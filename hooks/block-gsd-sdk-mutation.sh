#!/usr/bin/env bash
# PreToolUse hook for `gsd-sdk query <state-mutation-command>` Bash calls.
#
# Closes the gap discovered in Spike 012: 13 gsd-sdk mutation commands
# write to state-bearing files (.planning/ROADMAP.md, REQUIREMENTS.md,
# todos/, seeds/) and bypass the Edit/Write blocker from Spike 001.
#
# This hook fires only when matched by the `if: "Bash(gsd-sdk *)"`
# permission rule in the settings.json fragment. We parse the argv,
# check the first arg after `gsd-sdk query`, and deny if it's a
# state-bearing mutation.
#
# Returns exit 0 with hookSpecificOutput JSON.
# permissionDecision="deny" → blocks; reason is shown to Claude.
# When command is not in the deny-list, prints nothing (implicit allow).
#
# T-02-02 mitigation: case-pattern matches *"gsd-sdk "*"query "* exactly
# (spaces required); a command like `xgsd-sdkx query phase.add` does NOT match.
set -euo pipefail

payload="$(cat)"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"

# If no command (shouldn't happen for Bash), pass through
[ -z "$command" ] && exit 0

# Beads-managed-only: when registered globally in ~/.claude/settings.json
# this hook fires on every project. Without this guard, plain GSD projects
# and git worktrees that don't carry .beads/ have gsd-sdk mutations blocked
# spuriously. Pass through when project root has no .beads/.
project_dir="${CLAUDE_PROJECT_DIR:-$(printf '%s' "$payload" | jq -r '.cwd // empty')}"
[ -z "$project_dir" ] && project_dir="$PWD"
[ -d "$project_dir/.beads" ] || exit 0

# Extract the first non-flag argument after `gsd-sdk query`. Handle:
#   gsd-sdk query phase.add ...
#   gsd-sdk query phase add ...    (space-delimited alias)
#   gsd-sdk --project-dir /x query phase.add ...
#
# Normalize: strip everything up to and including ` query `, then take
# the first 1 or 2 tokens (to handle space-delimited aliases like
# `phase add` which need both words).
#
# T-02-02: anchored on *"gsd-sdk "*"query "* (literal spaces required).
case "$command" in
  *"gsd-sdk "*"query "*)
    after_query="${command#*query }"
    first="${after_query%% *}"
    rest="${after_query#* }"
    # If the first token is a known prefix that has space-aliased subcommands,
    # combine with second token to form a candidate two-word command.
    second_word=""
    case "$first" in
      phase|phases|state|roadmap|requirements|todo|milestone|frontmatter)
        second_word="${rest%% *}"
        ;;
    esac
    candidate1="$first"
    candidate2="${first}.${second_word}"  # check dotted form (e.g. `phase add` → `phase.add`)
    ;;
  *)
    # Not a gsd-sdk query — pass through
    exit 0
    ;;
esac

# State-bearing mutation deny-list (each entry handles both dotted and
# space-aliased forms via candidate1/candidate2 above).
case "$candidate1:$candidate2" in
  # phase.* writes ROADMAP.md
  "phase.add:"*|"phase:phase.add"|"phase.add-batch:"*|"phase:phase.add-batch"|\
  "phase.insert:"*|"phase:phase.insert"|"phase.remove:"*|"phase:phase.remove"|\
  "phase.complete:"*|"phase:phase.complete"|"phase.scaffold:"*|"phase:phase.scaffold")
    target=ROADMAP.md
    redirect="the upstream /gsd-* command (it routes through the gsd-sdk shadow into beads transparently) or use \`bd\` directly"
    ;;
  # phases.* writes ROADMAP.md
  "phases.clear:"*|"phases:phases.clear"|"phases.archive:"*|"phases:phases.archive")
    target=ROADMAP.md
    redirect="the upstream /gsd-* command or use \`bd\` directly"
    ;;
  # roadmap.* writes ROADMAP.md
  "roadmap.update-plan-progress:"*|"roadmap:roadmap.update-plan-progress"|\
  "roadmap.annotate-dependencies:"*|"roadmap:roadmap.annotate-dependencies")
    target=ROADMAP.md
    redirect="bd-sync.sh (handles regen automatically); use \`bd\` directly to mutate state"
    ;;
  # requirements.* writes REQUIREMENTS.md
  "requirements.mark-complete:"*|"requirements:requirements.mark-complete")
    target=REQUIREMENTS.md
    redirect="the upstream /gsd-* command or use \`bd close <req-id>\` directly"
    ;;
  # todo.* writes .planning/todos/
  "todo.complete:"*|"todo:todo.complete")
    target=".planning/todos/"
    redirect="the upstream /gsd-* command or use \`bd close <todo-id>\` directly"
    ;;
  # milestone.complete writes ROADMAP.md + REQUIREMENTS.md (dual)
  "milestone.complete:"*|"milestone:milestone.complete")
    target="ROADMAP.md + REQUIREMENTS.md"
    redirect="the upstream /gsd-* command (handles dual-write via bd-sync regen) or use \`bd\` directly"
    ;;
  *)
    # Not in the deny-list — allow
    exit 0
    ;;
esac

jq -n --arg target "$target" --arg cmd "$candidate1 $second_word" --arg redirect "$redirect" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("State-bearing gsd-sdk mutations route through the gsd-sdk shadow at ~/.local/bin/gsd-sdk in beads-managed projects. gsd-sdk query " + $cmd + " writes to " + $target + " which is generated from beads. Run via " + $redirect + ". This is the defensive backup hook.")
  }
}'
exit 0
