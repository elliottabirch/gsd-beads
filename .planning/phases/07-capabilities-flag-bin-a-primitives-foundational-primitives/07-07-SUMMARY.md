---
phase: "07"
plan: "07"
subsystem: adapter
tags: [primitives, snapshot, restore, putNamedDoc, getNamedDoc, named-doc-allowlist, path-traversal-mitigation, wave-5]
requires:
  - src/adapter/primitives.mjs (Wave 4 / Plan 06 — recordStateEvent + writeBinaryAsset live; 4 PRIM-02 stubs remaining: snapshot, restore, putNamedDoc, getNamedDoc)
  - src/adapter/pathRouter.mjs (Wave 1 — NAMED_DOC_CATEGORIES closed allowlist)
  - src/adapter/_atomicWrite.mjs (Wave 2 — atomic disk write per D-08)
  - src/bd/helper.mjs (existing — bd() spawnSync wrapper)
  - tests/fixtures/seed.jsonl (carry-forward — 2 milestone-heading memories used by snapshot smoke)
  - .planning/phases/07-.../07-CONTEXT.md §D-10 (named-doc dual-write disk + bd-memory index, closed enum) §D-11 (snapshot/restore covers bd JSONL + memories only)
  - .planning/phases/07-.../07-RESEARCH.md §"Pattern 5: snapshot/restore round-trip" §Pitfall 3 §Pitfall 4 §Pitfall 6
  - .planning/phases/07-.../deferred-items.md (cwd-not-passed pattern — applied here for new bd() calls)
provides:
  - "src/adapter/primitives.mjs — snapshot() (mkdtemp + bd export --json -o <tmp>; 1 spawn) + restore(snapshotRef) (TypeError validation, mkdtemp + git init + bd init --from-jsonl + chmod 0o700; 2 spawns) + putNamedDoc(category, key, body) (D-10 dual-write disk + bd-memory index; closed-allowlist + T-7-01 traversal guard; 1 spawn) + getNamedDoc(category, key) (disk read; null on missing; same validation; 0 spawns)"
  - "All 16 PRIM-02 / PRIM-01 primitive method bodies are now real — no stubs remain in src/adapter/primitives.mjs"
  - "tests/unit/primitives-snapshot.smoke.test.mjs (6 cases) — snapshot/restore round-trip + Pitfall 6 chmod + TypeError validation"
  - "tests/unit/primitives-namedDoc.smoke.test.mjs (9 cases) — D-10 dual-write + closed-allowlist on both methods + T-7-01 traversal guard on both methods + 9-category enum round-trip"
  - "tests/unit/adapter-shell.test.mjs — primitives-cluster sample dropped from STUB_RE samples (Phase 7 ships every primitive as real; the canonical stub-message contract is exercised via the other 7 cluster samples)"
affects:
  - "Wave 6 Plans 08-10 (conformance harness — exercises every primitive end-to-end against a freshBdFixture)"
  - "Phase 8+ (Bin B domain methods can rely on snapshot/restore for atomic write batches; named-doc primitives unblock intel/codebase/research/discovery aggregation)"
  - "Phase 9+ (state subsystem can list named-doc indexes via bd memories; aggregation queries via memory keys gsd-beads:named-doc:<cat>:*)"
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "snapshot via single-spawn `bd export --json -o <real-path>` (Pitfall 4 — never /dev/null) returning the path; caller owns lifecycle"
    - "restore via fresh tmpdir + git init + bd init --from-jsonl --prefix sd --skip-agents --skip-hooks (2 spawns); chmodSync 0o700 on .beads (Pitfall 6)"
    - "Named-doc dual-write: atomic disk file at .planning/<category>/<key>.md + bd memory index at gsd-beads:named-doc:<cat>:<key> = JSON({category, key, last_write, byte_length}) — body NEVER in memory entry per D-10"
    - "Closed-allowlist enforcement on category for both putNamedDoc + getNamedDoc — closed enum sourced from src/adapter/pathRouter.mjs NAMED_DOC_CATEGORIES (single source of truth per D-10)"
    - "T-7-01 path-traversal mitigation applied symmetrically on both put + get: `if (/[/\\\\]|\\.\\./.test(key)) throw TypeError(...)` — defense-in-depth on read side too"
    - "Cwd-pass discipline: every bd() invocation in this plan passes `cwd: this._beadsRoot` (continuation of the deferred-items.md pattern established in Plan 06)"
    - "TDD: per-task RED commit (failing tests with stub message) → GREEN commit (impl + smoke green) — 2 task cycles"
