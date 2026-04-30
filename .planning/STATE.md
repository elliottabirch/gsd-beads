---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: BeadsAdapter implementation (post-fork)
status: scoping
last_updated: "2026-04-30T00:00:00.000Z"
last_activity: 2026-04-30
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
superseded_milestones:
  - id: v0.1
    name: Foundation
    status: complete
    note: Spike + initial layer + cross-worktree validation. Carries forward.
  - id: v0.2
    name: Beads-backed reads
    status: superseded
    note: Phase 5/8 complete; remaining 3 phases canceled when shadow approach was abandoned in favor of fork-based adapter interface (2026-04-30). Phase 4-5 work carries forward as input to v1.0 Phase 6 (BeadsAdapter implementation).
---

# Project State

## Current Position

Milestone: v1.0 (BeadsAdapter implementation against forked GSD)
Status: scoping — pending GitHub fork creation
Last activity: 2026-04-30

## Architectural pivot (2026-04-30)

The v0.2 shadow architecture was abandoned after the fork-investigation
research found it had a hard ceiling:

- ~334 enumerated direct-I/O leaks across upstream GSD bypass the SDK
  surface entirely (workflows, agents, fat skills using Read/Write/Edit
  tools directly)
- A new leak class (`<context>`-block frontmatter `@.planning/...`)
  loads files at skill-activation time, before any shadow can intercept
- Every `/gsd-update` overwrites shadow installations
- Maintaining handlers in sync with upstream was open-ended

**Decision:** fork upstream `gsd-build/get-shit-done`, add a
`StorageAdapter` interface (zero behavior change without an adapter),
and rebuild gsd-beads as a `BeadsAdapter` implementation against that
interface.

See `.planning/DECISIONS.md` for the locked decisions.
See `.planning/research/fork-investigation/SYNTHESIS.md` for the
investigation that motivated this pivot (~258 artifacts classified, ~96
adapter methods proposed, 6 foundational primitives identified).

## v1.0 milestone scope (synthesis-derived)

8 phases (per `.planning/research/fork-investigation/SYNTHESIS.md` §7):

| # | Phase | Repo |
|---|-------|------|
| 1 | Fork bootstrap + StorageAdapter interface skeleton + MarkdownAdapter scaffold | fork |
| 2 | Wire core read methods to adapter | fork |
| 3 | Wire core write methods + `recordStateEvent` | fork |
| 4 | Plug workflow leaks (top 10 + the `<context>`-block class) | fork |
| 5 | Foundational primitive lift (`updateSection`, `snapshot/restore`, `putNamedDoc`, `writeBinaryAsset`) | fork |
| 6 | **BeadsAdapter implementation** | gsd-beads (this repo) |
| 7 | Conformance test suite (run against both adapters) | both |
| 8 | Migration + distribution | both |

Phases 1–5 are upstream-fork-side work; gsd-beads (this repo) goes dormant
until Phase 6.

## Locked decisions (2026-04-30)

1. **Two-repo model** — `<user>/get-shit-done` (fork) + `gsd-beads`
   (BeadsAdapter, this repo)
2. **Fork name:** keep `get-shit-done` (no rename)
3. **Upstream sync model:** periodic rebase against `gsd-build/get-shit-done`
4. **Adapter capability negotiation:** `adapter.capabilities = { ... }` flag

See `.planning/DECISIONS.md` for the full record + rationale.

## Open architectural questions deferred to v1.0 milestone phases

Six remaining open questions (see SYNTHESIS.md §6) are NOT blocking for
Phase 1; they get answered as the relevant phases approach:

- `commitPlanningState` semantics (Phase 3 blocker)
- Section-scoped vs whole-file granularity (Phase 5 blocker)
- 2 raw-git outliers — `spec-phase`/`eval-review` (Phase 4 cleanup)
- `<context>`-block leak mitigation strategy (Phase 4)
- Sidecar paths kv-vs-named (Phase 5)
- Knowledge-graph subsystem scope (Phase 5/6 boundary)
- "Scratch" record taxonomy (Phase 5)
- Markdown-and-lockfile helpers visibility (Phase 1 design call)
- Init-bundle granularity (Phase 2)

## Carry-forward from v0.1 / v0.2

The shadow-architecture code in `bin/gsd-sdk-shadow.mjs` and the hook
scripts are preserved in this repo as historical reference. They get
archived (not deleted) during Phase 6 when the BeadsAdapter takes over.

What translates DIRECTLY into Phase 6 (see PROJECT.md "Carry-forward"
section for the full list):

- 13 spike findings (Spike 002/003/005/007/014 especially)
- Bead vocabulary conventions (labels, IDs, hierarchy)
- Helpers: `parsePhaseId`, `deriveDiskStatus`, `detectDrift`,
  `loadMilestoneHeading`, `findBeadsRoot`
- Test infrastructure (seed.jsonl, build-seed.sh, seed-fixture.sh,
  parity helpers)
- Format-module concept (bidirectional parse/format pair)
- Determinism contract (`bd init --from-jsonl` byte-identity)
- Memory-key patterns (with documented forget-sync caveat)

## Pending todos

- `disambiguate-bd-managed-detection.md` — out of v0.2 scope when filed;
  v1.0 Phase 6 BeadsAdapter `init()` step covers this naturally

## Session Continuity

Architectural pivot session 2026-04-30:
- Fork-investigation: 10 batch agents classified ~258 artifacts in
  parallel (~3-4 hours wall clock)
- Synthesis: SYNTHESIS.md (6515 words, comprehensive adapter draft)
- 4 pre-flight decisions locked (DECISIONS.md)
- PROJECT.md rewritten around adapter-interface model
- v0.2 milestone superseded; v1.0 scoping
- Next: user forks `gsd-build/get-shit-done` to `<user>/get-shit-done`,
  clones locally; new milestone-scoping conversation in the new repo

Once the fork repo exists, the next concrete actions are:
1. Bootstrap `.planning/` in the fork repo (or use a different planning
   strategy native to the fork)
2. `/gsd-new-milestone` declaring v1.0 with the 8-phase scope above
3. `/gsd-discuss-phase 1` for the fork bootstrap + adapter interface
   skeleton + MarkdownAdapter scaffold
