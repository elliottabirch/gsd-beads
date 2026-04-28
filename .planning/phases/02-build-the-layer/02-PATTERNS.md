# Phase 2: Build the layer - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 27 (production code + tests + recipe + meta)
**Analogs found:** 17 / 27 (10 NEW — no in-repo analog)

This phase productionizes 13 spike POCs. The "analogs" here are exact
working code from `.claude/skills/spike-findings-gsd-beads/sources/`,
not approximate references. Files marked `EXACT` should copy the
spike POC verbatim and apply the listed deltas. Files marked `NEW`
have no in-repo analog and must be built from RESEARCH.md patterns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/cascade-loop.sh` | utility | batch | `.../sources/002-beads-modeling/cascade-loop.sh` | EXACT (verbatim, polish only) |
| `scripts/regen-roadmap.sh` | utility | transform | none in-repo | NEW (Spike 007 contract) |
| `scripts/regen-requirements.sh` | utility | transform | none in-repo | NEW (Spike 007 contract) |
| `hooks/block-state-md.sh` | middleware | request-response | `.../sources/001-hook-semantics/hooks/block-state-md.sh` | EXACT |
| `hooks/bd-sync.sh` | middleware | event-driven | `.../sources/001-hook-semantics/hooks/bd-sync.sh` | role-match (extend) |
| `hooks/block-gsd-sdk-mutation.sh` | middleware | request-response | `.../sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh` | EXACT |
| `hooks/worktree-post-checkout.sh` | middleware | event-driven | `.../sources/003-cross-worktree-sharing/worktree-post-checkout.sh` | EXACT |
| `settings.fragment.json` | config | static | `.../sources/001-hook-semantics/settings.fragment.json` | EXACT (extend with 3rd hook) |
| `bin/gsd-sdk-shadow.mjs` | controller | request-response | `.../sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs` | role-match (extend 12 stubs) |
| `bin/wrap-mutation.mjs` | utility | transform | none (upstream `buildMutationEvent` not exported) | NEW (Pitfall 2) |
| `scripts/install.sh` | utility | batch | none in-repo | NEW (Pitfall 1) |
| `recipe/gsd-beads-recipe.md` | config | static | none | NEW (single-file pointer per Pitfall 1) |
| `tests/hook-tests/block-state-md.test.sh` | test | request-response | `.../sources/001-hook-semantics/test-runner.sh` | EXACT (extract block suite) |
| `tests/hook-tests/bd-sync.test.sh` | test | event-driven | `.../sources/001-hook-semantics/test-runner.sh` | role-match (extend with read-only filter cases) |
| `tests/hook-tests/block-gsd-sdk-mutation.test.sh` | test | request-response | `.../sources/012-gsd-sdk-hook-coverage/test-runner.sh` | EXACT |
| `tests/hook-tests/cascade-loop.test.sh` | test | batch | none in-repo | NEW |
| `tests/hook-tests/regen-roadmap.test.sh` | test | transform | none in-repo | NEW |
| `tests/hook-tests/regen-requirements.test.sh` | test | transform | none in-repo | NEW |
| `tests/shadow-tests/handler-*.test.mjs` (×13) | test | request-response | none (handler skeleton in shadow POC) | NEW (node:test) |
| `tests/shadow-tests/wrap-mutation.test.mjs` | test | transform | none | NEW (snapshot test, see Pitfall 2) |
| `tests/shadow-tests/argv-routing.test.mjs` | test | request-response | none | NEW |
| `tests/install-tests/idempotency.test.sh` | test | batch | none in-repo | NEW |
| `tests/install-tests/settings-merge.test.sh` | test | transform | none in-repo | NEW |
| `tests/install-tests/memory-seeding.test.sh` | test | batch | none in-repo | NEW |
| `tests/install-tests/path-precedence.test.sh` | test | batch | none in-repo | NEW |
| `tests/install-tests/no-gsd-core-mutation.test.sh` | test | batch | none in-repo | NEW |
| `tests/worktree-tests/auto-config.test.sh` | test | event-driven | none in-repo | NEW |
| `tests/worktree-tests/append-idempotency.test.sh` | test | event-driven | none in-repo | NEW |
| `tests/e2e/full-install.smoke.sh` | test | batch | none in-repo | NEW |
| `tests/e2e/bd-sync-latency.test.sh` | test | batch | none in-repo | NEW (Pitfall 3) |
| `tests/e2e/concurrent-merge.test.sh` | test | event-driven | none in-repo | NEW |
| `tests/e2e/post-gsd-update.smoke.sh` | test | batch | none in-repo | NEW |
| `tests/e2e/bd-ready.smoke.sh` | test | request-response | none in-repo | NEW |
| `tests/run-quick.sh`, `tests/run-all.sh` | utility | batch | none in-repo | NEW (meta) |

## Pattern Assignments

### `scripts/cascade-loop.sh` (utility, batch — Plan 02-01)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh`
**Quality:** EXACT — production-ready, verbatim copy with polish only.

