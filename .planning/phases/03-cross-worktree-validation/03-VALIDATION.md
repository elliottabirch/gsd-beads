---
phase: 03
slug: cross-worktree-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed test map lives in `03-RESEARCH.md` §"Validation Architecture";
> this doc captures the runtime/sampling contract the planner must honor.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + jq + bd CLI (matches Phase 2 conventions; no Node, no pytest) |
| **Config file** | None — per-suite shell scripts; `tests/run-quick.sh` + `tests/run-all.sh` are the runners |
| **Quick run command** | `bash tests/run-quick.sh cross-worktree-sim` (NEW: add `cross-worktree-sim` case to run-quick.sh) |
| **Full suite command** | `bash tests/run-all.sh` (existing — picks up `tests/cross-worktree/*.sh` by glob once added) |
| **Estimated runtime** | ~20s for quick subset; ~60-90s for full simulation (3 worktrees × 4 simulated days + concurrent burst) |

---

## Sampling Rate

- **After every task commit:** Run the test most directly relevant to the task (e.g., `bash tests/hook-tests/flock-preamble.test.sh` after editing a regen script).
- **After every plan wave:** Run `bash tests/run-quick.sh cross-worktree-sim`.
- **Before phase verification:** Run `bash tests/run-all.sh` AND `bash tests/cross-worktree/simulation.sh` end-to-end. Both must be green.
- **Max feedback latency:** 90 seconds (full simulation; per-task feedback ≤ 20s).

---

## Per-Task Verification Map

> Source: `03-RESEARCH.md` §"Phase Requirements → Test Map". Reproduced here so the
> verifier has a single artifact to consult; planner must keep these in sync if the
> per-plan task IDs differ.

| Behavior (Req) | Test Type | Automated Command | File Status |
|----------------|-----------|-------------------|-------------|
| REQ-03 — 3 worktrees see shared state (write A → read B) | integration | `bash tests/cross-worktree/simulation.sh` | ❌ Wave 0 |
| REQ-03 — New worktree auto-config on `git worktree add` | unit | `bash tests/worktree-tests/auto-config.test.sh` | ✅ |
| REQ-03 — install.sh backfill of pre-existing worktrees (D-08) | integration | `bash tests/install-tests/worktree-backfill.test.sh` | ❌ Wave 0 |
| REQ-03 — `git worktree remove` no leak (D-06) | integration | sub-case of `tests/cross-worktree/simulation.sh` | ❌ Wave 0 |
| REQ-03 — Reactivating old worktree triggers shim (D-07) | integration | sub-case of `tests/cross-worktree/simulation.sh` | ❌ Wave 0 |
| REQ-05 — Concurrent regen produces atomic markdown (D-15) | integration | sub-case of `tests/cross-worktree/simulation.sh` (concurrent-stress) | ❌ Wave 0 |
| REQ-05 — flock preamble present in cascade-loop / regen-roadmap / regen-requirements | unit (grep) | `bash tests/hook-tests/flock-preamble.test.sh` | ❌ Wave 0 |
| REQ-05 — flock timeout emits clear stderr + non-zero exit | unit | sub-case of `tests/hook-tests/flock-preamble.test.sh` | ❌ Wave 0 |
| REQ-05 — bd-sync.sh fail-soft when flock returns non-zero | unit | extend `tests/hook-tests/bd-sync.test.sh` (new CASE) | ✅ extend |
| INFR — install.sh fails fast if `flock` missing | unit | extend an existing install-test OR new `tests/install-tests/flock-preflight.test.sh` | ✅ extend / ❌ Wave 0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

These artifacts must exist (even as stubs that fail loudly) before any execute-phase task in this phase runs:

- [ ] `tests/cross-worktree/simulation.sh` — main 3-worktree simulation harness (REQ-03 + REQ-05 integration coverage)
- [ ] `tests/cross-worktree/lib/setup.sh` — shared helpers: spin up source repo + N worktrees + sandbox cleanup via `trap EXIT`
- [ ] `tests/cross-worktree/lib/assertions.sh` — invariant checkers (no data loss, no ID collision, no stale state, atomic markdown views — D-04)
- [ ] `tests/cross-worktree/lib/inject.sh` — failure-injection helpers (D-13: source `.beads/` deleted, source rename, BEADS_DIR unset, concurrent regen burst)
- [ ] `tests/hook-tests/flock-preamble.test.sh` — grep-level + behavioral preamble assertions for the 3 lock-acquiring scripts
- [ ] `tests/install-tests/worktree-backfill.test.sh` — install.sh enumerates pre-existing worktrees and fires shim against each (D-08)
- [ ] `tests/run-quick.sh` — extend the case statement with `cross-worktree-sim` invocation
- [ ] `tests/run-all.sh` — confirm `tests/cross-worktree/*.sh` is globbed in (extend if not)

---

## Manual-Only Verifications

> Phase 3 deliberately keeps everything automated. The only "manual" step is the
> distillation of `docs/WORKTREES-EVIDENCE.md` from a real simulation run.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docs/WORKTREES-EVIDENCE.md` accurately reflects observed simulation behavior (D-12) | REQ-03 + REQ-05 | Curation of transcript snippets is editorial — automation can confirm the file exists and references each invariant, not that the prose is faithful. | After running `tests/cross-worktree/simulation.sh` end-to-end, distill the transcript into a per-invariant section. Verify each of the 4 invariants from D-04 has a heading + 5-10 line transcript excerpt. Reviewer: the implementer; reviewer-of-record: the next person to run the simulation. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are listed under Wave 0 Requirements above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ Wave 0 references in the per-task verification map
- [ ] No watch-mode flags (every test exits with a status code)
- [ ] Feedback latency < 90s for the full simulation; < 20s for per-task quick checks
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after generating tasks)
- [ ] All 4 invariants from CONTEXT.md D-04 have a corresponding assertion in `tests/cross-worktree/lib/assertions.sh`

**Approval:** pending
