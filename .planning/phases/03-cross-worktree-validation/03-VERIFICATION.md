---
phase: 03-cross-worktree-validation
verified: 2026-04-28T23:47:53Z
status: passed
score: 30/30 must-haves verified
overrides_applied: 0
---

# Phase 03: Cross-Worktree Validation — Verification Report

**Phase Goal:** Verify shared `BEADS_DIR` works across multiple worktrees in real use. Document the recommended worktree setup. (REQ-03, REQ-05)
**Verified:** 2026-04-28T23:47:53Z
**Status:** passed
**Re-verification:** No — initial verification

## Summary

Phase 3 ships three concerns end-to-end:

1. **D-15 flock serialization** (Plan 03-01) — byte-identical `BEGIN GSD-BEADS LOCK PREAMBLE v1` block in cascade-loop.sh, regen-roadmap.sh, regen-requirements.sh; install.sh pre-flight aborts on hosts without `flock`; bd-sync.sh CASE 18 proves fail-soft chain absorbs flock-timeout exits.
2. **D-08 install.sh worktree backfill + 3-worktree simulation** (Plan 03-02) — Step 6.5 enumerates pre-existing worktrees via `git worktree list --porcelain` and fires the shim against each (idempotent); a 5-day, 3-worktree, 13-checkpoint integration harness asserts all 4 D-04 invariants and fires all 4 D-13 failure injections in 50–55 s wall time.
3. **D-09…D-12 documentation triple** (Plan 03-03) — bd memory #8 (`gsd-beads:worktrees`, 19 lines, plain prose) auto-seeded by install.sh's existing memory loop; `docs/WORKTREES.md` (270 lines, setup + lifecycle + 5 troubleshooting subsections); `docs/WORKTREES-EVIDENCE.md` (169 lines, 5 `## Observed:` sections curated from a real simulation run); README "Multi-worktree setup" section + status update.

D-07 (hooks/worktree-post-checkout.sh untouched) holds: zero-byte diff across all phase-3 commits. D-15 anti-pattern guards (no `-c` form, no lock deletion) all pass with zero matches. No `gsd-sdk` mutations in any of the 14 phase-3 commits. Behavioral spot-checks all green: full test suite (`bash tests/run-all.sh`) reports `Suites failed: 0`; cross-worktree simulation passes 13/13 in 52 s; flock-preamble 4/4; bd-sync 18/18; worktree-backfill 9/9.

The 03-REVIEW.md just landed alongside this verification with **0 BLOCKERS**, 7 WARNINGs, 4 INFOs. All 7 warnings are either macOS-portability concerns (`date +%s%N`, `sed '\+'`) or test-correctness niceties (CASE 18 captures wrapper rc not hook rc; CASE 3.b/3.c grep source rather than parser behavior). They're advisory follow-ups; none block phase goal achievement and none invalidate the green test runs above. They are recorded under "Follow-up Items" below.

## Goal Achievement

### Observable Truths

The phase goal decomposes into two outcomes (validation in real use + documentation). 30 truths across the 3 plan frontmatters resolve to it. All verified.

