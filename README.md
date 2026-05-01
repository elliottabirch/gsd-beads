# gsd-beads

> BeadsAdapter — bd-backed StorageAdapter implementation for the get-shit-done planning workflow.

**Status:** v1.0-alpha (in flight). Phases 6-13 of milestone v1.0
are scoped; Phase 6 (cleanup + scaffolding) ships first; Phases
7-13 fill in the adapter contract surface against
`~/code/get-shit-done`'s StorageAdapter interface.

## What this is

`gsd-beads` is the **BeadsAdapter** implementation of the
`StorageAdapter` interface defined by the get-shit-done fork at
`~/code/get-shit-done` (branch `feat/storage-adapter`). It is a
sibling adapter library — consumed by the fork at runtime via
`peerDependencies`, NOT installed into `~/.claude/`.

Use it when you have `get-shit-done-cc` (the fork) installed AND
want bd-backed planning state (issue/dependency tracking via
`bd`) instead of the default markdown view.

## Install

The fork is unpublished; during development, link locally:

```bash
cd ~/code/get-shit-done
npm link

cd ~/code/gsd-beads
npm run link:fork    # equivalent to: npm link get-shit-done-cc
```

See `CONTRIBUTING.md` for the full dev workflow.

Once the fork publishes:

```bash
npm install gsd-beads
```

> **Note:** v0.2's `install.sh` (system layer distribution) was
> archived in Phase 6 — `gsd-beads` is now a library, not a hook
> layer. See `archive/v0.2-shadow/` for historical reference.

## Configure

In your project's `.planning/config.json` (consumed by the fork):

```json
{ "storage": { "adapter": "beads" } }
```

The fork's `StorageAdapter` resolution loads `BeadsAdapter` from
this package.

## Method coverage

The BeadsAdapter implements the SYNTHESIS.md §4 catalog (~75
deduplicated named methods, ~270 stubs across 8 SYNTHESIS cluster
boundaries). v1.0-alpha ships ALL stubs throwing
`BeadsAdapter.<method>: not implemented (Phase N / IMPL-NN)`;
Phases 7-13 fill them in.

## Architecture

```
+--------------------------+        +----------------------------+
|  ~/code/get-shit-done    |        |    ~/code/gsd-beads        |
|  (fork; consumer)        |  uses  |    (this repo; adapter)    |
|                          |<------>|                            |
|  StorageAdapter interface|  via   |  BeadsAdapter class        |
|  MarkdownAdapter (default)        |  Bin A primitives          |
|                          |        |  6 foundational primitives |
|                          |        |  ~270 cluster methods      |
+--------------------------+        +----------------------------+
                                             |
                                             v
                                   +----------------------+
                                   |  bd CLI (issue tracker)|
                                   +----------------------+
```

### Refactor-on-fork-stabilize policy

`gsd-beads` implements against `SYNTHESIS.md §4` in parallel with
the fork's interface evolution. Expect 10-30% method-signature
churn when the fork's contract stabilizes. This is the planned
cost of parallel development; the alternative (waiting for fork
Phase 1) was rejected per `D-2026-04-30-01`.

## Multi-worktree

v1.0 ships without an automatic multi-worktree helper.
Adapter consumers handle `BEADS_DIR` cross-worktree manually; see
`docs/WORKTREES.md` for the recipe (carry-forward from v0.1).

## Repo layout

```
gsd-beads/
├── src/
│   ├── adapter.mjs            # BeadsAdapter shell
│   ├── adapter/               # 8 cluster method bags
│   ├── bd/                    # bd CLI wrappers (helper, errors, findRoot)
│   ├── helpers/               # parsing helpers (parsePhaseId, etc.)
│   └── format/phase.mjs       # bidirectional phase parser
├── tests/
│   ├── unit/                  # node --test unit tests
│   ├── conformance/           # cross-adapter parity (Phase 7+)
│   └── fixtures/              # canonical seed.jsonl + helpers
├── archive/v0.2-shadow/       # v0.2 shadow code preserved
├── docs/                      # WORKTREES.md, etc.
└── .planning/                 # GSD planning state
```

## License

ISC
