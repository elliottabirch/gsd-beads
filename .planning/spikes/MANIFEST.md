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
- **`bd init --stealth --non-interactive` is the canonical install command.** Plain `bd init` auto-commits to the parent repo and prompts; stealth keeps the bead store local via `.git/info/exclude`. (Spike 002)
- **gsd-beads LAYERS on top of `bd setup claude`, not replaces it.** Install order: `bd init --stealth` → `bd setup claude` (installs SessionStart/PreCompact + bd's CLAUDE.md section) → gsd-beads install (adds PreToolUse(Edit|Write) blocker, PostToolUse(Bash, "Bash(bd *)") sync, GSD addendum to CLAUDE.md). The hook sets are orthogonal. (Spike 002)
- **gsd-beads is distributed as a bd custom recipe** via `bd setup --add gsd-beads <path>`. Reuses beads' install/update/remove machinery; supersedes "Path A: symlinks managed by windows-dev-setup" in `notes/beads-gsd-architecture.md`. (Spike 002)
- **Use custom types `requirement` and `phase`** (set via `bd config set types.custom "requirement,phase"`). Built-in `task` for leaves. Use `bd link --type parent-child` (NOT `bd dep add`'s default `blocks`) for hierarchy. (Spike 002)
- **Auto-close cascade is NOT free.** gsd-beads owns a `cascade-close.sh` script (proven in Spike 002) invoked from `bd-sync.sh` after every `bd ` command. `bd epic close-eligible` only handles `type=epic`. (Spike 002)
- **Tree rendering uses `bd children <id>`, NOT `bd dep tree`.** `dep tree` walks `blocks` deps; `children` walks `parent-child`. Generated ROADMAP.md must source from `bd children` or direct JSON queries. (Spike 002)
- **`bd prime` is beads' canonical operational SSOT.** It outputs ~80 lines of dynamic workflow context. gsd-beads' CLAUDE.md addendum points at it rather than duplicating its content. (Spike 002)

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | hook-semantics | standard | `PreToolUse(Edit, ROADMAP.md)` blocks with structured error; `PostToolUse(Bash, "^bd ")` fires every time | ✓ VALIDATED | hooks, determinism, claude-code |
| 002 | beads-modeling | standard | `bd` installs; custom types `requirement`/`phase` work; parent/child auto-close cascade fires | ⚠ VALIDATED-WITH-REFINEMENT | bd, modeling, custom-types, cascade, bd-recipes |
| 003 | cross-worktree-sharing | standard | Two worktrees with shared `BEADS_DIR` see identical state; writes propagate without manual sync | PENDING | bd, worktrees, BEADS_DIR |
| 004 | jsonl-roundtrip | standard | `bd export` → `bd init --from-jsonl` reconstructs an equivalent graph | PENDING | bd, jsonl, portability |
| 005 | concurrent-merge | standard | Two parallel processes mutating one issue both persist (Dolt cell-merge); rapid cross-process creates produce zero ID collisions | PENDING | bd, concurrency, dolt, hash-ids |
