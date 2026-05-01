---
phase: 06-cleanup-adapter-library-scaffolding
plan: 01
subsystem: testing
tags: [node-test, node-assert, scaffolding, structural-tests, archive]

# Dependency graph
requires:
  - phase: 05-pivot-decision
    provides: D-2026-04-30-01 pivot to adapter-library; the v0.2 shadow architecture must be archived (not deleted) so carry-forward primitives survive with git history.
provides:
  - 6 new node:test files under tests/unit/ that codify CLEAN-01..04, ARCH-01..05, DOC-01..02 verification ahead of any source code
  - archive/v0.2-shadow/ directory tree with a written README and 4 subdirs (bin/, hooks/, scripts/, tests/) ready to receive Wave 1 git mv operations
  - tests/conformance/.gitkeep permanent placeholder for Phase 7
  - tests/unit/fixtures/phase-format/.gitkeep placeholder for Plan 05 fixtures
affects:
  - 06-02 (cleanup move/delete) — structural-cleanup.test.mjs is its gate
  - 06-04 (extract carry-forward) — structural-imports.test.mjs is its gate
  - 06-05 (format/phase + fixtures) — format-phase.test.mjs is its gate
  - 06-06 (BeadsAdapter shell) — adapter-shell.test.mjs is its gate
  - 06-07 (package.json + docs rewrite) — package-json-shape.test.mjs + docs-content.test.mjs are its gates
  - phase 7 (conformance suite) — tests/conformance/ now exists in git

# Tech tracking
tech-stack:
  added: [node:test (Node 20+ built-in), node:assert/strict]
  patterns:
    - "Wave 0 / Nyquist sampling — write the verifier BEFORE the implementation; tests start red and turn green as later waves land"
    - "Dynamic await import(...) in tests so the test file parses even when the target module does not exist yet"
    - ".gitkeep placeholders for empty-but-tracked directories"
    - "Archive-instead-of-delete preserves git log --follow for carry-forward primitives"

key-files:
  created:
    - tests/unit/structural-cleanup.test.mjs
    - tests/unit/structural-imports.test.mjs
    - tests/unit/format-phase.test.mjs
    - tests/unit/adapter-shell.test.mjs
    - tests/unit/package-json-shape.test.mjs
    - tests/unit/docs-content.test.mjs
    - tests/unit/.gitkeep
    - tests/unit/fixtures/phase-format/.gitkeep
    - tests/conformance/.gitkeep
    - archive/v0.2-shadow/README.md
    - archive/v0.2-shadow/bin/.gitkeep
    - archive/v0.2-shadow/hooks/.gitkeep
    - archive/v0.2-shadow/scripts/.gitkeep
    - archive/v0.2-shadow/tests/.gitkeep
    - archive/v0.2-shadow/tests/shadow-tests/.gitkeep
    - archive/v0.2-shadow/tests/scripts/.gitkeep
  modified: []

key-decisions:
  - "Used dynamic await import() for src/ references so test files parse cleanly even before Wave 1+ creates the source modules — avoids the trap of static imports that would fail at parse time"
  - "Embedded the canonical stub-message regex `/^BeadsAdapter\\.\\w+: not implemented \\(Phase \\d+ \\/ (PRIM|IMPL)-\\d+\\)$/` directly in adapter-shell.test.mjs so the contract is single-sourced"
  - "format-phase.test.mjs uses an existsSync(FIXTURE_DIR) guard with a SKIP-equivalent test so it parses and runs even before Plan 05 populates fixtures"
  - "Fixed a quoting bug in the plan's verbatim test code (`Object.freeze\\'d` would not have parsed) — used a double-quoted string instead. Logged as Rule 1 deviation below."

patterns-established:
  - "Wave 0 (test scaffolding) precedes Waves 1-3 (implementation). Each Wave 1+ plan has its automated gate already on disk before it runs."
  - "Archive subdirs use .gitkeep placeholders; later waves' git mv operations land their source files alongside (or replace) the placeholders."
  - "Test files isolated to tests/unit/ — repo's existing tests/ subdirs (e2e, hook-tests, install-tests, etc.) are untouched and will be archived in 06-02."

