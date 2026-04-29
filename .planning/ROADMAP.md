# Roadmap

## Milestone v0.1 — Foundation

### Phase 1: Spike — validate beads + GSD topology

Throwaway test of the architectural assumptions in
`notes/beads-gsd-architecture.md` before committing to the full layer. See
`notes/spike-validation-plan.md` for what it must validate.

**Status:** complete
**Depends on:** —

### Phase 2: Build the layer

The full skill + hook + script implementation. Gated on Phase 1 success.

**Goal:** Productionize the 13 spike POCs into a `git clone && ./install.sh` distribution that gates GSD planning state behind beads, leaving GSD core untouched (REQ-01..REQ-08).

**Status:** complete (2026-04-28)
**Depends on:** Phase 1
**Requirements:** [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08]
**Plans:** 7 plans

Plans:
- [x] 02-01-bd-helpers-PLAN.md — `cascade-loop.sh`, `regen-roadmap.sh`, `regen-requirements.sh` (REQ-01)
- [x] 02-02-hooks-PLAN.md — `block-state-md.sh`, `bd-sync.sh`, `block-gsd-sdk-mutation.sh` + `settings.fragment.json` + 3 hook test suites (REQ-04, REQ-07)
- [x] 02-03-shadow-binary-PLAN.md — `gsd-sdk-shadow.mjs` + 13 bd-backed handlers + `wrap-mutation.mjs` (REQ-01, REQ-02, REQ-04)
- [x] 02-04-worktree-init-PLAN.md — `worktree-post-checkout.sh` sentinel-marker shim + idempotency tests (REQ-03)
- [x] 02-05-install-script-PLAN.md — `install.sh` self-contained installer + bd memory seeding + symlink (REQ-02, REQ-06, REQ-08)
- [x] 02-06-e2e-smoke-test-PLAN.md — fresh fixture E2E + perf gate + concurrent-merge + post-gsd-update + bd-ready (REQ-01..REQ-08)
- [x] 02-07-gap-closure-PLAN.md — install.sh path substitution + portable awk capitalization in regen-requirements.sh (REQ-04, REQ-06; closes 02-VERIFICATION.md gaps)

### Phase 3: Cross-worktree validation

Verify shared `BEADS_DIR` works across multiple worktrees in real use. Document
the recommended worktree setup.

**Status:** complete (2026-04-28)
**Depends on:** Phase 2

---

## Milestone v0.2 — Beads-backed reads

Extend the gsd-sdk shadow with read-side handlers so state-bearing queries
derive their answers from `bd` on beads-managed projects, restoring
`/gsd-progress`, `/gsd-resume-work`, `/gsd-execute-phase`, and other GSD
command-surface routing. Scope: all 16 P1 read handlers + Phase 0-style
refactor + mutation-handler audit gate.

## Phases

- [ ] **Phase 4: findBeadsRoot() + parity test infrastructure** — Refactor detection + lay down the snapshot/fallback harness every read handler will use
- [ ] **Phase 5: roadmap.* read handlers** — `roadmap.analyze` + `roadmap.get-phase` derive bd-backed phase state with full upstream parity
- [ ] **Phase 6: progress.* read handlers** — `progress.json` + `progress` + `progress.bar` + `progress.table` reuse roadmap parsing primitives
- [ ] **Phase 7: state.* read handlers** — `state-snapshot` + `state.json` + `state.load` surface bd-derived decisions, frontmatter, and STATE.md text
- [ ] **Phase 8: phase resolution + lookup handlers** — `find-phase` + `phases.list` + `phase.next-decimal` + `phase-plan-index` route phase identifiers off bd
- [ ] **Phase 9: init.* read handlers** — `init.progress` + `init.milestone-op` + `init.todos` deliver bd-backed init context for skill entry points
- [ ] **Phase 10: state-mutation hook coverage audit** *(blocks ship; parallelisable)* — Verify the 12 `state.*` mutation handlers cannot drift STATE.md from beads
- [ ] **Phase 11: transitive P1 verification + cross-cutting QUAL gates** — Confirm transitively-fixed handlers and lock in performance, ordering, allowlist, and non-bd regression invariants

## Phase Details

### Phase 4: findBeadsRoot() + parity test infrastructure

**Goal**: Read-side detection and shared test harness are in place before any read handler is written, so every subsequent phase plugs into the same parity, fallback, and worktree-correct foundation.

**Depends on**: Phase 2 (existing shadow), Phase 3 (worktree topology validated)

**Requirements**: REQ-QUAL-01, REQ-QUAL-02, REQ-QUAL-03

