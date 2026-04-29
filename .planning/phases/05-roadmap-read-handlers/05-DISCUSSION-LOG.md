# Phase 5: roadmap.* read handlers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 5-roadmap-read-handlers
**Areas discussed:** Phase identity, disk_status mapping, completed_phases, milestones[]

---

## Phase identity

### Q1: How should bd beads carry their phase number?

| Option | Description | Selected |
|--------|-------------|----------|
| Add `phase-id:NN` label | Extend build-seed.sh; regen-roadmap.sh + /gsd-beads-add-phase maintain. Phase 8 reuses. Stable, explicit, survives title edits. | ✓ |
| Parse from title regex | Match `/Phase\s+([\d.]+[A-Z]?)/i` against bead title. Brittle: title edits break lookup; current seed uses A/B/C letters not numbers. | |
| Sort-position numbering | Number = index+1 after deterministic sort. Numbers flap on insert/delete; can't represent decimal phases. | |

**User's choice:** Add `phase-id:NN` label (Recommended)

### Q2: Phase 4's `seed.jsonl` lacks `phase-id:NN` labels. How to close the gap?

| Option | Description | Selected |
|--------|-------------|----------|
| Update build-seed.sh + commit new seed.jsonl | Phase 5 deliverable: edit build-seed.sh to emit phase-id:01..07, regenerate seed.jsonl. Migrates entire test fleet atomically. | ✓ |
| Layer phase-id labels in Phase 5-only fixture | Sibling seed-phase5.jsonl with labels added. Two fixtures = two truths. | |
| Derive in handler from labels we already have | Synthetic mapping from version+sort. Inconsistent with Q1. | |

**User's choice:** Update build-seed.sh + commit new seed.jsonl (Recommended)

### Q3: Canonical phase-id label format?

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-padded numeric `phase-id:05` | Two-digit zero-pad; decimals `phase-id:72.1`; widen to 3-digit at 100+. Lex-sort works for 01..99. Matches existing `02-` directory convention. | ✓ |
| Plain numeric `phase-id:5` | Matches JSON literally but lex-sort breaks at 10; numeric coercion required for sort. | |
| Padded-3 `phase-id:005` / `phase-id:072-1` | All-string-sort-safe to 999 but diverges from `02-` convention; `-1` decimal encoding breaks user expectations. | |

**User's choice:** Zero-padded numeric (Recommended)

### Q4: What does the handler emit for `current_phase` and `phases[].number`?

| Option | Description | Selected |
|--------|-------------|----------|
| Strip padding at handler boundary | Storage `phase-id:05`, output `"5"`. Matches upstream byte-for-byte. parsePhaseId() helper. | ✓ |
| Emit padded `"05"` | Output matches label literally. Parity snapshot test FAILS against upstream's unpadded form. Breaks REQ-QUAL-01. | |

**User's choice:** Strip padding at handler boundary (Recommended)

---

## disk_status mapping

### Q1 (initial): How should the bd-backed handler derive `disk_status`?

User clarified before answering: "how does gsd currently handle this? shouldnt we just replace where gsd is looking for this data with the beads implementation, and leave gsd to make the decisions?"

**Claude's reformulation:** Explained that upstream's `roadmapAnalyze` is monolithic — no extractable disk_status helper. The two architectural seams are (a) regen approach (broken — the bug v0.2 repairs) and (b) shadow override (chosen). The real decision is which inputs come from bd vs disk.

### Q2: When bd children counts and on-disk files diverge, which wins?

User clarified before answering: "i think that the answer is that bd is the source of truth, and we need to raise an error when they diverge. im not sure all of the situations where this might come up, so we need to be alerted when it does"

### Q3 (reformulated to alert mechanism): How to alert when bd state diverges from on-disk files?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft alert: stderr + drift[] in data | Detect drift cases A/B/D/E. Emit drift[] entries + `[gsd-shadow] DRIFT:` stderr lines. Handler returns valid JSON; reads keep working. Parity test whitelists `drift` as bd-only. | ✓ |
| Hard fail: throw on drift | New BeadsDriftError sentinel. Bricks `/gsd-progress` on first drift case; one stale phase blocks all reads. | |
| stderr only, no JSON change | Human-only signal; agents reading stdout never see the alert. | |

