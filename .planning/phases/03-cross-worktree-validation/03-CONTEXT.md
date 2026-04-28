# Phase 3: Cross-worktree validation - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that the shared `BEADS_DIR` design built in Phase 2 works
across multiple git worktrees in **real ongoing use** (REQ-03, REQ-05) —
not just the synthetic Spike 003 harness — and produce documentation
users will actually consult when setting up their own multi-worktree
workflows.

**In scope:**
- Live-dev simulation script: 3 worktrees (main + feature + hotfix), realistic
  multi-day flow (issue create, parent-child link, cascade close, regen,
  branch switch). Reproducible; black-box invariant checks.
- 4 targeted failure injections layered on the simulation:
  source `.beads/` deleted, concurrent regen race, source repo rename,
  BEADS_DIR env var unset.
- Worktree lifecycle ops beyond setup: `git worktree remove` (no cleanup
  code; trust git, validate experimentally), reactivating an old worktree
  path (validate existing marker-gate idempotency).
- `install.sh` enhancement: enumerate `git worktree list --porcelain` and
  fire the post-checkout shim against each pre-existing worktree (one-time
  backfill, idempotent via marker file).
- `flock`-based serialization in `cascade-loop.sh`, `regen-roadmap.sh`,
  `regen-requirements.sh` — single shared lock at
  `<source-repo>/.beads/.gsd-beads.lock`, `flock -x -w 30`.
- Documentation triple: `gsd-beads:worktrees` bd memory (#8), README
  multi-worktree section, full `docs/WORKTREES.md` (setup +
  lifecycle ops + troubleshooting).
- Curated `docs/WORKTREES-EVIDENCE.md` distilling simulation transcripts
  and observed invariants.

**Out of scope:**
- Multi-developer / federation across machines (PROJECT.md non-goal).
- Heavy concurrency beyond happy-path + 4 targeted injections (no full chaos
  battery; no random fault injection).
- New auto-recovery code paths in `bd-sync.sh` — recovery for source-repo
  rename is a documented one-line `git config --worktree` reset, not runtime
  self-healing.
- `git worktree prune`, branch-switching within a worktree, or
  `git worktree repair` validation — deferred (single-dev audience hits
  these rarely; cover only if Phase 3 evidence suggests they bite).
- A `gsd-beads-doctor` or `gsd-beads-reconfigure` helper command — not
  needed given the install.sh backfill + documented manual recovery.
- Migration of existing GSD projects' `.planning/` into beads (PROJECT.md
  non-goal).

</domain>

<decisions>
## Implementation Decisions

### Validation methodology (Area 1)
- **D-01:** **Live-dev simulation is the primary validation approach.**
  A scripted, reproducible multi-day flow across 2-3 worktrees creates,
  links, cascades, regens, and branch-switches — closest to real user
  behavior, bounded scope, replayable. NOT a pure soak test (rejected:
  hard-to-reproduce failures), NOT a pure scenario pack (rejected: weaker
  realism), NOT yet dogfooded (deferred — see Deferred Ideas).
- **D-02:** **3 concurrent worktrees** is the simulation upper bound:
  `main` + `feature` + `hotfix`. Matches PROJECT.md's single-dev audience.
  Validates "cross-worktree" beyond the 2-worktree minimum without
  invoking 5+-worktree stress patterns rare in single-dev practice.
- **D-03:** **Happy-path first, then 4 targeted failure injections.** The
  simulation runs the realistic flow to green, then layers the 4 failures
  from D-13 on top. Failure injection is targeted (not random) so each
  failure reproduces deterministically.
