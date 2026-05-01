---
phase: 6
plan: 07
type: execute
wave: 3
depends_on: [01, 04, 05, 06]
files_modified:
  - package.json
  - README.md
  - CLAUDE.md
  - CONTRIBUTING.md
  - .planning/REQUIREMENTS.md
autonomous: true
requirements:
  - ARCH-05
  - DOC-01
  - DOC-02
  - CLEAN-03
must_haves:
  truths:
    - "package.json exists at repo root with the exact shape from D-06..D-09 (name, version, type, exports map, no bin entries, peerDeps, scripts, engines)"
    - "package.json#exports map includes all 6 conformance-needed subpaths (./bd, ./bd/errors, ./bd/findRoot, ./helpers, ./format/phase, ./package.json)"
    - "README.md describes the post-cleanup adapter library architecture (DOC-01)"
    - "CLAUDE.md describes this repo as adapter sibling and preserves Skill('spike-findings-gsd-beads') auto-load (DOC-02 + D-24)"
    - "CONTRIBUTING.md exists and documents npm link ../get-shit-done dev workflow (D-06)"
    - ".planning/REQUIREMENTS.md CLEAN-03 wording reflects D-12 (cascade-loop archives)"
    - "All 6 Wave 0 tests are green when npm run test:unit runs"
  artifacts:
    - path: "package.json"
      provides: "adapter-library shape per ARCH-05"
    - path: "README.md"
      provides: "post-cleanup architecture docs (DOC-01)"
    - path: "CLAUDE.md"
      provides: "sibling adapter-library role + preserved auto-load (DOC-02)"
    - path: "CONTRIBUTING.md"
      provides: "dev workflow per D-06"
    - path: ".planning/REQUIREMENTS.md"
      provides: "CLEAN-03 wording fix per D-12"
  key_links:
    - from: "package.json#exports"
      to: "src/adapter.mjs (.) + src/bd/*, src/helpers/, src/format/phase.mjs"
      via: "exports map subpath patterns"
      pattern: "\"\\./bd\":|\"\\./bd/errors\":|\"\\./helpers\":|\"\\./format/phase\":"
    - from: "CLAUDE.md"
      to: ".claude/skills/spike-findings-gsd-beads/SKILL.md"
      via: "Skill() auto-load directive"
      pattern: "Skill\\(\"spike-findings-gsd-beads\"\\)"
    - from: ".planning/REQUIREMENTS.md CLEAN-03"
      to: "scripts/cascade-loop.sh archives (D-12)"
      via: "edited block contains the new wording"
      pattern: "scripts/cascade-loop\\.sh also archives"
---

<objective>
Final Wave 3 plan: write the package.json describing the adapter library
shape (D-06..D-09 / ARCH-05), rewrite README.md and CLAUDE.md for the
post-cleanup architecture (DOC-01 / DOC-02), create CONTRIBUTING.md for
the dev workflow (D-06), and edit .planning/REQUIREMENTS.md to reflect
the D-12 override on CLEAN-03 wording.

Purpose: After this plan, all 6 Wave 0 tests run green:
- structural-cleanup.test.mjs (CLEAN-01..04 + REQUIREMENTS.md edit)
- structural-imports.test.mjs (Plan 04 already turned this green)
- format-phase.test.mjs (Plan 05 already turned this green)
- adapter-shell.test.mjs (Plan 06 already turned this green)
- package-json-shape.test.mjs (this plan)
- docs-content.test.mjs (this plan)

`npm run test:unit` runs all 17 tests (6 Wave 0 + 11 carry-forward) green.

Output: 5 files (1 created package.json, 2 rewritten docs, 1 new
CONTRIBUTING, 1 edited REQUIREMENTS.md).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-VALIDATION.md

<interfaces>
package.json blueprint per RESEARCH.md §3 lines 336-377 (verified syntax
for npm 11):

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
  "engines": { "node": ">=20" },
  "peerDependencies": { "get-shit-done-cc": "*" },
  "peerDependenciesMeta": { "get-shit-done-cc": { "optional": true } },
  "scripts": {
    "test": "node --test tests/unit/ tests/conformance/",
    "test:unit": "node --test tests/unit/",
    "test:conformance": "node --test tests/conformance/",
    "link:fork": "npm link ../get-shit-done"
  },
  "files": ["src/", "README.md", "CLAUDE.md", "CONTRIBUTING.md"],
  "license": "ISC"
}

