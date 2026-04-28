# Phase 3: Cross-worktree validation - Research

**Researched:** 2026-04-28
**Domain:** Git worktree mechanics + portable bash file-locking + reproducible bash integration tests
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Validation methodology (Area 1):**
- D-01: Live-dev simulation is the primary validation approach (scripted, reproducible, multi-day, 2-3 worktrees). Not a soak test, not a pure scenario pack.
- D-02: 3 concurrent worktrees — `main` + `feature` + `hotfix`. Matches single-developer audience.
- D-03: Happy-path first, then 4 targeted failure injections (deterministic, not random).
- D-04: Pass criterion = 4 invariants hold:
  1. **No data loss** — every issue created in any worktree survives.
  2. **No ID collision** — hash-based IDs unique across all worktrees and 40-op concurrent batches.
  3. **No stale state** — write in wt-A → read in wt-B sees it without manual sync.
  4. **Atomic markdown views** — regenerated ROADMAP/REQUIREMENTS never observed mid-write.

**Worktree lifecycle scope (Area 2):**
- D-05: Lifecycle scope = setup + remove + reactivate. `git worktree prune`, branch-switching, source rename deferred to docs/troubleshooting.
- D-06: `git worktree remove` requires NO new gsd-beads code (validate experimentally; trust git for cleanup).
- D-07: Reactivating an old worktree relies on existing marker-gate idempotency. Do NOT change the shim.
- D-08: `install.sh` backfills pre-existing worktrees in one pass via `git worktree list --porcelain` + shim invocation against each. Idempotent via existing marker check.

**Documentation surface (Area 3):**
- D-09: Three-layer docs — bd memory #8 (`gsd-beads:worktrees`) + README section + `docs/WORKTREES.md`.
- D-10: `docs/WORKTREES.md` covers setup + lifecycle ops + troubleshooting (4 failure modes from D-13).
- D-11: Memory #8 is full content (not pointer); seeded by `install.sh` from `install/memories/worktrees.md`.
- D-12: Curate `docs/WORKTREES-EVIDENCE.md` from simulation transcripts.

**Failure modes coverage (Area 4):**
- D-13: 4 failure injections during simulation: (1) source `.beads/` deleted, (2) concurrent regen race, (3) source repo renamed, (4) BEADS_DIR unset.
- D-14: Source-repo rename recovery = documented `git config --worktree gsd-beads.dir <new>/.beads` one-liner. NO new code.
- D-15: **flock-based serialization** at `<source>/.beads/.gsd-beads.lock` with `flock -x -w 30`, covering `cascade-loop.sh` + `regen-roadmap.sh` + `regen-requirements.sh`. Lock-path resolved via `git rev-parse --git-common-dir` → `dirname` → `/.beads/.gsd-beads.lock`. Lock timeout matches `bd-sync.sh` hook timeout in `settings.fragment.json`. On timeout: clear "another regen in progress" message, exit non-zero, `bd-sync.sh` continues fail-soft.

### Claude's Discretion
- Test framework: bash + jq (matches existing patterns).
- Simulation script location: `tests/cross-worktree/` (parallel to `tests/worktree-tests/`).
- CI integration: out of scope (INFR-03 future).
- WORKTREES-EVIDENCE.md format: `## Observed: <invariant>` heading per invariant + 5-10-line transcript excerpt.

### Deferred Ideas (OUT OF SCOPE)
- Dogfood adoption (post-v0.2 milestone).
- Soak test / full chaos battery.
- `git worktree prune`, branch-switching, `git worktree repair` validation.
- Runtime self-heal in `bd-sync.sh` for source rename.
- `gsd-beads-doctor` / `gsd-beads-reconfigure-worktrees` helper command.
- CI matrix integration.
- Multi-developer federation across machines.
- `--shared-server` mode validation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID     | Description                                       | Research Support                                                                                                                |
|--------|---------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| REQ-03 | Cross-worktree state sharing                      | Live-dev simulation across 3 worktrees + 4-invariant black-box assertions. Reuses `worktree-post-checkout.sh` shipping in Phase 2. |
| REQ-05 | Conflict-free concurrent updates                  | `flock -x -w 30` serialization of cascade+regen scripts at single shared lock path; concurrent-stress fixture asserts no corrupt markdown + last-writer-wins on bd state. |
</phase_requirements>

## Summary

Phase 3 is **integration validation + ergonomic hardening + docs**, not new architecture. The Phase 2 shim (`hooks/worktree-post-checkout.sh`) already delivers REQ-03; what remains is (a) stress it under realistic multi-day flows, (b) layer `flock` over the cascade+regen chain to make REQ-05 race-free under concurrent invocation from multiple worktrees, (c) backfill pre-existing worktrees during `install.sh`, (d) ship a 3-layer documentation set (bd memory + README + `WORKTREES.md` + `WORKTREES-EVIDENCE.md`).

The research is sized for a small phase (2-3 plans). Key external dependencies: `flock` (already on Linux/WSL2 via util-linux; macOS users install via `brew install flock` providing the discoteq port — feature-compatible with the util-linux flags we need: `-x`, `-w`, decimal seconds).

