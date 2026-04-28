# Shadow Binary Architecture (Y1)

The canonical Phase 2 design. A shadow `gsd-sdk` binary at
`~/.local/bin/gsd-sdk` (ahead of upstream on PATH) imports the SDK's
own building blocks, registers bd-backed handler overrides for the 13
state-bearing mutations, and dispatches through the SDK's machinery.
For non-overridden / non-beads-managed paths, spawnSync the upstream
binary.

## Requirements

- **Architecture Y1 is the chosen substitute pattern, registry-override variant.**
- **Use the SDK's own machinery via imports:** `createRegistry` from
  `get-shit-done-cc/sdk/dist/query/index.js`, `resolveQueryArgv` and
  `extractField` from `.../sdk/dist/query/registry.js`. Override
  state-bearing handlers via `registry.register(cmd, handler)`. Dispatch
  via `registry.dispatch(cmd, args, projectDir)`.
- **Beads-managed-project detection via `existsSync('.beads/metadata.json')`.**
- **Spawn upstream binary for non-query, non-overridden, or non-beads paths.**
- **The 13 state-bearing mutation commands** that need overrides:
  `phase.add`, `phase.add-batch`, `phase.insert`, `phase.complete`,
  `phase.remove`, `phase.scaffold`, `phases.clear`, `phases.archive`,
  `roadmap.update-plan-progress`, `roadmap.annotate-dependencies`,
  `requirements.mark-complete`, `todo.complete`, `milestone.complete`.
- **The 13 `/gsd-beads-*` substitute skills become OPTIONAL** under Y1.
  Upstream skills work transparently in beads-managed projects.

## How to Build It

### Canonical shape (gsd-sdk-shadow.mjs)

See `sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs` for
the validated POC.

```javascript
#!/usr/bin/env node
import { spawnSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SDK_BASE = process.env.GSD_SDK_PATH ?? '/path/to/get-shit-done-cc';
const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;
const QUERY_INDEX_PATH = `${SDK_BASE}/sdk/dist/query/index.js`;
const REGISTRY_PATH = `${SDK_BASE}/sdk/dist/query/registry.js`;

// Beads-backed handler signature: (args: string[], projectDir: string) => Promise<{data}>
async function beadsPhaseAdd(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
  return { data: { phase_id: beadId, title, status: 'added', backend: 'beads' } };
}

// Repeat for the other 12 state-bearing mutations
const BEADS_OVERRIDES = {
  'phase.add': beadsPhaseAdd,
  // ... 12 more
};

// ─── Argv routing ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);

function isBeadsManaged(dir) { return existsSync(resolve(dir, '.beads/metadata.json')); }
function spawnUpstream(argv) {
  const result = spawnSync(UPSTREAM_BIN, argv, { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}

const queryIdx = argv.indexOf('query');
if (queryIdx === -1) spawnUpstream(argv);

const projectDir = process.cwd();  // (or parse --project-dir)
if (!isBeadsManaged(projectDir)) spawnUpstream(argv);

// Use SDK's primitives — handler interface, argv resolver, dispatch
const queryModule = await import(QUERY_INDEX_PATH);
const registryModule = await import(REGISTRY_PATH);

const registry = queryModule.createRegistry();
for (const [cmd, h] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, h);
}

const queryArgv = argv.slice(queryIdx + 1);
const pickIdx = queryArgv.indexOf('--pick');
let pickField;
if (pickIdx !== -1) {
  pickField = queryArgv[pickIdx + 1];
  queryArgv.splice(pickIdx, 2);
}

const matched = registryModule.resolveQueryArgv(queryArgv, registry);
if (!matched) spawnUpstream(argv);

const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
console.log(pickField !== undefined
  ? registryModule.extractField(result.data, pickField)
  : JSON.stringify(result));
```

### Why this works (validated end-to-end in Spike 013)

