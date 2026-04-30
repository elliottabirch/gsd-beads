---
phase: 05-roadmap-read-handlers
plan: "04"
subsystem: roadmap-get-phase-handler
tags:
  - roadmap-get-phase
  - read-handler
  - parity-snapshot
  - cross-handler-parity
  - sc-3
dependency_graph:
  requires:
    - 05-01 (seed.jsonl with 11 phases + 24 plans + milestone memories)
    - 05-02 (assertKeySetParityWithExt helper)
    - 05-03 (beadsRoadmapAnalyze handler + SYNTHETIC_FIXTURE infrastructure)
  provides:
    - bin/gsd-sdk-shadow.mjs: beadsRoadmapGetPhase handler (~90 LOC, lines ~583-670)
    - tests/scripts/update-snapshots.mjs: SYNTHETIC_FIXTURE const + captureRoadmapGetPhase() entry
    - tests/shadow-tests/snapshots/roadmap-get-phase.json: upstream shape for phase 5 (v0.2)
    - tests/shadow-tests/handler-roadmap-get-phase.test.mjs: 6 cases (parity, happy, decimal, unmatched, passthrough, usage)
    - tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs: SC #3 cross-handler byte-equality
  affects:
    - BEADS_READ_OVERRIDES: second entry 'roadmap.get-phase' added
tech_stack:
  added: []
  patterns:
    - SYNTHETIC_FIXTURE shared const in update-snapshots.mjs — DRY refactor avoids duplicate ROADMAP.md content
    - withSyntheticFixture() helper — shared tempdir lifecycle (seed → write → run → cleanup) for both analyze and get-phase captures
    - Cross-handler parity test with EXPLICIT key remap: number↔phase_number, name↔phase_name
    - Graceful usage-error return shape ({found:false, error:'Usage:...'}) matching upstream's "ROADMAP.md not found" non-throwing pattern
    - SC #3 enforcement: both handlers use bead.title directly (no stripping) for byte-equal name/phase_name values
key_files:
  created:
    - tests/shadow-tests/snapshots/roadmap-get-phase.json
    - tests/shadow-tests/handler-roadmap-get-phase.test.mjs
    - tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs
  modified:
    - bin/gsd-sdk-shadow.mjs (beadsRoadmapGetPhase function + BEADS_READ_OVERRIDES entry)
    - tests/scripts/update-snapshots.mjs (SYNTHETIC_FIXTURE refactor + captureRoadmapGetPhase entry)
decisions:
  - "SC #3 phase_name consistency: beadsRoadmapGetPhase uses `phaseBead.title ?? ''` (no stripping) to match beadsRoadmapAnalyze's `name: bead.title ?? ''` exactly. Both handlers read the same bead field, producing byte-equal values under different key names (analyze→name, get-phase→phase_name). If title stripping were added to get-phase, SC #3 would silently fail."
  - "Snapshot shape observation: upstream snapshot stores data content directly (no {data:...} wrapper), matching roadmap-analyze.json convention. CASE 1 parity test compares parsed.data against snapshot using assertKeySetParityWithExt(parsed.data, snap, ['backend'])."
  - "usage-error strategy: handler returns {found:false, error:'Usage:...', backend:'beads'} (exit 0) rather than throwing, mirroring upstream's {found:false, error:'ROADMAP.md not found'} non-throwing shape. This keeps CASE 6 consistent with upstream semantics."
  - "section synthesis: `### Phase <N>: <name>\\n\\n<desc>` assembled from bd bead fields. Do NOT read .planning/ROADMAP.md — bd is the source of truth (key_decisions from plan). trimEnd() strips trailing whitespace when desc is empty."
  - "success_criteria parsing: captures bulleted/numbered list after 'Success Criteria:' heading in bead description. Seed beads have no description, so success_criteria = [] for all seed phases. Spike 007 format contract: '- item' or '1. item' list lines."
metrics:
  duration: ~25 minutes
  completed: "2026-04-29"
  tasks: 3
  files_modified: 5
  tests_added: 8
  tests_total: 128
---

# Phase 5 Plan 04: roadmap.get-phase Handler Summary

Implements `beadsRoadmapGetPhase`, the second Phase 5 read handler, satisfying REQ-READ-02 + SC #3 (cross-handler parity for overlapping keys with explicit key remap) + SC #5 (non-bd passthrough). Plan followed the standard RED→GREEN TDD cycle: snapshot captured first, tests written and confirmed failing, then handler turned everything GREEN.

## What Was Delivered

### Task 1 — Snapshot Infrastructure

Extended `tests/scripts/update-snapshots.mjs` with:

- Extracted `SYNTHETIC_FIXTURE` const (DRY refactor): `buildRoadmapMd()` and `buildStateMd()` methods shared by both analyze and get-phase entries — eliminates duplication of the v0.2 phase headings
- `withSyntheticFixture(callback)` helper: shared tempdir lifecycle used by both `captureRoadmapAnalyze` and `captureRoadmapGetPhase`
- `captureRoadmapGetPhase()`: runs upstream `query roadmap.get-phase 5` against the synthetic fixture, capturing the upstream shape
- `roadmap-get-phase.json` snapshot: `found: true, phase_number: "5", phase_name: "progress reads", goal: "progress.json + ...", success_criteria: [], section: "### Phase 5: ..."` — idempotent across two runs (md5 verified)

### Task 2 — 2 Test Files (8 cases) — RED Phase

