---
phase: 02-build-the-layer
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/cascade-loop.sh
  - scripts/regen-roadmap.sh
  - scripts/regen-requirements.sh
  - tests/hook-tests/cascade-loop.test.sh
  - tests/hook-tests/regen-roadmap.test.sh
  - tests/hook-tests/regen-requirements.test.sh
  - tests/fixtures/bd-helpers/3-level-hierarchy.sh
autonomous: true
requirements: [REQ-01]
requirements_addressed: [REQ-01]
must_haves:
  truths:
    - "Running cascade-loop.sh on a hierarchy with all leaves closed cascades up and closes parent epics (per D-01 02-01 scope, Spike 002)"
    - "Running regen-roadmap.sh produces .planning/ROADMAP.md whose ## Progress table parses identically across consecutive runs on identical bd state (REQ-01 SoT, Spike 007 contract)"
    - "Running regen-requirements.sh produces .planning/REQUIREMENTS.md grouped by version + category labels with traceability table (REQ-01, Spike 007)"
    - "All three scripts use bash + jq + bd CLI only (no Node, no Python — per CONVENTIONS Standard Stack)"
    - "cascade-loop.sh has a max-iteration safety cap of 20 (per PATTERNS.md Phase 2 delta)"
  artifacts:
    - path: "scripts/cascade-loop.sh"
      provides: "5-line bd epic close-eligible loop, idempotent, safety-capped"
      min_lines: 25
    - path: "scripts/regen-roadmap.sh"
      provides: "ROADMAP.md regeneration from bd-list+bd-children JSON output"
      min_lines: 60
    - path: "scripts/regen-requirements.sh"
      provides: "REQUIREMENTS.md regeneration from gsd:requirement bead set"
      min_lines: 50
    - path: "tests/hook-tests/cascade-loop.test.sh"
      provides: "Cascade idempotency + max-iter cap test cases"
      min_lines: 40
    - path: "tests/hook-tests/regen-roadmap.test.sh"
      provides: "Determinism test (same bd state → byte-identical ROADMAP.md)"
      min_lines: 40
    - path: "tests/hook-tests/regen-requirements.test.sh"
      provides: "Determinism test for REQUIREMENTS.md regen"
      min_lines: 40
  key_links:
    - from: "scripts/regen-roadmap.sh"
      to: "bd list --type=epic -l gsd:phase --status=all -n 0 --json"
      via: "execvp via $(...) substitution"
      pattern: "bd list.*-l gsd:phase.*--json"
    - from: "scripts/regen-roadmap.sh"
      to: "bd children <phase-id> --json"
      via: "per-phase iteration"
      pattern: "bd children.*--json"
    - from: "scripts/regen-requirements.sh"
      to: "bd list --type=epic -l gsd:requirement --status=all -n 0 --json"
      via: "main query"
      pattern: "bd list.*-l gsd:requirement.*--json"
    - from: "scripts/cascade-loop.sh"
      to: "bd epic close-eligible"
      via: "while-loop body"
      pattern: "bd epic close-eligible"
---

<objective>
Build the three bd-CLI-only primitives that everything else (Plans 02-02 through 02-06) depends on:
1. **cascade-loop.sh** — copy Spike 002's verbatim 5-line loop and add safety cap + --quiet flag
2. **regen-roadmap.sh** — NEW; implement Spike 007's documented format contract
3. **regen-requirements.sh** — NEW; implement Spike 007's REQUIREMENTS.md format contract

These scripts are pure transforms over `bd list --json` + `bd children --json`. They are invoked by `bd-sync.sh` (Plan 02-02) after every state-changing `bd ` Bash call. Determinism is critical — byte-stable output for unchanged bd state.

Purpose: Make beads the source of truth visible as regenerated markdown views (REQ-01).
Output: 3 production scripts + 3 test suites + 1 test fixture builder.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/02-build-the-layer/02-CONTEXT.md
@.planning/phases/02-build-the-layer/02-RESEARCH.md
@.planning/phases/02-build-the-layer/02-PATTERNS.md
@.planning/phases/02-build-the-layer/02-VALIDATION.md
@.planning/spikes/CONVENTIONS.md
@.planning/spikes/007-reader-skill-format-contract/README.md
@.claude/skills/spike-findings-gsd-beads/SKILL.md
@.claude/skills/spike-findings-gsd-beads/references/beads-modeling.md
@.claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh

