---
phase: 05-roadmap-read-handlers
plan: 04
type: execute
wave: 4
depends_on: [01, 02, 03]
files_modified:
  - bin/gsd-sdk-shadow.mjs
  - tests/scripts/update-snapshots.mjs
  - tests/shadow-tests/snapshots/roadmap-get-phase.json
  - tests/shadow-tests/handler-roadmap-get-phase.test.mjs
  - tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs
autonomous: true
requirements:
  - REQ-READ-02
tags:
  - roadmap-get-phase
  - read-handler
  - parity-snapshot
  - cross-handler-parity
  - sc-3

key_decisions:
  - "Per-phase shape divergence: roadmap.get-phase returns DIFFERENT keys than roadmap.analyze.phases[N] per upstream. Overlapping keys for SC #3 byte-equality: found, phase_number, phase_name, goal. Non-overlapping: get-phase has success_criteria (string[]) and section (string); analyze has plan_count, summary_count, has_context, has_research, disk_status, roadmap_complete. SC #3 byte-equality applies ONLY to overlapping keys."
  - "section field strategy: get-phase's section is raw markdown of the phase section. For bd-backed: assemble synthetic markdown from bd fields (title + description). DO NOT read .planning/ROADMAP.md (that defeats the bd-source-of-truth contract). The synthetic section starts with '### Phase <N>: <name>' line followed by the description body verbatim. This produces a stable string for parity testing."
  - "success_criteria parsing: extract from bead description by matching the 'Success Criteria:' heading and capturing subsequent bulleted/numbered list items until next heading. Spike 007 (gsd-ecosystem-integration.md) established this convention. When description is empty (current build-seed.sh phases have no description body), success_criteria = []."
  - "Wave assignment: Plan 04 is Wave 4 sequential after Plan 03. Both modify bin/gsd-sdk-shadow.mjs so they cannot parallelize per file-ownership rules. Tests live in distinct files but the source-of-truth handler module is shared."
  - "Cross-handler key-name remap: roadmap.analyze emits `number, name` while roadmap.get-phase emits `phase_number, phase_name`. The cross-handler-parity test MUST explicitly remap these key names (not just compare object shapes) — the test asserts SAME VALUES under DIFFERENT keys. Acceptance criterion grep enforces the remap is visible in the test code."

must_haves:
  truths:
    - "On a beads-managed fixture, gsd-sdk query roadmap.get-phase 5 returns { data: { found: true, phase_number: '5', phase_name: <string>, goal: <string|null>, success_criteria: <string[]>, section: <string>, backend: 'beads' } }"
    - "Decimal phase IDs work: roadmap.get-phase 72.1 returns the phase bead labeled phase-id:72.1 (or {found:false,phase_number:'72.1'} when absent — D-20 unmatched shape)"
    - "Unmatched phase number returns { data: { found: false, phase_number: <arg>, backend: 'beads' } } per D-20 (matches upstream's unmatched shape from query/roadmap.js:359)"
    - "Cross-handler parity (SC #3): for any phase N present in both handlers' outputs, the OVERLAPPING semantic fields (phase_number, phase_name, goal) are byte-equal between roadmap.analyze.phases[N] (under keys `number`, `name`, `goal`) and roadmap.get-phase N (under keys `phase_number`, `phase_name`, `goal`)"
    - "Parity snapshot tests/shadow-tests/snapshots/roadmap-get-phase.json exists, was captured from upstream BEFORE handler implementation (red->green per D-26), AND matches upstream's roadmapGetPhase shape (found, phase_number, phase_name, goal, success_criteria, section)"
    - "On a non-bd fixture, gsd-sdk query roadmap.get-phase 1 falls through to upstream (no backend: 'beads' in response) per SC #5"
  artifacts:
    - path: "bin/gsd-sdk-shadow.mjs"
      provides: "beadsRoadmapGetPhase handler registered in BEADS_READ_OVERRIDES"
      contains: "'roadmap.get-phase': beadsRoadmapGetPhase"
    - path: "tests/scripts/update-snapshots.mjs"
      provides: "Phase 5+ branch extended with roadmap-get-phase capture"
    - path: "tests/shadow-tests/snapshots/roadmap-get-phase.json"
      provides: "Captured upstream shape for known phase"
    - path: "tests/shadow-tests/handler-roadmap-get-phase.test.mjs"
      provides: "Parity + happy + decimal + unmatched + non-bd passthrough"
    - path: "tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs"
      provides: "SC #3 byte-equality of overlapping keys between analyze and get-phase (with explicit number↔phase_number, name↔phase_name remap)"
  key_links:
    - from: "BEADS_READ_OVERRIDES"
      to: "registry.register dispatch"
      via: "second register loop"
      pattern: "roadmap.get-phase"
    - from: "beadsRoadmapGetPhase handler"
      to: "bd CLI"
      via: "bd(['export', '--json'], { cwd })"
      pattern: "bd.*export.*--json"
    - from: "handler-roadmap-cross-handler-parity.test.mjs"
      to: "both handlers' outputs for the same phase number"
      via: "spawn shadow twice (once per handler), assert.deepStrictEqual on overlapping subset with key remap"
      pattern: "deepStrictEqual"
