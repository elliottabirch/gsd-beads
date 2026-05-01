# Phase 6: Cleanup + adapter-library scaffolding - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure this repo as a proper adapter library: archive v0.2 shadow
code, lay down a `src/` layout that Phases 7-13 fill in, rewrite
`package.json` for an adapter-library shape, refresh README + CLAUDE.md,
and ensure carry-forward primitive tests pass against the new paths.

This phase **does not implement any BeadsAdapter method** beyond stubs
that throw "not implemented (Phase N)". The one piece of real
implementation is `src/format/phase.mjs` (ARCH-03 bidirectional
parse/format pair) — every other src/ file is either a verbatim
relocation of a v0.2 carry-forward primitive or a stub.

**In scope:**
- Archive `bin/{gsd-sdk-shadow,wrap-mutation}.mjs` →
  `archive/v0.2-shadow/bin/` (CLEAN-01; `git mv` preserves history)
- Archive `hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,worktree-post-checkout}.sh` →
  `archive/v0.2-shadow/hooks/` (CLEAN-02 + D-12 override)
- Archive `scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh` →
  `archive/v0.2-shadow/scripts/` (CLEAN-03 + D-12 override)
- Delete `install.sh` (CLEAN-04)
- Create `src/bd/{helper,errors,findRoot}.mjs` from carry-forward
  primitives (ARCH-01; `findRoot.mjs` extracted from
  `bin/gsd-sdk-shadow.mjs:236-281` per D-11)
- Create `src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,
  loadMilestoneHeading}.mjs` + `index.mjs` barrel (ARCH-02)
- Implement `src/format/phase.mjs` real bidirectional contract for
  `parsePhaseTitle`/`formatPhaseTitle` and `parsePhaseDescription`/
  `formatPhaseDescription` (ARCH-03; round-trip contract per D-15)
- Create `src/adapter.mjs` shell + `src/adapter/{primitives,
  phaseLifecycle,roadmapMilestone,state,verifyReviews,discussTodos,
  longTail,initBundlers}.mjs` cluster files with all ~75 method stubs
  per D-01..D-05 (ARCH-04)
- Rewrite `package.json` per D-06..D-09 (ARCH-05)
- Update `README.md` and `CLAUDE.md` to describe the post-cleanup
  architecture (DOC-01, DOC-02)
- Migrate carry-forward primitive tests to `tests/unit/`, re-importing
  from `src/` (TEST-01 + D-10..D-13)
- Create empty `tests/conformance/` directory with `.gitkeep` for
  Phase 7 to populate
- Archive shadow-specific tests (`tests/shadow-tests/handler-*`,
  `_parity-helpers`, `argv-routing`, `wrap-mutation`,
  `bd-allowlist-grep`, `snapshots/`, `scripts/update-snapshots.mjs`)
  to `archive/v0.2-shadow/tests/shadow-tests/`
- Archive `tests/{e2e,hook-tests,install-tests,cross-worktree,
  worktree-tests}/` wholesale (D-13)
- Edit `.planning/REQUIREMENTS.md` CLEAN-03 wording to reflect D-12
  (cascade-loop archives; was previously "stays")
- Confirm `tests/fixtures/seed.jsonl` reproduces byte-identically via
  `build-seed.sh` (CONF-03 invariant preserved)

**Out of scope:**
- Any BeadsAdapter method body (Phases 7-13 own these)
- Phase 8's JS-rewrite of `cascade-loop.sh` → `src/bd/cascade.mjs`
  (deferred; cascade-loop archived as inert reference)
- Conformance test bodies (Phase 7 creates them)
- `gsd-sdk-cc.version.lock` lifecycle decision (whether it stays as a
  fork-tracking pin or is removed) — deferred; left in place this
  phase, revisit when fork publishes
- Multi-worktree feature (worktree-post-checkout archives; consumers
  of the adapter handle multi-worktree manually for now)
