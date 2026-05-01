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

**Status note (2026-04-30):** v0.2 milestone superseded by architectural
pivot — see DECISIONS.md `D-2026-04-30-01`. **Phases 4 and 5 shipped.
Phases 6-11 canceled.** v0.2 was rolled into v1.0 BeadsAdapter scope; the
canceled phase numbers (6-11) and beyond are reused for v1.0 phases.

## Phases

- [x] **Phase 4: findBeadsRoot() + parity test infrastructure** — Refactor detection + lay down the snapshot/fallback harness every read handler will use
- [x] **Phase 5: roadmap.* read handlers** — `roadmap.analyze` + `roadmap.get-phase` derive bd-backed phase state with full upstream parity
- [~] **Phase 6 (CANCELED): progress.* read handlers** — superseded by v1.0
- [~] **Phase 7 (CANCELED): state.* read handlers** — superseded by v1.0
- [~] **Phase 8 (CANCELED): phase resolution + lookup handlers** — superseded by v1.0
- [~] **Phase 9 (CANCELED): init.* read handlers** — superseded by v1.0
- [~] **Phase 10 (CANCELED): state-mutation hook coverage audit** — superseded by v1.0
- [~] **Phase 11 (CANCELED): transitive P1 verification + cross-cutting QUAL gates** — superseded by v1.0

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

### Phases 6-11 (v0.2) — CANCELED

The v0.2 plan included Phase 6 (`progress.*`), Phase 7 (`state.*`), Phase 8
(phase lookup), Phase 9 (`init.*`), Phase 10 (mutation audit), and Phase 11
(QUAL gates). All six phases are **canceled** as of 2026-04-30 per
`D-2026-04-30-01`. The shadow architecture they presupposed has a hard ceiling
(see DECISIONS.md and `.planning/research/fork-investigation/SYNTHESIS.md`).
Their concerns reframe inside the v1.0 BeadsAdapter scope.

The phase numbers 6-11 are **reused** for v1.0 phases below. Original v0.2
detail blocks are preserved in git history (last present in commit
`0e94a67`).

---

## Milestone v1.0 — BeadsAdapter

Implement a `BeadsAdapter` against the fork's `StorageAdapter` interface
(per `.planning/research/fork-investigation/SYNTHESIS.md` §4). ~75 named
methods organized along the cluster boundaries the investigation surfaced.
Cleanup of v0.2 shadow architecture and adapter-library scaffolding folded
in as Phase 6.

**Pivot context:** v0.2 shadow is being archived (not deleted) — preserved
under `archive/v0.2-shadow/` as historical reference. Carry-forward primitives
relocate into a fresh `src/` layout. v1.0 implements in **parallel** with the
fork's interface evolution at `~/code/get-shit-done`; minor refactors expected
when the fork's contract stabilizes (acceptable cost: 10-30%).

**Phase numbering:** Continues from v0.2's last shipped phase (Phase 5).
v1.0 phases are 6 through 13. The numbers 6-11 are reused — the canceled
v0.2 placeholders are gone; these are new v1.0 phases with the same numbers.

## Phases (v1.0)

- [x] **Phase 6: Cleanup + adapter-library scaffolding** — Archive v0.2 shadow code; restructure repo as adapter library (`src/` layout); package.json + docs refresh; carry-forward tests pass against new paths (completed 2026-05-01)
- [ ] **Phase 7: Capabilities flag + Bin A primitives + foundational primitives** — Adapter contract surface: `capabilities` flag, 10 generic CRUD primitives, 6 foundational primitives (`recordStateEvent`, `snapshot/restore`, `putNamedDoc`, `writeBinaryAsset`)
- [ ] **Phase 8: Phase/plan + roadmap/milestone domain methods** — High-frequency paths (~25 named methods covering phase lifecycle, plan/summary handling, roadmap evolution, milestone archival)
- [ ] **Phase 9: State + decisions/blockers/sessions domain methods** — STATE.md-shaped methods (~10) with `recordStateEvent` discriminated-union dispatch as the spine
- [ ] **Phase 10: Verify/UAT/validation/patterns/security/reviews domain methods** — Largest cluster (~25 methods) covering verification gates, UAT lifecycle, patterns/security, AI/UI/eval reviews, AI-SPEC section writes
- [ ] **Phase 11: Discuss/spec/research + todos/notes/seeds/handoff domain methods** — Discussion artifacts (~10) + memory layer (~12); together cover the discovery and continuity surface
- [ ] **Phase 12: Workstream/spike/sketch/intel/codebase/debug + reports + ingestion + templates** — Long tail (~30 methods) covering remaining Bin B clusters
- [ ] **Phase 13: Workflow init bundlers + conformance test suite + final docs** — Workflow-shaped init methods (~13) + conformance scaffolding cross-running against fork's MarkdownAdapter when available; ship gate

