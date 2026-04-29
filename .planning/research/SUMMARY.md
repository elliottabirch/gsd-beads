# Research Summary — Milestone v0.2: Beads-backed reads

**Confidence:** HIGH overall. Every bd JSON shape verified against a live
149-bead project (`tstl-sylvanas`); every upstream printer contract grounded
in source; every pitfall cross-referenced against current code, upstream
source, and spike findings (003, 006, 007, 013).

## TL;DR

The user's named four (`roadmap.analyze`, `state-snapshot`, `progress.bar`,
`progress.json`) understate the surface. Features research enumerated **96
unique `gsd-sdk query` subcommands** in the GSD command surface and
classified **16 P1 handlers** as state-bearing on bd-managed projects.
Architecture and Pitfalls research independently recommend a tighter v0.2
than the 16-handler full audit.

**Recommended v0.2 scope: 6 P1 handlers + Phase 0 refactor + 1 verification
pass**, deferring 10 P1 handlers to v0.2.x and `state-snapshot` /
`summary-extract` to v0.3.

| Phase | Content | Why |
|-------|---------|-----|
| **Phase 0** | `findBeadsRoot()` (replaces `isBeadsManaged()`) + schema-parity test infra | Must land before any read handler — Pitfall 5 (worktree topology) inherits otherwise |
| **Phase 1** | `roadmap.analyze` + `roadmap.get-phase` | Highest-leverage; share parsing/transform; restores `/gsd-progress` rich panel |
| **Phase 2** | `progress.json` / `progress` / `progress.bar` / `progress.table` | Pure derivations from same primitives; upstream aliases the family |
| **Phase 3 (parallelisable)** | State-mutation hook-coverage audit | Hidden risk: 12 `state.*` handlers may slip the v0.1 hook layer |

**Deferred to v0.3:** `state-snapshot` (memories + STATE.md complexity),
`summary-extract` (anti-feature — narrative-only, file-based by design).

## Stack — bd CLI surface

(See `STACK.md` for full reference.)

- **bd version pinned: v1.0.3.** Add a startup version assertion.
- **`bd memories --json` returns an OBJECT (kv map), not an array.** Always
  contains `schema_version: 1`. Filter session keys (`session:…`) and
  vocabulary keys (`gsd-beads:…`).
- **`bd show <bad-id> --json` exits 0 and emits an error OBJECT**, not
  an array — handlers must check `Array.isArray(parsed) && parsed.length > 0`.
- **`bd list` default is `-n 50`.** Read handlers MUST pass `-n 0` for
  state-bearing queries — silent truncation is the most insidious failure.
- **`bd list` does NOT populate `epic_total_children`/`epic_closed_children`**
  (always `null`); only `bd show` does. For `progress.*`, prefer
  `bd export --json` once + group by labels client-side.
- **`current_phase`/`next_phase` MUST be phase numbers** (e.g. `"89"`)
  extracted from `phase-id:NN` labels — NOT bead IDs (`sylv-cw0`).
- **Empty-state behavior is graceful by default:** `bd list` empty → `[]`,
  `bd memories` empty → `{schema_version: 1}`, `bd count` empty →
  `{count: 0, schema_version: 1}`.

## Features — full audit of `gsd-sdk query` call sites

(See `FEATURES.md` for the 96-row catalog.)

**Tier 1 (recommended in v0.2):** `roadmap.analyze`, `roadmap.get-phase`,
`progress.json`, `progress`, `progress.bar`, `progress.table`.

**Tier 1 deferred (P1 but slip to v0.2.x):** `state.json`, `state.load`,
`find-phase`, `init.progress`, `init.milestone-op`, `init.todos`,
`phases.list`, `phase.next-decimal`, `phase-plan-index`.

**Anti-features (DO NOT bd-back):** `summary-extract`, the entire
`frontmatter.*` family, `uat.render-checkpoint`, `intel.*`, `workstream.*`.
These read narrative or orthogonal storage; passthrough is correct.

**Hidden risk:** ~12 state mutation handlers (`state.update`, `state.patch`,
`state.advance-plan`, `state.update-progress`, `state.add-decision`,
`state.add-blocker`, `state.add-roadmap-evolution`, `state.begin-phase`,
`state.planned-phase`, `state.milestone-switch`, `state.record-metric`,
`state.record-session`) are NOT in `BEADS_OVERRIDES`. If they slip the v0.1
hook layer, STATE.md drifts from beads. **Phase 3 verifies this and either
covers the gap or documents the rationale.**

## Architecture — handler shape

(See `ARCHITECTURE.md` for the full skeleton + data-flow diagrams.)

