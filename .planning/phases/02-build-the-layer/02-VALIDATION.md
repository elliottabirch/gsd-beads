---
phase: 02
slug: build-the-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Auto-generated from RESEARCH.md `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Hook scripts framework** | bash + jq synthetic-payload runner (Spike 001/012 pattern) |
| **Shadow binary framework** | `node:test` (built-in, ESM-native, zero deps) |
| **Install script framework** | bash test (idempotency assertions on file contents + exit codes) |
| **E2E framework** | bash + ephemeral fixture at `/tmp/gsd-beads-e2e-${RANDOM}` |
| **Quick run command** | `bash tests/run-quick.sh` (single suite of touched component) |
| **Full suite command** | `bash tests/run-all.sh` (every suite + e2e) |
| **Estimated runtime** | ~30s quick, ~3m full (excludes 50-bead perf test) |

---

## Sampling Rate

- **After every task commit:** Run `bash tests/run-quick.sh <component>`
- **After every plan wave:** Run `bash tests/run-all.sh` (excludes 50-bead perf test)
- **Before `/gsd-verify-work`:** Full suite + 50-bead perf test must be green
- **Max feedback latency:** 30 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-W0 | 01 | 0 | REQ-01 | — | N/A | Wave 0 | `test -f tests/hook-tests/regen-roadmap.test.sh` | ❌ W0 | ⬜ pending |
| 02-01-01 | 01 | 1 | REQ-01 | — | regen produces deterministic ROADMAP.md for same bd state | unit | `bash tests/hook-tests/regen-roadmap.test.sh` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | REQ-01 | — | regen produces deterministic REQUIREMENTS.md for same bd state | unit | `bash tests/hook-tests/regen-requirements.test.sh` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | REQ-01 | — | cascade-loop closes parent when all children closed (Spike 002 parity) | unit | `bash tests/hook-tests/cascade-loop.test.sh` | ❌ W0 | ⬜ pending |
| 02-02-W0 | 02 | 0 | REQ-04 | T-02-01 | N/A | Wave 0 | `test -f tests/hook-tests/block-state-md.test.sh` | ✅ copy | ⬜ pending |
| 02-02-01 | 02 | 1 | REQ-04, REQ-07 | T-02-01 | Edit/Write hook denies state-bearing paths; allows narrative paths | unit | `bash tests/hook-tests/block-state-md.test.sh` | ✅ exists in spike POC | ⬜ pending |
| 02-02-02 | 02 | 1 | REQ-04 | T-02-02 | gsd-sdk-mutation hook denies 13 mutations × 2 forms = 26 deny + 17 allow + edge | unit | `bash tests/hook-tests/block-gsd-sdk-mutation.test.sh` | ✅ exists in spike POC | ⬜ pending |
| 02-02-03 | 02 | 1 | REQ-04 | T-02-03 | bd-sync runs on `bd ` Bash, skips read-only commands; cascade fires once | unit | `bash tests/hook-tests/bd-sync.test.sh` | ✅ extend | ⬜ pending |
| 02-03-W0 | 03 | 0 | REQ-04 | T-02-04 | N/A | Wave 0 | `test -f tests/shadow-tests/argv-routing.test.mjs` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | REQ-01, REQ-04 | T-02-04 | shadow's phase.add creates a bead with `gsd:phase` label | unit | `node --test tests/shadow-tests/handler-phase-add.test.mjs` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | REQ-04 | T-02-04 | 12 remaining bd-backed handlers route correctly | unit | `node --test tests/shadow-tests/handler-*.test.mjs` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | REQ-02 | T-02-05 | shadow falls through to upstream for non-overridden commands | unit | `node --test tests/shadow-tests/argv-routing.test.mjs` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | REQ-04 | — | wrapMutation emits a GSDEvent matching upstream wrap-pass shape (snapshot) | unit | `node --test tests/shadow-tests/wrap-mutation.test.mjs` | ❌ W0 | ⬜ pending |
| 02-04-W0 | 04 | 0 | REQ-03 | — | N/A | Wave 0 | `test -f tests/worktree-tests/auto-config.test.sh` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | REQ-03 | — | new worktree via `git worktree add` auto-configures `gsd-beads.dir` | integration | `bash tests/worktree-tests/auto-config.test.sh` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | REQ-03 | T-02-06 | sentinel-marker append idempotent (re-add does not duplicate) | unit | `bash tests/worktree-tests/append-idempotency.test.sh` | ❌ W0 | ⬜ pending |
| 02-05-W0 | 05 | 0 | REQ-06 | T-02-07 | N/A | Wave 0 | `test -f tests/install-tests/idempotency.test.sh` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | REQ-06 | T-02-07 | install.sh idempotent — running twice produces zero diff in `~/.claude/settings.json` | unit | `bash tests/install-tests/idempotency.test.sh` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 3 | REQ-06 | T-02-07 | deep-merge settings.json without clobbering existing user hooks; 5 cases including CASE 5 (different matchers retained — W6 fix) | unit | `bash tests/install-tests/settings-merge.test.sh` | ❌ W0 | ⬜ pending |
| 02-05-03 | 05 | 3 | REQ-06 | — | bd memory seeding produces 7 keys under `gsd-beads:` namespace | unit | `bash tests/install-tests/memory-seeding.test.sh` | ❌ W0 | ⬜ pending |
| 02-05-04 | 05 | 3 | REQ-06 | T-02-08 | symlink at `~/.local/bin/gsd-sdk` resolves; warns if PATH-shadowed (Volta trap) | unit | `bash tests/install-tests/path-precedence.test.sh` | ❌ W0 | ⬜ pending |
| 02-05-05 | 05 | 3 | REQ-02 | T-02-09 | grep guard — install never touches `~/.claude/get-shit-done/` | unit | `bash tests/install-tests/no-gsd-core-mutation.test.sh` | ❌ W0 | ⬜ pending |
| 02-06-W0 | 06 | 0 | REQ-01..REQ-08 | — | N/A | Wave 0 | `test -f tests/e2e/full-install.smoke.sh` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 4 | REQ-01..REQ-08 | T-02-10 | E2E: fresh fixture, full install, build hierarchy, cascade fires, regen ROADMAP.md parses | smoke | `bash tests/e2e/full-install.smoke.sh` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 4 | REQ-04 | — | E2E: 50-bead fixture, bd-sync.sh latency <5s (Pitfall 3 perf gate) | performance | `bash tests/e2e/bd-sync-latency.test.sh` | ❌ W0 | ⬜ pending |
| 02-06-03 | 06 | 4 | REQ-05 | — | E2E: 2 worktrees concurrently close same bead; both writers commit (non-empty stdout), close_reason ∈ {wt-source, wt-secondary}, no DB corruption (B1 fix — last-writer-wins acceptable per Pitfall 8) | integration | `bash tests/e2e/concurrent-merge.test.sh` | ❌ W0 | ⬜ pending |
| 02-06-04 | 06 | 4 | REQ-02 | — | E2E: post-`gsd-update`, shadow imports still work | smoke | `bash tests/e2e/post-gsd-update.smoke.sh` | ❌ W0 | ⬜ pending |
| 02-06-05 | 06 | 4 | REQ-08, D-07 | — | E2E: `bd ready` works as-is in beads-managed project; CASE 4 (B2 fix) verifies `bd prime` surfaces gsd-beads:vocabulary content per D-07 | smoke | `bash tests/e2e/bd-ready.smoke.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 stubs (must exist BEFORE production code is written so all subsequent tasks have an automated verify command):

