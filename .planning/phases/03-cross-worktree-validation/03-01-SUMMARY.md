---
phase: 03-cross-worktree-validation
plan: "01"
subsystem: testing
tags: [flock, serialization, cross-worktree, regen, cascade, install.sh, d-15]

# Dependency graph
requires:
  - phase: 02-build-the-layer
    plan: "01"
    provides: [scripts/cascade-loop.sh, scripts/regen-roadmap.sh, scripts/regen-requirements.sh]
  - phase: 02-build-the-layer
    plan: "02"
    provides: [hooks/bd-sync.sh, settings.fragment.json, tests/hook-tests/bd-sync.test.sh]
  - phase: 02-build-the-layer
    plan: "04"
    provides: [hooks/worktree-post-checkout.sh — canonical git-common-dir + cd && pwd -P resolver pattern]
  - phase: 02-build-the-layer
    plan: "05"
    provides: [install.sh — pre-flight block lines 14-20]
provides:
  - scripts/cascade-loop.sh — sentinel-marked GSD-BEADS LOCK PREAMBLE v1 (acquires <source>/.beads/.gsd-beads.lock via flock -x -w 30 9)
  - scripts/regen-roadmap.sh — same preamble, byte-identical
  - scripts/regen-requirements.sh — same preamble, byte-identical
  - install.sh — pre-flight `command -v flock` check with macOS hint (line 19, between git and node-version checks)
  - tests/hook-tests/flock-preamble.test.sh — 4 CASE blocks (grep cardinality, grep primitives, behavioral timeout on regen-roadmap, uncontended happy path)
  - tests/hook-tests/bd-sync.test.sh CASE 18 — flock-failure-still-fires-chain-and-returns-0 (D-15 fail-soft regression guard)
affects:
  - REQ-05 (concurrent regen race eliminated by flock — was previously papered-over by atomic-mv only)
  - Plan 03-02 simulation harness (concurrent-burst fixture asserts the same lock at <source>/.beads/.gsd-beads.lock)
  - Plan 03-03 docs/WORKTREES.md troubleshooting section (quotes the literal stderr message verbatim)
  - macOS users (install.sh now blocks install with brew install flock hint)

# Tech tracking
tech-stack:
  added:
    - flock (util-linux 2.39.3 on Linux/WSL2; discoteq/flock 0.4.0 on macOS via Homebrew) — kernel-level exclusive file locking with decimal-second timeout
  patterns:
    - "Sentinel-marked lock preamble v1 — `# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---` / `# --- END GSD-BEADS LOCK PREAMBLE v1 ---` — byte-identical across the 3 scripts so a single grep signature validates all three"
    - "fd-form flock (`exec 9>$LOCK ; flock -x -w 30 9`) — auto-releases when fd closes at script exit; no quoting hazard, no nested-shell pitfall (anti-pattern: -c form)"
    - "Lock file lifecycle: lazy-created via `[ -e $LOCK ] || : > $LOCK`; never deleted at script exit (flock semantics tied to fd, not file existence; *.lock already in .beads/.gitignore)"
    - "Source-root resolver = `dirname \"$(cd \"$common\" && pwd -P)\"` — absolutize via `cd && pwd -P` because `git rev-parse --git-common-dir` may return relative `.git` when invoked from the source root with PWD = source root (Pitfall 3 from 03-RESEARCH.md)"
    - "Pre-flight chain pattern: install.sh's existing `command -v X` block extended with `command -v flock` + macOS hint to stderr — fail-fast at install time, not at first bd-sync.sh fire"
    - "fail-soft chain regression guard: stub-injection test that asserts a failing cascade-loop still triggers regen-roadmap and regen-requirements via `|| true`"

key-files:
  created:
    - .planning/phases/03-cross-worktree-validation/03-01-SUMMARY.md
    - tests/hook-tests/flock-preamble.test.sh
  modified:
    - scripts/cascade-loop.sh (preamble inserted at line 24, between MAX_ITER and iter=0)
    - scripts/regen-roadmap.sh (preamble inserted at line 16, between `set -euo pipefail` and the project-root locator)
    - scripts/regen-requirements.sh (preamble inserted at line 16, same insertion point as regen-roadmap)
    - install.sh (flock pre-flight inserted at line 19, between git and node-version checks)
    - tests/hook-tests/bd-sync.test.sh (CASE 18 appended after CASE 17, before the summary block)

