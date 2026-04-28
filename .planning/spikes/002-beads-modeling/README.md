---
spike: 002
name: beads-modeling
type: standard
validates: "Given a fresh bd init with custom requirement and phase types, when a 3-level hierarchy (req → phase → tasks) is built and all tasks closed, then closing the parents cascades upward — phases close when their tasks all close, and the requirement closes when its phases all close."
verdict: VALIDATED-WITH-REFINEMENT
related: [001]
tags: [bd, modeling, custom-types, cascade, parent-child, bd-recipes]
---

# Spike 002: Beads Modeling

## What This Validates

**Given** a fresh `bd init --stealth` and custom types `requirement`/`phase`
defined,
**when** a 3-level hierarchy (REQ → 2 phases → 5 tasks) is built using
`bd link --type parent-child` and all 5 leaf tasks are closed,
**then** an explicit cascade-close pass closes the phases (their tasks
all complete) and then the requirement (its phases all complete) — full
progress visibility without manual roadmap edits.

## Research

**Authoritative source:** the `bd` binary itself (v1.0.3) plus the README
at https://github.com/steveyegge/beads.

### What ships out-of-the-box

| Item | Detail |
|---|---|
| Built-in issue types | `task`, `bug`, `feature`, `chore`, `epic`, `decision`, `spike`, `story`, `milestone` |
| Custom-type config key | `bd config set types.custom "type1,type2,..."` (note: bd warns the key isn't recognized but accepts it; behavior is correct) |
| Dependency types | `blocks` (default), `tracks`, `related`, `parent-child`, `discovered-from` |
| Tree rendering | **`bd children <id>`** — `bd dep tree` only shows blocks-style deps |
| Auto-close cascade | **Only for `epic`-typed parents** via `bd epic close-eligible`. Not automatic; must be invoked explicitly. |
| Storage backend | Embedded Dolt (`.beads/embeddeddolt/`) by default; auto-export to `.beads/issues.jsonl` after every write (60s throttle) |
| Hidden-from-git mode | `bd init --stealth` configures `.git/info/exclude` so beads files don't appear in `git status` |
| Non-interactive setup | `--non-interactive` skips prompts; auto-detects in CI / non-TTY |

### What `bd setup claude` ships (this is the major surprise — see Investigation Trail)

| Component | Detail |
|---|---|
| `~/<proj>/.claude/settings.json` | `SessionStart` and `PreCompact` hooks both run `bd prime` |
| `<proj>/CLAUDE.md` | Sentinel-marker-merged 55-line section: quick reference, workflow, types, priorities, mandatory session-close protocol |
| `bd prime` | Outputs ~80-line workflow context — beads' SSOT for operational commands. Designed to load fresh per session, so the contract evolves via `bd` upgrades not stale docs. |
| `bd setup --add` | Custom-recipe registration system — `bd setup --add gsd-beads <path>` could distribute the gsd-beads layer as a first-class recipe. |
| Existing recipes | `claude`, `cursor`, `gemini`, `aider`, `factory`, `codex`, `mux`, `opencode`, `junie`, `windsurf`, `cody`, `kilocode` |

### Approach comparison for the GSD vocabulary

| Mapping | Free cascade? | Pros | Cons |
|---|---|---|---|
| Use built-in `epic`/`story`/`task` | Partial: `bd epic close-eligible` cascades epic-level | Less custom config; stays in beads' canonical model | Loses semantic precision (`requirement` is more than an epic; `phase` ≠ story) |
| Use custom `requirement`/`phase` + built-in `task` | None built-in | Semantically correct GSD vocabulary | Requires gsd-beads-owned cascade script |
| **Hybrid (chosen):** custom `requirement`/`phase` + custom recursive cascade | **Full** — all parent-child levels cascade via one script | Semantic precision + full automation; ~50 lines of bash | Maintenance burden of one small script |

**Chosen approach:** custom types + a recursive cascade-close script invoked
from gsd-beads' `bd-sync.sh` after every `bd ` command. Proven by
`cascade-close.sh` here — closes parents whose every parent-child child is
closed, iterates until convergence.

## How to Run

```bash
# 1. Install bd (npm path; see Investigation Trail for alternatives)
npm install -g @beads/bd

# 2. Build the sandbox
mkdir -p ~/code/gsd-beads-spike-sandbox && cd ~/code/gsd-beads-spike-sandbox
bd init --stealth --non-interactive --skip-agents
bd config set types.custom "requirement,phase"

# 3. Build the hierarchy and run the cascade
bash /tmp/build-hierarchy.sh   # builds 8 issues, closes the 5 leaves
/home/ellio/code/gsd-beads/.planning/spikes/002-beads-modeling/cascade-close.sh

# 4. Verify everything closed
cd ~/code/gsd-beads-spike-sandbox
bd children $(bd list --status=all --json | jq -r '[.[] | select(.issue_type=="requirement")][0].id')
# All nodes should show ✓ (closed)
```

## What to Expect

`cascade-close.sh` output:

```
Iteration 1: closing 2 parent(s) whose children are all complete
✓ Closed gsd-beads-spike-sandbox-8jo — Phase 13: Auth UI: Closed
✓ Closed gsd-beads-spike-sandbox-y8u — Phase 12: Auth backend: Closed
Iteration 2: closing 1 parent(s) whose children are all complete
✓ Closed gsd-beads-spike-sandbox-b14 — REQ-042: Email/password auth: Closed

Cascade complete: 3 parent(s) closed across 2 iteration(s)
```

`bd children <req-id>` after the cascade — all 8 nodes ✓ closed:

```
✓ ...-b14 P0 requirement REQ-042: Email/password auth
├── ✓ ...-8jo P1 phase Phase 13: Auth UI
│   ├── ✓ ...-6ar P2 task Login form
│   └── ✓ ...-v7p P2 task Error states
└── ✓ ...-y8u P1 phase Phase 12: Auth backend
    ├── ✓ ...-5zt P2 task Session storage
    ├── ✓ ...-djc P2 task Password hashing
    └── ✓ ...-y6h P2 task Login endpoint
```

## Investigation Trail

**Iteration 1 — install + plain init.**
`npm install -g @beads/bd` succeeded (1.0.3). Ran `bd init` inside the
spike directory under the gsd-beads parent repo. **Surprise:**
- `bd init` auto-installed Claude Code hooks at the project's
  `.claude/settings.json` running `bd prime` on `SessionStart` and `PreCompact`.
- `bd init` created `AGENTS.md`, `CLAUDE.md`, `.beads/`, `.gitignore`.
- `bd init` **auto-committed all of the above to the parent gsd-beads repo**
  with the message `bd init: initialize beads issue tracking`.

That last item polluted the spike's git history. Reset the commit
(`git reset --hard HEAD^`), removed the in-tree sandbox, and relocated to
`~/code/gsd-beads-spike-sandbox/` — outside the parent repo per
`.planning/notes/spike-validation-plan.md`'s exit criterion.

**Iteration 2 — `--stealth --skip-agents` for clean init.**
`bd init --stealth --non-interactive --skip-agents` produced:
- A clean `.beads/` with `embeddeddolt/`, `config.yaml`, `metadata.json`
- A fresh `.git/` (since the sandbox dir had no parent repo) with
  `.git/info/exclude` configured to hide beads files
- **No** `AGENTS.md`, **no** `CLAUDE.md`, **no** project-level `.claude/`,
  **no** auto-commit
- This is the canonical install command for gsd-beads.

**Iteration 3 — built hierarchy with default `bd dep add`.**
Initial 3-level structure used `bd dep add child parent` (defaults to
`blocks`). Result was semantically wrong: bd reported `Phase 12 depends on
REQ-042 (blocks)` — which means "the requirement blocks the phase" — the
opposite of parent-child intent.

`bd dep tree <req-id>` showed only the requirement node, no children.
Took a moment to realize `bd dep tree` walks `blocks` deps, not
parent-child. The right command is `bd children <id>`, which renders
parent-child trees with proper indentation.

**Iteration 4 — `bd link --type parent-child`.**
`bd link <child> <parent> --type parent-child` is the proper way to
declare parent-child relationships. Rebuilt the hierarchy. `bd children`
now renders correctly. `bd list --status=open` ALSO renders parent-child
trees with `├──`/`└──` characters when there's a parent.

**Iteration 5 — auto-close probe.**
Closed all 5 leaf tasks. Phases stayed open. Ran `bd epic close-eligible`
— "No epics eligible for closure". Looked at flags: there's NO
`--type=requirement` to broaden it. **The architecture's "free auto-close
cascade" claim is FALSE for custom types.** It works only for `epic`.

**Iteration 6 — verified bd's epic close-eligible works for built-in epic.**
Built a separate small structure: `epic` parent + 2 task children. Closed
the children. `bd epic close-eligible --dry-run` reported "Would close 1
epic(s)". Real run closed it. The JSONL export shows
`close_reason: "All children completed"` for the auto-closed epic vs.
`close_reason: "Closed"` for manual closes — beads annotates cascade-driven
closures distinctly. Confirms: the cascade machinery exists, it's just
restricted to `type=epic`.

**Iteration 7 — built `cascade-close.sh` for arbitrary parent-child.**
Wrote a 60-line bash + jq script that:
1. Iterates over every open issue.
2. For each, fetches `bd show <id> --json` and inspects `dependents` filtered
   by `dependency_type=="parent-child"`.
3. If every such dependent is `status=closed`, closes the parent.
4. Repeats until no new closures (cascade up arbitrary depth).
Tested against the 3-level hierarchy: cascade closed 2 phases at iteration 1,
then the requirement at iteration 2. **3 parents closed across 2 iterations.**
Final state: all 8 issues closed.

**Iteration 8 — re-examined bundled Claude integration after user prompt.**
Initially I had reset bd's auto-installed `.claude/settings.json` and
`CLAUDE.md` without reading them — assuming they'd conflict. Re-installed
with `bd setup claude --stealth` in a separate sandbox and read everything.
**Major architectural shift:** beads ships a perfectly good Claude Code
integration with `SessionStart`/`PreCompact` hooks running `bd prime`
(an 80-line dynamic workflow context document) plus a sentinel-merged
CLAUDE.md template. gsd-beads should LAYER on top of this, not replace it.
Updated the architecture-implication table in this README accordingly.

## Results

**Verdict: VALIDATED-WITH-REFINEMENT ✓**

The data model works. Custom types, parent-child relationships, and
multi-level cascade closure all function on this machine, with one
caveat: the cascade requires gsd-beads' own ~60-line script
(`cascade-close.sh`), not a built-in beads feature.

**Concrete validations:**

1. **`bd` installs cleanly via npm.** Other paths (Homebrew, install script,
   direct binary) are documented but not tested here. v1.0.3 is the version
   used for this spike.

2. **Custom types work.** `bd config set types.custom "requirement,phase"`
   makes them creatable via `bd q "..." -t requirement` / `-t phase`.
   `bd types` lists them. `bd list` and `bd children` display them with
   their type labels. (bd warns the key "isn't recognized" but the behavior
   is correct.)

3. **Parent-child relationships work.** `bd link <child> <parent>
   --type parent-child` creates the relationship. `bd children <parent>`
   renders the tree. `bd list` renders parent-child trees with
   `├──`/`└──` characters.

4. **Multi-level cascade works via `cascade-close.sh`.** Closing 5 leaf tasks
   then running the script closes 2 phases (iteration 1) and 1 requirement
   (iteration 2). Idempotent — safe to re-run. Will be invoked from
   `bd-sync.sh` after every `bd ` command.

5. **Auto-export to JSONL is on by default.** `.beads/issues.jsonl` is
   regenerated after every write (60s throttle). Already captures
   `dependency_type: "parent-child"` and `close_reason: "All children
   completed"` for cascade-closed beads. Pre-validates spike 004 partially.

**Surprises and architectural shifts to carry forward:**

- **Beads ships its own Claude Code integration via `bd setup claude`.**
  gsd-beads should LAYER on top — install bd's recipe, then add gsd-beads'
  own PreToolUse(Edit|Write) blocker + PostToolUse(Bash, "Bash(bd *)") sync
  + GSD-specific CLAUDE.md addendum (sentinel-merged like bd does). The
  hooks are orthogonal — bd's SessionStart/PreCompact handle context
  injection; gsd-beads' Edit/Write/Bash hooks handle enforcement +
  regeneration.

- **gsd-beads should be a `bd setup --add` custom recipe.** Distribution
  becomes `bd setup --add gsd-beads <path>` then `bd setup gsd-beads`.
  Reuses beads' install/update/remove/check infrastructure. Architecture
  doc's "Path A: symlinks managed by windows-dev-setup" can be replaced
  with this cleaner path.

- **Always use `bd init --stealth --non-interactive`.** Plain `bd init`
  auto-commits to a parent repo and prompts interactively. Stealth keeps
  the bead store local and silent.

- **`bd dep add` defaults to `blocks`, not `parent-child`.** The `--type`
  flag (or `bd link --type parent-child`) is required. Easy footgun for
  agents that follow generic bd docs. Worth flagging in gsd-beads' own
  CLAUDE.md addendum.

- **`bd dep tree` and `bd children` are different commands.** `dep tree`
  walks `blocks` deps; `children` walks `parent-child`. gsd-beads'
  generated ROADMAP.md regeneration must use `bd children` (or query JSON
  directly).

- **Auto-close cascade is NOT automatic on `bd close`.** It's an explicit
  pass — `bd epic close-eligible` for epics OR gsd-beads' own
  `cascade-close.sh` for arbitrary types. The PostToolUse hook on `bd `
  must invoke it after every close.

- **Cascade-driven closures get `close_reason: "All children completed"`** in
  the JSONL export. Useful for distinguishing manual vs. cascade closes
  in regenerated views.

**Impact on remaining spikes:**
- Spike 003 (cross-worktree): proceed. `BEADS_DIR` semantics not yet tested;
  stealth-mode `.git/info/exclude` may interact in interesting ways.
- Spike 004 (jsonl-roundtrip): pre-validated partially — auto-export
  works. Still need full export → init-from-jsonl roundtrip.
- Spike 005 (concurrent-merge): proceed.

## Files

- `cascade-close.sh` — recursive parent-child cascade closer (the missing
  piece beads doesn't ship for custom types)
- `sandbox-link.md` — note explaining the sandbox lives at
  `~/code/gsd-beads-spike-sandbox/` outside the project repo
- `snapshot-final.json` — final `bd list --json --status all` after cascade
- `tree-final.txt` — final `bd children <req>` output after cascade
