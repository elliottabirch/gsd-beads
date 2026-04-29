---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 02
subsystem: shadow-dispatch
tags: [findBeadsRoot, BEADS_READ_OVERRIDES, sentinel-dispatch, worktree, esm, node-test, tdd, blocker-1]

# Dependency graph
requires:
  - phase: 04-findbeadsroot-parity-test-infrastructure-plan-01
    provides: BeadsUnavailableError + 4 subtypes (BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty) imported by gsd-sdk-shadow.mjs at top-of-file
  - phase: 03-cross-worktree-validation
    provides: real `git worktree add` fixture pattern (`tests/cross-worktree/lib/setup.sh:29-50`) translated to Node helper
provides:
  - "findBeadsRoot(start) — exported worktree-aware project-root finder (D-01..D-04, REQ-QUAL-03)"
  - "BEADS_READ_OVERRIDES — exported empty table; Phases 5-9 register read handlers here without wrapMutation (D-09)"
  - "Sentinel-aware dispatcher try/catch — falls through to spawnUpstream(argv) on BeadsUnavailableError or known bd-CLI error; explicit return after spawnUpstream is the BLOCKER-1 structural guarantee"
  - "Conditional _phase4-test-stub handler — env-gated (GSD_SHADOW_TEST_STUB=1) Phase-4-only stub proving dispatch wiring + sentinel fall-through"
  - "_phase4-test-stub subtype-throw matrix — GSD_SHADOW_TEST_STUB_THROW=corrupt|not-installed|version-mismatch|empty|typeerror produces named subtype or TypeError for end-to-end fall-through tests"
affects:
  - "Phase 5 (first task): deletes _phase4-test-stub block + adds roadmap.analyze as first real BEADS_READ_OVERRIDES entry"
  - "Phases 5-9 read handlers: all rely on the read-shaped try/catch fall-through proved here; all use findBeadsRoot for project root discovery"

# Tech tracking
tech-stack:
  added:
    - "node:fs realpathSync, statSync, readFileSync (worktree .git file parsing)"
    - "node:path join, dirname (parent walk + worktree gitdir traversal)"
  patterns:
    - "Worktree-first check order: at each level, check `.git` BEFORE `.beads/metadata.json` because bd init commits metadata.json into git tree"
    - "Module-level export of findBeadsRoot (NOT nested inside main()) so tests can import it"
    - "Second register loop without wrapMutation (D-09: reads do not emit GSDEvent.StateMutation)"
    - "Sentinel fall-through with explicit `return;` after spawnUpstream — structural correctness independent of process.exit side effect (BLOCKER-1)"
    - "Env-gated test stub for end-to-end dispatcher wiring proof (lifecycle-bound to phase, deleted by next phase)"

key-files:
  created:
    - "tests/shadow-tests/findBeadsRoot.test.mjs (102 LOC, 5 cases)"
    - "tests/shadow-tests/handler-_phase4-test-stub.test.mjs (140 LOC, 6 cases)"
  modified:
    - "bin/gsd-sdk-shadow.mjs (315 → 415 LOC; +96 net for findBeadsRoot, BEADS_READ_OVERRIDES, conditional stub, second register loop, sentinel-aware try/catch)"

key-decisions:
  - "findBeadsRoot must check .git BEFORE .beads/metadata.json: bd init commits metadata.json into git tree, so worktrees inherit a copy without the actual bd state (Dolt store is gitignored). The original RESEARCH §Pattern 1 check order put metadata.json first, which violated the REQ-QUAL-03 contract that demands resolution to source repo. Rule 1 deviation."
  - "Stub registered inline in gsd-sdk-shadow.mjs behind GSD_SHADOW_TEST_STUB=1 (vs. separate bin/_test-stub.mjs file) — smallest delta to existing shadow file; Phase 5 deletes the block in one shot"
  - "Subtypes imported eagerly at top of file (vs. lazy dynamic import inside the stub closure) — eager simplifies the stub body and removes async-in-throw complexity"
  - "Explicit `return;` after spawnUpstream(argv) in catch — even though spawnUpstream calls process.exit and never returns today, the explicit return is the structural guarantee that no future refactor (Promise-based spawnUpstream, test-harness mock of process.exit) can defeat the contract (BLOCKER-1 plan-checker finding)"
  - "CASE 6 BLOCKER-1 dual assertion: `assert.notEqual(status, 0) && assert.match(stderr, /dispatch failed/)` — together they prove the structural contract is exercised, not just side-effect ordering. Asserting either alone would pass for the wrong reason"

