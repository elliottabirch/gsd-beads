---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 01
subsystem: testing
tags: [error-hierarchy, sentinel-errors, spawnSync, esm, node-test, instanceof, tdd]

# Dependency graph
requires:
  - phase: 03-cross-worktree-validation
    provides: ESM module + node:test convention, mkdtempSync teardown idiom (`tests/shadow-tests/wrap-mutation.test.mjs`)
provides:
  - "BeadsCause frozen enum (5 string values per D-14)"
  - "BeadsUnavailableError base class + 4 subtypes (BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty)"
  - "bd(args, opts) helper that wraps spawnSync('bd', …) and throws sentinel subtypes on failure (D-13 helpers throw)"
  - "Cross-ESM-boundary instanceof + name-fallback contract (Pitfall 1 mitigation)"
  - "PATH-mocked bd-shim test pattern (mkdtempSync + bash + chmod 0o755)"
affects:
  - "04-02 sentinel dispatch fall-through (imports BeadsUnavailableError + isKnownBdCliError fan-in)"
  - "04-03 _phase4-test-stub handler (imports BeadsNotInstalled / BeadsCorrupt / BeadsVersionMismatch / BeadsEmpty for the throw modes)"
  - "Phases 5-9 read handlers (every handler imports bd from bin/bd-helper.mjs)"

# Tech tracking
tech-stack:
  added:
    - "node:child_process spawnSync (read-side; mutations keep execSync per D-13)"
    - "node:fs chmodSync (test PATH-shim execute permission)"
  patterns:
    - "Helpers throw / handlers stay clean (D-13): bd-helper raises sentinel subtypes, dispatcher catches the base"
    - "Sentinel `.name` fallback for cross-ESM `instanceof` splits (Pitfall 1)"
    - "PATH-injected subprocess shim for unit tests (mkdtempSync + writeFileSync + chmodSync; restore PATH in finally)"

key-files:
  created:
    - "bin/beads-errors.mjs (55 LOC)"
    - "bin/bd-helper.mjs (54 LOC)"
    - "tests/shadow-tests/beads-errors.test.mjs (38 LOC, 4 cases)"
    - "tests/shadow-tests/bd-helper.test.mjs (100 LOC, 4 cases)"
  modified: []

key-decisions:
  - "Each subtype overrides this.name with its own class string (Pitfall 1 mitigation: dispatcher can fall back to err.name === 'BeadsUnavailableError' if instanceof ever splits across module copies)"
  - "bd() routes ALL non-zero exits through BeadsCorrupt — version-mismatch detection is reserved for a future version-check helper, NOT bd() itself (per Task 3 scope statement)"
  - "PATH-injection chosen over child_process module-mocking for bd-helper tests — exercises the real spawnSync code path and avoids module-cache contamination"

patterns-established:
  - "Sentinel error hierarchy: base extends Error + 5 subtypes, each setting this.name to its own class string for ESM-split fallback"
  - "Helper throws / handler clean: bd() raises typed sentinels; handlers (Phase 5+) just call bd() and let exceptions propagate to dispatcher"
  - "PATH-mocked subprocess test: withMockBd(scriptBody, cb) helper wraps mkdtempSync + bash shim + PATH save/restore in finally (T-04-21 mitigation)"

requirements-completed:
  - REQ-QUAL-02

# Metrics
duration: ~7 min
completed: 2026-04-29
---

# Phase 04 Plan 01: Sentinel Hierarchy Summary

**BeadsUnavailableError base + 4 typed subtypes + bd() spawnSync helper, with 8/8 unit cases passing across `instanceof` parity and PATH-mocked bd-shim coverage of every throw branch.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-29T~20:34Z
- **Completed:** 2026-04-29T20:41:27Z
- **Tasks:** 4 (all `tdd="true"`; planned + 1 unplanned `[Rule 3 - Blocking]` wording fix)
- **Files modified:** 4 (all created)

## Accomplishments