## Phase Details (v1.0)

### Phase 6: Cleanup + adapter-library scaffolding

**Goal**: This repo is structured as a proper adapter library — v0.2 shadow code is archived but preserved, all carry-forward primitives live under a fresh `src/` layout, and `package.json`/README/CLAUDE.md describe the post-cleanup architecture. No fork dependency yet.

**Depends on**: Nothing (foundational; unblocks every later v1.0 phase)

**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, DOC-01, DOC-02, TEST-01

**Success Criteria** (what must be TRUE):
  1. No active code remains under `bin/`. `bin/gsd-sdk-shadow.mjs` and `bin/wrap-mutation.mjs` are at `archive/v0.2-shadow/bin/`; `hooks/block-gsd-sdk-mutation.sh`, `hooks/block-state-md.sh`, `hooks/bd-sync.sh` are at `archive/v0.2-shadow/hooks/`; `scripts/regen-*.sh` are at `archive/v0.2-shadow/scripts/`. Files are git-mv'd (history preserved), not deleted.
  2. Carry-forward primitives are accessible at the `src/` paths declared in REQUIREMENTS.md ARCH-01..03: `src/bd/{helper,errors,findRoot}.mjs`, `src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,loadMilestoneHeading}.mjs`, `src/format/phase.mjs` (with bidirectional `parsePhase{Title,Description}` ↔ `formatPhase{Title,Description}` real implementations satisfying `parse(format(x)) === x` for canonical inputs).
  3. `src/adapter.mjs` exports a `BeadsAdapter` class that constructs successfully against a project root, validates bd availability via `findBeadsRoot()`, and stubs all SYNTHESIS.md §4 methods to throw `Error('not implemented yet')` (placeholders sized for Phases 7-13 to fill in).
  4. `package.json` reflects adapter-library shape: an `exports` map points at `src/adapter.mjs` and selected submodules; no `bin` entries; `peerDependencies` declares the fork; scripts include `test:unit` and `test:conformance` and exclude `install`/`postinstall`.
  5. `README.md` and `CLAUDE.md` describe post-cleanup architecture (adapter library, sibling fork at `~/code/get-shit-done`, refactor-on-fork-stabilize policy).
  6. Carry-forward tests pass against the new paths: `tests/shadow-tests/{bd-helper,beads-errors,findBeadsRoot}.test.mjs` (renamed where needed) target `src/bd/*`; `tests/fixtures/seed.jsonl` reproduces byte-identically via existing `build-seed.sh` (CONF-03 invariant preserved).

**Plans:** 7/7 plans complete

