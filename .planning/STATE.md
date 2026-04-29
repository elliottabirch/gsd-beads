---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: Beads-backed reads
status: planning
last_updated: "2026-04-29T18:33:56.769Z"
last_activity: 2026-04-29
current_phase: "4"
current_phase_name: findBeadsRoot() + parity test infrastructure
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 4 — findBeadsRoot() + parity test infrastructure (not started)
Plan: —
Status: Roadmap drafted; awaiting plan-phase for Phase 4
Last activity: 2026-04-29 — Roadmap for milestone v0.2 created (8 phases: 4–11)

## Reference

- **Project core value:** Integrate beads as source of truth for GSD workflow state without modifying GSD upstream.
- **Current milestone:** v0.2 (Beads-backed reads) — extend the `gsd-sdk` shadow with read-side handlers so `/gsd-progress`, `/gsd-resume-work`, `/gsd-execute-phase`, and the rest of the GSD command surface route off bd-derived state.
- **Phases this milestone:** 4 (findBeadsRoot + parity infra) → 5 (roadmap.*) → 6 (progress.*) → 7 (state.*) → 8 (phase lookup) → 9 (init.*) → 10 (mutation hook audit, parallel, blocks ship) → 11 (transitive verification + QUAL gates).
- **v0.1 phases (completed):** 1 (spike), 2 (build the layer), 3 (cross-worktree validation).

## Accumulated Context

### Key decisions (locked in by research)

- Use a NEW table `BEADS_READ_OVERRIDES` — do NOT extend `BEADS_OVERRIDES`. Reads register without `wrapMutation` (mutation-shaped events would be semantically wrong for reads).
- Per-handler parity snapshot test BEFORE handler implementation (red → green) is non-negotiable per REQ-QUAL-01.
- Read handlers MUST stay within the `bd-sync.sh` allowlist (`list, show, ready, memories, status, prime, export, deps, children, search, help, version`) — CI grep test enforces this.
- `findBeadsRoot()` replaces `isBeadsManaged()` for reads (worktree topology, symmetric with hooks fix `b51abbc`); `isBeadsManaged()` keeps its mutation semantics intact.
- Phase 4 is foundation for Phases 5–9; Phase 5 lands first because Phase 6 shares its parsing primitives; Phases 6–9 are roughly parallelisable.
- Phase 10 (mutation audit) is parallelisable with read handler work but BLOCKS SHIP.
- v0.2 ships when Phase 11 cross-cutting invariants are green AND Phase 10 audit is resolved.

### Blockers

None (roadmap drafted, plan-phase for Phase 4 is the next action).

### Pending todos

- `disambiguate-bd-managed-detection.md` (out of v0.2 scope; tracked in `.planning/todos/pending/`).

## Session Continuity

Roadmap drafted 2026-04-29 with 8 v0.2 phases (Phase 4–11). REQUIREMENTS.md traceability section to be spliced. Next action: `/gsd-plan-phase 4`.
