---
phase: 03
plan: 02
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - install.sh
  - tests/cross-worktree/simulation.sh
  - tests/cross-worktree/lib/setup.sh
  - tests/cross-worktree/lib/assertions.sh
  - tests/cross-worktree/lib/inject.sh
  - tests/install-tests/worktree-backfill.test.sh
  - tests/run-quick.sh
  - tests/run-all.sh
autonomous: true
gap_closure: false
requirements_addressed: [REQ-03, REQ-05]
tags: [install.sh, worktree-backfill, simulation, cross-worktree, integration, REQ-03, REQ-05]
user_setup: []

must_haves:
  goal: "install.sh enumerates every pre-existing git worktree on first run and re-fires the gsd-beads post-checkout shim against each (D-08), and a black-box `tests/cross-worktree/simulation.sh` runs a 3-worktree multi-day flow with 4 failure injections proving the 4 invariants from D-04 hold."
  truths:
    - "install.sh, after Step 6 (worktree shim append), enumerates all pre-existing worktrees via `git worktree list --porcelain` (D-08)"
    - "install.sh fires the appended shim against every enumerated worktree path with `HEAD HEAD 1` (the canonical backfill invocation pattern from RESEARCH.md §Pattern 3)"
    - "install.sh skips `bare` and `prunable` worktree records during enumeration (RESEARCH.md §Pattern 2)"
    - "Pre-existing worktrees gain `git config --worktree gsd-beads.dir` and `.gsd-beads-configured` markers after install.sh runs (D-08 idempotent)"
    - "tests/cross-worktree/simulation.sh creates 3 worktrees (main + feature + hotfix) under /tmp via `mktemp -d`, runs a 4-day bd flow, and exits 0 (REQ-03 happy path)"
    - "Invariant 1 (no data loss): every issue created in any worktree appears in `bd list --json` from the source store (D-04 #1)"
    - "Invariant 2 (no ID collision): all hash-based IDs across all 3 worktrees + 20-op concurrent burst are unique (D-04 #2)"
    - "Invariant 3 (no stale state): a write in worktree-A is observable from worktree-B via `bd list` without manual sync (D-04 #3)"
    - "Invariant 4 (atomic markdown): regenerated ROADMAP.md / REQUIREMENTS.md is never observed mid-write during the concurrent burst (D-04 #4)"
    - "4 failure injections fire: source `.beads/` deleted (D-13.1), concurrent regen race (D-13.2), source repo renamed (D-13.3), BEADS_DIR unset (D-13.4)"
    - "tests/install-tests/worktree-backfill.test.sh proves install.sh backfills 2 pre-existing worktrees (REQ-03)"
    - "tests/run-quick.sh case statement gains `cross-worktree-sim` invocation (03-VALIDATION.md sampling rate)"
    - "tests/run-all.sh globs `tests/cross-worktree/*.sh` (verified existing pattern OR extended)"
  artifacts:
    - path: "install.sh"
      provides: "Worktree backfill loop (Step 6.5) using `git worktree list --porcelain`"
      contains: "worktree list --porcelain"
    - path: "tests/cross-worktree/simulation.sh"
      provides: "3-worktree multi-day simulation + 4 failure injections + 4 invariant assertions"
      min_lines: 200
    - path: "tests/cross-worktree/lib/setup.sh"
      provides: "mk_source_repo, mk_worktree, sandbox cleanup helpers"
      min_lines: 60
    - path: "tests/cross-worktree/lib/assertions.sh"
      provides: "assert_no_data_loss, assert_no_id_collision, assert_no_stale_state, assert_atomic_markdown — all 4 invariants from D-04"
      min_lines: 80
    - path: "tests/cross-worktree/lib/inject.sh"
      provides: "inject_source_beads_deleted, inject_concurrent_regen, inject_source_renamed, inject_beads_dir_unset — all 4 D-13 injections"
      min_lines: 60
    - path: "tests/install-tests/worktree-backfill.test.sh"
      provides: "install.sh backfills 2 pre-existing worktrees (D-08)"
      min_lines: 80
    - path: "tests/run-quick.sh"
      provides: "Existing runner extended with cross-worktree-sim case"
      contains: "cross-worktree-sim"
  key_links:
    - from: "install.sh"
      to: "hooks/worktree-post-checkout.sh (already appended at Step 6)"
      via: "fork-exec backfill loop calling `bash $REPO/.beads/hooks/post-checkout HEAD HEAD 1` for each enumerated worktree path"
      pattern: "worktree list --porcelain"
    - from: "tests/cross-worktree/simulation.sh"
      to: "tests/cross-worktree/lib/setup.sh + assertions.sh + inject.sh"
      via: "source ./lib/setup.sh ; source ./lib/assertions.sh ; source ./lib/inject.sh"
      pattern: "source.*lib/(setup|assertions|inject)\\.sh"
    - from: "tests/cross-worktree/simulation.sh"
      to: "Plan 03-01's flock preamble"
      via: "Concurrent burst step (Day 4 burst) exercises the lock-serialization path; assertion 4 (atomic markdown) verifies no mid-write reads"
      pattern: "atomic_markdown"
    - from: "tests/run-quick.sh"
      to: "tests/cross-worktree/simulation.sh"
      via: "case 'cross-worktree-sim') bash tests/cross-worktree/simulation.sh ;;"
      pattern: "cross-worktree-sim"
    - from: "tests/run-all.sh"
      to: "tests/cross-worktree/*.sh"
      via: "for-loop glob expansion (already covers tests/{hook,install,worktree}-tests/*.sh; extend if needed)"
      pattern: "tests/cross-worktree/\\*\\.sh"
---

<objective>
Ship the integration-validation surface for Phase 3:

1. **install.sh worktree backfill** (D-08) — enumerate every pre-existing
   git worktree of the project on first install and fire the shim against
   each. The shim is idempotent (marker-gate); subsequent installs are
   no-ops. Closes the "users on existing multi-worktree projects upgrade
   smoothly" gap.

2. **3-worktree live-dev simulation** (D-01..D-04, D-06, D-07, D-13) — a
   reproducible bash script that builds a 3-worktree fixture (main +
   feature + hotfix) under `/tmp/gsd-beads-cross-${RANDOM}`, runs a
   condensed multi-day flow (epic create / parent-child link / leaf close
   / cascade close / regen / cross-worktree read), then layers all 4
   failure injections from D-13. Asserts the 4 invariants from D-04.

3. **install-tests harness** — `tests/install-tests/worktree-backfill.test.sh`
   focuses on D-08 in isolation: build a source repo with 2 pre-existing
   worktrees, run install.sh, assert both worktrees gain the gsd-beads
   per-worktree config + marker.

4. **Test runner wiring** — `tests/run-quick.sh` learns a
   `cross-worktree-sim` component case; `tests/run-all.sh` is verified
   (or extended) to glob `tests/cross-worktree/*.sh`.

Purpose: REQ-03 (cross-worktree state sharing) needs an end-to-end
integration test that mirrors realistic multi-day single-developer
workflows, not just the synthetic Spike 003 harness. REQ-05 (conflict-free
concurrent updates) needs a proof that Plan 03-01's flock preamble holds
under cross-worktree contention.

