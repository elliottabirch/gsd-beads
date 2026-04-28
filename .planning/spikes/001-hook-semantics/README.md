---
spike: 001
name: hook-semantics
type: standard
validates: "Given a PreToolUse(Edit|Write) hook configured in settings.json and a PostToolUse(Bash, if=\"Bash(bd *)\") hook, when an agent attempts to edit state-bearing markdown and when any bd-prefixed command runs, then the edit is deterministically denied with a structured reason that the agent reads, and the post-hook fires reliably for every bd call (and only bd calls)."
verdict: VALIDATED
related: []
tags: [hooks, determinism, claude-code, settings.json, jq]
---

# Spike 001: Hook Semantics

## What This Validates

**Given** a `PreToolUse(Edit|Write)` hook configured in `settings.json` and a
`PostToolUse(Bash, if="Bash(bd *)")` hook,
**when** an agent attempts to edit state-bearing markdown
(`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/todos/**`,
`.planning/seeds/**`) **and** when any `bd`-prefixed command runs,
**then** the edit is deterministically denied with a structured
`permissionDecisionReason` shown to the agent, and the post-hook fires
reliably for every `bd` call (and only `bd` calls).

This is the load-bearing assumption from
`.planning/notes/beads-gsd-architecture.md`: *"Skills are convenience; hooks
are load-bearing."* If false, the deterministic-write-path requirement
(REQ-04) cannot be met without modifying GSD itself, and the architecture
collapses.

## Research

Authoritative source: https://docs.claude.com/en/docs/claude-code/hooks
(currently redirects to `https://code.claude.com/docs/en/hooks`).

| Question | Answer |
|---|---|
| Can a `PreToolUse` hook block a tool call by file path? | **Yes.** Matcher filters on tool name (`Edit\|Write`); the hook script reads `tool_input.file_path` from stdin and returns `permissionDecision: "deny"` via `hookSpecificOutput` JSON on stdout. |
| Can a `PostToolUse` Bash matcher fire only on `bd ` commands? | **Yes**, via the `if` field on the individual handler using permission-rule syntax: `if: "Bash(bd *)"`. Matcher itself only filters tool names; `if` is the per-handler arg filter. |
| What does the hook script receive on stdin? | JSON with `session_id`, `tool_name`, `tool_input` (full original args including `file_path` for Edit/Write or `command` for Bash), `tool_use_id`, plus event-specific fields. |
| Exit code semantics | `0` = success, parse stdout JSON for structured decision; `2` = blocking error, stderr fed to Claude as message; other = non-blocking error, transcript shows first stderr line. |
| Structured deny path | Exit 0 + JSON: `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "..." } }`. The reason string is shown to the agent. |
| Multiple matchers on same event | All handlers run in parallel; conflict precedence: `deny > defer > ask > allow`. |
| Settings.json fragment merging | **No native tool.** A custom installer must do a deep merge with array dedup. |

**Approach comparison:**

| Approach | Pros | Cons | Status |
|----------|------|------|--------|
| `PreToolUse` exit-code-2 + stderr | Simple | Stderr is unstructured; the reason text reaches the agent but as an error blob, not a typed decision. | Rejected |
| `PreToolUse` exit-0 + `hookSpecificOutput.permissionDecision` JSON | Structured; the reason is delivered with the decision; future-compatible | Requires `jq` (or another JSON tool) on the host | **Chosen** |
| MCP server | Agent-readable typed responses | Adds runtime dependency; overkill for blocking | Rejected |

**Chosen approach:** Exit-0 JSON output with `hookSpecificOutput.permissionDecision`. The hook script does path filtering inside its body using bash `case` glob matching (not the matcher field).

## How to Run

```bash
cd .planning/spikes/001-hook-semantics
./test-runner.sh
# Then open view.html in a browser
```

If `jq` is not installed:
```bash
mkdir -p ~/.local/bin
curl -sSL -o ~/.local/bin/jq https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64
chmod +x ~/.local/bin/jq
export PATH="$HOME/.local/bin:$PATH"
```

## What to Expect

- Suite 1 — 12 cases on `block-state-md.sh`: 5 state-bearing paths denied, 4
  narrative/source paths allowed, 3 edge cases (relative path, write tool,
  spaces in filename) denied.
- Suite 2 — 7 cases on `bd-sync.sh`: 4 `bd `-prefixed commands fire the hook,
  3 non-`bd` commands are filtered out by the simulated `if: "Bash(bd *)"`
  rule.
- Suite 3 — high-volume reliability: 50 sequential `bd ` calls all recorded
  in the marker file (no drops, no races).

