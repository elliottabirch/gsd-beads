---
spike: 012
name: gsd-sdk-hook-coverage
type: standard
validates: "Given gsd-sdk has 13 mutation commands (each with two argv aliases) that bypass the Edit/Write hook by writing to state-bearing files via Node fs/promises, when a PreToolUse(Bash, if='Bash(gsd-sdk *)') hook with command-allowlist parsing is added, then 23 state-bearing argv variants are denied with redirect, 8 read-only/non-state-bearing/edge-case patterns pass through, total 43/43 cases."
verdict: VALIDATED (reclassified as defensive backup under Architecture Y1, Spike 013)
related: [001, 006, 013]
tags: [hooks, gsd-sdk, sdk-mutations, defensive-backup]
---

# Spike 012: gsd-sdk Hook Coverage

## What This Validates

Spike 006's matrix inventoried Edit/Write tool declarations in skill
prompts but missed an entire class of mutations: **`gsd-sdk query <cmd>`
calls invoked via Bash that write to state-bearing files via Node
`fs/promises.writeFile`**. These bypass the PreToolUse(Edit|Write) hook
from Spike 001 entirely.

The smoking gun in `QUERY-HANDLERS.md`:
> *"`state.add-roadmap-evolution` is the canonical replacement for raw
> Edit/Write on STATE.md ... required when projects ship a `protect-files.sh`
> PreToolUse hook that blocks direct STATE.md writes."*

GSD already encountered this exact problem and the SDK route is
explicitly documented as a workaround for file-protection hooks like
ours.

This spike validates a **second hook** — `PreToolUse(Bash, if="Bash(gsd-sdk *)")`
— that parses argv, checks against an allowlist of state-bearing
mutation commands, and denies if matched.

## Research

`QUERY_MUTATION_COMMANDS` (in `~/.volta/.../sdk/src/query/index.ts`)
exhaustively enumerates every gsd-sdk command that performs durable
writes. From this set, **13 mutation commands target state-bearing
files** in our locked path set (`.planning/ROADMAP.md`,
`.planning/REQUIREMENTS.md`, `.planning/todos/`, `.planning/seeds/`).
Each has two argv aliases (dotted form `phase.add` and space-aliased
form `phase add`).

| Command (dotted form) | Writes to | Maps to substitute |
|---|---|---|
| `phase.add`, `phase.add-batch`, `phase.insert`, `phase.remove`, `phase.complete`, `phase.scaffold` | ROADMAP.md | `/gsd-beads-add-phase`, `-insert-phase`, `-complete-milestone` |
| `phases.clear`, `phases.archive` | ROADMAP.md | `/gsd-beads-complete-milestone` |
| `roadmap.update-plan-progress`, `roadmap.annotate-dependencies` | ROADMAP.md | `bd-sync.sh` regen + direct `bd` calls |
| `requirements.mark-complete` | REQUIREMENTS.md | `/gsd-beads-complete-milestone` or `bd close <req-id>` |
| `todo.complete` | `.planning/todos/` | `/gsd-beads-check-todos` or `bd close <todo-id>` |
| `milestone.complete` | ROADMAP.md + REQUIREMENTS.md (dual) | `/gsd-beads-complete-milestone` |

## How to Run

```bash
cd .planning/spikes/012-gsd-sdk-hook-coverage
./test-runner.sh   # 43 synthetic payloads driven through block-gsd-sdk-mutation.sh
```

Expected: `43/43 PASS`. Open `results/results.json` for the structured
case-by-case data.

## What to Expect

| Suite | Cases | Outcome |
|---|---|---|
| State-bearing mutations: should DENY | 23 (12 phase.* + 4 phases.* + 4 roadmap.* + 2 requirements + 2 todo + 2 milestone — all forms) | All deny with redirect |
| Read-only queries: should ALLOW | 5 | All allow |
| Non-state-bearing mutations: should ALLOW | 8 | All allow (state.update, frontmatter.set, config-set, commit, template.fill, workstream.create, intel.snapshot) |
| Non-gsd-sdk Bash: should ALLOW | 3 | All allow (the hook only fires on Bash(gsd-sdk *) match) |
| Edge cases | 4 | --help, init (no query), --project-dir flag before query, missing query subcommand all allow correctly |

## Investigation Trail

**Iteration 1 — discover the gap.**
User asked during Spike 011 wrap-up review: "I see a ton of sdk queries
happening in each skill — is that going to come back to bite us?"

Audited gsd-sdk: 104 query handlers, of which 13 mutate state-bearing
files. The Edit/Write blocker from Spike 001 doesn't see them.

**Iteration 2 — extract the deny-list.**
Read `QUERY_MUTATION_COMMANDS` set in full. Cross-referenced against
what targets state-bearing paths (vs other mutations like `state.update`
that touch STATE.md, which isn't in our locked set). Resulted in the
13-command list above.

**Iteration 3 — write `block-gsd-sdk-mutation.sh`.**
~80-line bash script that:
1. Reads JSON tool payload from stdin (`tool_input.command`)
2. Skips if not a `gsd-sdk *query *` invocation
3. Splits argv after `query` to find command name
4. Handles both dotted form (`phase.add`) and space-aliased (`phase add`)
5. Looks up the command in a `case` deny-list
6. If matched, returns `permissionDecision: "deny"` JSON with a redirect
   message naming the appropriate `/gsd-beads-*` substitute

**Iteration 4 — built test runner with 43 cases.**
Suites for state-bearing deny, read-only allow, non-state-bearing allow,
non-gsd-sdk allow, edge cases. Initial run: 43/43 PASS.

## Results

**Verdict: VALIDATED ✓ (43/43 tests)**

The hook correctly denies state-bearing gsd-sdk mutations and lets
everything else through.

**However — reclassification under Spike 013 (Architecture Y1):**

With Y1 (shadow gsd-sdk binary) adopted, this hook is **defensive
backup** rather than primary defense:

1. **Primary path:** the shadow at `~/.local/bin/gsd-sdk` intercepts
   state-bearing mutations and routes them to bd-backed handlers
   transparently. Upstream skills work as-is in beads-managed projects.
2. **Defensive backup:** if the shadow isn't installed, isn't first on
   PATH, or doesn't recognize a new state-bearing mutation command
   upstream adds, this hook denies it with the redirect message.
3. **Edit/Write hook (Spike 001):** still required for direct file
   edits, which neither the shadow nor this hook would otherwise see.

The Phase 2 implementation can pick one of these strategies:
- **Both layers:** Y1 shadow as primary, this hook as backup —
  defense-in-depth.
- **Y1 only:** drop this hook to reduce config complexity. The shadow's
  passthrough behavior on unknown commands silently writes MD; this
  hook's value is making that mode loud.

**Recommend keeping both** until Y1 has accumulated enough operational
trust.

## Files

- `hooks/block-gsd-sdk-mutation.sh` — the hook script itself
- `test-runner.sh` — 43-case test driver
- `results/results.json` — structured pass/fail data
