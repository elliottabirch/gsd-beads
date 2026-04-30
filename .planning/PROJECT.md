# Project: gsd-beads

A `BeadsAdapter` implementation of the `StorageAdapter` interface defined by
the user's GSD fork. Lives as a separate package; provides bd-backed storage
for any GSD project that opts in via config.

## Architecture (locked 2026-04-30)

```
┌────────────────────────────────────────────────────────────┐
│ <user>/get-shit-done  (separate repo — fork of upstream)   │
│  • Adapter interface refactor (StorageAdapter contract)    │
│  • Default MarkdownAdapter (zero behavior change)          │
│  • Capabilities flag for adapter feature negotiation       │
│  • Tracks gsd-build/get-shit-done; periodic rebase         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ gsd-beads  (this repo)                                      │
│  • BeadsAdapter — implements StorageAdapter against bd      │
│  • Carries forward spike findings, format module concept,   │
│    parsing helpers, JSONL roundtrip seed pattern            │
│  • Depends on the fork (npm dep / local symlink in dev)     │
└────────────────────────────────────────────────────────────┘
```

If a user installs the fork without gsd-beads, behavior is identical to
upstream GSD. If they install gsd-beads and configure
`storage.adapter: beads`, all `.planning/*` state lives in `bd` instead.

## Current Milestone: v1.0 BeadsAdapter implementation

**Status:** scoping (next session, after fork repo exists)

**Goal:** Ship a `BeadsAdapter` that implements the full StorageAdapter
contract defined by the fork, passes the conformance test suite against
real bd state, and ships as a working alternative storage backend for
GSD users.

**Phase scope (from `.planning/research/fork-investigation/SYNTHESIS.md` §7):**
1. Fork bootstrap + interface skeleton + MarkdownAdapter scaffold *(in fork repo)*
2. Wire core read methods *(in fork repo)*
3. Wire core write methods + `recordStateEvent` *(in fork repo)*
4. Plug workflow leaks *(in fork repo)*
5. Foundational primitive lift (`updateSection`, `snapshot/restore`, etc.) *(in fork repo)*
6. **BeadsAdapter implementation** *(this repo)* — leverage carry-forward
7. Conformance test suite *(both repos)*
8. Migration + distribution *(both repos)*

Phases 1–5 land in the fork repo first; gsd-beads (this repo) becomes
active again at Phase 6 once the interface is stable.

## Why this exists

GSD currently keeps all workflow state in markdown. Five concrete pains:
1. Context gets lost mid-phase (long phases, multiple sessions)
2. No first-class graph or dependency visualization
3. No sharing of state across git worktrees
4. Concurrent edits to markdown produce merge conflicts
5. No structural ordering or "what's next?" beyond manual `Depends on:` lines

Beads (Dolt-backed graph DB, hash-based IDs, cell-level merge, JSONL
export, agent-first design) addresses all five.

## Why an adapter interface (not a shadow)

v0.1 and v0.2 attempted to integrate via a runtime shadow that intercepted
`gsd-sdk query` calls. The investigation in
`.planning/research/fork-investigation/` found this approach has a hard
ceiling:
- ~334 direct-I/O leaks across upstream (workflows, agents, fat skills)
  bypass the SDK entirely
- A new leak class (`<context>`-block frontmatter `@.planning/...` references)
  loads files at skill-activation time, before any shadow can intercept
- Every `/gsd-update` overwrites shadow installations
- Maintaining shadow handlers in sync with upstream changes was open-ended

Forking to add a clean adapter interface eliminates the un-hookable surface
permanently.

## Audience

Single developer + Claude Code agents. Other adapters welcome — anyone can
write a `SqliteAdapter`, `PostgresAdapter`, `RestAdapter` against the same
interface.

## Success criteria

- A user can run `npm install -g <fork>` and get GSD with no behavior change
- Adding `gsd-beads` and `storage.adapter: beads` switches all state to bd
- Two git worktrees of the same project see the same workflow state
- `/gsd-update` (rebase fork against upstream) runs without merging into
  our adapter-interface changes
