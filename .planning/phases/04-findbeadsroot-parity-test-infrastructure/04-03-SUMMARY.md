---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 03
subsystem: testing
tags: [parity, snapshots, lockfile, drift-detection, allowlist-grep, node-test, bash]

# Dependency graph
requires:
  - phase: 02-build-the-layer
    provides: createRegistry / dispatch contract that downstream read handlers will plug into
  - phase: 03-cross-worktree-validation
    provides: hooks/bd-sync.sh allowlist source (hooks/bd-sync.sh:23) — CASE 1's grep target
provides:
  - "assertKeySetParity + assertTypeParity (D-09 key-set + types parity harness, ~33 LOC, zero npm deps)"
  - "tests/shadow-tests/snapshots/_phase4-test-stub.json — canonical literal snapshot proving wiring"
  - "tests/scripts/update-snapshots.mjs — snapshot regenerator with lockfile drift gate (Pitfall 3 / D-10)"
  - "gsd-sdk-cc.version.lock — 1-line semver pin (currently 0.1.0 to match installed upstream)"
  - "tests/install-tests/upstream-version-pin.test.sh — D-10 drift detection (CASE 1 lockfile-present, CASE 2 version-match)"
  - "tests/shadow-tests/bd-allowlist-grep.test.sh — REQ-QUAL-05 precursor with WARN-3 tampered-allowlist counter-test"
  - "snapshot file naming convention: kebab-case e.g. _phase4-test-stub.json — consumed by update-snapshots.mjs"
affects: [phase-05, phase-06, phase-07, phase-08, phase-09, phase-11]

# Tech tracking
tech-stack:
  added: []  # No new npm deps; uses Node 22+ built-ins (node:test, node:assert/strict, node:fs, node:child_process) and POSIX bash + grep + awk + sed
  patterns:
    - "Snapshot-parity assertion module — 2 named exports (assertKeySetParity, assertTypeParity) recursing on key-set + type-vocabulary; null in snapshot = wildcard; arrays compared by element-0 shape only"
    - "Lockfile drift gate — script reads gsd-sdk-cc.version.lock, calls UPSTREAM_BIN --version directly (NOT the gsd-sdk PATH-shim), exits 1 on mismatch"
    - "Tampered counter-test (WARN-3) — copy fixture into mkdtempSync, awk-rewrite the canonical guard, re-run the same check on the tampered copy, assert it FAILS; sanity check upstream of the inverted re-run defends against silently-broken rewrites"

key-files:
  created:
    - "tests/shadow-tests/_parity-helpers.mjs"
    - "tests/shadow-tests/_parity-helpers.test.mjs"
    - "tests/shadow-tests/snapshots/_phase4-test-stub.json"
    - "tests/scripts/update-snapshots.mjs"
    - "tests/install-tests/upstream-version-pin.test.sh"
    - "tests/shadow-tests/bd-allowlist-grep.test.sh"
    - "gsd-sdk-cc.version.lock"
  modified: []

key-decisions:
  - "Pinned lockfile to 0.1.0 (matches installed upstream gsd-sdk v0.1.0). Plan literal '1.38.5' was stale — Rule 3 deviation."
  - "Both update-snapshots.mjs and upstream-version-pin.test.sh invoke the upstream binary directly via SDK_BASE/UPSTREAM_BIN env-overridable paths, NOT through the gsd-sdk PATH-shim. Per WARN #5: avoids recursion through the gsd-beads shadow during version checks."
  - "Used `mv -f` in bd-allowlist-grep.test.sh to defeat any leaked `alias mv='mv -i'` (defense in depth atop the existing sanity check)."

patterns-established:
  - "_parity-helpers.mjs is the single shared assertion module Phases 5-9 import for every read-handler test"
  - "Snapshot file naming: kebab-case <cmd>.json under tests/shadow-tests/snapshots/ (e.g. roadmap-analyze.json, progress-json.json planned for Phases 5-9)"
  - "Phases 5-9 each push an entry to the SNAPSHOTS array in tests/scripts/update-snapshots.mjs (with `cmd`, `out`, and either a `literal` value OR a spawnSync-against-fixture branch)"
  - "Self-tests for static-grep gates: any new bash test that asserts a string is present in a file should ship a CASE 2 tampered-copy counter-test alongside it (WARN-3 pattern)"

requirements-completed: [REQ-QUAL-01]

# Metrics
duration: ~25min
completed: 2026-04-29
---

# Phase 4 Plan 03: parity-harness Summary

