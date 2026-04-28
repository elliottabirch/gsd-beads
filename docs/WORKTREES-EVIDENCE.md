# gsd-beads worktree validation — observed evidence

Curated transcript distillation from a real run of
`tests/cross-worktree/simulation.sh`. Each section corresponds to one
of the four invariants from `.planning/phases/03-cross-worktree-validation/03-CONTEXT.md`
D-04, plus a fifth section summarizing the four documented failure-mode
injections (D-13).

**Run captured:** 2026-04-28
**Host:** dev WSL2 (Ubuntu 24.04 on Windows 11)
**Wall time:** 49 seconds
**Final result:** 13/13 pass

Sandbox paths in the transcript are sanitized to `/tmp/<sandbox>/`.
bd hash IDs (e.g. `source-4yx`) are content-derived and not sensitive
— they are kept literal so future readers can correlate with bd state.
The full original run is reproducible via the simulation harness itself.

## Observed: No data loss (Invariant 1)

Every issue created across all 3 worktrees in the simulation appears
in `bd list --status=all --json` from the source store. The audit log
(maintained by `simulation.sh`) records each `CREATED <id>` line; the
final assertion compares its count to `bd list | jq 'length'`.

```
# === Day 1: from src — create epic + 3 leaves ===
[PASS] Day 1: created epic source-4yx + 3 leaves (source-7c9, source-895, source-o1k)

# === Day 5: from wt-hotfix — urgent epic + close ===
[PASS] Day 5: 2 phase-epics visible from src after multi-worktree flow

# === Invariants 1-3 (D-04 #1, #2, #3) ===
[PASS] Invariant 1 (no data loss): created=6 listed=6
```

`created=6 listed=6` — every `CREATED` audit-log entry is reflected in
the source's bd state. Sources include 4 from src (1 epic + 3 leaves),
2 from wt-hotfix (1 epic + 1 leaf). No writes lost.

## Observed: No ID collision (Invariant 2)

All hash-based IDs across the 3 worktrees + Day 4 concurrent burst are
unique. The audit log's `CREATED <id>` lines passed through
`sort -u | wc -l` match the total `CREATED` count.

```
[PASS] Invariant 1 (no data loss): created=6 listed=6
[PASS] Invariant 2 (no ID collision): created=6 unique=6
```

`unique=6` against `created=6` — bd's content-derived hash IDs remain
unique under cross-worktree concurrent writes (Day 4 fired 40 regen
invocations across 2 worktrees in ~30 seconds; this assertion runs
afterwards against the merged audit log).

## Observed: No stale state (Invariant 3)

A write completed in worktree-A is observable from worktree-B without
any manual sync step. The simulation writes a `stale-test-<random>`
issue from one worktree and asserts it appears in the other's
`bd list --json` output.

```
# === Day 2: from wt-feature — close 2 leaves ===
[PASS] Day 2: epic source-4yx visible from wt-feature (cross-worktree visibility)
[PASS] Day 2: closed leaves source-7c9 and source-895 from wt-feature

# === Day 3: from wt-feature — close last leaf + cascade ===
[PASS] Day 3: cascade closed epic source-4yx (status=closed)
[PASS] Day 3: epic closure visible from wt-hotfix (cross-worktree state-sharing)

[PASS] Invariant 3 (no stale state): wt-A wrote, wt-B saw 'stale-test-26118-29083'
```

Day 2 demonstrates write-in-src → read-in-wt-feature; Day 3
demonstrates write-in-wt-feature → cascade-close-of-epic →
read-in-wt-hotfix. The dedicated invariant 3 assertion at the bottom
confirms the round-trip with a synthetic title that is impossible to
have existed before the simulation.

## Observed: Atomic markdown views (Invariant 4)

Snapshots captured every 0.1s during Day 4's 40-invocation concurrent
regen burst all show fully-formed `ROADMAP.md` (no mid-write reads,
no truncation). The flock at `<source>/.beads/.gsd-beads.lock`
serializes the cascade + regen chain; the existing `mktemp + mv`
atomic-mv layer in `regen-roadmap.sh` then makes each individual
write observed-or-not, never partial.

