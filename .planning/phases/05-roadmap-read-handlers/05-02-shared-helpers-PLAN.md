---
phase: 05-roadmap-read-handlers
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - bin/gsd-sdk-shadow.mjs
  - tests/shadow-tests/_parity-helpers.mjs
  - tests/shadow-tests/helpers-parsePhaseId.test.mjs
  - tests/shadow-tests/helpers-deriveDiskStatus.test.mjs
  - tests/shadow-tests/helpers-detectDrift.test.mjs
  - tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs
  - tests/shadow-tests/_parity-helpers.test.mjs
autonomous: true
requirements: [REQ-READ-01, REQ-READ-02]
tags:
  - helpers
  - parity-extension
  - parsePhaseId
  - deriveDiskStatus
  - detectDrift
  - loadMilestoneHeading

key_decisions:
  - "Q3 Option B: Add new function `assertKeySetParityWithExt(actual, snapshot, extensions, path = '')` to _parity-helpers.mjs. Non-breaking: existing `assertKeySetParity` callers (Phase 4 stub test, future phases) keep working. Phase 5 handler tests use the new function with `extensions: ['drift']`. Option A (mutate signature) was rejected because it risks subtle breakage if any test passes `path` positionally. Option C (module-level export) was rejected because per-call extension lists are clearer than a global one."
  - "All 4 helpers live in bin/gsd-sdk-shadow.mjs (NOT a new bin/roadmap-helpers.mjs file). Rationale: the helpers are <40 LOC total; pulling them into a new module adds an import for marginal cohesion gain. The module already exceeds 400 LOC but stays readable; Phase 6+ can refactor if call sites multiply."
  - "summary_count derives from `bd children <phase> -l gsd:plan --status=closed` count per refined D-06 (commit 7feccb8). Drift kind `summary_count` stays LIVE: detectDrift compares the bd closed-plan count against the disk `*-SUMMARY.md` count and emits a drift entry when they diverge. This honors the 'bd is source of truth' principle (cascade-loop auto-closes plan beads when their child tasks complete) while alerting users to filesystem inconsistencies. Plan 02 helper-detectDrift.test.mjs exercises a fixture variant where bd has 2 closed plan beads and disk has 1 SUMMARY.md → drift entry emitted with kind='summary_count', bd_value=2, disk_value=1."
  - "Plan 02 supplies the substrate for both REQ-READ-01 (parsePhaseId/deriveDiskStatus/detectDrift/loadMilestoneHeading consumed by beadsRoadmapAnalyze) and REQ-READ-02 (same helpers consumed by beadsRoadmapGetPhase) — these helpers are the shared substrate for both read handlers."

  Decision References:
  - D-05: Full 7-value disk_status enum — deriveDiskStatus emits complete | partial | planned | empty | discussed | researched | no_directory (no bd-backend divergence; 4-value collapse rejected per REQ-QUAL-01 parity).
  - D-09: Drift surfaces via TWO channels — (1) stderr line per drift case: `[gsd-shadow] DRIFT: phase N plan_count bd=X disk=Y`; (2) drift[] array in response data. detectDrift implements both channels; Plan 03 handler wires detectDrift into the emitted response.
  - D-13: _parity-helpers whitelist (extension keys) — assertKeySetParityWithExt is the new export that whitelists drift[] as a bd-backend-only key present in actual but absent from upstream snapshot. This plan implements the API and adds CASEs 7-8 to _parity-helpers.test.mjs.
  - D-16: Milestone heading sourced from bd memory key gsd-beads:milestone:<version>:heading — loadMilestoneHeading reads memories[key]; fallback to bare version string when absent (D-17 path). Plan 03 handler calls loadMilestoneHeading once per milestone entry.

