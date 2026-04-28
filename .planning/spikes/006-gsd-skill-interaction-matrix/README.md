---
spike: 006
name: gsd-skill-interaction-matrix
type: standard
validates: "Given the full GSD skill + agent ecosystem (118 files: 85 skills + 33 agents), when each is classified by its interaction with state-bearing markdown paths (.planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/todos/**, .planning/seeds/**), then we know exactly which need /gsd-beads-* substitutes (BLOCKS), which need format-compatible regen (READS), and which are unaffected (MENTIONS)."
verdict: VALIDATED-WITH-FINDINGS (substitutes downgraded to OPTIONAL under Architecture Y1, Spike 013)
related: [001, 002]
tags: [gsd-ecosystem, hooks, skill-inventory, substitution-list, scope-expansion]
---

# Spike 006: GSD Skill Interaction Matrix

## What This Validates

**Given** the full GSD skill + agent ecosystem (118 files total: 85 skills
in `~/.claude/skills/gsd-*/`, 33 agents in `~/.claude/agents/gsd-*.md`),
**when** each is classified by whether it WRITES, READS, or MENTIONS
state-bearing markdown paths (`.planning/ROADMAP.md`,
`.planning/REQUIREMENTS.md`, `.planning/todos/**`, `.planning/seeds/**`),
**then** we know exactly which need `/gsd-beads-*` substitutes (BLOCKS — hit
the PreToolUse hook from Spike 001), which need format-compatible regen
(READS — input to Spike 007), and which are unaffected (MENTIONS).

