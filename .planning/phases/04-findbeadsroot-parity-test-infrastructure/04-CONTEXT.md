# Phase 4: findBeadsRoot() + parity test infrastructure - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Lay the read-side foundation that every Phase 5–9 read handler will plug
into: a worktree-aware detection function, a sentinel-based fallback
contract, a parity-test harness, the `BEADS_READ_OVERRIDES` table itself,
**and** the milestone-scoping plumbing that makes shared-bd / per-worktree-
milestone topologies resolve gracefully.

Phase 4 ships **no user-visible behavior** — `BEADS_READ_OVERRIDES` is
empty when the phase ends (real handlers land in Phases 5–9). What ships
is plumbing the next seven phases will build on.

**In scope:**
- `findBeadsRoot(projectDir)` — new function for read-side detection
  (worktree-aware; symmetric with the hooks fix `b51abbc`)
- `BeadsUnavailableError` class hierarchy (base + 4 subtypes) and
  helper-throws-only contract
- Read-shaped dispatch fall-through: shadow's `try/catch` at
  `bin/gsd-sdk-shadow.mjs:303-312` extended to recognize the sentinel
  and fall through to upstream instead of `process.exit(1)`
- `BEADS_READ_OVERRIDES = {}` table declared and registered in dispatch
  (without `wrapMutation`); kept empty until Phase 5
- `tests/shadow-tests/_parity-helpers.mjs` — the snapshot/parity harness
  Phases 5–9 will reuse
- Static-JSON snapshot storage + `tests/fixtures/seed-fixture.sh`
  deterministic seeder script (multi-milestone state: v0.1 closed,
  v0.2 in-progress, v0.3 planned)
- `_phase4-test-stub` handler (registered in BEADS_READ_OVERRIDES,
  removed in Phase 5) used to prove dispatch wiring + sentinel
  fall-through end-to-end
- Real `git worktree add` test fixture for findBeadsRoot
- Milestone-scoping plumbing: `regen-state.sh` reads worktree-local
  milestone source (NOT bd); STATE.md is per-worktree; multi-milestone
  fixture proves the scoping flow end-to-end
- CI lockfile pin for upstream `gsd-sdk-cc` version + drift-detection job

**Out of scope:**
- Any real read handler (Phases 5–9 own those)
- `regen-roadmap.sh` / `regen-requirements.sh` milestone-filter wiring —
  those scripts are touched by Phases 5/6 when their respective
  read handlers land. Phase 4 only proves the worktree-scoped
  STATE.md + seeder fixture pattern that makes downstream filtering
  possible
- Refactor of `isBeadsManaged()` to use `findBeadsRoot()` (kept
  separate; mutations keep their current detection)
- Anything from `.planning/todos/pending/disambiguate-bd-managed-detection.md`
  (different problem; tightening the detection guard for non-state bd
  content is its own future work)

</domain>

<decisions>
## Implementation Decisions

### Detection (Area 1 — findBeadsRoot semantics)
- **D-01:** **Resolution priority is `BEADS_DIR` env first.** If `$BEADS_DIR`
  is set and points at a real `.beads/` dir, use it. Otherwise parent-walk
  from `projectDir`. Symmetric with how Phase 3's install.sh sets
  `BEADS_DIR` per worktree.
- **D-02:** **Parent-walk bounded at git root.** Walk parents until either
  `.beads/metadata.json` or `.git/` is found, or we hit filesystem root.
  Avoids climbing out of the project tree. Matches how prettier / npm
  root-finding works.
- **D-03:** **Follow symlinks via `fs.realpath`.** Symlinked `.beads/` is
  legitimate (Phase 3 worktree setups may use them); follow transparently.
  The `bd` CLI itself follows symlinks.
- **D-04:** **`isBeadsManaged()` is unchanged for mutations; `findBeadsRoot()`
  is the new read-side function.** Different jobs, different signatures.
  Single-source-of-truth refactor is deferred — too much regression-test
  blast radius for a Phase 4 plumbing milestone.
- **D-05:** **Phase 4 acceptance includes milestone-scoping plumbing.**
  STATE.md is parameterized by the worktree (worktree-local source for
  "current milestone", *not* bd). `regen-state.sh` reads that
  worktree-local source so two worktrees on different milestones see
  different STATE.md content while sharing one bd store. Concretely:
  the seeder fixture must produce multi-milestone bd state and the
  parity harness must prove that worktree-A-style queries return v0.2
  rows and worktree-B-style queries return v0.3 rows, against the same
  store.

