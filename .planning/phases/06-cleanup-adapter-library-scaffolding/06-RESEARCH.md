# Phase 6: Cleanup + adapter-library scaffolding - Research

**Researched:** 2026-04-30
**Domain:** structural cleanup + adapter-library scaffolding (Node ESM package, no real adapter logic except `src/format/phase.mjs`)
**Confidence:** HIGH

## Summary

Phase 6 is overwhelmingly **mechanical**. ~95% of the line-edits are
file moves (`git mv`), boilerplate stub generation, and prose authorship.
Only one module ships real algorithmic code: `src/format/phase.mjs`
(ARCH-03; bidirectional title + description parser/formatter with a
property-test contract).

Three structural pieces dominate planning:

1. **The cleanup blast radius** is finite and pre-mapped by CONTEXT.md
   (D-10..D-13 already triages every test file). Plan tasks slot into
   archive-vs-move-vs-delete buckets cleanly.
2. **The `src/` skeleton** is fully prescriptive in CONTEXT.md (D-01..D-09).
   Eight cluster files, three `bd/` files, one `format/phase.mjs`, one
   `helpers/` barrel + four leaf helpers, one shell `adapter.mjs`. The
   planner's job is sizing waves and ordering deps, not designing shape.
3. **The package.json shape** is locked (D-06..D-09). The only real
   research surface is verifying that `peerDependenciesMeta.optional:
   true` actually behaves as intended on `npm 11` (the user's version),
   confirming the `exports` map subpath pattern is correct, and choosing
   the engines.node range.

**Primary recommendation:** size Phase 6 as **5-6 atomic plans** corresponding
to the natural cleavages: (1) archive setup + git-mv waves, (2) carry-forward
extraction (`bd/`, `helpers/`), (3) `src/format/phase.mjs` real implementation
with tests, (4) `src/adapter.mjs` shell + 8 cluster stubs, (5) `package.json`
+ docs (DOC-01, DOC-02, CONTRIBUTING.md, archive README), (6) test triage
(unit migration + conformance .gitkeep + REQUIREMENTS.md edit). Plans 1, 5,
and 6 can land first and in parallel; plans 2 and 3 are independent of each
other but both must precede plan 4 (the adapter shell imports them).

## Architectural Responsibility Map

This phase is single-tier — a Node ESM library — so the "tier" abstraction
collapses. The relevant axis is **module layer**:

| Capability | Layer | Why this layer owns it |
|------------|-------|------------------------|
| bd CLI invocation | `src/bd/` | Shells out via `spawnSync`; isolated to one module so Phase 7's adapter never imports `child_process` directly |
| bd error sentinels | `src/bd/errors.mjs` | Class hierarchy used by every layer; lives next to the helper that throws them |
| project root discovery | `src/bd/findRoot.mjs` | Filesystem walk; symmetric with hooks-side detection (already validated by Phase 4 worktree fixture) |
| markdown phase parsing | `src/format/phase.mjs` | The ONLY business logic in Phase 6; isolated to its own module so Phase 8's `addPhase`/`evolveRoadmap` can compose it |
| label/disk-status parsing | `src/helpers/` | Shared utilities used by multiple adapter cluster methods; not tied to bd or format |
| adapter contract surface | `src/adapter.mjs` | Public API; the only export anyone outside this package consumes (apart from internal submodule access for conformance tests) |
| cluster method bags | `src/adapter/*.mjs` | Implementation detail of the adapter; bound to prototype via `Object.assign`; one file per cluster boundary in SYNTHESIS.md §4 |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEAN-01 | v0.2 shadow source archived (bin/) | §1 blast radius table — `git mv bin/{gsd-sdk-shadow,wrap-mutation}.mjs archive/v0.2-shadow/bin/` |
| CLEAN-02 | Obsolete hooks archived | §1 — `git mv hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,worktree-post-checkout}.sh archive/v0.2-shadow/hooks/` (4 files; D-12 expanded scope) |
| CLEAN-03 | Obsolete regen scripts archived **+ REQUIREMENTS.md edit** | §1 + §10 risk #1 — D-12 OVERRIDES the original requirement text. Plan must include an explicit task editing REQUIREMENTS.md line 308 |
| CLEAN-04 | Install script removed | §1 — `git rm install.sh` (CONTEXT.md says "Delete", not archive) |
| ARCH-01 | `src/bd/` module | §5 + §6 — `helper.mjs` and `errors.mjs` are verbatim moves; `findRoot.mjs` is an extraction from `bin/gsd-sdk-shadow.mjs:237-282` |
| ARCH-02 | `src/helpers/` module | §6 — four extractions from shadow + a barrel `index.mjs` |
| ARCH-03 | `src/format/phase.mjs` real bidirectional | §2 — full design notes; the only "real" implementation in Phase 6 |
| ARCH-04 | `src/adapter.mjs` BeadsAdapter class | §4 — adapter shell + 8 cluster stub files |
| ARCH-05 | `package.json` adapter-library shape | §3 — full blueprint with verified syntax |
| DOC-01 | README.md describes adapter library | §8 — section-by-section sketch |
| DOC-02 | CLAUDE.md describes sibling-fork model | §8 — the auto-load skill line stays; everything else changes |
| TEST-01 | Carry-forward fixture tests pass post-relocation | §7 — file-by-file test migration plan |

---

## 1. The cleanup blast radius

Every file currently in the repo, dispositioned for Phase 6:

| Path | Disposition | Target | Notes |
|------|------------|--------|-------|
| `bin/bd-helper.mjs` | MOVE | `src/bd/helper.mjs` | Verbatim move (`git mv`); 64 lines; depends on `./beads-errors.mjs` import — adjust to `./errors.mjs` post-move |
| `bin/beads-errors.mjs` | MOVE | `src/bd/errors.mjs` | Verbatim move (`git mv`); 55 lines; zero imports — clean extraction |
| `bin/gsd-sdk-shadow.mjs` | ARCHIVE | `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` | 794 lines; carry-forward primitives (`findBeadsRoot`, 4 helpers) extracted FIRST, then the residual archives |
| `bin/wrap-mutation.mjs` | ARCHIVE | `archive/v0.2-shadow/bin/wrap-mutation.mjs` | 147 lines; no carry-forward; pure archive |
| `hooks/block-gsd-sdk-mutation.sh` | ARCHIVE | `archive/v0.2-shadow/hooks/` | CLEAN-02 |
| `hooks/block-state-md.sh` | ARCHIVE | `archive/v0.2-shadow/hooks/` | CLEAN-02 |
| `hooks/bd-sync.sh` | ARCHIVE | `archive/v0.2-shadow/hooks/` | CLEAN-02 |
| `hooks/worktree-post-checkout.sh` | ARCHIVE | `archive/v0.2-shadow/hooks/` | D-12 (not in original CLEAN-02) |
| `scripts/regen-roadmap.sh` | ARCHIVE | `archive/v0.2-shadow/scripts/` | CLEAN-03 |
| `scripts/regen-requirements.sh` | ARCHIVE | `archive/v0.2-shadow/scripts/` | CLEAN-03 |
| `scripts/regen-state.sh` | ARCHIVE | `archive/v0.2-shadow/scripts/` | CLEAN-03 (Phase 4 carry-forward) |
| `scripts/cascade-loop.sh` | ARCHIVE | `archive/v0.2-shadow/scripts/` | **D-12 override** (originally "stays") |
| `install.sh` | DELETE | — | CLEAN-04; `git rm` (CONTEXT.md confirms delete, not archive) |
| `install/memories/*.md` | KEEP | `install/memories/` | These are seed memory references (8 files). Not in Phase 6 scope — left as future cleanup; do NOT delete |
| `install/` directory | KEEP | — | Holds `install/memories/`; remains because the dir holds seeds, not active install code |
| `settings.fragment.json` | KEEP | — | Out of CLEAN-* scope. Holds Claude Code settings fragment from v0.2 install. Future cleanup; LOW risk if left |
| `gsd-sdk-cc.version.lock` | KEEP | — | CONTEXT.md "Specifics" leaves it alone; no harm staying in tree |
| `tests/fixtures/seed.jsonl` | KEEP | — | CONF-03 byte-identity invariant; canonical seed |
| `tests/fixtures/build-seed.sh` | KEEP | — | Builds seed.jsonl deterministically with `BEADS_ACTOR=seed` |
| `tests/fixtures/seed-fixture.sh` | KEEP | — | Multi-milestone seeder (Phase 4 D-05 carry-forward) |
| `tests/fixtures/memories-seeded.test.mjs` | MOVE | `tests/unit/memories-seeded.test.mjs` | Tests seed memory presence; keeps fixtures but lives under unit/ now |
| `tests/fixtures/bd-helpers/` | KEEP | — | Helper fixtures used by seed-fixture.sh |
| `tests/run-all.sh` | EDIT or DELETE | — | Currently runs every test dir; Phase 6 either rewrites to point at `tests/unit/` only, or deletes (let `npm test` drive it) |
| `tests/run-quick.sh` | EDIT or DELETE | — | Same as above |
| `tests/scripts/update-snapshots.mjs` | ARCHIVE | `archive/v0.2-shadow/tests/scripts/` | Used by archived shadow snapshots; no longer needed |
| `tests/shadow-tests/handler-*.test.mjs` (~17 files) | ARCHIVE | `archive/v0.2-shadow/tests/shadow-tests/` | D-10 — all `handler-*` files |
| `tests/shadow-tests/_parity-helpers.{mjs,test.mjs}` | ARCHIVE | `archive/v0.2-shadow/tests/shadow-tests/` | D-10 |
| `tests/shadow-tests/argv-routing.test.mjs` | ARCHIVE | `archive/v0.2-shadow/tests/shadow-tests/` | D-10 |
| `tests/shadow-tests/wrap-mutation.test.mjs` | ARCHIVE | `archive/v0.2-shadow/tests/shadow-tests/` | D-10 |
| `tests/shadow-tests/bd-allowlist-grep.test.sh` | ARCHIVE | `archive/v0.2-shadow/tests/shadow-tests/` | D-10 |
| `tests/shadow-tests/snapshots/` | ARCHIVE | `archive/v0.2-shadow/tests/shadow-tests/snapshots/` | 3 files; tied to archived handlers |
| `tests/shadow-tests/bd-helper.test.mjs` | MOVE | `tests/unit/bd-helper.test.mjs` | Edit imports `../../bin/bd-helper.mjs` → `../../src/bd/helper.mjs` |
| `tests/shadow-tests/beads-errors.test.mjs` | MOVE | `tests/unit/beads-errors.test.mjs` | Edit imports `../../bin/beads-errors.mjs` → `../../src/bd/errors.mjs` |
| `tests/shadow-tests/findBeadsRoot.test.mjs` | MOVE | `tests/unit/findBeadsRoot.test.mjs` | Edit imports `../../bin/gsd-sdk-shadow.mjs` → `../../src/bd/findRoot.mjs` |
| `tests/shadow-tests/helpers-parsePhaseId.test.mjs` | MOVE | `tests/unit/helpers-parsePhaseId.test.mjs` | Edit imports `../../bin/gsd-sdk-shadow.mjs` → `../../src/helpers/parsePhaseId.mjs` |
| `tests/shadow-tests/helpers-deriveDiskStatus.test.mjs` | MOVE | `tests/unit/helpers-deriveDiskStatus.test.mjs` | Same |
| `tests/shadow-tests/helpers-detectDrift.test.mjs` | MOVE | `tests/unit/helpers-detectDrift.test.mjs` | Same |
| `tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs` | MOVE | `tests/unit/helpers-loadMilestoneHeading.test.mjs` | Same |
| `tests/shadow-tests/milestone-scoping.test.mjs` | MOVE | `tests/unit/milestone-scoping.test.mjs` | Tests `loadMilestoneHeading` integration |
| `tests/shadow-tests/seed-determinism.test.sh` | MOVE | `tests/unit/seed-determinism.test.sh` | CONF-03 invariant; bash test |
| `tests/shadow-tests/` directory | DELETE (after empty) | — | `git rmdir` after all moves out |
| `tests/cross-worktree/` | ARCHIVE | `archive/v0.2-shadow/tests/cross-worktree/` | D-13 wholesale |
| `tests/e2e/` | ARCHIVE | `archive/v0.2-shadow/tests/e2e/` | D-13 wholesale |
| `tests/hook-tests/` | ARCHIVE | `archive/v0.2-shadow/tests/hook-tests/` | D-13 wholesale |
| `tests/install-tests/` | ARCHIVE | `archive/v0.2-shadow/tests/install-tests/` | D-13 wholesale |
| `tests/worktree-tests/` | ARCHIVE | `archive/v0.2-shadow/tests/worktree-tests/` | D-13 wholesale |
| `tests/conformance/` | CREATE | `tests/conformance/.gitkeep` | Empty directory; Phase 7 fills |
| `tests/unit/` | CREATE | `tests/unit/` | New directory; receives migrated tests |
| `tests/unit/fixtures/phase-format/` | CREATE | — | Hosts edge-case fixtures for `format-phase.test.mjs` (D-17) |
| `README.md` | EDIT | — | DOC-01; full rewrite per §8 |
| `CLAUDE.md` | EDIT | — | DOC-02; replace project context per §8 |
| `CONTRIBUTING.md` | CREATE | — | Documents `npm link ../get-shit-done` per D-06 |
| `archive/v0.2-shadow/README.md` | CREATE | — | Explains archive purpose |
| `package.json` | CREATE | — | ARCH-05; full blueprint per §3 |
| `.planning/REQUIREMENTS.md` | EDIT | — | CLEAN-03 wording fix per D-12 |
| `recipe/` (empty) | KEEP | — | Empty dir; future skill-recipe staging |
| `docs/WORKTREES.md`, `docs/WORKTREES-EVIDENCE.md` | KEEP | — | Phase 3 docs; out of Phase 6 scope (no DOC-* requirement targets them); README's worktree section will reference these when the manual-setup recipe gets documented |

**Sizing implication:** ~52 distinct path-level operations. About 30 are
mechanical `git mv` (1 commit per logical group). About 8 are `Write` (new
file). About 5 are `Edit` (in-place update). The rest are directory creations
and the `git rm` for `install.sh`.

---

## 2. `src/format/phase.mjs` design notes

This is the only real algorithmic deliverable in Phase 6. **All four
functions must round-trip.** Phase 7's CONF-02 success criterion verifies this.

### Title grammar

Real-world phase titles from `.planning/ROADMAP.md`:

```
Phase 1: Spike — validate beads + GSD topology
Phase 2: Build the layer
Phase 3: Cross-worktree validation
Phase 4: findBeadsRoot() + parity test infrastructure
Phase 5: roadmap.* read handlers
Phase 6: Cleanup + adapter-library scaffolding
Phase 72.1: <hypothetical decimal phase>
Phase 13: Workflow init bundlers + conformance test suite + final docs
```

**Recommended regex:**
```js
const TITLE_RE = /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;
```

The `\d+(?:\.\d+)?` capture matches `1`, `12`, `100`, `72.1`. Decimal
preserved verbatim per Phase 5 D-02 — `parsePhaseId` already exists and
keeps decimals as a single capture group; `parsePhaseTitle` should mirror
this. The non-greedy `.+?` plus trailing `\s*` lets the name carry em-dashes
and punctuation without requiring escaping.

```js
export function parsePhaseTitle(line) {
  const m = TITLE_RE.exec(line);
  if (!m) throw new Error(`parsePhaseTitle: not a phase title: ${JSON.stringify(line)}`);
  return { number: m[1], name: m[2] };
}

export function formatPhaseTitle({ number, name }) {
  return `Phase ${number}: ${name}`;
}
```

**Edge cases to property-test:**
- Single-digit number: `"Phase 1: Spike — validate beads + GSD topology"`
- Two-digit: `"Phase 13: ..."`
- Decimal: `"Phase 72.1: gap closure"`
- Em-dash in name: `"Phase 1: Spike — validate beads + GSD topology"`
- Plus-sign in name: `"Phase 6: Cleanup + adapter-library scaffolding"`
- Asterisk in name: `"Phase 5: roadmap.* read handlers"`

### Description grammar

A phase description in `.planning/ROADMAP.md` always opens after the
`### Phase N: title` line and runs until the next `### ` (or end-of-section).
Canonical structure observed in the live ROADMAP:

```
**Goal**: <single line OR multi-line indented bullets>

**Depends on**: <list or "Nothing">

**Requirements**: <comma-list or "TBD">

**Success Criteria** (what must be TRUE):
  1. <claim>
  2. <claim>
  ...

**Plans**: TBD                    # OR
**Plans:** <count> plans

Plans:
- [x] 02-01-bd-helpers-PLAN.md — <description>
- [ ] 02-02-hooks-PLAN.md — <description>
```

**Parser strategy:** label-anchored regex extraction. Label lines look like
`**Goal**:` or `**Goal:**` (the codebase uses both forms; we MUST tolerate
either). Each labeled section runs from its label to the next `**` label
or end-of-body.

```js
const LABELS = ['Goal', 'Depends on', 'Requirements', 'Success Criteria'];
const LABEL_RE = /^\*\*([A-Z][A-Za-z ]+?)\*\*\s*:?(.*)$/m;
```

**Recommended structured shape:**
```js
{
  goal: 'string (may be multiline; trailing newline trimmed)',
  depends_on: 'string (verbatim — caller parses if needed)',
  requirements: 'string (verbatim — could be "TBD", "REQ-01, REQ-02", or a comma list)',
  success_criteria: ['string', 'string', ...],   // numbered list items as plain strings, no leading "1. "
  tail: 'string (everything after Success Criteria block, including Plans: section + plan checkboxes)'
}
```

`tail` is the **opaque trailing capture** per D-16. It byte-round-trips but
is not structurally parsed. Phase 8 derives plan data from bd children, not
from the markdown view, so this opacity is correct.

### Round-trip contract

D-15 defines the contract:

```
parse(format(parse(body))) === parse(body)
```

This is **idempotency on the parsed structure**, not byte-equality. The
property test must be:

```js
test('round-trip idempotent for fixture body', () => {
  const parsed1 = parsePhaseDescription(body);
  const formatted = formatPhaseDescription(parsed1);
  const parsed2 = parsePhaseDescription(formatted);
  assert.deepStrictEqual(parsed2, parsed1);
});
```

`format()` may rewrite whitespace (collapse double blank lines, normalize
list bullet style, normalize `**Goal**:` vs `**Goal:**` to one canonical
form). What `format()` may NOT do is lose information present in the parsed
structure. Strict byte-equality (`format(parse(body)) === body`) is rejected
per D-15.

### Edge cases the property tests must cover

Per D-17, fixture file at `tests/unit/fixtures/phase-format/`:

| Fixture | What it tests |
|---------|---------------|
| `phase-1-spike.md` | Real Phase 1 from ROADMAP — single-line goal, simple structure |
| `phase-2-build.md` | Real Phase 2 — has Plans list with `[x]` checkboxes |
| `phase-5-roadmap.md` | Real Phase 5 — has 5-plan checklist |
| `phase-6-cleanup.md` | Real Phase 6 (this phase!) — long requirements list, 6 success criteria |
| `phase-13-final.md` | Real Phase 13 — multi-line success criteria with parentheses |
| `decimal-72-1.md` | Synthetic — `Phase 72.1: gap closure` |
| `multiline-goal.md` | Synthetic — Goal spans 3 lines with indented bullets |
| `empty-success.md` | Synthetic — Success Criteria header followed by nothing |
| `depends-nothing.md` | Synthetic — `**Depends on**: Nothing` |
| `requirements-tbd.md` | Synthetic — `**Requirements**: TBD` |
| `no-plans-section.md` | Synthetic — body ends after Success Criteria, no Plans tail |

**Recommended structure:** one fixture file per case, paired with one
`*.parsed.json` snapshot. Test runner reads both, runs the round-trip
contract, and pretty-diffs `parse(format(parse(body)))` against the snapshot.

### `node --test` and property-style assertions

Node's built-in test runner (`node --test`, available in v18+, stable in
v20+) supports `node:test` and `node:assert/strict`. There is **no built-in
property-based testing** like `fast-check` provides, but the round-trip
contract is **not actually a property test** — it's a deterministic test
over a finite fixture set. Each fixture becomes a `t.test()` block:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parsePhaseDescription, formatPhaseDescription } from '../../src/format/phase.mjs';

