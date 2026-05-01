---
phase: "07"
plan: "01"
subsystem: adapter
tags: [routing, errors, primitives, foundation, wave-1]
requires:
  - src/bd/errors.mjs (existing BeadsUnavailableError + 4 cause subtypes)
  - src/format/phase.mjs (module-shape analog: header comment + regex constants + JSDoc on exports)
  - .planning/phases/07-.../07-CONTEXT.md §D-01 §D-10 §D-16 (decisions)
  - .planning/phases/07-.../07-RESEARCH.md §"Pattern 1: Closed-enum router" §"UnsupportedOperationError class"
provides:
  - "src/adapter/pathRouter.mjs — resolve(path) shape-descriptor router + NAMED_DOC_CATEGORIES enum"
  - "src/bd/errors.mjs — UnsupportedOperationError class + BeadsCause.Unsupported entry"
affects:
  - "Wave 2 primitives (07-02..07-05): import { resolve } from '../adapter/pathRouter.mjs'"
  - "Wave 3 writeBinaryAsset (07-06): import { UnsupportedOperationError } from '../bd/errors.mjs'"
  - "Conformance harness (07-09/07-10): asserts D-16 byte-equal throw-message format"
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "Closed-enum routing registry (PATTERNS array of {test, shape}) per D-01"
    - "Anchored regex with bounded char classes (no ReDoS) per T-7-03 disposition"
    - "Object.freeze on enum + dispatch table — mutation-resistant"
    - "TDD: RED commit → GREEN commit per task (4 atomic commits)"
key-files:
  created:
    - src/adapter/pathRouter.mjs
    - tests/unit/pathRouter.test.mjs
  modified:
    - src/bd/errors.mjs
    - tests/unit/beads-errors.test.mjs
decisions:
  - "Implemented exactly what plan specified — no design choices needed (all locked by D-01/D-10/D-16)"
  - "Followed format/phase.mjs module shape: header comment block + regex constants at top + JSDoc on every named export"
metrics:
  duration: "~25 minutes wall-clock"
  completed: "2026-05-01T08:05:56Z"
  tasks: 2
  files_created: 2
  files_modified: 2
  test_cases_added: 18  # 6 new in beads-errors + 12 new in pathRouter
  test_cases_total: 22  # full suite for these two files (4 existing + 18 new)
  commits: 4
---

# Phase 07 Plan 01: capabilities-flag-bin-a-primitives-foundational-primitives — Wave 1 routing spine + UnsupportedOperationError

Landed the routing spine (`src/adapter/pathRouter.mjs`) and the `writeBinaryAsset` sentinel (`UnsupportedOperationError`) that every Wave 2/3 primitive in Phase 07 depends on — pure functions and an error class only, zero I/O, zero bd shell-out.

## What Shipped

### `src/adapter/pathRouter.mjs` (NEW, 97 lines, 2 named exports)

- `resolve(path)` — closed-enum router returning shape descriptors for the 7 documented kinds:
  - `{kind:'roadmap', tier:'bd', label:'gsd:roadmap', singleton:true}` for `.planning/ROADMAP.md`
  - `{kind:'requirements', tier:'bd', label:'gsd:requirement'}` for `.planning/REQUIREMENTS.md`
  - `{kind:'plan', tier:'disk', phase, plan}` for `.planning/phases/NN-slug/NN-XX-PLAN.md` (disk-routed per REQ-07)
  - `{kind:'phase'|'todo'|'seed', tier:'bd', label, collection:true}` for `.planning/phases` / `.planning/todos/*` / `.planning/seeds/*`
  - `{kind:'namedDoc', tier:'hybrid', category, key}` for the 9-category D-10 allowlist
  - Falls through to `{kind:'opaque', tier:'disk'}` for any non-match
- `NAMED_DOC_CATEGORIES` — frozen 9-element array (D-10 closed allowlist): `intel`, `codebase`, `research`, `archived-milestone`, `debug-knowledge-base`, `learnings`, `methodology`, `discussion-log`, `discovery`
- Throws `TypeError` on empty/null input (D-02 contract)
- `PATTERNS` array is `Object.freeze`'d; `NAMED_DOC_RE` and `PLAN_RE` are anchored with bounded char classes (no ReDoS — T-7-03 mitigation)

### `src/bd/errors.mjs` (MODIFIED — 1 enum entry + 1 class added)

