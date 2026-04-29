gsd-beads + git worktrees:

What works automatically:

- `git worktree add <path> -b <branch>` auto-configures the new worktree to share the source repo's bead store. The post-checkout hook persists `git config --worktree gsd-beads.dir=<source>/.beads` and writes a marker at `<wt-gitdir>/info/.gsd-beads-configured`.
- All worktrees see the same bd state — no manual sync, no `BEADS_DIR` env var required after the auto-config. `bd q`, `bd list`, `bd close` from any worktree read/write the same `<source>/.beads/` store.
- Pre-existing worktrees on first install are backfilled by `install.sh` Step 6.5: `git worktree list --porcelain` enumerates them, the shim is fired against each, and the marker-gate keeps re-runs idempotent.
- Concurrent regens from multiple worktrees are serialized via `flock -x -w 30` on `<source>/.beads/.gsd-beads.lock`. Covered scripts: `cascade-loop.sh`, `regen-roadmap.sh`, `regen-requirements.sh`. On lock timeout the script exits non-zero with `[gsd-beads] another regen is in progress at <lock> — retry shortly`; bd-sync.sh continues fail-soft via its `|| true` chain.

Lifecycle ops:

- `git worktree remove <path>` requires no gsd-beads-side cleanup; git deletes the per-worktree config + marker inside `.git/worktrees/<name>/` automatically. Run `git worktree prune` afterwards to clear any orphaned `.git/worktrees/<name>/` housekeeping entries from dirty/aborted removes.
- Reactivating an old worktree path: when `git worktree add` reuses a path whose previous gitdir was removed, the post-checkout shim fires and the marker-gate reconfigures from scratch — no manual intervention.

Install + recovery:

- macOS: `brew install flock` is required (the discoteq port is util-linux flag-compatible). install.sh's pre-flight blocks install with the same hint if flock is missing.
- Recovery if the source repo is renamed: from EACH affected worktree run `git config --worktree gsd-beads.dir <new-source-path>/.beads`. There is no runtime self-heal; this is by design.
- The hooks are installed globally at `~/.claude/hooks/` and pass through silently in projects without `.beads/` (plain GSD projects, worktrees of non-beads repos). Only beads-managed project roots enforce REQ-04.
- See `docs/WORKTREES.md` for the full setup walkthrough, lifecycle ops (add/remove/reactivate), and the four-failure-mode troubleshooting matrix.
