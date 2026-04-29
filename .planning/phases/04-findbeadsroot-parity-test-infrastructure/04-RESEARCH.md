# Phase 4: findBeadsRoot() + parity test infrastructure - Research

**Researched:** 2026-04-29
**Domain:** Internal infra — read-side detection helper, sentinel error class hierarchy, snapshot-parity test harness, deterministic fixture seeder, milestone-scoping plumbing for the gsd-sdk shadow
**Confidence:** HIGH overall. Every line-number, JSON shape, and bd flag was verified live (`bd v1.0.3 (1b2dd2cb)`, Node `v24.14.0`, `gsd-sdk-cc v1.38.5`). Determinism strategy verified empirically (`bd init --from-jsonl --prefix sd` preserves IDs and timestamps byte-for-byte). Two LOW-confidence items flagged in §Assumptions Log.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Detection (Area 1 — findBeadsRoot semantics)**
- **D-01:** Resolution priority is `BEADS_DIR` env first. If `$BEADS_DIR` is set and points at a real `.beads/` dir, use it. Otherwise parent-walk from `projectDir`. Symmetric with how Phase 3's install.sh sets `BEADS_DIR` per worktree.
- **D-02:** Parent-walk bounded at git root. Walk parents until either `.beads/metadata.json` or `.git/` is found, or we hit filesystem root. Avoids climbing out of the project tree.
- **D-03:** Follow symlinks via `fs.realpath`. Symlinked `.beads/` is legitimate; follow transparently. The `bd` CLI itself follows symlinks.
- **D-04:** `isBeadsManaged()` is unchanged for mutations; `findBeadsRoot()` is the new read-side function. Single-source-of-truth refactor is deferred — too much regression-test blast radius for Phase 4.
- **D-05:** Phase 4 acceptance includes milestone-scoping plumbing. STATE.md is parameterized by the worktree (worktree-local source for "current milestone", *not* bd). `regen-state.sh` reads that worktree-local source so two worktrees on different milestones see different STATE.md content while sharing one bd store.

**Test infrastructure (Area 2 — snapshot storage)**
- **D-06:** Static JSON snapshots in repo + deterministic seeder script. Snapshots live at `tests/shadow-tests/snapshots/<cmd>.json`. Captured via `tests/scripts/update-snapshots.mjs` (or similar) that runs upstream `gsd-sdk` against the seeded fixture and writes JSON.
- **D-07:** Deterministic seeder script at `tests/fixtures/seed-fixture.sh` is a Phase 4 deliverable. Determinism contract: same script invocation on the same machine produces byte-identical bd state. A Phase 4 test asserts the seeder is reproducible (run twice, diff JSONL).
- **D-08:** Multi-milestone fixture from day one. Seeder produces v0.1 phases (closed), v0.2 phases (in-progress), v0.3 phases (planned). Reusable in Phases 5–9.
- **D-09:** Parity assertion: key-set + types only. Same keys present in handler output and snapshot; same value types; values may differ because bd state differs from file state.
- **D-10:** CI drift detection via lockfile pin. A lockfile pins `gsd-sdk-cc` version. CI re-runs `update-snapshots` against the pinned upstream and diffs against repo snapshots; fails on drift. `/gsd-update` bumps lockfile + regenerates snapshots in the same PR.

**Error model (Area 3 — BeadsUnavailableError)**
- **D-11:** Subtype hierarchy. Base `BeadsUnavailableError` with four subtypes: `BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty`.
- **D-12:** Dispatcher catches `BeadsUnavailableError` OR known bd-CLI errors (ENOENT on `bd` binary, "bd: command not found"). Real bugs propagate loudly with `process.exit(1)`.
- **D-13:** Helpers throw, handlers stay clean. A `bd()` invocation helper wraps `execSync` and throws the appropriate sentinel subtype. `findBeadsRoot()` itself returns `null` (does NOT throw) when no `.beads/` is found — null is normal, not exceptional.
- **D-14:** Sentinel metadata: `{ cause: enum, originalError?: Error }`. The `cause` enum mirrors the subtypes.

**Validation strategy (Area 4 — proving wiring works)**
- **D-15:** Phase 4 ships a `_phase4-test-stub` handler registered in `BEADS_READ_OVERRIDES` purely to prove dispatch reaches read handlers. Returns `{ data: { ok: true, backend: 'beads' } }`. Phase 5 deletes it alongside adding `roadmap.analyze`.
- **D-16:** Same stub takes a flag/env to throw `BeadsUnavailableError`. Test variants invoke the stub configured to throw each subtype; assert the dispatcher catches the sentinel, falls through to upstream.
- **D-17:** Real `git worktree add` setup in `findBeadsRoot()` tests. ~1s setup but catches real-world bugs.
- **D-18:** Multi-milestone seeder is a Phase 4 deliverable, not deferred to Phase 5.

