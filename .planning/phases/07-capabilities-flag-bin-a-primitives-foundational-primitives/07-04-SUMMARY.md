---
phase: "07"
plan: "04"
subsystem: adapter
tags: [primitives, records, atomic-write, disk-routing, bd-routing, wave-2]
requires:
  - src/adapter/pathRouter.mjs (Wave 1 / Plan 01 — routerResolve)
  - src/bd/errors.mjs (Wave 1 / Plan 01 — BeadsEmpty)
  - src/bd/helper.mjs (existing — bd() spawnSync wrapper)
  - src/adapter.mjs (existing — _ensureBd lazy-validation pattern)
  - .planning/phases/07-.../07-CONTEXT.md §D-01 §D-02 §D-04 §D-08 §D-21 (decisions)
  - .planning/phases/07-.../07-RESEARCH.md §"Pattern 1" §"Pattern 3" §"Pitfall 5" §"Pitfall 7"
provides:
  - "src/adapter/_atomicWrite.mjs — atomicWriteFile(absPath, body) tmpfile+rename helper (D-08)"
  - "src/adapter/primitives.mjs — getRecord/putRecord/removeRecord/exists/listCollection real implementations (5 of 16 method bodies replaced)"
affects:
  - "Wave 2 Plan 05 (getSection/updateSection/getFrontmatter/updateFrontmatter/mergeFrontmatter): reuses atomicWriteFile for write-side"
  - "Wave 2 Plan 06/07 (named-doc helpers): reuses disk-routed code path semantics"
  - "Wave 3 conformance harness: exercises these 5 methods against the seed.jsonl fixture"
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "Router-first dispatch: every Bin A method opens with const route = routerResolve(path)"
    - "Atomic file replace: tmpfile (next to target, same fs) + renameSync (POSIX-atomic)"
    - "Recursive parent-dir creation: mkdirSync({recursive:true}) before tmpfile write"
    - "BeadsEmpty catch in exists(): Pitfall 5 mitigation"
    - "Deterministic listCollection sort by phase-id/plan-id labels (D-04)"
    - "TDD: RED commit -> GREEN commit per task (4 atomic commits)"
key-files:
  created:
    - src/adapter/_atomicWrite.mjs
    - tests/unit/atomicWrite.test.mjs
    - tests/unit/primitives-records.smoke.test.mjs
  modified:
    - src/adapter/primitives.mjs
    - tests/unit/adapter-shell.test.mjs  # Rule 1 fix: getRecord -> getSection sample
decisions:
  - "Implemented exactly what plan specified (verbatim code skeletons in <action>) — no design choices needed"
  - "Rule 1 deviation: adapter-shell.test.mjs sampled getRecord (now implemented); swapped to getSection (still-stubbed PRIM-01 method) so the canonical-stub-format test continues to verify remaining 11 stubs"
  - "Followed primitives.mjs cluster method-bag export shape per Phase 6 D-04 — Object.assign on prototype preserves this binding when methods are written as async name(args) {...}"
metrics:
  duration: "~14 minutes wall-clock"
  completed: "2026-05-01T08:34:25Z"
  tasks: 2
  files_created: 3
  files_modified: 2
  test_cases_added: 9  # 4 atomicWrite + 5 primitives-records smoke
  test_cases_total: 146  # full unit suite (was 137 baseline + 9 new)
  commits: 4
---

# Phase 07 Plan 04: capabilities-flag-bin-a-primitives-foundational-primitives — Wave 2 record primitives

Replaced 5 of 16 stub bodies in `src/adapter/primitives.mjs` (`getRecord`, `putRecord`, `removeRecord`, `exists`, `listCollection`) with real router-first implementations, and shipped the `atomicWriteFile` helper that putRecord (Plan 04) and updateSection (Plan 05+) both depend on.

## What Shipped

### `src/adapter/_atomicWrite.mjs` (NEW, 29 lines, 1 named export)

