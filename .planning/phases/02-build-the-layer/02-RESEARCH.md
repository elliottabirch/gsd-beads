# Phase 2: Build the layer - Research

**Researched:** 2026-04-27
**Domain:** Bash/jq hook scripts, Node.js ESM shadow binary, bd CLI orchestration, Claude Code settings.json hook contract
**Confidence:** HIGH

## Summary

Phase 2 productionizes 13 spike POCs into a `bd setup --add gsd-beads` distribution.
13 spikes (verdict: 7 outright VALIDATED, 6 VALIDATED-WITH-CAVEAT, 0 INVALIDATED)
fully designed the architecture; this research focuses on the **integration risks**,
**testing strategy**, and **implementation gaps** that the planner needs to address
when turning POCs into production code.

The core finding: the design is sound and the POCs are largely production-ready,
**but two locked decisions in CONTEXT.md need user reconsideration before plans are
written**. (1) `bd setup --add gsd-beads <path>` (D-03/D-04/D-05) does NOT do what
the spike claimed — empirical probe of bd v1.0.3 shows custom recipes are
**single-file-template writers**, not multi-file installers (cannot ship hooks +
shadow binary + memory seeding). (2) Re-wrapping handlers with `buildMutationEvent`
(D-09) requires copying ~80 lines of internal logic from the upstream SDK because
that function is **not exported** — verified by grep of `query/index.js`.

