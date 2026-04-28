---
phase: 03-cross-worktree-validation
reviewed: 2026-04-28T23:30:30Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - scripts/cascade-loop.sh
  - scripts/regen-roadmap.sh
  - scripts/regen-requirements.sh
  - install.sh
  - tests/hook-tests/flock-preamble.test.sh
  - tests/hook-tests/bd-sync.test.sh
  - tests/cross-worktree/simulation.sh
  - tests/cross-worktree/lib/setup.sh
  - tests/cross-worktree/lib/assertions.sh
  - tests/cross-worktree/lib/inject.sh
  - tests/install-tests/worktree-backfill.test.sh
  - tests/run-quick.sh
  - tests/run-all.sh
findings:
  blocker: 0
  warning: 7
  info: 4
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-28T23:30:30Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 3 deltas across plans 03-01 (flock retrofit), 03-02
(install backfill + cross-worktree simulation harness). The flock
preamble is byte-identical across all three scripts and uses the
correct fd-form (`flock -x -w 30 9`); lock-path resolution via
`dirname "$(cd "$common" && pwd -P)"` is sound from both main repo
and linked worktrees (verified by direct git-rev-parse trace). The
install.sh worktree enumeration awk parser correctly skips `bare`
and `prunable` records (verified against a real bare clone fixture).

No BLOCKERs found. Seven WARNINGs surface real correctness/portability
gaps — most notably:
1. `inject_concurrent_regen` uses `date +%s%N` which is GNU-only;
   on macOS BSD this silently collides snapshot filenames and
   weakens the atomic-markdown invariant to a near-no-op.
2. `assert_no_data_loss` mishandles the empty-audit-log case
   (`grep -c` + `|| echo 0` produces a multi-line "0\n0" that
   breaks `[ -le ]` arithmetic — only papered over because the
   simulation always populates the log first).
3. CASE 18 in bd-sync.test.sh asserts `rc=0` on a value that is
   permanently 0 (the `run_bd_payload` helper swallows the hook's
   exit code via `|| true`). The test is currently green for the
   wrong reason.
4. `worktree-backfill.test.sh` CASE 3.b/3.c verifies bare-skip and
   prunable-skip via `grep` against install.sh source rather than
   ever running the awk parser end-to-end against the bare-clone
   fixture it just built.

The byte-identical-preamble requirement holds (verified via diff).
The 4-invariant / 4-injection contract from D-04 + D-13 is structurally
in place. Findings below are all fixable without architectural rework.

## Warnings

### WR-01: `inject_concurrent_regen` snapshot timestamp not portable to macOS BSD

**File:** `tests/cross-worktree/lib/inject.sh:51`
**Issue:** The snapshot loop uses `date +%s%N` to produce a unique
nanosecond-precision filename for each capture:

```bash
cp "$roadmap" "$snap_dir/roadmap-snap-$(date +%s%N).md" 2>/dev/null || true
```

The `%N` format specifier is a GNU coreutils extension. On macOS BSD
`date`, `%N` is emitted **literally** — every snapshot in the same
second collides on the same filename `roadmap-snap-1714303200%N.md`
and `cp` overwrites the previous file. With the burst running ~40
regen invocations in well under a second, the assertion at
`assertions.sh:99-111` ends up scanning a single file (or a tiny
handful), defeating the "captured during the burst" contention
intent. The phase plan calls macOS a primary supported platform
(spike-findings Pitfall 1).

**Fix:** Use a strictly-portable monotonic counter:

```bash
local snap_n=0
( while [ ! -f "$snap_dir/.stop" ]; do
    if [ -f "$roadmap" ]; then
      cp "$roadmap" "$(printf '%s/roadmap-snap-%06d-%s.md' "$snap_dir" "$snap_n" "$(date +%s)")" 2>/dev/null || true
      snap_n=$((snap_n + 1))
    fi
    sleep 0.1
  done
) &
```

Or use `python -c 'import time; print(int(time.time() * 1e9))'`
guarded by a `command -v python` check — but a counter is simpler.

---

### WR-02: `assert_no_data_loss` produces multi-line "0\n0" on empty audit log