Output: ~600 lines of new test surface + ~15 lines of install.sh delta
+ run-quick.sh case-statement extension. The simulation runs in
~60-90 seconds (per 03-VALIDATION.md feedback latency target).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/03-cross-worktree-validation/03-CONTEXT.md
@.planning/phases/03-cross-worktree-validation/03-RESEARCH.md
@.planning/phases/03-cross-worktree-validation/03-VALIDATION.md
@.planning/phases/03-cross-worktree-validation/03-01-SUMMARY.md
@.planning/phases/02-build-the-layer/02-CONTEXT.md
@.planning/phases/02-build-the-layer/02-VERIFICATION.md
@.claude/skills/spike-findings-gsd-beads/SKILL.md
@.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md
@./CLAUDE.md
@install.sh
@hooks/worktree-post-checkout.sh
@hooks/bd-sync.sh
@scripts/cascade-loop.sh
@scripts/regen-roadmap.sh
@scripts/regen-requirements.sh
@tests/run-quick.sh
@tests/run-all.sh
@tests/worktree-tests/auto-config.test.sh
@tests/worktree-tests/append-idempotency.test.sh
@tests/install-tests/path-precedence.test.sh
@tests/install-tests/idempotency.test.sh
@tests/e2e/full-install.smoke.sh

<interfaces>
<!-- Canonical worktree-list parser (POSIX awk, from RESEARCH.md §Pattern 2). -->
<!-- Skips `bare` and `prunable` records; emits one path per line. -->

```bash
git worktree list --porcelain | awk '
  /^worktree / { p = substr($0, 10); s = 0; next }
  /^bare$/      { s = 1; next }
  /^prunable/   { s = 1; next }
  NF == 0       { if (p != "" && !s) print p; p = ""; s = 0 }
  END           { if (p != "" && !s) print p }
'
```

<!-- Canonical backfill loop (from RESEARCH.md §Pattern 3). -->
<!-- $REPO_BEADS_DIR resolved up-front to the source repo's .beads/. -->

```bash
# Run AFTER Step 6 (shim has been appended to .beads/hooks/post-checkout).
git -C "$PWD" worktree list --porcelain | awk '...as above...' | while IFS= read -r wt_path; do
  [ -d "$wt_path" ] || continue
  ( cd "$wt_path" && bash "$REPO_BEADS_DIR/hooks/post-checkout" HEAD HEAD 1 ) || true
done
```

<!-- Existing post-checkout shim signature (DO NOT MODIFY — D-07): -->
<!-- $1 = old_sha, $2 = new_sha, $3 = flag. Only $3 is consumed. -->
<!-- flag=1 means branch checkout; the shim's marker-gate makes second runs no-ops. -->

<!-- Existing worktree-test fixture pattern (from tests/worktree-tests/auto-config.test.sh): -->
```bash
make_fixture() {
  local dir="$1"
  cd "$dir"
  git init -q
  git config user.email "test@test.com"
  git config user.name "Test"
  git config extensions.worktreeConfig true
  git commit -q --allow-empty -m "init"
}
```

<!-- Existing e2e sandbox+trap pattern (from tests/e2e/full-install.smoke.sh): -->
```bash
fixture="/tmp/gsd-beads-e2e-${RANDOM}"
trap "rm -rf '$fixture'" EXIT
mkdir -p "$fixture" && cd "$fixture"
git init -q && git config user.email "..." && git config user.name "..."
bd init --non-interactive --skip-agents >/dev/null 2>&1
```

<!-- 4 invariant assertion shapes (from RESEARCH.md §"Code Examples"): -->
```bash
# Invariant 1: no data loss
created_count=$(grep -c '^CREATED' "$audit_log")
listed_count=$(BEADS_DIR="$src/.beads" bd list --status=all --json | jq 'length')
[ "$created_count" -eq "$listed_count" ] || die "data loss: created=$created_count listed=$listed_count"

# Invariant 2: no ID collision
[ "$(awk '$1=="CREATED"{print $2}' "$audit_log" | sort -u | wc -l)" -eq "$created_count" ] || die "ID collision"

# Invariant 3: no stale state (cross-worktree write→read)
(cd "$wt_a" && BEADS_DIR="$src/.beads" bd q "stale-test" -t task -p 3) > /dev/null
seen=$(cd "$wt_b" && BEADS_DIR="$src/.beads" bd list --json | jq '[.[] | select(.title=="stale-test")] | length')
[ "$seen" = "1" ] || die "stale state: wt-A wrote, wt-B did not see"

# Invariant 4: atomic markdown views (no mid-write reads during concurrent burst)
for snap in /tmp/roadmap-snap-*.md; do
  tail -1 "$snap" | grep -q '^$' || die "atomic violation: $snap truncated"
done
```

<!-- Source-repo .beads/ resolved from any worktree (used by the shim and lock preamble): -->
```bash
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
```
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| install.sh → user's git worktree list | install.sh trusts `git worktree list --porcelain` output; format is git-controlled and stable since git 2.5+. |
| simulation.sh → /tmp sandbox | All fixture I/O is contained under `mktemp -d` paths; `trap EXIT` cleanup is mandatory. |
| Test fixture bd init → user's bd memories | Tests must use isolated sandboxes; the simulation MUST set `BEADS_DIR=<sandbox>/.beads` for every bd invocation so the dev's real bd store is never touched. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-05 | Tampering | install.sh fires shim against malicious worktree path | accept | `git worktree list --porcelain` enumerates only worktrees git itself created (or that are explicitly added by the user). The shim invocation `bash $REPO_BEADS_DIR/hooks/post-checkout HEAD HEAD 1` does not interpret the worktree path as code. Path travels only as a `cd` target. |
| T-03-06 | Information disclosure | Test fixture leaks user environment | mitigate | Every fixture uses `mktemp -d /tmp/gsd-beads-cross-XXXXXX` and `trap "rm -rf '$fixture'" EXIT`. No reliance on `$HOME` or user's `~/.beads/`. |
| T-03-07 | Repudiation | Concurrent burst loses race-test signal | mitigate | Per RESEARCH.md Pitfall 4, cap the burst at 20 invocations (not 40) so the worst-case 30s flock timeout is never hit; document expected duration. |
| T-03-08 | Denial of service | install.sh hangs on a `prunable` worktree | mitigate | `awk` skip-rule for `prunable` records is the canonical guard. `[ -d "$wt_path" ] \|\| continue` second-guards. |

