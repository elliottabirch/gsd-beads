# Phase 7: Capabilities flag + Bin A primitives + foundational primitives - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the BeadsAdapter contract surface that every later phase builds
on:

- **Capabilities flag (CAP-01)** — finalize the seven-bit static
  `BeadsAdapter.capabilities` object with rationale comments per
  D-2026-04-30-05.
- **Bin A primitives (PRIM-01, 10 methods)** — `getRecord`, `putRecord`,
  `removeRecord`, `listCollection`, `exists`, `getSection`,
  `updateSection`, `getFrontmatter`, `updateFrontmatter`,
  `mergeFrontmatter` per SYNTHESIS.md §4 Bin A signatures.
- **Foundational primitives (PRIM-02, 6 methods, 2 of which overlap Bin
  A)** — `updateSection` + `getSection` (cross-cutting), plus
  `recordStateEvent`, `snapshot/restore`, `putNamedDoc`/`getNamedDoc`,
  `writeBinaryAsset`.
- **Conformance scaffolding (CONF-01, CONF-02)** — `tests/conformance/`
  layout that runs against `tests/fixtures/seed.jsonl` standalone today
  and pairs with the fork's MarkdownAdapter when available; round-trip
  property tests for `src/format/phase.mjs` (carry-forward — Phase 6
  shipped a partial set; Phase 7 promotes/expands them).

**In scope:**
- Replace stub bodies in `src/adapter/primitives.mjs` (16 methods) with
  real implementations against `bd` (via `src/bd/helper.mjs`,
  `src/bd/findRoot.mjs`, `src/bd/errors.mjs`) for bd-routed paths and
  Node `fs` (via the path router) for disk-routed paths.
- Add `src/adapter/pathRouter.mjs` — closed-enum registry (D-01) mapping
  repo-relative path patterns to bd-shape descriptors.
- Add `UnsupportedOperationError` class to `src/bd/errors.mjs` (D-16).
- Lock `BeadsAdapter.capabilities` to {record:true, section:true,
  binaryAsset:false, snapshot:true, transaction:false, namedDoc:true,
  commitPlanningState:false} with rationale JSDoc per `false` (D-16).
- Create `tests/conformance/{binA-records,binA-section,binA-frontmatter,
  foundational-events,foundational-namedDoc,foundational-snapshot,
  capabilities}.test.mjs` plus a `tests/conformance/run.mjs` driver and
  `tests/conformance/fixture.mjs` setup helper (D-13, D-14, D-15).
- Land conformance write+read shape assertions for all 10
  `recordStateEvent` types (D-12), plus capabilities-flag-shape test.
- Promote/expand `tests/unit/format-phase.test.mjs` round-trip property
  tests to satisfy CONF-02 fully (Phase 6 shipped 11 fixture cases;
  Phase 7 ensures coverage of all canonical inputs called out in
  ROADMAP §"Phase 7 SC#5").

**Out of scope:**
- Any Bin B domain method — Phases 8-13 own the ~58 named methods.
- Native bd transaction primitive — `capabilities.transaction = false`;
  callers needing transactional semantics use `snapshot()/restore()`
  manually.
- External binary blob store — `writeBinaryAsset` throws
  `UnsupportedOperationError`; UI screenshot consumers (Phase 10) check
  `capabilities.binaryAsset` before invoking.
- Whole-tree (`.planning/`) snapshot — narrow `snapshot()` scope to bd
  JSONL + memories per D-11; dry-run hoist consumers wrap with their
  own filesystem cp -r.
- `commitPlanningState` semantics — flag is `false`; method is a no-op
  (or thin throw) at this phase. Phase 13's IMPL-12 / OQ-08 owns final
  cross-adapter `commitPlanningState` behavior.
- Cross-adapter run against fork's MarkdownAdapter — describe.each
  factory pattern is shipped now (D-14) so Phase 13 just wires
  `RUN_CROSS_ADAPTER=1` once the fork publishes; no fork dep at this
  phase.
- Cascade-loop JS rewrite (`src/bd/cascade.mjs`) — Phase 8 owns this
  per Phase 6 D-12.

</domain>

<decisions>
## Implementation Decisions

### Bin A path routing & frontmatter

