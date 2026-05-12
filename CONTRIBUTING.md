# Contributing to gsd-beads

## Contribution flow

1. Fork → create a feature branch off the latest merged baseline (`main`
   post-Phase-6, or `feat/phase-6-reset` pre-merge).
2. Make changes — respect the sibling-boundary invariants (no domain
   logic; no contract decisions without a fork-side ADR proposal).
3. Run `npm test` locally; MUST be green.
4. Open a pull request. Squash-merge by default.

## Test commands

```bash
npm run build              # tsc → dist/
npm run test:unit          # vitest run tests/smoke/ (fast; no bd cold-start amplification)
npm run test:conformance   # runAdapterConformanceSuite('beads', factory) — full harness
npm test                   # full suite (unit + conformance)
```

## Conformance discipline

`runAdapterConformanceSuite` green is **blocking** — PRs that break
conformance are rejected. The suite runs against live `bd v1.0.4+` with
`tests/fixtures/seed.jsonl` as the deterministic test store. Never skip
a conformance assertion without a documented ADR citing the policy —
example: Plan 06-06 ADR `D-2026-05-12-OQ06-CREATED-SECTION` documents
why under D-MAPPING Outcome A BeadsAdapter never emits
`StateWriteOutcome.created_section`.

One known-green-gap exists as of v1.0 ship: the `stat(phase-collection)`
conformance case returns `null` under bd-tier routing (the bd record
doesn't exist because the write fell through to disk-tier via
resolveRoute for `phases/01-foo/PLAN.md` which doesn't match
`PHASE_PLAN_RE`). Deferred to Phase 7 CONFORM-01..04 paired-adapter work.

## Seed-fixture regeneration

Conformance + smoke tests load from `tests/fixtures/seed.jsonl`. To
regenerate:

```bash
cd tests/fixtures
BEADS_ACTOR=seed ./build-seed.sh
```

**Critical:** the `BEADS_ACTOR=seed` env var is required for byte-identity
across regenerations. Without it, bd stamps the current git actor's name
into JSONL and CONF-03 byte-identity tests flake.

## bd version pin

**Minimum: bd v1.0.4** (LOCKED at Plan 06-03 Task-4 human-verify
checkpoint, 2026-05-12, user override).

v1.0.3 is rejected at `BeadsAdapter.init()` via `BeadsVersionMismatch`
(missing `--metadata` primitive; incompatible `bd init --from-jsonl`
invocation shape; different `bd comments add --label` reject behavior).

Point-release divergence is re-verified via Plan 06-03's
`SPIKE-RESULTS.md §1` — `bd --version` output is asserted at spike time.
If a PR upgrades bd, it MUST re-run the spike and update SPIKE-RESULTS.md
in the fork.

## Running spikes

Plan 06-03's bd-primitive spike template lives at
`.planning/phases/06-beadsadapter-implementation/06-03-PLAN.md` in the
fork. To re-run a spike (for bd version upgrades or feature investigation):

1. Copy the spike template to a new plan or scratch doc.
2. Run every step against the target bd version.
3. Populate `SPIKE-RESULTS.md §§1–9` — a spike is INCOMPLETE until §7
   names the D-MAPPING + D-TXN outcomes.
4. Surface outcome changes as fork-side ADR proposals BEFORE
   re-implementing.

## Test-writing conventions

- Use vitest `describe` / `it` / `beforeEach` / `afterEach` (not
  `node:test`).
- Use `setupFreshAdapter()` from `tests/fixture.ts` in tests that need
  a bd-initialized project dir; call `h.cleanup()` in a `finally` (or
  `afterEach` when using the hook style).
- Spawn `bd` directly with `spawnSync` for read-backs in tests
  (sibling D-12); always pass `env: { ...process.env, BEADS_ACTOR: 'seed' }`.
- Unwrap `bd show <id> --json` via `Array.isArray(r) ? r[0] : r`
  (Landmine 5).
- `chmodSync(.beads, 0o700)` in fixture setup (Landmine 9).

## Landmine discipline

Every new bd-invoking code site must:

- Forward `env` through `spawnSync` (Landmine 3)
- Use `--author gsd:event:<type>` on `bd comments add`, never `--label`
  (Landmine 4 — v1.0.4 hard-rejects; v1.0.3 silently drops)
- Handle `{error, schema_version}` at exit 0 as "no issues found"
  (Landmine 7 — map to `BeadsEmpty`)
- Try `JSON.parse` first, then JSONL line-by-line fallback on
  `bd export --json` (Landmine 6)
- Route through `_abs()` if the site dereferences user-controlled paths
  (Landmine 1 / CR-01)
- Route generic putRecord on named-doc paths through the named-doc
  dispatch, not disk fallthrough (Landmine 2 / CR-02)

See `CLAUDE.md` §"Landmine fix register" for the complete list of
landed fixes with source-tree locations.
