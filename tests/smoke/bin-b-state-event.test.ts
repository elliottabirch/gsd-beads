/**
 * Bin B smoke — state-event category (SC#3, BEADS-02).
 *
 * Exercises all 3 recordState* families in one coherent cross-family
 * workflow (append a decision → flag a blocker → signal waiting → signal
 * resume → resolve the blocker). Distinct from Plan 06-06's per-family
 * smokes: this proves the cross-family happy path and observable
 * StateWriteOutcome shape match the fork's locked three-state contract.
 *
 * Pitfall 7 / ADR D-2026-05-12-OQ06-CREATED-SECTION:
 *   BeadsAdapter NEVER emits `created_section`. All `applied:true`
 *   outcomes are bare (no `created_section` field).
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('state-event category smoke (SC#3 — BEADS-02)', () => {
  // Extended timeout: 5 sequential bd spawns under full-sweep dolt-lock
  // saturation. Standalone run completes in ~14s; under the full
  // tests/smoke/ sweep the cross-family chain can exceed the 30s default.
  it('cross-family workflow: decision append + blocker mutation + waiting/resume signals', { timeout: 60_000 }, async () => {
    const h = await setupFreshAdapter();
    try {
      // 1. recordStateAppend (decision — low-freq bd remember)
      const appendRes = await h.adapter.recordStateAppend({
        type: 'decision',
        payload: {
          phase: '06',
          summary: 'Ship Outcome A per D-2026-05-12-OQ06-TXN',
          rationale: 'cross-family smoke',
        },
      });
      expect(appendRes).toEqual({ applied: true });

      // 2. recordStateMutation (blocker_added — label add)
      const mutAddRes = await h.adapter.recordStateMutation({
        type: 'blocker_added',
        payload: { text: 'Awaiting bd v1.0.4 install' },
      });
      expect(mutAddRes).toEqual({ applied: true });

      // 3. recordStateSignal (waiting — label add)
      const waitRes = await h.adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'human', question: 'Install bd?' },
      });
      expect(waitRes).toEqual({ applied: true });

      // 4. recordStateSignal (resume — label remove)
      const resumeRes = await h.adapter.recordStateSignal({
        type: 'resume',
        payload: {},
      });
      expect(resumeRes).toEqual({ applied: true });

      // 5. recordStateMutation (blocker_resolved — label remove)
      const mutResolveRes = await h.adapter.recordStateMutation({
        type: 'blocker_resolved',
        payload: { text: 'Awaiting bd v1.0.4 install' },
      });
      expect(mutResolveRes).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });

  it('idempotency: repeat decision append returns applied:false/duplicate', async () => {
    const h = await setupFreshAdapter();
    try {
      const event = {
        type: 'decision' as const,
        payload: { phase: '06', summary: 'Dup test', rationale: 'idempotency' },
      };
      const first = await h.adapter.recordStateAppend(event);
      expect(first).toEqual({ applied: true });
      const second = await h.adapter.recordStateAppend(event);
      expect(second).toEqual({ applied: false, reason: 'duplicate' });
    } finally {
      await h.cleanup();
    }
  });

  it('signal resume without prior waiting returns applied:false/nothing_to_remove', async () => {
    const h = await setupFreshAdapter();
    try {
      const res = await h.adapter.recordStateSignal({
        type: 'resume',
        payload: {},
      });
      expect(res).toEqual({ applied: false, reason: 'nothing_to_remove' });
    } finally {
      await h.cleanup();
    }
  });
});
