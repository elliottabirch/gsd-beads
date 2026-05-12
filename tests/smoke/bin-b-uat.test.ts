/**
 * Bin B smoke — uat category (SC#3, BEADS-02).
 *
 * Domain-level `createUat` + `updateUat` live in the fork SDK. This smoke
 * exercises the observable UAT-shaped primitive surface (round-trip +
 * updateSection append of new scenarios) through BeadsAdapter on
 * disk-routed paths — see bin-b-plan.test.ts header for the phase-
 * addressed bd-tier routing note.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('uat category smoke (SC#3 — BEADS-02)', () => {
  it('putRecord → getRecord round-trip on a UAT-shaped document', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'reports/UAT-01.md';
      const body = '# UAT — Phase 01\n\n## Scenarios\n\n1. Does X work?\n';
      await h.adapter.putRecord(path, body);
      expect(await h.adapter.getRecord(path)).toBe(body);
    } finally {
      await h.cleanup();
    }
  });

  it('updateSection append adds a scenario (createUat + updateUat flow)', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'reports/UAT-01.md';
      await h.adapter.putRecord(
        path,
        '# UAT\n\n## Scenarios\n\n1. Does A work?\n',
      );
      await h.adapter.updateSection(
        path,
        'uat/scenarios',
        '2. Does B work?\n',
        'append',
      );
      const after = (await h.adapter.getRecord(path)) ?? '';
      expect(after).toContain('Does A work');
      expect(after).toContain('Does B work');
    } finally {
      await h.cleanup();
    }
  });

  it('getSection retrieves the scenarios block for UAT verification', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'reports/UAT-01.md';
      await h.adapter.putRecord(
        path,
        '# UAT\n\n## Scenarios\n\n1. A\n2. B\n\n## Notes\n\nMisc.\n',
      );
      const section = await h.adapter.getSection(path, 'uat/scenarios');
      expect(section).not.toBeNull();
      expect(section).toContain('1. A');
      expect(section).toContain('2. B');
      expect(section).not.toContain('Misc.');
    } finally {
      await h.cleanup();
    }
  });
});
