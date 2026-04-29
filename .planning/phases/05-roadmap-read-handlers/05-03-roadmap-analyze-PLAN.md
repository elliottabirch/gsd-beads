---
phase: 05-roadmap-read-handlers
plan: 03
type: execute
wave: 3
depends_on: [01, 02]
files_modified:
  - bin/gsd-sdk-shadow.mjs
  - tests/scripts/update-snapshots.mjs
  - tests/shadow-tests/snapshots/roadmap-analyze.json
  - tests/shadow-tests/handler-roadmap-analyze.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs
  - tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs
autonomous: true
requirements:
  - REQ-READ-01
tags:
  - roadmap-analyze
  - read-handler
  - parity-snapshot
  - drift-detection
  - milestone-scoping
  - sc-1
  - sc-2
  - sc-5

key_decisions:
  - "Q1 Option A: summary_count derives from disk *-SUMMARY.md count, NOT a (non-existent) gsd:summary label. Refines D-06: 'summary_count from disk'. plan_count remains bd-source (`gsd:plan` children grouped from bd export). Rationale: gsd:summary label does not exist in production (STACK.md verified against tstl-sylvanas); using disk count matches upstream parity exactly. Documented in handler doc-comment."
  - "Q2 Option B: Synthetic fixture for parity capture — `update-snapshots.mjs` creates a tempdir with both `.beads/` (seed-fixture.sh) AND a synthetic `.planning/ROADMAP.md` with `### Phase 1..7:` headings matching the v0.2 narrative. Avoids coupling tests to gsd-beads project state. The synthetic ROADMAP.md is generated inside update-snapshots.mjs as a literal string (not regen-roadmap.sh — that produces the convention-label format upstream cannot parse)."
  - "STUB DELETION: The first concrete edit in this plan removes lines 290-300 of bin/gsd-sdk-shadow.mjs (the env-gated _phase4-test-stub block). The pre-existing handler-_phase4-test-stub.test.mjs WILL FAIL after deletion — that's expected and the test file is also deleted in Task 1. The shadow's `if (process.env.GSD_SHADOW_TEST_STUB === '1')` branch is the only consumer; nothing else references it."
  - "Threat T-05-01 (untrusted phase number argument injection): N/A for roadmap.analyze (argless). Phase 4's bd() helper already uses `spawnSync('bd', args, ...)` with array form (no shell), so even if a future caller passed user input through, `bd export --json` has no interpolation surface."

must_haves:
  truths:
    - "On a beads-managed fixture seeded from tests/fixtures/seed.jsonl with current-milestone v0.2, `gsd-sdk query roadmap.analyze` returns 10 top-level keys (milestones, phases, phase_count, completed_phases, total_plans, total_summaries, progress_percent, current_phase, next_phase, missing_phase_details) + 2 bd-only keys (backend, drift)"
    - "Each entry of phases[] has 10 keys: number, name, goal, depends_on, plan_count, summary_count, has_context, has_research, disk_status, roadmap_complete"
    - "current_phase and next_phase are phase number strings (e.g. '5'), never bead IDs (e.g. 'sd-ahn') — REQ-READ-01 SC #1"
    - "total_plans equals `bd count -l gsd:plan --json` output for the same fixture; completed_phases equals count of phase epics where bd_status=='closed' (D-14) — SC #2"
    - "Parity snapshot file tests/shadow-tests/snapshots/roadmap-analyze.json exists, was captured from upstream against a synthetic fixture WITH phases/ + ROADMAP.md, and was committed BEFORE handler implementation (red→green per D-26) — SC #4"
    - "On a non-bd fixture (mkdtempSync without `bd init`), gsd-sdk query roadmap.analyze falls through to upstream (response has no `backend: 'beads'` field) — SC #5"
    - "When current-milestone is set to v0.2 via `git config --worktree gsd-beads.milestone v0.2`, response phases[] contains only the 7 v0.2 phase beads (no v0.1, no v0.3) — D-19"
    - "When bd state and disk state diverge (drift fixture: bd has 2 gsd:plan children, disk has 1 *-PLAN.md), response.data.drift contains an entry with kind='plan_count', bd_value=2, disk_value=1, AND stderr contains '[gsd-shadow] DRIFT: phase ... plan_count bd=2 disk=1' — D-08..D-12"
    - "_phase4-test-stub block at bin/gsd-sdk-shadow.mjs lines 290-300 is removed; setting GSD_SHADOW_TEST_STUB=1 no longer registers any handler"
  artifacts:
    - path: "bin/gsd-sdk-shadow.mjs"
      provides: "beadsRoadmapAnalyze handler registered in BEADS_READ_OVERRIDES; stub deletion completed"
      contains: "'roadmap.analyze': beadsRoadmapAnalyze"
    - path: "tests/scripts/update-snapshots.mjs"
      provides: "Phase 5+ branch implemented: builds synthetic fixture (.beads/ + .planning/ROADMAP.md), runs upstream, captures stdout"
    - path: "tests/shadow-tests/snapshots/roadmap-analyze.json"
      provides: "Captured upstream shape against synthetic fixture (10 top-level + 10 per-phase keys)"
    - path: "tests/shadow-tests/handler-roadmap-analyze.test.mjs"
      provides: "Parity snapshot test (red→green) + non-bd passthrough + stub-absence assertion"
    - path: "tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs"
      provides: "SC #2: total_plans = bd count -l gsd:plan; completed_phases = bd phase status=closed count"
    - path: "tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs"
      provides: "D-19 worktree milestone scoping (worktree-A v0.2 vs worktree-B v0.3 returns disjoint phases[])"
    - path: "tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs"
      provides: "D-08..D-12 drift fixture (bd-vs-disk divergence emits drift[] + stderr)"
  key_links:
    - from: "BEADS_READ_OVERRIDES table"
      to: "registry.register dispatch"
      via: "second register loop (line 370-372)"
      pattern: "BEADS_READ_OVERRIDES\\['roadmap.analyze'\\]"
    - from: "beadsRoadmapAnalyze handler"
      to: "bd CLI"
      via: "bd(['export', '--json'], { cwd }) — single call, REQ-QUAL-07"
      pattern: "bd\\(\\['export', '--json'\\]"
    - from: "beadsRoadmapAnalyze handler"
      to: "bd memories"
      via: "bd(['memories', '--json'], { cwd }) — second of 2 allowed spawns"
      pattern: "bd\\(\\['memories'"
    - from: "handler-roadmap-analyze.test.mjs"
      to: "snapshots/roadmap-analyze.json"
      via: "JSON.parse(readFileSync) + assertKeySetParityWithExt"
      pattern: "snapshots/roadmap-analyze.json"