| #   | Truth                                                                                                                                         | Status     | Evidence                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | scripts/cascade-loop.sh acquires `<source>/.beads/.gsd-beads.lock` via `flock -x -w 30` before running cascade loop (D-15)                   | VERIFIED   | `grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/cascade-loop.sh` = 1; `flock -x -w 30 9` present                                                                                                                            |
| 2   | scripts/regen-roadmap.sh acquires the same lock at the same path (D-15)                                                                       | VERIFIED   | Same sentinel + `flock -x -w 30 9` present                                                                                                                                                                                     |
| 3   | scripts/regen-requirements.sh acquires the same lock at the same path (D-15)                                                                  | VERIFIED   | Same sentinel + `flock -x -w 30 9` present                                                                                                                                                                                     |
| 4   | All three scripts resolve the lock path via `git rev-parse --git-common-dir` + dirname + `cd && pwd -P` (Pitfall 3)                           | VERIFIED   | `cd "$common" && pwd -P` present in all three (preamble byte-identical)                                                                                                                                                        |
| 5   | All three scripts emit `another regen` and exit non-zero on flock timeout                                                                     | VERIFIED   | flock-preamble.test.sh CASE 3 behavioral test: regen-roadmap.sh under 35-s held lock exits non-zero in ~30 s with stderr containing the literal message                                                                        |
| 6   | install.sh adds pre-flight `command -v flock` with macOS hint                                                                                  | VERIFIED   | `install.sh:19` matches `command -v flock >/dev/null 2>&1 || ... brew install flock`                                                                                                                                            |
| 7   | tests/hook-tests/flock-preamble.test.sh has 4 CASE blocks; green (REQ-05 unit coverage)                                                       | VERIFIED   | `grep -c '^# CASE [0-9]' = 4`; behavioral run: 4/4 PASS                                                                                                                                                                        |
| 8   | tests/hook-tests/bd-sync.test.sh CASE 18 proves fail-soft chain absorbs flock timeout                                                         | VERIFIED   | bd-sync.test.sh: 18/18 PASS; CASE 18 records rc=0, rr=yes, rreq=yes (markers fire even when stub cascade exits 1)                                                                                                              |
| 9   | install.sh enumerates pre-existing worktrees via `git worktree list --porcelain` (D-08)                                                       | VERIFIED   | `install.sh:131` "Step 6.5" sentinel; `worktree list --porcelain` invocation present                                                                                                                                           |
| 10  | install.sh fires shim against every enumerated worktree path with `HEAD HEAD 1`                                                                | VERIFIED   | `install.sh:147` `bash "$REPO_BEADS_DIR/hooks/post-checkout" HEAD HEAD 1`                                                                                                                                                       |
| 11  | install.sh skips `bare` and `prunable` worktree records during enumeration                                                                    | VERIFIED   | install.sh awk skip-rules `/^bare$/`, `/^prunable/` present in Step 6.5                                                                                                                                                         |
| 12  | Pre-existing worktrees gain `git config --worktree gsd-beads.dir` + `.gsd-beads-configured` markers after install.sh runs                     | VERIFIED   | tests/install-tests/worktree-backfill.test.sh: 9/9 PASS; CASE 1.1.b / 1.2.b confirm config; CASE 1.1.a / 1.2.a confirm marker                                                                                                  |
| 13  | tests/cross-worktree/simulation.sh creates 3 worktrees + 4-day flow + exits 0 (REQ-03 happy path)                                              | VERIFIED   | Simulation run: `Passed: 13 / 13`, 3-worktree topology (main + feature + hotfix), 5-day flow + concurrent burst                                                                                                               |
| 14  | Invariant 1 (no data loss): all created issues appear in `bd list --json` from source store                                                    | VERIFIED   | Simulation log: `[PASS] Invariant 1 (no data loss): created=6 listed=6`                                                                                                                                                        |
| 15  | Invariant 2 (no ID collision): all hash-based IDs unique across worktrees + concurrent burst                                                   | VERIFIED   | Simulation log: `[PASS] Invariant 2 (no ID collision): created=6 unique=6`                                                                                                                                                     |
| 16  | Invariant 3 (no stale state): write in worktree-A observable from worktree-B without manual sync                                              | VERIFIED   | Simulation log: `[PASS] Invariant 3 (no stale state): wt-A wrote, wt-B saw 'stale-test-10645-29366'`                                                                                                                            |
| 17  | Invariant 4 (atomic markdown): regenerated ROADMAP.md never observed mid-write during concurrent burst                                         | VERIFIED   | Simulation log: `[PASS] Invariant 4 (atomic markdown): 278/278 snapshots well-formed (no mid-write reads)`                                                                                                                     |
| 18  | All 4 D-13 failure injections fire (source `.beads/` deleted, concurrent regen, source renamed, BEADS_DIR unset)                              | VERIFIED   | Simulation log shows all 4: `[INJECT D-13.1]`, `[INJECT D-13.2]`, `[INJECT D-13.3]`, `[INJECT D-13.4]`; each followed by a `[PASS]`                                                                                            |
| 19  | tests/install-tests/worktree-backfill.test.sh proves install.sh backfills 2 pre-existing worktrees (REQ-03)                                    | VERIFIED   | 9/9 cases PASS; CASE 1 covers basic backfill, CASE 2 idempotent re-install, CASE 3 bare/prunable awk skip-rule guard                                                                                                          |
| 20  | tests/run-quick.sh has `cross-worktree-sim` case                                                                                              | VERIFIED   | `grep -E 'cross-worktree-sim' tests/run-quick.sh` matches                                                                                                                                                                      |
| 21  | tests/run-all.sh globs `tests/cross-worktree/*.sh`                                                                                            | VERIFIED   | run-all.sh line 5 includes `tests/cross-worktree/*.sh`                                                                                                                                                                          |
| 22  | install/memories/worktrees.md exists with self-contained worktree briefing (D-11: full content, ≥15 lines)                                    | VERIFIED   | 19 lines; contains "What works automatically", "Lifecycle ops", "Install + recovery" sections; mentions `git config --worktree`, `flock`, `brew install flock`, `docs/WORKTREES.md`                                            |
| 23  | install.sh's existing memory loop auto-seeds worktrees.md as `gsd-beads:worktrees` (memory #8)                                                | VERIFIED   | `git diff cfe4884..HEAD -- install.sh` shows only Step 6.5 backfill from Plan 03-02; no Plan 03-03 changes — memory loop already pre-existed and globbed `*.md`                                                                |
| 24  | docs/WORKTREES.md has setup walkthrough, lifecycle ops (add/remove/reactivate), troubleshooting (4 D-13 modes) (D-10)                          | VERIFIED   | 270 lines; `## Setup walkthrough`, `## Lifecycle ops`, `## Troubleshooting` headings present; D-13 modes 1-4 + flock pre-flight = 5 troubleshooting subsections                                                                |
| 25  | docs/WORKTREES.md contains literal `git config --worktree gsd-beads.dir` recovery one-liner (D-14)                                            | VERIFIED   | `grep -F 'git config --worktree gsd-beads.dir' docs/WORKTREES.md` finds 4 matches (in walkthrough, troubleshooting, fallback hint, recovery section)                                                                          |
| 26  | docs/WORKTREES.md documents `brew install flock` (Pitfall 1)                                                                                  | VERIFIED   | 4 occurrences in docs/WORKTREES.md                                                                                                                                                                                              |
| 27  | docs/WORKTREES-EVIDENCE.md has ≥4 `## Observed:` sections sourced from a real simulation run (D-12)                                            | VERIFIED   | 5 `## Observed:` sections present (4 D-04 invariants + bonus failure-injection summary); references `tests/cross-worktree/simulation.sh`; sandbox paths sanitized to `/tmp/<sandbox>/`                                        |
| 28  | README.md has `## Multi-worktree setup` section linking to docs/WORKTREES.md                                                                  | VERIFIED   | README.md:15 `## Multi-worktree setup`; line 22 `[docs/WORKTREES.md](docs/WORKTREES.md)`; status line updated to reflect Phase 2 shipped + Phase 3 in progress                                                                  |
| 29  | Memory file count goes from 7 to 8                                                                                                            | VERIFIED   | `ls install/memories/*.md \| wc -l` = 8                                                                                                                                                                                         |
| 30  | hooks/worktree-post-checkout.sh unchanged across phase 3 (D-07 honored)                                                                       | VERIFIED   | `git diff cfe4884..HEAD -- hooks/worktree-post-checkout.sh` is empty; last touched in phase 2 commit `8cb3650`                                                                                                                  |

