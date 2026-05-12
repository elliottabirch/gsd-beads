/**
 * recordStateMutation — BEADS-02 smoke.
 *
 * Exercises 4 MutationEvent types × applied:true / applied:false:duplicate /
 * applied:false:nothing_to_remove matrix.
 *
 * Dispatch under D-MAPPING Outcome A:
 *   - blocker_added / blocker_resolved: label add/remove (gsd:blocker:<hash>)
 *   - todo_count_update: bd remember --key <milestone>:todo_count:current
 *   - deferred_items:add/remove: bd remember / bd forget on <milestone>:deferred_items:list
 */

import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter.recordStateMutation — D-MAPPING Outcome A (BEADS-02)', () => {
  // Longer timeout: 4 sequential mutations × ~4-6 bd spawns each +
  // setupFreshAdapter's bd init (~440ms). bd cold-start + dolt lock
  // serialization push this past the 10s default on first-run machines.
  it("blocker_added + blocker_resolved round-trip", async () => {
    const h = await setupFreshAdapter();
    try {
      const add = await h.adapter.recordStateMutation({
        type: 'blocker_added',
        payload: { text: 'Test blocker' },
      });
      expect(add).toEqual({ applied: true });

      // Same blocker again → duplicate.
      const dup = await h.adapter.recordStateMutation({
        type: 'blocker_added',
        payload: { text: 'Test blocker' },
      });
      expect(dup).toEqual({ applied: false, reason: 'duplicate' });

      // Resolve → applied:true.
      const resolved = await h.adapter.recordStateMutation({
        type: 'blocker_resolved',
        payload: { text: 'Test blocker' },
      });
      expect(resolved).toEqual({ applied: true });

      // Resolve a second time → nothing_to_remove.
      const noop = await h.adapter.recordStateMutation({
        type: 'blocker_resolved',
        payload: { text: 'Test blocker' },
      });
      expect(noop).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  }, 60_000);

  it("blocker_resolved before blocker_added → nothing_to_remove", async () => {
    const h = await setupFreshAdapter();
    try {
      const r = await h.adapter.recordStateMutation({
        type: 'blocker_resolved',
        payload: { text: 'Ghost blocker' },
      });
      expect(r).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  });

  it("todo_count_update: applied:true then duplicate on same count", async () => {
    const h = await setupFreshAdapter();
    try {
      const first = await h.adapter.recordStateMutation({
        type: 'todo_count_update',
        payload: { count: 5 },
      });
      expect(first).toEqual({ applied: true });
      const same = await h.adapter.recordStateMutation({
        type: 'todo_count_update',
        payload: { count: 5 },
      });
      expect(same).toEqual({ applied: false, reason: 'duplicate' });
      const changed = await h.adapter.recordStateMutation({
        type: 'todo_count_update',
        payload: { count: 7 },
      });
      expect(changed).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });

  it("deferred_items:add then duplicate:add of same items", async () => {
    const h = await setupFreshAdapter();
    try {
      const first = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['item-A', 'item-B'], action: 'add' },
      });
      expect(first).toEqual({ applied: true });
      const same = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['item-A', 'item-B'], action: 'add' },
      });
      expect(same).toEqual({ applied: false, reason: 'duplicate' });
      // Adding a new item → applied:true
      const added = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['item-C'], action: 'add' },
      });
      expect(added).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });

  it("deferred_items:remove of missing item → nothing_to_remove", async () => {
    const h = await setupFreshAdapter();
    try {
      const r = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['never-added'], action: 'remove' },
      });
      expect(r).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  });

  it("deferred_items:remove removes an added item", async () => {
    const h = await setupFreshAdapter();
    try {
      const added = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['x', 'y'], action: 'add' },
      });
      expect(added).toEqual({ applied: true });
      const removed = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['x'], action: 'remove' },
      });
      expect(removed).toEqual({ applied: true });
      // Second remove of same item → nothing_to_remove.
      const noop = await h.adapter.recordStateMutation({
        type: 'deferred_items',
        payload: { items: ['x'], action: 'remove' },
      });
      expect(noop).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  });
});