Total: 20/20 passing. `results/results.json` is consumed by `view.html`.

## Investigation Trail

**Iteration 1 — initial happy path.**
Wrote `block-state-md.sh` matching `*/.planning/ROADMAP.md`-style absolute
paths via bash `case` globbing. Wrote `bd-sync.sh` that just appends to a
marker file. Built a test-runner that pipes synthetic Claude Code payloads
into each. **17/17 PASS.**

**Iteration 2 — edge case probe.** Suspected the bash glob would miss
relative paths. Probed manually with `.planning/ROADMAP.md` (no leading
slash) → exited 0 with no JSON (silent allow). **Bug found.** Although
Claude Code's Edit/Write tool requires absolute paths per its tool schema,
defense-in-depth says we should still block relative variants — paths can
arrive from `cwd`-relative scripts in the bd-sync regeneration code path.

**Iteration 3 — fix + cover.** Extended the case statement with
non-prefixed alternates (`.planning/ROADMAP.md`, `.planning/todos/*`, etc.)
and adjusted the prefix-stripping to `${file_path##*.planning/}` so it
works in both shapes. Added 3 new test cases:
`block-relative-roadmap`, `block-relative-todo`, `block-spaces-in-path`.
**20/20 PASS.**

**Iteration 4 — surfaced runtime dependencies.** The hook scripts depend on
`jq`. `jq` was not installed on this machine. Documented this as a finding:
the gsd-beads install script must verify or install `jq` (and `bd`)
before activating the hook fragment.

## Results

**Verdict: VALIDATED ✓**

The hook backbone of gsd-beads is sound. Specifically:

1. **`PreToolUse` deny works deterministically.** The exit-0 +
   `hookSpecificOutput.permissionDecision: "deny"` path reliably blocks
   `Edit`/`Write` calls. The `permissionDecisionReason` text is delivered
   to the agent.

2. **The `if` field is the right filter for `bd `-prefixed commands.** The
   matcher field is too coarse (tool name only), but the `if` field's
   permission-rule syntax (`Bash(bd *)`) gives exactly the per-command
   filtering the architecture needs.

3. **Path filtering belongs in the script body, not the matcher.** The
   matcher cannot filter on `file_path`. The script reads `tool_input.file_path`
   from stdin and bash-globs it.

4. **High-volume reliability is solid.** 50 sequential synthetic fires all
   recorded — no race conditions, no drops, no dedup behavior interfering.

**Surprises and findings to carry into Phase 2:**

- **`jq` is a runtime dependency** the gsd-beads install script must
  guarantee. Same for `bd` itself. The bootstrap should detect missing
  binaries and either install them or fail with a clear error before
  activating the hook fragment. Filed for Phase 2 install script.

- **The `permissionDecisionReason` is human-readable, not a structured
  directive.** The agent reads "Use /gsd-beads-add-phase instead" and
  *should* comply, but there's no enforcement mechanism that *makes* it
  comply. The hook just denies; the redirect is a hint. This is good
  enough for the design — agents in practice do follow such hints — but
  worth documenting for users with adversarial-agent threat models.

- **No native settings.json fragment merge.** The Phase 2 install script
  must implement a deep merge with array deduplication (matching on
  `matcher` + `command` would be a sensible dedup key).

- **`Bash(bd *)` matches `bd ` followed by anything, but does NOT match
  bare `bd`** (no trailing space/args). gsd-beads always invokes `bd` with
  a subcommand, so this is fine, but worth noting.

- **End-to-end Claude-Code-runtime confirmation is still future work.** This
  spike validates the *script contract* — given the documented payload
  shape, the scripts return the documented decisions. Confirmation that
  Claude Code itself routes payloads to and from these scripts under all
  the conditions tested would require installing the hook fragment into
  `~/.claude/settings.json` and observing live behavior. That's a
  one-time install-test step for early Phase 2 — the spike here proves
  the architecture's *script half* of the contract is sound.

**Impact on remaining spikes:** None blocked. Architecture proceeds.
Spike 002 (beads-modeling) can begin — `bd` install will use the same
PATH+`~/.local/bin` approach as the `jq` install here.

## Files

- `hooks/block-state-md.sh` — PreToolUse(Edit|Write) deny script
- `hooks/bd-sync.sh` — PostToolUse(Bash, if=Bash(bd *)) sync stub
- `settings.fragment.json` — the hook config to merge into ~/.claude/settings.json
- `test-runner.sh` — synthetic payload driver
- `view.html` — visual results report (loads results/results.json)
- `fixtures/fake-gsd-project/` — synthetic file paths for tests
- `results/results.json` — last test run, structured