**Full file pattern** (lines 1-38):
```bash
#!/usr/bin/env bash
# Cascade-close loop using bd's built-in `bd epic close-eligible`.
# Idempotent — safe to call repeatedly.
set -euo pipefail

iter=0
total_closed=0

while :; do
  iter=$((iter + 1))
  out=$(bd epic close-eligible 2>&1)

  if echo "$out" | grep -q 'No epics eligible'; then
    break
  fi

  echo "$out"
  closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
  total_closed=$((total_closed + ${closed:-0}))
done

if [ "$total_closed" -gt 0 ]; then
  echo ""
  echo "Cascade complete: $total_closed epic(s) closed across $((iter - 1)) iteration(s)"
fi
```

**Phase 2 deltas:**
- Add a max-iteration safety cap (e.g., 20) to prevent any future bd
  bug from looping infinitely.
- Optional `--quiet` flag for invocation from `bd-sync.sh` (no stdout
  unless something was actually closed).

---

### `scripts/regen-roadmap.sh` (utility, transform — Plan 02-01)

**Analog:** NEW — no in-repo analog. Build from Spike 007 format
contract (`.planning/spikes/007-reader-skill-format-contract/README.md`).

**Pattern source:** spike 007 README "ROADMAP.md format contract"
table + "Beads commands needed for regen" section (lines 25-44, 105-118).

**Required bd reads** (verbatim from spike 007 README):
```bash
# Pull all phase beads
bd list --type=epic -l gsd:phase --status=all -n 0 --json

# Each phase's children (tasks)
bd children <phase-id> --json

# Each phase's parent requirements
bd show <phase-id> --json | jq '.[0].dependencies[] | select(.dependency_type=="parent-child")'
```

**Output template structure** (from spike 007):
```
# Roadmap: <Project>

## Overview
<paragraph from PROJECT.md narrative>

- [ ] **Phase 1: Name** - desc
- [ ] **Phase 2: Name** - desc

### Phase 1: Name
**Goal**: <parsed from description>
**Depends on**: <phase numbers via blocks deps>
**Requirements**: [REQ-01, REQ-02]   <- via parent-child to gsd:requirement
**Success Criteria** (what must be TRUE):
1. ...
**Plans**: N plans / TBD
- [ ] 02-01: desc
- [ ] 02-02: desc

## Progress
| Phase | Status | Plans Done | Plans Total |
| ... | ... | ... | ... |
```

**Stack pattern (verified — Standard Stack RESEARCH.md):** bash + jq +
bd CLI (no Node, no Python). Use `bd list --json | jq -r '...'` and
`bd children --json | jq -r '...'`. The narrative `## Overview`
paragraph is sourced from PROJECT.md (which is NOT regenerated —
narrative is untouched per REQ-07).

**Idempotency:** writing to `.planning/ROADMAP.md` IS the contract.
The script must produce byte-stable output for unchanged inputs (jq
sort phases by priority then bead-creation-order to avoid spurious
diffs).

---

### `scripts/regen-requirements.sh` (utility, transform — Plan 02-01)

**Analog:** NEW — no in-repo analog. Build from Spike 007 format
contract (`.planning/spikes/007-reader-skill-format-contract/README.md`
"REQUIREMENTS.md format contract" lines 46-58).

**Required bd reads:**
```bash
# All requirement beads
bd list --type=epic -l gsd:requirement --status=all -n 0 --json

# Out-of-scope set
bd list --type=epic -l gsd:requirement --status=closed --json | \
  jq '[.[] | select(.close_reason=="out-of-scope")]'

# Traceability (each phase's parent requirements)
bd list --type=epic -l gsd:phase --json | \
  jq -r '.[].id' | \
  xargs -I{} bd show {} --json
```

**Output template** (from spike 007):
```
# Requirements: <Project>

**Defined:** <date>
**Core Value:** <from PROJECT.md>

## v1 Requirements    <- via label version:v1

### Authentication    <- via label category:auth

- [ ] **AUTH-01**: User can ...    <- bead title; req-id label

## Out of Scope
| ID | Title | Reason |
| ... | ... | ... |

## Traceability
| Requirement | Phases |
| AUTH-01 | Phase 1, Phase 3 |
```

**Same idempotency contract** as regen-roadmap.sh.

---

### `hooks/block-state-md.sh` (middleware, request-response — Plan 02-02)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh`
**Quality:** EXACT — 20/20 PASS in spike. Copy verbatim, minor polish only.

**Full file pattern** (lines 1-46):
```bash
#!/usr/bin/env bash
# PreToolUse hook for Edit|Write — blocks writes to state-bearing markdown.
set -euo pipefail

payload="$(cat)"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  */.planning/ROADMAP.md|*/.planning/REQUIREMENTS.md|*/.planning/todos/*|*/.planning/seeds/*\
  |.planning/ROADMAP.md|.planning/REQUIREMENTS.md|.planning/todos/*|.planning/seeds/*)
    target="${file_path##*.planning/}"
    jq -n --arg target "$target" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("State-bearing markdown is generated from beads — direct edits to .planning/" + $target + " are blocked. Use one of: /gsd-beads-add-phase, /gsd-beads-add-todo, /gsd-beads-plant-seed, /gsd-beads-new-milestone, or run `bd` directly. Run `bd-sync.sh` to regenerate.")
      }
    }'
    exit 0 ;;
  *)
    exit 0 ;;
esac
```