- Conformance test suite passes for both adapters
- Existing GSD users have a migration path (markdown → bd)

## Non-goals

- Modifying upstream GSD's business logic (fork only adds the adapter
  interface seam; phase numbering, slug generation, validation rules,
  state transitions stay upstream)
- Maintaining business-logic divergence from upstream
- Replacing narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md,
  DISCUSSION-LOG.md) — these stay file-based even under the bd adapter,
  treated as named-doc storage
- Generating markdown for human readers outside the `bd` ecosystem when
  the bd adapter is active (markdown views are regenerated on demand)
- Backwards compatibility with v0.1/v0.2 shadow installations (clean break;
  v0.2 work is preserved as historical reference and BeadsAdapter input)

## Carry-forward from v0.1 and v0.2 work

These artifacts translate directly into the BeadsAdapter implementation
when Phase 6 of the new milestone begins:

- **13 spike findings** — auto-loaded via `Skill("spike-findings-gsd-beads")`
  - especially Spike 002 (beads modeling), 003 (cross-worktree),
    005 (concurrent merge), 014 (blocks edges for sibling deps)
- **Bead vocabulary conventions** — `gsd:phase`, `gsd:plan`, `gsd:requirement`,
  `gsd:seed`, `gsd:todo` labels; `phase-id:NN`, `req-id:XXX-NN`,
  `version:vX.Y` label patterns
- **Memory-key patterns** — `gsd-beads:milestone:vX.Y:heading`; the
  forget-sync caveat documented in spike findings
- **Helpers** — `parsePhaseId()`, `deriveDiskStatus()`, `detectDrift()`,
  `loadMilestoneHeading()`, `findBeadsRoot()` (refactored from
  `bin/gsd-sdk-shadow.mjs`)
- **Test infrastructure** — `tests/fixtures/seed.jsonl`,
  `tests/fixtures/build-seed.sh`, `tests/fixtures/seed-fixture.sh`,
  `tests/shadow-tests/_parity-helpers.mjs`
- **Format module concept** — bidirectional `parsePhase{Title,Description}` /
  `formatPhase{Title,Description}` round-trip pair (was Plan 5.6's design;
  becomes part of BeadsAdapter)
- **Cascade-loop pattern** — `bd epic close-eligible` 5-line idempotent loop
- **Determinism contract** — `bd init --from-jsonl` byte-identity with
  `BEADS_ACTOR=seed`

These NEVER GO AWAY. v0.2's work is the foundation BeadsAdapter is built on.

## What gets archived from v0.1/v0.2 (not deleted, just superseded)

- `bin/gsd-sdk-shadow.mjs` — entire shadow architecture goes away
- `bin/wrap-mutation.mjs` — wrapper not needed in adapter model
- `BEADS_OVERRIDES`, `BEADS_READ_OVERRIDES` tables — replaced by
  StorageAdapter implementation
- `hooks/block-gsd-sdk-mutation.sh` — defensive against shadow approach;
  not needed
- `hooks/block-state-md.sh` — most uses obsolete; defense-in-depth at most
- `scripts/bd-sync.sh` PostToolUse logic — replaced by per-query bd writes
- `scripts/regen-roadmap.sh` / `scripts/regen-requirements.sh` — replaced
  by adapter writing canonical markdown directly when bd is the backend

These files stay in the repo until Phase 6 of the new milestone migrates
their logic into BeadsAdapter, then they get archived/removed.

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

*Last updated: 2026-04-30 — architectural pivot from shadow to adapter-interface model.
v0.2 milestone superseded; v1.0 BeadsAdapter implementation scoped pending fork bootstrap.*
*Decision log: `.planning/DECISIONS.md`. Investigation input: `.planning/research/fork-investigation/SYNTHESIS.md`.*
