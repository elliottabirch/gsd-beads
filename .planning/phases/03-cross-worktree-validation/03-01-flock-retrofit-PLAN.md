---
phase: 03
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/cascade-loop.sh
  - scripts/regen-roadmap.sh
  - scripts/regen-requirements.sh
  - install.sh
  - tests/hook-tests/flock-preamble.test.sh
  - tests/hook-tests/bd-sync.test.sh
autonomous: true
gap_closure: false
requirements_addressed: [REQ-05]
tags: [flock, serialization, cross-worktree, regen, cascade, install.sh]
user_setup: []

must_haves:
  goal: "All three regen/cascade scripts serialize via a single shared `<source>/.beads/.gsd-beads.lock`, install.sh fails fast if `flock` is missing, and bd-sync.sh continues fail-soft when a flock acquisition times out."
  truths:
    - "scripts/cascade-loop.sh acquires <source>/.beads/.gsd-beads.lock via `flock -x -w 30` before running its cascade loop (D-15)"
    - "scripts/regen-roadmap.sh acquires the same lock at the same path before regenerating ROADMAP.md (D-15)"
    - "scripts/regen-requirements.sh acquires the same lock at the same path before regenerating REQUIREMENTS.md (D-15)"
    - "All three scripts resolve the lock path via `git rev-parse --git-common-dir` + dirname + `cd && pwd -P` (Pitfall 3 mitigation)"
    - "All three scripts emit the literal stderr message `another regen` and exit non-zero on flock timeout (D-15 failure mode)"
    - "install.sh adds a pre-flight `command -v flock` check that aborts the install with a clear macOS install hint when flock is missing (Pitfall 1)"
    - "tests/hook-tests/flock-preamble.test.sh verifies the preamble is present in all three scripts and that timeout produces the documented error (REQ-05 unit coverage)"
    - "tests/hook-tests/bd-sync.test.sh gains a CASE that proves bd-sync.sh exits 0 even when a chained script returns non-zero (fail-soft preservation per D-15)"
  artifacts:
    - path: "scripts/cascade-loop.sh"
      provides: "Lock-acquiring cascade loop"
      contains: "BEGIN GSD-BEADS LOCK PREAMBLE v1"
    - path: "scripts/regen-roadmap.sh"
      provides: "Lock-acquiring roadmap regen"
      contains: "BEGIN GSD-BEADS LOCK PREAMBLE v1"
    - path: "scripts/regen-requirements.sh"
      provides: "Lock-acquiring requirements regen"
      contains: "BEGIN GSD-BEADS LOCK PREAMBLE v1"
    - path: "install.sh"
      provides: "Pre-flight flock check"
      contains: "flock"
    - path: "tests/hook-tests/flock-preamble.test.sh"
      provides: "grep + behavioral preamble assertions for the 3 lock scripts"
      min_lines: 80
    - path: "tests/hook-tests/bd-sync.test.sh"
      provides: "Existing suite extended with flock-failure-still-returns-0 CASE"
      contains: "flock-failure"
  key_links:
    - from: "scripts/cascade-loop.sh"
      to: "<source>/.beads/.gsd-beads.lock"
      via: "exec 9>$LOCK ; flock -x -w 30 9"
      pattern: "flock -x -w 30 9"
    - from: "scripts/regen-roadmap.sh"
      to: "<source>/.beads/.gsd-beads.lock"
      via: "exec 9>$LOCK ; flock -x -w 30 9"
      pattern: "flock -x -w 30 9"
    - from: "scripts/regen-requirements.sh"
      to: "<source>/.beads/.gsd-beads.lock"
      via: "exec 9>$LOCK ; flock -x -w 30 9"
      pattern: "flock -x -w 30 9"
    - from: "install.sh"
      to: "flock binary on PATH"
      via: "command -v flock check in pre-flight block"
      pattern: "command -v flock"
    - from: "hooks/bd-sync.sh chain (unchanged)"
      to: "scripts/cascade-loop.sh ; scripts/regen-roadmap.sh ; scripts/regen-requirements.sh"
      via: "|| true on each invocation (existing fail-soft pattern)"
      pattern: "\\|\\| true"
---

<objective>
Retrofit `flock -x -w 30` serialization onto the three scripts that mutate
the regenerated markdown views (`cascade-loop.sh`, `regen-roadmap.sh`,
`regen-requirements.sh`) so that two worktrees firing `bd-sync.sh`
simultaneously produce a single, atomic markdown output rather than racing
on the atomic-mv tail. Implements decision **D-15**.

