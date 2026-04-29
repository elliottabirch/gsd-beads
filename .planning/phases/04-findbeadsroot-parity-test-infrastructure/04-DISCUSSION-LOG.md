# Phase 4: findBeadsRoot() + parity test infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or
> execution agents. Decisions are captured in CONTEXT.md — this log
> preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 4-findBeadsRoot-parity-test-infrastructure
**Areas discussed:** findBeadsRoot semantics, snapshot test storage, BeadsUnavailableError taxonomy, Phase 4 validation strategy

---

## findBeadsRoot semantics

### Resolution priority

| Option | Description | Selected |
|--------|-------------|----------|
| BEADS_DIR env wins | Check $BEADS_DIR first, then parent-walk | ✓ |
| Local .beads/ wins | Check projectDir/.beads/ first; only fall back when missing | |
| Symmetric (local then env then walk) | projectDir → BEADS_DIR → walk | |

**User's choice:** BEADS_DIR env wins
**Notes:** Symmetric with Phase 3 install.sh which sets BEADS_DIR per worktree.

### Walk depth

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded at git root | Walk parents until .git/ or filesystem root | ✓ |
| Unbounded | Walk to / | |
| Fixed depth (e.g. 5 levels) | Arbitrary cap | |

**User's choice:** Bounded at git root
**Notes:** Avoids climbing out of the project tree; matches prettier/npm idiom.

### Symlinked .beads/

| Option | Description | Selected |
|--------|-------------|----------|
| Follow symlinks | fs.realpath before checking metadata.json | ✓ |
| Reject symlinks | Treat symlinked .beads/ as non-managed | |

**User's choice:** Follow symlinks
**Notes:** Phase 3 worktree setups may symlink; bd CLI itself follows symlinks.

### isBeadsManaged() coexistence + milestone-scoping concern

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both functions | isBeadsManaged unchanged for mutations; findBeadsRoot new for reads | ✓ |
| Refactor isBeadsManaged to use findBeadsRoot | Single source of truth eventually | |
| Replace entirely | Reads + mutations both go through findBeadsRoot | |

**User's choice (deferred to free-text):** "so we need to figure out how to deal with worktrees. we are going to be on different milestones on different worktrees, and we'll get different doc regenerations, depending on our worktree. how will all of this resolve gracefully if every worktree is looking at the same beads dir?"

**Resolution after architectural discussion:**
- One canonical `.beads/` per source repo; worktrees share via BEADS_DIR
- ROADMAP.md / REQUIREMENTS.md / STATE.md remain per-worktree files
- Milestone-scoping happens at READ TIME — each handler filters bd by `version:vX.Y` label, sourced from worktree-local STATE.md
- STATE.md must be parameterized by worktree (not regenerated from bd unconditionally)
- `findBeadsRoot()` returns the same shared `.beads/` for all worktrees; milestone-scoping is layered on top by callers

**Follow-up question on milestone-scoping placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Phase 4 acceptance criteria | Phase 4 owns STATE.md worktree-locality + multi-milestone seeder | ✓ |
| Capture as a Phase 4.5 between 4 and 5 | Insert a focused phase for milestone-scoping plumbing | |
| Per-handler concern (Phase 5–9) | Each read handler implements its own filter | |
| Capture as todo, address separately | Out of v0.2 scope | |

**User's choice (isBeadsManaged):** Keep both functions
**User's choice (milestone scoping):** Add to Phase 4 acceptance criteria

---

## Snapshot test storage format

### Capture mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Static JSON files in repo | Captured once via `--update-snapshots` script | (after clarification) ✓ |
| Live regen from upstream every run | Always-current; ~6.7s added to suite | |
| Hybrid | Cache + periodic CI drift check | |

**User's choice (initial):** Asked clarifying question about scope of "every run" — gsd-beads's own test suite vs consuming repos.

**After clarification (cost analysis: ~6.7s per suite run for live regen, ~0ms for static, plus determinism constraint on the seeder for static):**
**User's choice:** Static JSON + deterministic seeder
**Notes:** Phase 4 must establish the seeder's determinism contract (fixed inputs, controlled bd init, no clock-dependent state in snapshots).

### Fixture source

| Option | Description | Selected |
|--------|-------------|----------|
| Single canonical multi-milestone fixture | Checked-in bd state | |
| Per-handler fixtures | Targeted but maintenance-heavy | |
| Generated fixture from script | Ephemeral, seeded per run by `tests/fixtures/seed-fixture.sh` | ✓ |

**User's choice:** Generated fixture from script
**Notes:** Combined with static-JSON snapshots, this requires the seeder to be deterministic (same script invocation → same bd state).

### Parity assertion

| Option | Description | Selected |
|--------|-------------|----------|
| Key-set + types only | Same keys, same types; values can differ | ✓ |
| Key-set + types + selected literals | Some fields exact, rest type-only | |
| Full deep-equal | Snapshot is a literal expected JSON | |

**User's choice:** Key-set + types only
**Notes:** Catches schema drift; doesn't false-positive on legitimate value differences (bd state vs file state can disagree).

### Drift detection

