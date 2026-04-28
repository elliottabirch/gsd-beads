---
spike: 003
name: cross-worktree-sharing
type: standard
validates: "Given two git worktrees of one project both setting BEADS_DIR to a single shared directory, when worktree-A creates/updates/closes issues, then worktree-B's bd list reflects the change immediately without any explicit sync command — and vice versa, including under concurrent load, with no ID collisions."
verdict: VALIDATED
related: [001, 002]
tags: [bd, worktrees, BEADS_DIR, embedded-dolt, hash-ids, concurrency]
---

# Spike 003: Cross-Worktree Sharing

## What This Validates

**Given** two git worktrees of one project both pointing
`BEADS_DIR=/path/to/shared/.beads`,
**when** worktree-A creates/updates/closes issues OR creates parent-child
links OR runs the cascade-loop,
**then** worktree-B's `bd list` reflects every change with no manual
sync — even under concurrent multi-process load — and hash-based IDs
remain unique.

Validates **REQ-03** (cross-worktree state sharing) directly and provides
strong evidence for **REQ-05** part 2 (hash-based ID uniqueness under
concurrent load).

## Research

**Three storage modes** are available in beads (per `bd init --help`):

| Mode | Init flag | Storage | Concurrency model |
|---|---|---|---|
| **Embedded (default)** | `bd init` | `.beads/embeddeddolt/` per project | Each `bd` invocation opens, reads/writes via Dolt file locking, closes. Concurrent processes serialize. |
| External server | `bd init --server --server-host ... --server-port ...` | `dolt sql-server` you start yourself | True concurrent SQL connections |
| Shared server | `bd init --shared-server` | `~/.beads/shared-server/` (one global server, all projects share) | True concurrent SQL connections, single bd-managed server |

`BEADS_DIR` overrides the default git-repo-discovery for any of these
modes. For embedded mode, two worktrees pointing at the same `BEADS_DIR`
both open the same `embeddeddolt/` files — Dolt's file locking prevents
corruption.

**Approach comparison:**

| Approach | Pros | Cons | Status |
|----------|------|------|--------|
| `BEADS_DIR=/shared/.beads` + embedded | Trivial setup; no daemon to manage; works with `bd init --stealth` | Concurrent writes serialize (no parallel speedup); ~3 writes/sec ceiling on this machine | **Chosen** |
| `--shared-server` mode | True concurrent SQL access; no per-write file-lock overhead | Requires the shared dolt server to be running; one more daemon to manage | Documented as escape hatch for heavy concurrency |
| Manual JSONL sync | Git-trackable; explicit | High latency, manual; doesn't match REQ-03's "without manual sync" | Rejected |

**Chosen approach:** `BEADS_DIR=<shared>/.beads` + embedded mode. Validated
end-to-end below. The `--shared-server` mode is available if heavy
concurrent-write workloads emerge in real use; for the gsd-beads MVP's
single-developer audience this is unlikely.

## How to Run

```bash
# 1. Source repo + two worktrees
mkdir -p ~/code/gsd-beads-wt-source && cd ~/code/gsd-beads-wt-source
git init -q -b main && echo "# wt-test" > README.md
git add README.md && git commit -q -m "init"
git worktree add ../gsd-beads-wt-A -b feature-a
git worktree add ../gsd-beads-wt-B -b feature-b

# 2. Initialize the shared bead store from worktree-A
SHARED=~/code/gsd-beads-wt-shared
mkdir -p "$SHARED"
cd ~/code/gsd-beads-wt-A
BEADS_DIR="$SHARED/.beads" bd init --stealth --non-interactive --skip-agents -p wttest

# 3. Sequential cross-worktree (A writes, B reads, vice versa)
BEADS_DIR="$SHARED/.beads" bd q "from A" -t task -p 2
cd ~/code/gsd-beads-wt-B
BEADS_DIR="$SHARED/.beads" bd list   # ← sees A's issue immediately

# 4. Cross-worktree cascade test
# Build epic+leaves split across worktrees, close from B, cascade from A
# (see captured test output in this README)

# 5. Concurrent load test (40 simultaneous creates from both worktrees)
( cd ~/code/gsd-beads-wt-A && for i in $(seq 1 20); do
    BEADS_DIR="$SHARED/.beads" bd q "concur-A-$i" -t task -p 3 &
  done; wait ) &
( cd ~/code/gsd-beads-wt-B && for i in $(seq 1 20); do
    BEADS_DIR="$SHARED/.beads" bd q "concur-B-$i" -t task -p 3 &
  done; wait ) &
wait
```

## What to Expect

- Sequential A→B and B→A read/write: every change visible immediately.
- Cross-worktree cascade: A creates an epic, A and B each add a leaf
  task, B closes both leaves, A runs `cascade-loop.sh` which sees
  the closed leaves and closes the epic.
- 40 concurrent `bd q` invocations: all succeed, all IDs unique, no
  errors. Concurrent total time ~14.8s vs sequential 12.3s — embedded
  Dolt serializes writes via file locking; no race-window for collisions.