**Phase 2 deltas (per CONTEXT.md D-06: no `/gsd-beads-*` substitute skills):**
- Update `permissionDecisionReason` text. The spike's reason still
  references `/gsd-beads-add-phase` etc. — D-06 ships no substitute
  skills, so the reason must redirect to upstream `/gsd-add-phase` (the
  shadow routes them transparently) or to `bd` directly.
- Suggested wording: `"...State-bearing markdown is generated from
  beads — use the upstream /gsd-* command (it routes through the
  gsd-sdk shadow) or run \`bd\` directly..."`.

**Critical preserve (per CONVENTIONS Anti-Pattern):** the case pattern
MUST match BOTH absolute and relative path shapes. Spike 001 iter 2
caught this gap empirically — do not regress.

---

### `hooks/bd-sync.sh` (middleware, event-driven — Plan 02-02)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/bd-sync.sh`
**Quality:** role-match — spike has a STUB; Phase 2 expands with real cascade + regen + read-only filter.

**Spike pattern — payload extraction** (lines 9-12):
```bash
payload="$(cat)"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
session_id="$(printf '%s' "$payload" | jq -r '.session_id // "unknown"')"
```

**Phase 2 expansion (NEW — per RESEARCH.md Pitfall 3):**
```bash
#!/usr/bin/env bash
# PostToolUse hook for `bd *` Bash commands.
# Filters READ-only bd commands; runs cascade + regen on state-changing only.
set -euo pipefail

payload="$(cat)"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
[ -z "$command" ] && exit 0

# Extract bd subcommand (the token after `bd `)
sub="${command#*bd }"
sub="${sub%% *}"

# Read-only filter — skip regen for read-only bd commands (Pitfall 3)
case "$sub" in
  list|show|ready|memories|status|prime|export|deps|children|search|help|version|"--version"|"--help")
    exit 0 ;;
esac

# Debounce — if last regen <1s ago, skip (idempotency)
ROADMAP_PATH="$CLAUDE_PROJECT_DIR/.planning/ROADMAP.md"
if [ -f "$ROADMAP_PATH" ]; then
  age=$(( $(date +%s) - $(stat -c %Y "$ROADMAP_PATH" 2>/dev/null || stat -f %m "$ROADMAP_PATH") ))
  [ "$age" -lt 1 ] && exit 0
fi

# Run cascade then regen
"$CLAUDE_PROJECT_DIR/.claude/scripts/cascade-loop.sh" --quiet
"$CLAUDE_PROJECT_DIR/.claude/scripts/regen-roadmap.sh"
"$CLAUDE_PROJECT_DIR/.claude/scripts/regen-requirements.sh"

exit 0
```

**Cascade integration:** invoke `cascade-loop.sh` BEFORE regen so the
cascade-closed beads are reflected in the regenerated markdown.

**Read-only allow-list rationale (Pitfall 3):** every `bd ` Bash hook
fires `bd-sync.sh`. Without this filter, `bd ready`, `bd list`, etc.
trigger a 2-4s regen pass. The agent would perceive sluggishness.

---

### `hooks/block-gsd-sdk-mutation.sh` (middleware, request-response — Plan 02-02)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh`
**Quality:** EXACT — 43/43 PASS. Copy verbatim, polish reason text only.

**Argv-extraction pattern** (lines 32-52):
```bash
case "$command" in
  *"gsd-sdk "*"query "*)
    after_query="${command#*query }"
    first="${after_query%% *}"
    rest="${after_query#* }"
    second_word=""
    case "$first" in
      phase|phases|state|roadmap|requirements|todo|milestone|frontmatter)
        second_word="${rest%% *}"
        ;;
    esac
    candidate1="$first"
    candidate2="${first}.${second_word}"
    ;;
  *)
    exit 0  # Not a gsd-sdk query
    ;;
esac
```

**Deny-list pattern** (lines 55-93) — 13 mutations. Verbatim except for
`redirect` text update (D-06: no `/gsd-beads-*` substitutes, so
redirect to `/gsd-*` upstream commands or `bd` directly).

**Defensive-backup role:** Under Y1 (D-09), the shadow handles mutations
in beads-managed projects. This hook is the defensive backup that
catches anything the shadow doesn't override.

---

### `hooks/worktree-post-checkout.sh` (middleware, event-driven — Plan 02-04)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh`
**Quality:** EXACT — production-ready. Copy verbatim.