- Resolving the conceptual "bd-managed project" detection question —
  Phase 7's adapter `init()` (lazy first-call validation per D-02)
  inherits this; the offending hooks moot the self-targeting issue
  via archival in Phase 6

</domain>

<decisions>
## Implementation Decisions

### Adapter class layout

- **D-01:** **`src/adapter.mjs` is a thin shell; per-cluster sub-modules
  hold method stubs.** Eight cluster files mirror SYNTHESIS.md §4
  cluster boundaries:
  - `src/adapter/primitives.mjs` — Bin A + 6 foundational (Phase 7)
  - `src/adapter/phaseLifecycle.mjs` — IMPL-01 (Phase 8)
  - `src/adapter/roadmapMilestone.mjs` — IMPL-02 (Phase 8)
  - `src/adapter/state.mjs` — IMPL-03 (Phase 9)
  - `src/adapter/verifyReviews.mjs` — IMPL-04 (Phase 10)
  - `src/adapter/discussTodos.mjs` — IMPL-05 + IMPL-06 (Phase 11)
  - `src/adapter/longTail.mjs` — IMPL-07..11 (Phase 12)
  - `src/adapter/initBundlers.mjs` — IMPL-12 (Phase 13)

- **D-02:** **Lazy bd validation.** Constructor stores `projectRoot`
  only; `_ensureBd()` runs `findBeadsRoot()` at first method call and
  caches the result. Matches Phase 7's CAP-01 SC #1 ("reading the flag
  does not require constructing the adapter against a beads-managed
  project"). Inherits the `disambiguate-bd-managed-detection.md`
  todo's planned resolution: adapter validates at first use, throws
  `BeadsUnavailableError` if invalid.

- **D-03:** **Static `capabilities` flag on the class.**
  `BeadsAdapter.capabilities = {...}` readable without instantiation.
  Phase 7 sets the actual booleans per D-2026-04-30-05; Phase 6 ships
  with a placeholder shape that compiles + matches the contract.

- **D-04:** **Cluster binding via `Object.assign(BeadsAdapter.prototype,
  ...clusterMethods)`.** Each cluster file exports a plain method-bag
  object (not a class, not a mixin function); the shell `Object.assign`s
  them all onto the prototype at module load. Stack traces show real
  method names; adding a cluster = drop a file + one line in the shell.

- **D-05:** **Stub style: `throw new Error('BeadsAdapter.<method>: not
  implemented (Phase N / IMPL-NN)')`.** Caller-friendly failure mode;
  conformance tests in Phase 7 can grep for this exact prefix to count
  remaining stubs.

### Fork peer-dep mechanism

- **D-06:** **`peerDependencies: { "get-shit-done-cc": "*" }` +
  `peerDependenciesMeta: { "get-shit-done-cc": { optional: true } }`.**
  Document `npm link ../get-shit-done` in `CONTRIBUTING.md` as the dev
  workflow. Doesn't pin a path or claim a version that doesn't exist.
  Tighten to `^1.0.0` once fork publishes.

- **D-07:** **Package name = `gsd-beads`** (matches repo, matches
  PROJECT.md / REQUIREMENTS.md usage). **Version = `1.0.0-alpha.0`**
  starting Phase 6.

- **D-08:** **`exports` map is structured.** Top-level `"."` →
  `./src/adapter.mjs`. Submodules: `"./bd"`, `"./bd/errors"`,
  `"./bd/findRoot"`, `"./helpers"`, `"./format/phase"`. Conformance
  tests need internal access (`bd`, `format`); a flat-only export
  would block them.

- **D-09:** **Pure-library shape.** `engines.node >= 20`. No `bin`
  entries (ARCH-05). No `install` / `postinstall` scripts (CLEAN-04 +
  ARCH-05). Scripts: `test`, `test:unit`, `test:conformance`,
  `link:fork`. Test layout standardizes as `tests/unit/` and
  `tests/conformance/`.

### Test file split