Plans:
- [x] 06-01-wave0-test-scaffolding-PLAN.md — Wave 0 test files + archive directory scaffolding (TEST-01 partial)
- [x] 06-02-archive-shadow-source-PLAN.md — git mv shadow bin/, hooks/, scripts/ to archive; delete install.sh (CLEAN-01, CLEAN-02, CLEAN-04)
- [x] 06-03-archive-shadow-tests-PLAN.md — git mv 26 shadow tests + 5 wholesale test dirs to archive (TEST-01)
- [x] 06-04-carry-forward-extraction-PLAN.md — verbatim move bd-helper/errors + extract findBeadsRoot + 4 helpers + migrate 11 tests (ARCH-01, ARCH-02, TEST-01)
- [x] 06-05-format-phase-module-PLAN.md — implement src/format/phase.mjs bidirectional parser + 11 fixtures + round-trip property tests (ARCH-03)
- [x] 06-06-adapter-shell-and-clusters-PLAN.md — BeadsAdapter shell + 8 cluster stub files (~270 stubs throwing canonical message) (ARCH-04)
- [x] 06-07-package-and-docs-PLAN.md — package.json + README + CLAUDE.md + CONTRIBUTING.md + REQUIREMENTS.md CLEAN-03 edit (ARCH-05, DOC-01, DOC-02, CLEAN-03)

### Phase 7: Capabilities flag + Bin A primitives + foundational primitives

**Goal**: The BeadsAdapter contract surface is complete — 10 generic CRUD primitives + 6 foundational primitives + a static `capabilities` flag — backing every domain method that follows. Conformance scaffolding exists for cross-adapter parity testing.

**Depends on**: Phase 6 (`src/` layout in place)

**Requirements**: CAP-01, PRIM-01, PRIM-02, CONF-01, CONF-02

**Success Criteria** (what must be TRUE):
  1. `BeadsAdapter.capabilities` is a static object whose shape matches D-2026-04-30-05 (`record`, `section`, `binaryAsset`, `snapshot`, `transaction`, `namedDoc`, `commitPlanningState` — concrete booleans, with rationale comments for `false` values). Consumers can branch on the flag at runtime; reading the flag does not require constructing the adapter against a beads-managed project.
  2. All 10 Bin A primitives (`getRecord`, `putRecord`, `removeRecord`, `listCollection`, `exists`, `getSection`, `updateSection`, `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter`) are implemented per SYNTHESIS.md §4 Bin A signatures. For bd-managed records, paths translate to bd queries; for raw markdown narrative files (PLAN.md/SPEC.md), they pass through to disk. Behaviour is verified by adapter unit tests on a `tests/fixtures/seed.jsonl` fixture.
  3. The 6 foundational primitives (`updateSection`, `getSection`, `recordStateEvent`, `snapshot/restore`, `putNamedDoc`/`getNamedDoc`, `writeBinaryAsset`) are implemented. `recordStateEvent` dispatches on the discriminated-union `type` field (per SYNTHESIS.md §4 state cluster). `writeBinaryAsset` either throws `UnsupportedOperationError` or routes to an external store, consistent with `capabilities.binaryAsset = false`.
  4. `tests/conformance/` directory exists with adapter-shape tests runnable against the BeadsAdapter standalone using `tests/fixtures/seed.jsonl`. The harness is structured so that when the fork's MarkdownAdapter ships, the same tests run cross-adapter (CONF-01 scaffolding requirement).
  5. Round-trip property tests for `src/format/phase.mjs` pass for all canonical inputs (single-line goals, multi-line success criteria, empty values, edge cases per ARCH-03 spec) — `parsePhaseTitle(formatPhaseTitle(x)) === x` and `parsePhaseDescription(formatPhaseDescription(x)) === x`.

**Plans:** 10 plans

Plans:
- [x] 07-01-PLAN.md — pathRouter.mjs closed-enum routing registry + UnsupportedOperationError class (PRIM-01, PRIM-02)
- [x] 07-02-PLAN.md — src/format/section.mjs slugify + locateSection + rewriteSection (PRIM-01, PRIM-02)
- [x] 07-03-PLAN.md — src/format/frontmatter.mjs flat-scalar YAML parser/formatter/merger (PRIM-01)
- [x] 07-04-PLAN.md — Bin A records (getRecord/putRecord/removeRecord/exists/listCollection) + atomicWriteFile helper (PRIM-01)
- [x] 07-05-PLAN.md — Bin A section + frontmatter primitives (5 methods) (PRIM-01, PRIM-02)
- [x] 07-06-PLAN.md — recordStateEvent dispatch + writeBinaryAsset throw + capabilities rationale comments (PRIM-02, CAP-01)
- [x] 07-07-PLAN.md — snapshot/restore + putNamedDoc/getNamedDoc (16/16 primitives complete) (PRIM-02)
- [x] 07-08-PLAN.md — conformance harness (run.mjs + fixture.mjs + capabilities.test.mjs) + seed.jsonl milestone-bead enrichment (CAP-01, CONF-01)
- [x] 07-09-PLAN.md — Bin A conformance tests (binA-records + binA-section + binA-frontmatter) (CONF-01, PRIM-01)
- [x] 07-10-PLAN.md — Foundational conformance tests (events + namedDoc + snapshot) + CONF-02 audit (CONF-01, CONF-02, PRIM-02)

