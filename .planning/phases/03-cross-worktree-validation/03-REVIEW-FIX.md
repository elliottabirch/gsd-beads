---
phase: 03-cross-worktree-validation
fixed_at: 2026-04-28T17:20:00Z
review_path: .planning/phases/03-cross-worktree-validation/03-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-28T17:20:00Z
**Source review:** `.planning/phases/03-cross-worktree-validation/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (WR-01..WR-07; IN-01..IN-04 out of scope per `fix_scope: critical_warning`)
- Fixed: 7
- Skipped: 0

**Verification (all green):**
- `bash tests/run-all.sh` → exit 0 (19 suites, all passing — 18+43+30+4+4+6+5+4+9+3+4+9+9+6+5+13+4+7+4)
- `bash tests/cross-worktree/simulation.sh` → exit 0 (13/13 invariants, 216 snapshots captured, ~48s wall)
- `bash tests/install-tests/worktree-backfill.test.sh` → exit 0 (9/9)
- `bash tests/hook-tests/bd-sync.test.sh` → exit 0 (18/18, including the now-strict CASE 18)

## Fixed Issues

### WR-01: `inject_concurrent_regen` snapshot timestamp not portable to macOS BSD

**Files modified:** `tests/cross-worktree/lib/inject.sh`
**Commit:** `0d4ce8f`
**Applied fix:** Replaced `date +%s%N` (GNU-only) with a zero-padded
monotonic counter plus `date +%s` epoch suffix
(`roadmap-snap-NNNNNN-EPOCH.md`). The counter is incremented inside
the snapshot subshell each loop, guaranteeing a unique filename per
snapshot on every supported platform — not just GNU coreutils.

### WR-02: `assert_no_data_loss` produces multi-line "0\n0" on empty audit log

**Files modified:** `tests/cross-worktree/lib/assertions.sh`
**Commit:** `21c8038`
**Applied fix:** Switched the `created` counter in `assert_no_data_loss`
and `assert_no_id_collision` from `grep -c PAT FILE 2>/dev/null || echo 0`
(which produces `"0\n0"` when the file is empty: grep prints "0" and
exits 1, then `|| echo 0` appends a second "0") to
`awk '/^CREATED/{c++} END{print c+0}' FILE` which always emits
exactly one numeric line. Hardened the `listed` and `uniq` fallbacks
to single integers as well (`${var:-0}` + `tr -d ' '` for `wc -l`).

### WR-03: CASE 18 always passes — `rc` captures wrapper, not hook exit

**Files modified:** `tests/hook-tests/bd-sync.test.sh`
**Commit:** `58e8e55`
**Applied fix:** Added a `run_bd_payload_strict` helper that does NOT
swallow the hook's exit via `|| true`, and switched
`run_flock_failure_test` (CASE 18) to use it. The fail-soft contract
requires bd-sync.sh to absorb cascade-loop's exit 1 and still return 0;
with this fix the `rc=0` assertion is now meaningful (it would catch
a regression where the hook leaks a non-zero exit code) rather than a
tautology against the wrapper. Confirmed: all 18 cases still pass.

### WR-04: CASE 3.b/3.c verify install.sh source text rather than parser behavior

**Files modified:** `tests/install-tests/worktree-backfill.test.sh`
**Commit:** `3498f6a`
**Applied fix:** Replaced the source-grep checks (`grep -F '/^bare$/'`
and `grep -F '/^prunable/'` against `install.sh`) with an end-to-end
behavior test: the awk parser block is extracted from `install.sh`
(via an awk-driven extractor that scans for the `worktree list
--porcelain | awk '` opener) and then run against the real bare-clone
porcelain output. CASE 3.b asserts the parser does NOT emit the bare
path; CASE 3.c asserts it DOES emit the linked worktree (so the test
catches both over-skip and under-skip regressions). All 9 cases pass.

### WR-05: Backfill silently invokes pre-existing post-checkout content

**Files modified:** `install.sh`
**Commit:** `fad956a`
**Applied fix:** Step 6.5's backfill loop now invokes
`$REPO/hooks/worktree-post-checkout.sh` (the GSD-BEADS shim source)
directly, rather than `$PWD/.beads/hooks/post-checkout` (the user's
project file, which may contain pre-existing content preserved by
Step 6's sentinel-replace). This decouples backfill from any
unrelated user post-checkout logic that might run on `flag=1`.
Removed the now-unused `REPO_BEADS_DIR` local. Confirmed:
worktree-backfill test still 9/9 pass.

### WR-06: `inject_source_beads_deleted` and `inject_source_renamed` lack empty-arg guards

**Files modified:** `tests/cross-worktree/lib/inject.sh`
**Commit:** `d675f7f`
**Applied fix:** Added `${1:?...}` required-arg guards on both
destructive injections plus a conservative denylist (`""`, `/`,
`/tmp`, `$HOME`) that returns rc=2 and prints to stderr if the
caller passes one of those values. None of those paths is ever a
legitimate sandbox source_root; the guards ensure that a future
caller bug never degrades to `rm -rf "/.beads"` or
`mv "" ".renamed"`.

### WR-07: `cleanup_sandbox` worktree-prune source-skip is fragile

**Files modified:** `tests/cross-worktree/lib/setup.sh`
**Commit:** `6aaaa3b`
**Applied fix:** Replaced the raw `[ "$wt" = "$root/source" ]` skip
with canonicalized comparison using `pwd -P` (POSIX, vs GNU-only
`realpath`). The function now resolves both the source repo and each
worktree path to its physical absolute form before comparing, so
trailing-slash drift in `$root` or symlinks in either path can no
longer cause the cleanup to mistakenly target the source repo.
Smoke-tested with normal, trailing-slash, and worktree-bearing
sandbox layouts: cleanup correctly prunes all worktrees and removes
the root in every case.

---

_Fixed: 2026-04-28T17:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
