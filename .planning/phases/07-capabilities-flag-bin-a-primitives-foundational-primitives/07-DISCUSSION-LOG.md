# Phase 7: Capabilities flag + Bin A primitives + foundational primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 07-capabilities-flag-bin-a-primitives-foundational-primitives
**Areas discussed:** Bin A path routing & frontmatter, Section anchor vocabulary, Bd storage shapes (events, named docs, snapshot), Conformance harness + capabilities flag

---

## Bin A path routing & frontmatter

### Q1: How does the adapter decide bd-query vs disk pass-through for a given path string in Bin A primitives?

| Option | Description | Selected |
|--------|-------------|----------|
| Closed-enum routing table | A `src/adapter/pathRouter.mjs` constants module holds a frozen registry mapping path patterns to bd-shapes. Anything not matched falls through to disk. Explicit, greppable, conformance enumerates the registry. | ✓ |
| Path-pattern allowlist (regex) | Single allowlist regex; matches → bd, misses → disk. Simpler but loses per-path bd-shape information. | |
| Virtual-path scheme | Adapter accepts virtual addresses like `bd:phases/06`. Caller picks the scheme. Forces translation in every existing GSD workflow. | |
| Method-level dispatch | Each method takes `{source: 'bd'\|'disk'}` parameter. Muddies the contract. | |

**User's choice:** Closed-enum routing table (Recommended)
**Notes:** Becomes D-01. Router is the single point of dispatch — every Bin A method starts by resolving the path through it.

### Q2: What path form does the routing registry key on, and what do callers pass?

| Option | Description | Selected |
|--------|-------------|----------|
| Repo-relative | Registry keys are repo-relative paths matching existing convention. Adapter joins to projectRoot internally. | ✓ |
| Absolute paths | Adapter requires absolute paths from callers. Verbose conformance. | |
| Both accepted (normalize at boundary) | Adapter normalizes both forms. Forgiving but hides bugs. | |

**User's choice:** Repo-relative (Recommended)
**Notes:** Becomes D-02. Matches spike-findings, REQUIREMENTS.md, helpers, Phase 5 read handlers — all use repo-relative.

### Q3: What does getFrontmatter(path)/updateFrontmatter/mergeFrontmatter return for a path that routes to a bd record (no markdown frontmatter exists)?

| Option | Description | Selected |
|--------|-------------|----------|
| Synthesize from bd labels | Returns object derived from record's bd labels and metadata. Updates mutate via `bd label add/remove`. Limit to flat string/boolean values. | ✓ |
| Throw 'frontmatter not applicable on bd records' | Forces every Bin B caller to handle the case explicitly. | |
| Return null / no-op | Silent; can't distinguish 'no FM' from 'FM doesn't apply'. | |
| Defer (Phase 8 decides) | Phase 7 only implements for disk-routed paths; bd-routed throws not-implemented. | |

**User's choice:** Synthesize from bd labels (Recommended)
**Notes:** Becomes D-03. Many Bin B callers (`phasePlanIndex`) generalize across both routes — synthesizing avoids forcing branch on routing decision.

### Q4: How does listCollection(prefix, filter?) behave — what does 'collection' mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Routing table decides per-prefix | Same closed-enum router applies. bd-routed → `bd list -l <label>`; disk-routed → fs.readdir. Filter maps to additional bd labels or predicate filtering. | ✓ |
| Always disk + bd-back overlay | Disk first; assert bd matches; warn on drift. Slow; behavior is 'check drift', not 'list collection'. | |
| Two methods | Split into `listCollection` (disk) and `listBdCollection` (bd). Deviates from SYNTHESIS §4 single signature. | |

**User's choice:** Routing table decides per-prefix (Recommended)
**Notes:** Becomes D-04. ≤2 bd spawns per call (QUAL-07 carry-forward).

---

## Section anchor vocabulary

### Q1: What is the `anchor` parameter — how do callers address a section?

