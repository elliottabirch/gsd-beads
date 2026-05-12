/**
 * Bin B smoke — debug category (SC#3, BEADS-02).
 *
 * NamedDocCategory mapping: 'debug-knowledge-base' (sibling-era) is NOT
 * in the fork's closed union. Fork categories per adapters/types.ts:
 *   'research' | 'intel' | 'codebase' | 'archived-milestone' | 'reports'
 *   | 'sketches' | 'tmp' | 'root'.
 *
 * `reports` is the closest semantic match for debug-session output (post-
 * mortem / investigation artifacts) and is used below as the stand-in.
 * If a future fork revision adds a literal 'debug' category, swap the
 * first argument to `putNamedDoc`; no other change needed — the smoke
 * shape matches the putNamedDoc/getNamedDoc contract, not the category
 * name.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('debug category smoke (SC#3 — BEADS-02)', () => {
  it('putNamedDoc + getNamedDoc round-trip (category: reports as debug stand-in)', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc(
        'reports',
        'debug-session-2026-05-11.md',
        '# Debug session\n\nFindings: X.\n',
      );
      expect(
        await h.adapter.getNamedDoc('reports', 'debug-session-2026-05-11.md'),
      ).toBe('# Debug session\n\nFindings: X.\n');
    } finally {
      await h.cleanup();
    }
  });

  it('putNamedDoc overwrite replaces prior debug doc body', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc('reports', 'dbg.md', 'old');
      await h.adapter.putNamedDoc('reports', 'dbg.md', 'new');
      expect(await h.adapter.getNamedDoc('reports', 'dbg.md')).toBe('new');
    } finally {
      await h.cleanup();
    }
  });

  it('getNamedDoc returns null for missing debug doc key', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(
        await h.adapter.getNamedDoc('reports', 'never-written-debug.md'),
      ).toBeNull();
    } finally {
      await h.cleanup();
    }
  });
});
