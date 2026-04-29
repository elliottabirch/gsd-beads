# Architecture Research — v0.2 (Beads-backed reads)

**Domain:** Shadow gsd-sdk binary; read-handler integration into the existing v0.1 shadow.
**Researched:** 2026-04-29
**Confidence:** HIGH (every claim is grounded in `/home/ellio/code/gsd-beads/bin/gsd-sdk-shadow.mjs`, the upstream `query/registry.js` + `query/index.js`, the v0.1 shadow tests, and Spike 013's POC.)

> Scope discipline: this document answers ONLY the seven architecture questions for adding read handlers to `bin/gsd-sdk-shadow.mjs`. It does **not** re-derive v0.1 architecture, pick handler implementations, or sequence v0.2 phases — that lives in PHASES/roadmap files.

---

## 1. System Overview — where read handlers fit

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CLI entry — bin/gsd-sdk-shadow.mjs            │
│                                                                     │
│   process.argv ── argv routing (lines 229–263)                      │
│        │                                                            │
│        ├── no `query` token       → spawnUpstream(argv)             │
│        ├── isBeadsManaged()=false → spawnUpstream(argv)             │
│        └── beads-managed query    ↓                                 │
│                                                                     │
│              dynamic import:  query/index.js, query/registry.js     │
│              createRegistry(eventStream, sessionId)  (line 274)     │
│              ↓                                                      │
│              for each [cmd,h] in BEADS_OVERRIDES:                   │
│                   registry.register(cmd, wrapMutation(h, …))        │
│              ─── NEW v0.2 ───                                       │
│              for each [cmd,h] in BEADS_READ_OVERRIDES:              │
│                   registry.register(cmd, h)   // no wrapMutation    │
│              ↓                                                      │
│              resolveQueryArgv(queryArgv, registry)  (line 297)      │
│              ↓                                                      │
│              registry.dispatch(cmd, args, projectDir)               │
│              ↓                                                      │
│   stdout: JSON.stringify(result)  OR  extractField(data, --pick)    │
└─────────────────────────────────────────────────────────────────────┘
                  │
                  ↓ (handler body, NEW for v0.2)
┌─────────────────────────────────────────────────────────────────────┐
│   beadsRoadmapAnalyze / beadsProgressJson / beadsSummaryExtract …   │
│                                                                     │
│   1. argument parsing (positional + --flag pairs from `args`)       │
│   2. bd CLI invocation(s)  via execSync(..., { cwd: projectDir })   │
│   3. transform raw bd JSON → upstream's printer-compatible shape    │
│   4. return { data: { … , backend: 'beads' } }                      │
└─────────────────────────────────────────────────────────────────────┘
```

The dotted box is **the only file that changes for v0.2.** No new files in `bin/`. New handlers and one new export (`BEADS_READ_OVERRIDES`) are appended to the existing single file. D-02 invariant remains satisfied — see §2 for the table-decision rationale.

---

## 2. Component responsibilities

| Component | Responsibility | Lives in |
|---|---|---|
| **argv router (lines 229–263)** | Decide passthrough vs override. Two-stage: (a) is `query` token present? (b) is project beads-managed? Falls through to upstream on either NO. **No change in v0.2.** | `bin/gsd-sdk-shadow.mjs` |
| **registry assembly (lines 266–279)** | Dynamically import upstream's `createRegistry` + `resolveQueryArgv`. Register every entry of `BEADS_OVERRIDES` (mutations) wrapped with `wrapMutation`. **v0.2 ADDS:** register every entry of `BEADS_READ_OVERRIDES` UNWRAPPED. | same file, after line 279 |
| **`BEADS_OVERRIDES` table (line 205)** | Allow-list of **mutations**: 13 handlers. Each is wrapped via `wrapMutation` to emit `GSDEvent.StateMutation` (today a no-op because eventStream=null, but the wrap preserves D-09 forward compat). **D-02 invariant: 13 entries; do not add reads here.** | line 205 (unchanged) |
| **`BEADS_READ_OVERRIDES` table — NEW** | Allow-list of **read handlers**: ~3–7 entries (e.g. `roadmap.analyze`, `roadmap.get-phase`, `progress`, `progress.json`, `progress.bar`, `progress.table`, `summary.extract`, `state-snapshot`, …). Reads emit no `GSDEvent` (none of upstream's read handlers do either) so they are registered without `wrapMutation`. | inserted directly below `BEADS_OVERRIDES` (after line 219) |
| **mutation handlers `beads*`** | Validate args → 1+ `bd` calls via `execSync` → return `{ data: { …, backend: 'beads' } }`. **No change in v0.2.** | lines 27–200 |
| **read handlers `beads*Read` — NEW** | Same shape as mutation handlers, but: (a) pure reads (no `bd close`/`bd label add`/etc.); (b) compose multiple `bd list` / `bd show` / `bd children` calls into the upstream printer's expected `data` shape. | inserted between `beadsMilestoneComplete` (line 199) and `BEADS_OVERRIDES` (line 205) |
| **`isBeadsManaged()` (line 232)** | Existence check on `.beads/metadata.json`. The single gate that decides "do we override?". **No change.** | line 232 |
| **`spawnUpstream()` (line 248)** | `spawnSync` upstream gsd-sdk with stdio=inherit and exits with its status. Used at lines 256, 262, 300. **No change.** | line 248 |
| **stdout writer (lines 305–308)** | Single line: `console.log(--pick? extractField(result.data,…) : JSON.stringify(result))`. Same path for reads — they return `{data:{…}}`, so `--pick` "Just Works". **No change in v0.2.** | lines 305–308 |

---

## 3. Answer to each architecture question

### Q1 — Same table or new table?

**Recommendation: NEW table — `BEADS_READ_OVERRIDES`.** Rationale:

1. **D-02 invariant is mutation-specific.** The comment at line 203 reads *"D-02 invariant: exactly 13 entries, all in this single file."* It was written for the 13 state-bearing **mutations** (Spike 006's matrix). It explicitly counts entries; adding reads would break that count and obscure the mutation-allow-list audit story.
2. **wrapMutation does not apply to reads.** Line 277 wraps every entry with `wrapMutation`. `wrap-mutation.mjs` builds a `GSDEvent` whose seven prefix branches all emit StateMutation/ConfigMutation/etc. Read handlers in upstream do **not** emit `GSDEvent`s (verified — none of `roadmapAnalyze`, `progressJson`, `summaryExtract`, `stateSnapshot` emit any). Wrapping reads would emit semantically wrong events the moment eventStream is wired in v0.3+.
3. **Two registration loops, two semantics.** Cleanest expression: mutations through `wrapMutation`, reads through plain `registry.register`. Co-locating in one table forces a "mutation? read?" predicate inside the loop or a duplicate iteration anyway.
4. **Audit boundary stays sharp.** Threat T-02-05 ("explicit allow-list; unknown commands → spawnUpstream") is a stronger guarantee when each table tells one story. A reviewer asking "what mutations does the shadow override?" gets a 13-entry table; "what reads?" gets the read table.

Concretely:

```javascript
// line 205 — UNCHANGED
export const BEADS_OVERRIDES = { /* 13 mutation entries */ };

// line ~221 — NEW
export const BEADS_READ_OVERRIDES = {
  'roadmap.analyze': beadsRoadmapAnalyze,
  'roadmap.get-phase': beadsRoadmapGetPhase,
  'progress': beadsProgressJson,
  'progress.json': beadsProgressJson,
  'progress.bar': beadsProgressBar,
  'progress.table': beadsProgressTable,
  // … extend per phase ordering in §6
};
```

Update the comment at line 203 to: *"D-02 invariant: exactly 13 mutation entries in `BEADS_OVERRIDES`. Read overrides live in `BEADS_READ_OVERRIDES` below."*

### Q2 — Handler signature (canonical, by reading the existing 13)

Every existing handler has identical shape:

```javascript
async function beadsX(args, projectDir) { /* … */ return { data: {/*…*/} }; }
```

- **Inputs:** `(args: string[], projectDir: string)`. The third upstream parameter `workstream` is documented in `registry.js` (line 109) but the shadow currently does not extract or forward it. Read handlers in v0.2 should accept it as an optional third positional parameter to match upstream's typed signature, but ignore it for the MVP — equivalent to the v0.1 handlers' silent non-use:
  ```javascript
  async function beadsRoadmapAnalyze(args, projectDir, _workstream) { … }
  ```
  This is a no-op for cwd-style projects (no workstream override) and stays forward-compatible.
- **Output:** `Promise<{ data: object, exit_code?: number }>`. Every existing handler returns `{ data: { … } }`. None set `exit_code` — the shadow's stdout writer (line 305) consumes only `result.data` (for `--pick`) or stringifies the whole `result` (without `--pick`). So `exit_code` is reserved for future use; reads should follow the existing convention and return `{ data }` only.
- **`backend: 'beads'` marker:** every existing mutation appends `backend: 'beads'` to its data. Read handlers should do the same — gives downstream skills (and tests) a deterministic way to know the response came from the shadow, not upstream. Compatible with extra fields the upstream printer expects: `{ phases: [...], milestone_version: 'v1.0', backend: 'beads' }`.
- **Error path:** existing handlers `throw new Error('phase.complete: requires args[0] = phase-id')` for argument validation; shadow's `try { … } catch` at line 309 logs and exits 1. Read handlers: same pattern, but for genuinely missing data (e.g. ROADMAP-equivalent has no phases yet), upstream returns `{ data: { error: '…' } }` — match this so callers' existing error-handling continues to work. **Throw only for argument-shape errors (invalid `--fields`), return `{data:{error:…}}` for "valid request but no data."**

### Q3 — Argument parsing

The shadow itself parses NO command-specific args. By the time a handler runs, the SDK has already done two things:

1. `resolveQueryArgv(queryArgv, registry)` (line 297) — does longest-prefix scan over registry keys, splits the input into `{ cmd, args }`. This handles dotted vs space-aliased forms automatically. So `gsd-sdk query roadmap.analyze` and `gsd-sdk query roadmap analyze` both arrive at the same handler with the same `args`.
2. `--project-dir <value>` is already stripped (lines 282–286).
3. `--pick <field>` is already stripped (lines 289–294) and applied at print time.

Everything else in `args` is positional or `--flag value` pairs that **the handler itself parses**. Look at the upstream pattern in `summaryExtract` (lines 96–106 of `query/summary.js`):

```javascript
export const summaryExtract = async (args, projectDir) => {
  const fieldsIdx = args.indexOf('--fields');
  const pathArgs  = fieldsIdx === -1 ? args : args.slice(0, fieldsIdx);
  const summaryPath = pathArgs[0] ?? '';
  const fields = fieldsIdx !== -1 && args[fieldsIdx + 1]
    ? args[fieldsIdx + 1].split(',').map(f => f.trim())
    : null;
  // …
};
```

**Convention to match:** scan `args.indexOf('--flag')`; positional args occupy the head before the first `--`. This is exactly what `beadsPhaseInsert` (lines 60–61) already does for positional args. v0.2 read handlers must use this same pattern — no introducing yargs/commander dependencies, no shadow-side flag stripping beyond the existing `--project-dir` / `--pick` pair.

Concrete shapes the v0.2 read handlers will see:
- `gsd-sdk query roadmap.analyze`                     → `args = []`
- `gsd-sdk query roadmap.get-phase 3`                 → `args = ['3']`
- `gsd-sdk query summary.extract foo/SUMMARY.md`      → `args = ['foo/SUMMARY.md']`
- `gsd-sdk query summary.extract foo.md --fields a,b` → `args = ['foo.md', '--fields', 'a,b']`
- `gsd-sdk query progress.bar`                        → `args = []`

### Q4 — Output formatting (printer responsibility)

**Handlers return the data structure unchanged. The shadow's `console.log` at line 305 is the only printer.** Reading lines 304–308:

```javascript
const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
console.log(pickField !== undefined
  ? registryModule.extractField(result.data, pickField)
  : JSON.stringify(result));
```

There is **no upstream printer.** The shadow's writer line is the printer. Whatever the handler puts in `result.data` is what reaches stdout (modulo the `--pick` field extractor, which is upstream's `extractField` — already wired).

This means v0.2 read handlers carry **double responsibility**:

1. Match the **shape** that downstream skills expect (the 17 GSD readers from Spike 007, plus the SDK consumers).
2. Embed any rendering — e.g. `progressBar` is "supposed to" return a one-line progress string; in upstream it does so by computing the bar string and putting it in `data.bar` (or similar — verify per handler before implementation). The shadow's printer doesn't do markdown rendering or table formatting; whatever shape upstream's handler returns is the contract.

**Critical implication for v0.2:** every read handler must produce a `data` shape **identical to upstream's same-name handler** so existing skills don't break. Practical workflow per handler:
1. Open upstream's `query/{module}.js` for the target command.
2. Identify the exact `{ data: {…} }` shape it returns.
3. Re-derive that shape from `bd list` / `bd children` / `bd show` JSON.
4. Add `backend: 'beads'` to the data object.

For `roadmap.analyze` specifically, upstream's `query/roadmap.js` line 373+ returns:
```javascript
{ data: { milestones: [...], phases: [...], current_phase: {…} | null, progress_percent, … } }
```
The bd-backed equivalent must reproduce that shape, sourcing phases from `bd list --type=epic -l gsd:phase --json` and milestones from `bd list -l milestone:* --json` (or the schema extension labels from Spike 007).

### Q5 — Fallback path (no behavior change for non-bd projects)

The fallback wiring is **already in place** at line 260:

```javascript
const projectDir = getProjectDir(argv);
if (!isBeadsManaged(projectDir)) {
  log(`${projectDir} is not beads-managed; passing to upstream.`);
  spawnUpstream(argv);    // process.exit() — never returns
}
```

This runs **before** `createRegistry()` and **before** any of our `register()` calls. It applies to every command — mutations and reads alike. No new code is needed for v0.2 to preserve passthrough.

The single consequence: **adding read handlers to `BEADS_READ_OVERRIDES` cannot change non-bd-project behavior**, because `isBeadsManaged()` short-circuits earlier. This is the architectural invariant that lets v0.2 ship without regression risk for non-bd users.

There is one further fallback at line 298: `if (!matched) spawnUpstream(argv)`. This catches the case where the project IS beads-managed but the command isn't in either override table — e.g. `gsd-sdk query stats.json` while we don't override stats. This is the desired behavior for v0.2: only override what we explicitly list. Everything else continues to use upstream's MD-backed handlers, which still work because `bd-sync.sh` regenerates ROADMAP.md from beads. **The shadow does not need to override every read** — only those where bd is faster, more accurate, or where the regenerated MD is known to lag.

### Q6 — Testing pattern

The existing `tests/shadow-tests/` directory has a clear, ~50-line-per-handler fixture pattern:

```javascript
import { test }       from 'node:test';
import assert         from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir }     from 'node:os';
import { join }       from 'node:path';
import { fileURLToPath } from 'node:url';

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');

