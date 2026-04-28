# Phase 2: Build the layer - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the gsd-beads integration layer end-to-end. The 13 spikes in
Phase 1 locked in the design (architecture, hook surface, beads
modeling, storage, distribution mechanism, shadow binary). Phase 2's
job is to **implement the design** as production-quality code,
distributed as a `bd setup --add gsd-beads` recipe, installable on a
fresh machine in one command.

**In scope:**
- bd helper scripts: `cascade-loop.sh`, `regen-roadmap.sh`,
  `regen-requirements.sh`
- Hook scripts: `block-state-md.sh`, `bd-sync.sh`,
  `block-gsd-sdk-mutation.sh`
- Shadow binary: `gsd-sdk-shadow.mjs` (ESM Node binary)
  registry-override variant + 13 bd-backed mutation handlers,
  manually re-wrapped for GSDEvent emission
- Worktree post-checkout shim (sentinel-marker-merged)
- Install script registered as bd recipe (`bd setup --add gsd-beads <path>`)
- bd memory seeding under `gsd-beads:` namespace
- E2E smoke test on a fresh fixture project

**Out of scope:**
- The 13 `/gsd-beads-*` substitute skills (Y1 makes them optional;
  ship lean MVP)
- Phase 3 cross-worktree extended validation
- Migration of existing GSD projects' `.planning/` into beads (per
  PROJECT.md non-goal)
- Multi-developer/team workflows (federation deferred)
- Live dashboard observability (re-wrapping in Phase 2 preserves the
  option but no dashboard ships yet)

</domain>

<decisions>
## Implementation Decisions