- **D-01:** **Closed-enum routing table at
  `src/adapter/pathRouter.mjs`.** A frozen registry maps repo-relative
  path patterns to bd-shape descriptors:
  ```
  '.planning/ROADMAP.md'              → { kind: 'roadmap' }
  '.planning/REQUIREMENTS.md'         → { kind: 'requirements' }
  '.planning/todos/**'                → { kind: 'todo' }
  '.planning/seeds/**'                → { kind: 'seed' }
  '.planning/phases/NN-*/NN-PLAN.md'  → { kind: 'plan',  phase: 'NN' }
  '.planning/<category>/<key>.md'     → { kind: 'namedDoc', category, key }
  ...
  ```
  Anything not matched falls through to disk. The router is the single
  point of dispatch — every Bin A method (`getRecord`, `putRecord`,
  `getSection`, `updateSection`, `exists`, `listCollection`) starts by
  resolving the path through the router. Path-pattern allowlist (single
  regex) rejected: loses the per-path bd-shape information; method
  would have to re-classify after matching. Virtual-path scheme rejected:
  breaks SYNTHESIS §4's "paths translate to bd queries" wording and
  forces every existing GSD workflow to translate paths it already
  knows. Method-level dispatch rejected: muddies the contract; consumers
  learn N defaults instead of one routing rule.

- **D-02:** **Repo-relative paths everywhere.** Registry keys are
  repo-relative (`.planning/ROADMAP.md`); callers pass repo-relative
  strings; adapter joins to `this.projectRoot` internally when an
  absolute path is needed. Matches existing convention in spike-findings,
  REQUIREMENTS.md, helpers, and Phase 5 read handlers. Conformance keeps
  fixture paths human-readable.

- **D-03:** **`getFrontmatter`/`updateFrontmatter`/`mergeFrontmatter`
  on bd-routed paths synthesize from bd labels.** Returns a flat object
  derived from the record's bd labels and metadata
  (`{phase_id: '07', version: 'v1.0', status: 'open', ...}`). Updates
  mutate the corresponding bd labels via `bd label add/remove`. Limit
  synthesized frontmatter to flat string/boolean values (bd labels are
  flat strings). For disk-routed paths (PLAN.md narrative, named docs),
  this is straightforward markdown frontmatter parsing via the
  established pattern (gray-matter or equivalent — plan-phase
  selects). Throw-on-bd-records rejected: many Bin B callers
  (`phasePlanIndex`) generalize across both routes; forcing branch on
  routing decision before calling is friction. Defer-to-Phase-8
  rejected: weakens Phase 7 SC's testable surface.

- **D-04:** **`listCollection(prefix, filter?)` follows the same
  router.** `listCollection('.planning/phases')` matches the
  phase-collection entry → `bd list -l gsd:phase` (sorted by
  `phase-id:NN` numeric, deterministic). `listCollection('.planning/todos')`
  → `bd list -l gsd:todo`. Disk-routed prefixes (`docs/features`, etc.)
  → `fs.readdir`. `filter`, when supplied, maps to additional `bd list
  -l <filter-label>` arguments for bd-routed and predicate filtering
  for disk-routed. ≤2 bd spawns per call (QUAL-07 carry-forward).

### Section anchor vocabulary

- **D-05:** **Anchor is a heading slug** — lowercase, hyphen-separated,
  derived from heading text via a documented `slugify()` helper exposed
  from `src/format/section.mjs` (new file). UAT "Current Test" →
  'current-test'. Adapter normalizes both stored heading and incoming
  anchor through the same rule. Verbatim-text rejected: brittle to
  heading edits, whitespace-sensitive. HTML-comment markers rejected:
  forces migration of every GSD markdown file before primitives can
  address them. XML semantic blocks rejected: only some files use the
  wrapper convention; needs a fallback for files that don't.

- **D-06:** **Path-slug always: anchor is a slash-separated path of
  slugs from H1 down.** `'phase-7/decisions/d-01'`. Forces unambiguous
  addressing everywhere; eliminates first-match-wins shadowing on
  duplicate sub-headings. Verbose for the common case is the explicit
  trade-off. Path-slug accepts a leading-slash variant (`'/decisions'`
  binds to the document root if a top-level heading slugs to
  'decisions'); plan-phase decides exact normalization. Lint test in
  Phase 7 conformance verifies that no documented anchored file has
  duplicate path-slugs (catches authoring errors early).

- **D-07:** **`updateSection` modes are body-replace within heading
  bounds.** A "section" is the content between the addressed heading
  and the next sibling-or-shallower heading (standard markdown section
  bounds, mdast convention). `mode === 'overwrite'` replaces all
  content in that range. `mode === 'append'` inserts `body` immediately
  before the next sibling heading (or end-of-file if none). `mode ===
  'prepend'` inserts `body` immediately after the heading line. The
  heading line itself is NEVER touched by any mode. Whole-section-replace
  rejected: would break path-slug stability when callers rewrite
  headings; cascading anchor breakage. Append-with-forced-blank-lines
  rejected: subtly mutates content on every call, breaks Debug Evidence
  idempotent appends per spike findings.

