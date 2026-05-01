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


### Milestone v0.1 (validated)

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 2 | Validated (2026-04-28) |
| REQ-02 | Phase 2 | Validated (2026-04-28) |
| REQ-03 | Phase 2, Phase 3 | Validated (2026-04-28) |
| REQ-04 | Phase 2 | Validated (2026-04-28) |
| REQ-05 | Phase 2 | Validated (2026-04-28) |
| REQ-06 | Phase 2 | Validated (2026-04-28) |
| REQ-07 | Phase 2 | Validated (2026-04-28) |
| REQ-08 | Phase 2 | Validated (2026-04-28) |

### Milestone v0.2 — Beads-backed reads

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-READ-01 (`roadmap.analyze`) | Phase 5 | Pending |
| REQ-READ-02 (`roadmap.get-phase`) | Phase 5 | Pending |
| REQ-READ-03 (`progress.json`) | Phase 6 | Pending |
| REQ-READ-04 (`progress` / `progress.bar` / `progress.table`) | Phase 6 | Pending |
| REQ-READ-05 (`state-snapshot`) | Phase 7 | Pending |
| REQ-READ-06 (`state.json`) | Phase 7 | Pending |
| REQ-READ-07 (`state.load`) | Phase 7 | Pending |
| REQ-READ-08 (`find-phase`) | Phase 8 | Pending |
| REQ-READ-09 (`init.progress`) | Phase 9 | Pending |
| REQ-READ-10 (`init.milestone-op`) | Phase 9 | Pending |
| REQ-READ-11 (`init.todos`) | Phase 9 | Pending |
| REQ-READ-12 (`phases.list`) | Phase 8 | Pending |
| REQ-READ-13 (`phase.next-decimal`) | Phase 8 | Pending |
| REQ-READ-14 (`phase-plan-index`) | Phase 8 | Pending |
| REQ-QUAL-01 (output shape parity) | Phase 4 (plumbing); referenced by Phases 5, 6, 7, 8, 9 | Pending |
| REQ-QUAL-02 (read-shaped fallback contract) | Phase 4 (plumbing); referenced by Phases 5, 6, 7, 8, 9 | Pending |
| REQ-QUAL-03 (`findBeadsRoot()` for reads) | Phase 4 | Pending |
| REQ-QUAL-04 (non-bd projects unchanged) | Phase 11 | Pending |
| REQ-QUAL-05 (hook-safe bd subcommand allowlist) | Phase 11 | Pending |
| REQ-QUAL-06 (deterministic ordering) | Phase 11 | Pending |
| REQ-QUAL-07 (performance budget) | Phase 11 | Pending |
| REQ-VERIFY-01 (state-mutation hook coverage audit) | Phase 10 *(blocks ship; parallelisable)* | Pending |
| REQ-VERIFY-02 (transitive P1 verification) | Phase 11 | Pending |

**Coverage:** 23/23 v0.2 requirements mapped to exactly one owning phase. REQ-QUAL-01 and REQ-QUAL-02 are owned by Phase 4 (where the harness/sentinel are built) but are referenced from each read-handler phase's success criteria as the parity-test-first invariant.

**Status note (2026-04-30):** v0.2 milestone superseded by architectural pivot. Phases 4 and 5 shipped; Phases 6-11 canceled. REQ-READ-03..14, REQ-QUAL-04..07, REQ-VERIFY-01..02 are all **superseded** — their concerns reframe as v1.0 BeadsAdapter requirements (TBD when fork interface ships). REQ-READ-01..02 and REQ-QUAL-01..03 shipped in v0.2 and carry forward as v1.0 inputs.

---

# Milestone v1.0 Requirements — BeadsAdapter

Full BeadsAdapter implementation against SYNTHESIS.md §4 spec
(~75 methods). Cleanup + scaffolding folded in. Implements in parallel
with fork's interface evolution; refactors when fork's contract stabilizes.

## Cleanup (archival of v0.2 shadow architecture)

### CLEAN-01: v0.2 shadow source archived

`bin/gsd-sdk-shadow.mjs` and `bin/wrap-mutation.mjs` move to
`archive/v0.2-shadow/`. No active code remains under `bin/`. Files
preserved as historical reference (not `git rm`).

