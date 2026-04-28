State-bearing paths (denied by PreToolUse(Edit|Write) hook block-state-md.sh):
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- .planning/todos/**
- .planning/seeds/**

Both absolute and relative path shapes are denied. To mutate state, run upstream /gsd-* commands (they route through the shadow into beads) or use bd directly. After a state-changing bd command, bd-sync.sh regenerates the markdown views.
