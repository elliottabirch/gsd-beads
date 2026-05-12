/**
 * BEADS-01 smoke: getSection / updateSection over disk-tier.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter section primitives (BEADS-01)', () => {
  it('getSection returns the body text under a matching heading', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '## Intro\nbody line\n## Next\nother\n',
      );
      const body = await h.adapter.getSection('research/x.md', 'intro');
      expect(body).toContain('body line');
    } finally {
      await h.cleanup();
    }
  });

  it('updateSection overwrite replaces the matched section body', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '## Intro\nold\n## Next\nkeep\n',
      );
      await h.adapter.updateSection('research/x.md', 'intro', 'new', 'overwrite');
      const after = await h.adapter.getRecord('research/x.md');
      expect(after).toContain('new');
      expect(after).not.toContain('old');
    } finally {
      await h.cleanup();
    }
  });

  it('updateSection append adds body after existing', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '## Intro\nold\n## Next\nkeep\n',
      );
      await h.adapter.updateSection('research/x.md', 'intro', 'more', 'append');
      const after = await h.adapter.getRecord('research/x.md');
      expect(after).toMatch(/old[\s\S]*more/);
    } finally {
      await h.cleanup();
    }
  });
});