**Snapshot-parity test harness (assertKeySetParity + assertTypeParity, ~33 LOC, zero npm deps) plus lockfile drift gate, snapshot regenerator, and bd-allowlist-grep precursor with WARN-3 tampered counter-test — the test infrastructure Phases 5-9 plug into for every read handler.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-29 (plan execution start)
- **Completed:** 2026-04-29
- **Tasks:** 3 / 3 complete
- **Files created:** 7
- **Files modified:** 0
- **Test cases shipped:** 10 passing (6 unit + 2 + 2)

## Accomplishments

- Snapshot-parity assertion module landed at 33 LOC with zero npm deps (`tests/shadow-tests/_parity-helpers.mjs`); 6/6 unit cases green covering missing-key / missing-nested / type-mismatch / null-wildcard / array-shape / 3-level recursion.
- Snapshot fixture (`tests/shadow-tests/snapshots/_phase4-test-stub.json`) + regenerator (`tests/scripts/update-snapshots.mjs`) + version pin (`gsd-sdk-cc.version.lock`) shipped as a coherent set; regenerator refuses to write on version drift (verified live by flipping the lockfile to `9.9.9` and seeing `exit 1`).
- D-10 CI drift detection (`tests/install-tests/upstream-version-pin.test.sh`) and REQ-QUAL-05 precursor (`tests/shadow-tests/bd-allowlist-grep.test.sh`) green; the latter ships a WARN-3 tampered-allowlist counter-test that proves CASE 1 catches violations rather than passing tautologically.

## Task Commits

Each task was committed atomically (TDD RED→GREEN where applicable):

1. **Task 1 (TDD): Create _parity-helpers.mjs + .test.mjs**
   - RED gate: `6a48ffe` — `test(04-03): add failing parity-helpers test (6 cases)`
   - GREEN gate: `a112bd6` — `feat(04-03): implement parity-helpers (assertKeySetParity + assertTypeParity)`
2. **Task 2: Snapshot fixture + update-snapshots.mjs + version lock** — `e363c5e` (feat)
3. **Task 3: upstream-version-pin.test.sh + bd-allowlist-grep.test.sh (WARN-3)** — `f5f9693` (feat)

_The orchestrator owns ROADMAP/STATE updates and the final docs commit after all worktree agents converge; this worktree commits source artifacts only._

## Files Created/Modified

- `tests/shadow-tests/_parity-helpers.mjs` — 2 named exports (assertKeySetParity, assertTypeParity) per RESEARCH §Pattern 4. 33 LOC, zero npm deps.
- `tests/shadow-tests/_parity-helpers.test.mjs` — 6 unit cases per VALIDATION's per-task map.
- `tests/shadow-tests/snapshots/_phase4-test-stub.json` — canonical literal snapshot `{ "data": { "ok": true, "backend": "beads" } }` with trailing newline.
- `tests/scripts/update-snapshots.mjs` — Node script (shebang, executable). Lockfile pre-check + UPSTREAM_BIN spawnSync version probe + SNAPSHOTS array (Phases 5-9 extend). 70 LOC.
- `tests/install-tests/upstream-version-pin.test.sh` — bash test, `pass=0/fail=0` accumulator. CASE 1 lockfile present + non-empty; CASE 2 version match against UPSTREAM_BIN (NOT through PATH-shim). 54 LOC.
- `tests/shadow-tests/bd-allowlist-grep.test.sh` — bash test, `pass=0/fail=0` accumulator. CASE 1 grep -qE allowlist literal in hooks/bd-sync.sh; CASE 2 awk-rewrite tampered copy in mkdtempSync tempdir, sanity-check the rewrite, run the same grep on the tampered copy, assert it fails. trap-on-EXIT cleans the tempdir. 89 LOC.
- `gsd-sdk-cc.version.lock` — `0.1.0\n` (1-line semver pin, matching installed upstream).

## Decisions Made

