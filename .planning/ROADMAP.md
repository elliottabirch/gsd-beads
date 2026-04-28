# Roadmap

## Milestone v0.1 — Foundation

### Phase 1: Spike — validate beads + GSD topology

Throwaway test of the architectural assumptions in
`notes/beads-gsd-architecture.md` before committing to the full layer. See
`notes/spike-validation-plan.md` for what it must validate.

**Status:** pending
**Depends on:** —

### Phase 2: Build the layer

The full skill + hook + script implementation. Gated on Phase 1 success.

**Status:** pending
**Depends on:** Phase 1

Subscope (subject to refinement during `/gsd-plan-phase`):

- New skills: `/gsd-beads-init`, `/gsd-beads-new-milestone`,
  `/gsd-beads-add-phase`, `/gsd-beads-add-todo`, `/gsd-beads-plant-seed`,
  `/gsd-beads-progress`, `/gsd-beads-execute-phase`, `/gsd-beads-ready`
- Scripts: `bd-sync.sh`, `bd-export-roadmap.sh`, `bd-export-requirements.sh`
- Hook fragment: `settings.fragment.json` with `PostToolUse` on `bd ` Bash +
  `PreToolUse` block on `Edit`/`Write` to state-bearing MD paths
- Install script: symlink + settings.json merge
- Substitute paths for upstream GSD agents that write state-bearing MD
  (`gsd-roadmapper`, `gsd-add-phase`, `gsd-new-milestone`, `gsd-add-todo`,
  `gsd-plant-seed`, `gsd-add-backlog`)

### Phase 3: Cross-worktree validation

Verify shared `BEADS_DIR` works across multiple worktrees in real use. Document
the recommended worktree setup.

**Status:** pending
**Depends on:** Phase 2