**Full sentinel-marked block** (lines 15-43):
```bash
# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---
old_sha=$1; new_sha=$2; flag=$3
[ "$flag" = "1" ] || exit 0

gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
marker="$gitdir/info/.gsd-beads-configured"
[ -f "$marker" ] && exit 0

common=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0
source_root="$(dirname "$(cd "$common" && pwd -P)")"
source_beads="$source_root/.beads"

if [ ! -d "$source_beads" ]; then
  printf '[gsd-beads] ⚠ Source repo at %s has no .beads/ — run `bd init` in source first\n' "$source_root" >&2
  exit 0
fi

git config --worktree gsd-beads.dir "$source_beads" 2>/dev/null || \
  git config gsd-beads.dir "$source_beads"

mkdir -p "$gitdir/info"
touch "$marker"
printf '[gsd-beads] ✓ Worktree configured (gsd-beads.dir=%s)\n' "$source_beads"
# --- END GSD-BEADS WORKTREE INIT ---
```

**Note for installer (Pitfall 7):** the SCRIPT is idempotent (uses
marker file). The INSTALL of the script into `.beads/hooks/post-checkout`
must also be idempotent — see `install.sh` pattern below.

---

### `settings.fragment.json` (config, static — Plan 02-02)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/settings.fragment.json`
**Quality:** EXACT — 2 hook entries verified. Phase 2 adds a 3rd.

**Spike pattern** (lines 1-30):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(bd *)",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bd-sync.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Phase 2 addition — 3rd hook (PreToolUse Bash with `gsd-sdk *` filter, per Spike 012):**
```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "if": "Bash(gsd-sdk *)",
      "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-gsd-sdk-mutation.sh",
      "timeout": 5
    }
  ]
}
```

**Critical convention (CONVENTIONS.md):** `if: "Bash(<prefix> *)"` for
per-command Bash filtering. NOT regex on the matcher field.

**Path placeholder note:** the spike uses `$CLAUDE_PROJECT_DIR/.claude/hooks/...`.
Phase 2's installer puts hooks in `~/.claude/hooks/` (user-level) with
the recipe symlinked there. Confirm path layout in 02-05 install
script before locking the fragment paths.

---

### `bin/gsd-sdk-shadow.mjs` (controller, request-response — Plan 02-03)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs`
**Quality:** role-match — POC has 1/13 handlers implemented (`phase.add`); Phase 2 implements other 12.

**Imports pattern** (lines 1-25):
```javascript
#!/usr/bin/env node
// Y1 (shadow gsd-sdk) — registry-override variant.
import { spawnSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// SDK module paths — could be resolved via require.resolve in distribution
const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;

const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;
const QUERY_INDEX_PATH = `${SDK_BASE}/sdk/dist/query/index.js`;
const REGISTRY_PATH = `${SDK_BASE}/sdk/dist/query/registry.js`;
```

**Handler skeleton pattern** (lines 31-41 — `phase.add`, fully implemented):
```javascript
async function beadsPhaseAdd(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
  return { data: { phase_id: beadId, title, status: 'added', backend: 'beads' } };
}
```

**Override registration** (lines 99-104):
```javascript
const registry = queryModule.createRegistry();
for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, handler);
}
```

**Argv routing pattern** (lines 64-95):
```javascript
const argv = process.argv.slice(2);

function isBeadsManaged(projectDir) {
  return existsSync(resolve(projectDir, '.beads/metadata.json'));
}

function getProjectDir(argv) {
  const idx = argv.indexOf('--project-dir');
  if (idx !== -1 && argv[idx + 1]) return resolve(argv[idx + 1]);
  return process.cwd();
}

function spawnUpstream(argv) {
  const result = spawnSync(UPSTREAM_BIN, argv, { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}

const queryIdx = argv.indexOf('query');
if (queryIdx === -1) spawnUpstream(argv);

const projectDir = getProjectDir(argv);
if (!isBeadsManaged(projectDir)) spawnUpstream(argv);
```