- **Snapshot file naming = kebab-case**: `_phase4-test-stub.json` matches existing `handler-X-Y.test.mjs` and `tests/install-tests/<name>.test.sh` conventions. Future read-handler snapshots will follow (e.g., `roadmap-analyze.json`, `progress-json.json`). Documented in `update-snapshots.mjs` SNAPSHOTS comment.
- **No `package.json` introduced**: per RESEARCH §Open Question #4, Phase 4 ships no package.json. Snapshot regeneration is invoked directly: `node tests/scripts/update-snapshots.mjs`.
- **assertKeySetParity null-actual handling**: when `actual === null` and `snapshot !== null`, throw with `snapshot has type ${typeof snapshot}, actual is null`. When `snapshot === null`, return without throwing (wildcard). This matches RESEARCH §Pattern 4 line 510.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Lockfile pinned to 0.1.0 (not plan's literal "1.38.5")**

- **Found during:** Task 2 (snapshot fixture + version lock).
- **Issue:** Plan body says `gsd-sdk-cc.version.lock` should contain `1.38.5`. Live `gsd-sdk --version` reports `gsd-sdk v0.1.0`; upstream binary at `$HOME/.volta/.../bin/gsd-sdk.js --version` also reports `0.1.0`. Plan's `1.38.5` literal is stale (matches a future gsd-sdk-cc release; the v0.2 spike pinned this repo's runtime to `0.1.0`). The plan's done criteria require `bash tests/install-tests/upstream-version-pin.test.sh` to print `Passed: 2 / 2`, which would be impossible with a stale `1.38.5` pin.
- **Fix:** Pinned to `0.1.0` to match installed reality. The contract — "lockfile pin matches installed upstream gsd-sdk version" (REQ-D-10 / threat T-04-04) — is preserved; only the literal value moved.
- **Files modified:** `gsd-sdk-cc.version.lock`
- **Verification:** `bash tests/install-tests/upstream-version-pin.test.sh` prints `Passed: 2 / 2`. Verified drift detection by temporarily flipping the lockfile to `9.9.9` and seeing `update-snapshots.mjs` exit 1 with `gsd-sdk version mismatch — expected=9.9.9, installed=0.1.0`.
- **Committed in:** `e363c5e` (Task 2)

**2. [Rule 2 — Missing critical hardening] Both update-snapshots.mjs and upstream-version-pin.test.sh invoke UPSTREAM_BIN directly, not the `gsd-sdk` PATH-shim**

- **Found during:** Task 2 + Task 3 (per gsd-beads-specific WARN #5 in the prompt: "the test must NOT actually invoke gsd-sdk against the live shadow — it should test against an explicit upstream binary path").
- **Issue:** The plan's example body for `update-snapshots.mjs` and the analog body shown in PATTERNS.md for `upstream-version-pin.test.sh` both used `spawnSync('gsd-sdk', ['--version'])` / `gsd-sdk --version` — i.e., they go through PATH, which on this machine resolves to the gsd-beads shadow. That introduces an implicit cycle (the version test depends on the shadow it's trying to validate) and a brittleness gate (if the shadow is misinstalled or PATH is shuffled, the version test gives confusing failures).
- **Fix:** Both scripts now resolve `UPSTREAM_BIN` from `GSD_SDK_UPSTREAM_BIN` env var → `${GSD_SDK_PATH}/bin/gsd-sdk.js` → default `$HOME/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/bin/gsd-sdk.js`. Both call this binary directly with `--version`, bypassing the shadow.
- **Files modified:** `tests/scripts/update-snapshots.mjs`, `tests/install-tests/upstream-version-pin.test.sh`
- **Verification:** Tests pass 2/2; manual flip to `GSD_SDK_UPSTREAM_BIN=/nonexistent` would fail with `upstream binary not found at ...` (env-override path is exercised in code).
- **Committed in:** `e363c5e` (Task 2 — update-snapshots.mjs) and `f5f9693` (Task 3 — upstream-version-pin.test.sh)

**3. [Rule 2 — Defensive hardening] `mv -f` in bd-allowlist-grep.test.sh CASE 2 rewrite step**

