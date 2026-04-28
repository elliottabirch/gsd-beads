# GSD Ecosystem Integration

How gsd-beads coexists with the broader GSD skill + agent ecosystem
without forking it. Maps which upstream files write/read state-bearing
markdown, and what to do about each.

## Requirements

- **Three layers needed for robust gsd-beads behavior; all required, none alone sufficient (post-Y1: simplified to 2 layers — see shadow-binary-architecture.md):**
  1. **soft path** — bd memories under `gsd-beads:` namespace, surfaced by `bd prime` at SessionStart, prime all sessions on the gsd-beads vocabulary and rules
  2. **hard path** — PreToolUse hooks deterministically deny state-bearing writes (Edit/Write + gsd-sdk Bash)
  3. **substitute path** (now OPTIONAL under Y1) — `/gsd-beads-*` skills as explicit-aliases for clean UX
- **Upstream agents CANNOT be modified per REQ-02.** GSD core is unmodified; `/gsd-sync-skills` would resync any override.
- **All persistent gsd-beads instructions live as `bd remember` memories**, NOT as CLAUDE.md addendum. Memories seeded at install time under `gsd-beads:` key namespace, surfaced automatically by `bd prime`.
- **TodoWrite carve-out:** TodoWrite is allowed for in-session ephemeral progress only. Cross-session work items go in beads. PreToolUse hook does NOT match TodoWrite.
- **Format contract for ROADMAP/REQUIREMENTS regen is fully documented.** Schema needs convention labels (`req-id:<id>`, `category:<slug>`, `version:v1|v2|out-of-scope`, `milestone:<id>`) plus a description-format convention for `Goal:` and `Success Criteria:`.

## How to Build It

### Inventory: 33 GSD files touch state-bearing paths

**13 BLOCKS — write state-bearing markdown** (these would hit our hooks
or, under Y1, route through our shadow):

| File | Type | Writes to |
|---|---|---|
| `gsd-roadmapper` (agent) | dual-writer | ROADMAP.md + REQUIREMENTS.md |
| `gsd-new-project` (skill) | dual-writer | spawns roadmapper |
| `gsd-new-milestone` (skill) | dual-writer | ROADMAP.md + REQUIREMENTS.md |
| `gsd-complete-milestone` (skill) | dual-writer | ROADMAP.md + REQUIREMENTS.md |
| `gsd-add-phase`, `gsd-add-backlog`, `gsd-insert-phase`, `gsd-review-backlog`, `gsd-plan-milestone-gaps`, `gsd-from-gsd2` | skill | ROADMAP.md |
| `gsd-add-todo`, `gsd-check-todos` | skill | `.planning/todos/` |
| `gsd-plant-seed` | skill | `.planning/seeds/` |

**~17 READS — need format-compatible regen** — gsd-progress, gsd-next,
gsd-manager, gsd-spec-phase, gsd-discuss-phase, gsd-add-tests,
gsd-analyze-dependencies, gsd-autonomous, gsd-forensics,
gsd-milestone-summary, plus most planning-phase agents (planner,
plan-checker, phase-researcher, domain-researcher, ui-researcher,
verifier, eval-planner, assumptions-analyzer, code-reviewer).

**6 MENTIONS — informational only.** No action.

### bd memory seeding (canonical, install-time)

```bash
bd remember --key gsd-beads:vocabulary "\
In beads-managed projects, prefer /gsd-beads-* over /gsd-* for any \
skill that creates/modifies workflow state. Under Architecture Y1 \
(shadow gsd-sdk binary), upstream skills route to bd transparently — \
both work, /gsd-beads-* is the explicit alias."

bd remember --key gsd-beads:state-paths "\
Direct edits to .planning/ROADMAP.md, .planning/REQUIREMENTS.md, \
.planning/todos/, .planning/seeds/ are BLOCKED by PreToolUse hook. \
These are GENERATED views from beads. Mutate via bd directly or \
through the Y1 shadow which routes mutations to bd."

bd remember --key gsd-beads:type-strategy "\
Requirements + phases use type=epic + label gsd:requirement / gsd:phase. \
Tasks use type=task. Cascade closes via 'bd epic close-eligible' loop \
(see cascade-loop.sh)."

bd remember --key gsd-beads:link-default "\
Use bd link <child> <parent> --type parent-child for the GSD hierarchy. \
bd dep add defaults to 'blocks' which is wrong for our model."

bd remember --key gsd-beads:discovered-from "\
When uncovering work mid-phase, use \
bd link <new-task> <originating-task> --type discovered-from \
in addition to --type parent-child to its proper home."

bd remember --key gsd-beads:todowrite "\
TodoWrite (Claude Code built-in) is allowed for in-session ephemeral \
progress tracking only. Cross-session work items go in beads \
(bd create or /gsd-beads-add-todo)."

bd remember --key gsd-beads:dolt-push "\
bd dolt push is for federation/remote sync, NOT cross-worktree sync. \
Cross-worktree state sharing is automatic via shared BEADS_DIR."
```