Purpose: REQ-05 (conflict-free concurrent updates) is currently satisfied
by atomic-mv only — which papers over the race rather than eliminating it.
D-15 directly chose `flock` over the recommended atomic-mv-only option to
serialize the full cascade→regen chain at a single shared lock file located
at `<source-repo>/.beads/.gsd-beads.lock` (resolved via
`git rev-parse --git-common-dir`).

Output: three production scripts gain identical sentinel-marked lock
preambles; `install.sh` gains a pre-flight `command -v flock` check
(matching the existing pre-flight block at lines 14–20); a new
`tests/hook-tests/flock-preamble.test.sh` regression-guards the preamble
shape and the timeout-error path; `tests/hook-tests/bd-sync.test.sh` gains
one CASE proving the existing `|| true` fail-soft chain continues to swallow
non-zero exits from a locked-out script.
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
@.planning/phases/02-build-the-layer/02-CONTEXT.md
@.planning/phases/02-build-the-layer/02-VERIFICATION.md
@.claude/skills/spike-findings-gsd-beads/SKILL.md
@.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md
@./CLAUDE.md
@scripts/cascade-loop.sh
@scripts/regen-roadmap.sh
@scripts/regen-requirements.sh
@hooks/bd-sync.sh
@install.sh
@settings.fragment.json
@tests/hook-tests/bd-sync.test.sh
@tests/hook-tests/cascade-loop.test.sh
@tests/hook-tests/regen-roadmap.test.sh
@tests/hook-tests/regen-requirements.test.sh

<interfaces>
<!-- Canonical lock-preamble shape (drop into all 3 scripts; from 03-RESEARCH.md §"Code Examples"). -->
<!-- The preamble MUST be byte-for-byte identical across the 3 scripts so the -->
<!-- flock-preamble test can grep one signature and validate all three. -->

```bash
# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---
# Resolve source repo's .beads/ from any worktree, absolutize via cd+pwd -P.
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"

# Pre-flight: flock present? (Pitfall 1 — macOS users must brew install flock)
if ! command -v flock >/dev/null 2>&1; then
  echo "[gsd-beads] ERROR: flock not installed (macOS: brew install flock)" >&2
  exit 1
fi

# Lazy-create lock file (zero bytes, never deleted; *.lock is already in .beads/.gitignore).
mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"

# Acquire exclusive lock (30s timeout matches bd-sync.sh hook timeout in settings.fragment.json).
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen is in progress at $LOCK — retry shortly" >&2
  exit 1
fi
# Lock auto-released when fd 9 closes (script exit).
# --- END GSD-BEADS LOCK PREAMBLE v1 ---
```

<!-- Existing fail-soft pattern in hooks/bd-sync.sh (DO NOT MODIFY): -->
```bash
"$SCRIPTS/cascade-loop.sh" --quiet || true
"$SCRIPTS/regen-roadmap.sh" || true
"$SCRIPTS/regen-requirements.sh" || true
exit 0
```

<!-- Existing pre-flight pattern in install.sh lines 14–20 (extend, do not refactor): -->
```bash
command -v bd >/dev/null 2>&1 || { echo "ERROR: bd not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not installed"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not installed"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "ERROR: git not installed"; exit 1; }
node -e 'process.exit(parseInt(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' \
  || { echo "ERROR: node >=22 required (have $(node --version))"; exit 1; }
```
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Worktree process → shared lock file | Two or more processes from different worktrees compete for `<src>/.beads/.gsd-beads.lock`. Trusted (single developer) but the locking primitive must be robust to crash and `kill -9`. |
| install.sh → host PATH | install.sh trusts that `command -v flock` returns the user's flock — no privilege boundary crossed (read-only check). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Denial of service | Lock holder hangs | mitigate | `flock -x -w 30` enforces a 30-second wait timeout (matches bd-sync.sh hook timeout in settings.fragment.json); blocked writers exit non-zero with the "another regen in progress" stderr message; bd-sync.sh's `\|\| true` chain absorbs the non-zero exit. |
| T-03-02 | Tampering | Stale lock file across kills | accept | flock semantics are tied to the open fd, not the file's existence. `kill -9` releases the kernel lock automatically (verified via flock(1) man page). Lock file is zero bytes; never deleted at script exit (anti-pattern explicitly rejected by RESEARCH.md). |
| T-03-03 | Information disclosure | Lock-file path leaks repo location | accept | Lock path is logged to stderr only on timeout. Single-developer audience; same surface as existing `[gsd-beads]` log lines from worktree-post-checkout.sh. |
| T-03-04 | Denial of service | Path-resolution failure on first call | mitigate | `git rev-parse --git-common-dir 2>/dev/null \|\| common="$PWD/.git"` provides a working fallback when invoked outside a git repo; absolutize via `cd && pwd -P` (Pitfall 3 mitigation in RESEARCH.md). |

