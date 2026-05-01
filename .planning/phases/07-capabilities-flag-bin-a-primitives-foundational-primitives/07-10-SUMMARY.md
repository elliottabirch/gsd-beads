---
phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives
plan: 10
subsystem: testing
tags: [conformance, foundational-primitives, recordStateEvent, namedDoc, snapshot, format-phase, CONF-01, CONF-02, PRIM-02]

requires:
  - phase: 07-09
    provides: tests/conformance/binA-*.test.mjs + run.mjs FILES list (capabilities + 3 binA = 4 files)
  - phase: 07-08
    provides: enriched seed.jsonl with v1.0 milestone bead (gsd:milestone + version:v1.0)
  - phase: 07-06
    provides: src/adapter/primitives.mjs recordStateEvent + putNamedDoc/getNamedDoc + snapshot/restore impls
  - phase: 07-07
    provides: putNamedDoc T-7-01 path-separator guard
provides:
  - tests/conformance/foundational-events.test.mjs — 12 PRIM-02 event-dispatch tests (7 memory + 3 comment + 1 unknown + 1 milestone-resolution)
  - tests/conformance/foundational-namedDoc.test.mjs — 22 PRIM-02 namedDoc tests (9 categories × 2 + 4 negative/edge)
  - tests/conformance/foundational-snapshot.test.mjs — 8 PRIM-02 snapshot/restore tests (path/JSONL/round-trip/security/comment-author)
  - tests/conformance/run.mjs — final 7-file FILES list (capabilities + 3 binA + 3 foundational)
  - CONF-02 audit confirming 11 phase-format fixtures cover ROADMAP §Phase 7 SC#5 categories (no new fixture needed)
affects: [phase-08-init-bundlers, phase-13-cross-adapter-conformance]

tech-stack:
  added: []
  patterns:
    - "for-loop dynamic test names over enum constants (NAMED_DOC_CATEGORIES, MEMORY_EVENT_TYPES, COMMENT_EVENT_TYPES) — single test() body emits N test cases"
    - "Direct bd reads (`bd recall`, `bd comments --json`, `bd show --json`) for storage-shape assertions per D-12 — Phase 9+ adapter read methods are NOT used in foundational conformance"
    - "Per-test snapshot tmp-dir cleanup via t.after(() => rmSync(dirname(snap)...)) per T-7-22 mitigation"

key-files:
  created:
    - tests/conformance/foundational-events.test.mjs
    - tests/conformance/foundational-namedDoc.test.mjs
    - tests/conformance/foundational-snapshot.test.mjs
  modified:
    - tests/conformance/run.mjs

key-decisions:
  - "bd v1.0.3 `bd show <id> --json` returns a single-element array, not a bare object — milestone-resolution test unwraps with Array.isArray check before reading labels"
  - "CONF-02 audit: existing 11 fixtures cover all four ROADMAP §Phase 7 SC#5 categories (single-line goals, multi-line success criteria, empty values, edge cases per ARCH-03); no new fixtures required"
  - "Snapshot round-trip preservation of comment.author field validates the D-09 amendment (--author replaces --label on bd comments) survives the bd export/import cycle"

patterns-established:
  - "Foundational conformance file shape: `runConformance(makeAdapter, label)` export + describe block + auto-invoke gate via GSD_CONFORMANCE_AUTORUN — same skeleton as Plan 09 binA-*.test.mjs"
  - "CONF-02 audit pattern: enumerate ROADMAP-mandated categories in a markdown table mapped to existing fixtures, document gap analysis in SUMMARY (no test code change when coverage is complete)"

requirements-completed: [CONF-01, CONF-02, PRIM-02]

duration: 12min
completed: 2026-05-01
---

# Phase 07 Plan 10: Wave 8 — Foundational conformance + CONF-02 audit Summary

**Three new foundational conformance files (events × 12, namedDoc × 22, snapshot × 8) wired into the driver's 7-file FILES list, plus CONF-02 audit confirming 11 phase-format fixtures cover ROADMAP §Phase 7 SC#5; full Phase 7 conformance suite ships green at 71 tests.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-01T11:11:24Z
- **Completed:** 2026-05-01T11:23:30Z
- **Tasks:** 5 (4 with code commits, Task 4 is documentation-only audit)
- **Files modified:** 4 (3 new conformance files + 1 driver edit)

## Accomplishments

