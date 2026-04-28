---
title: Beads as GSD workflow layer — architecture decisions
date: 2026-04-27
context: /gsd-explore session on integrating beads into GSD
---

# Beads as GSD workflow layer

Architecture decisions reached during a `/gsd-explore` session on 2026-04-27.

## The problem

GSD keeps all workflow state in markdown. Five concrete pains:

1. Context gets lost mid-phase (long phases, multiple sessions)
2. No graph/dependency visualization
3. No sharing of state across git worktrees
4. Concurrent edits to markdown produce merge conflicts
5. No structural ordering or "what's next?" beyond manual `Depends on:` lines

## The candidate

Beads (https://github.com/steveyegge/beads), v1.0+. Findings vs. the five pains:

| Pain | Beads answer |
|---|---|
| Context loss mid-phase | **Solved** — beads is explicitly framed as "a coding agent memory system"; agents log discovered work with `discovered-from` provenance edges; `AGENT_INSTRUCTIONS.md` includes a "Landing the Plane" protocol. |
| No visualization | **Partial** — `bd ready` (unblocked work), `bd dep tree`, first-class dep types (`parent/child`, `blocks`, `relates-to`, `supersedes`, `duplicates`, `discovered-from`); no built-in critical-path graph. |
| Cross-worktree sharing | **Solved** — `BEADS_DIR` env var lets all worktrees point at one shared `.beads/` dir; server mode for concurrent multi-process access. |
| MD merge conflicts | **Solved** — Dolt cell-level auto-merge, hash-based IDs that don't collide across branches/agents, JSONL export for git-trackable text. |
| No ordering / direction | **Solved** — graph deps + `bd ready` + `bd batch` atomic ops. |

Yegge himself recommends **CLI + hooks over MCP** for Claude Code, which
matches GSD's existing skill+CLI model exactly.

## Architectural decisions

### Separation of concerns: beads owns state, MD owns narrative

| Concern | Lives in |
|---|---|
| Workflow state (requirements, phases, todos, seeds, deps) | Beads (source of truth) |
| Dependencies, ordering, "what's next?" | Beads (`bd ready`, dep edges) |
| Cross-worktree sharing | Shared `BEADS_DIR` |
| Conflict-free concurrent writes | Dolt cell-level merge + hash IDs |
| Git portability | JSONL export committed to repo |
| Narrative (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md) | Markdown |
| Bridge | Bead body holds `see PLAN.md path`; MD has bead ID annotations |

State-bearing markdown (ROADMAP.md, REQUIREMENTS.md, todos/, seeds/) becomes a
**generated, read-only view** of the bead store. Narrative markdown is
unaffected — it stays hand-authored and bead-unaware.

### Custom issue types: `requirement`, `phase`

Requirements are parent beads. Their children are phases. Phase children are
tasks. Auto-close cascade gives free progress visibility:

```
bd-a1b2  type: requirement   "REQ-042: Email/password auth"
├── bd-c3d4  type: phase     "Phase 12: Auth backend"
│   ├── bd-e5f6  type: task  "Password hashing"
│   ├── bd-g7h8  type: task  "Login endpoint"
│   └── bd-i9j0  type: task  "Session storage"
└── bd-k1l2  type: phase     "Phase 13: Auth UI"
    ├── bd-m3n4  type: task  "Login form"
    └── bd-o5p6  type: task  "Error states"
```

Bead body is short — typically just `see PLAN.md` or the canonical narrative
file. The MD remains the authored spec; the bead is the workflow handle.

### Layer alongside GSD, do not fork

| Model | Update cost |
|---|---|
| A. Fork GSD | Merge conflicts every release |
| B. Local patches (`/gsd-reapply-patches`) | Patches reapplied per update; breaks when patched lines move |
| **C. Layer alongside GSD** | **Zero — `/gsd-update` runs cleanly** |
| D. Upstream PR | Zero if accepted, otherwise fall back to A/B/C |

**Decision: Model C.** Build the integration as a layer of new skills + hooks
+ scripts that live outside GSD's source tree. GSD reads the same MD shapes it
always read; those MD files now happen to be regenerated from beads. GSD never
knows beads exists.

### Determinism layer: hooks + scripts, not skills

GSD's existing components have mixed determinism:

| Component | Deterministic? |
|---|---|
| Skills, agents (LLM-interpreted prompts) | No |
| `gsd-sdk` CLI, file conventions | Yes |
| `settings.json` hooks | Yes |
| Pre-commit hooks | Yes |

Skills give *guidance*; hooks give *guarantees*. The deterministic backbone of
the beads layer is hooks + scripts:

```
~/.claude/skills/gsd-beads-*/SKILL.md     ← user-facing entry points
~/.claude/scripts/bd-sync.sh              ← deterministic regeneration
~/.claude/settings.json hooks:
  PostToolUse(Bash, command~="^bd ")          → bd-sync.sh
  PreToolUse(Edit|Write, path=ROADMAP.md…)    → block + redirect
  PreToolUse(Read, path=ROADMAP.md…)          → bd-sync.sh (lazy regen)
```

Skills are convenience; hooks are load-bearing.

### Do not override upstream skills; add alongside

`/gsd-sync-skills` would resync managed upstream skills, undoing any override.
Solution: name new commands distinctly (`/gsd-beads-add-phase`, not
`/gsd-add-phase`). User invokes the new ones by habit.

Existing GSD agents that write state-bearing MD (`gsd-roadmapper`,
`gsd-add-phase`, `gsd-new-milestone`, etc.) are **not used in beads-managed
projects** — the `/gsd-beads-*` substitutes are the canonical path. Hooks
deterministically block accidental writes from those agents.

### No migration, no non-bd readers

- Existing GSD projects' `.planning/` is left as-is. Fresh start at the next
  new milestone.
- All readers of workflow state have `bd` available (single developer +
  Claude Code agents). No need for a generated REQUIREMENTS.md for
  GitHub/stakeholder consumption.

### Distribution: `~/code/gsd-beads/` as own repo

Decoupled from `windows-dev-setup` (OS-level) — this is application-level.
Versioned independently. Two distribution paths:

- **Path A (start here):** symlinks managed by `windows-dev-setup` (or a
  dedicated install script). Settings.json hook fragment merged at install
  time.
- **Path B (later, optional):** Claude Code plugin (the skill list already
  shows plugins like `code-review:*`, `visual-explainer:*`, so the
  infrastructure exists).

Updates to upstream GSD and updates to gsd-beads are independent timelines.

## What this gives the user

- `bd ready` answers "what should I work on next that advances any open
  requirement?"
- `bd dep tree REQ-042` renders the requirement's full work breakdown.
- Closing the last task auto-closes its phase, which auto-closes its
  requirement — progress visible without manual ROADMAP edits.
- An agent doing Phase 13 work that uncovers missed Phase 12 work creates
  `bd-newtask --discovered-from bd-k1l2 --parent bd-c3d4` — provenance
  preserved, no markdown surgery, no merge conflict.
- Agents share state across worktrees via shared `BEADS_DIR`.

## What's still open

- Adopt beads' "Landing the Plane" protocol verbatim, or adapt it to GSD's
  discuss/plan/execute rhythm? (See `research/questions.md`.)
- Which exact set of upstream GSD agents writes state-bearing MD, and what is
  the substitute path for each? (Inventory needed during Phase 2.)
- Specific shape of the generated ROADMAP.md template — must mirror GSD's
  reader expectations exactly (header structure, `Depends on:` line format,
  status markers).