must_haves:
  truths:
    - "parsePhaseId('phase-id:05') returns '5'; parsePhaseId('phase-id:72.1') returns '72.1'; parsePhaseId(null/undefined) returns null"
    - "deriveDiskStatus returns the correct enum value across all 7 priority cases (D-07): no_directory, complete, partial, planned, researched, discussed, empty"
    - "detectDrift emits exactly 4 drift kinds (plan_count, summary_count, closed_without_summary, completed_phases_mismatch) and skips natural asymmetries per D-11; the `summary_count` drift kind is LIVE per refined D-06 (compares bd closed-plan count vs disk SUMMARY.md count)"
    - "loadMilestoneHeading returns 'Milestone v0.2 — Beads-backed reads' when memory exists; 'v0.2' (bare) when absent + emits stderr note per D-17"
    - "_parity-helpers.mjs exports assertKeySetParityWithExt(actual, snapshot, extensions, path = ''); existing assertKeySetParity export is untouched (backwards compatible)"
  artifacts:
    - path: "bin/gsd-sdk-shadow.mjs"
      provides: "parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading exported for use by handlers in Plans 03/04"
      contains: "function parsePhaseId"
    - path: "tests/shadow-tests/_parity-helpers.mjs"
      provides: "assertKeySetParityWithExt new export"
      contains: "assertKeySetParityWithExt"
    - path: "tests/shadow-tests/helpers-parsePhaseId.test.mjs"
      provides: "Coverage of D-02 padding-strip + decimal preservation"
    - path: "tests/shadow-tests/helpers-deriveDiskStatus.test.mjs"
      provides: "7 priority cases covered (D-07)"
    - path: "tests/shadow-tests/helpers-detectDrift.test.mjs"
      provides: "4 drift kinds + natural-asymmetry exclusions (D-10/D-11) + LIVE summary_count divergence case (refined D-06)"
    - path: "tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs"
      provides: "Memory-hit + fallback paths (D-15..D-17)"
  key_links:
    - from: "bin/gsd-sdk-shadow.mjs (helpers section)"
      to: "Plan 03/04 handler bodies"
      via: "internal export + same-module function call"
      pattern: "function (parsePhaseId|deriveDiskStatus|detectDrift|loadMilestoneHeading)"
    - from: "tests/shadow-tests/_parity-helpers.mjs"
      to: "Plan 03/04 handler-roadmap-*.test.mjs"
      via: "ES module import"
      pattern: "assertKeySetParityWithExt"
---

<objective>
Add the four shared helper functions (`parsePhaseId`, `deriveDiskStatus`, `detectDrift`, `loadMilestoneHeading`) into `bin/gsd-sdk-shadow.mjs` and extend `tests/shadow-tests/_parity-helpers.mjs` with `assertKeySetParityWithExt`. Each helper gets its own `node:test` file (red→green Wave 0).

Purpose: Plan 03 (`roadmap.analyze`) and Plan 04 (`roadmap.get-phase`) both consume these helpers. Extracting them as named functions lets tests cover them in isolation (faster feedback than going through the full handler). The `assertKeySetParityWithExt` extension lets handler tests whitelist `drift[]` as a bd-backend-only key without contaminating the existing `assertKeySetParity` API.

Output:
- `bin/gsd-sdk-shadow.mjs` — adds 4 helper functions (~50 LOC inserted near the top of the file before the handler bodies)
- `tests/shadow-tests/_parity-helpers.mjs` — adds 1 new function, ~10 LOC
- 4 new helper test files + 1 extended _parity-helpers test
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/05-roadmap-read-handlers/05-CONTEXT.md
@.planning/phases/05-roadmap-read-handlers/05-RESEARCH.md
@.planning/phases/05-roadmap-read-handlers/05-VALIDATION.md
@bin/gsd-sdk-shadow.mjs
@tests/shadow-tests/_parity-helpers.mjs
@tests/shadow-tests/_parity-helpers.test.mjs