### Phase 8: Phase/plan + roadmap/milestone domain methods

**Goal**: The high-frequency phase, plan, summary, roadmap, and milestone methods are implemented end-to-end — `addPhase`, `completePhaseAndCascade`, `getRoadmap`, `evolveRoadmap`, `archivePhases`, etc. — over the Phase 7 primitive layer.

**Depends on**: Phase 7 (primitives + capabilities flag)

**Requirements**: IMPL-01, IMPL-02

**Success Criteria** (what must be TRUE):
  1. `BeadsAdapter.addPhase({description})` creates a bd epic with `gsd:phase` and `phase-id:NN` labels, returns the SDK-shaped phase record, and is idempotent in the sense that re-invoking with the same description doesn't double-create. `addPhaseBatch`, `insertPhase`, `removePhase`, `findNextDecimalPhase` exhibit the analogous behaviour against the same labels.
  2. `BeadsAdapter.completePhaseAndCascade(phase)` closes the phase epic and cascades closure to dependent phases via `bd epic close-eligible` (carry-forward: 5-line idempotent loop pattern). Verified end-to-end on a fixture with two-deep phase dependency.
  3. `BeadsAdapter.getPhase`, `findPhase`, `listPhases`, `listPhasePlans`, `listPhaseSummaries`, `listPhaseArtifacts`, `getPlan`, `getSummary`, `phasePlanIndex` return SDK-shaped records derived from a single `bd export --json` snapshot per call (per QUAL-07 carry-forward; ≤2 bd spawns per public method invocation).
  4. `BeadsAdapter.getRoadmap`, `getRoadmapPhase`, `getCurrentMilestone`, `getNextMilestone`, `evolveRoadmap`, `archivePhases`, `completeMilestone`, `getMilestoneStats`, `getMilestoneCompletion`, `appendRetrospective`, and the milestone archive readers each round-trip on a fixture seeded with two milestones.
  5. Conformance tests for the IMPL-01 and IMPL-02 method sets run green standalone against the BeadsAdapter; no method falls back to a stub-throw.

**Plans**: TBD

### Phase 9: State + decisions/blockers/sessions domain methods

**Goal**: STATE.md-shaped methods are wired through `recordStateEvent` — every state-mutation event (decision, blocker, metric, session, todo-count, deferred-items, forensic-session, quick-task, roadmap-evolution) flows through the discriminated-union primitive into a typed bd artifact (memory or comment with anchor).

**Depends on**: Phase 7 (primitives — especially `recordStateEvent`, `getSection`/`updateSection`)

**Requirements**: IMPL-03

