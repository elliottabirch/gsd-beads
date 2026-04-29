---
phase: 04-findbeadsroot-parity-test-infrastructure
verified: 2026-04-29T14:30:00Z
status: passed
score: 7/7 must-haves verified (4 ROADMAP SC + 3 D-05 expanded)
overrides_applied: 0
re_verification: false
---

# Phase 4: findBeadsRoot() + parity test infrastructure — Verification Report

**Phase Goal:** Read-side detection and shared test harness are in place before any read handler is written, so every subsequent phase plugs into the same parity, fallback, and worktree-correct foundation.

**Verified:** 2026-04-29T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 (ROADMAP SC #1) | `findBeadsRoot()` resolves correctly across worktree topology (BEADS_DIR env first, parent-walk bounded at git root, follows symlinks) | VERIFIED | `bin/gsd-sdk-shadow.mjs:236-281` exports `findBeadsRoot(start)`. Line 237-244 honors `BEADS_DIR` first (D-01); line 246 calls `realpathSync` (D-03 symlink follow); lines 248-274 walk parents bounded at `.git` (D-02); line 277-279 walks parent + halts at filesystem root. Tests `tests/shadow-tests/findBeadsRoot.test.mjs` (5/5 cases pass): worktree→source, BEADS_DIR override, symlink, non-bd null, root-halt null. Real `git worktree add` fixture (D-17). |
| 2 (ROADMAP SC #2) | Read-side dispatch recognizes `BeadsUnavailableError` sentinel; falls through via `spawnUpstream(argv)` instead of `process.exit(1)`. v0.1 mutation behavior unchanged. | VERIFIED | `bin/gsd-sdk-shadow.mjs:402-413`: catch block tests `err instanceof BeadsUnavailableError \|\| isKnownBdCliError(err)`; calls `spawnUpstream(argv)` followed by explicit `return;` (BLOCKER-1 structural guarantee). Real bugs (TypeError) still emit `[gsd-sdk-shadow] dispatch failed` + exit 1. Test `handler-_phase4-test-stub.test.mjs` 6/6 pass: CASE 1 happy path; CASES 2-5 four subtypes fall through (no dispatch-failed marker); CASE 6 TypeError dual assertion (notEqual status 0 + dispatch-failed match). Mutation suite 45/45 pass (no regression). |
| 3 (ROADMAP SC #3) | Reusable parity-test helper at `tests/shadow-tests/_parity-helpers.mjs` supports red→green workflow (key-set + types parity per D-09). | VERIFIED | `tests/shadow-tests/_parity-helpers.mjs` (33 LOC) exports `assertKeySetParity` + `assertTypeParity`; null-in-snapshot acts as wildcard (D-09); recurses on objects, element-0 only on arrays. Test `_parity-helpers.test.mjs` 6/6 pass (missing-key, nested missing, type mismatch, null wildcard, array shape, 3-level recursion). Snapshot `tests/shadow-tests/snapshots/_phase4-test-stub.json` exists with literal `{ "data": { "ok": true, "backend": "beads" } }`. Regenerator `tests/scripts/update-snapshots.mjs` writes via `SNAPSHOTS` array (extension point for Phases 5-9). |
| 4 (ROADMAP SC #4) | `BEADS_READ_OVERRIDES` declared and registered without `wrapMutation`; comment near `BEADS_OVERRIDES` updated. | VERIFIED | `bin/gsd-sdk-shadow.mjs:287` exports `BEADS_READ_OVERRIDES = {}` (empty by default; stub registered only when `GSD_SHADOW_TEST_STUB === '1'`). Line 370-372 second register loop registers entries via `registry.register(cmd, handler)` — NO `wrapMutation` (D-09 forward-compat). Comment at lines 4-6 reads "13 mutation entries (BEADS_OVERRIDES) live here. Reads (BEADS_READ_OVERRIDES) register separately". Confirmed live: `BEADS_OVERRIDES count: 13`, `BEADS_READ_OVERRIDES count: 0`. Manual smoke: `gsd-sdk query roadmap.analyze --project-dir <bd-fixture>` falls through to upstream (returns upstream's "ROADMAP.md not found" error), no dispatch-failed marker. |
| 5 (D-05 expanded) | STATE.md per-worktree: `regen-state.sh` reads worktree-local milestone source, NOT bd. | VERIFIED | `scripts/regen-state.sh:61-63` — reads `git config --worktree gsd-beads.milestone` first, then `${GSD_MILESTONE:-}` env override, then "(unset)" fallback. NO `bd` invocation in script body (only `git`, `flock`, `mkdir`, `mv`, `printf`). Lock preamble byte-identical to `regen-roadmap.sh:16-39` (verbatim reuse). Wired into `hooks/bd-sync.sh:66-70` (project-local first, `$SCRIPTS` fallback, fail-soft). |
| 6 (D-05/D-08) | Multi-milestone fixture in Phase 4 (deterministic seeder + committed `seed.jsonl`). | VERIFIED | `tests/fixtures/seed.jsonl` (7 lines) contains v0.1×2 closed, v0.2×3 open, v0.3×2 open with `version:vX.Y` + `gsd:phase` labels. `tests/fixtures/build-seed.sh` is the source-of-truth builder (committed); `tests/fixtures/seed-fixture.sh` restores via `bd init --from-jsonl`. `BEADS_ACTOR=seed` on every bd call (Pitfall 8). `seed-determinism.test.sh` 2/2 pass: CASE 1 byte-identical bd export across two restores (D-07); CASE 2 v01=2-closed, v02=3-open, v03=2-open (D-08). |
| 7 (D-05 expanded) | Worktree-A milestone view differs from Worktree-B view against shared bd store. | VERIFIED | `tests/shadow-tests/milestone-scoping.test.mjs` 2/2 pass. Fixture co-locates source + 2 worktrees; `git config extensions.worktreeConfig true` set BEFORE worktree add (T-04-19); worktree-A → `gsd-beads.milestone=v0.2`, worktree-B → `v0.3`; both share one bd store seeded into `src/.beads`. CASE 1: WT-A STATE.md matches `/v0\.2/` and does NOT match `/v0\.3/`. CASE 2: WT-B mirror. |

**Score:** 7 / 7 truths VERIFIED.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `bin/beads-errors.mjs` | Sentinel hierarchy (base + 4 subtypes, frozen `BeadsCause` enum, per-subtype `.name` for ESM-split fallback per Pitfall 1) | VERIFIED | 55 LOC. `BeadsCause` `Object.freeze`d (5 string enum: not-installed, corrupt, version-mismatch, empty, unknown). `BeadsUnavailableError` extends `Error`; subtypes `BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty` each set `this.name`. `originalError` preserved on construction (D-14). 4/4 unit tests pass. |
| `bin/bd-helper.mjs` | `bd(args, opts)` `spawnSync` wrapper that throws sentinel subtypes (D-13 helpers-throw / handlers-clean) | VERIFIED | 54 LOC. Imports `BeadsNotInstalled`, `BeadsCorrupt`, `BeadsEmpty`. ENOENT→`BeadsNotInstalled`; non-zero exit→`BeadsCorrupt` (regex-tested for "database\|dolt\|metadata.json" stderr); non-JSON stdout→`BeadsCorrupt`; bd's empty-error shape `{error, schema_version}`→`BeadsEmpty`. Uses `spawnSync` only (`grep -c "execSync" → 0`). 4/4 PATH-mocked unit tests pass. |
| `bin/gsd-sdk-shadow.mjs` (extended) | `findBeadsRoot` exported, `BEADS_READ_OVERRIDES` exported, sentinel-aware dispatch, env-gated stub | VERIFIED | 415 LOC (was 315, +96 net). Imports added (lines 9-20), `findBeadsRoot` (236-281), `BEADS_READ_OVERRIDES` + conditional stub (287-300), `isKnownBdCliError` (304-307), second register loop (370-372), sentinel try/catch (396-414) with explicit BLOCKER-1 `return;`. D-02 invariant header comment updated (lines 4-6). |
| `scripts/regen-state.sh` | Per-worktree STATE.md regenerator using `git config --worktree gsd-beads.milestone` | VERIFIED | 93 LOC, executable. GSD-BEADS LOCK PREAMBLE v1 verbatim from `regen-roadmap.sh:16-39`. Atomic write via mktemp+mv. Reads worktree-local milestone source; never invokes bd. STATE.md emits markdown bold `**Current milestone:** v…` line for grep-based assertions. |
| `tests/shadow-tests/_parity-helpers.mjs` | Snapshot-parity harness (key-set + types per D-09) | VERIFIED | 33 LOC, zero npm deps. Two named exports. Documented as the module Phases 5-9 import for every read-handler test. |
| `tests/shadow-tests/snapshots/_phase4-test-stub.json` | Single literal snapshot proving wiring | VERIFIED | 7 lines (with trailing newline), `{ "data": { "ok": true, "backend": "beads" } }`. Matches stub handler's return shape; consumed by `update-snapshots.mjs` SNAPSHOTS array (literal branch). |
| `tests/scripts/update-snapshots.mjs` | Snapshot regenerator with lockfile drift gate | VERIFIED | 70 LOC. Reads `gsd-sdk-cc.version.lock`, refuses to write when missing/empty/mismatched. Invokes UPSTREAM_BIN directly (not gsd-sdk PATH-shim) to avoid recursion through gsd-beads shadow (WARN-5 mitigation). |
| `tests/install-tests/upstream-version-pin.test.sh` | D-10 CI drift detection | VERIFIED | 54 LOC. CASE 1 lockfile present + non-empty; CASE 2 invokes UPSTREAM_BIN `--version` and matches against lockfile. 2/2 pass. |
| `tests/shadow-tests/bd-allowlist-grep.test.sh` | REQ-QUAL-05 precursor | VERIFIED | 89 LOC. CASE 1 grep canonical allowlist literal in `hooks/bd-sync.sh`. CASE 2 WARN-3 self-test: copy-tamper-recheck proves CASE 1 catches violations (not tautological). 2/2 pass. |
| `tests/shadow-tests/findBeadsRoot.test.mjs` | 5 cases (worktree, BEADS_DIR, symlink, non-bd, root-halt) | VERIFIED | 102 LOC. Real `git worktree add` fixture (D-17). 5/5 cases pass. ~1s per fixture. |
| `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` | 6 cases (happy + 4 sentinel subtypes + real-bug) | VERIFIED | 140 LOC. CASE 6 BLOCKER-1 dual assertion (`assert.notEqual(status, 0) && assert.match(stderr, /dispatch failed/)`). 6/6 pass. |
| `tests/shadow-tests/beads-errors.test.mjs` | ~4 cases for instanceof parity | VERIFIED | 38 LOC. 4/4 cases pass: subtype instanceof base + Error + cause; frozen enum; per-subtype `.name`; `originalError` preserved. |
| `tests/shadow-tests/bd-helper.test.mjs` | PATH-mocked bd-shim coverage | VERIFIED | 100 LOC. `withMockBd` helper (mkdtemp+chmod+PATH save/restore in finally — T-04-21). 4/4 cases. |
| `tests/shadow-tests/_parity-helpers.test.mjs` | ~6 cases for parity helper module | VERIFIED | 6/6 cases pass: missing-key, missing-nested, type mismatch, null wildcard, array element-0, 3-level recursion. |
| `tests/shadow-tests/seed-determinism.test.sh` | D-07/D-08 reproducibility + content | VERIFIED | 78 LOC. CASE 1 D-07 byte-identical bd export across two seeds; CASE 2 D-08 multi-milestone counts. 2/2 pass. |
| `tests/shadow-tests/milestone-scoping.test.mjs` | D-05 worktree-A vs worktree-B view | VERIFIED | 87 LOC. extensions.worktreeConfig=true set BEFORE worktree add (T-04-19). 2/2 pass. |
| `tests/fixtures/build-seed.sh` | Source-of-truth bash builder | VERIFIED | 73 LOC. `BEADS_ACTOR=seed` on every bd call. Builds 7 phases across v0.1/v0.2/v0.3. Emits to `seed.jsonl`. |
| `tests/fixtures/seed.jsonl` | Committed canonical bd state | VERIFIED | 7 lines, ~2.6 KB. Each line `_type=issue` with `id`, `title`, `status`, `priority`, `issue_type`, `created_at`, `updated_at`, `labels`. v0.1×2 closed (status=closed), v0.2×3 open, v0.3×2 open. |
| `tests/fixtures/seed-fixture.sh` | Deterministic restorer via `bd init --from-jsonl` | VERIFIED | 30 LOC. Idempotent. Chmods `.beads` to 700 (bd warns at 0755). |
| `gsd-sdk-cc.version.lock` | 1-line semver pin | VERIFIED | Contains `0.1.0` (matches installed upstream — see Deviations section). |

---

## Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `bin/gsd-sdk-shadow.mjs` | `bin/beads-errors.mjs` | `import { BeadsUnavailableError, BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty }` (line 14-20) | WIRED | Used in `instanceof` check (line 403) and conditional stub throw branches (lines 293-297). |
| `bin/bd-helper.mjs` | `bin/beads-errors.mjs` | `import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty }` (line 8) | WIRED | Used in throw branches throughout `bd()`. |
| `BEADS_READ_OVERRIDES` registration | `dispatch loop` | `for (const [cmd, handler] of Object.entries(BEADS_READ_OVERRIDES)) registry.register(cmd, handler);` (line 370-372) | WIRED | Registered AFTER mutation overrides. NO `wrapMutation` wrapper. Verified live: GSD_SHADOW_TEST_STUB=1 enables `_phase4-test-stub` via dispatcher. |
| `dispatch try/catch` | `spawnUpstream` | `if (err instanceof BeadsUnavailableError ‖ isKnownBdCliError(err)) { … spawnUpstream(argv); return; }` (line 402-411) | WIRED | Explicit `return;` ensures structural guarantee against future refactors of `spawnUpstream`. Test CASE 6 dual assertion catches regressions. |
| `hooks/bd-sync.sh` | `scripts/regen-state.sh` | `if [ -x "$PROJECT_DIR/scripts/regen-state.sh" ]; then "$PROJECT_DIR/scripts/regen-state.sh" \|\| true` (line 66-70) | WIRED | Hook fires on PostToolUse; project-local script preferred over `$SCRIPTS` fallback; fail-soft. |
| `tests/fixtures/seed-fixture.sh` | `tests/fixtures/seed.jsonl` | `cp "$seed_jsonl" "$target/.beads/issues.jsonl"; bd init --from-jsonl` (line 27-28) | WIRED | Restorer reads committed JSONL, runs `bd init --from-jsonl` against target tempdir. |
| `tests/scripts/update-snapshots.mjs` | `gsd-sdk-cc.version.lock` | `readFileSync(LOCK)` → mismatch → `process.exit(1)` (line 33-45) | WIRED | Refuses to regenerate snapshots on version drift. Uses UPSTREAM_BIN directly, not PATH shim. |

All key links verified. No orphaned artifacts.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Module exports correct | `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => console.log(typeof m.findBeadsRoot, Object.keys(m.BEADS_OVERRIDES).length, Object.keys(m.BEADS_READ_OVERRIDES).length))"` | `function 13 0` | PASS |
| Stub registers when env-gated | `GSD_SHADOW_TEST_STUB=1 node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => console.log(Object.keys(m.BEADS_READ_OVERRIDES)))"` | `[ '_phase4-test-stub' ]` | PASS |
| Unmapped read on bd fixture falls through to upstream (SC #4) | Seeded bd fixture, then `node bin/gsd-sdk-shadow.mjs query roadmap.analyze --project-dir <fixture>` | Upstream's `{"data":{"error":"ROADMAP.md not found",…}}` returned (exit 0). No `[gsd-sdk-shadow] dispatch failed` marker. | PASS |
| Full shadow test suite | `node --test tests/shadow-tests/*.test.mjs` | 83 tests / 83 pass / 0 fail / 18.3s | PASS |
| Phase 4-only suite | `node --test` of 6 Phase 4 mjs files | 27 tests / 27 pass / 0 fail / 7.9s (5 findBeadsRoot + 6 stub + 4 beads-errors + 4 bd-helper + 6 parity-helpers + 2 milestone-scoping) | PASS |
| Seed determinism | `bash tests/shadow-tests/seed-determinism.test.sh` | Passed: 2 / 2 | PASS |
| bd allowlist grep | `bash tests/shadow-tests/bd-allowlist-grep.test.sh` | Passed: 2 / 2 | PASS |
| Upstream version pin | `bash tests/install-tests/upstream-version-pin.test.sh` | Passed: 2 / 2 (`lockfile 0.1.0 matches installed 0.1.0`) | PASS |
| `bd-helper.mjs` execSync gate | `grep -c "execSync" bin/bd-helper.mjs` | `0` | PASS |
| v0.1 mutation behavior unchanged | mutation handler tests run as part of full suite (45 cases) | All 45 mutation cases pass within the 83-total suite | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REQ-QUAL-01 | 04-03 (parity-harness) | Output shape parity via snapshot tests | SATISFIED (Phase 4 plumbing) | `_parity-helpers.mjs` exists, 6/6 unit cases pass; `_phase4-test-stub.json` snapshot present; `update-snapshots.mjs` regenerator with lockfile gate. Phases 5-9 will use this. The contract — handler tests can red→green via captured snapshot — is proven by the stub handler's snapshot. |
| REQ-QUAL-02 | 04-01 (sentinel-hierarchy) + 04-02 (shadow-integration) | Read-shaped fallback contract via BeadsUnavailableError | SATISFIED | Subtypes implemented (4 + base, all `instanceof` parity). Dispatcher catch (line 402-411) falls through on sentinel + bd-CLI errors. CASE 6 BLOCKER-1 dual assertion validates real-bug loud-fail. 6/6 stub tests + 4/4 beads-errors tests + 4/4 bd-helper tests = 14/14 pass. |
| REQ-QUAL-03 | 04-02 (shadow-integration) | findBeadsRoot for reads | SATISFIED | All 5 cases covered: worktree (CASE 1), BEADS_DIR (CASE 2), symlink (CASE 3), non-bd null (CASE 4), root-halt (CASE 5). 5/5 pass. Real `git worktree add` fixture (D-17). |

ORPHANED requirements: NONE — REQUIREMENTS.md maps Phase 4 to exactly REQ-QUAL-01..03; all three are claimed by plans 04-01..04-04 and verified above.

---

## Decision Honor (CONTEXT D-01..D-18)

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-01 BEADS_DIR env first | HONORED | `findBeadsRoot` lines 237-244 — checks env first via `realpathSync`, returns `dirname(resolved)` if `metadata.json` present. |
| D-02 Parent-walk bounded at git root | HONORED | Lines 248-274 halt walk when `.git` is a directory; line 277-279 halts at filesystem root. |
| D-03 Follow symlinks via realpathSync | HONORED | `realpathSync(resolve(start))` on line 246; CASE 3 test verifies symlinked `.beads/`. |
| D-04 isBeadsManaged unchanged | HONORED | Function still at `bin/gsd-sdk-shadow.mjs:320-322`, unchanged from v0.1. New `findBeadsRoot` is module-level export, not a replacement. |
| D-05 STATE.md per-worktree + regen-state.sh | HONORED | `scripts/regen-state.sh` reads `git config --worktree gsd-beads.milestone` (line 61); never calls bd. Multi-milestone fixture proves WT-A v0.2 ≠ WT-B v0.3 against shared bd store (`milestone-scoping.test.mjs` 2/2). |
| D-06 Static JSON snapshots | HONORED | `tests/shadow-tests/snapshots/_phase4-test-stub.json` is a static JSON file in the repo. |
| D-07 Deterministic seeder | HONORED | `seed-determinism.test.sh` CASE 1 asserts byte-identical bd export across two restores via `bd init --from-jsonl`. |
| D-08 Multi-milestone fixture from day one | HONORED | `seed.jsonl` contains v0.1×2 closed, v0.2×3 open, v0.3×2 open. |
| D-09 Parity = key-set + types only | HONORED | `assertKeySetParity` (key set) + `assertTypeParity` (types) — separate exports. Values not compared (D-09 contract). |
| D-10 CI lockfile pin + drift detection | HONORED | `gsd-sdk-cc.version.lock` (`0.1.0`); `update-snapshots.mjs` refuses to write on mismatch; `upstream-version-pin.test.sh` 2/2 pass. |
| D-11 Subtype hierarchy (base + 4) | HONORED | `BeadsUnavailableError` base + `BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty`. All instanceof tests pass. |
| D-12 Dispatcher catches sentinel OR bd-CLI errors | HONORED | Line 403: `err instanceof BeadsUnavailableError \|\| isKnownBdCliError(err)`. `isKnownBdCliError` checks `code === 'ENOENT'` and stderr regex. |
| D-13 Helpers throw, handlers stay clean | HONORED | `bd()` (bd-helper.mjs) throws sentinel subtypes; `findBeadsRoot()` returns null (NOT throws) per D-13 ("null is normal, not exceptional"). |
| D-14 Sentinel metadata `{cause, originalError}` | HONORED | `BeadsCause` frozen 5-string enum (lines 10-16, beads-errors.mjs); `originalError` preserved via constructor opts. |
| D-15 Stub registered in BEADS_READ_OVERRIDES (env-gated) | HONORED | Line 290-300: stub registered ONLY when `process.env.GSD_SHADOW_TEST_STUB === '1'`. Stub returns `{data:{ok:true,backend:'beads'}}` matching D-15 fixed shape. |
| D-16 Stub takes flag/env to throw each subtype | HONORED | `GSD_SHADOW_TEST_STUB_THROW=corrupt\|not-installed\|version-mismatch\|empty\|typeerror` matrix verified by 6 test cases (lines 292-297). |
| D-17 Real `git worktree add` setup in tests | HONORED | `findBeadsRoot.test.mjs` `worktreeBeadsFixture()` runs `git init`, `git worktree add`, `bd init` for real. |
| D-18 Multi-milestone seeder is Phase 4 deliverable | HONORED | `tests/fixtures/build-seed.sh` + `seed.jsonl` + `seed-fixture.sh` shipped in Phase 4 (commit `ad9452d`). |

All 18 locked decisions reflected in code/tests/scripts.

---

## Anti-Patterns Found

NONE. Scan of all created/modified files (`bin/beads-errors.mjs`, `bin/bd-helper.mjs`, `bin/gsd-sdk-shadow.mjs` Phase-4 sections, `scripts/regen-state.sh`, `tests/shadow-tests/_parity-helpers.mjs`, `tests/scripts/update-snapshots.mjs`, all Phase 4 test files) found:

- No TODO/FIXME/XXX/HACK markers
- No "placeholder", "coming soon", "not yet implemented" strings
- No empty implementations (`return null`, `=> {}`, etc.) outside D-13's intentional `findBeadsRoot()` null returns
- No stub data flowing to user-visible output (the `_phase4-test-stub` is an explicit, env-gated test fixture)
- The "Phase 5 deletes this block" / "Phases 5-9 add entries" comments are intentional lifecycle markers documenting where Phase 5 picks up, not unfinished work

The `_phase4-test-stub` handler returns hardcoded `{ data: { ok: true, backend: 'beads' } }` — this is INTENTIONAL per D-15. It is gated by `GSD_SHADOW_TEST_STUB === '1'` (production binary never registers it) and Phase 5's first task is documented to delete it.

---

## Notable Deviations (called out in objective)

All four substantive deviations from SUMMARY.md are correctly handled:

### 04-01 — `bd-helper.mjs` Pitfall-2 comment reworded

**Status:** ACCEPTED. Plan's verification gate `grep -c "execSync" bin/bd-helper.mjs == 0` was self-inconsistent with the suggested comment text (which contained the literal `execSync` token). Deviation reworded comment to "spawnSync (NOT the throwing exec-sync helper)" — preserves documentary intent, satisfies gate. Confirmed live: `grep -c "execSync" bin/bd-helper.mjs → 0`. Functional behavior unchanged. (Commit `d62fe01`.)

### 04-02 — `findBeadsRoot` check order: `.git` BEFORE `.beads/metadata.json`

**Status:** ACCEPTED. RESEARCH §Pattern 1's verbatim impl checked `.beads/metadata.json` first, but `bd init` commits `metadata.json` into the git tree (intentional bd behavior — see `.beads/.gitignore`), so every worktree inherits its own copy even though the actual bd state (Dolt store) lives only in the source repo. The verbatim check order returned the worktree path instead of source root, violating REQ-QUAL-03 contract. Fix re-orders the parent-walk: at each level, check `.git` first; if FILE (worktree marker), parse `gitdir:` and walk up three dirnames to source root. CASE 1 of `findBeadsRoot.test.mjs` directly asserts `findBeadsRoot(wt) === src`, proving the fix. Verified by inspection of `bin/gsd-sdk-shadow.mjs:248-279` and Task 2 GREEN commit `346962c`.

### 04-03 — Lockfile pinned to `0.1.0` (not stale `1.38.5`)

**Status:** ACCEPTED. `gsd-sdk --version` reports `0.1.0`; UPSTREAM_BIN reports `0.1.0`. Plan's `1.38.5` literal was stale (likely a future gsd-sdk-cc release pinned in PATTERNS.md). The contract — "lockfile pin matches installed upstream gsd-sdk version" — is preserved; only the literal value moved. `upstream-version-pin.test.sh` CASE 2 prints `lockfile 0.1.0 matches installed 0.1.0` (Passed: 2 / 2). When `gsd-sdk-cc` is upgraded later, `/gsd-update` will bump lockfile + regenerate snapshots in the same PR (D-10 contract).

### 04-04 — `bd-sync.sh` clobbered REQUIREMENTS.md/ROADMAP.md mid-execution

**Status:** ACCEPTED. The hook fired during a bd-touching exploration step in Plan 04-04; restored cleanly via `git checkout HEAD -- .planning/REQUIREMENTS.md .planning/ROADMAP.md` before committing. Subsequent bd-touching operations were wrapped in `bash <script>` invocations to avoid triggering the hook on the parent shell's commands. No corruption persisted; current REQUIREMENTS.md/ROADMAP.md are intact (verified by reading them in full above — both have all expected sections and frontmatter).

---

## Test Green-Light Summary

| Suite | Count | Pass | Fail | Notes |
| ----- | ----- | ---- | ---- | ----- |
| Full shadow tests `node --test tests/shadow-tests/*.test.mjs` | 83 | 83 | 0 | 18.3s; meets the 83/83 expectation in the verification criteria. Includes 45 v0.1 mutation handler cases (regression-safe). |
| Phase 4-only suite (6 files) | 27 | 27 | 0 | 7.9s; all five new Phase 4 modules + milestone-scoping. |
| `seed-determinism.test.sh` | 2 | 2 | 0 | D-07 (byte-identical) + D-08 (multi-milestone counts). |
| `bd-allowlist-grep.test.sh` | 2 | 2 | 0 | CASE 1 + WARN-3 counter-test. |
| `upstream-version-pin.test.sh` | 2 | 2 | 0 | Lockfile present + version match. |

**Total: 116 cases pass, 0 fail.**

---

## Acceptance Criteria from REQUIREMENTS.md (Phase 4-relevant)

- **Phase 4 ships plumbing for read handlers; downstream phases (5-9) can plug in:** SATISFIED. `BEADS_READ_OVERRIDES` table empty by default; second register loop in dispatcher; `findBeadsRoot` exported; `bd()` helper exported; `assertKeySetParity`/`assertTypeParity` exports; `update-snapshots.mjs` SNAPSHOTS extension array; documented contracts in 04-02 and 04-03 SUMMARYs for Phase 5+ usage.
- **All existing v0.1 tests still pass (no regression):** SATISFIED. 45 v0.1 mutation handler cases pass within the 83-total full suite (verified via the test run above).
- **Non-beads projects: read dispatch falls through to upstream (regression-safe):** SATISFIED. The `isBeadsManaged()` check at `gsd-sdk-shadow.mjs:348` is unchanged from v0.1; non-bd projects never reach the read-handler dispatch loop. Additionally, even on a bd-managed fixture, an unmapped read (no entry in BEADS_READ_OVERRIDES) falls through via the `resolveQueryArgv` returning null path (line 391-394). Manual smoke test above confirms upstream's response is what reaches the user.

---

## Human Verification Required

NONE. All Phase 4 behaviors have automated verification:
- `findBeadsRoot()` worktree topology — covered by `findBeadsRoot.test.mjs` with real `git worktree add` fixture.
- Dispatch fall-through on sentinel — covered by `handler-_phase4-test-stub.test.mjs` 6/6 cases including BLOCKER-1 dual assertion.
- Parity helper — covered by `_parity-helpers.test.mjs` 6/6 cases.
- Multi-milestone seeder + worktree-scoped STATE.md — covered by `seed-determinism.test.sh` + `milestone-scoping.test.mjs`.
- Lockfile drift — covered by `upstream-version-pin.test.sh`.
- Bd allowlist — covered by `bd-allowlist-grep.test.sh`.

Per `04-VALIDATION.md`'s "Manual-Only Verifications" section: *"All phase behaviors have automated verification."*

---

## Gaps Summary

NONE. Phase 4 delivers exactly what its goal requires:

> Read-side detection and shared test harness are in place before any read handler is written, so every subsequent phase plugs into the same parity, fallback, and worktree-correct foundation.

Concretely, Phase 5 can immediately:
1. Delete the env-gated `_phase4-test-stub` block in `bin/gsd-sdk-shadow.mjs` (lines 290-300)
2. Register `roadmap.analyze` as the first real `BEADS_READ_OVERRIDES` entry (no `wrapMutation` per D-09)
3. Import `{ bd }` from `bin/bd-helper.mjs` and let exceptions propagate (D-13)
4. Import `{ findBeadsRoot }` from `bin/gsd-sdk-shadow.mjs` for project root discovery (REQ-QUAL-03)
5. Import `{ assertKeySetParity, assertTypeParity }` from `tests/shadow-tests/_parity-helpers.mjs` for parity tests (D-09)
6. Push a SNAPSHOTS entry into `tests/scripts/update-snapshots.mjs` for the new `roadmap-analyze.json` fixture
7. Run integration tests against `tests/fixtures/seed.jsonl` (multi-milestone bd state)

All seven plumbing concerns are wired and tested. The phase is complete.

---

_Verified: 2026-04-29T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
