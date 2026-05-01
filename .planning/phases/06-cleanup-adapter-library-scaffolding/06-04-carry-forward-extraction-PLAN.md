---
phase: 6
plan: 04
type: execute
wave: 2
depends_on: [01, 02, 03]
files_modified:
  - bin/bd-helper.mjs
  - bin/beads-errors.mjs
  - src/bd/helper.mjs
  - src/bd/errors.mjs
  - src/bd/findRoot.mjs
  - src/helpers/parsePhaseId.mjs
  - src/helpers/deriveDiskStatus.mjs
  - src/helpers/detectDrift.mjs
  - src/helpers/loadMilestoneHeading.mjs
  - src/helpers/index.mjs
  - tests/shadow-tests/bd-helper.test.mjs
  - tests/shadow-tests/beads-errors.test.mjs
  - tests/shadow-tests/findBeadsRoot.test.mjs
  - tests/shadow-tests/helpers-parsePhaseId.test.mjs
  - tests/shadow-tests/helpers-deriveDiskStatus.test.mjs
  - tests/shadow-tests/helpers-detectDrift.test.mjs
  - tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs
  - tests/shadow-tests/milestone-scoping.test.mjs
  - tests/shadow-tests/seed-determinism.test.sh
  - tests/fixtures/memories-seeded.test.mjs
  - tests/unit/bd-helper.test.mjs
  - tests/unit/beads-errors.test.mjs
  - tests/unit/findBeadsRoot.test.mjs
  - tests/unit/helpers-parsePhaseId.test.mjs
  - tests/unit/helpers-deriveDiskStatus.test.mjs
  - tests/unit/helpers-detectDrift.test.mjs
  - tests/unit/helpers-loadMilestoneHeading.test.mjs
  - tests/unit/milestone-scoping.test.mjs
  - tests/unit/seed-determinism.test.sh
  - tests/unit/memories-seeded.test.mjs
autonomous: true
requirements:
  - ARCH-01
  - ARCH-02
  - TEST-01
must_haves:
  truths:
    - "src/bd/{helper,errors,findRoot}.mjs exist and import-resolve via the package's exports map (Plan 07 wires)"
    - "src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,loadMilestoneHeading}.mjs exist as leaf modules"
    - "src/helpers/index.mjs barrel re-exports the 4 helpers as named exports"
    - "11 carry-forward tests now live in tests/unit/ and import from src/* (NOT bin/*)"
    - "All 11 migrated tests pass when run via node --test (against new src/ paths)"
    - "tests/shadow-tests/ directory is empty (deleted) after migration"
    - "findBeadsRoot() body in src/bd/findRoot.mjs is byte-equal to lines 237-282 of the archived shadow file"
  artifacts:
    - path: "src/bd/helper.mjs"
      provides: "bd() spawnSync wrapper + sentinel error throws"
      exports: ["bd"]
    - path: "src/bd/errors.mjs"
      provides: "BeadsCause enum + BeadsUnavailableError + 4 subtypes"
      exports: ["BeadsCause", "BeadsUnavailableError", "BeadsNotInstalled", "BeadsCorrupt", "BeadsEmpty"]
    - path: "src/bd/findRoot.mjs"
      provides: "findBeadsRoot() — verbatim from archived shadow:237-282"
      exports: ["findBeadsRoot"]
    - path: "src/helpers/index.mjs"
      provides: "barrel for 4 helpers"
      exports: ["parsePhaseId", "deriveDiskStatus", "detectDrift", "loadMilestoneHeading"]
  key_links:
    - from: "src/bd/helper.mjs"
      to: "src/bd/errors.mjs"
      via: "import { BeadsNotInstalled, ... } from './errors.mjs'"
      pattern: "import.*from\\s+'\\./errors\\.mjs'"
    - from: "tests/unit/findBeadsRoot.test.mjs"
      to: "src/bd/findRoot.mjs"
      via: "import { findBeadsRoot } from '../../src/bd/findRoot.mjs'"
      pattern: "import.*from\\s+'\\.\\./\\.\\./src/bd/findRoot\\.mjs'"
    - from: "src/helpers/index.mjs"
      to: "4 leaf helper files"
      via: "named re-exports"
      pattern: "export \\{.*\\} from '\\./parsePhaseId\\.mjs'"
---

<objective>
Move the v0.2 carry-forward primitives into the new `src/` layout AND
migrate the 11 corresponding tests into `tests/unit/`. Three classes of
moves:

1. **Verbatim file moves (2 files):** `bin/bd-helper.mjs` and
   `bin/beads-errors.mjs` → `src/bd/{helper,errors}.mjs` (`git mv`,
   then edit the import path inside helper.mjs).
