---
phase: 05-roadmap-read-handlers
plan: 05
type: execute
wave: 5
depends_on: [01, 02, 03, 04]
files_modified:
  - tests/shadow-tests/handler-roadmap-determinism.test.sh
  - tests/shadow-tests/handler-roadmap-call-count.test.mjs
autonomous: true
requirements: [REQ-READ-01, REQ-READ-02]
tags:
  - quality-gates
  - determinism-precursor
  - call-count-precursor
  - allowlist-verification
  - phase-11-precursor

key_decisions:
  - "These tests are PRECURSORS — Phase 11 owns the formal REQ-QUAL-04..07 invariants. Plan 05 lands the per-handler determinism + call-count gates so future Phase 6/7/8/9 handlers inherit the pattern. Phase 11's full cross-cutting suite extends from these per-handler tests."
  - "REQ-QUAL-05 (allowlist): no new test added — bd-allowlist-grep.test.sh already covers `bin/gsd-sdk-shadow.mjs`. Plan 05 only verifies the allowlist test still passes after Plans 03/04 added `bd export` and `bd memories` invocations (both subcommands are in the allowlist; this is a sanity check, not new coverage)."
  - "Plan 05 does NOT implement Phase 11's transitive verification (REQ-VERIFY-02) or full perf gate (REQ-QUAL-07's 500ms budget). Those need 50-phase fixture + 5-run determinism + cross-handler perf tests; Phase 11 lands them."
  - "Phase 11 will extend handler-roadmap-determinism.test.sh and handler-roadmap-call-count.test.mjs to cover other read handlers as they ship (progress.json, state.json, etc.) — establishing the file-naming convention here lets Phase 11 reuse the structure."
  - "Plan 05 covers BOTH REQ-READ-01 (roadmap.analyze handler shipped in Plan 03) and REQ-READ-02 (roadmap.get-phase handler shipped in Plan 04) — the determinism + call-count regression gates protect both handlers against future N+1 spawn or ordering regressions."

  Decision References:
  - D-29: Hook-allowlist bd subcommands — only list, show, ready, memories, status, prime, export, deps, children, search are allowed in production read-handler code. Task 3 of this plan verifies bd-allowlist-grep.test.sh (REQ-QUAL-05) remains green after Plans 03/04 added bd export + memories invocations (both are within the allowlist).

must_haves:
  truths:
    - "Running gsd-sdk query roadmap.analyze 5x consecutively on the same fixture produces byte-identical output (REQ-QUAL-06 precursor) — sort by priority, created_at, id is deterministic"
    - "A single roadmap.analyze invocation triggers <=2 bd CLI spawns (1x bd export, 1x bd memories) regardless of phase count (REQ-QUAL-07 precursor) — no per-phase fan-out"
    - "A single roadmap.get-phase invocation triggers <=1 bd CLI spawn (1x bd export, no memories needed) regardless of phase count"
    - "bd-allowlist-grep.test.sh continues to pass after Plans 03/04 added export+memories invocations to bin/gsd-sdk-shadow.mjs (the allowlist contains both subcommands; precondition holds)"
  artifacts:
    - path: "tests/shadow-tests/handler-roadmap-determinism.test.sh"
      provides: "5x byte-identical roadmap.analyze on canonical fixture (REQ-QUAL-06 precursor) — protects REQ-READ-01 + REQ-READ-02"
    - path: "tests/shadow-tests/handler-roadmap-call-count.test.mjs"
      provides: "<=2 bd spawns per roadmap.analyze invocation; <=1 per roadmap.get-phase (REQ-QUAL-07 precursor) — protects REQ-READ-01 + REQ-READ-02"
  key_links:
    - from: "handler-roadmap-determinism.test.sh"
      to: "tests/fixtures/seed.jsonl"
      via: "bash tests/fixtures/seed-fixture.sh + 5x shadow query"
      pattern: "seed-fixture.sh"
    - from: "handler-roadmap-call-count.test.mjs"
      to: "bd CLI"
      via: "PATH-mock bd binary that increments a counter file"
      pattern: "withMockBd"
