/**
 * commitPlanningState smoke — OQ-01 resolution.
 *
 * Per DECISIONS.md D-2026-05-12-OQ01-BEADS: BeadsAdapter's
 * `commitPlanningState` is a NOOP. bd's own SQLite+JSONL store provides
 * per-write atomicity; there is no git-equivalent commit operation from
 * an adapter perspective. Checkpoint semantics live in `withTransaction`
 * (atomic commit/rollback across multiple writes).
 *
 * Validates:
 *   - the method returns without throwing
 *   - it does NOT mutate bd state (no side-effects)
 *   - it does NOT mutate disk state (no side-effects)
 */

import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter.commitPlanningState — OQ-01 noop (D-2026-05-12-OQ01-BEADS)', () => {
  it('resolves without throwing', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(h.adapter.commitPlanningState('test message')).resolves.toBeUndefined();
      await expect(
        h.adapter.commitPlanningState('test message', ['a.md', 'b.md']),
      ).resolves.toBeUndefined();
    } finally {
      await h.cleanup();
    }
  });

  it('does NOT mutate disk state (noop contract)', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/x.md', 'before');
      await h.adapter.commitPlanningState('checkpoint', ['research/x.md']);
      // Disk content unchanged.
      expect(await h.adapter.getRecord('research/x.md')).toBe('before');
    } finally {
      await h.cleanup();
    }
  });

  it('does NOT mutate bd state (noop contract)', async () => {
    const h = await setupFreshAdapter();
    try {
      // Snapshot the dep-graph before + after — noop must leave it unchanged.
      const before = await h.adapter.getRecord('graphs/graph.json');
      await h.adapter.commitPlanningState('checkpoint');
      const after = await h.adapter.getRecord('graphs/graph.json');
      expect(after).toBe(before);
    } finally {
      await h.cleanup();
    }
  });
});