key-files:
  created:
    - tests/unit/primitives-snapshot.smoke.test.mjs
    - tests/unit/primitives-namedDoc.smoke.test.mjs
  modified:
    - src/adapter/primitives.mjs
    - tests/unit/adapter-shell.test.mjs
key-decisions:
  - "Implemented exactly what the plan specified for snapshot + restore (verbatim Pattern 5 skeletons) + applied the deferred-items.md cwd-pass pattern to every new bd() call site."
  - "Path-traversal guard applied symmetrically to getNamedDoc as well (defense-in-depth): plan only explicitly required it on putNamedDoc, but a malicious read with `../` would also leak filesystem contents outside the named-doc tree."
  - "Retired the now-dead `NOT_IMPLEMENTED` stub helper from src/adapter/primitives.mjs (Rule 1 hygiene): once Task 2 GREEN landed, the helper had zero callers and contained the literal stub message that the plan's verification grep targets. Replaced with a comment explaining the symmetry break vs other cluster files."
  - "Adapter-shell test fix (Rule 3 / Rule 1 blocking): tests/unit/adapter-shell.test.mjs used `snapshot` as the primitives-cluster sample (per Plan 06 SUMMARY's explicit handoff note). After Task 1 GREEN, snapshot stopped throwing the canonical stub message — broke that test. Dropped the primitives sample (no stubs remain) rather than picking a different primitives method (all 4 in this plan ship; nothing left to point at). Bundled the fix into the Task 1 GREEN commit."
patterns-established:
  - "snapshot/restore primitive shape: caller-owned tmp lifecycle on snapshot path return; restore returns the new project root for caller orchestration; no in-place restore (Phase 8 will ship the backup-and-swap dance against an existing .beads/)"
  - "Named-doc dual-write contract (REQ-07 grep-readability + D-10 listing efficiency): body lives on disk (greppable), index lives in bd memory (fast existence + last_write listing), category enum is the registry"
  - "Symmetric path-traversal guards: both put + get enforce the same allowlist + traversal rules; conformance can sanity-check this with the same payload on both sides"
requirements-completed:
  - PRIM-02
duration: ~21 min
completed: 2026-05-01
---

# Phase 07 Plan 07: capabilities-flag-bin-a-primitives-foundational-primitives — snapshot + restore + putNamedDoc + getNamedDoc

**Replaced the final 4 PRIM-02 stubs in `src/adapter/primitives.mjs` (snapshot, restore, putNamedDoc, getNamedDoc) — every primitive (16/16) is now a real implementation; the next wave's conformance harness can exercise the entire BeadsAdapter primitives surface end-to-end.**

## Performance

- **Duration:** ~21 min (1251 s)
- **Started:** 2026-05-01T09:41:00Z
- **Completed:** 2026-05-01T10:01:51Z
- **Tasks:** 2 (each TDD: RED + GREEN; 4 commits total)
- **Files created:** 2 (snapshot smoke + namedDoc smoke)
- **Files modified:** 2 (`src/adapter/primitives.mjs` — 4 stubs replaced + helper retired; `tests/unit/adapter-shell.test.mjs` — primitives sample dropped)
- **Test cases added:** 15 (6 snapshot smoke + 9 namedDoc smoke)
- **Suite delta:** 164 (Plan 06 baseline) → 179 (this plan: +15 new); 0 fail

## Accomplishments