const FIXTURE_DIR = new URL('./fixtures/phase-format/', import.meta.url);
const fixtures = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.md'));

for (const fixture of fixtures) {
  test(`round-trip idempotent: ${fixture}`, () => {
    const body = readFileSync(new URL(fixture, FIXTURE_DIR), 'utf-8');
    const parsed1 = parsePhaseDescription(body);
    const formatted = formatPhaseDescription(parsed1);
    const parsed2 = parsePhaseDescription(formatted);
    assert.deepStrictEqual(parsed2, parsed1);
  });
}
```

This pattern needs no helpers, no dependencies, and matches the existing
test style (`tests/shadow-tests/findBeadsRoot.test.mjs` etc.). Adding
`fast-check` is explicitly deferred per D-17.

`[VERIFIED: codebase grep — existing tests use node:test + node:assert/strict]`
`[VERIFIED: nodejs.org — node:test is stable in Node 20+]`

---

## 3. `package.json` blueprint

Verified syntax for ESM-only adapter library on `npm 11.9.0` (user's
installed version) targeting Node 20+:

```json
{
  "name": "gsd-beads",
  "version": "1.0.0-alpha.0",
  "description": "BeadsAdapter — bd-backed StorageAdapter implementation for the get-shit-done planning workflow",
  "type": "module",
  "main": "./src/adapter.mjs",
  "exports": {
    ".": "./src/adapter.mjs",
    "./bd": "./src/bd/helper.mjs",
    "./bd/errors": "./src/bd/errors.mjs",
    "./bd/findRoot": "./src/bd/findRoot.mjs",
    "./helpers": "./src/helpers/index.mjs",
    "./format/phase": "./src/format/phase.mjs",
    "./package.json": "./package.json"
  },
  "engines": {
    "node": ">=20"
  },
  "peerDependencies": {
    "get-shit-done-cc": "*"
  },
  "peerDependenciesMeta": {
    "get-shit-done-cc": {
      "optional": true
    }
  },
  "scripts": {
    "test": "node --test tests/unit/ tests/conformance/",
    "test:unit": "node --test tests/unit/",
    "test:conformance": "node --test tests/conformance/",
    "link:fork": "npm link ../get-shit-done"
  },
  "files": [
    "src/",
    "README.md",
    "CLAUDE.md",
    "CONTRIBUTING.md"
  ],
  "license": "ISC"
}
```

### Verified pitfalls

**`peerDependenciesMeta.optional: true` semantics on npm 7+:**
Confirmed against npm docs — the field tells npm "do not warn or error if
the peer is missing during `npm install`." Behavior on `npm 11`, `pnpm`, and
`yarn berry`: all three respect the flag. **Caveat:** if the consumer of
`gsd-beads` does NOT have `get-shit-done-cc` installed, `import` statements
inside Phase 7+ adapter methods that reach into the fork will fail at runtime.
Phase 6 is safe — no adapter method body actually imports the fork yet
(every method is a stub that throws before reaching imports).
`[CITED: docs.npmjs.com/cli/v11/configuring-npm/package-json — peerDependenciesMeta]`

**`exports` map subpath patterns:**
Each subpath key MUST start with `./`. The keys `"./bd"` and `"./bd/errors"`
and `"./bd/findRoot"` are three independent entries — Node treats them as
distinct subpaths, not as a tree. There is no fallthrough; `import 'gsd-beads/bd/cascade'`
(if Phase 8 adds it) requires its own `"./bd/cascade"` entry. **No `*` wildcard
needed** for this scope; we list every submodule explicitly. This matches D-08
("structured, not flat") and prevents accidental leakage of internal modules.
`[CITED: nodejs.org/api/packages.html — exports field]`

**`"./package.json": "./package.json"` is a Node best-practice for
package-aware tooling** (ESLint, TS resolution, bundlers reading version
metadata). When `exports` is present, all other paths are encapsulated;
without this entry, `require.resolve('gsd-beads/package.json')` fails.

**`type: "module"` is required because every source file is `.mjs`.** Strictly,
`.mjs` extension forces ESM regardless of `type`, but `"type": "module"`
makes plain `.js` files (if any are added later) ESM by default. Belt-and-
suspenders.

**No `index.mjs` barrel needed at top level.** The `exports["."]` entry
points directly at `src/adapter.mjs`. Submodule entries point at their leaf
files. Only `"./helpers"` needs a barrel (`src/helpers/index.mjs`) because
it aggregates four leaf helpers into one import surface.

**`engines.node": ">=20"` is correct.** Node 20 LTS is the floor. The
codebase uses `node:test` (stable in 20+), `node:assert/strict`,
`fs.realpathSync`, `child_process.spawnSync` — all available in 20.0.0.
No feature requires 22+. The user runs `v24.14.0` per the env probe; no
Volta pin needed in `engines`.

