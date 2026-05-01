---
phase: 6
plan: 06
subsystem: adapter
tags: [adapter-shell, cluster-binding, stub-methods, ARCH-04, BeadsAdapter, capabilities]
requires:
  - tests/unit/adapter-shell.test.mjs (Wave 0 driver from Plan 01)
  - src/bd/findRoot.mjs (findBeadsRoot, from Plan 04)
  - src/bd/errors.mjs (BeadsEmpty, from prior phases)
provides:
  - src/adapter.mjs (BeadsAdapter shell + 7-key capabilities + cluster binding)
  - src/adapter/primitives.mjs (16 stubs — Phase 7 / PRIM-01 + PRIM-02)
  - src/adapter/phaseLifecycle.mjs (32 stubs — Phase 8 / IMPL-01)
  - src/adapter/roadmapMilestone.mjs (22 stubs — Phase 8 / IMPL-02)
  - src/adapter/state.mjs (21 stubs — Phase 9 / IMPL-03)
  - src/adapter/verifyReviews.mjs (50 stubs — Phase 10 / IMPL-04)
  - src/adapter/discussTodos.mjs (48 stubs — Phase 11 / IMPL-05+IMPL-06)
  - src/adapter/longTail.mjs (85 stubs — Phase 12 / IMPL-07..11)
  - src/adapter/initBundlers.mjs (13 stubs — Phase 13 / IMPL-12)
affects:
  - downstream Phase 7 (will replace primitives.mjs stubs with real bd
    plumbing; the cluster boundary lets those edits stay surgical)
  - downstream Phases 8-13 (each owns one cluster file)
tech-stack:
  added: []
  patterns:
    - "Method-bag default-export per cluster file (plain object, not class)
       — Object.assign(BeadsAdapter.prototype, ...) binds methods at module
       load, preserving function names in stack traces."
    - "Lazy bd validation via _ensureBd (D-02): constructor stores
       projectRoot only; first method call runs findBeadsRoot and caches
       the resolved root. Reading BeadsAdapter.capabilities never triggers
       validation."
    - "Static frozen capabilities flag (D-03): Object.freeze prevents
       runtime mutation; readable without instantiation per CAP-01."
    - "Canonical stub error format (D-05):
       `BeadsAdapter.<method>: not implemented (Phase N / (PRIM|IMPL)-NN)`
       — single regex governs all ~287 stubs across 8 cluster files."
key-files:
  created:
    - src/adapter.mjs (76 lines)
    - src/adapter/primitives.mjs (29 lines)
    - src/adapter/phaseLifecycle.mjs (39 lines)
    - src/adapter/roadmapMilestone.mjs (29 lines)
    - src/adapter/state.mjs (30 lines)
    - src/adapter/verifyReviews.mjs (57 lines)
    - src/adapter/discussTodos.mjs (60 lines)
    - src/adapter/longTail.mjs (109 lines)
    - src/adapter/initBundlers.mjs (21 lines)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/deferred-items.md
  modified: []
decisions:
  - "Adopted plan-spec verbatim for shell + 8 cluster files; no scope
     adjustments. The 9 files compile cleanly and Wave 0 adapter-shell
     tests turn green on first run (RED → GREEN, zero deviation iterations
     for the canonical contract)."
  - "longTail.mjs ships 85 methods (per REQUIREMENTS.md IMPL-07..11
     verbatim) rather than the 80 declared by the plan's verify-step
     arithmetic. Source-of-truth precedence: REQUIREMENTS.md > plan
     section comments. The plan's ±5 tolerance on the 282-method total
     covers it (actual 287 unique names)."
metrics:
  duration: "~10 minutes"
  completed_date: 2026-05-01
  commits: 2
  tests_added: 0  # Wave 0 driver pre-existed (Plan 01)
  tests_passing: 6  # ARCH-04 adapter-shell.test.mjs
  total_methods: 287  # 16+32+22+21+50+48+85+13 across 8 cluster files
---

