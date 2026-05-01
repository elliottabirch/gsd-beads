---
phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives
plan: 03
subsystem: format
tags: [yaml, frontmatter, parser, formatter, esm, no-deps]

# Dependency graph
requires:
  - phase: 06-cleanup-and-adapter-library-scaffolding
    provides: src/format/ directory with phase.mjs (module-shape analog)
provides:
  - parseFrontmatter(text) — flat-scalar YAML parser (string/number/boolean/null + flat string lists)
  - formatFrontmatter(fm, body) — round-trippable formatter (empty fm short-circuits to body verbatim)
  - mergeFrontmatter(base, patch) — shallow merge with null/undefined tolerance
affects:
  - Phase 7 Wave 2 disk-routed primitives (getFrontmatter / updateFrontmatter / mergeFrontmatter consumers in src/adapter/primitives.mjs)
  - Phase 7 Wave 4 conformance lint (must escalate on nested-frontmatter discovery)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled flat-scalar YAML — no gray-matter / js-yaml / kind-of dep (RESEARCH §Standard Stack)"
    - "Module-shape mirrors src/format/phase.mjs: file-header comment, regex-constants-at-top, JSDoc per export, no imports"
    - "Anchored regex (^---\\n…\\n---\\n?) with non-greedy [\\s\\S]*? body capture — bounded backtracking, ReDoS-safe"

key-files:
  created:
    - src/format/frontmatter.mjs (106 lines, 3 named exports, 0 imports)
    - tests/unit/format-frontmatter.test.mjs (11 behavior tests)
  modified: []

key-decisions:
  - "Hand-roll the parser per RESEARCH §Standard Stack (gray-matter rejected — 8 transitive deps for a flat-scalar schema)"
  - "Schema deliberately limited to flat scalars + flat string lists; nested frontmatter is an escalation signal (Wave 4 conformance lint enforces)"
  - "formatFrontmatter on empty fm returns body verbatim (no `---` block) — keeps callers' empty-state semantics simple"

patterns-established:
  - "TDD RED→GREEN gate: failing tests committed first (73b70f4), implementation next (ce5f7a3)"
  - "Single FRONTMATTER_RE regex captures both `\\n---\\n` and `\\n---\\n\\n` terminators via [\\s\\S]*? + \\n?"

requirements-completed: [PRIM-01]

# Metrics
duration: 4min
completed: 2026-05-01
---

# Phase 07 Plan 03: Flat-scalar YAML frontmatter primitives Summary

**Hand-rolled `parseFrontmatter` / `formatFrontmatter` / `mergeFrontmatter` (3 exports, 106 lines, zero deps) backing Wave 2 disk-routed `getFrontmatter`/`updateFrontmatter`/`mergeFrontmatter` per D-03.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-01T07:59:28Z
- **Completed:** 2026-05-01T08:03:42Z
- **Tasks:** 1 (TDD: RED + GREEN; no refactor needed)
- **Files modified:** 2 (both new)

## Accomplishments

- `src/format/frontmatter.mjs` exports the three D-03 primitives with no npm deps
- `tests/unit/format-frontmatter.test.mjs` covers all 11 behaviors from the plan (scalar parse, list parse, quoted-string unwrap, null/empty/false coercion, no-delimiter passthrough, scalar/list round-trip, empty-fm short-circuit, shallow-merge incl. undefined-patch + null-base)
- Full unit suite (50 tests across format + helpers) green; no regressions to format-phase or other helper tests
- ESM resolution verified: `parseFrontmatter`, `formatFrontmatter`, `mergeFrontmatter` all `typeof === 'function'`

## Task Commits

Each step committed atomically:

1. **Task 1 RED — failing tests** — `73b70f4` (test)
2. **Task 1 GREEN — implementation** — `ce5f7a3` (feat)

_TDD: RED gate confirmed via `ERR_MODULE_NOT_FOUND` on all 11 tests; GREEN gate confirmed by 11/11 pass + 50/50 unit-suite pass._

## Files Created/Modified

- `src/format/frontmatter.mjs` — flat-scalar YAML parser/formatter/merger (D-03 disk-routed primitives)
- `tests/unit/format-frontmatter.test.mjs` — 11 behavior tests covering parse/format/merge contracts

## Decisions Made

- Followed RESEARCH §"Standard Stack" — rejected gray-matter (8 transitive deps for a flat-scalar schema is unjustified weight)
- Module shape mirrors `src/format/phase.mjs`: header comment + regex-constants-at-top + JSDoc per export + zero imports
- `formatFrontmatter({}, body)` returns `body` verbatim (no `---` emission) — matches the "no frontmatter" disk shape exactly so a parse→format→parse round-trip on a plain markdown file is identity

## Deviations from Plan

### Minor done-criteria miss (non-blocking, plan-driven)

Plan done-criteria says `file is <= 100 lines`; final file is **106 lines** — a 6-line overshoot.

- **Cause:** the plan instructed "paste verbatim" the code in `<action>`, and the verbatim block (including header comment + JSDoc + blank lines + closing newline) is itself 106 lines. The line cap and the verbatim spec are mutually inconsistent in the plan as written.
- **Disposition:** Kept the verbatim content per the plan's primary directive ("paste verbatim"). All other done criteria pass: 3 `export function` matches, 2 `FRONTMATTER_RE` references, 0 imports, full unit suite green.
- **Files modified:** none (informational only)
- **Committed in:** ce5f7a3 (the GREEN feat commit; nothing to fix)

No Rule 1/2/3 auto-fixes were needed; the verbatim spec compiled and passed all 11 behavior tests on first run.

---

**Total deviations:** 0 auto-fixes; 1 documentation note (line-count vs. verbatim-spec inconsistency).
**Impact on plan:** None. All 11 must-have truths and all artifact contracts satisfied.

## Issues Encountered

- `node --test tests/unit/` (directory form) errors with `MODULE_NOT_FOUND` because Node 24 treats the bare `tests/unit/` argument as a single test file, not a directory glob. Worked around by passing explicit file globs / individual test files. This is a tooling quirk, not a regression — a future plan may want to add an `npm test` script that uses `node --test 'tests/unit/*.test.mjs'`.

## User Setup Required

None — pure-JS module with zero dependencies.

## Next Phase Readiness

- Wave 2 (`src/adapter/primitives.mjs`) can now import `parseFrontmatter` / `formatFrontmatter` from `../format/frontmatter.mjs` per the artifact key_links contract
- Wave 4 conformance lint should enumerate all `.planning/**/*.md` files, parse with `parseFrontmatter`, and assert no nested-object shapes survive (escalation signal per RESEARCH §Pitfall)
- No blockers; threat register T-7-07/T-7-08/T-7-09 dispositions all hold (anchored regex, deterministic coerce, single-level kv match)

## TDD Gate Compliance

- RED gate (`test(...)` commit): `73b70f4` — 11 tests failed with `ERR_MODULE_NOT_FOUND` before implementation existed.
- GREEN gate (`feat(...)` commit): `ce5f7a3` — 11 tests pass; full unit suite (50 tests) green.
- REFACTOR gate: skipped (file is already in canonical shape per plan's verbatim spec; no clean-up changes needed).

## Self-Check: PASSED

- `src/format/frontmatter.mjs` — FOUND
- `tests/unit/format-frontmatter.test.mjs` — FOUND
- Commit `73b70f4` (RED) — FOUND in git log
- Commit `ce5f7a3` (GREEN) — FOUND in git log
- All 11 frontmatter tests pass; full unit suite green; ESM exports verified

---
*Phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives*
*Plan: 03*
*Completed: 2026-05-01*
