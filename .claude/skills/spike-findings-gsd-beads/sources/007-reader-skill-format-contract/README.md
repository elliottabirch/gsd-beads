---
spike: 007
name: reader-skill-format-contract
type: standard
validates: "Given the 17 GSD readers identified in Spike 006, when their parse expectations are extracted from the GSD templates and skill prompts, then we have a complete format contract that gsd-beads' regen scripts must satisfy — and a clear list of beads schema extensions needed to encode the fields beads doesn't natively model."
verdict: VALIDATED-WITH-DESIGN-IMPLICATIONS
related: [002, 006]
tags: [gsd-ecosystem, regen, format-contract, schema-extensions]
---

# Spike 007: Reader Skill Format Contract

## What This Validates

**Given** the 17 GSD readers identified in Spike 006 plus the canonical
GSD templates at `~/.claude/get-shit-done/templates/roadmap.md` and
`requirements.md`,
**when** their parse expectations are extracted,
**then** we have the format contract gsd-beads' regen scripts must
satisfy, plus the list of beads schema extensions needed to encode
fields beads doesn't natively model.

## ROADMAP.md format contract

Source: `~/.claude/get-shit-done/templates/roadmap.md` + reader
expectations cross-referenced.

| Element | Required by | Beads source |
|---|---|---|
| `# Roadmap: <Project>` | All readers | Project metadata (PROJECT.md or `bd config get project.name`) |
| `## Overview` paragraph | gsd-progress, gsd-next | PROJECT.md (narrative — unaffected) |
| Phase summary list `- [ ] **Phase N: Name** - desc` | gsd-progress, gsd-next, gsd-manager | beads with `type=epic + label gsd:phase`, sorted by priority |
| `### Phase N: Name` headers | gsd-roadmapper, planner, plan-checker | each phase bead's title |
| `**Goal**: ...` | gsd-planner, plan-checker, verifier | **NEW — needs schema extension**: `gsd-goal:<phase-id>` memory bead OR description first paragraph convention |
| `**Depends on**: ...` | gsd-analyze-dependencies, planner | beads' "blocks" relationships rendered as phase numbers |
| `**Requirements**: [REQ-01, REQ-02]` | planner, verifier, eval-planner | parent-child upward to `gsd:requirement` epics, mapped to their `req-id:` labels |
| `**Success Criteria** (what must be TRUE):` | verifier, plan-checker, eval-planner | **NEW — schema extension**: structured `notes` field with parsed bullets, OR memory bead per phase |
| `**Plans**: N plans / TBD` | gsd-progress, gsd-next | child task count |
| Plans list `- [ ] NN-NN: desc` | gsd-progress, gsd-next | child tasks of the phase, indexed |
| `## Progress` table | gsd-progress, gsd-manager | aggregated child-status counts |
| Phase status: `Not started \| In progress \| Complete \| Deferred` | gsd-progress, gsd-next | derived from bead status (open/in_progress/closed/deferred) |
| Decimal phase numbering `Phase 2.1` (INSERTED) | gsd-insert-phase, all readers | priority + bead-creation-order convention |
| Milestone groupings `<details>` | gsd-progress, gsd-milestone-summary | label `milestone:v1.0`, `milestone:v1.1`, etc. |

## REQUIREMENTS.md format contract

Source: `~/.claude/get-shit-done/templates/requirements.md`.

| Element | Required by | Beads source |
|---|---|---|
| `# Requirements: <Project>` | All readers | Project metadata |
| `**Defined:** <date>` / `**Core Value:** <text>` | gsd-domain-researcher | PROJECT.md (narrative) |
| `## v1 Requirements` / `## v2 Requirements` | gsd-roadmapper, ui-researcher | **NEW**: label `version:v1` / `version:v2` |
| `### <Category>` (e.g., Authentication, Content) | gsd-roadmapper | **NEW**: label `category:auth`, `category:content` |
| `- [ ] **AUTH-01**: User can ...` | All req-readers | bead title format `AUTH-01: User can ...` + label `req-id:AUTH-01` |
| `## Out of Scope` table | gsd-domain-researcher | beads with `status=closed`, `close_reason="out-of-scope"`, label `gsd:requirement` |
| `## Traceability` table | gsd-roadmapper, planner | parent-child between `gsd:requirement` epics and `gsd:phase` epics |
| Coverage summary | gsd-roadmapper | aggregated count from traceability |

## Schema extensions needed

To encode the format contract above, gsd-beads' bead model needs to
extend Spike 002's "all-epic + gsd:requirement / gsd:phase" baseline
with additional convention labels and content fields:

### Convention labels