**Score:** 30/30 truths verified

### Required Artifacts

| Artifact                                              | Expected                                                                       | Status   | Details                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `scripts/cascade-loop.sh`                             | Sentinel-marked lock preamble                                                  | VERIFIED | 1× `BEGIN GSD-BEADS LOCK PREAMBLE v1` (line 24)                                                      |
| `scripts/regen-roadmap.sh`                            | Same preamble, byte-identical                                                  | VERIFIED | 1× sentinel (line 16)                                                                                |
| `scripts/regen-requirements.sh`                       | Same preamble, byte-identical                                                  | VERIFIED | 1× sentinel (line 16)                                                                                |
| `install.sh`                                          | Pre-flight `command -v flock` + Step 6.5 worktree backfill                     | VERIFIED | Line 19 flock pre-flight; lines 131-149 Step 6.5 with awk skip-rules                                 |
| `tests/hook-tests/flock-preamble.test.sh`             | 4 CASE blocks, green                                                           | VERIFIED | 80+ lines; 4/4 PASS in 32 s                                                                          |
| `tests/hook-tests/bd-sync.test.sh`                    | CASE 18 fail-soft regression guard                                              | VERIFIED | 18/18 PASS                                                                                            |
| `tests/cross-worktree/simulation.sh`                  | 3-worktree multi-day simulation + 4 invariants + 4 injections                   | VERIFIED | 224 lines; 13/13 PASS in 52 s                                                                        |
| `tests/cross-worktree/lib/setup.sh`                   | mk_source_repo, mk_worktree, cleanup_sandbox, bd_in_worktree                    | VERIFIED | 94 lines; all 4 functions exported                                                                   |
| `tests/cross-worktree/lib/assertions.sh`              | 4 D-04 invariant assertions                                                     | VERIFIED | 124 lines; all 4 functions exported                                                                  |
| `tests/cross-worktree/lib/inject.sh`                  | 4 D-13 failure injections                                                       | VERIFIED | 111 lines; all 4 functions exported                                                                  |
| `tests/install-tests/worktree-backfill.test.sh`       | install.sh backfills 2 pre-existing worktrees                                   | VERIFIED | 143 lines; 9/9 PASS                                                                                  |
| `tests/run-quick.sh`                                  | `cross-worktree-sim` component case wired                                       | VERIFIED | Case branch present                                                                                  |
| `tests/run-all.sh`                                    | `tests/cross-worktree/*.sh` glob added                                          | VERIFIED | Line 5 includes glob                                                                                 |
| `install/memories/worktrees.md`                       | bd memory #8 source, ≥15 lines, full content                                   | VERIFIED | 19 lines, plain prose, no markdown headings                                                          |
| `docs/WORKTREES.md`                                   | Full walkthrough: setup + lifecycle + troubleshooting                            | VERIFIED | 270 lines, all literal strings (D-14, D-15, brew hint) present                                       |
| `docs/WORKTREES-EVIDENCE.md`                          | Curated transcript with 4+ `## Observed:` sections                              | VERIFIED | 169 lines, 5 sections, sanitized                                                                     |
| `README.md`                                           | Multi-worktree section linking to docs/WORKTREES.md                             | VERIFIED | Section + link + macOS hint + status line update                                                     |