### Claude's Discretion
- **Stub-handler placement:** whether `_phase4-test-stub` lives in `gsd-sdk-shadow.mjs` behind a `process.env.GSD_SHADOW_TEST_STUB` check or in a sibling `bin/_test-stub.mjs` import — pick the option that keeps the production binary smallest while still allowing CLI-driven stub tests. Defer to plan-phase.
- **Determinism tactics for the seeder** (whether bd supports `BD_DATE` env, whether to use a fake-time wrapper, whether to disable bd's `auto-export` during seeding) — investigated below; pick a strategy in plan-phase.

### Deferred Ideas (OUT OF SCOPE)
- Refactoring `isBeadsManaged()` to delegate to `findBeadsRoot()` — D-04 keeps them separate for v0.2.
- `regen-roadmap.sh` / `regen-requirements.sh` milestone filtering — Phase 5 (roadmap.* read handlers) and Phase 6 (progress.* read handlers) own those.
- Caching layer for read handlers — none in v0.2.
- `disambiguate-bd-managed-detection.md` — the broader detection-tightening todo. Out of v0.2 entirely.
- `--update-snapshots` ergonomics (separate script vs env var) — plan-phase picks; either works.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **REQ-QUAL-01** | Output shape parity with upstream — every bd-backed read handler reproduces upstream's `data` shape exactly (same keys, same value types, same enum vocabulary). Verified by snapshot tests written before the handler implementation (red → green). | §Standard Stack (parity helper API), §Code Examples (key-set + types diff in 28 LOC, no library), §Architecture Patterns (snapshot file layout), §Validation Architecture (snapshot-write toggle) |
| **REQ-QUAL-02** | Read-shaped fallback contract — every bd-backed read handler degrades gracefully when bd is unavailable (missing, corrupt, wrong version, unreadable). Failure mode: fall through to upstream via a `BeadsUnavailableError` sentinel + dispatch-level catch — never exit 1, never crash the calling skill. | §Code Examples (5-class error hierarchy with `instanceof` parity), §Architecture Patterns (dispatcher try/catch extension at lines 303–312), §Common Pitfalls (Pitfall 1 — instanceof break across ESM module copies), §Validation Architecture (4-subtype dispatch fall-through assertion via stub) |
| **REQ-QUAL-03** | `findBeadsRoot()` replaces `isBeadsManaged()` for reads — read handlers detect bd-managed projects via a `findBeadsRoot()` walk that matches the `b51abbc` hooks fix (worktree topology, symlinked `.beads/`). `isBeadsManaged()` remains source of truth for mutations. | §Standard Stack (function signature + return contract), §Architecture Patterns (BEADS_DIR-first lookup, parent-walk halt conditions), §Code Examples (worktree fixture pattern), §Common Pitfalls (Pitfall 4 — symlink loops; Pitfall 6 — git rev-parse subprocess overhead) |
</phase_requirements>

## Summary

Phase 4 is **plumbing only**. No user-visible read handler ships. What ships is the substrate Phases 5–9 plug into:

1. **`findBeadsRoot(projectDir)`** — symmetric with the `b51abbc` hooks-side fix; honors `BEADS_DIR` env first, parent-walks bounded at git root, follows symlinks via `fs.realpath`. Returns the project root containing `.beads/metadata.json`, or `null` (NOT throws — null is normal per D-13).
2. **`BeadsUnavailableError` + 4 subtypes** — `BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty`. Helpers throw; handlers stay clean. The dispatcher's existing try/catch at `bin/gsd-sdk-shadow.mjs:303-312` is extended to recognize the sentinel and call `spawnUpstream(argv)` instead of `process.exit(1)`.
3. **`BEADS_READ_OVERRIDES = {}`** — a NEW table separate from the existing 13-entry `BEADS_OVERRIDES`. Registered in dispatch via a second loop after the mutation loop, WITHOUT `wrapMutation` (D-09 forward-compat: read handlers don't emit `GSDEvent.StateMutation`).
4. **`_phase4-test-stub` handler** — registered in `BEADS_READ_OVERRIDES` purely to prove dispatch wiring + sentinel fall-through end-to-end. Removed in Phase 5's first task.
5. **Snapshot-parity harness (`tests/shadow-tests/_parity-helpers.mjs`)** — key-set + types diff (~28 LOC, no library). Snapshots live as static JSON at `tests/shadow-tests/snapshots/<cmd>.json`.
6. **Deterministic seeder (`tests/fixtures/seed-fixture.sh`)** — multi-milestone bd state (v0.1 closed, v0.2 in-progress, v0.3 planned). Determinism strategy: **commit a canonical `seed.jsonl` to the repo and use `bd init --from-jsonl --prefix <fixed>` to restore it**. Verified live: this preserves IDs and `created_at`/`updated_at` byte-for-byte across machines [VERIFIED: bd v1.0.3 empirical test 2026-04-29].
7. **Milestone-scoping plumbing** — `scripts/regen-state.sh` is **not yet present in this repo** (despite CONTEXT.md mentioning commit `f8903ca`; that commit only added an *opportunistic* call site in `bd-sync.sh:66-70`). Phase 4's first task on this front is **creating** `scripts/regen-state.sh` (canonical install location), reading a worktree-local milestone source, NOT bd.
8. **CI drift detection via lockfile pin** — gsd-beads has **no `package.json`** today; upstream `gsd-sdk-cc` is consumed via the Volta-installed global. The lockfile is therefore a NEW file (recommend `gsd-sdk-cc.version.lock` as a 1-line pin: `1.38.5`) plus a CI script that asserts the installed version matches.

**Primary recommendation:** Use `bd init --from-jsonl --prefix sd` (committed `seed.jsonl`) for determinism, write a tiny ~28-LOC parity helper (no library), and follow the existing `tests/cross-worktree/lib/setup.sh` pattern for worktree fixtures (proven, ~1s/fixture).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project-root discovery (`findBeadsRoot`) | **CLI helper inside shadow process** | — | One-shot CLI; runs synchronously before any bd dispatch. No need for service tier. |
| Sentinel error class hierarchy | **Shadow process module** | — | Pure JS classes; consumed by helpers (which throw) and dispatcher (which catches `instanceof BeadsUnavailableError`). Module-local. |
| Read-handler dispatch | **Shadow process — registry layer** | Upstream gsd-sdk-cc | Reuses `createRegistry`/`resolveQueryArgv`/`extractField` from upstream; our shadow only adds the registration of `BEADS_READ_OVERRIDES` entries. |
| `BEADS_READ_OVERRIDES` table | **Shadow process module** | — | Same module as the existing `BEADS_OVERRIDES`. Co-located by intent (both are upstream-handler overrides) but separated by table for D-02 audit clarity. |
| Snapshot-parity harness | **Test process (`node:test`)** | Filesystem (snapshot files) | Pure assertion library; no runtime dependency. |
| Deterministic seeder | **Build/test fixture script (bash)** | bd CLI subprocess | One-shot bash invocation that writes JSONL to a temp `.beads/`; uses `bd init --from-jsonl`. |
| `regen-state.sh` (NEW) | **Build/script tier (bash)** | Filesystem (worktree-local milestone source) | Reads a worktree-local milestone source (e.g., `git config --worktree gsd-beads.milestone` — defer concrete choice to plan-phase), writes STATE.md. |
| CI lockfile pin | **CI workflow + filesystem** | npm/Volta resolver | Plain text file `gsd-sdk-cc.version.lock`; CI grep asserts `gsd-sdk` reports a matching version. |

## Standard Stack

### Core (already present in v0.1; no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | Node 22+ | Test runner | v0.1's 14 shadow tests already use it; Node-native; no `vitest`/`jest` install [VERIFIED: tests/run-quick.sh:11 invokes `node --test`] |
| `node:assert/strict` | Node 22+ | Assertions | Same v0.1 pattern; deep-equal supported via `assert.deepStrictEqual` [VERIFIED: tests/shadow-tests/wrap-mutation.test.mjs:65] |
| `node:child_process` (`spawnSync`) | Node 22+ | bd subprocess invocation | v0.1 mutations use `execSync`; reads SHOULD prefer `spawnSync` for status-code inspection without throwing (Pitfall 2 lesson) |
| `node:fs` (`existsSync`, `realpathSync`, `statSync`) | Node 22+ | Filesystem inspection | `realpathSync` follows symlinks per D-03; `statSync` distinguishes file/dir [CITED: nodejs.org/api/fs] |
| `node:path` (`resolve`, `join`, `dirname`) | Node 22+ | Path manipulation | Already imported in `bin/gsd-sdk-shadow.mjs:9` |
| `bd` CLI | `>= 1.0.3` | Source of truth + JSONL fixture format | Pinned by spike convention; verified `bd version 1.0.3 (1b2dd2cb)` |
| `git` CLI | system | Worktree fixture; `git rev-parse --git-common-dir` | Required for D-17 worktree fixture |
| `jq` | system | JSON manipulation in bash scripts | `regen-state.sh` and the seeder script use jq; install.sh:16 already pre-flights it |

### Supporting (NEW — created this phase, not external deps)

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `findBeadsRoot` | `bin/gsd-sdk-shadow.mjs` (new function near line 232) | Read-side root discovery | Every read handler's first call (Phases 5–9) |
| `BeadsUnavailableError` + subtypes | `bin/beads-errors.mjs` (NEW file — recommended; keeps shadow file slim) | Sentinel hierarchy | Helpers throw these; dispatcher catches base class |
| `bd()` helper | `bin/bd-helper.mjs` (NEW file — recommended) | Wrap `spawnSync('bd', ...)` and translate failures to sentinel subtypes | Replaces direct `execSync('bd …')` in read handlers |
| `_parity-helpers.mjs` | `tests/shadow-tests/_parity-helpers.mjs` (NEW) | `assertKeySetParity(actual, snapshot)`, `assertTypeParity(actual, snapshot)` | Every read-handler test (Phases 5–9) |
| `seed-fixture.sh` | `tests/fixtures/seed-fixture.sh` (NEW) | Restore canonical multi-milestone bd state from committed JSONL | Test setup hook in shadow tests |
| `seed.jsonl` | `tests/fixtures/seed.jsonl` (NEW, committed) | Canonical seeded bd state | Source for `bd init --from-jsonl` |
| `update-snapshots.mjs` | `tests/scripts/update-snapshots.mjs` (NEW) | Regenerate snapshot files from upstream gsd-sdk run against seeded fixture | Run via `npm run snapshot:update` (no package.json yet — see §Open Questions) or env-var-flagged test re-run |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Recommendation |
|------------|-----------|----------|----------------|
| Hand-roll 28-LOC parity helper | `chai-shape`, `joi`, `zod`, `ajv` | Adds an npm dep; gsd-beads has no `package.json` today; introduces lockfile maintenance burden | **Hand-roll.** Project's "no node deps" stance is intentional (see install.sh:14-21 — only system tools verified). |
| `bd init --from-jsonl` for determinism | Run a fixed bash seed script (`bd q "P1" -t epic` × N) | Live bd creation produces non-deterministic IDs and timestamps; verified empirically [VERIFIED: 2026-04-29 test — same script run twice yields different IDs `test-gpx` vs `test-5ec`] | **Use `--from-jsonl`.** Restores byte-identical state. Verified preserves IDs and `created_at`. |
| Plain text lockfile (`gsd-sdk-cc.version.lock`) | Add a `package.json` with `"dependencies": {"get-shit-done-cc": "1.38.5"}` | `package.json` invites npm install pattern that conflicts with current Volta-global model; complicates install.sh | **Plain text.** 1 line. CI grep asserts `gsd-sdk --version` matches. Defer `package.json` adoption decision. |
| `node --test --concurrency=1` (serial) | Default node:test parallelism | Tempdir/fixture isolation is fragile under parallelism (Pitfall 9 from milestone research); existing tests have not been audited | **Run serial in CI for v0.2** — `node --test` defaults to per-file parallel; phase 4 test design assumes that AND uses `mkdtempSync` per test (already standard). The risk is `BEADS_ACTOR` / global bd state leak; mitigate via per-test `env` overrides. |
| `git worktree remove --force` then `rm -rf` | Just `rm -rf` | If source repo and worktree are siblings under same tempdir, `rm -rf $tempdir` works — verified locally. If they're separate, orphan refs accumulate in source's `.git/worktrees/` | **Co-locate src+wt under one tempdir** (the existing `simulation.sh` pattern; see `tests/cross-worktree/lib/setup.sh:81-103`). Single `rm -rf` cleans both. |

**Installation:** No npm install. Existing v0.1 dependencies (Node 22+, bd 1.0.3+, git, jq, flock) cover everything. Verify with:

```bash
node --version          # >= v22
bd --version            # bd version 1.0.3
git --version           # any modern
jq --version            # any modern
```

**Version verification (2026-04-29):**
- `bd version 1.0.3 (1b2dd2cb)` [VERIFIED: `bd --version`]
- `node v24.14.0` [VERIFIED: `node --version`]
- `gsd-sdk-cc@1.38.5` [VERIFIED: `cat ~/.volta/.../get-shit-done-cc/package.json | jq -r .version`]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       gsd-sdk-shadow.mjs entry                          │
│                                                                         │
│   process.argv ── argv routing (lines 229–263, UNCHANGED)               │
│        │                                                                │
│        ├── no `query` token       → spawnUpstream(argv)                 │
│        ├── isBeadsManaged()=false → spawnUpstream(argv)                 │
│        └── beads-managed query    ↓                                     │
│                                                                         │
│              dynamic import:  query/index.js, query/registry.js         │
│              createRegistry(eventStream=null, sessionId)  (line 274)    │
│              ↓                                                          │
│              for [cmd,h] in BEADS_OVERRIDES:                            │
│                   registry.register(cmd, wrapMutation(h, …))   ← v0.1   │
│              for [cmd,h] in BEADS_READ_OVERRIDES:                       │
│                   registry.register(cmd, h)   ← Phase 4 NEW (no wrap)   │
│              ↓                                                          │
│              resolveQueryArgv(queryArgv, registry)  (line 297)          │
│              ↓                                                          │
│              try { result = await registry.dispatch(...) }              │
│              catch (err) {                                              │
│                if (err instanceof BeadsUnavailableError ||              │
│                    isKnownBdCliError(err))   ← Phase 4 NEW              │
│                  spawnUpstream(argv);   // fall through, never returns  │
│                else                                                     │
│                  process.exit(1);   // existing loud-fail               │
│              }                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                  │
                  ├─→ findBeadsRoot(projectDir)          ← Phase 4 NEW
                  │    (returns path or null)
                  │
                  ├─→ bd-helper.mjs::bd(args, cwd)       ← Phase 4 NEW
                  │    (throws BeadsNotInstalled / BeadsCorrupt /
                  │     BeadsVersionMismatch / BeadsEmpty on failure)
                  │
                  ├─→ _phase4-test-stub handler          ← Phase 4 NEW
                  │    (returns {data:{ok:true,backend:'beads'}};
                  │     env-flagged variant throws each subtype to
                  │     prove dispatch fall-through end-to-end)
                  │
                  └─→ tests/shadow-tests/                ← Phase 4 NEW
                       ├── _parity-helpers.mjs           (key-set + types)
                       ├── handler-_phase4-test-stub.test.mjs
                       ├── findBeadsRoot.test.mjs        (worktree fixture)
                       └── snapshots/                    (empty for now;
                                                          Phases 5–9 fill)
```

### Recommended Project Structure

```
gsd-beads/
├── bin/
│   ├── gsd-sdk-shadow.mjs           # extended (BEADS_READ_OVERRIDES, dispatch, findBeadsRoot)
│   ├── beads-errors.mjs             # NEW — BeadsUnavailableError + 4 subtypes
│   ├── bd-helper.mjs                # NEW — bd() helper that throws sentinels
│   └── wrap-mutation.mjs            # UNCHANGED
├── scripts/
│   ├── regen-state.sh               # NEW — reads worktree-local milestone source
│   ├── regen-roadmap.sh             # UNCHANGED
│   ├── regen-requirements.sh        # UNCHANGED
│   └── cascade-loop.sh              # UNCHANGED
├── tests/
│   ├── fixtures/
│   │   ├── seed-fixture.sh          # NEW — restores from seed.jsonl
│   │   └── seed.jsonl               # NEW (committed) — canonical bd state
│   ├── scripts/
│   │   └── update-snapshots.mjs     # NEW — regenerates snapshots from upstream
│   ├── shadow-tests/
│   │   ├── _parity-helpers.mjs      # NEW — assertKeySetParity / assertTypeParity
│   │   ├── handler-_phase4-test-stub.test.mjs   # NEW (deleted in Phase 5)
│   │   ├── findBeadsRoot.test.mjs   # NEW — worktree fixture tests
│   │   ├── snapshots/               # NEW directory (empty until Phase 5)
│   │   │   └── _phase4-test-stub.json
│   │   └── … (existing 14 tests UNCHANGED)
│   └── … (existing dirs unchanged)
└── gsd-sdk-cc.version.lock          # NEW — 1-line plain text version pin
```

### Pattern 1: BEADS_DIR-first parent-walk for `findBeadsRoot`

**What:** Honor explicit env override; fall back to walking parents bounded at `.git/`.
**When to use:** Every read-handler entrypoint (Phases 5–9).
**Why:** Symmetric with `b51abbc`'s hooks-side guard; honors Spike 003's worktree topology where `.beads/` lives in source repo only.

```javascript
// Source: derived from b51abbc (hooks/block-state-md.sh:31-33)
//         + Spike 003 (storage-and-distribution.md L9-10)
//         + Pitfall 5 prevention pattern (PITFALLS.md:381-394)
import { existsSync, realpathSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

/**
 * Discover the project root containing .beads/metadata.json.
 * - Honors BEADS_DIR env first (Spike 003 worktree topology).
 * - Walks parents from `start` (real-path resolved) bounded at git root + filesystem root.
 * - Returns null when no .beads/ found — null is normal, not exceptional (D-13).
 *
 * @param {string} start - directory to begin walking from (typically process.cwd() or argv --project-dir)
 * @returns {string|null} - canonical absolute path of the project root, or null
 */
export function findBeadsRoot(start) {
  // D-01: BEADS_DIR env wins.
  const envDir = process.env.BEADS_DIR;
  if (envDir) {
    const resolved = resolveSafe(envDir);
    if (resolved && existsSync(join(resolved, 'metadata.json'))) {
      // BEADS_DIR points AT a .beads/ dir; project root is its parent.
      return dirname(resolved);
    }
  }

  // D-03: follow symlinks via realpath. Catch ENOENT — start may not exist yet.
  let dir;
  try { dir = realpathSync(resolve(start)); } catch { return null; }

  // D-02: bounded parent-walk. Halt at filesystem root.
  while (true) {
    if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
    if (existsSync(join(dir, '.git'))) {
      // Hit the git root (file or dir; worktrees use a .git file).
      // .beads/ may live at the git common-dir for worktrees; check that too.
      // (See findBeadsRoot.test.mjs CASE: worktree topology.)
      return null;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;  // filesystem root
    dir = parent;
  }
}

function resolveSafe(p) {
  try { return realpathSync(resolve(p)); } catch { return null; }
}
```

**Worktree edge case** (Spike 003 + Pitfall 5): when invoked from a worktree, `dir` resolves to the worktree path, which has NO `.beads/` (it's only in the source repo). The walk terminates at the worktree's `.git` file (worktrees use a `.git` *file* pointing at the source's `.git/worktrees/<name>/`). Without explicit handling this returns null and falls through to upstream — wrong.

**Fix in the `if (existsSync(join(dir, '.git')))` branch:** when the marker is a `.git` *file* (not directory), read it to find the source repo, then check `<source>/.beads/metadata.json`. Equivalent to `git rev-parse --git-common-dir` but synchronous and dependency-free:

```javascript
import { statSync, readFileSync } from 'node:fs';

if (existsSync(join(dir, '.git'))) {
  const gitMarker = join(dir, '.git');
  const stat = statSync(gitMarker);
  if (stat.isFile()) {
    // Worktree: .git file contains "gitdir: /path/to/source/.git/worktrees/<name>"
    const content = readFileSync(gitMarker, 'utf-8').trim();
    const m = content.match(/^gitdir:\s*(.+)$/m);
    if (m) {
      // Walk up from gitdir to find source's .beads/
      const sourceGitDir = m[1].trim();
      // sourceGitDir ends in /.git/worktrees/<name>; walk up two parents
      const sourceRoot = dirname(dirname(dirname(sourceGitDir)));
      if (existsSync(join(sourceRoot, '.beads', 'metadata.json'))) {
        return sourceRoot;
      }
    }
  }
  return null;
}
```

[VERIFIED: tested manually 2026-04-29 — `git -C src worktree add ./wt`, then `wt/.git` is a file containing `gitdir: /tmp/.../src/.git/worktrees/feat`; the source's `.beads/` is at `src/.beads/`.]

### Pattern 2: BeadsUnavailableError class hierarchy with `instanceof` parity

**What:** Five Error subclasses, each preserving stack trace + carrying `cause` enum.
**When to use:** `bd-helper.mjs` throws subtypes; dispatcher catches base class.
**Why:** D-11 + D-14. Subtypes let future handlers degrade differently per cause without refactoring the contract.

```javascript
// Source: derived from MDN ECMA-262 Error subclassing pattern;
//         CAUSE_ENUM mirrors D-14 sentinel metadata schema.

export const BeadsCause = Object.freeze({
  NotInstalled:    'not-installed',
  Corrupt:         'corrupt',
  VersionMismatch: 'version-mismatch',
  Empty:           'empty',
  Unknown:         'unknown',
});

export class BeadsUnavailableError extends Error {
  constructor(message, { cause = BeadsCause.Unknown, originalError } = {}) {
    super(message);
    this.name = 'BeadsUnavailableError';
    this.cause = cause;                         // D-14 enum
    if (originalError) this.originalError = originalError;
    // Preserve stack trace (V8-specific; harmless on other engines)
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export class BeadsNotInstalled extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.NotInstalled });
    this.name = 'BeadsNotInstalled';
  }
}

export class BeadsCorrupt extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.Corrupt });
    this.name = 'BeadsCorrupt';
  }
}

