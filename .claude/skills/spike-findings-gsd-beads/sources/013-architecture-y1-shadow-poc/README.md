---
spike: 013
name: architecture-y1-shadow-poc
type: standard
validates: "Given user push-back on the parallel substitute layer (13 /gsd-beads-* skill prompts re-implementing bd orchestration), when validating Architecture Y1 (shadow gsd-sdk binary that intercepts state-bearing mutation argv and routes to bd, passing everything else to upstream), then we have a working POC demonstrating: (a) state-bearing mutations get intercepted, (b) read-only and non-state-bearing commands pass through, (c) beads-managed-project detection works, (d) both dotted and space-aliased command forms work."
verdict: VALIDATED
related: [001, 002, 006, 009, 010, 012]
tags: [architecture-pivot, shadow-binary, transparent-backend, gsd-sdk]
---

# Spike 013: Architecture Y1 (Shadow gsd-sdk) — POC

## What This Validates

User push-back during Spike 012 review: *"there is a code smell to me that
we are preventing a base layer of the gsd workflow."*

The current gsd-beads design is a **parallel layer** — 13 `/gsd-beads-*`
substitute skills each re-implementing bd orchestration logic. This is a
real code smell because gsd-sdk already provides the canonical mutation
infrastructure (atomicity, validation, locking, mutation events,
testing) and we'd be re-creating those in skill prompts.

**Architecture Y1: shadow the gsd-sdk binary.** Intercept state-bearing
mutation argv at the binary boundary; route to bd-backed handlers; pass
everything else through to upstream. Result: upstream skills work
transparently in beads-managed projects, no substitutes needed.

This spike validates Y1 is feasible.

## Research

`gsd-sdk` is `npm install -g get-shit-done-cc`'s exported binary. The
package structure:

```
~/.volta/tools/image/packages/get-shit-done-cc/
├── bin/gsd-sdk.js                       ← shim: spawns sdk/dist/cli.js
└── lib/node_modules/get-shit-done-cc/
    └── sdk/dist/
        ├── cli.js                       ← main(); has internal createRegistry()
        └── query/
            ├── index.js                 ← exports createRegistry()
            └── registry.js              ← QueryRegistry class
```

**Three potential extension points investigated:**

| Extension | Verdict |
|---|---|
| `createRegistry()` exported, `register(cmd, handler)` overwrites via `Map.set()` | ✓ Real plug-in surface |
| Backend / adapter / plugin abstraction in handlers | ✗ Not present; handlers call `fs/promises.writeFile` directly |
| `process.env.GSD_QUERY_FALLBACK` env-var-driven | Only governs unknown-command fallback to legacy `gsd-tools.cjs`, not handler override |
| `--require` / `--experimental-loader` Node hooks | Possible but fragile (ESM dynamic imports; loader hook stability concerns) |

**Constraint discovered:** `main()` in `cli.js` line 351 builds its own
registry internally:
```javascript
const registry = createRegistry();
```
There's no parameter to inject an externally-modified registry into the
existing main(). To use Y1, we either:
- (a) **Build our own dispatch using the SDK's exported building blocks**
  (createRegistry, resolveQueryArgv, extractField). We import the
  primitives, register overrides, dispatch through the SDK's machinery.
  ~50 lines of orchestration; reuses ALL of the SDK's typed-handler
  contract.
- (b) **Intercept argv at the binary boundary**, route state-bearing
  mutations to our hand-rolled handlers, spawnSync upstream for
  everything else. Simpler but rebuilds argv parsing and result-shape
  assembly ourselves.

Both variants validated below; (a) is the canonical design.

## How to Run

```bash
# 1. Build a beads-managed project
mkdir -p /tmp/spike13-beads && cd /tmp/spike13-beads
git init -q -b main && echo "# t" > R.md && git add R.md && git commit -q -m init
bd init --non-interactive --skip-agents -p s13

# 2. Run the POC shadow against state-bearing + passthrough commands
SHADOW=/home/ellio/code/gsd-beads/.planning/spikes/013-architecture-y1-shadow-poc/gsd-sdk-shadow.js

# Intercepted (state-bearing, project is beads-managed)
"$SHADOW" query phase.add "Phase 1: First feature"
"$SHADOW" query phase add "Phase 2: Space alias"

# Passthrough (read-only)
"$SHADOW" query progress

# Passthrough (non-state-bearing mutation)
"$SHADOW" query state.update --field foo --value bar

# Passthrough (project NOT beads-managed)
cd /tmp && "$SHADOW" query phase.add "ignored"
```

## What to Expect

- Intercepted state-bearing mutations: shadow handler creates the bead
  with right type + label (e.g., `gsd:phase`), returns JSON with backend
  marker `"backend":"beads"`.
- Passthrough commands: stdout/stderr from upstream gsd-sdk, including
  errors for missing args or unknown commands (upstream's normal
  behavior).