### Test infrastructure (Area 2 — snapshot storage)
- **D-06:** **Static JSON snapshots in repo + deterministic seeder script.**
  Snapshots live at `tests/shadow-tests/snapshots/<cmd>.json`. Captured
  via a `tests/scripts/update-snapshots.mjs` (or similar) that runs
  upstream `gsd-sdk` against the seeded fixture and writes JSON. Keeps
  parity tests at ~0ms cost (`JSON.parse`).
- **D-07:** **Deterministic seeder script at `tests/fixtures/seed-fixture.sh`
  is a Phase 4 deliverable.** Determinism contract: same script invocation
  on the same machine produces byte-identical bd state. Tactics: fixed
  seed inputs (no `$(date)` in bd issue titles), `BD_DATE` env if bd
  supports it, controlled `--prefix`, no random tokens. A Phase 4 test
  asserts the seeder is reproducible (run twice, diff JSONL).
- **D-08:** **Multi-milestone fixture from day one.** Seeder produces
  v0.1 phases (closed), v0.2 phases (in-progress), v0.3 phases (planned).
  Reusable in Phases 5–9 — every read handler tests against the same
  multi-milestone world, so milestone-scoping bugs surface immediately.
- **D-09:** **Parity assertion: key-set + types only.** Same keys present
  in handler output and snapshot; same value types (`string|number|null|
  array|object`); values may differ because bd state differs from file
  state. Catches schema drift; doesn't false-positive on legitimate
  bd-vs-file differences.
- **D-10:** **CI drift detection via lockfile pin.** A lockfile pins
  `gsd-sdk-cc` version. CI re-runs `update-snapshots` against the pinned
  upstream and diffs against repo snapshots; fails on drift. `/gsd-update`
  bumps lockfile + regenerates snapshots in the same PR.

### Error model (Area 3 — BeadsUnavailableError)
- **D-11:** **Subtype hierarchy.** Base `BeadsUnavailableError` with four
  subtypes: `BeadsNotInstalled` (bd binary missing), `BeadsCorrupt`
  (`.beads/metadata.json` malformed or schema violations), `BeadsVersionMismatch`
  (bd reports a version outside the supported range), `BeadsEmpty`
  (`.beads/` valid but no relevant content for the handler — e.g., zero
  phases). Lets future handlers degrade differently per cause without
  needing to refactor the contract.
- **D-12:** **Dispatcher catches `BeadsUnavailableError` OR known bd-CLI
  errors** (ENOENT on `bd` binary, "bd: command not found"). Real bugs
  (TypeError, syntax error in handler, etc.) propagate loudly with
  `process.exit(1)` — same loud-fail behavior as v0.1 mutations. Silent
  fallthrough on every error would mask handler bugs.
- **D-13:** **Helpers throw, handlers stay clean.** A `bd()` invocation
  helper (introduced in Phase 4) wraps `execSync` and throws the
  appropriate sentinel subtype on bd-related failures. `findBeadsRoot()`
  itself returns `null` (does NOT throw) when no `.beads/` is found —
  null is normal, not exceptional. Read handlers call helpers and just
  propagate.
- **D-14:** **Sentinel metadata: `{ cause: enum, originalError?: Error }`.**
  The `cause` enum mirrors the subtypes (`'not-installed' | 'corrupt' |
  'version-mismatch' | 'empty' | 'unknown'`). `originalError` preserves
  the underlying `Error` for debugging. Logs and tests can distinguish
  causes; downstream behavior keys off the subtype, not the string.

### Validation strategy (Area 4 — proving wiring works)
- **D-15:** **Phase 4 ships a `_phase4-test-stub` handler** registered in
  `BEADS_READ_OVERRIDES` purely to prove dispatch reaches read handlers
  registered after `BEADS_OVERRIDES` mutations. Returns a fixed shape
  (`{ data: { ok: true, backend: 'beads' } }`). Phase 5 deletes it
  alongside adding `roadmap.analyze`.
- **D-16:** **Same stub takes a flag/env to throw `BeadsUnavailableError`.**
  Test variants invoke the stub configured to throw each subtype; assert
  the dispatcher catches the sentinel, falls through to upstream, and
  upstream's response is what the user sees. End-to-end proof of the
  sentinel + dispatch contract before any real handler exists.
- **D-17:** **Real `git worktree add` setup in `findBeadsRoot()` tests.**
  Test fixture runs `git init`, `git worktree add`, sets `BEADS_DIR` env
  in the worktree, calls `findBeadsRoot()` from each location. Slow
  (~1s setup) but catches real-world bugs. CI already requires git for
  the existing test suite.
- **D-18:** **Multi-milestone seeder is a Phase 4 deliverable**, not
  deferred to Phase 5. Front-loads the complexity but matches the
  milestone-scoping acceptance from D-05; Phase 5+ ride on a confirmed
  fixture.