### Key Link Verification

| From                                          | To                                                  | Via                                            | Status   | Details                                                                                                          |
| --------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| scripts/cascade-loop.sh                       | `<source>/.beads/.gsd-beads.lock`                   | `exec 9>$LOCK; flock -x -w 30 9`                | VERIFIED | fd-form invocation present                                                                                        |
| scripts/regen-roadmap.sh                      | same lock                                           | same fd-form                                    | VERIFIED | Same                                                                                                             |
| scripts/regen-requirements.sh                 | same lock                                           | same fd-form                                    | VERIFIED | Same                                                                                                             |
| install.sh                                    | flock binary on PATH                                | `command -v flock` pre-flight (line 19)          | VERIFIED | Anti-pattern guards 0 matches; macOS hint emitted to stderr                                                       |
| hooks/bd-sync.sh chain                        | cascade/regen scripts (when locked out)              | `\|\| true` per invocation                      | VERIFIED | bd-sync.test.sh CASE 18 proves chain still fires regen markers when stub cascade exits 1                          |
| install.sh Step 6.5                           | hooks/worktree-post-checkout.sh                      | `bash $REPO_BEADS_DIR/hooks/post-checkout HEAD HEAD 1` | VERIFIED | worktree-backfill.test.sh: 9/9 confirms config + marker on each enumerated worktree                              |
| tests/cross-worktree/simulation.sh            | lib/setup.sh + lib/assertions.sh + lib/inject.sh    | `source` lines                                  | VERIFIED | 3 source lines present                                                                                           |
| tests/cross-worktree/simulation.sh            | Plan 03-01 flock preamble                            | Day-4 burst exercises lock under contention      | VERIFIED | 278 snapshots / 0 mid-write reads observed during 40-invocation burst                                            |
| tests/run-quick.sh                            | tests/cross-worktree/simulation.sh                  | `cross-worktree-sim)` case branch               | VERIFIED | Case present                                                                                                     |
| install.sh memory-seeding loop                | install/memories/worktrees.md                        | `for f in install/memories/*.md`                 | VERIFIED | install.sh BYTE-UNCHANGED by Plan 03-03; loop auto-discovered the new file                                        |
| README.md                                     | docs/WORKTREES.md                                    | markdown link                                   | VERIFIED | `[docs/WORKTREES.md](docs/WORKTREES.md)`                                                                          |
| docs/WORKTREES.md                             | install/memories/worktrees.md + WORKTREES-EVIDENCE  | "See also" cross-links                          | VERIFIED | Both referenced                                                                                                  |
| docs/WORKTREES-EVIDENCE.md                    | tests/cross-worktree/simulation.sh                   | "Reproducing this evidence" + transcript origin | VERIFIED | Reproducer command present                                                                                        |

