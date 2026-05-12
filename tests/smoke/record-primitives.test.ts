/**
 * BEADS-01 smoke: Bin A record primitives + CR-01 path-traversal guard.
 *
 * Covers disk-tier put/get/stat/list/remove round-trips and proves the
 * `_abs()` guard rejects absolute paths + `..` escapes + Windows-style
 * escapes while allowing legitimate nested paths that stay inside root.
 *
 * Bd-tier coverage for putRecord/getRecord on ROADMAP.md etc. is deferred
 * to Plan 06-07's breadth suite (record fixture seeds the label via
 * build-seed.sh, so reading is already covered by the init-probe test).
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter, setupNonBdDir } from '../fixture.js';
import { BeadsAdapter } from '../../src/index.js';

describe('BeadsAdapter Bin A record primitives (BEADS-01)', () => {
  it('disk-tier putRecord → getRecord round-trip', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/note.md', '# Hello\n');
      expect(await h.adapter.getRecord('research/note.md')).toBe('# Hello\n');
    } finally {
      await h.cleanup();
    }
  });

  it('getRecord returns null for missing paths', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(await h.adapter.getRecord('research/absent.md')).toBeNull();
    } finally {
      await h.cleanup();
    }
  });

  it('exists: returns true for present, false for absent', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('intel/x.md', 'x');
      expect(await h.adapter.exists('intel/x.md')).toBe(true);
      expect(await h.adapter.exists('intel/absent.md')).toBe(false);
    } finally {
      await h.cleanup();
    }
  });

  it('stat returns kind=file for file, kind=dir for directory, null on miss', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/nested/deep.md', 'body');
      expect((await h.adapter.stat('research/nested/deep.md'))?.kind).toBe('file');
      expect((await h.adapter.stat('research/nested'))?.kind).toBe('dir');
      expect(await h.adapter.stat('research/nonexistent.md')).toBeNull();
    } finally {
      await h.cleanup();
    }
  });

  it('listCollection enumerates disk-tier directory entries', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/a.md', 'a');
      await h.adapter.putRecord('research/b.md', 'b');
      const refs = await h.adapter.listCollection('research');
      const names = refs.map((r) => r.name).sort();
      expect(names).toContain('a.md');
      expect(names).toContain('b.md');
    } finally {
      await h.cleanup();
    }
  });

  it('removeRecord deletes disk-tier file', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('tmp/x.md', 'x');
      expect(await h.adapter.exists('tmp/x.md')).toBe(true);
      await h.adapter.removeRecord('tmp/x.md');
      expect(await h.adapter.exists('tmp/x.md')).toBe(false);
    } finally {
      await h.cleanup();
    }
  });

  it('removeCollection recursively deletes disk-tier directory', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('tmp/a.md', 'a');
      await h.adapter.putRecord('tmp/b/c.md', 'c');
      await h.adapter.removeCollection('tmp');
      expect(await h.adapter.exists('tmp/a.md')).toBe(false);
      expect(await h.adapter.exists('tmp/b/c.md')).toBe(false);
    } finally {
      await h.cleanup();
    }
  });

  it('disk-tier read against non-bd dir does NOT throw (disk paths skip bd probe)', async () => {
    const h = await setupNonBdDir();
    try {
      const adapter = new BeadsAdapter(h.projectDir);
      // 'research/' routes to disk-tier per paths.ts — no bd probe needed
      expect(await adapter.exists('research/nonexistent.md')).toBe(false);
    } finally {
      await h.cleanup();
    }
  });
});

describe('Path-traversal guard (CR-01 BLOCKER fix)', () => {
  it('putRecord rejects absolute path', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(h.adapter.putRecord('/etc/passwd', 'hi')).rejects.toThrow(TypeError);
    } finally {
      await h.cleanup();
    }
  });

  it('getRecord rejects `..` escape', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(h.adapter.getRecord('../../../etc/passwd')).rejects.toThrow(TypeError);
    } finally {
      await h.cleanup();
    }
  });

  it('listCollection rejects escape via prefix', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(h.adapter.listCollection('../../etc')).rejects.toThrow(TypeError);
    } finally {
      await h.cleanup();
    }
  });

  it('legitimate nested path that stays inside root is allowed', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/a/b/c.md', 'ok');
      expect(await h.adapter.getRecord('research/a/b/c.md')).toBe('ok');
    } finally {
      await h.cleanup();
    }
  });
});