**Success Criteria** (what must be TRUE):
  1. `BeadsAdapter.recordStateEvent({type:'decision', payload})` records a `<milestone>:decision-...` memory whose contents match the SYNTHESIS.md §4 state-cluster decision shape; reading via `getStateSnapshot()` surfaces it under `decisions[]` with the upstream key set.
  2. The remaining `recordStateEvent` types (`roadmap_evolution`, `blocker_added`, `blocker_resolved`, `metric`, `session`, `todo_count_update`, `deferred_items`, `forensic_session`, `quick_task`) each round-trip through their corresponding read method (`getStateSnapshot`, `listMemoryEntries`, etc.) with no field loss vs the input payload.
  3. `BeadsAdapter.getState`, `getStateField`, `getStateSnapshot`, `updateStateField`, `patchStateFields`, `recordSession`, `beginPhase`, `advancePlan`, `markPhasePlanned`, `switchMilestone`, `signalWaiting`, `clearWaitingSignal`, `validateState`, `syncState`, `pruneState`, `updateStateProgress` each pass adapter unit tests on a fixture; STATE.md fields without bd equivalents (`paused_at`, `session.last_date`, etc.) are returned as `null` rather than omitted (carry-forward QUAL-01 contract).
  4. `BeadsAdapter.evolveProject`, `getProject`, `updateProjectValidatedRequirements`, `getProjectLoad`, `getProjectTitle` round-trip PROJECT.md sections via `updateSection` semantics — the Validated/Active/Out-of-Scope/Decisions blocks are addressable as section anchors.
  5. Determinism contract holds: 5× consecutive calls to `getStateSnapshot()` on the same fixture return byte-identical output (carry-forward of v0.2 QUAL-06).

**Plans**: TBD

### Phase 10: Verify/UAT/validation/patterns/security/reviews domain methods

**Goal**: The largest Bin B cluster — verification gates, UAT lifecycle, patterns/security, AI-SPEC section writes, AI/UI/eval reviews, route-next-action — is implemented. Most methods are thin section-scoped wrappers over `getSection`/`updateSection`; the section-anchor vocabulary is documented.

**Depends on**: Phase 7 (primitives)

**Requirements**: IMPL-04

**Success Criteria** (what must be TRUE):
  1. Verification methods (`getVerification`, `getVerificationStatus`, `recordVerification`, `listVerificationsAcrossPhases`) round-trip on a fixture with two phases verified and one pending; `recordVerification(phase, report)` produces a record retrievable via `getVerification(phase)` byte-equal to the input report (modulo metadata).
  2. UAT lifecycle methods (`getUat`, `listActiveUat`, `listOutstandingUat`, `createUat`, `updateUat`, `updateUatGap`, `updateUatStatus`, `updateUatGapDiagnoses`) cover the full UAT state machine on a fixture; section-anchor writes (e.g. "Current Test", "Outstanding Gaps") are addressable independently and do not clobber sibling sections.
  3. AI-SPEC three-author concurrency contract holds: three sequential `updateAiSpecSection(phase, sectionId, body)` calls (mirroring gsd-domain-researcher → gsd-ai-researcher → gsd-eval-planner) leave each section's content intact; `getAiSpec(phase)` then returns all three sections in the canonical order. (Atomic-section assumption per SYNTHESIS.md §6 OQ-09.)
  4. Validation/patterns/security/threat-register methods (`getValidation`, `recordValidation`, `appendValidationAudit`, `recordPatterns`, `getSecurity`, `putSecurity`, `updateSecurityAuditTrail`, `getThreatRegister`) round-trip on a fixture; review/review-fix/UI-spec/UI-review/eval-review methods (`getReview`/`addReview`/`getReviewFix`/`addReviewFix`/`archiveReviewIteration` and the UI/eval mirrors) cover the iteration archival pattern (replaces `cp <file>.iterN.md`).
  5. Routing/decision-coverage/safety-gate methods (`routeNextAction`, `detectPhaseType`, `getAutoMode`, `getConfigGates`, `getPhaseCompletion`, `listSafetyGates`, `checkDecisionCoveragePlan`, `checkDecisionCoverageVerify`, `recordDocVerification`, `verifyPlanArtifacts`, `verifySummary`) each return SDK-shaped responses against a fixture; `routeNextAction` correctly differentiates the four documented states (phase complete → "advance", phase has open plans → "resume", phase has no plans yet → "plan", milestone complete → "complete-milestone") — carry-forward of v0.2 acceptance gate.

**Plans**: TBD

### Phase 11: Discuss/spec/research + todos/notes/seeds/handoff domain methods