---

<objective>
Implement `beadsRoadmapAnalyze`, the first real bd-backed read handler, satisfying REQ-READ-01 + SC #1, #2, #4, #5 + D-19 milestone scoping + D-08..D-12 drift detection. Delete the `_phase4-test-stub` block. Capture upstream parity snapshot from a synthetic fixture (Q2 Option B). Write 4 test files covering happy path / counts / milestone scoping / drift before turning the handler GREEN.

Purpose: This is the marquee Phase 5 deliverable. Once green, `/gsd-progress`'s rich panel renders bd-derived data; downstream phases (6, 7, 8, 9) inherit the established pattern (single export call + in-memory grouping + 2-spawn budget + parity-first testing).

Output:
- `bin/gsd-sdk-shadow.mjs` — `_phase4-test-stub` block removed; `beadsRoadmapAnalyze` function (~110 LOC) added; `BEADS_READ_OVERRIDES['roadmap.analyze'] = beadsRoadmapAnalyze` registered
- `tests/scripts/update-snapshots.mjs` — Phase 5+ branch implemented (synthetic-fixture upstream capture)
- `tests/shadow-tests/snapshots/roadmap-analyze.json` — captured snapshot, committed before handler GREEN
- 4 new test files (handler-roadmap-analyze + 3 sibling files for counts / milestone-scoping / drift)
- Deleted: `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` (the stub it covers no longer exists)
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
@.planning/phases/05-roadmap-read-handlers/05-01-fixture-migration-PLAN.md
@.planning/phases/05-roadmap-read-handlers/05-02-shared-helpers-PLAN.md
@bin/gsd-sdk-shadow.mjs
@bin/bd-helper.mjs
@bin/beads-errors.mjs
@tests/shadow-tests/_parity-helpers.mjs
@tests/scripts/update-snapshots.mjs
@tests/shadow-tests/handler-_phase4-test-stub.test.mjs
@tests/shadow-tests/milestone-scoping.test.mjs
@tests/fixtures/build-seed.sh
@tests/fixtures/seed-fixture.sh
@.claude/skills/spike-findings-gsd-beads/SKILL.md

<interfaces>
<!-- Existing imports at top of bin/gsd-sdk-shadow.mjs we'll add to: -->
```javascript
// Existing (do not remove)
import { existsSync, realpathSync, statSync, readFileSync, /* etc. */ } from 'node:fs';
import { /* etc. */ } from 'node:path';
import { spawnSync } from 'node:child_process';   // already imported
import { execSync } from 'node:child_process';    // already imported
import { fileURLToPath } from 'node:url';
import { BeadsUnavailableError, BeadsNotInstalled, /* etc. */ } from './beads-errors.mjs';
import { bd } from './bd-helper.mjs';
// SDK_BASE / QUERY_INDEX_PATH / REGISTRY_PATH already defined

// NEW for Phase 5 — add near other path constants:
const HELPERS_PATH = `${SDK_BASE}/sdk/dist/query/helpers.js`;
```

<!-- Upstream helpers we'll import dynamically inside the handler: -->
```javascript
const { phaseTokenMatches, planningPaths, comparePhaseNum, normalizePhaseName } = await import(HELPERS_PATH);
```

<!-- Output shape contract (UPSTREAM at /home/ellio/.volta/.../sdk/dist/query/roadmap.js:480-492): -->
```javascript
{ data: {
    milestones: [{ heading: string, version: string }],
    phases: [{ number, name, goal, depends_on, plan_count, summary_count, has_context, has_research, disk_status, roadmap_complete }],
    phase_count: number,
    completed_phases: number,
    total_plans: number,
    total_summaries: number,
    progress_percent: number,
    current_phase: string | null,
    next_phase: string | null,
    missing_phase_details: string[] | null,
    // bd-backend additions:
    backend: 'beads',
    drift: DriftEntry[],
}}
```

<!-- bd export --json output sample (verified from tests/fixtures/seed.jsonl): -->
```javascript
[
  { _type: 'issue', id: 'sd-93x', title: 'v0.2 Phase C: progress reads', status: 'open', priority: 1, issue_type: 'epic', created_at: '...', updated_at: '...', labels: ['gsd:phase', 'version:v0.2', 'phase-id:05'], dependency_count: 0, ... },
  // plan children (after Plan 01):
  { _type: 'issue', id: 'sd-xxx', title: 'v0.2 Plan 03-01', status: 'open', issue_type: 'task', labels: ['gsd:plan', 'version:v0.2', 'plan-id:03-01'], dependencies: [{ type: 'parent-child', depends_on_id: 'sd-...' }], ... },
  // memories appear ONLY in JSONL export, NOT in --json array output (Pitfall 3)
]
```

