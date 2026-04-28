---
spike: 005
name: concurrent-merge
type: standard
validates: "Given two parallel processes mutating one issue (same and different fields) and rapid cross-process creates, when both writes complete, then both writes that touch different fields persist (no overwrite), same-field contention is last-writer-wins with no errors, and ID uniqueness holds under heavy concurrent load."
verdict: VALIDATED
related: [001, 002, 003, 004]
tags: [bd, concurrency, dolt, hash-ids, cell-merge, discovered-from, provenance]
---

# Spike 005: Concurrent Merge

## What This Validates

**Given** two parallel processes both writing to bd at the same time
(creating, updating, closing, linking),
**when** they target the same issue (different fields, same field) and
when they create new issues at high concurrency,
**then** different-field writes both persist without loss, same-field
writes resolve to last-writer-wins with neither erroring, and IDs
remain unique under load.

Validates **REQ-05** ("Conflict-free concurrent updates") and the
architecture's provenance claim that two agents in different worktrees
can `bd-newtask --discovered-from <task> --parent <phase>` simultaneously
without merge conflict.

## Research

The architecture promises "Dolt cell-level auto-merge" for concurrent
writes. In practice the **embedded** Dolt backend (default, used by
gsd-beads) handles concurrency via **file locking** rather than cell-merge
proper. Cell-merge applies to:

- **`--shared-server` mode** where multiple processes connect to one Dolt
  SQL server (cell-merge happens server-side)
- **`bd federation`** where two separate Dolt databases diverge and merge

For the gsd-beads MVP (embedded + `BEADS_DIR=<src>/.beads`), file lock is
sufficient — concurrent writes serialize, but no writes are lost. The
practical correctness is the same as cell-merge for the workflows we care
about.

**Approach comparison:**

| Approach | What it gives | Verdict |
|---|---|---|
| Embedded + file lock (default) | Serializes concurrent writes; ~3.25 writes/sec ceiling per machine; 0 collisions, 0 lost writes | **What gsd-beads MVP uses** |
| `--shared-server` | True concurrent SQL access via Dolt server; higher throughput | Documented escape hatch for heavy concurrency |
| `bd federation` | Cell-merge across separate Dolt DBs on different machines | Out of scope for MVP (single-developer audience) |

## How to Run

```bash
mkdir -p /tmp/spike5 && cd /tmp/spike5
git init -q -b main && echo "# spike5" > README.md && git add README.md && git commit -q -m "init"
bd init --non-interactive --skip-agents -p s5

TARGET=$(bd q "shared issue" -t task -p 2)

# Test 1: parallel different-field updates
( bd update "$TARGET" --priority 0 ) &
( bd update "$TARGET" --add-label "from-process-B" ) &
wait
bd show "$TARGET" --json | jq '.[0] | {priority, labels:.labels}'

# Test 2: heavy parallel label additions (10 from each process)
( for i in $(seq 1 10); do bd update "$TARGET" --add-label "lbl-A-$i"; done ) &
( for i in $(seq 1 10); do bd update "$TARGET" --add-label "lbl-B-$i"; done ) &
wait
bd label list "$TARGET"   # expect 21 labels (1 + 20)

# Test 3: same-field contention
( bd update "$TARGET" --description "from A" ) &
( bd update "$TARGET" --description "from B" ) &
wait
bd show "$TARGET" --json | jq -r '.[0].description'   # one of A or B; no error

# Test 5: discovered-from provenance
P12=$(bd q "Phase 12" -t epic)
P13_TASK=$(bd q "Working on Phase 13" -t task)
DISCOVERED=$(bd q "Realized we missed: rate limiting" -t task)
bd link "$DISCOVERED" "$P12" --type parent-child
bd link "$DISCOVERED" "$P13_TASK" --type discovered-from
bd show "$DISCOVERED" --json | jq '.[0].dependencies'   # both edge types
```

## What to Expect

| Test | Expected outcome |
|---|---|
| 1 — parallel different-field | Both writes persist: priority=0 (from A) AND label `from-process-B` (from B) |
| 2 — heavy parallel labels | All 20 labels added (10 from A + 10 from B), plus the pre-existing label = 21 total |
| 3 — same-field contention | Both processes exit 0; final value is one of A's or B's (last-writer-wins) |
| 4 — concurrent close | Both processes report `✓ Closed`; one reason persists |
| 5 — discovered-from | Issue has 2 dep edges in `bd show`: one parent-child + one discovered-from |
| 6 — parallel creation | 6/6 issues created from 2 processes; no errors; all unique IDs |

