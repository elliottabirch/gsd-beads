---
phase: 5
slug: roadmap-read-handlers
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
approval: 2026-04-29 (per-plan TDD pattern)
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Per-plan TDD substitution (per-plan red→green pattern in lieu of formal Wave 0 separation):** Every Plan 01..05 ships its own RED test stub task as Task 1 (`tdd="true"`) immediately followed by the implementation task that turns the red test GREEN. This per-plan TDD discipline satisfies the Wave 0 contract incrementally — each plan owns its own red→green transition rather than the entire phase deferring failing tests to a single Wave 0. The strategy is approved as Nyquist-compliant: every code-producing task has an automated `<verify>` and the red test stub precedes the implementation in every plan, so feedback sampling never lags behind production code by more than one task within a plan.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (Node.js built-in test runner; ESM `.test.mjs` files) + bash test scripts (`*.test.sh`) |
| **Config file** | none — convention-based discovery (`tests/shadow-tests/*.test.{mjs,sh}`) |
| **Quick run command** | `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs tests/shadow-tests/handler-roadmap-get-phase.test.mjs` |
| **Full suite command** | `node --test tests/shadow-tests/*.test.mjs && bash tests/shadow-tests/seed-determinism.test.sh && bash tests/shadow-tests/bd-allowlist-grep.test.sh && bash tests/install-tests/upstream-version-pin.test.sh` |
| **Estimated runtime** | ~25 seconds full suite (Phase 4 baseline 18.3s + ~5s for new Phase 5 cases including parity snapshot diff and worktree fixture re-runs) |

---

## Sampling Rate