### Behavioral Spot-Checks

| Behavior                                                                  | Command                                                            | Result                              | Status |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- | ------ |
| Full test suite green                                                     | `bash tests/run-all.sh`                                            | `Suites failed: 0` (exit 0)         | PASS   |
| Cross-worktree simulation passes end-to-end with all invariants/injections | `bash tests/cross-worktree/simulation.sh`                          | `Passed: 13 / 13`, wall time 52 s   | PASS   |
| flock-preamble unit suite                                                 | `bash tests/hook-tests/flock-preamble.test.sh`                     | `Passed: 4 / 4` (~32 s)             | PASS   |
| bd-sync hook suite (incl. CASE 18 fail-soft)                              | `bash tests/hook-tests/bd-sync.test.sh`                            | `Passed: 18 / 18`                   | PASS   |
| Worktree-backfill install test                                            | `bash tests/install-tests/worktree-backfill.test.sh`               | `Passed: 9 / 9`                     | PASS   |
| Anti-pattern: no `-c` form of flock                                       | `grep -F 'flock -x -w 30 -c' scripts/`                              | 0 matches                           | PASS   |
| Anti-pattern: no lock-file deletion                                       | `grep -E 'rm -f.*\.gsd-beads\.lock' scripts/ tests/`               | 0 matches                           | PASS   |
| D-07: hooks/worktree-post-checkout.sh untouched                           | `git diff cfe4884..HEAD -- hooks/worktree-post-checkout.sh`         | empty                               | PASS   |
| Memory file count                                                          | `ls install/memories/*.md \| wc -l`                                  | 8                                   | PASS   |
| Sanitization in evidence doc                                              | `! grep -E '/tmp/gsd-beads-cross-[0-9]+' docs/WORKTREES-EVIDENCE.md` | 0 matches (sanitized)               | PASS   |
| install.sh syntax check                                                    | `bash -n install.sh`                                                | exit 0                              | PASS   |

### Requirements Coverage

