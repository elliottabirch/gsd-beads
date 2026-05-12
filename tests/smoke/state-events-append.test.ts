/**
 * recordStateAppend — BEADS-02 smoke.
 *
 * Exercises 6 AppendEvent types × applied:true / applied:false:duplicate matrix.
 * Mirrors structure of fork's tests/conformance/write-outcome.test.ts.
 *
 * Dispatch under D-MAPPING Outcome A:
 *   - Low-freq (decision / metric / roadmap_evolution): bd remember --key <m>:<t>:<id>
 *   - High-freq (session / quick_task / forensic_session): bd comments add --author gsd:event:<type>
 *
 * Pitfall 7 / ADR D-2026-05-12-OQ06-CREATED-SECTION:
 *   BeadsAdapter NEVER emits `created_section`. These tests assert
 *   `applied:true` BARE on first-writes — no `created_section` field.
 */

import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter.recordStateAppend — D-MAPPING Outcome A (BEADS-02)', () => {
  // ─── Low-frequency (bd remember) ──────────────────────────────────────

  it("decision: applied:true then false+duplicate on repeat", async () => {
    const h = await setupFreshAdapter();
    try {
      const event = {
        type: 'decision' as const,
        payload: { phase: '06', summary: 'Test decision', rationale: 'smoke' },
      };
      const first = await h.adapter.recordStateAppend(event);
      expect(first).toEqual({ applied: true });
      const second = await h.adapter.recordStateAppend(event);
      expect(second).toEqual({ applied: false, reason: 'duplicate' });
    } finally {
      await h.cleanup();
    }
  });

  it("metric: applied:true, de-dupes on identical payload", async () => {
    const h = await setupFreshAdapter();
    try {
      const event = {
        type: 'metric' as const,
        payload: { phase: '06', plan: '06-06', duration: '30m', tasks: '3', files: '8' },
      };
      const first = await h.adapter.recordStateAppend(event);
      expect(first).toEqual({ applied: true });
      const second = await h.adapter.recordStateAppend(event);
      expect(second).toEqual({ applied: false, reason: 'duplicate' });
    } finally {
      await h.cleanup();
    }
  });

  it("roadmap_evolution: applied:true on distinct actions; duplicate on exact repeat", async () => {
    const h = await setupFreshAdapter();
    try {
      const event = {
        type: 'roadmap_evolution' as const,
        payload: { phase: '06', action: 'added' as const, note: 'test-note' },
      };
      const first = await h.adapter.recordStateAppend(event);
      expect(first).toEqual({ applied: true });
      const same = await h.adapter.recordStateAppend(event);
      expect(same).toEqual({ applied: false, reason: 'duplicate' });

      // A distinct payload (different note) should land as applied:true.
      const distinct = await h.adapter.recordStateAppend({
        type: 'roadmap_evolution',
        payload: { phase: '06', action: 'added', note: 'different-note' },
      });
      expect(distinct).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });

  // ─── High-frequency (bd comments add --author) ────────────────────────

  it("session: applied:true; bare (no created_section in Outcome A)", async () => {
    const h = await setupFreshAdapter();
    try {
      const r = await h.adapter.recordStateAppend({
        type: 'session',
        payload: { stoppedAt: '2026-05-12T00:00:00Z', resumeFile: 'HANDOFF.json' },
      });
      expect(r.applied).toBe(true);
      if (r.applied) {
        // Pitfall 7 / ADR D-2026-05-12-OQ06-CREATED-SECTION policy.
        expect(r.created_section).toBeUndefined();
      }
    } finally {
      await h.cleanup();
    }
  });

  it("session: duplicate on exact-repeat payload", async () => {
    const h = await setupFreshAdapter();
    try {
      const event = {
        type: 'session' as const,
        payload: { stoppedAt: '2026-05-12T00:00:00Z' },
      };
      const first = await h.adapter.recordStateAppend(event);
      expect(first.applied).toBe(true);
      const second = await h.adapter.recordStateAppend(event);
      expect(second).toEqual({ applied: false, reason: 'duplicate' });
    } finally {
      await h.cleanup();
    }
  });

  it("quick_task: applied:true then duplicate on repeat", async () => {
    const h = await setupFreshAdapter();
    try {
      const event = {
        type: 'quick_task' as const,
        payload: { task: 'wire events.ts', result: 'done' },
      };
      const first = await h.adapter.recordStateAppend(event);
      expect(first).toEqual({ applied: true });
      const second = await h.adapter.recordStateAppend(event);
      expect(second).toEqual({ applied: false, reason: 'duplicate' });
    } finally {
      await h.cleanup();
    }
  });

  it("forensic_session: applied:true; distinct sessionIds are not duplicates", async () => {
    const h = await setupFreshAdapter();
    try {
      const a = await h.adapter.recordStateAppend({
        type: 'forensic_session',
        payload: { sessionId: 'sess-a', findings: 'nothing notable' },
      });
      expect(a).toEqual({ applied: true });
      const b = await h.adapter.recordStateAppend({
        type: 'forensic_session',
        payload: { sessionId: 'sess-b', findings: 'another finding' },
      });
      expect(b).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });

  // ─── Landmine 4 discipline (v1.0.4 --label hard-rejects on bd comments add) ──

  it("Landmine 4: high-freq events never emit bd comments add --label (v1.0.4 hard-rejects)", async () => {
    // Positive assertion: the append lands successfully, proving the
    // dispatch used --author (not --label). If events.ts ever regressed
    // to `--label`, bd v1.0.4 would hard-reject with exit 1 and this
    // test would throw.
    const h = await setupFreshAdapter();
    try {
      const r = await h.adapter.recordStateAppend({
        type: 'session',
        payload: { stoppedAt: 'landmine-4-check' },
      });
      expect(r).toEqual({ applied: true });
    } finally {
      await h.cleanup();
    }
  });
});
