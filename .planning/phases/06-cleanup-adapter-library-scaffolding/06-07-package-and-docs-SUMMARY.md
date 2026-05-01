---
phase: 06-cleanup-adapter-library-scaffolding
plan: 07
subsystem: docs
tags: [package.json, npm-link, peer-deps, esm, exports-map, claude-md, contributing]

# Dependency graph
requires:
  - phase: 06-cleanup-adapter-library-scaffolding/01-shadow-bin-cleanup
    provides: archive/v0.2-shadow/ tree (CLEAN-01..04 file moves)
  - phase: 06-cleanup-adapter-library-scaffolding/04-bd-helpers-and-helpers-extraction
    provides: src/bd/ + src/helpers/ subpath targets
  - phase: 06-cleanup-adapter-library-scaffolding/05-format-phase-extraction
    provides: src/format/phase.mjs subpath target
  - phase: 06-cleanup-adapter-library-scaffolding/06-adapter-shell-and-clusters
    provides: src/adapter.mjs entry point
provides:
  - package.json (adapter library shape, ARCH-05)
  - README.md (post-cleanup architecture, DOC-01)
  - CLAUDE.md (sibling adapter framing + auto-load preserved, DOC-02 + D-24)
  - CONTRIBUTING.md (npm link dev workflow, D-06)
  - .planning/REQUIREMENTS.md CLEAN-03 wording reflects D-12
  - All 6 Wave 0 tests fully GREEN, 91/91 unit tests pass via npm test
affects: [phase-7-conformance, phase-7-primitives, fork-consumers]

# Tech tracking
tech-stack:
  added: [package.json (none — pure config), node:test glob patterns]
  patterns:
    - "ESM-only library with subpath exports (./bd, ./bd/errors, ./bd/findRoot, ./helpers, ./format/phase)"
    - "Optional peerDependencies for fork — works installed AND linked"
    - "engines.node >=20 floor; tests run via Node built-in node:test (no framework deps)"
    - "Glob-based --test patterns (Node 24 compatible)"

key-files:
  created:
    - package.json
    - CONTRIBUTING.md
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-07-package-and-docs-SUMMARY.md
  modified:
    - README.md
    - CLAUDE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Test scripts use globs ('tests/unit/**/*.test.mjs') instead of bare directory paths to satisfy Node 24's stricter --test argument resolution while remaining compatible with Node 20+"
  - "Removed backticks around 'scripts/cascade-loop.sh' in REQUIREMENTS.md CLEAN-03 because the Wave 0 regex /scripts\\/cascade-loop\\.sh also archives/ requires literal substring match — minimal Rule 1 fix preserves planner narrative intent"

patterns-established:
  - "Adapter library exports map: 6 documented subpaths, NO cluster-internal exposure (T-6.07-01 mitigation)"
  - "CLAUDE.md auto-load preservation: D-24 mandates Skill('spike-findings-gsd-beads') survives any rewrite (two-layer defense: task verify + Wave 0 grep)"

requirements-completed: [ARCH-05, DOC-01, DOC-02, CLEAN-03]

# Metrics
duration: 25min
completed: 2026-04-30
---

# Phase 6 Plan 7: package.json + Docs Rewrite Summary

**Adapter library shape (package.json with 6-subpath exports map, optional peer-dep on get-shit-done-cc) plus README/CLAUDE/CONTRIBUTING rewrites for the v1.0 sibling-fork architecture; CLEAN-03 wording fixed to reflect D-12 cascade-loop archival.**

## Performance

- **Duration:** ~25 min (includes 3 minute npm test run)
- **Started:** 2026-05-01T02:46:00Z
- **Completed:** 2026-05-01T03:11:38Z
- **Tasks:** 6 (all complete)
- **Files modified/created:** 5 (1 new package.json, 1 new CONTRIBUTING.md, 2 rewritten docs, 1 in-place edit)

## Accomplishments

- **package.json (ARCH-05)** — Adapter library shape per D-06..D-09: name "gsd-beads", version "1.0.0-alpha.0", type "module", 6-subpath exports map, optional peerDep on get-shit-done-cc, engines.node >=20, no bin entries, no install/postinstall scripts
- **README.md (DOC-01)** — Rewritten from scratch: BeadsAdapter framing, fork ⇄ adapter ⇄ bd ASCII diagram, refactor-on-fork-stabilize policy, npm link dev workflow, repo layout tree
- **CLAUDE.md (DOC-02 + D-24)** — Adapter library role described, fork location referenced, `Skill("spike-findings-gsd-beads")` auto-load preserved exactly
- **CONTRIBUTING.md (D-06)** — npm link workflow documented including strict-peer-deps escape hatch, testing commands, branch model
- **.planning/REQUIREMENTS.md (D-12)** — CLEAN-03 heading + body reflect D-12 (cascade-loop also archives; Phase 8 reintroduces as src/bd/cascade.mjs)
- **All 6 Wave 0 tests fully GREEN:**
  - structural-cleanup.test.mjs: 5/5
  - structural-imports.test.mjs: 8/8
  - format-phase.test.mjs: 15/15
  - adapter-shell.test.mjs: 6/6
  - package-json-shape.test.mjs: 7/7
  - docs-content.test.mjs: 8/8
