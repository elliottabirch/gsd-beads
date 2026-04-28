# Beads Modeling

How gsd-beads maps GSD vocabulary onto beads' data model: types,
labels, parent-child relationships, cascade close, and concurrent-write
safety.

## Requirements

- **Type strategy: all-epic + labels.** Both requirement-level and phase-level beads use `type=epic`. Distinguish via labels:
  - `bd label add <id> gsd:requirement` for top-level
  - `bd label add <id> gsd:phase` for middle-level
  - tasks use built-in `type=task` (no label needed)
- **Cascade is a 5-line loop on `bd epic close-eligible`** (idempotent; safe to call repeatedly).
- **Always use `bd link --type parent-child`** for the requirement→phase→task hierarchy. NOT `bd dep add` (defaults to `blocks`, wrong semantics).
- **Use `bd label propagate`** to inherit labels down through children when restructuring.
- **`discovered-from` edge type is the architecture's signature feature.** When agents uncover work mid-phase, file with `bd link <new-task> <originating-task> --type discovered-from` (in addition to `--type parent-child` to its proper home).
- **Seeds map to beads issues with label `gsd:seed`** (deferred status), NOT to `bd remember` memories. Seeds are forward-looking work items; memories are persistent context.

## How to Build It

### Type + label mapping

| GSD concept | Beads encoding | Filter |
|---|---|---|
| Requirement | `type=epic` + `gsd:requirement` | `bd list --type=epic -l gsd:requirement` |
| Phase | `type=epic` + `gsd:phase` | `bd list --type=epic -l gsd:phase` |
| Task / plan | `type=task` | `bd list --type=task` |
| Seed | `type=task` + `gsd:seed` (deferred) | `bd list -l gsd:seed --deferred` |

Additional convention labels (for ROADMAP/REQUIREMENTS regeneration):
- `req-id:<ID>` — preserves the human-readable requirement ID (e.g. `req-id:AUTH-01`)
- `category:<slug>` — `category:auth`, `category:content`, etc.
- `version:v1` / `version:v2` / `version:out-of-scope`
- `milestone:<id>` — `milestone:v1.0`, `milestone:v1.1`

### Building a hierarchy

```bash
REQ=$(bd q "REQ-042: Email/password auth" -t epic -p 0)
bd label add "$REQ" gsd:requirement

P1=$(bd q "Phase 12: Auth backend" -t epic -p 1)
bd label add "$P1" gsd:phase
bd link "$P1" "$REQ" --type parent-child

T1=$(bd q "Hash passwords" -t task -p 2)
bd link "$T1" "$P1" --type parent-child
```

### Cascade-loop (the 5-line canonical close-up)

```bash
while :; do
  out=$(bd epic close-eligible 2>&1)
  echo "$out" | grep -q 'No epics eligible' && break
  echo "$out"
done
```

See `sources/002-beads-modeling/cascade-loop.sh` for the wrapped version
with iteration counting.

**Performance:** 0.86s on a 7-issue / 2-iteration fixture (Spike 002).

### Tree rendering

Use `bd children <id>` (NOT `bd dep tree` — that walks `blocks` deps,
not parent-child). `bd list` also renders parent-child trees with
`├──`/`└──` characters.

### Discovered-from provenance

```bash
DISCOVERED=$(bd q "Realized we missed: rate limiting" -t task -p 1)
bd link "$DISCOVERED" "$PROPER_PHASE" --type parent-child
bd link "$DISCOVERED" "$IN_FLIGHT_TASK" --type discovered-from
```

`bd show <id> --json` returns both edges with their distinct
`dependency_type` markers. Two agents in different worktrees can record
provenance simultaneously without merge conflict.

### Concurrent write safety (Spike 005)

- **Different-field updates from parallel processes both persist.** No
  lost writes.
- **Same-field contention is last-writer-wins.** No errors, no
  corruption.
- **Concurrent close is idempotent.** Both processes report `✓ Closed`;
  one reason persists.
- **Hash-based ID uniqueness holds under load.** 125 beads created
  across 40 concurrent processes from 2 worktrees: 0 collisions.

Embedded Dolt's file-locking serializes concurrent writes (~3.25
writes/sec ceiling per machine). Practical throughput is fine for
single-developer workflows; `--shared-server` is the documented escape
hatch for heavy concurrency.

## What to Avoid

- **DON'T use custom types `requirement`/`phase`.** Approach B (all-epic
  + labels) is 3× faster (0.86s vs 2.7s on 7-issue fixture), uses bd's
  built-in tooling, and benefits from future bd cascade improvements
  automatically. Custom types put bd's `bd epic status` etc. out of
  reach.
- **DON'T use `bd dep add` for parent-child.** Defaults to `blocks`,
  which is the wrong semantics. The dep-tree shows nothing meaningful.
- **DON'T use `bd dep tree` to render the GSD hierarchy.** Walks
  `blocks` deps, not parent-child. Use `bd children <id>`.
- **DON'T treat `bd dolt push` as cross-worktree sync.** It's
  federation/remote sync. Local cross-worktree is automatic via shared
  BEADS_DIR.
- **DON'T expect `bd close <leaf>` to auto-cascade up.** It doesn't —
  cascade requires explicit `bd epic close-eligible` (or our
  cascade-loop).
- **DON'T put project conventions in CLAUDE.md.** Use bd memories under
  `gsd-beads:` namespace (auto-surfaced by `bd prime`).

## Constraints

- bd v1.0.3 (npm install -g @beads/bd)
- jq required for JSON manipulation
- `bd epic close-eligible` only operates on `type=epic` (which is why
  we use type=epic for both requirement and phase levels)
- `bd config set types.custom` warns "not a recognized config key" but
  accepts it and works correctly (we don't need this since we chose
  Approach B)
- `bd label propagate` exists for label inheritance — use it when
  restructuring
- `bd export` includes memories by default; use `--no-memories` if you
  want to exclude them (we don't — memories are content we want to
  preserve)

## Origin

Synthesized from spikes: 002 (beads-modeling), 005 (concurrent-merge)
Source files available in: sources/002-beads-modeling/, sources/005-concurrent-merge/
