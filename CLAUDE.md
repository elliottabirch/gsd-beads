# gsd-beads — Project Context

Sibling repo of [`gsd-build/get-shit-done`](https://github.com/gsd-build/get-shit-done)
(fork at `feat/storage-adapter`; fork package name `get-shit-done-cc`).
Implements `BeadsAdapter` against the fork's locked `StorageAdapter` contract.

See `../get-shit-done/.planning/PROJECT.md` for fork architecture and the
two-repo model rationale (D-2026-04-30-02).

## Repo boundaries

- **Fork (`/Volumes/code/get-shit-done`):** owns the `StorageAdapter`
  contract, `MarkdownAdapter` reference implementation, conformance
  harness, and SDK domain helpers (addPhase, createPlan, writeLearnings,
  etc.). Strict-superset invariant: fork behavior must be unchanged by the
  adapter-interface seam.
- **Sibling (this repo, `/Volumes/code/gsd-beads`):** BeadsAdapter
  implementation ONLY. No domain logic (Phase 3 D-04 "adapter stays thin").
  No new contract decisions — surface bugs as fork-side ADR proposals in
  `.planning/DECISIONS.md`.

## Development

This repo depends on the fork via
`"get-shit-done-cc": "file:../get-shit-done"` in `devDependencies`.
The fork must have the `./conformance` subpath export built (fork Plan
06-01 Tasks 1+2 landed on the `feat/storage-adapter` branch).

```bash
cd /Volumes/code/gsd-beads
npm install             # resolves file-linked fork + vitest + typescript
npm run build           # tsc → dist/
npm run test:unit       # vitest run tests/smoke/ (fast)
npm run test:conformance  # runAdapterConformanceSuite('beads', factory) against live bd
npm test                # full suite (unit + conformance)
```

## Conformance invocation

`tests/conformance.test.ts` imports `runAdapterConformanceSuite` from
`get-shit-done-cc/conformance` and invokes with a factory that:

1. `git init` in the harness-provided tmpdir
2. Copy the committed seed to `.beads/issues.jsonl` (bd v1.0.4
   `--from-jsonl` is boolean; seed file must pre-exist)
3. `bd init --from-jsonl --non-interactive --skip-agents --skip-hooks
   --quiet` with `BEADS_ACTOR=seed`
4. `chmod .beads/ 0o700`
5. Returns `new BeadsAdapter(projectDir)`

This closes RESEARCH Open Question #1 (harness does not bd-init; factory
owns it) without extending the locked harness signature (Phase 1 D-15).

## BEADS_ACTOR=seed discipline

**Critical:** every bd invocation that affects determinism MUST pass
`BEADS_ACTOR=seed` in env. The `BdRunner` wrapper (`src/bd/helper.ts`)
bakes this into `baseEnv` at construction so per-call-site discipline is
not required (Landmine 3 + 11 combined fix). Tests that spawn bd directly
(conformance factory, smoke fixture setup, seed regeneration) must also
pass it explicitly.

## bd CLI dependency

**Minimum supported version: bd v1.0.4** (locked at Plan 06-03 Task-4
human-verify checkpoint, 2026-05-12, user override).

v1.0.3 is NOT supported:

- BeadsAdapter's D-MAPPING Outcome A depends on `bd update --metadata <json>`
  + `bd update --set-metadata <k>=<v>` primitives introduced in v1.0.4.
- The `bd init --from-jsonl` invocation shape changed between v1.0.3 and
  v1.0.4 (v1.0.4 requires JSONL at exact relative path `.beads/issues.jsonl`
  inside the target directory).
- `bd comments add --label` silently-drops in v1.0.3 and hard-rejects
  (exit 1) in v1.0.4 — Landmine 4 requires `--author` exclusively.

BeadsAdapter's `init()` probe (Plan 06-05) runs `bd --version` at adapter
construction and rejects older builds via `BeadsVersionMismatch`.

## Branch strategy

- `main` — stable; merged post-Phase-6-ship.
- `v0.2-archive` — pre-reset history (2026-05-11; sibling's pre-pivot work
  frozen at `5082d45f13f39d4e1a694936788f5b362ad1ba36`).
