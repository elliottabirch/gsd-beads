# gsd-beads

BeadsAdapter — a [`get-shit-done-cc`](https://github.com/gsd-build/get-shit-done)
[StorageAdapter](https://github.com/gsd-build/get-shit-done/blob/feat/storage-adapter/adapters/types.ts)
implementation targeting the [`bd`](https://github.com/steveyegge/beads) CLI
(pinned v1.0.4+).

## Status

**v1.0.0** — feature-complete against the fork's locked StorageAdapter
contract. All 22 methods have real bodies against live bd. The conformance
suite (`runAdapterConformanceSuite('beads', factory)`) runs 4/5 green
against bd v1.0.4; the one remaining red case is a fork-side harness-shape
issue (bd-tier routing vs. disk-tier collection stat semantics), tracked
as Phase 7 CONFORM-01..04 paired-adapter work — not a BeadsAdapter regression.

## Installation

During development this package is file-linked from the fork
(`"get-shit-done-cc": "file:../get-shit-done"` in `devDependencies`).
Post-Phase-8 it publishes to npm as `gsd-beads` with
`peerDependencies: { "get-shit-done-cc": "*" }` (see `package.json`).

```bash
npm install gsd-beads
```

System dependency: `bd` CLI v1.0.4 or later on PATH. The adapter shells
out — no node bindings exist for bd. `BeadsAdapter.init()` probes
`bd --version` at construction and rejects older builds via
`BeadsVersionMismatch`.

## Usage

```ts
import { BeadsAdapter } from 'gsd-beads';
import { createRegistry } from 'get-shit-done-cc';

const registry = createRegistry({
  adapter: new BeadsAdapter(process.cwd()),
});
```

Dual export per `D-RUNTIME-RESOLUTION` satisfies both consumer shapes:

- Named: `import { BeadsAdapter } from 'gsd-beads'` (TypeScript consumers
  with type inference)
- Default: `const Adapter = (await import('gsd-beads')).default`
  (Phase 8 DIST-01 adapter-name runtime resolver)

## Capabilities

9-key + `graphEdges` shape per the fork's locked `Capabilities` interface
(`adapters/types.ts`). Frozen literal lives at `src/capabilities.ts`.

| Capability | Value | Notes |
|------------|-------|-------|
| `record` | `true` | getRecord/putRecord/removeRecord/removeCollection/listCollection/exists/stat |
| `section` | `true` | getSection/updateSection (overwrite/append/prepend); format/section.ts anchor rewriter |
| `frontmatter` | `true` | getFrontmatter/updateFrontmatter/mergeFrontmatter via format/frontmatter.ts |
| `binaryAsset` | `false` | **D-BINARY** — throws `UnsupportedCapabilityError`; consumers guard via `hasBinaryAsset(adapter)` and skip-with-warning |
| `snapshot` | `false` | Derived from shipped **D-TXN Outcome A** (in-memory buffer — no dedicated snapshot primitive) |
| `transaction` | `true` | **D-TXN-CAPS** — all 3 outcomes declare true; pipeline.ts dry-run depends unconditionally |
| `namedDoc` | `true` | NamedDocCategory closed-union dispatch; disk-tier writes with optional workstream nesting |
| `markdownLockfile` | `false` | bd is not a markdown lockfile format; `replaceInCurrentMilestone` + `readModifyWriteRoadmapMd` throw `UnsupportedCapabilityError` |
| `graphEdges.semantic` | `false` | **D-OQ06** — graphify.cjs does not target bd as a data source (deferred post-v1.0) |
| `graphEdges.dependency` | `true` | **D-OQ06** — dep-edge synthesizer produces `{type:'dependency', confidence:1.0}` from bd `blocks` edges (src/dep-graph.ts) |

## Transaction variant (D-TXN)

**Shipped: Outcome A (in-memory write buffer)** per
[Plan 06-03 SPIKE-RESULTS §7](https://github.com/gsd-build/get-shit-done/blob/feat/storage-adapter/.planning/phases/06-beadsadapter-implementation/06-03-SPIKE-RESULTS.md)
and ADR `D-2026-05-12-OQ06-TXN` (user override of the Task-3 Outcome-C
proposal at Plan 06-03 Task-4 human-verify checkpoint, 2026-05-12).

Outcomes evaluated during the Plan 06-03 spike:

- **Outcome A (in-memory buffer) — SHIPPED.** `src/txn.ts` queues mutations;
  applies on commit; discards on rollback. `capabilities.snapshot: false`.
  Known limitation: mid-txn failure after 2-of-3 buffered writes leaves bd
  partially committed (no snapshot to restore to). Tracked as Phase 6.1
  follow-up + Phase 7 CONFORM-04 known-gap.
- **Outcome B (staging bd store + bead-hash bookmark cutover) — not shipped.**
  Architecturally 1:1 with MarkdownAdapter's shadow-dir journal; would close
  SYNTHESIS §9 HIGH-severity dry-run gate by construction.
  `capabilities.snapshot: true`. Evidence preserved in SPIKE-RESULTS §7 for
  Phase 6.1 revisit.
- **Outcome C (file-snapshot restore) — not shipped.** `bd export --json -o <snap>`
  on entry; `bd init --from-jsonl` into tmpdir + fs-level `.beads/` directory
  rename on rollback. Slow (~400-700ms per rollback) but reliable across 71
  sibling v0.2 conformance tests. `capabilities.snapshot: true`.

All three outcomes declare `capabilities.transaction: true`.

## Storage mapping (D-MAPPING)

**Shipped: Outcome A (sub-records via `bd update --metadata`)** per
SPIKE-RESULTS §7 and ADR `D-2026-05-12-OQ06-MAPPING`. bd v1.0.4
introduced the `--metadata <json>` / `--set-metadata <k>=<v>` primitives
that make named-JSON-field storage viable for the first time; the sibling's
v0.2 base on v1.0.3 had concluded Outcome A infeasible.

- **Outcome A (SHIPPED).** L2 sections map to `issue.metadata.<section>`
  sub-records (native mutable JSON fields); L3/L4 nested content goes into
  anchor-tagged comments with path-concatenation. 12+ per-canonical-file
  TypeScript schemas land via Plan 06-04 (`src/format/*.ts`).
- **Outcome B (labels-first) — not shipped.** Frontmatter ↔ bd labels
  (`phase-id:07` ↔ `{phase_id: '07'}`); body stored as issue's single
  `description`, re-parsed via `section.ts` on read. Scoped per-canonical-
  file schemas to ROADMAP.md + STATE.md only.

Event-family mapping under Outcome A:

| Family | Type frequency | bd primitive |
|--------|----------------|--------------|
| `recordStateAppend` | low-freq (decision / metric / roadmap_evolution) | `bd remember <json> --key <milestone>:<type>:<id>` |
| `recordStateAppend` | high-freq (session / quick_task / forensic_session) | `bd comments add <milestone> --author gsd:event:<type>` (Landmine 4 — `--author`, NEVER `--label`; v1.0.4 hard-rejects `--label` on comments) |
| `recordStateMutation` | all (blocker_added / blocker_resolved / todo_count_update / deferred_items) | label add/remove OR memory-key update (sub-record array op where applicable) |
| `recordStateSignal` | all (waiting / resume) | label add/remove |

ADR `D-2026-05-12-OQ06-CREATED-SECTION` documents that under Outcome A,
BeadsAdapter NEVER emits `StateWriteOutcome.created_section`. The 4
conformance matrix cells asserting `created_section` presence are
MarkdownAdapter-only; Phase 7 CONFORM-04 relaxes these per-adapter.

## Label namespace: `gsd:*`

BeadsAdapter reserves the `gsd:` label prefix for its own structural
metadata. End-user labels should avoid this prefix. Known namespaces:

| Prefix | Role |
|--------|------|
| `gsd:roadmap` | ROADMAP.md singleton (bd-tier routing) |
| `gsd:state` | STATE.md singleton |
| `gsd:project` | PROJECT.md singleton |
| `gsd:requirement` | REQUIREMENTS.md singleton |
| `gsd:decisions` | DECISIONS.md singleton |
| `gsd:phase` | phase-collection discriminator + per-phase records |
| `gsd:plan` | per-plan records |
| `gsd:event:<type>` | comment-author attribution for append events (Landmine 4) |
| `gsd:blocker:<id>` | mutation dispatch for blocker_added / blocker_resolved |
| `gsd:waiting:<type>` | signal dispatch for waiting; cleared by resume |
| `phase-id:<N>` | phase identity materializer on sub-records |
| `plan-id:<N-N>` | plan identity materializer |
| `version:<v>` | milestone version pin |

## Sidecar path-sniff map

Per Phase 5 D-19 SDK-typed sidecar verbs: `src/paths.ts` path-sniffs a
closed set of keys to dispatch sidecar reads to the correct source of
truth (bd memory vs. disk file) without domain leak. The sidecar
categories currently dispatched:

| Key pattern | Tier | Source |
|-------------|------|--------|
| `graphs/graph.json` | synthesized | bd export → materializeGraphJson (dep-edge synthesizer) |
| `HANDOFF.{json,md}` | disk | `.planning/HANDOFF.json` via putNamedDoc(category='root') |
| `CONTINUE-HERE.{json,md}` | disk | `.planning/CONTINUE-HERE.json` via putNamedDoc(category='root') |
| `DECISIONS-INDEX.{json,md}` | disk | `.planning/DECISIONS-INDEX.md` via putNamedDoc(category='root') |
| `<named-doc-category>/<key>` | disk | `.planning/<category>/[<workstream>/]<key>` via putNamedDoc |
| other `.md`/`.json` | per-path routing | canonical-file router per `resolveRoute()` in paths.ts |

## Known limitations (v1.0)

- `writeBinaryAsset` throws `UnsupportedCapabilityError` — consumer
  workflows guard via `hasBinaryAsset(adapter)` and skip-with-warning per
  Phase 5 D-18. No blob-store routing in v1.0.
- `snapshot`/`restore` throw `UnsupportedCapabilityError` — D-TXN Outcome A
  does not provide dedicated snapshot primitives. `hasSnapshot(adapter)`
  returns `false`; strict consumers skip.
- `capabilities.snapshot: false` + in-memory txn buffer → mid-txn failures
  after buffered writes apply leave bd partially committed. Tracked as
  Phase 6.1 follow-up; Outcome C migration preserved in SPIKE-RESULTS.
- `markdownLockfile: false` — `replaceInCurrentMilestone` +
  `readModifyWriteRoadmapMd` throw `UnsupportedCapabilityError`; these are
  MarkdownAdapter-specific affordances with no bd analog.
- Semantic graph edges absent on bd backend (`graphEdges.semantic: false`);
  dependency edges from bd `blocks` fill in partially (Phase 8+
  markdown→bd semantic-edge migration territory).
- Phase 7 CONFORM-04 known-gap: 4 StateWriteOutcome matrix cells that
  assert `created_section` presence are MarkdownAdapter-only under
  D-MAPPING Outcome A per ADR `D-2026-05-12-OQ06-CREATED-SECTION`.
- bd CLI pinned to v1.0.4+ — v1.0.3 rejected at `init()` via
  `BeadsVersionMismatch`. Point-release divergence must be re-verified via
  Plan 06-03 spike §1 (`bd --version` assertion).

## Carry-forward from v0.2

The sibling's full pre-reset history is preserved at the `v0.2-archive`
branch (`5082d45f13f39d4e1a694936788f5b362ad1ba36`). Main was selectively
pruned to the D-SCAFFOLD whitelist (~750 LOC of `.mjs`); Plans 06-02 and
06-04 port those files to `.ts` with Landmine fixes applied inline.

See the fork's
[`.claude/skills/spike-findings-gsd-beads`](https://github.com/gsd-build/get-shit-done/tree/feat/storage-adapter/.claude/skills/spike-findings-gsd-beads)
skill (2696 lines across 6 files) for the full durable-learnings
reference:

- `findBeadsRoot()` probe (4 topology cases; spike 003 verified)
- bd CLI wrapper sentinel-error discipline (`BeadsEmpty` / `BeadsCorrupt` /
  `BeadsVersionMismatch`) — `src/bd/helper.ts` `BdRunner` class
- Atomic write via tmpfile + POSIX rename (WR-05 fix via
  `crypto.randomBytes` — `src/_atomicWrite.ts`)
- Idempotency contract on `format/phase.ts`
  (`parse(format(parse(x))) === parse(x)`)
- `.planning/research/spike-014-bd-blocks.md` dep-edge semantics: field is
  `type` (not `dependency_type`), direction is `depends_on_id`, cascade
  ignores `blocks` edges.

## License

MIT