**Goal**: Discovery and continuity surfaces are wired — context/spec/research/discovery/discussion-log/checkpoint/questions on the discuss side; todos/notes/seeds/handoffs/continue-here/memory on the continuity side. `recordStateEvent({type:'decision'})` covers `recordDecision`.

**Depends on**: Phase 7 (primitives — especially `putNamedDoc`/`getNamedDoc` for closed-enum kinds)

**Requirements**: IMPL-05, IMPL-06

**Success Criteria** (what must be TRUE):
  1. Context/spec/discovery methods (`getContext`/`putContext`/`updatePhaseContext`, `getSpec`/`putSpec`, `getDiscovery`/`putDiscovery`, `putDiscussionLog`) round-trip on a fixture with three phases having different artifact populations; `listPriorPhaseContexts(currentPhase, limit?)` returns the K most recent prior phases' contexts in deterministic order.
  2. Research/methodology/decisions methods (`getResearch`/`writeResearch` over the closed `kind` enum from SYNTHESIS.md §4, `getMethodology`, `getDecisionsIndex`, `listPhaseDecisions`, `getDecisions`) each round-trip; `writeResearch` uses `putNamedDoc('research', kind, body)` under the hood per the Phase 7 primitive contract.
  3. Checkpoint/questions methods (`getCheckpoint`/`putCheckpoint`/`removeCheckpoint`, `putQuestionsState`/`getQuestionsState`, `putQuestionsCompanion`) handle the discuss-checkpoint and questions JSON/HTML assets; binary HTML survives the round-trip per the `writeBinaryAsset` contract or is treated as a text artifact when small.
  4. Todos/notes methods (`listTodos`, `getTodo`, `addTodo`, `completeTodo`, `closeTodosByResolvesPhase`, `findNextTodoId`, `tagTodoResolvesPhase`, `listNotes`, `addNote`, `markNotePromoted`, `findRelatedTodos`) operate over `gsd:todo`-labeled beads with the carry-forward `findNextTodoId` numeric-search pattern; `closeTodosByResolvesPhase(phase)` closes only beads whose `resolves-phase:NN` label matches.
  5. Seeds/handoff/continue-here/memory methods (`addSeed`, `listSeeds`, `getSeed`, `findNextSeedId`, `getHandoff`/`putHandoff`/`removeHandoff`, `listOrphanedHandoffs`, `getContinueHere`/`putContinueHere`/`findContinueHere`, `listMemoryEntries`, `findDeferredScopeRefs`, `findPlaceholderSummaries`, `detectActiveContext`, `listIncompletePlans`) each pass adapter unit tests on a fixture; `findDeferredScopeRefs` joins phase artifacts vs roadmap correctly (carry-forward from the v0.2 PILOT finding).

**Plans**: TBD

### Phase 12: Workstream/spike/sketch/intel/codebase/debug + reports + ingestion + templates

**Goal**: The remaining Bin B clusters are implemented — workstream/workspace/config/skill manifest, spike/sketch/codebase-doc/intel-doc/learnings, debug subsystem, reports/forensics/sidecar, doc ingestion, templates/commit. Long tail; small per-method but broad coverage.

**Depends on**: Phase 7 (primitives)

**Requirements**: IMPL-07, IMPL-08, IMPL-09, IMPL-10, IMPL-11

