---
created: 2026-04-29
title: Disambiguate "bd-managed project" detection from "project hosts bd vocabulary"
area: shadow, hooks
resolves_phase: 6
files:
  - bin/gsd-sdk-shadow.mjs
  - hooks/block-state-md.sh
  - hooks/block-gsd-sdk-mutation.sh
  - hooks/bd-sync.sh
---

> **Resolution note (2026-04-30):** v1.0 Phase 6 archives the shadow code
> and all three offending hooks (`block-state-md.sh`,
> `block-gsd-sdk-mutation.sh`, `bd-sync.sh`) into `archive/v0.2-shadow/`,
> which makes this self-targeting issue moot in this repo. The conceptual
> disambiguation work — "bd-managed project" vs "project hosts bd
> vocabulary" — moves to the BeadsAdapter `init()` step (CAP-01 / Phase 7),
> where the adapter validates bd state and gracefully degrades when no
> bd-tracked issues exist. Closing once Phase 6 ships.

## Problem

`isBeadsManaged(projectDir)` (`bin/gsd-sdk-shadow.mjs:233`) detects bd-managed
projects by the existence of `.beads/metadata.json`. The hook layer
(`block-state-md.sh`, `block-gsd-sdk-mutation.sh`, `bd-sync.sh`) uses the same
condition. This is too coarse: gsd-beads itself ships `.beads/` populated with
9 project-vocabulary memories (`gsd-beads:link-default`, `gsd-beads:type-strategy`,
`gsd-beads:vocabulary`, `gsd-beads:state-paths`, etc.) intended for downstream
consumption — but it has 0 issues and uses markdown for its own workflow state.

The mismatch causes:

- `block-state-md.sh` defends `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md`
  / `.planning/todos/**` against direct edits, claiming they're regenerated
  from beads — but bd has nothing to regenerate from. Workflow scripts
  (`/gsd-new-milestone`, `/gsd-new-project`) trip the hook and require the
  user (or Claude) to bypass it via `mv` or by disabling the hook.
- `block-gsd-sdk-mutation.sh` rejects mutations (`phases.clear`, etc.) on the
  same false-positive grounds.
- `bd-sync.sh` runs `regen-roadmap.sh` / `regen-requirements.sh` against an
  empty bd store and clobbers hand-authored markdown content.
  (Reproduced during v0.2 milestone setup on 2026-04-29 — research agents
  invoked something that triggered bd-sync, wiping ROADMAP.md and
  REQUIREMENTS.md back to empty regen output. Restored from `git HEAD`.)

The 9 memories in `.beads/` are intentional content that gsd-beads provides;
they are not workflow state. The hooks should not be self-targeting because
of them.

## Solution

Two coherent options:

1. **Tighten the guard.** Change `isBeadsManaged()` and the three hook
   scripts to require both `.beads/metadata.json` AND one of:
   - `bd count --status=all` returns ≥1 issue, OR
   - an explicit sentinel file exists (e.g., `.beads/.gsd-managed`).

   This lets any project keep bd-vocabulary-as-content (memories, recipes,
   etc.) without triggering self-management. Symmetric with how the v0.1
   detection refactor (commit `b51abbc`) tightened the guard from "blanket
   `.beads/`" to "`.beads/metadata.json` exists" — this is the next
   tightening pass.

2. **Move the vocabulary out of `.beads/`.** Store the 9 memories as data
   files under `data/seed-memories/` (or similar), have `install.sh` read
   them at install time and seed downstream projects' `.beads/` from there.
   gsd-beads itself then has no `.beads/`. Cleaner structurally but loses
   the "developer can bd-query gsd-beads's own conventions during dev"
   property.

Recommend option 1 — single-line guard tightening, preserves dev ergonomics,
generalizes to "any project that hosts bd content but isn't self-managed."

## Acceptance criteria

- gsd-beads can run `/gsd-new-milestone` without `Edit`/`Write` hooks blocking
  PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md edits.
- Bypassing the hooks via `mv` is no longer needed for any workflow that
  builds markdown directly.
- Downstream projects that DO have bd-tracked issues still get the protection
  (existing tests pass).
- `bd-sync.sh` does NOT clobber hand-authored markdown when bd has no
  matching state.

## Notes

Surfaced during v0.2 milestone setup (2026-04-29) when the
`block-gsd-sdk-mutation` hook blocked `phases.clear` and the `block-state-md`
hook required `mv`-via-Bash to write `.planning/REQUIREMENTS.md`. User
explicitly noted "gsd-beads probably shouldn't be managed by gsd-beads."
This todo captures the gap so v0.2 milestone work can continue with the
markdown-managed convention.
