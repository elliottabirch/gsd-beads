
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

**Plans:** 3/7 plans executed

Plans:
- [x] 06-01-wave0-test-scaffolding-PLAN.md — Wave 0 test files + archive directory scaffolding (TEST-01 partial)
- [x] 06-02-archive-shadow-source-PLAN.md — git mv shadow bin/, hooks/, scripts/ to archive; delete install.sh (CLEAN-01, CLEAN-02, CLEAN-04)
- [x] 06-03-archive-shadow-tests-PLAN.md — git mv 26 shadow tests + 5 wholesale test dirs to archive (TEST-01)
- [ ] 06-04-carry-forward-extraction-PLAN.md — verbatim move bd-helper/errors + extract findBeadsRoot + 4 helpers + migrate 11 tests (ARCH-01, ARCH-02, TEST-01)
- [ ] 06-05-format-phase-module-PLAN.md — implement src/format/phase.mjs bidirectional parser + 11 fixtures + round-trip property tests (ARCH-03)
- [ ] 06-06-adapter-shell-and-clusters-PLAN.md — BeadsAdapter shell + 8 cluster stub files (~270 stubs throwing canonical message) (ARCH-04)
- [ ] 06-07-package-and-docs-PLAN.md — package.json + README + CLAUDE.md + CONTRIBUTING.md + REQUIREMENTS.md CLEAN-03 edit (ARCH-05, DOC-01, DOC-02, CLEAN-03)