2. **Sub-file extraction (5 files):** `findBeadsRoot()` and 4 helpers
   from the archived `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`
   become 5 new leaf files under `src/`. Verbatim copy per D-11 + D-22.
3. **Test migrations (11 files):** `git mv` from `tests/shadow-tests/`
   (or `tests/fixtures/` for memories-seeded) to `tests/unit/`, then
   edit each test's `import` path to point at `src/`.

Purpose: Satisfies ARCH-01, ARCH-02, and TEST-01. Once this plan
completes, the Wave 0 `tests/unit/structural-imports.test.mjs` turns
green and all 11 carry-forward tests run against `src/` paths.

Output: 9 new files under `src/` + 11 migrated test files under
`tests/unit/` with corrected imports.
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
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-CONTEXT.md
@.claude/skills/spike-findings-gsd-beads/SKILL.md

<interfaces>
<!-- Source-line table for the 5 extractions from archived shadow file. -->

VERBATIM file moves (no source-line range; whole file):
- bin/bd-helper.mjs       → src/bd/helper.mjs    (64 lines; depends on './beads-errors.mjs' — adjust import to './errors.mjs' post-move)
- bin/beads-errors.mjs    → src/bd/errors.mjs    (55 lines; zero imports — clean move)

EXTRACTION from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs (per D-11, D-22):
- findBeadsRoot:         lines 237-282 (46 lines incl comments)  → src/bd/findRoot.mjs
- parsePhaseId:          lines 293-296 (4 lines)                  → src/helpers/parsePhaseId.mjs
- deriveDiskStatus:      lines 305-313 (9 lines)                  → src/helpers/deriveDiskStatus.mjs
- detectDrift:           lines 331-346 (16 lines)                 → src/helpers/detectDrift.mjs
- loadMilestoneHeading:  lines 356-364 (9 lines)                  → src/helpers/loadMilestoneHeading.mjs

CRITICAL: Per D-11 and RESEARCH.md §10 Risk #2, copy verbatim. Do NOT
"tidy up" while moving. The migrated tests validate exact behavior.

For findRoot.mjs imports (per RESEARCH.md §5 lines 674-675):
  import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
  import { resolve, join, dirname } from 'node:path';
(The shadow's import block also has `readdirSync` — drop it; findBeadsRoot doesn't use it.)

For helper imports:
  parsePhaseId        — no imports needed (pure string ops)
  deriveDiskStatus    — no imports needed (pure logic)
  detectDrift         — uses console.error (built-in; no import)
  loadMilestoneHeading— uses console.error (built-in; no import)

Test migration list (11 files):
  tests/shadow-tests/bd-helper.test.mjs              → tests/unit/bd-helper.test.mjs
  tests/shadow-tests/beads-errors.test.mjs           → tests/unit/beads-errors.test.mjs
  tests/shadow-tests/findBeadsRoot.test.mjs          → tests/unit/findBeadsRoot.test.mjs
  tests/shadow-tests/helpers-parsePhaseId.test.mjs   → tests/unit/helpers-parsePhaseId.test.mjs
  tests/shadow-tests/helpers-deriveDiskStatus.test.mjs → tests/unit/helpers-deriveDiskStatus.test.mjs
  tests/shadow-tests/helpers-detectDrift.test.mjs    → tests/unit/helpers-detectDrift.test.mjs
  tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs → tests/unit/helpers-loadMilestoneHeading.test.mjs
  tests/shadow-tests/milestone-scoping.test.mjs       → tests/unit/milestone-scoping.test.mjs
  tests/shadow-tests/seed-determinism.test.sh         → tests/unit/seed-determinism.test.sh
  tests/fixtures/memories-seeded.test.mjs            → tests/unit/memories-seeded.test.mjs

