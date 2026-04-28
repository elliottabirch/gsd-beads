# gsd-beads + git worktrees

A walkthrough for running gsd-beads across multiple git worktrees of the
same project. Covers setup, lifecycle ops, and troubleshooting.

## Why use worktrees with gsd-beads

The source repo's `.beads/` is the single canonical bead store. Every
worktree shares it via `git config --worktree gsd-beads.dir <source>/.beads`,
which the post-checkout shim writes automatically on `git worktree add`.
There is no bd federation, no manual sync between worktrees, and no
`BEADS_DIR` env-var dance: a write in one worktree is visible to every
other worktree on the next read.

## Setup walkthrough

### Fresh project

```bash
cd <source-repo>
bd init --non-interactive --skip-agents
cd <gsd-beads-clone> && ./install.sh
cd <source-repo>   # back to project root
```

> macOS users: install.sh requires `flock`. Install via
> `brew install flock` first (the discoteq port is util-linux
> flag-compatible). install.sh's pre-flight blocks install with a clear
> error otherwise.

After install.sh runs, your source repo has:

- `.beads/hooks/post-checkout` with the worktree-init shim appended
  (sentinel-bracketed `BEGIN GSD-BEADS WORKTREE INIT v1`).
- `~/.claude/hooks/bd-sync.sh` registered in `~/.claude/settings.json`
  so every bd write triggers cascade + regen.
- 8 bd memories under the `gsd-beads:*` keyspace
  (run `bd memories gsd-beads` to confirm).

### Adding a worktree (auto-config)

```bash
git worktree add ../wt-feature -b feature-x
# Output:
# [gsd-beads] ✓ Worktree configured (gsd-beads.dir=<source>/.beads)
```

The post-checkout hook fires automatically. Behind the scenes:

- Resolves the source repo via `git rev-parse --git-common-dir`.
- Persists `git config --worktree gsd-beads.dir=<source>/.beads`.
- Writes a marker file at `<wt-gitdir>/info/.gsd-beads-configured` so
  re-runs are no-ops.

You do NOT need to set `BEADS_DIR`. From the new worktree, `bd list`
sees the same issues as the source repo.

### Pre-existing worktrees on first install

If you install gsd-beads on a project that already has multiple
worktrees, install.sh Step 6.5 backfills them in one pass. It runs:

```bash
git worktree list --porcelain
```

…parses the output, skips `bare` and `prunable` records, and fires the
shim against each surviving worktree path with `HEAD HEAD 1`. The
shim's marker-gate makes the shim a no-op on subsequent installs.

A typical porcelain enumeration looks like:

```
worktree /path/to/source
HEAD <sha>
branch refs/heads/main

worktree /path/to/wt-feature
HEAD <sha>
branch refs/heads/feature-x

worktree /path/to/wt-hotfix
HEAD <sha>
branch refs/heads/hotfix
```

Each record is terminated by a blank line. The source repo itself is
included; the marker-gate handles its own already-configured case
correctly.

## Lifecycle ops

### Removing a worktree

```bash
git worktree remove ../wt-feature
```

gsd-beads requires no cleanup of its own. The per-worktree
`gsd-beads.dir` config and the `.gsd-beads-configured` marker live
inside `<source>/.git/worktrees/<name>/`, which `git worktree remove`
deletes along with the worktree directory.

### Reactivating an old worktree path

If a worktree directory previously existed, was deleted, and a new
`git worktree add` reuses the same path, the post-checkout hook fires
and the marker-gate detects the missing marker → it reconfigures from
scratch. No manual intervention.

### Cleaning up stale entries (`git worktree prune`)

A dirty/aborted `git worktree remove` can leave orphan housekeeping
directories under `<source>/.git/worktrees/<name>/` even though the
worktree directory itself is gone. Run:

```bash
git worktree prune
```

…to clean these up. This is git's cleanup, not gsd-beads's; the
gsd-beads files inside those orphan directories are deleted along
with everything else by `prune`.

## Troubleshooting

The four failure modes documented below are the same four that the
cross-worktree simulation injects (`tests/cross-worktree/simulation.sh`,
D-13 in the phase context).

### Source `.beads/` deleted (D-13.1)

**Symptom:** bd commands in any worktree fail with "no .beads/" or
similar errors. The bead store is gone from the source repo.

**Recovery:** restore from git. The bead state is exported to
`.beads/issues.jsonl` after every bd write, so the JSONL export is
git-tracked and recoverable:

```bash
cd <source-repo>
git checkout HEAD -- .beads/issues.jsonl
prefix=$(jq -r .dolt_database .beads/metadata.json 2>/dev/null || echo "$(basename "$PWD")")
bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents
```