- [ ] `tests/run-quick.sh` — meta script (Plan 02-02 Wave 0)
- [ ] `tests/run-all.sh` — meta script (Plan 02-02 Wave 0)
- [ ] `tests/hook-tests/regen-roadmap.test.sh` — REQ-01 stub (Plan 02-01)
- [ ] `tests/hook-tests/regen-requirements.test.sh` — REQ-01 stub (Plan 02-01)
- [ ] `tests/hook-tests/cascade-loop.test.sh` — REQ-01 stub (Plan 02-01)
- [ ] `tests/hook-tests/block-state-md.test.sh` — REQ-04 (copy from Spike 001)
- [ ] `tests/hook-tests/block-gsd-sdk-mutation.test.sh` — REQ-04 (copy from Spike 012)
- [ ] `tests/hook-tests/bd-sync.test.sh` — REQ-04 (extend Spike 001 with read-only filter cases)
- [ ] `tests/shadow-tests/argv-routing.test.mjs` — REQ-02/04 stub (Plan 02-03)
- [ ] `tests/shadow-tests/handler-phase-add.test.mjs` — REQ-04 stub (Plan 02-03)
- [ ] `tests/shadow-tests/handler-*.test.mjs` — 12 stubs for remaining bd-backed handlers
- [ ] `tests/shadow-tests/wrap-mutation.test.mjs` — D-09 snapshot stub (Plan 02-03)
- [ ] `tests/install-tests/idempotency.test.sh` — REQ-06 stub (Plan 02-05)
- [ ] `tests/install-tests/settings-merge.test.sh` — REQ-06 stub (Plan 02-05)
- [ ] `tests/install-tests/memory-seeding.test.sh` — REQ-06 stub (Plan 02-05)
- [ ] `tests/install-tests/path-precedence.test.sh` — REQ-06 stub (Plan 02-05)
- [ ] `tests/install-tests/no-gsd-core-mutation.test.sh` — REQ-02 stub (Plan 02-05)
- [ ] `tests/worktree-tests/auto-config.test.sh` — REQ-03 stub (Plan 02-04)
- [ ] `tests/worktree-tests/append-idempotency.test.sh` — REQ-03/06 stub (Plan 02-04 + 02-05)
- [ ] `tests/e2e/full-install.smoke.sh` — cross-cutting stub (Plan 02-06)
- [ ] `tests/e2e/bd-sync-latency.test.sh` — Pitfall 3 perf gate stub (Plan 02-06)
- [ ] `tests/e2e/concurrent-merge.test.sh` — REQ-05 stub (Plan 02-06)
- [ ] `tests/e2e/post-gsd-update.smoke.sh` — REQ-02 stub (Plan 02-06)
- [ ] `tests/e2e/bd-ready.smoke.sh` — REQ-08 stub (Plan 02-06)

