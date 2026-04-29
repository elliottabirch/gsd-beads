# Project: gsd-beads

A Claude Code skill + hook layer that integrates the beads issue/dependency
tracker into the GSD planning workflow.

## Current Milestone: v0.2 Beads-backed reads

**Goal:** Extend the gsd-sdk shadow with read-side handlers so state-bearing
queries derive their answers from `bd` on beads-managed projects, restoring
`/gsd-progress`, `/gsd-resume-work`, `/gsd-execute-phase`, and other GSD
command-surface routing.

**Target features:**
- `roadmap.analyze` handler — `current_phase`, `next_phase`, plan/summary
  counts, `progress_percent` from `bd list -l gsd:phase --json` + `bd children`
- `state-snapshot` handler — `decisions[]` from `bd memories`, blockers from
  labels, `pending_todos` count from `bd count -l gsd:todo --status=open`
- `progress.bar` / `progress.json` handlers — percent from `bd count` against
  `gsd:phase --status=closed` vs total
- `isBeadsManaged()` fallback in every read handler → upstream passthrough on
  non-bd projects (regression-safe)
- Read-handler test coverage in `tests/shadow-tests/`
- Audit other read queries used by the GSD command surface; bd-back the
  state-bearing ones, leave narrative-only queries (`summary-extract`) alone

**Key context:** Shadow lives at `bin/gsd-sdk-shadow.mjs`; existing 13
mutation handlers are the model — `bd … --json` → transform to upstream's
printer shape → return `{ data: … }`. Non-bd projects must remain unchanged.

## What it builds

- New skills (`/gsd-beads-init`, `/gsd-beads-add-phase`,
  `/gsd-beads-new-milestone`, `/gsd-beads-add-todo`, `/gsd-beads-plant-seed`,
  `/gsd-beads-progress`, `/gsd-beads-execute-phase`, `/gsd-beads-ready`) that
  are the user-facing entry points for state operations.
- Shell scripts (`bd-sync.sh`, `bd-export-roadmap.sh`,
  `bd-export-requirements.sh`) that deterministically regenerate state-bearing
  markdown views from the bead store.
- `~/.claude/settings.json` hook fragments that intercept writes to
  state-bearing markdown, redirect to the new skills, and run sync after `bd`
  commands.
- A bootstrap install script that symlinks/merges these into `~/.claude/`.

## Why

GSD currently keeps all workflow state in markdown. Five concrete pains:

1. Context gets lost mid-phase (long phases, multiple sessions)
2. No first-class graph or dependency visualization
3. No sharing of state across git worktrees
4. Concurrent edits to markdown produce merge conflicts
5. No structural ordering or "what's next?" beyond manual `Depends on:` lines

Beads (Dolt-backed graph DB, hash-based IDs, cell-level merge, JSONL export,
agent-first design) addresses all five.

## Audience

A single developer plus their Claude Code agents. No non-`bd` readers —
workflow state is consumed via `bd` CLI or by agents reading the regenerated
markdown views. This collapses the case for keeping a hand-authored
REQUIREMENTS.md alongside beads.

## Success criteria

- A new GSD milestone can be initialized with `/gsd-beads-init` and run
  end-to-end without ever editing ROADMAP.md, REQUIREMENTS.md, todos/, or
  seeds/ by hand.
- `bd ready` reliably answers "what should I work on next?"
- Two git worktrees of the same project see the same workflow state via shared
  `BEADS_DIR`.
- `/gsd-update` (upstream GSD update) runs cleanly with zero merge friction.
- The full layer can be installed on a fresh machine with one script.

## Non-goals

- Migrating existing GSD projects' `.planning/` into beads. Fresh start at the
  next new milestone.
- Generating markdown for human readers outside the `bd` ecosystem.
- Replacing narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md,
  DISCUSSION-LOG.md).
- Forking GSD or maintaining patches against upstream.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-29 — milestone v0.2 (Beads-backed reads) started*