| Test case | Result |
|---|---|
| `query phase.add "Phase 1"` (dotted) | ✓ Override fires; bead created with `gsd:phase` label; `{data:{phase_id,...,backend:"beads"}}` returned |
| `query phase add "Phase 2"` (space-aliased) | ✓ Same — SDK's `resolveQueryArgv` matches via longest-prefix scan |
| `query progress` (read-only, NOT overridden) | ✓ Dispatches through SDK to UNMODIFIED upstream handler; canonical project status returned |
| `query phase.add "X" --pick phase_id` | ✓ Returns just the ID via SDK's `extractField` (we wrote zero extraction code) |
| `--help` (not a query) | ✓ Passes through to upstream |
| `query phase.add` from non-beads project | ✓ Detection logs warning, passes to upstream |
| `query made-up-command` | ✓ Resolves to null; passes to upstream which falls back to legacy `gsd-tools.cjs` |

### Distribution

```bash
# Install our shadow ahead of upstream
mkdir -p ~/.local/bin
cp gsd-sdk-shadow.mjs ~/.local/bin/gsd-sdk
chmod +x ~/.local/bin/gsd-sdk
# Ensure ~/.local/bin is FIRST in PATH (most users already have this from ~/.profile)
```

Or as a `bd setup --add gsd-beads <recipe>` custom recipe (Spike 002
finding) — fits into beads' existing recipe ecosystem.

### When upstream adds a new state-bearing mutation

We have two failure modes:
1. **Pass-through** (current) — our shadow doesn't know about it, falls
   to upstream, upstream writes MD file (silently wrong for
   beads-managed projects). The Spike 012 PreToolUse(Bash) hook on
   `gsd-sdk *` is the **defensive backup**: if it includes the new
   mutation in its deny-list, the agent gets a loud error. If not, MD
   file is written.
2. **Implement-and-deploy** (right) — gsd-beads' team adds a beads-backed
   handler for the new mutation, ships a new shadow version. Upstream
   skills now route correctly.

Recommended: keep the Spike 012 hook even with Y1, as a defensive net
that makes "shadow doesn't yet support this mutation" loud rather than
silent.

## What to Avoid

- **DON'T try to inject a registry into the existing `main()`** in
  `cli.js`. It builds its own registry internally with no parameter.
  The path is to import the SDK's primitives and dispatch ourselves.
- **DON'T use the argv-intercept variant.** It's a working alternative
  but skips the SDK's typed dispatch. The registry-override variant
  gets us: typed QueryHandler signatures, SDK argv resolver, --pick for
  free, canonical QueryResult shape, automatic adaptation when upstream
  adds new commands.
- **DON'T forget the mutation event wrapping.** `createRegistry()`
  wraps `QUERY_MUTATION_COMMANDS` handlers with `GSDEvent` emission AT
  CONSTRUCTION TIME — before our `register()` call. Our overrides skip
  the wrapping. Phase 2 should either re-wrap manually or accept no
  GSDEvent emission for the single-dev MVP. (Worth flagging if a
  dashboard/observability story emerges later.)
- **DON'T fork upstream.** Y1 reads upstream's source via npm-installed
  package; doesn't modify it. REQ-02 holds.
- **DON'T plan for 13 substitute skills.** Y1 makes them optional.
  Phase 2 builds the shadow + handlers + bd-sync regen, not the 13
  substitutes.

## Constraints

- Node 22+ (ESM dynamic imports of upstream's `dist/` files)
- Upstream `package.json` has `"main": null` and `"exports": null`,
  which lets us do legacy resolution to `<pkg>/sdk/dist/query/index.js`.
  If upstream tightens `exports` later, our import path may break — the
  abstraction risk is real but bounded.
- The 13 state-bearing mutations are stable in upstream as of bd v1.0.3
  (extracted from `QUERY_MUTATION_COMMANDS` in `index.ts` — full list
  has 89 entries; we override the 13 that touch state-bearing files)
- `--project-dir` flag must come AFTER `query <cmd>` in argv (upstream
  parser quirk; respect it in our argv parsing too)
- Mutation event emission via `createRegistry`'s wrap-pass is lost on
  our overrides
- POC `gsd-sdk-shadow-v2.mjs` has only `phase.add` fully implemented;
  Phase 2 implements the other 12

## Origin

Synthesized from spike: 013 (architecture-y1-shadow-poc)
Related: 006 (informs the deny-list), 012 (defensive backup hook)
Source files available in: sources/013-architecture-y1-shadow-poc/
(both `gsd-sdk-shadow.js` argv-intercept variant and
`gsd-sdk-shadow-v2.mjs` registry-override canonical variant)
