import { defineConfig } from 'vitest/config';

/**
 * BeadsAdapter vitest config.
 *
 * bd spawns serialize on `.beads/` dolt exclusive write-lock. Running
 * parallel workers against a shared store causes dolt deadlocks.
 * Force single-fork execution per project root.
 *
 * Test timeout = 60s (Plan 06-07 deviation — Rule 1 bug fix).
 * Historical 10s was workable on the 33-test Plan 06-05 baseline; Plan
 * 06-06 raised to 30s for the 38 tests it added. Plan 06-07 adds 24
 * Bin-B category smokes (BEADS-02 SC#3 coverage), pushing the
 * single-fork sweep total past 110s. Per-test overrides in
 * state-events-mutation + state-events-signal (30_000ms) that fit
 * comfortably under Plan 06-06 load now occasionally exceed their
 * ceiling under the combined 95-test sweep (dolt-lock contention
 * timing varies by chmod/fs-sync jitter). Lift the default to 60s;
 * long-chain per-test overrides inherit the higher ceiling.
 */
export default defineConfig({
  test: {
    name: 'gsd-beads',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    // Vitest 4 migrated per-pool options to top-level. Single-process
    // execution is required because bd spawns serialize on `.beads/`
    // dolt exclusive write-lock.
    pool: 'forks',
    singleFork: true,
    testTimeout: 60_000,
    // Hook timeout lifted from default 10s to 60s — fork-side conformance
    // harness runs `mkdtemp + mkdir .planning + adapterFactory(dir)` in
    // beforeEach, and the BeadsAdapter factory does a full git init +
    // bd init --from-jsonl spawn sequence. Under combined-suite cumulative
    // fs load (95 smoke tests preceding 5 conformance tests in
    // `npm test`), `bd init` occasionally exceeds the default 10s on
    // saturated disks. Standalone conformance runs complete in ~13s
    // total (2-3s per test including setup), so 60s is generous.
    hookTimeout: 60_000,
  },
});