**File:** `tests/cross-worktree/lib/assertions.sh:37`
**Issue:** When the audit log contains zero CREATED lines, `grep -c`
prints "0" and exits with code 1. The `|| echo 0` fallback then
prints another "0", so `created` becomes the literal two-line string
`"0\n0"`:

```bash
created=$(grep -c '^CREATED' "$audit_log" 2>/dev/null || echo 0)
```

The subsequent arithmetic test `[ "$created" -le "$listed" ]` errors
out with `integer expression expected: 0\n0` (verified empirically),
which under `set -uo pipefail` (no `-e`) evaluates as false and
silently fails the assertion. The same pattern appears at line 56 in
`assert_no_id_collision`. The simulation always populates the audit
log before invoking the assertions, so the bug is dormant — but it
will bite anyone reusing this library in a different test, or anyone
who refactors the simulation order.

**Fix:** Use `wc -l` (which always returns 0 cleanly) and drop the
`|| echo 0` fallback:

```bash
created=$(grep -c '^CREATED' "$audit_log" 2>/dev/null; true)
# or, more robustly:
created=$(awk '/^CREATED/{c++} END{print c+0}' "$audit_log" 2>/dev/null)
```

The `awk` form always emits exactly one numeric line including 0.

---

### WR-03: CASE 18 always passes — `rc` captures wrapper, not hook exit

**File:** `tests/hook-tests/bd-sync.test.sh:219-225`
**Issue:** The `run_flock_failure_test` helper invokes `run_bd_payload`
and captures `rc=$?`:

```bash
run_bd_payload "$command"
rc=$?
```

But `run_bd_payload` (defined at line 30-48) ends with
`printf '%s' "$payload" | "$SYNC_HOOK" 2>/dev/null || true` — the
trailing `|| true` swallows the hook's exit status, so the helper
always returns 0. The `rc=0` assertion at line 225 is therefore a
tautology. The CASE 18 test claims to verify "bd-sync.sh's `|| true`
chain still fires regen-roadmap and regen-requirements when
cascade-loop returns non-zero" — the marker checks (`rr_fired`,
`rreq_fired`) do exercise that contract, but the `rc=0` element of
the assertion is dead code. If the hook itself ever started leaking
non-zero exit codes (a regression we want to catch), this test would
not catch it.

**Fix:** Add a non-swallowing variant for tests that care about the
hook's exit code:

```bash
run_bd_payload_strict() {
  local cmd="$1"
  local payload
  payload=$(jq -n --arg cmd "$cmd" '{ ... }')
  printf '%s' "$payload" | "$SYNC_HOOK" 2>/dev/null
  return $?
}
```

Then have CASE 18 call `run_bd_payload_strict "$command"; rc=$?`.

---

### WR-04: CASE 3.b/3.c verify install.sh source text rather than parser behavior

**File:** `tests/install-tests/worktree-backfill.test.sh:121-139`
**Issue:** CASE 3 builds a real bare-clone fixture (`source-bare`)
with a linked worktree, then validates only that the awk source code
in install.sh contains the literal strings `/^bare$/` and
`/^prunable/`:

```bash
if grep -F '/^bare$/' "$REPO_ROOT/install.sh" >/dev/null; then
  _pass "CASE 3.b: install.sh awk parser contains bare-skip rule"
```

This is a code-presence check, not a behavior check. If a future
refactor rewrites the parser to match the same patterns differently
(e.g., `/^(bare|prunable)/`) or moves the matcher to a helper, the
test fails for the wrong reason. Conversely, if the bare-skip rule
were broken (say, swapped `next` for `print`), CASE 3.b would still
pass.

**Fix:** Run the actual install.sh against the bare-clone fixture
and assert `git config --worktree gsd-beads.dir` is **NOT** set on
the bare repo (because backfill should have skipped it), but IS
set on the linked `wt-from-bare`. That ties the assertion to the
behavior the parser is meant to deliver.

---

### WR-05: Backfill silently invokes pre-existing post-checkout content

**File:** `install.sh:147`
**Issue:** Step 6.5's backfill loop directly bash-execs the project's
post-checkout hook:

```bash
( cd "$wt_path" && bash "$REPO_BEADS_DIR/hooks/post-checkout" HEAD HEAD 1 ) || true
```