No `high` severity threats. The flock retrofit is a defense-in-depth additive change layered over the existing atomic-mv pattern.
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add flock preamble to all three regen/cascade scripts (D-15 implementation)</name>
  <files>
    scripts/cascade-loop.sh,
    scripts/regen-roadmap.sh,
    scripts/regen-requirements.sh
  </files>
  <read_first>
    - 03-RESEARCH.md §"Code Examples" — the canonical lock preamble shape (lines ~340-352).
    - 03-RESEARCH.md §"Common Pitfalls" Pitfall 3 — `git rev-parse --git-common-dir` returning relative `.git` from the source repo (must absolutize via `cd && pwd -P`).
    - 03-RESEARCH.md §"Anti-Patterns to Avoid" — DO NOT use `flock -x -w 30 -c`; DO NOT delete the lock file at exit; DO NOT resolve the lock path via `$PWD/.beads/...`.
    - 03-CONTEXT.md D-15 in full (the locked decision text).
    - scripts/cascade-loop.sh (current 47 lines) — note `set -euo pipefail` is already on line 18; preamble must come AFTER `set -euo pipefail` and AFTER the `--quiet` argv parse on line 21 so that the preamble's `exit 1` paths still emit stderr cleanly.
    - scripts/regen-roadmap.sh (current 239 lines) — note `set -euo pipefail` is on line 14; the existing `mktemp` + `trap 'rm -f "$tmp"' EXIT` block starts at line 28. The lock preamble goes BEFORE the mktemp block (so a locked-out invocation never creates a tempfile).
    - scripts/regen-requirements.sh (current 275 lines) — same structure as regen-roadmap; `set -euo pipefail` line 14, mktemp/trap line 28-29. Same insertion point.
    - hooks/bd-sync.sh — confirms the existing `|| true` chain (lines 44-46) absorbs non-zero exit codes.
  </read_first>
  <behavior>
    - Test 1: After modification, all three scripts contain the literal sentinel `# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---` exactly once.
    - Test 2: All three scripts contain `flock -x -w 30 9` (the canonical fd-form invocation, NOT the `-c` form).
    - Test 3: All three scripts contain `git rev-parse --git-common-dir` and the absolutize idiom `cd "$common" && pwd -P`.
    - Test 4: All three scripts emit the literal stderr message `another regen is in progress` on lock timeout (verifiable via bash subprocess + busy-lock fixture in flock-preamble.test.sh).
    - Test 5: All three scripts pre-flight check `command -v flock` and emit a macOS-hint error message if missing.
    - Test 6: `bash -n scripts/cascade-loop.sh && bash -n scripts/regen-roadmap.sh && bash -n scripts/regen-requirements.sh` exits 0 (syntax-clean).
    - Test 7: Existing test suites still pass: `bash tests/hook-tests/cascade-loop.test.sh && bash tests/hook-tests/regen-roadmap.test.sh && bash tests/hook-tests/regen-requirements.test.sh` all green (no behavioral regressions for the uncontended path).
  </behavior>
  <action>
    Insert the canonical lock preamble (verbatim from `<interfaces>` above) into all three scripts. **Insertion point in each file:**

    - **scripts/cascade-loop.sh:** insert AFTER line 22 (`MAX_ITER="${MAX_ITER:-20}"`), BEFORE the existing blank line + `iter=0` block. The preamble must come after `set -euo pipefail` (line 18) and after the `--quiet` argv parse (lines 20-21) so that the lock acquisition is part of the script's "real work" preamble, not before argv interpretation.

    - **scripts/regen-roadmap.sh:** insert AFTER line 14 (`set -euo pipefail`), BEFORE the existing `# Pre-flight: locate project root` block (line 16+). The preamble's lock acquisition must happen BEFORE `mktemp` so a locked-out invocation never creates a tempfile that would then leak (the existing `trap 'rm -f "$tmp"' EXIT` only protects the script's own happy/error paths, not the preamble's `exit 1`).

    - **scripts/regen-requirements.sh:** same insertion point — AFTER line 14 (`set -euo pipefail`), BEFORE the project-root locator (line 16+).

    **Preamble content:** copy exactly the bash block in `<interfaces>` above (sentinel markers `# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---` and `# --- END GSD-BEADS LOCK PREAMBLE v1 ---` included). Do NOT edit the preamble — every byte matters for the flock-preamble grep test in Task 3.

    **Why fd-form, not `-c`-form:** RESEARCH.md anti-pattern. The fd-form (`exec 9>"$LOCK" ; flock -x -w 30 9`) auto-releases the lock when the script exits via fd close — no quoting hazard, no nested-shell pitfalls.

    **Why don't delete the lock at exit:** flock semantics are tied to the open fd, not the file's existence. Deleting introduces a TOCTOU window where two writers create different inodes. The lock file is 0 bytes; `*.lock` is already in `.beads/.gitignore` (verified). Per D-15: "Lock file lifecycle: created lazily on first run; never deleted."

    **Idempotent re-application:** Plan executor should run `grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' <file>` on each script BEFORE editing; if it returns 1, the preamble is already present and the script is skipped (defense against re-running this task). If it returns 0, insert. If it returns >1, fail loudly — duplicate preambles are a regression.

    **Per D-15:** the lock file is `<source-repo>/.beads/.gsd-beads.lock`. Source repo is resolved via `git rev-parse --git-common-dir` then `dirname` (the canonical resolver used by hooks/worktree-post-checkout.sh:19-20 — same pattern, same correctness).
  </action>
  <acceptance_criteria>
    - `grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/cascade-loop.sh` returns exactly `1`.
    - `grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/regen-roadmap.sh` returns exactly `1`.
    - `grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/regen-requirements.sh` returns exactly `1`.
    - `grep -F 'flock -x -w 30 9' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh` finds 3 matches (one per file).
    - `grep -F 'git rev-parse --git-common-dir' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh` finds 3 matches.
    - `grep -F 'cd "$common" && pwd -P' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh` finds 3 matches.
    - `grep -F 'another regen is in progress' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh` finds 3 matches.
    - `bash -n scripts/cascade-loop.sh && bash -n scripts/regen-roadmap.sh && bash -n scripts/regen-requirements.sh` exits 0.
    - `bash tests/hook-tests/cascade-loop.test.sh` is green (no regressions).
    - `bash tests/hook-tests/regen-roadmap.test.sh` is green (no regressions).
    - `bash tests/hook-tests/regen-requirements.test.sh` is green (no regressions).
    - Anti-pattern guard: `! grep -F 'flock -x -w 30 -c' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh` succeeds (zero matches — fd-form only, not `-c` form).
    - Anti-pattern guard: `! grep -E 'rm -f.*\\.gsd-beads\\.lock|rm.*\\$LOCK' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh` succeeds (zero matches — never delete the lock file).
  </acceptance_criteria>
  <verify>
    <automated>bash -n scripts/cascade-loop.sh && bash -n scripts/regen-roadmap.sh && bash -n scripts/regen-requirements.sh && bash tests/hook-tests/cascade-loop.test.sh && bash tests/hook-tests/regen-roadmap.test.sh && bash tests/hook-tests/regen-requirements.test.sh</automated>
  </verify>
  <done>
    All three scripts have an identical sentinel-marked lock preamble. Existing
    test suites are green. Anti-pattern guards confirm fd-form is used and the
    lock file is never deleted.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add `flock` pre-flight check to install.sh and create flock-preamble test suite</name>
  <files>
    install.sh,
    tests/hook-tests/flock-preamble.test.sh
  </files>
  <read_first>
    - install.sh lines 14-20 (current pre-flight block: bd, jq, node, git, node-version-22 check).
    - 03-RESEARCH.md §"Common Pitfalls" Pitfall 1 — full text. macOS does not ship flock; `command -v flock` MUST run BEFORE Step 2 of install.sh (mirror file copies); failure mode: install.sh exit 1 with the documented brew install hint.
    - 03-VALIDATION.md §"Wave 0 Requirements" — `tests/hook-tests/flock-preamble.test.sh` is on the Wave 0 list.
    - tests/hook-tests/regen-roadmap.test.sh (existing pattern for test-runner shape: `pass=0; fail=0; case_run helper; trap cleanup; `)
    - tests/hook-tests/cascade-loop.test.sh (same pattern, simpler — useful as a skeleton).
    - 03-RESEARCH.md §"Code Examples" §"Invariant assertions" — gives the shape of the bash assertions; we re-use the same shape in the flock-preamble tests.
    - settings.fragment.json — confirms the bd-sync.sh hook timeout is 30 (so the flock 30s timeout matches by D-15 contract).
  </read_first>
  <behavior>
    - Test 1: install.sh fails fast (exit 1) with stderr containing the literal string `flock not installed` when `flock` is removed from PATH.
    - Test 2: install.sh succeeds (exit 0) when `flock` is on PATH (existing behavior preserved).
    - Test 3: tests/hook-tests/flock-preamble.test.sh CASE 1 — grep-level: all three scripts contain `BEGIN GSD-BEADS LOCK PREAMBLE v1`.
    - Test 4: tests/hook-tests/flock-preamble.test.sh CASE 2 — grep-level: all three scripts contain `flock -x -w 30 9` and `git rev-parse --git-common-dir`.
    - Test 5: tests/hook-tests/flock-preamble.test.sh CASE 3 — behavioral: with the lock already held by a backgrounded `flock -x` on the lock file, invoking `regen-roadmap.sh` exits non-zero within ~30s + slack and emits stderr containing `another regen is in progress`.
    - Test 6: tests/hook-tests/flock-preamble.test.sh CASE 4 — behavioral: same shape as CASE 3 but for `cascade-loop.sh`.
    - Test 7: tests/hook-tests/flock-preamble.test.sh CASE 5 — behavioral: same shape as CASE 3 but for `regen-requirements.sh`.
    - Test 8: tests/hook-tests/flock-preamble.test.sh CASE 6 — uncontended path: with no other holder, `regen-roadmap.sh` runs in a synthetic /tmp git fixture and exits 0 (proving the preamble does not break the happy path).
  </behavior>
  <action>
    **Part A — Modify `install.sh`:**

    Add a single new pre-flight line into the existing pre-flight block. Insert after line 18 (current `command -v git` check), BEFORE line 19 (the node-version check). Exact line to insert:

    ```bash
    command -v flock >/dev/null 2>&1 || { echo "ERROR: flock not installed (macOS: brew install flock)" >&2; exit 1; }
    ```

    Rationale: this matches the exact shape of the surrounding `command -v X` lines (line 15-18) — same redirection (`>/dev/null 2>&1`), same brace block, same exit code. The `>&2` on the error message is a small upgrade over the surrounding lines (which write to stdout) but is the correct shape for an error.

    **Part B — Create `tests/hook-tests/flock-preamble.test.sh`:**

    Mirror the structure of tests/hook-tests/cascade-loop.test.sh and tests/hook-tests/regen-roadmap.test.sh:
    - `set -euo pipefail`; `pass=0; fail=0`; `case_run` helper; `trap cleanup EXIT`.
    - Resolve `REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"`.
    - **CASE 1 (grep-level preamble presence):** for each of the 3 scripts, grep for `BEGIN GSD-BEADS LOCK PREAMBLE v1` and assert exit 0.
    - **CASE 2 (grep-level primitives):** for each of the 3 scripts, grep for `flock -x -w 30 9`, `git rev-parse --git-common-dir`, `another regen is in progress`, and `cd "$common" && pwd -P`. All four patterns must appear.
    - **CASE 3 (behavioral, regen-roadmap.sh on contended lock):**
      1. Build a synthetic /tmp fixture: `git init -q`, `mkdir -p .beads`, `git commit --allow-empty -m init`.
      2. Pre-create `<fixture>/.beads/.gsd-beads.lock`.
      3. Background a long-running `flock -x` holder: `flock -x .beads/.gsd-beads.lock sleep 35 &` (sleep slightly longer than the 30s flock timeout). Capture its PID.
      4. From inside the fixture (cd into it), invoke `bash "$REPO_ROOT/scripts/regen-roadmap.sh"` with stderr captured. Expect exit code != 0 within ~31s. Assert stderr contains `another regen is in progress`.
      5. Kill the backgrounded holder (`kill $PID`).
      6. Use a shorter fixture timeout in the test for CI sanity: instead of 35s, override the flock timeout via `flock -x -w 5 ... ` AND inject a temporary `LOCK_TIMEOUT_OVERRIDE` env var? **Simpler:** reduce holder lifetime to a few seconds beyond a temporary override OR use `timeout` to cap the test at ~33s. Pick the simplest path: **hold the lock for `2` seconds (short-lived holder), then assert the shim WAITS THEN PROCEEDS** OR **hold the lock for 35s, the regen exits with timeout msg in ~30s**. The simulation correctness asserts the timeout path (the harder behavioral case), which proves D-15's failure mode. Use the 35s holder + 30s wait approach but wrap the test in a `timeout 33` for safety.
    - **CASE 4 (behavioral, cascade-loop.sh on contended lock):** same shape as CASE 3 but invokes `cascade-loop.sh --quiet` instead. (cascade-loop has no /tmp git fixture dependency for the lock itself — just the same fixture works because the lock-path resolver uses git-common-dir.)
    - **CASE 5 (behavioral, regen-requirements.sh on contended lock):** same shape as CASE 3 but invokes `regen-requirements.sh`.
    - **CASE 6 (uncontended happy path, regen-roadmap.sh):** in a fresh fixture with bd init, run `regen-roadmap.sh` (no holder) and assert exit 0 and that the lock file `<fixture>/.beads/.gsd-beads.lock` exists after the run (lazy-created, never deleted). bd init may fail in /tmp without project context, so use the existing `tests/e2e/full-install.smoke.sh` pattern: `bd init --non-interactive --skip-agents` after git init.

    **Important — keep test runtime under the 90s phase target (03-VALIDATION.md):**
    - CASE 3/4/5 each take ~31s (lock timeout). Three sequential = ~93s. **Reduce to a single contended case (CASE 3 = regen-roadmap)** and replace CASE 4/5 with a *shared* helper invocation that asserts each script's behavior in turn against the *same* held lock — but this is only correct if the helper fires them sequentially while the holder is alive.
    - **Better: parameterize one behavioral helper that takes the script name + accepts a single 35s holder lifetime.** Run it 3 times sequentially. Total: ~93s. **Still over 90s.**
    - **Best (chosen):** CASE 3 covers regen-roadmap.sh end-to-end with a real timeout. CASES 4 & 5 use a *short* 5-second holder + invoke each script which still hits the timeout but with `flock -x -w 4` overridden via a custom LOCK_TIMEOUT_OVERRIDE env var the script could honor — except D-15 locks the timeout at 30. **Punt: keep CASES 4 & 5 as grep-only (already covered by CASE 1+2)** and keep CASE 3 as the single behavioral timeout proof. Document this trade-off as a comment in the test file. The behavioral assertion in the simulation harness (Plan 03-02) covers the multi-script behavioral path more rigorously; this unit test stays fast.
    - **FINAL CASE LIST:** CASE 1 (grep-preamble all 3); CASE 2 (grep-primitives all 3); CASE 3 (behavioral timeout, regen-roadmap only — the canonical script); CASE 4 (uncontended happy-path, regen-roadmap — proves preamble doesn't break the no-holder case). Total runtime: ~32s + a few seconds. Well under 90s.
  </action>
  <acceptance_criteria>
    - `grep -n 'command -v flock' install.sh` returns a line in the pre-flight block (lines 14-20 region).
    - `grep -F 'macOS: brew install flock' install.sh` finds at least one match.
    - `bash -n install.sh` exits 0 (syntax-clean).
    - When `flock` is hidden from PATH (test via PATH override in a sandbox), `bash install.sh` exits 1 and stderr contains `flock not installed`.
    - When `flock` is on PATH (default), the existing 5/5 path-precedence test still passes: `bash tests/install-tests/path-precedence.test.sh` is green.
    - `tests/hook-tests/flock-preamble.test.sh` exists and is executable (`chmod +x`).
    - `bash tests/hook-tests/flock-preamble.test.sh` runs in <40s wall time and exits 0 (`pass = total`, `fail = 0`).
    - The test file contains exactly 4 CASE blocks (CASE 1, CASE 2, CASE 3 behavioral timeout, CASE 4 uncontended happy path).
    - `grep -c '^# CASE [0-9]' tests/hook-tests/flock-preamble.test.sh` returns 4.
  </acceptance_criteria>
  <verify>
    <automated>bash -n install.sh && bash tests/hook-tests/flock-preamble.test.sh && bash tests/install-tests/path-precedence.test.sh</automated>
  </verify>
  <done>
    install.sh refuses to proceed without `flock` (macOS hint included). The
    flock-preamble.test.sh suite green-locks the preamble shape and the timeout
    behavioral path. No regressions in path-precedence install test.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend bd-sync.test.sh with flock-failure-still-returns-0 CASE (fail-soft preservation)</name>
  <files>tests/hook-tests/bd-sync.test.sh</files>
  <read_first>
    - tests/hook-tests/bd-sync.test.sh (current 17 cases) — note the `make_stubs` helper at lines 51-71 that creates synthetic stub scripts in a tmpdir. The pattern: `SCRIPTS=$tmpdir bd-sync.sh < payload` lets us inject any failure mode by editing the stub.
    - hooks/bd-sync.sh — confirm the `|| true` on lines 44-46 swallows non-zero exits from each chained script.
    - 03-CONTEXT.md D-15 — failure mode contract: "lock timeout (`flock` exit 1) → script exits non-zero ... `bd-sync.sh` continues fail-soft."
    - 03-RESEARCH.md §"Validation Architecture" — REQ-05 unit test entry "bd-sync.sh chain still completes (fail-soft) when flock returns non-zero — extend tests/hook-tests/bd-sync.test.sh with new case."
  </read_first>
  <behavior>
    - Test 1: New CASE 18 ("CASE18-flock-failure-still-fires-chain-and-returns-0") drops in a stub `cascade-loop.sh` that exits 1 (simulating flock timeout) but stub `regen-roadmap.sh` and `regen-requirements.sh` still get called (proving `|| true` gates each invocation independently).
    - Test 2: bd-sync.sh exits 0 in this scenario (fail-soft preserved per D-15).
    - Test 3: All existing 17 cases still pass (no regressions).
  </behavior>
  <action>
    Append a new CASE block to tests/hook-tests/bd-sync.test.sh AFTER the existing CASE17 block. Use the existing `make_stubs` helper as a starting point but override the stubs to simulate flock failure:

    ```bash
    echo ""
    echo "=== Suite: Flock-failure fail-soft (D-15, 1 case) ==="

    run_flock_failure_test() {
      local name="$1"; local command="$2"
      local tmpdir
      tmpdir=$(mktemp -d)
      # Failing cascade stub (simulates flock timeout exit 1)
      cat > "$tmpdir/cascade-loop.sh" <<'STUB'
    #!/usr/bin/env bash
    echo "[gsd-beads] another regen is in progress at /fake/.gsd-beads.lock — retry shortly" >&2
    exit 1
    STUB
      chmod +x "$tmpdir/cascade-loop.sh"
      # regen-roadmap stub: still records being fired (proves || true gates each)
      cat > "$tmpdir/regen-roadmap.sh" <<'STUB'
    #!/usr/bin/env bash
    touch "${REGEN_ROADMAP_MARKER:-/tmp/regen-roadmap-stub-fired}"
    STUB
      chmod +x "$tmpdir/regen-roadmap.sh"
      cat > "$tmpdir/regen-requirements.sh" <<'STUB'
    #!/usr/bin/env bash
    touch "${REGEN_REQUIREMENTS_MARKER:-/tmp/regen-requirements-stub-fired}"
    STUB
      chmod +x "$tmpdir/regen-requirements.sh"
      local marker_rr="$tmpdir/rr.marker"
      local marker_rreq="$tmpdir/rreq.marker"
      export REGEN_ROADMAP_MARKER="$marker_rr"
      export REGEN_REQUIREMENTS_MARKER="$marker_rreq"
      export SCRIPTS="$tmpdir"
      run_bd_payload "$command"
      rc=$?
      unset REGEN_ROADMAP_MARKER REGEN_REQUIREMENTS_MARKER SCRIPTS
      local rr_fired="no"; [ -f "$marker_rr" ] && rr_fired="yes"
      local rreq_fired="no"; [ -f "$marker_rreq" ] && rreq_fired="yes"
      local status
      if [ "$rc" = "0" ] && [ "$rr_fired" = "yes" ] && [ "$rreq_fired" = "yes" ]; then
        status="PASS"; pass=$((pass+1))
      else
        status="FAIL"; fail=$((fail+1))
      fi
      printf '  [%s] %-50s rc=%s rr=%s rreq=%s\n' "$status" "$name" "$rc" "$rr_fired" "$rreq_fired"
      rm -rf "$tmpdir"
    }

    run_flock_failure_test "CASE18-flock-failure-still-fires-chain-and-returns-0" "bd close abc-1"
    ```

    Insert this block AFTER the existing `run_state_change_test "CASE17-..."` invocation (around line 184) and BEFORE the final `total=$((pass+fail))` summary block. Update the summary's expected count if hardcoded (it's not — it's `pass / total`).

    **Why this is the correct fail-soft proof:** the chained stubs prove that bd-sync.sh's `|| true` operates per-invocation, not per-chain. If a future refactor ever broke that (e.g., switched to `set -e` without `|| true`), this CASE would fail loudly.
  </action>
  <acceptance_criteria>
    - `grep -c 'CASE18' tests/hook-tests/bd-sync.test.sh` returns at least 1.
    - `grep -F 'flock-failure-still-fires-chain-and-returns-0' tests/hook-tests/bd-sync.test.sh` finds at least 1 match.
    - `grep -F 'fail-soft' tests/hook-tests/bd-sync.test.sh` finds at least 1 match.
    - `bash tests/hook-tests/bd-sync.test.sh` exits 0 with `Passed: 18 / 18` (all 17 existing + 1 new CASE 18 pass).
    - `bash -n tests/hook-tests/bd-sync.test.sh` exits 0 (syntax-clean).
  </acceptance_criteria>
  <verify>
    <automated>bash -n tests/hook-tests/bd-sync.test.sh && bash tests/hook-tests/bd-sync.test.sh</automated>
  </verify>
  <done>
    bd-sync.test.sh now has 18 cases. CASE 18 proves the existing `|| true`
    fail-soft chain absorbs flock timeouts and still fires the downstream
    regen scripts. Sentinel-marked regression guard for D-15's failure-mode
    contract.
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run the full Phase 3 quick suite:

```bash
bash tests/hook-tests/flock-preamble.test.sh   # NEW — must pass
bash tests/hook-tests/bd-sync.test.sh          # MUST report 18/18
bash tests/hook-tests/cascade-loop.test.sh     # regression: must still pass (4/4)
bash tests/hook-tests/regen-roadmap.test.sh    # regression: must still pass (5/5)
bash tests/hook-tests/regen-requirements.test.sh  # regression: must still pass (6/6)
bash -n install.sh                             # syntax-clean
bash tests/install-tests/path-precedence.test.sh   # regression: must pass (4/4)
```

Anti-pattern guards (must all return zero matches):
```bash
! grep -F 'flock -x -w 30 -c' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh   # fd-form only
! grep -E 'rm -f.*\\.gsd-beads\\.lock' scripts/cascade-loop.sh scripts/regen-roadmap.sh scripts/regen-requirements.sh   # never delete lock
```

Sentinel cardinality check (must each return exactly 1):
```bash
grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/cascade-loop.sh
grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/regen-roadmap.sh
grep -c 'BEGIN GSD-BEADS LOCK PREAMBLE v1' scripts/regen-requirements.sh
```
</verification>

<success_criteria>
- D-15 implementation complete: all three scripts hold the same shared lock at `<source>/.beads/.gsd-beads.lock` via `flock -x -w 30 9>$LOCK`.
- Pitfall 1 closed: install.sh aborts cleanly with macOS hint when flock is missing.
- Pitfall 3 closed: lock-path resolver uses absolutized `git rev-parse --git-common-dir`.
- REQ-05 unit-level coverage: `tests/hook-tests/flock-preamble.test.sh` green-locks both grep-level and behavioral timeout assertions.
- D-15 fail-soft contract: `tests/hook-tests/bd-sync.test.sh` CASE 18 proves the chain still completes when one script returns non-zero.
- No regressions: all 6 existing hook-tests + 5 install-tests + 2 worktree-tests still pass.
</success_criteria>

<output>
After completion, create `.planning/phases/03-cross-worktree-validation/03-01-SUMMARY.md` per @$HOME/.claude/get-shit-done/templates/summary.md. The SUMMARY must surface:
- The exact insertion-point line numbers for the lock preamble in each of the 3 scripts (so Plan 03-02's simulation harness knows where to grep for invariants).
- The literal stderr message format (`another regen is in progress at <LOCK> — retry shortly`) — Plan 03-03's WORKTREES.md troubleshooting section quotes this verbatim.
- A note on macOS install: `brew install flock` is the documented path; install.sh's pre-flight enforces this.
</output>
