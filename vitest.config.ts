import { defineConfig } from 'vitest/config';

/**
 * BeadsAdapter vitest config.
 *
 * bd spawns serialize on `.beads/` dolt exclusive write-lock. Running
 * parallel workers against a shared store causes dolt deadlocks.
 * Force single-fork execution per project root.
 *
 * Test timeout = 10s — bd cold-start is 400-700ms; several spawns per
 * test is normal; tight budgets would make CI flaky.
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
    testTimeout: 10_000,
  },
});
