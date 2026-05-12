> ⚠ PLACEHOLDER — SUPERSEDED BY PLAN 06-07
>
> Plan 06-07 Task 3 replaces this file wholesale once the full Phase 6
> implementation (Plans 06-02 through 06-06) has landed.

# gsd-beads — Project Context

Sibling repo of [`gsd-build/get-shit-done`](https://github.com/gsd-build/get-shit-done)
(fork at `feat/storage-adapter`; fork package name `get-shit-done-cc`).
Implements `BeadsAdapter` against the StorageAdapter contract.

See `../get-shit-done/.planning/PROJECT.md` for full architecture and the
two-repo model rationale (D-2026-04-30-02).

## Development

This repo depends on the fork via `"get-shit-done-cc": "file:../get-shit-done"`
in `devDependencies`. The fork must be at `/Volumes/code/get-shit-done` with
the `./conformance` subpath export live (fork Plan 06-01 Tasks 1+2 landed on
commit `7c564a72` on the `feat/storage-adapter` branch).

```bash
cd /Volumes/code/gsd-beads
npm install        # resolves file-linked fork
npm run build      # tsc → dist/
npm test           # vitest run (conformance + smoke)
```

## Branch strategy

- `main` — stable. Merged post-Phase-6-ship.
- `v0.2-archive` — pre-reset history (2026-05-11; sibling's v0.2 work frozen
  at `5082d45f13f39d4e1a694936788f5b362ad1ba36`).
- `feat/phase-6-reset` — Plan 06-01's destructive prune and scaffold landed
  here; subsequent plans branch off OR stay on this until Phase 6 completes.

## bd CLI dependency

Every plan after 06-02 requires `bd` on PATH. The sibling's empirical Phase-7
work pinned v1.0.3 (`1b2dd2cb`); the author's current install is v1.0.4. Plan
06-03 spike re-verifies landmines against the installed build before any
plan-06-05+ work lands.

```bash
bd --version   # prints: bd v1.0.3 (or compatible point release); currently v1.0.4 locally
```

Plan 06-03 spike fail-fasts on `command -v bd` missing.

## Post-reset scaffold state (what is actually present on this commit)

- `src/index.ts` — BeadsAdapter class (22 methods; all throw
  `NotYetImplementedError`), dual export (`class` + `default`).
- `src/capabilities.ts` — frozen `Capabilities` literal; 9-key shape matching
  fork's `types.ts` with `graphEdges: {semantic: false, dependency: true}`.
- `src/errors.ts` — `NotYetImplementedError` only. Plan 06-02 adds
  `BeadsCause` enum + `BdManagedMismatchError` per D-INIT-ERR.
- D-SCAFFOLD carry-forward whitelist (14 `.mjs` files under `src/bd/`,
  `src/helpers/`, `src/format/`, `src/adapter/`, `tests/fixtures/`) — untouched
  `.mjs` pending port. Plans 06-02 (bd/helper + findRoot + errors +
  _atomicWrite) and 06-04 (format/* + paths.ts) do the ports.
- `tests/conformance.test.ts` — invokes fork's `runAdapterConformanceSuite`.
  Currently expected to FAIL citing `NotYetImplementedError` — that's the
  red→green gate.
- D-TXN / D-MAPPING spike — NOT YET RUN. Plan 06-03 runs, produces
  `SPIKE-RESULTS.md`, locks outcomes. Until then, `src/txn/*.ts`,
  `src/events.ts`, `src/format/*.ts`, `src/paths.ts`, `src/dep-graph.ts`,
  `src/init.ts` do not exist.

## Landmines to avoid (authoritative catalog lives in fork)

See the fork's [`.claude/skills/spike-findings-gsd-beads/landmines.md`](../get-shit-done/.claude/skills/spike-findings-gsd-beads/landmines.md)
and `06-CONTEXT.md §Landmines` for the canonical 13-row table. CRITICAL items
(path-traversal guard, CWD propagation in bd wrapper, `--author` on
`bd comments add` not `--label`, array-unwrap on `bd show`, JSONL fallback
for `bd export --json`, `{error, schema_version}` empty detection) are baked
into Plans 06-02 (helper wrapper) and 06-05 (primitives).

## Phase 6 implementation status

- [x] Plan 06-01 — scaffold + fork-side contract changes (2026-05-11)
- [ ] Plan 06-02 — port bd/ + helpers/ + _atomicWrite (TS + landmine fixes)
- [ ] Plan 06-03 — bd v1.0.x dual spike (D-MAPPING + D-TXN)
- [ ] Plan 06-04 — port format/ + paths.ts + BdManagedMismatchError
- [ ] Plan 06-05 — Bin A primitives + init() probe + writeBinaryAsset throw
      (BEADS-01, BEADS-04, BEADS-05)
- [ ] Plan 06-06 — 3 recordState* families + withTransaction + dep-graph
      synthesizer (BEADS-02, BEADS-03)
- [ ] Plan 06-07 — smoke tests + README finalization + Phase 6 exit checkpoint
