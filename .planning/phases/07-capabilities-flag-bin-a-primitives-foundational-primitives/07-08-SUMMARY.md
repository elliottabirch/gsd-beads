---
phase: "07"
plan: "08"
subsystem: conformance
tags: [conformance-harness, capabilities-lint, seed-enrichment, milestone-beads, wave-6, CAP-01, CONF-01]
requires:
  - src/adapter.mjs (Plan 06 — BeadsAdapter shell + capabilities literal post-Plan 06; rationale comments preceding each `false:` value)
  - src/adapter/primitives.mjs (Plan 07 — all 16 primitives real; writeBinaryAsset throws UnsupportedOperationError per D-16)
  - src/bd/errors.mjs (existing — UnsupportedOperationError class with method + flag fields)
  - tests/fixtures/seed.jsonl (Plan 06 — multi-milestone bd state; this plan enriches with 4 milestone beads additively)
  - tests/fixtures/build-seed.sh (existing — source-of-truth seeder; this plan adds milestone-bead block before plan-children section)
  - tests/unit/seed-determinism.test.sh (existing CONF-03 test — must still pass post-edit)
  - tests/unit/primitives-events.smoke.test.mjs (Plan 06 — freshBdFixture pattern mirrored into conformance fixture.mjs)
  - .planning/phases/07-.../07-CONTEXT.md §D-13 / §D-14 / §D-15 / §D-16
  - .planning/phases/07-.../07-RESEARCH.md §"Pattern 6 / driver" §"Pattern 6 / fixture.mjs" §"Open Questions / Q3"
provides:
  - "tests/conformance/fixture.mjs — setupFreshAdapter(t, kind='beads') Promise<{adapter, projectRoot}>; mkdtempSync + git init + bd init --from-jsonl --skip-hooks --skip-agents + chmod 0o700 + .planning skeleton + t.after cleanup. 69 lines."
  - "tests/conformance/capabilities.test.mjs — runConformance(makeAdapter, label) export with 4 CAP-01 tests (shape lint, rationale lint, writeBinaryAsset throw-message, writeBinaryAsset structured-fields) wrapped in describe('Capabilities flag [<label>]'); GSD_CONFORMANCE_AUTORUN gate so glob and driver paths don't double-register. 99 lines."
  - "tests/conformance/run.mjs — driver setting GSD_CONFORMANCE_AUTORUN=0 before imports; FILES list seeded with capabilities.test.mjs only (Plans 09/10 extend); factories array seeded with BeadsAdapter factory; RUN_CROSS_ADAPTER=1 toggle reserved for Phase 13 with explicit error guard. 46 lines."
  - "tests/fixtures/build-seed.sh — adds 4 gsd:milestone+version:vX.Y epic beads (M01..M10) between v0.3 phase block and seed_plans() function; updates [build-seed] echo summary with Milestones line."
  - "tests/fixtures/seed.jsonl — regenerated via build-seed.sh (37 → 41 lines); 4 new milestone bead records with deterministic created_at/updated_at preserved across runs (CONF-03 byte-identity green via tests/unit/seed-determinism.test.sh)."
  - "tests/unit/seed-determinism.test.sh — CASE 2 phase-count assertions now filter on `-l gsd:phase` so milestone epics (which share version:vX.Y labels) don't pollute the v0.1/v0.2/v0.3 phase counts. Test intent preserved."
