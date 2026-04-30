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
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ gsd-beads  (this repo)                                      │
│  • BeadsAdapter — implements StorageAdapter against bd      │
│  • Carries forward: 13 spike findings, format module,       │
│    parsing helpers, JSONL roundtrip seed pattern            │
│  • Depends on the fork (npm peer dep / local symlink)       │
│  • Independent version line (v0.3 next, then v1.0)          │
└────────────────────────────────────────────────────────────┘
```

If a user installs the fork without gsd-beads, behavior is identical to
upstream GSD. If they install gsd-beads and configure
`storage.adapter: beads`, all `.planning/*` state lives in `bd` instead.

## Version line (this repo's milestones — independent from fork)

| Milestone | Status | Scope |
|-----------|--------|-------|
| v0.1 | complete | Spike + initial layer + cross-worktree validation |
| v0.2 | **superseded** | "Beads-backed reads" via shadow — abandoned 2026-04-30 after architectural investigation found shadow architecture has a hard ceiling |
| **v0.3** | **next** | **Adapter prep** — archive shadow code, restructure as adapter library, set up package layout. No fork dependency. |
| v1.0 | future | BeadsAdapter implementation against fork's StorageAdapter interface (waits for fork's Phase 1 to ship) |

## Current Milestone: v0.3 — Adapter prep

**Status:** ready to declare via `/gsd-new-milestone`

**Goal:** Clean up the v0.2 shadow architecture; restructure this repo as
a proper adapter library scaffold; preserve carry-forward primitives.
Independent of fork progress — pure cleanup + scaffolding work.

**Why this milestone exists:** the v0.2 shadow architecture was abandoned
when the architectural investigation (`.planning/research/fork-investigation/SYNTHESIS.md`)
revealed the shadow can't reach all of GSD's I/O surface. The shadow code
is now dead weight obscuring what this repo is becoming. We need to clean
it up and prep the directory structure before the fork's Phase 1 ships
the StorageAdapter interface that v1.0 will implement against.

**Scope (single phase):**
- **Archive shadow code** to `archive/v0.2-shadow/`:
  `bin/gsd-sdk-shadow.mjs`, `bin/wrap-mutation.mjs`,
  `hooks/block-gsd-sdk-mutation.sh`, `hooks/block-state-md.sh`, most of
  `hooks/bd-sync.sh`, `scripts/regen-roadmap.sh`,
  `scripts/regen-requirements.sh`
- **Carry-forward primitives** moved into `src/` layout:
  - `src/bd/helper.mjs` ← from `bin/bd-helper.mjs`
  - `src/bd/errors.mjs` ← from `bin/beads-errors.mjs`
  - `src/bd/findRoot.mjs` ← extracted from shadow's `findBeadsRoot`
  - `src/format/phase.mjs` ← phase-format module concept (parse/format pair)
  - `src/helpers/parsePhaseId.mjs` ← from shadow
  - `src/helpers/deriveDiskStatus.mjs` ← from shadow
  - `src/helpers/loadMilestoneHeading.mjs` ← from shadow
  - `src/adapter.mjs` ← BeadsAdapter placeholder (throws "not implemented")
- **Package config rewrite:** `package.json` updated to reflect adapter
  library shape (exports map, no bin entries, peer dep on fork)
- **Install script rewrite:** `install.sh` removed or repurposed (no more
  global hook installation — this is now an npm package, not a system
  layer)
- **README + CLAUDE.md update:** reflect post-cleanup architecture
- **Tests preserved:** `tests/fixtures/` stays as canonical fixtures;
  `tests/shadow-tests/` half-archived (parity helpers refactored later
  when v1.0's conformance suite gets set up)

**Success criteria:**
- No active code under `bin/` (all archived or moved to `src/`)
- All shadow hooks archived; nothing self-installs into `~/.claude/`
- `tests/fixtures/seed.jsonl` still produces byte-identical output
  via existing tests
- PROJECT.md / STATE.md / CLAUDE.md describe post-cleanup state
- Working tree clean; tagged `v0.3-complete`

**What this milestone does NOT do:**
- Implement BeadsAdapter — that's v1.0, gated on fork's Phase 1
- Modify the carry-forward helpers' logic — pure relocation + minor
  refactor for the new module shape
- Delete spike findings, decisions, or research docs (all preserved)

## v1.0 milestone (future, after fork Phase 1 ships)

**Goal:** Ship a `BeadsAdapter` that implements the full StorageAdapter
contract defined by the fork, passes the conformance test suite, and
ships as a working alternative storage backend for GSD users.

**Sub-phases (preliminary, refined when fork interface stabilizes):**
1. Phase 1.x: Wire BeadsAdapter against the fork's Bin A primitives
   (`getRecord`, `putRecord`, `getSection`, `updateSection`, etc.)
2. Phase 1.x: Wire Bin B named methods (phase/plan, roadmap/milestone,
   state, verify, etc.) — leverages bd schema-aware encoding
3. Phase 1.x: Wire foundational primitives (`recordStateEvent`
   discriminated union, `snapshot/restore`, `putNamedDoc`,
   `writeBinaryAsset`)
4. Phase 1.x: Conformance test suite passing against MarkdownAdapter
   parity baseline
5. Phase 1.x: Migration tooling (markdown → bd)

Phases get refined when the fork's interface ships and we know the exact
contract to implement against.

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

## Success criteria (project-level, beyond v0.3)

- A user can install the fork with `npm install -g <fork>` and get GSD
  with no behavior change
- Adding `gsd-beads` and `storage.adapter: beads` switches all state to bd
- Two git worktrees of the same project see the same workflow state
- Conformance test suite passes for both adapters
- Existing GSD users have a migration path (markdown → bd)

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

## Carry-forward from v0.1 and v0.2 work

These artifacts translate directly into the BeadsAdapter implementation
(v1.0). v0.3 reorganizes them into the new `src/` layout but doesn't
change their logic.

- **13 spike findings** — auto-loaded via `Skill("spike-findings-gsd-beads")`
  - especially Spike 002 (beads modeling), 003 (cross-worktree),
    005 (concurrent merge), 014 (blocks edges for sibling deps)
- **Bead vocabulary conventions** — `gsd:phase`, `gsd:plan`, `gsd:requirement`,
  `gsd:seed`, `gsd:todo` labels; `phase-id:NN`, `req-id:XXX-NN`,
  `version:vX.Y` label patterns
- **Memory-key patterns** — `gsd-beads:milestone:vX.Y:heading`; the
  forget-sync caveat documented in spike findings
- **Helpers** (relocated to `src/helpers/` in v0.3) — `parsePhaseId()`,
  `deriveDiskStatus()`, `detectDrift()`, `loadMilestoneHeading()`
- **bd CLI wrapping** (relocated to `src/bd/` in v0.3) — `bd-helper.mjs`,
  `beads-errors.mjs`, `findBeadsRoot()`
- **Test infrastructure** — `tests/fixtures/seed.jsonl`,
  `tests/fixtures/build-seed.sh`, `tests/fixtures/seed-fixture.sh`,
  `tests/shadow-tests/_parity-helpers.mjs` (refactored for conformance
  testing during v1.0)
- **Format module concept** — bidirectional `parsePhase{Title,Description}` /
  `formatPhase{Title,Description}` round-trip pair (lands in
  `src/format/phase.mjs` during v0.3 as a placeholder; logic written
  in v1.0)
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

*Last updated: 2026-04-30 — v0.3 milestone scoped (adapter prep).
v1.0 (BeadsAdapter implementation) deferred until fork ships StorageAdapter
interface.*
*Decision log: `.planning/DECISIONS.md`. Investigation input:
`.planning/research/fork-investigation/SYNTHESIS.md`.*
