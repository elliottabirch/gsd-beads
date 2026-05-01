---
phase: 6
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - tests/unit/structural-cleanup.test.mjs
  - tests/unit/structural-imports.test.mjs
  - tests/unit/format-phase.test.mjs
  - tests/unit/adapter-shell.test.mjs
  - tests/unit/package-json-shape.test.mjs
  - tests/unit/docs-content.test.mjs
  - tests/conformance/.gitkeep
  - archive/v0.2-shadow/README.md
autonomous: true
requirements:
  - TEST-01
must_haves:
  truths:
    - "tests/unit/ directory exists and contains 6 new test files"
    - "tests/conformance/ exists with .gitkeep so Phase 7 can populate"
    - "archive/v0.2-shadow/ directory tree exists with README.md and 4 subdirs"
    - "Wave 0 tests are red (will go green as Waves 1-3 land); they fail with file-not-found / import-not-resolvable, never with syntax errors"
  artifacts:
    - path: "tests/unit/structural-cleanup.test.mjs"
      provides: "CLEAN-01..04 + REQUIREMENTS.md edit verification"
    - path: "tests/unit/structural-imports.test.mjs"
      provides: "ARCH-01, ARCH-02 import-resolves verification"
    - path: "tests/unit/format-phase.test.mjs"
      provides: "ARCH-03 round-trip property test driver"
    - path: "tests/unit/adapter-shell.test.mjs"
      provides: "ARCH-04 BeadsAdapter constructor + capabilities + stub-throw verification"
    - path: "tests/unit/package-json-shape.test.mjs"
      provides: "ARCH-05 package.json structural assertions"
    - path: "tests/unit/docs-content.test.mjs"
      provides: "DOC-01, DOC-02 keyword-grep assertions"
    - path: "archive/v0.2-shadow/README.md"
      provides: "archive context for future readers"
    - path: "tests/conformance/.gitkeep"
      provides: "empty placeholder so directory exists in git"
  key_links:
    - from: "tests/unit/structural-imports.test.mjs"
      to: "src/bd/helper.mjs, src/bd/errors.mjs, src/bd/findRoot.mjs, src/helpers/index.mjs, src/format/phase.mjs"
      via: "dynamic import in test"
      pattern: "await import\\('\\.\\./\\.\\./src/"
    - from: "tests/unit/adapter-shell.test.mjs"
      to: "src/adapter.mjs"
      via: "dynamic import + new BeadsAdapter()"
      pattern: "BeadsAdapter"
---

<objective>
Wave 0 lays down the validation harness for every other plan in Phase 6.
Six new test files + the archive directory tree + the empty conformance/
directory are created BEFORE any source code is moved or written. Tests
start red and turn green as Waves 1-3 land; this is the Nyquist
sampling discipline (per .planning/phases/06-cleanup-adapter-library-scaffolding/06-VALIDATION.md).

Purpose: Every downstream task in Phases 02..07 has its automated verifier
already on disk, so `npm run test:unit` is a meaningful gate from Wave 1
onward. This plan ALSO archives the directory scaffolding (`archive/v0.2-shadow/`
with README.md) so Wave 1's `git mv` operations have somewhere to land.

Output: 6 test files (red), 1 conformance .gitkeep, 1 archive README, 4
empty archive subdirs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md
@.planning/phases/06-cleanup-adapter-library-scaffolding/06-VALIDATION.md
@.claude/skills/spike-findings-gsd-beads/SKILL.md

<interfaces>
<!-- Wave 0 tests reference these post-cleanup paths. Files do NOT exist yet -
     tests will start red and turn green as Waves 1-3 land. -->

Files Wave 0 tests will reference (created by later plans):
- src/bd/helper.mjs (Plan 04)
- src/bd/errors.mjs (Plan 04)
- src/bd/findRoot.mjs (Plan 04)
- src/helpers/index.mjs (Plan 04)
- src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,loadMilestoneHeading}.mjs (Plan 04)
- src/format/phase.mjs (Plan 05)
- src/adapter.mjs (Plan 06)
- src/adapter/{primitives,phaseLifecycle,roadmapMilestone,state,verifyReviews,discussTodos,longTail,initBundlers}.mjs (Plan 06)
- package.json (Plan 07)
- README.md (rewritten in Plan 07)
- CLAUDE.md (rewritten in Plan 07)

Stub error message format (per D-05; tested in adapter-shell.test.mjs):
  /^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/

REQUIREMENTS.md CLEAN-03 wording (per D-12; tested in structural-cleanup.test.mjs):
  "scripts/cascade-loop.sh also archives" must appear in the file post-edit.