affects:
  - "Wave 6 / Plan 09 (Bin A conformance — binA-records.test.mjs + binA-section.test.mjs + binA-frontmatter.test.mjs) — fixture.mjs + run.mjs ready; Plan 09 extends FILES list and adds new conformance test files following the auto-invoke + runConformance export pattern established here."
  - "Wave 6 / Plan 10 (foundational conformance — foundational-events.test.mjs + foundational-namedDoc.test.mjs + foundational-snapshot.test.mjs) — milestone beads in seed.jsonl unblock COMMENT_EVENT_TYPES dispatch tests (session/quick_task/forensic_session); _resolveMilestoneBead() can now find a target via gsd:milestone + version:<v> label-pair filter."
  - "Phase 13 (cross-adapter parity) — RUN_CROSS_ADAPTER=1 toggle wired without fork dep; when fork's MarkdownAdapter ships, Phase 13 imports it via npm-link and pushes a second factory into the array. Driver shape doesn't change."
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "Conformance-harness driver pattern (D-14): each conformance test file exports `runConformance(makeAdapter, label)` and does NOT auto-register at top level when GSD_CONFORMANCE_AUTORUN=0. Driver imports + invokes; standalone `node --test` invocation falls through to the auto-invoke gate at file bottom which calls runConformance with a default beads factory."
    - "Per-test fresh adapter via mkdtempSync (D-15): never mutates the canonical seed.jsonl in place. CONF-03 byte-identity invariant preserved by the additive-only enrichment of build-seed.sh + the per-test copyFileSync into a fresh tmp dir."
    - "Capabilities lint via source-text inspection: rationale lint reads src/adapter.mjs as text, finds each `<flag>: false,` line, asserts a comment containing 'UNSUPPORTED' or 'unsupported' appears within the 5 preceding lines. No runtime instrumentation needed; the lint is defensive against future edits that strip the rationale."
    - "Locked throw-message format (D-16) verified by regex: `^BeadsAdapter\\.writeBinaryAsset: not supported \\(capabilities\\.binaryAsset=false\\)\\.` — exact-prefix match. Optional hint suffix not asserted (allows variant hints across versions)."
    - "Structured error fields (UnsupportedOperationError): assert.equal err.method + err.flag — orthogonal to the message regex, so test failure points at the missing field directly without coupling to message format."
    - "Additive seed enrichment with version-label disambiguation: milestone beads share `version:vX.Y` labels with phase epics; the disambiguator is the `gsd:milestone` vs `gsd:phase` label. The seed-determinism test was updated to filter on `gsd:phase` so phase counts stay stable; future tests that care about milestone beads filter on `gsd:milestone`."
key-files:
  created:
    - tests/conformance/fixture.mjs
    - tests/conformance/capabilities.test.mjs
    - tests/conformance/run.mjs
  modified:
    - tests/fixtures/build-seed.sh
    - tests/fixtures/seed.jsonl
    - tests/unit/seed-determinism.test.sh
key-decisions:
  - "Implemented verbatim from RESEARCH §Pattern 6 skeletons (driver + fixture) and PATTERNS §capabilities.test.mjs (4 lint tests + auto-invoke gate). No deviations on test logic."
  - "Added git author identity (`git config user.email/user.name` + initial empty commit) to setupFreshAdapter, matching primitives-events.smoke.test.mjs:freshBdFixture. Without this, bd init fails on hosts without global git config."
  - "Updated tests/unit/seed-determinism.test.sh CASE 2 to filter on `-l gsd:phase` (Rule 3 blocking fix). Without this, the new milestone beads (which share `version:vX.Y` labels with phase epics) pollute the phase-count assertions and the test fails."
  - "TDD-task-3 had no RED phase: capabilities + writeBinaryAsset throw shipped in Plan 06; this plan conformance-locks the existing shape. Per the TDD fail-fast rule, when a feature pre-exists by design, the lint/conformance test is committed directly to GREEN (documented as a non-deviation in the SUMMARY)."
  - "Auto-invoke gate (GSD_CONFORMANCE_AUTORUN=0) chosen as Option A from the plan. Both `npm run test:conformance` (glob) and `node tests/conformance/run.mjs` (driver) work; the driver suppresses the gate before its imports."
patterns-established:
  - "Conformance test file template: top-of-file imports + runConformance export + auto-invoke gate at bottom. Plans 09/10 follow this template byte-for-byte; only the test cases inside runConformance change."
  - "Driver FILES extension protocol: Plans 09/10 add file paths to the FILES array in run.mjs in alphabetical order; the auto-invoke gate at the bottom of each conformance file makes new files glob-discoverable too without double-registration."
  - "Milestone-bead seeding convention: 1 epic per active milestone with `gsd:milestone` + `version:<v>` label-pair (NOT `gsd:phase`); Plan 10's `_resolveMilestoneBead()` filters on this exact label-pair. New milestones added in future plans follow the same convention."