### CLEAN-02: Obsolete hooks archived

`hooks/block-gsd-sdk-mutation.sh` and `hooks/block-state-md.sh` move to
`archive/v0.2-shadow/hooks/`. `hooks/bd-sync.sh` moves to the same
archive directory.

### CLEAN-03: Obsolete regen + cascade-loop scripts archived

`scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`, and
`scripts/regen-state.sh` move to `archive/v0.2-shadow/scripts/`.
scripts/cascade-loop.sh also archives to the same path; Phase 8
reintroduces the cascade primitive as `src/bd/cascade.mjs` when
wiring `completePhaseAndCascade`.

### CLEAN-04: Install script removed or repurposed

`install.sh` removed (this repo is no longer a system layer).

## Architecture (src/ layout for adapter library)

### ARCH-01: `src/bd/` module with bd CLI primitives

`src/bd/helper.mjs`, `src/bd/errors.mjs`, `src/bd/findRoot.mjs` exist
and export the v0.2 carry-forward primitives. Logic unchanged — pure
relocation + minor module-shape adjustment.

### ARCH-02: `src/helpers/` module with parsing helpers

`src/helpers/parsePhaseId.mjs`, `src/helpers/deriveDiskStatus.mjs`,
`src/helpers/detectDrift.mjs`, `src/helpers/loadMilestoneHeading.mjs`
exist and export their v0.2 implementations.

### ARCH-03: `src/format/phase.mjs` bidirectional format module

`src/format/phase.mjs` exports `parsePhaseTitle`, `formatPhaseTitle`,
`parsePhaseDescription`, `formatPhaseDescription` with real
implementations. Bidirectional contract: `parse(format(x)) === x`
verified by property tests for all canonical cases.

### ARCH-04: `src/adapter.mjs` BeadsAdapter class

`src/adapter.mjs` exports `BeadsAdapter` class that implements the
StorageAdapter interface from SYNTHESIS.md §4. Class is constructed
with a project root and validates bd availability via `findBeadsRoot()`.

### ARCH-05: `package.json` rewritten as adapter library

`package.json` reflects adapter library shape:
- `exports` map points at `src/adapter.mjs` and selected submodules
- No `bin` entries (library, not CLI)
- `peerDependencies` declare the fork (`get-shit-done` ^1.x OR
  `link:../get-shit-done` during dev)
- Scripts: `test:unit`, `test:conformance`, no `install`/`postinstall`

## Documentation refresh

### DOC-01: README.md describes adapter library

`README.md` describes architecture, install path, config snippet
(`storage.adapter: beads`), implemented method coverage, and refactor-
on-fork-interface-stabilize policy.

### DOC-02: CLAUDE.md describes this repo as adapter sibling

`CLAUDE.md` updated to reflect adapter library role; references fork at
`~/code/get-shit-done` and `.planning/research/fork-investigation/SYNTHESIS.md`
as canonical input. Spike-findings skill auto-load preserved.

## Capabilities + foundational primitives

### CAP-01: Adapter capabilities flag

`BeadsAdapter` exposes a static `capabilities` object declaring supported
features per D-2026-04-30-05:
```js
{
  record: true,
  section: true,
  binaryAsset: false,        // bd doesn't store binaries natively; will route to external blob store or error
  snapshot: true,
  transaction: false,        // bd has no atomic multi-bead transaction primitive
  namedDoc: true,
  commitPlanningState: false // OQ-01: beads is its own transactional store; no-op semantics TBD per fork
}
```
Final flag values may shift as implementation reveals constraints; flag
shape is the contract.

### PRIM-01: Bin A — generic CRUD primitives

10 generic CRUD methods per SYNTHESIS.md §4 "Bin A":
`getRecord(path)`, `putRecord(path, body)`, `removeRecord(path)`,
`listCollection(prefix, filter?)`, `exists(path)`,
`getSection(path, anchor)`, `updateSection(path, anchor, body, mode)`,
`getFrontmatter(path, field?)`, `updateFrontmatter(path, field, value)`,
`mergeFrontmatter(path, patch)`.
For bd-managed records, paths translate to bd queries; for raw markdown
records (PLAN.md, SPEC.md narrative files), they pass through to disk.

### PRIM-02: 6 foundational primitives