- **D-10:** **Triage by what each test targets.**
  - **Migrate to `tests/unit/`** (re-import from `src/`): `helpers-*`,
    `bd-helper`, `beads-errors`, `findBeadsRoot`, `memories-seeded`,
    `milestone-scoping`, `seed-determinism.test.sh`. Plus add stub
    coverage for `format/phase.mjs` per D-14..D-17.
  - **Archive to `archive/v0.2-shadow/tests/shadow-tests/`**: all
    `handler-*.test.mjs` (~17 files), `_parity-helpers.{mjs,test.mjs}`,
    `argv-routing.test.mjs`, `wrap-mutation.test.mjs`,
    `bd-allowlist-grep.test.sh`, `snapshots/`, parent
    `tests/scripts/update-snapshots.mjs`.
  - **Untouched**: `tests/fixtures/` (CONF-03 byte-identity invariant
    must hold; `build-seed.sh` and `seed.jsonl` stay).
  - **Created empty**: `tests/conformance/.gitkeep` for Phase 7.

- **D-11:** **`findBeadsRoot()` extracted verbatim** from
  `bin/gsd-sdk-shadow.mjs:236-281` into `src/bd/findRoot.mjs`. Existing
  `tests/shadow-tests/findBeadsRoot.test.mjs` relocates to
  `tests/unit/findBeadsRoot.test.mjs` and updates its import.
  Re-derivation rejected (loses Phase 4's worktree-fixture-validated
  behavior); re-export from archive rejected (couples src/ to
  archive/, defeats cleanup).

- **D-12:** **OVERRIDES REQUIREMENTS.md CLEAN-03.** Originally
  CLEAN-03 said "`scripts/cascade-loop.sh` stays (carry-forward bd
  primitive)." User decision: archive it alongside the rest.
  `hooks/worktree-post-checkout.sh` also archives (originally not in
  any CLEAN entry). Phase 6 deliverable adds a `git mv` for both into
  `archive/v0.2-shadow/{scripts,hooks}/` AND edits
  `.planning/REQUIREMENTS.md` CLEAN-03 wording to reflect this. Phase
  8 will JS-rewrite cascade as `src/bd/cascade.mjs` when wiring
  `completePhaseAndCascade`. Multi-worktree as a feature drops;
  consumers handle it manually.

- **D-13:** **`tests/{e2e,hook-tests,install-tests,cross-worktree,
  worktree-tests}/` archive wholesale** to
  `archive/v0.2-shadow/tests/`. They depend on shadow/hooks/install
  layers being live; `findBeadsRoot.test.mjs` already covers the
  worktree-symlink path independently — no regression risk.

### `src/format/phase.mjs` scope

- **D-14:** **Bidirectional surface = title + description.** Four
  exported functions:
  - `parsePhaseTitle(line) → { number, name }`
  - `formatPhaseTitle({ number, name }) → string`
  - `parsePhaseDescription(body) → { goal, depends_on, requirements,
    success_criteria, tail }`
  - `formatPhaseDescription(parsed) → string`

  `tail` is an opaque trailing string capturing anything after
  Success Criteria (e.g. the `Plans:` checkbox list); it round-trips
  byte-equal but isn't structurally parsed (D-16).

- **D-15:** **Round-trip contract: `parse(format(parse(body))) ===
  parse(body)`.** Idempotent canonical form on the parsed structure.
  `format()` normalizes whitespace / wrapping / blank-line conventions;
  `parse()` re-derives the same structured object regardless. Strict
  byte-equality (`format(parse(body)) === body`) rejected — would
  force the parser to track every space and comma and is brittle on
  edge cases. Standard markdown round-trip contract (mdast/remark
  family).

- **D-16:** **Plans list is opaque tail in Phase 6.** `parsePhaseDescription`
  consumes Goal / Depends on / Requirements / Success Criteria;
  everything after (`Plans:` checklist + `- [x] 02-01-...` lines)
  becomes the `tail` field. Phase 8's `phasePlanIndex` derives plan
  data from bd children, not the markdown view, so structurally
  parsing this list is unnecessary. Avoids over-scoping Phase 6.