### Claude's Discretion
- Stub-handler placement: whether `_phase4-test-stub` lives in
  `gsd-sdk-shadow.mjs` behind a `process.env.GSD_SHADOW_TEST_STUB` check
  or in a sibling `bin/_test-stub.mjs` import — pick the option that
  keeps the production binary smallest while still allowing CLI-driven
  stub tests. Defer to plan-phase.
- Determinism tactics for the seeder (whether bd supports `BD_DATE` env,
  whether to use a fake-time wrapper, whether to disable bd's
  `auto-export` during seeding) — investigated by gsd-phase-researcher;
  pick a strategy in plan-phase based on what bd v1.0.3 actually offers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 acceptance contract
- `.planning/ROADMAP.md` §"Phase 4: findBeadsRoot() + parity test infrastructure" — 4 success criteria + dependencies
- `.planning/REQUIREMENTS.md` §"REQ-QUAL-01..03" — output-shape parity, read-shaped fallback contract, findBeadsRoot for reads

### Architecture context (foundational, do not re-derive)
- `.planning/research/SUMMARY.md` — v0.2 synthesis with key decisions and build order
- `.planning/research/STACK.md` — bd CLI surface, JSON shape catalog, edge cases (memories returns object not array; bd list default `-n 50`; etc.)
- `.planning/research/ARCHITECTURE.md` — handler signatures, dispatch wiring, build order rationale, Skeleton handler example
- `.planning/research/PITFALLS.md` — 10 critical hazards including output-shape drift, read-shaped fallback, performance, hook-allowlist regression
- `.planning/research/FEATURES.md` — full 96-row catalog of `gsd-sdk query` call sites with classification

### Existing implementation (read before changing)
- `bin/gsd-sdk-shadow.mjs` — current shadow with 13 mutation handlers; lines 205 (BEADS_OVERRIDES), 232 (isBeadsManaged), 248 (spawnUpstream), 274 (createRegistry), 277-279 (register loop with wrapMutation), 303-312 (try/catch — needs read-shaped extension)
- `bin/wrap-mutation.mjs` — mutation event wrapper; do NOT use for read handlers (D-09 reasoning)
- `tests/shadow-tests/argv-routing.test.mjs` — has `beadsFixture()` and `nonBeadsFixture()` helpers + the existing fixture/teardown pattern; lines 13-29
- `tests/shadow-tests/handler-phase-add.test.mjs` and siblings — model for per-handler test files

### Hooks fix to mirror (b51abbc)
- `hooks/block-state-md.sh` — guard pattern at top: resolve project root from `CLAUDE_PROJECT_DIR` → payload.cwd → $PWD; pass through silently when no `.beads/`. `findBeadsRoot()` is the symmetric move on the shadow side.
- Commit `b51abbc` for the rationale and test extension pattern (33/33 + 46/46 tests after the fix)