- `atomicWriteFile(absPath, body)` — POSIX-atomic file replace via tmpfile + rename per D-08
  - Tmp filename: `.<basename>.tmp.<pid>.<time>` placed in `dirname(absPath)` (same filesystem — Pitfall 7 mitigation)
  - Recursive parent-dir creation via `mkdirSync(dir, { recursive: true })` so `putRecord` to a fresh `.planning/intel/foo.md` works without pre-existing intel/
  - Pure node:fs / node:path — no third-party deps

### `src/adapter/primitives.mjs` (MODIFIED — 5 stub bodies replaced; 11 remain)

The 5 method bodies replaced; their dispositions:

| Method | Disk-tier | Bd-tier |
|--------|-----------|---------|
| `getRecord(path)` | `existsSync` + `readFileSync(utf-8)`; returns `null` if missing | Single `bd list -l <label> --json -n 0`; returns `items[0]` for singletons (roadmap), throws for multi-record (caller should use listCollection) |
| `putRecord(path, body)` | `atomicWriteFile(_abs, body)` (D-08) | Throws — bd-routed writes are Bin B's domain (Phase 8+) |
| `removeRecord(path)` | `existsSync` guard + `unlinkSync`; idempotent (no throw on missing) | Throws — same boundary as putRecord |
| `exists(path)` | `existsSync(_abs)` | Single `bd list -l <label> --json -n 0`; returns `arr.length > 0`; catches `BeadsEmpty` -> `false` (Pitfall 5) |
| `listCollection(prefix, filter)` | `readdirSync` + filter (function predicate) + `slice().sort()` | `bd list -l <label> --json -n 0` (+ optional second `-l` filter; still 1 spawn); deterministic sort by `phase-id:`/`plan-id:` labels (D-04 / QUAL-06) |

The remaining 11 stubs (`getSection`, `updateSection`, `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter`, `recordStateEvent`, `snapshot`, `restore`, `putNamedDoc`, `getNamedDoc`, `writeBinaryAsset`) preserve their existing `NOT_IMPLEMENTED` calls verbatim (Plans 05/06/07/08 own those replacements).

### `tests/unit/adapter-shell.test.mjs` (MODIFIED — Rule 1 fix)

Sample list for the canonical-stub-format check swapped `['getRecord', '/tmp/foo']` -> `['getSection', '/tmp/foo', 'h']` because `getRecord` is now a real implementation (returns `null` instead of throwing). `getSection` is still a stub (Plan 05 ships its real impl), so it correctly throws the canonical "not implemented (Phase 7 / PRIM-01)" message and keeps the test's intent intact: spot-checking one method per cluster file ensures the cluster-binding plumbing works.

### Test coverage added

| File | New cases | Pattern |
|------|-----------|---------|
| `tests/unit/atomicWrite.test.mjs` | 4 | `mkdtempSync` + `t.after(rmSync)` fixture; tests new file, overwrite, no-leftover-tmp, recursive parent-dir |
| `tests/unit/primitives-records.smoke.test.mjs` | 5 | Disk-routed path round-trips; verifies that `BeadsAdapter` constructor + cluster binding wires the new bodies; no bd setup required |

Full unit suite (`tests/unit/*.test.mjs`): **146 tests pass, 0 fail** (was 137 baseline + 9 new). No regression in any Phase 6 helper, format, or Wave 1 routing test.

## TDD Gate Compliance

This plan's frontmatter is `type: execute` (not `type: tdd`), but each task carried `tdd="true"` and was executed with the standard RED/GREEN cycle:

| Task | RED commit | GREEN commit | Test result |
|------|------------|--------------|-------------|
| 1: atomicWriteFile helper | `ff2f827` test(07-04): add failing tests for atomicWriteFile helper | `50db4a3` feat(07-04): add atomicWriteFile helper for D-08 atomic writes | RED -> ERR_MODULE_NOT_FOUND; GREEN -> 4/4 pass |
| 2: 5 primitives + adapter-shell fix | `a3e7de0` test(07-04): add failing smoke tests for record primitives | `bdfac4f` feat(07-04): implement getRecord/putRecord/removeRecord/exists/listCollection (Bin A subset) | RED -> 5/5 fail with stub message; GREEN -> 9/9 pass + full suite 146/146 |