requirements-completed:
  - CAP-01
  - CONF-01
duration: ~16 min
completed: 2026-05-01
---

# Phase 07 Plan 08: Conformance harness scaffolding + capabilities lint + seed enrichment

**Landed the conformance harness skeleton (`run.mjs` + `fixture.mjs`), the first conformance test file (`capabilities.test.mjs` with 4 CAP-01 cases), and enriched `tests/fixtures/seed.jsonl` with 4 milestone beads (v0.1/v0.2/v0.3/v1.0) so Plan 10's foundational-events conformance can exercise COMMENT_EVENT_TYPES dispatch.**

## Performance

- **Duration:** ~16 min (938 s)
- **Started:** 2026-05-01T10:10:14Z
- **Completed:** 2026-05-01T10:25:52Z
- **Tasks:** 4 (1 seed enrichment + 1 fixture helper + 1 capabilities test + 1 driver)
- **Commits:** 4 atomic
- **Files created:** 3 (`tests/conformance/fixture.mjs`, `tests/conformance/capabilities.test.mjs`, `tests/conformance/run.mjs`)
- **Files modified:** 3 (`tests/fixtures/build-seed.sh`, `tests/fixtures/seed.jsonl`, `tests/unit/seed-determinism.test.sh`)
- **Test cases added:** 4 conformance (CAP-01 lint suite); 0 new unit tests (existing seed-determinism updated for stability)
- **Suite delta:** unit 179/179 (unchanged); conformance 0 → 4 (new harness)

## Accomplishments

### CONF-01: Conformance harness scaffolding