```
# === Day 4: concurrent regen burst (D-13.2 + invariant 4) ===
[INJECT D-13.2] concurrent regen burst: 20 × 2 worktrees → /tmp/<sandbox>/snapshots
[INJECT D-13.2] burst complete: 40 regen invocations, 257 snapshots captured
[PASS] Invariant 4 (atomic markdown): 257/257 snapshots well-formed (no mid-write reads)
```

`257/257 snapshots well-formed` — every captured snapshot ends with
the expected terminator line. No `another regen is in progress`
messages observed during the 40-invocation burst (the flock 30-second
timeout was never approached at the empirical ~3.25 writes/sec
embedded-Dolt ceiling).

## Observed: Failure injections behaved as documented

| Injection (D-13) | Observed behavior | Matches `docs/WORKTREES.md`? |
|---|---|---|
| D-13.1 source `.beads/` deleted | `[PASS] D-13.1: source .beads/ deleted → bd commands fail with clear error (rc=1)` | yes — Troubleshooting §"Source `.beads/` deleted" |
| D-13.2 concurrent regen race | `[PASS] Invariant 4: 257/257 snapshots well-formed` (flock serialized; no race) | yes — Troubleshooting §"another regen is in progress" |
| D-13.3 source repo renamed | `[INJECT D-13.3] recovery hint (per D-14): git config --worktree gsd-beads.dir <new>/.beads` | yes — Troubleshooting §"Source repo renamed" (D-14 one-liner) |
| D-13.4 BEADS_DIR unset | `[D-13.4-OBSERVED] discovery-fallback works (bd list returned issues)` | yes — Troubleshooting §"BEADS_DIR unset" (documented precedence) |

Raw transcript excerpts:

```
[INJECT D-13.4] unsetting BEADS_DIR + per-worktree gsd-beads.dir in /tmp/<sandbox>/wt-feature
[D-13.4-OBSERVED] discovery-fallback works (bd list returned issues)
[PASS] D-13.4: BEADS_DIR unset → documented behavior (fallback or clear error)

[INJECT D-13.1] removing /tmp/<sandbox>/source/.beads (DESTRUCTIVE)
[PASS] D-13.1: source .beads/ deleted → bd commands fail with clear error (rc=1)

[INJECT D-13.3] renaming /tmp/<sandbox>/source → /tmp/<sandbox>/source.renamed (DESTRUCTIVE)
[INJECT D-13.3] recovery hint (per D-14): `git config --worktree gsd-beads.dir /tmp/<sandbox>/source.renamed/.beads`
[PASS] D-13.3: source renamed → /tmp/<sandbox>/source no longer exists; recovery documented (per D-14)
```

D-13.4's observed behavior on this dev WSL2 host is the
discovery-fallback path (cwd-scan finds the source's `.beads/` via
git's discovery rules). This matches the precedence documented in
`docs/WORKTREES.md` §"BEADS_DIR unset". The injection-pass criterion
in the simulation accepts EITHER fallback OR a clear error per the
D-13.4 contract; on this host it was fallback.

## Wall-time observation

```
Wall time: 49s
Passed: 13 / 13
```

Three runs captured during Plan 03-02 (50s, 51s, 55s) plus this Plan
03-03 capture (49s) place the simulation at **49-55 seconds wall
time** on this dev WSL2 host. Day 4's concurrent burst is the
dominant cost (~30s from the 40-invocation queue at the embedded-Dolt
~3.25 writes/sec ceiling). Well under the 90-second VALIDATION.md
budget.

## Reproducing this evidence

From the gsd-beads checkout:

```bash
bash tests/cross-worktree/simulation.sh
```

Expected: 13/13 pass, ~50 seconds wall time. The simulation creates
its own sandbox under `/tmp/gsd-beads-cross-XXXXXX` and tears it down
on exit; nothing leaks to the user's bd store.

For the porcelain output format quoted in `docs/WORKTREES.md`'s
backfill section:

```bash
git -C <a-multi-worktree-repo> worktree list --porcelain
```

…produces the same shape (one record per worktree, `worktree`/`HEAD`/
`branch` lines terminated by a blank line).
