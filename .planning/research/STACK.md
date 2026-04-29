# Stack Research — v0.2 Read-Side Handlers

**Domain:** Internal infra — bd CLI invocation contract for new read handlers in `bin/gsd-sdk-shadow.mjs`
**Researched:** 2026-04-29
**Confidence:** HIGH (every JSON shape below was captured from a live `bd … --json` call against an active beads-managed project)

---

## TL;DR — what's already in the stack

The shadow already calls bd via `node:child_process` (`spawnSync` / `execSync`) and parses `--json` output. v0.2 introduces **no new dependencies** — only new bd subcommands and JSON-shape transforms. Specifically:

- bd v1.0.3 (verified `bd --version`)
- Node's `node:child_process.execSync` (already in shadow)
- Node's built-in `JSON.parse` (already in shadow)
- No jq dependency in the handlers themselves — JSON parsing is native; bash scripts (`regen-roadmap.sh`, `regen-requirements.sh`) keep using jq

**Pinned stack version:** `bd >= 1.0.3` (the version the existing 13 mutation handlers were validated against).

---

## Recommended Stack

### Core Technologies (all already present in v0.1)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `bd` CLI | `>= 1.0.3` | Source of truth for phase/plan/todo/requirement state, plus memories store for decisions | The 13 v0.1 handlers already shell out to `bd`; the read handlers must use the same backend to maintain `isBeadsManaged()` semantics |
| `node:child_process` (`execSync`) | Node 20+ (Volta-managed) | Synchronous bd invocation | v0.1 uses `execSync` for mutations; reads have the same ~75–150ms budget per call and the same single-result need |
| `JSON.parse` (built-in) | — | Parse `bd --json` output | All bd queries we need return JSON when `--json` is passed; no XML/text parsing required |

**No new packages required.** The existing v0.1 handler shape (`async function(args, projectDir): { data: … }`) is reused verbatim.

### Supporting bd subcommands

These are the bd primitives the four target handlers compose. Examples are **real `bd … --json` outputs** captured from `/home/ellio/code/tstl-sylvanas/.beads`.

#### 1. `bd list` — bulk filtered listing

```bash
bd list -l gsd:phase --status=all -n 0 --json
```

Returns: **JSON array** of issue objects.

Real shape (one element abridged):

```json
[
  {
    "id": "sylv-cw0",
    "title": "Phase 89: V2 cooldownPattern Cutover for BURST",
    "description": "...\nGoal: V2 `cooldownPattern` is retired ...\nSuccess Criteria:\n  - ...",
    "status": "open",
    "priority": 2,
    "issue_type": "epic",
    "owner": "elliottabirch@gmail.com",
    "created_at": "2026-04-29T17:20:55Z",
    "created_by": "elliottabirch",
    "updated_at": "2026-04-29T17:20:55Z",
    "labels": ["gsd:phase", "phase-id:89", "version:v1.18"],
    "dependencies": [
      { "issue_id": "sylv-cw0", "depends_on_id": "sylv-644", "type": "parent-child", … },
      { "issue_id": "sylv-cw0", "depends_on_id": "sylv-c5y", "type": "blocks", … }
    ],
    "dependency_count": 1,
    "dependent_count": 0,
    "comment_count": 0,
    "parent": "sylv-644"
  }
]
```

**All keys present on every list element:** `id, title, description, status, priority, issue_type, created_at, updated_at, labels, dependencies, dependency_count, dependent_count, comment_count, parent`. Optional: `owner, created_by, close_reason, closed_at` (only on closed beads).

**NOT present on `bd list` output:** `epic_total_children`, `epic_closed_children` are **always null** in `bd list` even for epics — those fields are populated only by `bd show`. (Verified empirically.)

Useful flag combinations:

| Flag | Effect |
|------|--------|
| `-l gsd:phase` | AND filter — bead must have label `gsd:phase` |
| `--label-any a,b,c` | OR filter — at least one of the labels |
| `-s open,in_progress` | comma-separated stored statuses |
| `--status=all` | include closed (default excludes closed) |
| `--all` | alias for `--status=all` |
| `-n 0` | unlimited results (default cap is 50) |
| `--type=epic` | filter to type=epic (gsd:phase + gsd:requirement both use epic) |

Pitfall: omitting `-n 0` silently truncates at 50. Always pass `-n 0` for state-bearing queries.

#### 2. `bd children <id>` — children of a parent

```bash
bd children sylv-c5y --json
```

Returns: **JSON array**. Each element has the same shape as `bd list` elements. Includes `parent: "<id>"` field on every child. Includes closed children by default (this is documented behavior — `bd children` is `bd list --parent <id> --status all`).

Pitfall: bad ID returns `[]` with exit code 0 — no error.

#### 3. `bd show <id>` — full bead detail

```bash
bd show sylv-cw0 --json
```

Returns: **JSON ARRAY (length 1 for single ID)**. Critical: this is an array even when one ID is passed.

Real shape (single element):

```json
[
  {
    "id": "sylv-cw0",
    "title": "Phase 89: ...",
    "description": "...",
    "status": "open",
    "priority": 2,
    "issue_type": "epic",
    "owner": "...",
    "created_at": "…",
    "updated_at": "…",
    "labels": ["gsd:phase", "phase-id:89", "version:v1.18"],
    "dependencies": [ { "issue_id": "sylv-cw0", "depends_on_id": "sylv-644", "type": "parent-child", … } ],
    "dependents": [ … ],
    "parent": "sylv-644",
    "epic_closeable": false,
    "epic_total_children": 6,
    "epic_closed_children": 0
  }
]
```

**Unique to `bd show` (not in `bd list`):** `dependents[]` (reverse links), `epic_closeable` (bool), `epic_total_children` (int), `epic_closed_children` (int).

Pitfall — silent error: `bd show <bad-id> --json` returns `{"error": "no issues found matching the provided IDs", "schema_version": 1}` (an OBJECT, not an array) and **exits 0**. Detection: if the parsed result is an object with `.error`, treat as not-found. The v0.1 `beadsMilestoneComplete` handler already wraps `bd show` in try/catch — but actually the wrapper there exits non-zero only on stderr-level failures, not the JSON-error case. New read handlers should additionally check the parsed shape.

#### 4. `bd memories [search]` — persistent memory store

```bash
bd memories --json          # all memories
bd memories "v1.18" --json  # search substring
```

Returns: **JSON OBJECT (map of key → value-string)**. Critical: this is **NOT an array**.

Real shape:

```json
{
  "schema_version": 1,
  "gsd-beads:vocabulary": "long memory text…",
  "v1.18:allocation-free-hot-path": "[v1.18 decision] Allocation-free hot path: …",
  "v1.18:architecture-shape-b": "[v1.18 decision] Architecture: Shape B+: …",
  "session:bd-workflow-test-resume": "…"
}
```

**`schema_version` is always present and is NOT a memory** — handler must filter `schema_version` (and any future control keys starting with `_` or known sentinels) before iterating.

Empty store returns `{ "schema_version": 1 }` only — no `null`, no error.

#### 5. `bd count` — aggregate counts

```bash
bd count --json                              # total
bd count -l gsd:phase --json                 # filtered
bd count -l gsd:phase -s closed --json       # one specific status
bd count --by-status -l gsd:phase --json     # grouped
```

Returns:

| Mode | Shape |
|------|-------|
| `bd count --json` | `{ "count": 149, "schema_version": 1 }` |
| `bd count --by-status --json` | `{ "groups": [{"count": 67, "group": "closed"}, {"count": 82, "group": "open"}], "total": 149, "schema_version": 1 }` |

Empty store: `{"count": 0, "schema_version": 1}` and `{"groups": [], "total": 0, "schema_version": 1}` — never errors.

Pitfall: `bd count -s` does NOT support comma-separated values (unlike `bd list -s`). Only one status at a time. Use `--by-status` for grouping or call once per status.