- **`tests/conformance/fixture.mjs`** (69 lines) — `setupFreshAdapter(t, kind='beads')` returning `{adapter, projectRoot}`. Per-test `mkdtempSync` + `git init` (with author identity for `bd init`'s commit step) + `mkdirSync .beads` + `copyFileSync seed.jsonl` + `bd init --from-jsonl --prefix sd --skip-agents --skip-hooks --quiet` + `chmodSync .beads 0o700` (Pitfall 6) + `mkdirSync .planning` skeleton + `t.after` cleanup. `BEADS_ACTOR=seed` on the bd init call (Pitfall 8 / D-20). Refuses unknown `kind` arguments with a clear "Phase 13 wires 'markdown'" error.
- **`tests/conformance/run.mjs`** (46 lines) — driver setting `GSD_CONFORMANCE_AUTORUN=0` BEFORE imports so per-file auto-invoke blocks suppress; iterates a `FILES` array (capabilities.test.mjs only at this wave; Plans 09/10 extend) × a `factories` array (BeadsAdapter only; RUN_CROSS_ADAPTER=1 reserves the second slot for Phase 13 MarkdownAdapter pairing) and dispatches `runConformance(factory, label)` for each combination via `await import(file)`.
- **Both invocation paths verified:** `npm run test:conformance` (glob path — auto-invoke fires) and `node tests/conformance/run.mjs` (driver path — auto-invoke suppressed) produce the same 4 assertions, all green. Standalone `node --test tests/conformance/capabilities.test.mjs` also works.

### CAP-01: Capabilities lint suite (4 tests)

- **`tests/conformance/capabilities.test.mjs`** exports `runConformance(makeAdapter, label)` with 4 tests in `describe('Capabilities flag [<label>]')`:
  1. **Shape lint** — `Object.isFrozen(BeadsAdapter.capabilities)` + `assert.deepEqual` against the literal 7-key D-2026-04-30-05 / D-16 shape `{record:true, section:true, binaryAsset:false, snapshot:true, transaction:false, namedDoc:true, commitPlanningState:false}`.
  2. **Rationale lint** — reads `src/adapter.mjs` as text, finds each `<flag>: false,` line, asserts a comment matching `/UNSUPPORTED|unsupported/` appears within the 5 preceding lines. Targets all 3 false flags (binaryAsset, transaction, commitPlanningState).
  3. **`writeBinaryAsset` throw-message lint** — `assert.rejects` with regex `/^BeadsAdapter\.writeBinaryAsset: not supported \(capabilities\.binaryAsset=false\)\./` (D-16 locked prefix; optional hint suffix not asserted).
  4. **`writeBinaryAsset` structured-fields lint** — `err.method === 'writeBinaryAsset'` + `err.flag === 'binaryAsset'` for diagnostic-friendly error inspection.
- **Auto-invoke gate** at file bottom: `if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') { await import('./fixture.mjs') → runConformance(...) }` — fires under glob path, suppressed under driver path.

### Seed enrichment for Plan 10 (COMMENT_EVENT_TYPES dispatch substrate)

- **`tests/fixtures/build-seed.sh`** — added a milestone-bead block between the v0.3 phase block (line 94) and the `# Plan children for v0.2 phases` separator (line 96). 4 epics created with `BEADS_ACTOR=seed bd q`:
  - M01 — "Milestone v0.1: Foundation" + `gsd:milestone` + `version:v0.1` + closed
  - M02 — "Milestone v0.2: Beads-backed reads" + `gsd:milestone` + `version:v0.2` + closed
  - M03 — "Milestone v0.3: Adapter scaffolding" + `gsd:milestone` + `version:v0.3` (open)
  - M10 — "Milestone v1.0: BeadsAdapter" + `gsd:milestone` + `version:v1.0` (open) — Plan 10's primary target
- **Trailing echo summary** updated with `[build-seed] Milestones: M01(v0.1) M02(v0.2) M03(v0.3) M10(v1.0)` line.
- **`tests/fixtures/seed.jsonl`** regenerated deterministically: 37 → 41 lines (4 new issue records with `_type:"issue"` + `gsd:milestone` label). Memories section unchanged. CONF-03 byte-identity invariant preserved.

### Tooling fix: seed-determinism CASE 2

- **`tests/unit/seed-determinism.test.sh`** CASE 2 now filters on `-l gsd:phase` so milestone epics (which share `version:vX.Y` labels with phase epics) don't pollute phase-count assertions. Test intent — "phase epic counts per milestone" — preserved. CASE 1 (sorted bd export equivalence) unchanged.

## Task Commits

Atomic commits on this worktree branch (each `--no-verify` per parallel-execution protocol):

1. **Task 1: Enrich seed.jsonl with milestone beads** — `52ac338` (`feat(07-08): enrich seed.jsonl with milestone beads (v0.1/v0.2/v0.3/v1.0)`) — adds 4 milestone bead records to `tests/fixtures/seed.jsonl` (37 → 41 lines) via additive bd state in `tests/fixtures/build-seed.sh`; updates `tests/unit/seed-determinism.test.sh` CASE 2 phase-filter for label-collision robustness.
2. **Task 2: setupFreshAdapter helper** — `77af382` (`feat(07-08): add tests/conformance/fixture.mjs (setupFreshAdapter helper)`) — 69-line helper formalizing the `freshBdFixture` pattern from Plan 06's smoke tests. Returns `{adapter, projectRoot}` Promise; t.after cleanup; chmodSync 0o700; BEADS_ACTOR=seed.
3. **Task 3: Capabilities lint suite** — `1939ec8` (`test(07-08): add tests/conformance/capabilities.test.mjs (CAP-01 lint suite)`) — 4 tests inside `runConformance` export + auto-invoke gate. Exercises `BeadsAdapter.capabilities` shape + rationale comments in `src/adapter.mjs` + `writeBinaryAsset` throw contract.
4. **Task 4: Driver** — `6b3cf2f` (`feat(07-08): add tests/conformance/run.mjs driver`) — sets `GSD_CONFORMANCE_AUTORUN=0` before imports; iterates FILES × factories; reserves RUN_CROSS_ADAPTER=1 for Phase 13.

## Files Created/Modified

### Created

- `tests/conformance/fixture.mjs` — 69 lines. `setupFreshAdapter(t, kind='beads')` per-test bd-init helper. Imports BeadsAdapter from `../../src/adapter.mjs`; SEED resolved from `../fixtures/seed.jsonl`. mkdtempSync + git init + git config (author identity) + initial empty commit + mkdir .beads + copyFile seed → .beads/issues.jsonl + bd init --from-jsonl --skip-hooks + chmod 0o700 + mkdir .planning + t.after cleanup. Refuses unknown kind with explicit Phase 13 hint.
- `tests/conformance/capabilities.test.mjs` — 99 lines. Exports `runConformance(makeAdapter, label)` with `describe('Capabilities flag [<label>]')` containing 4 tests (shape lint, rationale lint, writeBinaryAsset throw-prefix, writeBinaryAsset structured fields). Auto-invoke gate at bottom imports fixture.mjs and dispatches with default beads factory when `GSD_CONFORMANCE_AUTORUN !== '0'`.
- `tests/conformance/run.mjs` — 46 lines. Sets `process.env.GSD_CONFORMANCE_AUTORUN = '0'` before importing fixture.mjs; FILES = ['./capabilities.test.mjs'] (Plans 09/10 extend); factories = [BeadsAdapter factory]; RUN_CROSS_ADAPTER=1 toggle throws explicit error pending Phase 13 fork integration. Iterates and dispatches via dynamic await import.

### Modified

- `tests/fixtures/build-seed.sh`:
  - Inserted milestone-bead block (lines 96-117 in the post-edit file) between v0.3 phase epics and `seed_plans()` function. 4 epics created with `bd q -t epic -p {1,2}` + `bd label add gsd:milestone` + `bd label add version:vX.Y` + `bd close` (M01, M02 only — M03/M10 stay open).
  - Trailing echo summary extended with `Milestones: M01(v0.1) M02(v0.2) M03(v0.3) M10(v1.0)` line.
- `tests/fixtures/seed.jsonl` — regenerated via build-seed.sh; 37 → 41 lines. 4 new `{"_type":"issue", ..., "labels":["gsd:milestone","version:vX.Y"]}` records appear after existing phase epics in the export. The 2 memory entries (`gsd-beads:milestone:v0.1:heading`, `gsd-beads:milestone:v0.2:heading`) remain at the end. CONF-03 byte-identity preserved across runs.
- `tests/unit/seed-determinism.test.sh` — CASE 2 phase-count assertions now include `-l gsd:phase` to disambiguate phase epics from the new milestone epics that share `version:vX.Y` labels. Comment block added explaining the filter rationale.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Implemented all 4 tasks verbatim from the plan's RESEARCH/PATTERNS skeletons | Plan was prescriptive; the skeletons covered driver, fixture, capabilities lint, and auto-invoke gate. |
| 2 | Added git author identity (`user.email`/`user.name` + initial empty commit) to `setupFreshAdapter` | Without it, `bd init` errors on hosts where global git config isn't set (CI runners, fresh dev boxes). Mirrors the established pattern from `tests/unit/primitives-events.smoke.test.mjs:freshBdFixture`. Not in the plan's verbatim skeleton but consistent with Plan 06's parallel helper. |
| 3 | Chose Option A (auto-invoke gate) over Option B (run.mjs as test:conformance entrypoint) | Option A keeps `npm run test:conformance` running the standard `node --test 'tests/conformance/**/*.test.mjs'` glob (no package.json change required) AND lets the driver suppress double-registration via env-var. Plans 09/10 follow the same template byte-for-byte. |
| 4 | Updated `tests/unit/seed-determinism.test.sh` CASE 2 to filter on `gsd:phase` | Rule 3 blocking fix. Without the filter, milestone epics (which carry `version:vX.Y` labels for `_resolveMilestoneBead` discoverability) inflate phase-count assertions and the test fails. The test's intent is "phase epic counts per milestone" — adding `-l gsd:phase` makes that explicit. |
| 5 | Plan-task-3 (TDD) was committed directly to GREEN — no separate RED commit | Capabilities + writeBinaryAsset throw shipped in Plan 06 (verified by reading `src/adapter.mjs:51-81` and `src/adapter/primitives.mjs:557-563`). The test file is a conformance LINT against pre-existing implementation — there is nothing to fail-then-fix. Per the TDD fail-fast rule, this is the correct path: the test passes immediately because the feature already exists by design. Documented in Deviations below. |
| 6 | Did NOT add `BEADS_ACTOR=seed` git env var to git config calls | Plan only requires it on `bd` calls (which mutate bd state). git config is local config writing, not bd state. Mirroring primitives-events.smoke.test.mjs which also doesn't pass the env var to git operations. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `tests/unit/seed-determinism.test.sh` CASE 2 phase-count assertions broke after milestone-bead seeding**

- **Found during:** Task 1 verification — `bash tests/unit/seed-determinism.test.sh` returned exit 1 with `v0.1 closed=3 (expected 2), v0.2 open=7 (expected 7), v0.3 open=3 (expected 2)`.
- **Issue:** The new milestone beads share `version:vX.Y` labels with phase epics. The test's CASE 2 query `bd list --status=closed -l version:v0.1 --type=epic` matches BOTH the phase epic (P11) AND the milestone bead (M01) for v0.1, inflating the count from 2 to 3. Same for v0.3 (open count from 2 to 3). v0.2 happened to stay at 7 because the milestone bead was closed and the test queries `--status=open`.
- **Fix:** Added `-l gsd:phase` to all 3 phase-count queries in CASE 2 so milestone epics are filtered out. Test intent — "phase epic counts per milestone" — preserved; the new label simply makes that intent explicit. Comment block added explaining the filter rationale.
- **Files modified:** `tests/unit/seed-determinism.test.sh`
- **Verification:** Re-ran `bash tests/unit/seed-determinism.test.sh` → CASE 1 + CASE 2 both pass. Full unit suite 179/179 still green afterward.
- **Committed in:** `52ac338` (Task 1 commit — bundled with the seed enrichment that triggered the test break).

### Non-deviations (documented for completeness)

**N1. Task 3 had no TDD RED phase**

The plan tagged Task 3 with `tdd="true"`, but the feature being tested (capabilities literal + writeBinaryAsset throw) shipped in Plan 06 by design. Per the TDD execution flow's fail-fast rule, when a test passes immediately on first run, the agent must STOP and investigate. Investigation: `src/adapter.mjs:51-81` (capabilities Object.freeze with rationale comments) and `src/adapter/primitives.mjs:557-563` (writeBinaryAsset throwing UnsupportedOperationError) are both real implementations from Plan 06. The test file in this plan is a CONFORMANCE LINT — not a TDD-developed feature — and committing it directly to GREEN is correct (the lint locks the existing shape against drift in future edits). This is documented as a non-deviation rather than a Rule violation because:

- The plan's `<objective>` explicitly says "**CAP-01:** Flag shape lint + JSDoc rationale lint + writeBinaryAsset assertion (3 tests in capabilities.test.mjs)" — lint, not TDD-developed feature.
- No code in `src/` was touched in Task 3.
- The 4 tests pass because the implementation predates the test by design (Plan 06 / Plan 07 work).

The plan-level fail-fast rule is intended to catch cases where a test passes because the test is wrong; here the test is right and the feature pre-exists. Documented.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — seed-determinism phase-count filter). 1 documented non-deviation (Task 3 no-RED — feature pre-exists).