- `BeadsCause.Unsupported = 'unsupported'` appended to the frozen enum (existing 5 entries preserved in order)
- `UnsupportedOperationError extends BeadsUnavailableError` — sole sentinel `writeBinaryAsset` will throw in Wave 3
  - Constructor `(method, flag, hint = '')` produces D-16 locked message format byte-for-byte:
    `"BeadsAdapter.<method>: not supported (capabilities.<flag>=false)[. <hint>]"` (no trailing space when hint absent — verified by CASE 9)
  - Sets `.name`, `.method`, `.flag` for structured introspection (conformance harness reads these per D-16)

### Test coverage added

| File | New cases | Total | Pattern |
|------|-----------|-------|---------|
| `tests/unit/beads-errors.test.mjs` | 6 (CASE 5-10) | 10 | `node:test` + `assert.deepEqual`/`assert.equal`, mirrors existing CASE 1-4 |
| `tests/unit/pathRouter.test.mjs` | 12 | 12 | dynamic `await import()` + `assert.deepEqual`, mirrors `format-phase.test.mjs` |

Full unit suite (`tests/unit/**/*.test.mjs`): **109 tests pass, 0 fail** — no regression in any Phase 6 helper, format, or structural-cleanup test.

## TDD Gate Compliance

This plan's frontmatter is `type: execute` (not `type: tdd`), but each task carried `tdd="true"` and was executed with the standard RED/GREEN cycle:

| Task | RED commit | GREEN commit | Test result |
|------|------------|--------------|-------------|
| 1: UnsupportedOperationError | `dd3761d` test(07-01): add failing tests for UnsupportedOperationError... | `3908b15` feat(07-01): add UnsupportedOperationError + BeadsCause.Unsupported | RED → 1 module-load fail; GREEN → 10/10 pass |
| 2: pathRouter | `c30e805` test(07-01): add failing pathRouter tests for closed-enum routing | `15931a2` feat(07-01): add pathRouter.mjs closed-enum routing registry (D-01) | RED → ERR_MODULE_NOT_FOUND; GREEN → 12/12 pass |

Both RED gates produced legitimate failing tests before implementation; both GREEN commits passed without iteration.

REFACTOR phase skipped for both tasks — code is minimal and matches the plan's verbatim skeletons; no cleanup justifies a third commit per task.

## Verification

Per plan `<verification>` block:

| Check | Result |
|-------|--------|
| `node --test tests/unit/beads-errors.test.mjs tests/unit/pathRouter.test.mjs` exits 0 | PASS — 22/22 cases pass |
| Full unit suite still green | PASS — 109/109 unit tests pass; no regression in CASE 1-4 of beads-errors or any helper test |
| `grep -rn "UnsupportedOperationError\|NAMED_DOC_CATEGORIES" src/` shows 2 source files | PASS — `src/bd/errors.mjs` and `src/adapter/pathRouter.mjs` |
| ESM imports of `src/bd/errors.mjs` lists 7 exports | PASS — `BeadsCause,BeadsCorrupt,BeadsEmpty,BeadsNotInstalled,BeadsUnavailableError,BeadsVersionMismatch,UnsupportedOperationError` |
| `node -e "import('./src/adapter/pathRouter.mjs').then(...)"` outputs `function 9` | PASS |
| `pathRouter.mjs` ≤ 100 lines | PASS — 97 lines |

Plan `<must_haves>.truths` checklist:

- [x] `pathRouter.resolve('.planning/ROADMAP.md')` returns `{kind:'roadmap', tier:'bd', ...}` (CASE 1)
- [x] `pathRouter.resolve('.planning/intel/foo.md')` returns `{kind:'namedDoc', tier:'hybrid', category:'intel', key:'foo'}` (CASE 4)
- [x] `pathRouter.resolve('docs/random.md')` returns `{kind:'opaque', tier:'disk'}` (CASE 7 — outside .planning/)
- [x] `NAMED_DOC_CATEGORIES` is frozen and contains all 9 categories from D-10 (CASE 12)
- [x] `UnsupportedOperationError` extends `BeadsUnavailableError`; cause is `BeadsCause.Unsupported` (CASE 5)
- [x] `BeadsCause` includes `'Unsupported'` enum entry while all existing entries are preserved (CASE 6 + manual diff)
- [x] D-02: pathRouter callers pass repo-relative path strings; `resolve()` does not require absolute paths (no `path.resolve`/`projectRoot` coupling — verified by inspection)

