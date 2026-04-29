# Pitfalls Research

**Domain:** gsd-sdk shadow — adding read-side handlers to an existing mutation-only shadow
**Researched:** 2026-04-29
**Confidence:** HIGH (codebase + upstream source + spike findings cross-referenced)

## Context

This is internal-infra research, not a domain product. The gsd-sdk shadow at
`bin/gsd-sdk-shadow.mjs` already overrides 13 mutation handlers; v0.2 adds
read-side handlers (`roadmap.analyze`, `state-snapshot`, `progress`/`progress.json`)
that derive answers from `bd` instead of letting upstream's file parser walk
markdown the regen scripts no longer produce in the expected shape.

The bug being repaired: upstream's `roadmapAnalyze` (in upstream's
`sdk/dist/query/roadmap.js` line 373) parses `### Phase N: Name` headers from
ROADMAP.md. `regen-roadmap.sh` instead emits `### <title>` (line 168) — no
"Phase N:" prefix — so upstream's regex returns zero phases. Every reader
(`gsd-progress`, `gsd-next`, `gsd-manager`, planner, plan-checker, …, all 17
identified in Spike 006) sees an empty phases list and silently misroutes.

"Pitfalls" therefore means: **mistakes that cause read handlers to silently
return wrong data while looking like they work**.

---

## Critical Pitfalls

### Pitfall 1: Output-shape drift — fields renamed, dropped, or added

**What goes wrong:**