---

## Coverage Targets (Nyquist: test cases >= 2× decision branches)

| Component | Decision branches | Test cases | Source |
|-----------|-------------------|------------|--------|
| `block-state-md.sh` | 5 path patterns × 2 shapes (abs/rel) = 10 deny + N narrative-allow + edge | **20 cases** | Spike 001 — already at parity |
| `block-gsd-sdk-mutation.sh` | 13 mutations × 2 forms (dotted/space) = 26 deny + 12 allow + 5 edge | **43 cases** | Spike 012 — already at parity |
| `bd-sync.sh` | 2 filter branches (bd vs not-bd) + 4 read-only-skip + cascade-runs | **15+ cases** (NEW: read-only filter expands Spike 001's 7) | Phase 2 NEW |
| Shadow handler `phase.add` | 3 paths (beads, non-beads, malformed args) | **6+ cases** | Phase 2 NEW |
| Shadow handler ×12 others | 3 paths each = 36 | **36+ cases** | Phase 2 NEW |
| `wrapMutation` helper | 7 prefix branches (template, commit, frontmatter, config, validate, phase, fallback) | **14+ snapshot cases** | Phase 2 NEW |
| `install.sh` deep-merge | 5 cases (empty, no-overlap, partial-overlap, full-conflict, different-matchers — W6 fix CASE 5) | **10+ cases** | Phase 2 NEW |
| `worktree-post-checkout.sh` append idempotency | 2 cases (first-add, re-add) | **4+ cases** | Phase 2 NEW |

---

## Cross-Plan Invariants (for plan-checker / verify-work)

- Every `block-*.sh` script under `hooks/` has a matching test file under `tests/hook-tests/`
- Every shadow handler in `bin/gsd-sdk-shadow.mjs`'s `BEADS_OVERRIDES` map has a matching test file under `tests/shadow-tests/`
- Install script's idempotency test PASSES on a freshly-installed fixture (zero diff)
- E2E smoke produces a regenerated `ROADMAP.md` whose `## Progress` table parses identically to what `gsd-progress` outputs
- No production-code task ships without a Wave 0 stub-test as its dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `bd setup --list` shows `gsd-beads` after `bd setup --add` registration | REQ-06 | bd CLI side-effect not easily asserted in CI | After install: run `bd setup --list`; verify `gsd-beads` appears |
| Recipe template content acts as discovery pointer (not installer) | D-03 (revised) | Documentation correctness, not code behavior | Visually inspect recipe markdown; confirm it points at `git clone` instructions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (24 stubs above)
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 30s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter once all stubs exist

**Approval:** pending