- **PRIM-02 final ship.** All 4 remaining stubs in `src/adapter/primitives.mjs` are now real implementations:
  - **`snapshot()`** — single bd spawn (`bd export --json -o <mkdtemp>/snapshot.jsonl`) returning the path. Verified: produces parseable JSONL, includes both seeded memories (D-11 contract), file size >0.
  - **`restore(snapshotRef)`** — TypeError on non-string/empty/missing-file; spawns `git init` + `bd init --from-jsonl --prefix sd --non-interactive --skip-agents --skip-hooks --quiet` in a fresh tmpdir; `chmodSync 0o700` on `.beads` (Pitfall 6); returns the new project root. Verified: round-trip contract (mutate after snapshot, restore from snapshot, mutation absent in restored root).
  - **`putNamedDoc(category, key, body)`** — D-10 dual-write: atomic disk write to `.planning/<category>/<key>.md` (via `_atomicWrite.atomicWriteFile`) + bd memory index at `gsd-beads:named-doc:<cat>:<key> = JSON({category, key, last_write, byte_length})`. Body NEVER inlined into memory entry per D-10.
  - **`getNamedDoc(category, key)`** — disk read; returns `null` on missing file. Zero bd spawns. Memory index intentionally not consulted (D-10: index is for Phase 9 listings, not body storage).
