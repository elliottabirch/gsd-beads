> ⚠ PLACEHOLDER — SUPERSEDED BY PLAN 06-07
>
> This document is a scaffold-era placeholder. Plan 06-07 Task 3 replaces it
> wholesale once Plans 06-02..06-06 have landed and `SPIKE-RESULTS.md`
> (Plan 06-03) is committed with locked D-TXN and D-MAPPING outcomes.
> Until that replacement ships, the content below describes the post-reset
> scaffold state — every BeadsAdapter method throws `NotYetImplementedError`
> and the D-TXN / D-MAPPING spike has not yet run.

# gsd-beads

BeadsAdapter — a [`get-shit-done-cc`](https://github.com/gsd-build/get-shit-done)
[StorageAdapter](https://github.com/gsd-build/get-shit-done/blob/feat/storage-adapter/adapters/types.ts)
implementation targeting the [`bd`](https://github.com/TODO-add-bd-upstream) CLI.

## Post-reset status (2026-05-11)

**v1.0.0-alpha.0** — scaffold only. Plan 06-01 wired the `BeadsAdapter` class,
dual export, 9-key `Capabilities` literal, and fork-conformance invocation;
every method throws `NotYetImplementedError`. Implementation lands across
Plans 06-02 through 06-07.

Open questions that v1.0 shipping docs (Plan 06-07 rewrite) will answer:

- **D-TXN outcome (A/B/C)** — selected by Plan 06-03 bd-primitive spike.
  Corresponds to `capabilities.snapshot` value at runtime (A: `false`,
  B or C: `true`).
- **D-MAPPING outcome (A/B)** — same spike. Controls whether L2 sections use
  bd sub-records (A) or labels-first + description round-trips (B).
- **bd CLI version pin** — bd v1.0.4 is currently installed on the author's
  machine. The sibling's empirical Phase-7 work pinned bd v1.0.3. Plan 06-03
  spike re-verifies landmines against the installed build and records the
  diff in `SPIKE-RESULTS.md §1`.

## Known (interim) capability declaration

From `src/capabilities.ts` — frozen literal driven by D-OQ06, D-BINARY,
D-TXN-CAPS:

| Key | Value | Provenance |
| --- | --- | --- |
| `record` | `true` | Bin A contract |
| `section` | `true` | Bin A contract |
| `frontmatter` | `true` | Bin A contract |
| `binaryAsset` | `false` | **D-BINARY** — skip-and-warn; `writeBinaryAsset` throws `UnsupportedCapabilityError` |
| `snapshot` | `true` (tentative) | Plan 06-03 may flip to `false` if D-TXN Outcome A ships |
| `transaction` | `true` | **D-TXN-CAPS** — all 3 outcomes declare true |
| `namedDoc` | `true` | bd memory + path-sniff map (Plan 06-05 / 06-06) |
| `markdownLockfile` | `false` | bd is not a markdown lockfile format |
| `graphEdges.semantic` | `false` | **D-OQ06** — graphify.cjs does not target bd in v1.0 |
| `graphEdges.dependency` | `true` | **D-OQ06** — dep-edge synthesizer consumes bd `blocks` edges |

## Development (during Phase 6)

```bash
cd /Volumes/code/gsd-beads
npm install     # resolves fork via file:../get-shit-done (package name: get-shit-done-cc)
npm run build   # tsc → dist/
npm run typecheck  # same as build --noEmit; contract type-check gate

# Conformance run (expected RED until Plans 06-05/06-06 land):
npx vitest run tests/conformance.test.ts
# Expected output: failures citing NotYetImplementedError — that IS the gate signal.
```

## Carry-forward from v0.2

The sibling's full v0.2 history is preserved at the `v0.2-archive` branch
(pointing at `5082d45f13f39d4e1a694936788f5b362ad1ba36`). Main was selectively
pruned to the D-SCAFFOLD whitelist (~750 LOC of `.mjs`); Plans 06-02 and
06-04 port those files to `.ts`. See `spike-findings-gsd-beads` skill in the
fork for durable learnings:

- `findBeadsRoot()` probe (4 topology cases; spike 003 verified)
- bd CLI wrapper sentinel-error discipline (`BeadsEmpty` / `BeadsCorrupt` / `BeadsVersionMismatch`)
- Atomic write via tmpfile + POSIX rename (WR-05 fix via `crypto.randomBytes`)
- Idempotency contract on `format/phase.ts` (`parse(format(parse(x))) === parse(x)`)
- `.planning/research/spike-014-bd-blocks.md` (in the fork) — dep-edge provenance
  (field name is `type`, direction is `depends_on_id`, cascade ignores `blocks`)

## License

TBD — v1.0 ship docs (Plan 06-07) add LICENSE + SPDX header.