The bd-backed `roadmapAnalyze` returns `{ data: { phases, phase_count, … } }`,
but upstream callers (the `gsd-progress` skill prompt, `gsd-next`, the
init-composition handlers in upstream's `init.js`) read specific field names
from this object. If our handler returns `{ data: { phaseList, count, … } }`
or omits `missing_phase_details`, the caller silently sees `undefined` and
behaves as if the project has zero phases. This is the EXACT shape of the
existing bug, transplanted from the regen-md path into the SDK path.

The full canonical contract for `roadmap.analyze` (from upstream
`sdk/dist/query/roadmap.js` lines 480-492):

```js
{ data: {
    milestones: [{ heading, version }],
    phases: [{ number, name, goal, depends_on, plan_count, summary_count,
               has_context, has_research, disk_status, roadmap_complete }],
    phase_count: <int>,
    completed_phases: <int>,
    total_plans: <int>,
    total_summaries: <int>,
    progress_percent: <0..100>,
    current_phase: <string|null>,
    next_phase: <string|null>,
    missing_phase_details: <string[]|null>,
}}
```

For `state-snapshot` (lines 396-410): `current_phase, current_phase_name,
total_phases, current_plan, total_plans_in_phase, status, progress_percent,
last_activity, last_activity_desc, decisions[], blockers[], paused_at,
session{last_date,stopped_at,resume_file}`. Thirteen fields, two of them
nested objects/arrays.

Drift can also occur in TYPES — `phase_count` as `"6"` instead of `6` works
in JS but breaks any caller that does `phase_count > 0` (string truthy with
"0" is true).

**Why it happens:**

(a) Upstream's contract is undocumented except by reading the source. The
existing 13 mutation handlers each invented their own response shape (e.g.
`{ data: { phase_id, title, status, backend } }`) and nothing enforced
parity with upstream because mutations write before they return. Reads ARE
the contract — drift is silent.

(b) `disk_status` enum has 7 string values (`complete`, `partial`,
`planned`, `empty`, `discussed`, `researched`, `no_directory`) used by line
465-466 (`current_phase`/`next_phase` selection). A bd-backed handler is
tempted to map bd's status (`open`, `in_progress`, `closed`, `deferred`) to
these directly but the semantic gap is real — `disk_status: 'planned'`
means "PLAN.md exists but no SUMMARY.md", which has no bd analog.

**How to avoid:**

1. **Snapshot test against upstream's shape.** Add `tests/shadow-tests/handler-roadmap-analyze.test.mjs` with this exact assertion:
   ```js
   const upstreamKeys = ['milestones','phases','phase_count','completed_phases',
     'total_plans','total_summaries','progress_percent','current_phase',
     'next_phase','missing_phase_details'];
   for (const k of upstreamKeys) {
     assert.ok(k in parsed.data, `missing field: ${k}`);
   }
   const phaseKeys = ['number','name','goal','depends_on','plan_count',
     'summary_count','has_context','has_research','disk_status','roadmap_complete'];
   for (const p of parsed.data.phases) {
     for (const k of phaseKeys) assert.ok(k in p, `phase missing: ${k}`);
   }
   ```
2. **Type assertions for numeric fields:** `assert.equal(typeof parsed.data.phase_count, 'number')`.
3. **Document the disk_status mapping** as a comment in the handler:
   bd `closed` → `complete`; `in_progress` with non-zero children-closed → `partial`;
   `in_progress` zero closed → `planned`; `open` → `no_directory` (or `empty` if
   it has children).

**Warning signs:**

- A test that only checks `parsed.data.backend === 'beads'` and `parsed.data.phase_count >= 0` — passes for any object with those two keys.
- Hand-rolling the response object with `{ ...phases, current_phase: ... }` — drops fields by spread when phases is an array.
- Using `bd list … --json` output keys (`title`, `id`, `status`) directly
  instead of mapping to upstream keys (`name`, `number`, `disk_status`).

**Phase to address:**

Phase 1 (handler implementation) MUST include the snapshot test BEFORE
implementing the handler. Wave 0 (red marker) test stub covering all 10
upstream keys + 10 per-phase keys. Phase 1 turns it green by implementing
the mapping.

---

### Pitfall 2: Empty / partial bd state — handler crashes or returns garbage

**What goes wrong:**

Three scenarios where bd state is incomplete:

(a) `.beads/` exists (so `isBeadsManaged()` returns true) but no phase beads
have been created yet. `bd list -l gsd:phase --json` returns `[]`. Naive
handler does `phases[0].id` → `TypeError: Cannot read properties of undefined`.

(b) Some phases beaded, some still living in markdown. The bd-backed
handler returns a phases list shorter than ROADMAP.md, every reader
disagrees with reality, no error is raised.

(c) `bd` itself errors — corrupt embeddeddolt, lock contention, missing
binary on PATH. `execSync` throws; the dispatch catch in
`gsd-sdk-shadow.mjs:309` reports `dispatch failed: <message>` and exits 1.
Every read query fails, GSD command surface bricks.

**Why it happens:**

The existing mutation handlers (e.g. `beadsPhaseAdd` line 27) treat bd
errors as fatal because mutations have no fallback — a failed write must
fail loudly. Read handlers have a fallback: passthrough to upstream's
file parser. But the existing pattern of `execSync(...)` will throw and
the `try/catch` only exists at the outer dispatch level (line 303-312),
which converts every error to `process.exit(1)`. There is no per-handler
graceful-degradation path.

**How to avoid:**

1. **Wrap each `bd` call in `spawnSync` not `execSync`** to inspect
   `result.status` without throwing, mirroring the pattern in
   `argv-routing.test.mjs`. Pattern:
   ```js
   const out = spawnSync('bd', ['list','--type=epic','-l','gsd:phase','--json'],
     { cwd: projectDir, encoding: 'utf-8' });
   if (out.status !== 0) {
     log('bd list failed; passing to upstream:', out.stderr);
     throw new BeadsUnavailableError();  // caught at dispatch, falls through
   }
   ```
2. **Detect "no phase beads" as a pass-through trigger, not an empty result.**
   If `bd list -l gsd:phase --json` returns `[]` AND `.planning/ROADMAP.md`
   exists with phase headers, **let upstream parse the markdown**. Beading
   is gradual; treat unbeaded projects as not-yet-managed for read purposes.
   This is the inverse of the mutation guard — different scope, same logic.
3. **Per-handler fallback wrapper:**
   ```js
   async function withBeadsFallback(handler, cmd) {
     return async (args, projectDir) => {
       try { return await handler(args, projectDir); }
       catch (err) {
         log(`${cmd} bd-backed failed (${err.message}); falling through`);
         throw new BeadsUnavailableError();
       }
     };
   }
   ```
4. **`isBeadsManaged()` becomes `isBeadsPopulated()` for reads.** Check
   not just `.beads/metadata.json` but also `bd count -l gsd:phase > 0`.
   If zero, passthrough.

**Warning signs:**

- `parsed.data.phases.length === 0` returned for a project that visibly has
  phases in ROADMAP.md.
- Stack trace mentioning `JSON.parse` of empty string, or
  `Cannot read properties of undefined (reading '0')`.
- Test that creates a fresh `bd init` fixture and immediately queries
  `roadmap.analyze` — this is the empty-state test we lack.

**Phase to address:**

Phase 1 implementation MUST include three negative tests per read handler:
empty-bd, bd-unavailable (mock `BD_BIN=/bin/false`), and
mixed-state (bd has 1 phase, ROADMAP.md has 6). Test stubs in Wave 0.

---

### Pitfall 3: bd CLI fan-out — N+1 process spawns kill latency

**What goes wrong:**

A naive `roadmap.analyze` implementation:
```
1. bd list -l gsd:phase --json          (1 spawn)
2. for each phase: bd children <id>      (N spawns)
3. for each phase: bd show <id>          (N more spawns)
4. for each requirement: bd show         (M spawns)
```

On a 6-phase project this is 13 spawns × ~75-100ms = ~1 second per query.
GSD command-surface skills (`gsd-progress`, `gsd-next`, `gsd-manager`)
invoke `roadmap.analyze` ON EVERY TURN. A user typing `/gsd-progress` waits
1+ seconds; an autonomous agent doing 100 turns adds 100+ seconds of pure
`bd` CLI wall-clock that should be one query.

The existing mutation handlers already document this — see
`bin/gsd-sdk-shadow.mjs:37-38` ("Budget ~150ms × N — batch cost scales with
number of phases"). Mutations are user-driven (1-N per session), reads are
bot-driven (10-100 per session).

**Why it happens:**

`bd list <id>` looks like a graph traversal but it's a process spawn each
time. The pattern in `regen-roadmap.sh` (lines 134-218) already does
nested `bd children` + `bd show` calls inside a `while read` loop and
takes seconds — that's offline regen, not interactive read.

There IS a batched path: `bd export --json` returns the entire bead graph
in one call. Or `bd list --type=epic --json` (no label filter) returns
everything once and our handler does the in-memory traversal.

**How to avoid:**

1. **One `bd export --json` call per handler invocation, in-memory traversal.**
   ```js
   const all = JSON.parse(execSync('bd export --json', {cwd: projectDir, encoding: 'utf-8'}));
   const phases = all.filter(b => b.labels?.includes('gsd:phase'));
   const childrenById = groupBy(all, 'parent_id');  // or scan dependencies
   // …in-memory walk, no more spawns
   ```
2. **Performance gate in tests.** Add `tests/shadow-tests/perf-roadmap-analyze.test.mjs`:
   ```js
   const start = Date.now();
   const result = runShadow(['query','roadmap.analyze','--project-dir',dir]);
   const elapsed = Date.now() - start;
   assert.ok(elapsed < 500, `roadmap.analyze too slow: ${elapsed}ms`);
   ```
   Set the gate at 500ms initially; tighten to 250ms after batching is in.
3. **Document N+1 spawn budgets at top of each handler** — same convention
   as existing mutation handlers (`Budget ~150ms × N`). Reviewer can spot
   regressions instantly.

**Warning signs:**

- More than 2 distinct `execSync('bd …')` calls in a single read handler.
- A `for` loop containing `execSync` in a read handler.
- Test runtime for handler-roadmap-analyze.test.mjs > 1 second per case.
- `top` showing repeated `bd` process spawns during one Claude turn.

**Phase to address:**

Phase 1 (implementation) — choose `bd export` over `bd list + bd children + bd show`
from the start. Phase 2 (test coverage) — perf gate at 500ms. Reference
existing budget annotations on lines 27, 38, 59, 75 etc. of the shadow file.

---

### Pitfall 4: Determinism — `bd list --json` ordering flaps

**What goes wrong:**

`bd list --type=epic -l gsd:phase --json` returns phases in some order.
Empirically (see `regen-roadmap.sh:97-98`) this order is NOT priority-then-
created_at — that script EXPLICITLY pipes through `jq 'sort_by(.priority,
.created_at)'` because raw `bd list` ordering is implementation-defined.

If a read handler skips the sort, `phases[0]` (and therefore `current_phase`)
flaps between Claude turns within the same session. The user runs
`/gsd-progress` twice in a row and gets "Currently on Phase 3" then
"Currently on Phase 1". Worse: `next_phase` flapping causes
`/gsd-execute-phase` to start work on a different phase each invocation.

**Why it happens:**

bd's storage layer is Dolt; query order without an explicit `ORDER BY` is
the table's row-order which depends on insert sequence and recent updates.
Concurrent updates from cross-worktree usage (Spike 003, validated) can
re-order rows mid-session. The existing mutation handlers don't care
because they create one bead per call. Reads must canonicalize.

**How to avoid:**

1. **Always pipe `bd list --json` through a deterministic sort.** Match
   the `regen-roadmap.sh` convention: `sort_by(priority, created_at)`.
   In Node:
   ```js
   const phases = beads
     .filter(b => b.labels?.includes('gsd:phase'))
     .sort((a, b) => (a.priority - b.priority) || (a.created_at < b.created_at ? -1 : 1));
   ```
2. **Determinism test.** Run the same handler 5× in a row, assert all
   results are byte-identical:
   ```js
   const results = [];
   for (let i = 0; i < 5; i++) results.push(JSON.stringify(runShadow([…]).stdout));
   assert.equal(new Set(results).size, 1, 'roadmap.analyze flaps across calls');
   ```
3. **Tie-breaker on `id`.** When priority and created_at are equal (e.g.
   batch-created in <1s with the same priority — see
   `beadsPhaseAddBatch:38-56` and the perf-test fixtures), sort by `id`
   as the final tie-breaker. Hash-based bd IDs are stable across runs.

**Warning signs:**

- Test that runs twice and asserts result-equality only on `phase_count`
  but not on `phases[0].number`.
- `current_phase` field changing across consecutive identical queries.
- No `sort_by` / `.sort(...)` call in the handler body.

**Phase to address:**

Phase 1 (impl). Determinism test must be in the Wave 0 stub batch alongside
the shape-snapshot test.

---

### Pitfall 5: `isBeadsManaged()` is too coarse — false positives crash worktrees

**What goes wrong:**

`bin/gsd-sdk-shadow.mjs:232-234`:
```js
function isBeadsManaged(projectDir) {
  return existsSync(resolve(projectDir, '.beads/metadata.json'));
}
```

Edge cases this misses, all real on this codebase:

(a) **Symlinked `.beads/` from worktree.** Spike 003's chosen approach:
worktrees point at source repo's `.beads/` via `BEADS_DIR=<src>/.beads`.
The worktree itself has NO `.beads/` directory. Running the shadow from
the worktree, `existsSync('.beads/metadata.json')` returns false → reads
fall through to upstream's file parser → upstream sees no ROADMAP.md (or
sees the regenerated-from-bd one) → empty results.

(b) **Empty / partial `.beads/`.** A project that ran `bd init` but had
the embeddeddolt folder corrupted or wiped. `metadata.json` exists, but
`bd list` errors. Per Pitfall 2 we'd crash.

(c) **Subdirectory of project.** `process.cwd()` may be
`<project>/scripts/` not `<project>/`. `getProjectDir()` falls back to
`process.cwd()` (line 245); the shadow then can't find `.beads/`.

(d) **`BEADS_DIR` environment override.** `BEADS_DIR=/some/path bd …`
points bd at a different store entirely. Our `isBeadsManaged` ignores
`BEADS_DIR`, so reads detect "non-beads" and pass through to a stale
file parser.

**Why it happens:**

The mutation handlers got away with this because they're invoked via
upstream skills with explicit `--project-dir` arguments. Reads are
invoked the same way but ALSO via the `gsd-progress` skill which uses
plain `gsd-sdk query progress` with no `--project-dir`. The shadow then
falls back to `process.cwd()`. Worktree edge case (a) was a recent fix
target — see commit `b51abbc fix(hooks): guard block-state-md and
block-gsd-sdk-mutation on .beads/ presence`. The hooks handle it; the
shadow doesn't yet for reads.

**How to avoid:**

1. **Walk up to git root before checking `.beads/`.** Use the same
   pattern as `cascade-loop.sh:25-27`:
   ```js
   function findBeadsDir(start) {
     let dir = resolve(start);
     while (dir !== '/') {
       if (existsSync(join(dir, '.beads/metadata.json'))) return dir;
       const common = trySpawn('git', ['rev-parse','--git-common-dir'], dir);
       if (common) {
         const root = dirname(common);  // for bare worktrees this is the source repo
         if (existsSync(join(root, '.beads/metadata.json'))) return root;
       }
       dir = dirname(dir);
     }
     return null;
   }
   ```
2. **Honor `BEADS_DIR`.** If `process.env.BEADS_DIR` is set, use it
   instead of walking to `.beads/`.
3. **Worktree test fixture.** Add `tests/shadow-tests/handler-roadmap-analyze-worktree.test.mjs`:
   ```js
   const src = mkdtempSync('gsd-src-');
   execSync('bd init --non-interactive --skip-agents', {cwd: src});
   execSync(`git -C ${src} init && git -C ${src} commit -m init --allow-empty`);
   const wt = mkdtempSync('gsd-wt-');
   execSync(`git -C ${src} worktree add ${wt}`);
   process.env.BEADS_DIR = join(src, '.beads');
   const result = runShadow(['query','roadmap.analyze'], {cwd: wt});
   assert.equal(JSON.parse(result.stdout).data.backend, 'beads');
   ```

**Warning signs:**

- A read handler invoked from `<project>/scripts/` returns
  `backend: undefined` (upstream parser took over silently).
- `BEADS_DIR=/path/to/shared/.beads gsd-sdk query roadmap.analyze`
  returning data from the wrong project.
- No `git rev-parse` walk in `getProjectDir()`.
- Tests only fixture `mkdtempSync` + `bd init` (which produces a clean
  one-dir project) — never test worktree topology.

**Phase to address:**

Phase 1 must extend `isBeadsManaged()` (or a new `findBeadsRoot()`) BEFORE
adding any read handler, otherwise every read handler inherits the bug.
Worktree test goes in the test stub wave alongside the empty-bd test.

---

### Pitfall 6: Read handler accidentally tips PostToolUse → infinite regen

**What goes wrong:**

`hooks/bd-sync.sh:22-25` filters bd subcommands before running cascade-loop
and regen-roadmap:
```bash
case "$sub" in
  list|show|ready|memories|status|prime|export|deps|children|search|help|version|--version|--help)
    exit 0 ;;
esac
```

If a read handler invokes `bd <subcommand>` where `<subcommand>` is NOT
in this allowlist (e.g., a future `bd analyze`, `bd query`, or even
`bd --json show abc` where the parser thinks `--json` is the subcommand),
the bd-sync hook fires, `cascade-loop.sh` runs (acquires the flock,
20 iterations of `bd epic close-eligible`), THEN both regen scripts run
(more flock contention). Total wall-clock: 5-10 seconds per "read".

Worse: `regen-roadmap.sh` itself spawns more `bd` calls (lines 97, 134,
202, 233, 249) — each of those triggers another PostToolUse hook in
Claude Code. Even with the read-only filter catching most of them, the
hook overhead is non-trivial (`jq -r .tool_input.command`, case match,
debounce stat call) on every bd invocation.

**Why it happens:**

The read-only filter is a hand-maintained allowlist. New bd subcommands
in future bd versions, or non-standard invocations from a read handler
(e.g., `bd export --json` is allowed but `bd export json` with a space
isn't), don't match. The filter degrades closed (assumes write) for
unknown patterns.

The filter also ONLY matches the FIRST token after `bd`. If a read
handler builds command strings programmatically and accidentally puts a
flag first (`bd --no-color list` → sub="--no-color" → not in allowlist
→ hook fires → cascade runs).

**How to avoid:**

1. **Read handlers MUST stick to the allowlist.** Code-review checklist:
   any `execSync('bd …')` in a NEW read handler must use one of:
   `list, show, ready, memories, status, prime, export, deps, children,
   search`. Add a unit test that greps the handler source:
   ```js
   const src = readFileSync('bin/gsd-sdk-shadow.mjs', 'utf-8');
   const READ_HANDLERS = ['beadsRoadmapAnalyze','beadsStateSnapshot', /*…*/];
   for (const h of READ_HANDLERS) {
     const fn = extractFunction(src, h);
     const bdCalls = fn.match(/bd\s+(\S+)/g) ?? [];
     for (const call of bdCalls) {
       const sub = call.replace(/^bd\s+/, '').split(/\s/)[0];
       assert.ok(BD_READ_ONLY.includes(sub), `${h} uses non-read bd: ${sub}`);
     }
   }
   ```
2. **Never put flags before the subcommand.** `bd list --json` not
   `bd --json list`. Code-review check: `execSync` arg must match
   `/^bd (list|show|…)/`.
3. **bd-sync.sh allowlist should be code-reviewed alongside read-handler
   additions.** When you add a read handler that uses `bd export`, verify
   `export` is in the allowlist (it is, line 23). When upstream bd ships
   a new read-only command, both lists must be updated.

**Warning signs:**

- A read handler test takes >2s — likely tripping the regen cascade.
- ROADMAP.md mtime updates DURING `gsd-sdk query roadmap.analyze`.
- `bd-sync.sh` log lines (when DEBUG=1) appearing during read tests.

**Phase to address:**

Phase 2 (read handler implementation) — code-review gate before merge.
Phase 3 (test) — runtime gate (each read handler test < 500ms; see
Pitfall 3).

---

### Pitfall 7: Caching staleness within a single Claude turn

**What goes wrong:**

A read handler that caches `bd export --json` output at module load to
amortize the spawn cost: subsequent calls within the same Node process
return stale data. But the shadow process is short-lived (one CLI
invocation, exits 0). So per-process module-level caching doesn't apply.

The real cache risk is **filesystem-mediated**: if a future optimization
writes `.beads/cache.json` from a write handler (e.g., regen-roadmap.sh
caches its computed output) and the read handler reads from there
without invalidating on bd writes, the read returns pre-write data for
up to one cascade cycle.

A more immediate risk: within a single Claude turn, the agent calls
`gsd-sdk query phase.add "X"` (mutates bd), then `gsd-sdk query
roadmap.analyze`. These are TWO Node processes. The second one queries
bd fresh and sees the new phase — no cache, no problem. But if the
read handler invokes `bd export --json` and bd's own internal cache
hasn't picked up the embeddeddolt write yet (Dolt's write-then-read
visibility window), the second call may see stale state.

**Why it happens:**

This isn't a current bug — it's a pitfall to AVOID introducing. The
existing 13 mutation handlers don't cache. The read handlers shouldn't
either, in MVP. If Pitfall 3's perf gates require caching later,
caching needs an explicit invalidation hook on the regen scripts.

**How to avoid:**

1. **MVP: no caching.** Every `bd export --json` is a fresh spawn. Solve
   Pitfall 3 via batching (one spawn per query), not memoization.
2. **If caching is added later:** cache key must include
   `mtime(.beads/issues.jsonl)` AND `mtime(.beads/embeddeddolt/)`. Stat
   both before returning cached data; invalidate if either changed.
3. **Document "no caching" as a v0.2 invariant** in the shadow's header
   comment so future contributors don't add memoization without the
   invalidation hook.

**Warning signs:**

- Module-level `let cache = null` in `gsd-sdk-shadow.mjs`.
- Test that runs handler twice and asserts faster the second time
  (caching test) — premature optimization.

**Phase to address:**

Phase 1 — explicit "no caching" comment in handler. Phase N (perf
optimization, NOT in v0.2) — if added, include mtime invalidation
+ test.

---

### Pitfall 8: Regression on non-bd projects — every read handler must passthrough cleanly

**What goes wrong:**

The mutation guard at `gsd-sdk-shadow.mjs:259-263`:
```js
if (!isBeadsManaged(projectDir)) {
  log(`${projectDir} is not beads-managed; passing to upstream.`);
  spawnUpstream(argv);
}
```

This guard runs ONCE before dispatch — the same code-path serves both
mutations and reads. So new read handlers automatically get the
non-beads passthrough for free.

BUT: the bug surface widens in the OTHER direction. If a read handler
throws because of Pitfall 2 (empty bd state) or Pitfall 5 (worktree
detection failure), the dispatch catch (line 309-312) prints
`[gsd-sdk-shadow] dispatch failed: <err>` and exits 1 — it does NOT
fall through to upstream. So the failure mode is "non-bd project: fine,
upstream handles. Bd project with degraded state: BROKEN, no fallback."

The existing `argv-routing.test.mjs` CASE 6 verifies non-beads passthrough
for `phase.add` (a mutation). There is no equivalent test for read
handlers — we know mutations passthrough cleanly, we don't know reads do.

**Why it happens:**

The shape of the dispatch try/catch (line 303-312) was written for
mutation handlers where errors should fail loudly (a failed `bd close`
must not silently report success). Read handlers want the inverse: a
failed bd query should fall through to upstream's file parser, not
exit 1.

**How to avoid:**

1. **Per-handler fallback wrapper for reads** (see Pitfall 2). The wrapper
   re-throws a sentinel `BeadsUnavailableError` that the dispatch catch
   recognizes and falls through to upstream, instead of `process.exit(1)`.
2. **Symmetric tests for every read handler.** For each read handler,
   add 4 test cases mirroring the mutation tests:
   - CASE A: happy path on bd-managed project (returns `backend: 'beads'`).
   - CASE B: non-bd project (passes through to upstream).
   - CASE C: bd project with no phases (passes through OR returns empty
     shape — choice must be documented).
   - CASE D: bd command errors (`bd` binary not on PATH; passes through).
3. **Code-review checklist for new read handlers:** every new entry in
   `BEADS_OVERRIDES` must have a matching test file at
   `tests/shadow-tests/handler-<name>.test.mjs` with these 4 cases.

**Warning signs:**

- `tests/shadow-tests/handler-roadmap-analyze.test.mjs` has 1-2 cases
  but not all 4.
- `result.status !== 0` in a non-bd-project test (means our shadow
  failed instead of passing through).
- Stack trace from inside a read handler appearing in test output —
  means the handler isn't catching its own bd failures.

**Phase to address:**

Phase 2 (test coverage). Stub all 4 cases per handler in Wave 0 (red
markers). Implementation phase turns them green by adding the per-handler
fallback wrapper.

---

### Pitfall 9: Test isolation — `bd init` tempdir teardown gaps

**What goes wrong:**

Existing tests in `tests/shadow-tests/` use this pattern:

```js
function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-handler-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}
// later: rmSync(dir, { recursive: true, force: true });
```

Three potential issues:

(a) **Test crash leaves tempdir.** If `assert.equal(...)` throws before
the `finally rmSync`, the tempdir leaks. `bd init` writes `.beads/`
which has lockfiles — accumulation across test runs can cause
file-handle exhaustion.

(b) **bd's global config bleeds across tests.** `bd init` also writes
to `~/.bd/` for some global state (history, prefs). Two parallel test
processes using `bd init` compete for `~/.bd/lock`.

(c) **Parallel test runs share `BEADS_DIR` if env var leaks.** If a
parent test sets `process.env.BEADS_DIR = '/tmp/foo/.beads'` and forgets
to reset it, a sibling test inherits it and writes to the wrong store.

Looking at the existing 14 test files:

```
argv-routing.test.mjs
handler-milestone-complete.test.mjs
handler-phase-add-batch.test.mjs
handler-phase-add.test.mjs
… (13 mutation handler tests + 1 wrap-mutation test)
```

None show explicit sign of flakiness — but no parallel test invocation
exists yet (no `--concurrency` flag in any package.json scripts I can
find). Phase 2 read-handler tests + worktree fixtures (Pitfall 5) WILL
introduce parallelism.

**Why it happens:**

`bd init` writes to two places: the project's `.beads/` (which the
tempdir contains) AND occasionally to `~/.bd/` (global). Standard tempdir
patterns clean the former but not the latter. Plus, `mkdtempSync` doesn't
namespace the tempdir prefix — both `gsd-handler-test-` and
`gsd-beads-test-` prefixes collide if two tests run concurrently with
the same Date.now() millisecond (very rare, but possible on fast machines
where `node:test` runs file-parallel).