<interfaces>
<!-- bd CLI commands the regen scripts call. Memorize these — do not invent variants. -->
<!-- Verified in Spike 002 + Spike 007 README. -->

bd CLI surface used in this plan:
- `bd list --type=epic -l <label> --status=all -n 0 --json` — list epics with given label
- `bd list --type=epic -l <label> --status=closed --json` — only closed epics (for Out of Scope)
- `bd children <id> --json` — list children of an epic (for Plans list under each phase)
- `bd show <id> --json` — get full bead with dependencies array
- `bd epic close-eligible` — cascade-close any epic whose children are all closed (idempotent)

JSON shape for `bd list --json` (Spike 002 verified):
```json
[
  {
    "id": "abc-1",
    "title": "Phase 1: Auth backend",
    "issue_type": "epic",
    "priority": 1,
    "status": "open",
    "labels": ["gsd:phase", "milestone:v1.0"],
    "description": "Goal: ...\nSuccess Criteria:\n  1. ...",
    "dependencies": [
      {"target_id": "req-1", "dependency_type": "parent-child"}
    ],
    "close_reason": null
  }
]
```

JSON shape for `bd children --json` (Spike 002 verified):
Same array shape; one entry per child.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Create test stubs and fixture builder</name>
  <files>
    tests/hook-tests/cascade-loop.test.sh,
    tests/hook-tests/regen-roadmap.test.sh,
    tests/hook-tests/regen-requirements.test.sh,
    tests/fixtures/bd-helpers/3-level-hierarchy.sh
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-VALIDATION.md (per-task verification map for 02-01)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (test driver pattern from Spike 001 test-runner.sh — pass/fail tally + exit-nonzero-on-fail)
    - .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh (line 22-24, 60, 224 — tally pattern)
    - .planning/spikes/CONVENTIONS.md (Stack table — bash + jq + bd CLI for these tests)
  </read_first>
  <action>
    Create three failing test stubs and one shared fixture builder. **All four files are bash + jq + bd CLI** (Stack: see CONVENTIONS).

    **File 1: `tests/fixtures/bd-helpers/3-level-hierarchy.sh`** — shared test fixture builder.
    - Takes a directory argument; runs `cd "$1" && bd init --non-interactive --skip-agents` if `.beads/` missing.
    - Builds the canonical Spike 002 fixture verbatim:
    ```bash
    REQ=$(bd q "REQ-042: Email/password auth" -t epic -p 0)
    bd label add "$REQ" gsd:requirement
    bd label add "$REQ" req-id:REQ-042
    bd label add "$REQ" version:v1
    bd label add "$REQ" category:auth
    P1=$(bd q "Phase 12: Auth backend" -t epic -p 1)
    bd label add "$P1" gsd:phase
    bd label add "$P1" milestone:v1.0
    bd link "$P1" "$REQ" --type parent-child
    P2=$(bd q "Phase 13: Auth UI" -t epic -p 2)
    bd label add "$P2" gsd:phase
    bd label add "$P2" milestone:v1.0
    bd link "$P2" "$REQ" --type parent-child
    T1=$(bd q "Hash passwords" -t task -p 1)
    bd link "$T1" "$P1" --type parent-child
    T2=$(bd q "Verify JWT" -t task -p 2)
    bd link "$T2" "$P1" --type parent-child
    T3=$(bd q "Login form" -t task -p 1)
    bd link "$T3" "$P2" --type parent-child
    ```
    - Echo a summary line: `[fixture] built 3-level hierarchy: 1 req → 2 phases → 3 tasks`.

    **File 2: `tests/hook-tests/cascade-loop.test.sh`** — failing stub (Wave 0 marker).
    - shebang `#!/usr/bin/env bash`, `set -euo pipefail`.
    - Sets `pass=0; fail=0`.
    - Echo `[cascade-loop.test.sh] STUB — production code not yet written` and exit 1 (red Wave 0).
    - Add comment block with the 4 cases the production task will fill in:
      `# CASE 1: cascade closes parent when all children closed (1 round)`
      `# CASE 2: cascade is idempotent (2nd run = no-op)`
      `# CASE 3: max-iteration cap at 20 prevents infinite loop`
      `# CASE 4: --quiet flag suppresses stdout when nothing closed`

    **File 3: `tests/hook-tests/regen-roadmap.test.sh`** — failing stub.
    - shebang, set -euo pipefail.
    - Echo `[regen-roadmap.test.sh] STUB` exit 1.
    - Comment cases:
      `# CASE 1: byte-stable output across two runs on identical bd state (determinism)`
      `# CASE 2: ## Progress table column-order matches gsd-progress parser expectations`
      `# CASE 3: phases sorted by priority then bead-creation-order`
      `# CASE 4: requirements line lists parent-req IDs from req-id:* labels`
      `# CASE 5: missing PROJECT.md does not crash (informational fallback)`

    **File 4: `tests/hook-tests/regen-requirements.test.sh`** — failing stub.
    - shebang, set -euo pipefail.
    - Echo `[regen-requirements.test.sh] STUB` exit 1.
    - Comment cases:
      `# CASE 1: byte-stable output across two runs on identical bd state`
      `# CASE 2: ## v1 Requirements grouping correctly partitions by version:v1 label`
      `# CASE 3: ## <Category> sub-headers from category:* labels`
      `# CASE 4: ## Out of Scope rows from status=closed + close_reason=out-of-scope`
      `# CASE 5: ## Traceability table maps requirement → phases via parent-child`

    Make all four files executable: `chmod +x tests/fixtures/bd-helpers/*.sh tests/hook-tests/*.test.sh`.
  </action>
  <acceptance_criteria>
    - File `tests/fixtures/bd-helpers/3-level-hierarchy.sh` exists, is executable, contains string `bd q "REQ-042` and `bd link.*--type parent-child`.
    - File `tests/hook-tests/cascade-loop.test.sh` exists, is executable, exits 1 when invoked.
    - File `tests/hook-tests/regen-roadmap.test.sh` exists, is executable, exits 1 when invoked.
    - File `tests/hook-tests/regen-requirements.test.sh` exists, is executable, exits 1 when invoked.
    - Verify: `grep -c '^# CASE' tests/hook-tests/cascade-loop.test.sh` returns at least 4.
    - Verify: `grep -c '^# CASE' tests/hook-tests/regen-roadmap.test.sh` returns at least 5.
    - Verify: `grep -c '^# CASE' tests/hook-tests/regen-requirements.test.sh` returns at least 5.
  </acceptance_criteria>
  <verify>
    <automated>bash -n tests/hook-tests/cascade-loop.test.sh && bash -n tests/hook-tests/regen-roadmap.test.sh && bash -n tests/hook-tests/regen-requirements.test.sh && bash -n tests/fixtures/bd-helpers/3-level-hierarchy.sh && test -x tests/hook-tests/cascade-loop.test.sh</automated>
  </verify>
  <done>All 4 stub files exist, executable, syntax-valid, and the three test stubs exit non-zero (red Wave 0 markers).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 1): Implement cascade-loop.sh + finish its test suite</name>
  <files>
    scripts/cascade-loop.sh,
    tests/hook-tests/cascade-loop.test.sh
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh (EXACT verbatim source — copy this)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (Phase 2 deltas: max-iter cap of 20, --quiet flag)
    - tests/fixtures/bd-helpers/3-level-hierarchy.sh (the fixture builder created in Task 1)
    - .planning/spikes/MANIFEST.md (cascade requirement: "5-line loop on `bd epic close-eligible`")
  </read_first>
  <behavior>
    - Test 1: After building 3-level hierarchy and closing all 3 tasks, running cascade-loop.sh closes both phases and the requirement (3 epics closed across 1+ iterations).
    - Test 2: Running cascade-loop.sh a second time on the now-closed graph emits "No epics eligible" path and exits 0 with no further closures.
    - Test 3: Max-iteration safety cap (set MAX_ITER=2 via env) on a fixture that would loop forever exits 0 without crash.
    - Test 4: With `--quiet` flag, when nothing is closed, stdout is empty.
  </behavior>
  <action>
    **Step A: Implement `scripts/cascade-loop.sh`.** Copy verbatim from `.claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh` and apply Phase 2 deltas:

    ```bash
    #!/usr/bin/env bash
    # Cascade-close loop using bd's built-in `bd epic close-eligible`.
    # Idempotent — safe to call repeatedly.
    # Phase 2 deltas: max-iteration cap (env: MAX_ITER, default 20) + --quiet flag.
    set -euo pipefail

    QUIET=0
    if [ "${1:-}" = "--quiet" ]; then QUIET=1; fi
    MAX_ITER="${MAX_ITER:-20}"

    iter=0
    total_closed=0

    while [ "$iter" -lt "$MAX_ITER" ]; do
      iter=$((iter + 1))
      out=$(bd epic close-eligible 2>&1)

      if echo "$out" | grep -q 'No epics eligible'; then
        break
      fi

      [ "$QUIET" -eq 0 ] && echo "$out"
      closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
      total_closed=$((total_closed + ${closed:-0}))
    done

    if [ "$iter" -ge "$MAX_ITER" ]; then
      echo "[cascade-loop] WARNING: hit max iteration cap ($MAX_ITER); stopping" >&2
    fi

    if [ "$total_closed" -gt 0 ] && [ "$QUIET" -eq 0 ]; then
      echo ""
      echo "Cascade complete: $total_closed epic(s) closed across $((iter - 1)) iteration(s)"
    fi
    ```
    `chmod +x scripts/cascade-loop.sh`.

    **Step B: Fill in `tests/hook-tests/cascade-loop.test.sh`.** Use Spike 001's `test-runner.sh` pattern (lines 22-24, 60, 207-224 — tally + exit-nonzero-on-fail). Test driver runs in an ephemeral `BEADS_DIR=$(mktemp -d)/beads`-style fixture. Use the `tests/fixtures/bd-helpers/3-level-hierarchy.sh` builder. Implement the 4 CASEs from Task 1 stub. End with:
    ```bash
    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Threat mitigation (T-02-03 — bd-sync exec safety, see threat_model below):** cascade-loop.sh ONLY calls `bd epic close-eligible` and `grep`/`sed` — no eval of payload contents. Verified by `grep -c 'eval' scripts/cascade-loop.sh` → 0.
  </action>
  <acceptance_criteria>
    - `scripts/cascade-loop.sh` exists and is executable (`test -x scripts/cascade-loop.sh`).
    - `grep -c 'bd epic close-eligible' scripts/cascade-loop.sh` returns at least 1.
    - `grep -c 'MAX_ITER' scripts/cascade-loop.sh` returns at least 2 (declaration + comparison).
    - `grep -c '\-\-quiet' scripts/cascade-loop.sh` returns at least 1.
    - `grep -c 'eval' scripts/cascade-loop.sh` returns 0 (T-02-03 mitigation).
    - `bash -n scripts/cascade-loop.sh` exits 0 (syntax valid).
    - `bash tests/hook-tests/cascade-loop.test.sh` exits 0 with `Passed: 4 / 4` (all 4 CASEs PASS).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/hook-tests/cascade-loop.test.sh</automated>
  </verify>
  <done>cascade-loop.sh production-ready (idempotent, safety-capped, --quiet flag). All 4 cascade-loop test cases PASS.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (Wave 1): Implement regen-roadmap.sh + finish its test suite</name>
  <files>
    scripts/regen-roadmap.sh,
    tests/hook-tests/regen-roadmap.test.sh
  </files>
  <read_first>
    - .planning/spikes/007-reader-skill-format-contract/README.md (entire ROADMAP.md format contract — table at lines 25-44; bd commands at lines 105-118)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (regen-roadmap.sh section — output template structure, idempotency requirement, jq sort by priority+creation-order)
    - tests/fixtures/bd-helpers/3-level-hierarchy.sh (test fixture)
    - .claude/skills/spike-findings-gsd-beads/SKILL.md (canonical bd memory keys + format contract requirements)
  </read_first>
  <behavior>
    - Test 1 (DETERMINISM): two consecutive runs produce byte-identical .planning/ROADMAP.md (per Spike 007 idempotency contract).
    - Test 2 (PROGRESS TABLE): output contains `## Progress` header followed by a table whose first column is `Phase`, second `Status`.
    - Test 3 (PHASE SORT): when fixture has phases at priorities 1, 2, output lists phase-12 (p=1) before phase-13 (p=2).
    - Test 4 (REQUIREMENTS LINE): each `### Phase N` block contains `**Requirements**: [REQ-042]` (parsed from req-id:* labels of parent).
    - Test 5 (NO CRASH): with no PROJECT.md present, script still emits a roadmap file with empty Overview paragraph (informational fallback, not abort).
  </behavior>
  <action>
    **Step A: Implement `scripts/regen-roadmap.sh`.** Build from Spike 007 contract per PATTERNS.md regen-roadmap.sh section. **Bash + jq + bd only.** Write to `.planning/ROADMAP.md` atomically (write to `$tmp` then `mv`).

    Key blocks (in this order):

    1. **Pre-flight:** `set -euo pipefail`, locate project root via `git rev-parse --show-toplevel` or fall back to `$CLAUDE_PROJECT_DIR` or `$PWD`. Set `OUT="$root/.planning/ROADMAP.md"` and `tmp=$(mktemp)`.

    2. **Header:** `printf '# Roadmap: %s\n\n' "$(bd config get project.name 2>/dev/null || basename "$root")" >> "$tmp"`.

    3. **Overview:** if `$root/.planning/PROJECT.md` exists, sed-extract the first paragraph after `# Project:` heading; else write empty placeholder line.

    4. **Pull phase set with sort:**
    ```bash
    phases_json=$(bd list --type=epic -l gsd:phase --status=all -n 0 --json | \
      jq 'sort_by(.priority, .created_at)')
    ```

    5. **Phase summary list:** iterate `phases_json` and emit `- [ ] **Phase N: Title** - desc` lines (N from priority, desc from description first line).

    6. **Per-phase blocks:** for each phase, fetch `bd children <id> --json` and emit:
       - `### Phase N: Title`
       - `**Goal**: <parsed from description first paragraph after "Goal:">`
       - `**Depends on**: <comma-separated phase numbers from blocks deps>`
       - `**Requirements**: [<comma-separated req-ids from parent gsd:requirement labels>]` — query via `bd show <phase-id> --json | jq '.[0].dependencies[] | select(.dependency_type=="parent-child") | .target_id'`, then `bd show <target> --json` and grep for `req-id:*` label.
       - `**Success Criteria** (what must be TRUE):` followed by lines parsed from description after "Success Criteria:".
       - `**Plans**: N plans / TBD` where N=count of children.
       - Plans list: `- [ ] NN-NN: title` for each child task.

    7. **Progress table:** iterate phases_json, derive status from bead status (`open`→`Not started`, `in_progress`→`In progress`, `closed`→`Complete`, deferred→`Deferred`). Emit:
       ```
       ## Progress
       | Phase | Status | Plans Done | Plans Total |
       |-------|--------|------------|-------------|
       | Phase N: Name | Status | x | y |
       ```

    8. **Atomic write:** `mv "$tmp" "$OUT"`.

    `chmod +x scripts/regen-roadmap.sh`.

    **Step B: Fill in `tests/hook-tests/regen-roadmap.test.sh`.** Use the test fixture from Task 1 + the bash test driver pattern. Build hierarchy, run regen, snapshot the bytes, run regen a second time, diff (Test 1). Then assert grep patterns for Tests 2-5. Final tally + exit-nonzero-on-fail.

    **Determinism note:** since description text and creation timestamps would otherwise drift, the script MUST sort by `(priority, created_at)` and produce no timestamps in output. The test asserts byte-equality across runs.

    **Threat note (no T-02-XX direct):** regen-roadmap.sh reads bd output but never writes to `~/.claude/get-shit-done/` (REQ-02 honored — per D-04/D-05 only `.planning/ROADMAP.md` is written).
  </action>
  <acceptance_criteria>
    - `scripts/regen-roadmap.sh` exists and is executable.
    - `grep -c 'bd list.*-l gsd:phase' scripts/regen-roadmap.sh` returns at least 1.
    - `grep -c 'bd children' scripts/regen-roadmap.sh` returns at least 1.
    - `grep -c 'sort_by' scripts/regen-roadmap.sh` returns at least 1 (determinism).
    - `grep -c 'mv.*\.planning/ROADMAP\.md' scripts/regen-roadmap.sh` returns at least 1 (atomic write).
    - `grep -c '~/.claude/get-shit-done' scripts/regen-roadmap.sh` returns 0 (REQ-02 guard).
    - `bash -n scripts/regen-roadmap.sh` exits 0.
    - `bash tests/hook-tests/regen-roadmap.test.sh` exits 0 with `Passed: 5 / 5`.
  </acceptance_criteria>
  <verify>
    <automated>bash tests/hook-tests/regen-roadmap.test.sh</automated>
  </verify>
  <done>regen-roadmap.sh produces deterministic ROADMAP.md from bd state matching Spike 007 contract. All 5 cases PASS.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 (Wave 1): Implement regen-requirements.sh + finish its test suite</name>
  <files>
    scripts/regen-requirements.sh,
    tests/hook-tests/regen-requirements.test.sh
  </files>
  <read_first>
    - .planning/spikes/007-reader-skill-format-contract/README.md (REQUIREMENTS.md format contract — lines 46-58)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (regen-requirements.sh section)
    - scripts/regen-roadmap.sh (helper patterns from Task 3 — reuse atomic-write pattern, root-detection)
    - tests/fixtures/bd-helpers/3-level-hierarchy.sh
  </read_first>
  <behavior>
    - Test 1 (DETERMINISM): two consecutive runs produce byte-identical .planning/REQUIREMENTS.md.
    - Test 2 (VERSION GROUPING): emits `## v1 Requirements` for beads with label version:v1.
    - Test 3 (CATEGORY SUB-HEADERS): under each version, sub-grouped by category:* labels — `### Authentication` for category:auth.
    - Test 4 (OUT OF SCOPE): closed beads with close_reason=out-of-scope appear in `## Out of Scope` table.
    - Test 5 (TRACEABILITY): `## Traceability` table lists each requirement → phases via parent-child.
  </behavior>
  <action>
    **Step A: Implement `scripts/regen-requirements.sh`.** Build from Spike 007 contract per PATTERNS.md regen-requirements.sh section. **Bash + jq + bd only.**

    Structure (in order):
    1. **Pre-flight:** `set -euo pipefail`, root detection identical to regen-roadmap.sh, `OUT="$root/.planning/REQUIREMENTS.md"`, `tmp=$(mktemp)`.
    2. **Header:** `# Requirements: <Project>` + `**Defined:** $(date +%F)` + `**Core Value:** <from PROJECT.md if present, else empty>`.
    3. **Pull all reqs:**
       ```bash
       reqs_json=$(bd list --type=epic -l gsd:requirement --status=all -n 0 --json | jq 'sort_by(.priority, .created_at)')
       ```
    4. **Group by version label:** for each unique `version:v*` label seen, emit `## v1 Requirements` section. Within section, sub-group by `category:*` label — emit `### <Category-slug-titled>` headers.
    5. **Within each category:** emit `- [ ] **<REQ-ID>**: <title>` line (REQ-ID from `req-id:*` label, fallback to bead id). Use `[x]` if status=closed.
    6. **Out of Scope table:** filter closed beads with close_reason=out-of-scope:
       ```bash
       oos=$(bd list --type=epic -l gsd:requirement --status=closed --json | \
         jq '[.[] | select(.close_reason=="out-of-scope")]')
       ```
       Emit table: `| ID | Title | Reason |`.
    7. **Traceability table:** for each phase bead, query its parent reqs:
       ```bash
       phases=$(bd list --type=epic -l gsd:phase --json | jq -r '.[].id')
       for p in $phases; do
         parent_reqs=$(bd show "$p" --json | jq -r '.[0].dependencies[] | select(.dependency_type=="parent-child") | .target_id')
         # ... aggregate req → [phase numbers]
       done
       ```
       Emit table: `| Requirement | Phases |`.
    8. **Atomic write:** `mv "$tmp" "$OUT"`.

    **Step B: Fill in `tests/hook-tests/regen-requirements.test.sh`.** Test driver mirrors Task 3. Use the 3-level fixture (which has version:v1 + category:auth labels) and verify all 5 CASEs.
  </action>
  <acceptance_criteria>
    - `scripts/regen-requirements.sh` exists and is executable.
    - `grep -c 'bd list.*-l gsd:requirement' scripts/regen-requirements.sh` returns at least 1.
    - `grep -c 'close_reason==\"out-of-scope\"' scripts/regen-requirements.sh` returns at least 1.
    - `grep -c 'parent-child' scripts/regen-requirements.sh` returns at least 1.
    - `grep -c 'mv.*\.planning/REQUIREMENTS\.md' scripts/regen-requirements.sh` returns at least 1.
    - `grep -c '~/.claude/get-shit-done' scripts/regen-requirements.sh` returns 0 (REQ-02 guard).
    - `bash -n scripts/regen-requirements.sh` exits 0.
    - `bash tests/hook-tests/regen-requirements.test.sh` exits 0 with `Passed: 5 / 5`.
  </acceptance_criteria>
  <verify>
    <automated>bash tests/hook-tests/regen-requirements.test.sh</automated>
  </verify>
  <done>regen-requirements.sh produces deterministic REQUIREMENTS.md from bd state matching Spike 007 contract. All 5 cases PASS.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bd CLI → script stdout | Untrusted bd output (theoretical: malicious bd reply) → parsed by jq into our script |
