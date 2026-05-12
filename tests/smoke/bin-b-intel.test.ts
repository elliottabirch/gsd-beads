/**
 * Bin B smoke — intel category (SC#3, BEADS-02).
 *
 * `intel` is a first-class NamedDocCategory in the fork's closed union.
 * This smoke exercises putNamedDoc/getNamedDoc round-trip + null-on-miss
 * + workstream opt nesting.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('intel category smoke (SC#3 — BEADS-02)', () => {
  it('putNamedDoc + getNamedDoc round-trip (category: intel)', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc(
        'intel',
        'bd-cli-quirks.md',
        '# Intel: bd quirks\n\n- Landmine 4: --author, not --label\n',
      );
      expect(await h.adapter.getNamedDoc('intel', 'bd-cli-quirks.md')).toBe(
        '# Intel: bd quirks\n\n- Landmine 4: --author, not --label\n',
      );
    } finally {
      await h.cleanup();
    }
  });

  it('getNamedDoc returns null on miss', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(
        await h.adapter.getNamedDoc('intel', 'never-written.md'),
      ).toBeNull();
    } finally {
      await h.cleanup();
    }
  });

  it('putNamedDoc respects workstream opt (nested under intel/<ws>/<key>)', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc('intel', 'note.md', 'body', {
        workstream: 'phase-6',
      });
      expect(
        await h.adapter.getNamedDoc('intel', 'note.md', {
          workstream: 'phase-6',
        }),
      ).toBe('body');
    } finally {
      await h.cleanup();
    }
  });
});