function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-handler-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

function runShadow(args, dir) {
  return spawnSync('node', [SHADOW, ...args], { encoding: 'utf-8', cwd: dir });
}

test('roadmap.analyze CASE 1: empty project — returns zero phases', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(['query', 'roadmap.analyze', '--project-dir', dir], dir);
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.deepEqual(parsed.data.phases, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

**Existing properties confirmed:**

- **Three-case minimum per handler.** Every existing handler test has CASE 1 (happy path), CASE 2 (data assertion via direct `bd show ${id} --json`), CASE 3 (error path: missing args, unknown ID, etc.). v0.2 should match — minimum 3 cases per read handler.
- **bd is ambient.** Tests assume `bd` is on PATH (the install requirement from Spike 001). No mocking of `bd`; use it directly.
- **Negative testing exists.** `argv-routing.test.mjs` CASE 6 explicitly tests "non-beads project — passes through to upstream" using `nonBeadsFixture()` (a tempdir without `bd init`). This is the canonical example for the v0.2 falls-through-when-no-`.beads/` test (one such case per new read handler is enough; the routing test already covers the gate generically).
- **--pick coverage.** `argv-routing.test.mjs` CASE 4 covers `--pick`; new read handlers don't need their own `--pick` case unless they have non-trivial nested fields. Add a `--pick` case for `roadmap.analyze` because consumers will want `phases[0].number` style extraction.
- **Test naming convention.** `handler-{kebab-cmd}.test.mjs`. v0.2 files: `handler-roadmap-analyze.test.mjs`, `handler-progress-json.test.mjs`, `handler-summary-extract.test.mjs`, `handler-state-snapshot.test.mjs`, etc.
- **Fixture pollution discipline.** `try { … } finally { rmSync(dir, { recursive: true, force: true }); }` — required.

**One v0.2-specific test pattern: shape-parity tests.** Because read handlers must produce the same `data` shape as upstream's handler, add a `tests/shadow-tests/parity-roadmap-analyze.test.mjs` that compares keys (not values) of `runShadow(['query', 'roadmap.analyze'])` output against a captured fixture of upstream output. Catches drift when upstream adds new fields. (Reuses Spike 013's parity check pattern.)

### Q7 — Performance (caching across calls)

**Recommendation: NO caching in v0.2.** Reasons:

1. **The shadow is a one-shot CLI process.** Every `gsd-sdk query …` invocation `node`s the shadow afresh. `process.pid` changes; module-level state is gone. There is no "process" that lives across multiple skill turns.
2. **Cross-process caching adds risk.** A file-based cache in `.beads/.gsd-cache/` would need invalidation rules, file locks (Spike 005 already uses an embedded-Dolt write lock on bd's side), and would defeat the "bd is the SoT" invariant the moment cache and bd disagree.
3. **bd is fast enough.** `bd list --type=epic -l gsd:phase --json` on the test fixtures benchmarks ~75ms (per the existing in-handler comments at lines 27, 38, 59, 91). A worst-case `roadmap.analyze` is 2–3 bd calls (~225ms). Below the typical Claude-skill-turn budget.
4. **In-handler memoization is fine and free.** A single `roadmap.analyze` invocation that calls `bd list` once and reuses the JSON in two places is not "caching" — that's just normal coding. Do this. Don't introduce LRU/disk caches.

**If a future skill turn pattern (Phase 3+) demonstrably needs cross-call caching**, the right place is a `bd-export-cache.json` regenerated by `bd-sync.sh`'s PostToolUse hook (already running after every `bd` write). That gives free invalidation and zero extra IPC. v0.2 does not need it.

---

## 4. Data flow

### Read query — happy path

```
gsd-sdk query roadmap.analyze --pick phases[0].name --project-dir /proj
        ↓
[1] argv routing                              gsd-sdk-shadow.mjs lines 230–246
    queryIdx = 0 (no — there IS a `query` token at idx 0)
    projectDir = /proj   (valid existsSync)
    isBeadsManaged(/proj) → existsSync('/proj/.beads/metadata.json') → true
        ↓
[2] dynamic import                            lines 266–267
    queryModule = await import(QUERY_INDEX_PATH)
    registryModule = await import(REGISTRY_PATH)
        ↓
[3] registry assembly                         lines 274–279 + NEW v0.2
    registry = createRegistry(eventStream=null, sessionId)
    for [cmd,h] in BEADS_OVERRIDES:       registry.register(cmd, wrapMutation(h, …))
    for [cmd,h] in BEADS_READ_OVERRIDES:  registry.register(cmd, h)         ← NEW
        ↓
[4] strip --project-dir, --pick               lines 282–294
    queryArgv = ['roadmap.analyze']
    pickField = 'phases[0].name'
        ↓
[5] resolve to handler                        line 297
    matched = { cmd: 'roadmap.analyze', args: [] }
        ↓
[6] dispatch                                  line 304
    result = await registry.dispatch('roadmap.analyze', [], '/proj')
            ↓
            (inside beadsRoadmapAnalyze)
            execSync('bd list --type=epic -l gsd:phase --json', { cwd: '/proj' })
            execSync('bd list -l gsd:requirement --json',    { cwd: '/proj' })
            for each phase: execSync(`bd children ${id} --json`, …)
            transform → { data: { phases:[…], milestones:[…], …, backend:'beads' } }
        ↓
[7] write output                              lines 305–308
    extractField(result.data, 'phases[0].name')   → 'Phase 1: Auth'
    console.log('Phase 1: Auth')
    process.exit(0)
```

### Read query — non-bd project

```
gsd-sdk query roadmap.analyze --project-dir /tmp/no-bd
        ↓
[1] argv routing
    isBeadsManaged('/tmp/no-bd') → false
        ↓
[2] spawnUpstream(argv)                       line 248–252
    spawnSync(UPSTREAM_BIN, ['query','roadmap.analyze','--project-dir','/tmp/no-bd'], stdio=inherit)
    process.exit(result.status)               ← upstream's behavior reaches user unchanged
```

No code path through createRegistry, no BEADS_READ_OVERRIDES considered. **This is why v0.2 is regression-free for non-bd projects** — the gate is decided before any new code runs.

### Read query — bd-managed but command not overridden

```
gsd-sdk query stats.json    (we don't override stats.*)
        ↓
[1]–[4] argv routing, registry assembly, strip flags
        ↓
[5] resolveQueryArgv(['stats.json'], registry)
    registry has 'stats.json' (upstream registered it; our register() didn't touch it)
    matched = { cmd: 'stats.json', args: [] }
        ↓
[6] dispatch                                  line 304
    Upstream's statsJson handler runs (we didn't override).
        ↓
[7] write output unchanged
```

This is the elegant property of registry-override: **non-overridden reads dispatch through upstream's handler in the same registry**, no spawn, no second process. The shadow only spawns upstream when (a) no `query` token, (b) project not bd-managed, or (c) `resolveQueryArgv` returns null (genuinely unknown command).

---

## 5. Skeleton handler — `roadmap.analyze`

This is the build-order primary (rationale in §6). Skeleton mirrors the existing mutation-handler style for consistency:

```javascript
// Budget ~250ms (3 bd calls + per-phase children walk; cap N≈10 phases for typical projects)
async function beadsRoadmapAnalyze(_args, projectDir, _workstream) {
  // 1. Load all phase beads with metadata
  const phaseListRaw = execSync(
    `bd list --type=epic -l gsd:phase --status=all -n 0 --json`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  let phaseBeads = [];
  try { phaseBeads = JSON.parse(phaseListRaw); } catch { phaseBeads = []; }

  // 2. Sort phases (priority desc, then creation order — matches upstream's numeric phase ordering)
  phaseBeads.sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));

  // 3. For each phase, count tasks/plans (children) — upstream's roadmap.analyze tracks plan_count, summary_count
  const phases = [];
  for (let i = 0; i < phaseBeads.length; i++) {
    const p = phaseBeads[i];
    const childRaw = execSync(
      `bd children ${p.id} --json`,
      { cwd: projectDir, encoding: 'utf-8' }
    ).trim();
    let children = [];
    try { children = JSON.parse(childRaw); } catch { children = []; }

    // Status mapping: bd open → 'planned', closed → 'complete', etc.
    // Match upstream's status vocabulary: 'planned' | 'partial' | 'complete' | 'empty' | 'discussed' | 'researched'
    const totalChildren = children.length;
    const completedChildren = children.filter(c => c.status === 'closed').length;
    let diskStatus = 'empty';
    if (completedChildren === totalChildren && totalChildren > 0) diskStatus = 'complete';
    else if (completedChildren > 0) diskStatus = 'partial';
    else if (totalChildren > 0) diskStatus = 'planned';

    // Parse Goal / Success Criteria from description per Spike 007 convention
    const goalMatch  = (p.description ?? '').match(/^Goal:\s*(.+)$/m);
    const dependsMatch = (p.description ?? '').match(/^Depends on:\s*(.+)$/m);

    phases.push({
      number: String(i + 1),                          // upstream uses string '1','2','2.1'…
      name: p.title,
      goal: goalMatch ? goalMatch[1].trim() : null,
      depends_on: dependsMatch ? dependsMatch[1].trim() : null,
      disk_status: diskStatus,
      plan_count: totalChildren,
      summary_count: completedChildren,
      // … additional fields per upstream's exact shape: has_context, has_research
    });
  }

  // 4. Aggregate
  const totalPlans     = phases.reduce((s, p) => s + p.plan_count, 0);
  const totalSummaries = phases.reduce((s, p) => s + p.summary_count, 0);
  const progressPercent = totalPlans > 0
    ? Math.round((totalSummaries / totalPlans) * 100)
    : 0;

  // 5. Find current_phase: first phase with disk_status === 'partial' || 'planned'
  const currentPhase = phases.find(p => p.disk_status === 'partial' || p.disk_status === 'planned') ?? null;

  return {
    data: {
      phases,
      phase_count: phases.length,
      current_phase: currentPhase,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      progress_percent: progressPercent,
      milestones: [],     // v0.2 first-cut: defer until milestone labels are designed
      backend: 'beads',
    },
  };
}
```

**Caveats the skeleton flags:**

- `(_args, projectDir, _workstream)` — the workstream param is accepted but ignored, matching upstream's typed signature.
- `bd children ${p.id}` is the per-phase walk. With 10 phases, that's 11 bd calls. Acceptable for v0.2 (~750ms). If profiling shows 30+ phases as common, swap to a single `bd list --type=task --parent <each>` aggregation in a future phase.
- Status vocabulary alignment is the **single most fragile point**: upstream's `roadmap.analyze` returns `disk_status: 'complete'|'partial'|'planned'|'empty'|'discussed'|'researched'`. The skeleton derives only the first four. The "discussed"/"researched" cases require checking for `CONTEXT.md`/`RESEARCH.md` filesystem presence, which the bd-backed handler may need to sidestep (those are narrative artifacts not modeled in beads). Discussion: either (a) drop the two states for the bd backend and document the contract gap, or (b) preserve the filesystem check from upstream. **Defer that decision to v0.2 plan/discuss phase.**
- Milestone aggregation is left as `milestones: []` — Spike 007's `milestone:vX.Y` label convention is the design but its full implementation may belong to a separate handler (`milestone.list`) in a later milestone.

---

## 6. Build-order recommendation (for the roadmapper, not a phase definition)

Per the downstream-consumer instructions, I'll surface build-order rationale only — the roadmapper sequences phases.

| Order | Handler | Why this order |
|---|---|---|
| 1 | `roadmap.analyze` | Primary user-visible blocker today; it's what `gsd-progress`, `gsd-next`, `gsd-manager` and most readers depend on. Implementing this first proves end-to-end shape parity and unblocks downstream skills. Highest test-coverage payoff per LOC. |
| 2 | `roadmap.get-phase` | Single-phase variant of #1; reuses helpers (status mapping, description parsing). Logical extension once parser/transform code exists. |
| 3 | `progress` / `progress.json` | Same data source as `roadmap.analyze` (phases + child counts), different shape. Implement together — they share `bd list --type=epic -l gsd:phase --json` and the phase-children walk. Alias `progress` → `progressJson` matches upstream lines 234–235. |
| 4 | `progress.bar` / `progress.table` | Pure rendering layer over `progress.json` (per upstream lines 116–120, `progressBar` calls `progressJson` first). Trivial after #3 ships. Pure transform of already-validated data. |
| 5 | `summary.extract` | Independent — touches phase artifacts on disk (`SUMMARY.md` files, narrative MD), NOT bd. Could be skipped from v0.2 entirely if the contract is "summary.extract continues to read MD because narrative MD isn't beads-managed." Adding it only makes sense if a follow-on phase teaches gsd-beads to mirror summary frontmatter into bead notes — which is out of scope for v0.2. **Recommend: defer to v0.3.** |
| 6 | `state-snapshot` | Reads STATE.md frontmatter today. Beads has `bd remember` memories that could replace the decisions/blockers tables, but STATE.md fields like `Current Phase`, `Progress %`, `Status` overlap with what `roadmap.analyze` returns. Implement after #1–4 if the skill matrix shows it's a real blocker; otherwise let upstream continue handling it from regenerated STATE.md (produced by `bd-sync.sh`). |

**Summary build order: roadmap.analyze → roadmap.get-phase → progress.* family.** That's 3–6 read handlers depending on how aggressive v0.2 is. State-snapshot and summary-extract are good v0.3 candidates.

---

## 7. Integration points — every place a new line of code lands

| File | Lines | Change |
|---|---|---|
| `bin/gsd-sdk-shadow.mjs` | After line 199 (after `beadsMilestoneComplete`) | Add 3–6 new `async function beadsX(args, projectDir, _workstream) { … }` definitions. |
| `bin/gsd-sdk-shadow.mjs` | Line 203 comment | Edit comment to reflect "13 mutations + N reads". |
| `bin/gsd-sdk-shadow.mjs` | Line 220 (immediately after `BEADS_OVERRIDES` close brace) | Add `export const BEADS_READ_OVERRIDES = { … };`. |
| `bin/gsd-sdk-shadow.mjs` | After line 279 (after the existing register loop) | Add a second loop: `for (const [cmd, handler] of Object.entries(BEADS_READ_OVERRIDES)) { registry.register(cmd, handler); }` — **no `wrapMutation`**. |
| `tests/shadow-tests/handler-roadmap-analyze.test.mjs` | new file | 3+ test cases per Q6 pattern. |
| `tests/shadow-tests/handler-roadmap-get-phase.test.mjs` | new file | Same. |
| `tests/shadow-tests/handler-progress-json.test.mjs` | new file | Same. Include alias check: `query progress` and `query progress.json` produce identical output. |
| `tests/shadow-tests/handler-progress-bar.test.mjs` | new file | Same. |
| `tests/shadow-tests/handler-progress-table.test.mjs` | new file | Same. |
| `tests/shadow-tests/parity-roadmap-analyze.test.mjs` | new file (recommended) | Captures upstream's `data` keys for a fixture project; asserts shadow's keys match. Catches schema drift. |
| `tests/shadow-tests/argv-routing.test.mjs` | possibly extend CASE 7 | Add a "read handler unknown command falls through" assertion specific to a non-overridden read like `stats.json`. |
| No new files in `bin/` | — | The MVP fits in the existing shadow file. |
| No changes to `wrap-mutation.mjs` | — | Reads do not go through it. |

---

## 8. Anti-patterns to avoid (specific to v0.2 reads)

### Anti-Pattern 1: Wrapping reads with `wrapMutation`

**What people do:** Co-locate read handlers in `BEADS_OVERRIDES` for "code uniformity" and let the existing register loop wrap them.
**Why it's wrong:** Emits `GSDEvent.StateMutation` events when eventStream is wired. Reads are not state mutations. Pollutes the audit log. Breaks the v0.3+ event-emission story.
**Do this instead:** Two tables (`BEADS_OVERRIDES` + `BEADS_READ_OVERRIDES`), two register loops; reads register raw.

### Anti-Pattern 2: Reformatting at the print layer

**What people do:** Have `beadsProgressBar` return `{ data: { plans, summaries } }` and rely on the shadow's stdout writer (or a new printer in shadow) to render the bar.
**Why it's wrong:** Upstream's `progressBar` puts the rendered bar string in the data. Drift between shadow and upstream output shapes breaks downstream consumers.
**Do this instead:** Match upstream's `data` shape exactly. The shadow's `console.log` is dumb on purpose — never add formatting logic to lines 305–308.

### Anti-Pattern 3: Overriding reads that don't need it

**What people do:** Add every upstream read command to `BEADS_READ_OVERRIDES` "for completeness."
**Why it's wrong:** Each override is a coupling cost (must track upstream's shape changes). Most reads work fine through upstream's already-MD-aware handler running on `bd-sync.sh`-regenerated MD. Override only when (a) the regen lags meaningfully, (b) bd has data the MD doesn't, or (c) bd is significantly faster.
**Do this instead:** Curate the override list. v0.2 = 3–6 commands. Skills that don't override stay as-is.

### Anti-Pattern 4: Re-reading `bd` JSON for every aliased command

**What people do:** Register `progress` and `progress.json` to two different functions both calling `bd list`.
**Why it's wrong:** Doubles bd calls per skill turn for no benefit. Upstream solves this by aliasing both keys to the same function (`registry.register('progress', progressJson); registry.register('progress.json', progressJson);` — index.js lines 234–235).
**Do this instead:** Match upstream's aliasing exactly. One function, multiple registry keys.

### Anti-Pattern 5: Caching across shadow processes

**What people do:** Build a `.beads/.gsd-cache/roadmap.json` to skip bd between calls.
**Why it's wrong:** Every shadow invocation is a new process; cache invalidation requires an entirely new write-side discipline (file locks, mtime checks). Rebuilds the read-after-write semantics bd already provides.
**Do this instead:** No cache. If perf becomes an issue, generate a `bd export` JSONL snapshot in `bd-sync.sh`'s PostToolUse hook (already running after every bd write — automatic invalidation). The cache lives outside the shadow.

---

## 9. Sources

| Source | Confidence | Used for |
|---|---|---|
| `/home/ellio/code/gsd-beads/bin/gsd-sdk-shadow.mjs` (read in full) | HIGH | Every claim about line numbers, handler signatures, register loop, fallback path, --pick handling, isBeadsManaged guard. |
| `/home/ellio/code/gsd-beads/bin/wrap-mutation.mjs` (read in full) | HIGH | Why reads should NOT be wrapped (the seven-branch event builder is mutation-shaped). |
| `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/registry.js` (read in full) | HIGH | `(args, projectDir, workstream)` typed signature; `extractField`, `resolveQueryArgv` semantics; longest-prefix scan. |
| Upstream `query/index.js` lines 212–484 (registration table) | HIGH | What read commands exist and which alias to which handler. Verified `progress` ↔ `progressJson`, `progress.bar` ↔ `progressBar`, `roadmap.analyze` ↔ `roadmapAnalyze`, `summary.extract` ↔ `summaryExtract`, `state-snapshot` ↔ `stateSnapshot`. |
| Upstream `query/roadmap.js` lines 373+ | HIGH | Exact `data` shape `roadmap.analyze` returns; phases array fields; status vocabulary. |
| Upstream `query/progress.js` lines 73–120 | HIGH | `progressJson` and `progressBar` shapes; the alias of `progress` → `progressJson`; the fact that `progressBar` builds on `progressJson`. |
| Upstream `query/summary.js` lines 96–106 | HIGH | Argument-parsing convention (positional + `--fields` flag); `{data:{error:…}}` for missing-data shape. |
| Upstream `query/state.js` lines 318+ | HIGH | `stateSnapshot` reads STATE.md frontmatter — so beads-backed override would need to either replace the source or stay as upstream-handled. |
| `/home/ellio/code/gsd-beads/tests/shadow-tests/argv-routing.test.mjs` | HIGH | Test fixture pattern, beads vs non-beads fixture, --pick test, fallback test. |
| `/home/ellio/code/gsd-beads/tests/shadow-tests/handler-phase-add.test.mjs`, `handler-phases-clear.test.mjs`, `handler-milestone-complete.test.mjs` | HIGH | The 3-case-per-handler pattern; bd-side data assertion via `bd show ${id} --json`. |
| `/home/ellio/code/gsd-beads/.planning/spikes/013-architecture-y1-shadow-poc/README.md` | HIGH | The registry-override variant rationale; D-09 event-emission deferral; QueryHandler typed contract. |
| `/home/ellio/code/gsd-beads/.planning/spikes/007-reader-skill-format-contract/README.md` | HIGH | Format contract for read consumers; `bd list --type=epic -l gsd:phase --json` is the canonical phase query; Goal/Success-Criteria description-format convention. |
| `/home/ellio/code/gsd-beads/.planning/spikes/MANIFEST.md` (line 50, Spike 013 finding) | HIGH | "13 mutation overrides; substitute skills become OPTIONAL"; coupling cost of new upstream commands; `createRegistry` event-wrapping caveat. |
| `/home/ellio/code/gsd-beads/.planning/spikes/CONVENTIONS.md` | MEDIUM | Stack and style conventions (ESM, no build tools, `try/finally rmSync` discipline). |

---

*Architecture research for: gsd-beads v0.2 read handlers*
*Researched: 2026-04-29*
*Confidence: HIGH — every claim grounded in current source code, current tests, or current spike findings.*