patterns-established:
  - "Worktree fixture (Node test helper translation of `tests/cross-worktree/lib/setup.sh:29-50`): co-locate src + wt under one tempdir; single rm -rf cleans both; ~1s per fixture; use `t.after()` for multi-resource teardown"
  - "Stub-handler invocation in tests: spawnSync('node', [SHADOW, ...args]) with env: { ...process.env, GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: '<mode>' }"
  - "Read-shaped fall-through assertion: `assert.doesNotMatch(result.stderr, /\\[gsd-sdk-shadow\\] dispatch failed/)` — upstream may exit non-zero on the unknown command, that's acceptable; only the shadow's own loud-fail line is forbidden"

requirements-completed:
  - REQ-QUAL-02
  - REQ-QUAL-03

# Metrics
duration: ~9 min
completed: 2026-04-29
---

# Phase 04 Plan 02: Shadow Integration Summary

**findBeadsRoot, BEADS_READ_OVERRIDES, sentinel-aware dispatch, and env-gated _phase4-test-stub all wired into bin/gsd-sdk-shadow.mjs with 11 new test cases passing (5 findBeadsRoot + 6 stub) and zero regressions in the 45-case v0.1 mutation test suite — proving the read-side dispatch contract Phases 5-9 will plug into.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-29T20:53:38Z
- **Completed:** 2026-04-29T21:02:24Z
- **Tasks:** 3 (all `tdd="true"`)
- **Commits:** 4 (Task 1 feat + Task 2 RED test + Task 2 fix + Task 3 test)
- **Files modified:** 1 (`bin/gsd-sdk-shadow.mjs`)
- **Files created:** 2 (test files)

## Accomplishments

- **`bin/gsd-sdk-shadow.mjs`** — extended (NOT rewritten):
  - Imports `BeadsUnavailableError` + 4 subtypes from `./beads-errors.mjs`
  - Adds module-level `export function findBeadsRoot(start)` honoring `BEADS_DIR` env first, walking parents bounded at `.git`/filesystem root, handling worktree `.git` files (parses `gitdir:` line, walks 3 dirnames up to source root, returns source if owns `.beads/metadata.json`)
  - Adds `export const BEADS_READ_OVERRIDES = {}` with conditional `_phase4-test-stub` registration behind `process.env.GSD_SHADOW_TEST_STUB === '1'`. Stub takes `GSD_SHADOW_TEST_STUB_THROW=corrupt|not-installed|version-mismatch|empty|typeerror` for sentinel-throw modes (otherwise returns `{data:{ok:true,backend:'beads'}}`)
  - Adds `isKnownBdCliError(err)` helper at module level (D-12: ENOENT + bd-not-found patterns)
  - In `main()`: adds second register loop registering `BEADS_READ_OVERRIDES` entries WITHOUT `wrapMutation` (D-09 forward-compat)
  - In `main()`: replaces dispatch try/catch with sentinel-aware variant — catches `BeadsUnavailableError || isKnownBdCliError(err)` and falls through to `spawnUpstream(argv)` followed by **explicit `return;`** (BLOCKER-1 structural guarantee). Real bugs (TypeError etc.) preserve v0.1 loud-fail.
  - Updates D-02 invariant header comment to reflect read/write table separation
- **`tests/shadow-tests/findBeadsRoot.test.mjs`** — 5 cases via real `git worktree add` fixture (~1s each):
  - CASE 1: worktree resolves to source repo (via `.git` file gitdir parsing)
  - CASE 2: `BEADS_DIR` env wins over parent walk
  - CASE 3: symlinked `.beads/` resolves via realpathSync (accepts either symlink-side or realpath-target — RESEARCH §Pattern 5 latitude)
  - CASE 4: non-bd project under git returns null
  - CASE 5: bare directory halts at filesystem root, returns null without throw/hang