export class BeadsVersionMismatch extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.VersionMismatch });
    this.name = 'BeadsVersionMismatch';
  }
}

export class BeadsEmpty extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.Empty });
    this.name = 'BeadsEmpty';
  }
}
```

**Dispatcher catch (replace lines 309–312 of `gsd-sdk-shadow.mjs`):**

```javascript
import { BeadsUnavailableError } from './beads-errors.mjs';

// known bd-CLI errors that should also fall through (D-12)
const BD_CLI_FALLTHROUGH_PATTERNS = [
  /command not found/i,
  /bd: not found/i,
  /ENOENT/,                        // execve('bd', ...) failed
];

function isKnownBdCliError(err) {
  if (err.code === 'ENOENT') return true;       // child_process spawn failure
  return BD_CLI_FALLTHROUGH_PATTERNS.some(pat => pat.test(err.message ?? ''));
}

try {
  const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
  console.log(pickField !== undefined
    ? registryModule.extractField(result.data, pickField)
    : JSON.stringify(result));
  process.exit(0);
} catch (err) {
  if (err instanceof BeadsUnavailableError || isKnownBdCliError(err)) {
    log(`read fall-through (${err.name ?? 'bd CLI error'}): ${err.message}`);
    spawnUpstream(argv);   // never returns
  }
  // Real bugs (TypeError, etc.) — keep v0.1 loud-fail behavior
  console.error(`[gsd-sdk-shadow] dispatch failed: ${err.message}`);
  process.exit(1);
}
```

### Pattern 3: `bd()` helper that throws sentinels (D-13 helpers throw; handlers stay clean)

```javascript
// bin/bd-helper.mjs
import { spawnSync } from 'node:child_process';
import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty } from './beads-errors.mjs';