- **`npm test` reports 91/91 tests pass, exit 0**
- **`bash tests/unit/seed-determinism.test.sh`: 2/2 pass (CONF-03 byte-identity invariant intact)**

## Task Commits

Each task committed atomically (no separate RED/GREEN — Wave 0 tests pre-existed):

1. **Task 1: package.json** — `b510d4e` (feat)
2. **Task 2: README.md** — `c057b1b` (docs)
3. **Task 3: CLAUDE.md** — `38f7659` (docs)
4. **Task 4: CONTRIBUTING.md** — `173daf4` (docs)
5. **Task 5: REQUIREMENTS.md CLEAN-03 edit** — `5b2b833` (docs)
6. **Task 6: Final verification** — no commit (verification-only)

**Auto-fix commit:** `26d2eb7` (fix: Node 24 glob compatibility for test scripts)

## Files Created/Modified

- `package.json` (CREATED) — Adapter library shape per ARCH-05 / D-06..D-09; 40 lines
- `README.md` (REWRITTEN) — 110 lines (was 30); BeadsAdapter library framing
- `CLAUDE.md` (REWRITTEN) — 30 lines (was 11); sibling adapter role + Skill() auto-load preserved
- `CONTRIBUTING.md` (CREATED) — 61 lines; npm link workflow
- `.planning/REQUIREMENTS.md` (EDITED) — CLEAN-03 block (lines 305-311); D-12 wording

## Decisions Made

- **Test script glob form** — Use `'tests/unit/**/*.test.mjs'` rather than `tests/unit/` to satisfy Node 24's stricter `--test` argument handling (Node 24 treats bare directories as CJS module specs and errors with MODULE_NOT_FOUND). The plan's verbatim script form was Node 20-only; engines.node says `>=20`, so Node 24 must work too. Test names/keys unchanged → Wave 0 package-json-shape.test.mjs still passes (asserts script names exist, not contents).
- **REQUIREMENTS.md backtick removal** — The Wave 0 regex `/scripts\/cascade-loop\.sh also archives/` requires the literal substring with no backticks between `.sh` and `also`. The plan's mandated wording wrapped the path in backticks for markdown rendering. Removed only those one pair of backticks; rest of CLEAN-03 wording verbatim per D-12.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test regex vs. mandated text mismatch in CLEAN-03 wording**
- **Found during:** Task 5 (REQUIREMENTS.md CLEAN-03 edit)
- **Issue:** Plan §RESEARCH §10 Risk #1 mandated CLEAN-03 wording with `` `scripts/cascade-loop.sh` also archives `` (backticks). Wave 0 test `structural-cleanup.test.mjs` uses regex `/scripts\/cascade-loop\.sh also archives/` (literal substring, no backticks). Plan-as-written would not turn the test green.
- **Fix:** Removed backticks specifically around `scripts/cascade-loop.sh` in that one occurrence. All other backticks (around `regen-roadmap.sh`, `regen-requirements.sh`, `regen-state.sh`, `archive/v0.2-shadow/scripts/`, `src/bd/cascade.mjs`, `completePhaseAndCascade`) preserved per planner intent.
- **Files modified:** `.planning/REQUIREMENTS.md` (line 309)
- **Verification:** `command grep -F "scripts/cascade-loop.sh also archives" .planning/REQUIREMENTS.md` returns the line; structural-cleanup.test.mjs reports 5/5 green.
- **Committed in:** `5b2b833`

**2. [Rule 3 — Blocking] Node 24 incompatible test scripts**
- **Found during:** Task 6 (final integration verification)
- **Issue:** Plan-mandated `node --test tests/unit/ tests/conformance/` produces `MODULE_NOT_FOUND` on Node 24 (currently 24.14.0 on this dev machine). Node 24 treats bare directory args as CJS module specs instead of scanning the directory. Verification step blocked: cannot demonstrate `npm test` exits 0.
- **Fix:** Changed scripts to single-quoted glob patterns: `'tests/unit/**/*.test.mjs'` etc. Equivalent semantics on Node 20 (where the directory form also worked). The Wave 0 `package-json-shape.test.mjs` only asserts script names (`scripts.test`, `scripts['test:unit']`, etc.), not content — so the change is invisible to the test contract.
- **Files modified:** `package.json` (`scripts.test`, `scripts.test:unit`, `scripts.test:conformance`)
- **Verification:** `npm test` exits 0; tests 91/91 pass; `package-json-shape.test.mjs` 7/7 green.
- **Committed in:** `26d2eb7` (separate fix commit per executor protocol — never amend)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** Both fixes were minimal: surgical adjustments preserving the planner's narrative intent. No architectural drift, no requirement changes, no scope creep. The CLEAN-03 wording deviation is a planner test-vs-text inconsistency that the SUMMARY now documents for the verifier.

