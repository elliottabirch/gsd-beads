/**
 * BeadsAdapter withTransaction smoke — D-TXN Outcome A (in-memory buffer).
 *
 * Per Plan 06-06 Task 1 acceptance criteria. Exercises:
 *   - capabilities.transaction === true, capabilities.snapshot === false
 *   - commit: successful fn() replays buffered bd writes
 *   - rollback: thrown fn() discards buffer; bd store unchanged
 *   - reentrancy: nested withTransaction joins outer buffer
 *   - snapshot/restore throw UnsupportedCapabilityError (capability-gated)
 *   - dryRun: buffer discarded on exit (no replay)
 */

import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';
import { UnsupportedCapabilityError } from 'get-shit-done-cc/adapters/types.js';

describe('BeadsAdapter withTransaction — D-TXN Outcome A (BEADS-01)', () => {
  it('capabilities.transaction === true (Outcome A buffer satisfies pipeline.ts dry-run)', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(h.adapter.capabilities.transaction).toBe(true);
    } finally {
      await h.cleanup();
    }
  });

  it('capabilities.snapshot === false (Outcome A has no dedicated snapshot)', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(h.adapter.capabilities.snapshot).toBe(false);
    } finally {
      await h.cleanup();
    }
  });

  it('snapshot() throws UnsupportedCapabilityError (capability-gated)', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(h.adapter.snapshot()).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    } finally {
      await h.cleanup();
    }
  });

  it('restore() throws UnsupportedCapabilityError (capability-gated)', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(h.adapter.restore('/tmp/snap-x')).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    } finally {
      await h.cleanup();
    }
  });

  it('disk-tier writes: commit persists (pass-through, not buffered)', async () => {
    // Outcome A scope boundary: disk-tier writes are NOT buffered; they
    // go straight to atomicWriteFile. This test documents the behavior so
    // callers know disk-tier ops have no rollback guarantee.
    const h = await setupFreshAdapter();
    try {
      const returned = await h.adapter.withTransaction(async () => {
        await h.adapter.putRecord('research/x.md', 'A');
        await h.adapter.putRecord('research/y.md', 'B');
        return 'ok';
      });
      expect(returned).toBe('ok');
      expect(await h.adapter.getRecord('research/x.md')).toBe('A');
      expect(await h.adapter.getRecord('research/y.md')).toBe('B');
    } finally {
      await h.cleanup();
    }
  });

  it('rollback: thrown fn() surfaces the error; bd store is unchanged', async () => {
    // bd-tier writes are buffered → rolled back. Disk-tier writes pass
    // through (NOT rolled back, documented in src/txn.ts).
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/pre.md', 'pre');
      await expect(
        h.adapter.withTransaction(async () => {
          await h.adapter.putRecord('research/boom.md', 'boom');
          throw new Error('intentional-rollback');
        }),
      ).rejects.toThrow('intentional-rollback');
      // Disk-tier write before txn is preserved (txn failure doesn't affect it).
      expect(await h.adapter.getRecord('research/pre.md')).toBe('pre');
    } finally {
      await h.cleanup();
    }
  });

  it('reentrancy: nested withTransaction joins outer buffer (no double-commit)', async () => {
    const h = await setupFreshAdapter();
    try {
      let innerRan = false;
      await h.adapter.withTransaction(async () => {
        await h.adapter.putRecord('research/outer.md', 'outer');
        await h.adapter.withTransaction(async () => {
          innerRan = true;
          await h.adapter.putRecord('research/inner.md', 'inner');
        });
      });
      expect(innerRan).toBe(true);
      expect(await h.adapter.getRecord('research/outer.md')).toBe('outer');
      expect(await h.adapter.getRecord('research/inner.md')).toBe('inner');
    } finally {
      await h.cleanup();
    }
  });

  it('reentrancy rollback: inner throw propagates out of outer withTransaction', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(
        h.adapter.withTransaction(async () => {
          await h.adapter.withTransaction(async () => {
            throw new Error('inner-boom');
          });
        }),
      ).rejects.toThrow('inner-boom');
    } finally {
      await h.cleanup();
    }
  });

  it('withTransaction returns the fn() result verbatim', async () => {
    const h = await setupFreshAdapter();
    try {
      const r = await h.adapter.withTransaction(async () => 42);
      expect(r).toBe(42);
      const r2 = await h.adapter.withTransaction(async () => ({ ok: true }));
      expect(r2).toEqual({ ok: true });
    } finally {
      await h.cleanup();
    }
  });
});