/**
 * Invoke bd. Returns parsed JSON on success; throws sentinel subtypes on failure.
 * Handlers call this and let exceptions propagate to the dispatcher's catch.
 */
export function bd(args, { cwd, parseJson = true } = {}) {
  const result = spawnSync('bd', args, { cwd, encoding: 'utf-8' });

  // Spawn failure → bd binary not on PATH
  if (result.error?.code === 'ENOENT') {
    throw new BeadsNotInstalled('bd binary not found on PATH', { originalError: result.error });
  }

  if (result.status !== 0) {
    // bd returned non-zero. Distinguish corruption vs other failures.
    const stderr = (result.stderr ?? '').trim();
    if (/database|dolt|metadata\.json/i.test(stderr)) {
      throw new BeadsCorrupt(`bd ${args[0]} failed: ${stderr}`, { originalError: new Error(stderr) });
    }
    throw new BeadsCorrupt(`bd ${args[0]} failed (status ${result.status}): ${stderr}`);
  }

  const stdout = result.stdout ?? '';
  if (!parseJson) return stdout;

  // bd's "no issues found" returns an OBJECT not an array (Pitfall — STACK.md:115)
  let parsed;
  try { parsed = JSON.parse(stdout); }
  catch (err) {
    throw new BeadsCorrupt(`bd ${args[0]} returned non-JSON: ${stdout.slice(0, 200)}`, { originalError: err });
  }

  // Detect bd's empty-error shape: { error: '...', schema_version: 1 }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
    throw new BeadsEmpty(parsed.error, { originalError: new Error(parsed.error) });
  }

  return parsed;
}
```

### Pattern 4: Snapshot-parity helper (key-set + types only — D-09)

```javascript
// tests/shadow-tests/_parity-helpers.mjs
// Source: hand-rolled. ~28 LOC. No library dep — see Alternatives Considered.

/**
 * Assert `actual` and `snapshot` have the same key topology.
 * Recursive on objects; arrays compared by element-0 shape.
 * Values are NOT compared (D-09: "values may differ because bd state differs from file state").
 *
 * @throws AssertionError on key mismatch with a path like ".phases[0].disk_status"
 */
export function assertKeySetParity(actual, snapshot, path = '') {
  // Both null/undefined or both primitives — no keys to compare
  if (actual === null || snapshot === null) {
    if (actual !== snapshot && !(actual === null && snapshot === null)) {
      // Allow null in snapshot to match a non-null actual of any type
      if (snapshot !== null) {
        throw new Error(`parity: ${path || '<root>'} snapshot has type ${typeof snapshot}, actual is null`);
      }
    }
    return;
  }
  if (typeof actual !== 'object' || typeof snapshot !== 'object') return;

  if (Array.isArray(snapshot)) {
    if (!Array.isArray(actual)) {
      throw new Error(`parity: ${path || '<root>'} snapshot is array, actual is ${typeof actual}`);
    }
    // Array shape: check element-0 only (snapshot must have at least 1 element to test shape)
    if (snapshot.length > 0 && actual.length > 0) {
      assertKeySetParity(actual[0], snapshot[0], `${path}[0]`);
    }
    return;
  }

  // Object: every key in snapshot must be present in actual
  const snapshotKeys = Object.keys(snapshot);
  const actualKeys = Object.keys(actual);
  const missing = snapshotKeys.filter(k => !actualKeys.includes(k));
  if (missing.length > 0) {
    throw new Error(`parity: ${path || '<root>'} missing keys: ${missing.join(', ')}`);
  }
  // Recurse into every key snapshot has
  for (const k of snapshotKeys) {
    assertKeySetParity(actual[k], snapshot[k], `${path}.${k}`);
  }
}

/**
 * Assert `actual` and `snapshot` have matching value-types at every key.
 * Type vocabulary: 'string'|'number'|'boolean'|'null'|'array'|'object'
 * (typeof null === 'object' is a JS bug — this helper folds null into its own type).
 */
export function assertTypeParity(actual, snapshot, path = '') {
  const ta = typeOf(actual), ts = typeOf(snapshot);
  // null in snapshot = "any type allowed" (matches upstream's `null` field convention for "no value yet")
  if (ts === 'null') return;
  if (ta !== ts) {
    throw new Error(`parity: ${path || '<root>'} type mismatch — snapshot=${ts}, actual=${ta}`);
  }
  if (ts === 'object') {
    for (const k of Object.keys(snapshot)) {
      assertTypeParity(actual[k], snapshot[k], `${path}.${k}`);
    }
  } else if (ts === 'array' && snapshot.length > 0 && actual.length > 0) {
    assertTypeParity(actual[0], snapshot[0], `${path}[0]`);
  }
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;   // 'string' | 'number' | 'boolean' | 'object' | 'undefined'
}
```

### Pattern 5: Worktree test fixture (D-17)

```javascript
// tests/shadow-tests/findBeadsRoot.test.mjs (illustrative)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBeadsRoot } from '../../bin/gsd-sdk-shadow.mjs';

function worktreeBeadsFixture() {
  // Co-locate src + wt under one tempdir so a single rm -rf cleans both.
  // This avoids orphan refs in source's .git/worktrees/ — verified pattern
  // from tests/cross-worktree/lib/setup.sh:81-103.
  const root = mkdtempSync(join(tmpdir(), 'gsd-wt-test-'));
  const src = join(root, 'src');
  const wt = join(root, 'wt');
  mkdirSync(src);
  execSync('git init -q', { cwd: src });
  execSync('git config user.email t@t.t', { cwd: src });
  execSync('git config user.name t', { cwd: src });
  execSync('git commit -q --allow-empty -m init', { cwd: src });
  execSync('bd init --non-interactive --skip-agents --prefix wt >/dev/null 2>&1', { cwd: src });
  execSync(`git -C ${src} worktree add ${wt} -b feat`, { stdio: 'ignore' });
  return { root, src, wt };
}

test('findBeadsRoot CASE: worktree resolves to source repo', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // From the worktree dir, .beads/ is in src — findBeadsRoot must follow .git file.
  assert.equal(findBeadsRoot(wt), src);
});

test('findBeadsRoot CASE: BEADS_DIR env wins over walk', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  const otherSrc = join(root, 'other');
  mkdirSync(otherSrc);
  execSync('git init -q && git config user.email t@t.t && git config user.name t && git commit -q --allow-empty -m i', { cwd: otherSrc, shell: '/bin/bash' });
  execSync('bd init --non-interactive --skip-agents --prefix oth >/dev/null 2>&1', { cwd: otherSrc });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const prev = process.env.BEADS_DIR;
  process.env.BEADS_DIR = join(otherSrc, '.beads');
  try {
    assert.equal(findBeadsRoot(wt), otherSrc);
  } finally {
    if (prev === undefined) delete process.env.BEADS_DIR;
    else process.env.BEADS_DIR = prev;
  }
});

test('findBeadsRoot CASE: symlinked .beads/ resolves via realpath', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  const linkRoot = join(root, 'linked');
  mkdirSync(linkRoot);
  symlinkSync(join(src, '.beads'), join(linkRoot, '.beads'));
  // also need a .git so the walk knows linkRoot is a project
  execSync('git init -q && git commit --allow-empty -q -m i', { cwd: linkRoot, shell: '/bin/bash' });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = findBeadsRoot(linkRoot);
  // realpath dereferences the symlink; the answer is whichever side findBeadsRoot prefers
  // — document the chosen behavior in the test (after plan-phase decides).
  assert.ok(result === linkRoot || result === src,
    `expected either symlink-side or realpath-target, got: ${result}`);
});

