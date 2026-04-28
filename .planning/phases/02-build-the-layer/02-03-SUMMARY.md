---
phase: 02-build-the-layer
plan: "03"
subsystem: shadow-binary
tags: [node-esm, dynamic-import, gsd-sdk, beads, shadow-binary, handlers, argv-routing, tdd]

dependency_graph:
  requires:
    - phase: 02-build-the-layer
      plan: "02"
      provides: [hooks/block-gsd-sdk-mutation.sh, settings.fragment.json, tests/run-quick.sh]
  provides:
    - bin/gsd-sdk-shadow.mjs
    - bin/wrap-mutation.mjs
    - tests/shadow-tests/argv-routing.test.mjs
    - tests/shadow-tests/wrap-mutation.test.mjs
    - tests/shadow-tests/handler-*.test.mjs (13 files)
  affects:
    - 02-05-install-script (symlinks bin/gsd-sdk-shadow.mjs to ~/.local/bin/gsd-sdk)
    - 02-06-e2e-smoke-test (exercises all 13 handlers end-to-end)

tech-stack:
  added: []
  patterns:
    - Node ESM single-file shadow binary (D-02 single-file mandate)
    - Dynamic import of upstream SDK primitives (REQ-02: no fork, no modification)
    - isMain guard pattern (fileURLToPath + resolve) for CLI binary that is also importable
    - Spy-based snapshot test for internal function parity (W2 fix — Pitfall 2 mitigation)
    - ephemeral bd init fixture pattern for handler integration tests
    - Fire-and-forget eventStream emission with optional chaining (D-09 / W3)

key-files:
  created:
    - bin/gsd-sdk-shadow.mjs
    - bin/wrap-mutation.mjs
    - tests/shadow-tests/argv-routing.test.mjs
    - tests/shadow-tests/wrap-mutation.test.mjs
    - tests/shadow-tests/handler-phase-add.test.mjs
    - tests/shadow-tests/handler-phase-add-batch.test.mjs
    - tests/shadow-tests/handler-phase-insert.test.mjs
    - tests/shadow-tests/handler-phase-complete.test.mjs
    - tests/shadow-tests/handler-phase-remove.test.mjs
    - tests/shadow-tests/handler-phase-scaffold.test.mjs
    - tests/shadow-tests/handler-phases-clear.test.mjs
    - tests/shadow-tests/handler-phases-archive.test.mjs
    - tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs
    - tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs
    - tests/shadow-tests/handler-requirements-mark-complete.test.mjs
    - tests/shadow-tests/handler-todo-complete.test.mjs
    - tests/shadow-tests/handler-milestone-complete.test.mjs
  modified: []

key-decisions:
  - "D-02 honored: all 13 BEADS_OVERRIDES handlers in a single file (bin/gsd-sdk-shadow.mjs, 313 lines)"
  - "isMain guard added: allows test-imports of BEADS_OVERRIDES without triggering CLI routing"
  - "milestone.complete: added bd show validation before label ops (bd label remove exits 0 on unknown IDs — Rule 2 fix)"
  - "buildMutationEvent uses GSDEventType.TemplateFill (not TemplateMutation) and ConfigMutation for validate.* — verified against upstream dist/query/index.js lines 121-199"
  - "execSync grep acceptance criterion used single-quote pattern but implementation uses template literals — documented as doc inconsistency"

patterns-established:
  - "isMain guard: const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])"
  - "ephemeral fixture: mkdtempSync + bd init --non-interactive --skip-agents + rmSync in finally"
  - "handler return shape: { data: { ...fields, backend: 'beads' } }"
  - "bd show validation before label-only operations (label remove/add exit 0 on unknown IDs)"

requirements-completed: [REQ-01, REQ-02, REQ-04]

duration: 65min
completed: "2026-04-28"
---

# Phase 02 Plan 03: Shadow Binary Summary

**Shadow `gsd-sdk` binary with 13 bd-backed mutation handlers dispatched via SDK's own registry machinery, plus a reproduced `buildMutationEvent` helper — upstream skills work transparently in beads-managed projects.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-04-28T07:30:00Z
- **Completed:** 2026-04-28T08:39:52Z
- **Tasks:** 4 completed (Wave 0 stubs + 3 TDD tasks)
- **Files created:** 17

## Accomplishments

- `bin/gsd-sdk-shadow.mjs`: 313-line single-file Node ESM binary (D-02); 13 bd-backed handlers, dynamic import of upstream `createRegistry`/`resolveQueryArgv`/`extractField`, argv routing (dotted + space-aliased + --project-dir + --pick), isMain guard for importability
- `bin/wrap-mutation.mjs`: Reproduces upstream `buildMutationEvent` (NOT exported — Pitfall 2) with 7 prefix branches + `wrapMutation` fire-and-forget wrapper; verified by spy-based snapshot test (W2 fix)
- 56 tests passing: 8 wrap-mutation + 9 argv-routing + 39 handler tests (3 per handler × 13 handlers)
- All tests run via `tests/run-quick.sh` routing (argv-routing, wrap-mutation, handler-phase-add)

