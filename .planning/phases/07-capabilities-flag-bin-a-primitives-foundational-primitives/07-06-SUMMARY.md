---
phase: "07"
plan: "06"
subsystem: adapter
tags: [primitives, capabilities-flag, recordStateEvent, writeBinaryAsset, discriminated-union, bd-memory, bd-comments, wave-4]
requires:
  - src/adapter.mjs (Phase 06 — capabilities literal block; constructor; cluster bindings)
  - src/adapter/primitives.mjs (Wave 3 / Plan 05 — Bin A complete; 6 PRIM-02 stubs remaining)
  - src/bd/errors.mjs (Wave 1 / earlier — UnsupportedOperationError class with locked D-16 message format)
  - src/bd/helper.mjs (existing — bd() spawnSync wrapper)
  - tests/fixtures/seed.jsonl (carry-forward — bd init --from-jsonl source)
  - .planning/phases/07-.../07-CONTEXT.md §D-09 (discriminated-union dispatch contract) §D-16 (capabilities flag + writeBinaryAsset throw format)
  - .planning/phases/07-.../07-RESEARCH.md §"Pattern 4: Discriminated-union dispatch" §"Pitfall 1: bd comments don't accept labels (D-09 amendment)" §"writeBinaryAsset implementation"
provides:
  - "src/adapter.mjs — capabilities literal block annotated with JSDoc rationale comments adjacent to each false value (binaryAsset, transaction, commitPlanningState); Phase 7 SC#1 lint dependency in place"
  - "src/adapter/primitives.mjs — recordStateEvent (10-type discriminated-union dispatch over MEMORY_EVENT_TYPES + COMMENT_EVENT_TYPES) + writeBinaryAsset (UnsupportedOperationError throw with locked D-16 message)"
  - "src/adapter/primitives.mjs — MEMORY_EVENT_TYPES (7-entry frozen Set) and COMMENT_EVENT_TYPES (3-entry frozen Set) public to file scope"
  - "src/adapter/primitives.mjs — _resolveMilestoneBead helper for COMMENT_EVENT_TYPES dispatch (looks up gsd:milestone + version:<v> bead)"
affects:
  - "Wave 4 Plan 07 (last 4 PRIM-02 stubs: snapshot, restore, putNamedDoc, getNamedDoc)"
  - "Wave 5 Plan 08 (capabilities.test.mjs lint reads src/adapter.mjs as TEXT and verifies UNSUPPORTED comment proximity to each false value)"
  - "Wave 5 Plan 09 (foundational-events.test.mjs in conformance — exercises COMMENT_EVENT_TYPES path once seed.jsonl is enriched with milestone bead)"
  - "Phase 9 (state + decision + event domain methods — recordStateEvent is the Bin B dispatch substrate)"
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "Discriminated-union dispatch: const TYPES = Object.freeze(new Set([...])); if (TYPES.has(type)) { ... }"
    - "bd-memory event storage: bd remember <JSON.stringify(payload)> --key <milestone>:<type>:<id> (1 spawn)"
    - "bd-comment event storage: _resolveMilestoneBead (1 spawn) + bd comments add <bead> --author gsd:event:<type> <JSON.stringify(payload)> (1 spawn) — 2 total"
    - "UnsupportedOperationError throw with locked D-16 message format: 'BeadsAdapter.<method>: not supported (capabilities.<flag>=false). <hint>'"
    - "Capabilities literal annotated with JSDoc rationale comments adjacent to each false value — Phase 7 SC#1 lint reads source as TEXT"
    - "TDD: RED test commit -> GREEN impl commit per task (capabilities task is feat-only since the change is decorative + verified by an existing test; events task is full RED -> GREEN cycle)"
key-files:
  created:
    - tests/unit/primitives-events.smoke.test.mjs
    - .planning/phases/07-capabilities-flag-bin-a-primitives-foundational-primitives/deferred-items.md
  modified:
    - src/adapter.mjs
    - src/adapter/primitives.mjs
key-decisions:
  - "Implemented exactly what the plan specified (verbatim code skeletons in <action> for both tasks); no design choices needed."
  - "Rule 1 deviation: Added cwd: this._beadsRoot to bd() helper invocations in recordStateEvent and _resolveMilestoneBead. The bd() helper at src/bd/helper.mjs:22 only forwards cwd from opts (not env), and call sites in primitives.mjs were defaulting to process.cwd() — which silently routes writes to the dev .beads/ instead of the adapter's projectRoot. Smoke tests caught this directly. Logged the same pattern's pre-existing presence in Plan 04+05 call sites to deferred-items.md (out of scope per Rule 1 scope boundary)."