- **D-08:** **`updateSection` is atomic per call: read → AST → rewrite
  addressed section → write whole file via tmpfile + rename.** POSIX
  rename atomicity serializes concurrent processes. AI-SPEC three-author
  contract (Phase 10 SC#3 / OQ-09) holds because the three sequential
  calls each succeed in document order without clobbering siblings.
  For bd-routed paths (rare — AI-SPEC.md is narrative, stays disk-routed),
  the bd-side equivalent is `bd update` with the full new section
  content; `bd`'s own write semantics provide serialization.
  File-level lockfile rejected: NFS-quality concern that doesn't apply
  to single-developer + Claude single-process model. No-atomicity
  rejected: lose-update under concurrent invocation; defers OQ-09 to
  consumers.

### Bd storage shapes

- **D-09:** **`recordStateEvent({type, payload})` dispatch policy:**
  - **memories** for: `decision`, `blocker_added`, `blocker_resolved`,
    `metric`, `todo_count_update`, `deferred_items`, `roadmap_evolution`
    — stored under `<milestone>:<type>:<id>` (e.g.,
    `v1.0:decision:D-2026-04-30-05`). Read-back via
    `bd remember get <key>` or `bd remember list <prefix>`.
  - **comments** for: `session`, `quick_task`, `forensic_session` —
    high-frequency append events; stored as bd comments on the active
    milestone bead, labeled `gsd:event:<type>`. Read-back via
    `bd comments list <milestoneBead> --label gsd:event:<type>`.

  Uniform-memories rejected: high-frequency types bloat the memory
  store; bd memories aren't designed for time-series append patterns.
  Uniform-typed-sub-beads rejected: conflates 'state event' with
  'work item'; `bd ready` would surface them; thousands of session
  events over a project lifetime. Defer-per-type-to-Phase-9 rejected:
  Phase 7 SC#3 says all 10 dispatch — weakens the gate.

- **D-10:** **`putNamedDoc(category, key, body)` → disk under
  `.planning/<category>/<key>.md` + bd memory index.** Body is a real
  markdown file (preserves narrative readability per REQ-07; user can
  grep `.planning/intel/`); the parallel bd memory at
  `gsd-beads:named-doc:<category>:<key>` records existence + last-write
  timestamp + (optionally) a content hash. `getNamedDoc` reads the
  file directly. The category enum is frozen in `pathRouter.mjs` (the
  same registry from D-01 has `kind: 'namedDoc'` entries). Initial
  enum: `intel`, `codebase`, `research`, `archived-milestone`,
  `debug-knowledge-base`, `learnings`, `methodology`, `discussion-log`,
  `discovery`. Plan-phase finalizes the list against SYNTHESIS §4.
  Memories-with-inline-body rejected: bodies aren't sized for memory
  values; loses file-readability; conflicts with archived-milestone
  layout. Typed-sub-beads rejected: pollutes `bd ready` / `bd list`
  with non-work artifacts.

- **D-11:** **`snapshot()/restore()` covers bd JSONL + memories only.**
  `snapshot()` runs `bd export --json --memories` to a tmp file and
  returns the path. `restore(snapshotRef)` re-imports via `bd init
  --from-jsonl --prefix <…> --non-interactive --skip-agents` with
  `BEADS_ACTOR=seed` (spike-validated determinism contract preserved).
  Disk-routed records (PLAN.md narrative, named docs under
  `.planning/<category>/`) are NOT snapshotted — dry-run hoist consumers
  cp -r the `.planning/` tree themselves before invoking `snapshot()`.
  This narrow scope matches the locked `capabilities.snapshot = true`
  semantic. Whole-`.planning/`-tarball rejected: duplicates filesystem
  work the consumer often does itself; opaque tar refs make conformance
  brittle. Bd-only-no-memories rejected: decisions stored AS memories
  (D-09) wouldn't survive restore; breaks the round-trip badly.

- **D-12:** **Phase 7 conformance asserts the write+read storage shape
  for every primitive — read-back uses bd directly, NOT the Phase 9+
  read methods.** For each `recordStateEvent` type: write → assert
  memory key/comment label/payload via direct `bd` calls →
  Phase 9 then implements `getStateSnapshot` against the locked shape.
  For `putNamedDoc`: write → assert disk path exists with the body
  AND bd memory index has the entry. For `snapshot/restore`: write →
  snapshot → mutate → restore → re-read → assert original. JSON-schema
  files rejected: heavy infrastructure for 10 fixed shapes when JSDoc
  comments + conformance assertions serve the same purpose.

### Conformance harness + capabilities flag

- **D-13:** **Per-cluster, primitive-aware test layout under
  `tests/conformance/`:**
  - `binA-records.test.mjs` — getRecord/putRecord/removeRecord/exists/listCollection
  - `binA-section.test.mjs` — getSection/updateSection × 3 modes, with path-slug
  - `binA-frontmatter.test.mjs` — getFrontmatter/updateFrontmatter/mergeFrontmatter on bd-routed AND disk-routed paths
  - `foundational-events.test.mjs` — recordStateEvent × 10 types
  - `foundational-namedDoc.test.mjs` — putNamedDoc/getNamedDoc per category
  - `foundational-snapshot.test.mjs` — snapshot/restore round-trip
  - `capabilities.test.mjs` — flag shape + per-`false` rationale lint

  Per-method rejected: file explosion. Single-file rejected: balloons
  to thousands of lines; can't parallelize across files.
  Per-bin-only rejected: Bin A / foundational overlap on
  getSection/updateSection creates ambiguity.

- **D-14:** **Adapter factory in `describe.each` (or equivalent
  `node:test` parameterization).** Each conformance file exports
  `runConformance(makeAdapter, label)`. A driver
  `tests/conformance/run.mjs` invokes each file's exported function
  once with `() => new BeadsAdapter(<fixturePath>)` and (when fork is
  reachable via `npm link`) once with
  `() => new MarkdownAdapter(<fixturePath>)`. CI flag
  `RUN_CROSS_ADAPTER=1` toggles the second invocation. Phase 13 just
  flips the flag once the fork publishes — no harness rewrite needed.
  Two-parallel-suites rejected: massive duplication; drift risk.
  Env-var-selects-suite rejected: can't run both in one CI invocation.
  Defer-to-Phase-13 rejected: structure undecided defeats Phase 7
  SC#4 wording.

- **D-15:** **`tests/fixtures/seed.jsonl` stays canonical;
  `tests/conformance/fixture.mjs:setupFreshAdapter()` clones it to a
  tmp dir per test (mkdtempSync + t.after() teardown — Phase 5
  carry-forward).** Each test starts from the same baseline state and
  applies its own mutations. CONF-03 byte-identity preserved —
  seed.jsonl never modified in place. seed.jsonl gets a one-time
  enrichment in Phase 7 to cover all primitive scenarios (plan-phase
  determines exact additions: enough records for path-router
  exercises, sample memories for recordStateEvent reads, sample
  comments, etc.). Per-test-fixtures-from-scratch rejected: every
  test re-incurs `bd init` cost. Separate-`conformance.jsonl`
  rejected: two fixtures to maintain; only seed.jsonl has the
  CONF-03 byte-identity invariant.

- **D-16:** **Capabilities flag locks at Phase 6's shipped values;
  `writeBinaryAsset` throws `UnsupportedOperationError`.** Final shape:
  ```
  { record: true, section: true, binaryAsset: false, snapshot: true,
    transaction: false, namedDoc: true, commitPlanningState: false }
  ```
  `UnsupportedOperationError` is a new class added to
  `src/bd/errors.mjs`, extending the existing `BeadsUnavailableError`
  hierarchy. Throw message: `"BeadsAdapter.<method>: not supported
  (capabilities.<flag>=false). <hint>"`. Each `false` value gets a
  JSDoc rationale comment on the `BeadsAdapter.capabilities`
  declaration per Phase 7 SC#1. UI-screenshot consumers (Phase 10
  IMPL-04 `addUiReviewScreenshot`) check the flag before calling and
  skip with a warn-log when false — `if
  (!adapter.capabilities.binaryAsset) skip()`. External-blob-route
  rejected: out of phase scope; flag-as-source-of-truth would be
  wrong (callers would need a separate "does the sink work" check
  anyway). Snapshot-downgrade-to-false rejected: bd-only snapshot is
  useful for Phase 9-13 callers; downgrading forces try/catch where
  partial-snapshot suffices. Adding `partialSnapshot` bit rejected:
  D-2026-04-30-05 deliberately fixed the seven-bit shape; ad-hoc bits
  break "shape is the contract".