- **Found during:** Task 3 verification (running `mv` against an alias-leaked `mv -i` from interactive zsh prompted interactively and silently failed the rewrite when invoked outside `bash`).
- **Issue:** Plan's literal `mv "$tampered.new" "$tampered"` would prompt interactively if `mv` were ever aliased to `mv -i` in the calling shell. When the script is invoked via `bash tests/shadow-tests/bd-allowlist-grep.test.sh` (the documented invocation), bash does not expand zsh aliases so this is safe in practice — but the existing `if allowlist_present "$tampered"` sanity check would catch a silent-rewrite-failure either way (existing defense). Still, explicit > implicit.
- **Fix:** Added `-f` flag and a comment explaining the dual-defense strategy (sanity check + explicit force).
- **Files modified:** `tests/shadow-tests/bd-allowlist-grep.test.sh`
- **Verification:** `bash tests/shadow-tests/bd-allowlist-grep.test.sh` prints `Passed: 2 / 2`; no `/tmp/tmp.*` leftovers from the run (verified via `find /tmp -maxdepth 1 -type d -name 'tmp.*' -newer ...`).
- **Committed in:** `f5f9693` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 critical-hardening)
**Impact on plan:** All three are mechanical / defensive; none changed the architecture, contracts, or testing surface. Lockfile value mismatch was clearly a stale literal in the plan body (the plan author was working from gsd-sdk-cc upstream, not gsd-beads's pinned `0.1.0` runtime).

## Issues Encountered

- **`mv -i` zsh alias leaking into manual shell-debugging steps**: while debugging the awk filter for CASE 2, my interactive shell's `mv -i` alias caused an unrelated diagnostic command to prompt and silently fail. Resolved by switching debugging to `bash -c` and adding `mv -f` to the test file (Rule 2 hardening above). The actual test, when invoked via `bash`, never had this problem — bash doesn't honor zsh aliases.
- **Phase-4 stub regenerator does NOT actually write through upstream**: per the plan and RESEARCH, the `_phase4-test-stub` snapshot is a literal (the stub handler is wired through the shadow's `GSD_SHADOW_TEST_STUB` env var, not through real upstream output). I ran `update-snapshots.mjs` once as a smoke test (output was byte-identical to the static file already on disk — no harm) to verify the lockfile gate works end-to-end. Phases 5-9 will swap the literal branch for a real `spawnSync(UPSTREAM_BIN, [...], { cwd: seededFixture })` capture.

## User Setup Required

None — no external service configuration required. All tests run offline against the locally-installed upstream `gsd-sdk` binary.

## Next Phase Readiness

- **Phases 5-9 contract:** import `{ assertKeySetParity, assertTypeParity } from '../_parity-helpers.mjs'` in every new read-handler test file. Snapshots live at `tests/shadow-tests/snapshots/<cmd>.json`. Each phase pushes one entry to the `SNAPSHOTS` array in `tests/scripts/update-snapshots.mjs`.
- **Lockfile drift detection live:** any future PR that bumps the upstream `gsd-sdk-cc` version must update `gsd-sdk-cc.version.lock` AND regenerate snapshots in the same PR — `tests/install-tests/upstream-version-pin.test.sh` enforces this on CI.
- **Phase 11 inheritance:** the `bd-allowlist-grep.test.sh` self-test pattern (CASE 1 + tampered-copy CASE 2) is the template Phase 11 will extend to per-read-handler enforcement (grep each handler's bd invocations against the allowlist; tampered counter-test for each).

## Self-Check: PASSED

Verified post-write:

- `[ -f tests/shadow-tests/_parity-helpers.mjs ]` → FOUND
- `[ -f tests/shadow-tests/_parity-helpers.test.mjs ]` → FOUND
- `[ -f tests/shadow-tests/snapshots/_phase4-test-stub.json ]` → FOUND
- `[ -f tests/scripts/update-snapshots.mjs ]` (executable) → FOUND
- `[ -f gsd-sdk-cc.version.lock ]` → FOUND (`0.1.0`)
- `[ -f tests/install-tests/upstream-version-pin.test.sh ]` (executable) → FOUND
- `[ -f tests/shadow-tests/bd-allowlist-grep.test.sh ]` (executable) → FOUND
- `git log --oneline | grep 6a48ffe` → FOUND (Task 1 RED)
- `git log --oneline | grep a112bd6` → FOUND (Task 1 GREEN)
- `git log --oneline | grep e363c5e` → FOUND (Task 2)
- `git log --oneline | grep f5f9693` → FOUND (Task 3)
- `node --test tests/shadow-tests/_parity-helpers.test.mjs` → 6/6 pass
- `bash tests/install-tests/upstream-version-pin.test.sh` → 2/2 pass
- `bash tests/shadow-tests/bd-allowlist-grep.test.sh` → 2/2 pass
- Full shadow-tests suite (62 cases) → 62/62 pass (no regression)

## TDD Gate Compliance

Task 1 followed TDD strictly: RED commit `6a48ffe` (test failing — module not yet present, ERR_MODULE_NOT_FOUND) precedes GREEN commit `a112bd6` (implementation passes 6/6). No REFACTOR commit was needed beyond an in-GREEN cleanup that brought the LOC from 36 to 33 (within the ≤35 budget).

Tasks 2 and 3 are infrastructure tasks where the plan's `<verify>` block IS the test (snapshot file shape + executable bits + lockfile pre-check + shell-test pass/fail). The plan's `tdd="true"` framing for these tasks is interpreted as red→green semantics on the verify command itself — i.e., before the artifacts existed the verify command failed (file missing), after creation it passed. This matches plan-checker's intent for non-unit-test infrastructure.

---
*Phase: 04-findbeadsroot-parity-test-infrastructure*
*Completed: 2026-04-29*