The post-checkout file may contain user-written content **before**
the GSD-BEADS sentinel block (any pre-existing project hook would
have been preserved by the Step 6 sentinel-replace at line 123-124).
Running that pre-existing content with arguments `HEAD HEAD 1` could
trigger unintended side effects (e.g., an existing checkout hook
that runs `npm install` on flag=1 will run during install).

`|| true` swallows any errors silently — the user gets no signal if
their pre-existing hook breaks under the synthetic `HEAD HEAD 1`
arguments. This is a real change from Step 6 (which only **edits**
the file) to Step 6.5 (which **executes** it).

**Fix:** Source only the GSD-BEADS sentinel block, not the whole
file. Either (a) extract the GSD section into a tempfile and run
just that, or (b) use the `worktree-post-checkout.sh` source file
directly (which already contains only the GSD block):

```bash
( cd "$wt_path" && bash "$REPO/hooks/worktree-post-checkout.sh" HEAD HEAD 1 ) || true
```

This decouples the backfill from whatever else lives in the user's
post-checkout hook.

---

### WR-06: `inject_source_beads_deleted` and `inject_source_renamed` lack empty-arg guards

**File:** `tests/cross-worktree/lib/inject.sh:24-29, 91-96`
**Issue:** Neither destructive injection validates `$source_root` is
non-empty before operating:

```bash
inject_source_beads_deleted() {
  local source_root="$1"
  echo "[INJECT D-13.1] removing $source_root/.beads (DESTRUCTIVE)"
  rm -rf "$source_root/.beads"
}
```

If a future refactor calls these functions without an argument (or
with an unset variable under `set -u`), the rm degrades to
`rm -rf "/.beads"` — fortunately fails permissions, but the same
pattern in `inject_source_renamed` becomes
`mv "" ".renamed"` which is just an error. Still, this is a footgun
for a destructive-by-design library.

**Fix:** Add a guard at the top of each:

```bash
inject_source_beads_deleted() {
  local source_root="${1:?inject_source_beads_deleted: source_root required}"
  case "$source_root" in
    ""|"/"|"/tmp"|"$HOME") echo "[INJECT] refusing unsafe path: $source_root"; return 2 ;;
  esac
  rm -rf "$source_root/.beads"
}
```

The case-based denylist is conservative but matches the tone of
`tests/cross-worktree/lib/`'s "non-destructive by default" claim
in 03-PLAN.md.

---

### WR-07: `cleanup_sandbox` worktree-prune loop runs unbounded shell-pipe-while

**File:** `tests/cross-worktree/lib/setup.sh:86-91`
**Issue:** The cleanup function pipes worktree paths into a `while
read` loop:

```bash
git -C "$root/source" worktree list --porcelain 2>/dev/null \
  | awk '/^worktree / { print substr($0, 10) }' \
  | while IFS= read -r wt; do
      [ "$wt" = "$root/source" ] && continue
      git -C "$root/source" worktree remove --force "$wt" 2>/dev/null || true
    done
```

The `awk '/^worktree /'` pattern emits the source-repo line as well
(porcelain always lists the main worktree first). The `[ "$wt" =
"$root/source" ] && continue` skip relies on path equality — but if
`$root` ends with a trailing slash, or `$root/source` is symlinked,
the comparison fails and the cleanup tries to `worktree remove`
the source itself (which errors and is swallowed by `|| true`,
but it's a lurking footgun). The mktemp paths used in
simulation.sh do NOT have trailing slashes, so the bug is dormant.

**Fix:** Use the same awk pattern as install.sh Step 6.5 (which
already filters bare/prunable AND uses the blank-line terminator,
making it more robust). Or compare canonicalized paths:

```bash
local src_canonical
src_canonical=$(cd "$root/source" 2>/dev/null && pwd -P) || return 0
... | while IFS= read -r wt; do
  local wt_canonical
  wt_canonical=$(cd "$wt" 2>/dev/null && pwd -P) || continue
  [ "$wt_canonical" = "$src_canonical" ] && continue
  ...
done
```

## Info

### IN-01: Cascade closed-count parses with `\(...\)` GNU sed style

**File:** `scripts/cascade-loop.sh:61`
**Issue:** Line 61 parses bd's "Closed N epic" output with:

```bash
closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
```

The `\([0-9]\+\)` form is BRE (basic regex) and works in GNU sed.
On macOS BSD sed, `\+` is **not** a metacharacter — BSD sed treats
`\+` as a literal `+`, so this match silently fails on macOS,
causing `closed` to be empty and `total_closed` to never increment.
The cascade still works (the `bd epic close-eligible` loop still
breaks on "No epics eligible"), but the user-visible total is
always 0 on macOS.

**Note:** This file's body is unchanged from Phase 2 (the Phase 3
delta is only the lock preamble); the bug pre-exists. Flagging here
only because Phase 3's portability mandate makes it surface-relevant.

