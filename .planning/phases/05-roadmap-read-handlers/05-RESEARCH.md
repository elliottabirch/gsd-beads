# Phase 5: roadmap.* read handlers — Research

**Researched:** 2026-04-29
**Domain:** gsd-sdk shadow — first two real bd-backed read handlers (`roadmap.analyze` + `roadmap.get-phase`)
**Confidence:** HIGH — all claims grounded in upstream source code, Phase 4 delivered artifacts, and verified spike findings

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase identity (Area 1)**
- D-01: `phase-id:NN` label is the canonical phase identifier. Storage zero-padded (`phase-id:05`); decimal phases via `.` (`phase-id:72.1`); widen to 3-digit at 100+.
- D-02: Output strips padding via `parsePhaseId()` helper. Storage: `phase-id:05`. Output: `current_phase: "5"`, `phases[].number: "5"`. Helper: `label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1')`.
- D-03: Phase 5 deliverable: edit `tests/fixtures/build-seed.sh` to emit `phase-id:01..phase-id:07` on the existing 7 phases. Regenerate `seed.jsonl`; verify reproducibility via `seed-determinism.test.sh`.
- D-04: `/gsd-beads-add-phase` skill must write `phase-id:NN` going forward. Out of Phase 5 scope but flagged.

**disk_status mapping (Area 2)**
- D-05: Full 7-value parity with upstream: `complete | partial | planned | empty | discussed | researched | no_directory`.
- D-06: bd is source of truth for count-derived fields; disk is source of truth for narrative-derived fields. `plan_count` ← `bd children <phase> -l gsd:plan` count. `summary_count` ← `bd children <phase> -l gsd:summary` count. `has_context` ← `phases/<dir>/*-CONTEXT.md` presence. `has_research` ← `phases/<dir>/*-RESEARCH.md` presence.
- D-07: disk_status derivation priority: (1) `complete` — plan_count>0 && summary_count>=plan_count; (2) `partial` — summary_count>0; (3) `planned` — plan_count>0; (4) `researched` — has_research; (5) `discussed` — has_context; (6) `empty` — dir exists but nothing else; (7) `no_directory` — phase dir absent.

**Drift detection (Area 2 mechanism)**
- D-08: bd is canonical for emitted values; drift detection runs in parallel and reports divergence.
- D-09: Drift surfaces via TWO channels: (1) stderr line per drift case; (2) `drift[]` array in response data.
- D-10: Drift kinds detected: `plan_count`, `summary_count`, `closed_without_summary`, `completed_phases_mismatch`.
- D-11: Natural asymmetries (do NOT alert): phase dir absent for an open phase; CONTEXT.md or RESEARCH.md without bd children.
- D-12: No hard fail. Soft alert only; reads keep working when drift exists. `BeadsDriftError` sentinel is NOT introduced.
- D-13: `_parity-helpers.mjs` whitelist treatment. `drift[]` is a bd-backend-only key; parity test must treat it as backend extension.

**completed_phases (Area 3)**
- D-14: `completed_phases = phases.filter(p => p.bd_status === 'closed').length`. Auto-close via `scripts/cascade-loop.sh`.

**milestones[] (Area 4)**
- D-15: One entry per distinct `version:vX.Y` label found across phase epics in the current-milestone slice.
- D-16: Heading from bd memory key `gsd-beads:milestone:<version>:heading`.
- D-17: Fallback to bare `vX.Y` when no memory key exists. Log stderr note.
- D-18: `build-seed.sh` seeds the memory via `BEADS_ACTOR=seed bd remember 'gsd-beads:milestone:vX.Y:heading' '<name>'`.

**Current-milestone scoping (carry-forward from Phase 4 D-05)**
- D-19: Current milestone read from `git config --worktree gsd-beads.milestone` (or `${GSD_MILESTONE:-}` override). Filter phase epics by `version:<current-milestone>` label.

**roadmap.get-phase argument semantics**
- D-20: Accepts numeric phase identifiers only. On unmatched: return `{ data: { found: false, phase_number: arg } }`.

**current_phase / next_phase selection**
- D-21: Mirror upstream exactly. `current_phase` = first phase where `disk_status === 'planned' || 'partial'`. `next_phase` = first phase where `disk_status === 'empty' || 'no_directory' || 'discussed' || 'researched'`. Both emit phase number strings, never bead IDs.

**Carried forward from Phase 4 (do NOT re-decide)**
- D-22: `BEADS_READ_OVERRIDES` table; reads register without `wrapMutation`.
- D-23: Sentinel-aware dispatch; `BeadsEmpty`/`BeadsCorrupt` fall through to upstream.
- D-24: `findBeadsRoot()` with BEADS_DIR/parent-walk/symlink rules.
- D-25: `bd()` helper throws sentinels; handlers stay clean.
- D-26: Snapshot parity test FIRST (red→green) per REQ-QUAL-01.
- D-27: Single `bd export --json` call per handler invocation; no caching.
- D-28: Sort by `priority, created_at, id` for deterministic ordering.
- D-29: Hook-allowlist `bd` subcommands only: `list, show, ready, memories, status, prime, export, deps, children, search`.

### Claude's Discretion
- **Heading string assembly format** — exact byte-for-byte format to match upstream's milestonePattern output.
- **`drift[]` parity-helper API** — the exact API shape (extending `assertKeySetParity` signature vs `assertKeySetParityWithExt` vs known-extensions list).
- **`bd memories --json` invocation strategy** — whether to call once per `roadmap.analyze` or amortize through the same `bd export` call.
- **Decimal phase ordering** — numeric coercion for sort.

### Deferred Ideas (OUT OF SCOPE)
- `/gsd-beads-new-milestone` skill that writes the milestone-heading memory.
- `/gsd-beads-add-phase` writing `phase-id:NN`.
- `regen-roadmap.sh` round-trip discipline for `phase-id:NN` (Phase 6 owns).
- `BeadsDriftError` sentinel.
- Caching across handler invocations.
- Refactor of `isBeadsManaged()` to delegate to `findBeadsRoot()`.
- `progress.*` handlers (Phase 6), `find-phase`/`phases.list`/`phase.next-decimal`/`phase-plan-index` (Phase 8), `state-snapshot`/`state.json`/`state.load` (Phase 7), `init.*` handlers (Phase 9).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-READ-01 | `roadmap.analyze` returns bd-derived state with full upstream shape (10 top-level keys + 10 per-phase keys including `disk_status`). `current_phase` / `next_phase` are phase numbers, never bead IDs. | Upstream shape fully documented in §Upstream Output Shapes. `phase-id:NN` label strategy resolves IDs. Disk correlation for `has_context`/`has_research`/`disk_status` documented. |
| REQ-READ-02 | `roadmap.get-phase <N>` returns single-phase view using same parsing helpers as REQ-READ-01. | Upstream `roadmapGetPhase` returns a different shape than `roadmapAnalyze` phases array; both documented. Shared helpers identified. |
| REQ-QUAL-01 | Output shape parity with upstream verified by snapshot tests written BEFORE handler implementation (red→green). | `_parity-helpers.mjs` + `update-snapshots.mjs` SNAPSHOTS array from Phase 4 provide the harness. Extension point for Phase 5 documented. `drift[]` whitelist treatment in §Drift Detection. |
| REQ-QUAL-02 | Read-shaped fallback contract — graceful degradation via `BeadsUnavailableError` sentinel. | Phase 4 dispatcher catch already wired. `bd()` helper throws sentinels. Handlers stay clean. |
| REQ-QUAL-03 | `findBeadsRoot()` replaces `isBeadsManaged()` for reads. | Phase 4 shipped and verified. Phase 5 handlers call `findBeadsRoot(projectDir)` before any bd invocation (though the main dispatch guard still uses `isBeadsManaged()`; handlers use `findBeadsRoot` for the `phasesDir` resolution). |
</phase_requirements>

---

## Summary

Phase 5 implements the first two real bd-backed read handlers — `roadmap.analyze` and `roadmap.get-phase` — on the foundation Phase 4 shipped. The work divides into five concerns: (1) seed fixture migration to add `phase-id:NN` labels and milestone-heading memories, (2) shared helper functions (`parsePhaseId`, `deriveDiskStatus`, `detectDrift`, `loadMilestoneHeading`), (3) the `roadmap.analyze` handler with snapshot parity test, (4) the `roadmap.get-phase` handler with parity test, and (5) integration tests covering the 11-phase / 24-plan fixture required by SC #2.

The central technical challenge is that upstream's `roadmapAnalyze` derives phase data from ROADMAP.md markdown parsing, while the bd-backed version must derive the same 10-key-per-phase shape from `bd export --json` in a single call. The parity contract is strict: same key names, same enum vocabulary for `disk_status`, same `current_phase`/`next_phase` selection logic. The only permitted divergence is `backend: 'beads'` and the bd-only `drift[]` field.