Both RED gates produced legitimate failing tests before implementation. REFACTOR phase skipped for both tasks — code matches the plan's verbatim skeletons; no cleanup justifies a third commit per task.

## Verification

Per plan `<verification>` block:

| Check | Result |
|-------|--------|
| `node --test tests/unit/atomicWrite.test.mjs tests/unit/primitives-records.smoke.test.mjs` exits 0 | PASS — 9/9 cases pass |
| Full unit suite still green | PASS — 146/146 unit tests pass |
| Cluster binding intact: `typeof new BeadsAdapter('/tmp').getRecord === 'function'` | PASS — `function` |
| 5 of 16 stubs replaced | PASS — `grep -n NOT_IMPLEMENTED src/adapter/primitives.mjs` shows 11 invocations + 1 declaration line (was 16 invocations) |
| `routerResolve` referenced in primitives.mjs | PASS — appears 7x (1 import + 5 method bodies + 1 export-import alias) |
| `atomicWriteFile` referenced in primitives.mjs | PASS — appears 2x (1 import + 1 use in putRecord) |
| `_ensureBd` referenced in primitives.mjs | PASS — appears 5x (one per bd-tier branch + one in exists) |

Plan `<must_haves>.truths` checklist:

- [x] `getRecord` on a disk-routed path returns the file contents as utf-8 string (smoke test: putRecord -> getRecord round-trip equals 'body')
- [x] `getRecord` on a missing path returns null, NOT throws (smoke test 1)
- [x] `putRecord` on a disk-routed path writes via atomic tmpfile + rename — D-08 (atomicWriteFile test 3 verifies no leftover tmp)
- [x] `putRecord` creates parent directories on demand (atomicWriteFile test 4: nested `a/b/c/foo.md` succeeds)
- [x] `removeRecord` on a disk-routed path unlinks the file; missing path is a no-op (smoke test 4 + manual round-trip in smoke test 2)
- [x] `exists` returns false for missing records (smoke test 3 covers disk-routed; bd-routed BeadsEmpty catch is implemented per Pitfall 5 — Wave 4 conformance verifies on real fixture)
- [x] `listCollection('.planning/phases')` returns a deterministically-sorted array (impl uses `_firstSortKey` -> sort by phase-id/plan-id labels; disk fallback uses `slice().sort()`)
- [x] `listCollection` issues at most 2 bd spawns per call (D-21 / QUAL-07) — impl path: single `bd list` call regardless of filter (filter pushes additional `-l` args into the same argv, still 1 spawn)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] adapter-shell.test.mjs sampled getRecord which is now implemented**
- **Found during:** Task 2 GREEN — running full unit suite after replacing primitives bodies
- **Issue:** `tests/unit/adapter-shell.test.mjs:43` had `['getRecord', '/tmp/foo']` in the canonical-stub-format spot-check sample list. With `getRecord` now a real implementation that returns `null` for missing disk-routed paths instead of throwing, `assert.rejects` on it would always fail (the test only had this one sample for the primitives cluster).
- **Fix:** Swapped the sample to `['getSection', '/tmp/foo', 'h']` — `getSection` is a still-stubbed PRIM-01 method (Plan 05 owns its real implementation) so it correctly throws the canonical message and keeps the test's intent intact (spot-checking one method per cluster file).
- **Files modified:** tests/unit/adapter-shell.test.mjs
- **Commit:** `bdfac4f` (combined with primitives implementation since the change is required for the feat commit to leave the suite green)

No other deviations. The plan was unusually prescriptive (verbatim code skeletons in `<action>` for both tasks), so no auto-fix rules fired and no architectural decisions surfaced.

## Threat Model Status

Plan's `<threat_model>` had three entries; this plan's outcome:

