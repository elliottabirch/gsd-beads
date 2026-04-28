# Hook Layer

The deterministic enforcement backbone of gsd-beads. Two PreToolUse hooks
that block direct edits to state-bearing markdown and unauthorized
gsd-sdk mutations.

## Requirements

- **Use the structured `permissionDecision` JSON output (exit-0 path), not exit-2 + stderr.** The reason string reaches the agent and the path is future-compatible.
- **`PreToolUse` matcher must be `Edit|Write`; path filtering happens inside the hook script** (bash `case` glob on `tool_input.file_path`). The matcher field cannot filter on file path.
- **`PostToolUse` Bash filtering uses the `if: "Bash(bd *)"` field on the handler** — not the matcher.
- **The install script must guarantee `jq` and `bd` are on `PATH`** before activating the hook fragment, or fail with a clear error.
- **The install script must deep-merge `settings.fragment.json` into `~/.claude/settings.json`** with array deduplication on `(matcher, command)`; no native tool exists.
- **State-bearing path set is locked:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/todos/**`, `.planning/seeds/**`. Both absolute and relative shapes must be recognized. Narrative MD (`PLAN.md`, `RESEARCH.md`, `AI-SPEC.md`, `UI-SPEC.md`, `DISCUSSION-LOG.md`) and source code are unaffected.

## How to Build It

### settings.json fragment (canonical layout)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh",
            "timeout": 5 }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command",
            "if": "Bash(gsd-sdk *)",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-gsd-sdk-mutation.sh",
            "timeout": 5 }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command",
            "if": "Bash(bd *)",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bd-sync.sh",
            "timeout": 30 }
        ]
      }
    ]
  }
}
```

### Hook script contract (proven pattern from spikes 001 + 012)

Each hook script:
1. Reads JSON tool payload from stdin: `payload="$(cat)"`
2. Extracts the field of interest with `jq`:
   - For Edit/Write: `tool_input.file_path`
   - For Bash: `tool_input.command`
3. Runs path/command filtering inside bash via `case` glob matching
4. For deny: exits 0 with structured JSON output:
   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "PreToolUse",
       "permissionDecision": "deny",
       "permissionDecisionReason": "<actionable redirect message>"
     }
   }
   ```
5. For allow: exits 0 with no output (implicit allow)

### Block-state-md.sh — pattern

State-bearing path filter (absolute and relative shapes both):
```bash
case "$file_path" in
  */.planning/ROADMAP.md|*/.planning/REQUIREMENTS.md|*/.planning/todos/*|*/.planning/seeds/* \
  |.planning/ROADMAP.md|.planning/REQUIREMENTS.md|.planning/todos/*|.planning/seeds/*)
    target="${file_path##*.planning/}"
    jq -n --arg target "$target" '{...deny structured...}'
    ;;
esac
```

See `sources/001-hook-semantics/hooks/block-state-md.sh` for the
complete script.

### Block-gsd-sdk-mutation.sh — pattern

Deny-list of 13 state-bearing gsd-sdk mutation commands (each with two
argv aliases — dotted form and space-aliased form). The hook parses
`tool_input.command`, finds the token after `gsd-sdk query`, looks up
the deny-list, denies if matched.

See `sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh`
for the script and the canonical 13-command deny-list.

### bd-sync.sh — pattern

PostToolUse fires after `bd ` Bash invocations. The script:
1. Runs the cascade-loop on `bd epic close-eligible` until quiescent
2. Regenerates state-bearing markdown views (`regen-roadmap.sh`,
   `regen-requirements.sh`)

See `sources/001-hook-semantics/hooks/bd-sync.sh` for the spike-era
stub; Phase 2 expands it with the regen logic from Spike 007's
format-contract.

### Test runner pattern

For empirical validation without invoking Claude Code: pipe synthetic
hook payloads (matching the documented Claude Code shape) into the
script under test. See `sources/001-hook-semantics/test-runner.sh` (20
cases) and `sources/012-gsd-sdk-hook-coverage/test-runner.sh` (43 cases).

## What to Avoid

- **DON'T use exit-2 + stderr for deny.** Less structured than exit-0
  + JSON; the agent receives plain stderr text instead of a typed
  decision. Exit-0 + `permissionDecision` is the canonical Claude Code
  contract.
- **DON'T put path filtering in the matcher field.** It only matches
  tool name. Path/command filtering must happen in the script body.
- **DON'T treat `permissionDecisionReason` as a structured directive.**
  It's human-readable hint to Claude. Useful for redirecting habits but
  not enforceable. The block itself is the enforcement.
- **DON'T skip the relative-path case.** Although Claude Code's Edit
  tool requires absolute file_path, defense-in-depth says cover relative
  shapes too — sub-scripts may pass cwd-relative paths.
- **DON'T match `Bash(bd *)` and `Bash(gsd-sdk *)` with the same script.**
  Their semantics are different (the bd hook syncs; the sdk hook denies).
  Separate scripts; same matcher, different `if` filter.

## Constraints

- `permissionDecision` accepts only `allow | deny | ask | defer`
- `if` field uses Claude Code permission rule syntax: `Bash(prefix *)`
  matches Bash with command prefix matching
- Multiple matchers fire in parallel; conflict precedence: `deny > defer > ask > allow`
- No native tool merges `settings.fragment.json` into `~/.claude/settings.json`
  — install script must implement deep-merge with array deduplication
- `jq` is a runtime dependency
- 5s timeout is sufficient for path-glob hooks; bd-sync.sh needs ~30s

## Origin

Synthesized from spikes: 001 (hook-semantics), 012 (gsd-sdk-hook-coverage)
Source files available in: sources/001-hook-semantics/, sources/012-gsd-sdk-hook-coverage/