| Requirement | Source Plans              | Description                          | Status    | Evidence                                                                                                                                                                                                                                                |
| ----------- | ------------------------- | ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-03      | 03-02, 03-03              | Cross-worktree state sharing         | SATISFIED | install.sh Step 6.5 backfill (D-08) + 3-worktree simulation (Invariant 3 PASS) + worktree-backfill.test.sh 9/9 + documentation triple (memory #8 + README + WORKTREES.md + WORKTREES-EVIDENCE.md) all green                                              |
| REQ-05      | 03-01, 03-02              | Conflict-free concurrent updates      | SATISFIED | flock preamble byte-identical across 3 scripts (D-15) + flock-preamble.test.sh 4/4 + bd-sync.test.sh CASE 18 fail-soft + Day-4 concurrent burst (40 invocations, 278 snapshots, 0 mid-write reads) proves Invariant 4                                  |

Both load-bearing requirements are SATISFIED. No orphaned requirements: REQ-03 + REQ-05 are the only IDs declared by phase-3 plan frontmatter, and REQUIREMENTS.md does not map any other IDs to this phase.

### Anti-Patterns Found

| File                                                       | Line   | Pattern                                                       | Severity | Impact                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/cross-worktree/lib/inject.sh`                       | 51     | `date +%s%N` (GNU-only); macOS BSD emits literally             | INFO (WARN-01 from 03-REVIEW)    | Snapshot filenames collide on macOS, weakening Invariant 4 to a near-no-op there. Linux/WSL2 (the dev host) unaffected — observed 278 unique snapshots. Follow-up.                                                                                                                  |
| `tests/cross-worktree/lib/assertions.sh`                   | 37, 56 | `grep -c \|\| echo 0` produces multi-line "0\\n0"              | INFO (WARN-02)                   | Empty-audit-log path is dormant — simulation always populates the log first. Latent footgun for reuse. Follow-up.                                                                                                                                                                  |
| `tests/hook-tests/bd-sync.test.sh`                         | 219    | `rc=$?` captures wrapper exit (always 0), not hook exit         | INFO (WARN-03)                   | CASE 18's `rc=0` element is currently a tautology; the marker checks (rr=yes / rreq=yes) still validate the fail-soft contract. Follow-up.                                                                                                                                          |
| `tests/install-tests/worktree-backfill.test.sh`            | 121-139| CASE 3.b/3.c grep install.sh source, not parser behavior        | INFO (WARN-04)                   | Tests source-text presence rather than awk-output behavior. Bare-skip fixture is built but never exercised end-to-end. Follow-up.                                                                                                                                                  |
| `install.sh`                                               | 147    | Backfill bash-execs whole post-checkout file, may include user content | INFO (WARN-05) | Pre-existing user content in post-checkout would be invoked with `HEAD HEAD 1`. Follow-up: prefer running `hooks/worktree-post-checkout.sh` source directly.                                                                                                                       |
| `tests/cross-worktree/lib/inject.sh`                       | 24, 91 | Destructive injections lack empty-arg / unsafe-path guards      | INFO (WARN-06)                   | Destructive-by-design footgun for future refactors. Follow-up.                                                                                                                                                                                                                       |
| `tests/cross-worktree/lib/setup.sh`                        | 86     | `cleanup_sandbox` lacks canonical-path comparison                 | INFO (WARN-07)                   | Dormant — mktemp paths used in simulation.sh have no trailing slashes. Follow-up.                                                                                                                                                                                                  |
| `scripts/cascade-loop.sh`                                  | 61     | GNU `\+` BRE in sed (pre-existing from Phase 2)                  | INFO (IN-01)                     | Pre-existing macOS portability issue not introduced by Phase 3. Tracked separately.                                                                                                                                                                                                  |
| `scripts/regen-requirements.sh`                            | 110    | Unquoted `for ... in $list` IFS hazard (pre-existing)             | INFO (IN-02)                     | Dormant; bd labels are kebab-case. Tracked separately.                                                                                                                                                                                                                              |
| `install.sh`                                               | 149    | Backfill counter recomputes via re-running `git worktree list`   | INFO (IN-03)                     | Cosmetic. Follow-up.                                                                                                                                                                                                                                                                  |
| `tests/install-tests/worktree-backfill.test.sh`            | 59-101 | Duplicated worktree-iteration shape                                | INFO (IN-04)                     | Style/refactor. Follow-up.                                                                                                                                                                                                                                                          |

All findings are INFO/advisory. None are BLOCKERs. The phase ships green.

### Pre-Existing Working-Tree Modifications (Not Verification Concerns)

These files appear in `git status` as modified-but-uncommitted; they are intentional WIP from before Phase 3 and are explicitly noted in the executor handoff context as not in scope for Phase 3 verification:

- `hooks/block-state-md.sh`
- `hooks/block-gsd-sdk-mutation.sh`
- `tests/hook-tests/block-state-md.test.sh`
- `tests/hook-tests/block-gsd-sdk-mutation.test.sh`

They do NOT affect Phase 3 must-haves, and their working-tree state has not regressed any Phase 3 test (all 30 truths verify with the pre-existing WIP in place).

### Pre-Existing Dev-Env Caveats (Documented in Phase 2)

- A stray `gsd-beads-vocabulary` (hyphen, not colon) bd memory key persists in the dev's bd store from earlier work. Phase 03-03's commit `a3017e3` tightened `tests/install-tests/{idempotency,memory-seeding}.test.sh` to `^  gsd-beads:` (KEY-only regex), making both suites robust to this pollution. Both suites now green: idempotency 4/4 and memory-seeding 9/9 (recorded in 03-03-SUMMARY.md). Pre-existing pollution itself is unchanged (out of scope).

### Human Verification Required

None. The phase goal ("verify shared `BEADS_DIR` works across multiple worktrees in real use" + "document the recommended worktree setup") is achieved entirely via automated evidence:

- The simulation harness exercises 3 worktrees, 5 days of bd flow, 40 concurrent regen invocations, and 4 failure injections — exit 0 with 13/13 PASS.
- All 4 D-04 invariants assert PASS at runtime.
- Documentation files exist with verified literal-string fidelity (D-14 recovery one-liner, D-15 stderr message, macOS install hint).
- The "real use" claim is bound by the simulation; deeper validation (dogfood adoption on gsd-beads' own v0.2 milestone) is explicitly Deferred in 03-CONTEXT.md.

### Follow-up Items (advisory; from 03-REVIEW.md, do not block phase)

The 03-REVIEW.md just landed with 0 BLOCKERS, 7 WARNINGs, 4 INFOs. None block phase goal achievement. They should be addressed in a follow-up plan or queued as bd issues:

1. **WARN-01:** Replace `date +%s%N` with portable counter in `inject_concurrent_regen` (macOS).
2. **WARN-02:** Use `awk` form for CREATED-line counting in assertions to handle empty-log case.
3. **WARN-03:** Add a non-swallowing `run_bd_payload_strict` for CASE 18 to capture real hook exit code.
4. **WARN-04:** Run install.sh end-to-end against the bare-clone fixture in CASE 3 instead of grepping source.
5. **WARN-05:** Backfill should invoke `hooks/worktree-post-checkout.sh` source rather than the full post-checkout file.
6. **WARN-06:** Add empty-arg + unsafe-path guards to destructive injections.
7. **WARN-07:** Use canonical-path comparison in `cleanup_sandbox`.
8. **IN-01..IN-04:** Pre-existing portability issues + cosmetic test refactors.

### Gaps Summary

No gaps. All 30 truths verified, all artifacts present and substantive, all key links wired, all 4 D-04 invariants assert PASS at runtime, all 4 D-13 injections fire and produce documented behavior, both REQ-03 and REQ-05 are SATISFIED with evidence at three levels (unit test, integration simulation, documented walkthrough). Phase goal achieved.

---

_Verified: 2026-04-28T23:47:53Z_
_Verifier: Claude (gsd-verifier)_