**How to avoid:**

1. **Use `t.after()` from `node:test` for guaranteed teardown:**
   ```js
   test('CASE 1: …', async (t) => {
     const dir = setupFixture();
     t.after(() => rmSync(dir, { recursive: true, force: true }));
     // … assertions; teardown runs even on throw
   });
   ```
   This replaces the `try/finally` pattern that's currently in every test
   file. Migrate during v0.2 alongside read-handler test additions.
2. **Per-test BEADS_DIR isolation:**
   ```js
   const dir = setupFixture();
   const env = { ...process.env, BEADS_DIR: join(dir, '.beads'), HOME: dir };
   spawnSync('node', [SHADOW, ...args], { env, encoding: 'utf-8', cwd: dir });
   ```
   Setting `HOME=$tempdir` per-test means `~/.bd/` is inside the tempdir
   and gets cleaned with it.
3. **Disable test parallelism for shadow tests in v0.2.** Run with
   `node --test --concurrency=1 tests/shadow-tests/`. Document the choice.
   Re-enable in a future phase after isolation is properly tested.

**Warning signs:**

- `df -i` showing inode count climbing during test runs (tempdir leak).
- Test output mentioning `EBUSY: resource busy or locked, .beads/`.
- A test passing in isolation but failing when run with `--concurrency=4`.
- `find /tmp -name 'gsd-handler-test-*' | wc -l` returning > 0 after
  test run (current pattern leaks).