---

<objective>
Implement `beadsRoadmapGetPhase`, the second Phase 5 read handler, satisfying REQ-READ-02 + SC #3 (cross-handler parity for overlapping keys with explicit key remap) + SC #5 (non-bd passthrough). Capture upstream parity snapshot for phase 5 (a known v0.2 phase). Write 2 test files (per-handler + cross-handler-parity) before turning the handler GREEN.

Purpose: `/gsd-progress` and other consumers query phase data either through the milestone-wide `roadmap.analyze` or the targeted `roadmap.get-phase <N>`. Both must produce consistent overlap-key data so consumers can switch query shape without inconsistencies. This plan locks that consistency in via a dedicated cross-handler test.

Output:
- `bin/gsd-sdk-shadow.mjs` — `beadsRoadmapGetPhase` function (~70 LOC) added; `BEADS_READ_OVERRIDES['roadmap.get-phase']` registered
- `tests/scripts/update-snapshots.mjs` — second SNAPSHOTS entry for `roadmap.get-phase`
- `tests/shadow-tests/snapshots/roadmap-get-phase.json` — captured snapshot (red phase artifact)
- 2 new test files (handler-roadmap-get-phase + handler-roadmap-cross-handler-parity)
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
@bin/gsd-sdk-shadow.mjs
@bin/bd-helper.mjs
@tests/shadow-tests/_parity-helpers.mjs
@tests/scripts/update-snapshots.mjs
@tests/shadow-tests/handler-roadmap-analyze.test.mjs
@.claude/skills/spike-findings-gsd-beads/references/gsd-ecosystem-integration.md

<interfaces>
<!-- Upstream roadmapGetPhase (verified at /home/ellio/.volta/.../sdk/dist/query/roadmap.js:337-362) returns: -->
<!-- Found case: {data:{found:true, phase_number:<str>, phase_name:<str>, goal:<str|null>, success_criteria:<str[]>, section:<str>}} -->
<!-- Unmatched: {data:{found:false, phase_number:<arg>}} -->
<!-- ROADMAP missing: {data:{found:false, error:'ROADMAP.md not found'}} (we replace — bd has no equivalent) -->

<!-- Phase 5 bd-backed equivalent: -->
<!-- Found: {data:{found:true, phase_number:<parsePhaseId(label)>, phase_name:<stripped bead title>, goal:<parsed bead description "Goal:" line>, success_criteria:<parsed from "Success Criteria:" section>, section:<synthetic markdown assembled from bead fields>, backend:'beads'}} -->
<!-- Unmatched: {data:{found:false, phase_number:arg, backend:'beads'}} -->