- 42 new foundational conformance tests covering all 6 PRIM-02 primitives (recordStateEvent × 10 dispatch types + putNamedDoc/getNamedDoc × 9 categories + writeBinaryAsset (covered by capabilities.test.mjs from Plan 03) + snapshot/restore round-trip).
- Driver `run.mjs` FILES list complete for Phase 7 (capabilities + 3 binA + 3 foundational = 7 files); both invocation paths (`npm run test:conformance` glob and `node tests/conformance/run.mjs` driver dispatch) green at 71 tests across 7 suites.
- CONF-02 audit complete: 11 phase-format fixtures map cleanly to ROADMAP §Phase 7 SC#5 canonical-input categories (single-line goals, multi-line success criteria, empty values, ARCH-03 edge cases); 15 format-phase tests pass (4 inline + 11 fixture round-trips).
- Phase 7 acceptance gate met — 16 BeadsAdapter primitive methods all real, capabilities flag locked + lint passing, conformance suite covers Bin A + foundational + capabilities for the BeadsAdapter standalone using seed.jsonl.

## Task Commits

Each task was committed atomically on this worktree branch:

1. **Task 1: foundational-events.test.mjs** — `ccf2db4` (test)
2. **Task 2: foundational-namedDoc.test.mjs** — `a7dcfad` (test)
3. **Task 3: foundational-snapshot.test.mjs** — `7f4db7a` (test)
4. **Task 4: CONF-02 audit** — no code commit (documentation only; mapping recorded in this SUMMARY's `## CONF-02 Audit Table` below)
5. **Task 5: run.mjs FILES list update** — `35bb42d` (feat)

## Files Created/Modified

- `tests/conformance/foundational-events.test.mjs` — 12 PRIM-02 event-dispatch tests; for-loops emit per-type tests across MEMORY_EVENT_TYPES (7) and COMMENT_EVENT_TYPES (3) plus 1 unknown-type negative + 1 milestone-resolution smoke. Direct bd reads (`bd recall`, `bd comments --json`) per D-12 — no Phase 9+ adapter methods used.
- `tests/conformance/foundational-namedDoc.test.mjs` — 22 PRIM-02 namedDoc tests; for-loop emits put + get pairs across all 9 NAMED_DOC_CATEGORIES (intel, codebase, research, archived-milestone, debug-knowledge-base, learnings, methodology, discussion-log, discovery) + 4 negative/edge tests (closed-allowlist on put/get, T-7-01 path-traversal guard, missing-key returns null).
- `tests/conformance/foundational-snapshot.test.mjs` — 8 PRIM-02 snapshot/restore tests; path/JSONL/round-trip/security/comment-author preservation. Self-clean tmp dirs via `t.after()` per T-7-22 mitigation.
- `tests/conformance/run.mjs` — FILES list extended from 4 to 7; header comment updated to reflect Phase 7 completion.

## Decisions Made

1. **bd v1.0.3 `bd show --json` returns array, not object.** During Task 1's milestone-resolution test, the assertion `(issue.labels ?? []).includes('gsd:milestone')` failed because `JSON.parse(bd show stdout)` returns `[ { id: 'sd-puz', labels: [...] } ]`. Fix: unwrap with `const issue = Array.isArray(shown) ? shown[0] : shown;` before reading labels. (Rule 1 — bug in test code.)
2. **CONF-02 audit: no new fixtures.** ROADMAP §Phase 7 SC#5 enumerates four canonical-input categories (single-line goals, multi-line success criteria, empty values, edge cases per ARCH-03 spec). All four are covered by the existing 11 fixtures (see audit table below). No new fixture file is required; CONF-02 conformance is satisfied by `tests/unit/format-phase.test.mjs` running green over the 11 fixtures (15 tests total: 4 inline + 11 round-trips).

## CONF-02 Audit Table

Mapping the 11 existing `tests/unit/fixtures/phase-format/*.md` fixtures to ROADMAP §Phase 7 SC#5 canonical-input categories:

| # | Category (ROADMAP §Phase 7 SC#5)                     | Existing Fixture(s)                                                                       | Status     |
|---|------------------------------------------------------|-------------------------------------------------------------------------------------------|------------|
| 1 | Single-line goal                                     | phase-1-spike, phase-2-build, phase-5-roadmap, phase-6-cleanup, phase-13-final            | COVERED    |
| 2 | Multi-line success criteria                          | phase-2-build, phase-5-roadmap, phase-6-cleanup, phase-13-final (each has multi-line SC)  | COVERED    |
| 3 | Empty values (Success Criteria header with no items) | empty-success.md                                                                          | COVERED    |
| 4 | Edge cases per ARCH-03 spec                          | decimal-72-1 (decimal phase numbers), depends-nothing ("Nothing" depends_on), requirements-tbd ("TBD" requirements), no-plans-section (no Plans tail), multiline-goal (multi-paragraph goal body) | COVERED    |

Result: 11 fixtures × 15 round-trip tests (4 inline assertions + 11 fixture iterations) all pass under `node --test tests/unit/format-phase.test.mjs`. CONF-02 audit concludes the existing fixtures meet the SC#5 contract; no new fixture file added in this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `bd show <id> --json` returns array, not object**
- **Found during:** Task 1 (foundational-events milestone-resolution test)
- **Issue:** Initial test wrote `const issue = JSON.parse(show.stdout); assert.ok(issue.labels.includes(...))`, but bd v1.0.3 `bd show <id> --json` returns a single-element array `[{...}]`, not a bare object. Test failed with falsy `(issue.labels ?? []).includes('gsd:milestone')`.
- **Fix:** Added `const issue = Array.isArray(shown) ? shown[0] : shown;` unwrap before reading labels. Inline comment documents the bd v1.0.3 behavior.
- **Files modified:** tests/conformance/foundational-events.test.mjs
- **Verification:** Re-running `node --test tests/conformance/foundational-events.test.mjs` passes all 12 tests.
- **Committed in:** `ccf2db4` (Task 1 commit — fixed before initial commit landed)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test-code bug)
**Impact on plan:** Single test-side bug, found and fixed during Task 1 verification. No scope creep, no architectural change. Other 11 tests in Task 1 + all of Tasks 2/3/5 passed on first run against the existing primitive impls (Plans 06/07).