**Primary recommendation:** Plan 02-05-install-script must be a self-contained shell
installer (not a bd recipe template). The bd recipe slot can be a thin pointer
that documents the install command. D-09's wrap-pass should reference the
verbatim source of upstream's `buildMutationEvent` so it's auditable when the
shadow is updated.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plan Sequencing & Granularity (Approach A: bottom-up by layer)**
- **D-01:** **6 plans, dependency-ordered** as follows:
  - `02-01-bd-helpers-PLAN.md` — `cascade-loop.sh`, `regen-roadmap.sh`, `regen-requirements.sh`
  - `02-02-hooks-PLAN.md` — `block-state-md.sh`, `bd-sync.sh`, `block-gsd-sdk-mutation.sh` + `settings.fragment.json` + their test runners (parity with Spike 001's 20-case + Spike 012's 43-case suites)
  - `02-03-shadow-binary-PLAN.md` — `gsd-sdk-shadow.mjs` + 13 bd-backed handlers (in one plan; shared scaffolding makes per-handler granularity wasteful) + GSDEvent re-wrapping helper + handler tests
  - `02-04-worktree-init-PLAN.md` — `worktree-post-checkout.sh` (sentinel-marker append to bd's hook chain) + idempotency tests
  - `02-05-install-script-PLAN.md` — `bd setup --add gsd-beads` recipe registration + deep-merge of settings.json fragment + bd memory seeding + binary symlink to `~/.local/bin/gsd-sdk` + idempotent re-install
  - `02-06-e2e-smoke-test-PLAN.md` — fresh fixture project, full install, 3-level hierarchy build, cascade fires, regen ROADMAP.md is parser-compatible

- **D-02:** **One plan per shadow handler is overkill.** All 13 handlers share argv routing + spawnUpstream + import boilerplate. Plan 02-03 contains all 13 in one file with shared helpers; per-handler tests validate each independently.

**Distribution Mechanism (bd recipe path)**
- **D-03:** Distribute as a `bd setup --add gsd-beads <path>` recipe.
- **D-04:** No standalone curl-pipe-bash installer for MVP.
- **D-05:** Recipe contents include (a) shell snippet that runs the install script, (b) hook fragment, (c) bd memory seeding script.

**Substitute Skills (skip entirely)**
- **D-06:** No `/gsd-beads-*` substitute skills ship in Phase 2.
- **D-07:** Discovery via bd memories (`gsd-beads:vocabulary`, surfaced by `bd prime`).
- **D-08:** Substitutes are a Phase 3 candidate.

**Mutation Event Emission (re-wrap manually in Phase 2)**
- **D-09:** Re-wrap our 13 handler overrides with GSDEvent emission matching upstream's `createRegistry()` pattern. Helper `wrapMutation(handler, cmd, eventStream, sessionId)` applied post-register.
- **D-10:** Reuse upstream's `buildMutationEvent` if reachable; otherwise rebuild the event shape.

### Claude's Discretion
- Specific test framework (vitest vs node:test vs bash + jq) — pick whatever's idiomatic; spike test runners (Spike 001's 20-case + Spike 012's 43-case) are bash-driven and proven.
- Exact directory layout for the recipe (`scripts/`, `hooks/`, `bin/`).
- Error message phrasing for hook denials — preserve spike pattern.
- Logging strategy for shadow binary — quiet by default; debug via `GSD_BEADS_DEBUG=1`.

### Deferred Ideas (OUT OF SCOPE)
- The 13 `/gsd-beads-*` substitute skills.
- Custom curl-pipe-bash installer.
- Multi-developer/federation extension.
- Live dashboard / GSDEvent observability story.
- `gsd-progress`-format-contract regen test fragility hardening.
- Migration script for existing GSD projects.
- `bd federation` peer support across machines.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | Beads is source of truth for workflow state | Shadow binary (Spike 013) routes all 13 state-bearing mutations to `bd q` / `bd label add` / `bd link`. Regen scripts (02-01) produce `.planning/ROADMAP.md` and `REQUIREMENTS.md` deterministically. — Plans 02-01, 02-03 |
| REQ-02 | GSD core unmodified | Y1 architecture imports upstream's `dist/` files via dynamic `import()`; no fork. Verified empirically (this research): `createRegistry`, `resolveQueryArgv`, `extractField`, `QUERY_MUTATION_COMMANDS`, `QueryRegistry` all exported from `~/.volta/.../get-shit-done-cc/sdk/dist/query/{index,registry}.js`. — Plan 02-03; verification gate per plan |
| REQ-03 | Cross-worktree state sharing | `worktree-post-checkout.sh` sentinel-merged into `.beads/hooks/post-checkout` (Spike 003 verified). Persists `git config --worktree gsd-beads.dir <source-repo>/.beads`. — Plan 02-04 |
| REQ-04 | Deterministic write-path enforcement | `block-state-md.sh` (Spike 001, 20/20 PASS) + `block-gsd-sdk-mutation.sh` (Spike 012, 43/43 PASS) + shadow binary intercept all three write paths. — Plans 02-02, 02-03 |
| REQ-05 | Conflict-free concurrent updates | Inherits from beads (Spike 005: 125 beads / 40 concurrent processes / 0 collisions; embedded Dolt file lock at ~3.25 writes/sec). No Phase 2 work — already provided by bd. — N/A (verification only via 02-06 E2E) |
| REQ-06 | Versioned, installable distribution | Install script with sentinel-marker deep-merge of settings.json + idempotent bd memory re-seed + ~/.local/bin/gsd-sdk symlink. — Plan 02-05; CRITICAL: D-03 mechanism mismatch (see Common Pitfalls) |
| REQ-07 | Narrative markdown untouched | Spike 001 `block-state-md.sh` allow-list verified for PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md. — Plan 02-02 (test parity) |
| REQ-08 | Ready-set query is canonical "what's next" | `bd ready` works as-is (Spike 002); no Phase 2 build. Only documented via `gsd-beads:vocabulary` memory. — Plan 02-05 (memory seeding) |

**Per-plan `requirements_addressed` recommendation:**

| Plan | REQ IDs to claim |
|------|------------------|
| 02-01 bd-helpers | REQ-01 (regen output is the source-of-truth view) |
| 02-02 hooks | REQ-04, REQ-07 |
| 02-03 shadow-binary | REQ-01, REQ-02, REQ-04 |
| 02-04 worktree-init | REQ-03 |
| 02-05 install-script | REQ-06, REQ-08 (memory seeding) |
| 02-06 e2e-smoke-test | REQ-01 through REQ-08 (integration verification) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Direct file-edit prevention | Claude Code hooks (PreToolUse) | — | Only the agent runtime sees Edit/Write tool calls before execution |
| gsd-sdk mutation routing | Node.js shadow binary on PATH | Claude Code Bash hook (defensive backup) | Shadow intercepts at the binary boundary; hook catches what shadow misses |
| State-bearing mutation execution | Beads (bd CLI) | Embedded Dolt | Spike 002 chose all-epic+labels strategy; bd handles concurrency |
| Markdown view regeneration | bash + jq + bd JSON output | — | Spike 007 format-contract documented; deterministic transformation |
| Cross-worktree state sharing | git per-worktree config + BEADS_DIR env | bd's bundled post-checkout hook chain | Spike 003 reshape; no external shared dir |
| Distribution / install | Self-contained install script (NOT bd recipe — see Pitfall #1) | bd memory seeding (`bd remember`) | bd custom recipes can only write ONE template file |
| Cascade close | bash loop on `bd epic close-eligible` | bd-sync.sh PostToolUse hook | Spike 002: 5-line idempotent loop, 3× faster than custom-types alternative |
| Mutation event emission | wrapMutation helper (D-09) post-`registry.register` | — | upstream's wrap-pass runs at construction time, before our overrides |

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `bd` (beads) | v1.0.3 | Source of truth for workflow state | The system under test; chosen by PROJECT.md |
| `jq` | 1.7.1 | JSON manipulation in hook scripts | All spike scripts depend on it; required by hook contract |
| `bash` | system | Hook script runtime; install script | Per CONVENTIONS.md "use whatever gets to a runnable result fastest" |
| `node` | ≥22 | Shadow binary runtime (ESM dynamic import) | Required for `import()` of upstream `dist/` files |
| `git` | system | Worktrees, hooks, history, sentinel-marker management | Spike 003 cross-worktree |
| `get-shit-done-cc` (upstream) | 1.38.5 | Provides `createRegistry`, `resolveQueryArgv`, `extractField` | The package the shadow imports from; `npm install -g` |

**Verified versions (this research session):**
- `bd version 1.0.3 (1b2dd2cb)` — `bd --version` (2026-04-27)
- `jq-1.7.1` — `jq --version` (2026-04-27)
- `node v24.14.0` — meets ≥22 requirement
- Upstream `get-shit-done-cc@1.38.5` — `cat package.json` (2026-04-27)

### Supporting
| Library / Tool | Purpose | When to Use |
|----------------|---------|-------------|
| `node:test` | Built-in test runner for shadow binary | Per-handler test cases (~3 per handler × 13 = ~40 tests) — no extra dependency, ESM-native |
| `bash`+`jq` test driver | Synthetic Claude Code payload runner for hooks | Already proven in Spikes 001 (20 cases), 012 (43 cases) — copy the pattern |
| `bats-core` | Bash test framework alternative | Avoid — adds a dependency the spike runners proved isn't needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `node:test` for shadow handlers | `vitest` | More features but adds dependency tree | Reject — keep shadow zero-dependency |
| `bash`+`jq` for hook tests | `bats-core` | Slightly more ergonomic asserts | Reject — Spike 001/012 runners already exist; copy & extend |
| Self-contained install script | bd custom recipe (D-03) | bd recipes don't actually do this (see Pitfall #1) | **Recommend reverting D-03** — see decisions-needing-revisit |

**Installation (planner — for plans that need new tooling):**
```bash
# Already on this developer's machine; install script must verify these exist
command -v bd && command -v jq && command -v node && command -v git
# Node ≥22 check:
node -e 'process.exit(parseInt(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'
```

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         Claude Code agent                          │
│                                                                    │
│   tool calls: Edit/Write    Bash("bd ...")    Bash("gsd-sdk ...")  │
└──┬───────────────────────┬─────────────────────────┬───────────────┘
   │                       │                         │
   │ PreToolUse            │ PostToolUse             │ PreToolUse
   │ (matcher Edit|Write)  │ (matcher Bash,          │ (matcher Bash,
   │                       │  if "Bash(bd *)")       │  if "Bash(gsd-sdk *)")
   │                       │                         │
   ▼                       ▼                         ▼
┌──────────────┐   ┌────────────────┐    ┌────────────────────────┐
│ block-state- │   │ bd-sync.sh     │    │ block-gsd-sdk-         │
│ md.sh        │   │  (PostToolUse) │    │ mutation.sh            │
│  (deny if    │   │                │    │  (deny if cmd ∈        │
│  path ∈ SoT) │   │ → cascade-loop │    │   deny-list of 13)     │
└──────┬───────┘   │ → regen-roadmap│    │  DEFENSIVE BACKUP      │
       │           │ → regen-       │    │  under Y1              │
       │           │   requirements │    └─────────┬──────────────┘
       │           └───────┬────────┘              │
       │                   │                       │
       ▼                   ▼                       ▼
   exit 0 +           bd epic                  exit 0 +
   permissionDecision close-eligible           permissionDecision
   = "deny"           (cascade)                = "deny"

                          ┌───────────────┐
                          │  bd CLI        │
                          │  (embedded     │
                          │   Dolt)        │
                          └───────┬────────┘
                                  │
                          .beads/issues.jsonl
                          (auto-export, git-tracked)

═══════════════════════════════════════════════════════════════════
SHADOW BINARY PATH (ahead of upstream gsd-sdk on PATH):

   Claude Code Bash("gsd-sdk query phase.add ...")
                    │
                    ▼
   ~/.local/bin/gsd-sdk → gsd-sdk-shadow.mjs
                    │
                    ▼
   if .beads/metadata.json exists in projectDir:
       import createRegistry, resolveQueryArgv, extractField
       registry = createRegistry()
       for cmd, h in BEADS_OVERRIDES:
           registry.register(cmd, wrapMutation(h, cmd, ...))   ← D-09
       matched = resolveQueryArgv(argv)
       result = registry.dispatch(matched.cmd, matched.args, projectDir)
                    │
                    ▼ (bd-backed handler)
              execSync('bd q ... -t epic')
              execSync('bd label add ... gsd:phase')
              execSync('bd link <child> <parent> --type parent-child')
   else:
       spawnSync(UPSTREAM_BIN, argv)   ← passthrough

═══════════════════════════════════════════════════════════════════
WORKTREE PROVISIONING:

   git worktree add ../wt-feature
                    │
                    ▼
   .beads/hooks/post-checkout (via core.hooksPath)
                    │
                    ▼ (bd's BEADS INTEGRATION block runs first)
   bd hooks run post-checkout
                    │
                    ▼ (gsd-beads sentinel block runs after)
   git config --worktree gsd-beads.dir <source-repo>/.beads
   touch <wt-gitdir>/info/.gsd-beads-configured   ← idempotency marker
```

### Recommended Project Structure

The recipe template directory layout (Claude's discretion per CONTEXT.md):

```
gsd-beads/                                  # the source-of-truth repo for the layer
├── bin/
│   └── gsd-sdk-shadow.mjs                  # shadow binary (Plan 02-03)
├── hooks/
│   ├── block-state-md.sh                   # Plan 02-02 (extends Spike 001 POC)
│   ├── block-gsd-sdk-mutation.sh           # Plan 02-02 (Spike 012 POC, polish only)
│   ├── bd-sync.sh                          # Plan 02-02 (extends Spike 001 stub)
│   └── worktree-post-checkout.sh           # Plan 02-04 (Spike 003 POC, polish only)
├── scripts/
│   ├── cascade-loop.sh                     # Plan 02-01 (Spike 002 POC, polish only)
│   ├── regen-roadmap.sh                    # Plan 02-01 NEW (Spike 007 contract)
│   ├── regen-requirements.sh               # Plan 02-01 NEW (Spike 007 contract)
│   └── install.sh                          # Plan 02-05 NEW
├── recipe/
│   └── gsd-beads-recipe.md                 # Plan 02-05 (the file bd writes — see Pitfall #1)
├── settings.fragment.json                  # Plan 02-02 (Spike 001 starting point)
├── tests/
│   ├── hook-tests/                         # bash + jq runners (Plans 02-02 patterns from Spikes 001/012)
│   ├── shadow-tests/                       # node:test (Plan 02-03)
│   └── e2e/                                # Plan 02-06 fixture-based smoke
└── README.md
```

### Pattern 1: Hook Script Contract (proven, Spike 001 + 012)
**What:** Every PreToolUse hook reads JSON payload, filters in script body, emits structured deny via exit-0 + JSON or implicit allow via exit-0 silent.
**When to use:** All three hook scripts in 02-02.
**Example (verbatim from Spike 001's `block-state-md.sh`):**
```bash
# Source: .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh
payload="$(cat)"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
[ -z "$file_path" ] && exit 0

case "$file_path" in
  */.planning/ROADMAP.md|*/.planning/REQUIREMENTS.md|*/.planning/todos/*|*/.planning/seeds/*\
  |.planning/ROADMAP.md|.planning/REQUIREMENTS.md|.planning/todos/*|.planning/seeds/*)
    target="${file_path##*.planning/}"
    jq -n --arg target "$target" '{ hookSpecificOutput: { ... permissionDecision: "deny" ... } }'
    exit 0 ;;
  *) exit 0 ;;
esac
```
[VERIFIED: file read this session]

### Pattern 2: Shadow Binary Registry-Override (proven, Spike 013)
**What:** Import upstream SDK primitives, register bd-backed handler overrides, dispatch through SDK's machinery.
**When to use:** Plan 02-03.
**Example (verbatim from Spike 013's `gsd-sdk-shadow-v2.mjs`):**
```javascript
// Source: .claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs
const queryModule = await import(QUERY_INDEX_PATH);
const registryModule = await import(REGISTRY_PATH);
const registry = queryModule.createRegistry();
for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, handler);
}
const matched = registryModule.resolveQueryArgv(queryArgv, registry);
const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
console.log(pickField !== undefined
  ? registryModule.extractField(result.data, pickField)
  : JSON.stringify(result));
```
[VERIFIED: file read + empirical run this session — `createRegistry()` returns a registry with `phase.add` registered (true) and `progress` registered (true)]

### Pattern 3: Sentinel-Marker Hook-Chain Append (proven, Spike 003)
**What:** Append a `# --- BEGIN GSD-BEADS ... v1 ---` / `# --- END GSD-BEADS ... ---` block to bd's `.beads/hooks/post-checkout`. Multiple sentinel-marked blocks coexist; install/uninstall scripts manage their own block.
**When to use:** Plans 02-04 (worktree shim) and 02-05 (uninstall path).
**Example (verbatim from Spike 003's `worktree-post-checkout.sh`):**
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
[ -d "$source_beads" ] || { printf '[gsd-beads] ⚠ Source repo at %s has no .beads/\n' "$source_root" >&2; exit 0; }
git config --worktree gsd-beads.dir "$source_beads" 2>/dev/null || git config gsd-beads.dir "$source_beads"
mkdir -p "$gitdir/info" && touch "$marker"
printf '[gsd-beads] ✓ Worktree configured (gsd-beads.dir=%s)\n' "$source_beads"
# --- END GSD-BEADS WORKTREE INIT ---
```
[VERIFIED: file read this session; bd v1.0.3's `.beads/hooks/post-checkout` already uses sentinel-marker pattern with `# --- BEGIN BEADS INTEGRATION v1.0.3 ---` markers — empirically confirmed]

### Pattern 4: Synthetic Claude Code Payload Test Driver (proven, Spike 001 + 012)
**What:** Bash + jq runner that constructs JSON payloads matching Claude Code's documented hook input shape, pipes through the script under test, captures stdout/exit, asserts.
**When to use:** All hook tests (02-02).
**Example (Spike 001's payload shape):**
```bash
payload=$(jq -n --arg tool "$tool" --arg file_path "$file_path" '{
  session_id: "spike-test", transcript_path: "/tmp/x.jsonl", cwd: "/tmp",
  permission_mode: "default", hook_event_name: "PreToolUse",
  tool_name: $tool, tool_input: { file_path: $file_path, content: "anything" },
  tool_use_id: "toolu_test"
}')
stdout=$(printf '%s' "$payload" | "$BLOCK_HOOK" 2>/dev/null) || true
got=$(printf '%s' "$stdout" | jq -r '.hookSpecificOutput.permissionDecision // "allow"')
```
[VERIFIED: copy-paste from Spike 001's `test-runner.sh`, line 32-47]

### Anti-Patterns to Avoid

- **`bash` heredoc here-doc redirection in install script when writing settings.json fragments.** Use `jq` to construct + write — heredoc string interpolation drift is common.
- **Treating `permissionDecisionReason` as enforcement.** It's a hint to the agent; the deny is the enforcement. Don't rely on phrasing alone.
- **Forking upstream gsd-sdk source.** REQ-02 — use only dynamic import of `dist/`.
- **Hand-rolling argv parsing in shadow.** Spike 013 already proved `resolveQueryArgv` handles dotted vs space-aliased forms — use it.
- **Custom types `requirement`/`phase` for beads.** Spike 002 chose all-epic+labels (3× faster cascade); don't revisit.
- **Skip the relative-path case in `block-state-md.sh`.** Spike 001 iteration 2 found this gap empirically — Phase 2 must keep both shapes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argv parsing for `gsd-sdk query <cmd>` (dotted vs space-aliased) | Custom regex | `resolveQueryArgv` from `query/registry.js` | Handles `phase.add` and `phase add` automatically via longest-prefix scan |
| `--pick <field>` extraction | jq-style path traversal | `extractField` from `query/registry.js` | Already implements the SDK's pick semantics; free correctness |
| QueryHandler return shape | Custom JSON wrapper | Return `{ data: {...} }` (matches `QueryResult`) | Upstream's printers expect this exact shape |
| Cascade-close logic for parent-child trees | Custom recursion | `bd epic close-eligible` in a 5-line loop | Spike 002: 0.86s vs 2.7s; uses bd's native machinery |
| Tree rendering for parent-child hierarchy | `bd dep tree` | `bd children <id>` | `dep tree` walks `blocks` deps (wrong); `children` walks parent-child |
| Settings.json deep-merge | Heredoc string concat | `jq` with array deduplication on `(matcher, command)` | Spike 001: no native tool exists; jq deep-merge is the only correct approach |
| Persistent agent context | CLAUDE.md addendum | `bd remember --key gsd-beads:* "..."` | bd memories surface via `bd prime` at SessionStart, travel with JSONL roundtrip |
| Cross-worktree env-var discipline | Manual `export BEADS_DIR=...` | post-checkout shim writes `git config --worktree gsd-beads.dir` | Spike 003: per-worktree config persists; no shell-init dependency |
| Concurrent-write conflict resolution | Custom merge logic | bd's embedded Dolt file lock | Spike 005: 0 collisions across 125 beads / 40 procs |

**Key insight:** The shadow binary's win is using upstream's primitives. The cost of hand-rolling argv/dispatch/extraction is high (~200 lines of brittle code) and offers zero functionality gain.

## Runtime State Inventory

> Phase 2 is a NEW build, not a rename/refactor. This section is included because
> Plan 02-05 deals with `~/.claude/settings.json` deep-merge — which IS a runtime
> state mutation that the install script must handle correctly across re-installs.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — this is greenfield code; no existing beads-managed projects to migrate (per PROJECT.md non-goal) | None [VERIFIED: PROJECT.md non-goals section] |
| Live service config | `~/.claude/settings.json` is per-user state mutated by `bd setup claude` AND `gsd-beads` install. Both append sentinel-marked blocks; deep-merge must dedupe on `(matcher, command)` | install.sh must implement jq-based deep-merge with array dedup; uninstall removes ONLY the gsd-beads block (Plan 02-05) |
| OS-registered state | `~/.local/bin/gsd-sdk` symlink — must take precedence over `~/.volta/bin/gsd-sdk` on PATH; existing systems may have other `gsd-sdk` binaries [VERIFIED: `which gsd-sdk` returns volta path on this machine; PATH ordering shows `~/.volta/bin` BEFORE `~/.local/bin`] | install.sh must verify PATH ordering and warn / abort if wrong (Plan 02-05) |
| Secrets/env vars | `BEADS_DIR` env var (read by bd CLI). Set per-worktree via git config, NOT via env shell init | None — no env file pollution (Spike 003 design choice) |
| Build artifacts | None — the recipe is shipped as bash/node source; no compiled artifacts | None |

**Critical PATH ordering finding:** On this developer's machine, `~/.volta/bin` precedes `~/.local/bin`. The shadow at `~/.local/bin/gsd-sdk` would be **shadowed by upstream**, defeating the design. Install script MUST detect this and either:
1. Warn loudly and abort with remediation steps,
2. Or write to a different location that IS on PATH first (e.g., wrap as a Volta hook — but Volta shims own that namespace),
3. Or document a one-time `~/.profile` patch that prepends `~/.local/bin` to PATH.

This is a real install-time gotcha that Plan 02-05 must handle. The shadow's docstring claims "most users already have this from `~/.profile`" — that is FALSE for Volta users specifically.

## Common Pitfalls

### Pitfall 1: bd Custom Recipe ≠ Multi-File Installer (CRITICAL — re-examine D-03/D-04/D-05)
**What goes wrong:** Spike 002 documented `bd setup --add gsd-beads <path>` as the distribution mechanism. Empirical probe of bd v1.0.3 this session shows the recipe contract is fundamentally different from what was assumed.

**Empirical evidence (this session, 2026-04-27):**
```
$ bd setup --add probe2 /tmp/template/template.md      → ✓ Added recipe 'probe2'
$ cat /tmp/template/template.md                          → "# CUSTOM RECIPE PAYLOAD"  (our content)
$ bd setup probe2                                        → ✓ probe2 integration installed
$ cat /tmp/template/template.md                          → 1844 bytes of bd's canonical "Beads Issue Tracking" template
```
[VERIFIED: empirical probe; bd v1.0.3]

**bd's actual recipe contract:**
- `bd setup --add <name> <path>` registers a **destination path** (where the template should be written)
- `bd setup <name>` writes bd's bundled `bd prime`-style template TO that path
- The custom recipe **cannot ship multiple files**, **cannot run shell scripts**, and **cannot inject** anything other than the canonical bd template
- The template content itself is hardcoded in bd's binary — there is no way to substitute a custom template file

**Implication for D-03/D-04/D-05:** The plan to "distribute as a `bd setup --add gsd-beads <path>` recipe" cannot work as written. The recipe slot can only point at a single markdown file that gets bd's standard content written into it. Hooks, the shadow binary, the install script, and bd memory seeding must all come from somewhere else.

**How to avoid:** Plan 02-05 must build a self-contained `install.sh` and a small `gsd-beads-recipe.md` informational template. The user's recipe-path decision still adds value as a discovery surface (`bd setup --list` shows `gsd-beads`), but the actual install work happens via cloning the repo and running `install.sh`.

**Decision needing user revisit:**
- D-03: still useful as a **discovery hook**, not as the install mechanism
- D-04: re-examine — if recipes can't install multi-file layers, do we need a curl-pipe-bash or `git clone && ./install.sh` step?
- D-05: rewrite — the recipe payload is bd's canned template (we don't author it), our content goes in `install.sh`

**Warning signs:** any time a plan's task says "the recipe runs the install script" — this is impossible with bd's actual recipe contract.

### Pitfall 2: `buildMutationEvent` Is Not Exported (D-09 Wrap-Pass)
**What goes wrong:** D-09 plans to wrap our 13 handler overrides with `GSDEvent` emission "matching upstream's pattern" and "reuse upstream's `buildMutationEvent` if reachable" (D-10). Inspection of `query/index.js` this session shows `buildMutationEvent` is a **module-internal function** (line 121) with **no export statement**.

**Empirical evidence:**
```
$ grep -nE 'export' query/index.js | grep -i mutation
30:export declare const QUERY_MUTATION_COMMANDS: Set<string>;     ← exported
121:function buildMutationEvent(correlationSessionId, cmd, args, result) {  ← NOT exported
```
[VERIFIED: file read this session, lines 81–199 of `index.js`]

The function is ~80 lines: it inspects the command prefix (`template.`, `commit`, `frontmatter.`, `config-`, `validate.`, `phase.`, `state.`, fallback) and constructs a `GSDEventType.{StateMutation,GitCommit,FrontmatterMutation,...}` object. `GSDEventType` IS exported from `dist/types.js`.

**How to avoid:** D-10's "rebuild from documented fields" path is the only viable one. Plan 02-03 must:
1. Import `GSDEventType` from `~/.volta/.../sdk/dist/types.js`
2. Reproduce the prefix-dispatch logic as a small `gsd-beads/scripts/buildMutationEvent.mjs` helper (~80 lines, copy-source-attributed in a comment)
3. Add a verification test that asserts our helper's output for `phase.add`, `roadmap.update-plan-progress`, `requirements.mark-complete`, `todo.complete`, `milestone.complete` matches what upstream's wrap-pass would produce (snapshot test against a sample run from a non-overridden registry)

**Risk if upstream changes `buildMutationEvent`:** our helper drifts silently. Mitigation: snapshot test (above) against a freshly-instantiated unmodified registry — it will fail as soon as the upstream output shape changes.

**Warning signs:** any plan task that says "import `buildMutationEvent`" — that import will fail at runtime.

### Pitfall 3: PostToolUse `bd-sync.sh` Latency Budget on Every `bd` Call
**What goes wrong:** `bd-sync.sh` runs after every `bd ` Bash invocation (including `bd ready`, `bd list`, `bd show` — all read-only). It runs the cascade-loop + regenerates ROADMAP.md + REQUIREMENTS.md. If regen takes >5s, agents will perceive sluggishness.

**Estimated cost (extrapolating from Spike 002 timings):**
- cascade-loop: 0.86s on 7-issue fixture; scales sublinearly. Real projects with 50+ beads: ~1.5–2s per call
- regen-roadmap.sh: `bd list --type=epic -l gsd:phase --json` + `bd children` per phase + format. Estimate ~0.5–1s
- regen-requirements.sh: similar, ~0.5s

**Total per `bd ` call: ~2–4s.** The hook timeout is 30s (per `settings.fragment.json`). It will not time out, but it will slow every read.

**How to avoid:**
1. **Read-only filter:** `bd-sync.sh` should detect `bd list|show|ready|memories|status|prime` and skip regen. Only state-changing `bd` commands (`bd close`, `bd update`, `bd q`, `bd label add`, `bd link`, `bd dep add`) need regen. Spike 001's stub didn't filter — Phase 2 must.
2. **Idempotency check:** if last regen timestamp < 1s ago, skip (debounce). Use `mtime` on the regenerated files.
3. **Cascade-loop is already idempotent** (Spike 002 — safe to call repeatedly), but the regen is the slow part.

This filter logic is NEW to Phase 2 and not in the spike POCs. Plan 02-02's `bd-sync.sh` task must include it.

**Warning signs:** any e2e test that runs `bd ready` and observes >2s wall-clock latency.

### Pitfall 4: `--project-dir` Argv Position Quirk
**What goes wrong:** Upstream gsd-sdk's CLI parser requires `--project-dir <x>` to come AFTER `query <cmd>`, not before. Spike 013 iteration 4 hit this empirically. The shadow's `getProjectDir(argv)` must respect this.

**Empirical:** `gsd-sdk --project-dir /x query phase.add 'X'` — broken upstream
`gsd-sdk query phase.add 'X' --project-dir /x` — works
[VERIFIED: Spike 013 README iteration 4]

**How to avoid:** Plan 02-03's argv parser must scan AFTER `queryIdx` for `--project-dir`, not before. Spike 013's POC code does this correctly (line 73 in v2.mjs uses `argv.indexOf('--project-dir')` — which works regardless of position, but the parsed value still needs to come after `query`). Test case: `gsd-sdk query phase.add "X" --project-dir /tmp/test` MUST route to handler with projectDir=/tmp/test.

**Warning signs:** test failures like "(beads project not detected; passing through)" when `--project-dir` is set correctly.

### Pitfall 5: `bd q` and the Subset of bd Commands Used
**What goes wrong:** The shadow handlers use `bd q` (quick capture, returns ID). The 13 handlers each call 2–4 `bd` subcommands (`bd q`, `bd label add`, `bd link`, `bd close`, `bd update`). Each `execSync` call is ~50–100ms. A handler doing 4 calls = ~300ms minimum.

**For `phase.add-batch` (which takes a JSON array of phases):** if the input has 10 phases × 4 calls each × 100ms = 4 seconds. Synchronous, blocking the agent.

**How to avoid:**
1. Plan 02-03 should benchmark each handler against realistic inputs.
2. For batch operations (`phase.add-batch`, `phases.archive`), consider `bd create --body-file -` with bd's batch-input mode (the `--help` for `bd create` shows it accepts markdown/graph JSON).
3. Document timing budget per handler in handler comments.

**Warning signs:** smoke test in 02-06 with >10 phases takes >5s for `phase.add-batch`.

### Pitfall 6: Settings.json Deep-Merge Array Deduplication on `(matcher, command)`
**What goes wrong:** When the user re-installs gsd-beads, the install script appends to `hooks.PreToolUse[]` and `hooks.PostToolUse[]` arrays. Without dedupe, every re-install grows the arrays. After 5 re-installs the agent has 5 copies of the same hook firing 5 times.

**How to avoid:** Plan 02-05's deep-merge must deduplicate on `(matcher, command_string)` tuple. jq pattern (verified-shape):
```bash
jq -s '.[0] * .[1] | .hooks |= (
  to_entries | map(.value |=
    (group_by(.matcher) | map(
      .[0] + {hooks: (map(.hooks) | flatten | unique_by("\(.command)\(.if // "")"))}
    ))
  ) | from_entries
)' existing.json gsd-beads-fragment.json
```
This needs unit testing — the dedupe key MUST include `if` because two hooks with same command but different `if` filters are distinct.

**Warning signs:** install.sh idempotency test fails after 2nd or 3rd run; settings.json grows unboundedly.

### Pitfall 7: Worktree Hook Append Idempotency
**What goes wrong:** install.sh appends the gsd-beads worktree-init block to `.beads/hooks/post-checkout`. Re-running install would append again unless idempotent.

**How to avoid:** Spike 003's POC already has the sentinel marker (`# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---`). Install.sh must:
1. Check if marker already present in target file → skip append, OR
2. Replace existing marker block (sed `/BEGIN/,/END/d` then append) — this also handles version upgrades

The POC script ITSELF is idempotent (uses `marker="$gitdir/info/.gsd-beads-configured"`), but the **install of the POC script into the chain** is NOT idempotent in the spike — Phase 2 must add this.

**Warning signs:** running install.sh twice and finding two `# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---` blocks in `.beads/hooks/post-checkout`.

### Pitfall 8: Spike 005 Concurrent Merge — Same-Field Last-Writer-Wins
**What goes wrong:** Two agents in parallel worktrees both call `bd update <id> --status closed` on the same bead. Spike 005 confirmed both succeed without error, but only one `close_reason` persists. For non-trivial fields (e.g., notes), data is silently lost.

**How to avoid:** Document in `gsd-beads:concurrent-writes` memory: "Same-field updates are last-writer-wins; for collaborative annotation, use `bd update --append-notes` not `--description`." This is informational; no Phase 2 code change needed.

**Warning signs:** rare — two agents writing the same field at the same instant. Not a likely real-world issue for single-developer audience (PROJECT.md). Filed as known limitation.

## Code Examples

Verified patterns from official sources / spike POCs:

### Example 1: Building a 3-level beads hierarchy (canonical, Spike 002)
```bash
# Source: .claude/skills/spike-findings-gsd-beads/references/beads-modeling.md
REQ=$(bd q "REQ-042: Email/password auth" -t epic -p 0)
bd label add "$REQ" gsd:requirement

P1=$(bd q "Phase 12: Auth backend" -t epic -p 1)
bd label add "$P1" gsd:phase
bd link "$P1" "$REQ" --type parent-child

T1=$(bd q "Hash passwords" -t task -p 2)
bd link "$T1" "$P1" --type parent-child
```
[VERIFIED: empirical pattern from Spike 002]

### Example 2: Cascade-loop (canonical, Spike 002)
```bash
# Source: .claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh
iter=0
total_closed=0
while :; do
  iter=$((iter + 1))
  out=$(bd epic close-eligible 2>&1)
  if echo "$out" | grep -q 'No epics eligible'; then break; fi
  echo "$out"
  closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
  total_closed=$((total_closed + ${closed:-0}))
done
[ "$total_closed" -gt 0 ] && echo "Cascade complete: $total_closed epic(s) closed across $((iter - 1)) iteration(s)"
```
[VERIFIED: empirical 0.86s on 7-issue fixture per Spike 002]

### Example 3: Shadow handler skeleton (Plan 02-03 template)
```javascript
// Adapted from: .claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs
async function beadsPhaseAdd(args, projectDir) {
  const title = args[0] ?? 'Untitled phase';
  const beadId = execSync(
    `bd q ${JSON.stringify(title)} -t epic -p 1`,
    { cwd: projectDir, encoding: 'utf-8' }
  ).trim();
  execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });
  // (Phase 2: trigger bd-sync.sh to regenerate ROADMAP.md is handled by PostToolUse hook —
  //  no explicit call needed inside the handler itself)
  return { data: { phase_id: beadId, title, status: 'added', backend: 'beads' } };
}
```
[VERIFIED: Spike 013 POC; only `phase.add` is fully implemented in the POC — Phase 2 implements the other 12]

### Example 4: D-09 wrap-pass helper (NEW, derived from `query/index.js` lines 486–503)
```javascript
// Source: derived from upstream get-shit-done-cc/sdk/dist/query/index.js lines 486–503
//         + buildMutationEvent body lines 121–199 (NOT EXPORTED — must be re-implemented)
import { GSDEventType } from '/path/to/sdk/dist/types.js';

function buildMutationEvent(sessionId, cmd, args, result) {
  const base = { timestamp: new Date().toISOString(), sessionId };
  if (cmd.startsWith('phase.') || cmd.startsWith('phase ') ||
      cmd.startsWith('phases.') || cmd.startsWith('phases ')) {
    return { ...base, type: GSDEventType.StateMutation, command: cmd,
             fields: args.slice(0, 2), success: true };
  }
  // ... (other prefix branches per upstream lines 121–199)
  return { ...base, type: GSDEventType.StateMutation, command: cmd,
           fields: args.slice(0, 2), success: true };
}

function wrapMutation(handler, cmd, eventStream, sessionId) {
  return async (args, projectDir) => {
    const result = await handler(args, projectDir);
    try {
      eventStream?.emitEvent(buildMutationEvent(sessionId, cmd, args, result));
    } catch { /* fire-and-forget per upstream pattern */ }
    return result;
  };
}