key-decisions:
  - "Lock file path resolved via `git rev-parse --git-common-dir` + dirname + `cd \"$common\" && pwd -P` — same canonical pattern as hooks/worktree-post-checkout.sh:19-20 (D-15 source-root resolution + Pitfall 3 mitigation)"
  - "fd-form flock (not -c form) — D-15 anti-pattern enforcement; locked auto-release semantics, no quoting hazard"
  - "Lock file never deleted at script exit — D-15 explicit; *.lock is already in .beads/.gitignore (verified)"
  - "30-second wait timeout matches `bd-sync.sh` hook timeout in settings.fragment.json — D-15 contract; if bumped in either place, both must change together"
  - "Idempotent preamble retrofit — running this plan again would skip insertions because grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' returns 1 on each script (defense against re-runs)"
  - "flock-preamble.test.sh CASE inventory pruned to 4 (not 6) to keep total runtime ~32s under the 90s phase target — behavioral coverage of cascade-loop.sh and regen-requirements.sh is delegated to plan 03-02's simulation harness, where a real concurrent burst exercises all three under contention"
  - "install.sh flock pre-flight uses `>&2` for the error message (small upgrade over surrounding lines that write to stdout) — error messages should always go to stderr"

requirements-completed: [REQ-05]

# Metrics
metrics:
  duration: "~21 minutes"
  started: 2026-04-28T21:15:54Z
  completed: 2026-04-28T21:36:43Z
  tasks_completed: 3
  files_modified_count: 4
  files_created_count: 1
  test_cases_added: 5 (4 in flock-preamble.test.sh + 1 in bd-sync.test.sh CASE 18)
  commits: 3
---

# Phase 03 Plan 01: Flock Retrofit Summary

D-15 implemented end-to-end: cascade-loop.sh, regen-roadmap.sh, and regen-requirements.sh now serialize on a single shared `<source-repo>/.beads/.gsd-beads.lock` via `flock -x -w 30 9`, install.sh fails fast on hosts without flock (with the documented `brew install flock` hint for macOS), and bd-sync.sh's existing `|| true` chain fails-soft when a flock acquisition times out.

## What Changed

### Lock preamble (3 scripts, byte-identical)

The canonical preamble from `03-RESEARCH.md` §"Code Examples" was dropped verbatim into all three scripts. Sentinel markers `# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---` and `# --- END GSD-BEADS LOCK PREAMBLE v1 ---` bracket the block so a single grep signature in `flock-preamble.test.sh` CASE 1 validates all three at once.

