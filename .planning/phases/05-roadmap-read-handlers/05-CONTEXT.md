# Phase 5: roadmap.* read handlers - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Plug the **first two real bd-backed read handlers** into the foundation
Phase 4 shipped: `roadmap.analyze` (full milestone state) and
`roadmap.get-phase <N>` (single-phase view). Both produce upstream-shape-
compatible JSON derived from a single `bd export --json` call, with
`backend: 'beads'`, current-milestone scoping, and drift detection
between bd-backed counts and on-disk artifacts.

**In scope:**
- `roadmap.analyze` handler in `BEADS_READ_OVERRIDES` — returns the upstream
  10-key shape (`milestones`, `phases`, `phase_count`, `completed_phases`,
  `total_plans`, `total_summaries`, `progress_percent`, `current_phase`,
  `next_phase`, `missing_phase_details`) plus `backend: 'beads'` plus
  `drift[]` (new bd-only field; see D-09)
- `roadmap.get-phase <N>` handler — returns the same per-phase 10-key
  sub-shape used inside `roadmap.analyze.phases[]`, derived from the same
  parsing helpers (per ROADMAP SC #3)
- Per-phase sub-shape: `number, name, goal, depends_on, plan_count,
  summary_count, has_context, has_research, disk_status, roadmap_complete`
- Phase identity via `phase-id:NN` labels (D-01..D-04); update
  `tests/fixtures/build-seed.sh` to emit them; regenerate `seed.jsonl`
- Drift detection between bd children counts and on-disk
  `*-PLAN.md` / `*-SUMMARY.md` files (D-08..D-12)
- Milestone heading from bd memory `gsd-beads:milestone:<version>:heading`
  (D-15..D-17); fallback to bare version string when no memory key
- Parity snapshot tests (red→green) for both handlers BEFORE
  implementation per REQ-QUAL-01 (carry-forward from Phase 4 D-09)
- Delete the `_phase4-test-stub` block in `bin/gsd-sdk-shadow.mjs`
  (lines 290-300) as Phase 5's first task per Phase 4 §"Gaps Summary"
- Pass-through behavior on non-bd projects (REQ-QUAL-04 verified by
  passthrough test asserting `backend !== 'beads'`)

**Out of scope:**
- `progress.*` handlers (Phase 6)
- `find-phase`, `phases.list`, `phase.next-decimal`, `phase-plan-index`
  (Phase 8)
- `state-snapshot`, `state.json`, `state.load` (Phase 7)
- Any `init.*` read handler (Phase 9)
- `regen-roadmap.sh` milestone-filter wiring (Phase 6 owns it; Phase 5
  only proves the bd-side `phase-id:NN` discipline)
- `/gsd-beads-new-milestone` skill that writes the milestone-heading
  memory (skill-side work — Phase 5 covers reading + test seeding only)
- Cross-cutting allowlist / perf / determinism gates (Phase 11)
- Mutation hook coverage audit (Phase 10)
- Refactor of `isBeadsManaged()` to delegate to `findBeadsRoot()`
  (Phase 4 D-04 keeps them separate for v0.2)

</domain>

<decisions>
## Implementation Decisions

### Phase identity (Area 1)
- **D-01:** **`phase-id:NN` label is the canonical phase identifier.** Stored
  zero-padded (`phase-id:05`); decimal phases via `.` (`phase-id:72.1`);
  widen to 3-digit at 100+. Title parsing rejected (brittle); sort-position
  numbering rejected (flaps on insert/delete). Phase 8's `find-phase` and
  `phases.list` reuse this same lookup key.
- **D-02:** **Output strips padding via `parsePhaseId()` helper.** Storage:
  `phase-id:05`. Output: `current_phase: "5"`, `phases[].number: "5"`.
  Helper: `label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1')`. Matches
  upstream's regex which extracts unpadded forms; preserves decimals.
- **D-03:** **Phase 5 deliverable: edit `tests/fixtures/build-seed.sh` to
  emit `phase-id:01..phase-id:07` on the existing 7 phases.** Regenerate
  `seed.jsonl`; verify reproducibility via `seed-determinism.test.sh`. Sibling
  fixture rejected (two truths).
- **D-04:** **`/gsd-beads-add-phase` skill must write `phase-id:NN` going
  forward.** `regen-roadmap.sh` must preserve label discipline on round-trip.
  Skill-side update is out of Phase 5 scope but is a known prerequisite
  flagged here so future skill phases honor the convention.

### disk_status mapping (Area 2)
- **D-05:** **Full 7-value parity with upstream.** Emit
  `complete | partial | planned | empty | discussed | researched | no_directory`.
  No bd-backend divergence on the enum. 4-value collapse rejected (breaks
  REQ-QUAL-01 strict parity); 3-value pure-bd rejected (breaks consumers
  branching on `disk_status === 'researched'`).
- **D-06:** **bd is source of truth for count-derived fields; disk is
  source of truth for narrative-derived fields.**
  - `plan_count` ← `bd children <phase> -l gsd:plan` count
  - `summary_count` ← `bd children <phase> -l gsd:summary` count
  - `has_context` ← `phases/<dir>/*-CONTEXT.md` presence (disk-only; bd
    has no analog)
  - `has_research` ← `phases/<dir>/*-RESEARCH.md` presence (disk-only)
- **D-07:** **disk_status derivation priority (after D-06 inputs):**
  1. `complete` — `plan_count > 0 && summary_count >= plan_count`
  2. `partial` — `summary_count > 0`
  3. `planned` — `plan_count > 0`
  4. `researched` — `has_research`
  5. `discussed` — `has_context`
  6. `empty` — phase dir exists but nothing else
  7. `no_directory` — phase dir absent

### Drift detection (Area 2 mechanism)
- **D-08:** **bd is canonical for emitted values; drift detection runs
  in parallel and reports divergence.** Reads keep working; user gets
  alerted to bd-vs-disk inconsistencies they don't yet know to expect.
- **D-09:** **Drift surfaces via TWO channels:**
  1. **stderr line per drift case:** `[gsd-shadow] DRIFT: phase 5 plan_count bd=3 disk=2`
  2. **`drift[]` array in response data** (new bd-backend-only field):
     `[{phase: "5", kind: "plan_count", bd_value: 3, disk_value: 2}]`
- **D-10:** **Drift kinds detected (whitelist):**
  - `plan_count` — `bd children -l gsd:plan` count != filesystem `*-PLAN.md` count
  - `summary_count` — `bd children -l gsd:summary` count != filesystem `*-SUMMARY.md` count
  - `closed_without_summary` — bd phase epic `status === 'closed'` but
    zero `*-SUMMARY.md` on disk
  - `completed_phases_mismatch` — aggregate: `phases.filter(p =>
    p.bd_status === 'closed').length` !== `phases.filter(p =>
    p.disk_status === 'complete').length`
- **D-11:** **Natural asymmetries (do NOT alert):**
  - phase dir absent for an open phase (planned-but-not-scaffolded)
  - CONTEXT.md or RESEARCH.md present without bd children (bd doesn't
    model narrative-only state)
- **D-12:** **No hard fail.** Soft alert only; reads keep working when
  drift exists. `BeadsDriftError` sentinel is NOT introduced. Rationale:
  not all drift cases are known yet; alerting without bricking
  `/gsd-progress` lets the user discover them organically.
- **D-13:** **`_parity-helpers.mjs` whitelist treatment.** `drift[]` is a
  bd-backend-only key; the parity test must treat it as a backend
  extension (present iff `backend: 'beads'`); upstream snapshot lacks it.
  Update `assertKeySetParity` semantics or add a known-extensions list
  to make this explicit (defer the API choice to plan-phase).

### completed_phases (Area 3)
- **D-14:** **`completed_phases = phases.filter(p => p.bd_status === 'closed').length`.**
  Honors ROADMAP SC #2 literally (matches `bd list -l gsd:phase
  --status=closed -n 0 --json` count). Auto-close already happens via
  the existing `scripts/cascade-loop.sh` (calls `bd epic close-eligible`
  over ALL epics on every bd-sync hook). When `bd_status` count and
  `disk_status === 'complete'` count disagree, drift mechanism (D-09)
  reports `kind: 'completed_phases_mismatch'`. Recompute-in-handler
  rejected (duplicates cascade-loop in two languages); force-cascade-in-
  test-fixture rejected (redundant with seed-determinism.test.sh).

### milestones[] (Area 4)
- **D-15:** **One entry per distinct `version:vX.Y` label** found across
  phase epics in the current-milestone slice. After current-milestone
  scoping (D-19), one entry expected.
- **D-16:** **Heading sourced from bd memory key
  `gsd-beads:milestone:<version>:heading`** (e.g.
  `gsd-beads:milestone:v0.2:heading` → `"Beads-backed reads"`). Read via
  `bd memories --json` once per handler invocation (memory keys are kv
  shape per Pitfall STACK.md).
- **D-17:** **Fallback to bare `vX.Y`** when no memory key exists. Log
  to stderr: `[gsd-shadow] note: no milestone heading memory for v0.2`
  (one-time per invocation, not per phase).
- **D-18:** **`build-seed.sh` seeds the memory** via `BEADS_ACTOR=seed bd
  remember 'gsd-beads:milestone:v0.1:heading' 'Foundation'` (and v0.2,
  v0.3) so test fixtures cover both happy-path and fallback. Future
  `/gsd-beads-new-milestone` skill writes this memory at milestone start
  (out of Phase 5 scope; flagged for that future phase).

### Current-milestone scoping (locked carry-forward from Phase 4 D-05)
- **D-19:** **Current milestone is read from
  `git config --worktree gsd-beads.milestone`** (or `${GSD_MILESTONE:-}`
  override). Phase 4's `regen-state.sh` already wires this. Read handler
  filters phase epics by `version:<current-milestone>` label before
  computing `phases[]`, `phase_count`, `current_phase`, `next_phase`.
  Phases outside current milestone are excluded — symmetric with
  upstream's `extractCurrentMilestone()` slice behavior.

### roadmap.get-phase argument semantics
- **D-20:** **`roadmap.get-phase <N>` accepts numeric phase identifiers
  only** — whole (`5`) or decimal (`5.1`). Fuzzy/title/partial matching
  (e.g., `"auth"`) is Phase 8's `find-phase` responsibility. Lookup:
  `phase_beads.find(b => parsePhaseId(b.labels.find(l =>
  l.startsWith('phase-id:'))) === arg)`. On unmatched: return
  `{ data: { found: false, phase_number: arg } }` (matches upstream's
  unmatched shape from `query/roadmap.js:359`).

### current_phase / next_phase selection
- **D-21:** **Mirror upstream's selection logic exactly** (REQ-QUAL-01
  parity):
  - `current_phase = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null` — emit phase number string or null
  - `next_phase = phases.find(p => p.disk_status === 'empty' || p.disk_status === 'no_directory' || p.disk_status === 'discussed' || p.disk_status === 'researched') || null` — same
  - Both are phase number strings (e.g. `"5"`), never bead IDs (e.g.
    `"sd-ahn"`) per ROADMAP SC #1.

### Carried forward from Phase 4 (do NOT re-decide)
- **D-22:** `BEADS_READ_OVERRIDES` table; reads register without
  `wrapMutation` (Phase 4 D-15)
- **D-23:** Sentinel-aware dispatch; `BeadsEmpty`/`BeadsCorrupt` fall
  through to upstream (Phase 4 D-12)
- **D-24:** `findBeadsRoot()` with BEADS_DIR/parent-walk/symlink rules
  (Phase 4 D-01..D-04)
- **D-25:** `bd()` helper throws sentinels; handlers stay clean
  (Phase 4 D-13)
- **D-26:** Snapshot parity test FIRST (red→green) per REQ-QUAL-01
  (Phase 4 D-09)
- **D-27:** Single `bd export --json` call per handler invocation; no
  caching (REQ-QUAL-07; research/PITFALLS.md Pitfall 3)
- **D-28:** Sort by `priority, created_at, id` for deterministic ordering
  (REQ-QUAL-06; research/PITFALLS.md Pitfall 4)
- **D-29:** Hook-allowlist `bd` subcommands only: `list, show, ready,
  memories, status, prime, export, deps, children, search` (REQ-QUAL-05)

### Claude's Discretion
- **Heading string assembly format** — D-15..D-17 source the data; the
  exact byte-for-byte assembly to match upstream's regex capture
  (`"Milestone v0.2 — Beads-backed reads"` vs other formats) is decided
  in plan-phase by inspecting `query/roadmap.js`'s milestonePattern
  output.
- **`drift[]` parity-helper API** — D-13 names the requirement (whitelist
  bd-backend-only keys); the exact API shape (extending
  `assertKeySetParity` signature vs adding `assertKeySetParityWithExt`
  vs known-extensions list) is plan-phase's call.
- **`bd memories --json` invocation strategy** — whether to call once
  per `roadmap.analyze` invocation or amortize through the same
  `bd export` call (memories appear in export per spike findings;
  verify in plan-phase).
- **Decimal phase ordering** — `phase-id:72`, `phase-id:72.1`,
  `phase-id:73`. Numeric coercion for sort: `Number(parsePhaseId(label))`
  works for whole+decimal up to standard float precision; tie-break
  on insertion order. Plan-phase confirms.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 acceptance contract
- `.planning/ROADMAP.md` §"Phase 5: roadmap.* read handlers" — 5 success
  criteria + dependencies on Phase 4
- `.planning/REQUIREMENTS.md` §"REQ-READ-01..02" — `roadmap.analyze`
  and `roadmap.get-phase` bd-derived state contracts
- `.planning/REQUIREMENTS.md` §"REQ-QUAL-01..03" — output-shape parity,
  read-shaped fallback, findBeadsRoot for reads (carry-forward)

### Architecture context (foundational, do not re-derive)
- `.planning/research/SUMMARY.md` — v0.2 synthesis with 6-handler scope
  cut, build-order rationale (roadmap.analyze first), 5 open questions
- `.planning/research/STACK.md` — bd CLI surface; `bd memories` returns
  object not array; `bd list` default `-n 50` (must pass `-n 0`); empty-
  state behavior
- `.planning/research/ARCHITECTURE.md` — handler signatures, dispatch
  wiring, skeleton handler, integration points table; §3.Q4 output
  formatting; §5 skeleton handler example
- `.planning/research/PITFALLS.md` — 10 critical hazards; especially
  Pitfall 1 (output-shape drift), Pitfall 3 (N+1 spawn), Pitfall 4
  (determinism), Pitfall 6 (hook allowlist), Pitfall 10 (bd version)
- `.planning/research/FEATURES.md` — 96-row catalog of `gsd-sdk query`
  call sites with classification

### Upstream source (the contract Phase 5 must match)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js`
  lines 348-492 — `roadmapGetPhase` and `roadmapAnalyze` canonical impls;
  lines 480-491 the exact output shape; lines 425-440 the disk_status
  if/else chain to mirror
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/registry.js`
  lines 35-114 — `extractField`, `resolveQueryArgv`, dispatch contract
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/helpers.js`
  — `extractCurrentMilestone`, `phaseTokenMatches`, `normalizePhaseName`,
  `planningPaths` (some are reusable helpers; check before reimpl)

### Phase 4 plumbing (consume directly)
- `bin/gsd-sdk-shadow.mjs:236-281` — `findBeadsRoot()` (use for project
  root resolution)
- `bin/gsd-sdk-shadow.mjs:287-300` — `BEADS_READ_OVERRIDES` table +
  env-gated `_phase4-test-stub` (Phase 5's first task: delete the stub)
- `bin/gsd-sdk-shadow.mjs:370-372` — second register loop (no
  wrapMutation)
- `bin/gsd-sdk-shadow.mjs:396-414` — sentinel try/catch with explicit
  BLOCKER-1 `return;`
- `bin/beads-errors.mjs` — `BeadsUnavailableError` + 4 subtypes; throw
  `BeadsCorrupt` on bad bd JSON, `BeadsEmpty` on no-phase-beaded
- `bin/bd-helper.mjs` — `bd(args, opts)` `spawnSync` wrapper; throws
  sentinels; allowlist contract
- `tests/shadow-tests/_parity-helpers.mjs` — `assertKeySetParity` +
  `assertTypeParity` (D-13: needs whitelist semantics for `drift[]`)
- `tests/scripts/update-snapshots.mjs` — push new SNAPSHOTS entries
  for `roadmap-analyze.json` and `roadmap-get-phase.json`
- `tests/fixtures/seed.jsonl` — multi-milestone seed (D-03: edit
  `build-seed.sh` to add `phase-id:NN` labels and milestone-heading
  memories; regenerate)
- `tests/fixtures/build-seed.sh` — source-of-truth builder (D-03, D-18)
- `tests/fixtures/seed-fixture.sh` — restorer via `bd init --from-jsonl`

### Existing patterns to mirror
- `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` — 6-case
  pattern (happy + 4 sentinel subtypes + real-bug)
- `tests/shadow-tests/handler-phase-add.test.mjs` and siblings — per-
  handler test file convention
- `tests/shadow-tests/argv-routing.test.mjs:13-29` — `beadsFixture()` /
  `nonBeadsFixture()` setup helpers
- `tests/shadow-tests/milestone-scoping.test.mjs` — model for testing
  current-milestone scoping (D-19)

### Spike findings (validated patterns; carry forward)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — auto-loaded;
  canonical decisions index
- `.claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md`
  — Y1 architecture rationale; "DON'T re-wrap reads with wrapMutation"
- `.claude/skills/spike-findings-gsd-beads/references/beads-modeling.md`
  — `bd remember` memory key namespacing (`gsd-beads:` prefix)
- `.claude/skills/spike-findings-gsd-beads/references/gsd-ecosystem-integration.md`
  — format contract for ROADMAP/REQUIREMENTS regen; convention labels

### Cross-phase context to carry forward
- `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-CONTEXT.md`
  — locks Y1 read-side dispatch, sentinel hierarchy, parity helper, seeder,
  worktree-scoped STATE.md, lockfile drift detection
- `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-VERIFICATION.md`
  — proves the foundation is wired (83/83 + 27/27 + 6 hook tests pass);
  §"Gaps Summary" enumerates the 7 things Phase 5 imports

### Hooks to mirror
- `hooks/bd-sync.sh:22-25` — read-only `bd` subcommand allowlist
  (REQ-QUAL-05 enforces; CI grep test in
  `tests/shadow-tests/bd-allowlist-grep.test.sh`)
- `scripts/cascade-loop.sh` — already cascades phase epics via
  `bd epic close-eligible` (D-14 relies on this)
- `scripts/regen-state.sh` — already reads worktree-local milestone
  source (D-19 relies on this)
- Commit `b51abbc` — `findBeadsRoot()` parent of the read-side equivalent

### Defensive context (read but do NOT act on in Phase 5)
- `.planning/todos/pending/disambiguate-bd-managed-detection.md` — out
  of v0.2 scope entirely; Phase 5's bd-backed reads do NOT solve this
  (already deferred in Phase 4 D-04)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`findBeadsRoot(start)`** (`bin/gsd-sdk-shadow.mjs:236`): use to
  resolve project root for bd-managed detection across worktrees. Phase 5
  handlers call this BEFORE any bd invocation.
- **`bd(args, { cwd })`** (`bin/bd-helper.mjs`): spawnSync wrapper that
  throws `BeadsNotInstalled` / `BeadsCorrupt` / `BeadsEmpty` on failure.
  Read handlers call this and let exceptions propagate; dispatch (Phase 4
  D-12) catches and falls through to upstream.
- **`assertKeySetParity` / `assertTypeParity`**
  (`tests/shadow-tests/_parity-helpers.mjs`): import for parity tests.
  D-13 flags an extension to whitelist `drift[]` as bd-backend-only.
- **`tests/scripts/update-snapshots.mjs`** SNAPSHOTS array: append
  entries for `roadmap.analyze` and `roadmap.get-phase` so
  `update-snapshots` regenerates them from upstream.
- **`createRegistry` / `resolveQueryArgv` / `extractField`** (upstream
  `gsd-sdk-cc/sdk/dist/query/`): already imported by the shadow; the
  same registry instance dispatches read overrides.

### Established Patterns
- **Per-handler test file** (`handler-roadmap-analyze.test.mjs`,
  `handler-roadmap-get-phase.test.mjs`): one test file per handler,
  3+ cases (happy + data-assert + error). Phase 4 added the underscore
  prefix convention for non-handler files (`_parity-helpers.mjs`).
- **`mkdtempSync` + `try/finally rmSync`** OR **`t.after()`** teardown
  (PITFALLS Pitfall 9) — Phase 5 should use `t.after()` for new tests
  per the migration recommendation.
- **`spawnSync` (not `execSync`)** for shadow CLI invocations in tests;
  same constraint inside handlers per `bd()` helper contract.
- **Frozen `BeadsCause` enum + per-subtype `.name`** (Phase 4 Pitfall 1
  mitigation): if Phase 5 needs new error subtypes, extend the same
  pattern; `BeadsDriftError` is explicitly NOT introduced (D-12).
- **`BEADS_ACTOR=seed`** on every seeder bd call (Phase 4 Pitfall 8) —
  preserve in `build-seed.sh` updates (D-03, D-18).

### Integration Points
- **`bin/gsd-sdk-shadow.mjs:287-300`** — `BEADS_READ_OVERRIDES` table.
  Phase 5: delete env-gated `_phase4-test-stub` block (lines 290-300);
  add `'roadmap.analyze': beadsRoadmapAnalyze` and `'roadmap.get-phase':
  beadsRoadmapGetPhase` entries.
- **`bin/gsd-sdk-shadow.mjs` body** — add `beadsRoadmapAnalyze` and
  `beadsRoadmapGetPhase` function bodies + shared helpers
  (`parsePhaseId`, `deriveDiskStatus`, `detectDrift`,
  `loadMilestoneHeading`).
- **`tests/fixtures/build-seed.sh`** — D-03: add `phase-id:NN` labels
  to each `bd create` call. D-18: add `bd remember
  'gsd-beads:milestone:vX.Y:heading' '<name>'` calls for each milestone.
- **`tests/fixtures/seed.jsonl`** — regenerate via `build-seed.sh`;
  validate via `seed-determinism.test.sh` (must remain byte-identical
  across two restores).
- **`tests/scripts/update-snapshots.mjs` SNAPSHOTS array** — push
  `{ cmd: 'roadmap.analyze', file: 'snapshots/roadmap-analyze.json' }`
  and the get-phase equivalent.
- **`tests/shadow-tests/snapshots/`** — add `roadmap-analyze.json` and
  `roadmap-get-phase.json` (regenerated from upstream against the
  multi-milestone seed).
- **`tests/shadow-tests/_parity-helpers.mjs`** — D-13: extend to
  whitelist bd-backend-only keys (`drift`); plan-phase picks the API.
- **CI workflow** — same constraints as Phase 4: lockfile drift, hook
  allowlist grep, snapshot drift. Phase 5 doesn't add new CI jobs.

</code_context>

<specifics>
## Specific Ideas

- **Mirror upstream byte-for-byte except `backend` and `drift[]`.** The
  parity contract (D-05, REQ-QUAL-01) is the central commitment. Every
  divergence must be explicitly justified (e.g., `disk_status` derivation
  inputs differ but enum vocabulary stays identical; `drift[]` is bd-only
  but parity test whitelists it).

- **The `_phase4-test-stub` deletion is Phase 5's first task.** Phase 4
  ships an env-gated stub at `bin/gsd-sdk-shadow.mjs:290-300`. Phase 5's
  first commit removes it (the stub was Phase 4's wiring proof; it
  doesn't survive contact with real read handlers).

- **`bd export --json` once per handler invocation.** Phase 4
  set the budget; Phase 5 honors it. The handler does:
  `const all = await bd(['export', '--json']);` (which throws sentinels
  on failure), then in-memory groups by labels. No per-phase `bd
  children` walks (Pitfall 3).

- **The 7 phase beads in `seed.jsonl` ARE the Phase 5 fixture.** v0.1×2
  closed, v0.2×3 open, v0.3×2 open. Adding `phase-id:NN` labels (D-03)
  doesn't change the count; it just makes them lookupable. The
  multi-milestone seed already exercises current-milestone scoping
  (D-19).

- **Drift kinds are an open whitelist, not a closed enum.** D-10 lists
  the four kinds we know to detect today. The handler structure should
  make adding new kinds cheap (e.g., a single `detectDrift(phase,
  bd_state, disk_state)` function returning a list of drift entries).
  When new drift cases surface in user reports, Phase 5+ extensions to
  this set are minor.

</specifics>

<deferred>
## Deferred Ideas

- **`/gsd-beads-new-milestone` skill that writes `gsd-beads:milestone:
  <version>:heading` memory** — D-18 notes the dependency. Skill-side
  work is its own future phase. For now, `build-seed.sh` seeds the
  memory directly so Phase 5 tests cover the happy path; production
  users get the fallback string until the skill ships.
- **`/gsd-beads-add-phase` writing `phase-id:NN`** — D-04 flags the
  convention. The skill update is out of Phase 5 scope but is a known
  prerequisite for any phase that adds new phases via the skill rather
  than seeding fixtures.
- **`regen-roadmap.sh` round-trip discipline for `phase-id:NN`** — the
  regen script currently doesn't write or read this label. Phase 6
  (progress.* read handlers) shares the parsing primitives and is the
  natural owner of the regen-side label discipline. Phase 5 only ensures
  the read handlers tolerate either presence or absence (fallback to
  legacy parsing if the label is missing — though Phase 5 fixtures
  guarantee presence).
- **`BeadsDriftError` sentinel** — D-12 explicitly rejected. If a future
  phase wants hard-fail-on-drift behavior (e.g., a CI pre-merge gate),
  introduce it then with a separate dispatcher branch (don't reuse the
  fall-through path).
- **Caching across handler invocations** — Architecture research
  recommended no caching in v0.2; carried forward via D-27. Revisit in
  v0.3 if perf budget breached.
- **Refactor `isBeadsManaged()` to delegate to `findBeadsRoot()`** —
  Phase 4 D-04 keeps them separate; defer to a cleanup phase after the
  read-handler suite stabilizes (post-Phase 9 or v0.3).
- **`disambiguate-bd-managed-detection.md` todo** — out of v0.2 entirely
  (Phase 4 deferred; Phase 5 inherits the deferral).

### Reviewed Todos (not folded)
- `disambiguate-bd-managed-detection.md` — title-matched on shadow/hooks
  keywords (score 0.6) but addresses the orthogonal "gsd-beads ships
  `.beads/` for vocabulary not state" problem; out of v0.2 scope per
  PROJECT.md and Phase 4 deferral.

</deferred>

---

*Phase: 5-roadmap-read-handlers*
*Context gathered: 2026-04-29*