**Primary recommendation:** Single `bd export --json` call + one `bd memories --json` call per handler invocation. In-memory grouping by label. Sort by `priority, created_at, id`. Disk I/O for `has_context`/`has_research` via `fs/promises.readdir`. Write parity snapshot tests before any handler code.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phase identity lookup (`phase-id:NN`) | bd store | — | Labels are bd's authoritative state; disk directories may not exist yet |
| `plan_count` / `summary_count` | bd store (child beads with `gsd:plan` / `gsd:summary` labels) | — | D-06: bd is source of truth for count-derived fields |
| `has_context` / `has_research` | Disk filesystem | — | D-06: disk is source of truth for narrative-derived fields; bd has no analog |
| `disk_status` derivation | Derived (bd counts + disk presence) | — | D-07 priority chain combines both sources |
| `current_phase` / `next_phase` | Derived (disk_status chain) | — | D-21: mirror upstream's exact selection logic |
| `milestones[]` heading | bd memory store (`gsd-beads:milestone:vX.Y:heading`) | Fallback to bare version string | D-16/D-17 |
| Current-milestone scoping | Git worktree config (`git config --worktree gsd-beads.milestone`) | `${GSD_MILESTONE:-}` env override | D-19 |
| Drift detection | In-handler comparison (bd counts vs disk counts) | stderr + `drift[]` response field | D-08..D-12 |
| `completed_phases` | bd store (`status=closed` filter) | — | D-14: matches `bd list -l gsd:phase --status=closed -n 0 --json` count |

---

## Standard Stack

### Core (no new dependencies — all from Phase 4)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bd` CLI | `>= 1.0.3` | Source of truth for phase/plan/todo state + memory store | Pinned via `gsd-sdk-cc.version.lock`; all Phase 4 handlers use it |
| `node:child_process.spawnSync` | Node 20+ | bd invocation via `bd()` helper from `bin/bd-helper.mjs` | Throws sentinel subtypes on failure; handlers stay clean (D-25) |
| `node:fs/promises.readdir` | Node 20+ | Disk correlation for `has_context`, `has_research`, disk file counts | Async readdir to avoid blocking event loop during disk I/O |
| `node:fs.existsSync` | Node 20+ | Phase directory presence check for `disk_status: 'no_directory'` | Synchronous; already in shadow |
| `node:path.join` | Node 20+ | Path construction for `phasesDir` resolution | Already in shadow |

**Installation:** No new packages. Verify:

```bash
node --version   # >= 20
bd --version     # 1.0.3 or newer
```

[VERIFIED: `/home/ellio/code/gsd-beads/bin/bd-helper.mjs` — `spawnSync` only, zero `execSync`]
[VERIFIED: `bin/gsd-sdk-shadow.mjs` imports `existsSync, realpathSync, statSync, readFileSync` from `node:fs`]
[VERIFIED: `bin/gsd-sdk-shadow.mjs` — Phase 4 shipped `findBeadsRoot`, `BEADS_READ_OVERRIDES`, sentinel dispatch]

---

## Architecture Patterns

### System Architecture Diagram

```
gsd-sdk query roadmap.analyze --project-dir <bd-fixture>
        |
        v
[isBeadsManaged(projectDir)] → false → spawnUpstream(argv)
        |
        v (true: bd-managed project)
[createRegistry + BEADS_READ_OVERRIDES registration (no wrapMutation)]
        |
        v
[resolveQueryArgv → 'roadmap.analyze']
        |
        v
beadsRoadmapAnalyze([], projectDir)
        |
        +--[1] bd(['export','--json'], {cwd:projectDir})   ← 1 spawn
        |          |
        |          v
        |    filter: labels.includes('gsd:phase')
        |    filter: labels.includes('version:<currentMilestone>')
        |    sort: priority asc → created_at asc → id asc
        |
        +--[2] bd(['memories','--json'], {cwd:projectDir}) ← 1 spawn
        |          |
        |          v
        |    find key 'gsd-beads:milestone:<version>:heading'
        |    fallback to bare version string
        |
        +--[3] For each phase bead (in-memory, no extra spawns):
        |          - groupBy phase bead id → gsd:plan children (filtered from export)
        |          - groupBy → gsd:summary children
        |          - readdir(phases/<dir>) for has_context, has_research, disk counts
        |          - deriveDiskStatus(bd_plan_count, bd_summary_count, has_context, has_research, dir_exists)
        |          - detectDrift(phase, bd_state, disk_state) → drift[]
        |
        v
{ data: { milestones, phases, phase_count, completed_phases, total_plans,
          total_summaries, progress_percent, current_phase, next_phase,
          missing_phase_details, backend: 'beads', drift: [...] } }
        |
        v
JSON.stringify → stdout
```

### Recommended Project Structure

```
bin/
├── gsd-sdk-shadow.mjs    # Phase 5 adds beadsRoadmapAnalyze + beadsRoadmapGetPhase
│                         # + shared helpers: parsePhaseId, deriveDiskStatus,
│                         # detectDrift, loadMilestoneHeading
│                         # Phase 5 FIRST TASK: delete _phase4-test-stub block (lines 290-300)
├── bd-helper.mjs         # Unchanged (consume bd() from here)
└── beads-errors.mjs      # Unchanged (sentinel hierarchy)

tests/
├── fixtures/
│   ├── build-seed.sh     # D-03/D-18: add phase-id:NN labels + milestone-heading memories
│   └── seed.jsonl        # Regenerated after build-seed.sh edit
├── scripts/
│   └── update-snapshots.mjs  # Phase 5: push 2 entries (roadmap-analyze, roadmap-get-phase)
└── shadow-tests/
    ├── _parity-helpers.mjs   # D-13: extend to whitelist drift[] as bd-backend-only key
    ├── snapshots/
    │   ├── _phase4-test-stub.json   # Existing
    │   ├── roadmap-analyze.json     # Phase 5: new (from upstream against seeded fixture)
    │   └── roadmap-get-phase.json   # Phase 5: new
    ├── handler-roadmap-analyze.test.mjs     # Phase 5: new (parity first, then happy/error)
    └── handler-roadmap-get-phase.test.mjs   # Phase 5: new
```

---

## Upstream Output Shapes (the contract Phase 5 MUST match)

[VERIFIED: `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js` lines 480-492]

### `roadmap.analyze` — top-level shape

```javascript
{ data: {
    milestones: [{ heading: string, version: string }],    // e.g. [{heading:"Milestone v0.2 — Beads-backed reads", version:"v0.2"}]
    phases: [ /* see per-phase shape below */ ],
    phase_count: number,            // integer
    completed_phases: number,       // integer
    total_plans: number,            // integer (sum of plan_count across phases)
    total_summaries: number,        // integer (sum of summary_count across phases)
    progress_percent: number,       // 0..100, Math.round((total_summaries/total_plans)*100)
    current_phase: string | null,   // phase NUMBER string e.g. "5", never bead ID
    next_phase: string | null,      // phase NUMBER string or null
    missing_phase_details: string[] | null,  // null when no malformed ROADMAP
    // bd-backend additions (not in upstream):
    backend: 'beads',
    drift: DriftEntry[],
}}
```

### `roadmap.analyze` — per-phase sub-shape (10 keys)

```javascript
{
    number: string,         // "5" or "72.1" — stripped of padding via parsePhaseId()
    name: string,           // bead title (stripped of "Phase NN: " prefix if present)
    goal: string | null,    // parsed from bead description "Goal:" line
    depends_on: string | null,  // from "Depends on:" line in description
    plan_count: number,     // count of gsd:plan child beads (from bd export, grouped)
    summary_count: number,  // count of gsd:summary child beads
    has_context: boolean,   // disk: phases/<dir>/*-CONTEXT.md or CONTEXT.md exists
    has_research: boolean,  // disk: phases/<dir>/*-RESEARCH.md or RESEARCH.md exists
    disk_status: 'complete' | 'partial' | 'planned' | 'researched' | 'discussed' | 'empty' | 'no_directory',
    roadmap_complete: boolean,  // true when bd_status === 'closed'
}
```

### `roadmap.get-phase <N>` — NOT the same as phases[] element

[VERIFIED: `roadmap.js` lines 337-362 — `roadmapGetPhase` is built from `searchPhaseInContent()`, not from the phase loop]

`roadmap.get-phase` returns a DIFFERENT shape than `roadmap.analyze.phases[]`. The upstream implementation searches ROADMAP.md for a Phase heading and extracts the section:

```javascript
{ data: {
    found: true,
    phase_number: string,       // e.g. "5"
    phase_name: string,         // e.g. "roadmap.* read handlers"
    goal: string | null,
    success_criteria: string[], // array of strings parsed from "Success Criteria" list
    section: string,            // full raw markdown section text
}}
// On unmatched:
{ data: { found: false, phase_number: arg } }
```

**Critical:** `roadmap.get-phase` returns `success_criteria` (an array) and `section` (raw markdown), which are NOT in the `roadmap.analyze.phases[]` sub-shape. Phase 5 MUST match both shapes independently.

### Upstream helpers — importable vs reimplemented

[VERIFIED: `helpers.js` full source read]

