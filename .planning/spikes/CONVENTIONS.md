# Spike Conventions

Patterns and stack choices established across the 13 spikes in this
session. New spikes follow these unless the question requires otherwise.

## Stack

- **Bash + jq + bd CLI** for the hook scripts and most spikes —
  shell-driven empirical tests.
- **Node.js (ESM) for the shadow binary** (Spike 013). When the spike
  needs to import upstream package internals, ESM + dynamic `import()`
  is the right tool. Pattern: import building blocks from
  `<pkg>/dist/...`, never modify the package.
- **HTML viewer for visual results** when the spike has multi-case
  test output (Spike 001's `view.html` is the template — dark-mode,
  monospace, results.json consumer).
- **No build tools, no Docker.** Per the spike workflow's "use whatever
  gets to a runnable result fastest" rule.

## Structure

Each spike directory contains:

```
NNN-spike-name/
├── README.md                  # frontmatter + What This Validates +
│                              # Research + How to Run + What to Expect +
│                              # Investigation Trail + Results + Files
├── <script>.sh                # if the spike has executable artifacts
├── view.html                  # if the spike benefits from visual review
├── results/results.json       # captured test output
├── fixtures/                  # synthetic test inputs
└── sandbox-link.md            # if the live sandbox lives outside the project repo
```

Live sandboxes live OUTSIDE `.planning/` (in `~/code/`, `/tmp/`) per
`notes/spike-validation-plan.md`'s "Throwaway test repo... separate from
gsd-beads/ itself so test pollution can't dirty the source repo."

## Patterns

### Build with depth, not speed

Don't declare VALIDATED after one happy-path test. Probe edge cases
(relative paths, malformed payloads, concurrent processes, fresh-clone
bootstrap). Document iterations in the README's "Investigation Trail"
section. Eight of the 11 spikes here have ≥3 iterations of probe-and-
refine.

### Empirical over speculative

When something is unclear, run the actual command. The architecture
doc claimed "Dolt cell-merge"; we tested whether concurrent writes
preserve all changes. The architecture proposed "shared BEADS_DIR";
we tested two worktrees + 40 parallel processes.

### Capture surprises as MANIFEST requirements

Findings that didn't match the architecture get captured as bullet items
in `MANIFEST.md`'s Requirements section, with the spike number in
parens. By session end, MANIFEST has ~25 such requirements that
constitute the locked-in design for Phase 2.

### Reshape > rebuild when a finding inverts a requirement

When user push-back inverted "use --stealth" into "don't use --stealth"
(Spike 003 Iteration 6), the requirement was struck-through (~~~~) with
the corrected version captured separately, both in MANIFEST and in the
spike README. This preserves the design history.

### Sentinel-marker merging for hook chains

bd uses `# --- BEGIN BEADS INTEGRATION v1.0.3 ---` markers for its
git-hook shims, settings.json blocks, and CLAUDE.md sections. gsd-beads
follows the same pattern: `# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---`
in `worktree-post-checkout.sh`. Multiple sentinel-marked blocks coexist
cleanly in one file; install/uninstall scripts manage their own block
without disturbing others.

### Architecture pivots driven by user pushback

Three of the biggest design decisions came from user pushback during
review (NOT from initial spike intent):

| Push | Original assumption | Corrected design |
|---|---|---|
| Spike 003 | Use `bd init --stealth` | Use non-stealth — beads is designed to be git-tracked |
| Spike 002 review | "GSD-specific CLAUDE.md addendum" | bd memories under `gsd-beads:` namespace |
| Spike 013 | 13 substitute skills + hook | Y1 shadow binary — substitutes become optional |

Lesson: when an architecture decision feels like it's fighting the
upstream tool, it usually IS. Spike outputs reaching VALIDATED
shouldn't be the end of design conversation — review-pass questions
about WHY a finding looks the way it does have surfaced the most
valuable course corrections.

### bd memories over CLAUDE.md for persistent instructions

