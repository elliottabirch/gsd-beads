# Deferred Items — Phase 02 (gsd-beads layer)

Out-of-scope items discovered during plan 02-07 execution. These are NOT
caused by 02-07 changes and are not in scope for this gap-closure plan.

## Pre-existing test failures (unrelated to 02-07 path-substitution / awk fixes)

### tests/install-tests/idempotency.test.sh CASE 4 + memory-seeding.test.sh CASE 8

- **Symptom:** Both: `expected 7 gsd-beads:* memories, got 8`
- **Pre-existing:** Verified by stashing 02-07 changes and re-running on
  baseline `e5aeadf` — same FAIL on both suites.
- **Likely cause:** The tests run against the dev machine's real bd
  memory store; one stray seed (likely `gsd-beads:tasks-summary` from an
  older install or experiment, or a manually-added key) is left over.
  Both tests count `gsd-beads:*` keys via `bd memories | grep` and the
  count drifts when the dev host accumulates extra keys.
- **Why deferred:** Out of scope for plan 02-07 (which only touches path
  substitution + awk capitalization). The idempotency contract these
  cases assert is still upheld — the count is stable across two
  consecutive install.sh runs (just stable at 8, not 7, because a stale
  key exists in the host store).
- **Suggested fix (later plan):** Sandbox $HOME / bd store in CASE 4 of
  idempotency.test.sh and CASE 8 of memory-seeding.test.sh the way our
  new settings-merge CASE 6 sandboxes $HOME, so the count is
  deterministic regardless of dev-host bd-store state.
