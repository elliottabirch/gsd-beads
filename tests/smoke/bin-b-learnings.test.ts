/**
 * Bin B smoke — learnings category (SC#3, BEADS-02).
 *
 * The full `writeLearnings` SDK helper (milestone-level learnings
 * aggregation) lives in the fork — out of Phase 6 scope per CONTEXT.md
 * exclusions. This smoke proves the putNamedDoc dispatch for the
 * learnings-adjacent category works, which is the only BEADS-side
 * requirement.
 *
 * NamedDocCategory mapping: the fork's closed union does not include
 * 'learnings'. `reports` is the closest semantic match for milestone
 * learnings summaries (post-phase distillation artifacts) and is used
 * below as the stand-in. If a future fork revision adds a literal
 * 'learnings' category, swap the first argument.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('learnings category smoke (SC#3 — BEADS-02)', () => {
  it('putNamedDoc + getNamedDoc round-trip (category: reports as learnings stand-in)', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc(
        'reports',
        'learnings-v1.md',
        '# Learnings — v1.0\n\n- Landmine 4: use --author\n- Landmine 9: chmod 0o700\n',
      );
      const back = await h.adapter.getNamedDoc('reports', 'learnings-v1.md');
      expect(back).not.toBeNull();
      expect(back).toContain('Landmine 4');
      expect(back).toContain('Landmine 9');
    } finally {
      await h.cleanup();
    }
  });

  it('putNamedDoc creates intermediate directories for nested learnings keys', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc(
        'reports',
        'nested/deep/learnings.md',
        'deep body',
      );
      expect(
        await h.adapter.getNamedDoc('reports', 'nested/deep/learnings.md'),
      ).toBe('deep body');
    } finally {
      await h.cleanup();
    }
  });
});