patterns-established:
  - "Discriminated-union event dispatch: Object.freeze(new Set([...])) for MEMORY_EVENT_TYPES + COMMENT_EVENT_TYPES; type guard checks via .has(); exact text 'recordStateEvent: unknown type \"<x>\"' for unknown-type rejection"
  - "Capabilities-literal lint contract: each false value carries a /** ... UNSUPPORTED ... */ JSDoc comment adjacent (within 5 source lines) so a TEXT-mode lint can verify rationale proximity"
  - "freshBdFixture pattern for smoke tests: mkdtempSync + git init + cp seed.jsonl .beads/issues.jsonl + bd init --from-jsonl --prefix sd --skip-agents --skip-hooks (mirror of tests/unit/findBeadsRoot.test.mjs:14-28)"
requirements-completed:
  - PRIM-02
  - CAP-01
duration: ~17 min
completed: 2026-05-01
---

# Phase 07 Plan 06: capabilities-flag-bin-a-primitives-foundational-primitives — capabilities annotation + recordStateEvent + writeBinaryAsset

**Annotated capabilities literal with JSDoc rationale per `false` value, and replaced 2 of the 6 remaining PRIM-02 stubs in `src/adapter/primitives.mjs` (recordStateEvent + writeBinaryAsset) — 12 of 16 method bodies are now real; 4 remain (snapshot, restore, putNamedDoc, getNamedDoc) for Plan 07.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-05-01T09:11:00Z (approx — worktree base reset + initial reads)
- **Completed:** 2026-05-01T09:28:05Z
- **Tasks:** 2
- **Files created:** 2 (1 test + 1 deferred-items doc)
- **Files modified:** 2 (`src/adapter.mjs` capabilities block + `src/adapter/primitives.mjs` 2 stubs replaced)
- **Test cases added:** 6 (events smoke); full unit suite 158 → 164 (was 158 baseline + 6 new), 0 fail

## Accomplishments