<!-- bd memories --json output (verified from STACK.md): -->
```javascript
{
  "gsd-beads:milestone:v0.1:heading": "Foundation",
  "gsd-beads:milestone:v0.2:heading": "Beads-backed reads",
  "schema_version": "1"  // filter out
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete _phase4-test-stub + extend update-snapshots.mjs Phase 5+ branch</name>
  <files>
    bin/gsd-sdk-shadow.mjs,
    tests/shadow-tests/handler-_phase4-test-stub.test.mjs,
    tests/scripts/update-snapshots.mjs,
    tests/shadow-tests/snapshots/roadmap-analyze.json
  </files>
  <read_first>
    - bin/gsd-sdk-shadow.mjs lines 287-300 (the stub block to delete)
    - tests/shadow-tests/handler-_phase4-test-stub.test.mjs (the test file that depends on the deleted stub — must be removed atomically)
    - tests/scripts/update-snapshots.mjs (existing 70 LOC; the SNAPSHOTS array + the reserved Phase 5+ branch starting at line 65)
    - tests/scripts/update-snapshots.mjs (verify lockfile pre-check still works after Phase 5+ branch is added)
    - /home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js lines 373-492 (the upstream `roadmapAnalyze` body — confirms the exact `### Phase N:` heading regex `phasePattern` we must match in the synthetic ROADMAP.md)
    - tests/fixtures/seed-fixture.sh (the restorer we'll invoke)
  </read_first>
  <action>
    **Step A — Delete `_phase4-test-stub` block from `bin/gsd-sdk-shadow.mjs`:**

    Remove lines 289-300 (the comment line "// _phase4-test-stub: lifecycle-bound..." plus the entire `if (process.env.GSD_SHADOW_TEST_STUB === '1') { ... }` block). The line `export const BEADS_READ_OVERRIDES = {};` (line 287) STAYS — it's still the registration table for Plans 03/04 to add to.

    Verify after edit: `grep -c "_phase4-test-stub" bin/gsd-sdk-shadow.mjs` returns 0.

    **Step B — Delete the orphan test file:**

    `rm tests/shadow-tests/handler-_phase4-test-stub.test.mjs`

    The 6 cases this file covered (happy + 4 sentinel subtypes + real-bug TypeError) were Phase 4 wiring proofs. Phase 5's real handlers exercise the same dispatcher catch via the new `handler-roadmap-analyze.test.mjs` (one CASE will throw a sentinel and assert fall-through). The lifecycle-bound test goes when its stub goes.

    Also remove the now-orphan snapshot: `rm tests/shadow-tests/snapshots/_phase4-test-stub.json`

    **Step C — Extend `tests/scripts/update-snapshots.mjs` Phase 5+ branch:**

    Add a new SNAPSHOTS entry AND implement the else-branch at line 65-68 to handle the synthetic-fixture capture flow:

    ```javascript
    // Phase 5: roadmap.analyze snapshot (Q2 Option B: synthetic fixture)
    {
      cmd: 'roadmap.analyze',
      out: join(SNAPSHOT_DIR, 'roadmap-analyze.json'),
      synthetic: {
        // Build a tempdir with .beads/ (from seed.jsonl) + .planning/ROADMAP.md
        // The ROADMAP.md must contain `### Phase N:` headings that upstream's
        // phasePattern regex matches: /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi
        roadmapContent: [
          '# Roadmap',
          '',
          '## Milestone v0.2 — Beads-backed reads',
          '',
          '### Phase 1: Spike',
          '**Goal:** Validate beads + GSD topology.',
          '',
          '### Phase 2: Build the layer',
          '**Goal:** Productionize the spike POCs.',
          '',
          '### Phase 3: findBeadsRoot',
          '**Goal:** Read-side detection.',
          '',
          '### Phase 4: parity infrastructure',
          '**Goal:** Snapshot/parity harness.',
          '',
          '### Phase 5: roadmap reads',
          '**Goal:** roadmap.* read handlers.',
          '',
          '',  // (etc — match the 11 phases from build-seed.sh)
        ].join('\n'),
        phaseDirs: [
          // List of phase directories to mkdir under .planning/phases/
          // Names must match what phaseTokenMatches normalizes against.
          // Pattern: NN-slug (e.g. '01-spike', '02-build-the-layer', etc.)
        ],
      },
      argv: ['query', 'roadmap.analyze'],
    },
    ```

    Implement the synthetic branch:

    ```javascript
    } else if (s.synthetic) {
      const tmp = mkdtempSync(join(tmpdir(), 'gsd-snap-'));
      try {
        // 1. Restore .beads/ from seed.jsonl
        execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${tmp}`, { stdio: 'inherit' });
        // 2. Write .planning/ROADMAP.md
        const planningDir = join(tmp, '.planning');
        mkdirSync(planningDir, { recursive: true });
        writeFileSync(join(planningDir, 'ROADMAP.md'), s.synthetic.roadmapContent);
        // 3. Mkdir phase dirs (if any specified for disk_status testing)
        const phasesDir = join(planningDir, 'phases');
        mkdirSync(phasesDir, { recursive: true });
        for (const d of s.synthetic.phaseDirs ?? []) {
          mkdirSync(join(phasesDir, d), { recursive: true });
        }
        // 4. Run UPSTREAM binary against the synthetic fixture, capture stdout
        const result = spawnSync(UPSTREAM_BIN, [...s.argv, '--project-dir', tmp], { encoding: 'utf-8' });
        if (result.status !== 0) {
          console.error(`upstream failed for ${s.cmd}: ${result.stderr}`);
          process.exit(1);
        }
        const parsed = JSON.parse(result.stdout);
        writeFileSync(s.out, `${JSON.stringify(parsed, null, 2)}\n`);
        console.log(`wrote ${s.out} (synthetic fixture)`);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }
    ```

    Required imports to add at top of update-snapshots.mjs: `mkdtempSync`, `mkdirSync`, `rmSync` from `node:fs`; `tmpdir` from `node:os`.

    **Step D — Run update-snapshots and commit the captured snapshot:**

    `node tests/scripts/update-snapshots.mjs`

    This produces `tests/shadow-tests/snapshots/roadmap-analyze.json`. Read that file to confirm it has the 10 top-level keys + per-phase 10-key objects. If the upstream output is empty (`phases: []`) — that means the synthetic ROADMAP.md headings aren't matching upstream's regex; iterate on the heading format until upstream returns ≥1 phase. The captured snapshot is the contract Plan 03 Task 3 implements against.

    Commit phase: this snapshot file lands in git BEFORE Task 3 (handler implementation). That's the red→green discipline mandated by D-26.
  </action>
  <verify>
    <automated>! grep -q "_phase4-test-stub" bin/gsd-sdk-shadow.mjs &amp;&amp; ! test -f tests/shadow-tests/handler-_phase4-test-stub.test.mjs &amp;&amp; node tests/scripts/update-snapshots.mjs &amp;&amp; test -s tests/shadow-tests/snapshots/roadmap-analyze.json &amp;&amp; node -e "const j = JSON.parse(require('fs').readFileSync('tests/shadow-tests/snapshots/roadmap-analyze.json', 'utf-8')); const k = Object.keys(j.data); console.log(k.join(',')); if (!k.includes('phases') || !k.includes('phase_count') || !k.includes('milestones') || !k.includes('current_phase') || !k.includes('next_phase')) process.exit(1); if (j.data.phases.length === 0) { console.error('phases empty — synthetic ROADMAP.md not matched by upstream'); process.exit(1); }"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "_phase4-test-stub" bin/gsd-sdk-shadow.mjs` returns 0 (stub block removed)
    - `grep -c "GSD_SHADOW_TEST_STUB" bin/gsd-sdk-shadow.mjs` returns 0 (env-gate code path entirely removed)
    - File `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` does NOT exist
    - File `tests/shadow-tests/snapshots/_phase4-test-stub.json` does NOT exist
    - `grep -c "_phase4-test-stub" tests/scripts/update-snapshots.mjs` returns 0 (the literal SNAPSHOTS entry removed; the synthetic-fixture branch replaces it)
    - File `tests/shadow-tests/snapshots/roadmap-analyze.json` exists, is non-empty, and `node -e "..."` parse confirms ≥10 top-level keys including phases/phase_count/milestones/current_phase/next_phase, AND `phases.length >= 1` (proves upstream regex matched the synthetic ROADMAP.md)
    - Existing `node --test tests/shadow-tests/*.test.mjs` is now SHORT one test file (handler-_phase4-test-stub.test.mjs gone) but otherwise green; pre-deletion 83 - 6 = 77 mutation/Phase-4 tests still pass; Plan 02's 5 new helper test files green; net result: full suite still exits 0 with the orphan tests removed
    - `bash tests/install-tests/upstream-version-pin.test.sh` exits 0 (lockfile gate still works alongside Phase 5+ branch)
  </acceptance_criteria>
  <done>Stub deleted; orphan test + snapshot deleted; update-snapshots.mjs has working Phase 5+ synthetic-fixture branch; roadmap-analyze.json snapshot committed and contains a non-empty `phases[]` with the expected upstream key set. The contract Task 2/3 implements against is now in repo.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wave 0 — Write failing tests for roadmap.analyze (4 test files, all RED before Task 3)</name>
  <files>
    tests/shadow-tests/handler-roadmap-analyze.test.mjs,
    tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs,
    tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs,
    tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs
  </files>
  <read_first>
    - tests/shadow-tests/snapshots/roadmap-analyze.json (the contract — Task 1 captured this)
    - tests/shadow-tests/_parity-helpers.mjs (assertKeySetParityWithExt — Plan 02 added)
    - tests/shadow-tests/handler-phase-add.test.mjs (per-handler test pattern)
    - tests/shadow-tests/milestone-scoping.test.mjs (worktree topology pattern with `extensions.worktreeConfig=true` set BEFORE worktree add — T-04-19 mitigation)
    - tests/fixtures/seed-fixture.sh (restorer)
    - tests/fixtures/build-seed.sh (after Plan 01 edits — confirms 11 phases + 24 plans)
  </read_first>
  <behavior>
    **handler-roadmap-analyze.test.mjs (parity + happy + non-bd fall-through + stub-absence; 5+ cases):**

    - CASE 1 (PARITY red→green): Build a beads-managed fixture (seed-fixture.sh restore + create matching `.planning/phases/<dir>/` directories with `*-PLAN.md` files for the 7 v0.2 phases so disk_status can be derived). Set `git config --worktree gsd-beads.milestone v0.2`. Run shadow `query roadmap.analyze --project-dir <fixture>`. Load `snapshots/roadmap-analyze.json`. Assert `assertKeySetParityWithExt(actual.data, snapshot.data, ['drift', 'backend'])`. Assert `actual.data.backend === 'beads'`. Assert `Array.isArray(actual.data.phases) && actual.data.phases.length >= 1`. If `actual.data.phases.length > 0`, recursively assert `assertKeySetParityWithExt(actual.data.phases[0], snapshot.data.phases[0], [])` — every per-phase key from upstream must be present.

    - CASE 2 (current_phase / next_phase are NUMBER STRINGS, not bead IDs): Same fixture as CASE 1. Assert `actual.data.current_phase` is null OR `/^\d+(\.\d+)?$/` (matches phase number, NOT bead-ID format `sd-XXX`). Same for `next_phase`. SC #1 specific assertion.

    - CASE 3 (non-bd fixture passthrough): Use `mkdtempSync` without `bd init`. Run shadow `query roadmap.analyze --project-dir <fixture>`. Parse stdout. Assert `parsed.data?.backend !== 'beads'` (upstream's response, no backend marker). SC #5.

    - CASE 4 (stub absence): Run shadow with `GSD_SHADOW_TEST_STUB=1` env (formerly registered the stub). On a beads-managed fixture, query `_phase4-test-stub`. Assert dispatcher reaches "unknown command" path (resolveQueryArgv returns null → spawnUpstream fired). Pre-deletion this would have returned `{data:{ok:true,backend:'beads'}}`; after deletion, it falls through to upstream which doesn't know the command either. The exact stderr message can be matched: `assert.match(result.stderr, /unknown command|passing to upstream|not registered/)`. The point is to prove the env-gate dead-code path is gone.

    - CASE 5 (sentinel fall-through — replaces deleted Phase 4 CASE 6): Mock bd binary to return non-JSON output (e.g., shadow `bd` shim that exits 0 with `garbage`); the bd() helper throws BeadsCorrupt; dispatcher falls through to upstream. Assert `result.stderr` does NOT contain "dispatch failed" (sentinel is recognized; loud-fail not triggered). This preserves the BLOCKER-1 contract Phase 4 established.

    Use the multiMilestoneFixture pattern from milestone-scoping.test.mjs — co-located src + worktrees with proper `extensions.worktreeConfig=true` ordering.

    **handler-roadmap-analyze-counts.test.mjs (SC #2):**

    - CASE 1: On the v0.2 fixture (after Plan 01: 7 v0.2 phases + 24 plan children), `actual.data.total_plans === 24`. Verify against `bd count -l gsd:plan` output: `parseInt(execSync('bd count -l gsd:plan', { cwd: fixture }))` should equal `actual.data.total_plans`. SC #2 first half.

    - CASE 2: `actual.data.completed_phases === 0` for v0.2 (none closed). Verify against `bd list -l gsd:phase --status=closed -n 0 --json | jq length` (which should be 0 in v0.2-scoped view). SC #2 second half.

    - CASE 3: Switch worktree milestone to v0.1 (run regen-state.sh equivalent). Now `actual.data.completed_phases === 2` (both v0.1 phases closed). `actual.data.total_plans === 0` (no plan children attached to v0.1 phases in fixture).

    **handler-roadmap-analyze-milestone-scoping.test.mjs (D-19):**

    Mirror milestone-scoping.test.mjs topology (2 worktrees of 1 source repo, different gsd-beads.milestone configs):

    - CASE 1 (worktree A v0.2): Set `git config --worktree gsd-beads.milestone v0.2` in WT-A. Run shadow query roadmap.analyze in WT-A. Assert `actual.data.phases.every(p => p.number)` matches one of the 7 v0.2 phase numbers (03, 04, 05, 08, 09, 10, 11 in fixture mapping); NO v0.1 phase numbers (01, 02) appear; NO v0.3 phase numbers (06, 07) appear.

    - CASE 2 (worktree B v0.3): Same topology, WT-B has `gsd-beads.milestone=v0.3`. Run query. `actual.data.phases.length === 2`; phase numbers are 06 and 07 only. NO v0.2 phases.

    - CASE 3 (env override): Without git config, set `GSD_MILESTONE=v0.2` env var. Same scoping behavior as CASE 1.

    **handler-roadmap-analyze-drift.test.mjs (D-08..D-12):**

    - CASE 1 (plan_count drift): Build fixture with bd having 4 gsd:plan children for phase 5 (P23) but disk having only 3 *-PLAN.md files. Run query. Assert `actual.data.drift.length >= 1`; assert `actual.data.drift.some(d => d.kind === 'plan_count' && d.bd_value === 4 && d.disk_value === 3)`. Assert `result.stderr.match(/DRIFT: phase 5 plan_count bd=4 disk=3/)`.

    - CASE 2 (summary_count drift): Bd has gsd:plan child closed (per Q1 decision: summary_count from disk only — but for parent phase summary count, the spec uses *-SUMMARY.md count). Disk has 1 *-SUMMARY.md, bd-derived summary count for phase via "closed gsd:plan children" is 0 (or vice versa). Assert appropriate drift entry. NOTE: per Q1 Option A, summary_count IS disk count, so this test asserts that bd vs disk symmetry holds when both are computed from disk (always equal — drift never fires for summary_count). Reframe test: assert `actual.data.drift.every(d => d.kind !== 'summary_count')` on the canonical fixture (no synthetic divergence). The summary_count drift kind in detectDrift can still fire if a future plan re-introduces bd-side counting — leave the kind in place but document that it's dormant in v0.2.

    - CASE 3 (closed_without_summary): Build fixture with phase epic closed (`bd close <P11>`) and zero `*-SUMMARY.md` on disk for phase 1. Assert `actual.data.drift.some(d => d.kind === 'closed_without_summary' && d.phase === '1')`. Assert stderr contains `closed_without_summary`.

    - CASE 4 (completed_phases_mismatch — aggregate): Build fixture where 2 phase epics are bd-closed but only 1 phase dir has full *-SUMMARY.md coverage on disk. Assert `actual.data.drift.some(d => d.kind === 'completed_phases_mismatch' && d.phase === 'all')`. Assert stderr contains `completed_phases_mismatch`.

    - CASE 5 (no drift on canonical fixture): Build fixture matching disk to bd state perfectly. Assert `actual.data.drift.length === 0` AND `result.stderr.match(/DRIFT/) === null` (no drift output emitted). Proves drift detection isn't trigger-happy.

    All tests use `t.after()` teardown (Phase 4 PITFALLS recommendation; matches milestone-scoping.test.mjs pattern).

    Per D-26 (red phase): all 4 test files fail at end of Task 2 because Task 3 has not implemented `beadsRoadmapAnalyze` yet. Verify red signal by running.
  </behavior>
  <action>
    Create the 4 test files following the patterns from milestone-scoping.test.mjs and handler-_phase4-test-stub.test.mjs.

    Helper functions to factor out (in EACH test file or in a shared helper TBD):

    ```javascript
    function setupBdFixtureWithPhases(t) {
      // 1. mkdtemp
      // 2. bash seed-fixture.sh <tempdir>
      // 3. mkdir -p <tempdir>/.planning/phases/{01-spike,02-build-the-layer,...,11-hook-audit}
      // 4. For each phase, write *-PLAN.md files matching the seeded plan-children counts
      //    (so disk_status can resolve to 'planned' or 'partial' for parity)
      // 5. git init + extensions.worktreeConfig=true + git config --worktree gsd-beads.milestone v0.2
      // 6. t.after(() => rmSync(...))
      return { dir, phaseDirNames };
    }

    function runShadow(args, dir, env = {}) {
      return spawnSync('node', [SHADOW, ...args], { encoding: 'utf-8', cwd: dir, env: { ...process.env, ...env } });
    }
    ```

    Each test file:
    - imports test/assert/spawnSync/etc.
    - imports `assertKeySetParityWithExt` from `_parity-helpers.mjs` where used
    - has the helper functions (or imports from a new `_handler-test-helpers.mjs` if you prefer DRY; otherwise inline the ~30-line helper in each — choose based on whether the duplication exceeds ~3× — for 4 files duplication is fine if helpers stay small)

    Run all 4 test files; expect all to be RED:
    ```
    node --test tests/shadow-tests/handler-roadmap-analyze*.test.mjs
    ```

    Expected: every CASE fails (handler not implemented → upstream falls through → no `backend: 'beads'` → assertions on backend, drift, phases shape all fail).

    The error messages should pinpoint exactly which assertion to make pass. THIS IS THE CONTRACT for Task 3.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs 2>&amp;1 | tail -10 | tee /tmp/v.log; grep -E "fail [^0]" /tmp/v.log</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/shadow-tests/handler-roadmap-analyze.test.mjs` exists with ≥5 `test(` calls
    - File `tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs` exists with ≥3 `test(` calls
    - File `tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs` exists with ≥3 `test(` calls
    - File `tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs` exists with ≥5 `test(` calls
    - `grep -c "assertKeySetParityWithExt" tests/shadow-tests/handler-roadmap-analyze.test.mjs` returns ≥1 (proves the parity test uses the new extension API)
    - `grep -c "snapshots/roadmap-analyze.json" tests/shadow-tests/handler-roadmap-analyze.test.mjs` returns ≥1 (proves the test loads the captured snapshot)
    - `grep -c "extensions.worktreeConfig" tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs` returns ≥1 (T-04-19 mitigation)
    - `grep -c "t.after(" tests/shadow-tests/handler-roadmap-analyze*.test.mjs` returns ≥4 (every fixture cleaned up via the migration-recommended teardown)
    - At Task 2 completion (red phase): combined run produces ≥10 failures (handler not implemented yet)
  </acceptance_criteria>
  <done>4 test files committed; all assertions established; running them produces deterministic red signal that pinpoints what Task 3 must implement.</done>
</task>

<task type="auto">
  <name>Task 3: Implement beadsRoadmapAnalyze; turn Wave 0 GREEN</name>
  <files>bin/gsd-sdk-shadow.mjs</files>
  <read_first>
    - bin/gsd-sdk-shadow.mjs (current state after Task 1 stub deletion + Plan 02 helpers; identify insertion point for new handler — between findBeadsRoot/helpers section and BEADS_READ_OVERRIDES at line 287)
    - .planning/phases/05-roadmap-read-handlers/05-RESEARCH.md lines 860-980 (handler skeleton)
    - /home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js lines 373-492 (upstream contract)
    - /home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/helpers.js (phaseTokenMatches, planningPaths, comparePhaseNum, normalizePhaseName — what to dynamic-import)
    - All 4 test files from Task 2 (their assertions are the contract)
    - tests/shadow-tests/snapshots/roadmap-analyze.json (the parity contract)
  </read_first>
  <action>
    Implement `beadsRoadmapAnalyze` per RESEARCH §"Code Examples — Handler skeleton — beadsRoadmapAnalyze" (lines 866-975). Adapt for our key decisions:

    **Insertion location:** Between the Phase 5 helper section (Plan 02 added 4 helpers ending around new line ~325) and `BEADS_READ_OVERRIDES = {}` (was line 287, will be lower after helper insertions). Add a new comment header:

    ```javascript
    // ─── Phase 5 read handlers — REQ-READ-01..02 ───────────────────────────────
    // beadsRoadmapAnalyze: full milestone state from bd export (D-27, REQ-QUAL-07).
    // beadsRoadmapGetPhase: single-phase view (D-20).
    //
    // Pitfall 2 resolution (Plan 02): summary_count derives from DISK *-SUMMARY.md count.
    // The gsd:summary label does not exist in production (STACK.md verified against
    // tstl-sylvanas). plan_count remains bd-source via gsd:plan child grouping.
    ```

    **Implementation per RESEARCH skeleton, with concrete adjustments:**

    ```javascript
    import { readdir } from 'node:fs/promises';
    // (add at top of file with other imports)

    const HELPERS_PATH = `${SDK_BASE}/sdk/dist/query/helpers.js`;
    // (add near other path constants, line ~50)

    async function beadsRoadmapAnalyze(_args, projectDir, _workstream) {
      const { phaseTokenMatches, planningPaths, comparePhaseNum, normalizePhaseName } = await import(HELPERS_PATH);
      const phasesDir = planningPaths(projectDir).phases;

      // 1. Single bd export (D-27 budget: 1 of 2 spawns)
      const allBeads = bd(['export', '--json'], { cwd: projectDir });

      // bd export returns array; if it returned [] (truly empty store),
      // we still produce a well-formed empty-state response per Pitfall 6.
      // (BeadsEmpty sentinel only fires for bd's `{error, schema_version}` shape, handled in bd-helper.)

      if (!Array.isArray(allBeads)) {
        // Defensive — should be unreachable after bd-helper detection
        throw new BeadsCorrupt(`bd export --json returned non-array: ${typeof allBeads}`);
      }

      // 2. Single bd memories (D-27 budget: 2 of 2 spawns)
      let memories = {};
      try {
        const m = bd(['memories', '--json'], { cwd: projectDir });
        if (m && typeof m === 'object' && !Array.isArray(m)) {
          memories = m;
        }
      } catch (err) {
        // BeadsEmpty for memories is benign: no memories seeded yet, fall back to bare versions.
        if (!(err instanceof BeadsUnavailableError)) throw err;
      }

      // 3. Current-milestone scoping (D-19): git worktree config OR GSD_MILESTONE env
      let currentMilestone = process.env.GSD_MILESTONE;
      if (!currentMilestone) {
        const git = spawnSync('git', ['config', '--worktree', 'gsd-beads.milestone'], {
          cwd: projectDir, encoding: 'utf-8'
        });
        currentMilestone = (git.stdout ?? '').trim() || null;
      }

      // 4. Filter phase beads to current milestone (D-19)
      let phaseBeads = allBeads.filter(b =>
        b.labels?.includes('gsd:phase') &&
        (!currentMilestone || b.labels?.includes(`version:${currentMilestone}`))
      );

      // 5. Sort by phase-id (D-28: priority, created_at, id tie-breaks)
      phaseBeads.sort((a, b) => {
        const numA = parsePhaseId(a.labels?.find(l => l.startsWith('phase-id:')));
        const numB = parsePhaseId(b.labels?.find(l => l.startsWith('phase-id:')));
        const cmp = comparePhaseNum(numA ?? '', numB ?? '');
        if (cmp !== 0) return cmp;
        const priDiff = (a.priority ?? 1) - (b.priority ?? 1);
        if (priDiff !== 0) return priDiff;
        if (a.created_at < b.created_at) return -1;
        if (a.created_at > b.created_at) return 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

      // 6. Group plan children by parent (in-memory, no extra spawns)
      const plansByPhase = {};
      for (const b of allBeads) {
        const parentLink = b.dependencies?.find(d => d.type === 'parent-child' && d.depends_on_id !== b.id);
        if (!parentLink) continue;
        const pid = parentLink.depends_on_id;
        if (b.labels?.includes('gsd:plan')) {
          plansByPhase[pid] = (plansByPhase[pid] || 0) + 1;
        }
      }

      // 7. Per-phase disk I/O + status derivation
      const driftEntries = [];
      const phases = [];
      for (const bead of phaseBeads) {
        const phaseNum = parsePhaseId(bead.labels?.find(l => l.startsWith('phase-id:')));
        if (!phaseNum) continue;  // skip phases without phase-id label

        const normalized = normalizePhaseName(phaseNum);
        let dirExists = false, diskPlanCount = 0, diskSummaryCount = 0, hasContext = false, hasResearch = false;
        try {
          const entries = await readdir(phasesDir, { withFileTypes: true });
          const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
          const dirMatch = dirs.find(d => phaseTokenMatches(d, normalized));
          if (dirMatch) {
            dirExists = true;
            const phaseFiles = await readdir(`${phasesDir}/${dirMatch}`);
            diskPlanCount = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
            diskSummaryCount = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
            hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
            hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
          }
        } catch { /* phasesDir may not exist; fields remain default */ }

        const planCount = plansByPhase[bead.id] || 0;
        // Q1 Option A: summary_count from disk (NOT bd) — matches upstream parity
        const summaryCount = diskSummaryCount;

        const diskStatus = deriveDiskStatus({ planCount, summaryCount, hasContext, hasResearch, dirExists });

        // Drift: bd plan_count vs disk *-PLAN.md count; closed-without-summary
        driftEntries.push(...detectDrift(phaseNum,
          { plan_count: planCount, summary_count: summaryCount, bd_status: bead.status },
          { disk_plan_count: diskPlanCount, disk_summary_count: diskSummaryCount, disk_status: diskStatus }
        ));

        // Goal/depends_on from bead description
        const desc = bead.description ?? '';
        const goalMatch = desc.match(/^Goal:\s*(.+)$/m);
        const dependsMatch = desc.match(/^Depends on:\s*(.+)$/m);

        // Strip "Phase NN: " prefix from name if present (matches upstream phasePattern capture group 2)
        const name = bead.title.replace(/^v?\d+(\.\d+)?\s+Phase\s+[A-Z]?\d*:\s*/, '')
                                .replace(/^Phase\s+\d+(\.\d+)?:\s*/, '');

        phases.push({
          number: phaseNum,
          name,
          goal: goalMatch ? goalMatch[1].trim() : null,
          depends_on: dependsMatch ? dependsMatch[1].trim() : null,
          plan_count: planCount,
          summary_count: summaryCount,
          has_context: hasContext,
          has_research: hasResearch,
          disk_status: diskStatus,
          roadmap_complete: bead.status === 'closed',
        });
      }

      // 8. Milestones (D-15..D-17)
      const versionSet = new Set(phaseBeads.flatMap(b => b.labels?.filter(l => l.startsWith('version:')) ?? []));
      const milestones = [...versionSet].map(vLabel => {
        const version = vLabel.replace(/^version:/, '');
        return { heading: loadMilestoneHeading(memories, version), version };
      });

      // 9. Aggregates + selection (D-21)
      const totalPlans = phases.reduce((s, p) => s + p.plan_count, 0);
      const totalSummaries = phases.reduce((s, p) => s + p.summary_count, 0);
      // D-14: completed_phases from bd (closed phase epics in current-milestone scope)
      const completedPhases = phases.filter(p => p.roadmap_complete).length;
      const currentPhaseObj = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null;
      const nextPhaseObj = phases.find(p => ['empty','no_directory','discussed','researched'].includes(p.disk_status)) || null;

      // 10. Aggregate drift: completed_phases_mismatch
      const diskCompleteCount = phases.filter(p => p.disk_status === 'complete').length;
      if (completedPhases !== diskCompleteCount) {
        console.error(`[gsd-shadow] DRIFT: completed_phases_mismatch bd=${completedPhases} disk=${diskCompleteCount}`);
        driftEntries.push({ phase: 'all', kind: 'completed_phases_mismatch', bd_value: completedPhases, disk_value: diskCompleteCount });
      }

      return { data: {
        milestones,
        phases,
        phase_count: phases.length,
        completed_phases: completedPhases,
        total_plans: totalPlans,
        total_summaries: totalSummaries,
        progress_percent: totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0,
        current_phase: currentPhaseObj ? currentPhaseObj.number : null,
        next_phase: nextPhaseObj ? nextPhaseObj.number : null,
        missing_phase_details: null,
        backend: 'beads',
        drift: driftEntries,
      }};
    }
    ```

    **Register in BEADS_READ_OVERRIDES table:**

    ```javascript
    export const BEADS_READ_OVERRIDES = {
      'roadmap.analyze': beadsRoadmapAnalyze,
      // 'roadmap.get-phase' added in Plan 04
    };
    ```

    **Run all 4 Wave 0 tests; iterate until GREEN:**

    ```
    node --test tests/shadow-tests/handler-roadmap-analyze*.test.mjs
    ```

    If a CASE fails, the assertion message pinpoints the gap. Fix the handler and re-run. Common iteration points:
    - Phase title regex stripping (CASE 1 parity may complain about `name` field including/excluding "Phase NN: " prefix)
    - Milestone heading format (CASE 1 parity asserts `milestones[0].heading` matches upstream's "Milestone v0.2 — Beads-backed reads" format)
    - Sentinel fall-through (CASE 5): if mock-bd test path fails, ensure the handler does NOT swallow BeadsCorrupt — let it propagate to dispatcher which falls through

    **Verify call count (REQ-QUAL-07 precursor — full assertion lands in Plan 05):**

    `grep -c "bd(\['export'" bin/gsd-sdk-shadow.mjs` should return 1 (single export call in handler body).
    `grep -c "bd(\['memories'" bin/gsd-sdk-shadow.mjs` should return 1 (single memories call).
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs tests/shadow-tests/handler-roadmap-analyze-counts.test.mjs tests/shadow-tests/handler-roadmap-analyze-milestone-scoping.test.mjs tests/shadow-tests/handler-roadmap-analyze-drift.test.mjs 2>&amp;1 | tail -10 | tee /tmp/v.log; grep -E "fail 0" /tmp/v.log</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "async function beadsRoadmapAnalyze" bin/gsd-sdk-shadow.mjs` returns 1
    - `grep -c "'roadmap.analyze': beadsRoadmapAnalyze" bin/gsd-sdk-shadow.mjs` returns 1 (registered in BEADS_READ_OVERRIDES)
    - `grep -c "bd(\\['export'" bin/gsd-sdk-shadow.mjs` returns 1 (single export call — REQ-QUAL-07 precursor)
    - `grep -c "bd(\\['memories'" bin/gsd-sdk-shadow.mjs` returns 1 (single memories call — staying within ≤2 spawn budget)
    - `grep -c "bd(\\['children'" bin/gsd-sdk-shadow.mjs` returns 0 (NO per-phase fan-out — Pitfall 3 mitigation)
    - All 4 Wave 0 test files green: `node --test tests/shadow-tests/handler-roadmap-analyze*.test.mjs` exits 0 with "fail 0"
    - Full Phase 4 + Plan 02 helper suite still green: `node --test tests/shadow-tests/*.test.mjs` exits 0
    - bd allowlist intact: `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0 (no new write-side bd calls in handler)
    - seed-determinism still green: `bash tests/shadow-tests/seed-determinism.test.sh` exits 0
    - Lockfile pin still green: `bash tests/install-tests/upstream-version-pin.test.sh` exits 0
  </acceptance_criteria>
  <done>beadsRoadmapAnalyze implemented and registered; all Wave 0 tests green; full suite green; bd subcommand usage stays within `export, memories` allowlist subset; ≤2 spawns per invocation verified by grep.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Shadow CLI argv → bd | argv parsed by registry; `--project-dir` validated by existsSync (Phase 4 inheritance); bd args constructed as JS array (no shell) |
| bd export JSON → handler | parsed by bd-helper.mjs which throws sentinels on corruption (BeadsCorrupt) |
| Disk readdir → phase metadata | readdir is async; errors caught and treated as "phase dir absent" (no crash) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | bd export argument injection | accept | roadmap.analyze is argless; no user input flows into `bd export` args |
| T-05-06 | Information Disclosure | drift stderr lines + drift[] field | accept | Drift output contains phase numbers + integer counts; no sensitive data |
| T-05-07 | Denial of Service | Large bd export blocking | mitigate | Single export call (D-27); REQ-QUAL-07 precursor in Plan 05 asserts ≤2 spawns + 500ms budget on 50-phase fixture |
| T-05-08 | Tampering | git config --worktree milestone value | mitigate | Value is read by spawnSync (no shell); used only as label-filter string (no interpolation into bd args beyond `version:<value>` label string) |
</threat_model>

<verification>
After all 3 tasks:
- All 4 new handler test files green (~20+ cases)
- Full shadow test suite green (`node --test tests/shadow-tests/*.test.mjs` exits 0)
- bd allowlist grep test green
- seed-determinism + memories-seeded + upstream-version-pin all green
- `_phase4-test-stub` references absent from bin/, tests/, snapshots/
- Manual smoke: `cd <gsd-beads repo>; node bin/gsd-sdk-shadow.mjs query roadmap.analyze --project-dir .` returns a JSON response with `backend: 'beads'`, ≥1 phase, valid current_phase/next_phase fields
</verification>

<success_criteria>
- REQ-READ-01 satisfied: 10 top-level keys + 10 per-phase keys + backend + drift on a beads-managed fixture (SC #1)
- SC #2: total_plans matches `bd count -l gsd:plan`; completed_phases matches bd-closed phase count
- SC #4: parity snapshot file exists in repo BEFORE handler implementation (verified by git log if needed)
- SC #5: non-bd fixture returns response without `backend: 'beads'` (passthrough)
- D-19 milestone scoping: WT-A v0.2 ≠ WT-B v0.3 in returned phases[]
- D-08..D-12 drift: drift[] populated when bd-vs-disk diverges; stderr emits per-drift line; reads keep working
- _phase4-test-stub block + test file + snapshot all removed
</success_criteria>

<output>
After completion, create `.planning/phases/05-roadmap-read-handlers/05-03-SUMMARY.md` documenting:
- Final handler line range in bin/gsd-sdk-shadow.mjs
- Snapshot capture: synthetic fixture topology (.beads/ + synthetic ROADMAP.md), upstream output captured at version 0.1.0
- Pitfall 2 resolution applied: handler doc-comment notes "summary_count from disk; gsd:summary label not in production"
- Stub deletion confirmed: 0 references in bin/, tests/, snapshots/
- Sentinel fall-through: handler does NOT catch BeadsUnavailableError; dispatcher's existing catch (line ~402) handles fall-through
- Wave 0 → GREEN transition: 4 test files written red first, then handler made each pass deterministically
</output>
