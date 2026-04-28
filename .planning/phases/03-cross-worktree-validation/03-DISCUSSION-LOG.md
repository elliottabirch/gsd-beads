# Phase 3: Cross-worktree validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 03-cross-worktree-validation
**Areas discussed:** Validation methodology, Worktree lifecycle scope, Documentation surface, Failure modes coverage

---

## Validation methodology

### Q1: Primary validation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Live-dev simulation (Recommended) | Script a realistic multi-day flow across 2-3 worktrees — create issues, link parents, cascade close, regen markdown, switch branches. Closest to actual user behavior; reproducible; bounded scope. | ✓ |
| Specific scenario pack | Enumerate 5-10 real worktree workflows (feature branch, hotfix, long-lived experiment, etc.) and validate each as a discrete test. Strong coverage map; easy to extend later. | |
| Dogfood adoption | Adopt gsd-beads for this project's own v0.2 milestone. Strongest "real use" signal but slow to produce results. | |
| Soak test | N iterations of randomized cross-worktree ops over time, looking for lock contention, ID collisions, or stale-state degradation. | |

**User's choice:** Live-dev simulation
**Notes:** Dogfood deferred to v0.2 backlog (CONTEXT.md "Deferred Ideas"). Soak test deferred until a specific intermittent issue surfaces.

### Q2: Number of concurrent worktrees

| Option | Description | Selected |
|--------|-------------|----------|
| 3 worktrees (Recommended) | Main + feature + hotfix — realistic upper bound for single-dev. Matches PROJECT.md audience. | ✓ |
| 2 worktrees | Minimum for "cross" — source + one feature worktree. Smallest meaningful test. | |
| 5 worktrees | Stress — overlapping experiments, reviews, builds. Rare for single dev. | |

**User's choice:** 3 worktrees

### Q3: Failure injection scope

| Option | Description | Selected |
|--------|-------------|----------|
| Happy-path + targeted failure injection (Recommended) | Run realistic flow first, then inject 3-4 specific failures. Validates both "does it work" and "does it fail safely." | ✓ |
| Happy-path only | "Real use" is mostly happy-path. Failure modes covered separately in Area 4. | |
| Full chaos battery | Random fault injection across the whole flow. Heavy effort, low MVP payoff. | |

**User's choice:** Happy-path + targeted failure injection

### Q4: Pass criterion

| Option | Description | Selected |
|--------|-------------|----------|
| Invariants hold + zero data loss (Recommended) | Validation passes when key invariants hold: no data loss, no ID collision, no stale state, all cross-worktree reads see latest write. Black-box; matches REQ-03's plain-language guarantee. | ✓ |
| All scenarios pass with zero manual intervention | Strong but brittle — a single recovery step would fail this. | |
| All scenarios pass with documented intervention | Permissive — risks shipping known papercuts. | |

**User's choice:** Invariants hold + zero data loss

---

## Worktree lifecycle scope

### Q1: Lifecycle ops to cover

| Option | Description | Selected |
|--------|-------------|----------|
| Setup + removal + reactivating (Recommended) | The 3 most common ops. Keeps scope tight; matches single-dev audience. | ✓ |
| Setup + all 5 ops | Add `git worktree prune`, branch-switching within a worktree, source-repo rename. Fuller coverage; +4-5 scenarios. | |
| Setup only — defer others | Treat removal/prune/reactivate as out-of-scope edge cases. Smallest scope. | |

**User's choice:** Setup + removal + reactivating

### Q2: `git worktree remove` handling

| Option | Description | Selected |
|--------|-------------|----------|
| Trust git — validate and document, no cleanup code (Recommended) | Per-worktree git config and marker live in worktree's gitdir; git removes them. Validate experimentally; document. Zero new code. | ✓ |
| Add explicit cleanup hook | Wire up `git worktree remove` lifecycle (no native hook — would need wrapper script). | |
| Document remove + manual cleanup steps | Acknowledge any leaks as known and provide a one-line cleanup. | |