## Issues Encountered

- **Cwd drift between worktree and main during Task 1 commit.** First Task 1 commit attempt landed on `main` instead of the agent worktree branch because of a stale `cd /home/ellio/code/gsd-beads &&` prefix. Recovered by cherry-picking the commit onto the worktree branch (`ccf2db4`) and resetting `main` back to `743f753` (phase-07 base). Subsequent commits (Tasks 2/3/5) used absolute-path operations only, no cross-worktree cd, and landed cleanly on the worktree branch.
- **Pre-existing dirty `tests/fixtures/seed.jsonl`.** The working tree had drift in `tests/fixtures/seed.jsonl` (hash-id regeneration from a prior `build-seed.sh` run) at executor start. Out of scope for Plan 10; left untouched. The drift does NOT affect this plan's tests because `setupFreshAdapter` reads the committed seed.jsonl from disk via `import { resolve } from 'node:path'` + `copyFileSync(SEED, ...)`, and committed-tree content (not working-tree drift) is what gets read at runtime under standard Node imports. Verified by 71-test green run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 6 PRIM-02 foundational primitives (recordStateEvent, putNamedDoc, getNamedDoc, snapshot, restore, writeBinaryAsset) covered by conformance.
- All 10 PRIM-01 Bin A primitives covered by Plan 09's binA-* files (records, section, frontmatter clusters).
- `tests/conformance/run.mjs` driver wired for Phase 13 cross-adapter pairing — `RUN_CROSS_ADAPTER=1` is reserved; uncomment the MarkdownAdapter import path when fork integration ships.
- Phase 7 acceptance gate met: 16 BeadsAdapter primitives real + capabilities flag locked + conformance suite green + format-phase round-trip green. Phase 8 (init bundlers) can begin.

## Self-Check: PASSED

**Files created (verified via existsSync analog):**
- FOUND: tests/conformance/foundational-events.test.mjs
- FOUND: tests/conformance/foundational-namedDoc.test.mjs
- FOUND: tests/conformance/foundational-snapshot.test.mjs

**Commits (verified via git log on worktree branch):**
- FOUND: ccf2db4 — test(07-10): foundational-events
- FOUND: a7dcfad — test(07-10): foundational-namedDoc
- FOUND: 7f4db7a — test(07-10): foundational-snapshot
- FOUND: 35bb42d — feat(07-10): run.mjs FILES list

**Test gates:**
- `node --test tests/conformance/foundational-{events,namedDoc,snapshot}.test.mjs` → 42 pass / 0 fail
- `node --test tests/unit/format-phase.test.mjs` → 15 pass / 0 fail
- `npm run test:conformance` → 71 pass / 0 fail across 7 suites
- `node tests/conformance/run.mjs` (driver path) → 71 pass / 0 fail across 7 suites
- `node --test tests/unit/` (full unit suite) → 179 pass / 0 fail

---
*Phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives*
*Completed: 2026-05-01*
