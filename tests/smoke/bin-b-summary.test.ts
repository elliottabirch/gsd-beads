/**
 * Bin B smoke — summary category (SC#3, BEADS-02).
 *
 * Domain-level `addSummary` lives in the fork SDK. See bin-b-plan.test.ts
 * header for the phase-addressed bd-tier routing note; this smoke uses
 * disk-routed paths to exercise the observable summary-shaped primitive
 * surface (round-trip + getSection + append) through BeadsAdapter.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('summary category smoke (SC#3 — BEADS-02)', () => {
  it('putRecord → getRecord round-trip on a summary-shaped document', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'reports/01-01-SUMMARY.md';
      const body =
        '# Phase 01 Plan 01 Summary\n\n## What shipped\n\nAdapter primitives.\n';
      await h.adapter.putRecord(path, body);
      expect(await h.adapter.getRecord(path)).toBe(body);
    } finally {
      await h.cleanup();
    }
  });

  it('getSection preserves summary section structure across round-trip', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'reports/01-01-SUMMARY.md';
      await h.adapter.putRecord(
        path,
        "# Summary\n\n## What shipped\n\nOriginal.\n\n## What's next\n\nNext.\n",
      );
      const section = await h.adapter.getSection(path, 'summary/what-shipped');
      expect(section).not.toBeNull();
      expect(section).toContain('Original');
    } finally {
      await h.cleanup();
    }
  });

  it('updateSection append extends summary without touching later sections', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'reports/01-01-SUMMARY.md';
      await h.adapter.putRecord(
        path,
        "# S\n\n## What shipped\n\nA.\n\n## What's next\n\nB.\n",
      );
      await h.adapter.updateSection(path, 's/what-shipped', 'C.\n', 'append');
      const after = (await h.adapter.getRecord(path)) ?? '';
      expect(after).toMatch(/A[\s\S]*C/);
      expect(after).toContain("What's next");
      expect(after).toContain('B.');
    } finally {
      await h.cleanup();
    }
  });
});