- **D-10 closed-allowlist + T-7-01 path-traversal mitigation.** Both methods import `NAMED_DOC_CATEGORIES` from `src/adapter/pathRouter.mjs` (single source of truth) and reject:
  - any category outside the 9-entry allowlist (custom Error with the allowed list inlined for actionable diagnostics);
  - any non-string / empty key (TypeError);
  - any key containing `..`, `/`, or `\` (TypeError) — the path-traversal regex `/[/\\]|\.\./` is symmetric across put + get for defense-in-depth.
- **Stub helper retired.** Once Task 2 GREEN landed, the `NOT_IMPLEMENTED` helper at the top of `src/adapter/primitives.mjs` had zero callers and held the literal "not implemented (Phase 7 / PRIM-02)" message that the plan's verification greps target. Replaced with a comment block explaining the symmetry break vs the 7 other cluster files (which still carry the helper for Phase 8+ stubs).
- **`tests/unit/adapter-shell.test.mjs` follow-through.** Plan 06 SUMMARY explicitly handed off that the test used `snapshot` as the primitives-cluster sample for the canonical stub-message contract. With snapshot now real, the sample was dropped — the contract is still exercised across the 7 other cluster samples (phaseLifecycle, roadmapMilestone, state, verifyReviews, discussTodos, longTail, initBundlers).
- **Smoke coverage.** 15 new cases (6 snapshot + 9 namedDoc) all pass; full unit suite 179/179 (was 164 baseline + 6 + 9 = 179).

## Task Commits

Atomic commits on this worktree branch (each `--no-verify` per parallel-execution protocol):

1. **Task 1 RED: Failing tests for snapshot + restore** — `4b41583` (`test(07-07): add failing tests for snapshot + restore (RED)`) — 6 cases all fail with the canonical "not implemented (Phase 7 / PRIM-02)" stub.
2. **Task 1 GREEN: Implement snapshot + restore** — `7c8ea2f` (`feat(07-07): implement snapshot + restore (GREEN)`) — 6/6 smoke pass; full unit 170/170 after the bundled `tests/unit/adapter-shell.test.mjs` sample drop.
3. **Task 2 RED: Failing tests for putNamedDoc + getNamedDoc** — `c0c5a01` (`test(07-07): add failing tests for putNamedDoc + getNamedDoc (RED)`) — 9 cases all fail with the canonical stub message.
4. **Task 2 GREEN: Implement putNamedDoc + getNamedDoc + retire stub helper** — `6f5592a` (`feat(07-07): implement putNamedDoc + getNamedDoc + retire stub helper (GREEN)`) — 9/9 smoke pass; full unit 179/179.

REFACTOR phase skipped on both tasks — implementations match the plan's verbatim skeletons + the documented Rule 1/3 deviations.

## Files Created/Modified

### Created

- `tests/unit/primitives-snapshot.smoke.test.mjs` — 6 smoke cases for `snapshot` + `restore` (path return, parseable JSONL, memories present, round-trip, chmod 0o700, TypeError validation). Per-test fresh bd fixture (mkdtempSync + git init + commit + bd init --from-jsonl from `tests/fixtures/seed.jsonl`).
- `tests/unit/primitives-namedDoc.smoke.test.mjs` — 9 smoke cases for `putNamedDoc` + `getNamedDoc` (disk write, bd memory index, disk read, null-on-missing, closed-allowlist on both methods, T-7-01 traversal guard on both methods, 9-category enum round-trip).

### Modified

- `src/adapter/primitives.mjs`:
  - Imports extended: added `mkdtempSync, mkdirSync, copyFileSync, chmodSync` from `node:fs`; `join` from `node:path`; `tmpdir` from `node:os`; `NAMED_DOC_CATEGORIES` from `./pathRouter.mjs`.
  - Replaced 4 stubs (`snapshot`, `restore`, `putNamedDoc`, `getNamedDoc`) with real implementations as documented above.
  - Retired the `NOT_IMPLEMENTED` helper (lines 52-54) — replaced with a comment block.
- `tests/unit/adapter-shell.test.mjs` — dropped the `['snapshot']` line from the cluster-samples table in `ARCH-04: stub methods throw canonical message format`. Replaced with a comment explaining the symmetry break.

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Implemented verbatim from plan skeletons + applied deferred-items.md cwd-pass pattern (`cwd: this._beadsRoot`) to the new `bd export` and `bd remember` calls | Plan was prescriptive; the cwd issue would have surfaced during smoke (same failure mode as Plan 06's caught-and-fixed bug). |
| 2 | Path-traversal guard applied to BOTH `putNamedDoc` and `getNamedDoc` (plan only explicitly required it on put) | Defense-in-depth on the read side. A malicious key like `../../etc/passwd` on get could leak filesystem contents outside the named-doc tree. The guard is symmetric across both methods (T-7-01 mitigation). |
| 3 | Retired the `NOT_IMPLEMENTED` stub helper at file top | Rule 1 hygiene + plan's literal verification target: `grep -c "NOT_IMPLEMENTED" → 0` and `grep -c "not implemented (Phase 7" → 0`. The helper had zero callers after Task 2 GREEN. Other cluster files still carry their own copy of the helper (each is independent), so removing this one doesn't affect them. |
| 4 | Dropped the primitives-cluster sample from `tests/unit/adapter-shell.test.mjs` (Rule 3 fix, bundled into Task 1 GREEN commit) | Plan 06 SUMMARY's explicit handoff identified this exact follow-up. After Task 1 GREEN, snapshot stopped throwing the canonical stub message; the test broke. No primitives method survives to be the cluster sentinel after this plan, so the cleanest fix is dropping the line — the canonical stub-message contract is still exercised via the 7 other cluster samples. |
| 5 | Skipped REFACTOR phase on both tasks | Implementations match the plan's verbatim skeletons + the documented Rules 1+3 deviations. No additional cleanup justifies a third commit per task. |
| 6 | Wrote 15 smoke cases (instead of plan's 12) — added 3 extras for getNamedDoc-rejects-category, getNamedDoc-rejects-traversal, putNamedDoc-rejects-traversal-multi-form | The plan's `<behavior>` section listed 6 cases per task (12 total), but the threat model T-7-01 mitigation called for explicit traversal-rejection coverage on both put + get. Three extra cases (one per traversal vector — `..`, `/`, `\`) add minimal cost and cement the defense-in-depth property. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/unit/adapter-shell.test.mjs` cluster-samples table referenced `snapshot` as the primitives sentinel**