Per SYNTHESIS.md §4 "Foundational primitives":
- `updateSection(file, sectionId, body, mode)` — section-scoped writes
  (also a Bin A method; cross-cutting use)
- `getSection(file, anchor)` — section-scoped reads (same)
- `recordStateEvent({type, payload})` — discriminated-union event record
  over types: `roadmap_evolution`, `decision`, `blocker_added`,
  `blocker_resolved`, `metric`, `session`, `todo_count_update`,
  `deferred_items`, `forensic_session`, `quick_task` (per
  SYNTHESIS §4 state cluster)
- `snapshot()/restore()` — adapter-level checkpoint capability for
  dry-run hoist; bd implementation snapshots the JSONL + memories
- `putNamedDoc(category, key, body)` / `getNamedDoc(category, key)` —
  closed-enum kv (intel, codebase, research, archived-milestone, etc.)
- `writeBinaryAsset(path, bytes)` — declares unsupported via capabilities
  flag; throws or routes to external blob store

## Bin B implementation (~58 methods, by cluster per SYNTHESIS.md §4)

### IMPL-01: Phase/plan lifecycle methods (~15)

Per SYNTHESIS.md §4 "Phase/plan lifecycle". Includes `addPhase`,
`addPhaseBatch`, `insertPhase`, `removePhase`, `completePhaseAndCascade`,
`completeMilestone`, `archivePhases`, `clearPhases`, `findNextDecimalPhase`,
`scaffoldPhaseArtifact`, `addBacklogEntry`, `promoteBacklogEntry`,
`removeBacklogEntry`, `getPhase`, `findPhase`, `listPhases`,
`listPhasePlans`, `listPhaseSummaries`, `listPhaseArtifacts`, `getPlan`,
`addPlan`, `recordPlanAdded`, `addSummary`, `getSummary`,
`getPlanTaskStructure`, `listPhasePlanSummaryPairs`, `findPriorSummary`,
`findNextIncompletePlan`, `checkPhaseReady`, `roadmapUpdatePlanProgress`,
`updateRoadmapPhasePlanList`, `phasePlanIndex`.

### IMPL-02: Roadmap/milestone methods (~10)

Per SYNTHESIS.md §4 "Roadmap / Milestone". Includes `getRoadmap`,
`getRoadmapPhase`, `getRoadmapSection`, `getCurrentMilestone`,
`getNextMilestone`, `evolveRoadmap`, `updateRoadmapDependencies`,
`reorganizeRoadmapForMilestone`, `recordBacklogDeferral`,
`annotateRoadmapDependencies`, `listMilestones`, `listMilestoneArchives`,
`getArchivedMilestoneRoadmap`, `getArchivedMilestoneDoc`,
`getMilestoneAudit`, `writeMilestoneAudit`, `addGapClosurePhases`,
`appendRetrospective`, `getRetrospective`, `getMilestoneStats`,
`getMilestoneCompletion`, `digestPhaseHistory`.

### IMPL-03: State + decisions/blockers/sessions methods (~10)

Per SYNTHESIS.md §4 "State". Includes `getState`, `getStateField`,
`getStateSnapshot`, `updateStateField`, `patchStateFields`,
`recordSession`, `beginPhase`, `advancePlan`, `markPhasePlanned`,
`switchMilestone`, `signalWaiting`, `clearWaitingSignal`, `validateState`,
`syncState`, `pruneState`, `updateStateProgress`, `evolveProject`,
`getProject`, `updateProjectValidatedRequirements`, `getProjectLoad`,
`getProjectTitle`. (`recordStateEvent` covered by PRIM-02.)

### IMPL-04: Verify/UAT/validation/patterns/security/reviews methods (~25)