// Apply post-register:
const registry = createRegistry(eventStream, sessionId);  // upstream wraps its handlers
for (const [cmd, h] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, wrapMutation(h, cmd, eventStream, sessionId));  // re-wrap our overrides
}
```
[CITED: structure from `query/index.js` lines 486–503; ASSUMED safe — assumes upstream's event-emit semantics don't change. Snapshot test recommended (see Pitfall 2)]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 13 `/gsd-beads-*` substitute skills (~3,000 lines) | Y1 shadow binary (~1,000 lines) | Spike 013 (2026-04-27) | -2,000 lines; upstream skills work transparently |
| `bd init --stealth` | `bd init --non-interactive --skip-agents` | Spike 003 reshape (2026-04-27) | beads is git-tracked: audit log + multi-machine sync via `git push/pull` |
| Custom types `requirement`/`phase` | All-epic + labels (`gsd:requirement`/`gsd:phase`) | Spike 002 (2026-04-27) | 3× faster cascade; uses bd's native `bd epic close-eligible` |
| `bd dep add` for parent-child | `bd link --type parent-child` | Spike 002 | `bd dep add` defaults to `blocks` (wrong semantics) |
| `bd dep tree` for hierarchy | `bd children <id>` | Spike 002 | `dep tree` walks `blocks`, not parent-child |
| CLAUDE.md addendum for persistent instructions | `bd remember --key gsd-beads:* "..."` memories | Spike 002 review correction | searchable, JSONL-portable, surfaced by `bd prime` |
| Pre-Y1: PreToolUse(Bash) gsd-sdk hook is PRIMARY | Now DEFENSIVE BACKUP under Y1 | Spike 013 | shadow handles mutations; hook catches what shadow doesn't override |

**Deprecated/outdated:**
- `bd init --stealth`: do NOT use (Spike 003 reshape)
- Approach A (custom types) for beads: rejected by Spike 002 — kept `cascade-close.sh` as fallback reference only
- Argv-intercept variant of shadow (`gsd-sdk-shadow.js`): rejected by Spike 013 in favor of registry-override variant (`gsd-sdk-shadow-v2.mjs`)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bd v1.0.3's recipe `--add` contract will not change to support multi-file payloads in the near term | Pitfall 1 | If bd adds multi-file recipes in a future release, D-03 path could be revisited; no risk for MVP |
| A2 | upstream `get-shit-done-cc` sdk/dist/query/index.js's `createRegistry`/`resolveQueryArgv`/`extractField` exports remain stable across minor versions | Standard Stack, Pattern 2 | If upstream tightens `exports` field on `sdk/package.json` or renames internals, the shadow's dynamic import path breaks at runtime. Mitigation: install.sh validates by attempting an import at install time |
| A3 | `bd-sync.sh` regen takes <5s on real-world projects (50+ beads). Estimated 2–4s; not benchmarked at scale | Pitfall 3 | Performance regression — bd-sync hook hits 30s timeout, agent sees errors. Plan 02-06 e2e must include a 50-bead fixture to validate |
| A4 | `node:test` is sufficient for shadow handler tests (no need for vitest's mocking ergonomics) | Standard Stack | If tests require complex `bd` CLI mocking, may need to introduce a mocking lib. Mitigation: handler tests run against a real ephemeral `.beads/` via `bd init` in a tmp dir, no mocking needed |
| A5 | `~/.local/bin` can be made to precede `~/.volta/bin` on PATH for the user installing gsd-beads | Runtime State Inventory | Volta users (this developer) may have to manually patch `~/.profile`. Plan 02-05 documents this; install.sh detects + warns |
| A6 | The 13 state-bearing mutations enumerated in Spike 013 are exhaustive — no other gsd-sdk mutations write to `.planning/ROADMAP.md` / `REQUIREMENTS.md` / `todos/` / `seeds/` | shadow-binary-architecture.md | New upstream mutations slip through (silent MD writes). Mitigation: Spike 012 hook is the defensive backup |
| A7 | `.beads/issues.jsonl` auto-export latency (60s throttle per Spike 002) doesn't interfere with regen — regen reads from `bd list`/`bd children` which hit Dolt directly, not JSONL | bd-sync.sh design | If regen reads JSONL, it can be stale. Verified-by-design: all regen calls use `bd list --json` |
| A8 | The wrap-pass helper's reproduction of `buildMutationEvent` will not drift from upstream behavior in MVP timeframe (no GSDEvent consumer exists yet, so any drift is silent and safe for single-developer audience) | Pitfall 2 | Drift only matters if a dashboard ships; MVP has no consumer. Recommended snapshot test catches drift on upstream upgrade |

## Open Questions

1. **Should D-03 (bd recipe distribution) be revised in light of Pitfall 1 above?**
   - What we know: bd custom recipes are single-file template writers, not multi-file installers
   - What's unclear: Is the user OK shifting to `git clone gsd-beads && ./install.sh`? Or should the recipe stay for discovery (`bd setup --list`) while a curl-pipe-bash fills the gap?
   - Recommendation: Surface this in the planner's pre-plan checklist; ask the user to confirm before 02-05 is written. The planner should NOT write a plan that says "recipe runs the install script" — that doesn't work.

2. **What's the dolt_database prefix policy for the install script?**
   - What we know: Spike 004 found `bd init --from-jsonl --prefix <X>` is mandatory for fresh-clone bootstrap; `<X>` reads from `.beads/metadata.json`'s `dolt_database` field
   - What's unclear: For greenfield `bd init --non-interactive --skip-agents` (no `--from-jsonl`), does the install script need to set a specific `--prefix`? Default uses directory name.
   - Recommendation: For Plan 02-05, default to bd's auto-derived prefix (directory name). Document the fresh-clone bootstrap script (Spike 004) as a separate small utility for users cloning a beads-managed project.

3. **Where exactly does `wrapMutation` live in code?**
   - What we know: D-09 says ~30 lines helper + 13 wrapping calls
   - What's unclear: Is the helper inline in `gsd-sdk-shadow.mjs` or in a separate `lib/wrap-mutation.mjs`?
   - Recommendation: Plan 02-03 — separate module `bin/wrap-mutation.mjs` so it's unit-testable independently. Snapshot tests live in `tests/shadow-tests/wrap-mutation.test.mjs`.

4. **Test fixture size for E2E (Plan 02-06)?**
   - What we know: E2E builds "a 3-level hierarchy" (CONTEXT.md specifics)
   - What's unclear: How many phases / tasks? 3-level minimal (1 req → 2 phases → 3 tasks each = 7 beads) is fast but doesn't catch the bd-sync latency issue (Pitfall 3).
   - Recommendation: Plan 02-06 has TWO fixtures: a "minimal" 7-bead happy-path and a "scale" 50-bead fixture for performance assertions.

5. **Should the install script support both PATH locations (`~/.local/bin/gsd-sdk` AND PATH-precedence-aware fallback)?**
   - What we know: A5 above flags Volta-PATH-ordering as a real install gotcha
   - What's unclear: Is patching `~/.profile` automatically (line addition) acceptable, or do we want explicit user opt-in?
   - Recommendation: Plan 02-05 detects + warns; documents fix in install output; does NOT modify `~/.profile` automatically. User decision area.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` (beads) | All plans (PROJECT.md prerequisite) | ✓ | 1.0.3 | — (hard fail; install.sh aborts) |
