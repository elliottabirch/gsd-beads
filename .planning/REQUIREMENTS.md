# Requirements

## REQ-01: Beads is source of truth for workflow state

State-bearing artifacts (requirements, phases, todos, seeds, dependencies)
live in the bead store. Markdown views of these are read-only and regenerated
deterministically.

## REQ-02: GSD core is unmodified

No file under `~/.claude/get-shit-done/` is edited. `/gsd-update` runs cleanly
without local-patch reapplication.

## REQ-03: Cross-worktree state sharing

A shared `BEADS_DIR` (or equivalent) lets multiple git worktrees of the same
project see the same workflow state.

## REQ-04: Deterministic write-path enforcement

Hooks deterministically prevent state-bearing markdown from being edited by
hand. Writes go through `/gsd-beads-*` skills, which mutate beads first and
trigger regeneration of the markdown view.

## REQ-05: Conflict-free concurrent updates

Two agents (or two worktrees) updating workflow state simultaneously merge
without conflict, via Dolt cell-level merge + hash-based IDs.

## REQ-06: Versioned, installable distribution

`gsd-beads` is a git-versioned repo with a single install script that
symlinks/merges into `~/.claude/` on a fresh machine. No manual setup steps.

## REQ-07: Narrative markdown untouched

PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md, and other
narrative files behave exactly as in vanilla GSD. No interception, no
regeneration.

## REQ-08: Ready-set query is the canonical "what's next"

`bd ready` (or a `/gsd-beads-ready` wrapper) is the single source for "what
work is currently unblocked," replacing manual roadmap scanning.

---

# Milestone v0.2 Requirements — Beads-backed reads

## Read coverage

### REQ-READ-01: `roadmap.analyze` returns bd-derived state

On a beads-managed project, `gsd-sdk query roadmap.analyze` returns the upstream
printer's full data shape (`phases[]`, `phase_count`, `current_phase`,
`next_phase`, `total_plans`, `total_summaries`, `progress_percent`,
`missing_phase_details`, `milestones`, plus per-phase 10-key sub-shape including
`disk_status`) derived from `bd export --json`. `current_phase` and `next_phase`
are phase numbers (`"89"`), never bead IDs.

### REQ-READ-02: `roadmap.get-phase` returns single-phase view

`gsd-sdk query roadmap.get-phase <N>` returns the same per-phase shape used
inside `roadmap.analyze.phases[]`, derived from bd. Reuses the same parsing
helpers as REQ-READ-01.

### REQ-READ-03: `progress.json` returns bd-derived counts

`gsd-sdk query progress.json` returns `{ percent, completed_phases,
total_phases, completed_plans, total_plans, current_phase, … }` derived from
the same `bd export` output as REQ-READ-01. Counts match `bd count -l gsd:phase
--by-status` and `bd count -l gsd:plan --by-status`.

### REQ-READ-04: `progress` / `progress.bar` / `progress.table` aliases

`progress`, `progress.bar`, and `progress.table` are pure render layers over
`progress.json`. They produce the same string output as upstream when the bd
state matches the file state on a non-bd project.

### REQ-READ-05: `state-snapshot` returns bd-derived decisions and todos

`gsd-sdk query state-snapshot` returns `{ decisions[], blockers[],
pending_todos, … }`. `decisions[]` are `bd memories` filtered by `<milestone>:`
prefix. `pending_todos` is `bd count -l gsd:todo --status=open`. STATE.md
fields without bd equivalents (`paused_at`, `session.last_date`,
`session.stopped_at`, `session.resume_file`) are returned as `null` with
documented rationale, not omitted.

### REQ-READ-06: `state.json` returns bd-derived frontmatter

`gsd-sdk query state.json` returns the STATE.md frontmatter shape derived from
bd. Strategy decision (in-handler synthesis vs pre-regen via `bd-sync.sh`) is
made at plan-phase; the contract above is invariant.

### REQ-READ-07: `state.load` returns bd-derived STATE.md text

`gsd-sdk query state.load` returns STATE.md text consistent with `state.json`
(same strategy decision applies).

### REQ-READ-08: `find-phase` resolves phase identifiers from bd

`gsd-sdk query find-phase <hint>` resolves phase numbers, names, or partial
matches against bd's `phase-id:NN` labels and phase titles, returning the same
shape as upstream's file-based lookup.

### REQ-READ-09: `init.progress` returns bd-derived init context

`gsd-sdk query init.progress` returns the init JSON shape consumed by
`/gsd-progress`, with all state-bearing fields (`current_phase`, plan counts,
percent) derived from bd.

### REQ-READ-10: `init.milestone-op` returns bd-derived milestone context

`gsd-sdk query init.milestone-op` returns the init JSON shape consumed by
`/gsd-new-milestone` and `/gsd-complete-milestone`, with milestone version,
status, and progress counts from bd.

### REQ-READ-11: `init.todos` returns bd-derived todo state

`gsd-sdk query init.todos` returns the init JSON shape consumed by todo
management commands. Todo counts and IDs come from `bd list -l gsd:todo`.

### REQ-READ-12: `phases.list` returns bd-derived phase list

