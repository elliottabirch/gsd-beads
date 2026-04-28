# gsd-beads

A layer that integrates [beads](https://github.com/steveyegge/beads) into the
Get Shit Done (GSD) workflow **without modifying GSD itself**.

Beads becomes the source of truth for workflow state (requirements, phases,
todos, seeds, dependencies). State-bearing GSD markdown files (ROADMAP.md,
REQUIREMENTS.md, todos/, seeds/) become generated read-only views of the bead
store. Narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md,
DISCUSSION-LOG.md) is unaffected.

Distributed via symlinks into `~/.claude/` (skills + scripts + hook fragments).
Updates to upstream GSD apply cleanly because GSD's source is never touched.

**Status:** design phase. See `.planning/notes/beads-gsd-architecture.md`.
