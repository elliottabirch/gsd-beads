---
spike: 004
name: jsonl-roundtrip
type: standard
validates: "Given a populated bead store with epics + tasks + parent-child links + labels + close_reasons + notes, when bd export -o issues.jsonl runs and the store is reconstructed via bd init --from-jsonl in a fresh clone, then the resulting graph is semantically equivalent — same beads, same edges, same labels, same statuses, same metadata."
verdict: VALIDATED-WITH-WORKAROUND
related: [001, 002, 003]
tags: [bd, jsonl, portability, fresh-clone-bootstrap, prefix-preservation]
---

# Spike 004: JSONL Roundtrip

## What This Validates

**Given** a fully populated bead store with realistic gsd-beads features
(epics + tasks, parent-child links, custom labels, custom close_reasons,
notes, post-cascade closures),
**when** `bd export -o issues.jsonl` writes it out and a fresh `git clone`
runs `bd init --from-jsonl` to rebuild the embeddeddolt cache,
**then** the resulting bead store is semantically equivalent to the original
— modulo one prefix-preservation gap with a documented workaround.

This spike's importance went up substantially after Spike 003 reshaped to
**Approach C** (non-stealth + `BEADS_DIR=<src>/.beads`): the JSONL roundtrip
is now the **fresh-clone bootstrap path**. A teammate (or your own laptop
fresh-cloning your work) gets only the committed `.beads/` directory minus
the `embeddeddolt/` binary cache; `bd init --from-jsonl` reconstructs it.

## Research

`bd export` exports all issues (plus memories, by default) as JSONL
where each line is one issue with its labels, dependencies, and comments.
`bd init --from-jsonl` reads `.beads/issues.jsonl` and rebuilds the
embedded Dolt cache from it.

**Approach comparison:**

| Approach | Pros | Cons | Status |
|----------|------|------|--------|
| `bd backup export-git` + `bd backup restore` | Designed for backup/restore; preserves more state | Heavier; requires explicit backup/restore commands; doesn't fit fresh-clone-via-`git clone` flow | Not the right tool for this workflow |
| **`bd init --from-jsonl`** | Single command; integrates with `git clone` flow; preserves all roundtrip-essential fields | Doesn't auto-pick up the original prefix from metadata.json | **Chosen** (with workaround) |
| Custom JSON migration | Could solve prefix gap | Reinvents what bd already does | Rejected |

## How to Run

```bash
# Source: realistic populated bead store
mkdir -p /tmp/spike4-source && cd /tmp/spike4-source
git init -q -b main && echo "# spike4" > README.md && git add README.md && git commit -q -m "init"
bd init --non-interactive --skip-agents -p s4

# Build hierarchy: 1 req + 2 phases + 4 tasks, with labels + parent-child
REQ=$(bd q "REQ-001: Auth system" -t epic -p 0)
P1=$(bd q "Phase 1: Backend" -t epic -p 1)
P2=$(bd q "Phase 2: Frontend" -t epic -p 1)
T1=$(bd q "Hash passwords" -t task -p 2)
T2=$(bd q "Login endpoint" -t task -p 2)
T3=$(bd q "Login form" -t task -p 2)
T4=$(bd q "Error states" -t task -p 2)

bd label add "$REQ" gsd:requirement
bd label add "$P1" gsd:phase ; bd label add "$P2" gsd:phase
bd label add "$T3" needs-design

bd link "$P1" "$REQ" --type parent-child
bd link "$P2" "$REQ" --type parent-child
bd link "$T1" "$P1" --type parent-child ; bd link "$T2" "$P1" --type parent-child
bd link "$T3" "$P2" --type parent-child ; bd link "$T4" "$P2" --type parent-child

bd close "$T1" "$T2" --reason "merged in PR #42"
/path/to/cascade-loop.sh   # closes Phase 1 (Backend) via cascade
bd update "$T3" --notes "Designer signed off; ready to start"

bd export -o .beads/issues.jsonl
git add .beads && git commit -q -m "snapshot"

# Bootstrap the fresh clone
git clone file:///tmp/spike4-source /tmp/spike4-clone
cd /tmp/spike4-clone
bd init --from-jsonl \
  --prefix "$(jq -r .dolt_database .beads/metadata.json)" \
  --non-interactive --skip-agents
```

## What to Expect

- 7 beads in the original; 7 in the restored clone — same IDs.
- `bd children <REQ>` from the clone produces an identical tree to the
  source.