In a beads-native workflow, persistent project knowledge lives in
`bd remember --key <key> "..."` calls, not CLAUDE.md addendum.
Memories are auto-surfaced by `bd prime` at SessionStart, searchable,
exported with the JSONL roundtrip, and updatable via bd commands.
gsd-beads' canonical key namespace is `gsd-beads:` (e.g.,
`gsd-beads:vocabulary`, `gsd-beads:state-paths`).

### Hook script contract

Hook scripts that respond to Claude Code events:
- Read JSON tool payload from stdin (e.g., `payload="$(cat)"`)
- Use `jq` to extract relevant fields (`tool_input.file_path`,
  `tool_input.command`)
- For PreToolUse deny: exit 0 + JSON output with
  `hookSpecificOutput.permissionDecision = "deny"` and
  `permissionDecisionReason = "..."`
- For PostToolUse: exit 0; side effects via shell commands
- Path filtering happens IN the script body via bash `case` glob
  matching, NOT in the matcher field (Spike 001)
- Use `if: "Bash(<prefix> *)"` permission rule syntax for per-command
  Bash filtering (Spike 001)

### Test-harness pattern

For hook scripts that can't run inside Claude Code itself, build a
synthetic payload driver:
- Write JSON payloads matching Claude Code's documented hook input shape
- Pipe each into the hook script under test
- Capture stdout, exit code; assert against expected behavior
- Aggregate results into `results/results.json` for the visual viewer
- Spike 001's `test-runner.sh` is the canonical example

### Incremental test-then-extend

When a happy-path test passes, immediately probe edge cases that the
spike's verdict depends on. Spike 001's iteration 2 found relative-path
handling was missing AFTER the initial 17/17 PASS — extending the
script + adding 3 new test cases produced the final 20/20.

## Tools & Libraries

| Tool | Version | Source | Why |
|---|---|---|---|
| `bd` (beads) | v1.0.3 | `npm install -g @beads/bd` | The system under test |
| `jq` | 1.7.1 | static binary from GitHub releases (`~/.local/bin/jq`) | JSON manipulation in hook scripts |
| `bash` | system default | / | Hook script runtime |
| `git` | system default | / | Worktrees, hooks, history |

`jq` is required by every gsd-beads hook script; the install script
must guarantee it's on PATH (Spike 001 finding, captured in MANIFEST).

## Standard `bd init` flags for gsd-beads

```bash
bd init --non-interactive --skip-agents
```

NOT `--stealth` (Spike 003 reshape — non-stealth lets `.beads/` be
git-tracked, giving us audit history + cross-machine sync). NOT
`--from-jsonl` for a fresh init; that flag is for fresh-clone bootstrap
only.

For fresh-clone bootstrap:
```bash
prefix=$(jq -r .dolt_database .beads/metadata.json 2>/dev/null || basename "$PWD")
bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents
chmod 700 .beads
```

The explicit `--prefix` is mandatory (Spike 004 finding — bd doesn't
auto-restore prefix from metadata.json).

## Patterns to avoid

- **`--stealth` for the canonical setup.** Defeats git tracking; loses
  audit log, cross-machine sync, fresh-clone bootstrap. (Reversed in
  Spike 003.)
- **`bd dep add` for parent-child.** Defaults to `blocks`; wrong
  semantics. Use `bd link --type parent-child`. (Spike 002.)
- **`bd dep tree` for hierarchy display.** Walks `blocks` deps, not
  parent-child. Use `bd children <id>`. (Spike 002.)
- **CLAUDE.md addendum for persistent gsd-beads instructions.** Use
  bd memories under `gsd-beads:` key namespace. (Spike 002 review
  correction.)
- **Custom types `requirement`/`phase` + custom cascade-close script.**
  Approach B (all-epic + labels + `bd epic close-eligible` loop) is 3×
  faster and uses bd's native machinery. (Spike 002 user choice.)
- **Treating `bd dolt push` as cross-worktree sync.** It's federation/
  remote sync. Local cross-worktree is automatic via shared BEADS_DIR.
  (Spike 003.)
