import { defineConfig } from 'vitest/config';

/**
 * BeadsAdapter vitest config.
 *
 * bd spawns serialize on `.beads/` dolt exclusive write-lock. Running
 * parallel workers against a shared store causes dolt deadlocks.
 * Force single-fork execution per project root.
 *
 * Test timeout = 30s (Plan 06-06 deviation — Rule 1 bug fix).
 * Historical 10s was workable on the 33-test Plan 06-05 baseline; the
 * 38 tests added by Plan 06-06 (9 transaction + 18 state-events +
 * 8 dep-graph + 3 commit-planning-state) push total wall-clock on the
 * single-fork sweep high enough that concurrent-file execution within
 * the fork can starve individual tests past the 10s ceiling even though
 * raw bd-spawn work would fit. Per-test overrides are used on known
 * long-chain tests (mutation round-trip, signal round-trip); the 30s
 * default covers the remainder.
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
    testTimeout: 30_000,
  },
});