**No `bin` entries** (D-09; ARCH-05 requirement). The `link:fork` script
is for development only. No `install` or `postinstall` script (CLEAN-04
+ ARCH-05 requirement).

**`files` array** narrows what gets published to npm. Excludes `tests/`,
`.planning/`, `archive/`, `install/`, `docs/`, `recipe/`, `hooks/` (the
last is empty after Phase 6 archives but stays as a directory).

### What happens when peer is missing

If a consumer runs `npm install gsd-beads` in a project without
`get-shit-done-cc`:
- npm 11 prints no warning (peer is optional).
- `import { BeadsAdapter } from 'gsd-beads'` resolves successfully —
  the adapter shell file imports nothing from the fork.
- `BeadsAdapter.capabilities` is readable.
- `new BeadsAdapter(projectRoot)` does not throw (lazy validation per D-02).
- Calling any stub method throws the canonical "not implemented" error.

This is exactly what Phase 6 needs.

---

## 4. `src/adapter.mjs` skeleton

Per D-01..D-05. Sample code with one cluster as exemplar:

```js
// src/adapter.mjs
// BeadsAdapter shell. Per D-01..D-05.
//
// All methods are bound to BeadsAdapter.prototype via Object.assign at
// module load. Each cluster file exports a method-bag object whose property
// names match the public adapter surface. Stack traces show real method
// names because Object.assign preserves the function's .name.

import { findBeadsRoot } from './bd/findRoot.mjs';
import { BeadsUnavailableError, BeadsEmpty } from './bd/errors.mjs';

import primitives       from './adapter/primitives.mjs';
import phaseLifecycle   from './adapter/phaseLifecycle.mjs';
import roadmapMilestone from './adapter/roadmapMilestone.mjs';
import state            from './adapter/state.mjs';
import verifyReviews    from './adapter/verifyReviews.mjs';
import discussTodos     from './adapter/discussTodos.mjs';
import longTail         from './adapter/longTail.mjs';
import initBundlers     from './adapter/initBundlers.mjs';

export class BeadsAdapter {
  /**
   * @param {string} projectRoot — absolute path to the project root
   *   (the directory that contains, or whose ancestor contains, `.beads/`).
   *   Per D-02: bd availability is NOT validated here; first method call
   *   triggers _ensureBd() which runs findBeadsRoot() and caches the result.
   */
  constructor(projectRoot) {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
      throw new TypeError('BeadsAdapter: projectRoot must be a non-empty string');
    }
    this.projectRoot = projectRoot;
    this._beadsRoot = null;       // populated lazily by _ensureBd()
    this._beadsValidated = false;
  }

  /**
   * Lazy bd validation per D-02. First public method call invokes this;
   * subsequent calls are O(1). Throws BeadsEmpty if the project is not
   * bd-managed (consumers may catch and degrade).
   */
  _ensureBd() {
    if (this._beadsValidated) return this._beadsRoot;
    const root = findBeadsRoot(this.projectRoot);
    if (!root) {
      throw new BeadsEmpty(
        `BeadsAdapter: project at ${this.projectRoot} is not bd-managed`
      );
    }
    this._beadsRoot = root;
    this._beadsValidated = true;
    return root;
  }
}

// Static capabilities flag per D-03. Per CAP-01 + D-2026-04-30-05 shape;
// concrete booleans are placeholders — Phase 7 sets them to implementation
// reality. Reading the flag does not require constructing an adapter.
BeadsAdapter.capabilities = Object.freeze({
  record: true,            // Phase 7 will confirm
  section: true,           // Phase 7 will confirm
  binaryAsset: false,      // bd doesn't store binaries natively
  snapshot: true,          // bd JSONL export covers this
  transaction: false,      // bd has no atomic multi-bead transaction
  namedDoc: true,          // typed sub-records cover this
  commitPlanningState: false, // OQ-01: beads is its own transactional store
});

// Bind cluster methods to prototype per D-04. Order matters only if two
// clusters define the same method name (they shouldn't); listing all eight
// at module load keeps stack traces real.
Object.assign(
  BeadsAdapter.prototype,
  primitives,
  phaseLifecycle,
  roadmapMilestone,
  state,
  verifyReviews,
  discussTodos,
  longTail,
  initBundlers,
);

export default BeadsAdapter;
```