## Investigation Trail

**Iteration 1 — sanity check: A→B sequential.**
Created two worktrees + a `~/code/gsd-beads-wt-shared/` shared dir.
`BEADS_DIR="$SHARED/.beads" bd init --stealth --non-interactive --skip-agents`
from worktree-A populated `~/code/gsd-beads-wt-shared/.beads/`.
A created `wttest-lan: hello from A`. B's `bd list` (same `BEADS_DIR`)
showed it. ✓

**Iteration 2 — bidirectional + close.**
B created another issue and closed A's issue. A's `bd list --status all`
showed both, with A's issue marked ✓ closed. No `bd dolt push` or any
sync command needed. ✓

**Iteration 3 — cross-worktree cascade.**
Built a hierarchy split across worktrees:
- worktree-A created epic `wttest-h4n` and leaf `wttest-4tj`, linked them
- worktree-B created leaf `wttest-d7e`, linked to the epic, closed both
  leaves
- worktree-A ran `cascade-loop.sh` (from spike 002) — it saw the closed
  leaves and closed the epic in 1 iteration

This is the most important real-world test: it proves an agent in one
worktree can pick up where an agent in another worktree left off, with
no human intermediation. ✓

**Iteration 4 — concurrent load (40 parallel writes).**
20 background `bd q` processes from each worktree. Result:
- All 40 writes succeeded
- 0 ID collisions
- Total time 14.8s (concurrent) vs 12.3s (40-write sequential from one
  worktree)

The concurrent case is **slower** than sequential — embedded Dolt's file
locking serializes writes. This is fine for correctness (no races, no
collisions) but means we don't get parallel speedup. Throughput on this
machine: ~3.25 writes/sec.

**Iteration 5 — `--shared-server` mode probe.**
Available but requires running the dolt SQL server. Did not init
fully — for the single-developer MVP audience, embedded + BEADS_DIR
suffices. Documented as escape hatch.

## Results

**Verdict: VALIDATED ✓**

`BEADS_DIR` does exactly what the architecture said it does. Two
worktrees pointing at the same shared directory see identical state with
zero manual sync, including across realistic agent workflows like
"agent in worktree-B closes the leaves I created in worktree-A; my
cascade-loop in worktree-A picks them up and closes the epic."

**Concrete validations:**

1. **Shared `BEADS_DIR` works for sequential cross-worktree.** A and B
   see each other's writes the moment they happen.
2. **Cross-worktree cascade works.** Spike 002's `cascade-loop.sh` is
   worktree-agnostic — it operates on whatever bead store `BEADS_DIR`
   points at.
3. **Hash-based IDs don't collide under concurrent load.** 40 parallel
   creates from 2 worktrees produced 40 unique IDs.
4. **Embedded Dolt serializes concurrent writes safely.** No corruption,
   no lost writes, no errors. ~3.25 writes/sec ceiling on this machine.
5. **No explicit sync command is needed** between worktrees pointing at
   the same `BEADS_DIR`. (`bd dolt push` is for federation to remote
   peers, not local cross-worktree.)

**Surprises and findings to carry forward:**

- **Concurrent embedded writes serialize, they don't speed up.** Heavy
  parallel-write workloads (e.g., importing 1000 beads at once) will be
  bottlenecked by the file lock. For gsd-beads MVP this is fine, but
  document the existence of `--shared-server` as a relief valve. (Filed
  as a Phase 2+ optimization opportunity, not a blocker.)

- **Stealth mode is per-worktree, not shared.** Each worktree's
  `.git/info/exclude` was configured independently when `bd init` was
  run. If a user adds a third worktree later, they'd need to re-run
  `bd init --setup-exclude` (or `bd init --reinit-local`) in the new
  worktree to keep beads files hidden. Filed as a Requirement.

- **Issue prefix is shared across worktrees.** All beads in this spike
  used the `wttest-` prefix configured at init time. Worktree-B never
  had a chance to set its own prefix because the prefix lives in the
  bead store config (.beads/config.yaml), not in any worktree-local
  state.

- **`bd dolt push` is for remote federation, NOT local sync.** Critical
  to clarify in the gsd-beads CLAUDE.md addendum so agents don't
  unnecessarily run it after every local cross-worktree change.

**Impact on remaining spikes:**
- Spike 004 (jsonl-roundtrip): proceed. Auto-export validated; full
  roundtrip still to test.
- Spike 005 (concurrent-merge): the 40-parallel test here is partial
  pre-validation. Spike 005 should focus on the harder case: two
  processes mutating different fields of the SAME issue (vs different
  issues here).

## Files

- This README (no scripts written — the spike is a sequence of shell
  commands documented in the Investigation Trail)
- The shared bead store lives at `~/code/gsd-beads-wt-shared/.beads/`
  (not committed; see `sandbox-link.md` in spike 002 for the rationale
  on keeping bd sandboxes out of the project tree)