| Helper | Exported? | Importable from shadow? | Phase 5 action |
|--------|-----------|------------------------|----------------|
| `normalizePhaseName(phase)` | Yes (exported) | Yes — shadow already imports from upstream's dist path | Reimplement as local `parsePhaseId()` per D-02 (different padding behavior needed) |
| `phaseTokenMatches(dirName, normalized)` | Yes (exported) | Yes | Reuse directly for `phases/<dir>` directory matching |
| `planningPaths(projectDir, workstream)` | Yes (exported) | Yes | Reuse for `phasesDir` resolution |
| `extractCurrentMilestone(content, projectDir)` | Yes (exported) | Yes | NOT used — Phase 5 scopes via `version:<milestone>` label filter on beads, not ROADMAP.md parsing |
| `comparePhaseNum(a, b)` | Yes (exported) | Yes | Use for stable sort of decimal phase numbers |

**Import path for helpers:**

```javascript
// The shadow already imports from this module path:
const QUERY_INDEX_PATH = `${SDK_BASE}/sdk/dist/query/index.js`;
const REGISTRY_PATH = `${SDK_BASE}/sdk/dist/query/registry.js`;
// For helpers: add
const HELPERS_PATH = `${SDK_BASE}/sdk/dist/query/helpers.js`;
// Then: const { phaseTokenMatches, planningPaths, comparePhaseNum } = await import(HELPERS_PATH);
```

---

## milestones[] Assembly — Upstream Pattern Analysis

[VERIFIED: `roadmap.js` lines 455-463]

Upstream's `roadmap.analyze` assembles `milestones[]` by running this regex over the ROADMAP.md content:

```javascript
const milestonePattern = /##\s*(.*v(\d+(?:\.\d+)+)[^(\n]*)/gi;
// Match: "## Milestone v0.2 — Beads-backed reads"
// Capture group 1: "Milestone v0.2 — Beads-backed reads"  → heading
// Capture group 2: "0.2"                                   → version becomes "v0.2"
```

The heading emitted is the full matched text: `"Milestone v0.2 — Beads-backed reads"`.

**Phase 5 bd-backend assembly (D-15..D-17):**

The bd-backend must produce the same `{ heading: string, version: string }` shape. Sources:
- `version`: the `vX.Y` string from the `version:vX.Y` label (e.g. `version:v0.2` → `"v0.2"`)
- `heading`: from bd memory `gsd-beads:milestone:v0.2:heading` = `"Beads-backed reads"`, assembled as `"Milestone v0.2 — Beads-backed reads"` to match upstream regex output format

**Heading format to match upstream:** `"Milestone <version> — <heading-from-memory>"`

This matches the pattern upstream's regex captures: `## Milestone v0.2 — Beads-backed reads` produces `heading = "Milestone v0.2 — Beads-backed reads"` and `version = "v0.2"`. The bd-backed handler must produce the same string.

**Call strategy (D-16 / Claude's Discretion):** A separate `bd memories --json` call is required. Memories are NOT included in `bd export --json` output in the same object structure — `bd export` JSONL format includes memories as separate JSONL lines with `_type: "memory"` (per Spike 004: "bd export includes memories by default"), but when using `bd export --json` (not JSONL), the output is an array of issue objects only. The memory key-value data is only available via `bd memories --json`. Therefore: **2 bd spawns per `roadmap.analyze` invocation** — one `bd export --json`, one `bd memories --json`. This satisfies D-27 (single export call) and stays within REQ-QUAL-07 (≤2 spawns confirmed by Phase 11's test).

[VERIFIED: Spike 004 source — "bd export exports all issues (plus memories, by default) as JSONL where each line is one issue"]
[VERIFIED: STACK.md — "bd memories --json returns JSON OBJECT (map of key → value-string). Critical: this is NOT an array"]
[ASSUMED: `bd export --json` (JSON array mode, not JSONL mode) returns issues only, not memories. The JSONL export mode includes memories as separate lines. The `--json` flag produces the same array-of-issues shape confirmed in seed.jsonl. A separate `bd memories --json` call is always needed.]

---

## build-seed.sh Edits (D-03, D-18)

[VERIFIED: `tests/fixtures/build-seed.sh` — current structure, 7 phases across v0.1/v0.2/v0.3]

### D-03: Add `phase-id:NN` labels to existing 7 phase epics

After each `bd label add "$PXX" version:vX.Y`, add:

```bash
BEADS_ACTOR=seed bd label add "$P11" phase-id:01 >/dev/null
BEADS_ACTOR=seed bd label add "$P12" phase-id:02 >/dev/null
BEADS_ACTOR=seed bd label add "$P21" phase-id:03 >/dev/null   # or :04 per desired mapping
BEADS_ACTOR=seed bd label add "$P22" phase-id:04 >/dev/null
BEADS_ACTOR=seed bd label add "$P23" phase-id:05 >/dev/null
BEADS_ACTOR=seed bd label add "$P31" phase-id:06 >/dev/null
BEADS_ACTOR=seed bd label add "$P32" phase-id:07 >/dev/null
```

**Note:** The exact `phase-id:` assignment (which variable gets which number) is a plan-phase call — the numbers just need to be unique and ordered. The research recommends aligning with narrative sequence (v0.1-A=01, v0.1-B=02, v0.2-A=03...).

### D-18: Seed milestone-heading memories

Add BEFORE the final `bd export --json` call:

```bash
# Milestone heading memories (D-18): seeded so Phase 5 tests cover happy-path + fallback
BEADS_ACTOR=seed bd remember 'gsd-beads:milestone:v0.1:heading' 'Foundation' >/dev/null
BEADS_ACTOR=seed bd remember 'gsd-beads:milestone:v0.2:heading' 'Beads-backed reads' >/dev/null
# v0.3 deliberately omitted to test the fallback path (D-17: fallback to bare "v0.3")
```

**Determinism guarantee:** `bd remember` with the same key and value on the same bd init is idempotent — a second `build-seed.sh` run produces the same `seed.jsonl` (D-07). `seed-determinism.test.sh` must continue to pass after this edit.

[VERIFIED: `BEADS_ACTOR=seed` pattern confirmed in existing `build-seed.sh` — all calls use this prefix]
[ASSUMED: `bd remember --key 'gsd-beads:milestone:v0.1:heading' 'Foundation'` is the correct invocation syntax. The SKILL.md references `bd remember 'key' 'value'` form (no `--key` flag). Verify against `bd remember --help` during implementation.]

---

## Shared Helper Functions (Phase 5 writes to bin/gsd-sdk-shadow.mjs)

### `parsePhaseId(label)` — D-02

```javascript
// Input: "phase-id:05" or "phase-id:72.1" or undefined
// Output: "5" or "72.1" or null
function parsePhaseId(label) {
  if (!label) return null;
  return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
}
```

**Usage:**

```javascript
const phaseIdLabel = bead.labels?.find(l => l.startsWith('phase-id:'));
const phaseNum = parsePhaseId(phaseIdLabel);  // "5" for phase-id:05
```

### `deriveDiskStatus(opts)` — D-07

```javascript
// bd counts are source of truth for count-derived fields (D-06)
// disk is source of truth for narrative-derived fields (D-06)
function deriveDiskStatus({ planCount, summaryCount, hasContext, hasResearch, dirExists }) {
  if (!dirExists) return 'no_directory';
  if (planCount > 0 && summaryCount >= planCount) return 'complete';
  if (summaryCount > 0) return 'partial';
  if (planCount > 0) return 'planned';
  if (hasResearch) return 'researched';
  if (hasContext) return 'discussed';
  return 'empty';
}
```

**Note:** `planCount` and `summaryCount` come from bd (children with `gsd:plan` / `gsd:summary` labels). `hasContext` and `hasResearch` come from disk filesystem readdir.

### `detectDrift(phase, bdState, diskState)` — D-09/D-10

```javascript
// Returns array of drift entries (empty if no drift)
// phase: string (phase number e.g. "5")
// bdState: { plan_count, summary_count, bd_status }
// diskState: { disk_plan_count, disk_summary_count, disk_status }
function detectDrift(phase, bdState, diskState) {
  const entries = [];
  if (bdState.plan_count !== diskState.disk_plan_count) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} plan_count bd=${bdState.plan_count} disk=${diskState.disk_plan_count}`);
    entries.push({ phase, kind: 'plan_count', bd_value: bdState.plan_count, disk_value: diskState.disk_plan_count });
  }
  if (bdState.summary_count !== diskState.disk_summary_count) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} summary_count bd=${bdState.summary_count} disk=${diskState.disk_summary_count}`);
    entries.push({ phase, kind: 'summary_count', bd_value: bdState.summary_count, disk_value: diskState.disk_summary_count });
  }
  // closed_without_summary: bd phase closed but zero disk SUMMARY.md
  if (bdState.bd_status === 'closed' && diskState.disk_summary_count === 0) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} closed_without_summary`);
    entries.push({ phase, kind: 'closed_without_summary', bd_value: 'closed', disk_value: 0 });
  }
  return entries;
}