### Carried forward from Phase 6 (do NOT re-decide)

- **D-17:** Cluster-binding pattern: `Object.assign(BeadsAdapter.prototype,
  ...8 cluster method-bags)` (Phase 6 D-04). Phase 7 edits the
  `primitives` cluster file; the binding mechanism is untouched.
- **D-18:** Lazy bd validation via `_ensureBd()` — first-method-call
  triggers `findBeadsRoot()` lookup and caches the result (Phase 6 D-02
  + Phase 4 D-01..D-04). Every Phase 7 primitive that touches bd
  starts with `this._ensureBd()`; primitives that pass through to disk
  (raw narrative reads/writes) skip it.
- **D-19:** Static `capabilities` declared with `Object.freeze`
  (Phase 6 D-03). Phase 7 just edits the literal values; the
  `BeadsAdapter.capabilities` access pattern (no instance required)
  stays.
- **D-20:** `BEADS_ACTOR=seed` discipline preserved on every bd
  invocation that affects determinism (snapshot/restore, named-doc
  index writes if they participate in seed.jsonl). `bd-helper.mjs`
  signature already accepts an env override.
- **D-21:** ≤2 bd spawns per public method invocation (QUAL-07
  carry-forward). Bin A reads against bd typically use ONE
  `bd export --json` and parse client-side; writes use ONE `bd
  update`/`bd remember`/etc. Conformance has timing assertions on
  hot paths.