<interfaces>
<!-- Existing _parity-helpers.mjs exports (read tests/shadow-tests/_parity-helpers.mjs first): -->
```javascript
export function assertKeySetParity(actual, snapshot, path = '') { /* ... */ }
export function assertTypeParity(actual, snapshot, path = '') { /* ... */ }
```
<!-- The new export we add — non-breaking. Recurses with the extension list ignored after root. -->
<!-- (Or applied at every level if Phase 6+ needs nested extensions — but for v0.2, drift[] is only at root.) -->

<!-- Existing bin/gsd-sdk-shadow.mjs structure (read full file before editing): -->
<!-- Imports: existsSync, realpathSync, statSync, readFileSync, dirname, join, resolve, fileURLToPath, spawnSync, execSync, BeadsUnavailableError, BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty, bd, wrapMutation, GSDEvent, createRegistry, resolveQueryArgv, extractField -->
<!-- BEADS_OVERRIDES table: 13 mutation handlers (line 214) -->
<!-- findBeadsRoot: line 236 -->
<!-- BEADS_READ_OVERRIDES: line 287 (currently empty + env-gated stub) -->
<!-- main(): line 316 -->

<!-- Helpers go between findBeadsRoot (line 281) and BEADS_READ_OVERRIDES (line 287). -->
<!-- They are module-level so they're importable by tests. Use `export` keyword. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — Write failing tests for all 4 helpers + parity-helpers extension</name>
  <files>
    tests/shadow-tests/helpers-parsePhaseId.test.mjs,
    tests/shadow-tests/helpers-deriveDiskStatus.test.mjs,
    tests/shadow-tests/helpers-detectDrift.test.mjs,
    tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs,
    tests/shadow-tests/_parity-helpers.test.mjs
  </files>
  <read_first>
    - bin/gsd-sdk-shadow.mjs (current exports — confirm we'll add `export function parsePhaseId`, etc.)
    - tests/shadow-tests/_parity-helpers.test.mjs (existing 6-case structure to extend with 1 new case)
    - tests/shadow-tests/_parity-helpers.mjs (existing structure)
    - tests/shadow-tests/handler-_phase4-test-stub.test.mjs (test pattern with t.after() teardown)
    - .planning/phases/05-roadmap-read-handlers/05-RESEARCH.md (helper signatures + behavior contracts)
  </read_first>
  <behavior>
    **helpers-parsePhaseId.test.mjs (D-02):**
    - Test 1: parsePhaseId('phase-id:05') === '5'
    - Test 2: parsePhaseId('phase-id:5') === '5'
    - Test 3: parsePhaseId('phase-id:72.1') === '72.1' (decimal preserved)
    - Test 4: parsePhaseId('phase-id:100') === '100' (3-digit)
    - Test 5: parsePhaseId(null) === null AND parsePhaseId(undefined) === null
    - Test 6: parsePhaseId('not-a-phase-label') === 'not-a-phase-label' (no `phase-id:` prefix → stripped only by replace, returns input minus padding strip — verify expected behavior matches research §parsePhaseId implementation)

    **helpers-deriveDiskStatus.test.mjs (D-07):**
    Cover all 7 priority cases:
    - Test 1: dirExists=false → 'no_directory' (regardless of other inputs)
    - Test 2: planCount=2, summaryCount=2 → 'complete' (summaryCount >= planCount && planCount > 0)
    - Test 3: planCount=2, summaryCount=1 → 'partial' (summaryCount > 0 but < planCount)
    - Test 4: planCount=2, summaryCount=0 → 'planned' (planCount > 0, no summaries)
    - Test 5: planCount=0, hasResearch=true → 'researched'
    - Test 6: planCount=0, hasResearch=false, hasContext=true → 'discussed'
    - Test 7: planCount=0, hasResearch=false, hasContext=false, dirExists=true → 'empty'
    - Test 8 (priority order): planCount=2, summaryCount=2, hasContext=true, hasResearch=true → 'complete' (priority 1 wins)

    **helpers-detectDrift.test.mjs (D-10..D-12 + refined D-06):**
    - Test 1: bd.plan_count === disk.disk_plan_count → no drift entry, no stderr
    - Test 2 (plan_count drift): bd.plan_count=3, disk.disk_plan_count=2 → 1 drift entry { kind: 'plan_count', bd_value: 3, disk_value: 2 } + stderr line matching `/DRIFT: phase 5 plan_count bd=3 disk=2/`
    - Test 3 (LIVE summary_count divergence — refined D-06): Construct inputs where bd has 2 closed gsd:plan children for the phase and disk has 1 *-SUMMARY.md file. Call detectDrift with bd_summary_count=2, disk_summary_count=1. Assert exactly 1 drift entry { kind: 'summary_count', bd_value: 2, disk_value: 1 } + stderr line matching `/DRIFT: phase 5 summary_count bd=2 disk=1/`. **This proves the summary_count branch is real, NOT dead code.**
    - Test 4 (closed_without_summary): bd.bd_status='closed', disk.disk_summary_count=0 → 1 entry { kind: 'closed_without_summary' }
    - Test 5 (D-11 natural asymmetry): bd.plan_count=0, disk.disk_plan_count=0, bd.bd_status='open' → empty drift array even if dir absent (handler skips dir-absent case for open phases — but detectDrift itself is dumb; the handler is responsible for guarding the call. Test that detectDrift emits NO entry when both counts equal regardless of bd_status)
    - Test 6 (multiple kinds in one call): all 3 single-phase drift conditions firing simultaneously (plan_count diverge + summary_count diverge + closed_without_summary) → array length 3
    Use a stderr capture helper: spawn the test with a child process that imports the function and writes JSON.stringify(detectDrift(...)) to stdout; assert stderr regex separately. OR mock console.error with t.mock.method to avoid the spawn.
    Recommended: use `t.mock.method(console, 'error', () => {})` from node:test mocking API to capture calls without spawning.

    **helpers-loadMilestoneHeading.test.mjs (D-15..D-17):**
    - Test 1: memories = { 'gsd-beads:milestone:v0.2:heading': 'Beads-backed reads' }, version = 'v0.2' → returns 'Milestone v0.2 — Beads-backed reads'
    - Test 2: memories = {}, version = 'v0.3' → returns 'v0.3' (bare fallback) AND emits stderr containing 'no milestone heading memory for v0.3'
    - Test 3: memories has unrelated key, version = 'v0.4' → bare fallback (matches Test 2 pattern)
    - Test 4 (idempotency): calling 2× with same args returns identical result both times
    Mock console.error similarly.

    **_parity-helpers.test.mjs (D-13 — extend existing 6 cases by 1):**
    Add CASE 7: assertKeySetParityWithExt accepts an extensions array and silently allows actual to have those keys when snapshot does not.
    ```javascript
    test('CASE 7: assertKeySetParityWithExt allows whitelisted bd-only keys (drift)', () => {
      const snapshot = { phases: [], phase_count: 0 };
      const actual = { phases: [], phase_count: 0, drift: [], backend: 'beads' };
      // Should NOT throw — both `drift` and `backend` are extensions
      assert.doesNotThrow(() => assertKeySetParityWithExt(actual, snapshot, ['drift', 'backend']));
    });
    test('CASE 8: assertKeySetParityWithExt still catches non-whitelisted missing keys', () => {
      const snapshot = { phases: [], phase_count: 0, milestones: [] };
      const actual = { phases: [], phase_count: 0, drift: [] };  // missing milestones (NOT an extension)
      assert.throws(
        () => assertKeySetParityWithExt(actual, snapshot, ['drift']),
        /missing keys.*milestones/
      );
    });
    ```
  </behavior>
  <action>
    Create the 4 helper test files + extend _parity-helpers.test.mjs (do not modify existing CASEs 1-6):

    Each helper test file imports from `bin/gsd-sdk-shadow.mjs`:
    ```javascript
    import { parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading } from '../../bin/gsd-sdk-shadow.mjs';
    ```

    For tests that need stderr capture, use node:test's mocking API:
    ```javascript
    import { mock } from 'node:test';
    test('detectDrift CASE X', (t) => {
      const errLogs = [];
      t.mock.method(console, 'error', (msg) => errLogs.push(msg));
      const result = detectDrift('5', { plan_count: 3, ...}, { disk_plan_count: 2, ...});
      assert.equal(result.length, 1);
      assert.match(errLogs[0], /DRIFT: phase 5 plan_count bd=3 disk=2/);
    });
    ```

    Per D-26 (red phase): all 4 helper tests fail at end of Task 1 (functions not yet exported from shadow). _parity-helpers.test.mjs CASEs 7-8 also fail (assertKeySetParityWithExt does not exist yet).

    **Critical:** Do NOT modify existing _parity-helpers.test.mjs CASEs 1-6. Append CASEs 7-8 at the end of the file. Verify pre-existing 6/6 still pass alongside the new 2 expected-fail cases by running `node --test tests/shadow-tests/_parity-helpers.test.mjs` and counting "fail 2" exactly.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/helpers-parsePhaseId.test.mjs tests/shadow-tests/helpers-deriveDiskStatus.test.mjs tests/shadow-tests/helpers-detectDrift.test.mjs tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs tests/shadow-tests/_parity-helpers.test.mjs 2>&amp;1 | tail -30 | tee /tmp/v.log; ! grep -q "fail 0$" /tmp/v.log</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/shadow-tests/helpers-parsePhaseId.test.mjs` exists with ≥6 `test(` calls
    - File `tests/shadow-tests/helpers-deriveDiskStatus.test.mjs` exists with ≥7 `test(` calls (one per D-07 priority case + 1 priority-order case)
    - File `tests/shadow-tests/helpers-detectDrift.test.mjs` exists with ≥6 `test(` calls
    - `grep -c "kind: 'summary_count'" tests/shadow-tests/helpers-detectDrift.test.mjs` returns ≥1 (proves the LIVE summary_count branch is exercised per refined D-06)
    - File `tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs` exists with ≥4 `test(` calls
    - `tests/shadow-tests/_parity-helpers.test.mjs` has 2 NEW test cases (CASE 7, CASE 8); pre-existing 6 cases unchanged
    - At Task 1 completion (red phase): running all 5 files together produces ≥4 failures (the 4 helper tests fail because functions not yet exported; _parity-helpers.test.mjs has 2 new failures for CASE 7-8). The 6 pre-existing _parity-helpers cases still pass.
    - `grep -v '^//' tests/shadow-tests/helpers-parsePhaseId.test.mjs | grep -c "import.*parsePhaseId.*from.*gsd-sdk-shadow"` returns ≥1 (proves the test imports from the production module, not a copy)
  </acceptance_criteria>
  <done>5 test files created/extended; running them produces a deterministic red signal (≥4 helper-related failures + 2 _parity-helpers failures, with pre-existing 6 _parity-helpers cases still green). The test scaffolding is the contract Task 2 implements against. detectDrift summary_count CASE is LIVE per refined D-06.</done>
</task>

<task type="auto">
  <name>Task 2: Implement helpers in shadow + extend _parity-helpers, turn all tests green</name>
  <files>bin/gsd-sdk-shadow.mjs, tests/shadow-tests/_parity-helpers.mjs</files>
  <read_first>
    - bin/gsd-sdk-shadow.mjs (current full file; identify insertion point between findBeadsRoot ending at line 281 and BEADS_READ_OVERRIDES at line 287)
    - tests/shadow-tests/_parity-helpers.mjs (current 33 LOC, identify where to add new function)
    - All 5 test files written in Task 1 (their assertions ARE the contract)
    - .planning/phases/05-roadmap-read-handlers/05-RESEARCH.md (lines 380-460: exact helper bodies as research-recommended)
  </read_first>
  <action>
    **Step A — Insert 4 helpers into `bin/gsd-sdk-shadow.mjs`:**

    Insertion location: between `findBeadsRoot` (ends at line 281) and the comment block starting `// ─── BEADS_READ_OVERRIDES table` (line 283). Add a new comment header section:

    ```javascript
    // ─── Phase 5 read-handler shared helpers ───────────────────────────────────
    // D-02 / D-07 / D-10..D-12 / D-15..D-17. Used by beadsRoadmapAnalyze and
    // beadsRoadmapGetPhase (Plans 03/04). Exported so tests cover them directly.

    /**
     * D-02: Strip "phase-id:" prefix and zero-padding; preserve decimal segments.
     * @param {string|null|undefined} label - e.g. "phase-id:05" or "phase-id:72.1"
     * @returns {string|null} - e.g. "5" or "72.1" or null
     */
    export function parsePhaseId(label) {
      if (!label) return null;
      return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
    }

    /**
     * D-07: 7-value disk_status enum priority chain.
     * planCount/summaryCount come from bd (D-06); hasContext/hasResearch from disk.
     * Priority: no_directory → complete → partial → planned → researched → discussed → empty.
     */
    export function deriveDiskStatus({ planCount, summaryCount, hasContext, hasResearch, dirExists }) {
      if (!dirExists) return 'no_directory';
      if (planCount > 0 && summaryCount >= planCount) return 'complete';
      if (summaryCount > 0) return 'partial';
      if (planCount > 0) return 'planned';
      if (hasResearch) return 'researched';
      if (hasContext) return 'discussed';
      return 'empty';
    }

    /**
     * D-09/D-10 + refined D-06: Drift kinds — plan_count, summary_count, closed_without_summary.
     * Aggregate kind `completed_phases_mismatch` is computed at handler-level (post-loop), not here.
     *
     * Per refined D-06 (commit 7feccb8): summary_count is LIVE — bd's "summarized plan count"
     * (closed gsd:plan children) is compared against disk *-SUMMARY.md count. The handler
     * MUST pass distinct bd_summary_count and disk_summary_count values for this comparison
     * to be meaningful (do NOT pass the same value for both).
     *
     * Emits stderr line per drift case (D-09 channel 1) and returns array (channel 2).
     *
     * @param {string} phase - phase number (e.g. "5")
     * @param {{plan_count:number, summary_count:number, bd_status:string}} bdState - bd-derived counts (summary_count = closed gsd:plan child count)
     * @param {{disk_plan_count:number, disk_summary_count:number}} diskState - filesystem-derived counts
     */
    export function detectDrift(phase, bdState, diskState) {
      const entries = [];
      if (bdState.plan_count !== diskState.disk_plan_count) {
        console.error(`[gsd-shadow] DRIFT: phase ${phase} plan_count bd=${bdState.plan_count} disk=${diskState.disk_plan_count}`);
        entries.push({ phase, kind: 'plan_count', bd_value: bdState.plan_count, disk_value: diskState.disk_plan_count });
      }
      if (bdState.summary_count !== diskState.disk_summary_count) {
        console.error(`[gsd-shadow] DRIFT: phase ${phase} summary_count bd=${bdState.summary_count} disk=${diskState.disk_summary_count}`);
        entries.push({ phase, kind: 'summary_count', bd_value: bdState.summary_count, disk_value: diskState.disk_summary_count });
      }
      if (bdState.bd_status === 'closed' && diskState.disk_summary_count === 0) {
        console.error(`[gsd-shadow] DRIFT: phase ${phase} closed_without_summary`);
        entries.push({ phase, kind: 'closed_without_summary', bd_value: 'closed', disk_value: 0 });
      }
      return entries;
    }

    /**
     * D-15..D-17: Format milestone heading from bd memory or fall back to bare version.
     * Heading format mirrors upstream's milestonePattern capture: "Milestone <version> — <heading>".
     * Logs a stderr note exactly once per call when the memory is absent (D-17).
     */
    export function loadMilestoneHeading(memories, version) {
      const key = `gsd-beads:milestone:${version}:heading`;
      const heading = memories?.[key];
      if (heading) {
        return `Milestone ${version} — ${heading}`;
      }
      console.error(`[gsd-shadow] note: no milestone heading memory for ${version}`);
      return version;
    }
    ```

    **Step B — Add `assertKeySetParityWithExt` to `tests/shadow-tests/_parity-helpers.mjs`:**

    Append (do NOT modify the existing 2 functions):

    ```javascript
    /**
     * D-13: Like assertKeySetParity but tolerates `extensions` keys present in
     * actual but absent from snapshot. Used by Phase 5+ handler tests to whitelist
     * bd-backend-only keys (e.g., 'drift', 'backend') without contaminating the
     * upstream parity contract.
     *
     * @param {object} actual    - object under test (handler output)
     * @param {object} snapshot  - reference shape captured from upstream
     * @param {string[]} extensions - keys allowed to appear in actual but not snapshot
     * @param {string} [path]    - dotted path for error messages
     */
    export function assertKeySetParityWithExt(actual, snapshot, extensions = [], path = '') {
      if (snapshot === null) return;
      const here = path || '<root>';
      if (actual === null) throw new Error(`parity: ${here} snapshot has type ${typeof snapshot}, actual is null`);
      if (typeof actual !== 'object' || typeof snapshot !== 'object') return;
      if (Array.isArray(snapshot)) {
        if (!Array.isArray(actual)) throw new Error(`parity: ${here} snapshot is array, actual is ${typeof actual}`);
        if (snapshot.length > 0 && actual.length > 0) assertKeySetParityWithExt(actual[0], snapshot[0], extensions, `${path}[0]`);
        return;
      }
      // Snapshot is a plain object: every snapshot key must exist in actual (extensions don't apply this direction)
      const missing = Object.keys(snapshot).filter((k) => !Object.keys(actual).includes(k));
      if (missing.length > 0) throw new Error(`parity: ${here} missing keys: ${missing.join(', ')}`);
      // Recurse on shared keys; extensions in actual that aren't in snapshot are silently allowed
      for (const k of Object.keys(snapshot)) assertKeySetParityWithExt(actual[k], snapshot[k], extensions, `${path}.${k}`);
    }
    ```

    **Critical decisions reflected in the implementation:**
    - `extensions` is a flat list applied at every nesting level (simplest semantics; Phase 6+ can scope per-level if needed)
    - Empty `extensions` default makes the function semantically identical to `assertKeySetParity` for callers who do not need the feature
    - Error messages match the existing helpers' format ("parity: <root> missing keys: ...") so existing test consumers' regex matchers keep working

    **Step C — Run all 5 helper test files; expect 100% green:**
    Run quick command. All 4 helper tests + 2 new parity-helper cases turn green. Pre-existing 6 parity-helper cases still pass.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/helpers-parsePhaseId.test.mjs tests/shadow-tests/helpers-deriveDiskStatus.test.mjs tests/shadow-tests/helpers-detectDrift.test.mjs tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs tests/shadow-tests/_parity-helpers.test.mjs 2>&amp;1 | tail -15 | tee /tmp/v.log; grep -E "pass [0-9]+" /tmp/v.log &amp;&amp; ! grep -E "fail [^0]" /tmp/v.log</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^export function parsePhaseId" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "^export function deriveDiskStatus" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "^export function detectDrift" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "^export function loadMilestoneHeading" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "^export function assertKeySetParityWithExt" tests/shadow-tests/_parity-helpers.mjs` returns 1
    - Pre-existing exports unchanged: `grep -c "^export function assertKeySetParity\b" tests/shadow-tests/_parity-helpers.mjs` returns 1; `grep -c "^export function assertTypeParity" tests/shadow-tests/_parity-helpers.mjs` returns 1
    - All 5 test files green: `node --test` of all 5 produces "pass N" with N >= 23 (6 + 7 + 6 + 4 + 6 + 2 = combined; tail-grep "fail 0" or absence of any "not ok").
    - Full Phase 4 suite still green: `node --test tests/shadow-tests/*.test.mjs` exits 0 (regression check — all 83 Phase 4 cases plus the 4 new helper test files plus the extended _parity-helpers test pass; combined total ≥ 83 + 4×6-ish + 2 ≈ 109; the exact number floats with case decisions).
    - bd-allowlist-grep test still green: `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0 (helper additions do not invoke bd; allowlist intact)
  </acceptance_criteria>
  <done>4 helpers exported from gsd-sdk-shadow.mjs; assertKeySetParityWithExt added to _parity-helpers.mjs; all 5 helper test files green; Phase 4 suite passes without regression; bd-allowlist still intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Helper internals → caller | All helpers are pure functions over already-validated inputs (label strings come from bd export, memory keys/values are read from bd memories) — no untrusted input crosses |
| `console.error` writes | stderr writes carry phase numbers + counts; no PII, no credentials |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-04 | Information Disclosure | stderr drift lines | accept | Drift output contains phase numbers + integer counts only; no sensitive data. Consistent with v0.1 stderr conventions. |
| T-05-05 | Tampering | parsePhaseId regex | mitigate | Regex anchored at start (`^`) prevents injection from non-prefix characters. Empty/null returns null deterministically. |
</threat_model>

<verification>
After both tasks:
- `node --test tests/shadow-tests/*.test.mjs` exits 0 (full Phase 4 suite + all 5 new test files green)
- `bash tests/shadow-tests/seed-determinism.test.sh` exits 0 (no regression)
- `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0 (no allowlist changes — helpers don't invoke bd)
- `bash tests/install-tests/upstream-version-pin.test.sh` exits 0 (lockfile pin unaffected)
- `bash tests/fixtures/memories-seeded.test.mjs` (from Plan 01) still green
- `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => console.log(typeof m.parsePhaseId, typeof m.deriveDiskStatus, typeof m.detectDrift, typeof m.loadMilestoneHeading))"` prints `function function function function`
</verification>

<success_criteria>
- 4 helpers exported and verifiably callable from outside the module
- `assertKeySetParityWithExt` added without breaking the 2 existing parity-helper exports
- 5 new test files (4 helper + 1 extension) all green; Phase 4 baseline 83/83 unchanged; bd-allowlist + seed-determinism + memories-seeded still green
- Helpers are documented with JSDoc comments referencing the relevant decision IDs
- detectDrift summary_count branch is LIVE (refined D-06): exercised by helpers-detectDrift CASE 3 fixture variant where bd_summary_count=2 ≠ disk_summary_count=1 emits drift entry
</success_criteria>

<output>
After completion, create `.planning/phases/05-roadmap-read-handlers/05-02-SUMMARY.md` documenting:
- Final exported helper signatures (4 from shadow + 1 from _parity-helpers)
- Test counts: parsePhaseId (6), deriveDiskStatus (7+), detectDrift (6 — including LIVE summary_count CASE 3), loadMilestoneHeading (4), _parity-helpers extension (CASEs 7-8 added to existing 6)
- Helper insertion location in gsd-sdk-shadow.mjs (line range)
- Decision: refined D-06 honored — detectDrift summary_count comparison takes distinct bd vs disk values; Plan 03 Task 3 handler must pass `bd_summary_count` (closed gsd:plan child count) and `disk_summary_count` (filesystem *-SUMMARY.md count) as distinct values
</output>
</content>
</invoke>