Per-test import edit table:
  bd-helper.test.mjs         : '../../bin/bd-helper.mjs'         → '../../src/bd/helper.mjs'
  beads-errors.test.mjs      : '../../bin/beads-errors.mjs'      → '../../src/bd/errors.mjs'
  findBeadsRoot.test.mjs     : '../../bin/gsd-sdk-shadow.mjs'    → '../../src/bd/findRoot.mjs'
  helpers-parsePhaseId.test.mjs   : '../../bin/gsd-sdk-shadow.mjs' → '../../src/helpers/parsePhaseId.mjs'
  helpers-deriveDiskStatus.test.mjs: idem                          → '../../src/helpers/deriveDiskStatus.mjs'
  helpers-detectDrift.test.mjs    : idem                          → '../../src/helpers/detectDrift.mjs'
  helpers-loadMilestoneHeading.test.mjs: idem                     → '../../src/helpers/loadMilestoneHeading.mjs'
  milestone-scoping.test.mjs : may import shadow (verify and update)
  seed-determinism.test.sh   : may reference paths to fixtures (verify path-relative)
  memories-seeded.test.mjs   : moves UP one dir level — its imports of `seed-fixture.sh` etc need a relative-path adjustment
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move bd-helper.mjs + beads-errors.mjs verbatim to src/bd/</name>
  <read_first>
    - bin/bd-helper.mjs (full file — 64 lines)
    - bin/beads-errors.mjs (full file — 55 lines)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §1 lines 79-80 (VERBATIM moves)
  </read_first>
  <files>
    - bin/bd-helper.mjs
    - bin/beads-errors.mjs
    - src/bd/helper.mjs
    - src/bd/errors.mjs
  </files>
  <action>
    Step 1 — create the `src/bd/` directory:

    ```bash
    mkdir -p src/bd
    ```

    Step 2 — `git mv` the two files:

    ```bash
    git mv bin/bd-helper.mjs src/bd/helper.mjs
    git mv bin/beads-errors.mjs src/bd/errors.mjs
    ```

    Step 3 — edit the import inside `src/bd/helper.mjs`. The file currently
    imports from `./beads-errors.mjs`. After the move, both files live in
    `src/bd/`, so the import becomes `./errors.mjs`. Use the Edit tool to
    change EXACTLY the import line. Do NOT alter any other line.

    The line to change (in src/bd/helper.mjs) is the import statement that
    references `./beads-errors.mjs`. Change it to `./errors.mjs`. Search
    pattern (Edit tool):
      old: `from './beads-errors.mjs'`
      new: `from './errors.mjs'`

    Step 4 — at this point `bin/` should contain only `gsd-sdk-shadow.mjs`
    and `wrap-mutation.mjs` — but Plan 02 already archived those in Wave 1.
    So `bin/` should be empty. Remove the empty directory:

    ```bash
    rmdir bin/ 2>/dev/null || true
    ```

    DO NOT modify the body of either file (besides the single import line in
    helper.mjs). The migrated tests in Task 5 validate behavior bit-by-bit.
  </action>
  <verify>
    <automated>test -f src/bd/helper.mjs &amp;&amp; test -f src/bd/errors.mjs &amp;&amp; ! test -f bin/bd-helper.mjs &amp;&amp; ! test -f bin/beads-errors.mjs &amp;&amp; grep -q "from './errors.mjs'" src/bd/helper.mjs &amp;&amp; ! grep -q "beads-errors.mjs" src/bd/helper.mjs &amp;&amp; git log --follow --oneline src/bd/helper.mjs | head -1</automated>
  </verify>
  <acceptance_criteria>
    - `src/bd/helper.mjs` exists; line count within 1 line of original (only the import path changed)
    - `src/bd/errors.mjs` exists; byte-identical to the old `bin/beads-errors.mjs`
    - `bin/bd-helper.mjs` and `bin/beads-errors.mjs` do NOT exist
    - `src/bd/helper.mjs` contains `from './errors.mjs'` (NOT `from './beads-errors.mjs'`)
    - `git log --follow src/bd/helper.mjs` returns ≥1 commit (history preserved via git mv)
    - `node --check src/bd/helper.mjs && node --check src/bd/errors.mjs` succeeds
  </acceptance_criteria>
  <done>bd-helper + beads-errors moved verbatim with single import-line fix</done>
</task>