## Deviations from Plan

None — plan executed exactly as written.

The plan was unusually prescriptive (verbatim code skeletons + locked interfaces in `<must_haves>`), so no auto-fix rules fired and no architectural decisions surfaced.

Note: The plan's `<verify>` block claimed "16 total test cases passing (10 errors + 12 pathRouter — but reduced to 16 distinct after removing duplicate count)" — that arithmetic appears to be a typo in the plan; the actual count is 22 tests across the two files (10 + 12 = 22, all distinct). All 22 pass.

## Threat Model Status

Plan's `<threat_model>` had three entries; this plan's outcome:

| Threat ID | Disposition (plan) | Outcome |
|-----------|--------------------|---------|
| T-7-01 (path traversal in disk-routed `getRecord`) | mitigate (deferred to Wave 2) | Deferred as planned. `resolve('../../etc/passwd')` correctly returns `{kind:'opaque', tier:'disk'}` (manually verified post-impl). Wave 2 plans will add `path.normalize` + `startsWith(projectRoot)` guards in `getRecord`/`putRecord`. |
| T-7-02 (injection in error message) | accept | Accepted as planned. No user input flows into the message; constructor takes only adapter-source-code values. CASE 8 verifies byte-equal locked format. |
| T-7-03 (ReDoS in regexes) | accept | Accepted as planned. `PLAN_RE` and `NAMED_DOC_RE` are anchored (`^...$`) with bounded char classes, no nested quantifiers. CASE 6 (negative path: `.planning/random-cat/foo.md`) verifies opaque fallback in O(n). |

No new threats discovered during implementation.

## Threat Surface Scan (post-impl)

No new security-relevant surface introduced beyond what the plan's `<threat_model>` already documented. The router is a pure function (no fs, no spawn, no network); the error class is a constant-string formatter. No new endpoints, auth paths, file access, or schema changes.

## Known Stubs

None — `pathRouter.resolve` is fully wired and returns real shape descriptors for all 7 documented kinds plus opaque fallback. `UnsupportedOperationError` is fully functional; the only "stub-like" aspect is that no Wave 3 caller imports it yet — but that's expected for a Wave 1 plan whose explicit purpose is to provide the import target.

## Commits (chronological)

| # | Hash | Type | Subject |
|---|------|------|---------|
| 1 | `dd3761d` | test | `test(07-01): add failing tests for UnsupportedOperationError + Unsupported cause` |
| 2 | `3908b15` | feat | `feat(07-01): add UnsupportedOperationError + BeadsCause.Unsupported` |
| 3 | `c30e805` | test | `test(07-01): add failing pathRouter tests for closed-enum routing` |
| 4 | `15931a2` | feat | `feat(07-01): add pathRouter.mjs closed-enum routing registry (D-01)` |

## What's Next (handoff to Wave 2/3)

Wave 2 primitives (`src/adapter/primitives.mjs`) can now import:

```javascript
import { resolve as routerResolve, NAMED_DOC_CATEGORIES } from './pathRouter.mjs';
```

Per plan `<must_haves>.key_links`, the expected import patterns are:
- Wave 2 (`07-02..07-05`): `from\s+['"].\/pathRouter\.mjs['"]`
- Wave 3 (`07-06`, writeBinaryAsset): `UnsupportedOperationError` from `'../bd/errors.mjs'`

Wave 2 executors must add the deferred T-7-01 mitigation (path-traversal guard) to disk-routed handlers — the router itself returns `opaque/disk` for traversal attempts, and the disk handler is the place to enforce the boundary.

## Self-Check: PASSED

Verified post-write:

```
$ [ -f src/adapter/pathRouter.mjs ] && echo FOUND
FOUND
$ [ -f tests/unit/pathRouter.test.mjs ] && echo FOUND
FOUND
$ git log --oneline | grep -E "dd3761d|3908b15|c30e805|15931a2"
15931a2 feat(07-01): add pathRouter.mjs closed-enum routing registry (D-01)
c30e805 test(07-01): add failing pathRouter tests for closed-enum routing
3908b15 feat(07-01): add UnsupportedOperationError + BeadsCause.Unsupported
dd3761d test(07-01): add failing tests for UnsupportedOperationError + Unsupported cause
```

All 4 commits exist; both new files exist; both modified files have the expected new exports.
