---
phase: 6
plan: 05
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/format/phase.mjs
  - tests/unit/fixtures/phase-format/phase-1-spike.md
  - tests/unit/fixtures/phase-format/phase-2-build.md
  - tests/unit/fixtures/phase-format/phase-5-roadmap.md
  - tests/unit/fixtures/phase-format/phase-6-cleanup.md
  - tests/unit/fixtures/phase-format/phase-13-final.md
  - tests/unit/fixtures/phase-format/decimal-72-1.md
  - tests/unit/fixtures/phase-format/multiline-goal.md
  - tests/unit/fixtures/phase-format/empty-success.md
  - tests/unit/fixtures/phase-format/depends-nothing.md
  - tests/unit/fixtures/phase-format/requirements-tbd.md
  - tests/unit/fixtures/phase-format/no-plans-section.md
autonomous: true
requirements:
  - ARCH-03
must_haves:
  truths:
    - "src/format/phase.mjs exports parsePhaseTitle, formatPhaseTitle, parsePhaseDescription, formatPhaseDescription"
    - "parsePhaseTitle handles Phase N: Name (with N as integer) and Phase N.M: Name (decimal phase numbers)"
    - "Round-trip property holds: parsePhaseDescription(formatPhaseDescription(parsePhaseDescription(body))) === parsePhaseDescription(body) for every fixture"
    - "11 fixture files exist under tests/unit/fixtures/phase-format/"
    - "Wave 0 tests/unit/format-phase.test.mjs is green when run: node --test tests/unit/format-phase.test.mjs"
    - "tail field is preserved as opaque string per D-16 (Plans: section + checkboxes round-trip byte-equal)"
  artifacts:
    - path: "src/format/phase.mjs"
      provides: "bidirectional phase title + description parser"
      exports: ["parsePhaseTitle", "formatPhaseTitle", "parsePhaseDescription", "formatPhaseDescription"]
      min_lines: 80
    - path: "tests/unit/fixtures/phase-format/"
      provides: "11 markdown fixtures for round-trip verification"
  key_links:
    - from: "tests/unit/format-phase.test.mjs"
      to: "src/format/phase.mjs"
      via: "await import('../../src/format/phase.mjs')"
      pattern: "src/format/phase\\.mjs"
    - from: "src/format/phase.mjs:parsePhaseDescription"
      to: "src/format/phase.mjs:formatPhaseDescription"
      via: "round-trip idempotency contract per D-15"
      pattern: "parse\\(format\\(parse\\(.+\\)\\)\\)"
---

<objective>
Implement `src/format/phase.mjs` — the ONLY real algorithmic deliverable
in Phase 6. Bidirectional parser/formatter for ROADMAP.md phase titles
and descriptions per D-14, D-15, D-16, D-17.

Round-trip contract (D-15): `parse(format(parse(body))) === parse(body)`
— idempotent canonical form, NOT byte-equality.

Purpose: Phase 8's `addPhase` and `evolveRoadmap` will need to read +
write phase descriptions in ROADMAP.md without corrupting the markdown
view. The four exported functions are the substrate.

Output: src/format/phase.mjs (~80-150 lines) + 11 fixture markdown files
under tests/unit/fixtures/phase-format/. Wave 0 format-phase.test.mjs
turns from red → green.
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

<interfaces>
<!-- Per D-14: 4 exports total. Per D-15: idempotency contract. Per D-16: tail is opaque. -->

API contract (D-14):
  parsePhaseTitle(line: string): { number: string, name: string }
    Throws on lines that don't match the title regex.

  formatPhaseTitle({ number, name }): string
    Returns "Phase ${number}: ${name}" (no trailing newline).

  parsePhaseDescription(body: string): {
    goal: string,                  // may be multiline; trailing newline trimmed
    depends_on: string,            // verbatim string ("Nothing", a comma-list, etc.)
    requirements: string,          // verbatim string ("TBD", "REQ-01, REQ-02", etc.)
    success_criteria: string[],    // numbered items, leading "1. " stripped
    tail: string,                  // everything after Success Criteria block (Plans: + checkboxes), opaque per D-16
  }

  formatPhaseDescription(parsed: object): string
    Reconstructs canonical body from parsed structure. May normalize
    whitespace; MUST preserve every key losslessly so parse(format(x)) === x.