- **Found during:** Task 1 GREEN — full unit suite after first impl pass.
- **Issue:** Plan 06 SUMMARY explicitly noted this handoff: *"Each stub still throws the canonical `BeadsAdapter.<name>: not implemented (Phase 7 / PRIM-02)` message verified by `tests/unit/adapter-shell.test.mjs` (uses `snapshot` as the primitives-cluster sample — still a stub, so the test stays green)."* After my Task 1 GREEN landed, `snapshot()` ceased to be a stub: it returned a tmp path or threw "not bd-managed" on a non-bd test root. The `STUB_RE` regex match in `tests/unit/adapter-shell.test.mjs:57` failed with: `actual: 'BeadsAdapter: project at /tmp/anywhere is not bd-managed', expected: /^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/`.
- **Fix:** Replaced the `['snapshot']` line in the cluster-samples table with a comment explaining that the primitives cluster has no remaining stubs after Phase 7 (Plans 04-07). The canonical stub-message contract is still exercised via the 7 other cluster samples — each independently verifies the format.
- **Files modified:** `tests/unit/adapter-shell.test.mjs`
- **Verification:** Re-ran `find tests/unit -maxdepth 1 -name "*.test.mjs" | xargs node --test` — 170/170 pass after Task 1 GREEN, 179/179 after Task 2 GREEN.
- **Committed in:** `7c8ea2f` (Task 1 GREEN — bundled with the snapshot/restore impl).

**2. [Rule 1 - Bug] Retired the `NOT_IMPLEMENTED` stub helper at file top (dead code after Task 2 GREEN)**

- **Found during:** Task 2 GREEN verification — `grep -c "NOT_IMPLEMENTED" src/adapter/primitives.mjs` returned 1 (the helper declaration) instead of the plan's expected 0.
- **Issue:** Plan's `<verification>` and Task 2 `<done>` both specify `grep -c "NOT_IMPLEMENTED" src/adapter/primitives.mjs` returns exactly 0. Once Task 2 replaced the last 2 stubs (`putNamedDoc` + `getNamedDoc`), the helper at lines 52-54 had zero callers. It also held the literal "not implemented (Phase 7" stub message that the plan's `grep -c "not implemented (Phase 7" → 0` target keys on. Leaving it would have meant ambiguous verification (count of 1, but the plan's intent is "no stub plumbing remains").
- **Fix:** Removed the helper definition; replaced with a comment block explaining that other cluster files still carry their own stub helper (each cluster is independent). Replaced the symbol-mention in the comment with phrasing that doesn't include the literal `NOT_IMPLEMENTED` token (otherwise `grep -c` would still return 1).
- **Files modified:** `src/adapter/primitives.mjs`
- **Verification:** `grep -c "NOT_IMPLEMENTED" src/adapter/primitives.mjs` → 0; `grep -c "not implemented (Phase 7" src/adapter/primitives.mjs` → 0; full unit suite 179/179.
- **Committed in:** `6f5592a` (Task 2 GREEN — bundled with the put/getNamedDoc impl).

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug — both small follow-throughs from Plan 06 explicitly handed off in its SUMMARY).
**Impact on plan:** No scope creep. Both fixes were necessary to land the plan's literal verification targets (full unit suite green + grep counts at 0). Both were anticipated in Plan 06's handoff.

## Issues Encountered

None beyond the deviations above. The plan's verbatim skeletons were directly implementable; no library API surprises (`bd export --json -o <path>`, `bd init --from-jsonl --prefix sd --skip-agents --skip-hooks --quiet`, and `bd remember <json> --key <k>` all work as documented in `bd --help`).