- **D-17:** **Fixture: real ROADMAP.md Phases 6-13 + curated edge
  cases.** Property tests live in `tests/unit/format-phase.test.mjs`
  with fixture file at `tests/unit/fixtures/phase-format/`. Edge
  cases: decimal phase number (`72.1`), single-line goal, multi-line
  goal with bullets, empty success criteria, `Depends on: Nothing`,
  `Requirements: TBD`, missing `Plans:` section.

### Carried forward from prior phases (do NOT re-decide)

- **D-18:** Two-repo model — fork at `~/code/get-shit-done`, this repo
  is sibling adapter (D-2026-04-30-02)
- **D-19:** SYNTHESIS.md §4 is canonical method catalog
  (D-2026-04-30-06); cluster boundaries in D-01 mirror it
- **D-20:** Adapter capabilities flag shape per D-2026-04-30-05;
  Phase 7 sets the booleans, Phase 6 leaves the slot
- **D-21:** `BEADS_ACTOR=seed` discipline preserved on every seeder
  call (Phase 4 Pitfall 8 carry-forward); `seed.jsonl` byte-identity
  via `seed-determinism.test.sh` is a CONF-03 invariant
- **D-22:** `findBeadsRoot()` semantics — env-var first, parent-walk
  bounded at git root, `fs.realpath` follows symlinks (Phase 4 D-01..D-04)
- **D-23:** `BeadsUnavailableError` hierarchy (`BeadsNotInstalled`,
  `BeadsCorrupt`, `BeadsEmpty`, etc.) — preserved as `src/bd/errors.mjs`
  (verbatim from `bin/beads-errors.mjs`)
- **D-24:** Spike findings auto-load via
  `Skill("spike-findings-gsd-beads")` — CLAUDE.md keeps that line

### Folded Todos

- **`disambiguate-bd-managed-detection.md`** (resolves_phase=6,
  match score 0.6) — Phase 6's archival of the offending hooks
  (`block-state-md.sh`, `block-gsd-sdk-mutation.sh`, `bd-sync.sh`)
  moots the self-targeting issue in this repo. The conceptual
  disambiguation work — "bd-managed project" vs "project hosts bd
  vocabulary" — moves to Phase 7's adapter `init()` step. Phase 6
  partial-resolves; Phase 7 fully resolves. The todo file's
  resolution note already documents this. Plan-phase should mark the
  todo `closed` once Phase 6 ships and reference Phase 7 as the
  follow-on for the conceptual half.

### Claude's Discretion

- **Format of `Object.assign(prototype, ...)` call** — D-04 names the
  pattern; the exact import order, JSDoc on the shell class, whether
  to expose a `BeadsAdapter._clusters` array for introspection — plan
  decides.
- **`src/helpers/index.mjs` barrel shape** — D-08 declares `./helpers`
  as an export; whether the barrel re-exports each helper as named
  exports (`export { parsePhaseId } from ...`) or as a default object
  is plan-phase's call.