# Phase 6 Plan 06: BeadsAdapter shell + 8 cluster stub files Summary

**One-liner:** ARCH-04 BeadsAdapter shipped as a 9-file scaffold (1 shell
+ 8 cluster method-bags totalling 287 stubs) with lazy bd validation,
frozen 7-key capabilities flag, and a single canonical stub-error format
that lets Phases 7-13 fill in cluster files surgically without touching
the shell.

## What Shipped

### `src/adapter.mjs` — the shell

```js
export class BeadsAdapter {
  constructor(projectRoot) {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
      throw new TypeError('BeadsAdapter: projectRoot must be a non-empty string');
    }
    this.projectRoot = projectRoot;
    this._beadsRoot = null;
    this._beadsValidated = false;
  }
  _ensureBd() { /* D-02 lazy validation via findBeadsRoot */ }
}

BeadsAdapter.capabilities = Object.freeze({
  record: true, section: true, binaryAsset: false, snapshot: true,
  transaction: false, namedDoc: true, commitPlanningState: false,
});

Object.assign(BeadsAdapter.prototype,
  primitives, phaseLifecycle, roadmapMilestone, state,
  verifyReviews, discussTodos, longTail, initBundlers);
```

Three loadbearing structural choices, all from CONTEXT.md D-01..D-05:

| Decision | Implementation | Why |
|----------|----------------|-----|
| **D-02 lazy bd** | `_ensureBd()` called by future methods, NOT in constructor | Reading `BeadsAdapter.capabilities` must work on a non-bd machine (no `.beads/` required) |
| **D-03 static caps** | `Object.freeze({...})` static class property | Phase 7 will refine the booleans; freeze prevents consumer mutation (T-6.06-03) |
| **D-04 cluster bind** | `Object.assign(prototype, ...8imports)` at module load | Each cluster file is a plain method-bag object, not a class — preserves function names in stack traces, allows surgical edits in Phases 7-13 without touching the shell |
| **D-05 stub format** | `'BeadsAdapter.' + name + ': not implemented (Phase ' + phase + ' / ' + impl + ')'` | Wave 0 regex `/^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM\|IMPL)-\d+\)$/` validates the contract uniformly across 287 stubs |

### 8 cluster method-bag files

Per-cluster method counts and IMPL-id mapping:

| File | IMPL ids | Phase | Methods | Owner phase |
|------|----------|-------|---------|-------------|
| `primitives.mjs` | PRIM-01 (10) + PRIM-02 (6) | 7 | **16** | Phase 7 PRIM impl |
| `phaseLifecycle.mjs` | IMPL-01 | 8 | **32** | Phase 8 lifecycle impl |
| `roadmapMilestone.mjs` | IMPL-02 | 8 | **22** | Phase 8 roadmap impl |
| `state.mjs` | IMPL-03 | 9 | **21** | Phase 9 state impl |
| `verifyReviews.mjs` | IMPL-04 | 10 | **50** | Phase 10 verify impl |
| `discussTodos.mjs` | IMPL-05 (21) + IMPL-06 (27) | 11 | **48** | Phase 11 todos impl |
| `longTail.mjs` | IMPL-07 (18) + IMPL-08 (37) + IMPL-09 (8) + IMPL-10 (12) + IMPL-11 (10) | 12 | **85** | Phase 12 long-tail impl |
| `initBundlers.mjs` | IMPL-12 | 13 | **13** | Phase 13 init bundler impl |
| **Total unique names** | — | — | **287** | — |

`recordStateEvent` lives in `primitives.mjs` (PRIM-02), explicitly NOT
duplicated in `state.mjs` (IMPL-03). `getSection` and `updateSection`
appear in `primitives.mjs` only — counted once even though SYNTHESIS.md
listed them in both PRIM-01 and PRIM-02 categories. `recordDecision`
folds into `recordStateEvent` per REQUIREMENTS.md IMPL-05 note —
omitted from `discussTodos.mjs`. `writeIntel` folds into `putIntelDoc`
per REQUIREMENTS.md IMPL-11 note — omitted from `longTail.mjs`.