**User's choice:** Trust git — validate and document, no cleanup code

### Q3: Reactivating an old worktree

| Option | Description | Selected |
|--------|-------------|----------|
| Marker check + re-fire shim if missing (Recommended) | Existing post-checkout shim already gates on `.gsd-beads-configured` marker. Resurrected worktrees without marker re-fire and reconfigure. Just need to validate. | ✓ |
| Always re-fire on every checkout | Drop marker gate — shim runs every post-checkout, idempotent overwrite. Simpler invariant; tiny perf cost. | |
| Document manual reconfigure command | Tell users to run `git checkout HEAD` or a reconfigure command. | |

**User's choice:** Marker check + re-fire shim if missing

### Q4: Pre-existing worktrees at install time

| Option | Description | Selected |
|--------|-------------|----------|
| install.sh enumerates worktrees and runs shim against each (Recommended) | One-time backfill = clean state for everyone. Idempotent via marker. | ✓ |
| Document a `gsd-beads-reconfigure-worktrees` command | Explicit but adds a step users will skip. | |
| Accept limitation — only NEW worktrees auto-configure | Smallest install.sh footprint; biggest user friction. | |

**User's choice:** install.sh enumerates worktrees and runs shim against each

---

## Documentation surface

### Q1: Where docs live

| Option | Description | Selected |
|--------|-------------|----------|
| Combination: bd memory + README section + WORKTREES.md (Recommended) | Three layers, each at the right depth. bd memory surfaces at every `bd prime`; README links to docs/WORKTREES.md for the full walkthrough. | ✓ |
| Single dedicated `docs/WORKTREES.md` | One canonical doc, linked from README and recipe pointer. | |
| bd memory only (`gsd-beads:worktrees`) | Surfaces at every `bd prime`; users access via `bd memory get`. Lean but not for human-first reading. | |
| README section only | Smallest footprint. Misses agent surfacing and full walkthrough. | |

**User's choice:** Combination — bd memory + README section + WORKTREES.md

### Q2: WORKTREES.md scope

| Option | Description | Selected |
|--------|-------------|----------|
| Setup + lifecycle ops + troubleshooting (Recommended) | The 3 lifecycle ops from Area 2 + troubleshooting keyed off Area 4 failure modes. End-to-end answer in one doc. | ✓ |
| Setup + lifecycle ops only | Tight reference; troubleshooting elsewhere. | |
| Setup walkthrough only | Minimum viable; defers everything else to bd memory or README. | |

**User's choice:** Setup + lifecycle ops + troubleshooting

### Q3: bd memory #8 seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — seed it as memory #8 (Recommended) | install.sh writes `install/memories/worktrees.md` and seeds via `bd remember --key gsd-beads:worktrees`. Surfaces at every session via bd prime. | ✓ |
| No — docs/WORKTREES.md is enough | Skip the memory; rely on README link. | |
| Yes, but keep memory short — just a pointer | 1-2 line pointer to docs/WORKTREES.md. | |

**User's choice:** Yes — seed it as memory #8 (full content, not pointer)

### Q4: Evidence persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Commit a curated `docs/WORKTREES-EVIDENCE.md` (Recommended) | Distill simulation transcripts + invariants into a short evidence doc. Future readers see what was verified. | ✓ |
| Embed evidence inline in WORKTREES.md | Single doc, no separate evidence file. Risks bloat. | |
| Ephemeral — no committed evidence | Test logs only. Cleanest; harder to recover later. | |

**User's choice:** Commit a curated `docs/WORKTREES-EVIDENCE.md`

---

## Failure modes coverage