**Impact on plan:** No scope creep. All 4 tasks landed verbatim; the seed-determinism filter is a 3-line surgical fix that preserves the test's intent. Conformance harness scaffolding is now ready for Plans 09 and 10 to extend with binA-* and foundational-* test files.

## Issues Encountered

None beyond the deviation above. Both bd CLI invocations (`bd q`, `bd label add`, `bd close`, `bd init --from-jsonl`) work as documented in the carry-forward spike findings + Plan 06's freshBdFixture pattern. The auto-invoke gate (`GSD_CONFORMANCE_AUTORUN`) cleanly separates the glob path from the driver path; no double-registration observed.

Pre-existing repo state at executor start (left alone — unrelated to this plan):
- `recipe/gsd-beads-recipe.md` deleted (pre-existing dirty state from earlier worktree session — not committed)
- `tests/fixtures/seed.jsonl` had a pre-existing modification (reverted to the v0.3 baseline by the worktree-base reset; this plan's regeneration replaces it)
- `.claude/worktrees/` directory (worktree harness; not committed)

These were not committed by this plan.

## Threat Model Status

Plan's `<threat_model>` had 3 entries; outcomes:

| Threat ID | Disposition (plan) | Outcome |
|-----------|--------------------|---------|
| T-7-18 | mitigate (tmpdir leftover after test failure) | **Mitigated.** `t.after(() => rmSync(root, {recursive:true, force:true}))` registered in `setupFreshAdapter`. node:test's t.after fires on both pass and fail (verified empirically across the existing primitives smoke tests). |
| T-7-19 | mitigate (seed.jsonl byte-identity broken by non-deterministic enrichment) | **Mitigated.** Every new bd call in `build-seed.sh` carries `BEADS_ACTOR=seed` (Pitfall 8 / D-20). `tests/unit/seed-determinism.test.sh` CASE 1 (sorted bd export equivalence) green post-edit, confirming determinism preserved. |
| T-7-02 | accept (bd init parses adapter-controlled JSONL) | **Accepted as planned.** `seed.jsonl` is committed source; bd's own JSONL parser is hardened. No additional surface introduced. |

No new threats discovered during implementation.

## Threat Surface Scan (post-impl)

No new security-relevant surface introduced beyond the threat-model entries. The conformance fixture writes only into `mkdtempSync(join(tmpdir(), 'gsd-conf-'))` directories (POSIX 0700 by default). The driver and capabilities lint do not open new endpoints, auth paths, or schema changes at trust boundaries. Reading `src/adapter.mjs` as text (rationale lint) is local file I/O against committed source, no untrusted input.

## Known Stubs

**None.** The 3 created files are real implementations:
- `tests/conformance/fixture.mjs` — full mkdtempSync + bd init + cleanup helper
- `tests/conformance/capabilities.test.mjs` — 4 real lint tests; assertions exercise actual BeadsAdapter behavior
- `tests/conformance/run.mjs` — full driver iterating FILES × factories; RUN_CROSS_ADAPTER=1 throws explicit error pending Phase 13 (intentional, not stubbed)

The FILES list contains only `./capabilities.test.mjs` at this wave; Plans 09 and 10 extend it with their own conformance files. This is wave-progressive scaffolding, not a stub.

## TDD Gate Compliance

Plan frontmatter is `type: execute` (not `type: tdd`). Task 3 carries `tdd="true"` per plan tag, but it is a conformance LINT against pre-existing Plan 06 implementation — there is no RED gate because there is no feature to develop. See "Decisions Made" #5 + "Deviations from Plan" N1 for the rationale.

| Task | TDD tag | RED gate | GREEN gate | Notes |
|------|---------|----------|------------|-------|
| 1 (seed enrichment) | no | n/a | feat commit `52ac338` | bash + bd CLI changes; not a TDD feature |
| 2 (fixture.mjs) | no | n/a | feat commit `77af382` | helper module; verification by import + grep + node-side smoke (no test cases added) |
| 3 (capabilities.test.mjs) | yes (plan tag) | n/a — feature pre-exists (Plan 06) | test commit `1939ec8` (4/4 pass on first run) | Conformance LINT, not TDD-developed feature; documented as non-deviation N1 |
| 4 (run.mjs) | yes (plan tag) | n/a — driver wires existing pieces | feat commit `6b3cf2f` (verified by both invocation paths green) | Driver scaffolding; verification = both glob and driver paths produce same 4 assertions |

## What's Next (handoff)

- **Plan 09 (Bin A conformance — wave 6 sibling)** is unblocked. Template:
  1. Add `binA-records.test.mjs`, `binA-section.test.mjs`, `binA-frontmatter.test.mjs` following `capabilities.test.mjs` shape (top imports + `runConformance` export + auto-invoke gate at bottom).
  2. Each test file imports `setupFreshAdapter` from `./fixture.mjs` for the auto-invoke factory and accepts `makeAdapter` from the driver.
  3. Add the 3 new file paths to the FILES array in `run.mjs` (alphabetical ordering keeps diffs clean).
- **Plan 10 (foundational conformance — wave 6 sibling)** is unblocked. Template:
  1. Same pattern as Plan 09: 3 new test files (`foundational-events.test.mjs`, `foundational-namedDoc.test.mjs`, `foundational-snapshot.test.mjs`) with `runConformance` export + auto-invoke.
  2. The COMMENT_EVENT_TYPES dispatch tests in `foundational-events.test.mjs` can now resolve a milestone bead via the seeded `gsd:milestone + version:v1.0` label-pair (M10 in seed.jsonl). Default to `payload.milestone='v1.0'` to hit M10; v0.1/v0.2/v0.3 milestones available for negative/multi-milestone tests.
- **Phase 13 (cross-adapter parity)** — when fork's MarkdownAdapter ships and is npm-linked, uncomment the `RUN_CROSS_ADAPTER=1` block in `run.mjs:25-37`, push the second factory, and the same conformance suite exercises both adapters. No conformance test file changes needed — the `[label]` parameter in `describe('Capabilities flag [<label>]')` already disambiguates parallel runs.
- **deferred-items.md (cwd-not-passed at Plan 04+05 call sites)** — still outstanding. Not addressed by this plan; the conformance fixture passes `cwd: this._beadsRoot` indirectly via the BeadsAdapter constructor's `projectRoot`, so the bug doesn't manifest in this plan's scope.

## Self-Check: PASSED

Verified post-write:

```
$ [ -f tests/conformance/fixture.mjs ] && echo FOUND
FOUND
$ [ -f tests/conformance/capabilities.test.mjs ] && echo FOUND
FOUND
$ [ -f tests/conformance/run.mjs ] && echo FOUND
FOUND
$ git log --oneline | head -5
6b3cf2f feat(07-08): add tests/conformance/run.mjs driver
1939ec8 test(07-08): add tests/conformance/capabilities.test.mjs (CAP-01 lint suite)
77af382 feat(07-08): add tests/conformance/fixture.mjs (setupFreshAdapter helper)
52ac338 feat(07-08): enrich seed.jsonl with milestone beads (v0.1/v0.2/v0.3/v1.0)
dddfc8a docs(phase-07): update tracking after wave 5
$ wc -l tests/fixtures/seed.jsonl
41 tests/fixtures/seed.jsonl
$ grep -c '"_type":"issue".*gsd:milestone' tests/fixtures/seed.jsonl
4
$ npm run test:conformance 2>&1 | grep -E "^ℹ (tests|pass|fail)"
ℹ tests 4
ℹ pass 4
ℹ fail 0
$ bash tests/unit/seed-determinism.test.sh 2>&1 | tail -3
[PASS] CASE 1 (D-07): seed-fixture produces equivalent bd state (sorted comparison)
[PASS] CASE 2 (D-08): seed contains v0.1-closed (2), v0.2-open (7), v0.3-open (2)
Passed: 2 / 2
$ find tests/unit -maxdepth 1 -name "*.test.mjs" -type f | xargs node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
ℹ tests 179
ℹ pass 179
ℹ fail 0
```

All 4 commits exist on the worktree branch; all 3 new conformance files exist; modified files (build-seed.sh, seed.jsonl, seed-determinism.test.sh) contain the expected new content; full unit suite 179/179 green; conformance suite 4/4 green; seed-determinism CONF-03 byte-identity preserved; milestone-bead count matches plan target (4); seed.jsonl line count matches plan target (>= 41).

---
*Phase: 07 (capabilities-flag-bin-a-primitives-foundational-primitives)*
*Plan: 08 (conformance harness skeleton + capabilities lint + seed enrichment)*
*Completed: 2026-05-01*
