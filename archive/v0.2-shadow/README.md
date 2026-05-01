# Archive: v0.2 shadow architecture

This directory preserves the gsd-beads v0.2 implementation:
a runtime shadow over `gsd-sdk query` plus three blocking hooks
that prevented `.planning/*.md` files from being edited by hand.

The architecture had a hard ceiling: ~334 direct-I/O leaks across
upstream get-shit-done bypass the SDK entirely (workflows, agents,
fat skills using Read/Write/Edit). Plus a new leak class
(`<context>`-block frontmatter `@.planning/...` references) loads
files at skill-activation time, before any shadow can intercept.

See `.planning/DECISIONS.md` D-2026-04-30-01 for the pivot decision
and `.planning/research/fork-investigation/SYNTHESIS.md` for the
investigation that motivated it.

## What's here

- `bin/gsd-sdk-shadow.mjs` — the shadow binary
- `bin/wrap-mutation.mjs` — mutation event-stream wrapper (no-op in v0.2)
- `hooks/{block-gsd-sdk-mutation,block-state-md,bd-sync,worktree-post-checkout}.sh` — Claude Code hooks
- `scripts/{regen-roadmap,regen-requirements,regen-state,cascade-loop}.sh` — markdown regeneration + bd cascade-close
- `tests/shadow-tests/` — handler-level shadow tests (~26 archived)
- `tests/{e2e,hook-tests,install-tests,cross-worktree,worktree-tests}/` — installation + topology tests

## Carry-forward

Primitives that survived the pivot:
- `bd-helper.mjs` → `src/bd/helper.mjs`
- `beads-errors.mjs` → `src/bd/errors.mjs`
- `findBeadsRoot()` (extracted from `bin/gsd-sdk-shadow.mjs:237-282`) → `src/bd/findRoot.mjs`
- 4 helpers (parsePhaseId, deriveDiskStatus, detectDrift, loadMilestoneHeading) → `src/helpers/`

This archive is **not active code**. Do not link, import, or run
anything from this directory. It is preserved so:
- `git log --follow` works for the carry-forward primitives
- Future readers can study the shadow architecture's ceiling
- The 13 spike findings (bd modeling, hash-ID uniqueness, etc.)
  remain reproducible against the original code that demonstrated them