**Primary recommendation:** Three plans:
1. **Flock retrofit** — add `flock -x -w 30` preamble to cascade-loop, regen-roadmap, regen-requirements. Resolve lock path via `git rev-parse --git-common-dir`. Document `flock` install for macOS.
2. **Simulation harness + install.sh backfill** — `tests/cross-worktree/simulation.sh` builds 3-worktree fixture, runs the 4-day flow + 4 failure injections, asserts the 4 invariants. `install.sh` gains a worktree-list-and-fire step.
3. **Documentation triple** — `install/memories/worktrees.md` (#8), README section, `docs/WORKTREES.md`, `docs/WORKTREES-EVIDENCE.md` distilled from a simulation run.

## Architectural Responsibility Map

| Capability                          | Primary Tier                  | Secondary Tier            | Rationale                                                                                          |
|-------------------------------------|-------------------------------|---------------------------|----------------------------------------------------------------------------------------------------|
| Cross-worktree state sharing        | Bead store (`<src>/.beads/`)  | git config --worktree     | Shared path resolved at hook fire; bd reads/writes a single shared embeddeddolt store.             |
| Per-worktree config persistence     | Per-worktree git-dir config   | post-checkout hook        | `git config --worktree gsd-beads.dir` lives in `.git/worktrees/<name>/config.worktree`.            |
| Cascade+regen serialization (NEW)   | Filesystem lock file          | bash scripts (3)          | `<src>/.beads/.gsd-beads.lock` is the single shared synchronisation point across all worktrees.    |
| Worktree lifecycle (add/remove)     | git itself                    | gsd-beads marker file     | git owns gitdir cleanup; gsd-beads' marker lives inside the gitdir → auto-cleaned by `worktree remove`. |
| Backfill pre-existing worktrees     | `install.sh`                  | post-checkout shim        | One-time enumerate-and-fire; idempotent because shim self-gates on its marker.                     |
| Documentation                       | `docs/WORKTREES.md`           | bd memory #8 + README     | Memory #8 surfaces at every `bd prime`; WORKTREES.md is the deep dive.                             |

## Standard Stack

### Core (already shipping in Phase 2 — no new deps for the regen/cascade serialization step)
| Tool           | Version         | Purpose                                                                              | Why Standard                                                                                                                              |
|----------------|-----------------|--------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `flock`        | util-linux 2.39+ (Linux/WSL2) / discoteq 0.4.0 (macOS via Homebrew) | Exclusive file lock with timeout for cascade+regen serialization                                          | POSIX-style file locking baked into the kernel; ergonomic timeout via `-w`. Verified via `command -v flock` on the dev WSL2 host. [VERIFIED: /usr/bin/flock from util-linux 2.39.3 present; CITED: man.kernel.org/linux/man-pages/man1/flock.1.html] |
| `git worktree` | git 2.43+       | Worktree lifecycle (add/list/remove); fires `post-checkout` on add                   | Repo-level workflow already deeply integrated with bd's hook chain. [VERIFIED: git 2.43.0 in dev env; CITED: git-scm.com/docs/git-worktree] |
| `git rev-parse --git-common-dir` | git 2.5+ | Resolve source-repo `.git/` from any worktree → dirname → `/.beads/`                 | Already used by the existing post-checkout shim — same resolver works for the lock path. [CITED: git-scm.com/docs/git-rev-parse]          |
| `jq`           | 1.6+            | Parse `bd ...--json` output in invariant assertions                                  | Already required by Phase 2 install.sh + test runners.                                                                                    |
| `bd`           | 1.0.3+          | Bead store CLI (`bd q`, `bd link`, `bd close`, `bd ready`, `bd export`)              | Workflow SoT.                                                                                                                             |

### Supporting
| Tool             | Purpose                                                            | When to Use                                                                                                                |
|------------------|--------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `mktemp -d`      | Sandbox dir per simulation run                                     | All cross-worktree fixtures isolated under `/tmp/gsd-beads-cross-${RANDOM}` (matches existing test conventions).            |
| `trap '...' EXIT`| Sandbox cleanup                                                    | Pattern from `tests/e2e/concurrent-merge.test.sh`.                                                                          |
| `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` | Reproducible git commit timestamps in simulation    | Optional — useful only if simulation needs exact `git log` ordering. bd's hash IDs do not depend on git timestamps.         |

### Alternatives Considered
| Instead of                | Could Use                            | Tradeoff                                                                                                                  |
|---------------------------|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `flock` for serialization | `mkdir`-based lock + `trap rm`       | Portable across all POSIX systems with no install step, but no built-in timeout (need a sleep loop), and stale locks survive `kill -9` (untrap'd termination). [CITED: BashFAQ/045 mywiki.wooledge.org] |
| `flock` for serialization | `set -o noclobber` + redirect file   | More fragile on edge filesystems; same stale-lock problem as `mkdir`.                                                     |

**flock vs mkdir trade-off resolution:** Locked decision (D-15) is `flock`. Phase 3 documents the macOS install requirement (`brew install flock`) in WORKTREES.md and adds a pre-flight `command -v flock` check to `install.sh` with a clear error message. NO mkdir fallback in v1 — D-15 is explicit about flock.

**Installation note (macOS):**
```bash
# Required for cascade+regen serialization on macOS:
brew install flock   # installs discoteq/flock 0.4.0, util-linux-flag-compatible
```
[CITED: formulae.brew.sh/formula/flock; discoteq/flock README at github.com/discoteq/flock]

**Version verification:**
```bash
flock --version   # should report util-linux >= 2.30 OR discoteq >= 0.3.0
```

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────────────┐
                  │   source repo        │
                  │   <src>/             │
                  │   ├── .git/          │ ◀── git rev-parse --git-common-dir resolves here
                  │   └── .beads/        │
                  │       ├── embedded.. │
                  │       ├── issues.jsonl
                  │       └── .gsd-beads.lock  ◀── single shared flock file (D-15)
                  └──────────▲───────────┘
                             │ BEADS_DIR=<src>/.beads
                             │ git config gsd-beads.dir
              ┌──────────────┼──────────────┐
              │              │              │
         worktree-A     worktree-B     worktree-C
         (main)         (feature)      (hotfix)
              │              │              │
              ▼              ▼              ▼
        bd-sync.sh chain (each invoked from its own worktree):
            cascade-loop.sh  ──┐
            regen-roadmap.sh  ─┼─► all acquire <src>/.beads/.gsd-beads.lock (flock -x -w 30)
            regen-requirements.sh ─┘
              │
              ▼
        Atomic mv to .planning/{ROADMAP,REQUIREMENTS}.md (already exists in scripts)
```

Data flow:
1. User triggers `bd <write>` in any worktree → bd's PostToolUse hook fires → `bd-sync.sh` chain runs.
2. Each chain step opens fd `flock -x -w 30 <src>/.beads/.gsd-beads.lock` first.
3. While the lock is held: cascade closes eligible epics, regen rewrites markdown atomically.
4. On timeout (30s): exit 1 with clear message; `bd-sync.sh` keeps going (`|| true` in current code).
5. Other worktrees observing `bd list` see the new state immediately (shared bead store).

### Recommended Project Structure

```
tests/cross-worktree/                        # NEW — phase 3 simulation
├── simulation.sh                            # 4-day flow + 4 failure injections + 4 invariant assertions
├── helpers.sh                               # mk_worktree, assert_invariant, run_concurrent helpers
└── README.md                                # how to run locally + what it asserts

docs/                                        # NEW — phase 3 docs
├── WORKTREES.md                             # setup + lifecycle + troubleshooting
└── WORKTREES-EVIDENCE.md                    # curated transcript distillation

install/memories/
└── worktrees.md                             # NEW — memory #8 source

scripts/
├── cascade-loop.sh                          # MODIFIED — add flock preamble (D-15)
├── regen-roadmap.sh                         # MODIFIED — add flock preamble (D-15)
└── regen-requirements.sh                    # MODIFIED — add flock preamble (D-15)

install.sh                                   # MODIFIED — add (a) worktree backfill step (D-08), (b) flock pre-flight check, (c) memory #8 seeding (auto via existing loop)

README.md                                    # MODIFIED — add "Multi-worktree setup" section linking to docs/WORKTREES.md
```

### Pattern 1: flock preamble (canonical for D-15)
**What:** Each of the 3 scripts opens an fd against the shared lock file, takes an exclusive lock with 30s timeout, and exits clearly on timeout.
**When to use:** First lines (after `set -euo pipefail`) of `cascade-loop.sh`, `regen-roadmap.sh`, `regen-requirements.sh`.
**Example (verified shape):**
```bash
# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---
# Resolve source repo's .beads/ from any worktree.
# git rev-parse --git-common-dir returns the source repo's .git/, OR `.git` from the
# source itself; absolutize via cd + pwd -P (matches worktree-post-checkout.sh pattern).
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"

# Pre-flight: flock present?
if ! command -v flock >/dev/null 2>&1; then
  echo "[gsd-beads] ERROR: flock not installed (macOS: brew install flock)" >&2
  exit 1
fi

# Lazy-create lock file (zero-byte; never deleted).
mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"

# Acquire exclusive lock with 30s timeout (matches bd-sync.sh hook timeout).
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen is in progress at $LOCK — retry shortly" >&2
  exit 1
fi
# Lock auto-released when fd 9 closes (script exit).
# --- END GSD-BEADS LOCK PREAMBLE v1 ---
```

[CITED: man.kernel.org/linux/man-pages/man1/flock.1.html — `-x` exclusive, `-w SECONDS` decimal allowed; exit 1 on timeout]

### Pattern 2: `git worktree list --porcelain` parsing for backfill (D-08)
**What:** Enumerate worktree paths to fire the shim against each.
**When to use:** Inside `install.sh` after the post-checkout shim is appended.
**Edge cases (verified from git docs):**
- First attribute of every record is `worktree <path>`.
- Empty line terminates a record.
- A `bare` record may appear (no HEAD/branch) — skip via the `bare` label.
- A `prunable` record indicates a stale worktree pointing at a deleted gitdir — skip.
- A `locked` record can be safely included (the shim's marker check + `flag=1` invocation works regardless).
- The source/main repo itself appears as a record — INCLUDE it (the shim's marker check skips it if already configured; but the source has no marker yet on first install, and re-firing from `cd <src>` correctly resolves common-dir to itself → `<src>/.beads`).

**Canonical parser (POSIX-correct):**
```bash
# Read worktree paths only (skip bare records).
git worktree list --porcelain | awk '
  /^worktree / { path = substr($0, 10); is_bare = 0; next }
  /^bare$/      { is_bare = 1; next }
  /^prunable/   { is_bare = 1; next }   # treat as skip
  NF == 0       { if (path != "" && !is_bare) print path; path = ""; is_bare = 0 }
  END           { if (path != "" && !is_bare) print path }
'
```
[CITED: git-scm.com/docs/git-worktree §"List output"]

### Pattern 3: install.sh backfill — fire shim against existing worktrees (D-08)
**What:** After appending the shim to `.beads/hooks/post-checkout`, walk every worktree and invoke the appended hook with `HEAD HEAD 1`. The `flag=1` gate passes; the marker-gate makes second runs no-ops.
**Why `HEAD HEAD 1` works:** The shim does NOT compare `$1` and `$2`. It only checks `$3 = 1`. Then it checks the per-worktree marker. This means:
- First-install backfill: marker absent → shim configures and creates marker.
- Re-install (hot-path idempotency): marker present → shim exits 0 without touching config.

**Canonical backfill loop:**
```bash
# Run AFTER the shim has been appended to .beads/hooks/post-checkout.
git -C "$PWD" worktree list --porcelain | awk '...as above...' | while IFS= read -r wt_path; do
  [ -d "$wt_path" ] || continue
  # `cd` so the appended hook resolves git-dir / common-dir relative to this wt.
  ( cd "$wt_path" && bash "$PWD/.beads/hooks/post-checkout" HEAD HEAD 1 ) || true
done
```
**Alternative considered (rejected):** `git -C "$wt_path" checkout HEAD` to trigger the actual hook. Rejected because (a) checkout has side effects (file mtimes, index touches), (b) direct invocation is cleaner and the shim is designed for this — same pattern as `tests/worktree-tests/auto-config.test.sh` CASE 3.

### Pattern 4: Reproducible 4-day cross-worktree simulation
**What:** Simulate "Day 1..Day 4" of work across 3 worktrees with deterministic outcomes.
**Approach:** Drop the literal "day" framing for runtime — what matters for invariant assertions is **operation order and final state**, not real timestamps. Run all 4 days back-to-back in a single bash script.
**Determinism strategy:**
- bd hash IDs are content-derived; same titles + same prefix = same IDs across runs (no need to seed RNG).
- No reliance on wall-clock timestamps in the assertions — assert on `bd list --json`'s status / counts / IDs.
- For git commits in the fixture: pin `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` to a fixed timestamp (e.g. `2026-04-28T12:00:00Z`) — only matters if the simulation does literal `git commit`s and inspects `git log`. The simulation's bd-state assertions don't need this.

### Anti-Patterns to Avoid
- **DON'T resolve the lock path via `$PWD/.beads/.gsd-beads.lock`** — from a worktree, `$PWD/.beads/` is the source's beads only if `BEADS_DIR` is set, which is not guaranteed. Always use `git rev-parse --git-common-dir`. (This is the same bug pattern that the post-checkout shim avoids.)
- **DON'T call `flock -x -w 30 -c "<command string>"`** — the command form requires careful quoting; use the file-descriptor form (`exec 9>"$LOCK" ; flock -x -w 30 9`) so the lock auto-releases at script exit and there's no quoting hazard. [CITED: man flock(1) — fd-form is recommended for shell scripts]
- **DON'T delete the lock file at script exit.** flock semantics are tied to the open fd, not the file's existence. Deleting creates races. The lock file is zero bytes and lives forever; `*.lock` is already in `.beads/.gitignore`. [VERIFIED: `.beads/.gitignore` contains `*.lock`]
- **DON'T add an `exit 0` early-return when `$1 == $2` in the shim.** D-07 is explicit: do NOT change the shim. Backfill works because the shim's marker-gate already does the right thing.
- **DON'T run `git checkout` from each worktree to fire the shim during install.sh** — direct invocation is cleaner, faster, side-effect-free.

## Don't Hand-Roll

| Problem                                | Don't Build                                | Use Instead                                       | Why                                                                                                          |
|----------------------------------------|--------------------------------------------|---------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| Mutex/lock for cascade+regen scripts   | mkdir-loop with sleep + manual stale-lock detection + signal handler | `flock -x -w 30 9>"$LOCK"`                  | flock auto-releases on fd close; survives `kill -9`; built-in timeout; D-15 locked. [CITED: BashFAQ/045]    |
| Worktree path enumeration              | Parsing `.git/worktrees/*/gitdir` files    | `git worktree list --porcelain`                   | Official format with documented attributes (worktree/HEAD/branch/bare/locked/prunable); single source.       |
| Source-repo path resolution from a wt  | Walking `..` until `.git` is found         | `git rev-parse --git-common-dir` + `dirname`      | One-line; correct for bare/non-bare; the existing shim uses it.                                              |
| Cross-worktree concurrency primitive   | bd dolt push between worktrees             | Shared `BEADS_DIR` (D-15 just adds flock atop)    | Spike 003 + Phase 2 verification confirm shared BEADS_DIR is correct. `bd dolt push` is for federation only. |
| Markdown atomic-write                  | New atomic-write helper                    | Existing `mktemp + mv` already in regen scripts   | Already present; flock layers on TOP for end-to-end correctness (defense in depth).                          |

**Key insight:** Phase 3 is a thin layer atop Phase 2 — every load-bearing primitive already exists. The only NEW primitive is `flock`, and it's a kernel-level system call wrapped in a one-line shell command.

## Runtime State Inventory

> Phase 3 is not a rename or migration phase — but the locked decisions DO touch runtime state in 3 areas. Documenting per protocol.

| Category                  | Items Found                                                                  | Action Required                                                                                       |
|---------------------------|------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| **Stored data**           | bd embedded-dolt store at `<src>/.beads/embeddeddolt/` — read+write by all simulation worktrees during phase 3 simulation. No schema changes. | Simulation creates fixture-local data only (under `/tmp`); never touches the gsd-beads project's own bead store. Cleanup via `trap EXIT`. |
| **Live service config**   | None — gsd-beads has no daemon / live service. bd is invoked per-command.    | None.                                                                                                 |
| **OS-registered state**   | git per-worktree config (`gsd-beads.dir` in `.git/worktrees/<name>/config.worktree`). For pre-existing worktrees on an UPGRADE install, this config is missing. | `install.sh` backfill (D-08) runs the shim against each pre-existing worktree path → writes the config + marker. Idempotent. |
| **Secrets and env vars**  | `BEADS_DIR` env var — code-only references; rename / restructure not in scope. | None (D-13 injection #4 only validates discovery fallback, doesn't change anything).                  |
| **Build artifacts**       | None — gsd-beads has no build step (bash/jq scripts + ESM mjs binaries). | None.                                                                                                 |

**The canonical question for this phase:** *After install.sh runs (fresh OR upgrade), do all worktrees of the project have `gsd-beads.dir` configured?* — The backfill in D-08 ensures yes for the upgrade case. The shim's auto-fire on `git worktree add` ensures yes for new worktrees post-install.

## Common Pitfalls

### Pitfall 1: macOS users hit `flock: command not found` after install
**What goes wrong:** install.sh succeeds (no `flock` check), but the first `bd q ...` triggers `bd-sync.sh` → `cascade-loop.sh` → `flock` not found → exit 1. User sees a stack of stderr messages on every bd command.
**Why it happens:** macOS does not ship `flock`. `bd-sync.sh` swallows errors (`|| true`), so the symptom is "regen never runs", not a hard fail — easy to miss until ROADMAP.md goes stale.
**How to avoid:** `install.sh` MUST add `command -v flock >/dev/null 2>&1 || { echo "ERROR: flock not installed (macOS: brew install flock)"; exit 1; }` to the existing pre-flight block (line 15-17 of install.sh). Document in WORKTREES.md.
**Warning signs:** `cascade-loop.sh: line 5: flock: command not found` in stderr after a bd write.

### Pitfall 2: Lock-file race on first invocation
**What goes wrong:** Two `bd-sync.sh` chains fire simultaneously on a brand-new install where `<src>/.beads/.gsd-beads.lock` doesn't exist yet. Both `: > "$LOCK"` truncate-creates race; both `flock` calls win their own lock on different inode generations → no serialization.
**Why it happens:** Truncate-create is not atomic across two writers; `flock` locks the open fd's inode.
**How to avoid:** Use `set -o noclobber`-style "create only if absent" pattern, OR rely on `mkdir -p` of the parent + a single lazy creation that's safe under repeat invocation. The simplest correct form: `[ -e "$LOCK" ] || ( umask 077 && : > "$LOCK" ) ; exec 9>"$LOCK" ; flock -x -w 30 9`. The `[ -e ... ]` test + `: >` is racey only if both writers run simultaneously on a fresh install — extremely narrow window. Acceptable risk; if it bites, switch to `: >> "$LOCK"` (append, never truncates an existing file).
**Warning signs:** Two regen runs producing different `.planning/ROADMAP.md` byte content under simultaneous-burst test.

### Pitfall 3: `git rev-parse --git-common-dir` returns relative `.git` from the source repo
**What goes wrong:** From the source repo (not a worktree), `git rev-parse --git-common-dir` may return the literal string `.git` (relative). `dirname .git` returns `.`. Lock path becomes `./.beads/.gsd-beads.lock` — works only if PWD happens to be the source root.
**Why it happens:** git docs note `--git-common-dir` returns whatever resolves at the call site; for the source it's `.git` if the cwd IS the source root, but `/abs/path/.git` if cwd is deeper.
**How to avoid:** Absolutize via `cd "$common" && pwd -P` (the same pattern the existing shim uses on line 20). Verified.
**Warning signs:** `flock` complains about path resolution OR the lock file lands in an unexpected directory.

### Pitfall 4: Concurrent regen test produces flaky CI signals
**What goes wrong:** Simulation step 6 fires 20 `bd-sync.sh` invocations from each of 2 worktrees. With `flock -w 30`, all 40 should serialize within 30s. On a slow CI runner OR a shared dev machine, `bd` itself takes >0.7s per write (Spike 003: ~3.25 writes/sec ceiling); 40 writes = ~12s, well under 30s. But layering: each writer waits for flock + then takes ~0.3s to run cascade+regen → a worst-case 40-deep queue could approach 30s on slow hardware.
**Why it happens:** flock-wait stacks linearly with bd's internal file lock.
**How to avoid:** Set the simulation's concurrent burst to 20 total (not 40). Document expected duration. If a CI matrix later wants 40, bump the lock timeout or reduce the regen body's runtime.
**Warning signs:** "another regen in progress" messages > 0 during the simulation.

### Pitfall 5: `git worktree remove` leaves the source repo's bead store untouched (correct), but old per-worktree config persists in `.git/worktrees/<dead-name>/`
**What goes wrong:** Until `git worktree prune` runs, the dead worktree's `gsd-beads.dir` config and marker file persist as orphaned files under the source `.git/`. Harmless (nothing reads them) but visible.
**Why it happens:** `git worktree remove` deletes the worktree directory, not the gitdir housekeeping under `.git/worktrees/`. `git worktree prune` does the housekeeping.
**How to avoid:** D-06 says "trust git for cleanup" — document this behavior in WORKTREES.md troubleshooting ("if you see stale entries, run `git worktree prune`"). Validate experimentally in the simulation. NO code.
**Warning signs:** `ls .git/worktrees/` after `git worktree remove` shows directories for removed worktrees. Resolve via `git worktree prune`.

## Code Examples

### Lock preamble (verified shape, drop into all 3 scripts)
```bash
# Verified against: man.kernel.org/linux/man-pages/man1/flock.1.html
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"
mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen in progress at $LOCK — retry shortly" >&2
  exit 1
fi
```

### Worktree-list parser (POSIX awk, no bashisms)
```bash
git worktree list --porcelain | awk '
  /^worktree / { path = substr($0, 10); skip = 0; next }
  /^bare$/      { skip = 1; next }
  /^prunable/   { skip = 1; next }
  NF == 0       { if (path != "" && !skip) print path; path = ""; skip = 0 }
  END           { if (path != "" && !skip) print path }
'
```

### Backfill loop (drop into install.sh after the shim-append step)
```bash
# Re-fires the shim against every existing worktree.
# Idempotent: shim's marker-gate makes second invocations no-ops.
if [ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]; then
  git -C "$PWD" worktree list --porcelain | awk '
    /^worktree / { p = substr($0, 10); s = 0; next }
    /^bare$/      { s = 1; next }
    /^prunable/   { s = 1; next }
    NF == 0       { if (p != "" && !s) print p; p = ""; s = 0 }
    END           { if (p != "" && !s) print p }
  ' | while IFS= read -r wt_path; do
    [ -d "$wt_path" ] || continue
    ( cd "$wt_path" && bash "$wt_path/.beads/hooks/post-checkout" HEAD HEAD 1 ) || true
  done
fi
```

Note: the appended shim lives in `<src>/.beads/hooks/post-checkout`. From a worktree `cd`, `git rev-parse --git-common-dir` resolves to `<src>/.git/`, so we can also resolve via that — but the simpler form above (`$wt_path/.beads/hooks/post-checkout`) doesn't work because each worktree doesn't have its own `.beads/`. Correct invocation:
```bash
( cd "$wt_path" && bash "$REPO_BEADS_DIR/hooks/post-checkout" HEAD HEAD 1 )
# where REPO_BEADS_DIR is the source repo's .beads/ resolved up-front in install.sh.
```

### Invariant assertions (4 invariants from D-04)
```bash
# Invariant 1: no data loss. Count beads created across worktrees, compare to bd list.
created_count=$(grep -c '^CREATED' "$audit_log")
listed_count=$(BEADS_DIR="$src/.beads" bd list --status=all --json | jq 'length')
[ "$created_count" -eq "$listed_count" ] || die "data loss: created=$created_count listed=$listed_count"

# Invariant 2: no ID collision. All IDs in audit log unique.
[ "$(awk '$1=="CREATED"{print $2}' "$audit_log" | sort -u | wc -l)" -eq "$created_count" ] || die "ID collision"

# Invariant 3: no stale state. Cross-worktree write→read.
BEADS_DIR="$src/.beads" (cd "$wt_a" && bd q "stale-test" -t task -p 3) > /dev/null
seen=$(BEADS_DIR="$src/.beads" cd "$wt_b" && bd list --json | jq '[.[] | select(.title=="stale-test")] | length')
[ "$seen" = "1" ] || die "stale state: wt-A wrote, wt-B did not see"

# Invariant 4: atomic markdown views. Hash the markdown during a concurrent burst; ensure
# every observed hash is the FULL output of regen-roadmap.sh, not a truncated mid-write.
# Strategy: snapshot ROADMAP.md every 0.1s during the burst; verify each snapshot ends with
# the literal terminator line "\n" AND parses as a valid markdown structure (head/last-line check).
for snap in /tmp/roadmap-snap-*.md; do
  tail -1 "$snap" | grep -q '^$' || die "atomic violation: $snap truncated"
done
```

## State of the Art

| Old Approach (Spike 003)                            | Current Approach (Phase 3)                                                      | When Changed | Impact                                                                                       |
|-----------------------------------------------------|----------------------------------------------------------------------------------|--------------|----------------------------------------------------------------------------------------------|
| Synthetic 2-worktree validation (one-shot)          | 3-worktree multi-day simulation + 4 failure injections + 4 invariants            | Phase 3      | Realism level approaches dogfooding; failure modes documented for users.                     |
| No serialization layer (atomic-mv only in regen scripts) | flock at single shared `<src>/.beads/.gsd-beads.lock`                          | Phase 3 (D-15) | Eliminates the race window between cascade-then-regen-then-mv steps. Defense in depth.       |
| `git worktree add` works; pre-existing worktrees go un-configured | `install.sh` backfills via `git worktree list --porcelain` + shim re-fire | Phase 3 (D-08) | First-class upgrade path; users don't have to manually re-run anything per worktree.        |
| README mentions worktrees in passing                | 3-layer doc: `bd memory #8` + README section + `docs/WORKTREES.md` + `WORKTREES-EVIDENCE.md` | Phase 3 (D-09..D-12) | Surfaces at every `bd prime`; deep-dive available; evidence committed.            |

**Deprecated/outdated:** None — Phase 3 is purely additive over Phase 2.

## Assumptions Log

> Claims tagged `[ASSUMED]` need user confirmation before becoming locked decisions. Phase 3 has very few — the heavy lifting was done in CONTEXT.md.

| #   | Claim                                                                                                                | Section                            | Risk if Wrong                                                                                                                                |
|-----|----------------------------------------------------------------------------------------------------------------------|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| A1  | macOS users will install `flock` via `brew install flock` (not MacPorts, not source build).                         | Standard Stack / Pitfall 1         | If user's macOS environment lacks Homebrew or refuses to install flock, the install fails. Mitigation: pre-flight error message has clear instructions; documented in WORKTREES.md. |
| A2  | Bash `simulation.sh` running ~5 minutes locally is acceptable phase-3 validation duration.                           | Architecture Patterns / Pattern 4  | If simulation runs >10min, it becomes painful to iterate. Mitigation: simulation is opt-in (not in run-quick.sh); keep it under 5min.        |
| A3  | The 30s flock timeout is sufficient for realistic 3-worktree workflows (NOT for stress beyond Spike 003's 40-bead burst). | Pitfall 4                       | If real-world bursts >30s in queue, users see "another regen in progress" errors. Mitigation: documented in WORKTREES.md troubleshooting. Bumping the timeout requires also bumping settings.fragment.json's hook timeout (D-15 explicit on this match). |
| A4  | `git worktree remove` truly cleans up `.git/worktrees/<name>/` IF the worktree was clean; orphans only on dirty/aborted removes. | Pitfall 5                  | If git always orphans, the WORKTREES.md "trust git" line under-promises. Mitigation: simulation step 5 EXPERIMENTALLY validates this on the dev machine; evidence captured in WORKTREES-EVIDENCE.md.    |

## Open Questions

1. **Should `install.sh` enable `extensions.worktreeConfig` if it's not already on?**
   - What we know: `git config --worktree` requires `extensions.worktreeConfig=true` (set per-repo). The post-checkout shim's existing fallback (`git config gsd-beads.dir`) handles the unset case. Phase 2's `tests/worktree-tests/auto-config.test.sh` `make_fixture` helper sets it explicitly.
   - What's unclear: should production `install.sh` set it, or rely on the shim's fallback? Setting it changes user's git repo config — REQ-02 boundary.
   - Recommendation: **leave it to the shim's fallback (current Phase 2 behavior).** The fallback path uses repo-level `git config gsd-beads.dir`, which is shared across all worktrees — equivalent for our use case. No new write to user's repo config beyond what the shim already does. Capture this clarification in WORKTREES.md.

2. **Should `cascade-loop.sh` skip the lock when invoked from `bd-sync.sh` (which has its own implicit serialization via the hook timeout)?**
   - What we know: `bd-sync.sh` runs cascade → regen-roadmap → regen-requirements sequentially. Within a single bd-sync invocation, no internal contention.
   - What's unclear: does the lock add value in the "single bd-sync.sh chain" case, or only in the "two worktrees firing bd-sync.sh simultaneously" case?
   - Recommendation: **always acquire the lock.** The script may be invoked directly (not via bd-sync.sh), and the lock is cheap (~milliseconds when uncontended). D-15's "Coverage" line is explicit: each script acquires at preamble.

## Environment Availability

| Dependency       | Required By                                          | Available (this dev machine)             | Version             | Fallback                                                                                          |
|------------------|------------------------------------------------------|-------------------------------------------|---------------------|---------------------------------------------------------------------------------------------------|
| `flock`          | cascade-loop.sh + regen-roadmap.sh + regen-requirements.sh (D-15) | ✓ (WSL2)                          | util-linux 2.39.3   | macOS users: `brew install flock`. NO mkdir-fallback in v1 (D-15 locked). Pre-flight in install.sh blocks install with clear error. |
| `git` 2.5+ with worktree commands | post-checkout shim + install.sh backfill + simulation | ✓                          | 2.43.0              | None — git is mandatory.                                                                          |
| `git rev-parse --git-common-dir` | shim + lock-path resolver           | ✓                                         | git 2.5+            | None.                                                                                             |
| `jq`             | invariant assertions + bd JSON parsing               | ✓                                         | 1.6+                | None — already required by Phase 2.                                                               |
| `bd`             | simulation issue ops + invariant queries             | ✓                                         | 1.0.3+              | None.                                                                                             |
| `awk` (POSIX)    | worktree-list parser                                 | ✓                                         | mawk 1.3.4 / gawk 5+ / BSD awk | All ship by default.                                                                     |

**Missing dependencies with no fallback:**
- `flock` on macOS (NOT installed by default). Must be addressed by install.sh pre-flight + WORKTREES.md install instructions.

**Missing dependencies with fallback:** None — D-15 is explicit about flock.

## Validation Architecture

> nyquist_validation default = ON (no `.planning/config.json` override observed).

### Test Framework
| Property            | Value                                                                                                |
|---------------------|------------------------------------------------------------------------------------------------------|
| Framework           | bash + jq + bd CLI (matches Phase 2 conventions)                                                     |
| Config file         | None (per-suite shell scripts; `tests/run-quick.sh` + `tests/run-all.sh` are the runners)            |
| Quick run command   | `bash tests/run-quick.sh cross-worktree-sim` (NEW component; add to run-quick.sh case statement)     |
| Full suite command  | `bash tests/run-all.sh` (existing — picks up `tests/cross-worktree/*.sh` by glob if added)           |

### Phase Requirements → Test Map
| Req ID  | Behavior                                                                                | Test Type        | Automated Command                                                          | File Exists?     |
|---------|-----------------------------------------------------------------------------------------|------------------|----------------------------------------------------------------------------|------------------|
| REQ-03  | 3 worktrees see the same workflow state via shared BEADS_DIR (write in A → read in B)   | integration      | `bash tests/cross-worktree/simulation.sh`                                  | ❌ Wave 0        |
| REQ-03  | New worktree auto-configured on `git worktree add`                                      | unit             | `bash tests/worktree-tests/auto-config.test.sh`                            | ✅                |
| REQ-03  | Pre-existing worktrees backfilled by install.sh (D-08)                                  | integration      | `bash tests/install-tests/worktree-backfill.test.sh`                       | ❌ Wave 0        |
| REQ-03  | `git worktree remove` does not leak gsd-beads-side state (D-06)                          | integration      | sub-case of `tests/cross-worktree/simulation.sh`                           | ❌ Wave 0        |
| REQ-03  | Reactivating an old worktree path triggers shim reconfig (D-07)                         | integration      | sub-case of `tests/cross-worktree/simulation.sh`                           | ❌ Wave 0        |
| REQ-05  | Concurrent regen from 2 worktrees produces atomic, single-writer markdown (D-15)        | integration      | sub-case of `tests/cross-worktree/simulation.sh` (concurrent-stress)       | ❌ Wave 0        |
| REQ-05  | flock preamble present in cascade-loop.sh, regen-roadmap.sh, regen-requirements.sh      | unit (grep-style)| `bash tests/hook-tests/flock-preamble.test.sh`                             | ❌ Wave 0        |
| REQ-05  | Lock-timeout failure mode emits clear stderr + non-zero exit (D-15)                     | unit             | sub-case of `tests/hook-tests/flock-preamble.test.sh`                      | ❌ Wave 0        |
| REQ-05  | bd-sync.sh chain still completes (fail-soft) when flock returns non-zero                | unit             | extend `tests/hook-tests/bd-sync.test.sh` with new case                    | ✅ (extend)       |
| -       | install.sh fails fast if `flock` missing                                                | unit             | extend `tests/install-tests/path-precedence.test.sh` OR new flock-preflight.test.sh | ✅ (extend)/❌ |

### Sampling Rate
- **Per task commit:** `bash tests/run-quick.sh cross-worktree-sim` (or per-suite — small surface).
- **Per wave merge:** `bash tests/run-all.sh` (full).
- **Phase gate:** Full suite green + `tests/cross-worktree/simulation.sh` green + `docs/WORKTREES-EVIDENCE.md` populated from a real simulation run.

### Wave 0 Gaps
- [ ] `tests/cross-worktree/simulation.sh` — the 4-day flow + 4 failure injections + 4 invariants (REQ-03, REQ-05).
- [ ] `tests/cross-worktree/helpers.sh` — `mk_worktree`, `assert_invariant`, `run_concurrent` shared helpers.
- [ ] `tests/hook-tests/flock-preamble.test.sh` — verifies flock preamble exists in all 3 scripts; verifies timeout-error path.
- [ ] `tests/install-tests/worktree-backfill.test.sh` — verifies install.sh backfills 2 pre-existing worktrees correctly.
- [ ] Extend `tests/hook-tests/bd-sync.test.sh` with case "flock-failure-still-returns-0".
- [ ] Add `cross-worktree-sim` (and optionally `flock-preamble`, `worktree-backfill`) to `tests/run-quick.sh` case statement.
- [ ] Framework install: none — bash + jq + bd already required.

## Project Constraints (from CLAUDE.md)

- gsd-beads is a **single-developer** project. No multi-developer/federation features.
- Auto-load: `Skill("spike-findings-gsd-beads")` — phase 3 builds on findings in `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md` (BEADS_DIR canonical, post-checkout shim, fresh-clone bootstrap).
- Stack: bash + jq + bd CLI for hook scripts and tests (no Node, no Python). [VERIFIED: `tests/run-quick.sh` and existing 3 scripts]
- Sentinel-marker merging for any append into shared files. [VERIFIED: `BEGIN GSD-BEADS WORKTREE INIT v1` already in shim; new lock-preamble would use `BEGIN GSD-BEADS LOCK PREAMBLE v1`]
- 30-second timeout on the `bd-sync.sh` hook (settings.fragment.json:34). flock timeout MUST match (D-15).
- REQ-02: never write outside `~/.claude/{hooks,scripts}/` and `~/.local/bin/` from install.sh. Phase 3 mods to `install.sh` only add a backfill loop and a `flock` pre-flight — no new write targets.

## Sources

### Primary (HIGH confidence)
- Phase 2 `02-CONTEXT.md`, `02-VERIFICATION.md`, and shipping artifacts (`hooks/worktree-post-checkout.sh`, `hooks/bd-sync.sh`, `scripts/cascade-loop.sh`, `scripts/regen-roadmap.sh`, `scripts/regen-requirements.sh`, `install.sh`, `settings.fragment.json`, `tests/worktree-tests/*`, `tests/e2e/concurrent-merge.test.sh`) — read in full this session.
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md` — Spike 003 architecture (Approach C: source `.beads/` + `BEADS_DIR=<src>/.beads`).
- `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/README.md` — full Spike 003 validation harness; concrete numbers (40-process concurrent test → 0 ID collisions; ~3.25 writes/sec ceiling on embedded-dolt file lock).
- `.beads/.gitignore` — confirms `*.lock` already covers `.gsd-beads.lock`.
- [git-scm.com/docs/git-worktree](https://git-scm.com/docs/git-worktree) — porcelain output format, all attribute labels (worktree/HEAD/branch/bare/detached/locked/prunable), end-of-record semantics, `-z` flag.
- [git-scm.com/docs/git-rev-parse](https://git-scm.com/docs/git-rev-parse) — `--git-common-dir` semantics in linked worktrees.
- [man.kernel.org/linux/man-pages/man1/flock.1.html](https://man7.org/linux/man-pages/man1/flock.1.html) — flock(1) `-x`, `-w` decimal seconds, exit-code-on-timeout=1, fd-form recommended for shells.

### Secondary (MEDIUM confidence)
- [discoteq/flock README](https://github.com/discoteq/flock) + [Homebrew Formulae: flock](https://formulae.brew.sh/formula/flock) — macOS install path; util-linux flag compatibility for `-x`, `-w`, decimal seconds.
- [BashFAQ/045](https://mywiki.wooledge.org/BashFAQ/045) — mkdir-based locking pattern (rejected alternative; useful background).
- WebSearch + WebFetch on git-githooks docs — post-checkout hook signature `old_sha new_sha branch_flag` confirmed.

### Tertiary (LOW confidence — flagged for validation in plan-checker)
- Pitfall 5 specifics on `git worktree remove`'s gitdir housekeeping behavior. Validate experimentally in the simulation; capture in `WORKTREES-EVIDENCE.md`.

## Metadata

**Confidence breakdown:**
- Standard stack (flock, git worktree, jq): HIGH — all primitives empirically present in dev env; all flag semantics confirmed via official docs.
- Architecture patterns (lock preamble, backfill loop, simulation shape): HIGH — direct extensions of Phase 2 patterns; no novel design.
- Pitfalls: MEDIUM — Pitfalls 1-4 are derivable from primitive specs; Pitfall 5 (`git worktree remove` orphan behavior) needs experimental confirmation in the simulation.

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30-day stable window for git, flock, bd, embedded-dolt — all mature primitives)