**Success Criteria** (what must be TRUE):
  1. Workstream/workspace/config/skill methods (`getActiveWorkstream`, `listWorkstreams`, `createWorkstream`, `setActiveWorkstream`, `getWorkstreamStatus`, `archiveWorkstream`, `listWorkstreamProgress`, `createWorkspaceShell`, `removeWorkspaceShell`, `getConfig`, `updateConfig`, `ensureConfigSection`, `createInitialConfig`, `updateModelProfile`, `getConfigPath`, `writeSkillManifest`, `listProjectSkills`, `getDocsInitContext`) round-trip on a fixture; `getConfig` answers from `.planning/config.json` (or beads-equivalent) and is the canonical replacement for the `intel.md` and `graphify.md` direct-I/O leaks.
  2. Spike/sketch/codebase/intel/learnings methods (the IMPL-08 set including `addSpike`, `listSpikes`, `getSpike`, `getSpikeManifest`, `updateSpikeManifest`, `recordSpikeResult`, plus the sketch mirror plus `putCodebaseDoc`/`getCodebaseDoc`/`listCodebaseDocs` over the closed name enum, plus the intel methods `putIntelDoc`/`getIntelDoc`/`getIntelStatus`/`getIntelDiff`/`snapshotIntel`/`validateIntel`/`queryIntel`/`patchIntelMeta`/`recordIntelSnapshot`, plus `recordLearnings`/`markGraduated`/`listLearningSections`) each pass adapter unit tests; the `recordSpikeResult` frontmatter mutation uses `mergeFrontmatter` per the SYNTHESIS.md §4 note.
  3. Debug subsystem methods (`listDebugSessions`, `getDebugSession`, `addDebugSession`, `updateDebugSession`, `archiveDebugSession`, `getDebugKnowledgeBase`, `appendDebugKnowledgeBase`, `appendDebugSpecialistReview`) implement the section-scoped semantics correctly: overwrite Current Focus, append Evidence, append Eliminated, immutable Symptoms, overwrite Resolution, append Specialist Review — verified by a six-section state-machine fixture test.
  4. Reports/forensics/dependency-analysis/sidecar methods (`addForensicReport`, `listSessionReports`, `putSessionReport`, `writeInboxTriageReport`, `putReport`, `getPhaseManifest`, `findDependentPhases`, `findIntraPhasePlanDependencies`, `getNextCallCount`, `incrementNextCallCount`, `recordTempArtifact`, `getTempArtifact`) round-trip on a fixture; `incrementNextCallCount` is atomic (no lost-update under repeated invocations).
  5. Doc-ingestion + templates + commit methods (`writeDocClassification`, `listDocClassifications`, `writeIngestConflicts`, `getIngestConflicts`, `bootstrapFromGsd2`, `selectPhaseTemplate`, `fillTemplate`, `commitPlanningState`, `commitToSubrepo`, `checkCommitReady`) pass adapter unit tests; `commitPlanningState` is a no-op on the BeadsAdapter (per CAP-01 / OQ-01) and the no-op semantics are documented in the method's doc-comment.

**Plans**: TBD

### Phase 13: Workflow init bundlers + conformance test suite + final docs

