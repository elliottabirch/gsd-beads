TodoWrite carve-out:
- Claude Code's built-in TodoWrite tool is allowed for in-session ephemeral progress tracking (current task's sub-steps, scratch state).
- Cross-session work items, requirements, phases, and todos go in beads — NOT TodoWrite.
- The PreToolUse hook does NOT match TodoWrite (it only matches Edit|Write).