**Dispatch pattern** (lines 96-136):
```javascript
const queryModule = await import(QUERY_INDEX_PATH);
const registryModule = await import(REGISTRY_PATH);
const registry = queryModule.createRegistry();
for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, handler);
}
const queryArgv = argv.slice(queryIdx + 1);
// Strip --pick if present
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

**Phase 2 deltas:**
1. Implement 12 stub handlers — pattern per `beadsPhaseAdd`:
   `phase.add-batch`, `phase.insert`, `phase.complete`, `phase.remove`,
   `phase.scaffold`, `phases.clear`, `phases.archive`,
   `roadmap.update-plan-progress`, `roadmap.annotate-dependencies`,
   `requirements.mark-complete`, `todo.complete`, `milestone.complete`.
   Each handler returns `{ data: {...} }` (QueryResult shape) and uses
   `bd q`, `bd label add`, `bd link`, `bd close`, or `bd update` calls.
2. Wrap each handler with `wrapMutation` (D-09):
   ```javascript
   import { wrapMutation } from './wrap-mutation.mjs';
   for (const [cmd, h] of Object.entries(BEADS_OVERRIDES)) {
     registry.register(cmd, wrapMutation(h, cmd, eventStream, sessionId));
   }
   ```
3. Add quiet logging gate: only `console.error` if `GSD_BEADS_DEBUG=1`
   (per CONTEXT.md Claude's Discretion).
4. Replace `process.exit` calls inside the body with `await spawnUpstream`
   that returns control or import a tiny dispatch helper to avoid
   double-exit confusion.

**Error handling pattern** (lines 133-136):
```javascript
} catch (err) {
  console.error(`[gsd-sdk-shadow-v2] dispatch failed: ${err.message}`);
  process.exit(1);
}
```

**Don't hand-roll (CONVENTIONS):**
- Argv parsing for `phase.add` vs `phase add` → use `resolveQueryArgv`
- `--pick` field extraction → use `extractField`
- Custom result-wrapping → return `{ data: {...} }` (QueryResult shape)

---

### `bin/wrap-mutation.mjs` (utility, transform — Plan 02-03)

**Analog:** NEW — upstream's `buildMutationEvent` is module-internal
(NOT exported, per RESEARCH.md Pitfall 2).

**Source to reproduce:** `~/.volta/.../get-shit-done-cc/sdk/dist/query/index.js`
lines 121-199 (`buildMutationEvent` function body) and 486-503
(`wrapMutation` wrapper pattern).

**Helper structure** (RESEARCH.md Code Example 4):
```javascript
// Source: derived from upstream get-shit-done-cc/sdk/dist/query/index.js lines 486-503
//         + buildMutationEvent body lines 121-199 (NOT EXPORTED — re-implemented)
import { GSDEventType } from '/path/to/sdk/dist/types.js';

function buildMutationEvent(sessionId, cmd, args, result) {
  const base = { timestamp: new Date().toISOString(), sessionId };
  if (cmd.startsWith('phase.') || cmd.startsWith('phase ') ||
      cmd.startsWith('phases.') || cmd.startsWith('phases ')) {
    return { ...base, type: GSDEventType.StateMutation, command: cmd,
             fields: args.slice(0, 2), success: true };
  }
  // ... (other prefix branches per upstream lines 121-199)
  return { ...base, type: GSDEventType.StateMutation, command: cmd,
           fields: args.slice(0, 2), success: true };
}

export function wrapMutation(handler, cmd, eventStream, sessionId) {
  return async (args, projectDir) => {
    const result = await handler(args, projectDir);
    try {
      eventStream?.emitEvent(buildMutationEvent(sessionId, cmd, args, result));
    } catch { /* fire-and-forget per upstream pattern */ }
    return result;
  };
}
```

**7 prefix branches to reproduce** (from upstream lines 121-199):
`template.`, `commit`, `frontmatter.`, `config-`, `validate.`, `phase.`,
`state.`, fallback. Each builds a different `GSDEventType` (StateMutation,
GitCommit, FrontmatterMutation, ...).

**`GSDEventType` import:** verified exported from
`~/.volta/.../sdk/dist/types.js` lines 24-67.

**Snapshot test (REQUIRED — Pitfall 2 mitigation):** assert our helper's
output for `phase.add`, `roadmap.update-plan-progress`,
`requirements.mark-complete`, `todo.complete`, `milestone.complete`
matches upstream's wrap-pass output (run a non-overridden registry,
capture the event it emits, snapshot-compare). Lives in
`tests/shadow-tests/wrap-mutation.test.mjs`.

---

### `scripts/install.sh` (utility, batch — Plan 02-05)

**Analog:** NEW — no in-repo analog. Build from RESEARCH.md
Pitfall 1 + Runtime State Inventory + REQ-06.

**Required behaviors (from RESEARCH.md):**

1. **Pre-flight checks:**
   ```bash
   command -v bd >/dev/null  || { echo "ERROR: bd not installed"; exit 1; }
   command -v jq >/dev/null  || { echo "ERROR: jq not installed"; exit 1; }
   command -v node >/dev/null || { echo "ERROR: node ≥22 required"; exit 1; }
   node -e 'process.exit(parseInt(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' \
     || { echo "ERROR: node ≥22 required"; exit 1; }
   ```

2. **Settings.json deep-merge with dedupe** (RESEARCH.md Pitfall 6):
   ```bash
   jq -s '.[0] * .[1] | .hooks |= (
     to_entries | map(.value |=
       (group_by(.matcher) | map(
         .[0] + {hooks: (map(.hooks) | flatten | unique_by("\(.command)\(.if // "")"))}
       ))
     ) | from_entries
   )' "$HOME/.claude/settings.json" "$REPO/settings.fragment.json" > "$tmp"
   mv "$tmp" "$HOME/.claude/settings.json"
   ```
   **Critical:** dedupe key MUST include `if` filter (two hooks with
   same command but different `if` are distinct).

3. **Shadow binary symlink** (RESEARCH.md Runtime State Inventory):
   ```bash
   ln -sf "$REPO/bin/gsd-sdk-shadow.mjs" "$HOME/.local/bin/gsd-sdk"
   chmod +x "$REPO/bin/gsd-sdk-shadow.mjs"
   # Verify PATH precedence (warn loudly if Volta's gsd-sdk shadows ours)
   first=$(command -v gsd-sdk)
   case "$first" in
     "$HOME/.local/bin/gsd-sdk") echo "✓ shadow active" ;;
     *) echo "⚠ shadow at $HOME/.local/bin/gsd-sdk is shadowed by $first — fix PATH" ;;
   esac
   ```

4. **bd memory seeding** (CONTEXT.md specifics):
   ```bash
   for key in vocabulary state-paths type-strategy link-default discovered-from todowrite dolt-push; do
     bd forget "gsd-beads:$key" 2>/dev/null || true
     bd remember --key "gsd-beads:$key" "$(cat "$REPO/install/memories/$key.md")"
   done
   ```

5. **Worktree post-checkout shim append** (sentinel-marker idempotent):
   ```bash
   marker_begin="# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---"
   marker_end="# --- END GSD-BEADS WORKTREE INIT ---"
   target=".beads/hooks/post-checkout"
   # Remove any existing block then append fresh
   sed -i.bak "/^$marker_begin$/,/^$marker_end$/d" "$target" 2>/dev/null || true
   cat "$REPO/hooks/worktree-post-checkout.sh" >> "$target"
   ```

**Idempotency contract:** running install.sh twice produces zero diff
in `~/.claude/settings.json`, no duplicate marker blocks, refreshes
memories, re-creates symlink (silent no-op if unchanged).

**Anti-pattern (CONVENTIONS):** do NOT use bash heredoc to construct
JSON. Always `jq -n` to build, `jq -s` to merge.

---

### `recipe/gsd-beads-recipe.md` (config, static — Plan 02-05)

**Analog:** NEW — bd custom recipes are single-file template writers
(RESEARCH.md Pitfall 1).

**Required structure:** plain markdown pointer text. The file becomes
the destination of `bd setup --add gsd-beads <path>` registration. bd's
own canonical template will be written here when a user runs
`bd setup gsd-beads`. So this file's CONTENT is informational — it tells
the reader what gsd-beads is and where to clone it.

**Suggested body:**
```markdown
# gsd-beads