- Non-beads project: shadow detects `.beads/metadata.json` missing, logs
  `[gsd-sdk-shadow] Project ... is not beads-managed; passing to upstream`,
  passes argv through unchanged.

## Investigation Trail

**Iteration 1 — find the extension point.**
Audited gsd-sdk source for backend abstraction, plugin loading,
env-var-driven backend selection. Found:
- ✓ `createRegistry()` is exported from `query/index.js`
- ✓ `QueryRegistry.register(cmd, handler)` uses `Map.set()` (overwrites)
- ✗ No backend interface; handlers call `fs.writeFile` directly
- ✗ `main()` builds its own registry internally with no injection point

Verdict: Y1 is technically feasible but not via clean dependency injection.
Two paths: (a) replicate dispatch ourselves, (b) intercept argv at binary.

**Iteration 2 — built the argv-interception POC.**
~80-line `gsd-sdk-shadow.js` that:
- Reads `process.argv.slice(2)`
- Locates `query` token; finds following `<cmd>` (handles 1- and 2-word forms)
- If `<cmd>` is in our `STATE_BEARING_HANDLERS` set: invoke our handler
- If beads project not detected: pass through with informative log
- Otherwise: spawnSync upstream with original argv

Implemented one full handler (`phase.add`) and stubs for the other 12.
Beads-managed-project detection via `existsSync('.beads/metadata.json')`.

**Iteration 3 — end-to-end testing.**
| Test | Result |
|---|---|
| `phase.add` (dotted) on beads project | ✓ intercepted, bead created with `gsd:phase` label, JSON returned |
| `phase add` (space-aliased) on beads project | ✓ same — bead created, JSON returned |
| `phase.add` on non-beads project | ✓ shadow detects, logs, passes through (upstream errors as it would normally) |
| `progress` (read-only) on beads project | ✓ passthrough, upstream returns project status JSON |
| `state.update` (non-state-bearing mutation) on beads project | ✓ passthrough, upstream errors normally |
| Unknown command (`made-up-command`) | ✓ passthrough, upstream falls back to legacy `gsd-tools.cjs` |

4 phases successfully created in beads via the shadow. All pass-through
tests behave identically to direct upstream invocation.

**Iteration 4 — initial argv-flag-ordering quirk.**
Test 5/6/7 initially failed with `Error: "gsd-sdk query" requires a
command`. Debugging showed this is an UPSTREAM quirk —
`gsd-sdk --project-dir x query <cmd>` doesn't work; the flag must come
after `<cmd>` (or use cwd-based detection). Not a Y1 issue. Confirmed by
calling upstream directly with the same argv ordering.

## Iteration 5 — registry-override POC (canonical variant)

User asked: *"so we determined that we cannot hook into the gsd-sdk
package, and implement our own backend?"* — and I'd been imprecise. We
CAN hook into the package; the argv-intercept POC was a shortcut that
skipped the SDK's dispatch primitives.

Built `gsd-sdk-shadow-v2.mjs` — same shape but using the SDK's own
machinery:

```javascript
import { createRegistry } from 'get-shit-done-cc/sdk/dist/query/index.js';
import { resolveQueryArgv, extractField } from 'get-shit-done-cc/sdk/dist/query/registry.js';

const registry = createRegistry();
registry.register('phase.add', beadsPhaseAdd);   // ← OUR handler is now first-class
// ... 12 more state-bearing overrides

const matched = resolveQueryArgv(queryArgv, registry);   // SDK handles argv parsing
const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
console.log(JSON.stringify(result));
```

**Empirical validation (all 6 tests pass):**

| Test | Result |
|---|---|
| Not-a-query → passthrough | ✓ `--help` delegates to upstream |
| Non-beads project → passthrough | ✓ `phase.add` outside .beads/ falls through, upstream handles |
| `phase.add` (dotted) on beads project | ✓ Our handler runs; bead created with `gsd:phase` label; `{"data":{"phase_id":"...","backend":"beads"}}` returned |
| `phase add` (space-aliased) on beads project | ✓ SDK's `resolveQueryArgv` matches space-form via longest-prefix; our handler runs |
| Read-only `progress` on beads project | ✓ Dispatches through SDK to UNMODIFIED upstream handler; canonical project-status JSON returned |
| `--pick phase_id` on `phase.add` | ✓ SDK's `extractField` extracts just the ID — no extra code required |

**Concrete advantages over argv-intercept:**

- `resolveQueryArgv` handles dotted (`phase.add`) and space-aliased
  (`phase add`) forms automatically via longest-prefix scan — we don't
  write argv-parsing regex
- `--pick` extraction is free via `extractField()`
- Our handlers return `QueryResult { data }` shape — same as upstream
- When upstream adds new mutation commands, our shadow's argv parsing
  doesn't need to change — only the handler set