---

<objective>
Land per-handler quality gates (determinism + call-count) for the two Phase 5 handlers (REQ-READ-01 + REQ-READ-02). These are precursors to Phase 11's full REQ-QUAL-04..07 enforcement; landing them now means Phases 6-9 inherit the test pattern and Phase 11's job is extending coverage rather than building from scratch.

Purpose: Phase 11 will be a cross-cutting verification phase. Pre-existing per-handler determinism/call-count tests reduce Phase 11's risk surface (any read handler that breaks determinism or N+1 spawns is caught in its own phase). REQ-QUAL-05 allowlist verification is also confirmed here as a regression check after Plans 03/04 added new bd subcommand calls.

Output:
- `tests/shadow-tests/handler-roadmap-determinism.test.sh` — bash test running shadow 5x and asserting byte-identical stdout
- `tests/shadow-tests/handler-roadmap-call-count.test.mjs` — node:test using PATH-mock bd to count spawns
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-roadmap-read-handlers/05-CONTEXT.md
@.planning/phases/05-roadmap-read-handlers/05-RESEARCH.md
@.planning/phases/05-roadmap-read-handlers/05-VALIDATION.md
@.planning/phases/05-roadmap-read-handlers/05-03-roadmap-analyze-PLAN.md
@.planning/phases/05-roadmap-read-handlers/05-04-roadmap-get-phase-PLAN.md
@bin/gsd-sdk-shadow.mjs
@tests/shadow-tests/bd-allowlist-grep.test.sh
@tests/shadow-tests/bd-helper.test.mjs
@tests/shadow-tests/seed-determinism.test.sh
@tests/fixtures/seed-fixture.sh

<interfaces>
<!-- Existing bd-allowlist-grep.test.sh structure (read full file): -->
<!-- - CASE 1: greps for canonical allowlist literal in hooks/bd-sync.sh:23 -->
<!-- - CASE 2: WARN-3 self-test (tampered copy must fail the check) -->
<!-- Plan 05 doesn't modify this file; only verifies it stays green after Plans 03/04 added bd export+memories calls. -->

<!-- bd-helper.test.mjs has a `withMockBd` helper for PATH-mocking bd binary. Pattern: -->
<!-- 1. mkdtemp + write a shim shell script as `bd` that increments a counter file -->
<!-- 2. chmod +x; PATH=tempdir:$PATH -->
<!-- 3. spawn shadow; capture spawn count from counter file -->
<!-- 4. restore PATH in finally / t.after() -->