**Insertion line numbers (for plan 03-02's simulation harness invariant scan):**

| Script                          | BEGIN sentinel line | Inserted after        |
|---------------------------------|---------------------|----------------------|
| `scripts/cascade-loop.sh`       | line 24             | `MAX_ITER="${MAX_ITER:-20}"` (line 22) |
| `scripts/regen-roadmap.sh`      | line 16             | `set -euo pipefail` (line 14)          |
| `scripts/regen-requirements.sh` | line 16             | `set -euo pipefail` (line 14)          |

Insertion is AFTER `set -euo pipefail` so the preamble's `exit 1` paths emit stderr cleanly, and BEFORE the `mktemp` block in regen-roadmap/requirements so a locked-out invocation never creates a tempfile that would then leak.

### install.sh pre-flight check

```bash
command -v flock >/dev/null 2>&1 || { echo "ERROR: flock not installed (macOS: brew install flock)" >&2; exit 1; }
```

Inserted at line 19, between the existing `command -v git` check (line 18) and the node-version check (line 20). Stderr-bound (`>&2`) error message, matches the surrounding `command -v X` shape. Pitfall 1 closed: macOS users can no longer install gsd-beads onto a system that will silently fail on every bd-sync because flock is missing.

### bd-sync.test.sh CASE 18 — fail-soft regression guard

Appended a new CASE that injects a stub `cascade-loop.sh` simulating a flock timeout (exits 1 with the documented stderr message), then asserts:

- bd-sync.sh exits 0 (fail-soft preserved per D-15)
- regen-roadmap stub fires (`|| true` gates each invocation independently)
- regen-requirements stub fires (same)

A future refactor that ever broke `|| true` (e.g., switched to unguarded chaining) would fail this CASE loudly.

### flock-preamble.test.sh — 4 CASE green-lock

| CASE  | What it asserts                                                                                                       | Runtime |
|-------|-----------------------------------------------------------------------------------------------------------------------|---------|
| 1     | `BEGIN GSD-BEADS LOCK PREAMBLE v1` appears exactly once in each of 3 scripts (grep cardinality)                       | <1s     |
| 2     | Each script contains `flock -x -w 30 9`, `git rev-parse --git-common-dir`, `cd "$common" && pwd -P`, and the literal stderr message (grep primitives) | <1s     |
| 3     | regen-roadmap.sh under contended lock (backgrounded `flock -x` holder for 35s) exits non-zero in ~30s with `another regen is in progress` on stderr | ~30s    |
| 4     | regen-roadmap.sh on uncontended fixture (3-level-hierarchy bd state) exits 0; lock file lazy-created at `<fixture>/.beads/.gsd-beads.lock`; ROADMAP.md produced | <2s     |

Total runtime: ~32s — well under the 90s phase target in `03-VALIDATION.md`. Behavioral coverage of cascade-loop.sh and regen-requirements.sh is delegated to plan 03-02's simulation harness (concurrent burst exercises all three under contention with realistic bd state).

## Failure-mode contract (verbatim — for plan 03-03's WORKTREES.md troubleshooting)

When a worktree's bd-sync.sh chain hits a held lock and times out at 30s:

```
[gsd-beads] another regen is in progress at <LOCK_PATH> — retry shortly
```

Where `<LOCK_PATH>` is the absolute path to `<source-repo>/.beads/.gsd-beads.lock`. The blocked script exits 1; bd-sync.sh's `|| true` chain absorbs the non-zero exit and continues. Subsequent regen-roadmap and regen-requirements invocations within the same chain will themselves race for the lock and serialize cleanly.

## macOS install path

`brew install flock` (discoteq port, util-linux flag-compatible). install.sh's pre-flight enforces the dependency at install time:

```
ERROR: flock not installed (macOS: brew install flock)
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Add flock preamble to all three regen/cascade scripts** — `1bb6dd2` (feat)
2. **Task 2: install.sh flock pre-flight + flock-preamble test suite** — `a4b1e5b` (feat)
3. **Task 3: bd-sync.test.sh CASE 18 fail-soft guard** — `4129767` (test)

## Files Created/Modified

- `scripts/cascade-loop.sh` — preamble at line 24
- `scripts/regen-roadmap.sh` — preamble at line 16
- `scripts/regen-requirements.sh` — preamble at line 16
- `install.sh` — flock pre-flight at line 19
- `tests/hook-tests/bd-sync.test.sh` — CASE 18 appended (now 18/18 cases)
- `tests/hook-tests/flock-preamble.test.sh` — created with exactly 4 CASE blocks

## Decisions Made

- **Insertion points kept tight to plan spec:** cascade-loop.sh after argv parse + MAX_ITER (so flock preamble is part of "real work", not preamble-of-preamble); regen-* immediately after `set -euo pipefail` so a locked-out invocation never creates an mktemp tempfile.
- **CASE 4 reuses existing 3-level-hierarchy fixture builder** (`tests/fixtures/bd-helpers/3-level-hierarchy.sh`) rather than spinning a fresh `bd init` — avoids the bd init friction in /tmp and provides realistic bd state for regen-roadmap.sh's body to chew on. Tradeoff: CASE 4 implicitly depends on the same fixture builder regen-roadmap.test.sh CASE 1 uses; if that fixture breaks, both tests fail (acceptable signal).
- **`>&2` on install.sh's flock error message** is a small but correct upgrade over the surrounding pre-flight lines (which write to stdout). Errors belong on stderr; the surrounding `command -v X` lines are technically ill-shaped but kept as-is to avoid scope creep.
- **timeout 33 wrapper around CASE 3's flock invocation** — a safety belt that caps test runtime even if the flock holder somehow escapes the kill at the end of the case. The expected exit is from the 30s flock timeout itself, not the timeout(1) wrapper.

## Deviations from Plan

None — plan executed exactly as written. Acceptance criteria for all three tasks met on first pass:
- All 12 grep/cardinality acceptance criteria green (3 sentinels × 4 patterns each)
- 2 anti-pattern guards return 0 (no `flock -x -w 30 -c`, no `rm -f .gsd-beads.lock`)
- bash -n syntax check green for 3 scripts + install.sh + bd-sync.test.sh + flock-preamble.test.sh
- All 7 verification suites pass: flock-preamble (4/4), bd-sync (18/18), cascade-loop (4/4), regen-roadmap (5/5), regen-requirements (6/6), install.sh syntax, path-precedence (4/4)
- flock-preamble.test.sh has exactly 4 `^# CASE [0-9]` matches
- hooks/worktree-post-checkout.sh NOT modified (D-07)
- No `gsd-sdk` mutations in any commit

## Issues Encountered

**1. Doc-comment matched the CASE-count grep regex**

While drafting flock-preamble.test.sh, an explanatory header comment that started with `# CASE 3+5 (...) are delegated to plan 03-02's simulation harness` matched the acceptance criterion's `grep -c '^# CASE [0-9]' = 4` regex (returned 5). Resolution: rephrased the doc comment to start with `# Behavioral coverage for ...` so it no longer matches the regex but conveys the same trade-off note. No production behavior affected — only the test file's own self-documenting comments.

## User Setup Required

None — no external service configuration required. The only new dependency (`flock`) is enforced by install.sh's pre-flight; macOS users following the install instructions will be told to `brew install flock` before install.sh proceeds.

## Threat Flags

None — the flock retrofit is defense-in-depth additive over the existing atomic-mv pattern. No new network endpoints, auth paths, or trust boundary surface beyond what was already in the threat model. T-03-01 through T-03-04 from the plan are all `mitigate` or `accept` per the plan's threat register, and the implementation matches.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: scripts/cascade-loop.sh
- FOUND: scripts/regen-roadmap.sh
- FOUND: scripts/regen-requirements.sh
- FOUND: install.sh
- FOUND: tests/hook-tests/flock-preamble.test.sh
- FOUND: tests/hook-tests/bd-sync.test.sh

**Commits verified to exist:**
- FOUND: 1bb6dd2 (Task 1)
- FOUND: a4b1e5b (Task 2)
- FOUND: 4129767 (Task 3)

**Sentinel cardinality verified:**
- scripts/cascade-loop.sh: 1
- scripts/regen-roadmap.sh: 1
- scripts/regen-requirements.sh: 1

**Anti-pattern guards verified:**
- `flock -x -w 30 -c` (forbidden form): 0 matches
- `rm -f .gsd-beads.lock` or `rm $LOCK`: 0 matches

## Next Phase Readiness

- Plan 03-02 (simulation harness + install.sh worktree backfill) can proceed: the flock preamble is in place, the lock path is documented, and the failure-mode contract is locked. The simulation harness's concurrent-burst fixture should grep `BEGIN GSD-BEADS LOCK PREAMBLE v1` in all three scripts as an invariant check, and assert no `another regen is in progress` messages appear under the 20-burst-per-worktree workload (well under the 30s timeout per Pitfall 4 analysis).
- Plan 03-03 (documentation triple) can quote the literal stderr message verbatim from the "Failure-mode contract" section above — included precisely because docs/WORKTREES.md troubleshooting depends on it.
- macOS install path documented: `brew install flock` is the canonical install command for the discoteq port (util-linux flag-compatible).

---
*Phase: 03-cross-worktree-validation*
*Plan: 01*
*Completed: 2026-04-28T21:36:43Z*