`gsd-sdk query phases.list` returns the phase list shape (id, name, status,
optional metadata) sorted deterministically by `phase-id:` numeric value.

### REQ-READ-13: `phase.next-decimal` derives decimal phase numbers from bd

`gsd-sdk query phase.next-decimal <base>` returns the next available decimal
phase number (e.g., `72.1` after `72`) by inspecting `phase-id:` labels in bd.

### REQ-READ-14: `phase-plan-index` returns bd-derived plan index

`gsd-sdk query phase-plan-index <phase>` returns the plan index for a phase.
Plan IDs come from bd; PLAN.md frontmatter (`wave`, `autonomous`,
`files_modified`, `must_haves`) continues to come from disk. Hybrid bd-backed
+ file-based partial implementation is acceptable and documented.

## Quality and regression invariants

### REQ-QUAL-01: Output shape parity with upstream

Every bd-backed read handler reproduces upstream's `data` shape exactly: same
keys, same value types, same enum vocabulary. Verified by snapshot tests that
diff handler output against captured upstream output, with the snapshot
written before the handler implementation (red → green).

### REQ-QUAL-02: Read-shaped fallback contract

Every bd-backed read handler degrades gracefully when bd is unavailable
(missing, corrupt, wrong version, unreadable). Failure mode: fall through to
upstream via a `BeadsUnavailableError` sentinel + dispatch-level catch — never
exit 1, never crash the calling skill.

### REQ-QUAL-03: `findBeadsRoot()` replaces `isBeadsManaged()` for reads

Read handlers detect bd-managed projects via a `findBeadsRoot()` walk that
matches the `b51abbc` hooks fix (worktree topology, symlinked `.beads/`).
`isBeadsManaged()` remains the source of truth for mutations to keep their
existing semantics intact.

### REQ-QUAL-04: Non-bd projects are unchanged

On projects without `.beads/`, every read query falls through to upstream
exactly as today. Existing v0.1 mutation tests pass without modification.

### REQ-QUAL-05: Hook-safe bd subcommand allowlist

Read handlers only invoke bd subcommands listed in `hooks/bd-sync.sh:22-25`
(`list`, `show`, `ready`, `memories`, `status`, `prime`, `export`, `deps`,
`children`, `search`, `help`, `version`). A CI grep test asserts no read
handler invokes a write-side bd subcommand, preventing the PostToolUse hook
from triggering a 5-second cascade on every read.

### REQ-QUAL-06: Deterministic ordering

All list-shaped read outputs (phases, plans, todos, decisions) are sorted
deterministically (`priority`, `created_at`, `id`) so `current_phase` and
`next_phase` don't flap across calls in the same session.

### REQ-QUAL-07: Performance budget

A single `roadmap.analyze` or `progress.json` call completes within 500ms on
a project with up to 50 phases. Achieved via a single `bd export --json` call
+ in-handler grouping, not per-phase fan-out.

## Verification gate

### REQ-VERIFY-01: State-mutation hook coverage audit

Before v0.2 ships, the 12 state mutation handlers not in `BEADS_OVERRIDES`
(`state.update`, `state.patch`, `state.advance-plan`, `state.update-progress`,
`state.add-decision`, `state.add-blocker`, `state.add-roadmap-evolution`,
`state.begin-phase`, `state.planned-phase`, `state.milestone-switch`,
`state.record-metric`, `state.record-session`) are audited. Each is either
covered (added to `BEADS_OVERRIDES`) or its safety is documented (the v0.1
hook layer blocks it before reaching the SDK).

### REQ-VERIFY-02: Transitive P1 verification

The transitively-fixed P1 handlers (`init.phase-op`, `init.execute-phase`,
`init.plan-phase`, `init.verify-work`, `route.next-action`, `todo.match-phase`,
`init.manager`, `init.resume`) have integration tests confirming they return
correct bd-derived state on a beads-managed fixture.

## Acceptance criteria (gate v0.2 ship)

- `gsd-sdk query roadmap.analyze` on a beads-managed project returns
  plan/summary counts that match `bd count -l gsd:plan` /
  `bd count -l gsd:plan --status=closed`.
- `gsd-sdk query state-snapshot` surfaces `<milestone>:*` memories as
  `decisions[]`.
- `gsd-sdk query progress.bar` percent matches `closed_phases / total_phases`
  from bd.
- `/gsd-progress` (Claude Code skill) on a beads-managed project routes
  correctly: phase complete → "advance"; phase has open plans → "resume";
  phase has no plans yet → "plan".
- All existing v0.1 tests pass (no regression on mutation-side behavior).
- Non-beads projects: shadow falls through to upstream as before; behavior
  unchanged.
- REQ-VERIFY-01 mutation-handler audit complete.

## Out of scope

- `summary-extract` and the entire `frontmatter.*` family — narrative-only
  reads, file-based parsing is correct.
- `uat.render-checkpoint`, `intel.*`, `workstream.*` — orthogonal storage,
  not in beads.
- PLAN.md frontmatter round-tripping through beads
  (`wave`/`autonomous`/`files_modified`/`must_haves`) — file-based stays.
- Caching layer in the shadow process — one-shot per invocation; revisit
  if performance budget is breached.

## Traceability

(Filled by roadmapper.)
