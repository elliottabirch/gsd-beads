# Project: gsd-beads

A `BeadsAdapter` implementation of the `StorageAdapter` interface defined
by the user's GSD fork (`~/code/get-shit-done`, branch
`feat/storage-adapter`). Lives as a separate package; provides bd-backed
storage for any GSD project that opts in via config.

## Architecture (locked 2026-04-30)

```
┌────────────────────────────────────────────────────────────┐
│ <user>/get-shit-done   (fork — sibling repo)                │
│  • StorageAdapter interface (~10 Bin A primitives + 6       │
│    foundational primitives + ~58 Bin B named methods)       │
│  • Default MarkdownAdapter (zero behavior change)           │
│  • Capabilities flag for adapter feature negotiation        │
│  • Independent version line (its own v1.0 milestone)        │
│  • Status: Phase 1 in flight; interface still evolving      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ gsd-beads  (this repo)                                      │
│  • BeadsAdapter — implements StorageAdapter against bd      │
│  • Carries forward: 13 spike findings, format module,       │
│    parsing helpers, JSONL roundtrip seed pattern            │
│  • Independent version line (v1.0 in flight)                │
│  • Implements against SYNTHESIS.md §4 spec; refactors       │
│    when fork's interface stabilizes                         │
└────────────────────────────────────────────────────────────┘
```

If a user installs the fork without gsd-beads, behavior is identical to
upstream GSD. If they install gsd-beads and configure
`storage.adapter: beads`, all `.planning/*` state lives in `bd` instead.

## Version line (this repo's milestones — independent from fork)

| Milestone | Status | Scope |
|-----------|--------|-------|
| v0.1 | complete | Spike + initial layer + cross-worktree validation |
| v0.2 | superseded | "Beads-backed reads" via shadow — abandoned 2026-04-30 after architectural investigation found shadow has hard ceiling |
| **v1.0** | **in flight** | **BeadsAdapter implementation** — full scope per SYNTHESIS.md §4 (~75 methods); cleanup + scaffolding folded in. Implements in parallel with fork's interface evolution; refactors when fork's contract stabilizes. |

## Current Milestone: v1.0 — BeadsAdapter

**Status:** scoped; ready for `/gsd-discuss-phase 6` and `/gsd-plan-phase 6`

**Goal:** Ship a `BeadsAdapter` package that implements the full
StorageAdapter contract (per SYNTHESIS.md §4) against `bd` as the storage
backend. Includes cleanup of v0.2 shadow architecture, restructure as
adapter library, and end-to-end implementation of all ~75 adapter methods.

