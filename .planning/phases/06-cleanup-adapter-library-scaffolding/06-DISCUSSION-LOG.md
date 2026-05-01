# Phase 6: Cleanup + adapter-library scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or
> execution agents. Decisions are captured in CONTEXT.md — this log
> preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 6-cleanup-adapter-library-scaffolding
**Areas discussed:** Adapter class layout, Fork peer-dep mechanism, Test file split, format/phase.mjs scope

---

## Adapter class layout

### How should `src/adapter.mjs` organize the ~75 BeadsAdapter methods?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-cluster sub-modules | `src/adapter.mjs` thin shell composes 8 cluster files mirroring SYNTHESIS.md §4 boundaries; small per-PR diffs, parallel work easier | ✓ |
| Single mega-file | One adapter.mjs with all ~75 stubs; ~2000 lines; merge friction across Phases 7-13 | |
| Class-composition mixins | Base + applied mixins via `Object.assign(prototype, mixin)`; trickier for static analyzers | |

**User's choice:** Per-cluster sub-modules
**Notes:** Cluster files map to phase ownership: primitives.mjs (Phase 7), phaseLifecycle/roadmapMilestone (Phase 8), state (9), verifyReviews (10), discussTodos (11), longTail (12), initBundlers (13).

### What should each method stub do until implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| Throw with method name + phase pointer | `throw new Error('BeadsAdapter.addPhase: not implemented (Phase 8 / IMPL-01)')`; conformance tests can grep | ✓ |
| Throw plain `not implemented` | Terse but loses metadata | |
| Custom NotImplementedError subclass | `instanceof` checks possible; adds a file | |

**User's choice:** Throw with method name + phase pointer
**Notes:** Phase 7's conformance scaffolding can count remaining stubs by grep.

### When should the adapter validate bd availability?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy at first method call | Constructor stores projectRoot; `_ensureBd()` runs findBeadsRoot() on first use; matches CAP-01 SC #1 | ✓ |
| Eager in constructor | findBeadsRoot at construction; conflicts with CAP-01 (capabilities readable without instantiation) | |
| Explicit `init()` method | Consumers call `await adapter.init()`; extra step | |

**User's choice:** Lazy at first method call
**Notes:** Inherits the `disambiguate-bd-managed-detection.md` todo's planned resolution path.

### Where does the static `capabilities` flag live?

| Option | Description | Selected |
|--------|-------------|----------|
| Static class property | `BeadsAdapter.capabilities = {...}`; readable without instantiation | ✓ |
| Exported const + class re-export | Both ways exposed; slight redundancy | |
| Separate file `capabilities.mjs` | Versioned cleanly; overkill for ~10 lines | |

**User's choice:** Static class property

### How should cluster sub-modules bind to the class?

| Option | Description | Selected |
|--------|-------------|----------|
| `Object.assign(BeadsAdapter.prototype, ...clusters)` | Each cluster exports plain method-bag object; one-line registration in shell | ✓ |
| Class fields with static dispatchers | One-line wrapper per method; cleaner stack traces | |
| Single class with import-and-extend chain | 9-10 levels of extends; doesn't fit JS well | |

**User's choice:** `Object.assign(BeadsAdapter.prototype, ...)`

---

## Fork peer-dep mechanism

### How should `package.json` declare the in-flight fork dependency?

| Option | Description | Selected |
|--------|-------------|----------|
| `peerDependencies: "*"` + npm-link convention | Doesn't pin path or claim version that doesn't exist; tighten to `^1.0.0` once fork publishes | ✓ |
| `devDependencies: "file:../get-shit-done"` | Hard-codes relative path; breaks for contributors with different layout | |
| `devDependencies: "link:../get-shit-done"` | Same path-fragility but with symlink updates | |
| Defer entirely, no peer-dep until fork ships | Decouples Phase 6 from fork timeline; zero contract enforcement | |

**User's choice:** `peerDependencies: "*"` + npm-link convention
**Notes:** Document `npm link ../get-shit-done` in CONTRIBUTING.md as the dev workflow. `peerDependenciesMeta.optional: true` so consumers without the fork don't error on install.

### What package name and exports map?

| Option | Description | Selected |
|--------|-------------|----------|
| `gsd-beads` + adapter-only export with submodules | Matches repo name; submodules `./bd`, `./helpers`, `./format/phase` for conformance access | ✓ |
| `@gsd/beads-adapter` scoped name | Forward-looking but PROJECT.md uses `gsd-beads` consistently; renaming is churn | |
| `gsd-beads` + flat single export | Cleaner public surface; blocks Phase 7+ tests from importing internals | |

**User's choice:** `gsd-beads` + adapter-only export with submodules
**Notes:** Version `1.0.0-alpha.0` starting Phase 6.

### engines / bin / install lifecycle?

| Option | Description | Selected |
|--------|-------------|----------|
| engines.node + zero bin/install | `>=20`; no bin entries per ARCH-05; no install/postinstall (CLEAN-04); scripts: test, test:unit, test:conformance, link:fork | ✓ |
| No engines, just scripts | More permissive; defer engines until needed | |
| Keep `bin` for CLI shim later | Reserves migration tool slot; contradicts ARCH-05 | |

**User's choice:** engines.node + zero bin/install
**Notes:** Test layout standardizes as `tests/unit/` + `tests/conformance/`.

---

## Test file split

### How should `tests/shadow-tests/` be split?