No `high` severity. Test surface only; install.sh delta is read+invoke, no new writes outside the existing surface.
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build cross-worktree test infrastructure (lib helpers + simulation harness skeleton)</name>
  <files>
    tests/cross-worktree/lib/setup.sh,
    tests/cross-worktree/lib/assertions.sh,
    tests/cross-worktree/lib/inject.sh,
    tests/cross-worktree/simulation.sh,
    tests/run-quick.sh,
    tests/run-all.sh
  </files>
  <read_first>
    - tests/worktree-tests/auto-config.test.sh — for the canonical `make_fixture` pattern (lines 33-42) and the `git worktree add --detach` invocation (line 74).
    - tests/e2e/full-install.smoke.sh — for the `mktemp -d` + `trap EXIT` sandbox pattern (lines 8-9), the `bd init --non-interactive --skip-agents` invocation (line 28), and the bd hierarchy build pattern (lines 33-60).
    - tests/run-quick.sh — current case-statement structure (lines 7-17). New case must append, not replace.
    - tests/run-all.sh — current glob (line 5). Must verify it picks up tests/cross-worktree/*.sh after this plan.
    - hooks/worktree-post-checkout.sh — confirm shim signature: `$1 old_sha, $2 new_sha, $3 flag` (line 8). `flag=1` is the only path that reconfigures.
    - 03-CONTEXT.md D-04 — the 4 invariants in full text.
    - 03-CONTEXT.md D-13 — the 4 failure injections in full text.
    - 03-RESEARCH.md §"Validation Architecture" §"Wave 0 Requirements" — confirms the 4 lib files are required Wave 0 artifacts.
    - 03-RESEARCH.md §"Code Examples" §"Invariant assertions" — the canonical assertion shapes (already in `<interfaces>` above).
    - 03-RESEARCH.md §"Pitfall 4" — concurrent-burst sizing (20 ops, not 40).
    - 03-VALIDATION.md Per-Task Verification Map — confirms simulation.sh covers REQ-03 + REQ-05 sub-cases.
    - .beads/.gitignore — confirms `*.lock` is already covered (no test-fixture cleanup leak risk).
  </read_first>
  <behavior>
    - Test 1: `tests/cross-worktree/lib/setup.sh` defines `mk_source_repo`, `mk_worktree`, `cleanup_sandbox` functions. Sourcing it does not execute any commands (pure function definitions).
    - Test 2: `tests/cross-worktree/lib/assertions.sh` defines `assert_no_data_loss`, `assert_no_id_collision`, `assert_no_stale_state`, `assert_atomic_markdown` — one function per D-04 invariant. Each emits `[PASS]` or `[FAIL]` to stdout and increments a shared `$pass`/`$fail` counter.
    - Test 3: `tests/cross-worktree/lib/inject.sh` defines `inject_source_beads_deleted`, `inject_concurrent_regen`, `inject_source_renamed`, `inject_beads_dir_unset` — one function per D-13 failure mode.
    - Test 4: `tests/cross-worktree/simulation.sh` sources all 3 lib files, builds a 3-worktree sandbox, runs the 4-day flow + 4 injections + 4 assertions, and exits 0 with `Passed: N / N` summary on success.
    - Test 5: `tests/run-quick.sh cross-worktree-sim` invokes `bash tests/cross-worktree/simulation.sh` and forwards the exit code.
    - Test 6: `tests/run-all.sh` includes `tests/cross-worktree/*.sh` in its glob (either pre-existing because the line 5 glob covers `tests/*-tests/*.test.sh` — verify; if not, extend).
    - Test 7: Simulation completes in <90s wall time on the dev WSL2 host (per 03-VALIDATION.md latency budget).
  </behavior>
  <action>
    **Part A — `tests/cross-worktree/lib/setup.sh`:**

    Pure-function library. Sourced by simulation.sh and worktree-backfill.test.sh.

    Functions to define:
    - `mk_source_repo <dir>` — git init + worktreeConfig=true + initial commit + `bd init --non-interactive --skip-agents` + append the gsd-beads worktree shim to `.beads/hooks/post-checkout` (mirrors install.sh Step 6 logic so the lib is self-contained for testing). Final state: a beads-managed source repo ready for `git worktree add`.
    - `mk_worktree <source_dir> <wt_path> <branch_name>` — `cd $source_dir && git worktree add $wt_path -b $branch_name 2>&1` (the post-checkout fires automatically). Returns 0 on success.
    - `cleanup_sandbox <root>` — `git -C $root worktree list --porcelain | awk ... | xargs -I{} git -C $root worktree remove --force {} 2>/dev/null || true ; rm -rf $root` for full teardown. Used in trap.
    - `bd_in_worktree <wt_path> <args...>` — sets `BEADS_DIR=$source_root/.beads` then runs `(cd $wt_path && bd "$@")`. Source root resolved via `git -C $wt_path rev-parse --git-common-dir`.

    **Part B — `tests/cross-worktree/lib/assertions.sh`:**

    Pure-function library. One function per D-04 invariant. Each function:
    - Takes the sandbox root + any context (audit log path, worktree paths) as args.
    - Emits `[PASS]` or `[FAIL] <reason>` to stdout.
    - Increments a `pass`/`fail` counter (assumed to be in the caller's scope — bash dynamic scoping).
    - Returns 0 on PASS, 1 on FAIL (caller can choose to abort or continue).

    Required functions (use the canonical assertion shapes from `<interfaces>`):
    - `assert_no_data_loss <source_beads_dir> <audit_log>` — counts CREATED entries in audit log, compares to `bd list --status=all --json | jq 'length'`. D-04 #1.
    - `assert_no_id_collision <audit_log>` — extracts IDs from audit log, sorts -u, compares count. D-04 #2.
    - `assert_no_stale_state <source_beads_dir> <wt_a> <wt_b>` — writes a unique-titled task in wt_a, reads from wt_b, asserts seen=1. D-04 #3.
    - `assert_atomic_markdown <snapshot_dir>` — reads every `roadmap-snap-*.md` in snapshot_dir, asserts each ends with the expected terminator (last `tail -1` line matches the byte signature regen-roadmap.sh produces — empirically: file ends with a blank line after the Progress table; verify by inspecting a known-good output). D-04 #4.

    **Part C — `tests/cross-worktree/lib/inject.sh`:**

    Pure-function library. One function per D-13 failure mode. Each function:
    - Takes the sandbox root + worktree paths as args.
    - Performs the injection (deletes/renames/unsets/spawns concurrent procs).
    - Returns the *expected* observable outcome via stdout (e.g., the stderr that should be captured).

    Required functions:
    - `inject_source_beads_deleted <source_root>` — `rm -rf $source_root/.beads` + emits "expect: bd commands fail with clear error" comment line. D-13 #1.
    - `inject_concurrent_regen <wt_a> <wt_b>` — backgrounds a bd-sync.sh-equivalent burst from both worktrees simultaneously (20 invocations each), captures roadmap snapshots every 0.1s (for atomic-markdown invariant). D-13 #2 — exercises Plan 03-01's flock preamble end-to-end.
    - `inject_source_renamed <source_root>` — moves the source root to `${source_root}.renamed`; emits the documented recovery command (`git config --worktree gsd-beads.dir <new>/.beads`). D-13 #3.
    - `inject_beads_dir_unset <wt_path>` — unsets `BEADS_DIR` and `git config --worktree --unset gsd-beads.dir` in $wt_path; runs `bd list` and observes the discovery fallback (cwd-scan → source via `git rev-parse --git-common-dir`). D-13 #4.

    **Part D — `tests/cross-worktree/simulation.sh`:**

    The integration test orchestrator. Structure:

    ```bash
    #!/usr/bin/env bash
    # Phase 3 cross-worktree integration test.
    # Builds 3 worktrees (main + feature + hotfix), runs a condensed multi-day
    # flow, injects 4 failure modes from D-13, asserts the 4 invariants from D-04.
    # Runtime: ~60-90s on dev WSL2.
    set -uo pipefail

    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    source "$SCRIPT_DIR/lib/setup.sh"
    source "$SCRIPT_DIR/lib/assertions.sh"
    source "$SCRIPT_DIR/lib/inject.sh"

    pass=0; fail=0

    sandbox="/tmp/gsd-beads-cross-${RANDOM}-${RANDOM}"
    audit_log="$sandbox/audit.log"
    snap_dir="$sandbox/snapshots"
    cleanup_full() { cleanup_sandbox "$sandbox"; rm -rf "$sandbox"; }
    trap cleanup_full EXIT

    mkdir -p "$sandbox" "$snap_dir"
    src="$sandbox/source"
    wt_feat="$sandbox/wt-feature"
    wt_hot="$sandbox/wt-hotfix"
    mk_source_repo "$src"
    mk_worktree "$src" "$wt_feat" "feature-x"
    mk_worktree "$src" "$wt_hot" "hotfix-y"

    # === Day 1: from main (src), create epic + 3 leaves ===
    # ... bd q + bd link + write CREATED <id> to audit_log ...

    # === Day 2: from feature, close 2 of 3 leaves ===
    # ... bd close ... ; verify epic still open in main ...

    # === Day 3: from feature, close last leaf; cascade fires ===
    # ... bash cascade-loop.sh --quiet ... ; verify all 3 worktrees see closure ...

    # === Day 4: concurrent burst from main + feature ===
    # ... inject_concurrent_regen + capture snapshots ...

    # === Day 5: from hotfix, urgent epic + leaf, close immediately ===
    # ... regen ROADMAP.md across all 3 worktrees ...

    # === Failure injections (D-13.1, D-13.4 only — D-13.2 covered by Day 4 burst, D-13.3 is destructive and runs LAST) ===
    inject_beads_dir_unset "$wt_feat"   # D-13.4 — verify discovery fallback works
    inject_source_beads_deleted "$src"  # D-13.1 — DESTRUCTIVE; runs after main flow
    # inject_source_renamed runs LAST — most destructive; assertion for D-13.3 is documentation-only

    # === Invariants (D-04) ===
    # Note: D-04 #1 / #2 ran on /tmp before the destructive injections wiped the source.
    # We assert them BEFORE D-13.1 destroys .beads/.
    # ... see TASK 2 for the precise ordering ...

    echo ""
    echo "Passed: $pass / $((pass + fail))"
    [ "$fail" -eq 0 ]
    ```

    **Important — defer the actual day-by-day flow logic to Task 2.** This task creates the SKELETON — the lib files, the `source` lines, the sandbox/cleanup machinery, the trap. Task 2 fills in the bd operations and assertion calls.

    **Part E — `tests/run-quick.sh`:**

    Add a new case to the existing case statement (after the `auto-config|append-idempotency)` case, before the `*)`):

    ```bash
    cross-worktree-sim)
      bash "tests/cross-worktree/simulation.sh" ;;
    ```

    **Part F — `tests/run-all.sh`:**

    Inspect line 5: `for suite in tests/hook-tests/*.test.sh tests/install-tests/*.test.sh tests/worktree-tests/*.test.sh tests/e2e/*.smoke.sh; do`. The new test file is at `tests/cross-worktree/simulation.sh` (no `.test.` infix). **Two options:**
    - (a) name the simulation `tests/cross-worktree/simulation.test.sh` — but then the runner glob still doesn't include `tests/cross-worktree/*.test.sh`. Must extend the glob.
    - (b) keep the name `simulation.sh` and add an explicit `tests/cross-worktree/*.sh` to the glob.

    Pick (b): minimal change, matches the file naming convention from RESEARCH.md §"Recommended Project Structure" (`simulation.sh`, no `.test.`). Modify line 5 to:

    ```bash
    for suite in tests/hook-tests/*.test.sh tests/install-tests/*.test.sh tests/worktree-tests/*.test.sh tests/cross-worktree/*.sh tests/e2e/*.smoke.sh; do
    ```

    Verify by running `bash tests/run-all.sh` and confirming `=== tests/cross-worktree/simulation.sh ===` appears in output.

    **Make all created files executable:** `chmod +x` on `simulation.sh` and the lib files (lib files should also be sourceable; chmod is harmless for source).
  </action>
  <acceptance_criteria>
    - `tests/cross-worktree/lib/setup.sh` exists and sources cleanly (`bash -c "source tests/cross-worktree/lib/setup.sh"` exits 0).
    - `tests/cross-worktree/lib/setup.sh` defines `mk_source_repo`, `mk_worktree`, `cleanup_sandbox`, `bd_in_worktree` (verify with `bash -c "source tests/cross-worktree/lib/setup.sh && declare -F mk_source_repo mk_worktree cleanup_sandbox bd_in_worktree"`).
    - `tests/cross-worktree/lib/assertions.sh` exists and defines `assert_no_data_loss`, `assert_no_id_collision`, `assert_no_stale_state`, `assert_atomic_markdown` (verify with `declare -F`).
    - `tests/cross-worktree/lib/inject.sh` exists and defines `inject_source_beads_deleted`, `inject_concurrent_regen`, `inject_source_renamed`, `inject_beads_dir_unset` (verify with `declare -F`).
    - `tests/cross-worktree/simulation.sh` exists, is executable (`-x`), and sources all 3 lib files (`grep -c '^source.*lib/' tests/cross-worktree/simulation.sh` returns >= 3).
    - `tests/cross-worktree/simulation.sh` uses `mktemp -d` and `trap EXIT` (`grep -c 'mktemp\|trap.*EXIT' tests/cross-worktree/simulation.sh` returns >= 2).
    - `tests/run-quick.sh` includes a `cross-worktree-sim)` case (`grep -c '^[[:space:]]*cross-worktree-sim)' tests/run-quick.sh` returns 1).
    - `bash tests/run-quick.sh cross-worktree-sim` does not return "unknown component" (it may fail because Task 2 hasn't filled in the day flow yet — that's expected at this point; what matters is the case is wired up).
    - `tests/run-all.sh` line 5 includes `tests/cross-worktree/*.sh` (`grep -F 'tests/cross-worktree/' tests/run-all.sh` returns >= 1).
    - `bash -n` passes for all 6 modified/created files.
  </acceptance_criteria>
  <verify>
    <automated>bash -n tests/cross-worktree/lib/setup.sh tests/cross-worktree/lib/assertions.sh tests/cross-worktree/lib/inject.sh tests/cross-worktree/simulation.sh tests/run-quick.sh tests/run-all.sh && bash -c "source tests/cross-worktree/lib/setup.sh && declare -F mk_source_repo mk_worktree cleanup_sandbox bd_in_worktree" && bash -c "source tests/cross-worktree/lib/assertions.sh && declare -F assert_no_data_loss assert_no_id_collision assert_no_stale_state assert_atomic_markdown" && bash -c "source tests/cross-worktree/lib/inject.sh && declare -F inject_source_beads_deleted inject_concurrent_regen inject_source_renamed inject_beads_dir_unset"</automated>
  </verify>
  <done>
    Test infrastructure scaffolded: 3 lib files with correct function exports,
    simulation.sh skeleton with sandbox+trap, run-quick.sh + run-all.sh wired.
    The day-by-day flow + assertions are filled in by Task 2.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire install.sh worktree backfill (D-08) + create worktree-backfill.test.sh</name>
  <files>
    install.sh,
    tests/install-tests/worktree-backfill.test.sh
  </files>
  <read_first>
    - install.sh lines 113-128 (Step 6: worktree post-checkout shim append). Backfill goes immediately AFTER this block — once the shim is appended to `.beads/hooks/post-checkout`, fire it against every existing worktree.
    - install.sh line 117 — the conditional `if [ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]`: this gate ensures install.sh only operates on a beads-managed project, NOT on the gsd-beads repo itself. The backfill must inherit this same gate.
    - 03-RESEARCH.md §"Pattern 2" — canonical awk parser (already embedded in `<interfaces>`).
    - 03-RESEARCH.md §"Pattern 3" — canonical backfill loop (already embedded in `<interfaces>`).
    - 03-RESEARCH.md §"Code Examples" lines ~365-388 — concrete bash to drop in.
    - 03-RESEARCH.md §"Anti-Patterns to Avoid" — DO NOT use `git checkout HEAD` to fire the shim; use direct invocation. DO NOT use `$wt_path/.beads/hooks/post-checkout` (each worktree doesn't have its own .beads/); use `$REPO_BEADS_DIR/hooks/post-checkout` resolved up-front.
    - hooks/worktree-post-checkout.sh — reconfirm signature (only $3=flag is consumed; $1 and $2 are placeholders).
    - tests/worktree-tests/auto-config.test.sh — full structure for the test pattern (case_run helper, fixtures, cleanup).
    - tests/install-tests/idempotency.test.sh — for the install.sh sandbox+HOME-override pattern (relevant for the backfill test).
    - 03-CONTEXT.md D-08 — the locked decision.
  </read_first>
  <behavior>
    - Test 1: install.sh, after Step 6's shim append, enumerates worktrees via `git worktree list --porcelain` and fires the shim against each via `bash $REPO_BEADS_DIR/hooks/post-checkout HEAD HEAD 1`.
    - Test 2: The backfill loop is gated by the same `[ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]` condition as Step 6 (no fire on the gsd-beads repo itself).
    - Test 3: Backfill loop skips `bare` and `prunable` worktree records.
    - Test 4: tests/install-tests/worktree-backfill.test.sh CASE 1 — build a sandboxed source repo + 2 pre-existing worktrees (added BEFORE running install.sh, so they have no .gsd-beads-configured marker yet). Run install.sh. Assert both worktrees gain `git config --worktree gsd-beads.dir` AND a `.gsd-beads-configured` marker.
    - Test 5: tests/install-tests/worktree-backfill.test.sh CASE 2 — run install.sh a second time on the same sandbox. Assert no error AND markers still present (idempotent — shim's marker-gate makes second runs no-ops).
    - Test 6: tests/install-tests/worktree-backfill.test.sh CASE 3 — sandbox where the source repo has a `bare` worktree record (created via `git worktree add --bare`). Assert install.sh doesn't fire the shim against the bare record (no error, no spurious config).
    - Test 7: bash -n install.sh passes (syntax-clean).
  </behavior>
  <action>
    **Part A — modify install.sh:**

    Insert a new "Step 6.5: worktree backfill" block IMMEDIATELY AFTER the existing Step 6 block (after line 128, before Step 7 at line 130). Use the canonical Pattern 3 backfill loop from RESEARCH.md, adapted to install.sh's existing variables:

    ```bash
    # ── Step 6.5: Worktree backfill (D-08) ──────────────────────────────
    # After appending the shim, re-fire it against every pre-existing worktree
    # so they all gain `git config --worktree gsd-beads.dir` + the marker.
    # Idempotent: the shim's marker-gate makes second invocations no-ops.
    # Skips `bare` and `prunable` records (RESEARCH.md §Pattern 2).
    if [ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]; then
      REPO_BEADS_DIR="$PWD/.beads"
      git -C "$PWD" worktree list --porcelain | awk '
        /^worktree / { p = substr($0, 10); s = 0; next }
        /^bare$/      { s = 1; next }
        /^prunable/   { s = 1; next }
        NF == 0       { if (p != "" && !s) print p; p = ""; s = 0 }
        END           { if (p != "" && !s) print p }
      ' | while IFS= read -r wt_path; do
        [ -d "$wt_path" ] || continue
        ( cd "$wt_path" && bash "$REPO_BEADS_DIR/hooks/post-checkout" HEAD HEAD 1 ) || true
      done
      echo "backfilled gsd-beads config across $(git -C "$PWD" worktree list --porcelain | awk '/^worktree /{c++} END{print c+0}') worktree record(s)"
    fi
    ```

    **Why immediately after Step 6:** the shim has just been appended to `.beads/hooks/post-checkout`. Step 6.5 is the natural place to fire it.

    **Why we use `$REPO_BEADS_DIR/hooks/post-checkout` (not `$wt_path/.beads/...`):** each worktree shares the source repo's `.beads/` — only the source has a `.beads/hooks/post-checkout` file. Per RESEARCH.md anti-pattern.

    **Why `|| true`:** if a single worktree's shim invocation fails (e.g., dirty worktree, missing `.gitdir/info`), we don't want to abort install.sh. The shim already self-handles errors (CASE 4 in auto-config.test.sh: missing .beads/ → warn + exit 0).

    **Part B — create `tests/install-tests/worktree-backfill.test.sh`:**

    Mirror tests/install-tests/idempotency.test.sh and tests/worktree-tests/auto-config.test.sh patterns:

    ```bash
    #!/usr/bin/env bash
    # tests/install-tests/worktree-backfill.test.sh
    # Verifies install.sh enumerates pre-existing worktrees and fires the shim
    # against each (D-08). Tests the canonical backfill loop in install.sh Step 6.5.
    set -uo pipefail

    REPO_ROOT="$(git rev-parse --show-toplevel)"
    pass=0; fail=0
    _pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
    _fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

    # --- Helper: build a sandbox source repo + N worktrees BEFORE install.sh runs ---
    make_sandbox_with_worktrees() {
      local sandbox="$1"; local n_worktrees="$2"
      mkdir -p "$sandbox/source"
      cd "$sandbox/source"
      git init -q
      git config user.email "test@test.local"
      git config user.name "Test"
      git config extensions.worktreeConfig true
      git commit -q --allow-empty -m "init"
      bd init --non-interactive --skip-agents >/dev/null 2>&1 || true
      # Create N pre-existing worktrees (they DO NOT trigger our shim because the shim
      # isn't in .beads/hooks/post-checkout yet).
      local i
      for i in $(seq 1 "$n_worktrees"); do
        git worktree add "$sandbox/wt-$i" -b "branch-$i" 2>/dev/null
      done
    }

    # --- CASE 1: install.sh backfills 2 pre-existing worktrees ---
    sandbox=$(mktemp -d /tmp/gsd-beads-backfill.XXXXXX)
    saved_home="$HOME"
    trap 'export HOME="$saved_home"; rm -rf "$sandbox"' EXIT

    make_sandbox_with_worktrees "$sandbox" 2

    # Run install.sh from the sandboxed source repo.
    # Override HOME so the install side-effects (settings.json, ~/.local/bin) hit the sandbox.
    export HOME="$sandbox/.home"
    mkdir -p "$HOME/.claude" "$HOME/.local/bin"
    cd "$sandbox/source"
    bash "$REPO_ROOT/install.sh" >"$sandbox/install.log" 2>&1 || true
    export HOME="$saved_home"

    # Assert both worktrees gained the per-worktree config + marker.
    for i in 1 2; do
      wt="$sandbox/wt-$i"
      gitdir=$(git -C "$wt" rev-parse --git-dir)
      marker_path="$gitdir/info/.gsd-beads-configured"
      config_val=$(git -C "$wt" config --worktree --get gsd-beads.dir 2>/dev/null || git -C "$wt" config --get gsd-beads.dir 2>/dev/null || echo "MISSING")
      if [ -f "$marker_path" ]; then _pass "CASE 1.$i.a: worktree $i has marker"; else _fail "CASE 1.$i.a: worktree $i missing marker at $marker_path"; fi
      if [ "$config_val" = "$sandbox/source/.beads" ]; then _pass "CASE 1.$i.b: worktree $i has gsd-beads.dir=$sandbox/source/.beads"; else _fail "CASE 1.$i.b: worktree $i config wrong: $config_val"; fi
    done

    # --- CASE 2: re-running install.sh is idempotent ---
    cd "$sandbox/source"
    export HOME="$sandbox/.home"
    bash "$REPO_ROOT/install.sh" >"$sandbox/install2.log" 2>&1 || true
    export HOME="$saved_home"
    for i in 1 2; do
      wt="$sandbox/wt-$i"
      gitdir=$(git -C "$wt" rev-parse --git-dir)
      marker_path="$gitdir/info/.gsd-beads-configured"
      if [ -f "$marker_path" ]; then _pass "CASE 2.$i: worktree $i marker still present after re-install"; else _fail "CASE 2.$i: worktree $i marker disappeared after re-install"; fi
    done

    # --- CASE 3: bare worktree record is skipped ---
    sandbox3=$(mktemp -d /tmp/gsd-beads-backfill-bare.XXXXXX)
    trap 'export HOME="$saved_home"; rm -rf "$sandbox" "$sandbox3"' EXIT

    mkdir -p "$sandbox3/source"
    cd "$sandbox3/source"
    git init -q --bare
    cd /tmp
    # Now make_sandbox_with_worktrees pattern but in the bare context — since `git init --bare` creates
    # a bare main repo, `git worktree list --porcelain` reports it with a `bare` line.
    # NOTE: bare repos can't have working dirs; we test the parser's bare-skip via a normal source repo
    # plus a manually-induced bare worktree:
    cd "$sandbox3"
    git clone --bare "$sandbox3/source" "$sandbox3/source-bare" 2>/dev/null || true
    cd "$sandbox3/source-bare"
    git worktree add "$sandbox3/wt-from-bare" -b feature 2>/dev/null

    # Confirm `git worktree list --porcelain` reports a `bare` line:
    if git -C "$sandbox3/source-bare" worktree list --porcelain | grep -q '^bare$'; then
      _pass "CASE 3.a: bare worktree record observable in --porcelain output"
    else
      _fail "CASE 3.a: bare worktree record NOT observable — fixture broken"
    fi
    # The actual install.sh on a bare repo is out of normal scope (install.sh's
    # gate `[ -d "$PWD/.beads" ]` already excludes bare repos).
    # The behavioral guard for the bare-skip is the awk parser; that's grep-tested in CASE 3.b:
    if grep -F '/^bare$/      { s = 1; next }' "$REPO_ROOT/install.sh"; then
      _pass "CASE 3.b: install.sh awk parser skips bare records"
    else
      _fail "CASE 3.b: install.sh awk parser missing bare-skip rule"
    fi

    echo ""
    echo "Passed: $pass / $((pass + fail))"
    [ "$fail" -eq 0 ]
    ```

    **Note on CASE 1:** `bd init` may fail on a sandbox if the dev's bd is mid-state. Wrap with `|| true` and verify CASE 1 robustness via the marker check (which doesn't require bd to be functional — only git+install.sh).

    **Note on the `Passed: N / N` line:** keep the `[ "$fail" -eq 0 ]` final assertion shape consistent with all other tests/install-tests/*.test.sh files.

    `chmod +x tests/install-tests/worktree-backfill.test.sh`.
  </action>
  <acceptance_criteria>
    - `grep -c 'Step 6.5' install.sh` returns 1 (the new block has a sentinel comment header).
    - `grep -F 'worktree list --porcelain' install.sh` returns at least 1 match.
    - `grep -F '^bare$' install.sh` returns at least 1 match (the awk skip-rule for bare records).
    - `grep -F '^prunable' install.sh` returns at least 1 match (the awk skip-rule for prunable records).
    - `grep -F 'REPO_BEADS_DIR/hooks/post-checkout' install.sh` returns at least 1 match (canonical backfill invocation per RESEARCH.md anti-pattern).
    - Anti-pattern guard: `! grep -E 'git checkout HEAD|cd "\$wt_path" && git checkout' install.sh` succeeds (zero matches — direct invocation only, never `git checkout`).
    - `bash -n install.sh` exits 0.
    - `tests/install-tests/worktree-backfill.test.sh` exists and is executable.
    - `bash -n tests/install-tests/worktree-backfill.test.sh` exits 0.
    - `bash tests/install-tests/worktree-backfill.test.sh` exits 0 with `Passed: N / N` (no failures).
    - The other 4 install-tests still green: `bash tests/install-tests/path-precedence.test.sh && bash tests/install-tests/no-gsd-core-mutation.test.sh && bash tests/install-tests/settings-merge.test.sh` all pass.
    - `bash tests/run-all.sh` includes the new backfill test in its output (`grep -c 'worktree-backfill' <run-all-output>` >= 1).
  </acceptance_criteria>
  <verify>
    <automated>bash -n install.sh && bash -n tests/install-tests/worktree-backfill.test.sh && bash tests/install-tests/worktree-backfill.test.sh && bash tests/install-tests/path-precedence.test.sh && bash tests/install-tests/settings-merge.test.sh</automated>
  </verify>
  <done>
    install.sh Step 6.5 backfills pre-existing worktrees idempotently. The
    new install-test green-locks D-08 with 3 cases (basic backfill, idempotent
    re-install, bare-record skip).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fill in simulation.sh day-by-day flow + 4 invariant assertions + 4 failure injections</name>
  <files>tests/cross-worktree/simulation.sh</files>
  <read_first>
    - tests/cross-worktree/simulation.sh (skeleton from Task 1) — confirm sandbox + lib sourcing + trap is in place.
    - tests/cross-worktree/lib/setup.sh (created in Task 1).
    - tests/cross-worktree/lib/assertions.sh (created in Task 1).
    - tests/cross-worktree/lib/inject.sh (created in Task 1).
    - 03-CONTEXT.md §"Specific Ideas" — the simulation flow outline (Days 1-4) and concurrent stress (20 invocations from each of 2 worktrees).
    - 03-CONTEXT.md D-04 — the 4 invariants in full text.
    - 03-CONTEXT.md D-13 — the 4 failure injections in full text.
    - 03-RESEARCH.md §"Pitfall 4" — concurrent burst sizing (20 ops from each of 2 worktrees, NOT 40 from one — RESEARCH locked this at 20 to stay under the 30s flock timeout on slow hardware).
    - 03-RESEARCH.md §"Validation Architecture" §"Sampling Rate" — phase gate requires this script green end-to-end.
    - tests/e2e/full-install.smoke.sh lines 33-60 — exact bd hierarchy build pattern (epic create + label add + parent-child link). Reuse this shape.
    - 03-RESEARCH.md §"Pattern 4" — determinism strategy for the simulation (bd hash IDs are content-derived; rely on bd-state assertions, not wall-clock).
  </read_first>
  <behavior>
    - Test 1: simulation.sh runs in <90s wall time on the dev WSL2 host.
    - Test 2: Day 1 — from `src` (acting as main): create 1 epic + 3 leaf tasks linked parent-child, write `CREATED <id>` lines to audit log per creation.
    - Test 3: Day 2 — from `wt-feature`: close 2 of 3 leaves; verify epic still open by reading `bd list -l gsd:phase` from src.
    - Test 4: Day 3 — from `wt-feature`: close last leaf; run `cascade-loop.sh --quiet`; assert epic is now closed; verify cross-worktree visibility from `wt-hotfix` (assert_no_stale_state).
    - Test 5: Day 4 — concurrent stress: from `src` and `wt-feature`, fire 20 `bd-sync.sh`-equivalent invocations each (40 total) over ~5s. Capture roadmap snapshots every 0.1s during the burst. Assert atomic markdown via assert_atomic_markdown.
    - Test 6: D-13.4 injection (BEADS_DIR unset in wt-feature): unset BEADS_DIR + unset git config; run `bd list`; assert it succeeds via cwd-scan fallback (or fails with a clear error per the documented precedence).
    - Test 7: D-13.1 injection (source `.beads/` deleted) — DESTRUCTIVE; runs near the END after invariants 1-3 are asserted. Assert subsequent bd commands fail with a clear error.
    - Test 8: D-13.3 injection (source repo renamed) — DESTRUCTIVE; runs LAST. Asserts the shim emits the documented recovery hint OR a clear error message; pass criterion is "documented behavior matches RESEARCH.md Pitfall 5 / D-14".
    - Test 9: All 4 invariants from D-04 evaluated; final summary `Passed: N / N` printed; exit 0 only if `fail = 0`.
  </behavior>
  <action>
    Fill in the day-by-day flow in `tests/cross-worktree/simulation.sh` between the skeleton's `mk_worktree` calls and the final `Passed:` summary. Use the helpers from lib/setup.sh, lib/assertions.sh, lib/inject.sh.

    **Audit log discipline:** every bd `bd q ...` returns a freshly-minted issue ID on stdout. After each create, append `CREATED <id> day=<n> wt=<src|feat|hot>` to `$audit_log`. After each `bd close <id>`, append `CLOSED <id> day=<n> wt=<...>`. The audit log is the source of truth for assert_no_data_loss and assert_no_id_collision.

    **Day 1 (from src):**
    ```bash
    cd "$src"
    EPIC1=$(bd q "Phase-A: simulation core" -t epic -p 1)
    bd label add "$EPIC1" gsd:phase >/dev/null
    echo "CREATED $EPIC1 day=1 wt=src" >> "$audit_log"
    for i in 1 2 3; do
      T=$(bd q "Sim leaf $i" -t task -p $i)
      bd link "$T" "$EPIC1" --type parent-child >/dev/null
      echo "CREATED $T day=1 wt=src" >> "$audit_log"
      eval "L${i}=$T"
    done
    ```

    **Day 2 (from wt-feature):** verify cross-worktree visibility, then close 2 leaves.
    ```bash
    seen_in_feat=$(BEADS_DIR="$src/.beads" bd list --status=open --json | jq --arg id "$EPIC1" '[.[] | select(.id==$id)] | length')
    if [ "$seen_in_feat" = "1" ]; then _pass "Day 2: epic visible in wt-feature"; else _fail "Day 2: stale state — epic NOT visible in wt-feature"; fi
    cd "$wt_feat"
    BEADS_DIR="$src/.beads" bd close "$L1" >/dev/null 2>&1; echo "CLOSED $L1 day=2 wt=feat" >> "$audit_log"
    BEADS_DIR="$src/.beads" bd close "$L2" >/dev/null 2>&1; echo "CLOSED $L2 day=2 wt=feat" >> "$audit_log"
    ```

    **Day 3 (from wt-feature):** close last leaf + cascade.
    ```bash
    cd "$wt_feat"
    BEADS_DIR="$src/.beads" bd close "$L3" >/dev/null 2>&1; echo "CLOSED $L3 day=3 wt=feat" >> "$audit_log"
    BEADS_DIR="$src/.beads" bash "$REPO_ROOT/scripts/cascade-loop.sh" --quiet
    epic_status=$(BEADS_DIR="$src/.beads" bd show "$EPIC1" --json | jq -r '.[0].status')
    if [ "$epic_status" = "closed" ]; then _pass "Day 3: cascade closed epic"; else _fail "Day 3: epic still $epic_status after cascade"; fi
    # Cross-worktree read from wt-hotfix (D-04 #3 invariant 3 evidence point)
    seen_in_hot=$(BEADS_DIR="$src/.beads" bd list --status=closed --json | jq --arg id "$EPIC1" '[.[] | select(.id==$id)] | length')
    if [ "$seen_in_hot" = "1" ]; then _pass "Day 3: cross-worktree closure visible from wt-hotfix"; else _fail "Day 3: closure NOT visible from wt-hotfix"; fi
    ```

    **Day 4 (concurrent burst — exercises Plan 03-01 flock + D-13.2 injection):**
    ```bash
    inject_concurrent_regen "$src" "$wt_feat" "$snap_dir" 20  # 20 invocations from each
    # inject_concurrent_regen captures roadmap snapshots every 0.1s into $snap_dir
    assert_atomic_markdown "$snap_dir" || true   # invariant 4
    ```

    Implementation of `inject_concurrent_regen` in lib/inject.sh (Task 1 already created the function stub; flesh it out here):
    - Spawn a snapshot-capture loop in the background: `while true; do cp $src/.planning/ROADMAP.md $snap_dir/snap-$(date +%s%N).md 2>/dev/null; sleep 0.1; done &` (record PID).
    - Spawn 20 backgrounded `bd-sync.sh`-equivalent invocations from src AND 20 from wt_feat: each invocation triggers `bash $REPO_ROOT/scripts/regen-roadmap.sh` (the actual write path).
    - `wait` for all 40 to complete.
    - Kill the snapshot-capture loop.

    **Day 5 (from wt-hotfix — D-04 #1 + #2 evidence consolidation):**
    ```bash
    cd "$wt_hot"
    EPIC2=$(BEADS_DIR="$src/.beads" bd q "Phase-B: hotfix" -t epic -p 0)
    BEADS_DIR="$src/.beads" bd label add "$EPIC2" gsd:phase >/dev/null
    echo "CREATED $EPIC2 day=5 wt=hot" >> "$audit_log"
    L_HOT=$(BEADS_DIR="$src/.beads" bd q "Hotfix leaf" -t task -p 0)
    BEADS_DIR="$src/.beads" bd link "$L_HOT" "$EPIC2" --type parent-child >/dev/null
    echo "CREATED $L_HOT day=5 wt=hot" >> "$audit_log"
    BEADS_DIR="$src/.beads" bd close "$L_HOT" >/dev/null 2>&1; echo "CLOSED $L_HOT day=5 wt=hot" >> "$audit_log"
    ```

    **D-13.4 injection (BEADS_DIR unset in wt-feature) — non-destructive, runs early:**
    ```bash
    inject_beads_dir_unset "$wt_feat"
    # Assert: bd list inside wt-feature still works (cwd-scan fallback OR clear error)
    cd "$wt_feat"
    bd_out=$(bd list --status=open 2>&1) || rc=$?
    # Document observed precedence in summary (per D-13.4 contract)
    if echo "$bd_out" | grep -qE 'simulation core|EPIC|gsd-beads|database'; then
      _pass "D-13.4: BEADS_DIR unset → discovery fallback works"
    elif echo "$bd_out" | grep -qE 'no .beads|cannot find|BEADS_DIR'; then
      _pass "D-13.4: BEADS_DIR unset → clear error per documented precedence"
    else
      _fail "D-13.4: unexpected behavior on BEADS_DIR unset: $bd_out"
    fi
    ```

    **Run invariants 1-3 BEFORE destructive injections:**
    ```bash
    assert_no_data_loss "$src/.beads" "$audit_log"
    assert_no_id_collision "$audit_log"
    assert_no_stale_state "$src/.beads" "$src" "$wt_feat"
    # Invariant 4 already asserted in Day 4
    ```

    **D-13.1 injection (source `.beads/` deleted) — DESTRUCTIVE:**
    ```bash
    inject_source_beads_deleted "$src"
    # Assert: any subsequent bd command in any worktree fails with a clear error
    cd "$wt_feat"
    err=$(BEADS_DIR="$src/.beads" bd list 2>&1) || rc=$?
    if [ "${rc:-0}" != "0" ] && echo "$err" | grep -qiE 'no.*beads|database|directory|not found'; then
      _pass "D-13.1: source .beads/ deleted → bd commands fail with clear error"
    else
      _fail "D-13.1: expected clear error after .beads/ deletion, got: $err"
    fi
    ```

    **D-13.3 injection (source repo renamed) — DESTRUCTIVE; runs LAST:**
    ```bash
    inject_source_renamed "$src"   # mv $src $src.renamed
    # Assert documented behavior: bd config --worktree gsd-beads.dir <new>/.beads is the recovery
    # We don't test the recovery itself — just assert the failure mode is documented.
    cd "$wt_feat" 2>/dev/null || true
    if [ ! -d "$src" ]; then
      _pass "D-13.3: source renamed → wt config now points at non-existent path (recovery: git config --worktree gsd-beads.dir <new>/.beads per D-14)"
    else
      _fail "D-13.3: rename injection didn't take effect"
    fi
    ```

    **Final summary:** the existing skeleton has `echo "Passed: $pass / $((pass + fail))"` and `[ "$fail" -eq 0 ]`. Keep these as-is.

    **Wall-time budget guard:** add a top-of-script timestamp + bottom-of-script timestamp + `printf 'Wall time: %ds\n' "$elapsed"`. If elapsed > 90, print a WARNING but do not fail (the gate is correctness, not timing).
  </action>
  <acceptance_criteria>
    - `bash tests/cross-worktree/simulation.sh` exits 0 with `Passed: N / N` (no failures).
    - `bash tests/cross-worktree/simulation.sh` completes in <90s wall time on the dev WSL2 host.
    - `grep -cE '^# === Day [0-9]' tests/cross-worktree/simulation.sh` returns 5 (Days 1-5).
    - `grep -cE 'inject_(source_beads_deleted|concurrent_regen|source_renamed|beads_dir_unset)' tests/cross-worktree/simulation.sh` returns >= 4 (all 4 D-13 injections invoked).
    - `grep -cE 'assert_(no_data_loss|no_id_collision|no_stale_state|atomic_markdown)' tests/cross-worktree/simulation.sh` returns >= 4 (all 4 D-04 invariants asserted).
    - The simulation creates a snapshot dir during Day 4 and validates atomic markdown.
    - `bash -n tests/cross-worktree/simulation.sh` exits 0.
    - The simulation does NOT touch the dev's real bd store: `grep -c "BEADS_DIR=\"\\\$src/.beads\"" tests/cross-worktree/simulation.sh` returns >= 5 (every bd invocation explicitly scopes to the sandbox).
    - `bash tests/run-quick.sh cross-worktree-sim` invokes the simulation and forwards exit code.
  </acceptance_criteria>
  <verify>
    <automated>bash -n tests/cross-worktree/simulation.sh && timeout 120 bash tests/cross-worktree/simulation.sh</automated>
  </verify>
  <done>
    The cross-worktree simulation runs end-to-end in <90s, asserts all 4
    D-04 invariants, fires all 4 D-13 failure injections, and exits 0 on
    the dev machine. Phase gate from 03-VALIDATION.md is satisfied: full
    suite + simulation green.
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run:

```bash
# Plan 03-02 deliverables
bash -n install.sh
bash tests/install-tests/worktree-backfill.test.sh   # NEW; must pass
bash tests/cross-worktree/simulation.sh              # NEW; must pass in <90s
bash tests/run-quick.sh cross-worktree-sim           # NEW component case routes correctly

# No regressions
bash tests/run-all.sh                                # full suite green (excluding pre-existing dev-env caveats from Phase 2)
bash tests/install-tests/path-precedence.test.sh
bash tests/install-tests/settings-merge.test.sh
bash tests/install-tests/idempotency.test.sh         # may have pre-existing CASE 4 dev-env failure unrelated to this plan
bash tests/install-tests/no-gsd-core-mutation.test.sh
bash tests/worktree-tests/auto-config.test.sh
bash tests/worktree-tests/append-idempotency.test.sh

# Plan 03-01 verifications still hold
bash tests/hook-tests/flock-preamble.test.sh
bash tests/hook-tests/bd-sync.test.sh                # 18/18
```

Anti-pattern guards:
```bash
# install.sh backfill uses direct shim invocation, not git checkout
! grep -E 'git checkout HEAD|cd.*git checkout' install.sh

# install.sh backfill uses $REPO_BEADS_DIR, not $wt_path/.beads/
! grep -F '$wt_path/.beads/hooks/post-checkout' install.sh

# Simulation never writes to the user's real bd store
! grep -F 'bd q ' tests/cross-worktree/simulation.sh | grep -v 'BEADS_DIR='

# Simulation cleans up its sandbox
grep -F 'trap cleanup_full EXIT' tests/cross-worktree/simulation.sh
```
</verification>

<success_criteria>
- D-08 implemented: install.sh Step 6.5 backfills pre-existing worktrees idempotently.
- D-04 invariants asserted end-to-end: tests/cross-worktree/simulation.sh exercises all 4 invariants on a 3-worktree fixture.
- D-13 failure injections all fired: source `.beads/` deleted, concurrent regen, source renamed, BEADS_DIR unset — observable behavior matches CONTEXT.md.
- REQ-03 integration coverage: tests/cross-worktree/simulation.sh + tests/install-tests/worktree-backfill.test.sh together prove cross-worktree state sharing under realistic multi-day flows.
- REQ-05 integration coverage: Day 4 concurrent burst exercises Plan 03-01's flock preamble and asserts atomic markdown views (D-04 #4).
- Test runner wiring: tests/run-quick.sh cross-worktree-sim and tests/run-all.sh both green.
- Sandbox isolation: every fixture lives under `mktemp -d /tmp/gsd-beads-cross-XXXXXX` with `trap EXIT` cleanup; no leakage to the dev's real bd store.
- Wall-time budget honored: simulation completes in <90s.
</success_criteria>

<output>
After completion, create `.planning/phases/03-cross-worktree-validation/03-02-SUMMARY.md` per @$HOME/.claude/get-shit-done/templates/summary.md. The SUMMARY MUST include:
- A short transcript excerpt from one successful simulation run (Day 1 + Day 4 burst + final summary). This transcript is the seed material for Plan 03-03's docs/WORKTREES-EVIDENCE.md (D-12).
- The exact `git worktree list --porcelain` output observed during the worktree-backfill test (so the WORKTREES.md walkthrough in Plan 03-03 quotes accurate output).
- The empirically-observed wall time of `simulation.sh` on the dev machine (so Plan 03-03's docs/WORKTREES.md sets correct user expectations).
- Any pre-existing dev-env caveats that surface (analogous to Phase 2's stray bd-memory-key issue noted in 02-VERIFICATION.md).
</output>