Per SYNTHESIS.md §4 "Verify / Check / UAT / Validation / Patterns / Security / Reviews".
Includes `getVerification`, `getVerificationStatus`, `recordVerification`,
`listVerificationsAcrossPhases`, `getUat`, `listActiveUat`,
`listOutstandingUat`, `createUat`, `updateUat`, `updateUatGap`,
`updateUatStatus`, `updateUatGapDiagnoses`, `getValidation`,
`recordValidation`, `appendValidationAudit`, `recordPatterns`,
`getSecurity`, `putSecurity`, `updateSecurityAuditTrail`,
`getThreatRegister`, `getReview`, `addReview`, `getReviewFix`,
`addReviewFix`, `archiveReviewIteration`, `getUiSpec`, `addUiSpec`,
`getUiReview`, `addUiReview`, `addUiReviewScreenshot`, `getEvalReview`,
`addEvalReview`, `getAiSpec`, `putAiSpec`, `getAiSpecTemplate`,
`validateAiSpec`, `updateAiSpecSection`, `getReviews`, `addReviews`,
`recordDocVerification`, `verifyPlanArtifacts`, `verifySummary`,
`checkDecisionCoveragePlan`, `checkDecisionCoverageVerify`,
`getPhaseCompletion`, `listSafetyGates`, `routeNextAction`,
`detectPhaseType`, `getAutoMode`, `getConfigGates`.

### IMPL-05: Discuss/spec/research/discovery/explore methods (~10)

Per SYNTHESIS.md §4 "Discuss / Spec / Research / Discovery / Explore".
Includes `getContext`, `putContext`, `updatePhaseContext`, `getSpec`,
`putSpec`, `getResearch`, `writeResearch`, `getDiscovery`, `putDiscovery`,
`putDiscussionLog`, `getCheckpoint`, `putCheckpoint`, `removeCheckpoint`,
`putQuestionsState`, `getQuestionsState`, `putQuestionsCompanion`,
`getMethodology`, `getDecisionsIndex`, `listPriorPhaseContexts`,
`listPhaseDecisions`, `getDecisions`. (`recordDecision` folds into
`recordStateEvent({type:'decision'})` per PRIM-02.)

### IMPL-06: Todos/notes/seeds/memory/handoff methods (~12)

Per SYNTHESIS.md §4 "Todos / Notes / Seeds / Memory / Handoff".
Includes `listTodos`, `getTodo`, `addTodo`, `completeTodo`,
`closeTodosByResolvesPhase`, `findNextTodoId`, `tagTodoResolvesPhase`,
`listNotes`, `addNote`, `markNotePromoted`, `findRelatedTodos`,
`addSeed`, `listSeeds`, `getSeed`, `findNextSeedId`, `getHandoff`,
`putHandoff`, `removeHandoff`, `listOrphanedHandoffs`, `getContinueHere`,
`putContinueHere`, `findContinueHere`, `listMemoryEntries`,
`findDeferredScopeRefs`, `findPlaceholderSummaries`,
`detectActiveContext`, `listIncompletePlans`.

### IMPL-07: Workstream/workspace/config/skill methods (~6)

Per SYNTHESIS.md §4 "Workstream / Workspace / Config / Skill manifest".
Includes `getActiveWorkstream`, `listWorkstreams`, `createWorkstream`,
`setActiveWorkstream`, `getWorkstreamStatus`, `archiveWorkstream`,
`listWorkstreamProgress`, `createWorkspaceShell`, `removeWorkspaceShell`,
`getConfig`, `updateConfig`, `ensureConfigSection`, `createInitialConfig`,
`updateModelProfile`, `getConfigPath`, `writeSkillManifest`,
`listProjectSkills`, `getDocsInitContext`.

### IMPL-08: Spike/sketch/codebase/intel/learnings methods (~10)

Per SYNTHESIS.md §4 "Spike / Sketch / Codebase-doc / Intel-doc / Learnings".
Includes `addSpike`, `listSpikes`, `getSpike`, `getSpikeManifest`,
`updateSpikeManifest`, `getSpikeConventions`, `updateSpikeConventions`,
`recordSpikeResult`, `addSpikeRequirement`, `recordSpikeWrapUp`,
`markSpikeProcessed`, mirror set for sketches (`addSketch`, `listSketches`,
`getSketchManifest`, `updateSketchManifest`, `recordSketchWinner`,
`recordSketchWrapUp`, `markSketchProcessed`, `getSketchTheme`,
`putSketchTheme`, `putSketchAsset`), `putCodebaseDoc`, `getCodebaseDoc`,
`listCodebaseDocs`, `addCodebaseDoc`, `putIntelDoc`, `getIntelDoc`,
`getIntelStatus`, `getIntelDiff`, `snapshotIntel`, `validateIntel`,
`queryIntel`, `patchIntelMeta`, `recordIntelSnapshot`, `recordLearnings`,
`markGraduated`, `listLearningSections`.

