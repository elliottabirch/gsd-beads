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
- **Type strategy: all-epic + labels.** Both requirement-level and phase-level beads use `type=epic`. Distinguish via labels: `bd label add <id> gsd:requirement` for top-level, `bd label add <id> gsd:phase` for middle-level, no label needed for `task`-typed leaves. ROADMAP regen filter: `bd list --type=epic -l gsd:requirement --json` for requirements, `bd list --type=epic -l gsd:phase --json` for phases. **Rationale:** 3× faster cascade vs custom types (0.86s vs 2.7s on 7-issue fixture); leverages bd's built-in `bd epic close-eligible`; future bd cascade improvements apply automatically; agents already know `epic` from `bd prime`. (Spike 002)
- **Cascade is a 5-line loop on `bd epic close-eligible`** (see `cascade-loop.sh`). Invoked from `bd-sync.sh` after every `bd ` PostToolUse call. Idempotent — safe to call repeatedly. (Spike 002)
- **Always use `bd link --type parent-child`** (NOT `bd dep add`'s default `blocks`) for the requirement→phase→task hierarchy. (Spike 002)
- **Use `bd label propagate`** to inherit `gsd:phase` / `gsd:requirement` labels down through children when restructuring — durability mitigation. (Spike 002)
- **Run `bd hooks install` as part of gsd-beads install.** Adds 5 sentinel-merged git hook shims (pre-commit, post-merge, pre-push, post-checkout, prepare-commit-msg) with 300s timeout + graceful "no bead store" fallback. The `prepare-commit-msg` agent-identity trailer is valuable for forensics on agent-driven commits. (Spike 002)
- **Seeds map to beads issues with label `gsd:seed`** (deferred status), NOT to `bd remember` memories. `bd remember` is for cross-cutting conventions and gotchas; seeds are forward-looking work items with trigger conditions. (Spike 002)
- **`bd federation` is orthogonal to cross-worktree (spike 003)** — federation is for peer-to-peer between separate Dolt DBs on different machines; `BEADS_DIR` is for one-developer multi-worktree. Not needed for single-developer MVP. (Spike 002)
- **Cross-worktree sharing uses `BEADS_DIR=<shared>/.beads` + embedded mode.** No `bd dolt push` between worktrees needed — writes are immediately visible. `--shared-server` mode is documented as escape hatch for heavy concurrency, not required for MVP. (Spike 003)
- **`bd init --stealth` must be re-run in any newly-added worktree** to configure that worktree's `.git/info/exclude` (stealth state is per-worktree). The actual bead store is shared via `BEADS_DIR`; only the git-exclude config is per-worktree. (Spike 003)
- **Hash-based ID uniqueness is solid under concurrent load.** 125 beads created across 40 concurrent processes from 2 worktrees: 125 unique IDs, 0 collisions. Embedded Dolt serializes concurrent writes via file lock at ~3.25 writes/sec; correctness is guaranteed even though parallel speedup is not. (Spike 003)
- **`bd dolt push` is for federation/remote sync, NOT local cross-worktree sync.** Must clarify in gsd-beads CLAUDE.md addendum so agents don't unnecessarily invoke it after every cross-worktree change. (Spike 003)
- **Tree rendering uses `bd children <id>`, NOT `bd dep tree`.** `dep tree` walks `blocks` deps; `children` walks `parent-child`. Generated ROADMAP.md must source from `bd children` or direct JSON queries. (Spike 002)
- **`bd prime` is beads' canonical operational SSOT.** It outputs ~80 lines of dynamic workflow context. gsd-beads' CLAUDE.md addendum points at it rather than duplicating its content. (Spike 002)

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | hook-semantics | standard | `PreToolUse(Edit, ROADMAP.md)` blocks with structured error; `PostToolUse(Bash, "^bd ")` fires every time | ✓ VALIDATED | hooks, determinism, claude-code |
| 002 | beads-modeling | standard | `bd` installs; custom types `requirement`/`phase` work; parent/child auto-close cascade fires | ⚠ VALIDATED-WITH-REFINEMENT | bd, modeling, custom-types, cascade, bd-recipes |
| 003 | cross-worktree-sharing | standard | Two worktrees with shared `BEADS_DIR` see identical state; writes propagate without manual sync | ✓ VALIDATED | bd, worktrees, BEADS_DIR, embedded-dolt |
| 004 | jsonl-roundtrip | standard | `bd export` → `bd init --from-jsonl` reconstructs an equivalent graph | PENDING | bd, jsonl, portability |
| 005 | concurrent-merge | standard | Two parallel processes mutating one issue both persist (Dolt cell-merge); rapid cross-process creates produce zero ID collisions | PENDING | bd, concurrency, dolt, hash-ids |