| `jq` | All hook scripts; install.sh deep-merge | ✓ | 1.7.1 | — (hard fail; install.sh aborts) |
| `node` | Shadow binary, shadow tests | ✓ | 24.14.0 (≥22 required) | — (hard fail) |
| `bash` | All scripts | ✓ | system | — |
| `git` | Worktree shim, install in repos | ✓ | system | — |
| `get-shit-done-cc` (upstream) | Shadow binary imports | ✓ | 1.38.5 at `~/.volta/.../node_modules/` | — (shadow runtime checks `$GSD_SDK_PATH` and aborts loudly if missing) |
| `~/.local/bin` directory | Shadow binary symlink | ✓ on this machine | — | install.sh creates if missing |
| `~/.local/bin` BEFORE `~/.volta/bin` on PATH | Shadow precedence | ✗ on this machine | — | **Document remediation**; install.sh detects + warns |
| `bd setup --add` recipe registration | D-03 distribution | ✓ but contract is misunderstood (Pitfall 1) | — | Self-contained `install.sh` (decision needed) |

**Missing dependencies with no fallback:** None for the build itself — all tooling is present.

**Missing dependencies with fallback:**
- PATH ordering: documented remediation in install output

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Hook scripts framework | bash + jq synthetic-payload runner (Spike 001/012 pattern) |
| Shadow binary framework | `node:test` (built-in, ESM-native, zero dependencies) |
| Install script framework | bash test (idempotency assertions on file contents + exit codes) |
| E2E framework | bash + ephemeral fixture (`/tmp/gsd-beads-e2e-${RANDOM}`) |
| Quick-run command (per task commit) | `tests/run-quick.sh` (single suite of the touched component) |
| Full-suite command (per wave merge) | `tests/run-all.sh` (every suite + e2e) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | bd is source of truth — regen produces identical output for same bd state | unit (regen-roadmap.sh) | `bash tests/hook-tests/regen-roadmap.test.sh` | ❌ Wave 0 |
| REQ-01 | bd is source of truth — shadow's phase.add creates a bead with `gsd:phase` label | unit (shadow handler) | `node --test tests/shadow-tests/handler-phase-add.test.mjs` | ❌ Wave 0 |
| REQ-02 | GSD core unmodified — no file under `~/.claude/get-shit-done/` is touched by install | integration | `bash tests/install-tests/no-gsd-core-mutation.test.sh` | ❌ Wave 0 |
| REQ-02 | GSD core unmodified — shadow imports work after `/gsd-update` | smoke | `bash tests/e2e/post-gsd-update.smoke.sh` | ❌ Wave 0 |
| REQ-03 | Cross-worktree — new worktree via `git worktree add` auto-configures `gsd-beads.dir` | integration | `bash tests/worktree-tests/auto-config.test.sh` | ❌ Wave 0 |
| REQ-04 | Edit/Write hook denies state-bearing paths (12 cases from Spike 001) | unit | `bash tests/hook-tests/block-state-md.test.sh` | ✅ exists in spike POC; copy/extend |
| REQ-04 | bd-sync runs on `bd ` Bash, skips on others (Spike 001 pattern) | unit | `bash tests/hook-tests/bd-sync.test.sh` | ✅ exists; extend with regen filter |
| REQ-04 | gsd-sdk-mutation hook denies 13 mutations × 2 forms = 26 + 17 allow cases (Spike 012) | unit | `bash tests/hook-tests/block-gsd-sdk-mutation.test.sh` | ✅ exists in spike POC; copy verbatim |
| REQ-04 | Shadow routes 13 mutations to bd-backed handlers; passthrough for others | unit | `node --test tests/shadow-tests/*.test.mjs` | ❌ Wave 0 |
| REQ-04 | Shadow's wrapMutation emits a GSDEvent for each mutation | unit (snapshot test against upstream's wrap-pass output) | `node --test tests/shadow-tests/wrap-mutation.test.mjs` | ❌ Wave 0 |
| REQ-05 | Concurrent updates safe — 2 worktrees writing same bead ID don't conflict | integration (slow) | `bash tests/e2e/concurrent-merge.test.sh` | ❌ Wave 0 |
| REQ-06 | Install script idempotent — running twice produces zero diff in `~/.claude/settings.json` | unit | `bash tests/install-tests/idempotency.test.sh` | ❌ Wave 0 |
| REQ-06 | Install script deep-merges settings.json without clobbering existing hooks | unit | `bash tests/install-tests/settings-merge.test.sh` | ❌ Wave 0 |
| REQ-06 | bd memory seeding produces 7 keys under `gsd-beads:` namespace | unit | `bash tests/install-tests/memory-seeding.test.sh` | ❌ Wave 0 |
| REQ-06 | Symlink at `~/.local/bin/gsd-sdk` resolves; install warns if PATH-shadowed | unit | `bash tests/install-tests/path-precedence.test.sh` | ❌ Wave 0 |
| REQ-07 | Edit on PLAN.md / RESEARCH.md / AI-SPEC.md / UI-SPEC.md / DISCUSSION-LOG.md is allowed (not denied) | unit (Spike 001 already covers; verify) | `bash tests/hook-tests/block-state-md.test.sh::allow-narrative` | ✅ in Spike 001's runner — `allow-edit-narrative-plan` etc. |
| REQ-08 | `bd ready` works as-is in a beads-managed project (smoke) | smoke | `bash tests/e2e/bd-ready.smoke.sh` | ❌ Wave 0 |
| (cross-cutting) | E2E: fresh fixture, full install, build hierarchy, cascade fires, regenerated ROADMAP.md parses via `gsd-progress` | smoke (slow) | `bash tests/e2e/full-install.smoke.sh` | ❌ Wave 0 |
| (cross-cutting) | E2E: 50-bead fixture, bd-sync.sh latency <5s | performance | `bash tests/e2e/bd-sync-latency.test.sh` | ❌ Wave 0 |