requirements-completed: [TEST-01]

# Metrics
duration: 3min
completed: 2026-05-01
---

# Phase 6 Plan 01: Wave 0 — Test scaffolding Summary

**6 node:test files + archive/v0.2-shadow/ tree + conformance/ placeholder created BEFORE any source moves; every downstream Wave 1-3 plan now has its automated gate on disk and red-by-design.**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-05-01T02:11Z
- **Tasks:** 8
- **Files created:** 16 (6 test files + 7 .gitkeep placeholders + 1 README + 2 directory placeholders already counted)

## Accomplishments

- Wave 0 validation harness laid down: 5 + 8 + 5 + 6 + 7 + 8 = **39 test assertions across 6 files** ready to verify Waves 1-3
- archive/v0.2-shadow/ tree with verbatim README from RESEARCH.md §8 — Wave 1 has destinations for `git mv`
- tests/conformance/.gitkeep permanent placeholder lets Phase 7 populate without git noise
- tests/unit/fixtures/phase-format/.gitkeep placeholder marks where Plan 05 will land 11 round-trip fixtures
- All 6 test files parse cleanly under `node --check`
- Smoke-run confirmed tests are red for the right reason (assertion failures, ERR_MODULE_NOT_FOUND for src/ imports) — never syntax errors

## Task Commits

This plan will be committed atomically (single commit) via `gsd-sdk query commit` at the end of execution. Tasks 1-8 produce one logical artifact (the Wave 0 harness); per-task commits would fragment the scaffold across an unnaturally fine granularity. See "Files Created/Modified" for the full set.

## Files Created/Modified

### Test files (6)

| File | Tests | Covers | Will turn green after |
|------|-------|--------|----------------------|
| `tests/unit/structural-cleanup.test.mjs` | 5 | CLEAN-01..04 + D-12 REQUIREMENTS.md wording | Plans 06-02 + 06-07 |
| `tests/unit/structural-imports.test.mjs` | 8 | ARCH-01 (src/bd/), ARCH-02 (src/helpers/) | Plan 06-04 |
| `tests/unit/format-phase.test.mjs` | 4 inline + N fixture (currently 1 SKIP) | ARCH-03 round-trip per D-15 idempotency | Plan 06-05 |
| `tests/unit/adapter-shell.test.mjs` | 6 | ARCH-04 BeadsAdapter ctor + capabilities + stub regex | Plan 06-06 |
| `tests/unit/package-json-shape.test.mjs` | 7 | ARCH-05 / D-06..D-09 package shape | Plan 06-07 |
| `tests/unit/docs-content.test.mjs` | 8 | DOC-01 (README) + DOC-02 (CLAUDE.md) + CONTRIBUTING.md (D-06) | Plan 06-07 |

### Archive scaffolding

- `archive/v0.2-shadow/README.md` — 41-line verbatim copy from RESEARCH.md §8 lines 1017-1057, including the D-2026-04-30-01 + SYNTHESIS.md references and the carry-forward bullet list
- `archive/v0.2-shadow/bin/.gitkeep`
- `archive/v0.2-shadow/hooks/.gitkeep`
- `archive/v0.2-shadow/scripts/.gitkeep`
- `archive/v0.2-shadow/tests/.gitkeep`
- `archive/v0.2-shadow/tests/shadow-tests/.gitkeep`
- `archive/v0.2-shadow/tests/scripts/.gitkeep`

### Test directory placeholders