#### 6. `bd ready` — unblocked work surface

```bash
bd ready --json -n 10
```

Returns: **JSON array** with the same per-element shape as `bd list`. Excludes in_progress, blocked, deferred, hooked. Default limit is 10; pass `-n 0` for all.

Not directly required by the four target queries, but useful for `state-snapshot` enrichment if downstream wants a `next_actionable` field.

---

## Per-Handler Recipes

For each of the four target queries, the **exact bd commands**, the **transform**, and the **upstream printer-shape** that must be emitted as `{ data: … }`.

### `roadmap.analyze`

**Upstream shape that consumers depend on** (from `sdk/dist/query/roadmap.js` line 480):

```typescript
{
  milestones: { heading: string, version: string }[],
  phases: {
    number: string,           // e.g. "89" or "12.1"
    name: string,
    goal: string | null,
    depends_on: string | null,
    plan_count: number,
    summary_count: number,
    has_context: boolean,
    has_research: boolean,
    disk_status: 'complete' | 'partial' | 'planned' | 'researched' | 'discussed' | 'empty' | 'no_directory',
    roadmap_complete: boolean,
  }[],
  phase_count: number,
  completed_phases: number,
  total_plans: number,
  total_summaries: number,
  progress_percent: number,
  current_phase: string | null,    // phase NUMBER (e.g. "89"), not bead id
  next_phase: string | null,
  missing_phase_details: string[] | null,
}
```

**bd recipe:**

```bash
# Step 1: list every phase epic (open + closed) for this project
bd list -l gsd:phase --status=all -n 0 --json

# Step 2: for each phase, list its children (plans) — but bd show already has the counts:
bd show <phase-id> --json   # one call per phase, gets epic_total_children + epic_closed_children
# OR
bd children <phase-id> --json   # alternative: enumerate children, filter status=closed locally
```

**Recommended:** Use `bd show` per phase for `epic_*` counts (one round-trip) **only** when the phase has children. Skip the `bd show` call when `bd list` returns `dependency_count == 0` AND no parent-child deps in the partial dependencies array — saves N×75ms.

Even simpler / faster: `bd children <id> --json | length` and `[.[] | select(.status=="closed")] | length`. This is what `regen-roadmap.sh` already does — re-use the pattern. Cost: 1 + N bd calls (1 list + 1 children per phase).

**Field-by-field derivation:**