- **New table `BEADS_READ_OVERRIDES`** (don't extend `BEADS_OVERRIDES`).
  D-02's "13 entries" is mutation-specific; `wrapMutation` emits
  `GSDEvent.StateMutation` events that are semantically wrong for reads.
- **Handler signature:**
  `async (args: string[], projectDir: string, _workstream?: string) => Promise<{ data: object }>`.
  Identical to existing 13. Always include `backend: 'beads'` in `data`.
- **Argument parsing is per-handler** (not centralized). Match
  `summaryExtract` (lines 96–106) and `beadsPhaseInsert` (lines 60–61):
  `args.indexOf('--flag')`.
- **Output: handlers return data unchanged.** The shadow's `console.log`
  at lines 305–308 IS the printer — so the data shape MUST match upstream's
  `data` shape exactly. This is the single largest regression risk.
- **Fallback path:** `if (!isBeadsManaged(projectDir)) spawnUpstream(argv)`
  at line 260 already protects non-bd projects. **v0.2 must not regress
  this.** Unmatched commands fall through at line 298.
- **No caching in v0.2.** Shadow is one-shot per invocation; in-handler
  memoization (call `bd export` once per handler, reuse) is fine and free.
- **Test pattern:** `tests/shadow-tests/handler-{kebab-cmd}.test.mjs`,
  3 cases per handler (happy / data-assert / error). Use `mkdtempSync +
  bd init --non-interactive --skip-agents` fixture.

## Pitfalls — 10 critical hazards

(See `PITFALLS.md` for full table with line refs and prevention strategies.)

The five highest-leverage:

1. **Output-shape drift (Pitfall 1)** — upstream's `roadmapAnalyze` returns
   a precise 10-key shape with each phase carrying 10 sub-keys including the
   `disk_status` enum (7 string values). Without a snapshot test asserting
   all 20 keys + types, the v0.2 handler will reintroduce the same
   silent-zero-result failure mode. **Required: schema-parity test in every
   read-handler phase, written before the handler (red → green).**
2. **Dispatch try/catch is mutation-shaped, not read-shaped** (lines
   303–312). Exits 1 on errors instead of falling through to upstream.
   **Required: `BeadsUnavailableError` sentinel + dispatch-level fall-through
   for reads.**
3. **`isBeadsManaged()` is too coarse for reads.** Misses worktree
   topology (Spike 003: `BEADS_DIR=<src>/.beads`, symlinked / shared).
   Commit `b51abbc` already fixed this in hooks. **Required: `findBeadsRoot()`
   walk, symmetric with the hooks fix.**
4. **Performance / determinism:** naive `roadmap.analyze` fans out to
   13 spawns (~1s wall-clock). **Required: `bd export --json` once +
   deterministic sort (`priority, created_at, id`) — bd's row-order flaps
   `current_phase` mid-session.**
5. **Hook interaction (`bd-sync.sh:22-25` allowlist):** if a read handler
   uses a bd subcommand outside the allowlist (`list, show, ready, memories,
   status, prime, export, deps, children, search, help, version`), the
   PostToolUse hook fires and turns a 200ms read into a 5-second cascade.
   **Required: CI grep test asserting only allowlisted bd subcommands appear
   in read handlers.**

## Top decisions for the roadmapper

1. **Scope cut (6-handler v0.2 vs full 16-P1 v0.2).** Recommendation: **6**.
   Ship the bug-fix narrative, follow with v0.2.x for the rest. Risk of "16
   in v0.2": milestone bloats from architecturally-bounded to features-driven.
2. **Phase 0 refactor inside v0.2 vs prerequisite milestone.** Recommendation:
   **inside v0.2 as Phase 0**. It's a 30-line refactor; calling it v0.1.5
   adds ceremony without value. But it MUST be the first phase — Phases 1+
   depend on it.
3. **Schema-parity snapshot test as a top-line architectural commitment.**
   Both Pitfalls and Architecture independently flagged this. Write the
   schema test BEFORE the handler implementation in every phase.
4. **`state-snapshot` defer or include.** Recommendation: **defer to v0.3**;
   document rationale in v0.2 PROJECT.md. Memories + session.* complexity,
   plus the worked-example project has no `blocker` labels in use.
5. **Verification gate (Phase 3) blocking ship?** Recommendation: **yes —
   fix or document**. The mutation-handler audit is the only way to catch
   v0.2's hidden risk.

## Open questions still unresolved

1. **State-mutation handler hook coverage at SDK level.** Phase 3 audit will
   resolve.
2. **`milestones[]` in `roadmap.analyze` — `[]` or parse `version:vX.Y`
   labels?** Both valid; defer to plan-phase.
3. **`disk_status: 'discussed' | 'researched'`** — upstream derives from
   CONTEXT.md/RESEARCH.md presence; bd has no equivalent. Drop or preserve
   filesystem check? Defer to plan-phase.
4. **Empty-bd behavior:** when `.beads/` exists but no phases beaded, return
   empty-shape-with-`backend: 'beads'` or fall through to upstream (which
   parses regen'd ROADMAP.md, which is itself empty)? Both correct;
   recommend documenting in v0.2 spec.
5. **Workstream parameter (`args, projectDir, workstream`)** — none of the
   13 mutation handlers use it; reads may need it for multi-workstream
   projects (`state-snapshot` only — deferred).