| Purpose | Label format | Examples |
|---|---|---|
| Hierarchical role | `gsd:requirement`, `gsd:phase`, `gsd:seed`, `gsd:todo` | `gsd:requirement` |
| Requirement ID | `req-id:<id>` | `req-id:AUTH-01` |
| Category | `category:<slug>` | `category:auth`, `category:content` |
| Version (v1/v2/scope) | `version:<v>` | `version:v1`, `version:v2`, `version:out-of-scope` |
| Milestone | `milestone:<id>` | `milestone:v1.0`, `milestone:v1.1` |
| Phase decimal-insertion marker | `inserted` | `inserted` (true if priority+ordering won't cleanly produce 2.1) |

### Content fields

`Goal` and `Success Criteria` aren't first-class on a beads issue. Two
options for storing them:

**Option A — convention-based fields in `description`:**
```
Goal: Users can securely access their accounts
Success Criteria:
  1. User can log in with email + password
  2. Session persists across browser refresh
```
Regen parses these from `description` content. Works with bd's existing
schema; no extension needed. Slightly fragile (free-text format).

**Option B — separate "memory" beads keyed by phase ID:**
- `bd remember --key "goal:<phase-id>" "Users can securely access..."`
- `bd remember --key "success-criteria:<phase-id>" "1. User can ...\n2. ..."`

Memories are bd-native, structured, queryable. But they're per-account,
not per-bead, and `bd memories` is a separate listing.

**Recommendation:** **Option A** for simplicity. Define the parsing
convention in `bd-sync.sh`'s extractor; document it as a gsd-beads
description-format requirement.

### Beads commands needed for regen

The regen script invokes:
```bash
# Pull all phase beads with metadata
bd list --type=epic -l gsd:phase --status=all -n 0 --json

# Each phase's children (tasks)
bd children <phase-id> --json

# Each phase's requirements (parent-child upward)
bd show <phase-id> --json | jq '.[0].dependencies[] | select(.dependency_type=="parent-child")'

# All requirements for the REQUIREMENTS.md regen
bd list --type=epic -l gsd:requirement --status=all -n 0 --json
```

All of these are existing bd commands — no upstream feature required.

## Reader-by-reader format expectations

For each of the 17 readers from Spike 006, the parse expectations boil
down to:

| Reader | Critical parse element | Fragility |
|---|---|---|
| gsd-progress | Status column in Progress table; checkbox state on plans | High (table column-order matters) |
| gsd-next | "Not started" / "In progress" status text; phase numeric ordering | Medium (relies on status values) |
| gsd-manager | Phase summary list + Progress table | Medium |
| gsd-spec-phase | Phase header + Goal + Requirements lines | Low (loose match) |
| gsd-discuss-phase | Requirements line in phase | Low |
| gsd-add-tests | Phase Goal + Success Criteria | Low |
| gsd-analyze-dependencies | `**Depends on**:` line per phase | Medium (exact label needed) |
| gsd-autonomous | Status column + checkbox states | Medium |
| gsd-forensics | All of the above (post-mortem) | Variable |
| gsd-milestone-summary | Milestone grouping `<details>` tags | High (tag-aware parser) |
| gsd-planner | Goal + Success Criteria + Requirements | Low |
| gsd-plan-checker | Same as planner | Low |
| gsd-phase-researcher | Goal + scope context | Low |
| gsd-domain-researcher | Categories + Core Value | Low |
| gsd-ui-researcher | Same | Low |
| gsd-verifier | Success Criteria checkbox state | Medium |
| gsd-eval-planner | Phase Goal + Requirements | Low |
| gsd-assumptions-analyzer | Requirements list | Low |
| gsd-code-reviewer | Phase scope + Requirements | Low |

The most fragile readers are `gsd-progress` and `gsd-milestone-summary`
— they depend on table-column-order and `<details>` tag presence
respectively. Regen tests should focus on these.

## Investigation Trail

Read both templates in full. Identified each labeled element. Mapped
each to a beads source where possible; flagged the "Goal" and "Success
Criteria" fields as not natively-modeled. Surveyed the 17 readers for
specific regex/parse markers. Produced the schema extension table.

## Results

**Verdict: VALIDATED-WITH-DESIGN-IMPLICATIONS ✓**

The format contract is extractable and achievable. The regen scripts
need to:
1. Implement the per-element mappings in the table above.
2. Apply the schema extensions: convention labels + description-format
   parsing for Goal / Success Criteria.
3. Be tested specifically against `gsd-progress` and
   `gsd-milestone-summary` (the fragility hotspots).

**Findings carry-forward to Phase 2:**

- `bd-sync.sh` regen has 2 sub-scripts: `regen-roadmap.sh` and
  `regen-requirements.sh`. They share helpers but produce different
  files.
- The schema extension labels (`req-id:`, `category:`, `version:`,
  `milestone:`) need a documented standard in the gsd-beads CLAUDE.md
  addendum so agents apply them consistently.
- Goal / Success Criteria parsing convention should be a single
  function in `bd-sync.sh`, with clear extraction rules (e.g., look
  for `Goal:` line, treat next paragraph as content).

## Files

- This README (the format contract IS the artifact; no script written)