### Plan Sequencing & Granularity (Approach A: bottom-up by layer)
- **D-01:** **6 plans, dependency-ordered** as follows:
  - `02-01-bd-helpers-PLAN.md` — `cascade-loop.sh`,
    `regen-roadmap.sh`, `regen-requirements.sh` (the bd-CLI-only
    primitives that everything else builds on)
  - `02-02-hooks-PLAN.md` — `block-state-md.sh`, `bd-sync.sh`,
    `block-gsd-sdk-mutation.sh` + `settings.fragment.json` + their
    test runners (parity with Spike 001's 20-case + Spike 012's 43-case
    suites)
  - `02-03-shadow-binary-PLAN.md` — `gsd-sdk-shadow.mjs` + 13
    bd-backed handlers (in one plan; shared scaffolding makes
    per-handler granularity wasteful) + GSDEvent re-wrapping helper
    + handler tests
  - `02-04-worktree-init-PLAN.md` — `worktree-post-checkout.sh`
    (sentinel-marker append to bd's hook chain) + idempotency tests
  - `02-05-install-script-PLAN.md` — `bd setup --add gsd-beads`
    recipe registration + deep-merge of settings.json fragment + bd
    memory seeding + binary symlink to `~/.local/bin/gsd-sdk` + idempotent re-install
  - `02-06-e2e-smoke-test-PLAN.md` — fresh fixture project, full
    install via the recipe, build a 3-level hierarchy, close all leaves,
    verify cascade fires, verify regenerated ROADMAP.md is parser-compatible

- **D-02:** **One plan per shadow handler is overkill.** All 13 handlers
  share argv routing + spawnUpstream + import boilerplate. Plan 02-03
  contains all 13 in one file with shared helpers; per-handler tests
  validate each independently.

### Distribution Mechanism (revised 2026-04-27 from RESEARCH.md Pitfall 1)
**Note:** D-03/D-04/D-05 below are the **revised decisions** after Phase 2
research (RESEARCH.md Pitfall 1) empirically verified bd v1.0.3's recipe
contract: `bd setup --add <name> <path>` registers a destination path,
and `bd setup <name>` writes bd's bundled canonical template TO that path.
Custom recipes are single-file template writers — they cannot ship hooks +
shadow binary + memory seeding. Original D-03/D-04/D-05 were authored
without this empirical evidence. Original wording preserved in
DISCUSSION-LOG.md.

- **D-03 (revised):** **bd recipe is a discovery surface, not the installer.**
  Register gsd-beads via `bd setup --add gsd-beads <path>` so it appears
  in `bd setup --list` and is bd-native discoverable. The recipe template
  file contains pointer text directing users to `git clone … && ./install.sh`.
  The actual install work happens in `install.sh`, not via bd recipe machinery.
- **D-04 (revised):** **`git clone https://github.com/<owner>/gsd-beads &&
  ./install.sh` is the canonical install path.** No `curl … | bash` for MVP
  (security audit overhead not justified for a single-developer audience).
  Users without bd installed get an explicit error from `install.sh` with
  install-bd instructions.
- **D-05 (revised):** **install.sh does all the real work** — hook script
  install (sentinel-merged into `~/.claude/settings.json`), shadow binary
  symlink to `~/.local/bin/gsd-sdk` with PATH precedence check, bd memory
  seeding (`bd remember gsd-beads:*`), worktree post-checkout shim append.
  The bd recipe template is a small markdown file with discovery/pointer
  text only (e.g., "gsd-beads ships as a separate repo — `git clone …`").
  Idempotent: re-running install.sh on an already-installed project
  refreshes memories + re-symlinks without breaking anything.

### Substitute Skills (skip entirely)
- **D-06:** **No `/gsd-beads-*` substitute skills ship in Phase 2.**
  Y1 shadow makes upstream skills (`/gsd-add-phase`, `/gsd-add-todo`,
  etc.) work transparently in beads-managed projects. Ship the lean
  MVP. Saves ~2000 lines of skill prompts.
- **D-07:** **Discovery is via bd memories.** When agents run any
  command, `bd prime` surfaces the `gsd-beads:vocabulary` memory:
  "Upstream `/gsd-*` commands route to bd transparently in beads
  managed projects via the gsd-sdk shadow." Users see this context at
  every session start.
- **D-08:** **Substitutes are a Phase 3 candidate** if user feedback
  indicates the lack of `/gsd-beads-*` prefix is confusing. Filed as
  deferred — not load-bearing for MVP.

### Mutation Event Emission (re-wrap manually in Phase 2)
- **D-09:** **Re-wrap our 13 handler overrides with GSDEvent emission**
  matching the pattern `createRegistry()` uses upstream. Spike 013
  surfaced that our overrides skip the wrap because we register AFTER
  createRegistry returns. Phase 2 builds a small helper:

  ```javascript
  function wrapMutation(handler, cmd, eventStream, sessionId) {
    return async (args, projectDir) => {
      const result = await handler(args, projectDir);
      try {
        eventStream?.emitEvent(buildMutationEvent(sessionId, cmd, args, result));
      } catch { /* fire-and-forget per upstream */ }
      return result;
    };
  }
  ```

  Apply to all 13 handlers post-register. Adds ~30 lines of helper +
  13 wrapping calls. Preserves the dashboard/observability story for
  free.
- **D-10:** **Reuse upstream's `buildMutationEvent` if reachable.**
  Upstream's `cli.js` references it inline; if it's not exported, we
  rebuild the event shape from documented fields. Either way our events
  are GSDEvent-compatible.

### Claude's Discretion
- Specific test framework (vitest vs node:test vs bash + jq for the
  shell scripts) — pick whatever's idiomatic per language; the spike
  test runners (Spike 001's 20-case + Spike 012's 43-case) are
  bash-driven and proven.
- Exact directory layout for the recipe (`scripts/`, `hooks/`,
  `bin/`, etc.) — pick what works for `bd setup --add`'s file
  injection model.
- Error message phrasing for hook denials — preserve the spike pattern
  (specific redirect message naming the right `/gsd-beads-*` or `bd`
  command); exact wording is implementation detail.
- Logging strategy for the shadow binary — quiet by default; debug
  via `GSD_BEADS_DEBUG=1` env var.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project foundation
- `.planning/PROJECT.md` — project metadata, audience, success criteria, non-goals
- `.planning/REQUIREMENTS.md` — REQ-01 through REQ-08 (source of truth, no fork, cross-worktree, deterministic write-path, conflict-free, versioned distro, narrative untouched, ready-set canonical)
- `.planning/ROADMAP.md` — Phase 2 scope statement
- `.planning/notes/beads-gsd-architecture.md` — architecture decisions (with one major reversal: stealth → non-stealth, captured in spike 003)

### Spike findings (auto-loaded skill `spike-findings-gsd-beads`)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — top-level requirements + feature area index
- `.claude/skills/spike-findings-gsd-beads/references/hook-layer.md` — hook contract, scripts, settings.json shape
- `.claude/skills/spike-findings-gsd-beads/references/beads-modeling.md` — all-epic + labels strategy, cascade-loop, parent-child, discovered-from
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md` — non-stealth, BEADS_DIR, fresh-clone bootstrap, worktree shim
- `.claude/skills/spike-findings-gsd-beads/references/gsd-ecosystem-integration.md` — 33 GSD files inventoried; 13 BLOCKS / 17 READS / 6 MENTIONS; bd memories under `gsd-beads:` namespace
- `.claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md` — Y1 canonical design with code patterns

### Spike sources (working POCs to copy/extend)
- `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh` — proven 20/20 hook script
- `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/bd-sync.sh` — sync stub to expand with regen
- `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh` — synthetic-payload test pattern
- `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/settings.fragment.json` — hook config shape
- `.claude/skills/spike-findings-gsd-beads/sources/002-beads-modeling/cascade-loop.sh` — 5-line cascade (canonical)
- `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh` — sentinel-marker shim
- `.claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh` — 43/43 mutation blocker
- `.claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs` — registry-override POC, canonical Y1 design

### Spike consolidated outputs
- `.planning/spikes/MANIFEST.md` — 13 spikes + ~25 locked Requirements (the design contract)
- `.planning/spikes/CONVENTIONS.md` — stack, structure, patterns, things to avoid
- `.planning/spikes/WRAP-UP-SUMMARY.md` — verdict tally + 8 key findings + Phase 2 build list
- `.planning/spikes/007-reader-skill-format-contract/README.md` — exact ROADMAP.md / REQUIREMENTS.md regen contract (drives 02-01)

### Upstream gsd-sdk (read for Y1 implementation)
- `~/.volta/.../get-shit-done-cc/sdk/dist/query/index.js` — exports `createRegistry`, `QUERY_MUTATION_COMMANDS`
- `~/.volta/.../get-shit-done-cc/sdk/dist/query/registry.js` — exports `QueryRegistry`, `resolveQueryArgv`, `extractField`
- `~/.volta/.../get-shit-done-cc/sdk/src/query/QUERY-HANDLERS.md` — 309-line authoritative handler-shape doc

### Upstream beads
- https://github.com/steveyegge/beads (beads CLI README)
- `bd --help`, `bd <subcommand> --help` (authoritative for the runtime contract)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from spike POCs — extend, don't rewrite)
- `block-state-md.sh` — 20/20 PASS hook; extend with bd-sync trigger
- `bd-sync.sh` — sync stub; expand with cascade-loop + regen calls
- `block-gsd-sdk-mutation.sh` — 43/43 PASS hook with 13-command deny-list; ready for production with minor polish
- `cascade-loop.sh` — 5-line canonical loop; production-ready
- `worktree-post-checkout.sh` — sentinel-marker shim; production-ready
- `gsd-sdk-shadow-v2.mjs` — POC has phase.add fully implemented; 12 stubs to expand with bd-backed implementations
- `test-runner.sh` (× 2) — synthetic Claude Code payload driver pattern; reuse for new hook tests

### Established Patterns (from CONVENTIONS.md)
- Bash + jq + bd CLI for hook scripts
- Node.js ESM for the shadow binary (dynamic `import()` of upstream's `dist/` files)
- Sentinel-marker merging for hook chains (`# --- BEGIN GSD-BEADS ... --- v1 ---`)
- `permissionDecision` JSON output via exit-0 + structured stdout (not exit-2 + stderr)
- Path filtering in script body, not in hook matcher
- `if: "Bash(<prefix> *)"` for per-command Bash filtering
- Test runners drive synthetic Claude Code payloads through scripts and assert decisions

### Integration Points
- bd's `bd setup` recipe system — gsd-beads registers as `bd setup --add gsd-beads <path>`
- bd's bundled hooks (`bd hooks install`) — sentinel-merged, coexist with our shim
- bd's `bd prime` SessionStart hook — surfaces our `gsd-beads:*` memories at every session
- Claude Code's `~/.claude/settings.json` hooks — gsd-beads adds 3 hook entries (PreToolUse Edit|Write, PreToolUse Bash, PostToolUse Bash)
- gsd-sdk's `createRegistry`/`resolveQueryArgv`/`extractField` exports — the shadow imports these
- Project's `.git/hooks/post-checkout` (via `bd hooks install`) — gsd-beads appends a sentinel-marked block

</code_context>

<specifics>
## Specific Ideas

- **Install UX (revised per Pitfall 1):** primary install path is
  `git clone https://github.com/<owner>/gsd-beads && cd gsd-beads &&
  ./install.sh`. Secondary discovery surface is `bd setup --add gsd-beads
  <path>` so the recipe shows up in `bd setup --list`; the recipe
  template content is a pointer to the git clone instruction. Both
  paths are idempotent — re-running install.sh refreshes memories +
  re-symlinks the binary without breaking anything.
- **Shadow binary location:** symlink to `~/.local/bin/gsd-sdk` (must
  appear before upstream's `~/.volta/bin/gsd-sdk` on PATH). Install
  script verifies PATH ordering and warns if wrong.
- **bd memory seeding** uses the canonical key set from MANIFEST.md:
  `gsd-beads:vocabulary`, `gsd-beads:state-paths`,
  `gsd-beads:type-strategy`, `gsd-beads:link-default`,
  `gsd-beads:discovered-from`, `gsd-beads:todowrite`,
  `gsd-beads:dolt-push`. Idempotent: `bd forget gsd-beads:* &&
  reseed-script` on update.
- **Test fixture for E2E:** ephemeral repo at `/tmp/gsd-beads-e2e-${RANDOM}`,
  init bd, install via recipe, exercise the full hierarchy build +
  cascade + regen, snapshot the regenerated ROADMAP.md and assert it
  matches what `gsd-progress` expects.

</specifics>

<deferred>
## Deferred Ideas

- **The 13 `/gsd-beads-*` substitute skills.** Y1 makes them
  optional. If users find the lack of explicit `/gsd-beads-*` prefix
  confusing, ship them in a Phase 3. ~2000 lines.
- **Custom curl-pipe-bash installer.** Belt-and-suspenders alternative
  to bd recipe. Only build if/when CI environments without bd installed
  become a real use case.
- **Multi-developer/federation extension.** PROJECT.md's audience is
  single-developer. `bd federation` documented in spike 002 as
  available for future. Not Phase 2.
- **Live dashboard / GSDEvent observability story.** D-09 preserves the
  option (handlers are wrapped); the actual dashboard consumer is out
  of scope for Phase 2.
- **`gsd-progress`-format-contract regen test fragility.** Spike 007
  flagged `gsd-progress` and `gsd-milestone-summary` as fragile
  parsers. E2E test in 02-06 covers them. If they prove too tightly
  coupled to ad-hoc format, a Phase 3 hardening loop may be needed.
- **Migration script for existing GSD projects.** PROJECT.md
  explicitly excludes this. If demand emerges later, build a separate
  `/gsd-beads-migrate` skill in a future milestone.
- **`bd federation` peer support across machines.** Out of scope per
  MVP.

</deferred>

---

*Phase: 02-build-the-layer*
*Context gathered: 2026-04-27*
