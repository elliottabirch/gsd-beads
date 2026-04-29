---
phase: 4
slug: findbeadsroot-parity-test-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 22+, bundled) |
| **Config file** | None — `node --test <files>` invoked directly via bash runners (`tests/run-quick.sh:11`, `tests/run-all.sh:13`) |
| **Quick run command** | `node --test tests/shadow-tests/findBeadsRoot.test.mjs tests/shadow-tests/handler-_phase4-test-stub.test.mjs tests/shadow-tests/_parity-helpers.test.mjs tests/shadow-tests/beads-errors.test.mjs` |
| **Full suite command** | `tests/run-all.sh` |
| **Estimated runtime** | ~10-20 seconds (3 worktree fixtures × ~1s each + per-test bd init/teardown) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/shadow-tests/<the-changed-file>.test.mjs` (~2-5s each)
- **After every plan wave:** Run `tests/run-quick.sh argv-routing wrap-mutation handler-phase-add` + new Phase 4 suites
- **Before `/gsd-verify-work`:** Full suite must be green AND new seeder-determinism bash test green AND CI drift-pin test green
- **Max feedback latency:** ~30 seconds (full Phase 4 suite + existing v0.1 tests)

---

## Per-Task Verification Map

(Populated by gsd-planner. Below is the requirement→test map from RESEARCH.md, awaiting plan-task assignment.)

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| REQ-QUAL-01 | Snapshot-parity helper detects missing key | unit | `node --test tests/shadow-tests/_parity-helpers.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-01 | Parity helper detects type mismatch | unit | (same file) | ❌ Wave 0 |
| REQ-QUAL-01 | Snapshot files are loadable JSON; `_phase4-test-stub.json` exists at expected path | unit | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | `_phase4-test-stub` happy path: dispatch returns `{data:{ok:true,backend:'beads'}}` | integration | `node --test tests/shadow-tests/handler-_phase4-test-stub.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-02 | Stub configured to throw `BeadsNotInstalled`: dispatcher falls through to upstream | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Stub throws `BeadsCorrupt`: same fall-through | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Stub throws `BeadsVersionMismatch`: same fall-through | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Stub throws `BeadsEmpty`: same fall-through | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Real bug (`TypeError`) in handler: dispatcher exits 1 (NOT fall-through) — preserves v0.1 loud-fail | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | `instanceof BeadsUnavailableError` works across ESM module boundaries (subtypes also instanceof base) | unit | `node --test tests/shadow-tests/beads-errors.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` returns source repo when called from a worktree | integration | `node --test tests/shadow-tests/findBeadsRoot.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` honors `BEADS_DIR` env over parent-walk | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` follows symlinked `.beads/` via `realpathSync` | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` returns null on a non-bd project (no false positives) | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` halts at filesystem root (does not climb out of project tree) | unit | (same file) | ❌ Wave 0 |
| **D-07** | Seeder reproducibility: two invocations produce byte-identical `bd export --json` | integration | `bash tests/shadow-tests/seed-determinism.test.sh` | ❌ Wave 0 |
| **D-08** | Multi-milestone fixture: seeder produces v0.1 (closed), v0.2 (in-progress), v0.3 (planned) phases | integration | (same file or sibling) | ❌ Wave 0 |
| **D-05** | Worktree-A milestone v0.2 view differs from Worktree-B v0.3 view against shared bd store | integration | `node --test tests/shadow-tests/milestone-scoping.test.mjs` | ❌ Wave 0 |
| **D-10** | CI drift detection: lockfile pin matches installed `gsd-sdk` version | unit (CI) | `bash tests/install-tests/upstream-version-pin.test.sh` | ❌ Wave 0 |
| **REQ-QUAL-05 (precursor)** | Hook-allowlist grep: no read handler invokes a write-side bd subcommand | unit | `bash tests/shadow-tests/bd-allowlist-grep.test.sh` | ❌ Wave 0 |

*Status will be updated during execution: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shadow-tests/findBeadsRoot.test.mjs` — covers REQ-QUAL-03; 5 cases (worktree, BEADS_DIR, symlink, non-bd, root-halt)
- [ ] `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` — covers REQ-QUAL-02; 6 cases (happy + 4 sentinel subtypes + real-bug)
- [ ] `tests/shadow-tests/beads-errors.test.mjs` — covers REQ-QUAL-02 instanceof parity; ~4 cases
- [ ] `tests/shadow-tests/_parity-helpers.test.mjs` — covers REQ-QUAL-01 helper; ~6 cases
- [ ] `tests/shadow-tests/_parity-helpers.mjs` — harness module under test
- [ ] `tests/shadow-tests/snapshots/_phase4-test-stub.json` — single snapshot proving wiring + parity loop
- [ ] `tests/shadow-tests/seed-determinism.test.sh` — bash test asserting seeder reproducibility (D-07)
- [ ] `tests/shadow-tests/milestone-scoping.test.mjs` — D-05 worktree-A vs worktree-B milestone view
- [ ] `tests/install-tests/upstream-version-pin.test.sh` — CI drift detection (D-10)
- [ ] `tests/shadow-tests/bd-allowlist-grep.test.sh` — REQ-QUAL-05 precursor
- [ ] `tests/fixtures/seed-fixture.sh` — fixture restorer
- [ ] `tests/fixtures/seed.jsonl` — committed canonical state
- [ ] `tests/fixtures/build-seed.sh` — source bash script that rebuilds seed.jsonl
- [ ] `tests/scripts/update-snapshots.mjs` — snapshot regeneration (consumed by Phases 5-9)
- [ ] `bin/beads-errors.mjs` — sentinel hierarchy module
- [ ] `bin/bd-helper.mjs` — `bd()` helper module
- [ ] `scripts/regen-state.sh` — NEW script (currently absent despite CONTEXT.md mentioning f8903ca)
- [ ] `gsd-sdk-cc.version.lock` — version pin (1 line: `1.38.5`)
- [ ] Framework install: none — `node --test` is bundled with Node 22

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
