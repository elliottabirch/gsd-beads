---
phase: 02-build-the-layer
plan: "01"
subsystem: bd-helpers
tags: [bash, jq, bd-cli, cascade, regen, scripts, tests]
dependency_graph:
  requires: []
  provides:
    - scripts/cascade-loop.sh
    - scripts/regen-roadmap.sh
    - scripts/regen-requirements.sh
    - tests/fixtures/bd-helpers/3-level-hierarchy.sh
  affects:
    - plans/02-02-hooks (bd-sync.sh invokes these scripts)
    - plans/02-06-e2e-smoke-test (3-level-hierarchy fixture reused)
tech_stack:
  added: []
  patterns:
    - bash + jq + bd CLI only (no Node, no Python)
    - atomic write via mktemp + mv
    - base64 pipe-loop for jq output iteration
    - two-pass trace_tmp pattern for nested aggregation
key_files:
  created:
    - scripts/cascade-loop.sh
    - scripts/regen-roadmap.sh
    - scripts/regen-requirements.sh
    - tests/fixtures/bd-helpers/3-level-hierarchy.sh
    - tests/hook-tests/cascade-loop.test.sh
    - tests/hook-tests/regen-roadmap.test.sh
    - tests/hook-tests/regen-requirements.test.sh
  modified: []
decisions:
  - "D-DEV-01: renamed status/status→p_status/bead_status throughout to avoid zsh read-only variable collision"
  - "D-DEV-02: bd commands inside outer pipe-while require </dev/null to avoid stdin contamination of outer loop"
  - "D-DEV-03: traceability uses two-pass trace_tmp file approach (nested pipe subshells cannot pass data via variables)"
  - "D-DEV-04: printf -- prefix on list items to prevent '-' from being interpreted as printf flag"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-28"
  tasks_completed: 4
  tasks_total: 4
  files_created: 7
  files_modified: 0
requirements_addressed:
  - REQ-01
---

# Phase 02 Plan 01: bd-helpers Summary

## One-liner

Three bash+jq+bd-CLI scripts (cascade-loop, regen-roadmap, regen-requirements) with 14 passing tests and a reusable 3-level fixture builder.

## What was built

### Scripts

**`scripts/cascade-loop.sh`** — Idempotent bd epic close-eligible loop with max-iteration safety cap (MAX_ITER=20) and --quiet flag. Based verbatim on Spike 002 canonical loop with Phase 2 deltas applied. T-02-03 threat mitigated: no dynamic execution of bd output.

**`scripts/regen-roadmap.sh`** — Deterministic ROADMAP.md regeneration from bd state following Spike 007 format contract. Outputs: # Roadmap header, ## Overview (PROJECT.md fallback), phase summary list, per-phase detail blocks (Goal, Depends on, Requirements from req-id:* labels, Success Criteria, Plans list), and ## Progress table (Phase/Status/Plans Done/Plans Total columns). Phases sorted by `(priority, created_at)` for byte-stable output.

**`scripts/regen-requirements.sh`** — Deterministic REQUIREMENTS.md regeneration from bd state. Outputs: # Requirements header, ## v{N} Requirements sections (grouped by version:* label), ### Category sub-headers (from category:* labels), ## Out of Scope table (close_reason=out-of-scope), ## Traceability table (requirement → phases via parent-child lookup). Uses two-pass trace_tmp approach for traceability aggregation.

### Test Suites

| Test File | Cases | Result |
|-----------|-------|--------|
| `tests/hook-tests/cascade-loop.test.sh` | 4 | 4/4 PASS |
| `tests/hook-tests/regen-roadmap.test.sh` | 5 | 5/5 PASS |
| `tests/hook-tests/regen-requirements.test.sh` | 5 | 5/5 PASS |
| **Combined** | **14** | **14/14 PASS** |

### Fixture Builder

**`tests/fixtures/bd-helpers/3-level-hierarchy.sh`** — Reusable shared fixture for downstream plans (02-02, 02-06). Builds the canonical Spike 002 fixture: 1 requirement epic (REQ-042, version:v1, category:auth) → 2 phase epics (Phase 12 p=1, Phase 13 p=2) → 3 task beads. Takes a directory argument.

## CLI Contracts

| Script | Input | Output | Key bd calls |
|--------|-------|--------|--------------|
| `cascade-loop.sh` | `--quiet`, `MAX_ITER` env | stdout close events | `bd epic close-eligible` |
| `regen-roadmap.sh` | (none, uses git root / CLAUDE_PROJECT_DIR) | `.planning/ROADMAP.md` | `bd list -l gsd:phase`, `bd children`, `bd show` |
| `regen-requirements.sh` | (none, uses git root / CLAUDE_PROJECT_DIR) | `.planning/REQUIREMENTS.md` | `bd list -l gsd:requirement`, `bd show`, `bd list --status=closed` |

