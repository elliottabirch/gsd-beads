Beads modeling for gsd-beads (per Spike 002):
- Both requirement-level and phase-level beads use type=epic, distinguished by labels:
  - gsd:requirement for top-level requirements
  - gsd:phase for middle-level phases
- Tasks use the built-in type=task.
- Cascade closure is `bd epic close-eligible` in a 5-line loop (cascade-loop.sh) — 3× faster than custom-types alternative.
- DO NOT use custom types `requirement`/`phase` — rejected in Spike 002.