// completed_phases_mismatch: aggregate, computed once at top-level after all phases processed
// phases.filter(p => p.bd_status === 'closed').length !== phases.filter(p => p.disk_status === 'complete').length
```

### `loadMilestoneHeading(memories, version)` — D-16/D-17

```javascript
// memories: parsed object from bd memories --json (filter schema_version key)
// version: string e.g. "v0.2"
function loadMilestoneHeading(memories, version) {
  const key = `gsd-beads:milestone:${version}:heading`;
  if (memories[key]) {
    return `Milestone ${version} — ${memories[key]}`;
  }
  console.error(`[gsd-shadow] note: no milestone heading memory for ${version}`);
  return version;  // bare version fallback
}
```

---

## disk_status Derivation — Disk I/O Pattern

[VERIFIED: upstream `roadmap.js` lines 408-429 — uses `readdir(phasesDir)` + `phaseTokenMatches()`]

Phase 5 must read the disk to compute `has_context`, `has_research`, and disk file counts for drift detection. The upstream pattern uses `phaseTokenMatches(dirName, normalized)` from helpers.js to find the matching directory:

```javascript
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
// phaseTokenMatches and planningPaths imported from upstream helpers

async function getPhaseDirectoryInfo(phasesDir, phaseNum) {
  const normalized = normalizePhaseName(phaseNum);  // "05" for "5"
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const dirMatch = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!dirMatch) return { dirExists: false, planFiles: [], summaryFiles: [], hasContext: false, hasResearch: false };
    const phaseFiles = await readdir(join(phasesDir, dirMatch));
    return {
      dirExists: true,
      diskPlanCount: phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length,
      diskSummaryCount: phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length,
      hasContext: phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md'),
      hasResearch: phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md'),
    };
  } catch {
    return { dirExists: false, diskPlanCount: 0, diskSummaryCount: 0, hasContext: false, hasResearch: false };
  }
}
```

[VERIFIED: upstream pattern from `roadmap.js:408-429` — exact same readdir + phaseTokenMatches logic]

---

## bd Export Strategy — Single-Call Design (D-27)

[VERIFIED: `bin/bd-helper.mjs` — `bd(args, opts)` returns parsed JSON on success, throws sentinel on failure]
[VERIFIED: PITFALLS.md Pitfall 3 — N+1 spawn kill strategy]

```javascript
// In beadsRoadmapAnalyze:
const allBeads = bd(['export', '--json'], { cwd: projectDir });
// allBeads is an array of issue objects. Each has: id, title, status, priority,
// issue_type, created_at, updated_at, labels[], dependencies[]

// Filter phase beads for current milestone
const currentMilestone = process.env.GSD_MILESTONE
  || execSync('git config --worktree gsd-beads.milestone', { cwd: projectDir, encoding: 'utf-8' }).trim()
  || null;
const phaseBeads = allBeads.filter(b =>
  b.labels?.includes('gsd:phase') &&
  (!currentMilestone || b.labels?.includes(`version:${currentMilestone}`))
);

// Group children by parent_id for plan/summary counts (no additional bd spawns)
// Note: bd export --json includes parent_id on child beads (from dependencies[] parent-child links)
const plansByPhase = {};   // phase bead id → count of gsd:plan children
const summariesByPhase = {}; // phase bead id → count of gsd:summary children
for (const b of allBeads) {
  const parentLink = b.dependencies?.find(d => d.type === 'parent-child' && d.depends_on_id !== b.id);
  if (!parentLink) continue;
  const parentId = parentLink.depends_on_id;
  if (b.labels?.includes('gsd:plan')) {
    plansByPhase[parentId] = (plansByPhase[parentId] || 0) + 1;
  }
  if (b.labels?.includes('gsd:summary')) {
    summariesByPhase[parentId] = (summariesByPhase[parentId] || 0) + 1;
  }
}
```

**Note on `gsd:summary` label:** STACK.md research established that "gsd:summary does not exist as a separate type" in the live tstl-sylvanas data. The v0.2 D-06 decision references `bd children <phase> -l gsd:summary` count, but this may be a future convention not yet in use. The plan-phase must decide: (a) use `gsd:summary` label if it exists, or (b) define `summary_count = 0` for v0.2 (tracking only via disk SUMMARY.md files). This is a Claude's Discretion call flagged for the planner.

[ASSUMED: `bd export --json` output for child beads includes a `dependencies[]` array where parent-child links appear with `type: "parent-child"` and `depends_on_id` pointing to the parent. Verified from STACK.md shape documentation but not confirmed for the case where parent is the phase epic and child is a plan bead.]

---

## Sorting — Decimal Phase Ordering (D-28 + Claude's Discretion)

[VERIFIED: `helpers.js` — `comparePhaseNum(a, b)` exported, handles integers, letter suffixes, and decimal segments]

```javascript
// Sort phase beads by phase-id number for deterministic output (D-28)
phaseBeads.sort((a, b) => {
  const numA = parsePhaseId(a.labels?.find(l => l.startsWith('phase-id:')));
  const numB = parsePhaseId(b.labels?.find(l => l.startsWith('phase-id:')));
  // Use upstream's comparePhaseNum for decimal support (72 < 72.1 < 72.2 < 73)
  const cmp = comparePhaseNum(numA ?? '', numB ?? '');
  if (cmp !== 0) return cmp;
  // Tie-break on priority, then created_at, then id (D-28)
  const priDiff = (a.priority ?? 1) - (b.priority ?? 1);
  if (priDiff !== 0) return priDiff;
  if (a.created_at < b.created_at) return -1;
  if (a.created_at > b.created_at) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
});
```

`comparePhaseNum` handles the full range: `"5"` < `"72"` < `"72.1"` < `"72.2"` < `"73"` via segment-by-segment decimal comparison.

---

## current_phase / next_phase Selection — Exact Upstream Mirror (D-21)

[VERIFIED: upstream `roadmap.js` lines 465-466]

```javascript
// After phases array is built with disk_status values:
const currentPhase = phases.find(p =>
  p.disk_status === 'planned' || p.disk_status === 'partial'
) || null;

const nextPhase = phases.find(p =>
  p.disk_status === 'empty' ||
  p.disk_status === 'no_directory' ||
  p.disk_status === 'discussed' ||
  p.disk_status === 'researched'
) || null;

