> ⚠ PLACEHOLDER — SUPERSEDED BY PLAN 06-07
>
> Plan 06-07 Task 3 replaces this file wholesale with v1.0 shipping
> contribution guidance once Plans 06-02..06-06 have landed.

# Contributing to gsd-beads

This is a scaffold-era CONTRIBUTING; most of the topics below will be
expanded and verified once Plans 06-02..06-06 land their implementations.

## Seed-fixture regeneration

Conformance + smoke tests WILL load from `tests/fixtures/seed.jsonl` (not yet
ported into sibling — still lives in `tests/fixtures/build-seed.sh` as the
regeneration script). Once the seed is ported and regenerated, regenerate via:

```bash
cd tests/fixtures
BEADS_ACTOR=seed ./build-seed.sh
```

**Critical:** the `BEADS_ACTOR=seed` env var is required for byte-identity
across regenerations. Without it, bd stamps the current git actor's name into
JSONL and CONF-03 byte-identity tests flake.

## bd version pin

`bd v1.0.3 (1b2dd2cb)` is the empirically-verified sibling build. Author's
current install is bd v1.0.4. Plan 06-03's `SPIKE-RESULTS.md §1` records the
`bd --version` output and flags point-release divergence before any
Plan 06-05+ primitive authoring proceeds.

## Conformance test-writing conventions

- Use vitest `describe` / `it` / `beforeEach` / `afterEach` (not `node:test`).
- Spawn `bd` directly with `spawnSync` for read-backs in tests (sibling D-12).
- Always pass `env: { ...process.env, BEADS_ACTOR: 'seed' }` to bd invocations
  from tests.
- `chmodSync(.beads, 0o700)` after `bd init` in fixtures (Landmine 9).
- Unwrap `bd show <id> --json` results with `Array.isArray(r) ? r[0] : r`
  (Landmine 5).

## Landmine discipline

Every new bd invocation must:

- Forward `env` through `spawnSync` (Landmine 4 — sibling's v0.2 wrapper
  did not; Plan 06-02's `BdRunner` wrapper bakes this in).
- Use `--author gsd:event:<type>` on `bd comments add`, never `--label`
  (Landmine 4; only `--author` is structured in bd v1.0.3).
- Handle `{error, schema_version}` at exit 0 as "no issues found" (Landmine 7).
- Try `JSON.parse` then JSONL fallback on `bd export --json` (Landmine 6).

## Branch strategy

Per-plan feature branches off `feat/phase-6-reset` (or the eventual merged-
to-main baseline) are encouraged during Phase 6. Merge gates on conformance +
smoke green per the plan's `<verify>` blocks.