**Phase to address:**

Phase 2 (test infra). Migrate all 14 existing tests to `t.after` pattern
WHILE adding the 3-4 read-handler test files. The migration is small
(2 lines per file) and prevents v0.2 read-handler tests from inheriting
the leak.

---

### Pitfall 10: Version drift in bd's `--json` schema

**What goes wrong:**

Spike convention (CONVENTIONS.md line 142) pins bd to v1.0.3. The shadow
parses bd's `--json` output assuming specific keys: `id`, `title`,
`status`, `priority`, `created_at`, `labels[]`, `dependencies[]`,
`description`, etc. (See `regen-roadmap.sh:96-220` for the full surface.)

When bd ships v1.1.0 or v2.0:

(a) Field renames: `created_at` → `createdAt` would silently break sort
ordering (Pitfall 4) — sort-by-undefined is a stable no-op, so phases
return in arbitrary order with no error.

(b) New required fields: a future `schema_version` key not handled by
our parser is a no-op (good), but if upstream bd starts emitting
`{"format": "v2", "data": [...]}` instead of bare `[...]`, our
`JSON.parse` returns an object, not an array, and `.filter()` throws.

(c) Status enum changes: bd adds `status: "blocked"` in v1.1 — our
disk_status mapping (Pitfall 1) doesn't know this and returns `null`
for current_phase even when the project is actively blocked.