<task type="auto">
  <name>Task 2: Extract findBeadsRoot() to src/bd/findRoot.mjs (verbatim per D-11)</name>
  <read_first>
    - archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs lines 237-282 (the function body to extract)
    - archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs lines 1-30 (the imports block — for the fs/path imports findBeadsRoot uses)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-11, D-22
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §5 lines 628-722
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #2 (verbatim copy mandate)
  </read_first>
  <files>
    - src/bd/findRoot.mjs
  </files>
  <action>
    Read `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` lines 237-282 (Read
    tool with offset=237, limit=46). This is the `export function findBeadsRoot(start) { ... }`
    body. Copy it VERBATIM into `src/bd/findRoot.mjs`. Per D-11 and Risk
    #2: do NOT modify the function body. No "tidying" allowed.

    Create the file with this structure (header comment + imports + verbatim body):

    ```js
    // src/bd/findRoot.mjs
    // findBeadsRoot — read-side project-root discovery.
    //
    // Extracted VERBATIM from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:237-282
    // per Phase 6 D-11. Phase 4 D-01..D-04 + REQ-QUAL-03 semantics:
    //   - BEADS_DIR env wins (D-01)
    //   - Parent-walk bounded at git root (D-02)
    //   - realpathSync follows symlinks (D-03)
    //   - .git-as-FILE worktree resolution: read gitdir, walk to source repo
    //
    // History: see `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`
    // for the original ship history (Phase 4 deliverable).

    import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
    import { resolve, join, dirname } from 'node:path';

    // ===== VERBATIM EXTRACTION FROM SHADOW LINES 237-282 =====
    // Do not modify this function body. The migrated test
    // tests/unit/findBeadsRoot.test.mjs validates 4 cases (worktree,
    // BEADS_DIR, symlink, non-bd) — any re-implementation breaks one.

    export function findBeadsRoot(start) {
      // ... paste the exact body from shadow:237-282 here ...
    }
    ```

    Specifically: in the archive file, find the line `export function findBeadsRoot(start) {`,
    then copy every line up through and including the matching `}` (the function's
    closing brace). Paste into the new file under the header comment block.

    Verify the extraction is verbatim:

    ```bash
    # Extract just the function body from each file and diff
    sed -n '/^export function findBeadsRoot/,/^}$/p' archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs > /tmp/orig.mjs
    sed -n '/^export function findBeadsRoot/,/^}$/p' src/bd/findRoot.mjs > /tmp/new.mjs
    diff /tmp/orig.mjs /tmp/new.mjs
    # Expected: no output (zero diff)
    ```

    If the diff is non-empty, fix the extraction. The header comment is
    NOT included in the diff (it's above the `export function` line).
  </action>
  <verify>
    <automated>test -f src/bd/findRoot.mjs &amp;&amp; node --check src/bd/findRoot.mjs &amp;&amp; sed -n '/^export function findBeadsRoot/,/^}$/p' archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs > /tmp/orig.mjs &amp;&amp; sed -n '/^export function findBeadsRoot/,/^}$/p' src/bd/findRoot.mjs > /tmp/new.mjs &amp;&amp; diff /tmp/orig.mjs /tmp/new.mjs &amp;&amp; rm -f /tmp/orig.mjs /tmp/new.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `src/bd/findRoot.mjs` exists and parses (`node --check` succeeds)
    - File contains the import line `import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';`
    - File contains the import line `import { resolve, join, dirname } from 'node:path';`
    - The `findBeadsRoot` function body is byte-identical to the archive (verified by sed/diff)
    - Header comment cites `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:237-282`
    - File does NOT import `readdirSync` (unused per RESEARCH.md §5 line 685)
  </acceptance_criteria>
  <done>findBeadsRoot extracted verbatim; tests/unit/findBeadsRoot.test.mjs (Task 6) will validate</done>
</task>

<task type="auto">
  <name>Task 3: Extract 4 helpers to src/helpers/ leaf files</name>
  <read_first>
    - archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs lines 290-365 (4 helper function definitions)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §6 lines 728-770
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-08 (./helpers exports)
  </read_first>
  <files>
    - src/helpers/parsePhaseId.mjs
    - src/helpers/deriveDiskStatus.mjs
    - src/helpers/detectDrift.mjs
    - src/helpers/loadMilestoneHeading.mjs
  </files>
  <action>
    Step 1 — create the `src/helpers/` directory:

    ```bash
    mkdir -p src/helpers
    ```

    Step 2 — extract each helper VERBATIM from
    `archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`. Per RESEARCH.md §6 line ranges:

    - parsePhaseId         (lines 293-296)
    - deriveDiskStatus     (lines 305-313)
    - detectDrift          (lines 331-346)
    - loadMilestoneHeading (lines 356-364)

    Read each function via the Read tool with `offset` and `limit`. For
    each, create a leaf module with this template (substituting <NAME>
    and <BODY>):

    ```js
    // src/helpers/<NAME>.mjs
    /**
     * Carry-forward from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:<lineRange>.
     * Phase 5 deliverable; unchanged in Phase 6 (D-11 verbatim extraction).
     *
     * See `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` for
     * the original ship history.
     */

    <BODY>  // verbatim function definition starting with `export function <NAME>(...)`
    ```

    Specifically:

    For `src/helpers/parsePhaseId.mjs` (4 lines body, 293-296):
    ```js
    /**
     * D-02: Strip "phase-id:" prefix and zero-padding; preserve decimal segments.
     * Carry-forward from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:293-296.
     */
    export function parsePhaseId(label) {
      // ... verbatim from lines 294-295 ...
    }
    ```

    For `src/helpers/deriveDiskStatus.mjs` (lines 305-313): include the JSDoc
    header citing the archive source, then the verbatim function.

    For `src/helpers/detectDrift.mjs` (lines 331-346): same pattern. This
    function uses `console.error` (no import needed; built-in).

    For `src/helpers/loadMilestoneHeading.mjs` (lines 356-364): same pattern.

    Verify each extraction with sed/diff (same technique as Task 2):

    ```bash
    for h in parsePhaseId deriveDiskStatus detectDrift loadMilestoneHeading; do
      sed -n "/^export function $h/,/^}$/p" archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs > /tmp/orig-$h.mjs
      sed -n "/^export function $h/,/^}$/p" "src/helpers/$h.mjs" > /tmp/new-$h.mjs
      if ! diff /tmp/orig-$h.mjs /tmp/new-$h.mjs > /dev/null; then
        echo "DIFF MISMATCH for $h"; exit 1
      fi
    done
    rm -f /tmp/orig-*.mjs /tmp/new-*.mjs
    echo "All 4 helpers extracted verbatim"
    ```
  </action>
  <verify>
    <automated>for h in parsePhaseId deriveDiskStatus detectDrift loadMilestoneHeading; do test -f "src/helpers/$h.mjs" || { echo "MISSING $h"; exit 1; }; node --check "src/helpers/$h.mjs" || { echo "PARSE ERROR $h"; exit 1; }; sed -n "/^export function $h/,/^}$/p" archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs > /tmp/orig-$h.mjs; sed -n "/^export function $h/,/^}$/p" "src/helpers/$h.mjs" > /tmp/new-$h.mjs; diff /tmp/orig-$h.mjs /tmp/new-$h.mjs || { echo "DIFF $h"; exit 1; }; rm -f /tmp/orig-$h.mjs /tmp/new-$h.mjs; done; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - All 4 leaf files exist under `src/helpers/`
    - Each file parses (`node --check` succeeds)
    - Each function body is byte-identical to the archive source (sed/diff zero output)
    - Each file's header comment cites the archive source path + line range
  </acceptance_criteria>
  <done>4 helpers extracted verbatim into leaf modules</done>
</task>

<task type="auto">
  <name>Task 4: Create src/helpers/index.mjs barrel</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-08 ('./helpers' is a single submodule export)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md "Claude's Discretion" — barrel shape choice
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §6 lines 754-769 (recommended barrel)
  </read_first>
  <files>
    - src/helpers/index.mjs
  </files>
  <action>
    Create `src/helpers/index.mjs` with named-export re-exports per
    RESEARCH.md §6 recommendation (named exports preserve tree-shaking and
    keep imports explicit; default-object export rejected per Claude's
    Discretion + the recommendation):

    ```js
    // src/helpers/index.mjs
    // Barrel for src/helpers/. Per D-08; consumers import:
    //   import { parsePhaseId, deriveDiskStatus, ... } from 'gsd-beads/helpers';
    //
    // Named-export style (not a default object) — keeps imports explicit and
    // enables tree-shaking by tooling that supports it.

    export { parsePhaseId }         from './parsePhaseId.mjs';
    export { deriveDiskStatus }     from './deriveDiskStatus.mjs';
    export { detectDrift }          from './detectDrift.mjs';
    export { loadMilestoneHeading } from './loadMilestoneHeading.mjs';
    ```

    No other content — just the 4 re-export lines + header comment.
  </action>
  <verify>
    <automated>test -f src/helpers/index.mjs &amp;&amp; node --check src/helpers/index.mjs &amp;&amp; grep -c "^export {" src/helpers/index.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `src/helpers/index.mjs` exists and parses
    - Contains exactly 4 `export {` re-exports (one per helper)
    - Each re-export uses `from './<name>.mjs'` (relative path with `.mjs` extension)
    - `node -e "import('./src/helpers/index.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"` prints `deriveDiskStatus,detectDrift,loadMilestoneHeading,parsePhaseId`
  </acceptance_criteria>
  <done>Barrel index.mjs aggregates all 4 helpers</done>
</task>

<task type="auto">
  <name>Task 5: Migrate bd-helper, beads-errors, findBeadsRoot tests</name>
  <read_first>
    - tests/shadow-tests/bd-helper.test.mjs (full file)
    - tests/shadow-tests/beads-errors.test.mjs (full file)
    - tests/shadow-tests/findBeadsRoot.test.mjs (full file)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §6 lines 773-783 (per-test import edits)
  </read_first>
  <files>
    - tests/shadow-tests/bd-helper.test.mjs
    - tests/shadow-tests/beads-errors.test.mjs
    - tests/shadow-tests/findBeadsRoot.test.mjs
    - tests/unit/bd-helper.test.mjs
    - tests/unit/beads-errors.test.mjs
    - tests/unit/findBeadsRoot.test.mjs
  </files>
  <action>
    `git mv` each test, then edit imports.

    Step 1 — move:
    ```bash
    git mv tests/shadow-tests/bd-helper.test.mjs   tests/unit/bd-helper.test.mjs
    git mv tests/shadow-tests/beads-errors.test.mjs tests/unit/beads-errors.test.mjs
    git mv tests/shadow-tests/findBeadsRoot.test.mjs tests/unit/findBeadsRoot.test.mjs
    ```

    Step 2 — fix imports in each migrated file. Use the Edit tool with
    these EXACT replacements:

    `tests/unit/bd-helper.test.mjs`:
      old: `'../../bin/bd-helper.mjs'`
      new: `'../../src/bd/helper.mjs'`

    `tests/unit/beads-errors.test.mjs`:
      old: `'../../bin/beads-errors.mjs'`
      new: `'../../src/bd/errors.mjs'`

    `tests/unit/findBeadsRoot.test.mjs`:
      old: `'../../bin/gsd-sdk-shadow.mjs'`
      new: `'../../src/bd/findRoot.mjs'`

    Note: the path depth is the SAME (`../../` from tests/unit/ ↔ ../../ from
    tests/shadow-tests/) — both directories are one level deep under tests/.
    No relative-depth adjustment needed.

    Step 3 — run the 3 migrated tests to confirm they pass:

    ```bash
    node --test tests/unit/bd-helper.test.mjs tests/unit/beads-errors.test.mjs tests/unit/findBeadsRoot.test.mjs
    ```

    Expected: all tests pass. If `findBeadsRoot.test.mjs` fails, the
    extraction in Task 2 was not verbatim — fix that, not the test.
  </action>
  <verify>
    <automated>test -f tests/unit/bd-helper.test.mjs &amp;&amp; test -f tests/unit/beads-errors.test.mjs &amp;&amp; test -f tests/unit/findBeadsRoot.test.mjs &amp;&amp; ! test -f tests/shadow-tests/bd-helper.test.mjs &amp;&amp; grep -q "../../src/bd/helper.mjs" tests/unit/bd-helper.test.mjs &amp;&amp; grep -q "../../src/bd/errors.mjs" tests/unit/beads-errors.test.mjs &amp;&amp; grep -q "../../src/bd/findRoot.mjs" tests/unit/findBeadsRoot.test.mjs &amp;&amp; node --test tests/unit/bd-helper.test.mjs tests/unit/beads-errors.test.mjs tests/unit/findBeadsRoot.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - All 3 migrated test files exist in `tests/unit/`
    - All 3 originals in `tests/shadow-tests/` are gone
    - Each migrated test imports from `src/bd/` (not `bin/`)
    - All 3 tests PASS when run via `node --test`
    - `git log --follow tests/unit/bd-helper.test.mjs` shows the original commits
  </acceptance_criteria>
  <done>3 bd-related tests migrated and green</done>
</task>

<task type="auto">
  <name>Task 6: Migrate 4 helper tests + milestone-scoping</name>
  <read_first>
    - tests/shadow-tests/helpers-parsePhaseId.test.mjs (full file)
    - tests/shadow-tests/helpers-deriveDiskStatus.test.mjs
    - tests/shadow-tests/helpers-detectDrift.test.mjs
    - tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs
    - tests/shadow-tests/milestone-scoping.test.mjs
  </read_first>
  <files>
    - tests/shadow-tests/helpers-parsePhaseId.test.mjs
    - tests/shadow-tests/helpers-deriveDiskStatus.test.mjs
    - tests/shadow-tests/helpers-detectDrift.test.mjs
    - tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs
    - tests/shadow-tests/milestone-scoping.test.mjs
    - tests/unit/helpers-parsePhaseId.test.mjs
    - tests/unit/helpers-deriveDiskStatus.test.mjs
    - tests/unit/helpers-detectDrift.test.mjs
    - tests/unit/helpers-loadMilestoneHeading.test.mjs
    - tests/unit/milestone-scoping.test.mjs
  </files>
  <action>
    Step 1 — `git mv` each test:

    ```bash
    git mv tests/shadow-tests/helpers-parsePhaseId.test.mjs       tests/unit/helpers-parsePhaseId.test.mjs
    git mv tests/shadow-tests/helpers-deriveDiskStatus.test.mjs   tests/unit/helpers-deriveDiskStatus.test.mjs
    git mv tests/shadow-tests/helpers-detectDrift.test.mjs        tests/unit/helpers-detectDrift.test.mjs
    git mv tests/shadow-tests/helpers-loadMilestoneHeading.test.mjs tests/unit/helpers-loadMilestoneHeading.test.mjs
    git mv tests/shadow-tests/milestone-scoping.test.mjs           tests/unit/milestone-scoping.test.mjs
    ```

    Step 2 — fix imports per the table:

    For each `tests/unit/helpers-<NAME>.test.mjs`:
      old: `from '../../bin/gsd-sdk-shadow.mjs'`
      new: `from '../../src/helpers/<NAME>.mjs'`

    Specifically (use the Edit tool with these EXACT mappings):
      tests/unit/helpers-parsePhaseId.test.mjs       : `../../bin/gsd-sdk-shadow.mjs` → `../../src/helpers/parsePhaseId.mjs`
      tests/unit/helpers-deriveDiskStatus.test.mjs   : same → `../../src/helpers/deriveDiskStatus.mjs`
      tests/unit/helpers-detectDrift.test.mjs        : same → `../../src/helpers/detectDrift.mjs`
      tests/unit/helpers-loadMilestoneHeading.test.mjs: same → `../../src/helpers/loadMilestoneHeading.mjs`

    For `tests/unit/milestone-scoping.test.mjs`: read the file first and
    inspect its imports. If it imports `loadMilestoneHeading` from the
    shadow, update to `../../src/helpers/loadMilestoneHeading.mjs`. If it
    imports any other shadow internals, those are tests for archived code
    — flag and consult; the most likely answer is the import becomes
    `../../src/helpers/loadMilestoneHeading.mjs`.

    Step 3 — run the 5 migrated tests:

    ```bash
    node --test tests/unit/helpers-*.test.mjs tests/unit/milestone-scoping.test.mjs
    ```

    All 5 must pass. If any fail, the extraction in Task 3 was not verbatim.
  </action>
  <verify>
    <automated>for h in parsePhaseId deriveDiskStatus detectDrift loadMilestoneHeading; do test -f "tests/unit/helpers-$h.test.mjs" || { echo "MISSING $h"; exit 1; }; grep -q "src/helpers/$h.mjs" "tests/unit/helpers-$h.test.mjs" || { echo "WRONG IMPORT $h"; exit 1; }; done; test -f tests/unit/milestone-scoping.test.mjs &amp;&amp; node --test tests/unit/helpers-parsePhaseId.test.mjs tests/unit/helpers-deriveDiskStatus.test.mjs tests/unit/helpers-detectDrift.test.mjs tests/unit/helpers-loadMilestoneHeading.test.mjs tests/unit/milestone-scoping.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - 5 migrated test files exist in `tests/unit/`
    - 5 originals in `tests/shadow-tests/` are gone
    - Each helper test imports from its specific `src/helpers/<name>.mjs` leaf module
    - All 5 tests PASS via `node --test`
    - `milestone-scoping.test.mjs` imports adjusted (or unchanged if it doesn't import shadow internals)
  </acceptance_criteria>
  <done>4 helper tests + milestone-scoping migrated and green</done>
</task>

<task type="auto">
  <name>Task 7: Migrate seed-determinism + memories-seeded; clean up empty dirs</name>
  <read_first>
    - tests/shadow-tests/seed-determinism.test.sh (full file — bash test)
    - tests/fixtures/memories-seeded.test.mjs (full file — note this is in fixtures/, not shadow-tests/)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #10 (memories-seeded import drift)
  </read_first>
  <files>
    - tests/shadow-tests/seed-determinism.test.sh
    - tests/fixtures/memories-seeded.test.mjs
    - tests/unit/seed-determinism.test.sh
    - tests/unit/memories-seeded.test.mjs
  </files>
  <action>
    Step 1 — `git mv` both files:

    ```bash
    git mv tests/shadow-tests/seed-determinism.test.sh tests/unit/seed-determinism.test.sh
    git mv tests/fixtures/memories-seeded.test.mjs    tests/unit/memories-seeded.test.mjs
    ```

    Step 2 — verify seed-determinism.test.sh works from new location.
    The bash script likely uses `dirname $0` or relative path conventions.
    Read its content; if it has any path that says `../shadow-tests/...`,
    update to `../unit/...` or just remove the indirection. If it says
    `../fixtures/`, that depth is the SAME from `tests/unit/` as from
    `tests/shadow-tests/` (both are one level under tests/), so no edit.

    Run the bash test:

    ```bash
    bash tests/unit/seed-determinism.test.sh
    ```

    Must pass — it's a CONF-03 invariant.

    Step 3 — fix `tests/unit/memories-seeded.test.mjs` imports. This file
    moved UP one level (from `tests/fixtures/` to `tests/unit/`), so any
    relative imports of `seed-fixture.sh`, `build-seed.sh`, etc. need
    re-rooting. Per RESEARCH.md §10 Risk #10:

    Read the file FIRST. Then update each relative path:
      - `'./seed-fixture.sh'`        → `'../fixtures/seed-fixture.sh'`
      - `'./build-seed.sh'`           → `'../fixtures/build-seed.sh'`
      - `'./seed.jsonl'`              → `'../fixtures/seed.jsonl'`
      - `'./bd-helpers/'`             → `'../fixtures/bd-helpers/'`

    If the test uses `import.meta.dirname` to construct paths, those
    references also need updating to point back to `tests/fixtures/`.

    Run the test to verify:

    ```bash
    node --test tests/unit/memories-seeded.test.mjs
    ```

    Step 4 — clean up empty directories:

    ```bash
    rmdir tests/shadow-tests/ 2>/dev/null && echo "tests/shadow-tests/ removed"
    rmdir tests/scripts/ 2>/dev/null || true
    # tests/fixtures/ stays — it has seed.jsonl, build-seed.sh, etc.
    ```

    `tests/shadow-tests/` should be empty after all migrations (Plan 03
    archived 26 files, Plan 04 migrated 11 files including seed-determinism;
    that totals 37 — matches RESEARCH.md §7 count).

    If `rmdir tests/shadow-tests/` fails because the dir is non-empty, list
    its contents and flag — there's a missed file from one of the prior
    tasks that needs investigation.
  </action>
  <verify>
    <automated>test -f tests/unit/seed-determinism.test.sh &amp;&amp; test -f tests/unit/memories-seeded.test.mjs &amp;&amp; ! test -f tests/shadow-tests/seed-determinism.test.sh &amp;&amp; ! test -f tests/fixtures/memories-seeded.test.mjs &amp;&amp; ! test -d tests/shadow-tests &amp;&amp; bash tests/unit/seed-determinism.test.sh &amp;&amp; node --test tests/unit/memories-seeded.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/seed-determinism.test.sh` exists and `bash tests/unit/seed-determinism.test.sh` passes
    - `tests/unit/memories-seeded.test.mjs` exists and `node --test` passes
    - `tests/shadow-tests/` directory does NOT exist (fully empty after migration)
    - `tests/fixtures/` still contains `seed.jsonl`, `build-seed.sh`, `seed-fixture.sh`, `bd-helpers/` (fixtures untouched)
    - Wave 0 `tests/unit/structural-imports.test.mjs` runs green when invoked: `node --test tests/unit/structural-imports.test.mjs`
  </acceptance_criteria>
  <done>seed-determinism + memories-seeded migrated; tests/shadow-tests/ removed; tests/unit/ now houses the full carry-forward suite</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| archived shadow source → src/ extracted code | Sub-file extraction is unavoidable; risk is "tidied" or "minor cleanup" rewrites breaking semantics. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.04-01 | Tampering | findBeadsRoot() rewrite during extraction loses worktree-symlink behavior (RESEARCH.md §10 Risk #2) | mitigate | Task 2 specifies VERBATIM copy with sed/diff verification; the migrated `tests/unit/findBeadsRoot.test.mjs` validates 4 cases (worktree, BEADS_DIR, symlink, non-bd) — any regression breaks the test. |
| T-6.04-02 | Tampering | helper extraction silently drops behavior (e.g., omits a console.error call) | mitigate | Task 3 sed/diff each helper body against the archive source; the 4 migrated helper tests validate behavior exactly. |
| T-6.04-03 | Information Disclosure | bd-helper.mjs throws BeadsCorrupt with stderr from bd CLI; could leak path info | accept | Existing v0.2 behavior; not a new exposure. The error class hierarchy (Phase 4 D-23 / src/bd/errors.mjs) is preserved verbatim. |
| T-6.04-04 | Tampering | memories-seeded.test.mjs path rewrite errors break CONF-03 byte-identity invariant verification | mitigate | Task 7 reads the file first, identifies all relative paths, and rewrites only the relative-path tokens. The seed-determinism.test.sh + the test itself both run as part of acceptance — failures surface immediately. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- After this plan completes, `npm run test:unit` would run all 11 carry-forward tests + the 6 Wave 0 scaffolding tests (structural-imports turns green; the 5 others remain partially red until Plans 05/06/07 land their respective sources).
- `node --test tests/unit/findBeadsRoot.test.mjs` passes all 4 cases (worktree, BEADS_DIR, symlink, non-bd).
- `node --test tests/unit/structural-imports.test.mjs` passes all 8 import-resolves checks.
- `git log --follow tests/unit/findBeadsRoot.test.mjs` returns the original Phase 4 commits.
- No file under `bin/` exists (Plan 02 archived shadow + wrap-mutation; this plan moved bd-helper + beads-errors).
</verification>

<success_criteria>
- 9 source files exist under `src/bd/` (3) + `src/helpers/` (5 leaves + 1 barrel = 6)
- 11 carry-forward tests live in `tests/unit/` and pass
- All extractions verified verbatim against archive source via sed/diff
- `tests/shadow-tests/` directory is gone (empty after all migrations)
- Wave 0 `tests/unit/structural-imports.test.mjs` is green
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-04-SUMMARY.md` documenting: (1) the verbatim-copy verification for each of the 5 sub-file extractions; (2) the 11 test migrations with old → new import lines; (3) the test result counts before/after.
</output>
