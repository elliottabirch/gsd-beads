# Spike Wrap-Up Summary

**Date:** 2026-04-27
**Spikes processed:** 13
**Feature areas:** Hook Layer, Beads Modeling, Storage and Distribution, GSD Ecosystem Integration, Shadow Binary (Y1)
**Skill output:** `./.claude/skills/spike-findings-gsd-beads/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | hook-semantics | standard | ✓ VALIDATED | Hook Layer |
| 002 | beads-modeling | standard | ⚠ VALIDATED-WITH-REFINEMENT | Beads Modeling |
| 003 | cross-worktree-sharing | standard | ✓ VALIDATED (Approach C reshape) | Storage and Distribution |
| 004 | jsonl-roundtrip | standard | ⚠ VALIDATED-WITH-WORKAROUND | Storage and Distribution |
| 005 | concurrent-merge | standard | ✓ VALIDATED | Beads Modeling |
| 006 | gsd-skill-interaction-matrix | standard | ⚠ FINDINGS (downgraded by Y1) | GSD Ecosystem Integration |
| 007 | reader-skill-format-contract | standard | ⚠ DESIGN-IMPLICATIONS | GSD Ecosystem Integration |
| 008 | todowrite-vs-bd-collision | standard | ✓ VALIDATED | GSD Ecosystem Integration |
| 009 | gsd-new-project-e2e | standard | ⚠ DESIGN (substitute optional under Y1) | GSD Ecosystem Integration |
| 010 | bd-aware-gsd-agents | standard | ⚠ CONSTRAINTS (simplified by Y1) | GSD Ecosystem Integration |
| 011 | gsd-spike-wrap-up-integration | standard | ✓ VALIDATED | GSD Ecosystem Integration |
| 012 | gsd-sdk-hook-coverage | standard | ✓ VALIDATED (defensive backup under Y1) | Hook Layer |
| 013 | architecture-y1-shadow-poc | standard | ✓ VALIDATED (registry-override canonical) | Shadow Binary (Y1) |

**Tally:** 7 outright VALIDATED, 6 VALIDATED-WITH-CAVEAT, 0 INVALIDATED.

## Key Findings

### 1. The hook layer is sound
Two PreToolUse hooks — `Edit|Write` blocker on state-bearing markdown,
`Bash(gsd-sdk *)` blocker on state-bearing SDK mutations — work
deterministically. Spike 001's 20/20 tests + Spike 012's 43/43 tests
validate the contract. Hook scripts use exit-0 + structured JSON
output for deny; path/command filtering happens in the script body
(matcher field is too coarse).

### 2. Beads modeling: all-epic + labels won
Approach B (both requirement-level and phase-level beads use
`type=epic`, distinguished by labels `gsd:requirement` / `gsd:phase`)
beat custom types 3× on cascade speed (0.86s vs 2.7s on 7-issue
fixture) and uses bd's built-in tooling. `bd link --type parent-child`
for hierarchy. Cascade is a 5-line loop on `bd epic close-eligible`.
Concurrent writes are safe via embedded Dolt's file lock.

### 3. Non-stealth + source-repo `.beads/` is canonical
Reshape from Spike 003 reversed an earlier "use --stealth" decision.
Beads is designed to be git-tracked: `issues.jsonl` is the workflow-
state SoT, `embeddeddolt/` is the gitignored binary cache. Worktrees
point at the source repo's `.beads/` via `BEADS_DIR=<src>/.beads`.
Auto-setup post-checkout shim configures new worktrees automatically.

### 4. Fresh-clone bootstrap works (with one workaround)
`bd init --from-jsonl --prefix $(jq -r .dolt_database .beads/metadata.json)`
reconstructs the full bead state from committed JSONL: IDs, statuses,
labels, parent-child trees, close_reasons (including `"All children
completed"` cascade marker), notes, issue_type all preserved. The
explicit `--prefix` is mandatory — bd doesn't auto-restore it from
metadata.json.

### 5. GSD ecosystem integration is bigger than the architecture doc anticipated
33 of 118 GSD files touch state-bearing paths (~28% of the ecosystem).
13 BLOCKS, 17 READS, 6 MENTIONS. 4 dual-writers (REQUIREMENTS +
ROADMAP in one flow). Format contract for the regen scripts is
documented but needs schema extensions: convention labels (`req-id:`,
`category:`, `version:`, `milestone:`) + description-format parsing
for `Goal:` and `Success Criteria:`.

### 6. Architecture Y1 simplifies dramatically
User pushback during review surfaced a code smell — building 13
substitute skill prompts duplicates orchestration logic the gsd-sdk
already provides. Architecture Y1 (shadow `gsd-sdk` binary,
registry-override variant) imports the SDK's own primitives
(`createRegistry`, `resolveQueryArgv`, `extractField`), registers
bd-backed handler overrides, dispatches through the SDK's machinery.
Upstream skills work TRANSPARENTLY in beads-managed projects. The 13
substitute skills become optional UX aliases.

Phase 2 scope dropped from ~3,000 lines (13 substitutes + regen) to
~1,000 lines (1 shadow binary + regen).

### 7. Persistent instructions live in bd memories, not CLAUDE.md
Cross-cutting correction during review: "gsd-beads CLAUDE.md addendum"
language conflated two things. Persistent project knowledge lives in
`bd remember` memories under the `gsd-beads:` namespace, surfaced
automatically by `bd prime` at SessionStart. Searchable, exported with
JSONL roundtrip, updatable via bd commands. No CLAUDE.md edits required.

### 8. Three layers (now two under Y1)
- **Soft path:** bd memories prime sessions on gsd-beads vocabulary
- **Hard path:** PreToolUse hooks deterministically deny state-bearing
  edits / unauthorized SDK mutations
- **Substitute path** (was 13 skills, now: Y1 shadow binary)

The Edit/Write hook (Spike 001) remains primary for direct file edits.
The gsd-sdk hook (Spike 012) becomes defensive backup under Y1.

## What's locked in for Phase 2

See `.claude/skills/spike-findings-gsd-beads/SKILL.md` for the
implementation blueprint. Key build artifacts:

- `block-state-md.sh` — PreToolUse(Edit|Write) deny script
- `block-gsd-sdk-mutation.sh` — PreToolUse(Bash, gsd-sdk) deny script (defensive backup)
- `bd-sync.sh` — PostToolUse(Bash, bd) cascade-loop + regen
- `cascade-loop.sh` — 5-line `bd epic close-eligible` loop
- `worktree-post-checkout.sh` — auto-setup shim for new worktrees
- `gsd-sdk-shadow.mjs` — Y1 shadow binary, registry-override variant
- `regen-roadmap.sh`, `regen-requirements.sh` — format-contract regen scripts (NEW for Phase 2)
- Install script — bd init + bd setup claude + bd hooks install + gsd-beads layer
