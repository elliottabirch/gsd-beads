# Open research questions

## Q1: Adopt "Landing the Plane" verbatim or adapt?

Beads' `AGENT_INSTRUCTIONS.md` includes a "Landing the Plane" protocol for
agents to log discovered work and preserve context across handoffs. GSD has its
own discuss → plan → execute cadence that may or may not align with that
protocol. Investigate during Phase 2:

- Read beads' `AGENT_INSTRUCTIONS.md` in full
- Map each "Landing the Plane" step to a GSD lifecycle moment
- Decide:
  - (a) adopt verbatim
  - (b) write a GSD-flavored variant
  - (c) skip the protocol entirely and rely on `discovered-from` edges + bead
    body fields for context preservation

## Q2: Which upstream GSD agents write state-bearing markdown?

Inventory needed before Phase 2. Candidates known/suspected:

- `gsd-roadmapper` — writes ROADMAP.md
- `gsd-add-phase` — appends to ROADMAP.md
- `gsd-new-milestone` — modifies ROADMAP.md, MILESTONES.md
- `gsd-add-todo` — writes to `.planning/todos/`
- `gsd-plant-seed` — writes to `.planning/seeds/`
- `gsd-add-backlog` — writes to ROADMAP.md (backlog section)
- `gsd-insert-phase` — inserts a decimal phase into ROADMAP.md

Each needs a `/gsd-beads-*` substitute path. Do narrative-MD-writing agents
(`gsd-planner` writing PLAN.md, `gsd-phase-researcher` writing RESEARCH.md,
etc.) need any change at all? Default answer: no, but verify by reading their
prompts.

## Q3: Generated ROADMAP.md template fidelity

The generated ROADMAP.md must satisfy whatever readers GSD currently has —
agents like `gsd-progress`, `gsd-next`, `gsd-executor`, `gsd-roadmapper`'s
own checks, etc. parse it. What is the exact format contract?

Document by **reading the readers**, not guessing:

- Open every skill/agent that does `Read` or `Grep` on ROADMAP.md
- List every regex/parse expectation
- Build the template to satisfy all of them, with a fallback for
  unexpected fields

Same exercise for REQUIREMENTS.md, todos/, seeds/.

## Q4: Hook ordering and Claude Code's hook event semantics

Verify in the spike that `PreToolUse` hooks reliably block writes (exit code
non-zero → tool call rejected) and that `PostToolUse` hooks reliably fire
after every `Bash` call matching the regex. Specifically:

- Are hooks fired *before* the agent sees the tool result, or after?
- Can a `PreToolUse` block produce a structured error message the agent will
  read and react to?
- What happens if two hook handlers match the same event — order? race?

If hook semantics don't match the design assumptions, the determinism story
needs revision.

## Q5: Versioned `gsd-beads` releases and pinning

How does an installed `gsd-beads` know what version it's on, and how does it
detect drift between repo HEAD and what's symlinked into `~/.claude/`? Tag
strategy, VERSION file, install-time-pinning convention TBD during Phase 2.