### IMPL-09: Debug subsystem methods (~8)

Per SYNTHESIS.md §4 "Debug subsystem". Includes `listDebugSessions`,
`getDebugSession`, `addDebugSession`, `updateDebugSession` (heavy:
section-scoped semantics — overwrite Current Focus, append Evidence,
append Eliminated, immutable Symptoms, overwrite Resolution),
`archiveDebugSession`, `getDebugKnowledgeBase`,
`appendDebugKnowledgeBase`, `appendDebugSpecialistReview`.

### IMPL-10: Reports/forensics/dependency-analysis/sidecar methods (~10)

Per SYNTHESIS.md §4 "Reports / Forensics / Inbox", "Dependency analysis /
undo", "Sidecar / counter". Includes `addForensicReport`,
`listSessionReports`, `putSessionReport`, `writeInboxTriageReport`,
`putReport`, `getPhaseManifest`, `findDependentPhases`,
`findIntraPhasePlanDependencies`, `getNextCallCount`,
`incrementNextCallCount`, `recordTempArtifact`, `getTempArtifact`.

### IMPL-11: Doc ingestion + templates + commit methods (~6)

Per SYNTHESIS.md §4 "Doc ingestion (Batch 2)" and "Templates / Commit".
Includes `writeDocClassification`, `listDocClassifications`,
`writeIntel` (folds into `putIntelDoc`), `writeIngestConflicts`,
`getIngestConflicts`, `bootstrapFromGsd2`, `selectPhaseTemplate`,
`fillTemplate`, `commitPlanningState` (no-op for beads per CAP-01),
`commitToSubrepo`, `checkCommitReady`.

### IMPL-12: Workflow init bundlers (~13)

Per SYNTHESIS.md §4 "Workflow init bundlers". Includes
`getExecutePhaseInit`, `getPlanPhaseInit`, `getNewMilestoneInit`,
`getQuickInit`, `getResumeInit`, `getVerifyWorkInit`, `getPhaseOpInit`,
`getMilestoneOpInit`, `getMapCodebaseInit`, `getNewProjectInit`,
`getProgressInit`, `getManagerInit`, `getProjectExistence`.

## Test infrastructure

### TEST-01: Carry-forward fixture-based tests pass post-relocation

After `src/` move:
- `tests/shadow-tests/bd-helper.test.mjs` (renamed if needed; tests `src/bd/helper.mjs`)
- `tests/shadow-tests/beads-errors.test.mjs` (renamed if needed; tests `src/bd/errors.mjs`)
- `tests/shadow-tests/findBeadsRoot.test.mjs` (renamed if needed; tests `src/bd/findRoot.mjs`)
- `tests/fixtures/seed.jsonl` reproduces byte-identically via existing `build-seed.sh`
- Shadow-specific tests (`handler-*.test.mjs`, `_parity-helpers.test.mjs`, etc.) move to `archive/v0.2-shadow/tests/`

### CONF-01: Conformance test scaffolding

`tests/conformance/` directory holds adapter-shape tests that any
StorageAdapter must pass. Tests are runnable against BeadsAdapter
standalone (using `tests/fixtures/seed.jsonl`); cross-adapter parity
runs against fork's MarkdownAdapter when available.

### CONF-02: Round-trip property tests for `src/format/phase.mjs`

Property tests verify `parsePhaseTitle(formatPhaseTitle(x)) === x`
and `parsePhaseDescription(formatPhaseDescription(x)) === x` for all
canonical inputs (single-line goals, multi-line success criteria,
empty values, edge cases per ARCH-03 spec).

### CONF-03: bd determinism contract preserved

`tests/fixtures/seed.jsonl` byte-identity holds across reseeds with
`BEADS_ACTOR=seed`. Carry-forward from v0.2 determinism contract.

## Acceptance criteria (gate v1.0 ship)

- ~75 BeadsAdapter methods implemented per SYNTHESIS.md §4 (Bin A,
  foundational primitives, all Bin B clusters)
