gsd-beads vocabulary:

- Workflow state lives in beads (.beads/issues.jsonl auto-exported, git-tracked).
- State-bearing markdown (.planning/ROADMAP.md, REQUIREMENTS.md, todos/, seeds/) is REGENERATED from bd state by bd-sync.sh — DO NOT edit those files directly; the PreToolUse hook denies it.
- Narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md) is unaffected.
- Upstream /gsd-* commands (e.g., /gsd-add-phase, /gsd-add-todo) work transparently via the gsd-sdk shadow at ~/.local/bin/gsd-sdk in beads-managed projects.
- `bd ready` is the canonical "what should I work on next?" — replaces manual roadmap scanning (REQ-08).