## Shadow Binary Contract

### 13 BEADS_OVERRIDES (D-02 — single file)

| Handler | bd Commands | Timing Budget | Return Shape |
|---------|-------------|---------------|--------------|
| `phase.add` | `bd q` + `bd label add gsd:phase` | ~150ms | `{phase_id, title, status:'added', backend:'beads'}` |
| `phase.add-batch` | N × (bd q + bd label add) | ~150ms × N | `{phase_ids, count, backend:'beads'}` |
| `phase.insert` | `bd q` + `bd label add gsd:phase` + `bd label add inserted` | ~200ms | `{phase_id, title, priority, status:'inserted', backend:'beads'}` |
| `phase.complete` | `bd close` | ~100ms | `{phase_id, status:'closed', backend:'beads'}` |
| `phase.remove` | `bd close --reason removed` | ~100ms | `{phase_id, status:'removed', backend:'beads'}` |
| `phase.scaffold` | `bd q` + `bd label add gsd:phase` + N × (bd q + bd link) | ~150ms + 150ms × N | `{phase_id, task_ids, backend:'beads'}` |
| `phases.clear` | `bd list --json` + N × `bd close --reason cleared` | ~100ms + 100ms × N | `{cleared_count, backend:'beads'}` |
| `phases.archive` | `bd list --json` + N × `bd label add archived` | ~100ms + 100ms × N | `{archived_count, backend:'beads'}` |
| `roadmap.update-plan-progress` | `bd update --status` | ~100ms | `{plan_id, status, backend:'beads'}` |
| `roadmap.annotate-dependencies` | N × `bd link --type blocks` | ~100ms × N | `{phase_id, deps_added, backend:'beads'}` |
| `requirements.mark-complete` | `bd close` | ~100ms | `{req_id, status:'completed', backend:'beads'}` |
| `todo.complete` | `bd close` | ~100ms | `{todo_id, status:'completed', backend:'beads'}` |
| `milestone.complete` | `bd show` + `bd label remove active` + `bd label add completed` | ~200ms | `{milestone_id, status:'completed', backend:'beads'}` |

### Argv Routing Rules