- **D-22:** `findBeadsRoot()` semantics — env-var first, parent-walk
  bounded at git root, `fs.realpath` follows symlinks. Phase 4
  D-01..D-04 carry-forward.
- **D-23:** All-epic + labels strategy for bd vocabulary
  (`gsd:phase`, `gsd:plan`, `gsd:requirement`, `gsd:seed`, `gsd:todo`,
  `gsd:event:<type>`, `gsd:named-doc:<category>` — new for Phase 7);
  spike findings authoritative.
- **D-24:** Stub style preserved for any Phase 7 code that intentionally
  remains stub (none expected — Phase 7 implements ALL 16 primitives;
  if any sub-method falls out of scope mid-execution, use Phase 6's
  exact `'BeadsAdapter.<m>: not implemented (Phase N / IMPL-NN)'`
  format).

### Folded Todos

- **`disambiguate-bd-managed-detection.md`** (resolves_phase=6, score
  0.6) — Phase 6 archived the offending hooks (mooting the
  self-targeting issue); Phase 7 inherits the conceptual resolution
  via D-18 (lazy `_ensureBd()`). The adapter validates bd state at
  first method call and degrades gracefully via the
  `BeadsUnavailableError` hierarchy when no bd-tracked issues exist.
  No further work — todo stays closed by Phase 6 ship; Phase 7
  references it as resolved-context.

### Claude's Discretion

- **Slug rule details for D-05/D-06** — `slugify()` exact accent /
  unicode handling, whether to collapse multiple spaces, how to
  handle code-fence content in heading text. Plan-phase picks based
  on the `github-slugger` algorithm (most consistent with existing
  GitHub markdown rendering), or hand-rolls a smaller equivalent.
- **`pathRouter.mjs` registry shape** — D-01 names the pattern; the
  exact data structure (array of `{ pattern: RegExp, kind: string,
  toBdQuery: fn, toDiskPath: fn }` records vs a glob-trie) is
  plan-phase's call. Conformance only asserts behavior, not shape.
- **`bd export --json --memories` flag exact CLI** — D-11 names the
  intent; the exact bd flag syntax (it may be `bd export --json
  --include-memories` or two separate calls) is verified during
  research/plan-phase.
- **`UnsupportedOperationError` parent class** — D-16 says it extends
  the `BeadsUnavailableError` hierarchy; whether it sits next to
  `BeadsEmpty`/`BeadsCorrupt` or as a sibling of `BeadsUnavailableError`
  is plan-phase's call.
- **`tests/conformance/fixture.mjs:setupFreshAdapter()` exact API** —
  D-15 names the helper; whether it returns
  `{ adapter, fixturePath, cleanup }` or wraps in `t.context.adapter`
  is plan-phase's call given test runner conventions.
- **`bd memory key collision policy across milestones`** — D-09 uses
  `<milestone>:<type>:<id>` but if a stored payload is mutated during
  a milestone transition (rare), the key namespace is per-milestone
  isolated; no cross-milestone conflicts expected. If conflicts
  surface during execution, plan-phase adds a milestone-resolution
  step.
- **Whether `recordStateEvent` payload shape validation lives in
  Phase 7 or Phase 9** — Phase 7 ships the dispatch + storage; payload
  schema validation (e.g., `{type:'decision', payload: {id, body, ...
  required fields}}`) can defer to Phase 9 read-side or move into
  Phase 7 if research surfaces a clean validator pattern.

