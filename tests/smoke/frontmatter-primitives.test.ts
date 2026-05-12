/**
 * BEADS-01 smoke: getFrontmatter / updateFrontmatter / mergeFrontmatter over
 * disk-tier. Frontmatter parsing uses js-yaml@4.1.1 per Plan 06-04 escalation.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter frontmatter primitives (BEADS-01)', () => {
  it('getFrontmatter returns the full map when field arg is omitted', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '---\nphase: "06"\nstatus: active\n---\n# Body\n',
      );
      const fm = await h.adapter.getFrontmatter('research/x.md');
      expect(fm).toMatchObject({ phase: '06', status: 'active' });
    } finally {
      await h.cleanup();
    }
  });

  it('getFrontmatter returns a single field when field arg is supplied', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '---\nphase: "06"\n---\n# Body\n',
      );
      expect(await h.adapter.getFrontmatter('research/x.md', 'phase')).toBe('06');
    } finally {
      await h.cleanup();
    }
  });

  it('updateFrontmatter sets a field', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '---\nphase: "06"\n---\n# Body\n',
      );
      await h.adapter.updateFrontmatter('research/x.md', 'status', 'active');
      expect(await h.adapter.getFrontmatter('research/x.md', 'status')).toBe('active');
    } finally {
      await h.cleanup();
    }
  });

  it('mergeFrontmatter merges patch over base', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord(
        'research/x.md',
        '---\na: 1\nb: 2\n---\n# Body\n',
      );
      await h.adapter.mergeFrontmatter('research/x.md', { b: 20, c: 30 });
      const fm = (await h.adapter.getFrontmatter('research/x.md')) as Record<string, unknown>;
      expect(fm.a).toBeDefined();
      expect(fm.b).toBe(20);
      expect(fm.c).toBe(30);
    } finally {
      await h.cleanup();
    }
  });
});