| Option | Description | Selected |
|--------|-------------|----------|
| Heading slug | Lowercase hyphen-separated slug derived from heading text via documented `slugify()` helper. Stable across heading-text edits if slug unchanged. | ✓ |
| Verbatim heading text | Anchor is exact heading text including markdown level. Brittle to edits. | |
| Explicit section ID via HTML comment | `<!-- section: decisions -->` markers. Forces migration of every GSD markdown file. | |
| XML-like semantic blocks | `<decisions>...</decisions>` wrapper present in template files. Only some files use the convention; needs a fallback. | |

**User's choice:** Heading slug (Recommended)
**Notes:** Becomes D-05. Matches GitHub/markdown convention; greppable as identifiers.

### Q2: How does the slug-anchor handle heading levels (H2 vs H3) and duplicate slugs within a file?

| Option | Description | Selected |
|--------|-------------|----------|
| First match wins; level-agnostic | Anchor matches first occurrence in document order. Lint test fails on duplicates. | |
| Path-slug always | Anchor is slash-separated path of slugs from H1 down. Unambiguous everywhere; verbose for common case. | ✓ |
| Throw on duplicates | Surprises authors at runtime instead of lint time. | |

**User's choice:** Path-slug always
**Notes:** Becomes D-06. User chose more rigorous addressing over recommendation; verbose-for-common-case is the explicit trade-off.

### Q3: updateSection has mode: 'overwrite' | 'append' | 'prepend'. What are the exact boundary semantics for each mode at the section level?

| Option | Description | Selected |
|--------|-------------|----------|
| Body-replace within heading bounds | Section bounds = content between addressed heading and next sibling-or-shallower heading. Heading line itself NEVER touched. Mirrors mdast convention. | ✓ |
| Whole-section replace including heading | Overwrite replaces heading+body. Complicates path-slug stability when callers rewrite headings. | |
| Body-replace with forced blank lines | Append adds leading blank; prepend adds trailing blank. Subtly mutates content; breaks Debug Evidence idempotent appends. | |

**User's choice:** Body-replace within heading bounds (Recommended)
**Notes:** Becomes D-07.

### Q4: AI-SPEC three-author concurrency contract (OQ-09 / Phase 10 SC#3): three sequential updateSection calls to different sections in the same AI-SPEC.md file must each preserve sibling sections. What atomicity model does Phase 7's updateSection guarantee?

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic file replace per call | read → AST → rewrite → tmpfile + rename. POSIX rename atomicity serializes concurrent processes. | ✓ |
| File-level lockfile | NFS-grade concern; doesn't apply to single-developer + Claude single-process model. | |
| No atomicity; document 'caller serializes' | Lose-update under concurrent invocation; defers OQ-09 to consumers. | |

**User's choice:** Atomic file replace per call (Recommended)
**Notes:** Becomes D-08.

---

## Bd storage shapes (events, named docs, snapshot)

### Q1: recordStateEvent({type, payload}) — storage policy across 10 event types?

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly memories, sessions/quick_task as comments | Default: bd remember under `<milestone>:<type>:<id>`. Exceptions: session/quick_task/forensic_session → comments on milestone bead with `gsd:event:<type>` label. | ✓ |
| Uniform: all memories | Single read path; bloats memory store under high-frequency types. | |
| Uniform: all typed sub-beads | Pollutes `bd ready`; conflates state event with work item. | |
| Defer per-type to Phase 9 | Phase 7 only wires decision + roadmap_evolution. Weakens Phase 7 SC#3. | |

**User's choice:** Mostly memories, sessions/quick_task as comments (Recommended)
**Notes:** Becomes D-09. High-frequency append types (session, quick_task, forensic_session) go to comments; the other 7 types use memories.

### Q2: putNamedDoc(category, key, body) / getNamedDoc(category, key) over closed-enum categories — where do bodies live?