### Cross-cluster collision check

Detected via runtime introspection:

```
TOTAL UNIQUE NAMES: 287
CROSS-CLUSTER DUPLICATES: 0
```

Threat T-6.06-04 (Object.assign silent override) is fully mitigated:
the cluster boundaries are disjoint by construction, and a runtime
`getOwnPropertyNames(prototype).length` equals the sum of cluster
key counts.

## Test Results

```
node --test tests/unit/adapter-shell.test.mjs

✔ ARCH-04: constructor accepts string projectRoot
✔ ARCH-04: constructor rejects empty/non-string projectRoot
✔ ARCH-04: capabilities flag readable WITHOUT instantiation
✔ ARCH-04: capabilities is frozen (Object.isFrozen)
✔ ARCH-04: stub methods throw canonical message format
✔ ARCH-04: stub methods include the method name in the error

ℹ tests 6
ℹ pass  6
ℹ fail  0
```

All 6 ARCH-04 tests pass. Stub-format spot-checks one method per cluster:

| Cluster | Sampled method | Expected error fragment |
|---------|----------------|-------------------------|
| primitives | `getRecord` | `BeadsAdapter.getRecord: not implemented (Phase 7 / PRIM-01)` |
| phaseLifecycle | `addPhase` | `BeadsAdapter.addPhase: not implemented (Phase 8 / IMPL-01)` |
| roadmapMilestone | `getRoadmap` | `BeadsAdapter.getRoadmap: not implemented (Phase 8 / IMPL-02)` |
| state | `getStateSnapshot` | `BeadsAdapter.getStateSnapshot: not implemented (Phase 9 / IMPL-03)` |
| verifyReviews | `getVerification` | `BeadsAdapter.getVerification: not implemented (Phase 10 / IMPL-04)` |
| discussTodos | `getTodo` | `BeadsAdapter.getTodo: not implemented (Phase 11 / IMPL-06)` |
| longTail | `getConfig` | `BeadsAdapter.getConfig: not implemented (Phase 12 / IMPL-07)` |
| initBundlers | `getProgressInit` | `BeadsAdapter.getProgressInit: not implemented (Phase 13 / IMPL-12)` |

All 8 sampled stubs match the canonical regex. Combined Wave 0 run
(adapter-shell + structural-imports + findBeadsRoot): **19/19 pass**.

## Deviations from Plan

### Plan-spec deviations (no scope creep)

**1. [Rule 1 — Plan arithmetic bug] longTail.mjs method count**

- **Found during:** Task 8 verify step.
- **Issue:** Plan's verify regex expected 80 methods in
  `longTail.mjs`. The plan's own action-block code lists 18+37+8+12+10
  = 85 methods (matching REQUIREMENTS.md IMPL-07..11 verbatim). The
  regex `[a-zA-Z]+` further undercounts to 84 because
  `bootstrapFromGsd2` contains a digit. So the plan's strict equality
  test `M -eq 80` was unsatisfiable from the start.
- **Fix:** Shipped longTail.mjs with the full 85-method REQUIREMENTS.md
  surface (no methods omitted from the spec). Plan's overall ±5
  tolerance on the 282-method total covers the deviation (actual 287).