### Spike findings (validated patterns; carry forward)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — auto-loaded; canonical decisions index
- `.claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md` — Y1 architecture rationale; `createRegistry` / `resolveQueryArgv` / `extractField` import contract; "DON'T re-wrap reads with wrapMutation"
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md` — worktree topology (source-repo `.beads/` canonical; `BEADS_DIR=<source>/.beads`)

### Prior-phase context to carry forward
- `.planning/phases/02-build-the-layer/02-CONTEXT.md` — locks Y1 registry-override architecture; the 13 BEADS_OVERRIDES list; wrapMutation re-wrapping for D-09 forward-compat
- `.planning/phases/03-cross-worktree-validation/03-CONTEXT.md` — locks worktree topology, `flock` serialization on `<source>/.beads/.gsd-beads.lock`, the 4 invariants (no data loss / no ID collision / no stale state / atomic markdown views)

### Defensive context (read but do NOT act on in Phase 4)
- `.planning/todos/pending/disambiguate-bd-managed-detection.md` — the broader detection-tightening problem; out-of-scope for v0.2 entirely. Phase 4's `findBeadsRoot()` is for worktree topology only, not for solving this todo.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`createRegistry` / `resolveQueryArgv` / `extractField`** (upstream
  `gsd-sdk-cc/sdk/dist/query/`): already imported and used by the shadow
  for mutation dispatch. Read-handler dispatch reuses the SAME registry
  instance — register reads after mutations in the same loop.
- **`getProjectDir(argv)`** (gsd-sdk-shadow.mjs:238): parses `--project-dir`
  argv flag, falls back to `process.cwd()`. `findBeadsRoot()` should
  call this to get its starting point, not duplicate the logic.
- **`beadsFixture()` / `nonBeadsFixture()`** (argv-routing.test.mjs:13-22):
  existing helpers for `mkdtempSync` + `bd init` setup and teardown.
  Phase 4's `git worktree add` fixture extends this pattern with a
  third helper, e.g. `worktreeBeadsFixture()`.

### Established Patterns
- **Per-handler test file** (`handler-X-Y-Z.test.mjs`): one test file
  per handler with 3+ cases. Phase 4 introduces a NEW pattern —
  `_parity-helpers.mjs` (shared) and `_phase4-test-stub.test.mjs`
  (lifecycle-bound). The underscore prefix flags non-handler files.
- **`mkdtempSync` + `try { ... } finally { rmSync(dir, recursive, force) }`**:
  the existing teardown idiom. Phase 4 fixtures (especially the git
  worktree one) MUST mirror this; failed teardown leaves orphan
  `.beads/` dirs in `/tmp` that confuse later test runs.
- **`spawnSync` (not `execSync`) for shadow CLI invocations** in tests:
  captures `stdout` / `stderr` / `status` separately. Phase 4 helpers
  use the same.

### Integration Points
- **`bin/gsd-sdk-shadow.mjs:274-279`** — register loop. New code: a
  second loop after the mutation loop, registering BEADS_READ_OVERRIDES
  entries WITHOUT `wrapMutation`. The comment at line 4 (`D-02
  invariant: all 13 BEADS_OVERRIDES handlers...`) is updated to
  "13 mutation entries; reads register separately."
- **`bin/gsd-sdk-shadow.mjs:303-312`** — dispatch try/catch. Extended
  to detect `BeadsUnavailableError` (and known bd-CLI errors) and call
  `spawnUpstream(argv)` instead of `process.exit(1)`. Real errors
  still hit the existing path.
- **`bin/gsd-sdk-shadow.mjs:232-234`** — `isBeadsManaged()`. Untouched
  in Phase 4 (D-04). New `findBeadsRoot()` lives nearby.
- **`scripts/regen-state.sh`** (commit `f8903ca`) — Phase 4 extends to
  read worktree-local milestone source instead of (or in addition to)
  bd state. Specific approach decided in plan-phase based on the
  current implementation.
- **CI workflow** — Phase 4 adds: snapshot drift job, lockfile pin
  for `gsd-sdk-cc`, hook-allowlist grep test (precursor to
  REQ-QUAL-05; full test lands in Phase 11 but the wiring is here).

</code_context>

<specifics>
## Specific Ideas

- **Mirror b51abbc's guard pattern.** That commit established the
  symmetric pattern for the hook layer; Phase 4's `findBeadsRoot()`
  is the read-side application of the same idea. The hook fix's tests
  (33/33 block-state-md, 46/46 block-gsd-sdk-mutation) are a model
  for how thorough Phase 4's findBeadsRoot tests should be.

- **Multi-milestone fixture composition** — the seeder should produce
  state that exercises ALL the milestone-scoping edge cases at once:
  closed milestone (v0.1), in-progress milestone (v0.2), planned
  milestone (v0.3). Empty-bd is its own separate fixture (uses
  `nonBeadsFixture()` for the missing-`.beads/` case; an `emptyBeadsFixture()`
  helper for `bd init` with zero issues).

- **The stub handler's name is intentional.** `_phase4-test-stub`
  uses an underscore prefix and a phase number to signal "not real,
  delete me when Phase 4 closes." Phase 5's first task: assert the
  stub is gone before any real handler lands.

</specifics>

<deferred>
## Deferred Ideas

- **Refactoring `isBeadsManaged()` to delegate to `findBeadsRoot()`** —
  D-04 keeps them separate for v0.2. Future cleanup phase, after the
  read-handler suite stabilizes.
- **`regen-roadmap.sh` / `regen-requirements.sh` milestone filtering** —
  Phase 5 (roadmap.* read handlers) and Phase 6 (progress.* read handlers)
  own the script-level milestone filter wiring. Phase 4 only proves the
  STATE.md + seeder pattern that makes downstream filtering tractable.
- **Caching layer for read handlers** — Architecture research recommended
  no caching in v0.2 (one-shot per invocation); Phase 4 doesn't preclude
  caching but doesn't add it. Revisit in v0.3 if perf budget breached.
- **`disambiguate-bd-managed-detection.md`** — the broader detection-
  tightening todo (covered + documented in
  `.planning/todos/pending/`). Different problem; addresses the
  "gsd-beads ships .beads/ for vocabulary, not for state" mismatch.
  Out of v0.2 entirely.
- **`--update-snapshots` ergonomics** — whether the script is a
  separate `tests/scripts/update-snapshots.mjs` or an env var to the
  test runner (`UPDATE_SNAPSHOTS=1 node --test tests/shadow-tests/`).
  Plan-phase picks the cleanest option; either works.

</deferred>

---

*Phase: 4-findBeadsRoot-parity-test-infrastructure*
*Context gathered: 2026-04-29*