- **D-04:** **Pass criterion = invariants hold.** Validation is judged
  black-box against four invariants:
  1. **No data loss** — every issue created in any worktree survives.
  2. **No ID collision** — hash-based IDs unique across all worktrees and
     all 40-op concurrent batches.
  3. **No stale state** — after a write completes in worktree-A, a read in
     worktree-B sees it without manual sync.
  4. **Atomic markdown views** — regenerated ROADMAP.md / REQUIREMENTS.md
     never observed mid-write (no partial-content reads).
  REJECTED stricter "zero manual intervention" criterion (brittle — a
  legitimate `bd init --from-jsonl` on a fresh clone would fail it) and
  REJECTED looser "passes with documented recovery" (papers over real bugs).

### Worktree lifecycle scope (Area 2)
- **D-05:** **Lifecycle scope = setup + removal + reactivating.** Setup is
  already covered by the existing post-checkout shim. Removal and
  reactivation are the next two ops users hit. `git worktree prune`,
  branch-switching, and source-repo rename are deferred to Phase 3
  troubleshooting docs / future hardening.
- **D-06:** **`git worktree remove` requires no new gsd-beads code.** Both
  the per-worktree `gsd-beads.dir` config and the `.gsd-beads-configured`
  marker file live inside the worktree's gitdir (`.git/worktrees/<name>/`),
  which `git worktree remove` deletes. Validate experimentally that nothing
  leaks; document the result. NO explicit cleanup hook, NO wrapper script.
- **D-07:** **Reactivating an old worktree relies on existing marker-gate
  idempotency.** The post-checkout shim already gates on
  `.gsd-beads-configured`. Resurrected/old worktrees without the marker
  re-fire the shim and reconfigure. Validate this path with a specific
  scenario in the simulation; do NOT change the shim.
- **D-08:** **`install.sh` backfills pre-existing worktrees in one pass.**
  After installing the post-checkout hook, `install.sh` runs
  `git worktree list --porcelain`, parses worktree paths, and fires the
  shim against each. Idempotent (the shim's marker check makes second runs
  a no-op). REJECTED: documenting a separate `gsd-beads-reconfigure-worktrees`
  command (users would skip), REJECTED: accepting the limitation
  (biggest user friction).

### Documentation surface (Area 3)
- **D-09:** **Three-layer documentation.** Each layer at the right depth
  for its audience:
  1. `gsd-beads:worktrees` bd memory — surfaces at every `bd prime`
     (every Claude session), full content (not just a pointer), seeded by
     `install.sh` as memory #8 alongside the existing 7.
  2. README "Multi-worktree setup" section — links out to the full doc.
  3. `docs/WORKTREES.md` — full walkthrough.
  Single-doc and memory-only options REJECTED (incomplete coverage).
- **D-10:** **`docs/WORKTREES.md` covers setup + lifecycle ops + troubleshooting.**
  The 3 lifecycle ops from D-05 plus a troubleshooting section keyed off
  the 4 failure modes from D-13. End-to-end answer to "how do I run
  gsd-beads with worktrees?" in one doc.
- **D-11:** **`gsd-beads:worktrees` is memory #8, full content.** Add
  `install/memories/worktrees.md`, seed via `bd remember --key
  gsd-beads:worktrees` in `install.sh`. Consistent with the existing
  7-memory pattern. NOT a thin pointer — a self-contained briefing so
  agents don't need to chase a link.
- **D-12:** **Curate `docs/WORKTREES-EVIDENCE.md` from simulation runs.**
  After running the simulation (locally or in CI), distill the observed
  behavior, key transcript snippets, and verified invariants into a short
  evidence doc committed to the repo. Future readers see "here's what we
  actually verified" without rerunning.

### Failure modes coverage (Area 4)
- **D-13:** **Inject all 4 failure modes during the simulation:**
  1. **Source `.beads/` deleted mid-run** — verify graceful failure with
     clear error and no data loss in worktree-local state.
  2. **Concurrent regen-roadmap.sh from two worktrees** — validate flock
     serialization (D-15) prevents corrupt output; both invocations succeed.
  3. **Source repo renamed mid-flow** — verify clear error and document
     the recovery (D-14).
  4. **BEADS_DIR env var unset in a worktree** — verify discovery falls
     through to source via `git config --worktree gsd-beads.dir` cwd-scan,
     OR fails clearly. Document the precedence order observed.