| script → filesystem | Scripts write to `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03 | Information disclosure / Tampering | scripts/cascade-loop.sh | mitigate | Only invokes `bd epic close-eligible`; no eval of bd output. Grep gate: `grep -c 'eval' scripts/cascade-loop.sh` returns 0 (Task 2 acceptance). |
| T-02-09 | Tampering (REQ-02 violation) | scripts/regen-{roadmap,requirements}.sh | mitigate | Scripts only write to `.planning/*.md`. Grep gate per task: `grep -c '~/.claude/get-shit-done' <script>` returns 0. |
</threat_model>

<verification>
- All four task verifies pass.
- `bash tests/hook-tests/cascade-loop.test.sh && bash tests/hook-tests/regen-roadmap.test.sh && bash tests/hook-tests/regen-requirements.test.sh` exits 0 with combined `Passed: 14 / 14`.
- `grep -rn '~/.claude/get-shit-done' scripts/` returns no matches (REQ-02).
- `bash -n scripts/*.sh` syntax-clean for all three scripts.
</verification>

<success_criteria>
- 3 production scripts (cascade-loop.sh, regen-roadmap.sh, regen-requirements.sh) committed and executable.
- 3 test suites (cascade-loop.test.sh, regen-roadmap.test.sh, regen-requirements.test.sh) all exit 0 with full pass tallies.
- 1 fixture builder (3-level-hierarchy.sh) exists and is reused by all three test suites.
- Determinism property holds: running each regen script twice on identical bd state produces zero `diff` output.
- REQ-01 satisfied: bd is the source of truth — `.planning/{ROADMAP,REQUIREMENTS}.md` are pure functions of bd state.
- REQ-02 honored: no script touches anything under `~/.claude/get-shit-done/`.
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-01-SUMMARY.md` documenting:
- The 3 scripts and their CLI contracts
- The 3 test suites' pass tallies
- The reusable fixture path that downstream plans (02-02, 02-06) will consume
- Any deviations from spike POCs (max-iter cap, --quiet flag, atomic write helpers)
</output>