| Option | Description | Selected |
|--------|-------------|----------|
| Triage by what they test | (a) Handler-* tests archive (b) carry-forward primitive tests migrate to tests/unit/ re-importing src/ (c) parity infra archives (d) fixtures stay (e) seed-determinism + milestone-scoping migrate | ✓ |
| Archive everything wholesale, rebuild | Throws away ~hundreds of passing test cases | |
| Keep flat layout, rename in place | Conflicts with new test:unit / test:conformance script split | |

**User's choice:** Triage by what they test

### Where does `findBeadsRoot()` live in `src/`?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract logic to `src/bd/findRoot.mjs` | Verbatim copy from `bin/gsd-sdk-shadow.mjs:236-281`; existing test relocates to tests/unit/ | ✓ |
| Re-export from archived shadow | Couples src/ to archive/; defeats cleanup | |
| Re-derive cleanly from spec | Loses Phase 4's worktree-fixture-validated behavior | |

**User's choice:** Extract logic to `src/bd/findRoot.mjs`

### `scripts/cascade-loop.sh` and `hooks/worktree-post-checkout.sh` disposition?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as shell scripts in src/bd/ | Preserves carry-forward semantics; Phase 8 may JS-rewrite cascade later | |
| Keep cascade in scripts/, archive worktree-post-checkout | Splits primitives across locations | |
| Archive both | Cleanest archive boundary; Phase 8 JS-rewrites cascade as src/bd/cascade.mjs; multi-worktree drops as feature | ✓ |

**User's choice:** Archive both
**Notes:** OVERRIDES REQUIREMENTS.md CLEAN-03 (which originally said cascade-loop stays). Phase 6 plan must include a task to edit REQUIREMENTS.md to reflect this override. Phase 8 will JS-rewrite cascade-loop into `src/bd/cascade.mjs` when wiring `completePhaseAndCascade`.

### `tests/{e2e,hook-tests,install-tests,cross-worktree,worktree-tests}/`?

| Option | Description | Selected |
|--------|-------------|----------|
| Archive all five wholesale | Each depends on shadow/hooks/install live; findBeadsRoot test already covers worktree-symlink path | ✓ |
| Archive 4, salvage worktree-tests | Burden of extracting fixture without harness | |
| Defer to Phase 7 conformance design | Risks confused contributors seeing ~50 failing tests | |

**User's choice:** Archive all five wholesale

---

## format/phase.mjs scope

### Minimum bidirectional surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Title + Description body | parsePhaseTitle/formatPhaseTitle + parsePhaseDescription/formatPhaseDescription; covers what Phase 8 needs to round-trip ROADMAP.md entries through bd | ✓ |
| Title only | Defers description parsing to Phase 8; risks half-finished module | |
| Title + Description + Plan list | Adds parsePhasePlanList; Phase 8 derives plans from bd children anyway, not markdown view | |

**User's choice:** Title + Description body
**Notes:** Description structure: `{ goal, depends_on, requirements, success_criteria, tail }`. The `tail` field captures opaque trailing content (Plans: list etc.) for byte-equal round-trip without structural parsing.

### Round-trip equality contract?

| Option | Description | Selected |
|--------|-------------|----------|
| `parse(format(parse(body))) === parse(body)` | Idempotent canonical form; format normalizes whitespace; standard markdown round-trip contract | ✓ |
| Strict `format(parse(body)) === body` | Requires preserving insignificant whitespace; brittle | |
| Both directions, separate tests | Heavier Phase 6 work | |

**User's choice:** `parse(format(parse(body))) === parse(body)`

### Property-test fixture?

| Option | Description | Selected |
|--------|-------------|----------|
| Current ROADMAP.md Phases 6-13 + curated edge cases | Real data + decimal phase, single-line goal, `Depends on: Nothing`, `Requirements: TBD`, missing Plans | ✓ |
| Curated edge cases only | Doesn't pull real ROADMAP; safer against churn but misses real-world quirks | |
| Generated via fast-check | Strongest contract; adds dev dependency; overkill for Phase 6 | |

**User's choice:** Current ROADMAP.md Phases 6-13 + curated edge cases

### Plans list parsing in Phase 6?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip Plans list — opaque trailing body | Captured as `tail` field; Phase 8's phasePlanIndex derives from bd children | ✓ |
| Parse Plans list now | Adds fifth field; misaligns with bd-source-of-truth principle | |

**User's choice:** Skip Plans list — opaque trailing body

---

## Claude's Discretion

- Exact `Object.assign` call format and import order in `src/adapter.mjs`
- `src/helpers/index.mjs` barrel re-export shape (named exports vs default object)
- `engines.node` exact version (>=20 unless plan-phase research reveals need for >=22)
- README.md and CLAUDE.md exact prose for DOC-01 / DOC-02
- archive/v0.2-shadow/README.md content explaining the archive
- Exact replacement text for REQUIREMENTS.md CLEAN-03 edit per D-12

## Deferred Ideas

- JS rewrite of cascade-loop.sh → `src/bd/cascade.mjs` (Phase 8)
- Multi-worktree feature reintroduction as opt-in helper (v1.1+)
- `gsd-sdk-cc.version.lock` retirement (when fork publishes)
- `fast-check` property-based testing dependency (consider in Phase 8 if format bugs surface)
- Adapter-internal structured logging strategy (defer to first phase that needs it)
- `tests/conformance/` runner discovery / naming convention (Phase 7)
- Cross-adapter conformance pairing with fork's MarkdownAdapter (Phase 13)
