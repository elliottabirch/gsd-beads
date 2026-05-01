---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: BeadsAdapter
status: executing
last_updated: "2026-05-01T02:07:41.057Z"
last_activity: 2026-05-01 -- Phase 6 execution started
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 7
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 6 (Cleanup + adapter-library scaffolding) — EXECUTING
Plan: 1 of 7
Status: Executing Phase 6
Last activity: 2026-05-01 -- Phase 6 execution started

## Reference

- **Project core value:** Implement a `BeadsAdapter` against the fork's
  `StorageAdapter` interface (`~/code/get-shit-done` on
  `feat/storage-adapter`); ship a bd-backed storage option for any GSD
  project that opts in.

- **Independent version line:** this repo (gsd-beads) tracks its own
  versions (v0.3 next, then v1.0). The fork has its own v1.0 milestone
  (StorageAdapter interface). Don't conflate them.

- **v0.3 scope:** archive shadow code, restructure as adapter library
  scaffold, preserve carry-forward primitives. Single phase. No fork
  dependency.

- **v1.0 scope:** BeadsAdapter implementation against fork interface.
  Waits for fork's Phase 1 to ship. Refined when interface stabilizes.

## v0.3 milestone scope

**Goal:** Clean up the v0.2 shadow architecture; restructure this repo
as a proper adapter library; preserve all carry-forward primitives.

**Single phase, fixed scope:**

- Archive shadow code to `archive/v0.2-shadow/`:
  - `bin/gsd-sdk-shadow.mjs`, `bin/wrap-mutation.mjs`
  - `hooks/block-gsd-sdk-mutation.sh`, `hooks/block-state-md.sh`
  - Most of `hooks/bd-sync.sh` (cascade-trigger logic stays useful)
  - `scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`
- Carry-forward primitives moved to `src/` layout:
  - `src/bd/helper.mjs` ← `bin/bd-helper.mjs`
  - `src/bd/errors.mjs` ← `bin/beads-errors.mjs`
  - `src/bd/findRoot.mjs` ← extracted from shadow's `findBeadsRoot`
  - `src/format/phase.mjs` ← phase-format module (placeholder; logic in v1.0)
  - `src/helpers/parsePhaseId.mjs` ← from shadow
  - `src/helpers/deriveDiskStatus.mjs` ← from shadow
  - `src/helpers/loadMilestoneHeading.mjs` ← from shadow
  - `src/adapter.mjs` ← BeadsAdapter placeholder (throws not-implemented)
- `package.json` rewrite: adapter library shape (exports map, no bin
  entries, peer dep on fork)

- `install.sh` rewrite or removal (no more global hook installation)
- `README.md` + `CLAUDE.md` updated to reflect post-cleanup architecture
- Tests preserved: `tests/fixtures/` stays canonical;
  `tests/shadow-tests/` half-archived (parity helpers refactored later
  when v1.0 conformance suite goes in)

**Success criteria:**

- No active code under `bin/` (archived or moved to `src/`)
- All shadow hooks archived; nothing self-installs into `~/.claude/`
- `tests/fixtures/seed.jsonl` still produces byte-identical output via
  existing helpers

- PROJECT.md, STATE.md, CLAUDE.md describe post-cleanup state
- Working tree clean; tagged `v0.3-complete`

## Architectural pivot context

This repo's v0.2 shadow architecture was abandoned 2026-04-30 after the
fork-investigation found:

- ~334 enumerated direct-I/O leaks across upstream GSD bypass the SDK
  surface entirely (workflows, agents, fat skills using Read/Write/Edit
  tools directly)

- A new leak class (`<context>`-block frontmatter `@.planning/...`)
  loads files at skill-activation time, before any shadow can intercept

- Every `/gsd-update` overwrites shadow installations
- Maintaining handlers in sync with upstream was open-ended

The decision: fork upstream and add a `StorageAdapter` interface seam
(work happens in `~/code/get-shit-done`, branch `feat/storage-adapter`).
This repo evolves into a `BeadsAdapter` implementation against that
interface.

See `.planning/DECISIONS.md` for the locked decisions.
See `.planning/research/fork-investigation/SYNTHESIS.md` for the
investigation that motivated this pivot (~258 artifacts classified, ~96
adapter methods proposed, 6 foundational primitives identified).

## Locked decisions (2026-04-30)

1. **Two-repo model** — fork (`~/code/get-shit-done`) + gsd-beads (this repo)
2. **Fork name:** keep `get-shit-done` (no rename)
3. **Upstream sync model:** fork rebases periodically against
   `gsd-build/get-shit-done`

4. **Adapter capability negotiation:** `adapter.capabilities = { ... }` flag
5. **Independent version lines:** fork has its own v1.0; this repo tracks
   its own v0.3 → v1.0 sequence

6. **SYNTHESIS.md is canonical** scope input for v1.0 BeadsAdapter

See `.planning/DECISIONS.md` for full record + rationale.

## Pending todos

- `disambiguate-bd-managed-detection.md` — relevant to v1.0 BeadsAdapter
  `init()` step (covers detection naturally as part of adapter
  construction)

## Session Continuity

Architectural pivot session 2026-04-30:

- Fork-investigation: 10 batch agents classified ~258 artifacts in
  parallel

- Synthesis: SYNTHESIS.md (6515 words, comprehensive adapter draft)
- 6 pre-flight decisions locked (DECISIONS.md)
- PROJECT.md rewritten around adapter-implementation model;
  v0.2 superseded; v0.3 (adapter prep) scoped

- Fork repo bootstrapped at `~/code/get-shit-done` on
  `feat/storage-adapter` branch with `.planning/` mirroring research
  inputs

Next: declare v0.3 via `/gsd-new-milestone`, then `/gsd-discuss-phase 1`
for the cleanup work.

Sibling repo state: fork at `~/code/get-shit-done` is in v1.0 planning
mode; runs Phases 1-5 of fork milestone; this repo (gsd-beads) waits
for fork Phase 1 interface to ship before v1.0 BeadsAdapter
implementation begins.