See `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md`
("Fresh-clone bootstrap") for the full procedure when `metadata.json`
is also missing.

### "another regen is in progress" message (D-13.2 / D-15)

**Symptom:** stderr from a bd write contains:

```
[gsd-beads] another regen is in progress at <source>/.beads/.gsd-beads.lock — retry shortly
```

**Cause:** another worktree's `bd-sync.sh` is currently running the
cascade + regen chain. The flock at `<source>/.beads/.gsd-beads.lock`
serializes both invocations. Per Plan 03-01, the wait timeout is 30
seconds and matches the bd-sync.sh hook timeout in
`settings.fragment.json`.

**Recovery:** wait a few seconds and retry. `bd-sync.sh` continues
fail-soft via its `|| true` chain, so the parent bd command itself
already returned 0; only the regen of the markdown views was skipped.
The next bd write triggers another regen attempt.

If this message appears under normal use (not a deliberate burst),
you have likely exceeded the empirically observed embedded-Dolt write
ceiling of ~3.25 writes/sec sustained for >30 seconds (Spike 003).
Investigate the workload before tuning the timeout — bumping the
flock timeout requires also bumping `settings.fragment.json`'s hook
timeout to match (D-15).

### Source repo renamed (D-13.3 / D-14)

**Symptom:** worktree's bd commands fail because
`git config gsd-beads.dir` points at a path that no longer exists.

**Recovery:** in EACH affected worktree, run:

```bash
git config --worktree gsd-beads.dir <new-source-path>/.beads
```

There is no code-side runtime self-heal — this is by design (D-14).
Adding path-resolution logic to the bd-sync.sh hot path would cost
every worktree on every write to mitigate a rare event. The one-line
recovery is documented and idempotent.

### `BEADS_DIR` unset in a worktree (D-13.4)

**Symptom:** in a fresh worktree where `BEADS_DIR` is not exported and
`git config --worktree gsd-beads.dir` is unset, bd's discovery
precedence determines whether bd finds the source's bead store.

**Observed precedence (cross-worktree simulation, dev WSL2):** bd's
discovery successfully falls through to the source's `.beads/` via
git's own discovery rules (cwd-scan walks up to `.git/`, and the
source-side `.beads/` is found relative to that). `bd list` returns
cross-worktree-visible issues even with no env var or per-worktree
config.

**Recovery:** if the discovery fallback fails on your platform or git
version, manually run the post-checkout shim to (re)write the
per-worktree config:

```bash
( cd <worktree> && bash <source>/.beads/hooks/post-checkout HEAD HEAD 1 )
```

The shim is idempotent (marker-gate); running it never breaks an
already-configured worktree.

### `flock` not installed (Pitfall 1)

**Symptom:** install.sh exits with:

```
ERROR: flock not installed (macOS: brew install flock)
```

…or, if install.sh's pre-flight check were ever bypassed, every bd
write would emit:

```
[gsd-beads] ERROR: flock not installed (macOS: brew install flock)
```

…on stderr from `cascade-loop.sh`, `regen-roadmap.sh`, and
`regen-requirements.sh`. Because bd-sync.sh swallows non-zero exits
via `|| true`, the symptom is "regen never runs and ROADMAP.md goes
stale", not a hard fail.

**Recovery (macOS):**

```bash
brew install flock
```

Then re-run `./install.sh`. The pre-flight check is at install.sh
line 19; you will see it succeed on the next install.

## Performance notes

- Embedded-Dolt sustained write throughput per machine is ~3.25
  writes/sec (Spike 003 measurement). Concurrent bursts beyond that
  rate queue at the dolt-internal file lock rather than parallelizing.
- `flock -x -w 30` adds <1ms in the uncontended case. The contended
  worst case is bounded by the 30-second wait timeout.
- The cross-worktree simulation (3 worktrees, 5-day flow + 4 failure
  injections + 40-invocation concurrent burst) runs in approximately
  one minute on a typical developer laptop or WSL2 host (50-55 seconds
  observed across 3 dev runs, see `WORKTREES-EVIDENCE.md`).

## See also

- `install/memories/worktrees.md` — bd memory #8, surfaces at every
  `bd prime` (every Claude session).
- `docs/WORKTREES-EVIDENCE.md` — observed behavior from a real
  simulation run, distilled into one section per D-04 invariant.
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md`
  — design rationale (Approach C: source `.beads/` + per-worktree
  `gsd-beads.dir`).
- Spike 003 source:
  `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/`.
- `tests/cross-worktree/simulation.sh` — the canonical green-lock
  simulation; rerun any time to refresh evidence.