**Fix:** Use POSIX-portable BRE:

```bash
closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9][0-9]*\) epic.*$/\1/p' | head -1)
```

`[0-9][0-9]*` is the portable equivalent of `[0-9]\+`.

---

### IN-02: `regen-requirements.sh` `for cat in $categories` lacks IFS reset

**File:** `scripts/regen-requirements.sh:128-136`
**Issue:** The unquoted `for cat in $categories` and `for version in
$versions` (line 110) rely on the default IFS to split. If a category
or version label legitimately contains whitespace (e.g.,
`category:my docs`), it would split mid-token. bd label conventions
in this project use kebab-case (no spaces), so this is dormant. The
inner `IFS=','` swap at 264-269 of the same file shows the author is
aware of IFS hazards — applying the same care here would harden the
loop.

**Note:** This is pre-existing Phase 2 code; not a Phase 3 delta.
Flagged only because the Phase 3 review touched the surrounding
title-case awk fix.

**Fix:** Read into an array via a here-string (bash 4+ portable):

```bash
mapfile -t version_arr < <(printf '%s' "$reqs_json" | jq -r '...')
for version in "${version_arr[@]}"; do
  ...
done
```

---

### IN-03: Backfill counter recomputes by re-running `git worktree list`

**File:** `install.sh:149`
**Issue:** The post-loop `echo` recomputes the worktree count by
re-invoking `git worktree list --porcelain`:

```bash
echo "backfilled gsd-beads config across $(git -C "$PWD" worktree list --porcelain | awk '/^worktree /{c++} END{print c+0}') worktree record(s)"
```

This double-counts if a `bare` record exists (the awk here counts
all `^worktree ` lines, unlike the Step-6.5 filter which skips
bare/prunable). For the gsd-beads target use case (linked worktrees
on a non-bare source), the count is correct — but it's inconsistent
with the loop's own filter.

**Fix:** Tally the loop count via a counter:

```bash
backfilled=0
... | while ...; do
  ( cd "$wt_path" && bash ... ) || true
  backfilled=$((backfilled + 1))
done
echo "backfilled gsd-beads config across $backfilled worktree record(s)"
```

Note: the `while` runs in a subshell (pipe), so the counter must be
collected via a tempfile or a `< <(...)` process substitution, not
a bare `|`.

---

### IN-04: Identical `for i in 1 2` loop pattern in `worktree-backfill.test.sh`

**File:** `tests/install-tests/worktree-backfill.test.sh:59-84, 88-101`
**Issue:** CASE 1 and CASE 2 share an identical worktree-iteration
shape (resolve gitdir → derive abs_gitdir → compose marker_path).
The two blocks are 25+ lines of duplicated logic. Extracting a helper
`assert_marker_present <wt> <wt_id> <case_id>` would reduce drift
risk if a future test adds a third case or changes the marker path
convention.

**Fix:** Extract a helper:

```bash
assert_marker_present() {
  local wt="$1" wt_id="$2" case_id="$3"
  local gitdir abs_gitdir marker_path
  gitdir=$(git -C "$wt" rev-parse --git-dir 2>/dev/null || echo "")
  case "$gitdir" in
    /*) abs_gitdir="$gitdir" ;;
    *)  abs_gitdir="$wt/$gitdir" ;;
  esac
  marker_path="$abs_gitdir/info/.gsd-beads-configured"
  if [ -f "$marker_path" ]; then
    _pass "$case_id: worktree $wt_id has marker at $marker_path"
  else
    _fail "$case_id: worktree $wt_id missing marker at $marker_path"
  fi
}
```

---

_Reviewed: 2026-04-28T23:30:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