- **CAP-01 / D-16 ship.** `src/adapter.mjs` capabilities literal now carries inline JSDoc rationale comments adjacent to each `false` value (binaryAsset, transaction, commitPlanningState) and one-line descriptions on each `true` value. The Phase 7 SC#1 lint dependency for Plan 08 is in place.
- **PRIM-02 / D-09 partial ship.** `recordStateEvent` implements the locked discriminated-union dispatch:
  - 7 MEMORY_EVENT_TYPES (decision, blocker_added, blocker_resolved, metric, todo_count_update, deferred_items, roadmap_evolution) write `bd remember <JSON.stringify(payload)> --key <milestone>:<type>:<id>` (1 spawn).
  - 3 COMMENT_EVENT_TYPES (session, quick_task, forensic_session) resolve a milestone bead (1 spawn) then write `bd comments add <bead> --author gsd:event:<type> <JSON.stringify(payload)>` (1 spawn) per the **D-09 amendment** (RESEARCH §Pitfall 1: bd v1.0.3 doesn't accept `--label` on comments — `--author` provides the structured slot).
  - Unknown types throw `Error('recordStateEvent: unknown type "<x>"')`.
- **PRIM-02 / D-16 ship.** `writeBinaryAsset` throws `UnsupportedOperationError('writeBinaryAsset', 'binaryAsset', 'bd does not store binaries natively. Configure an external sink in v1.1+.')` — matches the locked D-16 message format byte-for-byte.
- **Smoke coverage.** `tests/unit/primitives-events.smoke.test.mjs` (6 cases) verifies decision + metric memory writes round-trip via `bd recall`, unknown/missing-id/missing-milestone all throw with the documented messages, and writeBinaryAsset throws with the locked message format.

## Task Commits

Atomic commits on the worktree branch (each `--no-verify` per parallel-execution protocol):

1. **Task 1: Annotate capabilities literal with JSDoc rationale** — `b37ecde` (`feat(07-06): annotate capabilities literal with JSDoc rationale per false value (CAP-01 / D-16)`)
2. **Task 2 RED: Failing tests for recordStateEvent + writeBinaryAsset** — `fe5287f` (`test(07-06): add failing tests for recordStateEvent + writeBinaryAsset (RED)`) — 6 cases all fail with canonical "not implemented (Phase 7 / PRIM-02)" stub message
3. **Task 2 GREEN: Implement recordStateEvent + writeBinaryAsset** — `cb8aeab` (`feat(07-06): implement recordStateEvent + writeBinaryAsset (GREEN)`) — 6/6 smoke cases pass; full suite 164/164

REFACTOR phase skipped for both tasks (Task 1 is decorative-only; Task 2 implementation matches the plan's verbatim skeletons + Rule 1 cwd fix).

## Files Created/Modified

### Created

- `tests/unit/primitives-events.smoke.test.mjs` — 6 smoke cases for recordStateEvent + writeBinaryAsset; per-test fresh bd fixture via `mkdtempSync` + `bd init --from-jsonl` from `tests/fixtures/seed.jsonl`. Pattern mirrors `tests/unit/findBeadsRoot.test.mjs`.
- `.planning/phases/07-capabilities-flag-bin-a-primitives-foundational-primitives/deferred-items.md` — tracks two pre-existing systemic flaws (out-of-scope) discovered during Plan 06 execution: (a) every other bd-routed call site in `src/adapter/primitives.mjs` has the same cwd-not-passed bug as the one I fixed in recordStateEvent; (b) the `bd()` helper signature accepts `env` from call sites but doesn't forward it to spawnSync (so BEADS_ACTOR=seed is documented at call sites but not enforced).

### Modified

- `src/adapter.mjs` — capabilities literal block (lines ~50-89) replaced with annotated version. Header comment references D-2026-04-30-05 / D-16 + lint contract. Constructor, `_ensureBd`, `Object.assign` cluster binding, and default export are unchanged.
- `src/adapter/primitives.mjs` — 2 of 6 remaining PRIM-02 stubs replaced. Added `MEMORY_EVENT_TYPES` (7-entry frozen Set) + `COMMENT_EVENT_TYPES` (3-entry frozen Set) above `export default {`. Added `_resolveMilestoneBead` helper at file bottom (just below `_labelsToFrontmatter`). Extended import line to bring `UnsupportedOperationError` in alongside `BeadsEmpty`.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Implemented verbatim from plan skeletons | Plan was unusually prescriptive (full code blocks for both tasks); no design choices surfaced. |
| 2 | Added `cwd: this._beadsRoot` to bd() invocations in recordStateEvent + _resolveMilestoneBead (Rule 1 fix — see Deviations) | Smoke tests caught silent failure: bd remember was succeeding against the dev .beads/ but bd recall (cwd: tmpRoot) saw an empty memory store. Without the fix, conformance against any non-CWD bd database would silently mis-route writes. |
| 3 | Skipped REFACTOR phase for Task 2 | Implementation matches plan's verbatim skeleton + minimal Rule 1 cwd correction; no cleanup justifies a third commit. |
| 4 | Wrote out-of-scope deferred-items.md instead of fixing pre-existing call sites | Rule 1 scope boundary: only auto-fix issues DIRECTLY caused by current task changes. Plan 04+05 bd-routed call sites have the same cwd bug but are pre-existing; logged for future plan attention. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `bd()` helper invocations in recordStateEvent + _resolveMilestoneBead were not passing `cwd`**

- **Found during:** Task 2 GREEN — `node --test tests/unit/primitives-events.smoke.test.mjs` after first impl pass.
- **Issue:** The plan's verbatim skeleton invokes `bd(['remember', ...], { env: ..., parseJson: false })` and `bd(args)` for the milestone-resolve list, with no `cwd`. The `bd()` helper at `src/bd/helper.mjs:22` invokes `spawnSync('bd', args, { cwd, encoding: 'utf-8' })` — when `cwd` is undefined, spawnSync uses `process.cwd()`. In the smoke test, `process.cwd()` is the gsd-beads repo (which has its own `.beads/`), so `bd remember` was succeeding against the *dev* bd database while `bd recall` (called separately with `cwd: root` in the test) saw the *fixture* database — which had no memory written.

  Test failures (RED tally was 6/6 fail; after first GREEN attempt 4/6 pass, 2/6 fail):

  ```
  ✖ SMOKE: recordStateEvent decision writes bd memory under v1.0:decision:<id>
    AssertionError: bd recall failed: No memory with key "v1.0:decision:d-smoke-1"
  ✖ SMOKE: recordStateEvent metric writes bd memory under v1.0:metric:<id>
    AssertionError: bd recall failed: No memory with key "v1.0:metric:m-smoke-1"
  ```
- **Fix:** Added `cwd: this._beadsRoot` to the bd() opts at all three call sites:
  1. `bd(['remember', ...], { cwd: this._beadsRoot, env: ..., parseJson: false })`
  2. `bd(['comments', 'add', ...], { cwd: this._beadsRoot, env: ..., parseJson: false })`
  3. `bd(args, { cwd: adapter._beadsRoot })` in _resolveMilestoneBead
- **Files modified:** `src/adapter/primitives.mjs`
- **Verification:** Re-ran `node --test tests/unit/primitives-events.smoke.test.mjs` — 6/6 pass. Re-ran full unit suite — 164/164 pass.
- **Committed in:** `cb8aeab` (Task 2 GREEN — the cwd fix is part of getting GREEN to pass)
- **Out of scope for this plan but noted to deferred-items.md:** Every other bd-routed call site in `src/adapter/primitives.mjs` (introduced by Plans 04+05: getRecord, listCollection, exists, getSection, updateSection, getFrontmatter, updateFrontmatter, mergeFrontmatter) has the same cwd-not-passed bug. Wave 5 conformance will hit it for the read paths the same way my smoke caught it for the write paths. A future plan should either audit-and-fix or refactor `bd()` to accept an adapter context.

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** No scope creep; the cwd fix is a one-line correction at 3 sites and was required for the smoke tests to pass. Pre-existing equivalent bug in Plans 04+05 call sites logged to deferred-items.md per scope-boundary rule (no fan-out fixes from this plan).

## Issues Encountered

None beyond the deviation above. The plan's verbatim skeletons were directly implementable; no library API surprises (`bd remember --key` and `bd comments add --author` both work as documented in `bd --help`).

Pre-existing repo state at executor start (left alone — unrelated to this plan):
- `recipe/gsd-beads-recipe.md` showed as deleted (pre-existing dirty state)
- `tests/fixtures/seed.jsonl` showed as modified (pre-existing dirty state — same content as what's used by smoke tests; no further changes)

These were not committed by this plan and were not modified.

## Threat Model Status

Plan's `<threat_model>` had 4 entries; outcomes:

| Threat ID | Disposition (plan) | Outcome |
|-----------|--------------------|---------|
| T-7-15 | accept (deferred to Phase 9) | Accepted as planned. recordStateEvent serializes `payload` via JSON.stringify with no schema validation; Phase 9 owns validation against the locked storage shape. No code-side change. |
| T-7-13 | mitigate (no shell injection) | Mitigated. The bd memory key is built via template literal `${milestone}:${type}:${id}`; the args flow through `spawnSync('bd', args, ...)` (no shell, no interpolation). bd's own key validation rejects malformed keys at the daemon. |
| T-7-16 | accept (DoS bound by GSD cadence) | Accepted as planned. COMMENT_EVENT_TYPES (session/quick_task/forensic_session) write 1 bd comment per event; bounded by workflow cadence. No DoS surface introduced. |
| T-7-02 | mitigate (Plan 07 owns) | Deferred to Plan 07 as planned (snapshot/restore JSONL parsing). Not in scope here. |

No new threats discovered during implementation.

## Threat Surface Scan (post-impl)

No new security-relevant surface introduced beyond the threat-model entries. recordStateEvent accepts caller-supplied `type` (validated against frozen Sets) and `payload` (serialized verbatim); writeBinaryAsset accepts no arguments before throwing. No new endpoints, auth paths, file access patterns at trust boundaries, or schema changes.

## Known Stubs

The remaining 4 stubs in `src/adapter/primitives.mjs` are intentionally preserved for Plan 07:

| Method | Owner | Why deferred |
|--------|-------|--------------|
| `snapshot` | Plan 07 (PRIM-02) | bd export pipeline — separate concern from event log |
| `restore(snapshotRef)` | Plan 07 (PRIM-02) | bd init --from-jsonl pipeline — separate concern |
| `putNamedDoc(category, key, body)` | Plan 07 (PRIM-02) | hybrid disk + bd memory index — separate routing |
| `getNamedDoc(category, key)` | Plan 07 (PRIM-02) | hybrid disk + bd memory index — separate routing |

Each stub still throws the canonical `BeadsAdapter.<name>: not implemented (Phase 7 / PRIM-02)` message verified by `tests/unit/adapter-shell.test.mjs` (uses `snapshot` as the primitives-cluster sample — still a stub, so the test stays green).

## TDD Gate Compliance

This plan's frontmatter is `type: execute` (not `type: tdd`), but **Task 2** explicitly carries `tdd="true"`. Gate sequence verified:

| Task | RED gate | GREEN gate | Notes |
|------|----------|------------|-------|
| 1 (capabilities annotation) | n/a — no test commit | `b37ecde` (`feat`) | Decorative change verified by existing `tests/unit/adapter-shell.test.mjs` (stays green; capabilities readability + frozen-shape spot-checks unchanged). No `tdd="true"` flag on this task. |
| 2 (recordStateEvent + writeBinaryAsset) | `fe5287f` (`test`) — 6/6 fail | `cb8aeab` (`feat`) — 6/6 pass | Standard TDD cycle. RED commit precedes GREEN commit in `git log`. |

## What's Next (handoff)

- **Plan 07** (final 4 PRIM-02 stubs: snapshot, restore, putNamedDoc, getNamedDoc) is unblocked. The `_beadsRoot` cwd-pass pattern established here applies — Plan 07 should pass `cwd: this._beadsRoot` to every `bd()` invocation it adds.
- **Plan 08** (capabilities.test.mjs lint) can now read `src/adapter.mjs` as TEXT and verify each `false` value carries a UNSUPPORTED rationale within 5 lines. The 3 false values in source are `binaryAsset: false`, `transaction: false`, `commitPlanningState: false`.
- **Plan 09** (foundational-events conformance) needs to enrich `tests/fixtures/seed.jsonl` additively with a milestone bead (labels `gsd:milestone` + `version:v1.0`) so the COMMENT_EVENT_TYPES dispatch path can be exercised end-to-end. Until then, COMMENT_EVENT_TYPES is implemented but smoke-tested only via the path-existence checks (memory-types smoke covers most of the surface).
- **deferred-items.md** logs two pre-existing systemic flaws future plans should triage: (1) cwd-not-passed at every bd-routed call site introduced by Plans 04+05, and (2) `bd()` helper not forwarding `env` to spawnSync (BEADS_ACTOR=seed documented but not enforced at call sites).

## Self-Check: PASSED

Verified post-write:

```
$ [ -f tests/unit/primitives-events.smoke.test.mjs ] && echo FOUND
FOUND
$ [ -f .planning/phases/07-capabilities-flag-bin-a-primitives-foundational-primitives/deferred-items.md ] && echo FOUND
FOUND
$ git log --oneline | grep -E "b37ecde|fe5287f|cb8aeab"
cb8aeab feat(07-06): implement recordStateEvent + writeBinaryAsset (GREEN)
fe5287f test(07-06): add failing tests for recordStateEvent + writeBinaryAsset (RED)
b37ecde feat(07-06): annotate capabilities literal with JSDoc rationale per false value (CAP-01 / D-16)
$ node --test tests/unit/*.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"
ℹ tests 164
ℹ pass 164
ℹ fail 0
$ grep -c "binaryAsset: false" src/adapter.mjs && grep -B 5 "binaryAsset: false" src/adapter.mjs | grep -c "UNSUPPORTED"
1
1
$ grep -c "NOT_IMPLEMENTED" src/adapter/primitives.mjs   # 1 declaration + 4 remaining stub invocations = 5
5
$ node -e "import('./src/adapter.mjs').then(m => console.log(Object.keys(m.BeadsAdapter.capabilities).join(',')))"
record,section,binaryAsset,snapshot,transaction,namedDoc,commitPlanningState
```

All 3 commits exist on the worktree branch; both new files exist; modified files contain the expected new content (capabilities annotation + 2 stubs replaced + helper + dispatch enums + import); full unit suite 164/164 green; capabilities key order intact; rationale-comment proximity holds for all 3 false values.

---
*Phase: 07 (capabilities-flag-bin-a-primitives-foundational-primitives)*
*Plan: 06*
*Completed: 2026-05-01*