- **After every task commit:** Run quick command (handler tests only) — ~3 seconds
- **After every plan wave:** Run full suite — ~25 seconds
- **Before `/gsd-verify-work`:** Full suite must be green; `seed-determinism.test.sh` must remain byte-identical pre/post `build-seed.sh` edits
- **Max feedback latency:** 5 seconds for handler-only quick command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | D-03 | — | seed deterministic; phase-id labels present on 7 phases | bash | `bash tests/shadow-tests/seed-determinism.test.sh` | ✅ existing | ⬜ pending |
| 5-01-02 | 01 | 1 | D-18 | — | milestone-heading memories seeded for v0.1/v0.2/v0.3 | mjs | `node --test tests/fixtures/memories-seeded.test.mjs` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | D-02 | — | parsePhaseId strips padding, preserves decimals | mjs | `node --test tests/shadow-tests/helpers-parsePhaseId.test.mjs` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | D-07 | — | deriveDiskStatus returns correct enum for 7 priority cases | mjs | `node --test tests/shadow-tests/helpers-deriveDiskStatus.test.mjs` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 2 | D-08..D-12 + refined D-06 | — | detectDrift emits all 4 kinds + skips natural asymmetries; LIVE summary_count divergence exercised (CASE 3 fixture: bd has 2 closed gsd:plan children, disk has 1 SUMMARY.md → drift entry emitted with `kind: 'summary_count', bd_value: 2, disk_value: 1`) | mjs | `node --test tests/shadow-tests/helpers-detectDrift.test.mjs` | ❌ W0 | ⬜ pending |
| 5-02-04 | 02 | 2 | D-15..D-17 | — | loadMilestoneHeading returns memory value or fallback | mjs | `node --test tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs` | ❌ W0 | ⬜ pending |
| 5-02-05 | 02 | 2 | D-13 | — | parity helper accepts whitelisted bd-only keys (drift) | mjs | `node --test tests/shadow-tests/_parity-helpers.test.mjs` | ✅ existing (extend) | ⬜ pending |
| 5-03-01 | 03 | 3 | REQ-READ-01, REQ-QUAL-01 | — | roadmap.analyze parity snapshot exists BEFORE handler (red→green per D-26) | mjs | `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 3 | REQ-READ-01 SC #1 | — | 10 top-level keys + 10 per-phase keys present; current_phase/next_phase are phase number strings | mjs | (subsumed in 5-03-01 cases) | — | ⬜ pending |
| 5-03-03 | 03 | 3 | REQ-READ-01 SC #2 | — | total_plans matches `bd count -l gsd:plan`; completed_phases matches `bd list -l gsd:phase --status=closed` count | mjs | `node --test tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs` | ❌ W0 | ⬜ pending |
| 5-03-04 | 03 | 3 | D-19 | — | current-milestone scoping via `git config --worktree gsd-beads.milestone` filters phases[] correctly | mjs | `node --test tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs` | ❌ W0 | ⬜ pending |
| 5-03-05 | 03 | 3 | REQ-QUAL-04 SC #5 | — | non-bd fixture falls through to upstream; backend !== 'beads' | mjs | (one CASE in 5-03-01) | — | ⬜ pending |
| 5-03-06 | 03 | 3 | D-08..D-12 + refined D-06 | — | drift fixture: bd state and disk state intentionally diverged; drift[] populated; LIVE summary_count CASE asserts kind='summary_count', bd_value=2, disk_value=1 + stderr line emitted | mjs | `node --test tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 3 | REQ-READ-02, REQ-QUAL-01 | — | roadmap.get-phase parity snapshot for known phase number | mjs | `node --test tests/shadow-tests/handler-roadmap-get-phase.test.mjs` | ❌ W0 | ⬜ pending |
| 5-04-02 | 04 | 3 | REQ-READ-02 SC #3 | — | shared per-phase fields between roadmap.analyze.phases[N] and roadmap.get-phase N are byte-equal (with explicit number↔phase_number, name↔phase_name remap) | mjs | `node --test tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` | ❌ W0 | ⬜ pending |
| 5-04-03 | 04 | 3 | D-20 | — | unmatched phase number returns `{found: false, phase_number: arg}` (matches upstream) | mjs | (one CASE in 5-04-01) | — | ⬜ pending |
| 5-05-01 | 05 | 4 | REQ-QUAL-06 (precursor) | — | roadmap.analyze byte-identical across 5 consecutive runs (determinism precursor for Phase 11) | bash | `bash tests/shadow-tests/handler-roadmap-determinism.test.sh` | ❌ W0 | ⬜ pending |
| 5-05-02 | 05 | 4 | REQ-QUAL-07 (precursor) | — | call-count assertion: ≤2 bd spawns per `roadmap.analyze` invocation regardless of phase count | mjs | `node --test tests/shadow-tests/handler-roadmap-call-count.test.mjs` | ❌ W0 | ⬜ pending |
| 5-05-03 | 05 | 4 | REQ-QUAL-05 | — | bd-allowlist grep test continues to pass with `export` and `memories` invocations | bash | `bash tests/shadow-tests/bd-allowlist-grep.test.sh` | ✅ existing | ⬜ pending |
| 5-05-04 | 05 | 4 | (delete _phase4-test-stub) | — | stub block (lines 290-300 of pre-Phase-5 shadow) removed; production binary returns ZERO entries when GSD_SHADOW_TEST_STUB=1 | mjs | (CASE in 5-03-01 happy path; absence of stub asserted) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shadow-tests/handler-roadmap-analyze.test.mjs` — happy path + 10 top-level + 10 per-phase key coverage + non-bd fall-through CASE + missing-stub assertion (REQ-READ-01, SC #1, SC #5)
- [ ] `tests/shadow-tests/handler-roadmap-get-phase.test.mjs` — happy + decimal phase + unmatched (REQ-READ-02, D-20)
- [ ] `tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs` — total_plans / completed_phases bd-count parity (SC #2)
- [ ] `tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs` — worktree-A v0.2 vs worktree-B v0.3 view (D-19)
- [ ] `tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs` — 4 drift kinds + natural asymmetry pass-through + LIVE summary_count divergence (D-10..D-12 + refined D-06)
- [ ] `tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` — overlapping fields byte-equal with explicit key remap (SC #3)
- [ ] `tests/shadow-tests/handler-roadmap-determinism.test.sh` — 5× byte-identical (REQ-QUAL-06 precursor)
- [ ] `tests/shadow-tests/handler-roadmap-call-count.test.mjs` — ≤2 spawns (REQ-QUAL-07 precursor)
- [ ] `tests/shadow-tests/helpers-parsePhaseId.test.mjs` — padding strip + decimal preservation (D-02)
- [ ] `tests/shadow-tests/helpers-deriveDiskStatus.test.mjs` — 7-value enum priority order (D-07)
- [ ] `tests/shadow-tests/helpers-detectDrift.test.mjs` — drift kinds + asymmetry exclusions (D-10/D-11) + LIVE summary_count CASE 3 (refined D-06)
- [ ] `tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs` — memory hit + fallback (D-15..D-17)
- [ ] `tests/fixtures/memories-seeded.test.mjs` — verify build-seed.sh emits 3 memory keys (D-18)
- [ ] `tests/shadow-tests/snapshots/roadmap-analyze.json` — captured upstream shape against gsd-beads ROADMAP.md fixture (D-26)
- [ ] `tests/shadow-tests/snapshots/roadmap-get-phase.json` — captured upstream shape for known phase
- [ ] `tests/shadow-tests/_parity-helpers.test.mjs` — extend with whitelist case for `drift` extension key (D-13)

*Wave 0 stubs: write all the above test files with FAILING expectations FIRST (red), then make them pass (green). Per D-26 / REQ-QUAL-01: parity snapshot tests MUST exist before handler implementation; CI fails if either handler omits a key from upstream shape.*

*Per-plan TDD substitution (W5): each Plan 01..05 ships its own RED Task 1 (`tdd="true"`) immediately followed by the GREEN implementation task — Wave 0 happens incrementally per plan rather than as a single front-loaded phase. This pattern satisfies Nyquist sampling because every code-producing task has an automated `<verify>` and red precedes implementation within every plan boundary.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/gsd-progress` rich-panel rendering on a real beads-managed project | REQ-READ-01 (Phase 5 acceptance via Phase 11 SC #6) | Cross-skill integration; the full GSD command-surface routing is gated by Phase 11's acceptance test | After Phase 5 plans land green: run `/gsd-progress` from the gsd-beads repo with bd seeded; verify the phase panel shows phase numbers (not bead IDs), correct progress %, milestone name from memory key |
| Worktree topology with shared bd store | D-19 / REQ-QUAL-03 | Real `git worktree add` setup beyond what milestone-scoping.test.mjs covers | `cd <worktree-A>; gsd-sdk query roadmap.analyze` returns v0.2 phases; `cd <worktree-B>; gsd-sdk query roadmap.analyze` returns v0.3 phases against same store. Already covered by `milestone-scoping.test.mjs` 2/2 from Phase 4 — manual repro only on user-reported edge cases. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (16 new test files identified above; per-plan TDD substitution)
- [x] No watch-mode flags (`node --test` runs once and exits; bash scripts are one-shot)
- [x] Feedback latency < 5s (quick command runs only the 2 handler test files)
- [x] `nyquist_compliant: true` set in frontmatter (per-plan TDD pattern approved 2026-04-29)

**Approval:** 2026-04-29 (per-plan TDD pattern)
</content>
</invoke>
