
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
