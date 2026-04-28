---
name: spike-findings-gsd-beads
description: Implementation blueprint from 13 spike experiments. Requirements, proven patterns, and verified knowledge for building gsd-beads — a Claude Code skill + hook layer that integrates the beads issue/dependency tracker into the GSD planning workflow without modifying GSD. Auto-loaded during implementation work.
---

<context>
## Project: gsd-beads

A Claude Code skill + hook layer that integrates the beads issue/
dependency tracker into the GSD planning workflow. Beads becomes the
source of truth for workflow state (requirements, phases, todos, seeds,
dependencies). State-bearing GSD markdown files (ROADMAP.md,
REQUIREMENTS.md, todos/, seeds/) become generated read-only views of
the bead store. Narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md,
UI-SPEC.md, DISCUSSION-LOG.md) is unaffected. GSD's source is never
touched — `/gsd-update` runs cleanly.

Spike sessions wrapped: 2026-04-27 (13 spikes across hook layer,
beads modeling, storage, GSD ecosystem integration, and shadow-binary
architecture)
</context>

<requirements>
## Requirements

Non-negotiable design decisions that emerged from spiking. Every
feature area reference MUST honor these. Drawn from
`.planning/spikes/MANIFEST.md`.

### Hook layer (Spike 001, 012)
- Use the structured `permissionDecision` JSON output (exit-0 path), not exit-2 + stderr.
- `PreToolUse` matcher must be `Edit|Write`; path filtering happens inside the hook script.
- `PostToolUse` Bash filtering uses the `if: "Bash(<prefix> *)"` field on the handler — not the matcher.
- Install script must guarantee `jq` and `bd` are on `PATH`.
- Install script must deep-merge `settings.fragment.json` into `~/.claude/settings.json` with array deduplication on `(matcher, command)`.
- State-bearing path set is locked: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/todos/**`, `.planning/seeds/**`.

### Beads modeling (Spike 002, 005)
- Type strategy: all-epic + labels. Both requirement-level and phase-level beads use `type=epic`. Distinguish via labels: `gsd:requirement`, `gsd:phase`. Tasks use built-in `type=task`.
- Cascade is a 5-line loop on `bd epic close-eligible` (idempotent).
- Use `bd link --type parent-child` for hierarchy (NOT `bd dep add`'s default `blocks`).
- `discovered-from` edge type for provenance when uncovering work mid-phase.

### Storage and distribution (Spike 003, 004)
- `bd init --non-interactive --skip-agents` is canonical (NOT `--stealth` — beads is designed to be git-tracked).
- Cross-worktree sharing: source-repo's `.beads/` is canonical; worktrees set `BEADS_DIR=<source-repo>/.beads`.
- Run `bd hooks install` as part of gsd-beads install.
- New worktrees auto-configured via post-checkout shim that persists `git config --worktree gsd-beads.dir`.
- Fresh-clone bootstrap: `bd init --from-jsonl --prefix $(jq -r .dolt_database .beads/metadata.json) --non-interactive --skip-agents`.
- Hash-based ID uniqueness validated under load: 125 beads / 40 concurrent processes → 0 collisions.

### Architecture (Spike 013, supersedes 006/009/010)
- **Architecture Y1** (shadow `gsd-sdk` binary, registry-override variant) is the chosen substitute pattern.
- Use the SDK's own machinery: `createRegistry`, `resolveQueryArgv`, `extractField`. Override 13 state-bearing handlers via `registry.register()`. Dispatch through `registry.dispatch()`.
- The 13 `/gsd-beads-*` substitute skills are OPTIONAL under Y1 — upstream skills work transparently.
- Upstream agents CANNOT be modified per REQ-02. GSD core is unmodified.

### GSD ecosystem integration (Spike 006, 007, 008, 010, 011)
- All persistent gsd-beads instructions live as `bd remember` memories under the `gsd-beads:` key namespace, NOT as a CLAUDE.md addendum. Memories are surfaced by `bd prime` at SessionStart.
- TodoWrite carve-out: TodoWrite is allowed for in-session ephemeral progress only; cross-session work items go in beads.
- Format contract for ROADMAP/REQUIREMENTS regen needs convention labels (`req-id:`, `category:`, `version:`, `milestone:`) + description-format parsing for `Goal:` and `Success Criteria:`.
- `bd dolt push` is for federation/remote sync, NOT cross-worktree sync.
- Seeds map to beads issues with label `gsd:seed` (deferred status), NOT to memories.

### Canonical bd memory keys

`gsd-beads:vocabulary`, `gsd-beads:state-paths`, `gsd-beads:type-strategy`, `gsd-beads:link-default`, `gsd-beads:discovered-from`, `gsd-beads:todowrite`, `gsd-beads:dolt-push`
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Hook Layer | references/hook-layer.md | Two PreToolUse hooks (Edit\|Write + Bash gsd-sdk) using exit-0 + structured JSON deny; matcher filters tool name only, path/command filtering in script body |
| Beads Modeling | references/beads-modeling.md | All-epic + labels strategy; cascade-loop on `bd epic close-eligible`; concurrent writes serialize safely (~3.25 writes/sec); discovered-from edges for provenance |
| Storage and Distribution | references/storage-and-distribution.md | Source-repo `.beads/` canonical, worktrees point at it via `BEADS_DIR`; non-stealth so JSONL is committed; fresh-clone bootstrap via `--from-jsonl` + explicit `--prefix` |
| GSD Ecosystem Integration | references/gsd-ecosystem-integration.md | 13 BLOCKS / 17 READS / 6 MENTIONS in upstream; bd memories under `gsd-beads:` namespace seeded at install time; TodoWrite carve-out documented |
| Shadow Binary (Y1) | references/shadow-binary-architecture.md | Canonical Phase 2 design: shadow `gsd-sdk` at `~/.local/bin/`, registry-override variant uses SDK primitives directly; 13 state-bearing mutation overrides |

## Source Files

Original spike source files preserved in `sources/`:
- `001-hook-semantics/` — `block-state-md.sh`, `bd-sync.sh`, `test-runner.sh`, `view.html`, `settings.fragment.json`
- `002-beads-modeling/` — `cascade-loop.sh`, `cascade-close.sh` (rejected alt)
- `003-cross-worktree-sharing/` — `worktree-post-checkout.sh`
- `004-jsonl-roundtrip/` — `original-export.jsonl`, `restored-export.jsonl`, `original-config.yaml`
- `005-concurrent-merge/` — README only (test sequence captured)
- `012-gsd-sdk-hook-coverage/` — `block-gsd-sdk-mutation.sh`, `test-runner.sh` (43 cases)
- `013-architecture-y1-shadow-poc/` — `gsd-sdk-shadow-v2.mjs` (canonical) + `gsd-sdk-shadow.js` (argv-intercept alt)
- All 13 spike READMEs are preserved with full Investigation Trail content
</findings_index>

<metadata>
## Processed Spikes

- 001-hook-semantics
- 002-beads-modeling
- 003-cross-worktree-sharing
- 004-jsonl-roundtrip
- 005-concurrent-merge
- 006-gsd-skill-interaction-matrix
- 007-reader-skill-format-contract
- 008-todowrite-vs-bd-collision
- 009-gsd-new-project-e2e
- 010-bd-aware-gsd-agents
- 011-gsd-spike-wrap-up-integration
- 012-gsd-sdk-hook-coverage
- 013-architecture-y1-shadow-poc
</metadata>
