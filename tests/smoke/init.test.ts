/**
 * BEADS-04 smoke: _ensureBd probe throws BdManagedMismatchError on non-bd
 * dirs + succeeds on bd-managed dirs. 4 topology cases.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { BeadsAdapter } from '../../src/index.js';
import { BdManagedMismatchError } from '../../src/bd/errors.js';
import { setupFreshAdapter, setupNonBdDir } from '../fixture.js';

describe('BeadsAdapter.init / _ensureBd (BEADS-04)', () => {
  it('bd-managed dir: first bd-using method call succeeds', async () => {
    const h = await setupFreshAdapter();
    try {
      // exists() is cheap + bd-tier for ROADMAP.md
      await expect(h.adapter.exists('ROADMAP.md')).resolves.not.toThrow();
    } finally {
      await h.cleanup();
    }
  });

  it('non-bd dir: bd-tier method throws BdManagedMismatchError with code PROJECT_BD_MANAGED_MISMATCH', async () => {
    const h = await setupNonBdDir();
    try {
      const adapter = new BeadsAdapter(h.projectDir);
      await expect(adapter.getRecord('ROADMAP.md')).rejects.toSatisfy((e: unknown) => {
        return (
          e instanceof BdManagedMismatchError &&
          (e as BdManagedMismatchError).code === 'PROJECT_BD_MANAGED_MISMATCH' &&
          (e as BdManagedMismatchError).projectDir === h.projectDir &&
          typeof (e as BdManagedMismatchError).hint === 'string' &&
          (e as BdManagedMismatchError).hint.length > 0
        );
      });
    } finally {
      await h.cleanup();
    }
  });

  it('BEADS_DIR env override: uses env-specified path', async () => {
    const h = await setupFreshAdapter();
    try {
      process.env.BEADS_DIR = join(h.projectDir, '.beads');
      const adapter = new BeadsAdapter(h.projectDir);
      await expect(adapter.exists('ROADMAP.md')).resolves.not.toThrow();
    } finally {
      delete process.env.BEADS_DIR;
      await h.cleanup();
    }
  });

  // Disk-tier-skip-probe coverage lives in tests/smoke/record-primitives.test.ts
  // (Task 3) once exists() is wired. BEADS-04 contract only covers the
  // init-probe behaviour on bd-tier methods.
});