`handler-roadmap-get-phase.test.mjs` (6 cases):
- CASE 1: parity snapshot — `assertKeySetParityWithExt(parsed.data, snap, ['backend'])` key-set check
- CASE 2: happy path — `found=true`, `phase_number='5'`, correct types, `backend='beads'`
- CASE 3: decimal phase — adds `phase-id:72.1` bead to fixture; queries `roadmap.get-phase 72.1` → `found=true, phase_number='72.1'` (D-02 preservation)
- CASE 4: unmatched — phase 99 absent → `found=false, phase_number='99', backend='beads'` (D-20 shape)
- CASE 5: non-bd passthrough — SC #5 verified (`backend !== 'beads'`)
- CASE 6: usage error — no args → `found=false, backend='beads'`, exit 0 (graceful)

`handler-roadmap-cross-handler-parity.test.mjs` (2 cases):
- CASE 1: SC #3 byte-equality with EXPLICIT KEY REMAP — visible `number → phase_number` and `name → phase_name` remap code; `assert.deepStrictEqual(analyzeRemapped, getPhaseSubset)`
- CASE 2: deterministic consistency — 4 total spawns (analyze×2, get-phase×2); all 4 views of overlapping fields agree

Red signal at Task 2 end: 6 failures confirmed (CASE 2, 3, 4, 6 in handler test; CASE 1, 2 in cross-handler test).

### Task 3 — Handler Implementation — GREEN

`beadsRoadmapGetPhase` function in `bin/gsd-sdk-shadow.mjs`:

**Handler line range:** ~583–670 in `bin/gsd-sdk-shadow.mjs`

Key implementation choices:

1. **Single bd export call** (D-27: ≤1 spawn budget; no memories call needed for get-phase)
2. **D-19 milestone scoping**: `readGitConfigMilestone()` shared with analyze; filters by `version:<milestone>` label
3. **D-20 lookup**: `parsePhaseId()` normalizes both sides (input `'5'` matches label `phase-id:05`; decimal `'72.1'` matches `phase-id:72.1`)
4. **SC #3 parity**: `phase_name = phaseBead.title ?? ''` (identical to analyze's `name: bead.title ?? ''`) — no stripping so both handlers produce byte-equal values under their respective key names
5. **D-20 unmatched**: returns `{found:false, phase_number:phaseArg, backend:'beads'}` (matches upstream's unmatched shape)
6. **Graceful usage error**: empty `args[0]` returns `{found:false, error:'Usage:...', backend:'beads'}` rather than throwing
7. **section synthesis**: `### Phase <N>: <name>\n\n<desc>` assembled from bd fields only (not ROADMAP.md disk)
8. **success_criteria**: parsed from `Success Criteria:` heading in bead description; `[]` when description is absent (current seed state)

`BEADS_READ_OVERRIDES` updated:
```javascript
export const BEADS_READ_OVERRIDES = {
  'roadmap.analyze': beadsRoadmapAnalyze,
  'roadmap.get-phase': beadsRoadmapGetPhase,
};
```

## Cross-Handler Parity Proof (SC #3)

Same bd bead (`phase-id:05`, title `"v0.2 Phase C: progress reads"`) → same overlapping field values via two code paths:

| Handler | Key name | Value |
|---------|----------|-------|
| roadmap.analyze | `number` | `"5"` |
| roadmap.get-phase | `phase_number` | `"5"` |
| roadmap.analyze | `name` | `"v0.2 Phase C: progress reads"` |
| roadmap.get-phase | `phase_name` | `"v0.2 Phase C: progress reads"` |
| roadmap.analyze | `goal` | `null` |
| roadmap.get-phase | `goal` | `null` |

Key remap visible in `handler-roadmap-cross-handler-parity.test.mjs`:
```javascript
// EXPLICIT REMAP: roadmap.analyze emits `number`/`name`; roadmap.get-phase emits `phase_number`/`phase_name`.
const analyzeRemapped = {
  phase_number: analyzePhase5.number,   // remap: number → phase_number
  phase_name: analyzePhase5.name,       // remap: name → phase_name
  goal: analyzePhase5.goal,
};
```

## Test Results

```
✔ All 128 tests pass (8 new + 120 baseline; regressions: 0)
✔ bash tests/shadow-tests/bd-allowlist-grep.test.sh — 2/2 pass
✔ bash tests/shadow-tests/seed-determinism.test.sh — 2/2 pass
✔ bash tests/install-tests/upstream-version-pin.test.sh — 2/2 pass
```

## Deviations from Plan

None — plan executed exactly as written. The only note: `grep -c "bd(['export'" bin/gsd-sdk-shadow.mjs` returns 3 instead of the plan's expected 2, because line 384 has a JSDoc comment referencing `bd(['export','--json'])`. The actual functional calls are 2 (one in analyze, one in get-phase), satisfying D-27.

## Known Stubs

None — all fields are wired to live bd data. `success_criteria: []` and `goal: null` are not stubs; they reflect the actual state of seed beads (no description set by `build-seed.sh`). The parsing logic correctly handles populated descriptions when present (Spike 007 format contract).

## Self-Check: PASSED

Commits verified:
- cc124d7 (Task 1: snapshot + update-snapshots refactor)
- cc71b37 (Task 2: 2 RED test files)
- 72340ed (Task 3: handler implementation + GREEN)

Files verified:
- tests/shadow-tests/snapshots/roadmap-get-phase.json: FOUND
- tests/shadow-tests/handler-roadmap-get-phase.test.mjs: FOUND
- tests/shadow-tests/handler-roadmap-cross-handler-parity.test.mjs: FOUND