</decisions>

<specifics>
## Specific Ideas

- **The router is the spine.** Every Bin A method's first line is
  `const route = pathRouter.resolve(path)`. This means that adding a
  new bd-managed kind in Phase 8+ (e.g., debug sessions) is a
  one-line addition to the registry; no method body change.

- **Memory-key namespacing follows the spike findings convention
  exactly.** `gsd-beads:` prefix continues to mark project-vocabulary
  memories; `<milestone>:` prefix marks milestone-scoped state events.
  No collision.

- **The path-slug `'phase-7/decisions/d-01'` rule means anchors are
  greppable as identifiers.** A Bin B method `recordDecision(phase,
  decisionId)` writing to ROADMAP.md's "## Decisions" section would
  use `updateSection('.planning/ROADMAP.md', 'decisions/d-01', body,
  'overwrite')`. Static analyzers can find anchor usages.

- **`describe.each(adapterFactory)` is the same shape as Vitest /
  Jest's pattern AND `node:test` accepts function-parameterized
  describes via plain JS — no additional runner needed.** The
  `tests/conformance/run.mjs` driver is plain `import` calls.

- **Capabilities flag's `false` values aren't "unimplemented" —
  they're "deliberately unsupported on this adapter".** The JSDoc
  rationale per `false` distinguishes "bd doesn't support binaries"
  from "no one has built it yet". Phase 13 verifies the flag still
  matches reality post-IMPL-12; no changes expected.

- **`.planning/<category>/` named-doc directories are first-class
  citizens.** `intel/`, `codebase/`, `research/` already exist in this
  repo. `learnings/`, `methodology/`, `archived-milestone/` get
  created on first write per category.

- **`tests/fixtures/seed.jsonl` enrichment is a one-time additive
  edit.** Phase 7 adds whatever records are needed for primitive
  conformance; CONF-03 byte-identity invariant means once added, the
  fixture stays. `build-seed.sh` regenerates deterministically.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 acceptance contract
- `.planning/ROADMAP.md` §"Phase 7: Capabilities flag + Bin A primitives
  + foundational primitives" — 5 success criteria + dependencies (Phase
  6 src/ layout)
- `.planning/REQUIREMENTS.md` §"Capabilities + foundational primitives"
  (CAP-01, PRIM-01, PRIM-02), §"Test infrastructure" (CONF-01, CONF-02,
  CONF-03) — 5 owned requirements
- `.planning/PROJECT.md` §"Architecture" — adapter library shape; sibling
  fork relationship

### Architecture context (foundational, do not re-derive)
- `.planning/research/fork-investigation/SYNTHESIS.md` §4 "Adapter
  interface draft" — Bin A signatures (lines 145-168) + Bin B catalog
  (lines 175-509) + Foundational primitives table (lines 518-533)
- `.planning/research/fork-investigation/SYNTHESIS.md` §6 "Open
  architectural questions" — OQ-2 (capability negotiation), OQ-3
  (section-scoped vs whole-file granularity), OQ-8
  (commitPlanningState semantics), OQ-9 (AI-SPEC three-author
  concurrency)
- `.planning/DECISIONS.md` D-2026-04-30-05 — capabilities flag shape
  contract; do NOT change shape, only finalize boolean values
- `.planning/DECISIONS.md` D-2026-04-30-06 — SYNTHESIS.md §4 is
  canonical method catalog
- `.planning/STATE.md` — milestone v1.0 status; Phase 6 complete

### Cross-phase context to carry forward
- `.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md`
  D-01..D-24 — adapter shell architecture, lazy `_ensureBd()`,
  `Object.assign` cluster binding, capabilities placeholder, format
  module bidirectional contract, src/ layout. ALL 24 decisions
  carry-forward; Phase 7 only edits the `primitives` cluster file +
  adds `pathRouter.mjs` + adds `tests/conformance/`.
- `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-CONTEXT.md`
  D-01..D-04 — `findBeadsRoot()` semantics inherited via
  `src/bd/findRoot.mjs`
- `.planning/phases/05-roadmap-read-handlers/05-CONTEXT.md` —
  Phase 5's parsing helpers (parsePhaseId, deriveDiskStatus, etc.)
  now under `src/helpers/`; Phase 7 reuses for ROADMAP/REQUIREMENTS
  bd-routed reads