- `feat/phase-6-reset` — Plan 06-01's destructive prune and scaffold
  landed here; subsequent plans branch off or stay on this until Phase 6
  completes.

Per-plan feature branches off `feat/phase-6-reset` are encouraged;
conformance + smoke green are blocking gates before merge.

## Landmine fix register (10 of 13 applied at port time)

Per the fork's `.claude/skills/spike-findings-gsd-beads/SKILL.md §9` and
`06-CONTEXT.md §Landmines canonical table`, Phase 6 port-time fixes (NOT
inherited bugs):

| # | Landmine | Fix location |
|---|----------|--------------|
| 1 | Path traversal in `_abs()` (CR-01 BLOCKER) | `src/primitives.ts::_abs` + 4 negative smoke tests |
| 2 | CR-02 hybrid-tier dual-write bypass | `src/paths.ts` — `'hybrid'` tier literal deleted; named-doc dispatches disk-tier directly |
| 3 | bd helper CWD not propagated | `src/bd/helper.ts` — `BdRunner` class with `cwd` baked at construction + env forwarding |
| 4 | `bd comments add --label` silently rejected (v1.0.3) / hard-rejects (v1.0.4) | `src/events.ts` uses `--author gsd:event:<type>` exclusively |
| 5 | `bd show <id> --json` returns array | `BdRunner.show()` unwraps via `Array.isArray(r) ? r[0] : r` |
| 6 | `bd export --json` is JSONL, not a JSON array | `BdRunner.run()` tries `JSON.parse` then line-by-line fallback |
| 7 | "no issues found" → `{error, schema_version}` at exit 0 | `BdRunner.run()` maps to `BeadsEmpty` sentinel |
| 8 | `.beads/` wider perms post-init | Fixtures + conformance factory `chmodSync 0o700` |
| 9 | WR-05 atomic-write ms-resolution race | `src/_atomicWrite.ts` uses `crypto.randomBytes` suffix |
| 11 | BEADS_ACTOR=seed byte-identity | `BdRunner.baseEnv` + fixture + conformance factory |

Deferred:

- **Landmine 10 (WR-02/WR-03 frontmatter YAML escape)** — TypeScript
  catches most shape bugs at compile time; escalation to `js-yaml` is
  conditional on nested-object frontmatter surfacing in the fork corpus
  (see `src/format/frontmatter.ts` inline comment).
- **WR-01** (`_resolveMilestoneBead` docs-lie) — WARN-level; CONTEXT.md
  Claude's Discretion; post-v1.0 cleanup.
- **WR-09** (`filter(Boolean)` heading-stack collapse) — WARN-level;
  CONTEXT.md Claude's Discretion; post-v1.0 cleanup.
- **WR-04 / Landmine 12** (snapshot-restore `--prefix` hardcoded) — N/A
  under shipped D-TXN Outcome A (no snapshot impl); only applies if
  Phase 6.1 migrates to Outcome C.

## Phase 6 implementation status

- [x] Plan 06-01 — scaffold + fork-side contract changes (graphEdges,
      ./conformance subpath)
- [x] Plan 06-02 — port bd/ + helpers/ + _atomicWrite (TS + Landmines 3,
      5, 6, 7, 9)
- [x] Plan 06-03 — bd v1.0.x dual spike (D-MAPPING Outcome A locked,
      D-TXN Outcome A locked)
- [x] Plan 06-04 — port format/* + paths.ts + BdManagedMismatchError
      (Landmine 2 CR-02 resolution)
- [x] Plan 06-05 — Bin A primitives + init() probe + writeBinaryAsset
      throw + Landmine 1 CR-01 guard (BEADS-01 / BEADS-04 / BEADS-05)
- [x] Plan 06-06 — 3 recordState* families + withTransaction + dep-graph
      synthesizer + commitPlanningState noop (BEADS-02 + BEADS-03;
      ADRs D-2026-05-12-OQ06-CREATED-SECTION + D-2026-05-12-OQ01-BEADS)
- [x] Plan 06-07 — 8 Bin B category smoke tests + conformance factory
      wrap + v1.0 docs rewrite + PHASE-6-EXIT.md audit