- **D-14:** **Source-repo rename recovery = documented `git config` reset.**
  Recovery is a one-line command in each affected worktree:
  `git config --worktree gsd-beads.dir <new-source-path>/.beads`. Document
  in `WORKTREES.md` troubleshooting. NO new code in gsd-beads. NO runtime
  self-heal in `bd-sync.sh` (rejected: adds path-resolution logic to a hot
  path; cost > benefit for a rare event).
- **D-15:** **flock-based serialization for cascade + regen scripts.**
  *Diverges from the recommended atomic-mv-only option* — user explicitly
  chose serialization to eliminate the race window entirely, not just
  paper over it with last-writer-wins. Implementation:
  - **Lock path:** `<source-repo>/.beads/.gsd-beads.lock`. Resolves to the
    source bead store regardless of which worktree fires the script (use
    `git rev-parse --git-common-dir` → `dirname` → `/.beads/.gsd-beads.lock`).
  - **Lock primitive:** `flock -x -w 30` (exclusive, 30-second wait timeout
    matching `bd-sync.sh`'s overall hook timeout from `settings.fragment.json`).
  - **Coverage:** `cascade-loop.sh`, `regen-roadmap.sh`,
    `regen-requirements.sh` each acquire the lock at script preamble.
    `bd-sync.sh` chains to all three so the lock serializes the full chain.
  - **Failure mode:** lock timeout (`flock` exit 1) → script exits non-zero
    with a clear "another gsd-beads regen is in progress, retry shortly"
    message; bd-sync.sh continues fail-soft.
  - **Lock file lifecycle:** created lazily on first run; never deleted
    (lock files are essentially zero-size and `flock` is idempotent on
    reuse). `.gitignore` covers `.beads/.gsd-beads.lock` already if it
    matches existing `.beads/` ignore patterns; verify and add if needed.

### Claude's Discretion
- **Test framework for the simulation script:** bash + jq (matches the
  existing test-runner pattern from Spike 001 / Phase 2 hook tests).
  Node-based simulation rejected — would mix toolchains.
- **Simulation script location:** `tests/cross-worktree/` directory,
  parallel to the existing `tests/worktree-tests/` (which holds the
  unit-level auto-config + idempotency tests). The simulation is the
  integration layer above those.
- **CI integration:** out of Phase 3 scope. The simulation runs locally
  during validation and in `tests/run-all.sh` opt-in. CI matrix is INFR-03
  in a future phase.
- **Exact transcript-distillation format for `WORKTREES-EVIDENCE.md`:**
  pick whatever reads cleanly — likely a `## Observed: <invariant>` heading
  per invariant with a 5-10-line transcript excerpt under each.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project foundation
- `.planning/PROJECT.md` — single-developer audience, success criteria
  (worktrees see same state via shared BEADS_DIR), non-goals (no
  multi-developer federation, no migration).
- `.planning/REQUIREMENTS.md` — REQ-03 (cross-worktree state sharing) and
  REQ-05 (conflict-free concurrent updates) are the requirements this
  phase validates.
- `.planning/ROADMAP.md` §"Phase 3: Cross-worktree validation" — the
  goal statement.
- `.planning/phases/02-build-the-layer/02-CONTEXT.md` — Phase 2 decisions
  (especially worktree-init shim design, D-04/D-05 install.sh as installer,
  D-09 wrap-mutation reflects where state-changing flows fan out).
- `.planning/phases/02-build-the-layer/02-VERIFICATION.md` — confirms
  REQ-03 surface (worktree-post-checkout.sh) is shipping; the 13/13 truths
  are the foundation Phase 3 builds on.

### Spike findings (auto-loaded skill `spike-findings-gsd-beads`)
- `.claude/skills/spike-findings-gsd-beads/SKILL.md` — top-level requirements + feature area index.
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md`
  — the cross-worktree design (BEADS_DIR=<source>/.beads, post-checkout
  shim, fresh-clone bootstrap). Required reading for Phase 3.
- `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/README.md`
  — Spike 003's full validation harness; Phase 3 generalizes it from
  one-shot synthetic to multi-day live-dev simulation.
- `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh`
  — canonical shim source.

### Existing implementation (Phase 2 deliverables)
- `hooks/worktree-post-checkout.sh` — the shipping shim; Phase 3 validates
  it without modifying it (D-07).
- `hooks/bd-sync.sh` — the read-only filter + chain-to-cascade-and-regen
  hook. Phase 3 wraps cascade+regen invocations in `flock` per D-15.
- `scripts/cascade-loop.sh`, `scripts/regen-roadmap.sh`,
  `scripts/regen-requirements.sh` — the 3 scripts that gain `flock`
  preambles (D-15).
- `install.sh` — gains worktree-list backfill step (D-08) and seeds
  memory #8 `gsd-beads:worktrees` (D-11).
- `tests/worktree-tests/` — unit-level tests; Phase 3's simulation lives
  alongside these in `tests/cross-worktree/`.
- `install/memories/*.md` — the existing 7 memory files; Phase 3 adds
  `worktrees.md` as #8.
- `settings.fragment.json` — `bd-sync.sh` hook entry has `timeout: 30` —
  the lock timeout in D-15 must match (and not exceed) this.

### Upstream beads / dolt
- `.beads/.gitignore` (auto-managed by bd) — confirm `.gsd-beads.lock`
  pattern coverage; if not, add an explicit ignore for `.gsd-beads.lock`.
- `bd setup --add gsd-beads` recipe surface — Phase 3 unchanged.
- `bd hooks install` post-checkout chain — the surface our shim appends to.

### External documentation
- `git worktree` man page (`git help worktree`) — authoritative for
  `add` / `remove` / `prune` semantics, gitdir layout, post-checkout
  trigger semantics.
- `flock(1)` man page — `-x -w 30` semantics, exit code 1 on timeout,
  lock-file lifecycle.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/worktree-post-checkout.sh` — already production-grade with
  sentinel markers, flag-1 gate, marker idempotency. Phase 3 does NOT
  modify it; only validates it (D-07) and ensures `install.sh` backfills
  pre-existing worktrees (D-08).
- Phase 2's `tests/run-quick.sh` / `tests/run-all.sh` test runners — the
  cross-worktree simulation registers into one or both per the existing
  pattern.
- The atomic-mv pattern in `regen-roadmap.sh` and `regen-requirements.sh`
  (write to mktemp, then `mv`) — already there. flock layers on top
  rather than replacing it (defense in depth).

### Established Patterns (from `.planning/spikes/CONVENTIONS.md`)
- **Bash + jq + bd CLI** for hook scripts and tests (no Node, no Python).
- **Sentinel-marker merging** for any append into shared files
  (already used by `worktree-post-checkout.sh` and `install.sh`).
- **Synthetic-payload test runner** for hook tests
  (Spike 001's pattern, reused in Phase 2 `tests/hook-tests/`). Cross-
  worktree simulation uses real `git worktree add` calls in
  `/tmp/gsd-beads-cross-${RANDOM}` sandboxes with `trap EXIT` cleanup.
- **`mktemp + mv` for atomic writes** — extend with `flock` per D-15.
- **30-second timeout** on the `bd-sync.sh` hook (settings.fragment.json) —
  the lock timeout must match.

### Integration Points
- `install.sh` step ordering: the worktree-list backfill (D-08) must run
  AFTER hooks are installed (so the shim exists to be invoked) but BEFORE
  memory seeding (so any errors surface before bd state mutations).
- `bd-sync.sh` chain: `cascade-loop.sh` → `regen-roadmap.sh` → `regen-requirements.sh`.
  All three acquire the same `<source>/.beads/.gsd-beads.lock`; the chain
  must work whether they're called from `bd-sync.sh` (sequential) or
  directly (potentially parallel from different worktrees).
- `git rev-parse --git-common-dir` — the canonical resolver for "where is
  the source repo's `.git` directory" from any worktree. Used by the
  existing post-checkout shim and reused by the lock-path resolver in D-15.

</code_context>

<specifics>
## Specific Ideas

- **Simulation flow outline (3 worktrees):**
  1. Setup: source repo + 2 feature worktrees + 1 hotfix worktree.
  2. Day 1: from main, create epic + 3 leaves; verify cross-worktree
     visibility on `feature-a`.
  3. Day 2: from `feature-a`, close 2 of 3 leaves; verify epic remains
     open in main.
  4. Day 3: from `feature-a`, close last leaf; verify cascade fires and
     epic closes; verify both other worktrees see the closure.
  5. Day 4: from `hotfix`, create urgent epic + 1 leaf, close immediately;
     verify regenerated `ROADMAP.md` shows both epics in correct state
     across all 3 worktrees.
  6. Concurrent stress: from main + feature-a simultaneously, fire 20
     `bd-sync.sh` invocations each over 5 seconds; assert flock
     serializes correctly and final markdown matches bd state.
- **WORKTREES.md outline:**
  1. Why use worktrees with gsd-beads (the design promise).
  2. Setup walkthrough (4-line copy-pasteable block).
  3. Lifecycle: removing a worktree, reactivating an old one.
  4. Troubleshooting: 4 failure modes from D-13 with one-line recovery
     each. Source-repo rename gets the explicit `git config --worktree`
     command.
- **Memory #8 content** (1-2 paragraphs, plain text, surfaces at every
  `bd prime`): "gsd-beads supports git worktrees natively. Run
  `git worktree add ../<name> -b <branch>`; the post-checkout hook
  auto-configures the new worktree to share the source repo's bead store.
  See docs/WORKTREES.md for setup, removal, and troubleshooting."
- **Lock file naming:** `.gsd-beads.lock` (dot-prefix = hidden; matches
  the `.gsd-beads-configured` marker convention used in worktree-post-checkout.sh).

</specifics>

<deferred>
## Deferred Ideas

- **Dogfood adoption** — adopting gsd-beads on this project's own v0.2
  milestone is a stronger "real use" signal than the simulation, but
  needs the v0.2 milestone to exist (Phase 3 ships first). File for the
  v0.2 backlog: "Run gsd-beads on gsd-beads v0.2 development with
  ≥2 worktrees as continuous validation."
- **Soak test** (N-iteration randomized cross-worktree ops) — defer until
  the simulation surfaces a specific intermittent issue worth chasing.
  Hard-to-reproduce failures aren't worth chasing pre-emptively.
- **Full chaos battery** (random fault injection) — not justified for the
  single-developer audience.
- **`git worktree prune`, branch-switching, `git worktree repair`
  validation** — defer to a future hardening phase. Single-dev users hit
  these rarely; the simulation's 3-worktree lifecycle covers the common
  case.
- **Runtime self-heal in `bd-sync.sh` for source-repo rename** — D-14
  ships documented manual recovery. If users hit this often, revisit.
- **`gsd-beads-doctor` / `gsd-beads-reconfigure-worktrees` helper
  command** — install.sh backfill (D-08) covers the only reasonable need
  surfaced; a generic doctor command can wait.
- **CI matrix integration for the simulation** — INFR-03 territory; not
  Phase 3.
- **Multi-developer federation across machines** — PROJECT.md non-goal.
- **`--shared-server` mode validation** — Spike 003 documented this as an
  escape hatch for heavy concurrency. Single-dev MVP doesn't need it.

</deferred>

---

*Phase: 03-cross-worktree-validation*
*Context gathered: 2026-04-28*