### Q1: Failure modes to inject (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Source `.beads/` deleted mid-run (Recommended) | Worktree's BEADS_DIR points at a vanished directory. Verify graceful failure. | ✓ |
| Concurrent regen-roadmap.sh from two worktrees (Recommended) | Two worktrees fire bd-sync simultaneously. Validate atomic-mv (and now flock per Q3) prevents partial writes. | ✓ |
| Source repo renamed mid-flow (Recommended) | `mv ~/code/proj ~/code/proj-renamed`. Verify clear error and document recovery. | ✓ |
| BEADS_DIR env var unset in a worktree | User cd's into worktree without `git config --worktree` having fired. Verify discovery falls through OR fails clearly. | ✓ |

**User's choice:** All four (multi-select)

### Q2: Source-repo rename recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Document a one-line `git config` reset command (Recommended) | `git config --worktree gsd-beads.dir <new-path>/.beads` in each affected worktree. Document in WORKTREES.md troubleshooting. No new code. | ✓ |
| Ship a `gsd-beads-reconfigure` helper | One-shot script that reads `git rev-parse --git-common-dir`. ~20 lines of bash. | |
| Detect and self-heal in bd-sync.sh | Runtime auto-rediscovery. Smartest UX but adds path-resolution logic to a hot path. | |

**User's choice:** Document a one-line `git config` reset command

### Q3: Concurrent regen race protection

| Option | Description | Selected |
|--------|-------------|----------|
| Validate atomic-mv is sufficient — no new locking (Recommended) | Atomic rename is POSIX-guaranteed; whichever finishes second wins. Validate via simulation. Zero new code. | |
| Add flock-based serialization | Wrap regen scripts in flock so only one runs at a time. Adds flock dep + tiny wait. | ✓ |
| Document the race as known + acceptable | Skip experimental validation; just note "last writer wins, files are atomic." | |

**User's choice:** Add flock-based serialization
**Notes:** *Diverges from recommendation.* User explicitly chose to eliminate the race window via serialization rather than rely on atomic rename's last-writer-wins semantics. Captured as D-15 in CONTEXT.md with full lock-path / timeout / coverage spec.

### Q4: flock placement and timeout

| Option | Description | Selected |
|--------|-------------|----------|
| Lock at `<source-repo>/.beads/.gsd-beads.lock` with 30s timeout (Recommended) | Single shared lock co-located with bead store. Matches bd-sync.sh's overall timeout. Covers cascade-loop, regen-roadmap, regen-requirements. | ✓ |
| Per-output-file locks (regen-roadmap.lock, regen-requirements.lock) | Two locks; regens for different outputs run in parallel. More throughput; more lock files to reason about. | |
| Lock at `.beads/.gsd-beads.lock`, 5s timeout, fail loudly | Tight timeout exposes deadlocks fast. Risk: legitimate slow runs trip the timeout. | |

**User's choice:** Lock at `<source-repo>/.beads/.gsd-beads.lock` with 30s timeout

---

## Claude's Discretion

- Test framework for simulation script: bash + jq (matches existing test-runner pattern; no Node).
- Simulation script location: `tests/cross-worktree/` directory parallel to `tests/worktree-tests/`.
- CI integration: out of Phase 3 scope; INFR-03 territory.
- Exact format of `WORKTREES-EVIDENCE.md`: per-invariant heading + 5-10-line transcript excerpt.
- Lock file naming: `.gsd-beads.lock` (dot-prefix matches `.gsd-beads-configured` convention).

## Deferred Ideas

- Dogfood adoption on gsd-beads v0.2 milestone (filed for v0.2 backlog).
- Soak test (N-iteration randomized) — defer until simulation surfaces specific intermittent issues.
- Full chaos battery — not justified for single-developer audience.
- `git worktree prune`, branch-switching, `git worktree repair` validation — future hardening.
- Runtime self-heal in `bd-sync.sh` for source-repo rename — manual recovery is sufficient.
- `gsd-beads-doctor` / `gsd-beads-reconfigure-worktrees` helper command — install.sh backfill covers the need.
- CI matrix for simulation — INFR-03 territory, not Phase 3.
- Multi-developer federation — PROJECT.md non-goal.
- `--shared-server` mode validation — escape hatch documented in Spike 003; not MVP.