Title regex (per RESEARCH.md §2 line 167):
  /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/

Description label regex (per RESEARCH.md §2 lines 226-230):
  Anchor labels: "Goal", "Depends on", "Requirements", "Success Criteria"
  Tolerate either `**Goal**:` or `**Goal:**` style (codebase uses both).

Round-trip property test pattern (per RESEARCH.md §2 lines 257-263, D-15):
  const parsed1 = parsePhaseDescription(body);
  const formatted = formatPhaseDescription(parsed1);
  const parsed2 = parsePhaseDescription(formatted);
  assert.deepStrictEqual(parsed2, parsed1);

11 fixture files (per D-17 + RESEARCH.md §2 lines 274-289):
  phase-1-spike.md     — real Phase 1 from ROADMAP.md (single-line goal, simple)
  phase-2-build.md     — real Phase 2 (Plans list with [x] checkboxes)
  phase-5-roadmap.md   — real Phase 5 (5-plan checklist)
  phase-6-cleanup.md   — real Phase 6 (THIS phase, long requirements list, 6 SC items)
  phase-13-final.md    — real Phase 13 (multi-line success criteria with parentheses)
  decimal-72-1.md      — synthetic, "Phase 72.1: gap closure"
  multiline-goal.md    — synthetic, Goal spans 3 lines with indented bullets
  empty-success.md     — synthetic, "**Success Criteria**" header + nothing
  depends-nothing.md   — synthetic, "**Depends on**: Nothing"
  requirements-tbd.md  — synthetic, "**Requirements**: TBD"
  no-plans-section.md  — synthetic, body ends after Success Criteria, no Plans tail
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 11 fixture markdown files</name>
  <read_first>
    - .planning/ROADMAP.md (lines containing "### Phase 1:", "### Phase 2:", "### Phase 5:", "### Phase 6:", "### Phase 13:") — these are the source for the 5 real fixtures
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §2 lines 274-289 (11 fixture descriptions)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-17 (fixture set authority)
  </read_first>
  <behavior>
    - Each fixture is a `.md` file containing exactly the body (everything after `### Phase N:` line, up to but not including the next `### ` heading or end-of-file)
    - 5 real fixtures match the live ROADMAP.md content for the corresponding phase
    - 6 synthetic fixtures cover edge cases per D-17
  </behavior>
  <action>
    Create 11 fixture files under `tests/unit/fixtures/phase-format/`. The
    `.gitkeep` placeholder from Plan 01 can stay (harmless) or be removed.

    Step 1 — Real ROADMAP fixtures. For each of phases 1, 2, 5, 6, 13:

    Read `.planning/ROADMAP.md`, find the `### Phase N: Name` line, copy
    the body (everything from the next line up to the next `### ` line
    or `---` separator). Write to `tests/unit/fixtures/phase-format/phase-N-<slug>.md`.

    Specifically:
      phase-1-spike.md   ← body of "### Phase 1: Spike — validate beads + GSD topology"
      phase-2-build.md   ← body of "### Phase 2: Build the layer"
      phase-5-roadmap.md ← body of "### Phase 5: roadmap.* read handlers"
      phase-6-cleanup.md ← body of "### Phase 6: Cleanup + adapter-library scaffolding"
      phase-13-final.md  ← body of "### Phase 13: Workflow init bundlers + conformance test suite + final docs"

    Each file should start with the `**Goal**:` line (NOT include the
    `### Phase N:` title line — `parsePhaseTitle` is tested separately
    on title strings).

    Step 2 — Synthetic edge case fixtures (write each as a short markdown
    body):

    `decimal-72-1.md`:
    ```markdown
    **Goal**: Synthesize a gap closure phase to test decimal phase number parsing.

    **Depends on**: Phase 72

    **Requirements**: TEST-72-1

    **Success Criteria** (what must be TRUE):
      1. Phase 72.1 parses correctly with number "72.1".
    ```

    `multiline-goal.md`:
    ```markdown
    **Goal**: Multi-paragraph goal description that spans several lines:
      - First bullet point
      - Second bullet point
      - Third bullet point with more detail and continuation

    **Depends on**: Nothing

    **Requirements**: TEST-MULTI

    **Success Criteria** (what must be TRUE):
      1. Multi-line goals round-trip without losing bullets.
    ```

    `empty-success.md`:
    ```markdown
    **Goal**: A phase whose Success Criteria header is followed by no items.

    **Depends on**: Nothing

    **Requirements**: TBD

    **Success Criteria** (what must be TRUE):
    ```

    `depends-nothing.md`:
    ```markdown
    **Goal**: Test fixture for "Nothing" depends_on value.

    **Depends on**: Nothing

    **Requirements**: TEST-DEP

    **Success Criteria** (what must be TRUE):
      1. The literal string "Nothing" round-trips verbatim in depends_on.
    ```

    `requirements-tbd.md`:
    ```markdown
    **Goal**: Test fixture for "TBD" requirements value.

    **Depends on**: Phase X

    **Requirements**: TBD

    **Success Criteria** (what must be TRUE):
      1. The literal string "TBD" round-trips verbatim in requirements.
    ```

    `no-plans-section.md`:
    ```markdown
    **Goal**: A phase body with no Plans tail.

    **Depends on**: Nothing

    **Requirements**: TEST-NOTAIL

    **Success Criteria** (what must be TRUE):
      1. Body ending after Success Criteria has empty tail field.
    ```

    Note for `phase-2-build.md`: this fixture INCLUDES the "**Plans:**" tail
    with checkbox list. That tail must round-trip per D-16 (opaque preservation).

    Note for `empty-success.md`: the body ends with the SC header label
    and nothing after it; tail is empty string.

    Verify all 11 files exist:

    ```bash
    ls tests/unit/fixtures/phase-format/*.md | wc -l   # expect 11
    ```
  </action>
  <verify>
    <automated>FIXTURE_COUNT=$(ls tests/unit/fixtures/phase-format/*.md 2>/dev/null | wc -l); test "$FIXTURE_COUNT" -eq 11 || { echo "Got $FIXTURE_COUNT fixtures, expected 11"; exit 1; }; for f in phase-1-spike phase-2-build phase-5-roadmap phase-6-cleanup phase-13-final decimal-72-1 multiline-goal empty-success depends-nothing requirements-tbd no-plans-section; do test -f "tests/unit/fixtures/phase-format/$f.md" || { echo "MISSING $f.md"; exit 1; }; done; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - 11 fixture `.md` files exist with the exact filenames in <files_modified>
    - The 5 real-phase fixtures contain content matching `.planning/ROADMAP.md` for their respective phases (verifiable by grep — e.g., `grep -q 'Spike' tests/unit/fixtures/phase-format/phase-1-spike.md`)
    - `phase-2-build.md` contains `Plans:` and `[x]` (proves the Plans tail is captured)
    - `decimal-72-1.md` contains a Goal section (note: title is tested separately)
    - `empty-success.md` ends with `**Success Criteria** (what must be TRUE):` plus optional whitespace, nothing after
  </acceptance_criteria>
  <done>11 fixtures in place; format-phase.test.mjs fixture-loop has substrate</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement src/format/phase.mjs (4 functions)</name>
  <read_first>
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-CONTEXT.md D-14, D-15, D-16, D-17 (signatures + idempotency contract + tail-as-opaque + fixture set)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §2 (full design — title regex, description grammar, label regex, round-trip pattern)
    - .planning/phases/06-cleanup-adapter-library-scaffolding/06-RESEARCH.md §10 Risk #4 (round-trip too strict vs too loose)
    - tests/unit/format-phase.test.mjs (the test driver — written in Plan 01)
    - 4-5 of the fixture files (e.g., phase-1-spike.md, phase-6-cleanup.md, multiline-goal.md, depends-nothing.md, no-plans-section.md) to inform the parser shape
  </read_first>
  <behavior>
    - Test 1 (parsePhaseTitle simple): parsePhaseTitle('Phase 1: Spike — validate beads + GSD topology') returns { number: '1', name: 'Spike — validate beads + GSD topology' }
    - Test 2 (parsePhaseTitle two-digit): parsePhaseTitle('Phase 13: Workflow init bundlers + conformance test suite + final docs') returns { number: '13', name: 'Workflow init bundlers + conformance test suite + final docs' }
    - Test 3 (parsePhaseTitle decimal): parsePhaseTitle('Phase 72.1: gap closure') returns { number: '72.1', name: 'gap closure' }
    - Test 4 (formatPhaseTitle): formatPhaseTitle({ number: '6', name: 'Cleanup + adapter-library scaffolding' }) returns 'Phase 6: Cleanup + adapter-library scaffolding'
    - Test 5 (parsePhaseTitle invalid): parsePhaseTitle('Not a phase') throws Error
    - Test 6-16 (round-trip per fixture): for each of the 11 fixture files, parsePhaseDescription(formatPhaseDescription(parsePhaseDescription(body))) deepStrictEqual parsePhaseDescription(body)
  </behavior>
  <action>
    Create `src/format/phase.mjs` with the 4 exported functions.

    Step 1 — create `src/format/` directory:

    ```bash
    mkdir -p src/format
    ```

    Step 2 — implement `parsePhaseTitle` and `formatPhaseTitle` (simple,
    regex-driven):

    ```js
    // src/format/phase.mjs
    // Bidirectional parser/formatter for ROADMAP.md phase titles + descriptions.
    // Per D-14 (4 exports), D-15 (idempotency contract), D-16 (tail as opaque),
    // D-17 (fixture set in tests/unit/fixtures/phase-format/).

    const TITLE_RE = /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;

    /**
     * Parses "Phase N: Name" (or "Phase N.M: Name" for decimal phases).
     * @param {string} line
     * @returns {{ number: string, name: string }}
     * @throws {Error} if line doesn't match title pattern
     */
    export function parsePhaseTitle(line) {
      const m = TITLE_RE.exec(line);
      if (!m) {
        throw new Error(`parsePhaseTitle: not a phase title: ${JSON.stringify(line)}`);
      }
      return { number: m[1], name: m[2] };
    }

    /**
     * Formats { number, name } back to "Phase N: Name".
     * @param {{ number: string, name: string }} parsed
     * @returns {string}
     */
    export function formatPhaseTitle({ number, name }) {
      return `Phase ${number}: ${name}`;
    }
    ```

    Step 3 — implement `parsePhaseDescription`. Strategy: label-anchored
    extraction. Walk the body line-by-line, identify each labeled section
    (`**Goal**:` / `**Goal:**`), capture content up to the next label or
    end-of-body. Tail is everything after the Success Criteria block.

    ```js
    // Section labels in canonical order.
    const SECTIONS = ['Goal', 'Depends on', 'Requirements', 'Success Criteria'];
    const LABEL_RE = /^\*\*([A-Za-z][A-Za-z ]*?)(?:\*\*\s*:|\:\s*\*\*)\s*(.*)$/;
    // Matches both `**Goal**: rest` and `**Goal:** rest` styles.

    /**
     * Parses a phase description body into structured form.
     * @param {string} body
     * @returns {{
     *   goal: string,
     *   depends_on: string,
     *   requirements: string,
     *   success_criteria: string[],
     *   tail: string
     * }}
     */
    export function parsePhaseDescription(body) {
      const lines = body.split('\n');
      const sections = { Goal: '', 'Depends on': '', Requirements: '', 'Success Criteria': '' };
      let current = null;
      let tailStart = null;
      let inSC = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = LABEL_RE.exec(line);
        if (m && SECTIONS.includes(m[1])) {
          // New labeled section starts.
          if (m[1] === 'Success Criteria') {
            inSC = true;
            // SC label may have trailing "(what must be TRUE):" - that's part of the line, not content.
            current = 'Success Criteria';
            sections[current] = m[2] ?? '';
            continue;
          }
          current = m[1];
          sections[current] = m[2] ?? '';
          continue;
        }

        // After Success Criteria items, anything that's not a numbered item
        // OR a blank line followed by something not-a-numbered-item starts the tail.
        if (inSC && /^\s*\*\*Plans/.test(line)) {
          tailStart = i;
          break;
        }
        // Generic non-SC continuation: append to current section.
        if (current && current !== 'Success Criteria') {
          // Continuation line (e.g., multi-line goal); append with newline.
          if (sections[current]) {
            sections[current] += '\n' + line;
          } else {
            sections[current] = line;
          }
        } else if (current === 'Success Criteria') {
          // Append to the SC accumulation; we'll re-split into items afterwards.
          sections[current] += '\n' + line;
        }
      }

      // Trim trailing newlines on each section.
      for (const k of Object.keys(sections)) {
        sections[k] = sections[k].replace(/\s+$/, '');
      }

      // Parse the SC accumulation into numbered items.
      const sc_lines = sections['Success Criteria'].split('\n');
      const success_criteria = [];
      let curItem = null;
      for (const sc of sc_lines) {
        const numMatch = /^\s*(\d+)\.\s+(.*)$/.exec(sc);
        if (numMatch) {
          if (curItem !== null) success_criteria.push(curItem.trim());
          curItem = numMatch[2];
        } else if (curItem !== null && sc.trim() !== '') {
          curItem += '\n' + sc;
        }
      }
      if (curItem !== null) success_criteria.push(curItem.trim());

      // Tail capture.
      let tail = '';
      if (tailStart !== null) {
        tail = lines.slice(tailStart).join('\n').replace(/\s+$/, '');
      }

      return {
        goal: sections.Goal,
        depends_on: sections['Depends on'],
        requirements: sections.Requirements,
        success_criteria,
        tail,
      };
    }
    ```

    Step 4 — implement `formatPhaseDescription` (the canonical-form
    formatter). Use the canonical `**Goal**:` style; emit one blank line
    between sections; emit `1. ` numbered SC items.

    ```js
    /**
     * Formats parsed phase description back to canonical markdown.
     * Idempotency contract per D-15: parse(format(parse(x))) === parse(x).
     * @param {object} parsed
     * @returns {string}
     */
    export function formatPhaseDescription({ goal, depends_on, requirements, success_criteria, tail }) {
      const out = [];
      out.push(`**Goal**: ${goal}`);
      out.push('');
      out.push(`**Depends on**: ${depends_on}`);
      out.push('');
      out.push(`**Requirements**: ${requirements}`);
      out.push('');
      out.push(`**Success Criteria** (what must be TRUE):`);
      success_criteria.forEach((item, idx) => {
        // Indent continuation lines two spaces.
        const itemLines = item.split('\n');
        out.push(`  ${idx + 1}. ${itemLines[0]}`);
        for (let j = 1; j < itemLines.length; j++) {
          out.push(`     ${itemLines[j]}`);
        }
      });
      if (tail) {
        out.push('');
        out.push(tail);
      }
      return out.join('\n');
    }
    ```

    Step 5 — run the Wave 0 format-phase.test.mjs and verify every test
    passes:

    ```bash
    node --test tests/unit/format-phase.test.mjs
    ```

    If any fixture fails round-trip:
    1. Read the fixture
    2. Manually parse → format → parse and compare the two parsed structures
    3. Identify the field that mismatches
    4. Adjust either the parser (to capture losslessly) or the formatter (to emit the form the parser will round-trip)
    5. NEVER change the fixture file to make the test pass — fix the implementation
    6. NEVER weaken the contract (don't switch from deepStrictEqual to a partial equality) — fix the implementation

    Per RESEARCH.md §10 Risk #4: the contract is `parse(format(parse(x))) === parse(x)` (idempotency on parsed structure), NOT `format(parse(x)) === x` (byte-equality). Whitespace and label-style normalization are PERMITTED.
  </action>
  <verify>
    <automated>test -f src/format/phase.mjs &amp;&amp; node --check src/format/phase.mjs &amp;&amp; node --test tests/unit/format-phase.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `src/format/phase.mjs` exists and parses
    - File exports exactly 4 functions: `parsePhaseTitle`, `formatPhaseTitle`, `parsePhaseDescription`, `formatPhaseDescription`
    - `node --test tests/unit/format-phase.test.mjs` reports ALL tests pass (3 inline title tests + 1 round-trip title + 11 fixture round-trip = 15 minimum)
    - File contains the exact regex `/^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/` (or equivalent)
    - File line count >= 80 (real implementation, not a stub)
  </acceptance_criteria>
  <done>format/phase.mjs implemented; round-trip green on all 11 fixtures</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| markdown body string → parsed structure | Untrusted markdown input is parsed; risk is regex catastrophic backtracking. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-6.05-01 | Denial of Service | Regex catastrophic backtracking on adversarial title input (e.g., `Phase 1.1.1.1.1: ...`) | mitigate | Title regex `^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$` is anchored at both ends, allows ONE optional decimal segment, uses non-greedy name capture — bounded backtracking O(n). Verified by stress-testing one fixture with adversarial input during execute-phase. |
| T-6.05-02 | Tampering | Round-trip too loose loses tail (Plans: section), Phase 8 evolveRoadmap silently corrupts ROADMAP.md (RESEARCH.md §10 Risk #4) | mitigate | Per D-16: tail is preserved opaquely as a string field; the round-trip property test on `phase-2-build.md` (which has a Plans tail) verifies tail-preservation. If formatPhaseDescription drops or mutates tail, deepStrictEqual fails. |
| T-6.05-03 | Tampering | Round-trip too strict (byte-equality) makes Phase 6 ship failing tests (RESEARCH.md §10 Risk #4) | mitigate | Per D-15: the contract is `parse(format(parse(x))) === parse(x)`, NOT byte-equality. Wave 0 test in format-phase.test.mjs uses `assert.deepStrictEqual(parsed2, parsed1)` exactly per the spec. |
| T-6.05-04 | Information Disclosure | Parser's error message embeds the input line via JSON.stringify, leaking content to logs | accept | The input is markdown content from a planning document, not user-supplied data. JSON.stringify is safe (escapes properly). No PII risk. |

No HIGH threats. security_enforcement gate satisfied at LOW per ASVS L1.
</threat_model>

<verification>
- `npm run test:unit -- tests/unit/format-phase.test.mjs` runs and all tests pass
- The line `assert.deepStrictEqual(parsed2, parsed1)` in format-phase.test.mjs is exercised on every fixture
- `phase-2-build.md` round-trip preserves the `Plans:` checkbox list (visible by inspecting parsed.tail before and after format)
- decimal-72-1.md exercises the `\d+\.\d+` capture group
</verification>

<success_criteria>
- src/format/phase.mjs exists with 4 named exports
- 11 fixture files exist and exercise the round-trip contract
- All format-phase.test.mjs tests green
- No fixture was modified to make tests pass — implementation absorbs all variation
</success_criteria>

<output>
After completion, create `.planning/phases/06-cleanup-adapter-library-scaffolding/06-05-SUMMARY.md` documenting: (1) the API exported (4 functions, signatures); (2) round-trip test results — 15 tests pass; (3) any normalization decisions made by the formatter (e.g., "tail empty → omit trailing blank line").
</output>