| Threat ID | Disposition (plan) | Outcome |
|-----------|--------------------|---------|
| T-7-01 (path traversal in disk-routed `getRecord`) | accept (low-risk in this consumer model) | Accepted as planned. `_abs(adapter, path)` uses `node:path.resolve(this.projectRoot, path)` which collapses `..` segments deterministically; a malicious caller could escape `projectRoot`. No new mitigation added — single-developer + Claude single-process trust model. v1.1 may add `path.normalize` + `startsWith(projectRoot)` guard if surface widens. |
| T-7-10 (DoS via huge bd output) | accept | Accepted as planned. bd's JSON output is bounded by project bead count; conformance fixture has ~30 issues, production projects <1000. |
| T-7-11 (TOCTOU on putRecord) | mitigate | Mitigated via atomicWriteFile: tmpfile placed next to target via `dirname(absPath)`, rename(2) is POSIX-atomic on the same filesystem (Pitfall 7). Test 3 of atomicWrite verifies no leftover tmp on success. |

No new threats discovered during implementation.

## Threat Surface Scan (post-impl)

No new security-relevant surface introduced beyond what the plan's `<threat_model>` already documented. The 5 methods consume repo-relative path strings already accepted by the public adapter contract; bd spawns flow through the existing `bd()` wrapper (no new injection surface). No new endpoints, auth paths, or schema changes.

## Known Stubs

The remaining 11 stubs in `primitives.mjs` are intentionally preserved for downstream plans:

| Method | Owner |
|--------|-------|
| `getSection`, `updateSection`, `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter` | Plan 05 (PRIM-01 section + frontmatter subset) |
| `recordStateEvent`, `snapshot`, `restore`, `putNamedDoc`, `getNamedDoc` | Plans 06/07 (PRIM-02 foundational primitives) |
| `writeBinaryAsset` | Plan 06/07 (capabilities-flag sentinel — throws `UnsupportedOperationError` per D-16) |

Each stub still throws the canonical `BeadsAdapter.<name>: not implemented (Phase 7 / (PRIM-01|PRIM-02))` message verified by `tests/unit/adapter-shell.test.mjs` (now using `getSection` as the primitives-cluster sample).

## Commits (chronological)

| # | Hash | Type | Subject |
|---|------|------|---------|
| 1 | `ff2f827` | test | `test(07-04): add failing tests for atomicWriteFile helper` |
| 2 | `50db4a3` | feat | `feat(07-04): add atomicWriteFile helper for D-08 atomic writes` |
| 3 | `a3e7de0` | test | `test(07-04): add failing smoke tests for record primitives` |
| 4 | `bdfac4f` | feat | `feat(07-04): implement getRecord/putRecord/removeRecord/exists/listCollection (Bin A subset)` |

## What's Next (handoff to Wave 2 Plan 05 + Wave 4 conformance)

**Wave 2 Plan 05** (section + frontmatter primitives) can now import:

```javascript
import { resolve as routerResolve } from './pathRouter.mjs';
import { atomicWriteFile } from './_atomicWrite.mjs';
```

The `_atomicWrite.mjs` helper is the canonical write-side primitive — `updateSection`, `updateFrontmatter`, `mergeFrontmatter`, and `putNamedDoc` will all reuse it.

**Wave 4 conformance harness** is the canonical verification surface for the bd-routed branches of these 5 methods. The smoke tests in this plan only exercise disk-routed paths (no bd setup required); conformance will exercise the full bd flow against `tests/fixtures/seed.jsonl`.

## Self-Check: PASSED

Verified post-write:

```
$ [ -f src/adapter/_atomicWrite.mjs ] && echo FOUND
FOUND
$ [ -f tests/unit/atomicWrite.test.mjs ] && echo FOUND
FOUND
$ [ -f tests/unit/primitives-records.smoke.test.mjs ] && echo FOUND
FOUND
$ git log --oneline | grep -E "ff2f827|50db4a3|a3e7de0|bdfac4f"
bdfac4f feat(07-04): implement getRecord/putRecord/removeRecord/exists/listCollection (Bin A subset)
a3e7de0 test(07-04): add failing smoke tests for record primitives
50db4a3 feat(07-04): add atomicWriteFile helper for D-08 atomic writes
ff2f827 test(07-04): add failing tests for atomicWriteFile helper
```

All 4 commits exist; all 3 new files exist; both modified files have the expected new content.