- **Files modified:** `src/adapter/longTail.mjs` (no change from plan
  body — the file matches the plan's literal action-block).
- **Note:** `.planning/phases/06-cleanup-adapter-library-scaffolding/deferred-items.md`
  documents this for traceability.
- **Commit:** 7544727 (cluster batch).

### Auth gates / blockers

None.

## Threat Mitigations

| Threat | Status | Evidence |
|--------|--------|----------|
| T-6.06-01 (stub format drift across 9 files) | mitigated | Inline `NOT_IMPLEMENTED` helper in every cluster file uses an exact-string template; Wave 0 spot-checks 1 method/cluster against the canonical regex; all 8 samples pass. |
| T-6.06-02 (path leak in `_ensureBd` error) | accepted | The path is exactly what the consumer passed in — no new exposure. v1.1+ may redact home dir. |
| T-6.06-03 (capabilities mutation) | mitigated | `Object.freeze` wraps the static; Wave 0 test asserts `Object.isFrozen(BeadsAdapter.capabilities)`. |
| T-6.06-04 (Object.assign duplicate-method silent override) | mitigated | Runtime introspection over the 8 cluster default exports finds 287 unique names + 0 duplicates. The disjoint-cluster invariant is now testable in CI. |

No HIGH threats. security_enforcement gate: LOW (ASVS L1).

## Key Files

- **Created:** `src/adapter.mjs` (76 lines, commit 2c247da)
- **Created:** 8 cluster files under `src/adapter/` (totalling 374 lines,
  commit 7544727)
- **Created:** `.planning/phases/06-cleanup-adapter-library-scaffolding/deferred-items.md`
  (logs pre-existing structural-cleanup test failure + plan arithmetic
  note for traceability; not a code artifact)
- **Existing test driver:** `tests/unit/adapter-shell.test.mjs`
  (Wave 0 scaffolding from Plan 01) — driver unchanged; all 6 ARCH-04
  tests now green

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | feat | 2c247da | feat(6-06): create BeadsAdapter shell with lazy bd validation and cluster binding |
| 2-9 | feat | 7544727 | feat(6-06): add 8 BeadsAdapter cluster files with canonical stub methods |

## Verification

- [x] All 9 src/adapter/*.mjs files parse with `node --check`
- [x] `node --test tests/unit/adapter-shell.test.mjs` — 6/6 pass (ARCH-04)
- [x] Combined Wave 0 (adapter-shell + structural-imports + findBeadsRoot)
      — 19/19 pass
- [x] Importing `src/adapter.mjs` resolves; `BeadsAdapter` is both default
      and named export
- [x] `BeadsAdapter.capabilities` is frozen with 7 boolean keys (record,
      section, binaryAsset, snapshot, transaction, namedDoc,
      commitPlanningState)
- [x] Constructor rejects empty / non-string `projectRoot` with TypeError
- [x] Constructor does NOT trigger bd validation (lazy per D-02)
- [x] All 287 stub methods throw `Error` matching the canonical regex
      `/^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/`
      (8 cluster-spanning samples verified by Wave 0 test)
- [x] Cross-cluster method-name uniqueness: 287/287 unique, 0 duplicates
- [x] No HIGH threats; T-6.06-01/03/04 mitigated, T-6.06-02 accepted

## Self-Check: PASSED

- src/adapter.mjs — FOUND
- src/adapter/primitives.mjs — FOUND
- src/adapter/phaseLifecycle.mjs — FOUND
- src/adapter/roadmapMilestone.mjs — FOUND
- src/adapter/state.mjs — FOUND
- src/adapter/verifyReviews.mjs — FOUND
- src/adapter/discussTodos.mjs — FOUND
- src/adapter/longTail.mjs — FOUND
- src/adapter/initBundlers.mjs — FOUND
- Commit 2c247da — FOUND in `git log`
- Commit 7544727 — FOUND in `git log`
- All 6 adapter-shell tests pass — VERIFIED

## Known Stubs

All 287 cluster methods are intentional stubs scheduled for Phases 7-13
(see cluster-IMPL mapping table above). This is the explicit scope of
plan 06-06: provide the canonical not-implemented surface against which
Phase 7+ fill in real bd plumbing. Wave 0 ARCH-04 test enforces the
canonical-message contract; calls to any stub throw a typed Error that
identifies its owning phase + IMPL id, so consumer code that hits a
not-yet-implemented method gets a clear "filed under Phase N / IMPL-NN"
signal rather than silent corruption.

## Next Plan

**06-07 (package.json + docs)** picks up next. With the BeadsAdapter
shell + cluster files in place, package.json can declare the public
adapter surface and docs can describe the phased fill-in plan.
