/**
 * Bin B smoke — phase category (SC#3, BEADS-02).
 *
 * Exercises one representative phase-workflow primitive round-trip against
 * BeadsAdapter end-to-end with live bd v1.0.4. Domain-level `addPhase` SDK
 * helper lives in the fork (Phase 3 D-04 "adapter stays thin") and is out
 * of BEADS-02 scope; this smoke proves the primitives that `addPhase`
 * composes over work against live bd.
 *
 * Route: `.planning/ROADMAP.md` → `roadmap-singleton` (bd-tier, label
 * `gsd:roadmap`). putRecord hits `bd create` on first-write (empty label
 * list) then `bd update --description` on subsequent writes.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('phase category smoke (SC#3 — BEADS-02)', () => {
  it('putRecord → getRecord round-trip on .planning/ROADMAP.md (bd-tier, gsd:roadmap)', async () => {
    const h = await setupFreshAdapter();
    try {
      const body = '# Roadmap\n\n## Phase 1 — Test Phase\n\nGoal: test.\n';
      await h.adapter.putRecord('.planning/ROADMAP.md', body);
      expect(await h.adapter.getRecord('.planning/ROADMAP.md')).toBe(body);
    } finally {
      await h.cleanup();
    }
  });

  it('getSection resolves a phase heading under the roadmap root', async () => {
    const h = await setupFreshAdapter();
    try {
      const body =
        '# Roadmap\n\n## Phase 1 — Test Phase\n\nGoal: test goal.\n\n## Phase 2 — Other\n\nOther body.\n';
      await h.adapter.putRecord('.planning/ROADMAP.md', body);
      // path-slug anchor: H1 "Roadmap" → "roadmap"; H2 "Phase 1 — Test Phase" → "phase-1-test-phase"
      const section = await h.adapter.getSection(
        '.planning/ROADMAP.md',
        'roadmap/phase-1-test-phase',
      );
      expect(section).not.toBeNull();
      expect(section).toContain('test goal');
    } finally {
      await h.cleanup();
    }
  });

  it('updateSection overwrite replaces the matched phase body without touching siblings', async () => {
    const h = await setupFreshAdapter();
    try {
      const body =
        '# Roadmap\n\n## Phase 1 — Test\n\nOld goal.\n\n## Phase 2 — Other\n\nSibling body.\n';
      await h.adapter.putRecord('.planning/ROADMAP.md', body);
      await h.adapter.updateSection(
        '.planning/ROADMAP.md',
        'roadmap/phase-1-test',
        'New goal.\n',
        'overwrite',
      );
      const after = (await h.adapter.getRecord('.planning/ROADMAP.md')) ?? '';
      expect(after).toContain('New goal');
      expect(after).not.toContain('Old goal');
      // sibling untouched
      expect(after).toContain('Sibling body');
    } finally {
      await h.cleanup();
    }
  });
});