## Issues Encountered

- **`tests/unit/memories-seeded.test.mjs` slow on Node 24** — That carry-forward test calls `bash tests/fixtures/build-seed.sh` which runs `bd init --from-jsonl` against ~2000 dolt commits. On Node 24, the cumulative bd CLI work can take 1-2 minutes per test invocation, and combined with `node --test`'s parallel orchestration overhead, the test trips a "Promise resolution is still pending but the event loop has already resolved" cancellation when run alongside other tests. The test DOES pass when given enough wall-clock time (160s for the full suite) — it does not pass when run in isolation with a tight node:test internal timeout. **Out of scope for this plan** (no Phase 6.7 file modifies the test or build-seed.sh). Logged for future work.
- **Test count mismatch** — Plan says "17 unit test files (6 Wave 0 + 11 carry-forward)". Actual count: 15 `.mjs` test files + 1 `.sh` test file = 16. The plan's "11 carry-forward" was a planner miscount; the actual carry-forward count from Plan 04 was 9. Acceptance criterion "*The number of *.test.mjs files in tests/unit/ is at least 17*" cannot be satisfied without writing more tests, which is out of scope. The intent of the criterion (all carry-forward tests still present) IS satisfied.
- **`tests/fixtures/seed.jsonl` modified by build-seed.sh during test runs** — As warned by the executor context. Restored each time with `git checkout`.

## Threat Flags

None. The 5 STRIDE threats from `<threat_model>` are all mitigated as planned:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-6.07-01 (cluster file exposure) | Mitigated — exports map lists ONLY the 6 documented subpaths + `.` + `./package.json`; `src/adapter/*.mjs` clusters NOT exported |
| T-6.07-02 (peer-dep version drift) | Mitigated — CONTRIBUTING.md documents exact `npm link get-shit-done-cc` command + strict-peer-deps escape hatch |
| T-6.07-03 (path leakage in README) | Accepted as planned — `~/code/get-shit-done` is convention, not secret |
| T-6.07-04 (CLEAN-03 wording loss) | Mitigated — Wave 0 grep regression coverage in `structural-cleanup.test.mjs` |
| T-6.07-05 (Skill() auto-load drop) | Mitigated — Wave 0 docs-content.test.mjs greps for exact `Skill("spike-findings-gsd-beads")` |

## User Setup Required

None — no external service configuration required. The fork's `npm link` workflow is documented in CONTRIBUTING.md.

## Next Phase Readiness

**Phase 6 acceptance gate:** All 12 phase requirements satisfied across the 7 plans:
- CLEAN-01..04 — green (Plan 02 + Plan 07 wording fix)
- ARCH-01 (`src/bd/`) — green (Plan 04)
- ARCH-02 (`src/helpers/`) — green (Plan 04)
- ARCH-03 (`src/format/phase.mjs`) — green (Plan 05)
- ARCH-04 (`src/adapter.mjs` shell + clusters) — green (Plan 06)
- ARCH-05 (`package.json` adapter shape) — green (this plan)
- DOC-01 (README.md) — green (this plan)
- DOC-02 (CLAUDE.md) — green (this plan)
- TEST-01 (`tests/unit/` + `tests/conformance/` skeleton + carry-forward) — green (Plan 03 + 04)

**Ready for Phase 7 (Bin A foundational primitives):**
- `src/adapter.mjs` exists with cluster bindings (Plan 06)
- `src/bd/{helper,errors,findRoot}.mjs` exist (Plan 04)
- Conformance skeleton at `tests/conformance/` (Plan 03)
- `package.json` is publishable shape (this plan)

**Concerns (forwarded to Phase 7+):**
- `memories-seeded.test.mjs` runtime sensitivity on Node 24 — should be addressed in Phase 7 along with conformance test scaffolding (likely needs `t.test()` wrapping or `--test-timeout` adjustment)
- `seed.jsonl` test side-effect drift — `build-seed.sh` should be made deterministic so tests don't dirty the working tree (Phase 7 conformance may help)

## Self-Check: PASSED

Verified files exist and commits exist:
- `[FOUND]` `package.json`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.planning/REQUIREMENTS.md`
- `[FOUND]` Commits: `b510d4e`, `c057b1b`, `38f7659`, `173daf4`, `5b2b833`, `26d2eb7` (all in `git log`)

---
*Phase: 06-cleanup-adapter-library-scaffolding*
*Completed: 2026-04-30*
