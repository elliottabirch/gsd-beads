# Requirements

## REQ-01: Beads is source of truth for workflow state

State-bearing artifacts (requirements, phases, todos, seeds, dependencies)
live in the bead store. Markdown views of these are read-only and regenerated
deterministically.

## REQ-02: GSD core is unmodified

No file under `~/.claude/get-shit-done/` is edited. `/gsd-update` runs cleanly
without local-patch reapplication.

## REQ-03: Cross-worktree state sharing

A shared `BEADS_DIR` (or equivalent) lets multiple git worktrees of the same
project see the same workflow state.

## REQ-04: Deterministic write-path enforcement

Hooks deterministically prevent state-bearing markdown from being edited by
hand. Writes go through `/gsd-beads-*` skills, which mutate beads first and
trigger regeneration of the markdown view.

## REQ-05: Conflict-free concurrent updates

Two agents (or two worktrees) updating workflow state simultaneously merge
without conflict, via Dolt cell-level merge + hash-based IDs.

## REQ-06: Versioned, installable distribution

`gsd-beads` is a git-versioned repo with a single install script that
symlinks/merges into `~/.claude/` on a fresh machine. No manual setup steps.

## REQ-07: Narrative markdown untouched

PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md, and other
narrative files behave exactly as in vanilla GSD. No interception, no
regeneration.

## REQ-08: Ready-set query is the canonical "what's next"

`bd ready` (or a `/gsd-beads-ready` wrapper) is the single source for "what
work is currently unblocked," replacing manual roadmap scanning.