CLAUDE.md auto-load line (per D-24; tested in docs-content.test.mjs):
  Skill("spike-findings-gsd-beads")
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create archive directory tree + README</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §8 "archive/v0.2-shadow/README.md (new file)" lines 1013-1057 for verbatim README content
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md decisions D-10 / D-12 / D-13 for what each subdir will receive
  </read_first>
  <files>
    - archive/v0.2-shadow/README.md
    - archive/v0.2-shadow/bin/.gitkeep
    - archive/v0.2-shadow/hooks/.gitkeep
    - archive/v0.2-shadow/scripts/.gitkeep
    - archive/v0.2-shadow/tests/.gitkeep
    - archive/v0.2-shadow/tests/shadow-tests/.gitkeep
    - archive/v0.2-shadow/tests/scripts/.gitkeep
  </files>
  <action>
    Create the archive directory tree using `mkdir -p`:

    ```bash
    mkdir -p archive/v0.2-shadow/bin
    mkdir -p archive/v0.2-shadow/hooks
    mkdir -p archive/v0.2-shadow/scripts
    mkdir -p archive/v0.2-shadow/tests
    mkdir -p archive/v0.2-shadow/tests/shadow-tests
    mkdir -p archive/v0.2-shadow/tests/scripts
    ```

    Add `.gitkeep` to each so they exist in git:

    ```bash
    touch archive/v0.2-shadow/bin/.gitkeep
    touch archive/v0.2-shadow/hooks/.gitkeep
    touch archive/v0.2-shadow/scripts/.gitkeep
    touch archive/v0.2-shadow/tests/.gitkeep
    touch archive/v0.2-shadow/tests/shadow-tests/.gitkeep
    touch archive/v0.2-shadow/tests/scripts/.gitkeep
    ```

    Create `archive/v0.2-shadow/README.md` with the EXACT content specified in
    RESEARCH.md §8 lines 1017-1057 (starts "# Archive: v0.2 shadow architecture",
    ends with the carry-forward bullet list and "remain reproducible against the
    original code that demonstrated them"). Reproduce verbatim — do not paraphrase.
    Include the references to D-2026-04-30-01 and SYNTHESIS.md.

    Wave 1 plans will `git mv` files into these subdirs; the .gitkeep files
    can stay (harmless) or be removed by Wave 1 plans when subdirs are no
    longer empty.
  </action>
  <verify>
    <automated>test -f archive/v0.2-shadow/README.md &amp;&amp; test -d archive/v0.2-shadow/bin &amp;&amp; test -d archive/v0.2-shadow/hooks &amp;&amp; test -d archive/v0.2-shadow/scripts &amp;&amp; test -d archive/v0.2-shadow/tests/shadow-tests &amp;&amp; grep -q "Archive: v0.2 shadow architecture" archive/v0.2-shadow/README.md &amp;&amp; grep -q "D-2026-04-30-01" archive/v0.2-shadow/README.md &amp;&amp; grep -q "spike findings" archive/v0.2-shadow/README.md</automated>
  </verify>
  <acceptance_criteria>
    - `archive/v0.2-shadow/README.md` exists with first heading `# Archive: v0.2 shadow architecture`
    - File contains the exact phrase "scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh"
    - File contains the exact phrase "Do not link, import, or run anything from this directory"
    - `archive/v0.2-shadow/bin/`, `hooks/`, `scripts/`, `tests/shadow-tests/`, `tests/scripts/` exist as directories
    - `git status` shows the new files staged or untracked (no merge errors)
  </acceptance_criteria>
  <done>Archive tree + README in place; Wave 1 has destinations for `git mv`</done>
</task>

<task type="auto">
  <name>Task 2: Create tests/unit/ + tests/conformance/ scaffolding</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §9 "Wave 0 gaps" lines 1102-1117 for the list of test files to create
  </read_first>
  <files>
    - tests/unit/.gitkeep
    - tests/unit/fixtures/phase-format/.gitkeep
    - tests/conformance/.gitkeep
  </files>
  <action>
    Create the new test directory structure:

    ```bash
    mkdir -p tests/unit
    mkdir -p tests/unit/fixtures/phase-format
    mkdir -p tests/conformance
    touch tests/unit/.gitkeep
    touch tests/unit/fixtures/phase-format/.gitkeep
    touch tests/conformance/.gitkeep
    ```

    The `.gitkeep` in `tests/unit/` will be removed once Tasks 3-8 of this
    plan create the actual test files; leave it for now so the directory is
    real even before any test files exist.

    `tests/unit/fixtures/phase-format/.gitkeep` is replaced by Plan 05 with
    11 fixture markdown files; leave the placeholder in place for now.

    `tests/conformance/.gitkeep` is the permanent placeholder per D-08 +
    RESEARCH.md §7 — Phase 7 populates the directory with conformance tests.
  </action>
  <verify>
    <automated>test -d tests/unit &amp;&amp; test -d tests/unit/fixtures/phase-format &amp;&amp; test -d tests/conformance &amp;&amp; test -f tests/conformance/.gitkeep</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/` exists as a directory tracked in git
    - `tests/conformance/.gitkeep` exists (permanent placeholder)
    - `tests/unit/fixtures/phase-format/` exists (Plan 05 will fill)
  </acceptance_criteria>
  <done>tests/unit/ + tests/conformance/ scaffolding in place</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create tests/unit/structural-cleanup.test.mjs (CLEAN-01..04 + REQUIREMENTS.md edit)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §9 lines 1080-1083 (per-req structural commands)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #1 (D-12 REQUIREMENTS.md wording specifics)
    - .planning/REQUIREMENTS.md lines 305-310 (current CLEAN-03 wording — to be updated by Plan 07)
  </read_first>
  <behavior>
    - Test 1 (CLEAN-01): asserts archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs exists AND archive/v0.2-shadow/bin/wrap-mutation.mjs exists AND bin/gsd-sdk-shadow.mjs does NOT exist AND bin/wrap-mutation.mjs does NOT exist
    - Test 2 (CLEAN-02): asserts archive/v0.2-shadow/hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,worktree-post-checkout}.sh ALL exist AND the same files do NOT exist under hooks/
    - Test 3 (CLEAN-03 file moves): asserts archive/v0.2-shadow/scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh ALL exist AND the same files do NOT exist under scripts/
    - Test 4 (CLEAN-03 REQUIREMENTS.md wording): reads `.planning/REQUIREMENTS.md` and asserts it contains the substring `scripts/cascade-loop.sh also archives` (the post-D-12 wording per RESEARCH.md §10 Risk #1)
    - Test 5 (CLEAN-04): asserts install.sh does NOT exist at the repo root
  </behavior>
  <action>
    Create `tests/unit/structural-cleanup.test.mjs` using `node:test` and
    `node:assert/strict`:

    ```js
    // tests/unit/structural-cleanup.test.mjs
    // Verifies CLEAN-01..04 + the D-12 REQUIREMENTS.md wording fix.
    // Wave 0 file: red until Plans 02 + 07 land.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { existsSync, readFileSync } from 'node:fs';
    import { resolve } from 'node:path';

    const ROOT = resolve(import.meta.dirname, '../..');
    const exists = (rel) => existsSync(resolve(ROOT, rel));
    const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

    test('CLEAN-01: shadow binaries archived, originals removed', () => {
      assert.ok(exists('archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs'),
        'shadow binary should be in archive');
      assert.ok(exists('archive/v0.2-shadow/bin/wrap-mutation.mjs'),
        'wrap-mutation should be in archive');
      assert.ok(!exists('bin/gsd-sdk-shadow.mjs'),
        'bin/gsd-sdk-shadow.mjs should be archived (removed from bin/)');
      assert.ok(!exists('bin/wrap-mutation.mjs'),
        'bin/wrap-mutation.mjs should be archived (removed from bin/)');
    });

    test('CLEAN-02: shadow hooks archived, originals removed', () => {
      const hooks = ['block-gsd-sdk-mutation', 'block-state-md', 'bd-sync', 'worktree-post-checkout'];
      for (const h of hooks) {
        assert.ok(exists(`archive/v0.2-shadow/hooks/${h}.sh`),
          `${h}.sh should be in archive`);
        assert.ok(!exists(`hooks/${h}.sh`),
          `hooks/${h}.sh should be removed`);
      }
    });

    test('CLEAN-03 file moves: regen + cascade-loop scripts archived', () => {
      const scripts = ['regen-roadmap', 'regen-requirements', 'regen-state', 'cascade-loop'];
      for (const s of scripts) {
        assert.ok(exists(`archive/v0.2-shadow/scripts/${s}.sh`),
          `${s}.sh should be in archive`);
        assert.ok(!exists(`scripts/${s}.sh`),
          `scripts/${s}.sh should be removed`);
      }
    });

    test('CLEAN-03 REQUIREMENTS.md wording: D-12 reflected', () => {
      const req = read('.planning/REQUIREMENTS.md');
      assert.match(req, /scripts\/cascade-loop\.sh also archives/,
        'REQUIREMENTS.md CLEAN-03 must reflect D-12 (cascade-loop archives)');
    });

    test('CLEAN-04: install.sh deleted', () => {
      assert.ok(!exists('install.sh'),
        'install.sh should be deleted (CLEAN-04)');
    });
    ```

    Run `node --test tests/unit/structural-cleanup.test.mjs` to confirm it
    runs (will be all red — files have not moved yet, REQUIREMENTS.md not
    edited yet). Red is correct for Wave 0.
  </action>
  <verify>
    <automated>node --test tests/unit/structural-cleanup.test.mjs 2>&amp;1 | grep -E "^# (tests|pass|fail)" | head -10; test -f tests/unit/structural-cleanup.test.mjs &amp;&amp; grep -c "^test(" tests/unit/structural-cleanup.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/unit/structural-cleanup.test.mjs` exists
    - File contains exactly 5 `test(` declarations (CLEAN-01..04 + REQUIREMENTS.md edit)
    - File imports from `node:test`, `node:assert/strict`, `node:fs`, `node:path`
    - Running `node --test tests/unit/structural-cleanup.test.mjs` parses without syntax errors (it WILL fail on assertions — that's expected at Wave 0)
    - File contains the exact regex pattern `/scripts\/cascade-loop\.sh also archives/` (or equivalent string match)
  </acceptance_criteria>
  <done>structural-cleanup.test.mjs in place; will turn green after Plans 02 + 07</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Create tests/unit/structural-imports.test.mjs (ARCH-01, ARCH-02)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §9 lines 1084-1085 (ARCH-01, ARCH-02 import-resolves expectations)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-08 (the expected exports map subpaths)
  </read_first>
  <behavior>
    - Test 1 (ARCH-01 src/bd/ leaf files): each of src/bd/helper.mjs, src/bd/errors.mjs, src/bd/findRoot.mjs imports successfully via dynamic import; `helper.mjs` exports `bd`; `errors.mjs` exports `BeadsUnavailableError`; `findRoot.mjs` exports `findBeadsRoot`
    - Test 2 (ARCH-02 src/helpers/ barrel): src/helpers/index.mjs imports successfully and exports parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading as named exports
    - Test 3 (ARCH-02 leaf helpers): each individual helper file (parsePhaseId.mjs, deriveDiskStatus.mjs, detectDrift.mjs, loadMilestoneHeading.mjs) imports and exports a function with the matching name
  </behavior>
  <action>
    Create `tests/unit/structural-imports.test.mjs`:

    ```js
    // tests/unit/structural-imports.test.mjs
    // Verifies ARCH-01 (src/bd/) + ARCH-02 (src/helpers/).
    // Wave 0 file: red until Plan 04 lands the source files.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';

    test('ARCH-01: src/bd/helper.mjs exports bd()', async () => {
      const mod = await import('../../src/bd/helper.mjs');
      assert.equal(typeof mod.bd, 'function', 'src/bd/helper.mjs must export bd()');
    });

    test('ARCH-01: src/bd/errors.mjs exports BeadsUnavailableError + BeadsCause', async () => {
      const mod = await import('../../src/bd/errors.mjs');
      assert.equal(typeof mod.BeadsUnavailableError, 'function',
        'src/bd/errors.mjs must export BeadsUnavailableError class');
      assert.ok(mod.BeadsCause, 'src/bd/errors.mjs must export BeadsCause enum');
    });

    test('ARCH-01: src/bd/findRoot.mjs exports findBeadsRoot()', async () => {
      const mod = await import('../../src/bd/findRoot.mjs');
      assert.equal(typeof mod.findBeadsRoot, 'function',
        'src/bd/findRoot.mjs must export findBeadsRoot()');
    });

    test('ARCH-02: src/helpers/index.mjs barrel exports all 4 helpers', async () => {
      const mod = await import('../../src/helpers/index.mjs');
      for (const name of ['parsePhaseId', 'deriveDiskStatus', 'detectDrift', 'loadMilestoneHeading']) {
        assert.equal(typeof mod[name], 'function',
          `src/helpers/index.mjs must export ${name}()`);
      }
    });

    test('ARCH-02: src/helpers/parsePhaseId.mjs leaf module', async () => {
      const mod = await import('../../src/helpers/parsePhaseId.mjs');
      assert.equal(typeof mod.parsePhaseId, 'function');
    });

    test('ARCH-02: src/helpers/deriveDiskStatus.mjs leaf module', async () => {
      const mod = await import('../../src/helpers/deriveDiskStatus.mjs');
      assert.equal(typeof mod.deriveDiskStatus, 'function');
    });

    test('ARCH-02: src/helpers/detectDrift.mjs leaf module', async () => {
      const mod = await import('../../src/helpers/detectDrift.mjs');
      assert.equal(typeof mod.detectDrift, 'function');
    });

    test('ARCH-02: src/helpers/loadMilestoneHeading.mjs leaf module', async () => {
      const mod = await import('../../src/helpers/loadMilestoneHeading.mjs');
      assert.equal(typeof mod.loadMilestoneHeading, 'function');
    });
    ```

    Run `node --test tests/unit/structural-imports.test.mjs` — will be red
    (src/ doesn't exist). Red is correct for Wave 0.
  </action>
  <verify>
    <automated>test -f tests/unit/structural-imports.test.mjs &amp;&amp; grep -c "^test(" tests/unit/structural-imports.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/unit/structural-imports.test.mjs` exists
    - Contains 8 `test(` declarations (3 src/bd/ + 5 src/helpers/)
    - Uses dynamic `await import(...)` (not static) so test file parses even when target modules are absent
    - File parses without syntax errors via `node --check tests/unit/structural-imports.test.mjs`
  </acceptance_criteria>
  <done>structural-imports.test.mjs in place; will turn green after Plan 04</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Create tests/unit/format-phase.test.mjs (ARCH-03)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §2 lines 257-326 (round-trip contract + node:test pattern)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-14, D-15, D-17 (signatures + idempotency contract + fixture set)
  </read_first>
  <behavior>
    - Test 1 (parsePhaseTitle): for each canonical title (e.g., "Phase 1: Spike — validate beads + GSD topology"), parsePhaseTitle returns {number, name} with exact expected values
    - Test 2 (formatPhaseTitle): formatPhaseTitle({number: '1', name: 'Spike'}) returns 'Phase 1: Spike'
    - Test 3 (round-trip title): for each title fixture, parsePhaseTitle(formatPhaseTitle(parsePhaseTitle(title))) deep-equals parsePhaseTitle(title)
    - Test 4 (round-trip description per fixture): for each fixture file in tests/unit/fixtures/phase-format/*.md, parsePhaseDescription(formatPhaseDescription(parsePhaseDescription(body))) deep-equals parsePhaseDescription(body) — the D-15 idempotency contract
    - Test 5 (decimal phase number): parsePhaseTitle('Phase 72.1: gap closure') returns {number: '72.1', name: 'gap closure'}
  </behavior>
  <action>
    Create `tests/unit/format-phase.test.mjs`:

    ```js
    // tests/unit/format-phase.test.mjs
    // Verifies ARCH-03 round-trip contract per D-15 + D-17.
    // Wave 0 file: red until Plan 05 lands src/format/phase.mjs and the
    // 11 fixture files in tests/unit/fixtures/phase-format/.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync, readdirSync, existsSync } from 'node:fs';
    import { resolve } from 'node:path';

    const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures/phase-format');

    test('parsePhaseTitle: simple single-digit', async () => {
      const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
      assert.deepEqual(
        parsePhaseTitle('Phase 1: Spike — validate beads + GSD topology'),
        { number: '1', name: 'Spike — validate beads + GSD topology' }
      );
    });

    test('parsePhaseTitle: two-digit', async () => {
      const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
      assert.deepEqual(
        parsePhaseTitle('Phase 13: Workflow init bundlers + conformance test suite + final docs'),
        { number: '13', name: 'Workflow init bundlers + conformance test suite + final docs' }
      );
    });

    test('parsePhaseTitle: decimal phase number preserved', async () => {
      const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
      assert.deepEqual(
        parsePhaseTitle('Phase 72.1: gap closure'),
        { number: '72.1', name: 'gap closure' }
      );
    });

    test('formatPhaseTitle: round-trip on single title', async () => {
      const { parsePhaseTitle, formatPhaseTitle } = await import('../../src/format/phase.mjs');
      const original = 'Phase 6: Cleanup + adapter-library scaffolding';
      const parsed1 = parsePhaseTitle(original);
      const formatted = formatPhaseTitle(parsed1);
      const parsed2 = parsePhaseTitle(formatted);
      assert.deepStrictEqual(parsed2, parsed1,
        'parse(format(parse(x))) must equal parse(x) — D-15 idempotency');
    });

    // Per D-15 + D-17: round-trip idempotency for each fixture.
    if (existsSync(FIXTURE_DIR)) {
      const fixtures = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.md'));
      for (const fixture of fixtures) {
        test(`round-trip idempotent description: ${fixture}`, async () => {
          const { parsePhaseDescription, formatPhaseDescription } =
            await import('../../src/format/phase.mjs');
          const body = readFileSync(resolve(FIXTURE_DIR, fixture), 'utf-8');
          const parsed1 = parsePhaseDescription(body);
          const formatted = formatPhaseDescription(parsed1);
          const parsed2 = parsePhaseDescription(formatted);
          assert.deepStrictEqual(parsed2, parsed1,
            `parse(format(parse(${fixture}))) must equal parse(${fixture})`);
        });
      }
    } else {
      test('SKIP: fixture dir tests/unit/fixtures/phase-format/ does not exist yet', () => {
        // Plan 05 creates the fixtures; until then this branch fires once.
        assert.ok(true, 'fixture dir absent — Plan 05 will populate');
      });
    }
    ```

    Run `node --test tests/unit/format-phase.test.mjs` — will be red on the
    parse tests (src/format/phase.mjs missing); the fixture-loop will run
    the SKIP branch. Red is correct for Wave 0.
  </action>
  <verify>
    <automated>test -f tests/unit/format-phase.test.mjs &amp;&amp; grep -c "deepStrictEqual\|deepEqual" tests/unit/format-phase.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/unit/format-phase.test.mjs` exists
    - Contains the exact assertion pattern `parse(format(parse(...)))` (the D-15 contract)
    - Uses `existsSync(FIXTURE_DIR)` guard so the file parses even when fixtures are missing
    - Imports format functions via `await import('../../src/format/phase.mjs')` (dynamic so missing module doesn't break parse)
    - At least 3 inline title tests (simple, two-digit, decimal) plus fixture-loop tests
  </acceptance_criteria>
  <done>format-phase.test.mjs in place; will turn green after Plan 05 lands fixtures + module</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Create tests/unit/adapter-shell.test.mjs (ARCH-04)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §4 lines 444-624 (skeleton + capabilities + stub format)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-01..D-05 (cluster names + lazy bd validation + stub message format)
  </read_first>
  <behavior>
    - Test 1 (constructor accepts string): `new BeadsAdapter('/tmp/anything')` does NOT throw
    - Test 2 (constructor rejects empty/non-string): `new BeadsAdapter()` and `new BeadsAdapter('')` throw TypeError
    - Test 3 (capabilities flag readable without instantiation): `BeadsAdapter.capabilities` is an object with the 7 keys (record, section, binaryAsset, snapshot, transaction, namedDoc, commitPlanningState) all as booleans
    - Test 4 (capabilities is frozen): `Object.isFrozen(BeadsAdapter.capabilities)` returns true
    - Test 5 (stub method throws canonical message): calling `adapter.addPhase({})` throws an Error whose message matches the regex `/^BeadsAdapter\.addPhase: not implemented \(Phase \d+ \/ IMPL-\d+\)$/`
    - Test 6 (every cluster method throws canonical pattern): for a sampled method from each of the 8 clusters (e.g., getRecord, addPhase, getRoadmap, getStateSnapshot, getVerification, getTodo, getConfig, getProgressInit), calling it throws an Error whose message matches `/^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/`
  </behavior>
  <action>
    Create `tests/unit/adapter-shell.test.mjs`:

    ```js
    // tests/unit/adapter-shell.test.mjs
    // Verifies ARCH-04 BeadsAdapter shell + capabilities + stub pattern.
    // Wave 0 file: red until Plan 06 lands src/adapter.mjs + 8 cluster files.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';

    const STUB_RE = /^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/;

    test('ARCH-04: constructor accepts string projectRoot', async () => {
      const { BeadsAdapter } = await import('../../src/adapter.mjs');
      assert.doesNotThrow(() => new BeadsAdapter('/tmp/anywhere'));
    });

    test('ARCH-04: constructor rejects empty/non-string projectRoot', async () => {
      const { BeadsAdapter } = await import('../../src/adapter.mjs');
      assert.throws(() => new BeadsAdapter(), TypeError);
      assert.throws(() => new BeadsAdapter(''), TypeError);
      assert.throws(() => new BeadsAdapter(null), TypeError);
    });

    test('ARCH-04: capabilities flag readable WITHOUT instantiation', async () => {
      const { BeadsAdapter } = await import('../../src/adapter.mjs');
      const c = BeadsAdapter.capabilities;
      assert.equal(typeof c, 'object');
      for (const k of ['record', 'section', 'binaryAsset', 'snapshot', 'transaction', 'namedDoc', 'commitPlanningState']) {
        assert.equal(typeof c[k], 'boolean', `capabilities.${k} must be a boolean`);
      }
    });

    test('ARCH-04: capabilities is frozen (Object.isFrozen)', async () => {
      const { BeadsAdapter } = await import('../../src/adapter.mjs');
      assert.ok(Object.isFrozen(BeadsAdapter.capabilities),
        'BeadsAdapter.capabilities must be Object.freeze\\'d');
    });

    test('ARCH-04: stub methods throw canonical message format', async () => {
      const { BeadsAdapter } = await import('../../src/adapter.mjs');
      const adapter = new BeadsAdapter('/tmp/anywhere');

      // Spot-check one method from each of the 8 cluster files.
      const samples = [
        ['getRecord', '/tmp/foo'],            // primitives
        ['addPhase', { description: 'x' }],   // phaseLifecycle
        ['getRoadmap'],                       // roadmapMilestone
        ['getStateSnapshot'],                 // state
        ['getVerification', '6'],             // verifyReviews
        ['getTodo', 'todo-1'],                // discussTodos
        ['getConfig'],                        // longTail
        ['getProgressInit'],                  // initBundlers
      ];

      for (const [name, ...args] of samples) {
        await assert.rejects(
          async () => adapter[name](...args),
          (err) => {
            assert.match(err.message, STUB_RE,
              `${name} should throw canonical "BeadsAdapter.<name>: not implemented (Phase N / (PRIM|IMPL)-NN)" — got: ${err.message}`);
            return true;
          }
        );
      }
    });

    test('ARCH-04: stub methods include the method name in the error', async () => {
      const { BeadsAdapter } = await import('../../src/adapter.mjs');
      const adapter = new BeadsAdapter('/tmp/anywhere');
      await assert.rejects(
        async () => adapter.addPhase({}),
        (err) => err.message.includes('BeadsAdapter.addPhase')
      );
    });
    ```

    Run `node --test tests/unit/adapter-shell.test.mjs` — will be red
    (src/adapter.mjs missing). Red is correct for Wave 0.
  </action>
  <verify>
    <automated>test -f tests/unit/adapter-shell.test.mjs &amp;&amp; grep -c "STUB_RE\|BeadsAdapter\\.\\\\w+" tests/unit/adapter-shell.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/unit/adapter-shell.test.mjs` exists
    - Contains the exact regex literal `/^BeadsAdapter\.\w+: not implemented \(Phase \d+ \/ (PRIM|IMPL)-\d+\)$/`
    - Tests use dynamic import `await import('../../src/adapter.mjs')`
    - Sample method list covers all 8 clusters (8 entries minimum)
    - At least one test asserts `Object.isFrozen(BeadsAdapter.capabilities)`
  </acceptance_criteria>
  <done>adapter-shell.test.mjs in place; will turn green after Plan 06</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: Create tests/unit/package-json-shape.test.mjs (ARCH-05)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §3 lines 332-440 (full package.json blueprint)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-06, D-07, D-08, D-09 (locked package shape decisions)
  </read_first>
  <behavior>
    - Test 1 (file exists + parses): package.json exists at repo root and is valid JSON
    - Test 2 (name + version + type): name === 'gsd-beads', version === '1.0.0-alpha.0', type === 'module'
    - Test 3 (exports map structure per D-08): exports['.'] === './src/adapter.mjs'; exports has the keys './bd', './bd/errors', './bd/findRoot', './helpers', './format/phase', './package.json'
    - Test 4 (no bin entries per D-09): package.json has no 'bin' key
    - Test 5 (peer deps per D-06): peerDependencies['get-shit-done-cc'] === '*' AND peerDependenciesMeta['get-shit-done-cc'].optional === true
    - Test 6 (scripts per D-09): scripts.test exists; scripts['test:unit'] exists; scripts['test:conformance'] exists; scripts['link:fork'] exists; no 'install' script; no 'postinstall' script
    - Test 7 (engines per D-09): engines.node matches /^>=20/
  </behavior>
  <action>
    Create `tests/unit/package-json-shape.test.mjs`:

    ```js
    // tests/unit/package-json-shape.test.mjs
    // Verifies ARCH-05 / D-06..D-09 package.json shape.
    // Wave 0 file: red until Plan 07 writes package.json.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync, existsSync } from 'node:fs';
    import { resolve } from 'node:path';

    const ROOT = resolve(import.meta.dirname, '../..');
    const PKG_PATH = resolve(ROOT, 'package.json');

    test('ARCH-05: package.json exists and parses', () => {
      assert.ok(existsSync(PKG_PATH), 'package.json must exist at repo root');
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      assert.ok(pkg);
    });

    test('ARCH-05/D-07: name + version + type', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      assert.equal(pkg.name, 'gsd-beads', 'name must be gsd-beads (D-07)');
      assert.equal(pkg.version, '1.0.0-alpha.0', 'version must be 1.0.0-alpha.0 (D-07)');
      assert.equal(pkg.type, 'module', 'type must be "module" (ESM)');
    });

    test('ARCH-05/D-08: exports map subpath structure', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      assert.equal(pkg.exports['.'], './src/adapter.mjs',
        '"." must point at src/adapter.mjs');
      const required = ['./bd', './bd/errors', './bd/findRoot', './helpers', './format/phase', './package.json'];
      for (const sub of required) {
        assert.ok(pkg.exports[sub] !== undefined,
          `exports must include subpath "${sub}" (D-08)`);
      }
    });

    test('ARCH-05/D-09: no bin entries (library shape)', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      assert.equal(pkg.bin, undefined, 'package.json must have no "bin" field (D-09)');
    });

    test('ARCH-05/D-06: peer deps optional fork', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      assert.equal(pkg.peerDependencies?.['get-shit-done-cc'], '*',
        'peerDependencies must declare "get-shit-done-cc": "*" (D-06)');
      assert.equal(pkg.peerDependenciesMeta?.['get-shit-done-cc']?.optional, true,
        'peerDependenciesMeta must mark fork as optional (D-06)');
    });

    test('ARCH-05/D-09: scripts have test/test:unit/test:conformance/link:fork; no install/postinstall', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      for (const s of ['test', 'test:unit', 'test:conformance', 'link:fork']) {
        assert.ok(pkg.scripts?.[s], `scripts.${s} must be present (D-09)`);
      }
      assert.equal(pkg.scripts?.install, undefined, 'no install script allowed (CLEAN-04)');
      assert.equal(pkg.scripts?.postinstall, undefined, 'no postinstall script allowed (CLEAN-04)');
    });

    test('ARCH-05/D-09: engines.node >=20', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      assert.match(pkg.engines?.node ?? '', /^>=\s*20/, 'engines.node must be ">=20" (D-09)');
    });
    ```

    Run `node --test tests/unit/package-json-shape.test.mjs` — will be red
    (no package.json yet). Red is correct for Wave 0.
  </action>
  <verify>
    <automated>test -f tests/unit/package-json-shape.test.mjs &amp;&amp; grep -c "^test(" tests/unit/package-json-shape.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/unit/package-json-shape.test.mjs` exists
    - Contains exactly 7 `test(` declarations
    - Each test reads `package.json` via `readFileSync` (re-reads each time so partial writes don't poison)
    - Asserts the exact six required subpaths in exports map
    - Includes the assertion `pkg.scripts.install === undefined` (CLEAN-04 wired)
  </acceptance_criteria>
  <done>package-json-shape.test.mjs in place; will turn green after Plan 07</done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: Create tests/unit/docs-content.test.mjs (DOC-01, DOC-02)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §8 lines 880-1011 (README.md sections + CLAUDE.md rewrite)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-24 (CLAUDE.md must keep `Skill("spike-findings-gsd-beads")` line)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #6 (CLAUDE.md auto-load preservation)
  </read_first>
  <behavior>
    - Test 1 (DOC-01: README mentions BeadsAdapter): grep README.md for the word "BeadsAdapter"
    - Test 2 (DOC-01: README mentions sibling fork at ~/code/get-shit-done): grep for the path
    - Test 3 (DOC-01: README does NOT mention install.sh as active behavior): grep -v 'install.sh' (or grep that the only mention is "(removed)" if any)
    - Test 4 (DOC-02: CLAUDE.md mentions sibling adapter library role): grep for "sibling" or "adapter library"
    - Test 5 (DOC-02: CLAUDE.md preserves spike-findings auto-load per D-24): grep -q 'Skill("spike-findings-gsd-beads")'
    - Test 6 (DOC-02: CLAUDE.md mentions fork at ~/code/get-shit-done): grep for the path
    - Test 7 (CONTRIBUTING.md exists with npm link instruction per D-06): file exists; contains "npm link" substring
    - Test 8 (CLAUDE.md does NOT contain stale "skill + hook layer" framing): grep -v 'skill + hook layer' (the obsolete 11-line description from current CLAUDE.md)
  </behavior>
  <action>
    Create `tests/unit/docs-content.test.mjs`:

    ```js
    // tests/unit/docs-content.test.mjs
    // Verifies DOC-01 (README.md) + DOC-02 (CLAUDE.md) + CONTRIBUTING.md.
    // Wave 0 file: red until Plan 07 lands the documentation rewrite.

    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync, existsSync } from 'node:fs';
    import { resolve } from 'node:path';

    const ROOT = resolve(import.meta.dirname, '../..');
    const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');
    const exists = (rel) => existsSync(resolve(ROOT, rel));

    test('DOC-01: README mentions BeadsAdapter', () => {
      const readme = read('README.md');
      assert.match(readme, /BeadsAdapter/,
        'README.md must reference BeadsAdapter');
    });

    test('DOC-01: README mentions sibling fork at ~/code/get-shit-done', () => {
      const readme = read('README.md');
      assert.match(readme, /~\/code\/get-shit-done|get-shit-done-cc/,
        'README.md must reference sibling fork');
    });

    test('DOC-01: README does NOT promote install.sh as active', () => {
      const readme = read('README.md');
      // install.sh should NOT appear as install instruction. It may
      // appear in a "Removed in v1.0" note, but not as ./install.sh.
      assert.doesNotMatch(readme, /^\s*\.\/install\.sh/m,
        'README.md must not show ./install.sh as an active install step');
    });

    test('DOC-02: CLAUDE.md describes sibling adapter library role', () => {
      const claude = read('CLAUDE.md');
      assert.match(claude, /sibling|adapter library/i,
        'CLAUDE.md must describe sibling adapter library role');
    });

    test('DOC-02 (D-24): CLAUDE.md preserves spike-findings auto-load', () => {
      const claude = read('CLAUDE.md');
      assert.match(claude, /Skill\("spike-findings-gsd-beads"\)/,
        'CLAUDE.md MUST preserve `Skill("spike-findings-gsd-beads")` auto-load (D-24)');
    });

    test('DOC-02: CLAUDE.md mentions fork repo location', () => {
      const claude = read('CLAUDE.md');
      assert.match(claude, /~\/code\/get-shit-done/,
        'CLAUDE.md must reference fork at ~/code/get-shit-done');
    });

    test('CONTRIBUTING.md exists with npm link workflow (D-06)', () => {
      assert.ok(exists('CONTRIBUTING.md'),
        'CONTRIBUTING.md must exist (D-06)');
      const contrib = read('CONTRIBUTING.md');
      assert.match(contrib, /npm link/,
        'CONTRIBUTING.md must document npm link workflow');
    });

    test('DOC-02: CLAUDE.md drops stale "skill + hook layer" framing', () => {
      const claude = read('CLAUDE.md');
      assert.doesNotMatch(claude, /skill \+ hook layer/,
        'CLAUDE.md must remove the v0.2 "skill + hook layer" framing');
    });
    ```

    Run `node --test tests/unit/docs-content.test.mjs` — will be red on
    most tests (current README.md is v0.1-shaped; CLAUDE.md is the 11-line
    v0.2 framing; CONTRIBUTING.md doesn't exist). Red is correct for Wave 0.
  </action>
  <verify>
    <automated>test -f tests/unit/docs-content.test.mjs &amp;&amp; grep -c "^test(" tests/unit/docs-content.test.mjs &amp;&amp; grep -q 'spike-findings-gsd-beads' tests/unit/docs-content.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/unit/docs-content.test.mjs` exists
    - Contains exactly 8 `test(` declarations
    - Contains the exact regex `/Skill\("spike-findings-gsd-beads"\)/` (literal D-24 contract)
    - Contains assertion that CLAUDE.md does NOT contain "skill + hook layer"
    - Contains assertion that CONTRIBUTING.md exists
  </acceptance_criteria>
  <done>docs-content.test.mjs in place; will turn green after Plan 07</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| n/a | Wave 0 only writes test files and an archive README — no code paths execute against external input. No trust boundary crossed. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.01-01 | Tampering | tests/unit/structural-imports.test.mjs uses dynamic import | accept | Dynamic `await import()` is required so test files parse before target modules exist; risk is bounded — the test files only import paths within the repo (`../../src/...`), no external URLs. ASVS L1 N/A. |
| T-6.01-02 | Information Disclosure | archive/v0.2-shadow/README.md | accept | Documents archive purpose to future readers; no secrets. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- `npm run test:unit` parses all 6 new test files without syntax errors
- `node --test tests/unit/structural-cleanup.test.mjs` runs (red is acceptable; red proves tests are wired and waiting for Wave 1+)
- `git status` shows the new test files + archive scaffolding as untracked or staged
- No file under `src/` or `package.json` is created in Wave 0 (those belong to Wave 2/3)
</verification>

<success_criteria>
- 6 new test files exist under `tests/unit/`
- `archive/v0.2-shadow/` exists with the documented README and 4 subdirs
- `tests/conformance/.gitkeep` exists
- `tests/unit/fixtures/phase-format/` exists (Plan 05 will populate)
- All test files parse (`node --check tests/unit/*.test.mjs` passes)
- All tests red — but red for the right reason (target files don't exist yet), not for syntax errors
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-01-SUMMARY.md` documenting which Wave 0 tests were created and what they assert.
</output>
