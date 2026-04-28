---
spike: 009
name: gsd-new-project-e2e
type: standard
validates: "Given /gsd-new-project as the canonical fresh-start flow (writes REQUIREMENTS.md + ROADMAP.md via gsd-roadmapper), when designing the /gsd-beads-new-project substitute, then we know exactly which steps stay native (PROJECT.md, research/, STATE.md), which translate to bd operations + regen (REQUIREMENTS.md, ROADMAP.md), and where the orchestration handoffs happen."
verdict: VALIDATED-WITH-DESIGN
related: [001, 002, 006, 007]
tags: [gsd-ecosystem, e2e, onboarding, substitute-design]
---

# Spike 009: /gsd-new-project End-to-End Design

## What This Validates

`/gsd-new-project` is the canonical fresh-start flow. It writes 6 files
and is one of the 13 BLOCKS items from Spike 006. This spike designs
the `/gsd-beads-new-project` substitute path.

## Source flow (reading `~/.claude/skills/gsd-new-project/SKILL.md`)

The skill creates 6 artifacts:

| Artifact | Type | Hook interaction |
|---|---|---|
| `.planning/PROJECT.md` | Narrative | UNAFFECTED |
| `.planning/config.json` | Workflow prefs | UNAFFECTED |
| `.planning/research/` | Narrative directory | UNAFFECTED |
| `.planning/REQUIREMENTS.md` | **STATE-BEARING** | BLOCKS |
| `.planning/ROADMAP.md` | **STATE-BEARING** | BLOCKS |
| `.planning/STATE.md` | Project memory | UNAFFECTED |

The state-bearing writes flow through `gsd-roadmapper` (the agent),
which is also a BLOCKS item.

## /gsd-beads-new-project substitute design

The substitute keeps the same UX (questioning → research → requirements
→ roadmap) but routes the state-bearing steps through bd:

```
1. Questioning + PROJECT.md write     ← unchanged (narrative)
2. config.json write                  ← unchanged
3. Optional research                  ← unchanged (narrative dir)
4. Requirements gathering (interactive question loop, AS BEFORE)
5. NEW: For each requirement, instead of appending to REQUIREMENTS.md:
     bd create --title "AUTH-01: User can sign up..." -t epic
     bd label add <id> gsd:requirement
     bd label add <id> req-id:AUTH-01
     bd label add <id> category:auth
     bd label add <id> version:v1
6. Roadmap derivation (questioning + categorization, AS BEFORE)
7. NEW: For each phase, instead of appending to ROADMAP.md:
     bd create --title "Phase 2: Authentication" -t epic
     bd label add <id> gsd:phase
     bd link <phase-id> <requirement-id> --type parent-child  (for each REQ in phase)
8. STATE.md write                     ← unchanged
9. NEW: Trigger bd-sync.sh to regenerate REQUIREMENTS.md and ROADMAP.md views
10. Commit                            ← unchanged but commit includes the regenerated views
```

**Orchestration handoffs:**

- Steps 1, 2, 3, 4, 6, 8, 10 are unchanged from upstream.
- Steps 5, 7, 9 are new bd-mediated steps.
- Step 4's questioning UI can stay the same — we just write the answers
  to bd instead of to a markdown file at the end.
- Step 9 (bd-sync.sh) is the same regen logic that runs after every
  `bd ` command via the PostToolUse hook from Spike 001.

## What blocks if a user runs the upstream `/gsd-new-project` directly

Without the substitute, here's what happens at each blocked step:

| Step | What happens |
|---|---|
| `Write` to `.planning/REQUIREMENTS.md` | PreToolUse(Edit\|Write) hook fires → `permissionDecision: "deny"` with redirect message: "Use /gsd-beads-add-phase, /gsd-beads-add-todo, ... or run `bd` directly." |
| `Write` to `.planning/ROADMAP.md` | Same hook fires → same redirect |
| Spawn of `gsd-roadmapper` agent | Agent attempts Write → same hook fires → agent receives the deny + reason |

The agent sees the redirect message, but as flagged in Spike 001's
findings, the reason is human-readable not a structured directive.
**An agent that hits this block partway through `/gsd-new-project` will
likely report the failure rather than retry through the substitute.**
That's why `/gsd-beads-new-project` must be the entry point users (and
agents) reach for in beads-managed projects.

## Vocabulary routing via bd memory

Persistent gsd-beads instructions live as bd memories (NOT a CLAUDE.md
addendum — see Spike 002 Iteration 11 for the rationale). gsd-beads'
install seeds the vocabulary memory:

```bash
bd remember --key gsd-beads:vocabulary "\
In beads-managed projects, prefer /gsd-beads-* over /gsd-* for any skill \
that creates/modifies workflow state:
  /gsd-beads-new-project       (instead of /gsd-new-project)
  /gsd-beads-add-phase         (instead of /gsd-add-phase)
  /gsd-beads-add-todo          (instead of /gsd-add-todo)
  /gsd-beads-add-backlog       (instead of /gsd-add-backlog)
  /gsd-beads-plant-seed        (instead of /gsd-plant-seed)
  /gsd-beads-new-milestone     (instead of /gsd-new-milestone)
  /gsd-beads-complete-milestone(instead of /gsd-complete-milestone)
  /gsd-beads-insert-phase      (instead of /gsd-insert-phase)
  /gsd-beads-review-backlog    (instead of /gsd-review-backlog)
  /gsd-beads-plan-milestone-gaps (instead of /gsd-plan-milestone-gaps)
  /gsd-beads-from-gsd2         (instead of /gsd-from-gsd2)
  /gsd-beads-check-todos       (instead of /gsd-check-todos)
  /gsd-beads-roadmapper        (instead of the gsd-roadmapper agent)

The legacy /gsd-* versions still exist; they're blocked from writing \
state-bearing markdown by hooks, but you'll get a friendlier experience \
using the -beads- versions directly."
```

Auto-surfaced every session via `bd prime`'s memories section. Idempotent
on re-install: `bd forget gsd-beads:vocabulary` first if reseeding.

## Verdict

**VALIDATED-WITH-DESIGN ✓**

The substitute path is concrete: 7 unchanged steps + 3 bd-mediated
steps. Total LOC for `/gsd-beads-new-project` is approximately
**3× the size** of `/gsd-new-project`'s SKILL.md (47 lines), since it
needs to spell out the bd operations and label conventions. Roughly
~150 lines of skill + workflow content.

**Open question for Phase 2 implementation:** the questioning UX in
the upstream skill spawns AskUserQuestion repeatedly. The substitute
needs to preserve this — easiest path is to keep the upstream's
questioning logic and only swap the "write at the end" step.

## How to Verify in Phase 2

Build the substitute, then run on a fixture project:
1. `cd /tmp/test-project && git init`
2. `bd init --non-interactive --skip-agents -p test`
3. `bd setup claude && bd hooks install`
4. `gsd-beads bootstrap` (installs gsd-beads layer hooks)
5. Run `/gsd-beads-new-project` end-to-end
6. Verify: PROJECT.md created (narrative), beads issues created with
   correct labels, regenerated REQUIREMENTS.md and ROADMAP.md match
   the format contract from Spike 007.