This spike answers `research/questions.md` Q2 ("Which upstream GSD agents
write state-bearing markdown? Inventory needed before Phase 2") and
fundamentally constrains gsd-beads' Phase 2 scope.

## Research

`grep -rl 'ROADMAP.md|REQUIREMENTS.md|.planning/todos|.planning/seeds'`
across `~/.claude/skills/gsd-*` and `~/.claude/agents/gsd-*.md` found
**33 files** with any reference. The Explore agent then read each in
detail and classified by:

- **W (Write):** Has the Write or Edit tool declared and invokes it on a
  state-bearing path, OR invokes a Bash command that does.
- **R (Read):** Has the Read or Grep tool declared and invokes it on a
  state-bearing path.
- **M (Mention):** References the path in prose only — describes
  workflow, doesn't programmatically touch the file.
- **-** : No reference at all (the file appears in the original grep
  for some other reason, e.g., its description mentions the workflow
  abstractly).

## The Matrix

### BLOCKS — 13 skills/agents (substitutes OPTIONAL under Y1)

**Note (post-Spike 013):** With Architecture Y1 (shadow gsd-sdk binary)
adopted, these 13 upstream skills work TRANSPARENTLY in beads-managed
projects — their `gsd-sdk query` calls route through our shadow to
bd-backed handlers. Substitutes are no longer load-bearing; they could
be retained as explicit-aliases (`/gsd-beads-add-phase` runs the same
flow but is explicit about the backend) but the upstream skill names
work too. The matrix below remains useful as a reference of what
mutation commands each skill performs, which informs the Y1 shadow's
handler set.



These hit our PreToolUse(Edit|Write) hook from Spike 001 and would be
denied with our redirect message. Each needs a substitute that mutates
the bead store first, then triggers regeneration.

| File | Type | Writes to |
|---|---|---|
| `gsd-roadmapper` | agent | ROADMAP.md + REQUIREMENTS.md |
| `gsd-new-project` | skill | ROADMAP.md + REQUIREMENTS.md (spawns roadmapper) |
| `gsd-new-milestone` | skill | ROADMAP.md + REQUIREMENTS.md |
| `gsd-complete-milestone` | skill | ROADMAP.md + REQUIREMENTS.md |
| `gsd-add-phase` | skill | ROADMAP.md |
| `gsd-add-backlog` | skill | ROADMAP.md (Backlog section) |
| `gsd-insert-phase` | skill | ROADMAP.md (decimal phase) |
| `gsd-review-backlog` | skill | ROADMAP.md (Backlog → active) |
| `gsd-plan-milestone-gaps` | skill | ROADMAP.md |
| `gsd-from-gsd2` | skill | ROADMAP.md (migration) |
| `gsd-add-todo` | skill | `.planning/todos/` |
| `gsd-check-todos` | skill | `.planning/todos/` (R+W) |
| `gsd-plant-seed` | skill | `.planning/seeds/` |

### READS — ~17 skills/agents (need regen-format-compatible views)

These will read the regenerated `.planning/ROADMAP.md` etc. Their parse
expectations dictate the regeneration template — Spike 007's job to
extract the exact contract.

| File | Type | Reads |
|---|---|---|
| `gsd-progress` | skill | ROADMAP.md, STATE.md |
| `gsd-next` | skill | ROADMAP.md, STATE.md |
| `gsd-manager` | skill | ROADMAP.md, STATE.md |
| `gsd-spec-phase` | skill | ROADMAP.md, REQUIREMENTS.md |
| `gsd-discuss-phase` | skill | REQUIREMENTS.md |
| `gsd-add-tests` | skill | ROADMAP.md, REQUIREMENTS.md |
| `gsd-analyze-dependencies` | skill | ROADMAP.md |
| `gsd-autonomous` | skill | ROADMAP.md, REQUIREMENTS.md |
| `gsd-forensics` | skill | ROADMAP.md |
| `gsd-milestone-summary` | skill | ROADMAP.md, REQUIREMENTS.md |
| `gsd-roadmapper` | agent | (also reads — for incremental updates) |
| `gsd-planner` | agent | REQUIREMENTS.md, ROADMAP.md |
| `gsd-plan-checker` | agent | ROADMAP.md, REQUIREMENTS.md |
| `gsd-phase-researcher` | agent | ROADMAP.md, REQUIREMENTS.md |
| `gsd-domain-researcher` | agent | ROADMAP.md, REQUIREMENTS.md |
| `gsd-ui-researcher` | agent | ROADMAP.md, REQUIREMENTS.md |
| `gsd-verifier` | agent | ROADMAP.md, REQUIREMENTS.md |
| `gsd-eval-planner` | agent | ROADMAP.md, REQUIREMENTS.md |
| `gsd-assumptions-analyzer` | agent | REQUIREMENTS.md |
| `gsd-code-reviewer` | agent | ROADMAP.md, REQUIREMENTS.md |

### MENTIONS — 6 skills/agents (informational, no action)

`gsd-doc-classifier`, `gsd-doc-synthesizer`, `gsd-doc-writer`,
`gsd-ingest-docs`, `gsd-quick`, `gsd-executor` — reference state-bearing
paths in prose (workflow description) but never programmatically touch
them. No action needed.

## How to Run

The classification is sourced from a structured Explore-agent pass over
the 33 files. To verify a row:

```bash
grep -nE 'Edit|Write' ~/.claude/agents/gsd-roadmapper.md | head -10
grep -nE 'ROADMAP\.md|REQUIREMENTS\.md' ~/.claude/agents/gsd-roadmapper.md | head -10
# Look for a "tools:" frontmatter line listing Write/Edit, plus body usage
```

## Investigation Trail

**Iteration 1 — locate the inventory.**
`ls ~/.claude/skills/ | wc -l` = 85 skills (gsd-*). `ls ~/.claude/agents/`
= 33 agents (gsd-*). Total 118 files.

**Iteration 2 — narrow to state-bearing references.**
`grep -rlE 'ROADMAP\.md|REQUIREMENTS\.md|\.planning/todos|\.planning/seeds'`
across both directories returned **33 files**. About 28% of the GSD
ecosystem touches state-bearing paths in some way.

**Iteration 3 — classify each via Explore agent.**
The agent read each of the 33 files (frontmatter + prose + tool
declarations) and produced a per-file classification. The matrix above
is the result.

**Iteration 4 — recognize the scope expansion.**
The architecture doc (`notes/beads-gsd-architecture.md`) anticipated
**8** `/gsd-beads-*` substitutes. The actual count is **13**:

| Architecture doc | Discovered |
|---|---|
| `/gsd-beads-init` | (still needed for first-time setup) |
| `/gsd-beads-add-phase` | ✓ matches `gsd-add-phase` |
| `/gsd-beads-new-milestone` | ✓ matches `gsd-new-milestone` |
| `/gsd-beads-add-todo` | ✓ matches `gsd-add-todo` |
| `/gsd-beads-plant-seed` | ✓ matches `gsd-plant-seed` |
| `/gsd-beads-progress` | (READS only — could potentially skip substitute) |
| `/gsd-beads-execute-phase` | (gsd-executor MENTIONS, doesn't write — could skip substitute) |
| `/gsd-beads-ready` | (new — `bd ready` wrapper) |
| **NEW: `/gsd-beads-roadmapper`** | (the agent that does the heavy lifting in /gsd-new-project + /gsd-new-milestone) |
| **NEW: `/gsd-beads-new-project`** | (canonical fresh-start flow) |
| **NEW: `/gsd-beads-add-backlog`** | (writes to ROADMAP backlog section) |
| **NEW: `/gsd-beads-insert-phase`** | (decimal phase insertion) |
| **NEW: `/gsd-beads-review-backlog`** | (promote backlog to active) |
| **NEW: `/gsd-beads-plan-milestone-gaps`** | (gap-fill phase creation) |
| **NEW: `/gsd-beads-complete-milestone`** | (milestone archival) |
| **NEW: `/gsd-beads-from-gsd2`** | (migration from old format) |
| **NEW: `/gsd-beads-check-todos`** | (also writes — needs substitute) |

**Iteration 5 — recognize the dual-write problem.**
Four skills write to BOTH ROADMAP.md AND REQUIREMENTS.md in a single
flow:
- `gsd-new-project`
- `gsd-new-milestone`
- `gsd-complete-milestone`
- `gsd-roadmapper` (the agent)

These substitutes need to perform paired bd operations + paired regens.
The architecture's `bd-sync.sh` from Spike 001 handles regen, but it
needs to know that some skills produce changes to multiple state-bearing
files in one bd transaction.

## Results

**Verdict: VALIDATED-WITH-FINDINGS ✓**

The inventory is complete. The matrix produces a concrete Phase 2 scope
that is ~62% larger than the architecture doc anticipated (13
substitutes vs the doc's 8).

**Concrete validations:**

1. **13 skills/agents BLOCK and need `/gsd-beads-*` substitutes.**
   Listed exhaustively above with the specific path each writes to.
2. **~17 skills/agents READ state-bearing paths.** Their format
   expectations are the input to Spike 007.
3. **6 skills MENTION but don't act.** No action needed.
4. **Four substitutes are dual-writers** (REQUIREMENTS + ROADMAP in
   one flow) — design implication for `bd-sync.sh` regen ordering.
5. **`gsd-progress` and `gsd-next` are READ-only.** The architecture's
   anticipated `/gsd-beads-progress` could potentially be skipped — these
   work as-is on the regenerated ROADMAP.md.

**Surprises:**

- **`gsd-roadmapper` is an agent, not a skill.** That means we can't
  intercept it with a `/gsd-` skill replacement. The substitute path is
  either (a) a `/gsd-beads-roadmapper`-skill that orchestrates the bd
  operations + regen, called by our `/gsd-beads-new-project` and
  `/gsd-beads-new-milestone` skills, OR (b) make `gsd-roadmapper` itself
  bd-aware via in-prompt detection (Spike 010's territory).

- **`gsd-from-gsd2` writes ROADMAP.md.** This skill exists for migrating
  GSD-2 (`.gsd/`) projects back to GSD v1 (`.planning/`). For
  gsd-beads-managed projects, it would need a corresponding migration
  path — or be flagged as "not supported in beads-managed projects."

- **`gsd-check-todos` BOTH reads and writes** — confirmed by the
  classification. So its substitute is more involved than just a
  read-only progress display: it also marks todos as picked up.

- **READS surface area is meaningful (~17 files).** Spike 007's
  format-contract investigation needs to actually read each of those
  files' parse expectations (regex, line-counting, tag-matching) and
  cross-reference against any single regenerated template. That's a
  ~17-file analysis.

**Impact on remaining spikes:**

- **Spike 007 (reader format contract):** input list is the 17 READS
  rows. Read each one's parse logic. Build a unified regen template
  that satisfies all of them.
- **Spike 008 (TodoWrite collision):** orthogonal — TodoWrite is the
  Claude Code built-in tool, not a GSD skill. Proceed independently.
- **Spike 009 (gsd-new-project E2E):** focus on `gsd-new-project` (the
  most complex BLOCK case — spawns gsd-roadmapper, dual-writes
  ROADMAP+REQUIREMENTS, runs in a fresh fixture). Tests the full
  substitute path under realistic load.
- **Spike 010 (bd-aware GSD agents):** investigate whether
  `gsd-roadmapper` agent could be made bd-aware via in-prompt
  detection — would let us avoid one of the 13 substitutes.
- **Spike 011 (gsd-spike-wrap-up self-test):** quick sanity check; not
  on the matrix because it doesn't write to state-bearing paths.

**Phase 2 scope implications:**

| Architecture doc | Reality |
|---|---|
| 8 `/gsd-beads-*` substitutes | **13** |
| Single-write substitutes only | **4 dual-writers** (req+roadmap) |
| READ-side regeneration template "TBD" | **17 readers** to cross-reference |

The expanded scope is real but tractable. Each substitute is small
(thin wrapper around `bd` + `bd-sync.sh`), so the line count is modest.
The cognitive load is the orchestration story — particularly for
dual-writers.

## Files

- This README
- The matrix above is the canonical artifact (no separate JSON yet —
  could be extracted to `matrix.json` for tooling in Phase 2)