**Success Criteria** (what must be TRUE):
  1. `findBeadsRoot(projectDir)` resolves to the correct `.beads/` for (a) flat single-repo projects, (b) git worktrees that symlink `.beads/` from the source repo, and (c) projects with `BEADS_DIR` set in env — verified by a worktree fixture test that creates a `git worktree add` setup and confirms the function returns the source-repo `.beads/` path.
  2. Read-side dispatch in `bin/gsd-sdk-shadow.mjs` recognises a `BeadsUnavailableError` sentinel: when a future read handler throws it, the shadow falls through to upstream via `spawnUpstream(argv)` instead of `process.exit(1)`. Existing v0.1 mutation behaviour (loud-fail on error) is unchanged because mutations do not throw the sentinel.
  3. A reusable parity-test helper exists at `tests/shadow-tests/_parity-helpers.mjs` (or equivalent) that captures upstream's `data` shape for a given `gsd-sdk query <cmd>` invocation against a fixture and asserts shape equivalence (key set + value types) against the shadow's output. Phases 5–9 import it; the helper supports the red→green workflow (snapshot written before handler).
  4. `BEADS_READ_OVERRIDES` table is declared (empty in this phase) and registered in the dispatch loop without `wrapMutation`. The comment near `BEADS_OVERRIDES` is updated to clarify "13 mutation entries; reads register separately." The change is verified by a test that `gsd-sdk query <unmapped-read>` on a beads-managed fixture still falls through to upstream (no read handlers active yet).

**Plans**: TBD

### Phase 5: roadmap.* read handlers

**Goal**: `/gsd-progress`'s rich phase panel and every consumer of phase metadata renders bd-derived data with full upstream shape parity, on both empty and populated fixtures.

**Depends on**: Phase 4

**Requirements**: REQ-READ-01, REQ-READ-02