- **`engines.node` exact version** — D-09 says `>=20`; if research
  surfaces a feature requiring `>=22` (or a Volta-pinned version on
  the user's machine), plan-phase tightens.
- **`README.md` and `CLAUDE.md` exact wording for DOC-01 / DOC-02** —
  must describe post-cleanup architecture, sibling fork at
  `~/code/get-shit-done`, refactor-on-fork-stabilize policy. Tone /
  ordering / detail level is plan/execute discretion.
- **Archive-directory README.md content** — `archive/v0.2-shadow/README.md`
  should explain "this code shipped as v0.2; preserved for historical
  reference; not active." Exact wording is plan-phase's call.
- **`.planning/REQUIREMENTS.md` CLEAN-03 edit wording** — D-12 names
  the change; the precise replacement text (e.g. "`scripts/cascade-loop.sh`
  archives to `archive/v0.2-shadow/scripts/`; Phase 8 reintroduces
  the cascade primitive as `src/bd/cascade.mjs`") is plan-phase's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 acceptance contract
- `.planning/ROADMAP.md` §"Phase 6: Cleanup + adapter-library
  scaffolding" — 6 success criteria + dependencies (none — foundational)
- `.planning/REQUIREMENTS.md` §"Cleanup (CLEAN-01..04)",
  §"Architecture (ARCH-01..05)", §"Documentation (DOC-01..02)",
  §"TEST-01" — 12 owned requirements; CLEAN-03 is mid-edit per D-12
- `.planning/PROJECT.md` §"Carry-forward from v0.1 and v0.2 work" —
  enumerates the primitives Phase 6 must relocate

### Architecture context (foundational, do not re-derive)
- `.planning/research/fork-investigation/SYNTHESIS.md` §4 — canonical
  ~96-method catalog; cluster boundaries in D-01 mirror these
- `.planning/research/fork-investigation/SYNTHESIS.md` §8 — explicit
  carry-forward list (13 spike findings, format module concept,
  helpers, JSONL roundtrip seed pattern)
- `.planning/DECISIONS.md` D-2026-04-30-01..06 — locked decisions
  (architectural pivot, two-repo model, capabilities flag shape,
  SYNTHESIS canonicalization)
- `.planning/STATE.md` — milestone v1.0 status; v0.2 milestone
  superseded context

### Cross-phase context to carry forward
- `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-CONTEXT.md`
  D-01..D-04 — `findBeadsRoot()` semantics that `src/bd/findRoot.mjs`
  must preserve verbatim (D-11 + D-22)
- `.planning/phases/05-roadmap-read-handlers/05-CONTEXT.md` — Phase 5
  D-22..D-29 carry-forward decisions; the helpers Phase 6 relocates
  (parsePhaseId, deriveDiskStatus, etc.) shipped during Phase 5

### Spike findings (validated patterns; carry forward)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — auto-loaded;
  canonical decisions index. Constraints in `<requirements>` block
  (cascade-loop semantics, hash-based ID uniqueness, JSONL determinism)
  remain valid even though the shell scripts archive
- `.claude/skills/spike-findings-gsd-beads/references/beads-modeling.md`
  — `bd remember` memory key namespacing (`gsd-beads:` prefix);
  cascade-loop 5-line pattern Phase 8 will re-implement in JS
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md`
  — `BEADS_DIR` cross-worktree pattern (still relevant context even
  though `worktree-post-checkout.sh` archives per D-12)
- `.claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md`
  — Y1 architecture rationale; useful for archive/v0.2-shadow/README.md

### Existing source files Phase 6 relocates / extracts
- `bin/bd-helper.mjs` → `src/bd/helper.mjs` (verbatim relocation;
  ARCH-01)
- `bin/beads-errors.mjs` → `src/bd/errors.mjs` (verbatim relocation;
  ARCH-01)
- `bin/gsd-sdk-shadow.mjs:236-281` → extract `findBeadsRoot()` to
  `src/bd/findRoot.mjs` (D-11; ARCH-01)
- The four helpers shipped in Phase 5 (parsePhaseId,
  deriveDiskStatus, detectDrift, loadMilestoneHeading) — currently
  embedded inline in `bin/gsd-sdk-shadow.mjs`; Phase 6 extracts each
  to its own file under `src/helpers/` (ARCH-02)

### Files Phase 6 archives (not deleted)
- `bin/gsd-sdk-shadow.mjs`, `bin/wrap-mutation.mjs` →
  `archive/v0.2-shadow/bin/` (CLEAN-01)
- `hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,
  worktree-post-checkout}.sh` → `archive/v0.2-shadow/hooks/`
  (CLEAN-02 + D-12)
- `scripts/{regen-roadmap,regen-requirements,regen-state,
  cascade-loop}.sh` → `archive/v0.2-shadow/scripts/` (CLEAN-03 + D-12)
- `install.sh` → DELETE (CLEAN-04)
- `tests/shadow-tests/handler-*` (~17 files), `_parity-helpers.*`,
  `argv-routing.test.mjs`, `wrap-mutation.test.mjs`,
  `bd-allowlist-grep.test.sh`, `snapshots/`,
  `tests/scripts/update-snapshots.mjs` →
  `archive/v0.2-shadow/tests/shadow-tests/` (D-10)
- `tests/{e2e,hook-tests,install-tests,cross-worktree,
  worktree-tests}/` → `archive/v0.2-shadow/tests/` (D-13)

### External fork reference
- `~/code/get-shit-done` (branch `feat/storage-adapter`) — sibling
  fork; in flight, unpublished. Phase 6 declares `peerDependencies`
  per D-06 but does NOT depend on the fork at runtime (BeadsAdapter
  stubs throw, so no fork API call paths exercise yet)

### Defensive context (read but do NOT act on in Phase 6)
- `.planning/todos/pending/disambiguate-bd-managed-detection.md` —
  partially resolved by Phase 6 archival (mooting self-targeting
  issue); fully resolved by Phase 7 adapter init. Plan-phase folds
  per the "Folded Todos" entry above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`bin/bd-helper.mjs`** — `bd(args, opts)` `spawnSync` wrapper that
  throws `BeadsNotInstalled`/`BeadsCorrupt`/`BeadsEmpty` sentinels.
  Verbatim move to `src/bd/helper.mjs`.
- **`bin/beads-errors.mjs`** — Frozen `BeadsCause` enum + per-subtype
  error classes. Verbatim move to `src/bd/errors.mjs`.
- **`bin/gsd-sdk-shadow.mjs:236-281`** — `findBeadsRoot()` body
  (env-var → parent-walk → `fs.realpath` symlink follow). Extract to
  `src/bd/findRoot.mjs`. Phase 4's `tests/shadow-tests/findBeadsRoot.test.mjs`
  + worktree fixture is the regression suite (relocates to `tests/unit/`).
- **The four helpers** (parsePhaseId, deriveDiskStatus, detectDrift,
  loadMilestoneHeading) — shipped during Phase 5; currently inline in
  `bin/gsd-sdk-shadow.mjs`. Phase 6 extracts each to its own file
  under `src/helpers/`.
- **`tests/fixtures/seed.jsonl` + `build-seed.sh` + `seed-fixture.sh`** —
  CONF-03 byte-identity invariant. Stay where they are; Phase 7's
  conformance tests use them as the canonical fixture.

### Established Patterns

- **`BEADS_ACTOR=seed`** discipline on every seeder call (Phase 4
  Pitfall 8) — preserved.
- **Per-handler test file naming** (`handler-roadmap-analyze.test.mjs`,
  etc.) — these files archive (D-10); Phase 7+ conformance uses a
  different convention (per-method or per-cluster).
- **`Object.freeze` on enums + per-subtype `.name`** (Phase 4 Pitfall
  1) — preserved in `src/bd/errors.mjs`.
- **`spawnSync` (not `execSync`)** for shell-out — preserved in
  `src/bd/helper.mjs`.
- **`mkdtempSync` + `t.after()` teardown** (Phase 5 migration) — used
  in `tests/unit/` going forward.

### Integration Points

- **`src/adapter.mjs` shell** imports: `findBeadsRoot` from
  `./bd/findRoot.mjs`; `bd` from `./bd/helper.mjs`; errors from
  `./bd/errors.mjs`; helpers from `./helpers/index.mjs`; format
  functions from `./format/phase.mjs`. Re-exports the
  `BeadsAdapter` class as both default and named.
- **`package.json#exports`** map (D-08) — must list every submodule
  Phase 7+ tests will import. Conformance tests import `./bd`,
  `./bd/errors`, `./helpers`, `./format/phase`.
- **`CONTRIBUTING.md`** — new file documenting `npm link
  ../get-shit-done` dev workflow per D-06.
- **`archive/v0.2-shadow/README.md`** — new file explaining the
  archive's purpose (historical reference; not active code; archived
  during Phase 6 of v1.0 milestone).
