# Storage and Distribution

How the bead store is laid out, shared across worktrees, committed to
git, and bootstrapped on fresh clones.

## Requirements

- **`bd init --non-interactive --skip-agents` is the canonical install command.** NOT `--stealth`. Beads is designed to be git-tracked: `.beads/issues.jsonl` (workflow state SoT) is auto-exported and auto-staged after every write, while `.beads/embeddeddolt/` (binary cache, rebuildable from JSONL) is gitignored.
- **Cross-worktree sharing: source-repo's `.beads/` is the canonical store; worktrees point at it via `BEADS_DIR=<source-repo>/.beads`.** No `bd dolt push` between worktrees needed; no external shared directory required.
- **New worktrees auto-configured via post-checkout hook.** `git worktree add` reliably fires `post-checkout`. Sentinel-marked block in `.beads/hooks/post-checkout` persists `git config --worktree gsd-beads.dir <source-repo>/.beads`. Idempotent via marker file in worktree's git-dir.
- **Run `bd hooks install` as part of gsd-beads install.** Adds 5 sentinel-merged git-hook shims (pre-commit, post-merge, pre-push, post-checkout, prepare-commit-msg) with 300s timeout + graceful "no bead store" fallback. The `prepare-commit-msg` agent-identity trailer is valuable for forensics on agent-driven commits.
- **Fresh-clone bootstrap = `git clone` + `bd init --from-jsonl`** with explicit `--prefix` read from `.beads/metadata.json`'s `dolt_database` field. JSONL roundtrip preserves every field that matters: IDs, statuses, parent-child trees, labels, close_reasons (including bd's `"All children completed"` cascade marker), notes, and issue_type. Without explicit `--prefix`, new post-clone IDs use the clone-directory name and diverge from pre-clone IDs.

## How to Build It

### Initial install in a project

```bash
# In the project's source repo (where .git/ lives):
cd <source-repo>
bd init --non-interactive --skip-agents
bd setup claude          # bd's bundled SessionStart/PreCompact + CLAUDE.md
bd hooks install         # bd's bundled git-hook shims

# Configure custom labels for gsd-beads vocabulary (optional — surfaced via bd memories)
bd remember --key gsd-beads:vocabulary "Use /gsd-beads-* skills..."
bd remember --key gsd-beads:state-paths ".planning/ROADMAP.md, REQUIREMENTS.md, todos/, seeds/ are GENERATED..."
# ... other gsd-beads:* memories

# Append worktree-init shim to bd's post-checkout
cat <<'EOF' >> .beads/hooks/post-checkout

# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---
[gsd-beads worktree-init shim — see sources/003-cross-worktree-sharing/worktree-post-checkout.sh]
# --- END GSD-BEADS WORKTREE INIT ---
EOF
```

### From any worktree

```bash
# Either: BEADS_DIR is set in the env (after cd into the worktree)
export BEADS_DIR=$(git config gsd-beads.dir)

# Or: bd resolves it via cwd-discovery from the source repo
cd <worktree>
BEADS_DIR=$(git config gsd-beads.dir) bd list -n 0
```

### Adding a new worktree (auto-setup)

```bash
git worktree add ../wt-new -b feature-x
# post-checkout fires automatically:
#   - resolves source repo's .beads/ via git rev-parse --git-common-dir
#   - persists git config --worktree gsd-beads.dir <path>
#   - touches marker in worktree's git-dir
# Output: [gsd-beads] ✓ Worktree configured (gsd-beads.dir=<source-repo>/.beads)
```

See `sources/003-cross-worktree-sharing/worktree-post-checkout.sh` for
the canonical shim.

### Fresh-clone bootstrap

```bash
git clone <repo-url> <local-path>
cd <local-path>

# Read prefix from metadata.json (committed)
prefix=$(jq -r .dolt_database .beads/metadata.json 2>/dev/null || basename "$PWD")

bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents
chmod 700 .beads

# Now bd list etc. work; embeddeddolt rebuilt from issues.jsonl
```

This recovers the full bead state from the committed `issues.jsonl`.
Validation (Spike 004): IDs preserved literally; statuses, labels,
parent-child relationships, close_reasons, notes, issue_type all
roundtrip cleanly. The reconstructed clone is fully workable —
cascade-loop fires correctly, new issues create with the right prefix.

### What the source repo commits

bd's auto-managed `.beads/.gitignore` splits the directory:

| Tracked in git | Ignored |
|---|---|
| `issues.jsonl` (workflow SoT, auto-staged after every write) | `embeddeddolt/` (binary cache, rebuildable) |
| `config.yaml`, `metadata.json`, `hooks/`, `.gitignore` | runtime locks, daemons, federation creds, ephemeral SQLite, backups, *.pid, sync-state |

Result: `git log -p .beads/issues.jsonl` IS the workflow audit log.
`git push/pull` becomes the multi-machine sync mechanism.

### Cross-worktree validation results (Spike 003)

- A→B and B→A sequential reads/writes: **immediate**, no manual sync
- Cross-worktree cascade: leaves closed in B, epic closed by
  cascade-loop run from A — same shared store
- 40 concurrent processes from 2 worktrees: 125 unique IDs, 0 collisions
- Embedded Dolt serializes concurrent writes via file lock (~3.25
  writes/sec). No parallel speedup, but correctness is guaranteed.

## What to Avoid

- **DON'T use `--stealth`.** It excludes the bead store from git via
  `.git/info/exclude`. You lose: git audit log, multi-machine sync,
  fresh-clone bootstrap, bd's bundled `post-merge` hook value.
  (Original spike-002 finding suggested stealth; user pushback led to
  reversal in spike-003 reshape.)
- **DON'T put the bead store in an external location** (e.g. `~/code/shared/.beads/`)
  while also wanting git history. Approach C is: source-repo's `.beads/`
  IS the shared store; worktrees point at it via `BEADS_DIR=<src>/.beads`.
- **DON'T forget the `--prefix` flag in `bd init --from-jsonl`.** Without
  it, new IDs in the restored clone use the directory name as prefix,
  diverging from pre-clone IDs. Read prefix from `metadata.json`.
- **DON'T expect `bd dolt push` to sync between worktrees.** It's for
  federation/remote sync. Same-machine multi-worktree is automatic.
- **DON'T re-run `bd init` blindly in a new worktree.** It'll try to
  re-initialize the existing bead store and may fail with safety
  errors. Use the post-checkout shim to configure git-config only.

## Constraints

- bd v1.0.3+
- `BEADS_DIR` must point at an existing `.beads/` directory; if missing,
  bd errors out (no auto-create on read)
- `bd init --from-jsonl` requires the JSONL file at `.beads/issues.jsonl`
- `chmod 700 .beads` recommended (bd warns at 0755) — fresh clones
  default to 755
- bd's auto-export throttles to once per 60s; force flush with `bd export -o .beads/issues.jsonl`
- Concurrent write throughput on embedded Dolt: ~3.25 writes/sec per
  machine. Heavy bursts queue rather than parallelize.
- `bd export` includes memories by default — relevant: gsd-beads:* memories
  travel with the JSONL roundtrip, so fresh clones get them automatically.

## Origin

Synthesized from spikes: 003 (cross-worktree-sharing), 004 (jsonl-roundtrip)
Source files available in: sources/003-cross-worktree-sharing/, sources/004-jsonl-roundtrip/