**Goal**: All 13 workflow-shaped init bundlers are implemented; the cross-adapter conformance suite is complete (paired with fork's MarkdownAdapter when available); README/CLAUDE.md/release notes describe the v1.0 ship state. v1.0 ship gate.

**Depends on**: Phases 7, 8, 9, 10, 11, 12 (init bundlers compose the per-domain methods); fork's MarkdownAdapter availability is helpful but not blocking — the conformance suite runs standalone if the fork is still in flight.

**Requirements**: IMPL-12, CONF-01, CONF-02, CONF-03

**Success Criteria** (what must be TRUE):
  1. All 13 workflow init bundlers (`getExecutePhaseInit`, `getPlanPhaseInit`, `getNewMilestoneInit`, `getQuickInit`, `getResumeInit`, `getVerifyWorkInit`, `getPhaseOpInit`, `getMilestoneOpInit`, `getMapCodebaseInit`, `getNewProjectInit`, `getProgressInit`, `getManagerInit`, `getProjectExistence`) return SDK-shaped JSON for the corresponding `/gsd-*` workflow on a fixture, deriving every state-bearing field from the underlying domain methods (no direct fixture reads).
  2. The conformance test suite at `tests/conformance/` covers every Phase 6-12 method with at least one round-trip case; CI runs the suite in standalone mode against the BeadsAdapter and (if the fork's MarkdownAdapter is reachable via local link) in cross-adapter mode asserting equivalent outcomes for shared semantics.
  3. CONF-03 determinism contract holds end-to-end: `tests/fixtures/seed.jsonl` reproduces byte-identically across reseeds with `BEADS_ACTOR=seed`, and the conformance suite verifies it as a precondition.
  4. `BeadsAdapter.capabilities` reflects implementation reality (any `false` flags from CAP-01 that turned out to be `true` during Phases 7-12 are flipped; any flags that revealed unsupported edge cases are documented in release notes).
  5. README + CLAUDE.md + release notes describe v1.0 ship state (method coverage, capabilities flag, install path, fork-link config snippet, refactor-on-fork-stabilize policy). Working tree clean; `v1.0-complete` tag applied.
  6. Acceptance gate (per REQUIREMENTS.md): ~75 BeadsAdapter methods implemented per SYNTHESIS.md §4; capabilities flag accurate; carry-forward tests pass against new `src/` paths; v0.2 shadow code archived (no active references); minimum-viable ship gate (Bin A + 6 foundational + IMPL-01..04) is met if any IMPL-05..12 methods slip to v1.1 due to unresolved fork-interface questions.

**Plans**: TBD

## Phase Dependencies (v1.0)

```
Phase 6 (cleanup + scaffolding)
    │
    ▼
Phase 7 (capabilities + primitives) ◄── unblocks the contract surface
    │
    ├──► Phase 8 (phase/plan/roadmap/milestone)
    ├──► Phase 9 (state)
    ├──► Phase 10 (verify/UAT/reviews)
    ├──► Phase 11 (discuss/todos/seeds)
    └──► Phase 12 (workstream/spike/debug/etc)
              │
              ▼
         Phase 13 (init bundlers + conformance + ship)
```

Phases 8-12 are **structurally parallelisable** (each depends only on
Phase 7's primitive base). In **practice they land sequentially** —
single-implementer constraint, plus each cluster surfaces interface-design
friction that informs the others. Sequential ordering also keeps the
conformance suite (Phase 13) growing incrementally rather than landing as
a big-bang at the end.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Spike — validate beads + GSD topology | — | Complete | 2026-04-26 |
| 2. Build the layer | 7/7 | Complete | 2026-04-28 |
| 3. Cross-worktree validation | — | Complete | 2026-04-28 |
| 4. findBeadsRoot() + parity test infrastructure | — | Complete (v0.2 shipped) | 2026-04-29 |
| 5. roadmap.* read handlers | 5/5 | Complete (v0.2 shipped) | 2026-04-30 |
| 6. progress.* read handlers (v0.2) | 7/7 | Complete   | 2026-05-01 |
| 7. state.* read handlers (v0.2) | — | Canceled (v0.2 superseded — see DECISIONS.md D-2026-04-30-01) | — |
| 8. phase resolution + lookup handlers (v0.2) | — | Canceled (v0.2 superseded — see DECISIONS.md D-2026-04-30-01) | — |
| 9. init.* read handlers (v0.2) | — | Canceled (v0.2 superseded — see DECISIONS.md D-2026-04-30-01) | — |
| 10. state-mutation hook coverage audit (v0.2) | — | Canceled (v0.2 superseded — see DECISIONS.md D-2026-04-30-01) | — |
| 11. transitive P1 verification + cross-cutting QUAL gates (v0.2) | — | Canceled (v0.2 superseded — see DECISIONS.md D-2026-04-30-01) | — |
| 6. Cleanup + adapter-library scaffolding (v1.0) | 0/? | Not started | — |
| 7. Capabilities + Bin A + foundational primitives (v1.0) | 0/? | Not started | — |
| 8. Phase/plan + roadmap/milestone domain methods (v1.0) | 0/? | Not started | — |
| 9. State + decisions/blockers/sessions domain methods (v1.0) | 0/? | Not started | — |
| 10. Verify/UAT/validation/reviews domain methods (v1.0) | 0/? | Not started | — |
| 11. Discuss/spec/research + todos/notes/seeds/handoff (v1.0) | 0/? | Not started | — |
| 12. Workstream/spike/sketch/intel/codebase/debug + reports + ingestion (v1.0) | 0/? | Not started | — |
| 13. Workflow init bundlers + conformance test suite + final docs (v1.0) | 0/? | Not started | — |
