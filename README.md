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

## Multi-worktree setup

gsd-beads supports git worktrees natively. After
`git clone && ./install.sh`, run `git worktree add` from the source
repo and the new worktree auto-configures to share the source repo's
bead store. No env-var dance, no manual `bd` reconfig.

See [docs/WORKTREES.md](docs/WORKTREES.md) for the full setup
walkthrough, lifecycle ops (`git worktree remove`, reactivating an
old path), and troubleshooting (4 documented failure modes with
one-line recoveries).

macOS users: `brew install flock` is required.

**Status:** Phase 2 shipped (13/13 verified, 2026-04-28). Phase 3 (cross-worktree validation) in progress.