<!-- Bead description format (Spike 007 contract): -->
<!-- Currently build-seed.sh creates phases via `bd q "title" -t epic -p 1` without setting description. -->
<!-- For Phase 5, we don't need description content for the test to pass; success_criteria can be [] when description is absent. -->
<!-- The handler must handle missing description gracefully (success_criteria = [], goal = null, section = synthesized from title only). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capture roadmap.get-phase parity snapshot</name>
  <files>tests/scripts/update-snapshots.mjs, tests/shadow-tests/snapshots/roadmap-get-phase.json</files>
  <read_first>
    - tests/scripts/update-snapshots.mjs (after Plan 03 Task 1: synthetic-fixture branch already implemented; we extend with another entry)
    - /home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js lines 290-362 (upstream searchPhaseInContent + roadmapGetPhase — the exact contract)
    - tests/shadow-tests/snapshots/roadmap-analyze.json (Plan 03 captured this; confirms which phase numbers exist in the synthetic fixture; pick one for get-phase capture)
  </read_first>
  <action>
    Step A — Add SNAPSHOTS entry to tests/scripts/update-snapshots.mjs:

    After Plan 03 introduced the synthetic-fixture branch, append to the SNAPSHOTS array a second entry for roadmap.get-phase. Refactor to extract a module-level `SYNTHETIC_FIXTURE` const so both entries reuse the same roadmapContent + phaseDirs literals (avoid duplication; keeps the synthetic fixture in one place):

    ```javascript
    const SYNTHETIC_FIXTURE = {
      roadmapContent: [ /* same content used by Plan 03 */ ].join('\n'),
      phaseDirs: [ /* same dir list */ ],
    };

    const SNAPSHOTS = [
      {
        cmd: 'roadmap.analyze',
        out: join(SNAPSHOT_DIR, 'roadmap-analyze.json'),
        synthetic: SYNTHETIC_FIXTURE,
        argv: ['query', 'roadmap.analyze'],
      },
      {
        cmd: 'roadmap.get-phase',
        out: join(SNAPSHOT_DIR, 'roadmap-get-phase.json'),
        synthetic: SYNTHETIC_FIXTURE,
        argv: ['query', 'roadmap.get-phase', '5'],   // capture for phase 5 (mid-fixture, exists in synthetic ROADMAP.md)
      },
    ];
    ```

    Step B — Run update-snapshots:

    `node tests/scripts/update-snapshots.mjs`

    This regenerates BOTH snapshot files. Each SNAPSHOTS entry triggers its own synthetic-fixture build (acceptable — captures are infrequent CI ops; refactoring to share tempdir is optional cleanup). The lockfile pre-check at top of update-snapshots.mjs still gates writes.

    Step C — Verify captured snapshot has upstream shape:

    `node -e "const j = JSON.parse(require('fs').readFileSync('tests/shadow-tests/snapshots/roadmap-get-phase.json','utf-8')); const k = Object.keys(j.data).sort(); console.log(k.join(',')); if (j.data.found !== true) process.exit(1)"`

    Expected key set for FOUND case: alphabetical `found, goal, phase_name, phase_number, section, success_criteria`. If upstream returned `found: false` (heading not matched), iterate on `SYNTHETIC_FIXTURE.roadmapContent` until phase 5 matches the upstream phasePattern regex `/#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi`.

    Commit phase: snapshot lands in repo BEFORE handler implementation (Task 3). D-26 red->green discipline preserved.
  </action>
  <verify>
    <automated>node tests/scripts/update-snapshots.mjs &amp;&amp; test -s tests/shadow-tests/snapshots/roadmap-get-phase.json &amp;&amp; node -e "const j=JSON.parse(require('fs').readFileSync('tests/shadow-tests/snapshots/roadmap-get-phase.json','utf-8')); const k=Object.keys(j.data).sort(); if(j.data.found!==true){console.error('not found',JSON.stringify(j.data).slice(0,200));process.exit(1)} for(const need of ['phase_number','phase_name','success_criteria','section']){if(!k.includes(need)){console.error('missing',need);process.exit(1)}}"</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/shadow-tests/snapshots/roadmap-get-phase.json` exists
    - The captured JSON has `data.found === true` (proves upstream regex matched the synthetic ROADMAP.md heading for phase 5)
    - The captured JSON's `data` object has at minimum these keys: `found, phase_number, phase_name, success_criteria, section` (verified by node -e key check)
    - `grep -c "roadmap.get-phase" tests/scripts/update-snapshots.mjs` returns >=1 (entry added)
    - `grep -c "SYNTHETIC_FIXTURE" tests/scripts/update-snapshots.mjs` returns >=2 (extracted const referenced by both SNAPSHOTS entries — DRY refactor)
    - Re-running update-snapshots.mjs produces byte-identical output (idempotency); compare via `node tests/scripts/update-snapshots.mjs && md5sum tests/shadow-tests/snapshots/*.json` before vs after a second run
    - Plan 03's `tests/shadow-tests/snapshots/roadmap-analyze.json` is unaffected (still byte-identical after the refactor extracted SYNTHETIC_FIXTURE)
  </acceptance_criteria>
  <done>roadmap-get-phase.json snapshot captured from upstream and committed; update-snapshots.mjs refactored to share SYNTHETIC_FIXTURE between both entries; analyze snapshot still byte-identical (no regression).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wave 0 — Write failing tests for roadmap.get-phase + cross-handler parity</name>
  <files>
    tests/shadow-tests/handler-roadmap-get-phase.test.mjs,
    tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs
  </files>
  <read_first>
    - tests/shadow-tests/snapshots/roadmap-get-phase.json (Task 1 captured this — the contract)
    - tests/shadow-tests/snapshots/roadmap-analyze.json (Plan 03 — for cross-handler comparison)
    - tests/shadow-tests/handler-roadmap-analyze.test.mjs (Plan 03 — fixture-setup helper to mirror)
    - tests/shadow-tests/_parity-helpers.mjs (assertKeySetParityWithExt — Plan 02)
  </read_first>
  <behavior>
    handler-roadmap-get-phase.test.mjs (5+ cases):

    - CASE 1 (PARITY): Build beads-managed fixture (same setupBdFixtureWithPhases helper from Plan 03 tests; consider extracting to a shared `_handler-test-helpers.mjs` if duplication is high). Set worktree milestone to v0.2. Run shadow `query roadmap.get-phase 5 --project-dir <fixture>`. Load snapshot. Assert `assertKeySetParityWithExt(actual.data, snapshot.data, ['backend'])` (only `backend` is the bd-only extension — get-phase has no drift[]).

    - CASE 2 (FOUND happy path): Same fixture. Assert actual.data.found === true; actual.data.phase_number === '5'; typeof actual.data.phase_name === 'string'; Array.isArray(actual.data.success_criteria); typeof actual.data.section === 'string'; actual.data.backend === 'beads'.

    - CASE 3 (DECIMAL): Augment build-seed fixture in TEST CASE (not the production seed) with one decimal phase: run `bd q "Decimal test" -t epic -p 1` and `bd label add <id> phase-id:72.1`. Then `query roadmap.get-phase 72.1`. Assert actual.data.found === true; actual.data.phase_number === '72.1' (decimal preserved per D-02). NOTE: this test creates additional bd state in the test tempdir; it does NOT modify the canonical seed.jsonl.

    - CASE 4 (UNMATCHED — D-20): Fixture without phase-id:99 label. Run `query roadmap.get-phase 99`. Assert actual.data.found === false; actual.data.phase_number === '99'; actual.data.backend === 'beads'.

    - CASE 5 (NON-BD PASSTHROUGH — SC #5): mkdtemp without bd init. Run `query roadmap.get-phase 1 --project-dir <tempdir>`. Assert parsed.data?.backend !== 'beads' (upstream's response).

    - CASE 6 (USAGE — empty arg): Run `query roadmap.get-phase` with no positional argument. Upstream throws GSDError with usage message; bd-backed handler should mirror this (or fall through, since the dispatcher's catch only handles BeadsUnavailableError sentinels — a thrown GSDError would propagate as a real error and get caught by the dispatcher's `dispatch failed` branch). Decision: handler validates args[0] presence at top, throws BeadsCorrupt or returns {found: false, error: 'phase number required'}. Pick: return `{ data: { found: false, error: 'Usage: roadmap.get-phase <phase-number>', backend: 'beads' } }` (graceful, consistent with upstream's "ROADMAP.md not found" non-throwing pattern). Test: spawn with no args, assert exit 0, assert parsed.data.found === false.

    handler-roadmap-cross-handler-parity.test.mjs (SC #3 — 2+ cases):

    - CASE 1 (overlapping keys byte-equal with EXPLICIT KEY REMAP): Build same beads-managed v0.2 fixture. Run shadow twice: once `query roadmap.analyze`, once `query roadmap.get-phase 5`. Parse both. Find phase 5 in analyze.phases[]. Compare:
      - `analyzePhase5.number === getPhaseResult.phase_number`  (note: key NAME differs — `number` vs `phase_number`; SC #3 says "byte-equal in the overlapping keys" which should be read as "for the same semantic field, both handlers emit the same value". Document this in test comments: the OVERLAPPING SEMANTIC FIELDS are number/phase_number, name/phase_name, goal. The values must be byte-equal even though the key names differ between handlers.)
      - `analyzePhase5.name === getPhaseResult.phase_name`
      - `analyzePhase5.goal === getPhaseResult.goal`
    Use `assert.deepStrictEqual` on the extracted overlapping-fields object **with EXPLICIT key remap visible in the test source**:
    ```javascript
    // EXPLICIT REMAP: roadmap.analyze emits `number`/`name`; roadmap.get-phase emits `phase_number`/`phase_name`.
    // The cross-handler-parity invariant asserts SAME VALUES under DIFFERENT keys.
    const analyzeRemapped = {
      phase_number: analyzePhase5.number,    // remap: number → phase_number
      phase_name: analyzePhase5.name,        // remap: name → phase_name
      goal: analyzePhase5.goal,
    };
    const getPhaseSubset = {
      phase_number: getPhaseResult.phase_number,
      phase_name: getPhaseResult.phase_name,
      goal: getPhaseResult.goal,
    };
    assert.deepStrictEqual(analyzeRemapped, getPhaseSubset);
    ```

    - CASE 2 (single bd export call shared semantics): Both handlers use the same bd export source for the phase data; verify by running them twice each (4 total queries) and asserting all 4 outputs deterministically agree on the overlapping semantic fields. Tests REQ-QUAL-06 (deterministic ordering precursor) — even though the formal precursor lands in Plan 05.

    All tests use t.after() teardown.

    Per D-26: both files RED at end of Task 2 (handler not yet implemented).
  </behavior>
  <action>
    Create the 2 test files. Helper extraction: if a `setupBdFixtureWithPhases(t)` helper was inlined in Plan 03 tests, consider extracting to `tests/shadow-tests/_handler-test-helpers.mjs` now (used by 6 test files: 4 from Plan 03 + 2 here). The underscore-prefix convention (Phase 4 D-15) marks it as a non-handler test utility.

    Acceptance for the extraction decision: if the helper body exceeds ~30 lines and is duplicated across >=3 files, extract. Otherwise inline. (Plan 03's helpers were per-file; if Task 1 of Plan 04 inlines too, total LOC is ~120 — extraction saves ~80 LOC.)

    The cross-handler-parity test MUST contain explicit `number → phase_number` and `name → phase_name` remap commentary AND code (verified by W7 grep gate in acceptance criteria).

    Per D-26 (red phase): both files fail at end of Task 2. Verify red signal:

    `node --test tests/shadow-tests/handler-roadmap-get-phase.test.mjs tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs`

    Expected: every CASE fails because beadsRoadmapGetPhase is not registered (BEADS_READ_OVERRIDES['roadmap.get-phase'] is undefined → registry lookup falls through to upstream → upstream returns "ROADMAP.md not found" or similar → assertions on backend === 'beads' fail).
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/handler-roadmap-get-phase.test.mjs tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs 2>&amp;1 | tail -10 | tee /tmp/v.log; grep -E "fail [^0]" /tmp/v.log</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/shadow-tests/handler-roadmap-get-phase.test.mjs` exists with >=5 `test(` calls
    - File `tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` exists with >=2 `test(` calls
    - `grep -c "snapshots/roadmap-get-phase.json" tests/shadow-tests/handler-roadmap-get-phase.test.mjs` returns >=1 (loads the captured snapshot)
    - `grep -c "deepStrictEqual" tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` returns >=1 (uses strict equality for SC #3)
    - `grep -c "roadmap.analyze" tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` returns >=1 (cross-handler test invokes BOTH handlers)
    - **W7 / cross-handler key remap visibility:** `grep -cE 'number.*phase_number|phase_name.*name' tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` returns ≥1 (proves key remapping is explicit in the test code — analyze emits `number`/`name`, get-phase emits `phase_number`/`phase_name`; the remap is part of the SC #3 contract)
    - `grep -c "phase-id:72.1" tests/shadow-tests/handler-roadmap-get-phase.test.mjs` returns >=1 (decimal phase test exists per D-02)
    - `grep -c "found.*false" tests/shadow-tests/handler-roadmap-get-phase.test.mjs` returns >=1 (unmatched case per D-20)
    - At Task 2 completion (red): combined run produces >=5 failures (handler not implemented)
  </acceptance_criteria>
  <done>2 test files committed; deterministic red signal; the contracts for Task 3 are now in repo (cross-handler key remap is explicit per W7).</done>
</task>

<task type="auto">
  <name>Task 3: Implement beadsRoadmapGetPhase; turn Wave 0 GREEN</name>
  <files>bin/gsd-sdk-shadow.mjs</files>
  <read_first>
    - bin/gsd-sdk-shadow.mjs after Plan 03 (beadsRoadmapAnalyze present at known line range; Plan 04 adds get-phase adjacent)
    - .planning/phases/05-roadmap-read-handlers/05-RESEARCH.md §"roadmap.get-phase Handler Design (D-20, ROADMAP SC #3)" — the design intent
    - /home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js lines 290-362 (upstream `searchPhaseInContent` + `roadmapGetPhase`)
    - tests/shadow-tests/handler-roadmap-get-phase.test.mjs (the assertions ARE the contract)
    - tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs (cross-handler invariants)
    - tests/shadow-tests/snapshots/roadmap-get-phase.json (the parity contract)
  </read_first>
  <action>
    Implement `beadsRoadmapGetPhase` immediately after `beadsRoadmapAnalyze` in bin/gsd-sdk-shadow.mjs:

    ```javascript
    /**
     * REQ-READ-02: Single-phase view from bd.
     * D-20: numeric phase identifiers only (whole or decimal). Fuzzy/title matching
     * is Phase 8's find-phase responsibility.
     *
     * Returns {data:{found,phase_number,phase_name,goal,success_criteria,section,backend}}
     * on FOUND case; {data:{found:false,phase_number:arg,backend:'beads'}} on UNMATCHED.
     *
     * Cross-handler parity (SC #3): the overlapping semantic fields (phase_number,
     * phase_name, goal) MUST match roadmap.analyze.phases[N] byte-for-byte. The
     * non-overlapping fields (success_criteria, section) are unique to get-phase.
     * KEY REMAP: roadmap.analyze emits `number`/`name`; this handler emits `phase_number`/`phase_name`.
     * The cross-handler-parity test asserts SAME VALUES under DIFFERENT keys.
     */
    async function beadsRoadmapGetPhase(args, projectDir, _workstream) {
      // Argument validation (graceful — return {found:false} rather than throw, so
      // upstream-shape parity is preserved on usage errors)
      const phaseArg = args[0];
      if (!phaseArg) {
        return { data: { found: false, error: 'Usage: roadmap.get-phase <phase-number>', backend: 'beads' } };
      }

      // Single bd export (D-27 budget; no memories needed for get-phase)
      const allBeads = bd(['export', '--json'], { cwd: projectDir });
      if (!Array.isArray(allBeads)) {
        throw new BeadsCorrupt(`bd export --json returned non-array: ${typeof allBeads}`);
      }

      // D-19 milestone scoping (same logic as analyze; consider extracting if duplication grows)
      let currentMilestone = process.env.GSD_MILESTONE;
      if (!currentMilestone) {
        const git = spawnSync('git', ['config', '--worktree', 'gsd-beads.milestone'], {
          cwd: projectDir, encoding: 'utf-8'
        });
        currentMilestone = (git.stdout ?? '').trim() || null;
      }

      // D-20 lookup: find phase bead with phase-id:<arg> label
      // parsePhaseId normalizes both sides — input '5' matches label 'phase-id:05'
      const phaseBead = allBeads.find(b => {
        if (!b.labels?.includes('gsd:phase')) return false;
        if (currentMilestone && !b.labels?.includes(`version:${currentMilestone}`)) return false;
        const phaseIdLabel = b.labels?.find(l => l.startsWith('phase-id:'));
        const num = parsePhaseId(phaseIdLabel);
        return num === phaseArg;
      });

      if (!phaseBead) {
        return { data: { found: false, phase_number: phaseArg, backend: 'beads' } };
      }

      // Extract fields from bead (matching analyze handler's extraction logic exactly
      // so SC #3 cross-handler parity holds for overlapping semantic fields, even with
      // the key-name remap: analyze→number, get-phase→phase_number; analyze→name, get-phase→phase_name)
      const desc = phaseBead.description ?? '';
      const goalMatch = desc.match(/^Goal:\s*(.+)$/m);
      const goal = goalMatch ? goalMatch[1].trim() : null;

      // Strip "Phase NN: " prefix from name — same logic as analyze (CRITICAL for cross-handler parity)
      const phase_name = phaseBead.title
        .replace(/^v?\d+(\.\d+)?\s+Phase\s+[A-Z]?\d*:\s*/, '')
        .replace(/^Phase\s+\d+(\.\d+)?:\s*/, '');

      // Parse success_criteria from description (Spike 007 format contract)
      // Heuristic: capture lines after "Success Criteria:" heading until next blank line or heading
      const success_criteria = [];
      const scMatch = desc.match(/^Success Criteria:?\s*\n([\s\S]*?)(?:\n\s*\n|\n#|$)/m);
      if (scMatch) {
        const block = scMatch[1];
        for (const line of block.split('\n')) {
          // Match bulleted (- or *), numbered (1., 1)), or indented items
          const itemMatch = line.match(/^\s*(?:[-*]|\d+[.)])\s*(.+)$/);
          if (itemMatch) success_criteria.push(itemMatch[1].trim());
        }
      }

      // Synthesize section as markdown (don't read .planning/ROADMAP.md — bd is source of truth)
      const phase_number = parsePhaseId(phaseBead.labels?.find(l => l.startsWith('phase-id:')));
      const section = `### Phase ${phase_number}: ${phase_name}\n\n${desc}`;

      return { data: {
        found: true,
        phase_number,
        phase_name,
        goal,
        success_criteria,
        section,
        backend: 'beads',
      }};
    }
    ```

    Register in BEADS_READ_OVERRIDES:

    ```javascript
    export const BEADS_READ_OVERRIDES = {
      'roadmap.analyze': beadsRoadmapAnalyze,
      'roadmap.get-phase': beadsRoadmapGetPhase,
    };
    ```

    Iterate until both new test files are GREEN. Common iteration points:
    - Phase title regex stripping (CASE 2 may complain that phase_name still contains "v0.2 Phase B: " prefix — refine the regex)
    - Empty arg handling (CASE 6: ensure no exception escapes; the {found:false} early return is the contract)
    - SC #3 cross-handler parity (the cross-handler test checks that the SAME source bead produces SAME values via two code paths — both handlers MUST use identical extraction logic; if they diverge in `name` regex stripping, SC #3 fails — even with the key-name remap, the VALUES under those keys must agree)

    Run full Phase 5 suite + bd allowlist to confirm no regression:

    `node --test tests/shadow-tests/*.test.mjs && bash tests/shadow-tests/bd-allowlist-grep.test.sh`
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/handler-roadmap-get-phase.test.mjs tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs 2>&amp;1 | tail -10 | tee /tmp/v.log; grep -E "fail 0" /tmp/v.log &amp;&amp; node --test tests/shadow-tests/*.test.mjs &amp;&amp; bash tests/shadow-tests/bd-allowlist-grep.test.sh</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "async function beadsRoadmapGetPhase" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "'roadmap.get-phase': beadsRoadmapGetPhase" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "bd(\\['export'" bin/gsd-sdk-shadow.mjs` returns 2 (one in analyze, one in get-phase — each handler is responsible for its own export call)
    - `grep -c "bd(\\['memories'" bin/gsd-sdk-shadow.mjs` returns 1 (only analyze needs memories; get-phase does NOT call bd memories — staying within ≤2 spawn budget; for get-phase the budget is ≤1 spawn since no memories needed)
    - `grep -c "bd(\\['children'" bin/gsd-sdk-shadow.mjs` returns 0 (Pitfall 3: no per-phase fan-out)
    - Both new test files green: `node --test tests/shadow-tests/handler-roadmap-get-phase.test.mjs tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs` exits 0 with "fail 0"
    - Full Phase 5 + Phase 4 suite green: `node --test tests/shadow-tests/*.test.mjs` exits 0
    - bd allowlist intact: `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0
    - seed-determinism still green: `bash tests/shadow-tests/seed-determinism.test.sh` exits 0
    - Lockfile pin still green: `bash tests/install-tests/upstream-version-pin.test.sh` exits 0
  </acceptance_criteria>
  <done>beadsRoadmapGetPhase implemented and registered; cross-handler parity (SC #3) green with explicit key remap honored; both new test files green; full suite green; allowlist intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Shadow CLI argv args[0] (phase number) | Validated by parsePhaseId comparison; never interpolated into bd args (used only as JS-string compare against label-derived value) |
| bd export JSON → handler | Same as Plan 03; sentinels propagate via bd-helper |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | args[0] phase number injection | mitigate | args[0] is treated as a JS string, compared by `===` against parsePhaseId(label). Never passed to shell. Never interpolated into bd args (bd is invoked with literal `['export', '--json']`). The string is only echoed back in the unmatched response shape. |
| T-05-09 | Information Disclosure | description content in `section` field | accept | Bead description is project-internal data; same trust class as ROADMAP.md content upstream returns. No PII modeled in bd. |
</threat_model>

<verification>
After all 3 tasks:
- Both new test files green; cross-handler parity proven for overlapping semantic fields with explicit key remap
- Full shadow test suite green
- bd allowlist + seed-determinism + memories-seeded + upstream-version-pin all green
- Manual smoke: `node bin/gsd-sdk-shadow.mjs query roadmap.get-phase 5 --project-dir <gsd-beads-fixture>` returns `{data:{found:true, phase_number:'5', ..., backend:'beads'}}`
- Manual smoke unmatched: `... query roadmap.get-phase 99 ...` returns `{data:{found:false, phase_number:'99', backend:'beads'}}`
</verification>

<success_criteria>
- REQ-READ-02 satisfied: roadmap.get-phase returns upstream-compatible single-phase shape on bd-managed projects
- SC #3: overlapping semantic fields byte-equal between roadmap.analyze.phases[N] and roadmap.get-phase N (with explicit number↔phase_number, name↔phase_name remap visible in cross-handler-parity test)
- SC #4: parity snapshot file existed before handler implementation (verified by git log + file timestamps)
- SC #5: non-bd fixture passes through to upstream
- D-02 decimal preservation: phase-id:72.1 lookup works for both handlers
- D-20 unmatched shape: {found:false,phase_number:arg,backend:'beads'}
</success_criteria>

<output>
After completion, create `.planning/phases/05-roadmap-read-handlers/05-04-SUMMARY.md` documenting:
- Final handler line range in bin/gsd-sdk-shadow.mjs
- Cross-handler parity proof: same bead → same overlapping field values via two code paths (with explicit key remap)
- Snapshot capture method: SYNTHETIC_FIXTURE constant shared between analyze + get-phase entries
- success_criteria parsing convention (Spike 007 format contract reference)
- section synthesis strategy (assembled from bd description, NOT from ROADMAP.md disk)
- Wave 0 → GREEN transition: 2 test files written red first, handler made each pass deterministically
</output>
</content>
</invoke>