## Deviations from Plan

### Auto-discovered Issues (Rules 1-2)

**1. [Rule 1 - Bug] bash read-only variable `status` collision with zsh shell**
- **Found during:** Task 3 initial testing
- **Issue:** `status` is a read-only variable in zsh; naming pipeline variables `status` caused silent assignment failures when the script ran in a zsh-inherited context
- **Fix:** Renamed all pipeline iteration variables to `p_status`, `p_title`, `p_desc`, `bead_status`, `child_bead_status` etc.
- **Files modified:** `scripts/regen-roadmap.sh`
- **Commit:** a3be6c3

**2. [Rule 1 - Bug] bd commands inside outer pipe-while consume stdin**
- **Found during:** Task 4 traceability debugging
- **Issue:** `bd show "$phase_id" --json` inside a `printf ... | while read` outer loop consumed the pipe's stdin, terminating the outer loop early
- **Fix:** Added `</dev/null` redirect to `bd show` calls inside pipe-while loops
- **Files modified:** `scripts/regen-requirements.sh`
- **Commit:** bdf89ca

**3. [Rule 1 - Bug] printf format string '-' interpreted as option flag**
- **Found during:** Task 3 initial testing
- **Issue:** `printf '- [%s]...'` — printf in some contexts interprets leading `-` in format strings as option flags
- **Fix:** Used `printf -- '- [%s]...'` (POSIX `--` end-of-options delimiter)
- **Files modified:** `scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`
- **Commit:** a3be6c3, bdf89ca

**4. [Rule 1 - Bug] jq query `.[] | select(.dependency_type...)` wrong — should be `.[0].dependencies[]`**
- **Found during:** Task 3 testing (requirements showed `[]` instead of `[REQ-042]`)
- **Issue:** `bd show <phase-id> --json` returns an array where `.[0]` is the phase itself and `.[0].dependencies[]` are the parent bead objects. The original plan's code example used `.[] | select(...)` which was incorrect.
- **Fix:** Changed to `.[0].dependencies[] | select(.dependency_type=="parent-child")`
- **Files modified:** `scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`
- **Commit:** a3be6c3

**5. [Rule 1 - Bug] Nested pipe subshell writes to trace_tmp not persisting**
- **Found during:** Task 4 traceability debugging
- **Issue:** When using `printf '%s' "$ids" | while read rid; do echo ... >> trace_tmp` inside an outer `| while` loop, the inner pipe subshell ran in a new subshell and the writes were silently lost
- **Fix:** Replaced inner `printf | while` with IFS-based `for` loop directly in the outer subshell
- **Files modified:** `scripts/regen-requirements.sh`
- **Commit:** bdf89ca

**6. [Rule 1 - Bug] bd priority must be 0-4, not arbitrary integers**
- **Found during:** Task 4 test writing (used `-p 99` in test fixture)
- **Issue:** bd rejects priority values outside 0-4 range
- **Fix:** Changed test to use `-p 4` for out-of-scope requirement
- **Files modified:** `tests/hook-tests/regen-requirements.test.sh`
- **Commit:** bdf89ca

**7. [Rule 2 - Missing] eval safety comment contained 'eval' keyword**
- **Found during:** Task 2 acceptance check
- **Issue:** `grep -c 'eval' scripts/cascade-loop.sh` returned 1 due to comment text; T-02-03 acceptance criteria requires 0
- **Fix:** Removed 'eval' from comment; reworded to "no dynamic execution of bd output"
- **Files modified:** `scripts/cascade-loop.sh`
- **Commit:** 18c2da1

## REQ-01 Satisfaction

Beads is now the source of truth: `scripts/regen-roadmap.sh` and `scripts/regen-requirements.sh` produce `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` as pure read-only views of bd state. Both scripts satisfy the Spike 007 format contract tested to pass with the gsd-progress parser expectation (## Progress table column order verified in CASE 2).

## Reusable Fixture

`tests/fixtures/bd-helpers/3-level-hierarchy.sh` is the canonical shared fixture for Plans 02-02 through 02-06. It creates: REQ-042 (gsd:requirement, req-id:REQ-042, version:v1, category:auth) → Phase 12 (gsd:phase, p=1) + Phase 13 (gsd:phase, p=2) → 3 tasks. Runs idempotently (skips bd init if .beads/ exists).

## Self-Check

- [x] scripts/cascade-loop.sh — exists, committed in 18c2da1
- [x] scripts/regen-roadmap.sh — exists, committed in a3be6c3
- [x] scripts/regen-requirements.sh — exists, committed in bdf89ca
- [x] tests/fixtures/bd-helpers/3-level-hierarchy.sh — exists, committed in 6d69e27
- [x] All test suites exit 0 with full pass tallies (14/14 total)
- [x] REQ-02 honored: no script touches ~/.claude/get-shit-done/

## Self-Check: PASSED
