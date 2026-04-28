# gsd-beads

This recipe is a discovery pointer. The actual gsd-beads layer ships as a separate repository.

## Install

    git clone https://github.com/<owner>/gsd-beads
    cd gsd-beads
    ./install.sh

After install:
- `~/.claude/settings.json` is patched with 3 hooks (deep-merged, deduped)
- `~/.local/bin/gsd-sdk` symlinks to the shadow binary
- bd memories under `gsd-beads:*` are seeded
- Worktree post-checkout shim is appended to `.beads/hooks/post-checkout`

## Verify

    bd memories | grep gsd-beads:
    command -v gsd-sdk    # should resolve to ~/.local/bin/gsd-sdk

Per Pitfall 1, this template's content is informational — bd's recipe-add slot is a single-file template writer; the actual install work happens via `install.sh` in the cloned repo.