README.md sections per RESEARCH.md §8 lines 882-911:
  - Title + tagline
  - Status badge (v1.0-alpha in flight)
  - What this is
  - When to install
  - Install instructions (npm link workflow until fork publishes)
  - Configure (storage.adapter: beads in fork's config)
  - Method coverage (16 primitives + ~75 named methods, ~270 stubs)
  - Architecture diagram (ASCII; fork box + this-repo box)
  - Refactor-on-fork-stabilize policy
  - Multi-worktree note (manual setup; carry-forward from v0.1)
  - Repo layout (tree)
  - License (ISC)

CLAUDE.md per RESEARCH.md §8 lines 925-963:
  - Title
  - Body: this repo is BeadsAdapter implementation; sibling to fork
  - Source layout section
  - Archived directory mention
  - Auto-loaded skills section preserving Skill("spike-findings-gsd-beads")

CONTRIBUTING.md per RESEARCH.md §8 lines 971-1011:
  - Local development against the fork (npm link instructions)
  - Testing (npm test variants)
  - Branch model

REQUIREMENTS.md CLEAN-03 wording per RESEARCH.md §10 Risk #1 lines 1138-1146:
  ### CLEAN-03: Obsolete regen + cascade-loop scripts archived

  `scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`, and
  `scripts/regen-state.sh` move to `archive/v0.2-shadow/scripts/`.
  `scripts/cascade-loop.sh` also archives to the same path; Phase 8
  reintroduces the cascade primitive as `src/bd/cascade.mjs` when
  wiring `completePhaseAndCascade`.

The structural-cleanup.test.mjs (Wave 0) greps for the exact substring
"scripts/cascade-loop.sh also archives" — the wording above produces a
match.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write package.json (ARCH-05)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §3 lines 336-440 (full blueprint + verified pitfalls)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-06, D-07, D-08, D-09
    - tests/unit/package-json-shape.test.mjs (Wave 0 test driver — what shape it asserts)
    - src/adapter.mjs (Plan 06 — confirms the entry point exists)
    - src/bd/helper.mjs, src/bd/errors.mjs, src/bd/findRoot.mjs (Plan 04 — confirms subpath targets exist)
    - src/helpers/index.mjs (Plan 04)
    - src/format/phase.mjs (Plan 05)
  </read_first>
  <files>
    - package.json
  </files>
  <action>
    Write `package.json` at the repo root with the exact shape per
    RESEARCH.md §3 / D-06..D-09. Verify each subpath target exists
    BEFORE writing — if any is missing, the corresponding plan failed
    upstream.

    Pre-flight checks:

    ```bash
    test -f src/adapter.mjs       || { echo "MISSING src/adapter.mjs (Plan 06 not done)"; exit 1; }
    test -f src/bd/helper.mjs     || { echo "MISSING src/bd/helper.mjs (Plan 04)"; exit 1; }
    test -f src/bd/errors.mjs     || { echo "MISSING src/bd/errors.mjs (Plan 04)"; exit 1; }
    test -f src/bd/findRoot.mjs   || { echo "MISSING src/bd/findRoot.mjs (Plan 04)"; exit 1; }
    test -f src/helpers/index.mjs || { echo "MISSING src/helpers/index.mjs (Plan 04)"; exit 1; }
    test -f src/format/phase.mjs  || { echo "MISSING src/format/phase.mjs (Plan 05)"; exit 1; }
    ```

    Write the file (use the Write tool, NOT a heredoc):

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

    Verify the file parses as JSON:

    ```bash
    node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf-8'))"
    ```

    Run the Wave 0 package-json-shape test:

    ```bash
    node --test tests/unit/package-json-shape.test.mjs
    ```

    All 7 tests must pass.
  </action>
  <verify>
    <automated>test -f package.json &amp;&amp; node -e "JSON.parse(require('fs').readFileSync('package.json','utf-8'))" &amp;&amp; node --test tests/unit/package-json-shape.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - package.json exists at repo root
    - File parses as valid JSON
    - `name` is "gsd-beads", `version` is "1.0.0-alpha.0", `type` is "module"
    - `exports` map has exactly the 6 documented subpaths plus "."
    - No `bin` field
    - No `install` or `postinstall` script
    - `peerDependencies["get-shit-done-cc"]` is "*", `peerDependenciesMeta["get-shit-done-cc"].optional` is true
    - `engines.node` matches `/^>=20/`
    - `node --test tests/unit/package-json-shape.test.mjs` reports 7/7 pass
  </acceptance_criteria>
  <done>package.json in place; Wave 0 package-json-shape.test.mjs green</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rewrite README.md (DOC-01)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §8 lines 882-911 (section sketch)
    - tests/unit/docs-content.test.mjs (test driver — keyword grep assertions)
    - README.md (current v0.1-shaped content — overwrite)
    - .planning/PROJECT.md (for accurate architecture context)
  </read_first>
  <files>
    - README.md
  </files>
  <action>
    Rewrite README.md from scratch. The current 30-line file is wholly
    obsolete (describes v0.1 hook layer + install.sh distribution). Write
    a new README per RESEARCH.md §8 sections.

    Required content (each section addresses a Wave 0 docs-content test
    or DOC-01 success criterion):

    ```markdown
    # gsd-beads

    > BeadsAdapter — bd-backed StorageAdapter implementation for the get-shit-done planning workflow.

    **Status:** v1.0-alpha (in flight). Phases 6-13 of milestone v1.0
    are scoped; Phase 6 (cleanup + scaffolding) ships first; Phases
    7-13 fill in the adapter contract surface against
    `~/code/get-shit-done`'s StorageAdapter interface.

    ## What this is

    `gsd-beads` is the **BeadsAdapter** implementation of the
    `StorageAdapter` interface defined by the get-shit-done fork at
    `~/code/get-shit-done` (branch `feat/storage-adapter`). It is a
    sibling adapter library — consumed by the fork at runtime via
    `peerDependencies`, NOT installed into `~/.claude/`.

    Use it when you have `get-shit-done-cc` (the fork) installed AND
    want bd-backed planning state (issue/dependency tracking via
    `bd`) instead of the default markdown view.

    ## Install

    The fork is unpublished; during development, link locally:

    ```bash
    cd ~/code/get-shit-done
    npm link

    cd ~/code/gsd-beads
    npm run link:fork    # equivalent to: npm link get-shit-done-cc
    ```

    See `CONTRIBUTING.md` for the full dev workflow.

    Once the fork publishes:

    ```bash
    npm install gsd-beads
    ```

    ## Configure

    In your project's `.planning/config.json` (consumed by the fork):

    ```json
    { "storage": { "adapter": "beads" } }
    ```

    The fork's `StorageAdapter` resolution loads `BeadsAdapter` from
    this package.

    ## Method coverage

    The BeadsAdapter implements the SYNTHESIS.md §4 catalog (~75
    deduplicated named methods, ~270 stubs across 8 SYNTHESIS cluster
    boundaries). v1.0-alpha ships ALL stubs throwing
    `BeadsAdapter.<method>: not implemented (Phase N / IMPL-NN)`;
    Phases 7-13 fill them in.

    ## Architecture

    ```
    +--------------------------+        +----------------------------+
    |  ~/code/get-shit-done    |        |    ~/code/gsd-beads        |
    |  (fork; consumer)        |  uses  |    (this repo; adapter)    |
    |                          |<------>|                            |
    |  StorageAdapter interface|  via   |  BeadsAdapter class        |
    |  MarkdownAdapter (default)        |  Bin A primitives          |
    |                          |        |  6 foundational primitives |
    |                          |        |  ~270 cluster methods      |
    +--------------------------+        +----------------------------+
                                                 |
                                                 v
                                       +----------------------+
                                       |  bd CLI (issue tracker)|
                                       +----------------------+
    ```

    ### Refactor-on-fork-stabilize policy

    `gsd-beads` implements against `SYNTHESIS.md §4` in parallel with
    the fork's interface evolution. Expect 10-30% method-signature
    churn when the fork's contract stabilizes. This is the planned
    cost of parallel development; the alternative (waiting for fork
    Phase 1) was rejected per `D-2026-04-30-01`.

    ## Multi-worktree

    v1.0 ships without an automatic multi-worktree helper.
    Adapter consumers handle `BEADS_DIR` cross-worktree manually; see
    `docs/WORKTREES.md` for the recipe (carry-forward from v0.1).

    ## Repo layout

    ```
    gsd-beads/
    ├── src/
    │   ├── adapter.mjs            # BeadsAdapter shell
    │   ├── adapter/               # 8 cluster method bags
    │   ├── bd/                    # bd CLI wrappers (helper, errors, findRoot)
    │   ├── helpers/               # parsing helpers (parsePhaseId, etc.)
    │   └── format/phase.mjs       # bidirectional phase parser
    ├── tests/
    │   ├── unit/                  # node --test unit tests
    │   ├── conformance/           # cross-adapter parity (Phase 7+)
    │   └── fixtures/              # canonical seed.jsonl + helpers
    ├── archive/v0.2-shadow/       # v0.2 shadow code preserved
    ├── docs/                      # WORKTREES.md, etc.
    └── .planning/                 # GSD planning state
    ```

    ## License

    ISC
    ```

    Notes for the executor:
    - The Wave 0 docs-content test asserts:
      - `BeadsAdapter` appears (covered)
      - `~/code/get-shit-done` or `get-shit-done-cc` appears (both covered)
      - `./install.sh` does NOT appear at the start of any line (the
        install instruction now uses `npm` commands; ./install.sh is gone)
    - Do NOT include `./install.sh` as an active install instruction.
      You may mention "v0.2 install.sh archived" in passing if helpful.
    - Use the exact strings above; do not paraphrase the architectural
      framing or refactor-on-stabilize section.
  </action>
  <verify>
    <automated>test -f README.md &amp;&amp; grep -q "BeadsAdapter" README.md &amp;&amp; (grep -q "~/code/get-shit-done" README.md || grep -q "get-shit-done-cc" README.md) &amp;&amp; ! grep -E "^\\s*\\./install\\.sh" README.md</automated>
  </verify>
  <acceptance_criteria>
    - README.md rewritten (line count > 60; current was 30)
    - Contains exact substring "BeadsAdapter"
    - Contains exact substring "~/code/get-shit-done" OR "get-shit-done-cc" (both is fine)
    - Does NOT contain a line starting with `./install.sh` (no install.sh as active instruction)
    - Contains a "Refactor-on-fork-stabilize policy" or equivalent paragraph
    - References tests/unit/, tests/conformance/, archive/v0.2-shadow/ in the repo layout
    - Wave 0 docs-content.test.mjs DOC-01 tests pass (3 tests)
  </acceptance_criteria>
  <done>README.md rewritten; DOC-01 tests green</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Rewrite CLAUDE.md (DOC-02 + D-24)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §8 lines 925-963 (CLAUDE.md draft)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-24 (preserve Skill("spike-findings-gsd-beads"))
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #6 (auto-load preservation)
    - tests/unit/docs-content.test.mjs (the 5 CLAUDE.md test cases)
    - CLAUDE.md (current 11-line v0.2 framing — overwrite)
  </read_first>
  <files>
    - CLAUDE.md
  </files>
  <action>
    Replace CLAUDE.md content entirely. Per RESEARCH.md §8 +
    D-24 + Risk #6, the new content must:
    1. Drop the "skill + hook layer" framing (current line 1)
    2. Describe the sibling adapter-library role
    3. Reference the fork at ~/code/get-shit-done
    4. Preserve `Skill("spike-findings-gsd-beads")` exactly (D-24)

    Use this content:

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

    The closing line `→ Skill("spike-findings-gsd-beads")` MUST be exact
    (D-24 + Wave 0 test grep). Do NOT use smart quotes or backticks
    around `spike-findings-gsd-beads`.

    Verify the Wave 0 CLAUDE.md tests pass:

    ```bash
    node --test tests/unit/docs-content.test.mjs
    ```

    All 8 tests in docs-content.test.mjs must pass after this task
    (Tasks 2-4 collectively turn it green).
  </action>
  <verify>
    <automated>test -f CLAUDE.md &amp;&amp; grep -q "BeadsAdapter" CLAUDE.md &amp;&amp; grep -q "~/code/get-shit-done" CLAUDE.md &amp;&amp; grep -q 'Skill("spike-findings-gsd-beads")' CLAUDE.md &amp;&amp; (grep -q "sibling" CLAUDE.md || grep -q "adapter library" CLAUDE.md) &amp;&amp; ! grep -q "skill + hook layer" CLAUDE.md</automated>
  </verify>
  <acceptance_criteria>
    - CLAUDE.md rewritten (line count >= 25)
    - Contains substring `Skill("spike-findings-gsd-beads")` exactly (D-24)
    - Contains substring `BeadsAdapter`
    - Contains substring `~/code/get-shit-done`
    - Contains substring `sibling` OR `adapter library` (case-insensitive)
    - Does NOT contain substring `skill + hook layer` (the obsolete v0.2 framing)
    - Wave 0 docs-content.test.mjs DOC-02 tests pass (5 tests)
  </acceptance_criteria>
  <done>CLAUDE.md rewritten with auto-load preserved; DOC-02 tests green</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Create CONTRIBUTING.md (D-06)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §8 lines 971-1011 (CONTRIBUTING.md draft)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-06 (npm link workflow documentation requirement)
    - tests/unit/docs-content.test.mjs (CONTRIBUTING.md test case)
  </read_first>
  <files>
    - CONTRIBUTING.md
  </files>
  <action>
    Create `CONTRIBUTING.md` per RESEARCH.md §8:

    ```markdown
    # Contributing to gsd-beads

    ## Local development against the fork

    `gsd-beads` declares an **optional** peer dependency on
    `get-shit-done-cc` (the fork). During development, link the fork
    into this repo's `node_modules`:

    ```bash
    # In the fork:
    cd ~/code/get-shit-done
    npm link

    # In gsd-beads:
    cd ~/code/gsd-beads
    npm link get-shit-done-cc
    # OR equivalently (per package.json scripts):
    npm run link:fork
    ```

    This makes `import { ... } from 'get-shit-done-cc'` resolve to the
    fork's source. Phase 7+ adapter methods that delegate to fork
    internals will work; Phase 6 stubs throw before hitting any fork
    import.

    ### Strict peer-deps note

    If `npm install gsd-beads` errors on missing `get-shit-done-cc`,
    your project has `strict-peer-deps` enabled in its `.npmrc`. Either:
    - Link the fork (`npm run link:fork`), OR
    - Set `--no-strict-peer-deps` for the install.

    See [npm/feedback#225](https://github.com/npm/feedback/discussions/225)
    for context.

    ## Testing

    ```bash
    npm test                  # unit + conformance (Phase 6: only unit, conformance is empty)
    npm run test:unit         # unit only (fast)
    npm run test:conformance  # conformance only (Phase 7+)
    ```

    Tests run via Node's built-in `node:test` runner — no framework install
    needed (Node >= 20 is the engines floor).

    ## Branch model

    - `main` — released versions (`v1.0-alpha.0` and onward)
    - Working branches: one per phase (e.g., `phase-6-cleanup`,
      `phase-7-primitives`, ...)

    See `.planning/ROADMAP.md` for the v1.0 phase plan.

    ## Phase work

    Each phase ships independently per the GSD workflow. Read the
    phase's `.planning/phases/XX-<slug>/06-CONTEXT.md` and
    `.planning/phases/XX-<slug>/06-RESEARCH.md` before opening any
    `XX-NN-*-PLAN.md` for execution. Locked decisions (D-NN) in
    CONTEXT.md are non-negotiable.
    ```
  </action>
  <verify>
    <automated>test -f CONTRIBUTING.md &amp;&amp; grep -q "npm link" CONTRIBUTING.md &amp;&amp; grep -q "test:unit" CONTRIBUTING.md</automated>
  </verify>
  <acceptance_criteria>
    - CONTRIBUTING.md exists at repo root
    - Contains substring "npm link"
    - Contains substring "test:unit"
    - Contains substring "get-shit-done-cc" (peer dep)
    - Contains substring "node:test" or "Node 20" (toolchain context)
    - Wave 0 docs-content.test.mjs CONTRIBUTING.md test passes
  </acceptance_criteria>
  <done>CONTRIBUTING.md in place; D-06 documented</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Edit .planning/REQUIREMENTS.md CLEAN-03 wording (D-12)</name>
  <read_first>
    - .planning/REQUIREMENTS.md lines 305-313 (current CLEAN-03 wording with "stays")
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-12 (override)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #1 (replacement wording)
    - tests/unit/structural-cleanup.test.mjs (Wave 0 test that greps for the new wording)
  </read_first>
  <files>
    - .planning/REQUIREMENTS.md
  </files>
  <action>
    Edit `.planning/REQUIREMENTS.md` to replace the CLEAN-03 block with
    the D-12 wording. Use the Edit tool with these EXACT old/new strings:

    Old (current CLEAN-03 block in REQUIREMENTS.md, approximately lines 305-309):
    ```
    ### CLEAN-03: Obsolete regen scripts archived

    `scripts/regen-roadmap.sh` and `scripts/regen-requirements.sh` move to
    `archive/v0.2-shadow/scripts/`. `scripts/cascade-loop.sh` stays
    (carry-forward bd primitive).
    ```

    New (per RESEARCH.md §10 Risk #1):
    ```
    ### CLEAN-03: Obsolete regen + cascade-loop scripts archived

    `scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`, and
    `scripts/regen-state.sh` move to `archive/v0.2-shadow/scripts/`.
    `scripts/cascade-loop.sh` also archives to the same path; Phase 8
    reintroduces the cascade primitive as `src/bd/cascade.mjs` when
    wiring `completePhaseAndCascade`.
    ```

    Use `Edit` (not Write — REQUIREMENTS.md is much larger than this
    section; rewriting the whole file is wasteful and risks dropping
    other content).

    The Wave 0 structural-cleanup.test.mjs test reads REQUIREMENTS.md
    and asserts the regex `/scripts\/cascade-loop\.sh also archives/`
    matches. The new wording above contains that substring.

    Run the Wave 0 test:

    ```bash
    node --test tests/unit/structural-cleanup.test.mjs
    ```

    All 5 tests must now pass (Plan 02 already turned CLEAN-01..04
    file-move tests green; this task closes the REQUIREMENTS.md wording
    test).
  </action>
  <verify>
    <automated>grep -q "scripts/cascade-loop.sh also archives" .planning/REQUIREMENTS.md &amp;&amp; grep -q "Phase 8 reintroduces the cascade primitive as" .planning/REQUIREMENTS.md &amp;&amp; ! grep -q "scripts/cascade-loop.sh stays" .planning/REQUIREMENTS.md &amp;&amp; node --test tests/unit/structural-cleanup.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/REQUIREMENTS.md` contains the substring "scripts/cascade-loop.sh also archives"
    - `.planning/REQUIREMENTS.md` contains the substring "Phase 8 reintroduces the cascade primitive as"
    - `.planning/REQUIREMENTS.md` does NOT contain the substring "scripts/cascade-loop.sh stays" (the old wording is gone)
    - The CLEAN-03 heading reads "### CLEAN-03: Obsolete regen + cascade-loop scripts archived"
    - Wave 0 structural-cleanup.test.mjs reports 5/5 tests pass
  </acceptance_criteria>
  <done>REQUIREMENTS.md CLEAN-03 reflects D-12; structural-cleanup.test.mjs fully green</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Final integration verification — npm test runs all tests green</name>
  <read_first>
    - tests/unit/ (all 17 tests should be present: 6 Wave 0 + 11 carry-forward)
    - package.json (Task 1 — npm test contract)
  </read_first>
  <files>
  </files>
  <action>
    Final wiring check. Run the full test suite via npm:

    ```bash
    npm test
    ```

    This invokes `node --test tests/unit/ tests/conformance/`. Expected:
    - tests/unit/ : 17 test files, all green (6 Wave 0 + 11 carry-forward)
    - tests/conformance/ : 0 test files (only the .gitkeep), 0 tests

    Total expected pass count: ~50-60 individual tests across the 17
    files (each file has 1-8 tests; exact count varies).

    If any test fails:
    1. Identify which plan owns it (check the test file's content)
    2. The failure is a regression in the upstream plan, not this task
    3. Open a gap closure path — fix the upstream issue rather than
       weakening this verification

    Also run:

    ```bash
    bash tests/unit/seed-determinism.test.sh
    ```

    Must pass — CONF-03 byte-identity invariant.

    Document the final results: number of test files, total tests, all green.
  </action>
  <verify>
    <automated>npm test 2>&amp;1 | tail -5; bash tests/unit/seed-determinism.test.sh</automated>
  </verify>
  <acceptance_criteria>
    - `npm test` exits 0 (all tests pass)
    - `bash tests/unit/seed-determinism.test.sh` exits 0
    - The npm test output reports zero failures
    - The number of *.test.mjs files in tests/unit/ is at least 17
  </acceptance_criteria>
  <done>Phase 6 fully wired; all tests green; ready for /gsd-verify-work</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| package.json#exports → consumer code | `peerDependencies: "*"` plus `npm-link` could install an unintended fork if the consumer's node_modules already has a divergent `get-shit-done-cc`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.07-01 | Tampering | package.json#exports map exposes internal mutable state of cluster files (planner threat T-2 from phase guidance) | mitigate | Per D-08, the exports map lists ONLY the documented submodules (./bd, ./bd/errors, ./bd/findRoot, ./helpers, ./format/phase, ./package.json). Cluster files in src/adapter/ are NOT exported — consumers get the BeadsAdapter class via "." entry, not the cluster method bags. Phase 7 conformance can use relative imports if internal access becomes necessary (RESEARCH.md §10 Risk #3). |
| T-6.07-02 | Tampering | `peerDependencies: "*"` + npm-link installs an unintended fork (planner threat T-3) | mitigate | CONTRIBUTING.md (Task 4) documents the EXACT npm link command (`npm link get-shit-done-cc` against the local fork at ~/code/get-shit-done). Future enhancement: tighten to `^1.0.0` once the fork publishes (deferred per D-06). |
| T-6.07-03 | Information Disclosure | README.md describes ~/code/get-shit-done absolute path, leaking developer machine layout | accept | The path is documented as the fork's location convention; not a secret. Real-world consumers (npm install) won't see this README on their machine. |
| T-6.07-04 | Repudiation | REQUIREMENTS.md CLEAN-03 edit silently drops `scripts/cascade-loop.sh stays` wording (planner threat: D-12 missed) | mitigate | Task 5 explicitly verifies `! grep -q "scripts/cascade-loop.sh stays"` AND `grep -q "scripts/cascade-loop.sh also archives"`. The structural-cleanup.test.mjs test (Wave 0) provides regression coverage for the wording. |
| T-6.07-05 | Tampering | CLAUDE.md auto-load directive Skill("...") gets dropped during rewrite (planner threat T-Risk-6) | mitigate | Task 3 verify command grep -q's the EXACT string `Skill("spike-findings-gsd-beads")`. The Wave 0 docs-content.test.mjs has the same regex assertion. Two-layer defense — task verify AND test driver. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- `npm test` exits 0; all 17 unit test files green
- `bash tests/unit/seed-determinism.test.sh` exits 0 (CONF-03 invariant)
- `node -e "import('gsd-beads').then(m => console.log(m.BeadsAdapter.name))"` would print "BeadsAdapter" (after `npm link` to self for testing)
- `node -e "import('gsd-beads/format/phase').then(m => console.log(typeof m.parsePhaseTitle))"` prints "function"
- `git status` shows the 5 modified files staged for commit
- All 12 phase requirements (CLEAN-01..04, ARCH-01..05, DOC-01..02, TEST-01) satisfied across the 7 plans
</verification>

<success_criteria>
- package.json shape exactly per D-06..D-09
- README.md, CLAUDE.md describe post-cleanup architecture
- CONTRIBUTING.md documents npm link workflow
- .planning/REQUIREMENTS.md CLEAN-03 wording reflects D-12
- All 6 Wave 0 tests + 11 carry-forward tests = 17 test files, all green via `npm test`
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-07-SUMMARY.md` documenting:
1. The 5 file outputs (package.json, README.md, CLAUDE.md, CONTRIBUTING.md, REQUIREMENTS.md edit)
2. The npm test exit code + total tests passed
3. Any deferred items (e.g., gsd-sdk-cc.version.lock retirement is left to v1.1 per RESEARCH.md "Specifics")
4. Phase 6 acceptance gate status: ROADMAP SC #1-6 all green
</output>