**Why now (not after fork's Phase 1 ships):** SYNTHESIS.md §4 is a
credible interface spec derived from a 258-artifact investigation.
Implementing against it in parallel surfaces design friction that
informs the fork's interface evolution. Acceptable cost: 10-30% refactor
when the fork's contract stabilizes.

**Target features (organized by SYNTHESIS.md §4 clusters):**
- Cleanup + scaffolding: archive v0.2 shadow code; restructure as
  adapter library (`src/` layout); package config; documentation
- Bin A generic CRUD primitives (~10 methods): `getRecord`, `putRecord`,
  `listCollection`, `getSection`, `updateSection`,
  `getFrontmatter`/`updateFrontmatter`/`mergeFrontmatter`, etc.
- Foundational primitives (~6 methods): `recordStateEvent` (discriminated
  union), `snapshot/restore` (or `withTransaction`), `putNamedDoc`,
  `writeBinaryAsset`
- Bin B named domain methods (~58):
  - Phase/plan lifecycle (~15)
  - Roadmap/milestone (~10)
  - State (~10)
  - Verify/UAT/Validation/Patterns/Security/Reviews (~15)
  - Discuss/Spec/Research (~5)
  - Todos/Notes/Seeds/Memory/Handoff (~10)
  - Workstream/Workspace/Config/Skill (~6)
  - Spike/Sketch/Codebase/Intel/Learnings (~10)
  - Debug subsystem (~5)
  - Reports/Forensics/Inbox (~3)
  - Doc ingestion (~3)
  - Templates/Commit (~3)
  - Sidecar/Counter (~3)
- Capabilities flag declaring supported features (per D-2026-04-30-05)
- Conformance test scaffolding — runs against bd fixtures; will pair
  with fork's MarkdownAdapter at v1.0 ship for cross-adapter parity tests

**Phase scope (preliminary; gsd-roadmapper refines):**
| # | Phase | Brief |
|---|-------|-------|
| 6 | Cleanup + scaffolding | Archive v0.2 shadow code; src/ layout; package.json; docs |
| 7 | Bin A primitives + foundational primitives | Wire ~16 primitive methods; conformance scaffolding |
| 8 | Phase/plan/roadmap/milestone domain methods | ~25 methods; high-frequency paths |
| 9 | State + decision + event domain methods | ~10 methods; recordStateEvent discriminated union |
| 10 | Verify/check/UAT/validation/reviews domain methods | ~15 methods |
| 11 | Discuss/spec/research/todos/seeds/handoff domain methods | ~15 methods |
| 12 | Workstream/spike/sketch/intel/codebase/debug/misc domain methods | ~15 methods |
| 13 | Conformance test suite + fork-link integration + docs | parity vs fork's MarkdownAdapter once available |

(roadmapper may consolidate; phase numbers continue from v0.2's last shipped)

## Why this exists (the core motivation)

GSD currently keeps all workflow state in markdown. Five concrete pains:
1. Context gets lost mid-phase (long phases, multiple sessions)
2. No first-class graph or dependency visualization
3. No sharing of state across git worktrees
4. Concurrent edits to markdown produce merge conflicts
5. No structural ordering or "what's next?" beyond manual `Depends on:` lines

Beads (Dolt-backed graph DB, hash-based IDs, cell-level merge, JSONL
export, agent-first design) addresses all five.

## Why an adapter (not a shadow)

v0.1 and v0.2 attempted to integrate via a runtime shadow that intercepted
`gsd-sdk query` calls. The investigation found this approach has a hard
ceiling:
- ~334 direct-I/O leaks across upstream (workflows, agents, fat skills)
  bypass the SDK entirely
- A new leak class (`<context>`-block frontmatter `@.planning/...`
  references) loads files at skill-activation time, before any shadow
  can intercept
- Every `/gsd-update` overwrites shadow installations
- Maintaining shadow handlers in sync with upstream changes was open-ended

Forking to add a clean adapter interface eliminates the un-hookable
surface permanently.

## Audience

Single developer + Claude Code agents. Other adapters welcome — anyone
can write a `SqliteAdapter`, `PostgresAdapter`, `RestAdapter` against the
same fork interface.

## Success criteria (project-level)

- A user can install the fork with `npm install -g <fork>` and get GSD
  with no behavior change (fork's responsibility)
- Adding `gsd-beads` and `storage.adapter: beads` switches all state to bd
- All ~75 BeadsAdapter methods implemented against SYNTHESIS.md §4 spec
- Conformance test suite passes for BeadsAdapter (paired with fork's
  MarkdownAdapter when fork ships)
- Two git worktrees of the same project see the same workflow state
- Existing GSD users have a migration path (markdown → bd; v1.0 ship gate)

## Non-goals

- Modifying upstream GSD's business logic (fork-side concern, not ours)
- Maintaining business-logic divergence from upstream
- Replacing narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md,
  DISCUSSION-LOG.md) — these stay file-based even under the bd adapter,
  treated as named-doc storage
- Generating markdown for human readers outside the `bd` ecosystem when
  the bd adapter is active (markdown views are regenerated on demand)
- Backwards compatibility with v0.1/v0.2 shadow installations (clean break;
  v0.2 work archived under `archive/v0.2-shadow/` as historical reference)
- 100% method coverage at v1.0 ship if fork's interface is still in flux —
  a "minimum viable BeadsAdapter" gate may apply (Bin A + foundational +
  most-used Bin B); rare Bin B methods can land in v1.1

## Carry-forward from v0.1 and v0.2 work

These artifacts translate directly into BeadsAdapter implementation. v1.0
relocates them into the new `src/` layout and wires them into the adapter.

- **13 spike findings** — auto-loaded via `Skill("spike-findings-gsd-beads")`
  - especially Spike 002 (beads modeling), 003 (cross-worktree),
    005 (concurrent merge), 014 (blocks edges for sibling deps)
- **Bead vocabulary conventions** — `gsd:phase`, `gsd:plan`, `gsd:requirement`,
  `gsd:seed`, `gsd:todo` labels; `phase-id:NN`, `req-id:XXX-NN`,
  `version:vX.Y` label patterns
- **Memory-key patterns** — `gsd-beads:milestone:vX.Y:heading`; the
  forget-sync caveat documented in spike findings
- **Helpers** (relocate to `src/helpers/`) — `parsePhaseId()`,
  `deriveDiskStatus()`, `detectDrift()`, `loadMilestoneHeading()`
- **bd CLI wrapping** (relocate to `src/bd/`) — `bd-helper.mjs`,
  `beads-errors.mjs`, `findBeadsRoot()`
- **Test infrastructure** — `tests/fixtures/seed.jsonl`,
  `tests/fixtures/build-seed.sh`, `tests/fixtures/seed-fixture.sh`,
  `tests/shadow-tests/_parity-helpers.mjs`
- **Format module concept** — bidirectional `parsePhase{Title,Description}` /
  `formatPhase{Title,Description}` round-trip pair (becomes
  `src/format/phase.mjs` with real implementation in v1.0)
- **Cascade-loop pattern** — `bd epic close-eligible` 5-line idempotent
  loop
- **Determinism contract** — `bd init --from-jsonl` byte-identity with
  `BEADS_ACTOR=seed`

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to `.planning/DECISIONS.md`

**After each milestone:**
1. Full review of all sections
2. Audit Out of Scope — reasons still valid?
3. Update carry-forward section with what survived

---

*Last updated: 2026-04-30 — v1.0 (BeadsAdapter) milestone scoped; full
implementation scope adopted in parallel with fork interface evolution.*
*Decision log: `.planning/DECISIONS.md`. Investigation input:
`.planning/research/fork-investigation/SYNTHESIS.md`.*