## Investigation Trail

**Iteration 1 — different-field parallel updates.**
Process A set `--priority 0` while Process B added a label. Both
succeeded; final state had both changes. ✓

**Iteration 2 — heavy parallel additions (10 + 10 labels).**
20 background `bd update --add-label` invocations. Result: 21/21 labels
present (20 new + 1 prior). 0 errors. Embedded Dolt's file lock
serialized the writes; no drops. ✓

**Iteration 3 — same-field contention (`--description`).**
Both processes successfully updated. Final description was Process A's
("description from process A"). bd does not error on simultaneous
same-field writes — last-writer-wins is the resolution. ✓ (Acceptable
for gsd-beads' single-developer use case where same-field same-time
contention is rare.)

**Iteration 4 — concurrent close.**
Both processes report `✓ Closed s5-liy: closed by <X>`. Final
`close_reason: "closed by B"` — last-writer-wins for the reason field
too. The close action itself is idempotent (both processes "succeed" —
the issue is closed regardless of which actually mutated the row).
✓ No errors, no broken state.

**Iteration 5 — `discovered-from` provenance edge.**
The architecture's claim: "An agent doing Phase 13 work that uncovers
missed Phase 12 work creates `bd-newtask --discovered-from bd-k1l2
--parent bd-c3d4` — provenance preserved." Verified directly:
- Created `s5-tvo "Realized we missed: rate limiting"` as a `task`
- Linked to `Phase 12` via `--type parent-child` (where the work
  *belongs*)
- Linked to the in-flight Phase 13 task via `--type discovered-from`
  (where the work *was uncovered*)
- `bd show s5-tvo --json` returns both edges with their distinct
  `dependency_type` markers

This is meaningfully better than markdown-based GSD's manual
`discovered-from` annotation because the relationship is structural and
queryable. ✓

**Iteration 6 — parallel-discovery race.**
Process A: created 3 tasks AND linked each to Phase 12. Process B:
created 3 tasks plain. 6/6 issues created, 0 errors, all unique IDs,
all 3 of A's parent-child links present. The architecture's "agents in
different worktrees can independently discover work without merge
conflict" claim holds. ✓

## Results

**Verdict: VALIDATED ✓**

Concurrent operations are safe under embedded Dolt + file locking:
- Different-field writes to the same issue: both persist.
- Same-field writes to the same issue: last-writer-wins, no errors.
- Concurrent close: idempotent; one reason wins.
- High-volume parallel creates: 0 collisions (combined with Spike 003's
  125 unique IDs across 40 processes, sample size is now strong).
- Discovered-from edges work; agents in parallel worktrees can record
  provenance without conflict.

**Concrete validations:**

1. **Different-field concurrent updates persist correctly.** Priority and
   label updates from different processes both end up in the final
   state.
2. **Heavy concurrent label additions: 21/21 (100%) preserved.**
3. **Same-field contention resolves to last-writer-wins.** No errors,
   no silent corruption, no need for explicit conflict resolution.
4. **Concurrent close is idempotent.** Both processes report success.
5. **`discovered-from` edge type is structural.** The architecture's
   provenance promise works.
6. **Parallel-discovery scenario is conflict-free.** Multiple agents
   creating + linking issues simultaneously produce unique, well-formed
   beads.

**Surprises and findings to carry forward:**

- **bd's "cell-merge" claim applies to server/federation modes, not
  embedded.** Embedded mode uses file locking. The practical effect is
  identical for gsd-beads' workflows — concurrent writes don't lose
  data — but worth documenting accurately. (Filed for the architecture
  doc revision in `/gsd-spike-wrap-up`.)

- **Same-field contention's last-writer-wins is a documented design
  choice, not a bug.** For gsd-beads, this is acceptable: agents
  rarely mutate the same field of the same issue at the same instant,
  and when they do, the resolution is intuitive.

- **`discovered-from` deserves promotion in the gsd-beads CLAUDE.md
  addendum.** It's the architecture's most differentiated feature vs
  markdown-based GSD — agents should know to use it whenever they file
  newly-discovered work, not just when filing within their own
  worktree.

**Impact on remaining spikes:** None. This is the last spike.

## Files

- This README (no scripts written — the spike is a sequence of shell
  commands captured in the Investigation Trail; logs at `/tmp/s5-*.log`
  during the run)