- Handler signature (`(args, projectDir) => Promise<QueryResult>`) is
  the canonical typed interface; we benefit from any improvements
  upstream makes to it

**Trade-off acknowledged:** the SDK's `createRegistry()` wraps
`QUERY_MUTATION_COMMANDS` handlers with mutation-event emission AT
construction time. When we `registry.register('phase.add', ourHandler)`
AFTER createRegistry returns, our handler replaces the wrapped one and
loses event emission. Phase 2 should either (a) wrap our handlers
manually with the same event-emission logic or (b) accept that gsd-beads
mutations don't emit GSDEvents (relevant for live-dashboard
observability — out of scope for the MVP single-developer audience).

## Results

**Verdict: VALIDATED ✓ (registry-override variant is canonical)**

Architecture Y1 is empirically viable in **both variants**, with the
registry-override approach (`gsd-sdk-shadow-v2.mjs`) as the canonical
design. POC demonstrates:

1. **State-bearing mutations route to bd transparently** — upstream
   skills calling `gsd-sdk query phase.add` automatically work in
   beads-managed projects, no skill changes needed.

2. **Non-state-bearing operations pass through cleanly** — read-only
   queries, non-state-bearing mutations, unknown commands all behave
   identically to direct upstream invocation.

3. **Beads-managed-project detection is reliable** — falls back to
   upstream when not in a beads project, with an informative log.

4. **Both dotted (`phase.add`) and space-aliased (`phase add`)
   command forms work.** Important because upstream tooling may use
   either.

5. **Failure mode for new upstream mutations is loud-but-passthrough.**
   When upstream adds a mutation command we don't know about, our shadow
   passes it through. The mutation runs against MD files (wrong for
   beads), but the result is at least consistent (won't fail
   mysteriously). This is a real coupling cost — every new state-bearing
   mutation upstream ships, we must add a beads-backed handler.

## Architectural cascade

Y1 simplifies the gsd-beads architecture significantly. Many earlier
spikes' verdicts get re-scoped:

| Spike | Pre-Y1 finding | Post-Y1 finding |
|---|---|---|
| 006 (skill interaction matrix) | 13 BLOCKS skills need substitutes | **Substitutes become OPTIONAL.** Upstream skills work transparently via the shadow. The matrix is still useful as a reference of what mutations each skill performs. |
| 009 (gsd-new-project E2E) | `/gsd-beads-new-project` substitute (~150 lines) needed | **No substitute needed.** Upstream `/gsd-new-project` works as-is; its `gsd-roadmapper` agent calls `gsd-sdk query phase.add` etc., all of which the shadow intercepts. |
| 010 (bd-aware agents) | 3 layers required: bd-memory priming + hook + 13 substitutes | **2 layers suffice:** shadow binary (transparent backend) + Edit/Write hook (defensive against direct file edits). bd-memory priming is nice-to-have for vocabulary visibility but not required. |
| 012 (gsd-sdk hook coverage) | PRIMARY: PreToolUse(Bash) hook denies state-bearing gsd-sdk mutations | **DEFENSIVE BACKUP:** the shadow handles them. The hook is now a safety net for upstream additions we don't yet support. (Or could be removed entirely if Y1 is the design — pick one or the other.) |

The hook from Spike 001 (Edit/Write blocker on state-bearing paths)
remains primary because Y1 doesn't catch direct file edits — those
bypass the SDK entirely.

## Caveats / known weaknesses

- **Coupling to upstream's mutation surface.** Every new mutation
  command upstream adds, we either implement (correct) or pass through
  (wrong: writes MD). Maintenance burden.
- **Argv-parsing must stay in sync.** If upstream changes how `query`
  is parsed (e.g., adds `--query` flag), our regex-based detection may
  break. Should be wrapped in tests.
- **Shadow is a binary that must be on PATH.** Distribution (probably
  `~/.local/bin/gsd-sdk` symlinked or wrapper-installed) is one more
  install step.
- **POC has only `phase.add` fully implemented.** The other 12
  state-bearing handlers are stubs; Phase 2 implements them.

## Files

- `gsd-sdk-shadow-v2.mjs` — **canonical Y1 design.** ~110 lines.
  Imports `createRegistry`, `resolveQueryArgv`, `extractField` from the
  SDK package; registers state-bearing handler overrides; dispatches
  through the SDK's own machinery. `phase.add` fully implemented; 12
  stubs for Phase 2.
- `gsd-sdk-shadow.js` — argv-intercept variant POC. Kept as a working
  alternative reference; demonstrates the simpler routing path. Phase
  2 will use v2.
- This README
- The live POC sandbox is at `/tmp/spike13-beads/` — 7 phase beads
  successfully created across both shadow variants (4 via v1, 3 via v2).
