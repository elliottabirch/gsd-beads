/**
 * recordStateSignal — BEADS-02 smoke.
 *
 * Exercises 2 SignalEvent types × applied:true / applied:false matrix.
 *
 * Dispatch under D-MAPPING Outcome A:
 *   - waiting: label add `gsd:waiting:<waitType>` on milestone bead
 *   - resume:  label remove all `gsd:waiting:*` labels on milestone bead
 */

import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter.recordStateSignal — D-MAPPING Outcome A (BEADS-02)', () => {
  it("waiting then resume round-trip", async () => {
    const h = await setupFreshAdapter();
    try {
      const w = await h.adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'human', question: 'confirm?' },
      });
      expect(w).toEqual({ applied: true });

      const r = await h.adapter.recordStateSignal({
        type: 'resume',
        payload: {},
      });
      expect(r).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });

  it("duplicate waiting signal → applied:false:duplicate", async () => {
    const h = await setupFreshAdapter();
    try {
      const first = await h.adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'human' },
      });
      expect(first).toEqual({ applied: true });
      const dup = await h.adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'human' },
      });
      expect(dup).toEqual({ applied: false, reason: 'duplicate' });
    } finally {
      await h.cleanup();
    }
  });

  it("resume without prior waiting → nothing_to_remove", async () => {
    const h = await setupFreshAdapter();
    try {
      const r = await h.adapter.recordStateSignal({
        type: 'resume',
        payload: {},
      });
      expect(r).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  });

  // Longer timeout: 4 sequential signals × multiple bd spawns each
  // (list milestone + show + label update). bd cold-start pushes past 10s.
  it("distinct waitTypes are distinct signals (not duplicates)", async () => {
    const h = await setupFreshAdapter();
    try {
      const human = await h.adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'human' },
      });
      expect(human).toEqual({ applied: true });
      const model = await h.adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'model' },
      });
      expect(model).toEqual({ applied: true });
      // Resume removes BOTH waiting labels in one shot.
      const r = await h.adapter.recordStateSignal({ type: 'resume', payload: {} });
      expect(r).toEqual({ applied: true });
      // Second resume → nothing_to_remove.
      const r2 = await h.adapter.recordStateSignal({ type: 'resume', payload: {} });
      expect(r2).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  }, 60_000);
});