The freshBdFixture pattern (mirrored from `tests/unit/primitives-events.smoke.test.mjs` per Plan 06's pattern note) needed `git config user.email/user.name` + an initial empty commit before `bd init --from-jsonl` — without those, `bd init` errored on missing git author identity. Both new smoke fixtures include the same boilerplate.

Pre-existing repo state at executor start (left alone — unrelated to this plan):
- `recipe/gsd-beads-recipe.md` showed as deleted (pre-existing dirty state from earlier worktree)
- `tests/fixtures/seed.jsonl` showed as modified (pre-existing dirty state — same content as Plan 06's smoke uses; not modified here)
- `.claude/worktrees/` directory untracked (worktree harness; not committed)

These were not committed by this plan.

## Threat Model Status

Plan's `<threat_model>` had 3 entries; outcomes:

| Threat ID | Disposition (plan) | Outcome |
|-----------|--------------------|---------|
| T-7-02 | mitigate (deserialization on restore) | **Mitigated.** `restore(snapshotRef)` validates: (a) snapshotRef is a non-empty string (TypeError), (b) the file exists at that path (Error before reaching bd). The bd helper's `BeadsCorrupt` sentinel surfaces malformed JSONL via stderr inspection in `src/bd/helper.mjs` (carry-forward). JSDoc note added: callers should not invoke `restore` with arbitrary user-supplied paths. |
| T-7-01 | mitigate (path traversal in putNamedDoc) | **Mitigated AND extended.** Added `if (/[/\\]|\.\./.test(key)) throw new TypeError(...)` to BOTH `putNamedDoc` AND `getNamedDoc` (defense-in-depth on read side). 5 smoke cases verify the rejection across `..`, `/`, `\` vectors on both methods. Closed-allowlist on category remains the primary control. |
| T-7-17 | accept (tmp snapshot file disclosure) | **Accepted as planned.** `mkdtempSync(join(tmpdir(), 'gsd-beads-snap-'))` — POSIX tmp dirs are mode 0700 by default. Caller owns the lifecycle of the returned path (cleanup is theirs). Documented in JSDoc on `snapshot()`. |

No new threats discovered during implementation.

## Threat Surface Scan (post-impl)

No new security-relevant surface introduced beyond the threat-model entries. snapshot writes only to a fresh `mkdtemp` dir; restore writes only to a fresh `mkdtemp` dir; putNamedDoc writes only under `<projectRoot>/.planning/<category>/<key>.md` (closed allowlist + traversal guard); getNamedDoc reads only under the same path. No new endpoints, auth paths, schema changes at trust boundaries.

## Known Stubs

**None.** All 16 BeadsAdapter primitive method bodies in `src/adapter/primitives.mjs` are now real implementations:

| Method | Status | Plan that shipped it |
|--------|--------|----------------------|
| `getRecord` / `putRecord` / `removeRecord` / `listCollection` / `exists` | real | Plan 04 |
| `getSection` / `updateSection` | real | Plan 05 |
| `getFrontmatter` / `updateFrontmatter` / `mergeFrontmatter` | real | Plan 05 |
| `recordStateEvent` | real | Plan 06 |
| `writeBinaryAsset` | real (throws `UnsupportedOperationError` per D-16) | Plan 06 |
| `snapshot` / `restore` | real | **this plan** |
| `putNamedDoc` / `getNamedDoc` | real | **this plan** |

The stub-message contract for the OTHER 7 adapter cluster files (phaseLifecycle, roadmapMilestone, state, verifyReviews, discussTodos, longTail, initBundlers) is unchanged — those files still carry their own `NOT_IMPLEMENTED` helpers and stubs for Phase 8+ implementation.

## TDD Gate Compliance

This plan's frontmatter is `type: execute` (not `type: tdd`), but **both Task 1 and Task 2** carry `tdd="true"`. Gate sequence verified for each:

| Task | RED gate | GREEN gate | Notes |
|------|----------|------------|-------|
| 1 (snapshot + restore) | `4b41583` (`test`) — 6/6 fail | `7c8ea2f` (`feat`) — 6/6 pass | Standard TDD cycle. RED commit precedes GREEN commit in `git log`. |
| 2 (putNamedDoc + getNamedDoc) | `c0c5a01` (`test`) — 9/9 fail | `6f5592a` (`feat`) — 9/9 pass | Standard TDD cycle. RED commit precedes GREEN commit in `git log`. |

Both tasks: REFACTOR phase intentionally skipped (no behavior-preserving cleanup justifies a third commit; impl matches plan skeleton + documented deviations).

## What's Next (handoff)

- **Wave 6 / Plans 08-10 (conformance harness)** is unblocked. Every BeadsAdapter primitive is real; conformance can:
  - Drive `snapshot()` → mutate → `restore()` for atomic-write batches and cross-worktree topology rehearsals.
  - Drive `putNamedDoc(category, key, body)` + `getNamedDoc(category, key)` round-trips for all 9 D-10 categories.
  - Verify the closed-allowlist + T-7-01 traversal guards across the full primitive surface (not just smoke).
- **Plan 08 (capabilities lint)** can rely on the now-stable primitives module — no stubs, no dead helpers, no remaining placeholders.
- **deferred-items.md (cwd-not-passed at Plans 04+05 call sites)** is still outstanding. This plan continued the new-cwd-pass pattern for all bd() calls it added; future plans should still triage the pre-existing read-path call sites in primitives.mjs (getRecord/listCollection/exists/getSection/updateSection/getFrontmatter/updateFrontmatter/mergeFrontmatter). Wave 6 conformance will exercise those branches and may surface the bug if run from a non-fixture CWD.
- **D-10 listing efficiency** — Phase 9 aggregation can list all named-doc indexes for a category via `bd recall --prefix gsd-beads:named-doc:<category>:` (or whatever bd's prefix-listing primitive turns out to be). The index entries carry `last_write` + `byte_length`, sufficient for Phase 9 dashboards without re-reading bodies.

## Self-Check: PASSED

Verified post-write:

```
$ [ -f tests/unit/primitives-snapshot.smoke.test.mjs ] && echo FOUND
FOUND
$ [ -f tests/unit/primitives-namedDoc.smoke.test.mjs ] && echo FOUND
FOUND
$ git log --oneline | grep -E "4b41583|7c8ea2f|c0c5a01|6f5592a"
6f5592a feat(07-07): implement putNamedDoc + getNamedDoc + retire stub helper (GREEN)
c0c5a01 test(07-07): add failing tests for putNamedDoc + getNamedDoc (RED)
7c8ea2f feat(07-07): implement snapshot + restore (GREEN)
4b41583 test(07-07): add failing tests for snapshot + restore (RED)
$ grep -c "NOT_IMPLEMENTED" src/adapter/primitives.mjs   # exactly 0 — all stubs replaced + helper retired
0
$ grep -c "not implemented (Phase 7" src/adapter/primitives.mjs   # exactly 0 — stub message fully eliminated
0
$ grep -c "NAMED_DOC_CATEGORIES" src/adapter/primitives.mjs   # 6 (1 import + 2 includes checks + 3 in error messages)
6
$ grep -c "atomicWriteFile" src/adapter/primitives.mjs   # 6 (1 import + 5 call sites: putRecord, updateSection disk path, updateFrontmatter disk path, mergeFrontmatter disk path, putNamedDoc)
6
$ grep -c "chmodSync.*0o700" src/adapter/primitives.mjs   # 1 (restore Pitfall 6)
1
$ grep -c "from-jsonl" src/adapter/primitives.mjs   # 1 (restore)
1
$ grep -c 'bd.*export.*--json' src/adapter/primitives.mjs   # 2 (1 in snapshot impl + 1 in JSDoc reference inside restore comment block)
2
$ node -e "import('./src/adapter.mjs').then(m => { const a = new m.BeadsAdapter('/tmp'); console.log(typeof a.snapshot, typeof a.restore, typeof a.putNamedDoc, typeof a.getNamedDoc) })"
function function function function
$ find tests/unit -maxdepth 1 -name "*.test.mjs" -type f | xargs node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
ℹ tests 179
ℹ pass 179
ℹ fail 0
```

All 4 commits exist on the worktree branch; both new files exist; modified files contain the expected new content (4 stubs replaced + helper retired + adapter-shell sample dropped); full unit suite 179/179 green; verification grep counts hit the plan's literal targets (NOT_IMPLEMENTED → 0, "not implemented (Phase 7" → 0); BeadsAdapter exposes all 4 methods as functions.

---
*Phase: 07 (capabilities-flag-bin-a-primitives-foundational-primitives)*
*Plan: 07*
*Completed: 2026-05-01*
