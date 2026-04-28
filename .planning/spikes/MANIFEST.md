# Spike Manifest

## Idea

Validate that the **gsd-beads** integration design (see
`.planning/notes/beads-gsd-architecture.md`) actually works on this developer's
machine before committing to the full Phase 2 build. Beads becomes the source
of truth for workflow state; state-bearing markdown becomes a regenerated
read-only view; hooks deterministically enforce the write path; GSD core is
unmodified. Each assumption in `notes/spike-validation-plan.md` gets exercised.

## Requirements

Decisions that emerged from spiking. Non-negotiable for the real build.
Updated as spikes progress.

- **Use the structured `permissionDecision` JSON output (exit-0 path), not exit-2 + stderr.** The reason string reaches the agent and the path is future-compatible. (Spike 001)
- **`PreToolUse` matcher must be `Edit|Write`; path filtering happens inside the hook script** (bash `case` glob on `tool_input.file_path`). The matcher field cannot filter on file path. (Spike 001)
- **`PostToolUse` Bash filtering uses the `if: "Bash(bd *)"` field on the handler** — not the matcher. (Spike 001)
- **The install script must guarantee `jq` and `bd` are on `PATH`** before activating the hook fragment, or fail with a clear error. (Spike 001)
- **The install script must deep-merge `settings.fragment.json` into `~/.claude/settings.json`** with array deduplication on `(matcher, command)`; no native tool exists. (Spike 001)
- **State-bearing path set is locked:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/todos/**`, `.planning/seeds/**`. Both absolute and relative shapes must be recognized. Narrative MD (`PLAN.md`, `RESEARCH.md`, `AI-SPEC.md`, `UI-SPEC.md`, `DISCUSSION-LOG.md`) and source code are unaffected. (Spike 001)

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | hook-semantics | standard | `PreToolUse(Edit, ROADMAP.md)` blocks with structured error; `PostToolUse(Bash, "^bd ")` fires every time | ✓ VALIDATED | hooks, determinism, claude-code |
| 002 | beads-modeling | standard | `bd` installs; custom types `requirement`/`phase` work; parent/child auto-close cascade fires | PENDING | bd, modeling, custom-types, cascade |
| 003 | cross-worktree-sharing | standard | Two worktrees with shared `BEADS_DIR` see identical state; writes propagate without manual sync | PENDING | bd, worktrees, BEADS_DIR |
| 004 | jsonl-roundtrip | standard | `bd export` → `bd init --from-jsonl` reconstructs an equivalent graph | PENDING | bd, jsonl, portability |
| 005 | concurrent-merge | standard | Two parallel processes mutating one issue both persist (Dolt cell-merge); rapid cross-process creates produce zero ID collisions | PENDING | bd, concurrency, dolt, hash-ids |