| Option | Description | Selected |
|--------|-------------|----------|
| CI job pinned to upstream version | Lockfile pin + drift-check job | ✓ |
| Manual on /gsd-update | No CI enforcement | |
| Skip in v0.2 | Defer drift story to v0.3 | |

**User's choice:** CI job pinned to upstream version
**Notes:** /gsd-update bumps lockfile + regenerates snapshots in the same PR.

---

## BeadsUnavailableError taxonomy

### Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single sentinel class | One class with optional cause field | |
| Subtypes for granular handling | BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty | ✓ |
| Single class + cause string enum | Middle ground | |

**User's choice:** Subtypes for granular handling
**Notes:** Lets future handlers degrade differently per cause without refactoring the contract.

### Catch scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only BeadsUnavailableError | Real bugs propagate loudly | |
| Any thrown Error | Maximum graceful degradation | |
| Sentinel OR known bd-CLI errors | ENOENT / "command not found" / etc. fall through; everything else loud | ✓ |

**User's choice:** Sentinel + known bd-CLI errors
**Notes:** More resilient than only-sentinel without masking handler bugs the way catch-all does.

### Where errors are thrown

| Option | Description | Selected |
|--------|-------------|----------|
| Helper functions only | findBeadsRoot returns null; bd() helper throws | ✓ |
| Read handlers throw directly | More control per handler, error logic duplicated | |
| Dispatcher throws based on state | Cleanest handler API but couples dispatcher to bd version checks | |

**User's choice:** Helper functions only
**Notes:** Centralizes error genesis; handlers stay clean.

### Sentinel metadata

| Option | Description | Selected |
|--------|-------------|----------|
| cause string + originalError | { cause: enum, originalError?: Error } | ✓ |
| cause string only | Just the enum | |
| Free-form data object | Maximum flexibility, no contract | |

**User's choice:** cause string + originalError
**Notes:** Sufficient for logs and tests; doesn't over-design.

---

## Phase 4 validation strategy

### Wiring proof (BEADS_READ_OVERRIDES is empty in Phase 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Test-only stub handler | `_phase4-test-stub` registered in Phase 4, removed in Phase 5 | ✓ |
| Negative-only: assert unmapped reads passthrough | No positive assertion until Phase 5 | |
| Defer to Phase 5 acceptance | Phase 4 lands without verifying read-dispatch loop end-to-end | |

**User's choice:** Test-only stub handler
**Notes:** Gives Phase 4 a vertical slice to assert against; underscore-prefix flags non-real handler.

### Sentinel test

| Option | Description | Selected |
|--------|-------------|----------|
| Stub throws sentinel | Same _phase4-test-stub takes flag/env to throw BeadsUnavailableError | ✓ |
| Unit-test the dispatcher in isolation | Faster but doesn't catch CLI argv issues | |
| Both: unit + stub via CLI | Belt-and-suspenders | |

**User's choice:** Stub throws sentinel
**Notes:** Verifies catch-and-fallthrough wiring end-to-end.

### findBeadsRoot test

| Option | Description | Selected |
|--------|-------------|----------|
| Real git worktrees in test setup | git init + git worktree add + BEADS_DIR per worktree | ✓ |
| Symlink simulation | Faster but misses git-config bugs | |
| Mixed (mock unit + one real worktree integration) | Best coverage/speed balance | |

**User's choice:** Real git worktrees in test setup
**Notes:** Slow (~1s setup) but catches real-world bugs; CI already requires git.

### Multi-milestone fixture timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 4 includes it | Front-loads complexity but matches D-05 acceptance | ✓ |
| Phase 4 single-milestone; Phase 5 expands | Defers complexity; risks gaps surfacing late | |

**User's choice:** Phase 4 includes the multi-milestone seeder
**Notes:** Phase 5+ ride on a confirmed fixture; milestone-scoping bugs surface in Phase 4.

---

## Claude's Discretion

- **Stub handler placement** — Whether `_phase4-test-stub` lives in
  `gsd-sdk-shadow.mjs` behind a `process.env.GSD_SHADOW_TEST_STUB` check
  or in a sibling module. Decided in plan-phase based on which keeps the
  production binary smallest.
- **Seeder determinism tactics** — Specific approach (BD_DATE env if bd
  supports it, fake-time wrapper, disabling auto-export during seeding)
  decided after the gsd-phase-researcher investigates bd v1.0.3's
  actual capabilities.
- **`--update-snapshots` ergonomics** — Separate script vs env var to
  the test runner; either works. Plan-phase picks the cleanest option.

## Deferred Ideas

- Refactoring `isBeadsManaged()` to delegate to `findBeadsRoot()` — D-04
  keeps them separate for v0.2; revisit in a future cleanup phase.
- `regen-roadmap.sh` / `regen-requirements.sh` milestone-filter wiring
  proper — Phase 5 (roadmap.*) and Phase 6 (progress.*) own that;
  Phase 4 only proves the STATE.md + seeder pattern.
- Read-handler caching — explicitly NOT in v0.2 (per ARCHITECTURE.md
  research); revisit in v0.3 if perf budget breached.
- The `disambiguate-bd-managed-detection.md` todo — different problem
  (vocabulary-bd vs state-bd), out of v0.2 entirely.