This is a discovery pointer. The actual gsd-beads layer is shipped as
a separate repository.

## Install

    git clone https://github.com/<owner>/gsd-beads
    cd gsd-beads
    ./install.sh

After install:
- `~/.claude/settings.json` is patched with 3 hooks
- `~/.local/bin/gsd-sdk` symlinks to the shadow binary
- bd memories under `gsd-beads:*` are seeded
- Worktree post-checkout shim is appended to `.beads/hooks/post-checkout`

## Verify
    bd memories | grep gsd-beads:
    command -v gsd-sdk    # should resolve to ~/.local/bin/gsd-sdk
```

---

### Test files (NEW — `tests/hook-tests/*.test.sh`, Plan 02-02)

**Analog:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh`
**Quality:** role-match (synthetic-payload runner pattern; copy the helpers, change the cases).

**Synthetic Claude Code Edit/Write payload pattern** (lines 32-44):
```bash
payload=$(jq -n \
  --arg tool "$tool" \
  --arg file_path "$file_path" \
  '{
    session_id: "spike-test",
    transcript_path: "/tmp/x.jsonl",
    cwd: "/tmp",
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: $tool,
    tool_input: { file_path: $file_path, content: "anything" },
    tool_use_id: "toolu_test"
  }')

stdout=$(printf '%s' "$payload" | "$BLOCK_HOOK" 2>/dev/null) || true

got=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecision // "allow"')
```

**Synthetic Bash payload pattern** (lines 84-99):
```bash
payload=$(jq -n \
  --arg cmd "$command" \
  '{
    session_id: "spike-test",
    transcript_path: "/tmp/x.jsonl",
    cwd: "/tmp",
    permission_mode: "default",
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: $cmd, description: "test" },
    tool_response: { stdout: "", stderr: "", interrupted: false },
    tool_use_id: "toolu_test",
    duration_ms: 1
  }')

printf '%s' "$payload" | "$SYNC_HOOK" 2>/dev/null || true
```

**`if`-filter simulation pattern** (lines 119-128):
```bash
matches_bd_filter() {
  case "$1" in
    "bd "*) return 0 ;;
    *) return 1 ;;
  esac
}
```

**Pass/fail tally pattern** (lines 22-24, 60, 207-224):
```bash
pass=0
fail=0
results='[]'
# ... after each test:
if [ "$got" = "$expect" ]; then status="PASS"; pass=$((pass+1)); else status="FAIL"; fail=$((fail+1)); fi
# ... at end:
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]    # exit non-zero on any fail
```

**Phase 2 deltas:**
- `block-state-md.test.sh` — 12 cases verbatim from spike + 8 narrative-allow cases (REQ-07 verification)
- `bd-sync.test.sh` — 7 spike cases + NEW 8 read-only-filter cases (verify `bd ready/list/show/...` skip regen) + 2 cascade-fired-on-state-change cases
- `block-gsd-sdk-mutation.test.sh` — 43 cases verbatim from spike 012's `test-runner.sh`

---

### Test files (NEW — `tests/shadow-tests/*.test.mjs`, Plan 02-03)

**Analog:** NEW — no spike test for shadow handlers exists.

**Stack pattern (RESEARCH.md Standard Stack):** `node:test` (built-in,
ESM-native, zero dependencies).

**Required test shape:**
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('phase.add creates a bead with gsd:phase label', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-test-'));
  try {
    execSync('bd init --non-interactive --skip-agents', { cwd: dir });
    const result = spawnSync(
      'node',
      ['../../bin/gsd-sdk-shadow.mjs', 'query', 'phase.add', 'Test phase', '--project-dir', dir],
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.backend, 'beads');
    assert.match(parsed.data.phase_id, /^[a-z]+-\d+$/);
    // Verify the label was applied
    const labels = execSync(`bd show ${parsed.data.phase_id} --json`, { cwd: dir, encoding: 'utf-8' });
    assert.ok(JSON.parse(labels)[0].labels.includes('gsd:phase'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

**Snapshot test for `wrap-mutation`** (Pitfall 2 mitigation):
- Build a NON-overridden registry via `createRegistry(eventStream, sessionId)` from upstream
- Capture the events it emits for sample mutations
- Run our `wrapMutation`-wrapped registry on the same inputs
- Assert event objects are deep-equal

---

### Test files (NEW — `tests/install-tests/*.test.sh`, Plan 02-05)

**Analog:** NEW — no in-repo analog. Build from RESEARCH.md test map.

**Required suites:**
- `idempotency.test.sh` — run install.sh, snapshot 4 files (settings.json, post-checkout, symlink target, memories list); run again; diff = empty
- `settings-merge.test.sh` — 4 deep-merge cases: empty, no-overlap, partial-overlap, full-conflict (verify dedupe on `(matcher, command, if)`)
- `memory-seeding.test.sh` — assert 7 keys present after install: `gsd-beads:vocabulary`, `:state-paths`, `:type-strategy`, `:link-default`, `:discovered-from`, `:todowrite`, `:dolt-push`
- `path-precedence.test.sh` — must catch the Volta-shadow-trap: assert `command -v gsd-sdk` resolves to `~/.local/bin/gsd-sdk`, otherwise prints remediation
- `no-gsd-core-mutation.test.sh` — grep guard: install.sh must not touch any file under `~/.claude/get-shit-done/`

---

### Test files (NEW — `tests/worktree-tests/*.test.sh`, Plan 02-04)

**Analog:** NEW — closest is the post-checkout script itself.

**Pattern:** ephemeral fixture repo + `git worktree add` + assert config:
```bash
fixture=$(mktemp -d)
cd "$fixture" && git init && bd init --non-interactive --skip-agents
"$INSTALLER" "$fixture"
git worktree add ../wt
cd ../wt
got=$(git config --worktree gsd-beads.dir)
[ -n "$got" ] || { echo FAIL; exit 1; }
[ -f "$(git rev-parse --git-dir)/info/.gsd-beads-configured" ] || { echo FAIL; exit 1; }
```

**Idempotency test:** run `git worktree add` twice on different dirs;
each gets the marker; appending the install block twice produces only
one sentinel-marked block in `.beads/hooks/post-checkout`.

---

### Test files (NEW — `tests/e2e/*.smoke.sh`, Plan 02-06)

**Analog:** NEW — full-system smoke; closest reference is Spike 002's
fixture-build pattern (lines 522-535 of RESEARCH.md):

```bash
REQ=$(bd q "REQ-042: Email/password auth" -t epic -p 0)
bd label add "$REQ" gsd:requirement
P1=$(bd q "Phase 12: Auth backend" -t epic -p 1)
bd label add "$P1" gsd:phase
bd link "$P1" "$REQ" --type parent-child
T1=$(bd q "Hash passwords" -t task -p 2)
bd link "$T1" "$P1" --type parent-child
```

**E2E flow per CONTEXT.md specifics (`/tmp/gsd-beads-e2e-${RANDOM}`):**
1. ephemeral repo at `/tmp/gsd-beads-e2e-$RANDOM`
2. `bd init --non-interactive --skip-agents`
3. `./install.sh` from the gsd-beads repo
4. Build 3-level hierarchy: 1 req → 2 phases → 3 tasks each
5. Close all leaves: `bd close <task-id>` × 6
6. Assert `bd-sync.sh` fired cascade-loop and ROADMAP.md regenerated
7. Snapshot ROADMAP.md, run `gsd-progress` parser on it, assert success

**Performance test (Pitfall 3):** 50-bead fixture, run `bd-sync.sh`,
assert wall-clock < 5s.

---

## Shared Patterns

### Hook Script Boilerplate
**Source:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh` lines 16-25
**Apply to:** All hook scripts (`block-state-md.sh`, `bd-sync.sh`, `block-gsd-sdk-mutation.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
# Extract relevant field via jq
field="$(printf '%s' "$payload" | jq -r '.tool_input.<field> // empty')"
[ -z "$field" ] && exit 0
```

### Permission-Decision Output Shape (CONVENTIONS exit-0 + JSON, NOT exit-2 + stderr)
**Source:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh` lines 33-40
**Apply to:** All deny-emitting hooks

```bash
jq -n --arg target "$target" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "<specific message redirecting to /gsd-* or bd>"
  }
}'
exit 0
```

### Sentinel-Marker Block (CONVENTIONS)
**Source:** `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh` lines 15, 43
**Apply to:** Any block of code appended to a chained file (`.beads/hooks/post-checkout`, `~/.claude/settings.json` if line-based merge ever needed)

```bash
# --- BEGIN GSD-BEADS <NAME> v1 ---
<block content>
# --- END GSD-BEADS <NAME> ---
```

Install/uninstall: `sed "/BEGIN <NAME>/,/END <NAME>/d"` then append.

### Synthetic Claude Code Hook Payload Test Driver
**Source:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh` lines 32-74
**Apply to:** All hook tests in `tests/hook-tests/`

Pattern: jq-construct payload → pipe to script → capture stdout → jq-extract decision → assert.

### Pass/Fail Tally + Exit-Nonzero-On-Fail
**Source:** `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh` lines 22-24, 60, 224
**Apply to:** All bash test runners

```bash
pass=0; fail=0
# ... after each test:
if [ "$got" = "$expect" ]; then pass=$((pass+1)); else fail=$((fail+1)); fi
# ... at end:
echo "Passed: $pass / $((pass+fail))"
[ "$fail" -eq 0 ]
```

### Shadow Handler Skeleton (Plan 02-03 — apply to all 13 handlers)
**Source:** `.claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs` lines 31-41
**Apply to:** All 13 entries in `BEADS_OVERRIDES`

```javascript
async function beads<Cmd>(args, projectDir) {
  // 1. Parse args
  // 2. Run bd commands via execSync (cwd: projectDir)
  // 3. Return { data: {...} }    // QueryResult shape
}
```

Each handler: 2-4 `bd` subprocess calls (`bd q`, `bd label add`, `bd
link`, `bd close`, `bd update`). Document timing budget per handler in
a comment (Pitfall 5).

### bd CLI Patterns (Don't Hand-Roll, RESEARCH.md table)
**Apply to:** All shadow handlers, regen scripts, install.sh

| Need | Use |
|------|-----|
| Create bead with type=epic | `bd q "<title>" -t epic -p <pri>` |
| Add label | `bd label add <id> <label>` |
| Parent-child link | `bd link <child> <parent> --type parent-child` |
| Cascade-close epics | `bd epic close-eligible` (in cascade-loop.sh) |
| Children | `bd children <id>` (NOT `bd dep tree`) |
| Memory seed | `bd remember --key gsd-beads:* "..."` |

## No Analog Found

Files with no in-repo match (planner uses RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason | RESEARCH.md Reference |
|------|------|-----------|--------|----------------------|
| `scripts/regen-roadmap.sh` | utility | transform | spike 007 documented contract; no working POC built | Spike 007 README + RESEARCH.md regen contract |
| `scripts/regen-requirements.sh` | utility | transform | same | same |
| `bin/wrap-mutation.mjs` | utility | transform | upstream `buildMutationEvent` not exported | RESEARCH.md Pitfall 2 + Code Example 4 |
| `scripts/install.sh` | utility | batch | bd recipe doesn't do multi-file install (Pitfall 1) | RESEARCH.md Pitfall 1, 6, 7 + Runtime State Inventory |
| `recipe/gsd-beads-recipe.md` | config | static | bd writes its own template here; we provide pointer text | RESEARCH.md Pitfall 1 |
| `tests/shadow-tests/*.test.mjs` | test | request-response | new framework (`node:test`); ephemeral bd fixture pattern | RESEARCH.md Validation Architecture + Standard Stack |
| `tests/install-tests/*.test.sh` | test | batch | new test surface | RESEARCH.md Phase Requirements → Test Map |
| `tests/worktree-tests/*.test.sh` | test | event-driven | new test surface | RESEARCH.md Phase Requirements → Test Map |
| `tests/e2e/*.smoke.sh` | test | batch | new test surface | RESEARCH.md Validation Architecture |
| `tests/run-quick.sh` / `tests/run-all.sh` | utility | batch | meta scripts | RESEARCH.md Sampling Rate |

For all NEW files: planner should refer to the cited RESEARCH.md
sections for the implementation skeleton, the relevant CONVENTIONS.md
patterns, and the Standard Stack table for tooling choices.

## Metadata

**Analog search scope:** `.claude/skills/spike-findings-gsd-beads/sources/`
(13 spike directories), `.planning/spikes/`, repo root.
**Files scanned:** 9 spike POCs read + 1 spike 007 README +
CONTEXT.md + RESEARCH.md.
**Pattern extraction date:** 2026-04-27
**Stack reminder (CONVENTIONS):** bash + jq + bd CLI for hooks/scripts;
Node.js ESM dynamic-import for shadow binary; `node:test` for shadow
tests; `bash + jq` synthetic-payload runners for hook/install tests.