### Coverage Targets (Nyquist: test cases >= 2× decision branches)

| Component | Decision branches | Test cases | Source |
|-----------|---------|---------|--------|
| `block-state-md.sh` | 5 path patterns × 2 shapes (abs/rel) = 10 deny + N narrative-allow + edge cases | **20 cases** | Spike 001 — already at parity |
| `block-gsd-sdk-mutation.sh` | 13 mutations × 2 forms (dotted/space) = 26 deny + 12 allow + 5 edge = 43 | **43 cases** | Spike 012 — already at parity |
| `bd-sync.sh` | 2 filter branches (bd vs not-bd) + 4 read-only-skip branches + cascade-runs branch | **15+ cases** (NEW: read-only filter expands Spike 001's 7 cases) | Phase 2 NEW |
| Shadow handler `phase.add` | 3 paths (beads, non-beads, malformed args) | **6+ cases** | Phase 2 NEW |
| Shadow handler ×12 others | 3 paths each = 36 | **36+ cases** | Phase 2 NEW |
| `wrapMutation` helper | 7 prefix branches (template, commit, frontmatter, config, validate, phase, fallback) | **14+ snapshot cases** | Phase 2 NEW |
| `install.sh` deep-merge | 4 cases (empty, no-overlap, partial-overlap, full-conflict) | **8+ cases** | Phase 2 NEW |
| `worktree-post-checkout.sh` append idempotency | 2 cases (first-add, re-add) | **4+ cases** | Phase 2 NEW |

### Sampling Rate
- **Per task commit:** the touched component's quick-run test (`bash tests/hook-tests/<component>.test.sh` or `node --test tests/shadow-tests/<file>.test.mjs`)
- **Per wave merge:** full suite — `bash tests/run-all.sh` (excluding 50-bead perf test which is slow)
- **Phase gate:** full suite + perf test green before `/gsd-verify-work`

### Wave 0 Gaps
Files that DO NOT yet exist and must be created in early waves before any production code is written:

- [ ] `tests/hook-tests/regen-roadmap.test.sh` — REQ-01 (Plan 02-01)
- [ ] `tests/hook-tests/regen-requirements.test.sh` — REQ-01 (Plan 02-01)
- [ ] `tests/hook-tests/cascade-loop.test.sh` — REQ-01 (Plan 02-01) — copy from Spike 002 pattern
- [ ] `tests/hook-tests/block-state-md.test.sh` — REQ-04 (Plan 02-02) — copy from Spike 001's `test-runner.sh`, adapt paths
- [ ] `tests/hook-tests/block-gsd-sdk-mutation.test.sh` — REQ-04 (Plan 02-02) — copy from Spike 012's `test-runner.sh`
- [ ] `tests/hook-tests/bd-sync.test.sh` — REQ-04 (Plan 02-02) — extend Spike 001's bd-sync cases with read-only filter cases
- [ ] `tests/shadow-tests/handler-phase-add.test.mjs` — REQ-04 (Plan 02-03) — node:test with ephemeral `bd init` fixture
- [ ] `tests/shadow-tests/handler-{12 others}.test.mjs` — REQ-04 (Plan 02-03)
- [ ] `tests/shadow-tests/wrap-mutation.test.mjs` — D-09 (Plan 02-03) — snapshot tests against upstream's wrap-pass output
- [ ] `tests/shadow-tests/argv-routing.test.mjs` — REQ-02/04 (Plan 02-03) — verifies dotted, space-aliased, --pick, non-beads passthrough
- [ ] `tests/install-tests/idempotency.test.sh` — REQ-06 (Plan 02-05)
- [ ] `tests/install-tests/settings-merge.test.sh` — REQ-06 (Plan 02-05)
- [ ] `tests/install-tests/memory-seeding.test.sh` — REQ-06 (Plan 02-05)
- [ ] `tests/install-tests/path-precedence.test.sh` — REQ-06 (Plan 02-05) — must check Volta-shadow-trap
- [ ] `tests/install-tests/no-gsd-core-mutation.test.sh` — REQ-02 (Plan 02-05) — grep guard
- [ ] `tests/worktree-tests/auto-config.test.sh` — REQ-03 (Plan 02-04)
- [ ] `tests/worktree-tests/append-idempotency.test.sh` — REQ-03/06 (Plan 02-04 + 02-05)
- [ ] `tests/e2e/full-install.smoke.sh` — cross-cutting (Plan 02-06)
- [ ] `tests/e2e/bd-sync-latency.test.sh` — Pitfall 3 perf gate (Plan 02-06)
- [ ] `tests/e2e/concurrent-merge.test.sh` — REQ-05 (Plan 02-06)
- [ ] `tests/e2e/post-gsd-update.smoke.sh` — REQ-02 (Plan 02-06) — runs `gsd-update` and verifies shadow still works
- [ ] `tests/e2e/bd-ready.smoke.sh` — REQ-08 (Plan 02-06)
- [ ] `tests/run-quick.sh` — meta script (Plan 02-02 or 02-05)
- [ ] `tests/run-all.sh` — meta script (Plan 02-02 or 02-05)

**Cross-plan invariants for plan-checker / verify-work:**
- Every `block-*.sh` script under `hooks/` has a matching test file under `tests/hook-tests/`
- Every shadow handler in `bin/gsd-sdk-shadow.mjs`'s `BEADS_OVERRIDES` map has a matching test file
- Install script's idempotency test PASSES on a freshly-installed fixture
- E2E smoke produces a regenerated `ROADMAP.md` whose `## Progress` table parses identically to what `gsd-progress` outputs

## Project Constraints (from CLAUDE.md)

- **Auto-loaded skill:** `spike-findings-gsd-beads` is auto-loaded for all sessions in this project per `.claude/CLAUDE.md`. Plans should reference findings via skill-relative paths (e.g., `references/hook-layer.md`) rather than absolute paths
- **Project context document:** `.planning/PROJECT.md` — single-developer audience, beads-native workflow, GSD core never modified
- **Spike findings auto-loaded** at session start; planner should NOT re-derive what spikes already locked in

## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-build-the-layer/02-CONTEXT.md` — locked decisions D-01 through D-10
- `.planning/phases/02-build-the-layer/02-DISCUSSION-LOG.md` — alternatives considered, rejected
- `.planning/REQUIREMENTS.md` — REQ-01 through REQ-08
- `.planning/PROJECT.md` — audience, success criteria, non-goals
- `.planning/ROADMAP.md` — Phase 2 scope
- `.planning/spikes/MANIFEST.md` — 13 spikes + ~25 locked requirements
- `.planning/spikes/CONVENTIONS.md` — stack, structure, patterns to avoid
- `.planning/spikes/WRAP-UP-SUMMARY.md` — verdict tally + 8 key findings
- `.planning/spikes/007-reader-skill-format-contract/README.md` — exact regen contract
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` and 5 references — implementation blueprint
- `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/{block-state-md,bd-sync}.sh` + `test-runner.sh` — proven hook POC + 20-case driver [VERIFIED: read this session]
- `.claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh` — canonical 5-line cascade [VERIFIED]
- `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh` — sentinel-marker shim [VERIFIED]
- `.claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/{block-gsd-sdk-mutation.sh,test-runner.sh}` — 43-case mutation blocker [VERIFIED]
- `.claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs` — registry-override Y1 POC [VERIFIED + empirically run]
- `~/.volta/.../get-shit-done-cc/sdk/dist/query/index.js` — `createRegistry`, `QUERY_MUTATION_COMMANDS`, `buildMutationEvent` (NOT exported) [VERIFIED: lines 81–199, 209–504]
- `~/.volta/.../get-shit-done-cc/sdk/dist/query/registry.js` — `QueryRegistry`, `resolveQueryArgv`, `extractField` [VERIFIED: lines 60–168]
- `~/.volta/.../get-shit-done-cc/sdk/dist/types.js` — `GSDEventType` enum [VERIFIED: lines 24–67]
- bd v1.0.3 CLI empirical probe: `bd setup --add`, `bd setup --list`, `bd setup --print`, `bd hooks install`, `bd remember`, `bd memories`, `bd q --help`, `bd create --help` [VERIFIED]

### Secondary (MEDIUM confidence)
- `~/.volta/.../get-shit-done-cc/get-shit-done/templates/roadmap.md` — upstream roadmap template (informs format-contract; Spike 007 cross-referenced)

### Tertiary (LOW confidence)
- None — all major claims verified against source files or empirical probes this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified by direct CLI probe; imports verified by Node ESM run
- Architecture: HIGH — POCs read end-to-end; spike findings cross-referenced with source files
- Pitfalls 1, 2: HIGH — empirically verified this session (bd recipe contract probe; `buildMutationEvent` grep)
- Pitfalls 3, 5: MEDIUM — extrapolated from spike timings; not benchmarked at scale (Open Question 4)
- Pitfalls 4, 6, 7: HIGH — verified in spike sources or this session
- Pitfall 8: MEDIUM — Spike 005 finding; documented limitation
- Validation Architecture: HIGH for Spike-validated patterns (Spike 001/012 runners as templates); MEDIUM for new test files (Wave 0 gaps) — pattern is proven, files don't exist yet
- Environment Availability: HIGH — all dependencies probed live this session
- Architectural Responsibility Map: HIGH — derived from explicit spike findings

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (~30 days; re-verify if upstream `get-shit-done-cc` major-version-bumps before then; bd v1.x is stable)