### Spike findings (validated patterns; auto-loaded)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — non-negotiable
  bd modeling: all-epic + labels, cascade-loop, hash-based IDs,
  `BEADS_ACTOR=seed` determinism. Phase 7 D-09/D-23 inherit.
- `.claude/skills/spike-findings-gsd-beads/references/beads-modeling.md`
  — `bd remember` memory key namespacing (`gsd-beads:` prefix);
  cascade-loop 5-line pattern (Phase 8 owns; Phase 7 doesn't touch)
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md`
  — `bd init --from-jsonl --prefix --non-interactive --skip-agents`
  invocation Phase 7 D-11 uses for `restore()`

### Existing source files Phase 7 modifies / adds
- `src/adapter.mjs` — adapter shell. Phase 7 EDITS the
  `BeadsAdapter.capabilities` literal (line ~53-61) per D-16, leaves
  everything else unchanged.
- `src/adapter/primitives.mjs` — Phase 7 REPLACES every stub body in
  this file (16 methods) with real implementations.
- `src/adapter/pathRouter.mjs` — NEW. Closed-enum routing registry
  per D-01. Imported by primitives.mjs.
- `src/bd/errors.mjs` — Phase 7 ADDS `UnsupportedOperationError`
  class per D-16.
- `src/format/section.mjs` — NEW. `slugify()` + section-bounds
  parser per D-05/D-07. Adjacent to existing `src/format/phase.mjs`.
- `src/format/phase.mjs` — UNCHANGED in implementation; Phase 7
  conformance promotes the round-trip property tests if any inputs
  remain uncovered.
- `tests/conformance/{binA-records, binA-section, binA-frontmatter,
  foundational-events, foundational-namedDoc, foundational-snapshot,
  capabilities}.test.mjs` — NEW × 7.
- `tests/conformance/run.mjs` — NEW driver per D-14.
- `tests/conformance/fixture.mjs` — NEW shared `setupFreshAdapter()`
  per D-15.
- `tests/fixtures/seed.jsonl` — Phase 7 ENRICHES (one-time additive
  edit). `build-seed.sh` regenerates; CONF-03 byte-identity holds
  post-edit.
- `package.json` — Phase 7 may ADD `test:conformance` script body
  (Phase 6 declared the script slot but stubbed); plan-phase
  decides exact command.

### External fork reference
- `~/code/get-shit-done` (branch `feat/storage-adapter`) — sibling
  fork. Phase 7 does NOT depend on the fork at runtime; cross-adapter
  pairing under D-14 is `RUN_CROSS_ADAPTER=1` opt-in only. Phase 13
  flips the flag once fork publishes.

### Defensive context (read but Phase 7 does NOT act on)
- `.planning/todos/pending/disambiguate-bd-managed-detection.md` —
  resolved-by-context per Phase 6 ship + Phase 7 D-18 inheritance.
  No work in Phase 7; folded above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/bd/helper.mjs`** — `bd(args, opts)` `spawnSync` wrapper that
  throws `BeadsNotInstalled`/`BeadsCorrupt`/`BeadsEmpty` sentinels.
  Phase 7 wraps every bd invocation through this. Already accepts an
  `env` option for `BEADS_ACTOR=seed`.
- **`src/bd/findRoot.mjs`** — `findBeadsRoot(projectRoot)`. Used by
  `_ensureBd()` (Phase 6 D-02). Phase 7 primitives that touch bd
  start with `this._ensureBd()` to get the cached beads root.
- **`src/bd/errors.mjs`** — frozen `BeadsCause` enum + per-subtype
  error classes (`BeadsNotInstalled`, `BeadsCorrupt`, `BeadsEmpty`).
  Phase 7 ADDS `UnsupportedOperationError` here per D-16.
- **`src/format/phase.mjs`** — Phase 6 shipped real bidirectional
  parser/formatter for ROADMAP.md phase titles + descriptions. Phase
  7 conformance reuses for round-trip property tests (CONF-02).
- **`src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,
  loadMilestoneHeading}.mjs`** — Phase 5 helpers. Phase 7's
  `pathRouter.mjs` may delegate to `parsePhaseId` for the
  `'.planning/phases/NN-*/...'` pattern.
- **`tests/fixtures/{seed.jsonl,build-seed.sh,seed-fixture.sh}`** —
  CONF-03 canonical fixture. Phase 7 enriches additively.
- **`tests/unit/format-phase.test.mjs`** + 11 fixture files at
  `tests/unit/fixtures/phase-format/` — Phase 6's round-trip tests.
  Phase 7 either promotes to `tests/conformance/` or expands inline
  per CONF-02.
- **`tests/unit/{bd-helper,beads-errors,findBeadsRoot}.test.mjs`** —
  Phase 6's regression suite. Phase 7's primitive tests live alongside
  in `tests/conformance/` (separate directory; same `node:test`
  runner).

### Established Patterns

- **`Object.assign(prototype, ...clusterMethodBags)` cluster binding
  (Phase 6 D-04)** — Phase 7 just edits the `primitives` bag.
- **`Object.freeze` on enums + frozen `capabilities`** — Phase 7
  preserves; only the literal values change.
- **`spawnSync` (not `execSync`)** for bd shell-out — preserved.
- **`mkdtempSync` + `t.after()` teardown** — Phase 5/6 migration; Phase
  7 conformance reuses for per-test fixture isolation (D-15).
- **`BEADS_ACTOR=seed`** discipline (spike-validated) — preserved on
  every seeder/restore call (D-11 D-20).
- **Stub style `'BeadsAdapter.<m>: not implemented (Phase N / IMPL-NN)'`
  (Phase 6 D-05)** — Phase 7 doesn't ship new stubs; if execution-time
  scope reduction needs one, follow this exact format.
- **Repo-relative path discipline** — all helpers, tests, README
  examples, and spike findings already use repo-relative paths;
  D-02 codifies as the contract.

### Integration Points

- **`src/adapter.mjs`** imports `primitives` from `./adapter/primitives.mjs`;
  Phase 7's primitive bodies replace stubs; the import binding is
  untouched.
- **`src/adapter/primitives.mjs`** imports `pathRouter` from
  `./pathRouter.mjs` (NEW), `bd` from `../bd/helper.mjs`, errors
  from `../bd/errors.mjs`, format helpers from `../format/section.mjs`
  (NEW).
- **`tests/conformance/run.mjs`** imports each conformance file's
  `runConformance` export; calls with BeadsAdapter factory and
  optionally MarkdownAdapter factory (Phase 13 wires).
- **`package.json#scripts.test:conformance`** — Phase 6 reserved the
  slot; Phase 7 fills the command body (`node --test tests/conformance/run.mjs`
  or equivalent).
- **`tests/fixtures/seed.jsonl`** — Phase 7 enriches additively;
  `build-seed.sh` regenerates byte-identically; CONF-03 invariant
  preserved.
- **`bd hooks install` / `BEADS_DIR` topology** — already in place
  per Phase 6; Phase 7 does NOT need to touch bd configuration.

</code_context>

<deferred>
## Deferred Ideas

- **External binary blob store for `writeBinaryAsset`** — D-16 throws
  unconditionally; if UI screenshots become essential, v1.1 adds a
  configurable sink (`BeadsAdapter({binaryAssetSink: fn})`) and
  flips the flag.
- **Native bd transaction primitive** — `capabilities.transaction =
  false`; consumers compose `snapshot/restore` for transactional
  semantics. v1.1+ may introduce a `withTransaction(fn)` wrapper if
  bd ships native txn or if usage patterns warrant the helper.
- **Whole-tree `.planning/` snapshot** — Phase 7 `snapshot()` is bd-only;
  if dry-run hoist callers grow tired of cp -r boilerplate, v1.1+ may
  add `snapshotTree()` as a separate method (not a flag flip on the
  existing primitive).
- **`recordStateEvent` payload schema validation** — Phase 7 ships
  dispatch + storage; if Phase 9 read-side surfaces shape drift,
  introduce JSON-schema validation as a v1.1 helper.
- **Cascade-loop JS rewrite (`src/bd/cascade.mjs`)** — Phase 8 owns
  per Phase 6 D-12; Phase 7 doesn't touch.
- **`commitPlanningState` non-no-op semantics** — Phase 13 / OQ-08
  owns final cross-adapter contract; Phase 7's flag value is `false`
  and the method is a no-op (or thin throw).
- **Cross-adapter conformance parity vs fork's MarkdownAdapter** —
  D-14 ships the harness ready; Phase 13 flips
  `RUN_CROSS_ADAPTER=1` once fork publishes.
- **Memory-key resolution at milestone transitions** — D-09 uses
  `<milestone>:<type>:<id>`; if mid-transition events surface
  collisions during execution, plan-phase or Phase 9 adds a
  milestone-resolution helper.

### Reviewed Todos (not folded as scope)

None — `disambiguate-bd-managed-detection.md` is the only matched
todo, and it folded above as resolved-by-context.

</deferred>

---

*Phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives*
*Context gathered: 2026-04-30*