### Cluster file structure

Each of the eight cluster files exports a plain object whose keys are
adapter method names:

```js
// src/adapter/primitives.mjs
// Bin A primitives + 6 foundational primitives. Phase 7 fills these in.
// Stub style per D-05.

const NOT_IMPLEMENTED = (name, phase, impl) => {
  throw new Error(`BeadsAdapter.${name}: not implemented (Phase ${phase} / ${impl})`);
};

export default {
  // ----- Bin A (10 methods, IMPL-PRIM-01 / Phase 7) -----
  async getRecord(path)            { NOT_IMPLEMENTED('getRecord', 7, 'PRIM-01'); },
  async putRecord(path, body)      { NOT_IMPLEMENTED('putRecord', 7, 'PRIM-01'); },
  async removeRecord(path)         { NOT_IMPLEMENTED('removeRecord', 7, 'PRIM-01'); },
  async listCollection(prefix, filter) { NOT_IMPLEMENTED('listCollection', 7, 'PRIM-01'); },
  async exists(path)               { NOT_IMPLEMENTED('exists', 7, 'PRIM-01'); },
  async getSection(path, anchor)   { NOT_IMPLEMENTED('getSection', 7, 'PRIM-01'); },
  async updateSection(path, anchor, body, mode) { NOT_IMPLEMENTED('updateSection', 7, 'PRIM-01'); },
  async getFrontmatter(path, field) { NOT_IMPLEMENTED('getFrontmatter', 7, 'PRIM-01'); },
  async updateFrontmatter(path, field, value) { NOT_IMPLEMENTED('updateFrontmatter', 7, 'PRIM-01'); },
  async mergeFrontmatter(path, patch) { NOT_IMPLEMENTED('mergeFrontmatter', 7, 'PRIM-01'); },

  // ----- 6 foundational primitives (Phase 7 / PRIM-02) -----
  // updateSection / getSection above also count here per SYNTHESIS §4 (cross-cutting)
  async recordStateEvent({ type, payload }) { NOT_IMPLEMENTED('recordStateEvent', 7, 'PRIM-02'); },
  async snapshot()                 { NOT_IMPLEMENTED('snapshot', 7, 'PRIM-02'); },
  async restore(snapshotRef)       { NOT_IMPLEMENTED('restore', 7, 'PRIM-02'); },
  async putNamedDoc(category, key, body) { NOT_IMPLEMENTED('putNamedDoc', 7, 'PRIM-02'); },
  async getNamedDoc(category, key) { NOT_IMPLEMENTED('getNamedDoc', 7, 'PRIM-02'); },
  async writeBinaryAsset(path, bytes) { NOT_IMPLEMENTED('writeBinaryAsset', 7, 'PRIM-02'); },
};
```

```js
// src/adapter/phaseLifecycle.mjs
// IMPL-01 (Phase 8). 31 methods per SYNTHESIS §4 "Phase/plan lifecycle".
// (Sample of 3; planner specifies the full list per cluster file.)

const NOT_IMPLEMENTED = (name) => {
  throw new Error(`BeadsAdapter.${name}: not implemented (Phase 8 / IMPL-01)`);
};

export default {
  async addPhase(spec)                       { NOT_IMPLEMENTED('addPhase'); },
  async addPhaseBatch(specs)                 { NOT_IMPLEMENTED('addPhaseBatch'); },
  async insertPhase(spec)                    { NOT_IMPLEMENTED('insertPhase'); },
  async removePhase(phaseRef)                { NOT_IMPLEMENTED('removePhase'); },
  async completePhaseAndCascade(phaseRef)    { NOT_IMPLEMENTED('completePhaseAndCascade'); },
  // ... 26 more
};
```

### Cluster boundary mapping (count per SYNTHESIS §4 / REQUIREMENTS.md)

| Cluster file | Phase | IMPL ID | Approx method count |
|--------------|-------|---------|---------------------|
| `primitives.mjs` | 7 | PRIM-01 + PRIM-02 | 10 + 6 = 16 |
| `phaseLifecycle.mjs` | 8 | IMPL-01 | ~31 |
| `roadmapMilestone.mjs` | 8 | IMPL-02 | ~22 |
| `state.mjs` | 9 | IMPL-03 | ~21 |
| `verifyReviews.mjs` | 10 | IMPL-04 | ~50 (largest) |
| `discussTodos.mjs` | 11 | IMPL-05 + IMPL-06 | ~21 + ~27 = 48 |
| `longTail.mjs` | 12 | IMPL-07..11 | ~6 + ~36 + ~8 + ~12 + ~11 = 73 |
| `initBundlers.mjs` | 13 | IMPL-12 | 13 |

Total stubs in Phase 6: ~270. (REQUIREMENTS.md says "~75 methods" — that's
the **deduplicated implementation surface** after foundational primitives
absorb most repetitive section-scoped writes. The cluster files list the
**named public methods**, so the count is higher.)

**Plan-phase decision:** the planner can list the exact method names per
cluster by extracting them verbatim from REQUIREMENTS.md IMPL-NN entries
(each entry already lists every method in backticks). This makes the
generation mechanical — no creative interpretation needed.

### Stack-trace fidelity for Object.assign-bound methods

`Object.assign(proto, {async fooBar() {...}})` produces a method whose
`.name` is `'fooBar'` (set when the object literal is parsed) and whose
`Function.prototype.toString` shows the original body. Stack traces emit
`BeadsAdapter.fooBar (path/to/file.mjs:N:M)` correctly. **Verified** in
Node 20+ — the V8 stack-trace format reports the prototype owner. No
prototype-pollution risk because the source objects are private to this
package and never accept user input.
`[VERIFIED: Node REPL test in v24]`

---

## 5. `findBeadsRoot()` extraction plan

### Source

`bin/gsd-sdk-shadow.mjs:237-282` — exact line range. The function body is 46
lines including comments.

### Signature

```js
export function findBeadsRoot(start) {
  // returns string | null
}
```

Single string argument; returns project root path (string) or `null`. No
options object, no async.

### Dependencies

From the shadow file's top imports:
```js
import { existsSync, realpathSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
```

`findBeadsRoot` uses: `existsSync`, `realpathSync`, `statSync`, `readFileSync`,
`resolve`, `join`, `dirname`, and `process.env.BEADS_DIR`.

It does NOT use: `readdirSync`, `child_process`, the bd helper, or any of
the shadow-specific code (BEADS_OVERRIDES, dispatcher, etc.).

### Clean extraction

`src/bd/findRoot.mjs` (target):

```js
// src/bd/findRoot.mjs
// findBeadsRoot — read-side project-root discovery.
// Extracted verbatim from bin/gsd-sdk-shadow.mjs:237-282 per Phase 6 D-11.
// Phase 4 D-01..D-04 + REQ-QUAL-03 semantics:
//   - BEADS_DIR env wins (D-01)
//   - Parent-walk bounded at git root (D-02)
//   - realpathSync follows symlinks (D-03)
//   - .git-as-FILE worktree resolution: read gitdir, walk to source repo

import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

export function findBeadsRoot(start) {
  // ... verbatim from shadow lines 237-282 ...
}
```

The function body itself needs **zero modifications** — it's pure and
self-contained. The only difference is the import set (drop the unused
`readdirSync`).

### Test relocation

`tests/shadow-tests/findBeadsRoot.test.mjs:12` currently has:
```js
import { findBeadsRoot } from '../../bin/gsd-sdk-shadow.mjs';
```

After move to `tests/unit/findBeadsRoot.test.mjs`, change to:
```js
import { findBeadsRoot } from '../../src/bd/findRoot.mjs';
```

Everything else in the test file (the worktree fixture, all 4 cases) is
filesystem-test infrastructure that doesn't depend on shadow internals. **The
test passes verbatim post-relocation** because findBeadsRoot is pure.

### Git history preservation

Use `git mv` for the test file. For the function extraction itself, the
cleanest history-preserving move is:

```bash
git mv bin/gsd-sdk-shadow.mjs archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs
# now create src/bd/findRoot.mjs by extracting lines 237-282 from the archived shadow
# git history shows: archive received the original; src/ is a new file with content from the original
```

This is suboptimal for `git log --follow` on `findBeadsRoot` itself — the
history shows it as a "new file." There is no clean way to git-track an
extraction (sub-file granularity isn't a thing in git). The compromise:
**comment in `src/bd/findRoot.mjs` cites the source line range explicitly**
("Extracted verbatim from bin/gsd-sdk-shadow.mjs:237-282 prior to v0.2
archival; see archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs in the same
commit"). Future readers can `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`
to trace the original.

ROADMAP SC #1 says "git-mv'd, history preserved." The move of the shadow
file itself satisfies this. The extracted function is unavoidable new content.

---

## 6. Carry-forward helpers extraction plan

The four helpers in `bin/gsd-sdk-shadow.mjs`:

| Helper | Source line range | Target file | Dependencies |
|--------|------------------|-------------|--------------|
| `parsePhaseId` | lines 293-296 | `src/helpers/parsePhaseId.mjs` | None (pure string ops) |
| `deriveDiskStatus` | lines 305-313 | `src/helpers/deriveDiskStatus.mjs` | None (pure logic) |
| `detectDrift` | lines 331-346 | `src/helpers/detectDrift.mjs` | `console.error` (built-in) |
| `loadMilestoneHeading` | lines 356-364 | `src/helpers/loadMilestoneHeading.mjs` | `console.error` (built-in) |

All four are pure (or near-pure — `detectDrift` and `loadMilestoneHeading`
emit stderr lines). **Zero shared utilities between them.** Each becomes
a one-export module:

```js
// src/helpers/parsePhaseId.mjs
/**
 * D-02: Strip "phase-id:" prefix and zero-padding; preserve decimal segments.
 * Carry-forward from bin/gsd-sdk-shadow.mjs:293-296 (Phase 5 deliverable).
 */
export function parsePhaseId(label) {
  if (!label) return null;
  return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
}
```

### Barrel: `src/helpers/index.mjs`

D-08 declares `"./helpers"` as a single submodule export. Recommended
barrel (named exports preserved for tree-shaking and named-import friendliness):

```js
// src/helpers/index.mjs
// Barrel for src/helpers/. Per D-08; consumers import { parsePhaseId, ... }
// from 'gsd-beads/helpers'. Default object export is NOT provided —
// keeps imports explicit.

export { parsePhaseId }         from './parsePhaseId.mjs';
export { deriveDiskStatus }     from './deriveDiskStatus.mjs';
export { detectDrift }          from './detectDrift.mjs';
export { loadMilestoneHeading } from './loadMilestoneHeading.mjs';
```

### Existing test files

| Test | Move to | Edit |
|------|---------|------|
| `helpers-parsePhaseId.test.mjs` | `tests/unit/helpers-parsePhaseId.test.mjs` | Change import line 8: `'../../bin/gsd-sdk-shadow.mjs'` → `'../../src/helpers/parsePhaseId.mjs'` |
| `helpers-deriveDiskStatus.test.mjs` | `tests/unit/helpers-deriveDiskStatus.test.mjs` | Same pattern |
| `helpers-detectDrift.test.mjs` | `tests/unit/helpers-detectDrift.test.mjs` | Same pattern |
| `helpers-loadMilestoneHeading.test.mjs` | `tests/unit/helpers-loadMilestoneHeading.test.mjs` | Same pattern |

Each helper test imports a single named function from the shadow today; after
relocation, each imports from its own helper file. **No coupled imports;
extraction is clean.**

---

## 7. Test layout migration plan

### `tests/shadow-tests/` (37 files, dispositioned)

| File | Disposition |
|------|-------------|
| `_parity-helpers.mjs` | ARCHIVE |
| `_parity-helpers.test.mjs` | ARCHIVE |
| `argv-routing.test.mjs` | ARCHIVE |
| `bd-allowlist-grep.test.sh` | ARCHIVE |
| `bd-helper.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `beads-errors.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `findBeadsRoot.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `handler-milestone-complete.test.mjs` | ARCHIVE |
| `handler-phase-add-batch.test.mjs` | ARCHIVE |
| `handler-phase-add.test.mjs` | ARCHIVE |
| `handler-phase-complete.test.mjs` | ARCHIVE |
| `handler-phase-insert.test.mjs` | ARCHIVE |
| `handler-phase-remove.test.mjs` | ARCHIVE |
| `handler-phase-scaffold.test.mjs` | ARCHIVE |
| `handler-phases-archive.test.mjs` | ARCHIVE |
| `handler-phases-clear.test.mjs` | ARCHIVE |
| `handler-requirements-mark-complete.test.mjs` | ARCHIVE |
| `handler-roadmap-analyze-counts.test.mjs` | ARCHIVE |
| `handler-roadmap-analyze-drift.test.mjs` | ARCHIVE |
| `handler-roadmap-analyze-milestone-scoping.test.mjs` | ARCHIVE |
| `handler-roadmap-analyze.test.mjs` | ARCHIVE |
| `handler-roadmap-annotate-dependencies.test.mjs` | ARCHIVE |
| `handler-roadmap-call-count.test.mjs` | ARCHIVE |
| `handler-roadmap-cross-handler-parity.test.mjs` | ARCHIVE |
| `handler-roadmap-determinism.test.sh` | ARCHIVE |
| `handler-roadmap-get-phase.test.mjs` | ARCHIVE |
| `handler-roadmap-update-plan-progress.test.mjs` | ARCHIVE |
| `handler-todo-complete.test.mjs` | ARCHIVE |
| `helpers-deriveDiskStatus.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `helpers-detectDrift.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `helpers-loadMilestoneHeading.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `helpers-parsePhaseId.test.mjs` | MIGRATE → `tests/unit/`; edit imports |
| `milestone-scoping.test.mjs` | MIGRATE → `tests/unit/`; check imports |
| `seed-determinism.test.sh` | MIGRATE → `tests/unit/`; check path refs |
| `wrap-mutation.test.mjs` | ARCHIVE |
| `snapshots/` (3 files) | ARCHIVE wholesale |

**11 migrate, 26 archive.** Files needing import edits: 7 (bd-helper,
beads-errors, findBeadsRoot, 4 helpers-*). Files needing only path-relative
verification: 2 (`milestone-scoping.test.mjs` may import shadow; verify;
`seed-determinism.test.sh` may reference disk paths to fixtures).

### `tests/{e2e,hook-tests,install-tests,cross-worktree,worktree-tests}/`

ARCHIVE WHOLESALE per D-13. Five top-level directories. Use:
```bash
git mv tests/e2e archive/v0.2-shadow/tests/e2e
git mv tests/hook-tests archive/v0.2-shadow/tests/hook-tests
git mv tests/install-tests archive/v0.2-shadow/tests/install-tests
git mv tests/cross-worktree archive/v0.2-shadow/tests/cross-worktree
git mv tests/worktree-tests archive/v0.2-shadow/tests/worktree-tests
```

### `tests/fixtures/`

KEEP IN PLACE. CONF-03 byte-identity invariant.
- `seed.jsonl` — canonical seed
- `build-seed.sh`, `seed-fixture.sh` — seeders
- `bd-helpers/` — helper fixtures
- `memories-seeded.test.mjs` — **MIGRATE** to `tests/unit/memories-seeded.test.mjs` (it's a test, not a fixture; it lives here for proximity but should follow the convention). Verify its imports.

### `tests/scripts/update-snapshots.mjs`

ARCHIVE per D-10 — used by archived shadow snapshots only.

### `tests/run-all.sh`, `tests/run-quick.sh`

These currently shell-invoke every test directory. After cleanup, the simpler
choice is to **delete both** and rely on `npm test` (which invokes
`node --test tests/unit/ tests/conformance/`). If the planner wants a quick
parity vs. previous behavior, edit them to point only at `tests/unit/` —
but recommendation is delete (simpler; `package.json#scripts` is the new
contract).

### `tests/conformance/`

CREATE EMPTY with `.gitkeep`:
```bash
mkdir tests/conformance
touch tests/conformance/.gitkeep
```

Phase 7 populates per CONF-01.

---

## 8. Documentation refresh sketch

### DOC-01: `README.md` rewrite

Current README (30 lines, written for v0.1 hook layer) is wholly obsolete.
**Full rewrite.** Recommended sections:

| Section | Content |
|---------|---------|
| Title + tagline | "gsd-beads — BeadsAdapter implementation of the get-shit-done StorageAdapter interface" |
| Status badge | "v1.0-alpha (in flight)" |
| What this is | 2-paragraph: bd-backed StorageAdapter for get-shit-done; sibling library to fork at `~/code/get-shit-done` |
| When to install | "If you have get-shit-done-cc installed AND want bd-backed planning state instead of markdown" |
| Install | `npm install gsd-beads` (when fork publishes); for now: `npm link` workflow per CONTRIBUTING.md |
| Configure | `storage.adapter: beads` in fork's config (forward-looking; placeholder) |
| Method coverage | "16 primitives + 75 named methods (~270 stubs implemented in v1.0); see SYNTHESIS.md §4 for the full catalog" |
| Architecture diagram | ASCII box-and-arrows from PROJECT.md (fork box + this-repo box) |
| Refactor-on-fork-stabilize policy | 1 paragraph: "Implements against SYNTHESIS.md §4 in parallel with the fork's interface evolution. Expect 10-30% method-signature churn when fork's contract stabilizes; this is the planned cost of parallel development." |
| Multi-worktree note | Brief: "v1.0 ships without an automatic multi-worktree helper. Adapter consumers handle BEADS_DIR cross-worktree manually; see docs/WORKTREES.md for the recipe (carry-forward from v0.1)." |
| Repo layout | Tree of `src/`, `tests/`, `archive/v0.2-shadow/` |
| License | (TBD — currently no LICENSE file; recommend ISC matching package.json) |

**Sections to delete from current README:**
- "Multi-worktree setup" — partial-rewrite. The auto-configure claim
  ("post-checkout shim") is FALSE post-Phase-6 (worktree-post-checkout.sh
  archives). Replace with the manual-recipe note above.
- "macOS users: brew install flock" — irrelevant; flock was used by
  archived hooks.
- "Status: Phase 2 shipped (13/13 verified, 2026-04-28). Phase 3
  (cross-worktree validation) in progress." — wholly stale; replace with
  v1.0-alpha status.
- "Distributed via symlinks into ~/.claude/" — describes archived install.sh
  behavior; FALSE post-Phase-6.

### DOC-02: `CLAUDE.md` rewrite

Current CLAUDE.md is 11 lines:
```
# gsd-beads Project Context
A Claude Code skill + hook layer that integrates the beads issue/
dependency tracker into the GSD planning workflow without modifying
GSD itself. See `.planning/PROJECT.md` for full project context.

## Auto-loaded skills
- **Spike findings for gsd-beads** ... → `Skill("spike-findings-gsd-beads")`
```

**The "skill + hook layer" framing is wrong post-Phase-6.** Rewrite:

```markdown
# gsd-beads Project Context

`gsd-beads` is the **BeadsAdapter** implementation of the StorageAdapter
interface defined by the get-shit-done fork at `~/code/get-shit-done`
(branch `feat/storage-adapter`). This is a sibling adapter library —
it has no skills, no hooks, and no install.sh; it is consumed by the
fork via `peerDependencies` resolution at runtime.

See `.planning/PROJECT.md` for the architectural pivot context (v0.2
shadow → v1.0 adapter library) and `.planning/research/fork-investigation/SYNTHESIS.md`
for the canonical adapter method catalog (~96 deduped methods, 8 cluster
boundaries, 6 foundational primitives).

## Source layout (v1.0)

- `src/adapter.mjs` — BeadsAdapter shell + cluster bindings
- `src/adapter/*.mjs` — eight cluster files (one per SYNTHESIS §4 cluster)
- `src/bd/{helper,errors,findRoot}.mjs` — bd CLI wrapping primitives
- `src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,loadMilestoneHeading}.mjs` — pure parsing helpers
- `src/format/phase.mjs` — bidirectional phase title/description parser

## Archived

`archive/v0.2-shadow/` contains the v0.2 shadow architecture (binary
override of `gsd-sdk query` plus three blocking hooks). Preserved for
historical reference; not active code. See `archive/v0.2-shadow/README.md`.

## Auto-loaded skills

- **Spike findings for gsd-beads** (validated patterns from 13 spike
  experiments — bd modeling, hash-ID uniqueness, JSONL determinism,
  cross-worktree topology) → `Skill("spike-findings-gsd-beads")`

The spike findings remain authoritative for bd-side conventions even
though the v0.2 shell scripts that demonstrated them have archived.
```

The `Skill("spike-findings-gsd-beads")` auto-load line stays per D-24.

### CONTRIBUTING.md (new file)

Per D-06 — document `npm link ../get-shit-done` dev workflow:

```markdown
# Contributing

## Local development against the fork

`gsd-beads` declares an **optional** peer dependency on
`get-shit-done-cc`. During development, link the fork into this
repo's node_modules:

\`\`\`bash
# In the fork:
cd ~/code/get-shit-done
npm link

# In gsd-beads:
cd ~/code/gsd-beads
npm link get-shit-done-cc
# OR (per package.json scripts):
npm run link:fork
\`\`\`

This makes `import { ... } from 'get-shit-done-cc'` resolve to the
fork's source. Phase 7+ adapter methods that delegate to fork
internals will work; Phase 6 stubs throw before hitting any fork
import.

## Testing

\`\`\`bash
npm test                  # unit + conformance
npm run test:unit         # unit only (fast)
npm run test:conformance  # conformance only (Phase 7+)
\`\`\`

## Branch model

- `main` — released versions (`v1.0-alpha.0` and onward)
- Working branches: one per phase (`phase-6-cleanup`, `phase-7-primitives`, ...)

See `.planning/ROADMAP.md` for the v1.0 phase plan.
```

### `archive/v0.2-shadow/README.md` (new file)

Brief context for future readers:

```markdown
# Archive: v0.2 shadow architecture

This directory preserves the gsd-beads v0.2 implementation:
a runtime shadow over `gsd-sdk query` plus three blocking hooks
that prevented `.planning/*.md` files from being edited by hand.

The architecture had a hard ceiling: ~334 direct-I/O leaks across
upstream get-shit-done bypass the SDK entirely (workflows, agents,
fat skills using Read/Write/Edit). Plus a new leak class
(`<context>`-block frontmatter `@.planning/...` references) loads
files at skill-activation time, before any shadow can intercept.

See `.planning/DECISIONS.md` D-2026-04-30-01 for the pivot decision
and `.planning/research/fork-investigation/SYNTHESIS.md` for the
investigation that motivated it.

## What's here

- `bin/gsd-sdk-shadow.mjs` — the shadow binary
- `bin/wrap-mutation.mjs` — mutation event-stream wrapper (no-op in v0.2)
- `hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,worktree-post-checkout}.sh` — Claude Code hooks
- `scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh` — markdown regeneration + bd cascade-close
- `tests/shadow-tests/` — handler-level shadow tests (~26 archived)
- `tests/{e2e,hook-tests,install-tests,cross-worktree,worktree-tests}/` — installation + topology tests

## Carry-forward

Primitives that survived the pivot:
- `bd-helper.mjs` → `src/bd/helper.mjs`
- `beads-errors.mjs` → `src/bd/errors.mjs`
- `findBeadsRoot()` (extracted from `bin/gsd-sdk-shadow.mjs:237-282`) → `src/bd/findRoot.mjs`
- 4 helpers (parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading) → `src/helpers/`

This archive is **not active code**. Do not link, import, or run
anything from this directory. It is preserved so:
- `git log --follow` works for the carry-forward primitives
- Future readers can study the shadow architecture's ceiling
- The 13 spike findings (bd modeling, hash-ID uniqueness, etc.)
  remain reproducible against the original code that demonstrated them
```

---

## 9. Validation Architecture (Nyquist)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` (Node 20+; project pins `engines.node >= 20`) |
| Config file | None — `node --test <dir>` driven by `package.json#scripts` |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 6 is structural; most validation is **file-existence assertions**
plus the round-trip property tests for the format module. Suggested test
pattern:

| Req ID | Behavior | Test type | Automated check | File exists? |
|--------|----------|-----------|----------------|---------------|
| CLEAN-01 | Shadow binaries archived | structural | `[ -f archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs ] && [ -f archive/v0.2-shadow/bin/wrap-mutation.mjs ] && [ ! -f bin/gsd-sdk-shadow.mjs ]` | Wave 0 — `tests/unit/structural-cleanup.test.mjs` |
| CLEAN-02 | Hooks archived | structural | `for h in block-gsd-sdk-mutation block-state-md bd-sync worktree-post-checkout; do [ -f archive/v0.2-shadow/hooks/$h.sh ]; done` | Wave 0 — same file |
| CLEAN-03 | Regen scripts archived + REQUIREMENTS.md edited | structural + grep | files in archive; `grep -q "scripts/cascade-loop.sh archives" .planning/REQUIREMENTS.md` | Wave 0 |
| CLEAN-04 | install.sh deleted | structural | `[ ! -f install.sh ]` | Wave 0 |
| ARCH-01 | `src/bd/` exists | structural + import | `import { bd } from 'gsd-beads/bd'`; `import { BeadsUnavailableError } from 'gsd-beads/bd/errors'`; `import { findBeadsRoot } from 'gsd-beads/bd/findRoot'` resolve | Wave 0 — `tests/unit/structural-imports.test.mjs` |
| ARCH-02 | `src/helpers/` exists | structural + import | `import { parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading } from 'gsd-beads/helpers'` resolves | Wave 0 — same file |
| ARCH-03 | `src/format/phase.mjs` round-trips | property | round-trip on each fixture in `tests/unit/fixtures/phase-format/` | Wave 0 — `tests/unit/format-phase.test.mjs` |
| ARCH-04 | `BeadsAdapter` constructs + stubs throw canonical message | smoke | `import { BeadsAdapter } from 'gsd-beads'`; `new BeadsAdapter('/tmp')` does not throw; `adapter.addPhase()` throws Error matching `/^BeadsAdapter\.addPhase: not implemented \(Phase 8 \/ IMPL-01\)$/` | Wave 0 — `tests/unit/adapter-shell.test.mjs` |
| ARCH-05 | `package.json` shape | structural | parse `package.json`; assert `type === 'module'`, `exports['.']`, no `bin`, `peerDependencies['get-shit-done-cc']`, scripts have `test:unit` and `test:conformance`, no `install`/`postinstall` | Wave 0 — `tests/unit/package-json-shape.test.mjs` |
| DOC-01 | README.md rewritten | structural | `grep -q 'BeadsAdapter' README.md && grep -qv 'install.sh' README.md` | Wave 0 — `tests/unit/docs-content.test.mjs` |
| DOC-02 | CLAUDE.md updated | structural | `grep -q 'sibling' CLAUDE.md && grep -q 'spike-findings-gsd-beads' CLAUDE.md` | Wave 0 — same file |
| TEST-01 | Carry-forward fixture tests pass | smoke | `npm run test:unit` runs migrated bd-helper / beads-errors / findBeadsRoot / 4 helpers tests; all pass; `bash tests/unit/seed-determinism.test.sh` passes | All migrated test files exist post-migration |

### Sampling rate

- **Per task commit:** `npm run test:unit` (~5-10 seconds; Node test runner)
- **Per wave merge:** `npm test` (unit + conformance; conformance is empty
  in Phase 6 so identical to unit)
- **Phase gate:** Full suite green before `/gsd-verify-work` runs

### Wave 0 gaps

New test files Phase 6 must create (the structural assertions above):

- [ ] `tests/unit/structural-cleanup.test.mjs` — covers CLEAN-01..04
- [ ] `tests/unit/structural-imports.test.mjs` — covers ARCH-01, ARCH-02 (import-resolves smoke)
- [ ] `tests/unit/format-phase.test.mjs` — covers ARCH-03 (round-trip per fixture)
- [ ] `tests/unit/fixtures/phase-format/` — 11 fixture files per §2 table
- [ ] `tests/unit/adapter-shell.test.mjs` — covers ARCH-04 (constructor, capabilities flag, stub-throw)
- [ ] `tests/unit/package-json-shape.test.mjs` — covers ARCH-05 (parse + assert structure)
- [ ] `tests/unit/docs-content.test.mjs` — covers DOC-01, DOC-02 (grep assertions)

Existing test files migrated:
- bd-helper, beads-errors, findBeadsRoot, 4 helpers-*, milestone-scoping,
  seed-determinism, memories-seeded — covered by §7

Framework install: **none needed** — Node 20+ ships with `node:test` and
`node:assert/strict`.

---

## 10. Risks / pitfalls

### Risk 1 — D-12 REQUIREMENTS.md edit missed

**What goes wrong:** The plan executes CLEAN-01..04 and ARCH-01..05, runs
the cleanup-cluster verification, but never edits `.planning/REQUIREMENTS.md`
line 308. Phase verification (`/gsd-verify-work`) reads REQUIREMENTS.md
CLEAN-03 and sees "scripts/cascade-loop.sh stays" while the file system
shows it archived. Verification flags divergence; the phase is "almost
complete but documentation lies."

**Prevention:** Plan must include an EXPLICIT task in the cleanup wave:
"Edit `.planning/REQUIREMENTS.md` CLEAN-03 to reflect D-12 (cascade-loop
archives, doesn't stay)." The structural-cleanup test
(`tests/unit/structural-cleanup.test.mjs`) should `grep -q` for the new
wording so CI catches the omission. Recommended new wording:

```markdown
### CLEAN-03: Obsolete regen + cascade-loop scripts archived

`scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`, and
`scripts/regen-state.sh` move to `archive/v0.2-shadow/scripts/`.
`scripts/cascade-loop.sh` also archives to the same path; Phase 8
reintroduces the cascade primitive as `src/bd/cascade.mjs` when
wiring `completePhaseAndCascade`.
```

### Risk 2 — `findBeadsRoot()` extraction loses worktree-symlink behavior

**What goes wrong:** Someone "tidies up" the extracted `findBeadsRoot`
during the move — re-typed instead of copy-pasted, or a "minor cleanup"
strips the `if (stat.isFile())` branch that handles `git worktree` topology.
Phase 4's worktree-symlink case (test CASE 3) fails post-Phase-6.

**Prevention:** Three layers:
1. **Verbatim copy** — D-11 says "extracted verbatim." The plan task
   should literally specify "copy lines 237-282 from
   `bin/gsd-sdk-shadow.mjs`; do not modify."
2. **Test relocation runs unchanged** — the migrated
   `tests/unit/findBeadsRoot.test.mjs` validates all 4 cases (worktree,
   BEADS_DIR, symlink, non-bd) against the new module path. Any
   re-implementation breaks one of them.
3. **Pre-merge verification** — `npm run test:unit` runs the worktree
   fixture test; if green, semantics preserved.

### Risk 3 — `package.json#exports` too restrictive

**What goes wrong:** Phase 7 conformance tests want to import
`gsd-beads/format/phase` (already in the exports map) but ALSO
`gsd-beads/adapter/primitives` to test the cluster file directly. The
exports map doesn't list `./adapter/primitives`, so the import fails
with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Prevention:** D-08 lists the conformance-required submodules: `./bd`,
`./bd/errors`, `./bd/findRoot`, `./helpers`, `./format/phase`. Phase 7's
conformance tests test PUBLIC adapter methods through the BeadsAdapter
class, not internal cluster files directly. If Phase 7 needs cluster-internal
access, the exports map gets a new entry then — Phase 6 doesn't predict
unknown future imports.

**Escape hatch:** if a test absolutely needs internal access, use a relative
import (`tests/conformance/foo.test.mjs` → `import { ... } from '../../src/adapter/primitives.mjs'`) — relative imports bypass the exports map entirely. Document this pattern in CONTRIBUTING.md if it becomes common.

### Risk 4 — Round-trip contract too strict (or too loose)

**What goes wrong, too strict:** Property test asserts
`format(parse(body)) === body` (byte-equality). Real fixture has
`**Goal**:` and another has `**Goal:**` — formatter normalizes both to one
form, byte-equality fails. Phase 6 ships failing round-trip tests.

**What goes wrong, too loose:** Property test asserts only that
`format(parse(body))` is a string. Formatter loses the Plans tail entirely;
test passes; Phase 8's `evolveRoadmap` later corrupts every phase
description.

**Prevention:** Use the exact contract from D-15:
`parse(format(parse(body))) === parse(body)` (idempotency on parsed
structure). This catches information loss without forcing byte-equality.
Implementation: `assert.deepStrictEqual(parsed2, parsed1)`. The fixture
set must include at least one body with the `**Plans:**` tail to verify
tail preservation.

### Risk 5 — `git mv` history loss for the function extraction

**What goes wrong:** The planner specifies `cp lines 237-282 ; rm` instead
of moving the whole shadow first. `git log --follow src/bd/findRoot.mjs`
shows only "new file" with no provenance to the shadow.

**Prevention:** Standard `git mv` only operates on whole files. For
sub-file extraction, the optimal sequence is:
1. `git mv bin/gsd-sdk-shadow.mjs archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`
   (preserves shadow history)
2. Create `src/bd/findRoot.mjs` with the extracted function + a header
   comment citing `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:237-282` as source
3. Commit both changes in ONE commit so git diff shows them together

This gives `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`
the original history, and the new `src/bd/findRoot.mjs` carries an
explicit pointer.

### Risk 6 — CLAUDE.md auto-load breaks

**What goes wrong:** The current CLAUDE.md loads
`Skill("spike-findings-gsd-beads")`. The rewrite drops that line. Future
sessions on this repo lose the spike findings auto-load; bd-modeling
conventions go un-referenced.

**Prevention:** D-24 explicitly preserves the auto-load. The DOC-02 task
must include a verification step: `grep -q 'Skill("spike-findings-gsd-beads")' CLAUDE.md`.
The `tests/unit/docs-content.test.mjs` should grep for this exact line.

### Risk 7 — `peerDependenciesMeta.optional: true` plus `npm install --strict-peer-deps`

**What goes wrong:** A consumer enables strict peer-deps in their `.npmrc`.
With `peerDependencies: {"get-shit-done-cc": "*"}` and the peer absent,
strict mode treats the missing peer as a hard error despite the
`optional: true` flag.

**Prevention:** This is a known npm edge case but does not affect Phase 6
correctness — gsd-beads cannot enforce consumer .npmrc settings. Document
in CONTRIBUTING.md: "If `npm install gsd-beads` errors on missing
get-shit-done-cc, your project has strict-peer-deps enabled. Either link
the fork (`npm run link:fork`) or set `--no-strict-peer-deps` for the
install." `[CITED: github.com/npm/feedback/discussions/225]`

### Risk 8 — `tests/run-all.sh` orphaning

**What goes wrong:** `tests/run-all.sh` and `tests/run-quick.sh` reference
archived directories (`tests/e2e/`, `tests/hook-tests/`) that no longer
exist. Running them prints errors. Some external script or muscle-memory
invokes them.

**Prevention:** Either delete (recommended; let `npm test` be the contract)
or rewrite to point only at `tests/unit/`. Plan-phase decides; recommendation
is delete to reduce surface area. CONTRIBUTING.md documents `npm test` as
the canonical entry point.

### Risk 9 — Stub error messages drift from the canonical form

**What goes wrong:** The 8 cluster files each reimplement the
NOT_IMPLEMENTED helper. Subtle drift: one file uses `'BeadsAdapter.foo: not
implemented'`, another uses `'foo: not implemented yet'`, another uses
`Error.captureStackTrace`. Phase 7's conformance test that greps for
"BeadsAdapter\.\\w+: not implemented \\(Phase \\d+ / IMPL-\\d+\\)" misses
some.

**Prevention:** Recommendation: define the helper in **one** place
(`src/adapter/_stub.mjs` or inline in each cluster but identical). The
plan task that creates the cluster files should specify the EXACT message
template:

```js
const NOT_IMPLEMENTED = (name, phase, impl) => {
  throw new Error(`BeadsAdapter.${name}: not implemented (Phase ${phase} / ${impl})`);
};
```

Verification: `tests/unit/adapter-shell.test.mjs` greps each cluster file
for the pattern `not implemented \(Phase \d+ / (IMPL-\d+|PRIM-\d+)\)`.

### Risk 10 — `tests/fixtures/memories-seeded.test.mjs` import drift

**What goes wrong:** `memories-seeded.test.mjs` currently sits inside
`tests/fixtures/`. After moving to `tests/unit/`, its relative imports
to `seed-fixture.sh` or other fixture helpers change one level.

**Prevention:** Read the test before moving; if it has `import './seed-fixture.sh'`
or runs `bash` against a relative path, update the relative path in the
move task. The migration task should list "verify all imports resolve" as
an explicit step.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 8 cluster boundary names in D-01 (`primitives`, `phaseLifecycle`, `roadmapMilestone`, `state`, `verifyReviews`, `discussTodos`, `longTail`, `initBundlers`) map cleanly to SYNTHESIS.md §4 cluster headers | §4 | If a cluster boundary renames in SYNTHESIS, the file name is stale. LOW — CONTEXT.md D-01 explicitly names them; SYNTHESIS.md is locked per D-2026-04-30-06 |
| A2 | The full method count per cluster (~270 stubs total) — derived by counting backtick-quoted method names in REQUIREMENTS.md IMPL-01..12 entries | §4 | If REQUIREMENTS.md adds/removes a method between Phase 6 and Phase 7, stub count drifts. MEDIUM — planner can extract names mechanically from REQUIREMENTS.md at plan time, so drift is auto-corrected |
| A3 | `npm 11`, `pnpm`, and `yarn berry` all respect `peerDependenciesMeta.optional: true` consistently | §3 | If a package manager errors on missing optional peer, install breaks for that user. LOW — npm 11 confirmed; pnpm and yarn historically follow npm spec |
| A4 | Stack-trace fidelity for `Object.assign(prototype, {async fooBar() {...}})` is preserved in V8 | §4 | If stack traces show `<anonymous>` instead of `BeadsAdapter.fooBar`, debugging Phase 7+ regressions is harder. LOW — verified in Node 24 REPL |
| A5 | The current CLAUDE.md `Skill("spike-findings-gsd-beads")` auto-load syntax is exactly what Claude Code expects | §8 | If the syntax has changed, the rewrite still works (D-24 says "keep that line" — verbatim preservation) |
| A6 | Existing tests under `tests/shadow-tests/` (bd-helper, beads-errors, helpers-*) need ONLY import path edits to pass against `src/` | §7 | If a test relies on shadow-internal state (e.g., a shared module-load side effect), the import edit alone fails. LOW — read of bd-helper.test.mjs shows imports + spawn fixtures only; helpers tests imports + 6 cases each. No shared state |

---

## Open Questions

1. **Should `tests/run-all.sh` / `tests/run-quick.sh` be edited or deleted?**
   - What we know: the scripts reference dirs that archive in Phase 6.
   - What's unclear: whether external automation (CI? hooks? aliases?) calls them.
   - Recommendation: DELETE. Use `npm test` as the canonical entry point and document in CONTRIBUTING.md. If the planner discovers an external dependency, fall back to a one-line script that invokes `npm test`.

2. **Should `install/memories/*.md` files relocate?**
   - What we know: 8 files in `install/memories/` referencing seed memories (vocabulary, link-default, type-strategy, etc.). Used by archived install.sh.
   - What's unclear: whether they're still useful as documentation (the conventions they describe are alive even though install.sh archives) or pure dead weight.
   - Recommendation: KEEP IN PLACE. They're prose documentation of bd conventions; spike-findings skill references them. Out of CLEAN-* scope. Future cleanup if user requests.

3. **`gsd-sdk-cc.version.lock` retirement timing?**
   - What we know: file pins fork's upstream version against drift; D-09 keeps it for now (specifics § "lives — for now").
   - What's unclear: when fork publishes, this file's purpose evaporates.
   - Recommendation: KEEP for Phase 6; revisit when fork's `npm publish` happens (Phase 13 or later).

4. **Sample size of fixtures for `format/phase.mjs` round-trip tests?**
   - What we know: 11 fixtures recommended in §2; the real ROADMAP.md has 13 phases.
   - What's unclear: whether the real ROADMAP.md should be a single fixture or one fixture per phase.
   - Recommendation: ONE FIXTURE PER PHASE for the real cases (so a Phase 8 regression fails with phase-specific signal), plus the 6-7 synthetic edge cases. The planner can size this in plan-phase.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md auto-loads `Skill("spike-findings-gsd-beads")`. The spike skill's
`<requirements>` block enforces:

- `bd init --non-interactive --skip-agents` is canonical
- `bd link --type parent-child` for hierarchy (NOT `bd dep add`'s default `blocks`)
- `BEADS_ACTOR=seed` discipline on every seeder call (Phase 4 Pitfall 8)
- Hash-based ID uniqueness (validated under load)
- JSONL determinism with `BEADS_ACTOR=seed`
- All-epic + labels type strategy
- Cascade is a 5-line loop on `bd epic close-eligible`

Phase 6 deliverables that touch bd or seeders MUST honor these. The relevant
ones for Phase 6:
- `seed-determinism.test.sh` (post-migration) verifies the JSONL determinism
  contract — must pass with `BEADS_ACTOR=seed`
- The `findBeadsRoot()` semantics (D-22) preserve the `BEADS_DIR` env-first
  resolution — symmetric with Phase 3's per-worktree `BEADS_DIR` setting
- No new bd invocations in Phase 6 (every adapter method stubs out before
  reaching `bd`); the constraints become live again in Phase 7

The user's global CLAUDE.md (`~/.claude/CLAUDE.md`) covers OS/dev-environment
context (WSL2 + macOS, Volta, Zsh) — no overlap with Phase 6 Node-library
deliverables.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md` (full read; 17 locked decisions D-01..D-24, scope, references)
- `.planning/REQUIREMENTS.md` (CLEAN-01..04, ARCH-01..05, DOC-01..02, TEST-01, CAP-01, PRIM-01..02, IMPL-01..12; full read)
- `.planning/ROADMAP.md` (Phase 6 § plus Phase 7-13 details for fixture content; full read)
- `.planning/STATE.md` (milestone v1.0 status)
- `.planning/PROJECT.md` ("Carry-forward from v0.1 and v0.2 work" section)
- `.planning/DECISIONS.md` (D-2026-04-30-01..06 + open questions OQ-01..10)
- `.planning/research/fork-investigation/SYNTHESIS.md` §4 (Bin A 10 methods, Bin B catalog, Foundational primitives table); §6 (open questions including OQ-01 commitPlanningState semantics)
- `bin/bd-helper.mjs` (full read; 64 lines)
- `bin/beads-errors.mjs` (full read; 55 lines)
- `bin/gsd-sdk-shadow.mjs:237-282` (`findBeadsRoot` body); lines 293-296, 305-313, 331-346, 356-364 (helpers)
- `tests/shadow-tests/findBeadsRoot.test.mjs` (verify import path that needs editing)
- `tests/shadow-tests/bd-helper.test.mjs` (sample for migration import-edit pattern)
- `tests/shadow-tests/helpers-parsePhaseId.test.mjs` (sample for helper-test migration)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` (auto-loaded; bd modeling constraints)
- `README.md` and `CLAUDE.md` (current; both need rewrites)

### Secondary (MEDIUM confidence)
- [Modules: Packages — Node.js docs](https://nodejs.org/api/packages.html) — `exports` field, subpath patterns
- [package.json — npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) — `peerDependenciesMeta.optional` semantics

### Tertiary (LOW confidence)
- [npm/feedback discussion #225](https://github.com/npm/feedback/discussions/225) — strict-peer-deps interaction with optional peers (referenced but noted as a consumer-side concern, not a Phase 6 blocker)

## Metadata

**Confidence breakdown:**
- Cleanup blast radius: HIGH — every file accounted for via direct repo listing + CONTEXT.md mapping
- `src/format/phase.mjs` design: HIGH — grammar derived from real ROADMAP.md content
- `package.json` blueprint: HIGH — D-06..D-09 lock the shape; verified syntax against Node + npm 11
- `src/adapter.mjs` skeleton: HIGH — D-01..D-05 lock the pattern; cluster boundaries from SYNTHESIS §4
- `findBeadsRoot()` extraction: HIGH — function read directly; pure; zero coupled deps
- Helpers extraction: HIGH — four pure functions read directly; no shared state
- Test layout migration: HIGH — D-10..D-13 prescribe; verified by directory listing
- Documentation refresh: MEDIUM — section structure is sketched, exact wording is plan/execute discretion
- Validation architecture: HIGH — Node test runner is built-in, no framework decision
- Risks: MEDIUM — derived from spike findings + CONTEXT.md + careful read of bordering phases

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable; no fast-moving deps; fork's StorageAdapter
interface evolution may invalidate the IMPL-NN method names but not the
Phase 6 cleanup/scaffolding scope)
