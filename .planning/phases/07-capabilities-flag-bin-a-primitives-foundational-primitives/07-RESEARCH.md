# Phase 7: Capabilities flag + Bin A primitives + foundational primitives — Research

**Researched:** 2026-04-30
**Domain:** BeadsAdapter primitive surface (10 Bin A + 6 foundational + capabilities flag + conformance harness)
**Confidence:** HIGH (every bd CLI flag, memory shape, comment shape, and snapshot/restore round-trip was end-to-end verified live in this session)

## Summary

Phase 7 is execution against a fully-locked design. CONTEXT.md ships D-01..D-24 with the routing table, anchor vocabulary, dispatch policy, snapshot scope, conformance layout, and capabilities literal already decided. The research surface is therefore not "what to build" but "how to build it correctly":

1. Verify every locked bd CLI flag against bd v1.0.3 (the current installed version) so the planner can write task `<action>` blocks with literal commands rather than placeholders.
2. Choose the small handful of unlocked details (D-05 slugify rules; D-06 path-slug normalization; D-13 fixture API shape; frontmatter-on-disk parser).
3. Document concrete code patterns for the harder Bin A operations — section-bounds parsing, atomic file rewrite, frontmatter-on-bd synthesis, listCollection performance tradeoff.

**Primary recommendation:** Build the router + section parser + slugify helper as a tightly-isolated set of pure functions in `src/format/section.mjs` and `src/adapter/pathRouter.mjs`. Hand-roll a ~25-line ASCII-only slugify (we own the input vocabulary — GSD heading text is plain English). Hand-roll a ~40-line YAML frontmatter parser limited to flat scalar/list values for disk-routed `getFrontmatter` (gray-matter is overkill for our PLAN.md schema). Use `bd export --json` once and parse client-side for `listCollection` (2× faster than `bd list -l <label>`); use `bd update --description -` (stdin) only when bodies are >100 KB (which they won't be in this domain). Use `bd comments add --author "gsd:event:<type>"` for high-frequency events — bd comments do NOT support labels, so `--author` is the only structured slot available, and it round-trips through `bd export --json`.

**One CONTEXT decision needs a small adjustment based on live verification:** D-09 says session/quick_task/forensic_session are stored as comments "labeled `gsd:event:<type>`". Comments don't accept labels in bd v1.0.3. The closest faithful substitute is `bd comments add <bead> --author "gsd:event:<type>" "<payload>"` — the `author` field IS structured, IS preserved in `bd export --json`, and IS filterable client-side after `bd comments <bead> --json`. **This is a one-word amendment to D-09**: replace "labeled `gsd:event:<type>`" with "authored as `gsd:event:<type>`". All other dispatch policy semantics hold unchanged. Plan-phase or discuss-phase confirms.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Path → bd-shape routing | Adapter helper module (`pathRouter.mjs`) | — | Pure data + lookup; no I/O; unit-testable in isolation |
| bd CLI shell-out | bd helper (`src/bd/helper.mjs`) | — | Already ships `spawnSync` wrapper + sentinel error mapping |
| Heading slugification | format helper (`src/format/section.mjs`) | — | Pure string transform; no I/O |
| Section bounds locator | format helper (`src/format/section.mjs`) | — | Pure parser over markdown lines; no AST library |
| Atomic file replace | adapter primitives (`primitives.mjs`) | Node `fs` | `writeFileSync(tmp); renameSync(tmp,target)` — POSIX-atomic |
| YAML frontmatter parse (disk) | format helper (`src/format/frontmatter.mjs` — new) | — | Hand-rolled, flat-scalar only |
| Frontmatter synthesis (bd) | adapter primitives | path router | Map labels → flat object + back |
| Snapshot/restore | adapter primitives | bd helper | `bd export --json` + `bd init --from-jsonl --prefix --non-interactive --skip-agents --skip-hooks` |
| State event dispatch | adapter primitives | bd helper | Discriminated-union switch over `type` |
| Named-doc disk + bd-memory index | adapter primitives | path router + bd helper | Disk write + memory index write are 2 spawns total |
| Conformance harness driver | tests/conformance/run.mjs | — | Plain `import` calls; no test runner extension |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Bin A path routing & frontmatter

- **D-01:** **Closed-enum routing table at `src/adapter/pathRouter.mjs`.** A frozen registry maps repo-relative path patterns to bd-shape descriptors:
  ```
  '.planning/ROADMAP.md'              → { kind: 'roadmap' }
  '.planning/REQUIREMENTS.md'         → { kind: 'requirements' }
  '.planning/todos/**'                → { kind: 'todo' }
  '.planning/seeds/**'                → { kind: 'seed' }
  '.planning/phases/NN-*/NN-PLAN.md'  → { kind: 'plan',  phase: 'NN' }
  '.planning/<category>/<key>.md'     → { kind: 'namedDoc', category, key }
  ...
  ```
  Anything not matched falls through to disk. The router is the single point of dispatch — every Bin A method (`getRecord`, `putRecord`, `getSection`, `updateSection`, `exists`, `listCollection`) starts by resolving the path through the router. Path-pattern allowlist (single regex) rejected: loses the per-path bd-shape information; method would have to re-classify after matching. Virtual-path scheme rejected: breaks SYNTHESIS §4's "paths translate to bd queries" wording and forces every existing GSD workflow to translate paths it already knows. Method-level dispatch rejected: muddies the contract; consumers learn N defaults instead of one routing rule.

- **D-02:** **Repo-relative paths everywhere.** Registry keys are repo-relative (`.planning/ROADMAP.md`); callers pass repo-relative strings; adapter joins to `this.projectRoot` internally when an absolute path is needed.

- **D-03:** **`getFrontmatter`/`updateFrontmatter`/`mergeFrontmatter` on bd-routed paths synthesize from bd labels.** Returns a flat object derived from the record's bd labels and metadata (`{phase_id: '07', version: 'v1.0', status: 'open', ...}`). Updates mutate the corresponding bd labels via `bd label add/remove`. Limit synthesized frontmatter to flat string/boolean values (bd labels are flat strings). For disk-routed paths (PLAN.md narrative, named docs), this is straightforward markdown frontmatter parsing.

- **D-04:** **`listCollection(prefix, filter?)` follows the same router.** `listCollection('.planning/phases')` matches the phase-collection entry → `bd list -l gsd:phase` (sorted by `phase-id:NN` numeric, deterministic). `listCollection('.planning/todos')` → `bd list -l gsd:todo`. Disk-routed prefixes (`docs/features`, etc.) → `fs.readdir`. `filter`, when supplied, maps to additional `bd list -l <filter-label>` arguments for bd-routed and predicate filtering for disk-routed. ≤2 bd spawns per call (QUAL-07 carry-forward).

#### Section anchor vocabulary

- **D-05:** **Anchor is a heading slug** — lowercase, hyphen-separated, derived from heading text via a documented `slugify()` helper exposed from `src/format/section.mjs` (new file). UAT "Current Test" → `'current-test'`. Adapter normalizes both stored heading and incoming anchor through the same rule.

- **D-06:** **Path-slug always: anchor is a slash-separated path of slugs from H1 down.** `'phase-7/decisions/d-01'`. Forces unambiguous addressing everywhere; eliminates first-match-wins shadowing on duplicate sub-headings. Path-slug accepts a leading-slash variant (`'/decisions'` binds to the document root if a top-level heading slugs to 'decisions'); plan-phase decides exact normalization.

- **D-07:** **`updateSection` modes are body-replace within heading bounds.** A "section" is the content between the addressed heading and the next sibling-or-shallower heading (standard markdown section bounds, mdast convention). `mode === 'overwrite'` replaces all content in that range. `mode === 'append'` inserts `body` immediately before the next sibling heading (or end-of-file if none). `mode === 'prepend'` inserts `body` immediately after the heading line. The heading line itself is NEVER touched by any mode.

- **D-08:** **`updateSection` is atomic per call: read → AST → rewrite addressed section → write whole file via tmpfile + rename.** POSIX rename atomicity serializes concurrent processes. AI-SPEC three-author contract (Phase 10 SC#3 / OQ-09) holds because the three sequential calls each succeed in document order without clobbering siblings. For bd-routed paths (rare — AI-SPEC.md is narrative, stays disk-routed), the bd-side equivalent is `bd update` with the full new section content.

#### Bd storage shapes

- **D-09:** **`recordStateEvent({type, payload})` dispatch policy:**
  - **memories** for: `decision`, `blocker_added`, `blocker_resolved`, `metric`, `todo_count_update`, `deferred_items`, `roadmap_evolution` — stored under `<milestone>:<type>:<id>` (e.g., `v1.0:decision:D-2026-04-30-05`). Read-back via `bd recall <key>` or `bd memories <prefix-substring>`.
  - **comments** for: `session`, `quick_task`, `forensic_session` — high-frequency append events; stored as bd comments on the active milestone bead, **authored as** `gsd:event:<type>`. Read-back via `bd comments <milestoneBead> --json` then client-side filter on `author === 'gsd:event:<type>'`. (Amendment from "labeled" to "authored as" — see Pitfalls below.)

- **D-10:** **`putNamedDoc(category, key, body)` → disk under `.planning/<category>/<key>.md` + bd memory index.** Body is a real markdown file; the parallel bd memory at `gsd-beads:named-doc:<category>:<key>` records existence + last-write timestamp + (optionally) a content hash. `getNamedDoc` reads the file directly. The category enum is frozen in `pathRouter.mjs`. Initial enum: `intel`, `codebase`, `research`, `archived-milestone`, `debug-knowledge-base`, `learnings`, `methodology`, `discussion-log`, `discovery`.

- **D-11:** **`snapshot()/restore()` covers bd JSONL + memories only.** `snapshot()` runs `bd export --json --memories` to a tmp file and returns the path. `restore(snapshotRef)` re-imports via `bd init --from-jsonl --prefix <…> --non-interactive --skip-agents` with `BEADS_ACTOR=seed`. Disk-routed records (PLAN.md narrative, named docs under `.planning/<category>/`) are NOT snapshotted — dry-run hoist consumers cp -r the `.planning/` tree themselves before invoking `snapshot()`.

- **D-12:** **Phase 7 conformance asserts the write+read storage shape for every primitive — read-back uses bd directly, NOT the Phase 9+ read methods.**

#### Conformance harness + capabilities flag

- **D-13:** **Per-cluster, primitive-aware test layout under `tests/conformance/`:**
  - `binA-records.test.mjs` — getRecord/putRecord/removeRecord/exists/listCollection
  - `binA-section.test.mjs` — getSection/updateSection × 3 modes, with path-slug
  - `binA-frontmatter.test.mjs` — getFrontmatter/updateFrontmatter/mergeFrontmatter on bd-routed AND disk-routed paths
  - `foundational-events.test.mjs` — recordStateEvent × 10 types
  - `foundational-namedDoc.test.mjs` — putNamedDoc/getNamedDoc per category
  - `foundational-snapshot.test.mjs` — snapshot/restore round-trip
  - `capabilities.test.mjs` — flag shape + per-`false` rationale lint

- **D-14:** **Adapter factory in `describe.each` (or equivalent `node:test` parameterization).** Each conformance file exports `runConformance(makeAdapter, label)`. A driver `tests/conformance/run.mjs` invokes each file's exported function once with `() => new BeadsAdapter(<fixturePath>)` and (when fork is reachable via `npm link`) once with `() => new MarkdownAdapter(<fixturePath>)`. CI flag `RUN_CROSS_ADAPTER=1` toggles the second invocation.

- **D-15:** **`tests/fixtures/seed.jsonl` stays canonical; `tests/conformance/fixture.mjs:setupFreshAdapter()` clones it to a tmp dir per test (mkdtempSync + t.after() teardown — Phase 5 carry-forward).** Each test starts from the same baseline state and applies its own mutations. CONF-03 byte-identity preserved — seed.jsonl never modified in place. seed.jsonl gets a one-time enrichment in Phase 7 to cover all primitive scenarios.

- **D-16:** **Capabilities flag locks at Phase 6's shipped values; `writeBinaryAsset` throws `UnsupportedOperationError`.** Final shape:
  ```
  { record: true, section: true, binaryAsset: false, snapshot: true,
    transaction: false, namedDoc: true, commitPlanningState: false }
  ```
  `UnsupportedOperationError` is a new class added to `src/bd/errors.mjs`, extending the existing `BeadsUnavailableError` hierarchy. Throw message: `"BeadsAdapter.<method>: not supported (capabilities.<flag>=false). <hint>"`.

#### Carried forward from Phase 6

- **D-17..D-24:** Object.assign cluster binding, lazy `_ensureBd()`, frozen capabilities, BEADS_ACTOR=seed discipline, ≤2 bd spawns per public method invocation, findBeadsRoot() semantics, all-epic + labels strategy, stub style preserved.

### Claude's Discretion

- **Slug rule details for D-05/D-06** — `slugify()` exact accent / unicode handling, whether to collapse multiple spaces, how to handle code-fence content in heading text. Plan-phase picks based on the `github-slugger` algorithm, or hand-rolls a smaller equivalent.
- **`pathRouter.mjs` registry shape** — D-01 names the pattern; the exact data structure (array of `{ pattern: RegExp, kind: string, toBdQuery: fn, toDiskPath: fn }` records vs a glob-trie) is plan-phase's call. Conformance only asserts behavior, not shape.
- **`bd export --json --memories` flag exact CLI** — VERIFIED in research: bd v1.0.3 includes memories by default in `bd export --json`. Use `--no-memories` to exclude. No `--memories` / `--include-memories` / `--with-memories` flag exists (and none is needed). Single command: `bd export --json -o <path>`.
- **`UnsupportedOperationError` parent class** — D-16 says it extends the `BeadsUnavailableError` hierarchy; whether it sits next to `BeadsEmpty`/`BeadsCorrupt` or as a sibling of `BeadsUnavailableError` is plan-phase's call.
- **`tests/conformance/fixture.mjs:setupFreshAdapter()` exact API** — D-15 names the helper; whether it returns `{ adapter, fixturePath, cleanup }` or wraps in `t.context.adapter` is plan-phase's call given test runner conventions.
- **`bd memory key collision policy across milestones`** — D-09 uses `<milestone>:<type>:<id>` but if a stored payload is mutated during a milestone transition (rare), the key namespace is per-milestone isolated; no cross-milestone conflicts expected.
- **Whether `recordStateEvent` payload shape validation lives in Phase 7 or Phase 9** — Phase 7 ships the dispatch + storage; payload schema validation can defer to Phase 9 read-side.

### Deferred Ideas (OUT OF SCOPE)

- External binary blob store for `writeBinaryAsset` — D-16 throws unconditionally
- Native bd transaction primitive — `capabilities.transaction = false`
- Whole-tree `.planning/` snapshot — Phase 7 `snapshot()` is bd-only
- `recordStateEvent` payload schema validation — Phase 7 ships dispatch + storage only
- Cascade-loop JS rewrite (`src/bd/cascade.mjs`) — Phase 8 owns
- `commitPlanningState` non-no-op semantics — Phase 13 / OQ-08 owns
- Cross-adapter conformance parity vs fork's MarkdownAdapter — D-14 ships the harness ready; Phase 13 flips `RUN_CROSS_ADAPTER=1`
- Memory-key resolution at milestone transitions — D-09 uses `<milestone>:<type>:<id>`; if collisions surface, plan-phase or Phase 9 adds a milestone-resolution helper.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | `BeadsAdapter` exposes a static `capabilities` object (record, section, binaryAsset, snapshot, transaction, namedDoc, commitPlanningState) per D-2026-04-30-05 | Phase 6 already ships the placeholder literal at the correct location (`src/adapter.mjs:53-61`). Phase 7 only edits boolean values per D-16 + adds JSDoc rationale comments per `false` value. |
| PRIM-01 | 10 generic CRUD methods (getRecord, putRecord, removeRecord, listCollection, exists, getSection, updateSection, getFrontmatter, updateFrontmatter, mergeFrontmatter) | All bd CLI flags verified live (`bd update -d <body>`, `bd label add/remove`, `bd export --json`, `bd show <id> --json`, `bd list -l <label> --json`). For disk-routed paths, Node `fs` (writeFileSync + renameSync) is sufficient. Section parser is hand-rollable in <80 lines (see Code Examples below). |
| PRIM-02 | 6 foundational primitives (updateSection + getSection cross-cutting; recordStateEvent; snapshot/restore; putNamedDoc/getNamedDoc; writeBinaryAsset) | recordStateEvent dispatch via `bd remember --key` (memory) or `bd comments add --author` (comment). Snapshot via `bd export --json -o <path>`. Restore via `bd init --from-jsonl --prefix <…> --non-interactive --skip-agents --skip-hooks`. writeBinaryAsset throws `UnsupportedOperationError` (new class in `src/bd/errors.mjs`). |
| CONF-01 | `tests/conformance/` directory with adapter-shape tests; runnable against BeadsAdapter standalone using seed.jsonl; cross-adapter via fork's MarkdownAdapter when available | node:test does NOT have native `describe.each`. Idiomatic pattern is exported `runConformance(makeAdapter, label)` invoked from `tests/conformance/run.mjs`. Each conformance file uses `describe(\`<cluster> [\${label}]\`, () => { ... })`. Driver imports each file and invokes its export. RUN_CROSS_ADAPTER=1 env-var gates the second invocation. |
| CONF-02 | Round-trip property tests for `src/format/phase.mjs` — `parsePhaseTitle(formatPhaseTitle(x)) === x` and `parsePhaseDescription(formatPhaseDescription(x)) === x` for all canonical inputs | Phase 6 shipped 11 fixtures + a working idempotency loop (`tests/unit/format-phase.test.mjs`). Phase 7 either promotes the file to `tests/conformance/format-phase.test.mjs` OR leaves in place + adds any missing canonical inputs. The contract is `parse(format(parse(x))) === parse(x)` (D-15 idempotency, NOT byte-identity). Already passing — Phase 7 verifies coverage and adds tests for any gap. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in (Node ≥20) | File I/O for disk-routed paths, atomic-rename | Already in use across `src/bd/findRoot.mjs`, no dep added |
| `node:child_process` `spawnSync` | built-in | bd CLI shell-out via `src/bd/helper.mjs` (existing) | Existing, do not change |
| `node:test` | built-in | Test runner (existing) | Existing, no migration |
| `node:assert/strict` | built-in | Conformance assertions | Existing, no migration |
| `node:path` | built-in | Path joins / resolution | Existing |
| `node:os` `tmpdir()` | built-in | Per-test mkdtemp scratch | Existing pattern in tests/unit/findBeadsRoot.test.mjs |
| `bd` v1.0.3 | system binary | Backing store CLI | Existing — `bd version 1.0.3 (1b2dd2cb)` verified in shell `[VERIFIED: command -v bd && bd --version]` |

### Supporting (consider, do NOT auto-add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gray-matter` | 4.0.3 | YAML frontmatter parser | ONLY if hand-rolled flat-scalar parser proves insufficient. PLAN.md frontmatter we have today is ALL flat scalars + flat string lists (`files_modified: - foo.mjs`). Hand-roll is recommended. |
| `js-yaml` | 4.1.1 | YAML parser (more general) | If gray-matter is added later for nested-object frontmatter (not needed in Phase 7). |
| `github-slugger` | 2.0.0 | Heading slugifier | ONLY if Unicode/accent support is required. Current GSD heading vocabulary is ASCII English. Hand-roll a 25-line ASCII slugify. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled section parser | `mdast-util-from-markdown` + `unified` ecosystem | Heavy (~50KB, 20+ transitive deps) for a strictly-bounded markdown subset (ATX headings only). Hand-roll wins. |
| Hand-rolled slugify | `github-slugger` (2.0.0) | Only matters for non-ASCII headings. We don't have them; hand-roll wins. |
| Hand-rolled frontmatter | `gray-matter` (4.0.3) | gray-matter pulls in `js-yaml` + `section-matter` + `kind-of`. For flat-scalar PLAN.md frontmatter, hand-roll is 40 lines; gray-matter is 8 transitive deps. Hand-roll wins. |
| `bd export --json` parse client-side for listCollection | `bd list -l <label> --json` | bd export is ~2× faster (0.32s vs 0.59s on the seed.jsonl fixture, both single-spawn). [VERIFIED: live timing.] But export pulls everything; `bd list -l` scopes server-side. Best-of-both: use `bd list -l <label> --json -n 0` (the `-n 0` lifts the default 50-row limit). [VERIFIED: returns deterministic JSON array.] |
| node:test parameterization via `describe.each` | Plain JS loop wrapping `describe` | node:test has no `describe.each`. The idiomatic pattern is `for (const f of factories) describe(\`\${f.label}\`, () => suite(f.factory))`. [VERIFIED: nodejs/node#47902] Plan ships this pattern. |

**Installation:** Phase 7 adds NO new npm dependencies. (If plan-phase elects gray-matter or github-slugger after revisiting, the installation is a single `npm install --save-prod` line; current package.json has zero non-peer deps.)

**Version verification:**

```bash
bd --version    # bd version 1.0.3 (1b2dd2cb)  [VERIFIED 2026-04-30]
node --version  # v24.14.0                     [VERIFIED 2026-04-30; engines.node says >=20]
npm view github-slugger version  # 2.0.0       [VERIFIED]
npm view gray-matter version     # 4.0.3       [VERIFIED]
npm view js-yaml version         # 4.1.1       [VERIFIED]
```

## Architecture Patterns

### System Architecture Diagram

```
        ┌─────────────────────────────────────────────────────┐
        │            Caller (workflow / skill)                │
        │  await adapter.updateSection('.planning/PLAN.md',   │
        │       'phase-7/decisions/d-01', body, 'overwrite')  │
        └────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────┐
                    │  BeadsAdapter.prototype.    │
                    │  updateSection (primitive)  │
                    └─────────┬──────────────────┘
                              │
                              ▼
                    ┌────────────────────────┐
                    │  pathRouter.resolve     │  ◀── pure function
                    │   (closed-enum lookup)  │      (no I/O)
                    └─────┬──────────────────┘
                          │
              ┌───────────┼────────────┐
              │ bd-routed │  disk-routed
              ▼           │            ▼
     ┌────────────────┐   │   ┌──────────────────────────┐
     │ this._ensureBd │   │   │ readFileSync(target)     │
     │ → cached root  │   │   │ ─→ format/section.mjs    │
     └──────┬─────────┘   │   │    locateSection(...)    │
            │             │   │ ─→ rewrite slice         │
            ▼             │   │ ─→ writeFileSync(tmp)    │
     ┌────────────────┐   │   │ ─→ renameSync(tmp,target)│  POSIX-atomic
     │ bd update <id> │   │   └──────────────────────────┘
     │   -d "<body>"  │   │
     └────────────────┘   │
            │             │
            ▼             │
     ┌────────────────┐   │
     │ spawnSync via  │   │
     │ src/bd/helper  │   │
     │  → throws on   │   │
     │    bd failure  │   │
     └────────────────┘   │
                          │
                          ▼
              ┌───────────────────────────────┐
              │ getSection / listCollection / │
              │ recordStateEvent / snapshot / │
              │ putNamedDoc / etc.            │
              │ (same router-first dispatch)  │
              └───────────────────────────────┘
```

The router is the spine. Every Bin A method's first line is `const route = pathRouter.resolve(path)`. The two primary tiers below the router are bd-routed (cached `findBeadsRoot()` + `bd` shell-out) and disk-routed (`fs` only). Foundational primitives (`recordStateEvent`, `putNamedDoc`, `snapshot`) compose the same two tiers — `recordStateEvent` writes either bd memory or bd comment; `putNamedDoc` writes BOTH disk + bd memory (the index); `snapshot` is bd-only.

### Recommended Project Structure

```
src/
├── adapter.mjs                      # (existing) shell + capabilities literal — Phase 7 EDITS lines 53-61
├── adapter/
│   ├── primitives.mjs                # Phase 7 REPLACES every stub body
│   ├── pathRouter.mjs                # NEW (D-01) — closed-enum routing registry
│   ├── phaseLifecycle.mjs            # (existing stubs) — Phase 8
│   ├── roadmapMilestone.mjs          # (existing stubs) — Phase 8
│   ├── state.mjs                     # (existing stubs) — Phase 9
│   ├── verifyReviews.mjs             # (existing stubs) — Phase 10
│   ├── discussTodos.mjs              # (existing stubs) — Phase 11
│   ├── longTail.mjs                  # (existing stubs) — Phase 12
│   └── initBundlers.mjs              # (existing stubs) — Phase 13
├── bd/
│   ├── helper.mjs                    # (existing) bd spawn wrapper
│   ├── findRoot.mjs                  # (existing) findBeadsRoot
│   └── errors.mjs                    # Phase 7 ADDS UnsupportedOperationError
├── format/
│   ├── phase.mjs                     # (existing real impl) — Phase 7 verifies coverage
│   ├── section.mjs                   # NEW (D-05/D-07) — slugify + section locator
│   └── frontmatter.mjs               # NEW (D-03) — flat-scalar YAML parser
└── helpers/                          # (existing parsers; unchanged)

tests/
├── conformance/                      # NEW DIRECTORY (Phase 6 created the dir; Phase 7 fills it)
│   ├── run.mjs                       # NEW (D-14) — driver invokes each runConformance
│   ├── fixture.mjs                   # NEW (D-15) — setupFreshAdapter() helper
│   ├── binA-records.test.mjs         # NEW (D-13)
│   ├── binA-section.test.mjs         # NEW (D-13)
│   ├── binA-frontmatter.test.mjs     # NEW (D-13)
│   ├── foundational-events.test.mjs  # NEW (D-13)
│   ├── foundational-namedDoc.test.mjs# NEW (D-13)
│   ├── foundational-snapshot.test.mjs# NEW (D-13)
│   └── capabilities.test.mjs         # NEW (D-13)
├── fixtures/
│   ├── seed.jsonl                    # ENRICH (Phase 7 adds memories + comments + named-doc records)
│   └── build-seed.sh                 # EDIT to match enrichment
└── unit/
    └── format-phase.test.mjs         # (existing — Phase 7 verifies CONF-02 coverage; expand if gaps)
```

### Pattern 1: Closed-enum router with shape descriptors

**What:** Translate a repo-relative path string into a routing decision and a bd-shape descriptor in O(1) per pattern (or O(N patterns) for the prefix table — N ≈ 12).

**When to use:** Every Bin A method's first line. Kept pure to enable unit testing without spawning bd.

**Example:**
```javascript
// src/adapter/pathRouter.mjs
// Closed-enum routing registry per D-01.

const PATTERNS = Object.freeze([
  // Static singletons
  {
    test: (path) => path === '.planning/ROADMAP.md',
    shape: () => ({ kind: 'roadmap', tier: 'bd', label: 'gsd:roadmap', singleton: true }),
  },
  {
    test: (path) => path === '.planning/REQUIREMENTS.md',
    shape: () => ({ kind: 'requirements', tier: 'bd', label: 'gsd:requirement' }),
  },

  // Phase plans: .planning/phases/NN-<slug>/NN-<plan>-PLAN.md
  {
    test: (path) => /^\.planning\/phases\/(\d+)-[^/]+\/(\1)-([^/]+)-PLAN\.md$/.test(path),
    shape: (path) => {
      const m = path.match(/^\.planning\/phases\/(\d+)-[^/]+\/\1-([^/]+)-PLAN\.md$/);
      return { kind: 'plan', tier: 'disk', phase: m[1], plan: m[2] };
    },
  },

  // Collections (prefix matches)
  { test: (p) => p === '.planning/todos' || p.startsWith('.planning/todos/'),
    shape: () => ({ kind: 'todo', tier: 'bd', label: 'gsd:todo', collection: true }) },
  { test: (p) => p === '.planning/seeds' || p.startsWith('.planning/seeds/'),
    shape: () => ({ kind: 'seed', tier: 'bd', label: 'gsd:seed', collection: true }) },
  { test: (p) => p === '.planning/phases' || /^\.planning\/phases\/?$/.test(p),
    shape: () => ({ kind: 'phase', tier: 'bd', label: 'gsd:phase', collection: true }) },

  // Named-doc enum: .planning/<category>/<key>.md
  // The category enum is THE allowlist — anything not matching falls through to disk
  {
    test: (path) => {
      const m = path.match(/^\.planning\/(intel|codebase|research|archived-milestone|debug-knowledge-base|learnings|methodology|discussion-log|discovery)\/([^/]+)\.md$/);
      return Boolean(m);
    },
    shape: (path) => {
      const m = path.match(/^\.planning\/([^/]+)\/([^/]+)\.md$/);
      return { kind: 'namedDoc', tier: 'hybrid', category: m[1], key: m[2] };
    },
  },
]);

export const NAMED_DOC_CATEGORIES = Object.freeze([
  'intel', 'codebase', 'research', 'archived-milestone', 'debug-knowledge-base',
  'learnings', 'methodology', 'discussion-log', 'discovery',
]);

/**
 * @param {string} path  repo-relative
 * @returns {{kind:string, tier:'bd'|'disk'|'hybrid', ...}} shape descriptor
 */
export function resolve(path) {
  if (typeof path !== 'string' || !path.length) {
    throw new TypeError('pathRouter.resolve: path must be a non-empty string');
  }
  for (const entry of PATTERNS) {
    if (entry.test(path)) return entry.shape(path);
  }
  // Fall through: disk-routed, opaque kind
  return { kind: 'opaque', tier: 'disk' };
}
```

### Pattern 2: Hand-rolled section locator (lines-based, no AST)

**What:** Locate the byte-range of a heading-anchored section in a markdown file. Section ends at the next heading whose level is ≤ the addressed heading's level (mdast convention).

**When to use:** Every `getSection`/`updateSection` call on disk-routed paths.

**Algorithm:**
1. Split file into lines.
2. Build a stack of open headings as we scan top-down. At each heading line, slugify its text and append to the stack at depth `level - 1`.
3. The path-slug at any line is the join of stack[0..level-1] with `/`.
4. The addressed section starts at `start = headingLineIndex + 1` (heading line itself NEVER touched per D-07).
5. The section ends at the next line whose heading-level ≤ addressed heading's level (or EOF).

**Example:**
```javascript
// src/format/section.mjs

/**
 * GitHub-style ASCII slugify (subset). Per D-05.
 *
 * Rules (chosen over full github-slugger to avoid the dep):
 *  1. Lowercase
 *  2. Strip everything that isn't [a-z0-9 -]
 *  3. Collapse whitespace + hyphens to single hyphens
 *  4. Trim leading/trailing hyphens
 *
 * If non-ASCII headings appear in our corpus, swap to github-slugger@2.
 * VERIFIED: current GSD .planning/ corpus is 100% ASCII English.
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*_~]/g, '')           // strip markdown emphasis
    .replace(/[^\w\s-]/g, ' ')         // non-word / non-space / non-hyphen → space
    .replace(/[\s_]+/g, '-')           // whitespace / underscore → hyphen
    .replace(/-+/g, '-')               // collapse runs
    .replace(/^-+|-+$/g, '');          // trim ends
}

/**
 * Match an ATX heading line. Captures level + text.
 * Per CommonMark §4.2: 1-6 leading hashes, single required space, optional
 * trailing hashes (treated as decoration).
 */
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/**
 * Locate a section by path-slug.
 *
 * @param {string} text       full file contents
 * @param {string} anchor     path-slug like 'phase-7/decisions/d-01' or '/decisions'
 * @returns {{
 *   headingLine: number,        // 0-based
 *   headingLevel: number,       // 1-6
 *   bodyStart: number,          // 0-based line AFTER heading (inclusive)
 *   bodyEnd: number,            // 0-based line BEFORE next sibling heading (exclusive)
 *   bodyText: string,           // join of [bodyStart..bodyEnd) with \n
 * } | null}
 */
export function locateSection(text, anchor) {
  // Normalize: leading slash means "at document root level"
  const target = anchor.replace(/^\/+/, '');
  const targetParts = target.split('/').filter(Boolean);
  if (!targetParts.length) return null;

  const lines = text.split('\n');
  const stack = [];  // index = level-1; value = slug at that level
  let foundLine = -1;
  let foundLevel = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    const slug = slugify(m[2]);
    stack.length = level;          // truncate deeper levels
    stack[level - 1] = slug;
    // Compare current path-slug to target
    const currentParts = stack.slice(0, level).filter(Boolean);
    if (
      currentParts.length === targetParts.length &&
      currentParts.every((p, idx) => p === targetParts[idx])
    ) {
      foundLine = i;
      foundLevel = level;
      break;
    }
  }
  if (foundLine === -1) return null;

  // Walk forward to next heading with level <= foundLevel
  let bodyEnd = lines.length;
  for (let j = foundLine + 1; j < lines.length; j++) {
    const m = HEADING_RE.exec(lines[j]);
    if (m && m[1].length <= foundLevel) {
      bodyEnd = j;
      break;
    }
  }
  return {
    headingLine: foundLine,
    headingLevel: foundLevel,
    bodyStart: foundLine + 1,
    bodyEnd,
    bodyText: lines.slice(foundLine + 1, bodyEnd).join('\n'),
  };
}

/**
 * Rewrite a section.
 *
 * @param {string} text
 * @param {string} anchor
 * @param {string} body         new body content (will replace lines [bodyStart..bodyEnd))
 * @param {'overwrite'|'append'|'prepend'} mode
 * @returns {string}            new full text
 * @throws if anchor not found
 */
export function rewriteSection(text, anchor, body, mode) {
  const loc = locateSection(text, anchor);
  if (!loc) throw new Error(`section not found: ${anchor}`);
  const lines = text.split('\n');
  const bodyLines = body.split('\n');

  let head, mid, tail;
  if (mode === 'overwrite') {
    head = lines.slice(0, loc.bodyStart);
    mid = bodyLines;
    tail = lines.slice(loc.bodyEnd);
  } else if (mode === 'append') {
    head = lines.slice(0, loc.bodyEnd);
    mid = bodyLines;
    tail = lines.slice(loc.bodyEnd);
  } else if (mode === 'prepend') {
    head = lines.slice(0, loc.bodyStart);
    mid = bodyLines;
    tail = lines.slice(loc.bodyStart);
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }
  return [...head, ...mid, ...tail].join('\n');
}
```

### Pattern 3: Atomic file replace

**What:** Rewrite a file under a tmpfile, then `rename(tmp, target)`. POSIX rename is atomic against concurrent readers, so the file's content jumps from old to new in a single inode swap.

**When to use:** Every `updateSection`, `putRecord`, `mergeFrontmatter` against disk-routed paths.

**Example:**
```javascript
// inside primitives.mjs
import { writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

function atomicWriteFile(absPath, body) {
  // Tmp must be on the SAME filesystem as the target (rename atomicity guarantee).
  // dirname(absPath) puts us next to the target — same fs by construction.
  const tmpPath = resolve(dirname(absPath), `.${basename(absPath)}.tmp.${process.pid}.${Date.now()}`);
  writeFileSync(tmpPath, body);
  renameSync(tmpPath, absPath);   // atomic on POSIX [VERIFIED locally — Node test in research]
}
```

[VERIFIED: live test in research session — write tmp + rename succeeded with target swapping atomically.]

### Pattern 4: Discriminated-union dispatch for recordStateEvent

**What:** Single switch on `event.type` directing to either a memory write or a comment write.

**When to use:** Every `recordStateEvent({type, payload})` call.

**Example:**
```javascript
// inside primitives.mjs

const MEMORY_EVENT_TYPES = Object.freeze(new Set([
  'decision', 'blocker_added', 'blocker_resolved',
  'metric', 'todo_count_update', 'deferred_items', 'roadmap_evolution',
]));

const COMMENT_EVENT_TYPES = Object.freeze(new Set([
  'session', 'quick_task', 'forensic_session',
]));

async recordStateEvent({ type, payload }) {
  if (typeof type !== 'string') throw new TypeError('recordStateEvent: type must be string');
  this._ensureBd();

  if (MEMORY_EVENT_TYPES.has(type)) {
    // Per D-09: <milestone>:<type>:<id>
    const id = payload.id ?? payload.decision_id ?? deriveIdFromPayload(payload);
    const milestone = payload.milestone ?? this._getCurrentMilestone();
    const key = `${milestone}:${type}:${id}`;
    bd(['remember', JSON.stringify(payload), '--key', key], {
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      parseJson: false,
    });
    return { storage: 'memory', key };
  }

  if (COMMENT_EVENT_TYPES.has(type)) {
    // Per D-09 (amended): comments authored as gsd:event:<type> on the milestone bead
    const milestoneBead = await this._getMilestoneBead(payload.milestone);
    bd(['comments', 'add', milestoneBead, '--author', `gsd:event:${type}`, JSON.stringify(payload)], {
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      parseJson: false,
    });
    return { storage: 'comment', bead: milestoneBead, author: `gsd:event:${type}` };
  }

  throw new Error(`recordStateEvent: unknown type "${type}"`);
}
```

### Pattern 5: snapshot/restore round-trip via bd export + bd init --from-jsonl

**What:** Snapshot writes the entire bd state (issues + memories + comments) to a JSONL file. Restore re-imports it into a (possibly different) bd directory.

**When to use:** Dry-run hoist (Phase 8+); restore for failed multi-step plans.

**Verified flow** (live in this research session):
```bash
# Snapshot
BEADS_ACTOR=seed bd export --json -o /tmp/snap.jsonl
# Output: "Exported 1 issues and 3 memories to /tmp/snap.jsonl"

# Restore — start with empty .beads/, copy issues.jsonl, init --from-jsonl
mkdir -p new-project/.beads && cp /tmp/snap.jsonl new-project/.beads/issues.jsonl
cd new-project && BEADS_ACTOR=seed bd init --from-jsonl --prefix sd \
   --non-interactive --skip-agents --skip-hooks --quiet

# Verify: issues, memories, AND comments restored. JSONL format:
#  {"_type":"issue", "id":"...", "labels":[...], "comments":[...], ...}
#  {"_type":"memory","key":"...","value":"..."}
```

[VERIFIED: 1 issue + 3 memories + 1 comment round-tripped byte-for-content; comment author preserved.]

**Code:**
```javascript
import { mkdtempSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bd } from '../bd/helper.mjs';

async snapshot() {
  this._ensureBd();
  const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-snap-'));
  const path = join(dir, 'snapshot.jsonl');
  bd(['export', '--json', '-o', path], {
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    parseJson: false,
  });
  return path;   // caller owns lifecycle
}

async restore(snapshotRef) {
  // Restore re-inits a bd store. We do NOT touch the project's existing
  // .beads/; the consumer is responsible for the backup-and-swap dance.
  // (Phase 8 ships the orchestration helper; Phase 7 ships the primitive.)
  if (typeof snapshotRef !== 'string') throw new TypeError('restore: snapshotRef must be path');
  const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-restore-'));
  mkdirSync(join(dir, '.beads'), { recursive: true });
  copyFileSync(snapshotRef, join(dir, '.beads/issues.jsonl'));
  // Fresh git repo so bd init's checks pass
  // (Real bd init walks for .git; we either create one or rely on cwd being
  // inside an existing repo.)
  bd(['init', '--from-jsonl', '--prefix', this._beadsPrefix(),
      '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'], {
    cwd: dir,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    parseJson: false,
  });
  chmodSync(join(dir, '.beads'), 0o700);
  return dir;
}
```

### Pattern 6: node:test parameterized conformance harness

**What:** Each conformance test file exports `runConformance(makeAdapter, label)`. The driver calls each export with concrete factory arguments. node:test does NOT have native `describe.each` (verified — see [nodejs/node#47902](https://github.com/nodejs/node/issues/47902)); the idiomatic pattern is plain JS function dispatch.

**Example:**
```javascript
// tests/conformance/binA-records.test.mjs

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

export function runConformance(makeAdapter, label) {
  describe(`Bin A: records [${label}]`, () => {

    test('getRecord returns null for missing record', async (t) => {
      const { adapter } = await makeAdapter(t);
      const result = await adapter.getRecord('.planning/does-not-exist.md');
      assert.equal(result, null);
    });

    test('putRecord then getRecord round-trips body', async (t) => {
      const { adapter } = await makeAdapter(t);
      const body = '# Hello\n\nbody\n';
      await adapter.putRecord('.planning/intel/test-key.md', body);
      const result = await adapter.getRecord('.planning/intel/test-key.md');
      assert.equal(result, body);
    });

    // ... more tests
  });
}

// Auto-run against BeadsAdapter when this file is executed directly via
// `node --test tests/conformance/binA-records.test.mjs`. The driver
// (run.mjs) overrides this by importing the export.
import { setupFreshAdapter } from './fixture.mjs';
runConformance(async (t) => setupFreshAdapter(t, 'beads'), 'beads');
```

```javascript
// tests/conformance/run.mjs

// Driver: invokes each conformance file's runConformance with concrete factories.
// Skip self-import on individual file `node --test` runs by gating on env var.

import { setupFreshAdapter } from './fixture.mjs';

const FILES = [
  './binA-records.test.mjs',
  './binA-section.test.mjs',
  './binA-frontmatter.test.mjs',
  './foundational-events.test.mjs',
  './foundational-namedDoc.test.mjs',
  './foundational-snapshot.test.mjs',
  './capabilities.test.mjs',
];

const factories = [
  { label: 'beads', factory: (t) => setupFreshAdapter(t, 'beads') },
];
if (process.env.RUN_CROSS_ADAPTER === '1') {
  // Phase 13 wires this once fork publishes:
  // const { MarkdownAdapter } = await import('get-shit-done-cc/adapter/markdown');
  // factories.push({ label: 'markdown', factory: (t) => setupMarkdownAdapter(t) });
}

for (const file of FILES) {
  const { runConformance } = await import(file);
  for (const f of factories) {
    runConformance(f.factory, f.label);
  }
}
```

```javascript
// tests/conformance/fixture.mjs

// Per-test bd-init from seed.jsonl + tearteown via t.after().
// D-15: setupFreshAdapter() returns { adapter, projectRoot }. Cleanup is
// registered on the test context so failures still clean up.

import { mkdtempSync, mkdirSync, copyFileSync, rmSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../fixtures/seed.jsonl');

export async function setupFreshAdapter(t, kind = 'beads') {
  const root = mkdtempSync(join(tmpdir(), 'gsd-conf-'));
  // Initialize a real git+bd repo from seed.jsonl
  spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  mkdirSync(join(root, '.beads'));
  copyFileSync(SEED, join(root, '.beads/issues.jsonl'));
  const init = spawnSync('bd', ['init', '--from-jsonl', '--prefix', 'sd',
      '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'], {
    cwd: root,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  });
  if (init.status !== 0) {
    throw new Error(`bd init failed: ${init.stderr}`);
  }
  chmodSync(join(root, '.beads'), 0o700);

  // Create .planning/ skeleton for disk-routed tests
  mkdirSync(join(root, '.planning'), { recursive: true });

  t.after(() => rmSync(root, { recursive: true, force: true }));

  if (kind !== 'beads') {
    throw new Error(`unknown adapter kind: ${kind}`);
  }
  const adapter = new BeadsAdapter(root);
  return { adapter, projectRoot: root };
}
```

### Anti-Patterns to Avoid

- **Single-spawn-per-method discipline broken by adding "verify after write" reads.** Bin A writes (`putRecord`, `updateSection`) frequently want a "verify" read-back. Resist; tests assert behavior. ≤2 spawns per public method (D-21).
- **Calling `bd export --json` twice in `listCollection` to filter.** Use the result to derive ALL list outputs in one call. If two listCollection calls happen back-to-back, the caller can be optimized later — the primitive itself stays single-spawn.
- **Assuming `bd q` accepts `-d` (description).** It doesn't. Use `bd create -d <body>` for new bd records with body. `bd q` is title-only. [VERIFIED: bd v1.0.3.]
- **Using `--memories` / `--include-memories` flags on `bd export`.** They don't exist. `bd export --json` includes memories by default; `--no-memories` excludes them. [VERIFIED.]
- **Putting a label on a comment.** `bd comments add` takes only `[issue-id] [text] --author <str> --file <path>`. NO label flag. Use `--author` for the structured slot. [VERIFIED.]
- **Forgetting `--skip-hooks` on `bd init` in the conformance setup.** Without it, bd installs git hooks into the temp project (irrelevant + slow). All seed/setup paths in this repo use `--skip-hooks`.
- **Hand-rolling YAML to support deeply-nested frontmatter.** PLAN.md frontmatter is intentionally flat. If nested objects appear, escalate to gray-matter — but flag the escalation in plan-phase rather than silently expanding the parser.
- **Calling `bd show <id>` to test existence.** With `--json`, it returns `{error, schema_version}` and exits 0; the bd helper translates this into a `BeadsEmpty` throw. `exists()` should catch `BeadsEmpty` and return `false`, not bubble the exception. [VERIFIED via existing src/bd/helper.mjs flow.]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Issue creation with body | Custom JSONL append + auto-export poke | `bd create -d <body>` (or `bd q` then `bd update -d <body>`) | bd's auto-export, deduplication, hash-id generation, and status validation are non-trivial. Going around bd violates REQ-01. |
| Memory key collision tracking | Custom local index | `bd remember --key <k>` overwrite-in-place semantics | Verified live: `bd remember "v2 body" --key "v1.0:decision:..."` updates rather than appends. No additional tracking needed. |
| Memory listing by prefix | Custom JSON walk | `bd memories <prefix-substring> --json` | Verified live: substring search returns matching entries as `{schema_version, <key>: <value>, ...}`. Prefix lookup `bd memories "v1.0:" --json` returns only v1.0-prefixed keys. |
| JSONL parsing | Custom line-by-line parser | Existing `src/bd/helper.mjs` JSONL fallback (lines 47-55) | The bd helper already handles `bd export --json` JSONL output (each line a separate JSON object). Phase 7 just calls `bd(['export','--json','-o',path])` and reads the file separately, OR calls without `-o` and lets the helper parse. |
| Slug uniqueness suffix logic | Custom counter | github-slugger@2.0.0 (only if needed) | github-slugger handles duplicate-anchor disambiguation (`foo`, `foo-1`, `foo-2`). For Phase 7's path-slug addressing, duplicates are LINTED out (D-06 conformance test asserts no duplicate path-slugs in canonical files), so we don't need the counter. |
| Atomic file replace | Custom temp + flush + sync | `writeFileSync(tmp); renameSync(tmp, target)` | POSIX rename is atomic. Same filesystem (target's directory) means no fsync needed for the contract D-08 names. [VERIFIED.] |

**Key insight:** The bd v1.0.3 CLI surface is rich enough that we hand-roll no protocol logic. Every primitive is "translate caller intent → bd command → parse JSON response". The hand-rolled parts (router, slugify, section locator, frontmatter parser) are pure-string transforms with zero dependence on bd or fs.

## Runtime State Inventory

> Phase 7 IS implementation, not refactor. State inventory below documents PRE-EXISTING runtime state Phase 7 must KNOW about — not net-new state to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `tests/fixtures/seed.jsonl` — canonical fixture (37 lines: 11 phases + 24 plans + 2 milestone-heading memories). Phase 7 ENRICHES additively. | Plan-phase scopes the additions: a few sample memories under `<milestone>:<type>:<id>` keys for recordStateEvent fixtures, sample comments authored as `gsd:event:<type>`, sample named-doc records (memory + .md file pair). `build-seed.sh` regenerates byte-identically. |
| Live service config | None — this repo's `.beads/` is fresh, populated only when conformance tests run. Production consumers of the adapter use their own bd stores. | None |
| OS-registered state | None — no Windows tasks, no launchd plists, no pm2 entries reference Phase 7 artifacts. | None |
| Secrets/env vars | `BEADS_ACTOR=seed` is enforced at every bd invocation that affects determinism (D-20). `BEADS_DIR` is the cross-worktree env var (D-22). Both are pre-existing patterns. | None — Phase 7 carries forward exactly. |
| Build artifacts | Phase 6 ARCH-05 stripped binary entries from package.json; no install artifacts to invalidate. `node_modules` rebuilt only if Phase 7 plan-phase decides to add a dep (recommendation: don't). | None unless gray-matter / github-slugger gets added (then `npm install`). |

**Per-cluster artifacts Phase 7 creates** (NOT existing runtime state — listed for the planner's mental model):
- `src/adapter/pathRouter.mjs` (new)
- `src/format/section.mjs` (new — slugify + section locator)
- `src/format/frontmatter.mjs` (new — flat-scalar YAML)
- `tests/conformance/{run,fixture,binA-records,binA-section,binA-frontmatter,foundational-events,foundational-namedDoc,foundational-snapshot,capabilities}.{mjs,test.mjs}` (9 files, all new)
- `src/bd/errors.mjs` ADDS `UnsupportedOperationError` class (~10 lines)
- `src/adapter.mjs` EDITS `BeadsAdapter.capabilities` (add JSDoc rationale comments per `false` value; flag values themselves are unchanged from Phase 6 ship)
- `src/adapter/primitives.mjs` REPLACES every stub body (16 methods)
- `tests/fixtures/seed.jsonl` ENRICHES (one-time additive edit; build-seed.sh updated to match)
- `package.json` MAY edit `scripts.test:conformance` body (Phase 6 already shipped `node --test 'tests/conformance/**/*.test.mjs'`; Phase 7 leaves as-is unless a different invocation surfaces during planning)

## Common Pitfalls

### Pitfall 1: bd comments don't accept labels (D-09 amendment)

**What goes wrong:** D-09 says session/quick_task/forensic_session events are stored as bd comments "labeled `gsd:event:<type>`". Implementer writes `bd comments add <id> "<payload>" --label gsd:event:session` and bd v1.0.3 errors with "unknown flag: --label".

**Why it happens:** `bd comments add` ergonomics in bd v1.0.3 are: `[issue-id] [text] --author <str> --file <path>`. There is NO label-on-comment flag. Labels are an issue-level concept.

**How to avoid:** Use `--author "gsd:event:<type>"` instead. The `author` field is structured, persisted, and round-trips through `bd export --json`. [VERIFIED in research session.]

**Concrete amended pattern:**
```bash
BEADS_ACTOR=seed bd comments add <milestoneBead> --author "gsd:event:session" "<json-payload>"
```

Read-back filter:
```bash
bd comments <milestoneBead> --json | jq '.[] | select(.author == "gsd:event:session")'
```

[CITED: live test 2026-04-30 — `bd comments add test-a8v "session payload here" --author "gsd:event:session"` succeeded; `bd comments test-a8v --json` returned `{author: "gsd:event:session", ...}`; `bd export --json` preserved both fields in the issue's `comments[]` array.]

**Warning signs:** Any task instruction that includes `bd comments add ... --label` is wrong. Plan-phase normalizes to `--author`.

### Pitfall 2: `bd q` doesn't accept `-d` for description

**What goes wrong:** Implementer writes `bd q "title" -t epic -d "body"` to create-with-body. bd errors: `unknown shorthand flag: 'd' in -d`.

**Why it happens:** `bd q` is "Quick capture" — title only, designed for shell scripting. Full creation uses `bd create`. [VERIFIED.]

**How to avoid:** For new records with body, use `bd create -t <type> -p <prio> -d "<body>" "<title>"`. For new records that the test seed-builders use without bodies, `bd q` is correct.

### Pitfall 3: `bd export --memories` does NOT exist

**What goes wrong:** Implementer reads D-11 and writes `bd export --json --memories`. bd errors: `unknown flag: --memories`.

**Why it happens:** D-11's prose-level naming intent is "export with memories included". The actual flag is the OPPOSITE polarity: `--no-memories` to EXCLUDE them; default behavior INCLUDES them. [VERIFIED: `bd export` help output: "Memories (from 'bd remember') are included by default. Use --no-memories to exclude them."]

**How to avoid:** Plain `bd export --json -o <path>` is correct for snapshot. The output prefix message confirms: `"Exported 1 issues and 3 memories to /path"`.

### Pitfall 4: `bd export --json -o /dev/null` errors

**What goes wrong:** Implementer test-runs `bd export --json -o /dev/null` and gets `Error: failed to sync output file: sync /dev/null: invalid argument`.

**Why it happens:** bd calls `fsync()` on the output file; /dev/null doesn't support fsync.

**How to avoid:** Always use a real file path. `mkdtempSync` + `path.join` works. For test discards, use `mkdtempSync` + accept the cleanup cost.

### Pitfall 5: `bd show <missing-id> --json` exits 0 with error JSON

**What goes wrong:** Implementer writes `exists(path)` as "spawnSync bd show; if status === 0 return true". Calls always return true even for missing records.

**Why it happens:** `bd show test-zzz --json` exits 0 (success) but stdout is `{"error": "no issues found matching the provided IDs", "schema_version": 1}`. Without `--json`, exits 1 with stderr. [VERIFIED both branches.]

**How to avoid:** Use the existing `src/bd/helper.mjs:bd()` wrapper — it detects the `{error, schema_version}` shape and throws `BeadsEmpty`. `exists()` becomes:
```javascript
async exists(path) {
  const route = pathRouter.resolve(path);
  if (route.tier === 'disk') return existsSync(this._absolute(path));
  if (route.tier === 'bd') {
    try {
      bd([...route.toShowArgs(path)]);
      return true;
    } catch (err) {
      if (err instanceof BeadsEmpty) return false;
      throw err;
    }
  }
}
```

### Pitfall 6: Forgetting `chmod 700 .beads` after restore

**What goes wrong:** After `bd init --from-jsonl`, every bd command emits `Warning: /path/.beads has permissions 0755 (recommended: 0700).`. The warning bleeds into stdout/stderr for every test, polluting JSON parses.

**Why it happens:** `bd init --from-jsonl` creates `.beads/` with the umask default (0755). bd warns on permissions ≠ 0700 on every subsequent invocation.

**How to avoid:** Always `chmodSync(join(root, '.beads'), 0o700)` immediately after `bd init`. Already done in `tests/fixtures/build-seed.sh` (Phase 6 carry-forward); replicate in `tests/conformance/fixture.mjs:setupFreshAdapter()`. [VERIFIED: warning gone after chmod.]

### Pitfall 7: Atomic-rename across filesystems

**What goes wrong:** Implementer puts the tmpfile in `os.tmpdir()` (often `/tmp`, a tmpfs) and renames to `/home/.../`. `EXDEV: cross-device link not permitted`.

**Why it happens:** POSIX `rename(2)` is atomic only within a single filesystem.

**How to avoid:** Always create the tmpfile NEXT TO the target (same directory). Pattern 3 above does this: `resolve(dirname(absPath), \`.\${basename(absPath)}.tmp.\${pid}.\${time}\`)`.

### Pitfall 8: Section parser hits a `# heading` inside a code fence

**What goes wrong:** A markdown file contains a code fence with `\`\`\`bash\n# this is bash, not a heading\n\`\`\``. The hand-rolled section parser slugs `'this-is-bash-not-a-heading'` and now thinks the document has a heading inside the fence.

**Why it happens:** Lines-based parsing without code-fence tracking.

**How to avoid:** Track open code fences in the parser loop. A simple state machine adds 4 lines:
```javascript
let inFence = false;
for (let i = 0; i < lines.length; i++) {
  if (/^```/.test(lines[i])) { inFence = !inFence; continue; }
  if (inFence) continue;
  // ... heading detection as before
}
```
Phase 7 plan-phase MUST include this guard. Conformance fixture should include a code-fence-with-pseudo-heading test case.

### Pitfall 9: bd export auto-throttle (60s) breaks conformance test isolation

**What goes wrong:** Phase 7 conformance test mutates state via `bd update`, then calls `adapter.snapshot()` (which runs `bd export`). The auto-export from the previous mutation hasn't fired yet (60s throttle), so the snapshot might miss the latest write.

**Why it happens:** bd auto-exports `.beads/issues.jsonl` after every write, but throttles to once per 60s. `bd export` IS NOT auto-export; it's explicit and not throttled. So snapshot is fine. The pitfall is the OPPOSITE direction: tests that READ `.beads/issues.jsonl` directly (not via `bd export`) might miss writes.

**How to avoid:** Always go through `bd export --json` for snapshot. Never read `.beads/issues.jsonl` directly in tests. [DOCUMENTED in spike-findings storage-and-distribution.md.]

### Pitfall 10: `BEADS_ACTOR` leak from environment

**What goes wrong:** Developer's local env has `BEADS_ACTOR=elliott`. Tests inherit it. `bd export --json` records `created_by: "elliott"` instead of `seed`. seed.jsonl regeneration breaks CONF-03 byte-identity.

**Why it happens:** spawnSync inherits `process.env` by default.

**How to avoid:** Every bd invocation in conformance fixture + build-seed.sh sets `env: { ...process.env, BEADS_ACTOR: 'seed' }` explicitly. Pattern is already used in `tests/fixtures/build-seed.sh` (D-20 carry-forward); replicate verbatim in `tests/conformance/fixture.mjs`.

## Code Examples

Verified patterns from official sources or live tests in this research session.

### Section locator with code-fence guard

```javascript
// src/format/section.mjs

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^```/;

export function locateSection(text, anchor) {
  const target = anchor.replace(/^\/+/, '').split('/').filter(Boolean);
  if (!target.length) return null;
  const lines = text.split('\n');
  const stack = [];
  let inFence = false;
  let foundLine = -1, foundLevel = -1;

  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = HEADING_RE.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    stack.length = level;
    stack[level - 1] = slugify(m[2]);
    const path = stack.slice(0, level).filter(Boolean);
    if (path.length === target.length && path.every((p, idx) => p === target[idx])) {
      foundLine = i;
      foundLevel = level;
      break;
    }
  }
  if (foundLine === -1) return null;

  let bodyEnd = lines.length;
  inFence = false;
  for (let j = foundLine + 1; j < lines.length; j++) {
    if (FENCE_RE.test(lines[j])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = HEADING_RE.exec(lines[j]);
    if (m && m[1].length <= foundLevel) { bodyEnd = j; break; }
  }
  return {
    headingLine: foundLine,
    headingLevel: foundLevel,
    bodyStart: foundLine + 1,
    bodyEnd,
    bodyText: lines.slice(foundLine + 1, bodyEnd).join('\n'),
  };
}
```

### UnsupportedOperationError class

```javascript
// src/bd/errors.mjs (add to existing file)

export class UnsupportedOperationError extends BeadsUnavailableError {
  /**
   * @param {string} method     adapter method name
   * @param {string} flag       capabilities flag name (e.g., 'binaryAsset')
   * @param {string} [hint]     guidance for caller
   */
  constructor(method, flag, hint = '') {
    const msg = `BeadsAdapter.${method}: not supported (capabilities.${flag}=false).${hint ? ' ' + hint : ''}`;
    super(msg, { cause: BeadsCause.Unknown });
    this.name = 'UnsupportedOperationError';
    this.method = method;
    this.flag = flag;
  }
}
```

[Source: derived from existing class hierarchy in `src/bd/errors.mjs:18-55`. The constructor signature follows D-16's required throw-message format verbatim.]

### writeBinaryAsset implementation

```javascript
// inside primitives.mjs
import { UnsupportedOperationError } from '../bd/errors.mjs';

async writeBinaryAsset(path, bytes) {
  throw new UnsupportedOperationError(
    'writeBinaryAsset',
    'binaryAsset',
    'bd does not store binaries natively. Configure an external sink in v1.1.'
  );
}
```

### Frontmatter synthesis (bd-routed) and parsing (disk-routed)

```javascript
// src/format/frontmatter.mjs

/**
 * Parse YAML frontmatter limited to flat scalars + flat lists.
 * Returns { frontmatter, body } where frontmatter is `null` when absent.
 *
 * Supported:
 *   key: scalar
 *   key: "quoted scalar"
 *   key: 'single-quoted'
 *   key: 123
 *   key: true
 *   key:
 *     - item one
 *     - item two
 *
 * NOT supported (escalate to gray-matter when these arrive):
 *   nested objects
 *   block scalars (| or >)
 *   anchors / aliases
 *   inline JSON (`key: { a: 1 }`)
 */
export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) return { frontmatter: null, body: text };
  const fm = {};
  const lines = m[1].split('\n');
  let currentKey = null;
  let currentList = null;
  for (const line of lines) {
    const listItem = /^\s+-\s+(.+)$/.exec(line);
    if (listItem && currentKey && currentList) {
      currentList.push(coerce(listItem[1].trim()));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === '') {
      // List header
      currentKey = k;
      currentList = [];
      fm[k] = currentList;
    } else {
      fm[k] = coerce(v);
      currentKey = null;
      currentList = null;
    }
  }
  return { frontmatter: fm, body: m[2] };
}

function coerce(v) {
  if (/^("|').*\1$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  return v;
}

export function formatFrontmatter(fm, body) {
  if (!fm || !Object.keys(fm).length) return body;
  const out = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      out.push(`${k}:`);
      for (const item of v) out.push(`  - ${item}`);
    } else {
      out.push(`${k}: ${v}`);
    }
  }
  out.push('---', '');
  return out.join('\n') + body;
}
```

### Bd-routed frontmatter synthesis

```javascript
// inside primitives.mjs

/**
 * For a bd-routed path, synthesize a flat frontmatter object from the
 * record's labels + metadata. Reverse map: bd labels of the form
 * `<key>:<value>` become {key: value}; bare labels become flags.
 *
 * Examples:
 *   labels: ['gsd:phase', 'phase-id:07', 'version:v1.0', 'status:ready']
 *   →
 *   { gsd: 'phase', phase_id: '07', version: 'v1.0', status: 'ready' }
 *   (with the convention: bd uses ':', frontmatter uses '_' for keys)
 */
function labelsToFrontmatter(issue) {
  const fm = { id: issue.id, status: issue.status };
  for (const label of issue.labels ?? []) {
    const [k, ...rest] = label.split(':');
    if (rest.length === 0) {
      // bare label — flag
      fm[k] = true;
    } else {
      fm[k.replace(/-/g, '_')] = rest.join(':');
    }
  }
  return fm;
}

async getFrontmatter(path, field) {
  const route = pathRouter.resolve(path);
  if (route.tier === 'disk') {
    const text = readFileSync(this._absolute(path), 'utf-8');
    const { frontmatter } = parseFrontmatter(text);
    if (!frontmatter) return field ? undefined : {};
    return field ? frontmatter[field] : frontmatter;
  }
  // bd-routed: query the issue, derive flat object from labels
  this._ensureBd();
  const issue = await this._bdShow(path);   // wraps bd show <id> --json
  const fm = labelsToFrontmatter(issue);
  return field ? fm[field] : fm;
}

async updateFrontmatter(path, field, value) {
  const route = pathRouter.resolve(path);
  if (route.tier === 'disk') {
    const abs = this._absolute(path);
    const text = readFileSync(abs, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(text);
    const fm = { ...(frontmatter ?? {}), [field]: value };
    atomicWriteFile(abs, formatFrontmatter(fm, body));
    return;
  }
  // bd-routed: convert (field, value) to a label rewrite.
  // Labels of the form `<field>:*` are removed; new label `<field>:<value>` is added.
  this._ensureBd();
  const issue = await this._bdShow(path);
  const existing = (issue.labels ?? []).filter(l => l.startsWith(`${field}:`));
  for (const old of existing) {
    bd(['label', 'remove', issue.id, old], { env: { ...process.env, BEADS_ACTOR: 'seed' }, parseJson: false });
  }
  if (value !== undefined && value !== null) {
    bd(['label', 'add', issue.id, `${field}:${value}`], { env: { ...process.env, BEADS_ACTOR: 'seed' }, parseJson: false });
  }
}
```

[NOTE: this design takes 2-3 bd spawns for `updateFrontmatter` on bd-routed paths (`bd show` + `bd label remove` + `bd label add`). D-21 says ≤2 spawns per public method invocation. Plan-phase reconciles: either (a) cache the labels list inside `_bdShow` so subsequent calls in the same invocation are free, or (b) accept up to 3 spawns specifically for label-rewrite operations and bump the QUAL-07 budget for that subset, or (c) cache via passing the issue object explicitly. **Recommendation:** option (c) — `updateFrontmatter` internally calls `getFrontmatter` first (1 spawn for `bd show`), computes the diff, and emits only `bd label add` for new value (1 spawn) — skip the remove if value IS the same. For the "change to a different value" case, use `bd label remove` then `bd label add` (2 spawns plus the read = 3). Plan-phase confirms.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--memories` / `--include-memories` flag (assumed in D-11) | Default-include + `--no-memories` to exclude | bd v1.0.3 ships this polarity | D-11's prose-level naming corrected to "default-include"; no behavior change |
| Comments labeled `gsd:event:<type>` (CONTEXT D-09 wording) | Comments authored as `gsd:event:<type>` | bd v1.0.3 doesn't support comment labels | D-09 amendment: use `--author` instead of `--label` |
| `bd q` for full creation | `bd q` for title-only quick capture; `bd create` for body | bd v1.0.3 — bd q intentionally minimized | Use `bd create -d <body>` when a body is needed |
| Single fence-unaware regex section locator | Fence-aware state-machine | Current best practice | Avoids false positives on `# bash comments` inside ```bash blocks |
| Add gray-matter for any frontmatter | Hand-roll for flat-scalar; escalate to gray-matter on demand | This research's tradeoff analysis | Zero new deps in Phase 7 unless plan-phase elects otherwise |

**Deprecated/outdated:**
- node:test `describe.each`: doesn't exist; not in any current Node release. Use a JS-level for-loop wrapping `describe()`. [VERIFIED via [nodejs/node#47902](https://github.com/nodejs/node/issues/47902).]
- `bd dolt push` for cross-worktree sync: explicitly rejected by spike findings; same-machine multi-worktree is automatic via shared `BEADS_DIR`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hand-rolled flat-scalar YAML parser is sufficient for all current PLAN.md / .planning/* frontmatter | Frontmatter parsing | If a nested-object frontmatter appears (would surprise — current corpus is 100% flat), `parseFrontmatter` silently drops nested keys. Mitigation: conformance lint test enumerates current frontmatter shapes and asserts the parser handles all of them. If the lint catches an unsupported shape, escalate to gray-matter. |
| A2 | The current GSD heading vocabulary is 100% ASCII English | slugify | Wrong → some headings round-trip to empty slugs (e.g., a Cyrillic-only heading becomes ''). Mitigation: conformance lint test asserts slugify(heading) is non-empty for every heading in the canonical corpus. If a non-empty failure appears, escalate to github-slugger@2. [Likely correct; spot-check of `.planning/` shows only ASCII English.] |
| A3 | bd's `comments[]` array in `bd export --json` preserves the `author` field exactly | recordStateEvent comment dispatch | [VERIFIED in research session — `bd export --json` output included `{author: "gsd:event:session", text: "...", created_at: "..."}`.] |
| A4 | `bd init --from-jsonl --prefix sd --skip-hooks` in a fresh tmpdir without an existing git repo will succeed | Snapshot/restore conformance | [VERIFIED: ran `git init -q` then `bd init --from-jsonl ...` in a tmpdir successfully. The skip-hooks flag avoids hook-install side effects.] |
| A5 | `BeadsAdapter.capabilities` access does NOT require the adapter to be constructed against a beads-managed project | Capabilities flag (CAP-01 SC#1) | The flag is a static class property (`Object.freeze` on the class object). [VERIFIED: `BeadsAdapter.capabilities` is set on the class itself in `src/adapter.mjs:53-61`, NOT on `prototype` or instances. Static access works without instantiation.] |
| A6 | The current `seed.jsonl` enrichment surface is small (a few memories + a few comments + a few named-doc disk records) | Phase 7 seed enrichment scope | Plan-phase determines exact additions. The fixture today has 33 issues + 2 memories. Adding 5-10 memories + 3-5 comments + 3-5 named-doc records keeps the fixture readable + complete. |
| A7 | Hand-rolled section locator with code-fence guard handles all canonical .planning/* markdown variants | getSection/updateSection conformance | Mitigation: conformance includes a fixture with a code-fence-containing-pseudo-heading and asserts the parser doesn't match it. |

## Open Questions

1. **D-09 amendment: comments labeled vs authored as `gsd:event:<type>`**
   - What we know: bd v1.0.3 `bd comments add` does NOT accept a label flag. The closest structured slot is `--author`.
   - What's unclear: Whether the user prefers (a) keep the design-level "label" intent and emulate it (e.g., prefix the comment text with `[gsd:event:session]` then strip on read), or (b) accept the mechanical reality and amend D-09 to "authored as".
   - Recommendation: (b). The `author` field is just as filterable, just as round-trippable, and avoids the parsing tax. Plan-phase or discuss-phase confirms with the user before implementation.

2. **`updateFrontmatter` on bd-routed paths exceeds QUAL-07 budget**
   - What we know: Changing a label-encoded field requires `bd show` + `bd label remove` + `bd label add` = 3 spawns. D-21 says ≤2 per public method invocation.
   - What's unclear: Whether to (a) cache labels at the start of the call so the read costs zero (still 3 spawns total), (b) bump QUAL-07 to ≤3 specifically for label-rewrite, or (c) accept that QUAL-07 applies to "READ" methods primarily and writes are exempt.
   - Recommendation: (c) is most defensible — QUAL-07's stated rationale (REQ-QUAL-07: "performance budget for read fan-out") is read-side. Plan-phase confirms or escalates to a fresh decision.

3. **`tests/fixtures/seed.jsonl` enrichment scope**
   - What we know: Phase 7 needs at least: a few memories under `<milestone>:<type>:<id>` keys, a few comments authored as `gsd:event:<type>`, a few sample named-doc records.
   - What's unclear: How many of each. Conformance per primitive needs ≥1 happy-path fixture; for `recordStateEvent`'s 10 types that's 10 fixtures. Plan-phase decides whether to: (a) seed all 10 in `seed.jsonl` (canonical state grows by 10 entries) or (b) seed a representative subset (3-5) and have the conformance test mutate-then-read for the rest.
   - Recommendation: (b). seed.jsonl stays small + readable; conformance write-then-read covers each type from a clean baseline.

4. **`commitPlanningState` no-op behavior**
   - What we know: D-16 + CAP-01 lock `capabilities.commitPlanningState = false`. The phase boundary says "method is a no-op (or thin throw) at this phase."
   - What's unclear: No-op (silently succeed; harmless) vs throw (consumers checking the flag are required to skip). The phase boundary leans no-op; Phase 13 finalizes.
   - Recommendation: Throw `UnsupportedOperationError` to be consistent with `writeBinaryAsset` (also flag=false). A consumer that DOES call without checking the flag is a bug; making it loud now prevents shipping a broken consumer.

5. **`describe.each` parameterization — exact node:test idiom**
   - What we know: node:test has no native describe.each. The plain-JS for-loop pattern works.
   - What's unclear: Whether the test labels surface usefully in `node --test` output. Different test reporters render `describe('...[label]')` differently.
   - Recommendation: Use `describe(\`<cluster> [\${label}]\`, () => {...})` and verify the default reporter shows them clearly. If the labels collapse, switch to `test('[\${label}] cluster.method behavior', ...)` at the test level.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` (beads CLI) | Every primitive that touches bd | ✓ | v1.0.3 (1b2dd2cb) | None — required at runtime |
| Node ≥20 | Adapter library + tests | ✓ | v24.14.0 | None |
| `git` | bd init pre-req (looks for .git) | ✓ | system git | None |
| `gray-matter` | OPTIONAL (frontmatter escalation) | ✗ | 4.0.3 latest | Hand-rolled flat-scalar parser |
| `js-yaml` | OPTIONAL (transitive of gray-matter) | ✗ | 4.1.1 latest | Hand-rolled |
| `github-slugger` | OPTIONAL (Unicode slug escalation) | ✗ | 2.0.0 latest | Hand-rolled ASCII slugify |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `gray-matter`, `js-yaml`, `github-slugger` — all OPTIONAL. Phase 7 hand-rolls each unless plan-phase elects otherwise.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` built-in (Node 24.14.0) |
| Config file | none — invoked via `node --test <pattern>` |
| Quick run command | `npm run test:conformance` (already in package.json: `node --test 'tests/conformance/**/*.test.mjs'`) |
| Full suite command | `npm test` (runs `tests/unit/**` + `tests/conformance/**`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | `BeadsAdapter.capabilities` is a frozen object with the exact 7-key shape; reading does not require construction | unit (conformance) | `node --test tests/conformance/capabilities.test.mjs` | ❌ Wave 0 |
| CAP-01 | Each `false` value has a JSDoc rationale comment in source | lint (test) | grep-test in `tests/conformance/capabilities.test.mjs` checks `src/adapter.mjs` source | ❌ Wave 0 |
| PRIM-01 | getRecord/putRecord/removeRecord round-trip on disk-routed | unit (conformance) | `node --test tests/conformance/binA-records.test.mjs` | ❌ Wave 0 |
| PRIM-01 | getRecord/putRecord/removeRecord on bd-routed (creates / updates / removes bd record) | unit (conformance) | same | ❌ Wave 0 |
| PRIM-01 | listCollection sorts deterministically; `listCollection('.planning/phases')` returns phase-id ordering | unit (conformance) | same | ❌ Wave 0 |
| PRIM-01 | exists returns false for missing, true for present | unit (conformance) | same | ❌ Wave 0 |
| PRIM-01 | getSection/updateSection × 3 modes on disk-routed PLAN.md | unit (conformance) | `node --test tests/conformance/binA-section.test.mjs` | ❌ Wave 0 |
| PRIM-01 | getFrontmatter/updateFrontmatter on bd-routed (label synthesis) and disk-routed (yaml parse) | unit (conformance) | `node --test tests/conformance/binA-frontmatter.test.mjs` | ❌ Wave 0 |
| PRIM-02 | recordStateEvent dispatches all 10 types correctly (memories for 7, comments for 3) | unit (conformance) | `node --test tests/conformance/foundational-events.test.mjs` | ❌ Wave 0 |
| PRIM-02 | snapshot()/restore() round-trips bd issues + memories + comments | unit (conformance) | `node --test tests/conformance/foundational-snapshot.test.mjs` | ❌ Wave 0 |
| PRIM-02 | putNamedDoc writes BOTH disk + bd memory index; getNamedDoc reads disk | unit (conformance) | `node --test tests/conformance/foundational-namedDoc.test.mjs` | ❌ Wave 0 |
| PRIM-02 | writeBinaryAsset throws UnsupportedOperationError | unit (conformance) | `node --test tests/conformance/capabilities.test.mjs` (or in foundational suite) | ❌ Wave 0 |
| CONF-01 | Conformance harness runs against BeadsAdapter standalone using seed.jsonl | integration | `npm run test:conformance` | ❌ Wave 0 (harness scaffold) |
| CONF-01 | Cross-adapter pairing point exists (RUN_CROSS_ADAPTER=1 toggles it; no fork dep at this phase) | structure-only | grep-test that `tests/conformance/run.mjs` references `RUN_CROSS_ADAPTER` | ❌ Wave 0 |
| CONF-02 | parsePhaseTitle / formatPhaseTitle round-trip for all canonical inputs | unit | existing `tests/unit/format-phase.test.mjs` | ✅ (Phase 6) |
| CONF-02 | parsePhaseDescription / formatPhaseDescription round-trip for all 11 fixtures | unit | same | ✅ (Phase 6, 11 fixtures) |
| CONF-02 | All canonical inputs called out in ROADMAP §"Phase 7 SC#5" pass | unit | same; Phase 7 verifies coverage and ADDS fixtures for any gap | partial — Phase 7 audits |

### Sampling Rate

- **Per task commit:** `npm run test:conformance` (~3-5s on a hot bd; ~6-10s with bd init from JSONL per test). Each conformance file is independently runnable.
- **Per wave merge:** `npm test` (unit + conformance).
- **Phase gate:** All seven conformance files green + format-phase tests green + every existing Phase 6 test green.

### Wave 0 Gaps

- [ ] `tests/conformance/run.mjs` — driver invokes each runConformance with BeadsAdapter factory; gates RUN_CROSS_ADAPTER=1
- [ ] `tests/conformance/fixture.mjs` — `setupFreshAdapter(t, kind)` returns `{adapter, projectRoot}`; uses mkdtempSync + t.after()
- [ ] `tests/conformance/binA-records.test.mjs` — exports `runConformance(makeAdapter, label)`; covers getRecord, putRecord, removeRecord, exists, listCollection
- [ ] `tests/conformance/binA-section.test.mjs` — covers getSection, updateSection × 3 modes, with path-slug examples
- [ ] `tests/conformance/binA-frontmatter.test.mjs` — covers getFrontmatter, updateFrontmatter, mergeFrontmatter on BOTH bd-routed and disk-routed
- [ ] `tests/conformance/foundational-events.test.mjs` — write+read for each of 10 recordStateEvent types
- [ ] `tests/conformance/foundational-namedDoc.test.mjs` — putNamedDoc per category, getNamedDoc, mem-index assertion
- [ ] `tests/conformance/foundational-snapshot.test.mjs` — snapshot → mutate → restore → re-read (issues + memories + comments)
- [ ] `tests/conformance/capabilities.test.mjs` — flag shape lint, JSDoc rationale lint, writeBinaryAsset throw assertion

## Sources

### Primary (HIGH confidence — verified live in this research session)

- **bd v1.0.3 CLI** — verified live: `bd version 1.0.3 (1b2dd2cb)`. All flag verifications below ran in tmpdir bd stores via `mkdtempSync` + `bd init --non-interactive --skip-agents --skip-hooks --quiet -p test`.
  - `bd export --help` — confirmed default-include-memories + `--no-memories` flag
  - `bd init --help` — confirmed `--from-jsonl`, `--prefix`, `--non-interactive`, `--skip-agents`, `--skip-hooks`
  - `bd label add/remove --help` — confirmed `[issue-id...] [label]` arg shape
  - `bd comments add --help` — confirmed `--author`, `--file`, `--stdin`; NO `--label` flag
  - `bd update --help` — confirmed `--description`, `--body-file -`, `--title`, `--status`, `--priority`, `--append-notes`
  - `bd remember --help` — confirmed `--key` flag with overwrite-in-place semantics
  - `bd list --help` — confirmed `-l/--label`, `-n/--limit`, `--label-any`, `--label-pattern`, `--no-pager`
  - `bd show --json` — confirmed JSON shape and that missing IDs return `{error, schema_version}` JSON (exit 0)
  - Live snapshot/restore round-trip — `bd export --json -o /path/snap.jsonl` + fresh `bd init --from-jsonl --prefix sd --non-interactive --skip-agents --skip-hooks` preserved 1 issue + 3 memories + 1 comment with author field intact
- **Node 24.14.0 fs / child_process** — verified `writeFileSync`+`renameSync` atomic-replace works; `spawnSync` with `BEADS_ACTOR=seed` env override works for multi-line markdown bodies via `-d` flag

### Secondary (MEDIUM confidence — official docs / canonical references)

- **node:test runtime spec** — [Test runner | Node.js v25.9.0 Documentation](https://nodejs.org/api/test.html) — confirms `t.after(fn)` cleanup hook (used Phase 5 forward) and `describe()` / `test()` shape
- **node:test parameterization gap** — [test-runner: Parameterized tests · nodejs/node#47902](https://github.com/nodejs/node/issues/47902) — confirms `describe.each` is NOT yet in node:test
- **github-slugger algorithm** — [Flet/github-slugger](https://github.com/Flet/github-slugger) + [npm](https://www.npmjs.com/package/github-slugger) — confirms lowercase + strip-non-word + collapse-hyphens base algorithm; full Unicode regex available in [regex.js](https://github.com/Flet/github-slugger/blob/master/regex.js) if escalation needed
- **CommonMark §4.2 ATX headings** — [commonmark.org](https://spec.commonmark.org/) — confirms `^#{1,6}\s+...$` pattern; trailing # decoration optional
- **POSIX rename(2) atomicity** — [POSIX.1-2017 rename](https://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html) — atomic if source and dest on same filesystem
- **gsd-beads spike findings** — `.claude/skills/spike-findings-gsd-beads/SKILL.md` + `references/beads-modeling.md` + `references/storage-and-distribution.md` — non-negotiable bd modeling decisions (all-epic + labels, BEADS_ACTOR=seed, hash-id uniqueness validated under load, JSONL roundtrip preserves all fields)
- **`.planning/research/fork-investigation/SYNTHESIS.md`** §4 — Bin A signatures (lines 145-168), foundational primitives table (lines 518-533), Bin B catalog (lines 175-509). Canonical adapter method shape; D-2026-04-30-06 locks SYNTHESIS as authoritative.
- **`.planning/DECISIONS.md` D-2026-04-30-05** — capabilities flag shape contract (7-key boolean object); flag shape is fixed, only boolean values move
- **`.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md`** — Phase 6 D-01..D-24 carry-forward (Object.assign cluster binding, lazy `_ensureBd()`, frozen capabilities placeholder, BEADS_ACTOR=seed discipline)

### Tertiary (LOW confidence — unverified or training-knowledge)

- **gray-matter / js-yaml package shapes** — versions verified via `npm view`, but per-feature behavior NOT verified live in this session (we recommend hand-rolling instead, so the API shape isn't on the critical path)

## Metadata

**Confidence breakdown:**
- bd CLI flags + behavior: HIGH — every flag was verified live in tmpdir bd stores in this research session
- Conformance harness pattern: HIGH — node:test gap is documented in Node's own issue tracker; the JS-loop workaround is well-known
- Section parser approach: HIGH — algorithm is straightforward; code-fence guard handles the one tricky case
- Slugify approach: MEDIUM — hand-rolled is correct for ASCII English; if non-ASCII headings appear, escalate. Phase 7 conformance lint catches the issue early.
- Frontmatter parser approach: MEDIUM — flat-scalar is correct for current PLAN.md schema; Phase 7 plan must include a lint that catches nested-shape escapes.
- Snapshot/restore round-trip: HIGH — full round-trip (issues + memories + comments) verified live, byte-for-content
- D-09 amendment (comments authored as vs labeled): HIGH — direct CLI verification

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (bd v1.0.x stable; Node 24 LTS line stable). Re-verify if bd ships a major version that changes `comments add` ergonomics or if Node ships native `describe.each` to node:test.