test('findBeadsRoot CASE: non-bd project returns null', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-no-beads-'));
  execSync('git init -q && git commit --allow-empty -q -m i', { cwd: dir, shell: '/bin/bash' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(findBeadsRoot(dir), null);
});
```

**Setup time:** ~1s per fixture (verified live: 992ms total for `mkdir + git init + bd init + worktree add`). Cleanup `rm -rf`: ~6ms. The 4-case suite above runs in ~5s — acceptable.

### Pattern 6: Determinism via `bd init --from-jsonl` (D-07)

```bash
# tests/fixtures/seed-fixture.sh
#!/usr/bin/env bash
# Restores a canonical multi-milestone bd fixture into $1.
# Determinism contract: byte-identical state across runs (verified empirically).
# Strategy: bd init --from-jsonl preserves IDs and created_at/updated_at exactly.
set -euo pipefail

target="${1:?usage: seed-fixture.sh <target-dir>}"
seed_jsonl="${SEED_JSONL:-$(dirname "$0")/seed.jsonl}"
prefix="${SEED_PREFIX:-sd}"

[ -f "$seed_jsonl" ] || { echo "seed JSONL not found: $seed_jsonl" >&2; exit 1; }

mkdir -p "$target/.beads"
cp "$seed_jsonl" "$target/.beads/issues.jsonl"
( cd "$target" && BEADS_ACTOR=seed bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents >/dev/null 2>&1 )
chmod 700 "$target/.beads"  # bd warns at 0755
```

**Determinism verification (Phase 4 test):**

```javascript
test('seed-fixture CASE: byte-identical state across runs', (t) => {
  const a = mkdtempSync(join(tmpdir(), 'gsd-seed-a-'));
  const b = mkdtempSync(join(tmpdir(), 'gsd-seed-b-'));
  t.after(() => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });
  execSync(`tests/fixtures/seed-fixture.sh ${a}`);
  execSync(`tests/fixtures/seed-fixture.sh ${b}`);
  const exportA = execSync(`bd export --json`, { cwd: a, encoding: 'utf-8' });
  const exportB = execSync(`bd export --json`, { cwd: b, encoding: 'utf-8' });
  assert.equal(exportA, exportB, 'seeded bd state must be byte-identical');
});
```

**How the seeder JSONL is initially captured (one-time, committed):**

1. Manually run a fixed sequence of `BEADS_ACTOR=seed bd q "Phase 1" -t epic -p 1` etc. against a tempdir.
2. Add labels (`gsd:phase`, `phase-id:NN`, `version:v0.1` / `v0.2` / `v0.3`).
3. Establish parent-child links for plans.
4. Close v0.1 phases; leave v0.2 in progress; v0.3 untouched.
5. `bd export --json -o tests/fixtures/seed.jsonl`
6. `git add tests/fixtures/seed.jsonl && git commit`

The committed JSONL embeds specific IDs (`sd-h1d`, `sd-q5y`, etc.) and timestamps. From then on, every seed restore reproduces those exact IDs and timestamps [VERIFIED: empirical roundtrip test 2026-04-29 — ID `sd-h1d` and `created_at: 2026-04-29T19:43:13Z` preserved].

### Anti-Patterns to Avoid

- **Co-locating reads in `BEADS_OVERRIDES`** — the existing 13-entry table is wrapped with `wrapMutation` (line 277-279). Wrapping reads emits semantically wrong `GSDEvent.StateMutation` events when eventStream wires up post-v0.2. Use the new `BEADS_READ_OVERRIDES` table.
- **`require('chai-shape')` or `zod.shape()` for parity** — adds an npm dep; the project has no `package.json`. Hand-roll the 28-LOC helper.
- **Live bd writes in the seeder** — non-deterministic IDs (verified: `bd q "Same Title"` produces `sd-h1d` then `sd-dux`). Use `--from-jsonl` instead.
- **Worktree fixture cleanup via `rm -rf` alone with separated tempdirs** — leaves orphan refs in `<source>/.git/worktrees/`. Co-locate src + wt under one tempdir.
- **Throwing from `findBeadsRoot()`** — null-on-not-found is the contract (D-13). Throwing means every read handler must wrap it; null lets handlers do `if (!root) throw new BeadsEmpty(...)` once.
- **Forgetting to handle the `.git` *file*** — worktrees use a `.git` file (not directory). Without explicit handling, the parent-walk halts before reaching the source repo's `.beads/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worktree topology resolution | A custom git-worktree parser | Read the `.git` *file*, parse `gitdir:` line, walk up | git's worktree marker format is stable since git 2.5 (2015); 5-line parse is enough |
| JSONL fixture restoration | Hand-replay `bd q` calls | `bd init --from-jsonl --prefix <fixed>` | bd v1.0.3 ships this; preserves IDs + timestamps byte-for-byte [VERIFIED] |
| Test runner / parallel coordination | A custom runner | `node:test` (already used by 14 existing tests) | Node 22+ ships it; `t.after()` provides leak-free teardown |
| Snapshot diff with type tolerance | Reach for `chai`, `joi`, `zod`, `ajv`, `deep-equal` | 28-LOC `_parity-helpers.mjs` | No npm dep needed; logic is small enough to audit in one screen |
| Symlink resolution | Manual `lstat` + recursion | `fs.realpathSync` (Node built-in) | Handles cycles, `EACCES`, all filesystems |
| Subprocess invocation with status code inspection | Hand-roll over `execSync` + try/catch | `spawnSync` from `node:child_process` | Returns `{stdout, stderr, status, error}` without throwing on non-zero exit |
| Project-root finder beyond what we need | A general-purpose `find-up`-style helper | The 30-line `findBeadsRoot` above | Scope to bd's exact needs; less surface area to break |

## Runtime State Inventory

> Phase 4 ships **plumbing only**, no rename / refactor / migration. Most categories are not applicable.
> Skipping the table per the "rename/refactor only" guidance — explicit reasoning below to confirm nothing was missed.