- `close_reason: "merged in PR #42"` survives verbatim. `close_reason:
  "All children completed"` (bd's auto-cascade marker) survives.
- All 3 unique labels (`gsd:requirement`, `gsd:phase`, `needs-design`)
  preserved with correct attachment counts (1, 2, 1).
- `notes: "Designer signed off; ready to start"` round-trips.
- `issue_type` (`epic` vs `task`) preserved.
- `config.yaml` is byte-identical pre vs post (since it's a tracked file).
- New issues created in the clone after `bd init --from-jsonl --prefix s4`
  use the original `s4-*` prefix.
- **Without the explicit `--prefix` flag, new issues use the clone
  directory's name as the prefix** (e.g., `spike4-clone-pjw`) — surprising
  and worth a documented bootstrap step.

## Investigation Trail

**Iteration 1 — build a realistic source.**
Built a 7-bead hierarchy in `/tmp/spike4-source/`:
- 1 epic labeled `gsd:requirement` (REQ-001: Auth system)
- 2 epics labeled `gsd:phase` (Phase 1, Phase 2)
- 4 tasks (3 with no extra labels, 1 with `needs-design`)
- All linked parent-child requirement → phases → tasks
- Closed T1 + T2 with `--reason "merged in PR #42"`
- Ran `cascade-loop.sh` → Phase 1 auto-closed with `close_reason: "All
  children completed"`
- Set notes on T3: "Designer signed off; ready to start"

`bd export -o .beads/issues.jsonl` produced 7 lines. Committed `.beads/`.

**Iteration 2 — fresh clone bootstrap.**
`git clone` to `/tmp/spike4-clone/`. The clone has `issues.jsonl`,
`config.yaml`, `metadata.json`, `hooks/`, `.gitignore` — but no
`embeddeddolt/`. `bd list` from the clone errors with "no beads
database found" (graceful — exit 3, the documented "no DB, skip" code).

`bd init --from-jsonl --non-interactive --skip-agents` succeeded.
`bd list` from the clone now shows the full tree, identical to the source.

**Iteration 3 — semantic equivalence diff.**

| Field | Status |
|---|---|
| Bead count (7 vs 7) | ✓ identical |
| All 7 IDs | ✓ identical (sorted set match) |
| `status` per ID | ✓ identical (no diff) |
| `close_reason` per closed ID | ✓ identical, including bd's auto-cascade marker `"All children completed"` and the custom `"merged in PR #42"` |
| Labels (3 unique, 4 attachments) | ✓ all preserved |
| Parent-child tree (`bd children`) | ✓ identical structure and indentation |
| `notes` (T3) | ✓ exact string preserved |
| `issue_type` per ID | ✓ identical (`epic` for top-3, `task` for leaves) |
| `config.yaml` | ✓ byte-identical (it's a tracked file, just survived the clone) |

**Iteration 4 — issue prefix preservation FAILED on default restore.**
Created a new issue post-restore: `bd q "fresh issue post-restore"`.
**Got: `spike4-clone-pjw`** — using the new clone directory's name as
prefix. **Expected: `s4-<hash>`** to match the original prefix.

The metadata.json in the clone correctly contains
`"dolt_database": "s4"` (the original prefix), but bd's
`--from-jsonl` flow doesn't read it. Existing IDs in the JSONL are
preserved as literal strings, but new issues created post-restore use
the new prefix, producing inconsistent IDs in one project's history.

**Iteration 5 — explicit `--prefix` workaround.**
Re-ran in a fresh clone with `bd init --from-jsonl --prefix s4`.
Result: `s4-7qp` for the new issue. ✓ prefix preserved.

The bootstrap command for gsd-beads should read the prefix from
metadata.json explicitly:

```bash
bd init --from-jsonl \
  --prefix "$(jq -r .dolt_database .beads/metadata.json)" \
  --non-interactive --skip-agents
```

**Iteration 6 — restored clone is fully operational.**
- Created a new issue: works, gets correct prefix.
- Closed T3 + T4 + ran cascade-loop: cascaded Phase 2 + the
  requirement, both reaching ✓ closed.
- Re-export: 8 beads (7 original + 1 new). JSONL is well-formed and
  could roundtrip again.

## Results

**Verdict: VALIDATED-WITH-WORKAROUND ✓**

JSONL roundtrip preserves everything that matters for gsd-beads
workflows. New-clone bootstrap works. The single non-obvious gotcha is
prefix preservation, which has a one-line workaround that gsd-beads'
bootstrap script will encode.

**Concrete validations:**

1. **`bd init --from-jsonl` reconstructs an equivalent graph** — IDs,
   statuses, dependencies, labels, close_reasons, notes, issue_type all
   round-trip cleanly.
2. **bd's auto-cascade marker `close_reason: "All children completed"`
   survives** — useful for distinguishing manual vs cascade closes in
   regenerated views, even after a clone.
3. **`config.yaml` is git-tracked, so types.custom + custom statuses
   survive trivially.**
4. **The reconstructed clone is fully workable** — new issues, cascade,
   labels, all subsequent operations work normally.

**Surprises:**

- **Prefix preservation requires explicit `--prefix` from metadata.json.**
  Filed as a critical step in the gsd-beads bootstrap script. Without
  it, IDs in one project will diverge in prefix between pre-clone and
  post-clone eras. (Filed as a candidate bd upstream issue: "respect
  metadata.json's dolt_database as the default prefix on
  --from-jsonl".)
- **`.beads/` permission warning.** bd recommends 0700 on `.beads/`;
  fresh clones get 0755. Cosmetic but should be in the bootstrap script.
- **`bd export` includes memories by default.** If gsd-beads uses
  `bd remember` for any state we don't want round-tripped through the
  JSONL (e.g., per-machine credentials), use `--no-memories`. Out of
  scope for the MVP — both seeds and memories are content we DO want
  preserved.

**Impact on remaining spikes:**
- Spike 005 (concurrent-merge): proceed. The 40-process load test in
  spike 003 already partially pre-validated; spike 005 should focus on
  same-issue concurrent updates.

**Phase 2 implementation requirements (filed in MANIFEST):**

- `gsd-beads bootstrap` script does:
  ```bash
  prefix=$(jq -r .dolt_database .beads/metadata.json 2>/dev/null || basename "$PWD")
  bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents
  chmod 700 .beads
  ```
- This is invoked once per fresh clone of a gsd-beads-managed repo.
- Could be auto-triggered by gsd-beads' SessionStart Claude Code hook
  if `.beads/embeddeddolt/` is missing — minimum-friction setup.

## Files

- `roundtrip-test.sh` — captured test sequence (Iterations 1–4)
- `original-export.jsonl` — pre-roundtrip JSONL (7 issues)
- `restored-export.jsonl` — post-roundtrip JSONL (7 issues)
- `original-config.yaml` — config snapshot for diffing
