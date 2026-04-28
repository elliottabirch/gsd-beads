# Phase 2: Build the layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 02-build-the-layer
**Areas discussed:** Plan sequencing & granularity, Distribution mechanism, Optional substitute skills, Mutation event emission

---

## Plan Sequencing & Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| A: Bottom-up by layer (6 plans) | 02-01 bd helpers → 02-02 hooks → 02-03 shadow binary → 02-04 worktree shim → 02-05 install script → 02-06 E2E smoke test. Dependency-ordered; each plan testable independently. | ✓ |
| B: Vertical slices (3-4 plans) | 02-01 hook layer end-to-end → 02-02 shadow binary end-to-end → 02-03 finishing touches (regen + worktree + memories) → 02-04 E2E. Higher per-plan complexity. | |
| C: Per-handler granularity (15+ plans) | 1 plan for hooks, 1 for cascade, 1 PER shadow handler (13), 1 for install. Maximum traceability; risk of duplication since handlers share scaffolding. | |

**User's choice:** A — Bottom-up by layer
**Notes:** Spike POCs naturally fit this layering; dependency order is clean (bd helpers → hooks/shadow can proceed in parallel-ish → install ties everything → E2E validates).

---

## Distribution Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| A: bd recipe (`bd setup --add gsd-beads <path>`) | Spike 002 finding: bd's recipe system supports custom recipes. Reuses bd's install/uninstall/check infrastructure. | ✓ |
| B: Custom installer (curl-pipe-bash or git-clone-and-run) | Standalone bash installer; doesn't depend on bd's recipe system. More control; reinvents what bd already provides. | |
| C: Both | Custom installer that ALSO registers a bd recipe. Defensive but more code. | |

**User's choice:** A — bd recipe path
**Notes:** Lean MVP. If bd is installed (which is a prerequisite anyway), the recipe machinery is available. No reason to build a parallel installer.

---

## Optional Substitute Skills (the 13 /gsd-beads-* aliases)

| Option | Description | Selected |
|--------|-------------|----------|
| A: Skip them entirely (lean MVP) | Y1 shadow makes upstream skills work transparently. Saves ~2000 lines. | ✓ |
| B: Ship a thin stub set (3-4 most-used) | Just /gsd-beads-add-phase, -add-todo, -plant-seed, -new-milestone (~120 lines). | |
| C: Ship all 13 (~2000 lines) | Full vocabulary parity with original architecture doc intent. | |

**User's choice:** A — Skip entirely
**Notes:** Y1 transparency is the win. If users find the lack of /gsd-beads-* prefix confusing, ship in Phase 3. Filed as deferred.

---

## Mutation Event Emission

| Option | Description | Selected |
|--------|-------------|----------|
| A: Punt to Phase 3 | Accept no GSDEvents from beads-backed mutations for MVP. Saves ~50 lines. | |
| B: Re-wrap our handlers manually in Phase 2 | Build a small helper that wraps each override with GSDEvent emission matching upstream's pattern. ~30 lines helper + 13 calls. | ✓ |
| C: Emit GSDEvents inline in each handler | More verbose per-handler; no upstream-internals dependency. | |

**User's choice:** B — Re-wrap manually in Phase 2
**Notes:** Marginal Phase 2 cost; preserves the dashboard/observability story for free in case it matters later.

---

## Claude's Discretion

- Specific test framework for the shadow binary (vitest vs node:test) — pick whatever's idiomatic
- Exact directory layout for the recipe (`scripts/`, `hooks/`, `bin/`)
- Error message phrasing for hook denials (preserve spike pattern; exact wording is implementation detail)
- Logging strategy for the shadow (quiet by default; debug via `GSD_BEADS_DEBUG=1` env var)

## Deferred Ideas

- The 13 `/gsd-beads-*` substitute skills — Phase 3 candidate if user feedback indicates need
- Custom curl-pipe-bash installer — only if CI/no-bd environments become a real use case
- `bd federation` extension for multi-developer workflows
- Live dashboard / GSDEvent consumer — D-09 preserves the option but no dashboard ships yet
- Migration script for existing GSD projects — explicitly excluded by PROJECT.md
- `gsd-progress`/`gsd-milestone-summary` regen-format hardening loop — only if E2E test surfaces fragility