- **Stored data:** None. Phase 4 doesn't rename any bd ID, label, or memory key. All current beads in this project's `.beads/` (if any seed work was done) are untouched.
- **Live service config:** None. No external services with project-name strings.
- **OS-registered state:** None. No new launchd/Task Scheduler/systemd registration.
- **Secrets / env vars:** Phase 4 introduces ONE new env var: `BEADS_DIR` (already established by Phase 3's install.sh, NOT new). Phase 4 reads it; doesn't define it. Optionally `GSD_SHADOW_TEST_STUB` for stub-handler activation (test-only). Neither lives in any secret store.
- **Build artifacts / installed packages:** `gsd-beads` itself is symlinked from `~/.local/bin/gsd-sdk` (per install.sh:93). Phase 4 modifies `bin/gsd-sdk-shadow.mjs` and adds two siblings (`bin/beads-errors.mjs`, `bin/bd-helper.mjs`); both are picked up automatically via ESM import. No reinstall needed.

## Common Pitfalls

### Pitfall 1: `instanceof` breaks across ESM module copies

**What goes wrong:** When `bin/gsd-sdk-shadow.mjs` imports `BeadsUnavailableError` from `./beads-errors.mjs`, and `bin/bd-helper.mjs` ALSO imports it from `./beads-errors.mjs`, Node loads the file **once** (per resolved URL) and `instanceof` works. BUT: if a test file does `import { BeadsUnavailableError } from '../../bin/beads-errors.mjs'` and the shadow imports it via a slightly different URL (e.g., one with `?cache-bust=1`), Node may load it twice — and `instanceof` returns false because they're different class objects.

**Why it happens:** ESM module identity is keyed on resolved URL. Same source file via two URLs = two classes.

**How to avoid:**
1. Always import via the exact same path string from every consumer. The `import` resolver normalizes paths, but a cache-bust query string or a `file://` vs relative path can split.
2. Test for the bug: write one assertion that imports the class from the test file AND triggers a throw via the shadow CLI; assert `instanceof` matches. If it ever fails, you've split.
3. If a split is unavoidable (rare in this codebase), check `err.name === 'BeadsUnavailableError'` as a fallback alongside `instanceof`.

**Warning signs:** Tests that test the dispatch fall-through pass when run in isolation but fail when bundled. `err.name === 'BeadsUnavailableError'` returns true but `err instanceof BeadsUnavailableError` returns false.

[VERIFIED: pattern documented at https://nodejs.org/api/esm.html#import-and-export-statements; concern referenced in TC39 Realms proposal.]

### Pitfall 2: `execSync` throws on non-zero — read fall-through never reached

**What goes wrong:** v0.1 mutation handlers use `execSync('bd …')` (e.g., `gsd-sdk-shadow.mjs:30,49,66,104`). `execSync` THROWS when bd exits non-zero. If a Phase 4 read handler reuses this pattern, the throw is caught by the dispatcher's existing catch (line 309) and `process.exit(1)` fires — the BeadsUnavailableError fall-through is never reached.

**Why it happens:** Reads inherit the mutation pattern by copy-paste.

**How to avoid:** `bd-helper.mjs` uses `spawnSync` (Pattern 3 above), inspects `result.status`, and throws the appropriate sentinel. Read handlers MUST go through `bd-helper.mjs::bd()`, never call `execSync('bd …')` directly.

**Warning signs:** A read handler test that mocks bd as missing exits with `[gsd-sdk-shadow] dispatch failed: …` instead of falling through.

### Pitfall 3: Snapshot file written from stale upstream version

**What goes wrong:** Developer runs `update-snapshots.mjs` against an upstream `gsd-sdk-cc` they happen to have installed locally. They commit the snapshot. CI installs the lockfile-pinned upstream version — different — and parity fails.

**Why it happens:** The snapshot writer doesn't pin upstream; the lockfile does, but only at CI time.

**How to avoid:**
1. `update-snapshots.mjs` reads `gsd-sdk-cc.version.lock`, asserts the resolved `gsd-sdk` binary reports a matching version, and refuses to run otherwise.
2. CI re-runs `update-snapshots.mjs` against the pinned upstream; diffs against committed snapshots; fails on drift.
3. `/gsd-update` is a single PR that bumps lockfile AND regenerates snapshots together.

**Warning signs:** Snapshots committed from a version-mismatched dev machine. CI fails on parity but local passes.

### Pitfall 4: `realpathSync` infinite loop on symlink cycles

**What goes wrong:** A pathological symlink (`a → b → a`) makes `realpathSync` throw `ELOOP`. Naive code treats this as ENOENT and silently returns null, so reads fall through to upstream — but the user's `BEADS_DIR` was set on purpose, and upstream sees a non-bd project.

**Why it happens:** `fs.realpathSync` does NOT loop indefinitely (it has cycle detection), but it throws `ELOOP`. Catching all errors as "no .beads/" hides the real bug.

**How to avoid:** In `findBeadsRoot`, catch only `ENOENT` and let `ELOOP` / `EACCES` propagate (or log + return null with a debug warning). [CITED: nodejs.org/api/fs.html#fsrealpathsyncpath-options — throws on ELOOP.]

### Pitfall 5: Bd's `auto-export` interferes with seeder reproducibility

**What goes wrong:** `bd init --from-jsonl` triggers an auto-export at completion (default behavior). If the auto-export runs at a slightly different millisecond than the source export, `.beads/issues.jsonl` mtimes diverge across runs. State is identical but files have different mtimes.

**Why it happens:** bd's `export.auto: true` writes JSONL after every write. This is set per-project in `config.yaml`.

**How to avoid:** The determinism contract is on **bd state**, not on **filesystem mtimes**. Test reproducibility via `bd export --json | sha256sum`, NOT via `diff .beads/issues.jsonl .beads/issues.jsonl.expected`. (Already what the example test in Pattern 6 does.)

[VERIFIED: bd v1.0.3 `bd config get export.auto` returns `true` by default; per `bd config --help` output line documenting `export.auto`.]

### Pitfall 6: `git rev-parse --git-common-dir` adds 50ms per findBeadsRoot call

**What goes wrong:** Spawning `git rev-parse` to resolve worktree topology is ~50ms. `findBeadsRoot` is called by EVERY read handler invocation (Phases 5–9). 50 invocations per Claude turn × 50ms = 2.5s of git overhead on top of bd queries.

**Why it happens:** `git rev-parse --git-common-dir` is a subprocess.

**How to avoid:** Read the `.git` file directly with `readFileSync` and parse the `gitdir:` line. Single ~5ms file read. No subprocess. (Pattern 1 above already uses this.)

### Pitfall 7: `tests/fixtures/seed.jsonl` becomes a contested merge target

**What goes wrong:** Phases 5–9 each want to extend the seed with a new piece (e.g., Phase 7 needs decisions memories; Phase 8 needs `phase-id:` labels in a specific shape). PRs collide on the JSONL.

**Why it happens:** JSONL is line-oriented but order-sensitive (bd preserves insertion order in the JSONL); merging two new lines requires re-running the seeder.

**How to avoid:** Establish the convention now (Phase 4): the seed.jsonl is **regenerated** from a source bash script (`tests/fixtures/build-seed.sh`), NOT hand-edited. PRs change the source script + commit the regenerated JSONL. The diff in PR review is on the bash script (semantic), not the JSONL (mechanical).

### Pitfall 8: CI runs node:test in parallel — global bd state leaks across tests

**What goes wrong:** Two parallel test files both run `bd init` in their tempdirs, but bd writes some global state to `~/.bd/` (history, prefs). One test's `BEADS_ACTOR` env leaks into another's spawn. Tests pass in isolation, fail under `--concurrency=4`.

**Why it happens:** Per Pitfall 9 of the milestone-level research; node:test default is per-file parallel.

**How to avoid:**
1. `BEADS_ACTOR=seed` in every fixture spawn (already done in Pattern 6).
2. `HOME=$tempdir` per-test (the milestone-research recommendation; not yet adopted in v0.1, but the v0.1 tests don't currently flake — so adopt only if Phase 4 tests start showing it).
3. Run tests serially in CI for v0.2 (`node --test --concurrency=1`); document the choice and revisit in v0.3.

## Code Examples

All code examples are in §Architecture Patterns above (Patterns 1–6). They are: `findBeadsRoot`, error-class hierarchy, `bd()` helper, parity helpers, worktree fixture, deterministic seeder.

## State of the Art

| Old Approach (v0.1) | Current Approach (Phase 4) | Why Changed | Impact |
|---------------------|----------------------------|-------------|--------|
| `isBeadsManaged()` (existsSync only) | `findBeadsRoot()` (BEADS_DIR + parent-walk + symlink) | Worktree topology validated in Spike 003; `b51abbc` fixed hooks; reads inherit the bug if not symmetric | All Phase 5–9 read handlers route correctly from worktrees |
| `execSync('bd …')` throws → `process.exit(1)` | `bd()` helper throws sentinel → dispatcher falls through to upstream | Reads must degrade gracefully (REQ-QUAL-02); v0.1's loud-fail is wrong for reads | `gsd-progress` doesn't crash when bd is unavailable on a transitional project |
| Single `BEADS_OVERRIDES` table, all wrapped with `wrapMutation` | New `BEADS_READ_OVERRIDES` table, registered without wrap | `wrapMutation` emits `GSDEvent.StateMutation` — semantically wrong for reads | Forward-compat with eventStream wiring (D-09) |
| No snapshot tests | Static-JSON snapshots + key-set+types parity helper | Output-shape drift (Pitfall 1 of milestone research) is the most insidious failure mode | Every Phase 5–9 read handler proves shape parity before the implementation lands |
| No determinism story | `bd init --from-jsonl` from committed seed | Live `bd q` calls produce non-deterministic IDs / timestamps; verified empirically | Snapshot tests can compare against fixed reference state |
| No upstream version pin | `gsd-sdk-cc.version.lock` plain text | Without a pin, snapshots drift silently with upstream | CI fails on drift; `/gsd-update` bumps both atomically |

**Deprecated/outdated (do NOT do):**
- Adding read handlers to `BEADS_OVERRIDES` for "code uniformity" — emits wrong events.
- Trusting bd ID generation to be deterministic — it isn't (verified).
- Using `execSync` in read handlers — masks the fall-through path.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 22+, bundled) |
| Config file | None — `node --test <files>` is invoked directly via bash runners (`tests/run-quick.sh:11`, `tests/run-all.sh:13`) |
| Quick run command | `node --test tests/shadow-tests/findBeadsRoot.test.mjs tests/shadow-tests/handler-_phase4-test-stub.test.mjs tests/shadow-tests/_parity-helpers.test.mjs` |
| Full suite command | `tests/run-all.sh` |
| Phase gate | `tests/run-all.sh` returns 0; new bash test (Phase 4) for seeder reproducibility passes |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-QUAL-01 | Snapshot-parity helper exists and detects a missing key | unit | `node --test tests/shadow-tests/_parity-helpers.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-01 | Snapshot-parity helper exists and detects a type mismatch | unit | (same file) | ❌ Wave 0 |
| REQ-QUAL-01 | Snapshot files are loadable JSON; `_phase4-test-stub.json` exists at the expected path | unit | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | `_phase4-test-stub` happy path: dispatch returns `{data:{ok:true,backend:'beads'}}` | integration | `node --test tests/shadow-tests/handler-_phase4-test-stub.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-02 | Stub configured to throw `BeadsNotInstalled`: dispatcher falls through to upstream (no `dispatch failed` in stderr) | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Stub configured to throw `BeadsCorrupt`: same fall-through | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Stub configured to throw `BeadsVersionMismatch`: same fall-through | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Stub configured to throw `BeadsEmpty`: same fall-through | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | Real bug (`TypeError`) in handler: dispatcher exits 1 (NOT fall-through) — preserves v0.1 loud-fail | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-02 | `instanceof BeadsUnavailableError` works across ESM module boundaries (subtypes also instanceof base) | unit | `node --test tests/shadow-tests/beads-errors.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` returns source repo when called from a worktree | integration | `node --test tests/shadow-tests/findBeadsRoot.test.mjs` | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` honors `BEADS_DIR` env over parent-walk | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` follows symlinked `.beads/` via `realpathSync` | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` returns null on a non-bd project (no false positives) | integration | (same file) | ❌ Wave 0 |
| REQ-QUAL-03 | `findBeadsRoot` halts at filesystem root (does not climb out of project tree) | unit | (same file) | ❌ Wave 0 |
| **D-07** | Seeder reproducibility: two invocations produce byte-identical `bd export --json` | integration | `bash tests/shadow-tests/seed-determinism.test.sh` | ❌ Wave 0 |
| **D-08** | Multi-milestone fixture: seeder produces v0.1 (closed), v0.2 (in-progress), v0.3 (planned) phases | integration | (same file or sibling) | ❌ Wave 0 |
| **D-05** | Worktree-A querying STATE.md for milestone v0.2 sees v0.2 phases; Worktree-B querying for v0.3 sees v0.3 phases — same shared bd store | integration | `node --test tests/shadow-tests/milestone-scoping.test.mjs` | ❌ Wave 0 |
| **D-10** | CI drift detection: lockfile pin matches installed `gsd-sdk` version | unit (CI) | `bash tests/install-tests/upstream-version-pin.test.sh` | ❌ Wave 0 |
| **REQ-QUAL-05 (precursor)** | Hook-allowlist grep test: no read handler invokes a write-side bd subcommand (validates against `hooks/bd-sync.sh:23` allowlist) — Phase 4 stages the wiring; full test in Phase 11 | unit | `bash tests/shadow-tests/bd-allowlist-grep.test.sh` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/shadow-tests/<the-changed-file>.test.mjs` (~2-5s each).
- **Per wave merge:** `tests/run-quick.sh argv-routing wrap-mutation handler-phase-add` + new Phase 4 suites.
- **Phase gate:** `tests/run-all.sh` green AND new seeder-determinism bash test green AND CI drift-pin test green.

### Wave 0 Gaps

- [ ] `tests/shadow-tests/findBeadsRoot.test.mjs` — covers REQ-QUAL-03; 5 cases (worktree, BEADS_DIR, symlink, non-bd, root-halt).
- [ ] `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` — covers REQ-QUAL-02; 6 cases (happy + 4 sentinel subtypes + real-bug).
- [ ] `tests/shadow-tests/beads-errors.test.mjs` — covers REQ-QUAL-02 instanceof parity; ~4 cases.
- [ ] `tests/shadow-tests/_parity-helpers.test.mjs` — covers REQ-QUAL-01 helper; ~6 cases (missing-key, missing-nested, type-mismatch, null-snapshot-allows-anything, array-shape, recursion).
- [ ] `tests/shadow-tests/_parity-helpers.mjs` — the harness module itself (covered by tests above).
- [ ] `tests/shadow-tests/snapshots/_phase4-test-stub.json` — single snapshot proving the wiring + parity loop.
- [ ] `tests/shadow-tests/seed-determinism.test.sh` — bash test asserting seeder reproducibility (D-07).
- [ ] `tests/shadow-tests/milestone-scoping.test.mjs` — D-05 worktree-A vs worktree-B milestone view.
- [ ] `tests/install-tests/upstream-version-pin.test.sh` — CI drift detection (D-10).
- [ ] `tests/shadow-tests/bd-allowlist-grep.test.sh` — REQ-QUAL-05 precursor.
- [ ] `tests/fixtures/seed-fixture.sh` — fixture restorer.
- [ ] `tests/fixtures/seed.jsonl` — committed canonical state.
- [ ] `tests/fixtures/build-seed.sh` — source bash script that rebuilds seed.jsonl.
- [ ] `tests/scripts/update-snapshots.mjs` — snapshot regeneration (consumed by Phases 5–9).
- [ ] `bin/beads-errors.mjs` — sentinel hierarchy module.
- [ ] `bin/bd-helper.mjs` — bd() helper module.
- [ ] `scripts/regen-state.sh` — NEW (currently absent from this repo despite CONTEXT.md mentioning commit f8903ca).
- [ ] `gsd-sdk-cc.version.lock` — version pin (1 line: `1.38.5`).
- [ ] Framework install: none — `node --test` is bundled with Node 22.

## Security Domain

> Security gate is enabled by default. Phase 4 introduces minimal new attack surface; the threat model below is mostly inherited from v0.1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (CLI tool, no users) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Filesystem-bound; OS user is the only principal |
| V5 Input Validation | partial | argv parsing already done by upstream's `resolveQueryArgv`; new surface is `BEADS_DIR` env (validated via `existsSync` + `realpathSync`) and `seed.jsonl` (treated as trusted, committed-to-repo data) |
| V6 Cryptography | no | No crypto in Phase 4 |
| V12 File and Resources | partial | `findBeadsRoot` reads `.git` files and walks directories; bounded at filesystem root via while-loop terminator |

### Known Threat Patterns for Node CLI + bd integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `BEADS_DIR=/etc/passwd/..` | Tampering | `realpathSync` canonicalizes; `existsSync(metadata.json)` requires a real `.beads/` dir; non-bd paths fail the gate |
| Symlink loop DoS in `findBeadsRoot` | DoS | `realpathSync` has cycle detection; throws ELOOP; let it propagate or log-and-null |
| Malicious `.git` file (`gitdir: /etc/passwd`) hijacking project root | Tampering | The `gitdir:` path is read but only used to look for `<dirname-up-2>/.beads/metadata.json`; that file must exist and be a valid bd metadata file |
| Test-fixture tempdir collision under parallel tests | Information Disclosure | `mkdtempSync` provides cryptographically random suffix; per-test dirs cannot overlap |
| Subprocess injection via bd argv | Injection | `bd-helper.mjs::bd(args)` takes `args` as an array; `spawnSync('bd', args)` does NOT shell-interpret; no string concatenation |
| Stub handler activated in production | Tampering | Stub is registered conditionally on `process.env.GSD_SHADOW_TEST_STUB === '1'` (Claude's Discretion: alternative is a separate `bin/_test-stub.mjs` import; either way, NOT active by default in installed shadow) — Phase 5 deletes the stub entirely |

**Net new attack surface beyond v0.1 mutations:** None of consequence. Phase 4 introduces parsing of `BEADS_DIR` and `.git` files (both already trusted — env is OS-user-controlled, `.git` is git-controlled). Test fixtures use `mkdtempSync` (Node's secure temp) and run isolated commands. The seeder reads a committed JSONL (trusted at commit time; CI re-runs it from source bash). Snapshot files are committed text — drift detection is exactly the integrity story (D-10).

The planner's threat-model block can simply note: *"Phase 4 inherits v0.1's threat model. New filesystem reads (BEADS_DIR, .git file parsing) are bounded by realpath canonicalization + existsSync validation. No new network, auth, or untrusted-input surface."*

## Sources

### Primary (HIGH confidence)
- `/home/ellio/code/gsd-beads/bin/gsd-sdk-shadow.mjs` (read in full; line 4 D-02 comment, lines 27–200 mutation handlers, line 205 `BEADS_OVERRIDES`, lines 232–246 `isBeadsManaged`/`getProjectDir`, lines 274–279 register loop, lines 297–312 dispatch + try/catch)
- `/home/ellio/code/gsd-beads/bin/wrap-mutation.mjs` (read in full; the 7-prefix mutation event builder — confirms reads must NOT be wrapped)
- `/home/ellio/code/gsd-beads/tests/shadow-tests/argv-routing.test.mjs` (existing `beadsFixture()` / `nonBeadsFixture()` lines 13-22; CASE 6 line 103-121 non-bd passthrough; CASE 9 line 155-167 position-agnostic --project-dir)
- `/home/ellio/code/gsd-beads/tests/shadow-tests/handler-phase-add.test.mjs` (3-case-per-handler model; `try/finally rmSync` lines 32-35)
- `/home/ellio/code/gsd-beads/tests/cross-worktree/lib/setup.sh` (canonical worktree fixture pattern: lines 29-50 `mk_source_repo`, lines 57-60 `mk_worktree`, lines 81-103 `cleanup_sandbox` with WR-07 fix for canonical-path comparison)
- `/home/ellio/code/gsd-beads/tests/cross-worktree/simulation.sh` (the most complex existing fixture; ~90s runtime budget; co-located src+wt under one tempdir)
- `/home/ellio/code/gsd-beads/hooks/block-state-md.sh` (lines 31-33 — the `b51abbc` symmetric guard pattern; project_dir resolution from `CLAUDE_PROJECT_DIR` → payload.cwd → $PWD)
- `/home/ellio/code/gsd-beads/hooks/bd-sync.sh` (lines 22-25 read-only allowlist; lines 66-70 the *opportunistic* regen-state.sh call site from commit f8903ca)
- `/home/ellio/code/gsd-beads/install.sh` (lines 14-21 system pre-flight; line 93 shadow symlink; lines 105-112 memory seeding; lines 137-156 worktree backfill)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/index.js` lines 232-235 (upstream `roadmap.analyze` registered unconditionally — our shadow's second `register()` overwrites)
- `/home/ellio/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/roadmap.js` lines 480-491 (canonical `roadmap.analyze` 10-key data shape)
- `bd v1.0.3 --help` for `init`, `q`, `export`, `backup`, `init --from-jsonl --prefix` (verified live 2026-04-29)
- `node v24.14.0 --version` (Node:test bundled)
- `gsd-sdk-cc v1.38.5` package.json (verified live 2026-04-29)
- Empirical determinism test (verified live 2026-04-29): `bd init --from-jsonl --prefix sd` preserves IDs (`sd-h1d`) and timestamps (`2026-04-29T19:43:13Z`) byte-for-byte across machines.
- `.planning/research/STACK.md` (full bd CLI surface + JSON shapes)
- `.planning/research/ARCHITECTURE.md` (handler signatures + dispatch wiring)
- `.planning/research/PITFALLS.md` (10 hazards; Pitfalls 1, 2, 5, 8, 9 directly inform Phase 4)
- `.planning/research/SUMMARY.md` (milestone synthesis)
- `.claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md` (Y1 design rationale; "DON'T re-wrap reads with wrapMutation" admonition)
- `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md` (worktree topology canonicalized; `BEADS_DIR=<source>/.beads`)

### Secondary (MEDIUM confidence)
- MDN `Error` subclassing pattern (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#extending_error_with_es6) — basis for `BeadsUnavailableError` hierarchy
- Node ESM module identity semantics (https://nodejs.org/api/esm.html#import-and-export-statements) — Pitfall 1 root cause
- Node `fs.realpathSync` docs (https://nodejs.org/api/fs.html#fsrealpathsyncpath-options) — symlink + ELOOP behavior

### Tertiary (LOW confidence — flagged in §Assumptions Log)
- "Co-locating src + wt under one tempdir avoids orphan refs" — verified manually for the no-prune case but NOT verified what happens if the user has set `git worktree.guessRemote = true` or other esoteric git config; assumption is that the gsd-beads test fixtures use minimal git config (`user.email`, `user.name` only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The decision to use `BEADS_DIR` as a single-segment env var (pointing AT `.beads/`) — same convention Phase 3's worktree-post-checkout.sh uses — is the intended semantic. The alternative would be `BEADS_DIR` pointing at the **project root** (the parent of `.beads/`). [ASSUMED] | §Pattern 1 (`findBeadsRoot`) | If wrong, `findBeadsRoot` resolves to `dirname(envDir)` instead of `envDir`; one-line fix in implementation; tests would catch it. **Recommend confirming during plan-phase by reading `hooks/worktree-post-checkout.sh`.** |
| A2 | `bd init --from-jsonl` is the canonical determinism strategy. The CONTEXT.md "Claude's Discretion" item asks whether bd supports `BD_DATE` or fake-time. [VERIFIED — bd v1.0.3 has NO `BD_DATE` env var; live test confirmed timestamps come from system clock. From-JSONL is the only path.] | §Pattern 6 (seeder), §Don't Hand-Roll | None — verified empirically. |
| A3 | The committed `seed.jsonl` is **regenerated** from a `build-seed.sh` source script, NOT hand-edited. This is a convention recommendation, not a locked decision. [ASSUMED — based on Pitfall 7 mitigation rationale.] | §Pattern 6, §Pitfall 7 | If wrong (e.g., team prefers to hand-edit JSONL), merge conflicts on simultaneous Phase 5/6/7 PRs become routine. Low risk; convention can be added retroactively. |
| A4 | The `gsd-sdk-cc.version.lock` is a 1-line plain text file (`1.38.5\n`), NOT a `package-lock.json`. The project has no `package.json` today; introducing one is a separable decision. [ASSUMED — based on Alternatives Considered table reasoning.] | §Standard Stack, §Pitfall 3 | If wrong (team wants `package.json`), Phase 4 needs to also add `package.json` + run `npm install`; affects install.sh; modest scope creep. **Recommend deciding during plan-phase by asking: "do we want gsd-beads to become an installable npm package, or stay a plain bash+JS-modules repo?"** |
| A5 | `regen-state.sh` does NOT exist in this repo today. Commit `f8903ca` only added an *opportunistic* call site in `bd-sync.sh:66-70` — the script itself ships from an upstream project (tstl-sylvanas, per the comment "tstl-sylvanas keeps it"). Phase 4 is **creating** this script in `scripts/regen-state.sh`. [VERIFIED — `find /home/ellio/code/gsd-beads -name regen-state.sh` returns nothing; `git log --all --oneline -- scripts/regen-state.sh` returns nothing.] | §Summary, §Recommended Project Structure | None — verified. |
| A6 | The "worktree-local milestone source" for D-05 is `git config --worktree gsd-beads.milestone <vX.Y>`. The CONTEXT.md leaves this open. [ASSUMED — chosen because Spike 003 + install.sh:152 already use `git config --worktree gsd-beads.dir`; same mechanism with a sibling key is consistent.] | §Architectural Responsibility Map (regen-state.sh row), §Validation Architecture (D-05 row) | If wrong (e.g., a `.beads-milestone` sentinel file is preferred), Phase 4 ships the wrong plumbing; downstream Phases 5–9 inherit the choice. **Recommend confirming during plan-phase before writing `regen-state.sh`.** |
| A7 | The stub handler `_phase4-test-stub` is registered conditionally on an env var (e.g., `GSD_SHADOW_TEST_STUB=1`), so it does NOT appear in production-installed shadows. The alternative (separate `bin/_test-stub.mjs` import) is per CONTEXT.md "Claude's Discretion." [ASSUMED — but plan-phase decides.] | §Architecture Patterns, §Security Domain | If the production shadow always exposes `_phase4-test-stub`, an attacker could probe it (low risk; underscore-prefixed name signals "internal", returns trivial data). **Defer to plan-phase.** |

## Open Questions

1. **`BEADS_DIR` semantic — points AT `.beads/` or AT project root?**
   - What we know: install.sh and the Phase 3 worktree shim set `git config --worktree gsd-beads.dir <path-to-source-.beads>`, AT `.beads/` per `tests/cross-worktree/lib/setup.sh:64-72` (`bd_in_worktree` reads `git config gsd-beads.dir` and uses it as `BEADS_DIR=$source_beads`).
   - What's unclear: That git-config key matches the env-var convention if and only if the env var has the same semantic. Reading `hooks/worktree-post-checkout.sh` (which I haven't read in this session) would confirm.
   - Recommendation: Plan-phase reads `hooks/worktree-post-checkout.sh` first thing and confirms `BEADS_DIR` points AT `.beads/`. If different, fix `findBeadsRoot`'s `dirname()` line.

2. **`regen-state.sh` worktree-local milestone source format**
   - What we know: D-05 says "worktree-local source for current milestone, NOT bd". CONTEXT.md leaves the format open. install.sh already uses `git config --worktree gsd-beads.dir` for the bd-store path — same mechanism would work for a milestone key.
   - What's unclear: Is `git config --worktree gsd-beads.milestone v0.2` the chosen format, or a sentinel file like `.gsd-current-milestone`?
   - Recommendation: Plan-phase makes this decision before scaffolding `regen-state.sh`. Recommend `git config --worktree` for consistency with the bd-store path mechanism.

3. **Snapshot file location: `tests/shadow-tests/snapshots/` vs other?**
   - What we know: D-06 specifies `tests/shadow-tests/snapshots/<cmd>.json`. No conflict with existing layout.
   - What's unclear: Naming convention — is it `roadmap.analyze.json` (literal command) or `roadmap-analyze.json` (kebab)? The existing test files use kebab (`handler-roadmap-analyze.test.mjs`). Snapshot files should match for symmetry.
   - Recommendation: Use kebab. Phase 4 creates the convention with `_phase4-test-stub.json`.

4. **Stub handler's "throw configurable subtype" mechanism**
   - What we know: D-16 says the stub takes a flag/env to throw `BeadsUnavailableError` subtypes. Implementation TBD.
   - What's unclear: env var (`GSD_SHADOW_TEST_STUB_THROW=corrupt`) or argv flag (`--throw=corrupt`)? Env is simpler; argv is more visible in test output.
   - Recommendation: env var — easy to set in `spawnSync({ env: ... })` per test case.

5. **Order: ship findBeadsRoot before or after the error hierarchy?**
   - What we know: They're independent. Either can land first.
   - What's unclear: Recommended task ordering in plan-phase.
   - Recommendation: errors first (no test infra needed), then findBeadsRoot (uses errors? actually D-13 says findBeadsRoot returns null, doesn't throw — so they're independent). Order doesn't matter; parallelize as Wave 1 + Wave 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bd` CLI | Seeder (`bd init --from-jsonl`), all read-handler tests | ✓ | 1.0.3 | None — Phase 4 tests skip if missing (and CI must install bd) |
| Node.js | All Phase 4 code | ✓ | 24.14.0 (≥22 required) | None — install.sh:20 already enforces ≥22 |
| `git` CLI | findBeadsRoot worktree fixture, `worktree add` | ✓ | system | None — install.sh:18 enforces presence |
| `jq` | seeder bash script, `update-snapshots.mjs` (for fixtures) | ✓ | system | None — install.sh:16 enforces |
| `flock` | Existing (regen-roadmap/requirements lock; NOT used by Phase 4 directly) | ✓ | system | install.sh:19 enforces |
| `gsd-sdk-cc` upstream | `update-snapshots.mjs` runs upstream against fixture to generate canonical snapshots | ✓ | 1.38.5 (Volta-installed global) | None — required for snapshot regeneration; but parity tests run against committed snapshots, so dev workflow doesn't need upstream every time |

**Missing dependencies with no fallback:** None — all dependencies present.

**Missing dependencies with fallback:** None — Phase 4 doesn't introduce optional dependencies.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every recommended package version verified live; no new external deps.
- Architecture: HIGH — every line number, function name, and JSON shape verified against `bin/gsd-sdk-shadow.mjs` and upstream `query/index.js` / `query/roadmap.js`.
- Pitfalls: HIGH — Pitfalls 1, 4, 5, 6 are derived from Node/git documentation + empirical tests; Pitfalls 2, 3, 7, 8 are derived from milestone-level PITFALLS.md hazards 1, 5, 8, 9 (already confidence HIGH there).
- Determinism strategy: HIGH — `bd init --from-jsonl` empirically verified to preserve IDs and timestamps byte-for-byte across runs (tested 2026-04-29).
- Validation Architecture: HIGH — every test maps to a phase requirement; framework choice (`node:test`) is the existing convention; sampling rates are bounded by per-fixture setup time (~1s).
- Open questions: 5 items, all are genuine plan-phase decisions, not research gaps.

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days for stable Node + bd; sooner if upstream `gsd-sdk-cc` ships v1.39+ which may change shape contracts)
