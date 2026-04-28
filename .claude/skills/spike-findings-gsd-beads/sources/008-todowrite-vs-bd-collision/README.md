---
spike: 008
name: todowrite-vs-bd-collision
type: standard
validates: "Given Claude Code's built-in TodoWrite tool and bd's CLAUDE.md rule 'do NOT use TodoWrite, TaskCreate, or markdown TODO lists', when GSD skills (which declare TodoWrite as an available tool) run inside a beads-managed project, then a clear convention exists for when each is appropriate, and our PreToolUse hook does NOT block TodoWrite (it only blocks Edit/Write to state-bearing paths)."
verdict: VALIDATED
related: [001, 006]
tags: [gsd-ecosystem, todowrite, claude-code, bd-rules, in-session-vs-persistent]
---

# Spike 008: TodoWrite vs bd Collision

## What This Validates

bd's bundled CLAUDE.md says: *"Do NOT use TodoWrite, TaskCreate, or
markdown TODO lists."* GSD skills like `gsd-execute-phase` declare
`TodoWrite` as an available tool. Apparent conflict — resolved here.

## Findings

**Surface area is tiny:** Only **1 GSD file** declares TodoWrite as a tool:
`~/.claude/skills/gsd-execute-phase/SKILL.md`. (Other GSD skills use
TaskCreate, Task, etc., but TodoWrite specifically is rare.)

**Resolution: the two tools serve different purposes:**

| Tool | Scope | Persistence | Right use case |
|---|---|---|---|
| `TodoWrite` (Claude Code built-in) | This conversation | Lost when conversation ends | "Currently executing wave 2 of 3" — in-session progress display |
| `bd create / bd update` | Project | Survives across all sessions | "Refactor the auth module" — actual work item |

bd's "do NOT use TodoWrite" rule is aimed at **using TodoWrite as a
project-tracker** (storing real work items there, where they'd be lost).
For genuine in-session progress display, TodoWrite is correct. They
don't actually compete.

**Hook behavior:** Our PreToolUse(Edit|Write) hook from Spike 001 does
NOT match TodoWrite. TodoWrite writes to Claude Code's internal task
system, not to a file path — there's nothing to intercept. Confirmed by
inspecting the hook's matcher (`Edit|Write`).

**The carve-out, seeded as a `bd remember` memory at gsd-beads install time:**

```bash
bd remember --key gsd-beads:todowrite \
  "TodoWrite is allowed for in-session ephemeral progress tracking only. \
When the work survives this conversation — a bug to fix, a phase to \
implement, a feature to add — file it as a beads issue (bd create or \
/gsd-beads-add-todo). When it's 'track wave 2 of 3 progress while I \
execute this phase', TodoWrite is the right tool."
```

This is auto-surfaced via `bd prime` at SessionStart, so every session
in a beads-managed project sees the rule. (NOT a CLAUDE.md addendum —
that pattern was corrected during spike review; see Spike 002 Iteration 11
for the rationale.)

## Verdict

**VALIDATED ✓** — no actual technical conflict. Document the carve-out
via `bd remember --key gsd-beads:todowrite` at gsd-beads install time
and the issue resolves itself.