| Upstream field | Derivation from bd |
|----------------|---------------------|
| `phases[].number` | Extract `phase-id:NN` label, fallback to bead `id` |
| `phases[].name` | bead `title` (strip `Phase NN: ` prefix if present, to match upstream's stripped form) |
| `phases[].goal` | Parse `description` for first line beginning `Goal:` (regen-roadmap.sh has the awk for this — port to JS) |
| `phases[].depends_on` | From `dependencies[]` filter `type == "blocks"` → join `depends_on_id`s OR titles |
| `phases[].plan_count` | `bd children <id> --json | length` |
| `phases[].summary_count` | `bd children <id> --json | [.[] | select(.status=="closed")] | length` (proxy: closed plan = "summary written") |
| `phases[].has_context` | Always `false` in beads (no equivalent yet) — defensible default |
| `phases[].has_research` | Always `false` in beads (no equivalent yet) |
| `phases[].disk_status` | Derive from counts: closed→`complete`, summaries==0&&plans==0→`empty`, summaries<plans→`planned` (use the same waterfall as upstream `roadmapAnalyze`) |
| `phases[].roadmap_complete` | `status == "closed"` |
| `phase_count` | `phases.length` |
| `completed_phases` | `phases.filter(p => p.disk_status === 'complete').length` |
| `total_plans` | `sum(plan_count)` |
| `total_summaries` | `sum(summary_count)` |
| `progress_percent` | `total_plans > 0 ? round(total_summaries/total_plans*100) : 0` (mirror upstream exactly) |
| `current_phase` | `phases.find(p => p.disk_status === 'planned' || 'partial')?.number ?? null` |
| `next_phase` | `phases.find(p => p.disk_status === 'empty' \|\| 'no_directory' \|\| 'discussed' \|\| 'researched')?.number ?? null` |
| `milestones` | Either parse from `version:vX.Y` labels (group, dedupe) — OR return `[]` for v0.2 if not needed by `/gsd-progress` |
| `missing_phase_details` | `null` always — bd has no concept of summary-list-without-detail |

**Pitfall:** `current_phase` / `next_phase` return phase **numbers** (strings like `"89"`), not bead IDs. Downstream printers slot them into `Phase NN` headings. If you return bead IDs, `/gsd-progress` and `/gsd-resume-work` will print `Phase sylv-cw0` — broken UX.

**Ordering:** Sort phases by `priority` ascending then `created_at` ascending — this matches `regen-roadmap.sh` (`jq 'sort_by(.priority, .created_at)'`) and produces deterministic output.

### `state-snapshot`

**Upstream shape** (from `sdk/dist/query/state.js` line 396):

```typescript
{
  current_phase: string | null,      // phase number, not bead id
  current_phase_name: string | null,
  total_phases: number | null,
  current_plan: string | null,
  total_plans_in_phase: number | null,
  status: string | null,             // 'executing' | 'planning' | 'paused' | 'completed' | 'unknown' | …
  progress_percent: number | null,
  last_activity: string | null,
  last_activity_desc: string | null,
  decisions: { phase: string, summary: string, rationale: string }[],
  blockers: string[],
  paused_at: string | null,
  session: { last_date: string|null, stopped_at: string|null, resume_file: string|null },
}
```

**bd recipe:**

```bash
# Step 1: phases for current_phase / total_phases / progress_percent
bd list -l gsd:phase --status=all -n 0 --json

# Step 2: pending todos for "blockers"
bd list -l gsd:todo --status=open -n 0 --json

# Step 3: decisions store
bd memories --json

# Step 4 (optional): in-progress plans for current_plan
bd list -l gsd:plan -s in_progress -n 1 --json
```

**Field derivation:**

| Field | Derivation |
|-------|------------|
| `current_phase` | First open phase by `priority,created_at` order, return its `phase-id:NN` label value |
| `current_phase_name` | That phase's `title` |
| `total_phases` | length of phase list |
| `current_plan` | If a plan has `status == "in_progress"`, its `plan-id:NN-XX` label; else first open plan under `current_phase`; else `null` |
| `total_plans_in_phase` | `bd children <current-phase-id> --json | length` |
| `status` | If any phase has status `in_progress` → `"executing"`. If a `paused` label exists → `"paused"`. Else `"unknown"`. Match upstream's normalization waterfall (state.js lines 147–169) |
| `progress_percent` | Same formula as `roadmap.analyze`: `round(closed_plans / total_plans * 100)` |
| `last_activity` | Pull latest `updated_at` across all gsd:phase + gsd:plan + gsd:todo beads (max of `updated_at` ISO strings) |
| `last_activity_desc` | The title of the most-recently-updated bead |
| `decisions[]` | Iterate `bd memories --json`, filter out `schema_version` AND keys starting with `session:`. For each remaining `key → value`, emit `{ phase: extractFromKey(key), summary: value.split('\n')[0], rationale: value }`. Use the same memory-key prefix convention `<phase-id>:<slug>` already in use (see tstl-sylvanas keys `v1.18:architecture-shape-b`) |
| `blockers[]` | `bd list -l gsd:todo --status=open --label-any "blocker,blocked" -n 0 --json` → titles. **Conservative behavior if no blocker label exists yet:** return `[]`. (Verified: tstl-sylvanas has no blocker labels in use; this is a forward-compatible convention) |
| `paused_at` | `null` for v0.2 (no bd field maps cleanly; STATE.md frontmatter still owns this) |
| `session` | All three fields `null` for v0.2 — these come from STATE.md, not bd. (Acceptable regression: STATE.md is regenerated by hook anyway; the SDK shadow can defer this.) |

**Pitfall — memory-key vocabulary:** Existing convention from tstl-sylvanas memories (verified live):

- `<version>:<slug>` — milestone-scoped decision (e.g. `v1.18:architecture-shape-b`)
- `gsd-beads:<slug>` — project-level vocabulary/policy memory
- `session:<slug>` — ephemeral session resume notes (filter these out for `decisions[]`)
- `schema_version` — always present, NOT a memory (filter)

Encode this filter in the handler. If the convention changes, only the handler needs updating — the downstream printer is unaware of the prefix scheme.

**Pitfall — `bd memories --json` is an OBJECT.** `JSON.parse(out)` gives a plain object; iterate via `Object.entries(obj)`, not `.map`/`.filter`.

### `progress.bar`

**Upstream shape** (from `sdk/dist/query/progress.js` line 126):

```typescript
{ bar: string, percent: number, completed: number, total: number }
```

Where `bar` is a Unicode-block string like `[██████████░░░░░░░░░░] 5/10 plans (50%)`.

**bd recipe:**

```bash
# Two count-only calls — fastest path
bd count -l gsd:plan --json                # total
bd count -l gsd:plan -s closed --json      # completed
```

OR a single grouped call:

```bash
bd count --by-status -l gsd:plan --json
# → groups[{count, group}], total
```

**Field derivation:**

| Field | Derivation |
|-------|------------|
| `total` | `groups.find(g => g.group !== "closed").count + closed.count` — or just `total` from grouped output |
| `completed` | `groups.find(g => g.group === "closed")?.count ?? 0` |
| `percent` | `total > 0 ? min(100, round(completed/total*100)) : 0` |
| `bar` | Build `'█'.repeat(filled) + '░'.repeat(20-filled)` then `\`[${bar}] ${completed}/${total} plans (${percent}%)\`` — **must match upstream string EXACTLY** because `/gsd-progress` may grep this output |

**Width is 20 chars** — confirmed in `progress.js` line 122: `const barWidth = 20`.

**Pitfall — semantic mismatch:** Upstream `progress.bar` counts plans-vs-summaries from filesystem. Beads counts plans-by-status (`open` vs `closed`). These are **conceptually equivalent** in the gsd-beads model (a plan bead's lifecycle: open → closed when summary is written via `/gsd-execute-plan`'s mutation). Document this equivalence in the handler doc-comment so future readers don't think it's a bug.

### `progress.json`

**Upstream shape** (from `sdk/dist/query/progress.js` line 100):

```typescript
{
  milestone_version: string,           // 'v1.18'
  milestone_name: string,
  phases: {
    number: string,                    // phase number, not bead id
    name: string,
    plans: number,
    summaries: number,
    status: 'Pending' | 'Planned' | 'In Progress' | 'Executed' | 'Complete' | 'Needs Review',
  }[],
  total_plans: number,
  total_summaries: number,
  percent: number,
}
```

**bd recipe:**

```bash
# Step 1: phases sorted
bd list -l gsd:phase --status=all -n 0 --json
# → enumerate by priority,created_at

# Step 2: per phase, count children
for phase_id in <ids>; do
  bd children "$phase_id" --json   # length=plans, [closed]=summaries
done
```

**Field derivation:**

| Field | Derivation |
|-------|------------|
| `milestone_version` | Most-common `version:vX.Y` label across all phases — or pull from `bd config get project.name` if exposed. Fallback: read `.beads/metadata.json` |
| `milestone_name` | Same source as `milestone_version`. For v0.2 acceptable to default to project name |
| `phases[].number` | Extract `phase-id:NN` label or fall back to bead `id` |
| `phases[].name` | Bead `title` (strip `Phase NN: ` prefix to match upstream) |
| `phases[].plans` | Children count (length of `bd children <id>` array) |
| `phases[].summaries` | Children with `status == "closed"` |
| `phases[].status` | Map: phase status `closed` → `Complete`; phase has children with summaries==plans → `Complete`; summaries>0&&summaries<plans → `In Progress`; plans>0&&summaries==0 → `Planned`; else `Pending`. Mirror upstream `determinePhaseStatus` logic exactly |
| `total_plans` | sum |
| `total_summaries` | sum |
| `percent` | Same formula |

**Pitfall — `Needs Review` and `Executed`:** Upstream derives these from VERIFICATION.md presence + `status: passed`/`gaps_found`/`human_needed` markers. Beads has no equivalent yet. **Recommended for v0.2:** never emit `Needs Review` or `Executed`; collapse to `Complete`/`In Progress`/`Planned`/`Pending`. Document this as a known regression in the handler doc-comment. (Future: a `verification:passed` label or memory key can re-introduce these.)

---

## Label & Convention Inventory (cross-checked against scripts and live beads)

These are the labels the read handlers must understand. **Source of truth for each is annotated.** All cross-checked against `migrate-to-beads.sh` (mentioned in PROJECT.md but file not present in repo — derived from `regen-*.sh` and live tstl-sylvanas data instead).

### Type-routing labels (every bead has exactly one)

| Label | Bead `issue_type` | Confirmed by |
|-------|-------------------|--------------|
| `gsd:requirement` | `epic` | `regen-requirements.sh:95` queries `bd list --type=epic -l gsd:requirement` |
| `gsd:phase` | `epic` | `regen-roadmap.sh:97` and `bin/gsd-sdk-shadow.mjs:121,138` |
| `gsd:plan` | `task` (parent-child child of a `gsd:phase` epic) | tstl-sylvanas live data: `sylv-c5y.3` has labels `["gsd:plan", "phase-id:88", "plan-id:88-03"]` |
| `gsd:todo` | `task` | PROJECT.md line 17: "`bd count -l gsd:todo --status=open`" |
| `gsd:seed` | `task` | tstl-sylvanas live data: `sylv-4ir` has labels `["gsd:seed", "source:..."]` |
| `gsd:summary` | (does not exist as a separate type) | **Not a real label.** Summary semantics in beads = a `gsd:plan` bead transitioning to `status=closed`. The "summary" file produced by `/gsd-execute-plan` lives in markdown only. Don't query for it. |
| `gsd:requirement` (out-of-scope) | `epic`, status=closed, `close_reason=out-of-scope` | `regen-requirements.sh:209-210` |

### Identifier labels (zero or one per bead)

| Label pattern | Bead types | Example |
|---------------|------------|---------|
| `req-id:REQ-NN` | `gsd:requirement` | `req-id:REQ-04` (regen-requirements.sh:146) |
| `phase-id:NN` | `gsd:phase`, `gsd:plan` | `phase-id:89` (live) |
| `plan-id:NN-MM` | `gsd:plan` | `plan-id:88-03` (live) |
| `version:vX.Y` | all (cross-reference) | `version:v1.18` (live) — required for milestone grouping in `regen-requirements.sh:106` |
| `category:slug` | `gsd:requirement` | `category:hooks` → "Hooks" header (regen-requirements.sh:124) |

### Edge / link conventions (verified in live `dependencies[]`)

| Edge type | Created by | Semantics |
|-----------|------------|-----------|
| `parent-child` | `bd link <child> <parent> --type parent-child` (memory `gsd-beads:link-default`) | Hierarchy: requirement→phase→plan |
| `blocks` | `bd link <blocked> <blocker> --type blocks` (`bin/gsd-sdk-shadow.mjs:166`) | Phase-level dependency edge |
| `discovered-from` | `bd link <new> <origin> --type discovered-from` (memory `gsd-beads:discovered-from`) | Provenance — non-hierarchical |

The shadow handler must use `parent-child` to traverse hierarchy and `blocks` to populate `depends_on`. **Never rely on `bd dep tree`** (memory `gsd-beads:link-default`: "use `bd children`, NOT `bd dep tree` (which walks blocks not parent-child)").

---

## Installation

Nothing to install. v0.2 reuses every dependency from v0.1.

```bash
# verify (no install required)
node --version              # ≥ 20
bd --version                # bd version 1.0.3 (1b2dd2cb) or newer
which bd                    # ~/.volta/bin/bd or /usr/local/bin/bd
```

If `bd --version` shows a version older than 1.0.3, the JSON shapes above may differ — re-run the probe commands in `tests/shadow-tests/` against the local bd before debugging handler logic.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `execSync(\`bd list … --json\`)` then `JSON.parse(out)` | `execSync` then `jq` filter via shell pipe | **Don't.** Adding jq to the handler path adds another spawn + a shell-quoting attack surface. Native `JSON.parse` + array methods is faster and safer. |
| `bd list -l gsd:phase --status=all -n 0` | `bd list --type=epic -l gsd:phase --status=all -n 0` | Both work; `--type=epic` is redundant when `gsd:phase` is already a strict subset. `regen-roadmap.sh` uses `--type=epic` for explicitness. Either is fine; pick one and be consistent (recommend matching `regen-*.sh`: include `--type=epic`). |
| `bd children <id>` per phase (N+1 calls) | One `bd list -l gsd:plan` then group by `phase-id:NN` label client-side | The list-then-group approach is one call regardless of phase count. **Use this for >10 phases.** Use per-phase `bd children` when N≤10 (current tstl-sylvanas has 11 phases — borderline). The per-phase approach is what `regen-roadmap.sh` already does (proven correct). |
| `bd count --by-status -l gsd:plan` | Two `bd count` calls (`-s open`, `-s closed`) | The grouped form is one call. Use grouped. Empty-store edge case is handled (`groups: []`). |
| `bd memories --json` | `bd recall <key> --json` per known key | `bd memories` returns everything in one call — cheaper. `bd recall` is for single-key lookup, not enumeration. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bd dep tree` | Walks `blocks` edges, not `parent-child`. Will give the wrong tree. (Locked in by `gsd-beads:link-default` memory.) | `bd children <id>` |
| `bd show <id>` for batch counts | One round-trip per phase. With 50+ phases this dominates handler latency. | `bd children <id>` then count locally; OR list-and-group |
| `bd list --pretty` / `--tree` / no flags | Returns human-formatted text; not parseable. | Always pass `--json` |
| `bd count -s open,closed` | `bd count --status` does NOT support comma-separated values (unlike `bd list --status`). Silently filters to nothing. | Use `--by-status` for grouping |
| Default `-n 50` (no `-n 0`) | Silently truncates after 50 results. Will produce wrong totals on bigger projects. | Always `-n 0` for state-bearing queries |
| `JSON.parse` without try/catch on `bd show` | Bad ID returns a `{error, schema_version}` OBJECT (exit 0), not an array. Naive `parsed[0].id` access throws. | Check shape: `Array.isArray(parsed) && parsed.length > 0` |
| Treating `bd memories --json` as an array | It's an object/map. `.map`/`.filter` won't work. | `Object.entries(parsed).filter(([k]) => k !== 'schema_version' && !k.startsWith('session:'))` |
| `bd list` without `-l gsd:<type>` | Returns ALL bead types including `gsd:seed`, raw todos, infra beads, gates. | Always filter by the type-routing label |

---

## Stack Patterns by Variant

**If `.beads/` is missing (non-bd project):**
- Don't run any of the above. The shadow's `isBeadsManaged()` check (existing line 232–234) bails out before dispatch and falls through to `spawnUpstream`. Read handlers inherit this — the registry is only built when `isBeadsManaged === true`.

**If `.beads/` exists but the store is empty:**
- `bd list … --json` returns `[]` — handlers must produce a valid empty-state response, NOT throw.
  - `roadmap.analyze` → `{ milestones: [], phases: [], phase_count: 0, completed_phases: 0, total_plans: 0, total_summaries: 0, progress_percent: 0, current_phase: null, next_phase: null, missing_phase_details: null }`
  - `state-snapshot` → all fields `null` or empty arrays, `status: 'unknown'`
  - `progress.bar` → `{ bar: '[░░░░░░░░░░░░░░░░░░░░] 0/0 plans (0%)', percent: 0, completed: 0, total: 0 }`
  - `progress.json` → `{ milestone_version: '?', milestone_name: 'unknown', phases: [], total_plans: 0, total_summaries: 0, percent: 0 }`
- `bd memories --json` returns `{ "schema_version": 1 }` only — the `decisions[]` filter naturally yields `[]`.

**If `bd` binary is missing:**
- `execSync` throws with a useful error. v0.1 handlers don't catch this — they let it propagate. Read handlers should do the same; the dispatch loop's catch block (line 309) prints `[gsd-sdk-shadow] dispatch failed: <message>` and exits 1.

**If a phase has no `phase-id:NN` label (legacy or hand-created):**
- Fall back to the bead `id` (e.g. `sylv-cw0`). Same fallback used by `regen-requirements.sh:148-150` for `req-id`. Document the fallback so users know why their progress output shows `Phase sylv-cw0`.

---

## Version Compatibility

| Component | Pinned Version | Notes |
|-----------|---------------|-------|
| `bd` | `>= 1.0.3` | The JSON shapes in this doc are from 1.0.3. Earlier versions may use different field names (e.g. `assignee` was renamed). The `epic_total_children` / `epic_closed_children` fields are 1.0+ only. |
| Node | `>= 20` (Volta-managed) | `node:child_process` is stable; v20 is what the existing handlers target |
| `flock` | required (system) | `regen-roadmap.sh:23` blocks if missing; on macOS users need `brew install flock`. Read handlers don't acquire the lock (read-only), but the regen scripts they trigger do. |

**Pre-flight check the read handlers should NOT do:** verifying bd version. The shadow's `spawnUpstream` fallback handles version-incompatibility gracefully — let bd's own error propagate. Adding a version check is overhead per query.

---

## Sources

All confirmed empirically against running bd:

- `/home/ellio/code/tstl-sylvanas/.beads/` — live data source. 149 beads, 11 phases, 24 plans, 57 todos, 55 requirements, 19 memories — fully exercises every shape in this doc. **HIGH confidence.**
- `bd v1.0.3` (`bd --version`) — pinned version. **HIGH.**
- `bin/gsd-sdk-shadow.mjs` — v0.1 mutation handlers, the shape model for v0.2. **HIGH.**
- `scripts/regen-roadmap.sh` and `scripts/regen-requirements.sh` — canonical bd-call patterns. **HIGH.**
- `~/.volta/.../sdk/dist/query/roadmap.js` lines 480–492 — upstream `roadmap.analyze` printer-shape contract. **HIGH.**
- `~/.volta/.../sdk/dist/query/progress.js` lines 100–127 — upstream `progress.json` and `progress.bar` shape contracts. **HIGH.**
- `~/.volta/.../sdk/dist/query/state.js` lines 396–411 — upstream `state-snapshot` shape contract. **HIGH.**
- bd subcommand `--help` output — flag semantics. **HIGH.**

Things NOT verified (LOW confidence, flagged for plan time):

- The exact `category:` slugs in current use across the codebase — only one example confirmed (`category:hooks` per regen-requirements.sh:124–125 capitalization logic). Will not block the read-handler implementation; just flag if `progress.json.milestone_name` derivation hits an unexpected value.
- The naming convention for `blocker` / `blocked` labels — **no live examples found**. Treat the convention as forward-compatible (the handler should query `--label-any "blocker,blocked"` and gracefully return `[]` when none match). If the team adopts a different label later, change the handler in one place.
- Whether `bd list -l gsd:phase` and `bd list --type=epic -l gsd:phase` perform identically — both succeed; whichever the codebase prefers should be used consistently. (Recommendation: `--type=epic` because it matches `regen-*.sh`.)

---

*Stack research for: gsd-beads v0.2 read-side handlers*
*Researched: 2026-04-29*