**Success Criteria** (what must be TRUE):
  1. `gsd-sdk query roadmap.analyze --project-dir <bd-fixture>` returns the upstream 10-key data shape (`milestones`, `phases`, `phase_count`, `completed_phases`, `total_plans`, `total_summaries`, `progress_percent`, `current_phase`, `next_phase`, `missing_phase_details`) plus `backend: 'beads'`, with each `phases[]` element carrying its 10-key sub-shape including `disk_status`. `current_phase` and `next_phase` are phase numbers (e.g. `"89"`), never bead IDs (e.g. `"sylv-cw0"`).
  2. On a 11-phase / 24-plan beads fixture, `roadmap.analyze.total_plans` matches `bd count -l gsd:plan` and `roadmap.analyze.completed_phases` matches the count of phase epics with `status=closed` from `bd list -l gsd:phase --status=closed -n 0 --json`.
  3. `gsd-sdk query roadmap.get-phase <N>` returns the same per-phase shape used inside `roadmap.analyze.phases[]`, derived from the same parsing helpers (verified by test: both handlers' output for phase N is byte-equal in the overlapping keys).
  4. Parity snapshot test (red → green) for both handlers exists and was written **before** the handler implementation; CI fails if either handler omits a key from the upstream shape.
  5. On a non-bd fixture, both queries fall through to upstream unchanged (verified by passthrough test asserting `backend !== 'beads'`).

**Plans:** 5 plans

Plans:
- [ ] 05-01-fixture-migration-PLAN.md — build-seed.sh emits phase-id:NN labels + milestone-heading memories + 11 phases / 24 plan children for SC #2 substrate (D-03/D-18)
- [ ] 05-02-shared-helpers-PLAN.md — parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading helpers + assertKeySetParityWithExt extension (D-02/D-07/D-10..D-12/D-13/D-15..D-17)
- [ ] 05-03-roadmap-analyze-PLAN.md — beadsRoadmapAnalyze handler + parity snapshot + counts/milestone-scoping/drift tests; deletes _phase4-test-stub (REQ-READ-01, SC #1, #2, #4, #5)
- [ ] 05-04-roadmap-get-phase-PLAN.md — beadsRoadmapGetPhase handler + cross-handler-parity test (REQ-READ-02, SC #3, #5)
- [ ] 05-05-quality-gates-PLAN.md — handler-roadmap-determinism.test.sh (5x byte-identical) + handler-roadmap-call-count.test.mjs (<=2 spawns) precursors for Phase 11

### Phase 6: progress.* read handlers

**Goal**: Progress-bar and progress-percentage rendering across `/gsd-progress`, `/gsd-transition`, and `/gsd-complete-milestone` derive their numbers from bd, and the rendered string matches upstream byte-for-byte on equivalent fixtures.

**Depends on**: Phase 4, Phase 5 (shares roadmap parsing primitives)

**Requirements**: REQ-READ-03, REQ-READ-04

**Success Criteria** (what must be TRUE):
  1. `gsd-sdk query progress.json` returns `{ milestone_version, milestone_name, phases: [{number,name,plans,summaries,status}], total_plans, total_summaries, percent, backend: 'beads' }`. `total_plans`, `total_summaries`, and `percent` match the values produced by `bd count -l gsd:plan --by-status` on the same fixture.
  2. `gsd-sdk query progress` and `gsd-sdk query progress.json` are aliased to the same handler and return byte-identical output (verified by alias test).
  3. `gsd-sdk query progress.bar` returns `{ bar, percent, completed, total, backend: 'beads' }` where `bar` is exactly 20 characters of `█`/`░` plus the `[bar] N/M plans (P%)` envelope, character-equal to upstream's output for an equivalent file-based fixture.
  4. `gsd-sdk query progress.table` returns the same row shape as upstream (verified by parity snapshot test); per-phase status enum collapses to the four values (`Complete`, `In Progress`, `Planned`, `Pending`) per documented v0.2 contract — `Needs Review` and `Executed` are explicitly NOT emitted, and the divergence is documented in the handler doc-comment.
  5. Empty-bd fixture (`.beads/` exists, zero phases beaded): all four queries return well-formed empty-state shapes (`percent: 0`, `total: 0`, `phases: []`) with `backend: 'beads'` rather than crashing or exiting 1.

**Plans**: TBD

### Phase 7: state.* read handlers

**Goal**: `/gsd-progress`'s decisions/blockers panel, `/gsd-next` routing, and `/gsd-do` / `/gsd-ship` / `/gsd-settings` state-loading all consume bd-derived state without reading STATE.md from disk.

**Depends on**: Phase 4, Phase 5 (shares phase parsing)

**Requirements**: REQ-READ-05, REQ-READ-06, REQ-READ-07

**Success Criteria** (what must be TRUE):
  1. `gsd-sdk query state-snapshot` returns the upstream 13-field shape (`current_phase, current_phase_name, total_phases, current_plan, total_plans_in_phase, status, progress_percent, last_activity, last_activity_desc, decisions[], blockers[], paused_at, session{last_date,stopped_at,resume_file}`) plus `backend: 'beads'`. `decisions[]` is derived from `bd memories --json` filtered to keys with the `<milestone>:` prefix; `pending_todos` count matches `bd count -l gsd:todo --status=open`. STATE.md fields without bd equivalents (`paused_at`, `session.last_date`, `session.stopped_at`, `session.resume_file`) are present and explicitly `null` (not omitted).
  2. `gsd-sdk query state.json` returns the STATE.md frontmatter shape (`gsd_state_version, milestone, milestone_name, current_phase, current_phase_name, current_plan, status, stopped_at, paused_at, last_updated, last_activity, progress: {…}`) derived from bd. The strategy decision (in-handler synthesis vs pre-regen via `bd-sync.sh`) is documented in the plan-phase artifact and consistently applied; either strategy satisfies parity.
  3. `gsd-sdk query state.load` returns `{ config, state_raw, state_exists, roadmap_exists, config_exists }` where `state_raw` is consistent with `state.json` (same milestone, same `current_phase`, same `status`) — verified by a test that parses YAML out of `state_raw` and diffs against `state.json` output.
  4. On a beads fixture with 3 `<milestone>:*` memories, `state-snapshot.decisions[]` contains exactly 3 entries; on a fresh `bd init` fixture (no memories), `decisions[]` is `[]` — never `null`, never undefined.
  5. Memory-key vocabulary filter is enforced: keys starting with `session:`, the literal `schema_version` key, and `gsd-beads:*` project-vocabulary keys are excluded from `decisions[]` (verified by fixture test that seeds all three key types and asserts none surface).

**Plans**: TBD

### Phase 8: phase resolution + lookup handlers

**Goal**: Phase-scoped commands (`/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-insert-phase`, `/gsd-add-backlog`, `/gsd-audit-milestone`, `/gsd-plan-milestone-gaps`) resolve phase identifiers from bd labels and surface phase plan indexes from the bead graph.

**Depends on**: Phase 4, Phase 5 (shares phase parsing)

**Requirements**: REQ-READ-08, REQ-READ-12, REQ-READ-13, REQ-READ-14

**Success Criteria** (what must be TRUE):
  1. `gsd-sdk query find-phase <hint>` resolves phase numbers (`"3"`), full names (`"Phase 3: Auth"`), and partial matches (`"auth"`) against `phase-id:NN` labels and bead titles, returning the upstream shape (`{ found, directory, phase_number, phase_name, phase_slug, plans, summaries, incomplete_plans, has_research, has_context, has_verification, has_reviews }`). On unmatched input, returns `{ found: false }` with `backend: 'beads'`.
  2. `gsd-sdk query phases.list` returns `{ directories | files, count }` (matching upstream's `--type plans|summaries` and `--phase` argument shapes) with phases sorted deterministically by `phase-id:NN` numeric value (NOT bd row order). Two consecutive calls return byte-identical output.
  3. `gsd-sdk query phase.next-decimal <base>` returns the next free decimal under base phase by inspecting `phase-id:` labels (e.g. `phase.next-decimal 72` returns `72.1` if no decimals exist, `72.4` if `72.1`, `72.2`, `72.3` are present). Verified against an `/gsd-insert-phase` fixture.
  4. `gsd-sdk query phase-plan-index <phase>` returns `{ phase, plans: [{id, wave, autonomous, objective, files_modified, task_count, has_summary}], waves, incomplete, has_checkpoints }` where plan `id`s come from bd (`plan-id:NN-MM` labels) and `wave`/`autonomous`/`files_modified`/`must_haves` continue to come from PLAN.md frontmatter on disk. The hybrid bd+disk derivation is documented in the handler doc-comment.
  5. Parity snapshot tests for all four handlers pass (red→green) and CI catches any field drift from upstream's shape.

**Plans**: TBD

### Phase 9: init.* read handlers

**Goal**: `/gsd-progress`, `/gsd-add-todo`, `/gsd-check-todos`, `/gsd-audit-milestone`, `/gsd-autonomous`, `/gsd-complete-milestone`, and `/gsd-milestone-summary` consume bd-derived init context as their entry-point query.

**Depends on**: Phase 4, Phase 5 (shares phase parsing), Phase 7 (shares STATE.md derivation)

**Requirements**: REQ-READ-09, REQ-READ-10, REQ-READ-11

**Success Criteria** (what must be TRUE):
  1. `gsd-sdk query init.progress` returns the init JSON shape consumed by `/gsd-progress` (`{ executor_model, planner_model, commit_docs, milestone_version, milestone_name, phases: [{number,name,directory,status,plan_count,summary_count,has_research}], phase_count, completed_count, in_progress_count, current_phase, next_phase, paused_at, has_work_in_progress, roadmap_exists, state_exists }`) with all state-bearing fields derived from bd and file-existence fields (`has_research`, `roadmap_exists`, `state_exists`) still derived from disk.
  2. `gsd-sdk query init.milestone-op` returns the init JSON shape consumed by `/gsd-new-milestone` and `/gsd-complete-milestone` (`{ commit_docs, milestone_version, milestone_name, milestone_slug, phase_count, completed_phases, all_phases_complete, archived_milestones, archive_count, project_exists, roadmap_exists, state_exists, archive_exists, phases_dir_exists }`). `all_phases_complete` reflects the closed-vs-total ratio computed from `bd list -l gsd:phase`, gating `/gsd-autonomous` correctly.
  3. `gsd-sdk query init.todos` returns the todo enumeration shape (`{ commit_docs, date, timestamp, todo_count, todos: [{file,created,title,area,path}], area_filter, pending_dir, completed_dir, todos_dir_exists, pending_dir_exists, project_root, agents_installed }`) where `todo_count` and `todos[]` come from `bd list -l gsd:todo --status=open --json` (one bead → one row).
  4. Output ordering across all three handlers is deterministic (`priority, created_at, id`) — running each query twice produces byte-identical output.
  5. Parity snapshot tests for all three handlers pass; on non-bd fixtures, all three fall through to upstream unchanged.

**Plans**: TBD

### Phase 10: state-mutation hook coverage audit (BLOCKS SHIP — parallelisable)

**Goal**: Confirm that the 12 `state.*` mutation handlers not in `BEADS_OVERRIDES` cannot drift STATE.md from beads on a beads-managed project — either by adding them to `BEADS_OVERRIDES` (with v0.1's `wrapMutation` semantics) or by documenting that the v0.1 hook layer (`block-state-md.sh` + `block-gsd-sdk-mutation.sh`) blocks them before they reach the SDK dispatcher.

**Depends on**: Phase 2 (v0.1 hook layer in place); does NOT block Phases 5–9 (parallelisable). **BLOCKS v0.2 ship.**

**Requirements**: REQ-VERIFY-01

**Success Criteria** (what must be TRUE):
  1. Each of the 12 named handlers (`state.update`, `state.patch`, `state.advance-plan`, `state.update-progress`, `state.add-decision`, `state.add-blocker`, `state.add-roadmap-evolution`, `state.begin-phase`, `state.planned-phase`, `state.milestone-switch`, `state.record-metric`, `state.record-session`) has a row in an audit document recording: invocation path (which skill/command calls it), whether it reaches the SDK dispatcher on a beads-managed project, and the disposition (covered → added to `BEADS_OVERRIDES`; or hook-blocked → documented with the specific hook + line that blocks it).
  2. For every handler classified as "covered", a corresponding entry exists in `BEADS_OVERRIDES` with a bd-backed implementation, or a documented decision to forward to upstream is captured in the handler comment.
  3. For every handler classified as "hook-blocked", a test fixture demonstrates the hook firing on a representative invocation (e.g. `gsd-sdk query state.update --field status --value executing` on a beads fixture is intercepted by `block-gsd-sdk-mutation.sh` before reaching dispatch).
  4. The audit document is committed under `.planning/notes/` (or equivalent) and referenced from the v0.2 ship gate.

**Plans**: TBD

### Phase 11: transitive P1 verification + cross-cutting QUAL gates

**Goal**: Lock in the cross-cutting invariants (non-bd regression-free, hook-safe bd allowlist, deterministic ordering, performance budget) and verify that transitively-fixed P1 handlers actually produce correct bd-derived state on a real fixture.

**Depends on**: Phases 5, 6, 7, 8, 9 (all read handlers landed); can run in parallel with Phase 10

**Requirements**: REQ-VERIFY-02, REQ-QUAL-04, REQ-QUAL-05, REQ-QUAL-06, REQ-QUAL-07

**Success Criteria** (what must be TRUE):
  1. **Non-bd regression suite (REQ-QUAL-04):** All v0.1 mutation tests pass without modification. A new full read-handler suite runs against a non-bd fixture and confirms every read handler falls through to upstream (verified by `backend !== 'beads'` in every response and by the existing v0.1 mutation behaviour being byte-equal).
  2. **Bd subcommand allowlist (REQ-QUAL-05):** A CI grep test asserts that every `bd <subcommand>` invocation in the read handlers added in Phases 5–9 uses one of the 12 read-only subcommands listed in `hooks/bd-sync.sh:22-25` (`list, show, ready, memories, status, prime, export, deps, children, search, help, version`). Test fails CI on any new read handler invoking a write-side bd subcommand.
  3. **Deterministic ordering (REQ-QUAL-06):** A test runs each list-shaped read query (`roadmap.analyze`, `progress.json`, `phases.list`, `init.todos`) 5× consecutively on the same fixture and asserts byte-identical output across all 5 invocations. Verifies sort keys (`priority, created_at, id`) are applied consistently.
  4. **Performance budget (REQ-QUAL-07):** A perf gate test asserts `roadmap.analyze` and `progress.json` complete within 500ms on a 50-phase fixture. Implementation must use a single `bd export --json` call + in-handler grouping (verified by call-count assertion: handler invocation triggers ≤ 2 `bd` spawns regardless of phase count).
  5. **Transitive P1 verification (REQ-VERIFY-02):** Integration tests on a beads-managed fixture confirm that the 8 transitively-fixed P1 handlers (`init.phase-op`, `init.execute-phase`, `init.plan-phase`, `init.verify-work`, `route.next-action`, `todo.match-phase`, `init.manager`, `init.resume`) return correct bd-derived state — specifically that their internal calls to `find-phase` + `roadmap.get-phase` + `init.todos` resolve through the new bd-backed handlers.
  6. v0.2 acceptance gate passes: `/gsd-progress` on a beads-managed project routes correctly across the four documented states (phase complete → "advance"; phase has open plans → "resume"; phase has no plans yet → "plan"; milestone complete → "complete-milestone").

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Spike — validate beads + GSD topology | — | Complete | 2026-04-26 |
| 2. Build the layer | 7/7 | Complete | 2026-04-28 |
| 3. Cross-worktree validation | — | Complete | 2026-04-28 |
| 4. findBeadsRoot() + parity test infrastructure | 0/? | Not started | — |
| 5. roadmap.* read handlers | 0/? | Not started | — |
| 6. progress.* read handlers | 0/? | Not started | — |
| 7. state.* read handlers | 0/? | Not started | — |
| 8. phase resolution + lookup handlers | 0/? | Not started | — |
| 9. init.* read handlers | 0/? | Not started | — |
| 10. state-mutation hook coverage audit | 0/? | Not started | — |
| 11. transitive P1 verification + cross-cutting QUAL gates | 0/? | Not started | — |
