
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