- **`bin/beads-errors.mjs`** — Frozen `BeadsCause` enum + `BeadsUnavailableError` base with 4 subtypes; each subtype sets `this.name` for the cross-ESM-boundary fallback. `originalError` and V8 `Error.captureStackTrace` preserved on construction. Pure JS, zero imports.
- **`bin/bd-helper.mjs`** — `bd(args, opts)` wrapper around `spawnSync('bd', args, …)`. Throws `BeadsNotInstalled` on `result.error?.code === 'ENOENT'`, `BeadsCorrupt` on non-zero exit (with stderr-pattern detection for `database|dolt|metadata\.json`), `BeadsCorrupt` on non-JSON stdout, `BeadsEmpty` on bd's `{ error, schema_version }` empty-error shape. Returns parsed JSON on success.
- **`tests/shadow-tests/beads-errors.test.mjs`** — 4 unit cases: subtype `instanceof` base + Error + cause enum, frozen enum, per-subtype `.name`, `originalError` reference preservation. All green.
- **`tests/shadow-tests/bd-helper.test.mjs`** — 4 unit cases via PATH-mocked bash shim (WARN-2 follow-up): ENOENT → `BeadsNotInstalled`; version-mismatch stderr exit-1 → `BeadsCorrupt` (subtype reflects current bd-helper branching, not the CASE name); `metadata.json` stderr exit-1 → `BeadsCorrupt`; success → parsed JSON. Total suite ~62 ms; no `/tmp/gsd-bd-shim-*` orphans after run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create `bin/beads-errors.mjs` (sentinel hierarchy)** — `cbc5ddc` (feat)
2. **Task 2: Create `tests/shadow-tests/beads-errors.test.mjs` (4 unit cases)** — `8490446` (test)
3. **Task 3: Create `bin/bd-helper.mjs` (spawnSync wrapper)** — `7d7375e` (feat)
4. **Task 4: Create `tests/shadow-tests/bd-helper.test.mjs` (WARN-2 — 4 PATH-mocked cases)** — `c765fb7` (test)

**Plan-level fixup:**

5. **`docs(04-01)` — reword bd-helper comment to satisfy execSync-grep gate** — `d62fe01` (docs; `[Rule 3 - Blocking]` deviation, see Deviations below)

_Note: Tasks were executed in plan order. Each `tdd="true"` task is split across feat/test commit boundaries (Tasks 1+2 form the beads-errors RED/GREEN pair; Tasks 3+4 form the bd-helper RED/GREEN pair). The plan author intentionally ordered impl-before-test in each pair given the verbatim research §Pattern 2/3 source, so the strict-RED-first gate documented in `tdd_execution` is relaxed at plan author's discretion (plan `type: execute`, not `type: tdd`)._

## Files Created/Modified

- `bin/beads-errors.mjs` (55 LOC) — `BeadsCause` frozen enum + `BeadsUnavailableError` base + 4 subtypes (`BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty`). All exports named; no imports.
- `bin/bd-helper.mjs` (54 LOC) — `bd(args, opts)` wrapper around `spawnSync('bd', …)`. Imports `{ BeadsNotInstalled, BeadsCorrupt, BeadsEmpty }` from `./beads-errors.mjs`.
- `tests/shadow-tests/beads-errors.test.mjs` (38 LOC) — 4 cases via `node:test` + `assert/strict`; no fixture, pure JS class assertions.
- `tests/shadow-tests/bd-helper.test.mjs` (100 LOC) — 4 cases via `node:test` + PATH-injected bash shim. Uses `withMockBd(scriptBody, cb)` helper for tempdir + chmod 0o755 + PATH save/restore in `finally`.

## Decisions Made