### Format contract (for regen scripts)

ROADMAP.md regen sources from:
- `bd list --type=epic -l gsd:phase --status=all -n 0 --json` for phase summary
- `bd children <phase-id> --json` for plans-under-phase
- Phase status derived from bead status (open/in_progress/closed/deferred)
- Decimal phase numbering via priority + creation order
- Milestone groupings via `milestone:<id>` label

REQUIREMENTS.md regen sources from:
- `bd list --type=epic -l gsd:requirement --status=all -n 0 --json` for v1/v2 split (filter by `version:*` label)
- Categories from `category:<slug>` label
- IDs from `req-id:<id>` label
- Out-of-scope: `status=closed` + `close_reason="out-of-scope"` + `gsd:requirement` label
- Traceability: parent-child between requirement and phase beads

`Goal:` and `Success Criteria:` parsing convention: stored in the
bead's `description` field with conventional formatting:
```
Goal: Users can securely access their accounts
Success Criteria:
  1. User can log in with email + password
  2. Session persists across browser refresh
```

`bd-sync.sh` regen extracts these via deterministic parsing.

### Reader skill fragility hotspots

- **gsd-progress** — depends on table column-order in `## Progress`
  table. Regen tests must verify exact column shape.
- **gsd-milestone-summary** — depends on `<details>` tag presence for
  collapsed milestones. Regen must produce the right tag structure.

Other readers are loose-match (they look for `Goal:`, `Requirements:`,
`Phase N:` headers and don't care about exact whitespace).

### TodoWrite carve-out

Surface area is tiny: only `gsd-execute-phase` declares TodoWrite as a
tool. PreToolUse hook does NOT match TodoWrite (only Edit/Write/Bash).
Document the rule via the `gsd-beads:todowrite` memory above.

## What to Avoid

- **DON'T fork upstream skills.** Violates REQ-02. `/gsd-sync-skills`
  resyncs. Don't override SKILL.md files.
- **DON'T duplicate `bd prime`'s content in CLAUDE.md.** That's bd's
  SSOT. Memories are surfaced by it automatically.
- **DON'T treat `permissionDecisionReason` as a structured directive.**
  Agents see it as text — they may or may not follow it. The hook is
  the enforcement; the message is a hint.
- **DON'T plan for 13 substitute skills.** Under Architecture Y1
  (Spike 013) the upstream skills work transparently via the shadow
  binary. Substitutes become optional UX aliases, not required code.
- **DON'T forget the `gsd-roadmapper` agent.** It's an agent, not a
  skill — but it's still in the BLOCKS set because skills like
  `/gsd-new-project` spawn it. Under Y1 it's covered transparently;
  pre-Y1 design needed an explicit `/gsd-beads-roadmapper` substitute.
- **DON'T use bd memories for IDEAS that haven't materialized into
  work.** Those are seeds (`gsd:seed` label, deferred status). Memories
  are for context (gotchas, conventions, project-wide rules).
- **DON'T treat `/gsd-spike-wrap-up` as state-bearing.** It writes to
  `./.claude/skills/spike-findings-*/`, not `.planning/todos/` etc.
  Safe in beads-managed projects (Spike 011).

## Constraints

- 33 of 118 GSD files touch state-bearing paths (~28% of the ecosystem)
- 4 dual-writers (ROADMAP + REQUIREMENTS in one flow): new-project,
  new-milestone, complete-milestone, gsd-roadmapper
- 13 BLOCKS, 17 READS, 6 MENTIONS
- Upstream's CLI argv-parser quirk: `--project-dir` flag must come
  AFTER `query <cmd>`, not before
- bd memories travel with JSONL roundtrip (Spike 004 confirmed)
- `bd prime` runs at SessionStart and PreCompact (bd's bundled hooks)

## Origin

Synthesized from spikes: 006 (skill-interaction-matrix), 007
(reader-skill-format-contract), 008 (todowrite-vs-bd-collision), 009
(gsd-new-project-e2e), 010 (bd-aware-gsd-agents), 011
(gsd-spike-wrap-up-integration)
Source files available in: sources/006-gsd-skill-interaction-matrix/,
sources/007-reader-skill-format-contract/,
sources/008-todowrite-vs-bd-collision/,
sources/009-gsd-new-project-e2e/, sources/010-bd-aware-gsd-agents/,
sources/011-gsd-spike-wrap-up-integration/