- **`tests/shadow-tests/handler-_phase4-test-stub.test.mjs`** — 6 cases via shadow CLI integration (~1s each):
  - CASE 1: happy path — `runShadow(['query', '_phase4-test-stub', '--project-dir', dir], dir, {GSD_SHADOW_TEST_STUB:'1'})` exits 0 with `{data:{ok:true,backend:'beads'}}`
  - CASES 2-5: sentinel subtypes (BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty) prove fall-through — stderr does NOT contain `[gsd-sdk-shadow] dispatch failed`
  - CASE 6: TypeError exits non-zero AND emits dispatch-failed marker (BLOCKER-1 dual assertion: both halves required to catch a regression in the structural `return;`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend `bin/gsd-sdk-shadow.mjs` with findBeadsRoot, BEADS_READ_OVERRIDES, conditional stub, sentinel-aware dispatch** — `c53ebe3` (feat)
2. **Task 2 RED: Add `tests/shadow-tests/findBeadsRoot.test.mjs` (5 cases)** — `b29ba34` (test). CASE 1 fails against Task 1 impl because `.beads/metadata.json` is checked before `.git`, so worktrees with the inherited tracked copy of metadata.json return the worktree path instead of the source path.
3. **Task 2 GREEN: `fix(04-02)` findBeadsRoot — check `.git` before metadata.json (Rule 1 deviation)** — `346962c` (fix). All 5 findBeadsRoot cases now green; v0.1 mutation tests still 20/20.
4. **Task 3: Add `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` (6 cases)** — `2bda38a` (test). All 6 cases pass against current impl (CASE 6 BLOCKER-1 dual assertion verified).

## Files Created/Modified

- **Modified:** `bin/gsd-sdk-shadow.mjs` (+96 net LOC; 315 → 415).
  - Top-of-file imports extended (existsSync→realpathSync/statSync/readFileSync; resolve→join/dirname; new beads-errors import)
  - Module-level exports added: `findBeadsRoot`, `BEADS_READ_OVERRIDES`
  - Module-level helper added: `isKnownBdCliError`
  - Conditional stub registration block (env-gated)
  - Header comment updated for D-02 read/write separation
  - Inside `main()`: second register loop + sentinel-aware try/catch with BLOCKER-1 explicit `return;`
- **Created:** `tests/shadow-tests/findBeadsRoot.test.mjs` (102 LOC; 5 cases via real `git worktree add` fixture)
- **Created:** `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` (140 LOC; 6 cases via shadow CLI integration with env-forwarding `runShadow` helper)

## Decisions Made

- **Worktree-first check order in findBeadsRoot** — `bd init` commits `metadata.json` into the git tree (per `.beads/.gitignore` comment: "Config files (metadata.json, config.yaml) are tracked by git by default"). Therefore every worktree has its own copy of `.beads/metadata.json` even though the actual bd state (Dolt store under `.beads/embeddeddolt/`) is gitignored and lives only in the source repo. The RESEARCH §Pattern 1 verbatim impl checked `.beads/metadata.json` first and returned the worktree path — violating the REQ-QUAL-03 contract that demands resolution to the source repo. Fixed in Task 2 GREEN: at each parent-walk level, check `.git` first; if it's a FILE (worktree marker), resolve via `gitdir:` parse and return source root; if it's a DIRECTORY (regular repo, git root reached), check `.beads/metadata.json` here and return dir or null.
- **Stub-handler placement: inline behind env-gate** — chosen over a separate `bin/_test-stub.mjs` file. Smallest delta to existing shadow file; Phase 5's first task deletes the block in one shot (vs. needing to delete both the file and the import).
- **Eager subtype imports** — top-of-file `import { BeadsUnavailableError, BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty }` rather than lazy dynamic `import()` inside the stub. Simpler, no async-in-throw complexity, no measurable cost (5 named imports from a small module).
- **Explicit `return;` after `spawnUpstream(argv)` in the catch** — even though `spawnUpstream` calls `process.exit(result.status ?? 1)` and never returns today, the explicit `return` is the structural guarantee that no future refactor (Promise-based `spawnUpstream`, test-harness mock of `process.exit`, etc.) can defeat the sentinel-vs-real-bug distinction. This is the BLOCKER-1 fix from `04-PLAN-CHECK.md` PLANS VERIFIED iteration 2.
- **CASE 6 dual assertion (`assert.notEqual(status,0) && assert.match(stderr, /dispatch failed/)`)** — both halves required. Without the dispatch-failed match, a regression in the `return;` (causing sentinel paths to fall through to the dispatch-failed line) would still pass an exit-code-only check (because both sentinel and real-bug paths emit non-zero in that broken state). With both, the test catches structural regressions, not just side-effect ordering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] findBeadsRoot check order produced worktree path instead of source path**
- **Found during:** Task 2 (TDD RED — CASE 1 worktree-resolves-to-source failed against the Task 1 impl)
- **Issue:** RESEARCH §Pattern 1's verbatim impl placed the `existsSync(.beads/metadata.json)` check at the top of the parent-walk loop, before the `.git` check. Because `bd init` commits `metadata.json` into the git tree (intentional bd behavior — see `.beads/.gitignore` final comment), every worktree inherits its own `.beads/metadata.json` file at checkout, even though the actual bd state (Dolt store) is gitignored and exists only in the source repo. Result: `findBeadsRoot(wt)` returned `wt` instead of `src`, violating the REQ-QUAL-03 plan contract: "From a worktree, findBeadsRoot reads the .git file and returns the source repo path that owns .beads/".
- **Fix:** Re-ordered the parent-walk to check `.git` first at each level. Branch:
  - `.git` is a FILE (worktree marker) → parse `gitdir:` line, walk three `dirname()` levels up to source root, return source if it owns `.beads/metadata.json`, else null
  - `.git` is a DIRECTORY (regular repo, git root) → check `.beads/metadata.json` at this level (D-02 halt); return dir or null
  - No `.git` at this level → check `.beads/metadata.json` then walk parent