// Emit the phase NUMBER string, not the bead ID
current_phase: currentPhase ? currentPhase.number : null,
next_phase: nextPhase ? nextPhase.number : null,
```

---

## roadmap.get-phase Handler Design (D-20, ROADMAP SC #3)

`roadmap.get-phase <N>` (args[0] = phase number string) must:

1. Call `bd export --json` to load all beads (same single-call strategy, D-27)
2. Find the phase bead with `phase-id:NN` matching `parsePhaseId(args[0])`
3. If not found: return `{ data: { found: false, phase_number: args[0] } }`
4. If found: return a shape matching upstream's `roadmapGetPhase` output

**Key difference from `roadmap.analyze.phases[]`:** `roadmap.get-phase` returns `success_criteria: string[]` and `section: string` (raw markdown section). For the bd-backed version:
- `success_criteria`: parse from bead description (same "Success Criteria:" heading pattern upstream uses, already established in description-format convention)
- `section`: construct a synthetic markdown section from bead fields (or return the description as-is)

**SC #3 byte-equality requirement:** SC #3 says "both handlers' output for phase N is byte-equal in the overlapping keys." The overlapping keys are `found`, `phase_number`, `phase_name`, `goal`, `depends_on`. These come from the same bead source in both handlers. The non-overlapping keys (`plan_count`, `summary_count`, `has_context`, `has_research`, `disk_status`, `roadmap_complete` from analyze; `success_criteria`, `section` from get-phase) are handled independently.

---

## Drift Detection Mechanics (D-08..D-12)

### Drift kinds and detection logic

| Kind | bd source | Disk source | Alert condition |
|------|-----------|-------------|-----------------|
| `plan_count` | `gsd:plan` children in bd export | `*-PLAN.md` + `PLAN.md` files in `phases/<dir>/` | bd count ≠ disk count |
| `summary_count` | `gsd:summary` children in bd export | `*-SUMMARY.md` + `SUMMARY.md` files | bd count ≠ disk count |
| `closed_without_summary` | `status === 'closed'` on phase bead | `disk_summary_count === 0` | closed bd phase has no SUMMARY.md on disk |
| `completed_phases_mismatch` | `phases.filter(p => bd_status === 'closed').length` | `phases.filter(p => disk_status === 'complete').length` | aggregate counts differ |

### Natural asymmetries (D-11 — do NOT alert)

- Phase dir absent (`no_directory`) when phase epic has `status = 'open'`: planned-but-not-scaffolded is normal
- CONTEXT.md or RESEARCH.md present without bd children: bd doesn't model narrative-only state

### Drift output format (D-09 — exact format locked)

**stderr line:** `[gsd-shadow] DRIFT: phase 5 plan_count bd=3 disk=2`

**`drift[]` array element:**
```javascript
{ phase: "5", kind: "plan_count", bd_value: 3, disk_value: 2 }
```

### `_parity-helpers.mjs` whitelist strategy for `drift[]` (D-13 — Claude's Discretion)

Three options, pick one in plan-phase:

**Option A — Extend `assertKeySetParity` signature:**
```javascript
// Add optional 3rd param: knownExtensions (keys present in actual but not snapshot)
export function assertKeySetParity(actual, snapshot, path = '', knownExtensions = []) { ... }
// Usage: assertKeySetParity(actual.data, snapshot.data, '', ['drift'])
```

**Option B — New `assertKeySetParityWithExt` function (non-breaking):**
```javascript
export function assertKeySetParityWithExt(actual, snapshot, extensions, path = '') { ... }
// Usage: assertKeySetParityWithExt(actual.data, snapshot.data, ['drift'])
```

**Option C — Known-extensions list as module-level export:**
```javascript
export const BEADS_ONLY_KEYS = ['drift', 'backend'];
// In tests: assertKeySetParity skips keys in BEADS_ONLY_KEYS that are absent from snapshot
```

Recommendation: **Option B** — adding a new function is non-breaking; existing tests importing `assertKeySetParity` continue to work unchanged; the extension semantics are explicit in the function name. Option A risks subtle breakage if any existing test passes `path` positionally.

---

## Snapshot Strategy (D-26, REQ-QUAL-01)

### Snapshot workflow (red → green)

1. Edit `tests/scripts/update-snapshots.mjs` to add two SNAPSHOTS entries:

```javascript
// Phase 5 entries (add to SNAPSHOTS array)
{
  cmd: 'roadmap.analyze',
  out: join(SNAPSHOT_DIR, 'roadmap-analyze.json'),
  fixture: join(REPO_ROOT, 'tests/fixtures'),  // seeded from seed.jsonl
  argv: ['query', 'roadmap.analyze'],
},
{
  cmd: 'roadmap.get-phase',
  out: join(SNAPSHOT_DIR, 'roadmap-get-phase.json'),
  fixture: join(REPO_ROOT, 'tests/fixtures'),
  argv: ['query', 'roadmap.get-phase', '3'],   // phase 3 from the seed fixture
},
```

2. The `update-snapshots.mjs` else-branch (currently reserved for "Phase 5+ branch") must be implemented to:
   - Seed a fixture via `tests/fixtures/seed-fixture.sh` into a temp dir
   - Also create `phases/` subdirectories so upstream can compute disk_status (upstream reads disk; snapshot is from upstream)
   - Run `UPSTREAM_BIN` against the fixture
   - Write stdout to the snapshot file

3. Write `handler-roadmap-analyze.test.mjs` that:
   - Loads `snapshots/roadmap-analyze.json` as expected shape
   - Runs shadow against bd-seeded fixture
   - Calls `assertKeySetParity(actual.data, snapshot.data, '', ['drift'])` (bd-only key)
   - Asserts `actual.data.backend === 'beads'`
   - **This test must be WRITTEN AND COMMITTED before the handler is implemented (red phase)**

**Critical upstream snapshot consideration:** Upstream `roadmapAnalyze` parses ROADMAP.md. The snapshot must come from upstream running against a fixture that has a valid ROADMAP.md with phase headings in the expected format. Two options:

**Option A (simpler):** Run upstream against the actual gsd-beads project directory (which has a real ROADMAP.md) to capture the upstream shape, then use the bd-seeded fixture for the shadow test.

**Option B (fixture-complete):** Create a test fixture with both `.beads/` (from seed.jsonl) AND `.planning/ROADMAP.md` (generated from regen-roadmap.sh). Since regen-roadmap.sh generates ROADMAP.md in the beads-convention format (without `### Phase N:` headings), upstream will return `phases: []`. This reveals an important insight: **the snapshot for `roadmap.analyze` cannot be captured from upstream against the bd fixture** because upstream's file parser returns empty on the regenerated ROADMAP.md.

**Resolution (plan-phase decision):** The snapshot represents upstream's shape FROM A PROPERLY FORMATTED ROADMAP.md, not from the bd fixture. The parity test checks that the bd-backed handler MATCHES THE SHAPE (not the values) of what upstream would return on a well-formatted project. Use Option A: capture snapshot from a known-good project, then assert key-set + type parity (not value equality) against the bd-backed output.

[ASSUMED: The Phase 5 snapshot strategy for `roadmap.analyze` must use a fixture with a ROADMAP.md that upstream can parse (not the regenerated format). This is a constraint not fully resolved in CONTEXT.md — plan-phase must decide the exact fixture topology.]

---

## Test Fixture Topology

Phase 5 requires four distinct fixture types:

### 1. bd-managed fixture with phase-id labels (primary)

Seed from `tests/fixtures/seed.jsonl` (after build-seed.sh edit) using `seed-fixture.sh`. This provides:
- 7 phase epics across 3 milestones with `phase-id:01..07` labels
- Current-milestone scoping via `git config --worktree gsd-beads.milestone=v0.2`
- Milestone heading memories for v0.1 + v0.2 (v0.3 fallback path)

**Must also create `phases/` dirs on disk** for `has_context`/`has_research`/`disk_status` computation:

```javascript
function seedPhaseDirectories(fixtureDir, phases) {
  const planningDir = join(fixtureDir, '.planning', 'phases');
  mkdirSync(planningDir, { recursive: true });
  for (const p of phases) {
    const phaseDir = join(planningDir, `0${p.num}-${p.slug}`);
    mkdirSync(phaseDir, { recursive: true });
    if (p.withContext) writeFileSync(join(phaseDir, `0${p.num}-CONTEXT.md`), '# Context\n');
    if (p.withResearch) writeFileSync(join(phaseDir, `0${p.num}-RESEARCH.md`), '# Research\n');
    for (let i = 0; i < p.planCount; i++) {
      writeFileSync(join(phaseDir, `0${p.num}-0${i+1}-PLAN.md`), '# Plan\n');
    }
    for (let i = 0; i < p.summaryCount; i++) {
      writeFileSync(join(phaseDir, `0${p.num}-0${i+1}-SUMMARY.md`), '# Summary\n');
    }
  }
}
```

### 2. Non-bd fixture (SC #5)

Use existing `nonBeadsFixture()` from `argv-routing.test.mjs`:

```javascript
function nonBeadsFixture() {
  return mkdtempSync(join(tmpdir(), 'gsd-nonbeads-test-'));
}
// Test: verify both handlers fall through to upstream, response has no backend:'beads'
```

### 3. Drift fixture (D-08..D-12)

Create a bd fixture where bd state and disk state are intentionally diverged:
- bd has 2 `gsd:plan` child beads for phase 3
- disk has 1 `*-PLAN.md` file
- Expected: `drift: [{ phase: "3", kind: "plan_count", bd_value: 2, disk_value: 1 }]`

### 4. Empty-bd fixture (passthrough or empty-shape)

A fresh `bd init` fixture with no phase beads. Handler must return `BeadsEmpty` sentinel → dispatch falls through to upstream (per Phase 4 D-13: `BeadsEmpty` is a passthrough trigger).

---

## Plan Structure Recommendation

Given the locked decisions and the build order constraint (parity test before implementation), Phase 5 maps cleanly to 5 plans with clear wave dependencies:

| Plan | Name | Wave | Key Tasks |
|------|------|------|-----------|
| 05-01 | Stub deletion + seed migration | 0 | Delete `_phase4-test-stub` block; edit `build-seed.sh` (D-03/D-18); regenerate `seed.jsonl`; verify `seed-determinism.test.sh` passes |
| 05-02 | Parity snapshots (red phase) | 1 | Extend `update-snapshots.mjs` SNAPSHOTS array; implement the "run upstream, capture stdout" branch; generate `roadmap-analyze.json` + `roadmap-get-phase.json` snapshots; extend `_parity-helpers.mjs` for `drift[]` whitelist (D-13); write red test stubs |
| 05-03 | Shared helpers | 1 | `parsePhaseId`, `deriveDiskStatus`, `detectDrift`, `loadMilestoneHeading` functions in shadow; unit tests for each |
| 05-04 | `roadmap.analyze` handler (green phase) | 2 | Implement `beadsRoadmapAnalyze`; wire into `BEADS_READ_OVERRIDES`; parity test turns green |
| 05-05 | `roadmap.get-phase` handler + integration tests | 2 | Implement `beadsRoadmapGetPhase`; parity test turns green; SC #2 integration test (11-phase / 24-plan fixture); drift fixture test; non-bd passthrough tests |

**Wave dependencies:**
- Wave 0 (05-01): no dependencies, removes the Phase 4 stub that blocks real handler registration
- Wave 1 (05-02, 05-03): parallel; parity snapshots need seed.jsonl done; helpers need no external deps
- Wave 2 (05-04, 05-05): both handlers depend on helpers (05-03); 05-05 can start on `roadmap.get-phase` once 05-04's handler pattern is established