1. No `query` token → `spawnUpstream(argv)` (passthrough)
2. `--project-dir <path>`: position-agnostic `argv.indexOf` find; validated with `existsSync`
3. Non-beads-managed project (no `.beads/metadata.json`) → `spawnUpstream(argv)`
4. `--project-dir` stripped from `queryArgv` before `resolveQueryArgv`
5. `--pick <field>` stripped before dispatch; result extracted via `extractField(data, field)`
6. `resolveQueryArgv` returns null (unknown command) → `spawnUpstream(argv)`
7. Dispatch throws → `process.exit(1)` with error message

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GSD_SDK_PATH` | `~/.volta/.../get-shit-done-cc` | Override upstream SDK path |
| `GSD_BEADS_DEBUG` | `""` | Set to `"1"` for debug logging to stderr |
| `GSD_SESSION_ID` | `shadow-<pid>-<ts>` | Thread into GSDEvent emission |

## wrap-mutation.mjs Contract

**7 prefix branches** (per upstream `dist/query/index.js` lines 121-199, NOT exported):

| Prefix | GSDEventType | Notes |
|--------|-------------|-------|
| `template.*` / `template ` | `TemplateFill` | Returns templateType, path, created fields |
| `commit`, `check-commit`, `commit-to-subrepo` | `GitCommit` | Returns hash, committed, reason fields |
| `frontmatter.*` / `frontmatter ` | `FrontmatterMutation` | Returns file, fields array |
| `config-*` | `ConfigMutation` | Returns key field |
| `validate.*` / `validate ` | `ConfigMutation` | Same as config-* per upstream |
| `phase.*` / `phases.*` | `StateMutation` | Returns command, fields, success |
| `state.*` | `StateMutation` | Returns command, fields, success |
| Fallback (roadmap, requirements, todo, milestone, etc.) | `StateMutation` | Returns command, fields, success |

**MVP production (W3):** `eventStream = null` → `eventStream?.emitEvent(...)` is a no-op; `wrapMutation` returns handler result unchanged.

**Fire-and-forget (D-09):** emit errors caught and silently discarded; handler result always returned.

## Per-Handler Timing Notes (Pitfall 5)

- `phase.add-batch`: 150ms × N phases — flag if N > 10 (>1.5s in smoke test)
- `phases.clear`: 100ms × N open phases — scales with project size
- `phases.archive`: 100ms × N phases — same
- `phase.scaffold`: 150ms × N tasks per phase
- All other handlers: fixed ~100-200ms budget

## Cross-Plan Invariant

Every `BEADS_OVERRIDES` entry has a matching `handler-<cmd-slug>.test.mjs`:
`phase.add` → `handler-phase-add.test.mjs`, `roadmap.update-plan-progress` → `handler-roadmap-update-plan-progress.test.mjs`, etc.

Verified: `ls tests/shadow-tests/handler-*.test.mjs | wc -l` = 13.

## Threat Mitigations

| Threat ID | Mitigation | Verifying Test |
|-----------|-----------|----------------|
| T-02-04 | `getProjectDir` uses `existsSync` path validation; `resolveQueryArgv` (SDK primitive) for argv parsing | CASE 8+9 in argv-routing |
| T-02-05 | Explicit 13-entry `BEADS_OVERRIDES` allow-list; unknown → `spawnUpstream`; `Object.keys(BEADS_OVERRIDES).length === 13` acceptance criterion | CASE 7 in argv-routing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `bd show` validation before `milestone.complete` label operations**
- **Found during:** Task 4 (handler-milestone-complete test CASE 3)
- **Issue:** `bd label remove <id> active` and `bd label add <id> completed` exit 0 even for unknown IDs (prints error to stderr but does not fail). The plan spec says "unknown id → exit 1" but the handler would exit 0 silently.
- **Fix:** Added a `bd show <id> --json` pre-validation call that throws if the bead doesn't exist (`bd show` exits 1 for unknown IDs).
- **Files modified:** `bin/gsd-sdk-shadow.mjs` (milestone.complete handler)
- **Verification:** `handler-milestone-complete CASE 3` passes: unknown id → exit 1
- **Committed in:** 2a9bb56 (Task 4 commit)

**2. [Rule 1 - Bug] isMain guard added — import() of BEADS_OVERRIDES without triggering CLI routing**
- **Found during:** Task 3 acceptance criterion verification
- **Issue:** The plan's acceptance criterion `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m=>process.exit(Object.keys(m.BEADS_OVERRIDES).length===13?0:1))"` requires the module to be importable without running CLI logic. Without the guard, `process.argv` had no `query` token and `spawnUpstream` was called immediately, exiting before `BEADS_OVERRIDES` was accessible.
- **Fix:** Added `const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]); if (isMain) { await main(); }` pattern. CLI logic moved into `main()` function.
- **Files modified:** `bin/gsd-sdk-shadow.mjs`
- **Verification:** `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m=>process.exit(Object.keys(m.BEADS_OVERRIDES).length===13?0:1))"` exits 0.
- **Committed in:** b7c84e8 (Task 3 commit)

**3. [Doc inconsistency — no code fix] execSync grep pattern mismatch**
- **Issue:** Acceptance criterion `grep -c "execSync.*'bd " bin/gsd-sdk-shadow.mjs` uses single-quote pattern; plan code examples use template literals (backticks) because `bd q ${JSON.stringify(title)}` requires template interpolation. The grep returns 0 but there are 16 execSync calls with template-literal bd commands.
- **Resolution:** Implementation is correct. Criteria grep pattern is a doc inconsistency, not a code bug. No fix needed — 16 bd execSync calls verified.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug), 1 doc inconsistency noted.
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## B3, W2, W3 Invariant Verification

| Invariant | Verification | Result |
|-----------|-------------|--------|
| B3: D-02 single-file | `grep -c '^export const BEADS_OVERRIDES' bin/gsd-sdk-shadow.mjs` = 1 AND `wc -l bin/gsd-sdk-shadow.mjs` = 313 (< 800) | PASS |
| W2: spy-based snapshot, no upstream invocation | `node --test tests/shadow-tests/wrap-mutation.test.mjs` CASE 6 PASS | PASS |
| W3: eventStream=null → no-op | `grep -c 'eventStream = null' bin/gsd-sdk-shadow.mjs` = 2 + CASE 8 in wrap-mutation PASS | PASS |

## Self-Check

| Item | Result |
|------|--------|
| bin/gsd-sdk-shadow.mjs | FOUND (commit b7c84e8) |
| bin/wrap-mutation.mjs | FOUND (commit 3edc1fa) |
| tests/shadow-tests/argv-routing.test.mjs | FOUND (commit b7c84e8) |
| tests/shadow-tests/wrap-mutation.test.mjs | FOUND (commit 3edc1fa) |
| All 13 handler-*.test.mjs | FOUND (commit 2a9bb56) |
| wrap-mutation 8/8 PASS | PASS |
| argv-routing 9/9 PASS | PASS |
| handler-*.test.mjs 39/39 PASS | PASS |
| BEADS_OVERRIDES count = 13 | PASS |
| D-02: single file < 800 lines | PASS (313 lines) |
| REQ-02: no ~/.claude/get-shit-done in bin/ | PASS |

## Self-Check: PASSED