- **`.planning/REQUIREMENTS.md`** CLEAN-03 — must be edited during
  execution to reflect D-12 (cascade-loop archives, doesn't stay).
- **`tests/conformance/.gitkeep`** — placeholder so the directory
  exists in git; Phase 7 populates.

</code_context>

<specifics>
## Specific Ideas

- **`git mv`, not `cp + rm`.** ROADMAP SC #1 explicitly says "files
  are git-mv'd (history preserved), not deleted." Every archival
  move must preserve `git log --follow` history.

- **Idempotent canonical form is the markdown round-trip standard.**
  D-15's contract `parse(format(parse(body))) === parse(body)` is the
  same property `JSON.stringify(JSON.parse(x))` yields and what
  mdast/remark guarantee. Don't over-engineer to byte-equality.

- **The format module is the only "real" implementation in Phase 6.**
  Everything else is move + stub + docs. This keeps the Phase 6 blast
  radius narrow: file moves are mechanical, stubs are boilerplate,
  docs are prose. The format module is the only place subtle bugs
  can ship — property tests against the real ROADMAP.md fixture
  catch them.

- **Phase 7 is the conformance-test-first phase.** Phase 6 creates an
  empty `tests/conformance/.gitkeep` so the structure exists. Phase
  7 will fill in primitive-level conformance tests against
  `seed.jsonl` and against the fork's MarkdownAdapter (when reachable).

- **CLEAN-03 wording fix is a Phase 6 deliverable.** D-12 overrides
  the original. The plan must include a task to edit
  `.planning/REQUIREMENTS.md` and commit that edit. Otherwise Phase
  6 verification will flag the divergence.

- **`gsd-sdk-cc.version.lock` lives — for now.** It pinned upstream
  SDK version against drift in v0.2. With shadow archived, its
  purpose evaporates. But it does no harm staying in tree, and
  removing it is technically out of CLEAN-01..04 scope. Phase 7+ may
  retire it when the fork starts publishing — left as future cleanup.

</specifics>

<deferred>
## Deferred Ideas

- **JS rewrite of `cascade-loop.sh` → `src/bd/cascade.mjs`** — D-12
  archives the shell script; Phase 8 owns the JS rewrite when wiring
  `completePhaseAndCascade`. Don't pre-build it.

- **Multi-worktree feature for adapter consumers** — `worktree-post-checkout.sh`
  archives. The capability spike-validated in v0.1 (BEADS_DIR
  cross-worktree sharing) doesn't ship as automatic install behavior
  in v1.0. README documents the manual setup recipe; v1.1+ may
  reintroduce as an opt-in helper script under `src/bd/`.

- **`gsd-sdk-cc.version.lock` retirement** — left in tree this phase;
  out of CLEAN-* scope. Retire when fork publishes and version
  pinning shifts to fork's package version.

- **`fast-check` property-based testing dependency** — D-17 chose
  hand-curated edge cases + real ROADMAP fixture. If Phase 8's
  `addPhase` / `evolveRoadmap` round-trip surfaces format bugs,
  consider adding fast-check then.

- **Adapter-internal logging strategy** — Phase 6 adapter shell does
  no logging. Phases 8+ may want structured logs (drift detection,
  bd spawn timing). Defer to first phase that needs it.

- **`tests/conformance/` test runner discovery contract** — Phase 6
  creates the directory empty; Phase 7 decides naming convention
  (one file per primitive? per cluster? per method?).

- **Bridging the fork's `MarkdownAdapter`** — Phase 13 owns the
  cross-adapter conformance run; Phase 7 just leaves the harness
  capable of pairing.

### Reviewed Todos (not folded as scope)

None — `disambiguate-bd-managed-detection.md` is folded above (the
only matched todo).

</deferred>

---

*Phase: 6-cleanup-adapter-library-scaffolding*
*Context gathered: 2026-04-30*