**Alternative factoring considered:** Merging 05-02 and 05-03 into a single "test infrastructure" plan. Rejected because parity snapshot capture depends on upstream binary (requires seed.jsonl ready from 05-01) while shared helpers are pure code with no fixture dependency — keeping them separate avoids blocking the helper implementation on fixture readiness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase directory matching | Custom regex on `phases/<dir>` name | `phaseTokenMatches(dirName, normalizePhaseName(phaseNum))` from upstream helpers.js | Handles letter suffixes (12A), decimal (12.1), project-code prefix (CK-01); reimplementation risks edge case gaps |
| Phase number sort with decimals | `Number(parsePhaseId())` sort | `comparePhaseNum(a, b)` from upstream helpers.js | Handles `12 < 12A < 12A.1 < 12A.2 < 13` segment-by-segment; `Number()` mangles letter suffixes |
| Planning paths | Manual `join(projectDir, '.planning', ...)` | `planningPaths(projectDir)` from upstream helpers.js | Returns all common .planning paths; stays in sync if upstream changes convention |
| Phase name normalization | Custom padding | `normalizePhaseName(phase)` from upstream helpers.js (for directory lookup) | Handles `CK-01` prefix stripping, letter suffixes, decimal parts |
| Milestone version extraction | Regex on `version:vX.Y` label | `label.replace(/^version:/, '')` (trivial, but use consistently) | Not worth a helper but must be consistent |

**Key insight:** Phase 5 handles exactly the path where upstream's file-based helpers exist and are importable. The read handlers should import `phaseTokenMatches`, `planningPaths`, and `comparePhaseNum` from the upstream helpers module rather than reimplementing. Only `parsePhaseId` is a new helper (D-02's padding-strip behavior doesn't map to any existing upstream utility).

---

## Common Pitfalls

### Pitfall 1: roadmap.get-phase shape is NOT the same as roadmap.analyze.phases[]

**What goes wrong:** Implementation reuses the phases[] element shape from `roadmap.analyze` for `roadmap.get-phase`, missing `success_criteria` and `section` fields that upstream's `roadmapGetPhase` returns.

**Why it happens:** Both handlers return "phase data" so it's tempting to share shape. But upstream's `roadmapGetPhase` uses `searchPhaseInContent()` which parses the full phase markdown section and extracts `success_criteria` as a separate field.

**How to avoid:** The parity snapshot for `roadmap.get-phase` (written before implementation) will have `success_criteria` in it. The test will fail if the handler omits it. Red phase protects against this.

**Warning signs:** `roadmapGetPhase` snapshot has more keys than `roadmapAnalyze.phases[0]`.

### Pitfall 2: Drift for `gsd:summary` may be zero if the label doesn't exist yet

**What goes wrong:** D-06 references `bd children <phase> -l gsd:summary`, but STACK.md research established that `gsd:summary` is not a real label in production use — summary semantics come from `gsd:plan` bead transitioning to `status=closed`.

**Why it happens:** The CONTEXT.md D-06 was written before the STACK.md finding was fully internalized. The `gsd:summary` label may not be in use on any real project.

**How to avoid:** In plan-phase, decide: (a) define `summary_count` as count of child `gsd:plan` beads with `status=closed`, OR (b) define `summary_count` as count of child beads with `gsd:summary` label (which will be 0 in v0.2 but is the forward-compatible choice). Document the decision in the handler doc-comment.

**Warning signs:** `summary_count` is always 0 on a project with closed plans.

[ASSUMED: The resolution between D-06's `gsd:summary` reference and STACK.md's "gsd:summary does not exist" finding is a plan-phase decision. The research flags this as a required clarification.]

### Pitfall 3: bd export --json does NOT include memories inline

**What goes wrong:** Handler tries to extract milestone heading from `bd export --json` output (treating it as containing memories), gets `undefined` for all heading lookups.

**Why it happens:** `bd export` in JSONL format includes memories as separate lines. `bd export --json` (JSON array mode) returns ONLY issue objects. The spike finding "bd export includes memories by default" refers to the JSONL roundtrip format used for `bd init --from-jsonl`, not the `--json` array output.

**How to avoid:** Always use a separate `bd memories --json` call for milestone heading lookup (D-16). This is the second of the two allowed spawns.

**Warning signs:** `bd(['export', '--json'])` result parsed and `allBeads.filter(b => b._type === 'memory')` returns empty — because `--json` mode doesn't include memories inline.

### Pitfall 4: Parity snapshot captured from non-existent or wrong ROADMAP.md

**What goes wrong:** `update-snapshots.mjs` runs upstream against the bd fixture directory, but the bd fixture has no `.planning/ROADMAP.md` (or has one in the regenerated format without `### Phase N:` headings). Upstream returns `{ error: 'ROADMAP.md not found' }` or `{ phases: [] }`. The snapshot captures the error shape instead of the expected shape.

**Why it happens:** The bd fixture created by `seed-fixture.sh` only has `.beads/` — no `.planning/` directory. Upstream's `roadmapAnalyze` reads `.planning/ROADMAP.md` and fails gracefully.

**How to avoid:** The snapshot for `roadmap.analyze` should be captured from a fixture that has BOTH `.beads/` AND a valid `.planning/ROADMAP.md`. Either (a) use the actual gsd-beads project as the snapshot source, or (b) create a test fixture with a synthetic ROADMAP.md that has `### Phase N:` headings matching the 7 phases in seed.jsonl.

### Pitfall 5: Hook allowlist — `export` and `memories` are confirmed safe

[VERIFIED: `hooks/bd-sync.sh` line 23: `list|show|ready|memories|status|prime|export|deps|children|search|help|version|"--version"|"--help"`]

Both `export` and `memories` are in the allowlist. Phase 5 handlers are hook-safe. The `bd-allowlist-grep.test.sh` CI test will catch any regression if a future handler uses an unlisted subcommand.

### Pitfall 6: `bd export --json` returns ARRAY — shape assertion needed