**User's choice:** Soft alert: stderr + drift[] in data (Recommended)
**Notes:** User wants to be alerted to drift cases they don't yet know to expect; alert without bricking reads. Drift kinds detected: plan_count, summary_count, closed_without_summary, completed_phases_mismatch. Natural asymmetries (phase dir absent for open phase; CONTEXT/RESEARCH.md without bd children) do NOT alert.

---

## completed_phases

### Q1 (initial): How should `completed_phases` be computed?

User clarified before answering: "why cant we auto close with drift detection?"

**Claude's reformulation:** Investigated `scripts/cascade-loop.sh` — confirmed it already calls `bd epic close-eligible` over ALL epics (including phase epics) on every bd-sync hook. Auto-close is not a Phase 5 deliverable; it's existing v0.1 infrastructure. The two strategies layer naturally: cascade auto-closes for the steady state, drift detection (Area 2) catches the edge cases.

### Q2 (reformulated): Confirm derivation given cascade-loop already auto-closes.

| Option | Description | Selected |
|--------|-------------|----------|
| bd status=closed count + Area 2 drift detection | Honors ROADMAP SC #2 literally. Cascade-loop already closes phase epics. Drift mechanism reports `kind: 'completed_phases_mismatch'` on bd-vs-disk divergence. | ✓ |
| Same, plus add cascade-loop call as Phase 5 deliverable | Force convergence in test fixture. Redundant with seed-determinism.test.sh; risks hiding cascade-coverage bugs. | |
| Skip cascade trust; recompute eligibility per read | Duplicates cascade-loop logic in two languages; perf hit; contradicts v0.1 architecture. | |

**User's choice:** bd status=closed count + Area 2 drift detection (Recommended)

---

## milestones[]

### Q1: How to populate `milestones[]` and where does milestone heading come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from version: labels + bd memory key | One entry per distinct `version:vX.Y` label. Heading from `gsd-beads:milestone:<version>:heading` memory. Fallback to bare version. /gsd-beads-new-milestone writes the memory; build-seed.sh seeds for tests. | ✓ |
| Emit `[]` (defer to v0.3) | Architecture research recommendation. Loses fidelity vs upstream; consumers reading milestones[0].heading get undefined. | |
| Hybrid: version from bd, heading from regen'd ROADMAP.md | Couples read perf to disk + regen freshness; partly defeats bd-backed goal. | |

**User's choice:** Derive from version: labels + bd memory key (Recommended)

---

## Claude's Discretion

- **Heading string assembly format** — exact byte-for-byte match with upstream's milestonePattern capture; deferred to plan-phase
- **`drift[]` parity-helper API** — extending assertKeySetParity vs known-extensions list; deferred to plan-phase
- **`bd memories --json` invocation strategy** — separate call vs amortize through `bd export`; deferred to plan-phase
- **Decimal phase ordering** — numeric coercion + tie-break; deferred to plan-phase

## Deferred Ideas

- `/gsd-beads-new-milestone` skill that writes the milestone-heading memory (skill-side work; out of Phase 5)
- `/gsd-beads-add-phase` writing `phase-id:NN` labels (skill-side work; out of Phase 5)
- `regen-roadmap.sh` round-trip discipline for `phase-id:NN` labels (Phase 6 — shares parsing primitives)
- `BeadsDriftError` sentinel (rejected for Phase 5; introduce only when a future phase wants hard-fail-on-drift)
- Caching across handler invocations (no caching in v0.2 per Architecture research; revisit v0.3+)
- Refactor `isBeadsManaged()` to delegate to `findBeadsRoot()` (Phase 4 D-04; defer to v0.3+)
- `disambiguate-bd-managed-detection.md` todo (out of v0.2 entirely)