(d) The shadow has no version assertion. There is no place where it
says "this code targets bd >= 1.0.3 < 2.0.0". CI doesn't catch the
drift; the user finds out when their `bd update` ships a schema change.

**Why it happens:**

Same reason every parser-of-untyped-output suffers from this: JSON
shapes are implicit contracts. The shadow imports upstream gsd-sdk via
a hard-coded path (`SDK_BASE`); upstream's typescript types catch THAT
contract drift at compile time. bd's CLI output has no equivalent type
guard.

**How to avoid:**

1. **Version assertion at startup.** First thing the read handler does:
   ```js
   const bdVersion = execSync('bd --version', { cwd: projectDir, encoding: 'utf-8' }).trim();
   const [major, minor] = bdVersion.replace(/^v/, '').split('.').map(Number);
   if (major !== 1 || minor < 0) {
     log(`unsupported bd version ${bdVersion}; passing to upstream`);
     throw new BeadsUnavailableError();
   }
   ```
   Cache the result per-process (one bd-version call ~50ms).
2. **Schema assertion on first `bd export --json`.** Verify the response
   is an array; verify the first element has expected keys:
   ```js
   const beads = JSON.parse(out);
   if (!Array.isArray(beads)) throw new Error(`bd export shape changed: got ${typeof beads}`);
   if (beads.length > 0) {
     const required = ['id','title','status','priority','created_at','labels'];
     for (const k of required) {
       if (!(k in beads[0])) throw new Error(`bd export missing field: ${k}`);
     }
   }
   ```
