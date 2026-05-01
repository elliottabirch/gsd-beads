# Deferred items — Phase 07

## Discovered during Plan 07-06

### bd helper cwd not respected at call sites (Plans 04/05 affected)

**Discovered:** Plan 06 Task 2 GREEN, while implementing recordStateEvent
+ smoke tests against a freshBdFixture.

**Issue:** Every bd-routed call site in `src/adapter/primitives.mjs`
invokes the `bd()` helper without passing `cwd: this._beadsRoot`. The
helper at `src/bd/helper.mjs:22` defaults `cwd` to undefined, which
means `spawnSync('bd', args, { encoding: 'utf-8' })` uses
`process.cwd()` and bd auto-discovers `.beads/` by walking up from
there.

This is incorrect when:
- The caller is running from a different CWD than the BeadsAdapter's
  projectRoot (e.g., a test harness, a CLI wrapper, a CI runner).
- Multiple BeadsAdapter instances exist for different projects in the
  same node process.

In the development environment this hasn't surfaced because:
- The dev / CI process always runs from gsd-beads' own root, which has
  its own `.beads/`.
- Plan 04+05 smoke tests only exercise disk-routed paths.
- Plan 07-06's smoke tests are the first to exercise bd-write paths
  with a freshBdFixture that has its own `.beads/` apart from
  process.cwd().

**Fix in Plan 06 (in scope):** `recordStateEvent` and
`_resolveMilestoneBead` were updated to pass `cwd: this._beadsRoot` to
the bd() helper.

**Affected sites (out of scope for Plan 06 — Rule 1 scope boundary):**
- `getRecord` bd-routed path (Plan 04)
- `listCollection` bd-routed path (Plan 04)
- `exists` bd-routed path (Plan 04)
- `getSection` / `updateSection` bd-routed paths (Plan 05) — incl. the
  `bd update --description` write
- `getFrontmatter` bd-routed path (Plan 05)
- `updateFrontmatter` bd-routed path (Plan 05) — incl. `bd label remove`
  + `bd label add`

**Recommended fix:** Either (a) audit and add `cwd: this._beadsRoot` to
every bd() call site in `src/adapter/primitives.mjs`, or (b) refactor
the bd() helper to accept an adapter context and inject cwd uniformly.

**Risk if left as-is:** Wave 5 conformance (Plan 08) running against a
seed fixture from a non-fixture CWD will exercise the bd-routed
branches; the silent-wrong-database failure mode my smoke test caught
is the same failure mode that will hit conformance for the read paths.

### bd() helper signature: env option not forwarded to spawnSync

**Discovered:** Plan 06 Task 2 (already documented in Plan 05 SUMMARY,
re-noted here for visibility).

**Issue:** `src/adapter/primitives.mjs` call sites pass
`env: { ...process.env, BEADS_ACTOR: 'seed' }` to bd(), but
`src/bd/helper.mjs:22` only destructures `{ cwd, parseJson }` from opts
and does not pass `env` to spawnSync. So BEADS_ACTOR is never actually
forwarded to bd; bd falls back to its own default (git user.name / $USER
per --actor docs).

**Effect:** D-20 / determinism contract is documented at the call sites
but not enforced. JSONL byte-identity is preserved for now because all
test BEADS_ACTOR provenance flows from the test harness `env:` parameter
on its own spawnSync calls, not via this code path.

**Recommended fix:** Update `bd()` helper to destructure and forward
`env`. Single-line change.

**Risk if left as-is:** Conformance plans will need to set
`BEADS_ACTOR=seed` at the test process level; can't rely on adapter
internals to set it per-call.
