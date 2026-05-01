# gsd-beads Project Context

`gsd-beads` is the **BeadsAdapter** implementation of the StorageAdapter
interface defined by the get-shit-done fork at `~/code/get-shit-done`
(branch `feat/storage-adapter`). This is a sibling adapter library —
it has no skills, no hooks, and no install.sh; it is consumed by the
fork via `peerDependencies` resolution at runtime.

See `.planning/PROJECT.md` for the architectural pivot context (v0.2
shadow → v1.0 adapter library) and `.planning/research/fork-investigation/SYNTHESIS.md`
for the canonical adapter method catalog (~96 deduped methods, 8 cluster
boundaries, 6 foundational primitives).

## Source layout (v1.0)

- `src/adapter.mjs` — BeadsAdapter shell + cluster bindings
- `src/adapter/*.mjs` — eight cluster files (one per SYNTHESIS §4 cluster)
- `src/bd/{helper,errors,findRoot}.mjs` — bd CLI wrapping primitives
- `src/helpers/{parsePhaseId,deriveDiskStatus,detectDrift,loadMilestoneHeading}.mjs` — pure parsing helpers
- `src/format/phase.mjs` — bidirectional phase title/description parser

## Archived

`archive/v0.2-shadow/` contains the v0.2 shadow architecture (binary
override of `gsd-sdk query` plus three blocking hooks). Preserved for
historical reference; not active code. See `archive/v0.2-shadow/README.md`.

## Auto-loaded skills

- **Spike findings for gsd-beads** (validated patterns from 13 spike
  experiments — bd modeling, hash-ID uniqueness, JSONL determinism,
  cross-worktree topology) → `Skill("spike-findings-gsd-beads")`

The spike findings remain authoritative for bd-side conventions even
though the v0.2 shell scripts that demonstrated them have archived.