[VERIFIED: `bin/bd-helper.mjs` lines 43-53 — already detects bd's empty-error OBJECT shape and throws `BeadsEmpty`]

The `bd()` helper already handles the `{ error, schema_version }` error object case. However, if `bd export --json` returns an empty array `[]` (no beads at all), the handler gets `[]` and must not throw. The correct behavior: return `{ data: { phases: [], ..., backend: 'beads', drift: [] } }` (SC #5 empty-state shape). This is NOT a `BeadsEmpty` case — `BeadsEmpty` is for bd's explicit error object, not for a legitimately empty bead store.

### Pitfall 7: Missing `_phase4-test-stub` deletion causes BEADS_READ_OVERRIDES registration conflict

**What goes wrong:** Phase 5 adds `roadmap.analyze` to `BEADS_READ_OVERRIDES`, but the env-gated `_phase4-test-stub` block (lines 290-300) is still present. When `GSD_SHADOW_TEST_STUB=1`, the stub registers first and the handler registers after — both in `BEADS_READ_OVERRIDES`. This doubles the registration but only the first one wins (registry.js uses first-registered semantics for existing keys... or the second overwrites the first — either way it's wrong).

**How to avoid:** Phase 5's first task is stub deletion (per CONTEXT.md "Specific Ideas" and VERIFICATION.md Gaps Summary).

---

## Code Examples

### Handler skeleton — `beadsRoadmapAnalyze`

```javascript
// [VERIFIED: bin/gsd-sdk-shadow.mjs handler signature pattern]
// [VERIFIED: upstream roadmap.js lines 373-492 — shape contract]
async function beadsRoadmapAnalyze(_args, projectDir, _workstream) {
  const { phaseTokenMatches, planningPaths, comparePhaseNum, normalizePhaseName } = await import(HELPERS_PATH);
  const phasesDir = planningPaths(projectDir).phases;

  // 1. Single bd export call (D-27)
  const allBeads = bd(['export', '--json'], { cwd: projectDir });  // throws sentinels on failure

  // 2. Single bd memories call for milestone heading (D-16)
  const memories = bd(['memories', '--json'], { cwd: projectDir });

  // 3. Current-milestone scoping (D-19)
  let currentMilestone = process.env.GSD_MILESTONE;
  if (!currentMilestone) {
    try {
      const { spawnSync } = await import('node:child_process');
      const git = spawnSync('git', ['config', '--worktree', 'gsd-beads.milestone'], { cwd: projectDir, encoding: 'utf-8' });
      currentMilestone = git.stdout?.trim() || null;
    } catch { currentMilestone = null; }
  }

  // 4. Filter + sort phase beads (D-28)
  let phaseBeads = allBeads.filter(b =>
    b.labels?.includes('gsd:phase') &&
    (!currentMilestone || b.labels?.includes(`version:${currentMilestone}`))
  );
  phaseBeads.sort((a, b) => {
    const numA = parsePhaseId(a.labels?.find(l => l.startsWith('phase-id:')));
    const numB = parsePhaseId(b.labels?.find(l => l.startsWith('phase-id:')));
    return comparePhaseNum(numA ?? '', numB ?? '')
      || (a.priority - b.priority)
      || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)
      || (a.id < b.id ? -1 : 1);
  });

  // 5. Build plan/summary counts from export (in-memory, no extra spawns)
  const plansByPhase = {}, summariesByPhase = {};
  for (const b of allBeads) {
    const parentLink = b.dependencies?.find(d => d.type === 'parent-child' && d.depends_on_id !== b.id);
    if (!parentLink) continue;
    const pid = parentLink.depends_on_id;
    if (b.labels?.includes('gsd:plan')) plansByPhase[pid] = (plansByPhase[pid] || 0) + 1;
    // if (b.labels?.includes('gsd:summary')) summariesByPhase[pid] = ...; // plan-phase decision
  }

  // 6. Per-phase disk I/O + derivation
  const driftEntries = [];
  const phases = [];
  for (const bead of phaseBeads) {
    const phaseNum = parsePhaseId(bead.labels?.find(l => l.startsWith('phase-id:')));
    const { dirExists, diskPlanCount, diskSummaryCount, hasContext, hasResearch } =
      await getPhaseDirectoryInfo(phasesDir, phaseNum, phaseTokenMatches, normalizePhaseName);
    const planCount = plansByPhase[bead.id] || 0;
    const summaryCount = summariesByPhase[bead.id] || 0;
    const diskStatus = deriveDiskStatus({ planCount, summaryCount, hasContext, hasResearch, dirExists });
    driftEntries.push(...detectDrift(phaseNum, { plan_count: planCount, summary_count: summaryCount, bd_status: bead.status }, { disk_plan_count: diskPlanCount, disk_summary_count: diskSummaryCount, disk_status: diskStatus }));

    const goalMatch = (bead.description ?? '').match(/^Goal:\s*(.+)$/m);
    const dependsMatch = (bead.description ?? '').match(/^Depends on:\s*(.+)$/m);
    phases.push({
      number: phaseNum,
      name: bead.title,
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

  // 7. Milestones (D-15..D-17)
  const versionSet = new Set(phaseBeads.flatMap(b => b.labels?.filter(l => l.startsWith('version:')) ?? []));
  const milestones = [...versionSet].map(vLabel => {
    const version = vLabel.replace(/^version:/, '');
    return { heading: loadMilestoneHeading(memories, version), version };
  });

  // 8. Aggregates + selection (D-21)
  const totalPlans = phases.reduce((s, p) => s + p.plan_count, 0);
  const totalSummaries = phases.reduce((s, p) => s + p.summary_count, 0);
  const completedPhases = phases.filter(p => p.roadmap_complete).length;  // D-14
  const currentPhase = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null;
  const nextPhase = phases.find(p => ['empty','no_directory','discussed','researched'].includes(p.disk_status)) || null;

  // 9. completed_phases_mismatch drift check
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
    current_phase: currentPhase ? currentPhase.number : null,
    next_phase: nextPhase ? nextPhase.number : null,
    missing_phase_details: null,  // bd has no concept of malformed-ROADMAP
    backend: 'beads',
    drift: driftEntries,
  }};
}
```

[Source: upstream `roadmap.js` lines 373-492, Phase 4 `bin/gsd-sdk-shadow.mjs` patterns, CONTEXT.md D-01..D-29]

### Parity test skeleton — `handler-roadmap-analyze.test.mjs`

```javascript
// [VERIFIED: _parity-helpers.mjs exports assertKeySetParity + assertTypeParity]
// [VERIFIED: handler-_phase4-test-stub.test.mjs — 6-case pattern with t.after() cleanup]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertKeySetParityWithExt, assertTypeParity } from './_parity-helpers.mjs';  // Option B API

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');
const SNAPSHOT = join(fileURLToPath(import.meta.url), 'snapshots/roadmap-analyze.json');

test('roadmap.analyze PARITY (red→green): key-set matches upstream shape', async (t) => {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf-8'));
  const dir = await setupBdFixtureWithPhasesDirs(t);  // seed + git config milestone + phases/ dirs
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], dir);
  assert.equal(result.status, 0);
  const actual = JSON.parse(result.stdout);
  assertKeySetParityWithExt(actual.data, snapshot.data, ['drift']);  // drift is bd-only
  assert.equal(actual.data.backend, 'beads');
  assert.equal(typeof actual.data.phase_count, 'number');
  assert.ok(Array.isArray(actual.data.phases));
  if (actual.data.phases.length > 0) {
    assertKeySetParityWithExt(actual.data.phases[0], snapshot.data.phases[0], []);
    assertTypeParity(actual.data.phases[0], snapshot.data.phases[0]);
  }
});

test('roadmap.analyze non-bd project: falls through to upstream', async (t) => {
  const dir = await nonBeadsFixture(t);
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], dir);
  // upstream returns its own shape; backend !== 'beads'
  const parsed = JSON.parse(result.stdout);
  assert.notEqual(parsed.data?.backend, 'beads');
});

test('roadmap.analyze drift detection: bd plan_count vs disk divergence', async (t) => {
  const dir = await setupDriftFixture(t);  // 2 bd plans, 1 disk PLAN.md
  const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], dir);
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.data.drift.length > 0, 'expected drift entries');
  assert.ok(parsed.data.drift.some(d => d.kind === 'plan_count'));
  // Stderr has the drift line
  assert.match(result.stderr, /\[gsd-shadow\] DRIFT:.*plan_count/);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Upstream parses `### Phase N:` headings from ROADMAP.md | bd-backed handler derives from `phase-id:NN` labels + bead fields | Phase 5 (this work) | Fixes the root cause: regen-roadmap.sh doesn't emit `Phase N:` headings, so upstream's parser returns zero phases |
| N+1 bd spawns (one per phase for children) | Single `bd export --json` + in-memory grouping | Phase 5 (D-27) | Reduces from ~13 spawns (11 phases × ~75ms) to 2 spawns (~150ms total) |
| `try/finally rmSync` for test teardown | `t.after()` from `node:test` | Phase 4 recommendation; Phase 5 implements for new tests | Guarantees teardown even on test failure |

**Deprecated patterns for Phase 5:**
- `execSync` in read handlers: use `bd()` from `bin/bd-helper.mjs` (uses `spawnSync`, throws sentinels)
- `process.env.GSD_SHADOW_TEST_STUB` registration: deleted in Phase 5's first task
- Per-phase `bd children` loop: replaced by export + in-memory grouping

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bd export --json` (JSON array mode) does NOT include memories inline; memories require a separate `bd memories --json` call | §bd Export Strategy | If wrong: single-call strategy works; separate `bd memories` call is redundant but not harmful |
| A2 | `bd remember 'key' 'value'` (no `--key` flag) is the correct invocation syntax for seeding memories | §build-seed.sh Edits | If wrong: `build-seed.sh` D-18 edit fails; fix by adding `--key` flag |
| A3 | Child beads in `bd export --json` include a `dependencies[]` array with `type: "parent-child"` links pointing to the parent phase bead id | §bd Export Strategy | If wrong: in-memory grouping for `plan_count` fails; fallback to per-phase `bd children` calls (N+1 spawns, breaks perf budget) |
| A4 | The `gsd:summary` label is NOT in current use; `summary_count` should be derived from disk `*-SUMMARY.md` count or redefined as closed `gsd:plan` children | §Pitfall 2 / Drift Detection | If wrong: `summary_count` is always 0 in drift detection; correct by adding `gsd:summary` label to plan-close workflow |
| A5 | The parity snapshot for `roadmap.analyze` must be captured from a fixture with valid `.planning/ROADMAP.md` (not the bd fixture alone) | §Snapshot Strategy | If wrong: snapshot captures error shape `{error: 'ROADMAP.md not found'}` and parity test passes trivially |

**If this table is empty**: All claims in this research were verified or cited.

---

## Open Questions

1. **`gsd:summary` label vs closed `gsd:plan` bead**
   - What we know: STACK.md confirmed `gsd:summary` is not a real label in production (tstl-sylvanas has no such label). D-06 references it. D-09 drift kind `summary_count` is defined.
   - What's unclear: How should `summary_count` be derived in v0.2?
   - Recommendation: Plan-phase decides. Two viable options: (a) disk count of `*-SUMMARY.md` files (most accurate for drift detection); (b) count of closed `gsd:plan` child beads (bd-only, proxy).

2. **Parity snapshot fixture topology**
   - What we know: Upstream `roadmapAnalyze` parses ROADMAP.md. The bd fixture has no ROADMAP.md. Snapshot must match upstream's shape.
   - What's unclear: Should the snapshot be captured from gsd-beads project itself, or from a synthetic fixture with both `.beads/` and `.planning/ROADMAP.md`?
   - Recommendation: Plan-phase decides fixture topology for `update-snapshots.mjs`. The gsd-beads project itself works as snapshot source (has real ROADMAP.md with real upstream output).

3. **`drift[]` in `assertKeySetParity` — which API option**
   - What we know: Three options (A, B, C) documented in §drift parity-helper API.
   - What's unclear: Which API is cleanest for downstream phases (6-9) to use.
   - Recommendation: Option B (`assertKeySetParityWithExt`) — non-breaking new function.

4. **SC #2 fixture: 11-phase / 24-plan**
   - What we know: ROADMAP SC #2 requires "11-phase / 24-plan beads fixture." Current seed.jsonl has 7 phases, 0 plans.
   - What's unclear: Is SC #2's 11-phase fixture a separate larger fixture, or does the existing 7-phase fixture (augmented with plans) satisfy it?
   - Recommendation: Plan-phase creates a larger SC #2-specific fixture (separate from seed.jsonl). Adding 4 more phases + 24 plans to seed.jsonl would break seed-determinism.test.sh's CASE 2 count assertion.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` CLI | All handlers | ✓ | 1.0.3 | `BeadsNotInstalled` sentinel → upstream fallthrough |
| `node` | Shadow runtime | ✓ | 20+ (Volta) | — |
| `git` (for worktree config) | Current-milestone scoping | ✓ | System git | `${GSD_MILESTONE:-}` env override |
| `flock` | `cascade-loop.sh` (D-14 context) | ✓ (Linux) | System | macOS: `brew install flock` |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node 20+) |
| Config file | none — `node --test tests/shadow-tests/*.test.mjs` |
| Quick run command | `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs tests/shadow-tests/handler-roadmap-get-phase.test.mjs` |
| Full suite command | `node --test tests/shadow-tests/*.test.mjs` (currently 83 tests / 83 pass) |
| Bash tests | `bash tests/shadow-tests/seed-determinism.test.sh && bash tests/shadow-tests/bd-allowlist-grep.test.sh` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-READ-01 | `roadmap.analyze` returns 10-key top-level shape with per-phase 10-key sub-shape | unit/parity | `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs` | ❌ Wave 0 |
| REQ-READ-01 | `current_phase` / `next_phase` are phase numbers, not bead IDs | unit | Same file | ❌ Wave 0 |
| REQ-READ-01 | `completed_phases` matches `bd list -l gsd:phase --status=closed -n 0 --json` count | integration | Same file | ❌ Wave 0 |
| REQ-READ-02 | `roadmap.get-phase <N>` returns overlapping keys byte-equal to analyze | unit/parity | `node --test tests/shadow-tests/handler-roadmap-get-phase.test.mjs` | ❌ Wave 0 |
| REQ-READ-02 | Unmatched phase returns `{ found: false, phase_number: arg }` | unit | Same file | ❌ Wave 0 |
| REQ-QUAL-01 | Parity snapshot test (red→green) before handler implementation | parity | `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-02 | `BeadsNotInstalled` / `BeadsCorrupt` / `BeadsEmpty` fall through to upstream | unit | Same handler tests | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot()` resolves project root correctly | unit | Existing `findBeadsRoot.test.mjs` | ✅ (Phase 4) |
| ROADMAP SC #2 | 11-phase / 24-plan fixture: `total_plans` matches `bd count -l gsd:plan` | integration | `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs` | ❌ Wave 0 |
| ROADMAP SC #5 | Non-bd project: both handlers fall through, `backend !== 'beads'` | passthrough | Same handler test files | ❌ Wave 0 |
| D-09/D-10 | Drift detection produces `drift[]` entries and stderr lines | unit | Same handler tests | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/shadow-tests/handler-roadmap-analyze.test.mjs tests/shadow-tests/handler-roadmap-get-phase.test.mjs`
- **Per wave merge:** `node --test tests/shadow-tests/*.test.mjs && bash tests/shadow-tests/seed-determinism.test.sh && bash tests/shadow-tests/bd-allowlist-grep.test.sh`
- **Phase gate:** Full suite green (currently 83/83) plus 2 new handler test files before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/shadow-tests/handler-roadmap-analyze.test.mjs` — covers REQ-READ-01, REQ-QUAL-01, REQ-QUAL-02, ROADMAP SC #2, SC #5, D-09/D-10
- [ ] `tests/shadow-tests/handler-roadmap-get-phase.test.mjs` — covers REQ-READ-02, ROADMAP SC #3, SC #5
- [ ] `tests/shadow-tests/snapshots/roadmap-analyze.json` — captured from upstream before handler implementation
- [ ] `tests/shadow-tests/snapshots/roadmap-get-phase.json` — captured from upstream before handler implementation
- [ ] `tests/scripts/update-snapshots.mjs` — implement Phase 5+ branch (seed fixture + run upstream + write snapshot)

---

## Security Domain

Security enforcement is not explicitly configured (`security_enforcement` key absent from config.json). Applying default: include security domain review.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Read handlers have no auth surface; shadow invoked by local CLI |
| V3 Session Management | No | No sessions; one-shot CLI process |
| V4 Access Control | No | All access is local filesystem; no network |
| V5 Input Validation | Yes | `args[0]` in `roadmap.get-phase` is validated (numeric-only per D-20) |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Phase number injection (e.g. `args[0] = "../../../etc/passwd"`) | Tampering | `roadmap.get-phase` validates args[0] is numeric only before lookup; `parsePhaseId()` strips non-numeric content. No shell interpolation of args. |
| bd command injection via args | Tampering | Phase 5 handlers use `bd(['export','--json'], ...)` with array form (no shell interpolation); `bd()` helper uses `spawnSync('bd', args, ...)` — no shell involved |

PITFALLS.md §Security Mistakes confirms: "Most read handlers will be argless (`roadmap.analyze`, `state-snapshot`, `progress.json`) so the surface is small." Phase 5's `roadmap.get-phase` receives one arg but it's used only for label lookup, not as a shell token.

---

## Sources

### Primary (HIGH confidence)

- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js` lines 337-492 — upstream `roadmapGetPhase` and `roadmapAnalyze` canonical implementations; exact output shapes
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/helpers.js` — `normalizePhaseName`, `phaseTokenMatches`, `planningPaths`, `comparePhaseNum` — all exported and importable
- `/home/ellio/code/gsd-beads/bin/gsd-sdk-shadow.mjs` lines 236-415 — Phase 4 foundation: `findBeadsRoot`, `BEADS_READ_OVERRIDES`, sentinel dispatch, `_phase4-test-stub` block to delete
- `/home/ellio/code/gsd-beads/bin/bd-helper.mjs` — `bd()` wrapper; `spawnSync` only; throws `BeadsNotInstalled`/`BeadsCorrupt`/`BeadsEmpty`
- `/home/ellio/code/gsd-beads/bin/beads-errors.mjs` — sentinel hierarchy (5 types, frozen `BeadsCause` enum)
- `/home/ellio/code/gsd-beads/tests/shadow-tests/_parity-helpers.mjs` — `assertKeySetParity` + `assertTypeParity`; 33 LOC; null-as-wildcard
- `/home/ellio/code/gsd-beads/tests/scripts/update-snapshots.mjs` — SNAPSHOTS array extension point; lockfile drift gate
- `/home/ellio/code/gsd-beads/tests/fixtures/build-seed.sh` — source-of-truth builder; BEADS_ACTOR=seed; 7 phases across 3 milestones
- `/home/ellio/code/gsd-beads/tests/fixtures/seed.jsonl` — current committed fixture (no phase-id labels yet)
- `/home/ellio/code/gsd-beads/hooks/bd-sync.sh` line 23 — read-only bd subcommand allowlist (`export` and `memories` confirmed present)
- `/home/ellio/code/gsd-beads/.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-VERIFICATION.md` — Phase 4 artifacts inventory; Gaps Summary enumerates 7 things Phase 5 imports

### Secondary (MEDIUM confidence)

- `/home/ellio/code/gsd-beads/.planning/research/STACK.md` — bd CLI shapes verified against live 149-bead project; `bd memories` object shape; `bd export --json` array shape; `gsd:summary` non-existence
- `/home/ellio/code/gsd-beads/.planning/research/ARCHITECTURE.md` — handler signature, output formatting, test pattern, anti-patterns
- `/home/ellio/code/gsd-beads/.planning/research/PITFALLS.md` — 10 critical hazards with line references; recovery strategies

### Tertiary (LOW confidence / ASSUMED)

- Spike 004 source: "bd export includes memories by default" — refers to JSONL mode; `--json` mode behavior assumed to be issues-only array [ASSUMED: A3]
- D-06 `gsd:summary` label — not confirmed in production use [ASSUMED: A4]

---

## Metadata

**Confidence breakdown:**

- Upstream output shapes: HIGH — source code read directly
- Shared helpers (phaseTokenMatches, comparePhaseNum, planningPaths): HIGH — exports confirmed in helpers.js
- Fixture migration (D-03/D-18 build-seed.sh edits): HIGH — existing pattern understood
- `bd export --json` vs `bd memories` separation: MEDIUM — JSONL format confirmed to include memories; `--json` array mode assumed issues-only
- `gsd:summary` label existence: LOW — STACK.md research found it absent in production; D-06 references it

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable — bd 1.0.3 pinned; upstream shape only changes on gsd-sdk-cc upgrade)

---

## RESEARCH COMPLETE