<!-- seed-determinism.test.sh structure (Phase 4): -->
<!-- - Uses bash + diff to assert byte-equality across two seed-fixture.sh restores -->
<!-- - Same pattern Plan 05 mirrors for 5x shadow invocations -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Determinism precursor — handler-roadmap-determinism.test.sh</name>
  <files>tests/shadow-tests/handler-roadmap-determinism.test.sh</files>
  <read_first>
    - tests/shadow-tests/seed-determinism.test.sh (existing bash test pattern: setup, 2 cases, pass/fail counters, exit on summary)
    - tests/fixtures/seed-fixture.sh (the restorer; takes target dir as arg)
    - bin/gsd-sdk-shadow.mjs (after Plans 03/04 — handler exists)
  </read_first>
  <action>
    Create `tests/shadow-tests/handler-roadmap-determinism.test.sh` mirroring seed-determinism.test.sh structure:

    ```bash
    #!/usr/bin/env bash
    # handler-roadmap-determinism.test.sh — REQ-QUAL-06 precursor.
    # Asserts roadmap.analyze produces byte-identical output across 5 consecutive
    # invocations on the same fixture. Phase 11 extends this pattern to other handlers.
    set -euo pipefail

    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    SHADOW="$REPO_ROOT/bin/gsd-sdk-shadow.mjs"
    pass=0; fail=0
    _pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
    _fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

    # Fixture setup: bd-managed tempdir from seed.jsonl + .planning/phases dirs to satisfy
    # disk_status derivation (handler reads disk for has_context/has_research/disk counts).
    fixture=$(mktemp -d)
    trap 'rm -rf "$fixture"' EXIT
    bash "$REPO_ROOT/tests/fixtures/seed-fixture.sh" "$fixture" >/dev/null

    # Initialize git (required for the worktree-config milestone read in handler)
    cd "$fixture"
    git init -q
    git config user.email t@t.t
    git config user.name t
    git config extensions.worktreeConfig true   # T-04-19 mitigation
    git commit -q --allow-empty -m init
    git config --worktree gsd-beads.milestone v0.2

    # Seed phase directories so disk_status resolves
    mkdir -p .planning/phases/{01-spike,02-build-the-layer,03-findbeadsroot,04-parity-infra,05-roadmap-reads,06-cache,07-query-opt,08-state-reads,09-phase-resolution,10-init-reads,11-hook-audit}

    # CASE 1: 5x byte-identical roadmap.analyze stdout
    out1=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
    out2=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
    out3=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
    out4=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
    out5=$(node "$SHADOW" query roadmap.analyze --project-dir "$fixture" 2>/dev/null)
    if [ "$out1" = "$out2" ] && [ "$out2" = "$out3" ] && [ "$out3" = "$out4" ] && [ "$out4" = "$out5" ]; then
      _pass "CASE 1: roadmap.analyze byte-identical across 5 consecutive runs"
    else
      _fail "CASE 1: roadmap.analyze NOT byte-identical across 5 runs"
      diff <(echo "$out1") <(echo "$out2") || true
    fi

    # CASE 2: 5x byte-identical roadmap.get-phase 5
    g1=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
    g2=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
    g3=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
    g4=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
    g5=$(node "$SHADOW" query roadmap.get-phase 5 --project-dir "$fixture" 2>/dev/null)
    if [ "$g1" = "$g2" ] && [ "$g2" = "$g3" ] && [ "$g3" = "$g4" ] && [ "$g4" = "$g5" ]; then
      _pass "CASE 2: roadmap.get-phase byte-identical across 5 consecutive runs"
    else
      _fail "CASE 2: roadmap.get-phase NOT byte-identical across 5 runs"
      diff <(echo "$g1") <(echo "$g2") || true
    fi

    echo
    echo "Passed: $pass / $((pass + fail))"
    [ "$fail" -eq 0 ]
    ```

    chmod +x the file.

    Run it. Both cases MUST pass — handlers were designed for determinism via the priority/created_at/id sort (D-28).

    If a case fails: investigate non-determinism source (likely culprits: timestamp comparison ties when created_at is identical down to second; remediate by ensuring `id` tiebreaker is stable and the bd export output itself is sorted before grouping. The fixture seed has 1-second granularity created_at — id tiebreaker is the key).
  </action>
  <verify>
    <automated>chmod +x tests/shadow-tests/handler-roadmap-determinism.test.sh &amp;&amp; bash tests/shadow-tests/handler-roadmap-determinism.test.sh</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/shadow-tests/handler-roadmap-determinism.test.sh` exists, executable
    - `grep -c "CASE 1:" tests/shadow-tests/handler-roadmap-determinism.test.sh` returns >=1
    - `grep -c "CASE 2:" tests/shadow-tests/handler-roadmap-determinism.test.sh` returns >=1
    - `grep -c "5 consecutive" tests/shadow-tests/handler-roadmap-determinism.test.sh` returns >=1 (proves the 5x assertion is in place per REQ-QUAL-06 precursor language)
    - `grep -c "byte-identical\\|byte-equal" tests/shadow-tests/handler-roadmap-determinism.test.sh` returns >=1
    - `bash tests/shadow-tests/handler-roadmap-determinism.test.sh` exits 0 (both cases pass)
    - Test runtime <=10s (5×2=10 shadow invocations × ~0.5s each = ~5s; budget bound)
  </acceptance_criteria>
  <done>5x byte-identical assertion green for both roadmap.analyze and roadmap.get-phase. Determinism precursor for Phase 11 in place; protects REQ-READ-01 + REQ-READ-02 from future ordering regressions.</done>
</task>

<task type="auto">
  <name>Task 2: Call-count precursor — handler-roadmap-call-count.test.mjs</name>
  <files>tests/shadow-tests/handler-roadmap-call-count.test.mjs</files>
  <read_first>
    - tests/shadow-tests/bd-helper.test.mjs (existing PATH-mock bd pattern: `withMockBd` helper)
    - bin/gsd-sdk-shadow.mjs (after Plans 03/04 — confirms handler structure: 1x export + 1x memories for analyze; 1x export only for get-phase)
    - tests/fixtures/seed-fixture.sh (restorer)
  </read_first>
  <action>
    Create `tests/shadow-tests/handler-roadmap-call-count.test.mjs`:

    ```javascript
    // tests/shadow-tests/handler-roadmap-call-count.test.mjs
    // REQ-QUAL-07 precursor: assert each handler stays within the spawn budget
    // regardless of phase count. Uses PATH-mock bd that increments a counter.
    //
    // Budget contract (D-27):
    // - roadmap.analyze: <=2 bd spawns (1 export + 1 memories)
    // - roadmap.get-phase: <=1 bd spawn (1 export; no memories needed)

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { execSync, spawnSync } from 'node:child_process';
    import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, chmodSync, existsSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join, dirname } from 'node:path';
    import { fileURLToPath } from 'node:url';

    const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');
    const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

    /**
     * Build a PATH-mock bd shim that:
     *   - increments a counter file on every invocation
     *   - delegates to the real bd binary (so handler logic still works)
     * Returns { mockDir, counterFile, restore }.
     */
    function withMockBd(t) {
      const mockDir = mkdtempSync(join(tmpdir(), 'gsd-bd-mock-'));
      const counterFile = join(mockDir, 'counter');
      writeFileSync(counterFile, '0\n');
      const realBd = execSync('which bd', { encoding: 'utf-8' }).trim();
      const shim = `#!/usr/bin/env bash
    set -euo pipefail
    # Increment counter (exclusive lock to avoid races on parallel calls)
    {
      flock 9
      n=$(cat "${counterFile}")
      echo $((n + 1)) > "${counterFile}"
    } 9>"${counterFile}.lock"
    exec "${realBd}" "$@"
    `;
      const shimPath = join(mockDir, 'bd');
      writeFileSync(shimPath, shim);
      chmodSync(shimPath, 0o755);
      const oldPath = process.env.PATH;
      process.env.PATH = `${mockDir}:${oldPath}`;
      t.after(() => {
        process.env.PATH = oldPath;
        rmSync(mockDir, { recursive: true, force: true });
      });
      return { mockDir, counterFile };
    }

    function readCount(counterFile) {
      return parseInt(readFileSync(counterFile, 'utf-8').trim(), 10);
    }

    function setupBdFixture(t) {
      const dir = mkdtempSync(join(tmpdir(), 'gsd-callcount-'));
      execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${dir}`, { stdio: 'pipe' });
      execSync('git init -q', { cwd: dir });
      execSync('git config user.email t@t.t', { cwd: dir });
      execSync('git config user.name t', { cwd: dir });
      execSync('git config extensions.worktreeConfig true', { cwd: dir });
      execSync('git commit -q --allow-empty -m init', { cwd: dir });
      execSync('git config --worktree gsd-beads.milestone v0.2', { cwd: dir });
      const phasesDir = join(dir, '.planning', 'phases');
      mkdirSync(phasesDir, { recursive: true });
      // Mirror the 11 phase dirs from build-seed.sh
      const dirs = ['01-spike','02-build-the-layer','03-findbeadsroot','04-parity-infra','05-roadmap-reads','06-cache','07-query-opt','08-state-reads','09-phase-resolution','10-init-reads','11-hook-audit'];
      for (const d of dirs) mkdirSync(join(phasesDir, d), { recursive: true });
      t.after(() => rmSync(dir, { recursive: true, force: true }));
      return dir;
    }

    function runShadow(args, dir) {
      // Run with the mocked PATH already set on process.env
      return spawnSync('node', [SHADOW, ...args], { encoding: 'utf-8', cwd: dir, env: { ...process.env } });
    }

    test('call-count CASE 1: roadmap.analyze invokes bd <=2 times on 11-phase fixture', (t) => {
      const fixture = setupBdFixture(t);
      const { counterFile } = withMockBd(t);
      const before = readCount(counterFile);
      const result = runShadow(['query', 'roadmap.analyze', '--project-dir', fixture], fixture);
      assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
      const after = readCount(counterFile);
      const calls = after - before;
      assert.ok(calls <= 2, `expected <=2 bd spawns, got ${calls} (REQ-QUAL-07 budget)`);
      assert.ok(calls >= 1, `expected >=1 bd spawn (sanity: handler must call bd at least once), got ${calls}`);
    });

    test('call-count CASE 2: roadmap.get-phase invokes bd <=1 time on 11-phase fixture', (t) => {
      const fixture = setupBdFixture(t);
      const { counterFile } = withMockBd(t);
      const before = readCount(counterFile);
      const result = runShadow(['query', 'roadmap.get-phase', '5', '--project-dir', fixture], fixture);
      assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
      const after = readCount(counterFile);
      const calls = after - before;
      assert.ok(calls <= 1, `expected <=1 bd spawn, got ${calls} (REQ-QUAL-07 budget; get-phase needs no memories)`);
      assert.ok(calls >= 1, `expected >=1 bd spawn (sanity: handler must call bd), got ${calls}`);
    });

    test('call-count CASE 3: roadmap.analyze call count does NOT scale with phase count', (t) => {
      // Phase count check: same 11-phase fixture vs the call count assertion.
      // If a future regression introduces N+1 spawns (e.g., per-phase bd children call),
      // CASE 1 catches it because count would be 2 + N where N=11 -> count=13 > 2.
      // This case is documentary — the assertion is identical to CASE 1 but with explicit
      // commentary that REQ-QUAL-07 budget is constant in phase count.
      const fixture = setupBdFixture(t);
      const { counterFile } = withMockBd(t);
      const before = readCount(counterFile);
      runShadow(['query', 'roadmap.analyze', '--project-dir', fixture], fixture);
      const after = readCount(counterFile);
      assert.equal(after - before, 2, `expected exactly 2 bd spawns (export + memories), got ${after - before}`);
    });
    ```

    Run the test. All cases must pass — Plans 03/04 implementations have:
    - roadmap.analyze: 1x bd export + 1x bd memories = 2 spawns
    - roadmap.get-phase: 1x bd export only = 1 spawn

    If a case fails (count > budget): the handler has unintended fan-out. Locate the offending bd() call and remove it (likely a refactor regression).

    If a case fails (count = 0): the PATH mock isn't being picked up — verify the shim is executable and PATH ordering.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/handler-roadmap-call-count.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/shadow-tests/handler-roadmap-call-count.test.mjs` exists with >=3 `test(` calls
    - `grep -c "withMockBd" tests/shadow-tests/handler-roadmap-call-count.test.mjs` returns >=1 (PATH-mock helper present)
    - `grep -c "<= 2" tests/shadow-tests/handler-roadmap-call-count.test.mjs` returns >=1 (budget bound for analyze)
    - `grep -c "<= 1" tests/shadow-tests/handler-roadmap-call-count.test.mjs` returns >=1 (budget bound for get-phase)
    - `node --test tests/shadow-tests/handler-roadmap-call-count.test.mjs` exits 0 (3/3 cases pass)
    - The test does NOT modify production code; only verifies handler call counts via PATH-mocking
    - Test runtime <=10s
  </acceptance_criteria>
  <done>Call-count budget enforcement green for both handlers. Phase 11 precursor in place; the test catches future N+1 regressions before they ship; protects REQ-READ-01 + REQ-READ-02.</done>
</task>

<task type="auto">
  <name>Task 3: Verify allowlist + full suite green (no new code; regression check)</name>
  <files></files>
  <read_first>
    - tests/shadow-tests/bd-allowlist-grep.test.sh (existing — Phase 4 wrote this)
    - bin/gsd-sdk-shadow.mjs (after Plans 03/04 — handlers use only export+memories)
  </read_first>
  <action>
    This task adds NO new code. It runs the full test matrix and confirms zero regression. The point: Plan 05 closing-out asserts the entire Phase 5 deliverable is green and the bd allowlist is intact.

    Run sequence:

    1. `bash tests/shadow-tests/bd-allowlist-grep.test.sh` — must exit 0 (REQ-QUAL-05 precursor)
    2. `bash tests/shadow-tests/seed-determinism.test.sh` — must exit 0 (Phase 4 fixture determinism still holds)
    3. `bash tests/install-tests/upstream-version-pin.test.sh` — must exit 0 (lockfile gate)
    4. `node --test tests/shadow-tests/*.test.mjs` — must exit 0 (full mjs suite)
    5. `node --test tests/fixtures/memories-seeded.test.mjs` — must exit 0 (Plan 01 deliverable)
    6. `bash tests/shadow-tests/handler-roadmap-determinism.test.sh` — must exit 0 (Task 1)
    7. Verify no new `bd` subcommand has crept in via grep:
       ```bash
       # Allowed bd subcommands in production code (read-only allowlist):
       allowed='list|show|ready|memories|status|prime|export|deps|children|search|help|version'
       # Find all bd invocations in bin/gsd-sdk-shadow.mjs (excluding comments)
       grep -n "bd(\\['" bin/gsd-sdk-shadow.mjs | grep -v '^//' | tee /tmp/bdcalls.log
       # Manually verify each call in /tmp/bdcalls.log uses an allowed subcommand
       ```
       Expected calls: `bd(['export', '--json'], ...)` (in beadsRoadmapAnalyze and beadsRoadmapGetPhase) and `bd(['memories', '--json'], ...)` (in beadsRoadmapAnalyze).
       NO calls to `bd close`, `bd update`, `bd add`, `bd q`, `bd link`, `bd label add`, `bd label remove`, `bd init` (those exist in build-seed.sh which is NOT a read handler — the allowlist applies only to bin/gsd-sdk-shadow.mjs read overrides).

       The 13 mutation handlers in BEADS_OVERRIDES (`phase.add`, etc.) DO use write-side bd subcommands (`bd q`, `bd close`, `bd label add`, etc.) — those are mutation-side and the allowlist contract per CONTEXT.md D-29 applies to READ handlers only. The bd-allowlist-grep test asserts the canonical string at hooks/bd-sync.sh:23 is intact (the source of truth); per-read-handler enforcement is Phase 11.
  </action>
  <verify>
    <automated>bash tests/shadow-tests/bd-allowlist-grep.test.sh &amp;&amp; bash tests/shadow-tests/seed-determinism.test.sh &amp;&amp; bash tests/install-tests/upstream-version-pin.test.sh &amp;&amp; node --test tests/shadow-tests/*.test.mjs &amp;&amp; node --test tests/fixtures/memories-seeded.test.mjs &amp;&amp; bash tests/shadow-tests/handler-roadmap-determinism.test.sh &amp;&amp; node --test tests/shadow-tests/handler-roadmap-call-count.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - bd-allowlist-grep.test.sh: 2/2 cases pass
    - seed-determinism.test.sh: 2/2 cases pass (with new 11-phase / 24-plan counts from Plan 01)
    - upstream-version-pin.test.sh: 2/2 cases pass
    - Full mjs suite: all tests pass (count includes Phase 4 baseline minus deleted _phase4-test-stub plus 4 helper test files plus 2 handler-roadmap-analyze test files plus 4 handler-roadmap-analyze sibling files plus 2 handler-roadmap-get-phase files plus 1 call-count file plus the existing 9 mutation handler files; expect ~25-30 mjs files total exiting 0)
    - memories-seeded.test.mjs: 3/3 cases pass
    - handler-roadmap-determinism.test.sh: 2/2 cases pass
    - handler-roadmap-call-count.test.mjs: 3/3 cases pass
    - Manual grep of bin/gsd-sdk-shadow.mjs read-handler bd calls confirms only `export, memories` subcommands used (allowlist subset)
  </acceptance_criteria>
  <done>Full Phase 5 deliverable green: 5 plans, all wave dependencies satisfied, all tests pass, allowlist intact, determinism + call-count precursors in place for Phase 11.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PATH-mock bd shim | Local-only test artifact; no privilege boundary crossed. The real bd binary delegate is `which bd` resolved at test runtime. |
| Counter file | tempdir-local file; no cross-test interference (each test creates its own mockDir via mkdtempSync) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-10 | Tampering | PATH-mock bd shim race condition | mitigate | flock on counter file inside the shim ensures atomic increment under parallel calls (rare but possible if a future test parallelizes shadow invocations) |
| T-05-11 | DoS | Determinism test running 10 shadow invocations | accept | Total runtime ~5-10s; well within CI budget. Phase 11 will extend to 5x×N-handlers — still acceptable. |
</threat_model>

<verification>
After all 3 tasks:
- 7 test runners green: bd-allowlist-grep, seed-determinism, upstream-version-pin, full mjs suite, memories-seeded, handler-roadmap-determinism, handler-roadmap-call-count
- Phase 5 deliverable complete: 5 plans + all REQ-READ-01..02 + SC #1..5 + D-01..D-29 honored
- Phase 11 precursors in place: determinism (5x byte-identical) + call-count (<=2 spawns) tests for both handlers
- Phase 6 inheritance ready: progress.* handlers will reuse the test patterns established here
</verification>

<success_criteria>
- All 7 test runners green (no new failures introduced; no regression from Plan 04 GREEN state)
- Phase 5 deliverable: REQ-READ-01 satisfied (Plan 03), REQ-READ-02 satisfied (Plan 04), 5 ROADMAP SC met, all 29 CONTEXT decisions honored, Phase 11 precursor tests landed
- Allowlist intact: bd subcommands in read handlers limited to `export, memories` (subset of canonical allowlist)
- Determinism precursor green: roadmap.analyze + roadmap.get-phase produce byte-identical output across 5 consecutive runs
- Call-count precursor green: <=2 spawns for analyze, <=1 spawn for get-phase, regardless of phase count
</success_criteria>

<output>
After completion, create `.planning/phases/05-roadmap-read-handlers/05-05-SUMMARY.md` documenting:
- 7 test runners status (all green at phase exit)
- Determinism test design (5x byte-identical assertion + diff fallback for debugging failures)
- Call-count test design (PATH-mock bd with flock-protected counter file)
- Phase 11 inheritance: per-handler tests serve as templates; Phase 11 extends coverage to other read handlers as Phase 6/7/8/9 ship
- REQ-QUAL-05 allowlist sanity check: confirmed export+memories are within the canonical allowlist; bd-allowlist-grep.test.sh remains the source-of-truth gate at hooks/bd-sync.sh:23

This SUMMARY closes Phase 5. /gsd-verify-work runs next.
</output>
</content>
</invoke>