- **`this.name = '<ClassName>'` on every subtype** (Pitfall 1 mitigation). Verbatim from RESEARCH §Pattern 2; preserves dispatcher's ability to fall back to `err.name === '…'` if `instanceof` ever splits across module copies (e.g., test imports via different URL).
- **`bd()` does NOT distinguish version-mismatch from other failures**. Per Task 3 scope statement, version detection is the dispatcher's job (or a future helper). All non-zero-exit cases route through `BeadsCorrupt`. Task 4's CASE 2 name "version-mismatch stderr" reflects the stderr CONTENT the shim emits, not the resulting subtype.
- **PATH-injection over module-mocking for bd-helper tests** (per WARN-2 / D-17). Exercises the real `spawnSync` code path; avoids ESM module-cache contamination; consistent with project bash-shim conventions (every existing test fixture uses `#!/usr/bin/env bash`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded bd-helper Pitfall-2 comment to remove literal "execSync" substring**
- **Found during:** post-Task-4 success-criteria verification (`grep -c "execSync" bin/bd-helper.mjs | grep -q '^0$'`)
- **Issue:** The plan's `<verification>` block requires `grep -c "execSync" bin/bd-helper.mjs` to return 0, asserting "bd-helper uses spawnSync only". Initial Task 3 implementation copied the suggested comment text from PATTERNS.md verbatim: `// Pitfall 2 mitigation: spawnSync (not execSync) so reads can fall through to upstream.` That comment matched the grep — making the verification gate fail despite zero `execSync(` function calls in the file. The plan author's verification command and the plan author's suggested comment text are mutually inconsistent.
- **Fix:** Reworded the comment to `// Pitfall 2 mitigation: spawnSync (NOT the throwing exec-sync helper) so reads can fall through to upstream.` — preserves the documentary intent (reader still understands why we don't use the throwing variant) while avoiding the literal `execSync` token. `grep -c` now returns 0; verification gate passes.
- **Files modified:** `bin/bd-helper.mjs`
- **Verification:** `grep -c "execSync" bin/bd-helper.mjs` → `0`. `node --test tests/shadow-tests/bd-helper.test.mjs` → 4/4 pass.
- **Committed in:** `d62fe01` (post-Task-4 docs commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — minor wording)
**Impact on plan:** Documentary-only edit; functional behavior of `bd()` unchanged. No scope creep. The deviation is recommended for an upstream PATTERNS.md / RESEARCH.md fix in a future cleanup pass so the inconsistency doesn't recur.

## Issues Encountered

None — plan executed smoothly. The PATH-injection bash shim approach worked first-try (chmod 0o755 was the load-bearing detail; without it the shim would have failed with EACCES masking the test). Suite duration well under the 5-second budget (62 ms).

## Threat Surface Coverage

The plan's `<threat_model>` flags four mitigation tasks; all are implemented:

- **T-04-01** (Tampering — bd-helper argv): `spawnSync('bd', args, { cwd, encoding: 'utf-8' })` — `args` is an array; no shell interpretation. Verified at `bin/bd-helper.mjs` line 23.
- **T-04-05** (Tampering — `instanceof` cross-ESM): each subtype overrides `this.name`. Verified by Task 2 CASE 3 (4 sub-asserts).
- **T-04-21** (Tampering — PATH shim leaks into other tests): `withMockBd` saves `oldPath` + `rmSync` tempdir, both in `finally`. Verified by Task 4 CASE 1's manual PATH save/restore + the helper-wrapped CASEs 2-4.
- **T-04-06 / T-04-07** dispositions are `accept`; no implementation needed.

No new security-relevant surface introduced beyond what the plan already enumerated.

## User Setup Required

None — pure-JS module additions; no external service configuration, no env vars, no install steps.

## Next Phase Readiness

- **Plan 04-02 (sentinel dispatch fall-through)** can immediately `import { BeadsUnavailableError } from '../../bin/beads-errors.mjs'` for the dispatcher's `try/catch`. The base class + the `err.name === 'BeadsUnavailableError'` fallback are both available.
- **Plans 04-03 / 04-04** (test stub + worktree fixtures) can `import { BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty } from '../../bin/beads-errors.mjs'` for the throw-mode variants.
- **Phases 5-9** read handlers can `import { bd } from '../../bin/bd-helper.mjs'` and let exceptions propagate to the dispatcher (D-13 contract).
- **WARN-2 follow-up addressed:** bd-helper.mjs has direct in-Phase-4 unit coverage of every throw branch via the PATH-mocked shim approach. Phase 5+ regressions in stderr-pattern matching or the `'error' in parsed` JSON branch will surface in `bd-helper.test.mjs`, not as a mysterious read-handler test failure.

## Self-Check: PASSED

**Files exist:**
- `/home/ellio/code/gsd-beads/.claude/worktrees/agent-ab4a54dd48952fe6c/bin/beads-errors.mjs` — FOUND
- `/home/ellio/code/gsd-beads/.claude/worktrees/agent-ab4a54dd48952fe6c/bin/bd-helper.mjs` — FOUND
- `/home/ellio/code/gsd-beads/.claude/worktrees/agent-ab4a54dd48952fe6c/tests/shadow-tests/beads-errors.test.mjs` — FOUND
- `/home/ellio/code/gsd-beads/.claude/worktrees/agent-ab4a54dd48952fe6c/tests/shadow-tests/bd-helper.test.mjs` — FOUND

**Commits exist (`git log --oneline f6fcac0..HEAD`):**
- `cbc5ddc feat(04-01): add BeadsUnavailableError sentinel hierarchy` — FOUND
- `8490446 test(04-01): add beads-errors unit tests (4 cases)` — FOUND
- `7d7375e feat(04-01): add bd() spawnSync wrapper helper` — FOUND
- `c765fb7 test(04-01): add bd-helper unit tests via PATH-mocked shim (WARN-2)` — FOUND
- `d62fe01 docs(04-01): reword bd-helper comment to satisfy execSync-grep gate` — FOUND

**Tests pass:** `node --test tests/shadow-tests/beads-errors.test.mjs tests/shadow-tests/bd-helper.test.mjs` → 8/8 pass / 0 fail / ~62 ms.

**Verification gates:**
- `grep -c "execSync" bin/bd-helper.mjs` → `0`
- Subtype `.name` fallback verified: `['BeadsUnavailableError','BeadsNotInstalled','BeadsCorrupt','BeadsVersionMismatch','BeadsEmpty']` matches expected.
- Existing tests unaffected: `node --test tests/shadow-tests/wrap-mutation.test.mjs` → still green.

---
*Phase: 04-findbeadsroot-parity-test-infrastructure*
*Completed: 2026-04-29*