| Option | Description | Selected |
|--------|-------------|----------|
| Disk under .planning/<category>/<key>.md | Body stays a real markdown file (REQ-07 narrative carve-out). Parallel bd memory `gsd-beads:named-doc:<category>:<key>` records existence + last-write timestamp. | ✓ |
| Bd memories (body inline) | Loses file-readability; bodies aren't sized for memory values. | |
| Typed sub-beads with body in description | Pollutes `bd ready` / `bd list` with non-work artifacts. | |

**User's choice:** Disk under .planning/<category>/<key>.md (Recommended)
**Notes:** Becomes D-10. Initial enum: intel, codebase, research, archived-milestone, debug-knowledge-base, learnings, methodology, discussion-log, discovery (plan-phase finalizes against SYNTHESIS §4).

### Q3: snapshot()/restore() — what does Phase 7's snapshot capture?

| Option | Description | Selected |
|--------|-------------|----------|
| Bd JSONL + memories only | `bd export --json --memories` to tmp file; restore via `bd init --from-jsonl` with BEADS_ACTOR=seed. Disk-routed records NOT snapshotted; consumers cp -r .planning/ themselves. | ✓ |
| Whole .planning/ tarball | Single-call hoist; opaque tar refs; conformance brittle. | |
| Bd-only JSONL (no memories) | Decisions stored as memories wouldn't survive restore; breaks the round-trip badly. | |

**User's choice:** Bd JSONL + memories only (Recommended)
**Notes:** Becomes D-11. Matches `capabilities.snapshot = true` semantic.

### Q4: Phase 9's IMPL-03 SC#1 says recordStateEvent({type:'decision'}) round-trips through getStateSnapshot() under decisions[]. What shape contract does Phase 7 lock so Phase 9's read methods can reverse-engineer correctly?