- **Files modified:** `bin/gsd-sdk-shadow.mjs` (in-place edit of `findBeadsRoot` body, +12/-2)
- **Commit:** `346962c` (`fix(04-02): findBeadsRoot — check .git before metadata.json`)
- **Verification:** findBeadsRoot tests 5/5 green; v0.1 mutation tests 20/20 still green.

### No Architectural Changes

No Rule 4 deviations encountered. The fix above is a pure check-order correction within the existing function body.

## Verification Run

Per the plan's `<verification>` block:

```bash
$ node --test tests/shadow-tests/findBeadsRoot.test.mjs tests/shadow-tests/handler-_phase4-test-stub.test.mjs
ℹ tests 11
ℹ pass 11
ℹ fail 0
ℹ duration_ms 7036.819821

$ node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => { ... })"
findBeadsRoot: function
BEADS_OVERRIDES count: 13
BEADS_READ_OVERRIDES count: 0

$ grep -A1 'D-02 invariant' bin/gsd-sdk-shadow.mjs | head -3
// D-02 invariant: 13 mutation entries (BEADS_OVERRIDES) live here.
//                 Reads (BEADS_READ_OVERRIDES) register separately; empty in Phase 4

$ grep -A2 'spawnUpstream(argv);' bin/gsd-sdk-shadow.mjs | grep -q 'return;' && echo "OK"
OK: BLOCKER-1 fix present
```

Regression check (full handler suite):

```bash
$ node --test tests/shadow-tests/handler-*.test.mjs
ℹ tests 45
ℹ pass 45
ℹ fail 0
```

Combined Task 1 + Task 2 + v0.1 quick suite:

```bash
$ node --test tests/shadow-tests/argv-routing.test.mjs tests/shadow-tests/handler-phase-add.test.mjs tests/shadow-tests/wrap-mutation.test.mjs tests/shadow-tests/findBeadsRoot.test.mjs
ℹ tests 25
ℹ pass 25
ℹ fail 0
```

Stub gating verified:

```bash
$ node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => console.log('keys=', Object.keys(m.BEADS_READ_OVERRIDES)))"
keys= []

$ GSD_SHADOW_TEST_STUB=1 node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => console.log('keys=', Object.keys(m.BEADS_READ_OVERRIDES)))"
keys= [ '_phase4-test-stub' ]
```

## Cross-Plan Dependencies

- **Plans 03 (parity-harness) and 04 (milestone-scoping) — already merged in Wave 1:** import nothing from this plan. No coupling.
- **Phases 5-9 read handlers:** every read handler will:
  1. Call `findBeadsRoot(projectDir)` for project-root discovery (REQ-QUAL-03)
  2. Register into `BEADS_READ_OVERRIDES` via the second register loop (no `wrapMutation`)
  3. Throw `BeadsUnavailableError` (or one of its 4 subtypes) on bd unavailability — the dispatcher's read-shaped try/catch will fall through to upstream automatically
  4. Real bugs (TypeError etc.) propagate to the dispatch-failed loud-fail path — preserves v0.1 behavior

The `_phase4-test-stub` handler exists purely to prove items 2 and 3 end-to-end before any real read handler ships. Phase 5's first task is documented in the plan as: delete the env-gated stub block + register `roadmap.analyze` as the first real `BEADS_READ_OVERRIDES` entry.

## Self-Check: PASSED

**Files created:**
- FOUND: tests/shadow-tests/findBeadsRoot.test.mjs (102 LOC)
- FOUND: tests/shadow-tests/handler-_phase4-test-stub.test.mjs (140 LOC)

**Files modified:**
- FOUND: bin/gsd-sdk-shadow.mjs (415 LOC, +96 net)

**Commits:**
- FOUND: c53ebe3 (Task 1 feat)
- FOUND: b29ba34 (Task 2 RED test)
- FOUND: 346962c (Task 2 GREEN fix)
- FOUND: 2bda38a (Task 3 test)
