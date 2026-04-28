`bd dolt push` is for federation/remote sync, NOT for local cross-worktree sync.
- Local cross-worktree: shared via BEADS_DIR (set per-worktree by the post-checkout shim). No bd dolt push needed.
- Federation across machines: bd federation feature (deferred for MVP).
Don't reflexively call bd dolt push after every cross-worktree change.