| Option | Description | Selected |
|--------|-------------|----------|
| Conformance-fixture write+read pair | Phase 7 writes one of each event type, reads bd directly (NOT via getStateSnapshot — that's Phase 9), asserts storage shape. Phase 9 just inverts. | ✓ |
| Write-only test in Phase 7; read contract Phase 9 | Storage shape deferred = silent risk. | |
| Use a per-event JSON schema file | Heavy for 10 fixed shapes; JSDoc serves the same purpose. | |

**User's choice:** Conformance-fixture write+read pair (Recommended)
**Notes:** Becomes D-12.

---

## Conformance harness + capabilities flag

### Q1: tests/conformance/ test-file layout — how are conformance tests organized?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-cluster, primitive-aware | binA-records, binA-section, binA-frontmatter, foundational-events, foundational-namedDoc, foundational-snapshot, capabilities. File boundaries match conceptual groupings. | ✓ |
| Per-method | One file per primitive (~16 files). File explosion. | |
| Single test file | Balloons to thousands of lines; can't parallelize. | |
| Per-bin (Bin A vs foundational) | Bin A / foundational overlap on getSection/updateSection creates ambiguity. | |

**User's choice:** Per-cluster, primitive-aware (Recommended)
**Notes:** Becomes D-13.

### Q2: How does the harness pair with fork's MarkdownAdapter when it ships?

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter factory in describe.each | Each conformance file exports `runConformance(makeAdapter, label)`. Driver runs once per adapter; `RUN_CROSS_ADAPTER=1` toggles second invocation. Phase 13 flips flag once fork publishes. | ✓ |
| Two parallel suites under tests/conformance/{beads,markdown}/ | Massive duplication; drift risk. | |
| Env-var ADAPTER selects which suite runs | Can't run both in one CI invocation. | |
| Defer cross-adapter to Phase 13 | Phase 7 SC#4 says structure must be ready; deferring leaves it undecided. | |

**User's choice:** Adapter factory in describe.each (Recommended)
**Notes:** Becomes D-14.

### Q3: Conformance fixture strategy — what does Phase 7's conformance use?

| Option | Description | Selected |
|--------|-------------|----------|
| seed.jsonl as canonical + per-test mutators | `tests/conformance/fixture.mjs:setupFreshAdapter()` clones seed.jsonl to tmp dir per test (mkdtempSync + t.after()). CONF-03 byte-identity preserved — seed.jsonl never modified in place. | ✓ |
| Per-test fixtures from scratch | Every test re-incurs `bd init` cost. | |
| One enriched 'phase-7' fixture distinct from seed.jsonl | Two fixtures to maintain; only seed.jsonl has CONF-03 invariant. | |

**User's choice:** seed.jsonl as canonical + per-test mutators (Recommended)
**Notes:** Becomes D-15. seed.jsonl gets one-time additive enrichment in Phase 7 to cover all primitive scenarios.

### Q4: Capabilities flag finalization. What do we lock for Phase 7 — and what does writeBinaryAsset do?

| Option | Description | Selected |
|--------|-------------|----------|
| Lock as-shipped; writeBinaryAsset throws | All seven booleans confirm at Phase 6 placeholder values. writeBinaryAsset throws `UnsupportedOperationError` (new class in src/bd/errors.mjs). Each `false` gets JSDoc rationale. | ✓ |
| writeBinaryAsset routes to .planning/binary/<hash> | Adds binary-blob handling; defeats point of capabilities flag. | |
| Re-evaluate snapshot=true as 'false (Phase 11+)' | Forces consumers into try/catch where partial-snapshot suffices. | |
| Add capabilities.partialSnapshot=true alongside snapshot=false | Bloats contract; D-2026-04-30-05 fixed seven-bit shape. | |

**User's choice:** Lock as-shipped; writeBinaryAsset throws (Recommended)
**Notes:** Becomes D-16. Phase 6 placeholder values (D-2026-04-30-05) match implementation reality.

---

## Claude's Discretion

The following items were left to plan-phase / execute-phase to decide based on research findings and existing conventions:

- `slugify()` exact accent / unicode handling, whether to collapse multiple spaces, how to handle code-fence content in heading text (recommend `github-slugger` algorithm or hand-rolled equivalent).
- `pathRouter.mjs` registry data structure (array of records vs glob-trie vs other).
- `bd export --json --memories` exact CLI flag syntax — verify during research whether the flag is `--memories`, `--include-memories`, or two separate calls.
- `UnsupportedOperationError` parent class — sibling of `BeadsUnavailableError` or sub-class.
- `tests/conformance/fixture.mjs:setupFreshAdapter()` exact API shape (returns object vs `t.context` wrapping).
- Whether `recordStateEvent` payload shape validation lives in Phase 7 or defers to Phase 9 read-side.
- `bd memory key collision policy across milestones` — D-09 namespace is per-milestone isolated; if collisions surface during execution, plan-phase adds resolution.

---

## Deferred Ideas

Captured for future phases, not in scope for Phase 7:

- External binary blob store for `writeBinaryAsset` — v1.1 if UI screenshots become essential.
- Native bd transaction primitive — v1.1+ if bd ships native txn or usage warrants.
- Whole-tree `.planning/` snapshot — v1.1+ if dry-run hoist callers grow tired of cp -r boilerplate.
- `recordStateEvent` payload schema validation — v1.1 if Phase 9 read-side surfaces shape drift.
- Cascade-loop JS rewrite (`src/bd/cascade.mjs`) — Phase 8 owns per Phase 6 D-12.
- `commitPlanningState` non-no-op semantics — Phase 13 / OQ-08 owns final cross-adapter contract.
- Cross-adapter conformance parity vs fork's MarkdownAdapter — Phase 13 flips `RUN_CROSS_ADAPTER=1` once fork publishes.
- Memory-key resolution at milestone transitions — plan-phase or Phase 9 adds helper if needed.

### Folded Todos

- `disambiguate-bd-managed-detection.md` (resolves_phase=6, score 0.6) — Phase 6 archived offending hooks (mooting self-targeting issue); Phase 7 inherits conceptual resolution via Phase 6 D-02 (lazy `_ensureBd()`). No additional Phase 7 work; folded as resolved-by-context.
