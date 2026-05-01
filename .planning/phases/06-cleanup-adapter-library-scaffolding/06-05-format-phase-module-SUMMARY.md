---
phase: 6
plan: 05
subsystem: format/phase
tags: [parser, formatter, round-trip, idempotency, phase-format, ARCH-03]
requires:
  - tests/unit/format-phase.test.mjs (Wave 0 driver from Plan 01)
  - .planning/ROADMAP.md (real-phase fixture source)
provides:
  - src/format/phase.mjs (4 named exports)
  - tests/unit/fixtures/phase-format/*.md (11 round-trip fixtures)
  - bidirectional parse/format primitive for Phase 8 evolveRoadmap/addPhase
affects:
  - tests/unit/fixtures/phase-format/.gitkeep (still present; harmless)
  - downstream Phase 8 (will import parsePhaseDescription/formatPhaseDescription
    when wiring evolveRoadmap)
tech-stack:
  added: []
  patterns:
    - "Round-trip idempotency on parsed structure (parse(format(parse(x))) === parse(x))"
    - "Label-anchored extraction with continuation absorption (unrecognized **Foo:** lines append to current section)"
    - "Opaque tail capture (D-16: everything after Success Criteria preserved byte-equal)"
key-files:
  created:
    - src/format/phase.mjs (250 lines)
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
  modified: []
decisions:
  - "Tail-trigger rule relaxed: tail starts at first **Plans line whenever any SECTIONS-recognized label has opened (current !== null), NOT only when inSC=true. Required because Phase 2 fixture has no Success Criteria block but does have a Plans tail; the original rule would have absorbed Plans content into Requirements as continuation."
  - "Label regex extended to tolerate parenthetical between **Foo** and the colon: /^\\*\\*([A-Za-z][A-Za-z ]*?)(?:\\*\\*\\s*(?:\\([^)]*\\)\\s*)?:|\\:\\s*\\*\\*)\\s*(.*)$/. Required for the canonical SC header **Success Criteria** (what must be TRUE):"
  - "Success Criteria continuation lines stored leading-whitespace-stripped, formatter re-emits canonical 5-space indent. Prevents the indent-growth bug where naive round-trip would compound indentation by 5 spaces per cycle."
metrics:
  duration: "~25 minutes"
  completed_date: 2026-05-01
  commits: 2
  tests_added: 0  # Wave 0 driver pre-existed
  tests_passing: 15
---

# Phase 6 Plan 05: format/phase.mjs bidirectional parser + 11 fixtures Summary

**One-liner:** ARCH-03 bidirectional phase title + description parser
implemented in `src/format/phase.mjs` (4 named exports, 250 lines) with
11 fixture markdown files driving the D-15 round-trip idempotency
contract; all 15 Wave 0 tests turn green on first implementation pass.

## What Shipped

### `src/format/phase.mjs` — 4 exports

| Export | Signature | Purpose |
|--------|-----------|---------|
| `parsePhaseTitle(line)` | `string → { number, name }` | Parses "Phase N: Name" or "Phase N.M: Name" (decimal); throws on malformed input |
| `formatPhaseTitle({ number, name })` | `→ string` | Emits "Phase N: Name" (no trailing newline) |
| `parsePhaseDescription(body)` | `string → { goal, depends_on, requirements, success_criteria, tail }` | Label-anchored extraction over the canonical 4 sections; tail captured opaquely per D-16 |
| `formatPhaseDescription(parsed)` | `→ string` | Reconstructs canonical markdown body (`**Foo**:` style, 2-space SC indent) |

### Title regex (per RESEARCH.md §2 line 167)
```
/^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/
```
Anchored both ends; allows ONE optional decimal segment; non-greedy
name capture. Bounded backtracking O(n) — verified <1ms on 1000-dot
adversarial input (T-6.05-01 mitigation).

### Label regex (extended from RESEARCH.md §2 to handle parenthetical SC header)
```
/^\*\*([A-Za-z][A-Za-z ]*?)(?:\*\*\s*(?:\([^)]*\)\s*)?:|\:\s*\*\*)\s*(.*)$/
```
Tolerates `**Foo**:`, `**Foo:**`, AND `**Foo** (parenthetical):` forms.

### Tail trigger
```
/^\s*\*\*Plans\b/
```
Triggered only when `current !== null` (i.e., we've opened at least one
canonical section).

### 11 fixture files at `tests/unit/fixtures/phase-format/`

| Fixture | Source | Edge case exercised |
|---------|--------|---------------------|
| `phase-1-spike.md` | ROADMAP §"Phase 1" | Loose body — no Goal/Requirements/SC, just prose + `**Status:** complete` + `**Depends on:** —` |
| `phase-2-build.md` | ROADMAP §"Phase 2" | `**Goal:**` style + `**Plans:** N plans` + `Plans:` checkbox list (7 `[x]` items) — tail capture without SC |
| `phase-5-roadmap.md` | ROADMAP §"Phase 5" | `**Goal**:` style + 5-item SC + Plans tail with `[ ]` checkboxes |
| `phase-6-cleanup.md` | ROADMAP §"Phase 6" (this phase) | Long Requirements list (12 IDs), 6-item SC, Plans tail mixing `[x]` and `[ ]` |
| `phase-13-final.md` | ROADMAP §"Phase 13" | 6-item SC with multi-clause items + `**Plans**: TBD` (one-line tail) |
| `decimal-72-1.md` | Synthetic | Documents that decimal phases (`Phase 72.1`) are tested in inline title tests |
| `multiline-goal.md` | Synthetic | Goal spans 4 lines with indented bullet continuations |
| `empty-success.md` | Synthetic | SC header followed by no items (success_criteria === []) |
| `depends-nothing.md` | Synthetic | Literal `Nothing` round-trips verbatim in `depends_on` |
| `requirements-tbd.md` | Synthetic | Literal `TBD` round-trips verbatim in `requirements` |
| `no-plans-section.md` | Synthetic | Body ends after SC; tail === '' |

## Test Results

```
node --test tests/unit/format-phase.test.mjs

✔ parsePhaseTitle: simple single-digit
✔ parsePhaseTitle: two-digit
✔ parsePhaseTitle: decimal phase number preserved
✔ formatPhaseTitle: round-trip on single title
✔ round-trip idempotent description: phase-1-spike.md
✔ round-trip idempotent description: phase-2-build.md
✔ round-trip idempotent description: phase-5-roadmap.md
✔ round-trip idempotent description: phase-6-cleanup.md
✔ round-trip idempotent description: phase-13-final.md
✔ round-trip idempotent description: decimal-72-1.md
✔ round-trip idempotent description: multiline-goal.md
✔ round-trip idempotent description: empty-success.md
✔ round-trip idempotent description: depends-nothing.md
✔ round-trip idempotent description: requirements-tbd.md
✔ round-trip idempotent description: no-plans-section.md

ℹ tests 15
ℹ pass 15
ℹ fail 0
ℹ duration_ms ~60
```

All 15 tests pass. Wave 0 RED → GREEN on the first implementation pass
(zero deviation iterations).

## Normalization Decisions Made by the Formatter

These are the canonical-form normalizations `formatPhaseDescription`
applies. Per D-15, idempotency on the parsed structure is the contract;
byte-equality is explicitly NOT required, so these normalizations are
permitted.

1. **Label style canonicalized to `**Foo**:`** — Even when the input used
   `**Foo:**` style (e.g., `**Goal:** Productionize ...` in phase-2),
   the formatter emits `**Goal**: Productionize ...`. The `**Goal:**`
   style still parses (LABEL_RE accepts both), so round-trip holds.
2. **Single blank line between sections** — Multiple consecutive blanks
   between sections collapse to one in the formatted output. Trailing
   blank lines per section are stripped at parse time.
3. **SC items at 2-space + numeric prefix** — `  1. <text>`, `  2. <text>`.
   Continuation lines (none in current fixtures) get 5-space indent.
4. **Tail emitted with single leading blank line** — `out.push('') ;
   out.push(tail)` produces a `\n\n` boundary between SC and tail. If
   tail is empty (e.g., `no-plans-section.md`), no trailing blank is
   emitted (`if (tail)` guard).
5. **SC header always emitted, even when success_criteria === []** —
   `**Success Criteria** (what must be TRUE):` is the canonical SC
   header; emitted unconditionally so empty-SC fixtures round-trip.
6. **Goal contents preserve embedded newlines** — Multi-line goals
   (e.g., `multiline-goal.md` with 4 lines + indented bullets) flow
   through `out.push(\`**Goal**: \${goal}\`)` as a single push with
   embedded `\n`; the join produces canonical multi-line output.
7. **Unrecognized `**Foo:**` labels (e.g., `**Status:**`) absorb into
   current section as continuation** — phase-1 and phase-2 both have
   `**Status:** complete` lines that aren't in SECTIONS; these
   roundtrip as part of the Goal (or Depends on) value with embedded
   newlines.

## Deviations from Plan

### Plan-spec deviations (no scope creep)

**1. [Rule 1 — Bug] Tail trigger rule relaxed from `inSC` to `current !== null`**

- **Found during:** Task 2 trace-through of phase-2-build.md
- **Issue:** The plan's drafted parser checked
  `if (inSC && /^\s*\*\*Plans/.test(line))` to detect tail start.
  But Phase 2 in the real ROADMAP has NO Success Criteria block — it
  goes Goal → Status → Depends on → Requirements → Plans. With the
  inSC guard, the parser would never enter SC mode and would never
  detect tail; the entire Plans content would be absorbed into
  Requirements as continuation. Threat T-6.05-02 (tail loss) would
  trigger.
- **Fix:** Relaxed the guard to `current !== null` — i.e., tail is
  detected whenever ANY canonical section has opened, regardless of
  whether SC was reached. Phase 2 now correctly captures the Plans
  list as `tail`.
- **Files modified:** src/format/phase.mjs (line 117)
- **Commit:** ac76d7a

**2. [Rule 1 — Bug] Label regex extended to handle SC header parenthetical**

- **Found during:** Task 2 design trace through `**Success Criteria**
  (what must be TRUE):` line
- **Issue:** The plan's drafted LABEL_RE was
  `/^\*\*([A-Za-z][A-Za-z ]*?)(?:\*\*\s*:|\:\s*\*\*)\s*(.*)$/` —
  expects `**` followed immediately (allowing whitespace) by `:`. But
  the canonical SC header `**Success Criteria** (what must be TRUE):`
  has a parenthetical between `**` and the trailing `:`. The regex
  would not match, and the parser would never enter SC mode for any
  real ROADMAP fixture. Every SC-bearing fixture would round-trip
  with success_criteria=[].
- **Fix:** Added an optional non-capturing parenthetical inside the
  first alternation:
  `(?:\*\*\s*(?:\([^)]*\)\s*)?:|\:\s*\*\*)`. Both styles
  (`**Foo**:` plain and `**Foo** (paren):`) match correctly; the
  `**Foo:**` style is unaffected.
- **Files modified:** src/format/phase.mjs (line 86)
- **Commit:** ac76d7a

**3. [Rule 1 — Bug] SC continuation lines store leading-whitespace-stripped to prevent indent growth**

- **Found during:** Task 2 design — preemptive fix (no fixture exercises
  this case, but RESEARCH.md §10 Risk #4 warns that "round-trip too
  loose / too strict" is the dominant failure mode).
- **Issue:** Naive parser would store SC continuation line as-is
  (`'\n' + sc`), preserving leading whitespace. Formatter would then
  prepend 5 spaces of canonical indent, producing 10-space indent on
  re-parse. After two round-trips: 15-space indent. Not idempotent.
- **Fix:** Continuation lines stored as `'\n' + line.trim()`; formatter
  emits canonical `     ${itemLines[j]}` (5 spaces). Trim+canonical-indent
  is a fixed point under format-then-parse.
- **Files modified:** src/format/phase.mjs (parseScItems function, line ~187)
- **Commit:** ac76d7a

### Auth gates / blockers

None.

## Threat Mitigations

| Threat | Status | Evidence |
|--------|--------|----------|
| T-6.05-01 (regex backtracking DoS) | mitigated | Adversarial input `Phase 1.1.1...` (1000 dots) parses in <1ms — bounded O(n) backtracking |
| T-6.05-02 (round-trip loses tail / Phase 8 corrupts ROADMAP) | mitigated | phase-2-build.md round-trip preserves Plans tail with all 7 `[x]` checkboxes (verified by inspecting parsed.tail). The `current !== null` tail-trigger relaxation was specifically motivated by this threat. |
| T-6.05-03 (round-trip too strict) | mitigated | Test driver uses `assert.deepStrictEqual(parsed2, parsed1)` exactly per D-15 spec; format() applies normalizations 1-7 above without breaking the contract |
| T-6.05-04 (info disclosure via error message) | accepted | Error includes `JSON.stringify(line)`; safe escape, no PII risk |

## Key Files

- **Created:** `src/format/phase.mjs` (250 lines, commit ac76d7a)
- **Created:** 11 fixture files under `tests/unit/fixtures/phase-format/`
  (commit 9ded924)
- **Existing test driver:** `tests/unit/format-phase.test.mjs` (Wave 0
  scaffolding from Plan 01) — driver unchanged; all 15 tests now green

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | test | 9ded924 | test(06-05): add 11 phase-format fixtures for round-trip property tests |
| 2 | feat | ac76d7a | feat(06-05): implement bidirectional phase title + description parser |

## Verification

- [x] `node --test tests/unit/format-phase.test.mjs` — 15/15 pass
- [x] `node --check src/format/phase.mjs` — syntax OK
- [x] All 4 named exports present (parsePhaseTitle, formatPhaseTitle,
      parsePhaseDescription, formatPhaseDescription)
- [x] Title regex `/^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/` present
      verbatim
- [x] File line count 250 (>= 80 minimum from acceptance criteria)
- [x] All 11 fixture files exist
- [x] phase-2-build.md `tail` field captures the Plans checkbox list
      (proves D-16 opaque-tail contract; mitigates T-6.05-02)
- [x] decimal-72-1.md exercises `\d+\.\d+` capture group via the inline
      title test `parsePhaseTitle('Phase 72.1: gap closure')`
- [x] Adversarial regex input (1000-dot decimal) parses in <1ms
      (mitigates T-6.05-01)

## Self-Check: PASSED

- src/format/phase.mjs — FOUND
- All 11 fixture files — FOUND
- Commit 9ded924 — FOUND in `git log`
- Commit ac76d7a — FOUND in `git log`
- All 15 tests pass — VERIFIED

## Next Plan

**06-06 (adapter shell + 8 cluster stub files)** picks up next. The
format/phase.mjs primitive is now available for adapter cluster modules
to import (e.g., Phase 8's `evolveRoadmap` will import
`parsePhaseDescription` / `formatPhaseDescription` from this file).
