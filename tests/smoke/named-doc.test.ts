/**
 * BEADS-01 smoke: putNamedDoc / getNamedDoc round-trips across the
 * NamedDocCategory union + the 'root' discriminator (HANDOFF etc.).
 *
 * Named-docs are disk-tier per CR-02 resolution (Plan 06-04). The bd-memory
 * index write path is deferred to Plan 06-07 breadth scope.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter named-doc primitives (BEADS-01; CR-02 resolution)', () => {
  it("putNamedDoc + getNamedDoc round-trip (category='research')", async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc('research', 'note.md', 'body');
      expect(await h.adapter.getNamedDoc('research', 'note.md')).toBe('body');
    } finally {
      await h.cleanup();
    }
  });

  it("putNamedDoc + getNamedDoc round-trip (category='root', key='HANDOFF')", async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc('root', 'HANDOFF', '{"ok":true}');
      expect(await h.adapter.getNamedDoc('root', 'HANDOFF')).toBe('{"ok":true}');
    } finally {
      await h.cleanup();
    }
  });

  it('getNamedDoc returns null for absent keys', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(await h.adapter.getNamedDoc('intel', 'absent.md')).toBeNull();
    } finally {
      await h.cleanup();
    }
  });

  it('putNamedDoc respects workstream opt (nested subdir)', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putNamedDoc('intel', 'note.md', 'hello', { workstream: 'ws-a' });
      expect(
        await h.adapter.getNamedDoc('intel', 'note.md', { workstream: 'ws-a' }),
      ).toBe('hello');
    } finally {
      await h.cleanup();
    }
  });
});