- `tests/unit/.gitkeep` (will become redundant after Wave 0; harmless)
- `tests/unit/fixtures/phase-format/.gitkeep` (replaced by Plan 05's 11 fixtures)
- `tests/conformance/.gitkeep` (permanent — Phase 7 populates the directory)

## Decisions Made

- **Dynamic vs static imports in tests** — Used `await import('../../src/...')` everywhere a target module does not exist yet, so the test file's `node --check` passes at Wave 0 and the failure mode is `ERR_MODULE_NOT_FOUND` at runtime (red-but-wired) rather than parse error.
- **Inline canonical stub regex** — Embedded `/^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/` directly in `adapter-shell.test.mjs` per the plan's `<interfaces>` block. Plan 06-06 must produce errors matching this exact shape.
- **existsSync(FIXTURE_DIR) guard** — `format-phase.test.mjs` checks for the fixture directory and emits a SKIP-equivalent assertion if absent. This means the file works at Wave 0 (fixtures absent), Wave 2 (Plan 05 lands 11 fixtures), and beyond — no edits required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unparseable string literal in adapter-shell.test.mjs verbatim block**
- **Found during:** Task 6 (adapter-shell.test.mjs creation)
- **Issue:** Plan's verbatim code block contained `assert.ok(Object.isFrozen(BeadsAdapter.capabilities), 'BeadsAdapter.capabilities must be Object.freeze\\'d');` — the `\\'` inside a single-quoted string literal would not have parsed under `node --check` (unexpected token after the apostrophe terminates the string).
- **Fix:** Switched the outer quoting to double quotes: `"BeadsAdapter.capabilities must be Object.freeze'd"`. The error message text is preserved verbatim; only the string-delimiter strategy changed.
- **Files modified:** `tests/unit/adapter-shell.test.mjs`
- **Verification:** `node --check tests/unit/adapter-shell.test.mjs` returns 0; `node --test` runs all 6 tests and reports `ERR_MODULE_NOT_FOUND` for `src/adapter.mjs` (red for the right reason).
- **Committed in:** Wave 0 plan-level commit

---

**Total deviations:** 1 auto-fixed (1 syntax bug in plan's verbatim code block)
**Impact on plan:** Negligible. The fix preserves the assertion's intent and error message; only the JS string-delimiter strategy changed. No scope creep.

## Issues Encountered

None. The plan's `<read_first>` references were precise and the verbatim README content from RESEARCH.md §8 was reproducible without ambiguity.

## User Setup Required

None.

## Next Phase Readiness

**Wave 1 (06-02 cleanup-cluster) ready to start:**

- Has `archive/v0.2-shadow/{bin,hooks,scripts,tests}/` destinations for `git mv`
- Has `tests/unit/structural-cleanup.test.mjs` ready to flip from red to green as files move
- The `.gitkeep` files in archive subdirs are harmless; Wave 1 plans can leave them or `git rm` them once the subdir has real content

**Wave 2 plans (06-04, 06-05) ready to start:**

- `tests/unit/structural-imports.test.mjs` will gate Plan 06-04 (carry-forward extraction)
- `tests/unit/format-phase.test.mjs` will gate Plan 06-05 (format/phase + 11 fixtures); the SKIP branch fires once and the fixture-loop tests appear automatically when Plan 05 populates the fixture directory

**Wave 3 plans (06-06, 06-07) ready to start:**

- `tests/unit/adapter-shell.test.mjs` will gate Plan 06-06 (BeadsAdapter shell)
- `tests/unit/package-json-shape.test.mjs` + `tests/unit/docs-content.test.mjs` will gate Plan 06-07 (package.json + README + CLAUDE.md + CONTRIBUTING.md)

**No blockers carry forward.**

## Self-Check: PASSED

Verified:
- All 16 listed key-files exist at the documented paths
- All 6 test files pass `node --check` (no syntax errors)
- `archive/v0.2-shadow/README.md` contains the required phrases (`Archive: v0.2 shadow architecture`, `D-2026-04-30-01`, `spike findings`, `scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh`, `Do not link, import, or run anything from this directory`)
- `tests/conformance/.gitkeep` exists
- `tests/unit/fixtures/phase-format/.gitkeep` exists
- Smoke-run of `node --test tests/unit/structural-cleanup.test.mjs` produces assertion failures (red for the right reason)
- Smoke-run of `node --test tests/unit/adapter-shell.test.mjs` produces `ERR_MODULE_NOT_FOUND` (red for the right reason — module absence, not syntax error)

---
*Phase: 06-cleanup-adapter-library-scaffolding*
*Plan: 01-wave0-test-scaffolding*
*Completed: 2026-05-01*