3. **Document the bd version contract in `bin/gsd-sdk-shadow.mjs` header:**
   ```js
   // Bd version contract: 1.0.x. Upstream bd is pinned via npm-shrinkwrap
   // in the gsd-beads recipe (Spike 002 finding). Schema changes in 1.1+
   // require updating: phase mapping, sort keys, BEADS_OVERRIDES read set.
   ```
4. **CI test against bd version in CONVENTIONS.md:** `bd --version` in
   the test bootstrap; fail loudly if not 1.0.3.

**Warning signs:**

- Suddenly all phases return in random order after a `npm install -g
  @beads/bd` — silent symptom of (a).
- `parsed.data.phases` is `null` or `undefined` instead of `[]` —
  symptom of (b).
- `current_phase` is null on a project that visibly has a phase in
  progress — symptom of (c).
- No `bd --version` check anywhere in the codebase (currently true).

**Phase to address:**

Phase 1 (impl) — version + schema assertions BEFORE first read handler.
Cheap; runs once per shadow invocation. Phase 2 (test) — assertion that
test fixture's `bd --version` matches the documented contract.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `execSync` pattern from existing 13 mutation handlers in new read handlers | Code consistency, no learning curve | Errors fatal — no fallback to upstream → Pitfall 2/8 manifest | NEVER for reads. Reads need `spawnSync` + per-handler fallback wrapper. |
| Skip `roadmap.analyze` because mutation-only design "works" | Saves a milestone of work | The bug being fixed RIGHT NOW recurs in 6 months for a different reason | Never — this is the milestone goal. |
| Hand-write field mappings without snapshot testing upstream shape | Faster initial implementation | Field drift goes undetected for weeks (the bug we're fixing took ~weeks to identify) | Never — the snapshot test is ~30 lines, must exist before merge. |
| Fan-out `bd children` calls in a loop instead of `bd export --json` once | Faster to write — mirrors regen-roadmap.sh | Reads become 1+ second; aspartame on every Claude turn | Only inside regen scripts (already offline). Never inside a read handler. |
| Trust `bd list` ordering for `current_phase` | Skip the `sort_by` call | Flapping "next phase" across sessions; intermittent /gsd-execute-phase misroutes | Never — use explicit `sort_by(priority, created_at, id)`. |
| Skip BEADS_DIR / worktree detection in `isBeadsManaged()` | Single-line check, less code | Worktree users (validated as 1st-class via Spike 003) silently fall back to upstream's broken parser | Never — `findBeadsRoot()` handles both single-project and worktree topology. |
| Pin bd version informally ("we tested on 1.0.3") | No CI overhead | Quiet schema drift on next bd update; user surface goes red overnight | Acceptable for v0.2 if version assertion + schema check are in place. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Upstream `gsd-sdk` registered handlers | Calling `registry.register('roadmap.analyze', ourHandler)` and assuming our handler runs — but `wrapMutation` (line 277-279) wraps it. For READS we don't want event emission. | Skip `wrapMutation` for read handlers — `registry.register()` direct, no wrapper. Document clearly: only mutation handlers go through `wrapMutation` (currently a no-op anyway with `eventStream=null`). |
| `--pick` field extraction | Read handler returns nested object; caller does `--pick phases[0].number`. Works because `extractField` (registry.js:35-55) supports bracket notation. | Test that `--pick phases[0].number` works for the new handler — it's the same code path mutations already use, but the test must explicitly verify. |
| Hook (`bd-sync.sh`) read-only filter | A read handler invokes `bd analyze` (hypothetical future bd subcommand). Not in allowlist → cascade-loop fires → 5s lag per read. | Document the contract: `bin/gsd-sdk-shadow.mjs` read handlers MAY ONLY use bd subcommands listed in `hooks/bd-sync.sh:23`. Add CI assertion. |
| `BEADS_DIR` env var | Shadow ignores it; user with cross-worktree setup gets passthrough behavior on reads | `findBeadsRoot()` honors `process.env.BEADS_DIR` first, then walks up to git root. |
| bd `metadata.json` parsing | Treating its presence as "bd is healthy" — Spike 002 found `metadata.json` exists even on `bd init --stealth` (which we don't use, but the file-existence check doesn't tell you "bd is functional"). | `isBeadsManaged()` is a CHEAP heuristic. `isBeadsHealthy()` (different fn, called per-handler) does `bd --version || throw`. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 bd spawns per read | Each `/gsd-progress` invocation takes 1-2s | Use `bd export --json` once, in-memory traversal | At ~6 phases (current project size). 1ms/phase × 6 phases × 3 calls = ~25ms, but N=100 spawns hits 5-10s. |
| No determinism sort | `current_phase` flaps across consecutive `gsd-progress` calls | `sort_by(priority, created_at, id)` always | Any project with ≥2 phases at the same priority. |
| Cascade-loop tipped by mis-classified bd subcommand | `gsd-sdk query roadmap.analyze` takes 5s instead of 200ms | Read handlers stick to allowlist; CI grep test | First time a future bd subcommand isn't in `hooks/bd-sync.sh:23`. |
| Caching without invalidation | Read handler returns stale data after a mutation in the same session | No caching in v0.2; document as invariant | When perf gates fail at >250ms — caching becomes tempting; resist until proper mtime-based invalidation. |

## Security Mistakes

Not directly relevant to this internal-infra milestone (no untrusted user
input flows through the shadow; bd CLI shells out are constructed from
JSON-parsed argv that goes through `JSON.stringify` quoting on titles per
existing pattern at `gsd-sdk-shadow.mjs:30,49,66,104`).

One latent risk:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Building bd command strings via template literals on user-supplied input (e.g. phase title with shell metacharacters) | `bd q "$(rm -rf /)"` style injection if argv quoting is missed | Already handled in mutation handlers via `JSON.stringify(title)` — preserve this convention in any read handler that takes args. Most read handlers will be argless (`roadmap.analyze`, `state-snapshot`, `progress.json`) so the surface is small. |

## "Looks Done But Isn't" Checklist

When implementing v0.2 read handlers, these are the high-risk "I shipped
it but it's broken" cases:

- [ ] **`roadmap.analyze`:** Often missing `missing_phase_details` field — verify exact 10-key shape matches upstream's `sdk/dist/query/roadmap.js:480-491`.
- [ ] **`roadmap.analyze`:** Often returns `disk_status: 'open'` (bd's enum) — verify mapped to upstream's enum (`complete`/`partial`/`planned`/`empty`/`discussed`/`researched`/`no_directory`).
- [ ] **`state-snapshot`:** Often missing `session: { last_date, stopped_at, resume_file }` nested object — verify all 13 top-level fields + 3 session fields.
- [ ] **All read handlers:** Often missing fallback for empty bd state — verify CASE C (bd init'd, zero phases) returns or passes through cleanly.
- [ ] **All read handlers:** Often missing worktree fixture test — verify CASE B (running from worktree where `.beads/` is in source repo) routes through bd.
- [ ] **`isBeadsManaged()`:** Currently checks only `<projectDir>/.beads/metadata.json` — verify upgraded to `findBeadsRoot()` that walks git topology + honors `BEADS_DIR`.
- [ ] **Determinism:** Often relies on bd ordering — verify all `bd list --json` parses are followed by `.sort()` on at least 2 keys + tie-breaker.
- [ ] **bd version assertion:** Often missing — verify `bd --version` is checked against contract before first bd query.
- [ ] **Test isolation:** Often `try/finally rmSync` — verify migrated to `t.after()` for guaranteed teardown.
- [ ] **Hook interaction:** Often a `bd <new-subcommand>` slipped in — verify CI test that greps the shadow source for bd calls and asserts each is in `bd-sync.sh`'s read-only allowlist.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Output-shape drift discovered post-merge | LOW | Add missing field, ship patch; existing field-snapshot test catches in pre-merge thereafter. |
| Empty bd state crashes read | LOW | Wrap handler in `try/throw BeadsUnavailableError`; teach dispatch (line 309) to fall through on this sentinel. ~20 lines. |
| Read handler tipping cascade-loop | MEDIUM | Identify offending bd subcommand in handler; either replace with allowlist subcommand or extend `hooks/bd-sync.sh` allowlist. ~5 lines + redeploy hook. |
| Determinism flap | LOW | Add `.sort()` call. Field-snapshot test catches in CI thereafter. |
| Worktree detection failure | LOW | Implement `findBeadsRoot()` walking git topology. ~30 lines, one place. |
| bd version drift | MEDIUM | Re-pin bd in install recipe; OR write compat shim in shadow that maps new schema → old expected shape (~50 lines per breaking change). |
| Test leak / parallel flake | LOW | Migrate to `t.after()` pattern in all 14 existing + 3-4 new test files. ~30 line edit. |

## Pitfall-to-Phase Mapping

Suggested mapping to v0.2 roadmap phases (the consumer of this research):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Output-shape drift | Phase 1 (handler impl) — write field-snapshot test FIRST | Test asserts all 10 `roadmap.analyze` keys + 10 per-phase keys present + types match |
| 2. Empty / partial bd state | Phase 1 (handler impl) — per-handler fallback wrapper | Test CASE C: bd init'd, no phases → either passthrough or empty-shape-with-`backend:'beads'` (decision documented) |
| 3. bd CLI fan-out | Phase 1 (handler impl) — use `bd export --json` once | Perf gate test: handler runtime < 500ms on 6-phase fixture |
| 4. Determinism flap | Phase 1 (handler impl) — sort all bd list outputs | Test runs handler 5× and asserts byte-identical output |
| 5. `isBeadsManaged()` coarseness | Phase 0 (refactor) — must precede ANY new read handler | Test CASE: worktree fixture with `.beads/` in source repo, BEADS_DIR set, returns `backend:'beads'` |
| 6. Hook interaction (cascade tip) | Phase 1 (impl) + Phase 2 (CI) | CI test greps shadow source for `bd <subcmd>` and asserts each subcmd in `hooks/bd-sync.sh:23` allowlist |
| 7. Caching staleness | Phase 1 (handler impl) — explicit "no caching" comment | Code review only; no test (no caching is the easier-to-audit invariant) |
| 8. Non-bd project regression | Phase 2 (test coverage) — 4 cases per read handler | Symmetric to mutation tests; CASE B (non-bd) returns non-`beads` backend |
| 9. Test isolation gaps | Phase 2 (test infra) — `t.after()` migration alongside new tests | Test runs with `--concurrency=4`; no flakes; tempdir count zero after run |
| 10. bd version drift | Phase 1 (impl) — startup version + schema assertions | Test asserts handler exits gracefully (passthrough) when bd version mismatch is mocked |

## Sources

- `bin/gsd-sdk-shadow.mjs` (current 13-mutation shadow — patterns and constraints)
- `bin/wrap-mutation.mjs` (event emission pattern; no-op for null eventStream)
- `tests/shadow-tests/argv-routing.test.mjs` (test patterns: `mkdtempSync` + `bd init` + `try/finally rmSync`)
- `tests/shadow-tests/handler-phase-add.test.mjs` (per-handler test pattern — 3 cases each)
- `hooks/bd-sync.sh` lines 21-26 (read-only bd subcommand allowlist; the contract for hook-safe read handlers)
- `scripts/regen-roadmap.sh` lines 96-220 (the SHAPE that's currently broken — what the read handler must REPLACE, not match)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js:373-493` (upstream `roadmapAnalyze` — canonical output shape)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/state.js:318-411` (upstream `stateSnapshot` — canonical output shape, 13 fields)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/registry.js:35-114` (extractField + dispatch — the contract our handlers fulfil)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/index.js:81-114` (`QUERY_MUTATION_COMMANDS` — proves our 13 reads are NOT in this set; reads bypass `wrapMutation`)
- Spike 003 (`.planning/spikes/003-cross-worktree-sharing/README.md`) — worktree topology validation; BEADS_DIR pattern (Pitfall 5 root cause)
- Spike 007 (`.planning/spikes/007-reader-skill-format-contract/README.md`) — 17 readers, the format contract our handlers serve (Pitfall 1 motivation)
- Spike 013 (`.planning/spikes/013-architecture-y1-shadow-poc/README.md`) — shadow design; "every new mutation upstream ships, we must add a beads-backed handler" — same applies to reads with the same fragility
- Commit `b51abbc` — `fix(hooks): guard block-state-md and block-gsd-sdk-mutation on .beads/ presence` — exact precedent for Pitfall 5 / 8 (the same trap, fixed in hooks; reads are the symmetric case)
- Commit `f8903ca` — `fix(hooks): bd-sync.sh — fall back to ~/.claude/scripts` — example of silent-failure-in-deployment that the test suite missed; Pitfall 6 / 9 prevention takes inspiration from this style of bug

---
*Pitfalls research for: v0.2 Beads-backed reads — gsd-sdk shadow read handler additions*
*Researched: 2026-04-29*