- `BeadsAdapter.capabilities` reflects implementation reality
- All carry-forward tests pass against new `src/` paths
- Conformance test suite passes for BeadsAdapter standalone
- Round-trip property tests for `src/format/phase.mjs` pass
- v0.2 shadow code archived (no active references)
- `package.json`, README, CLAUDE.md describe v1.0 architecture
- Working tree clean; tagged `v1.0-complete`

**Minimum-viable ship gate (if fork interface still in flux at v1.0):**
- All Bin A primitives + 6 foundational primitives implemented
- IMPL-01..04 (phase/plan/roadmap/state/verify) complete — high-frequency
  paths
- Other Bin B clusters (IMPL-05..12) MAY ship in v1.1 if blocked by
  unresolved fork-interface questions
- Documented in v1.0 release notes

## Out of scope (deferred to v1.1+)

- Migration tooling (markdown → bd) — depends on stable fork interface
- Multi-bead transactional semantics (`transaction: false` per CAP-01)
- Binary asset write path (`binaryAsset: false` per CAP-01) — sketch
  HTML/CSS, UI screenshots get external blob store or error
- `commitPlanningState` semantics resolution (OQ-01 in SYNTHESIS.md §6)
- Knowledge-graph subsystem support (separate `GraphAdapter` per OQ-06)
- 2 raw-git outliers fix (OQ-03; fork-side concern)
- `<context>`-block leak mitigation (OQ-04; fork-side concern)

## Traceability

### Milestone v1.0 — BeadsAdapter

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 (v0.2 shadow source archived) | Phase 6 | Complete |
| CLEAN-02 (obsolete hooks archived) | Phase 6 | Complete |
| CLEAN-03 (obsolete regen scripts archived) | Phase 6 | Complete |
| CLEAN-04 (install script removed) | Phase 6 | Complete |
| ARCH-01 (`src/bd/`) | Phase 6 | Complete |
| ARCH-02 (`src/helpers/`) | Phase 6 | Complete |
| ARCH-03 (`src/format/phase.mjs`) | Phase 6 | Complete |
| ARCH-04 (`src/adapter.mjs` BeadsAdapter class) | Phase 6 | Complete |
| ARCH-05 (`package.json` rewrite) | Phase 6 | Complete |
| DOC-01 (README.md) | Phase 6 | Complete |
| DOC-02 (CLAUDE.md) | Phase 6 | Complete |
| TEST-01 (carry-forward fixture tests) | Phase 6 | Complete |
| CAP-01 (capabilities flag) | Phase 7 | Pending |
| PRIM-01 (Bin A generic CRUD) | Phase 7 | Pending |
| PRIM-02 (6 foundational primitives) | Phase 7 | Pending |
| CONF-01 (conformance test scaffolding) | Phase 7 (scaffolding); Phase 13 (full suite) | Pending |
| CONF-02 (round-trip property tests for `src/format/phase.mjs`) | Phase 7 | Pending |
| IMPL-01 (phase/plan lifecycle) | Phase 8 | Pending |
| IMPL-02 (roadmap/milestone) | Phase 8 | Pending |
| IMPL-03 (state + decisions/blockers/sessions) | Phase 9 | Pending |
| IMPL-04 (verify/UAT/validation/patterns/security/reviews) | Phase 10 | Pending |
| IMPL-05 (discuss/spec/research/discovery/explore) | Phase 11 | Pending |
| IMPL-06 (todos/notes/seeds/memory/handoff) | Phase 11 | Pending |
| IMPL-07 (workstream/workspace/config/skill) | Phase 12 | Pending |
| IMPL-08 (spike/sketch/codebase/intel/learnings) | Phase 12 | Pending |
| IMPL-09 (debug subsystem) | Phase 12 | Pending |
| IMPL-10 (reports/forensics/dependency-analysis/sidecar) | Phase 12 | Pending |
| IMPL-11 (doc ingestion + templates + commit) | Phase 12 | Pending |
| IMPL-12 (workflow init bundlers) | Phase 13 | Pending |
| CONF-03 (bd determinism contract preserved) | Phase 13 | Pending |

**Coverage:** 30/30 v1.0 requirement entries mapped to exactly one
owning phase (CONF-01 is split across Phase 7 scaffolding and Phase 13
full suite; the cross-reference is documented in both phases'
success criteria). No orphans.
