/**
 * Bin B smoke — plan category (SC#3, BEADS-02).
 *
 * Domain-level `createPlan` lives in the fork SDK (Phase 3 D-04); smokes
 * prove the primitives that compose over — round-trip + frontmatter read +
 * listCollection enumerate — work through BeadsAdapter end-to-end against
 * live bd v1.0.4.
 *
 * Note on routing: `.planning/phases/<NN-slug>/<NN-NN>-PLAN.md` routes to
 * `phase-plan` (bd-tier). Per Plan 06-06 scope (primitives.ts:188),
 * phase-addressed bd *writes* are not wired in Bin A — they land via the
 * fork SDK's addPhase/createPlan domain helpers which compose the lower
 * primitives (writing to ROADMAP.md + emitting recordState*). This smoke
 * therefore exercises the observable primitive surface under paths that
 * don't collide with the `phase-*` bd-routing regex, matching the category
 * intent (plan-shaped document lifecycle) without reaching into domain
 * logic.
 */
import { describe, it, expect } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';

describe('plan category smoke (SC#3 — BEADS-02)', () => {
  it('putRecord → getRecord round-trip on a plan-shaped document', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'research/plans/test-plan.md';
      const body =
        '---\nphase: 01\nplan: 01\nwave: 1\n---\n\n# Plan 01-01 — Test\n\n## Tasks\n\n- task 1\n';
      await h.adapter.putRecord(path, body);
      expect(await h.adapter.getRecord(path)).toBe(body);
    } finally {
      await h.cleanup();
    }
  });

  it('getFrontmatter reads plan frontmatter fields', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'research/plans/test-plan.md';
      await h.adapter.putRecord(
        path,
        "---\nphase: '01'\nplan: '01'\nwave: 2\n---\n\nBody.\n",
      );
      expect(await h.adapter.getFrontmatter(path, 'wave')).toBe(2);
      expect(await h.adapter.getFrontmatter(path, 'phase')).toBe('01');
    } finally {
      await h.cleanup();
    }
  });

  it('listCollection enumerates plan-shaped files under a plans directory', async () => {
    const h = await setupFreshAdapter();
    try {
      await h.adapter.putRecord('research/plans/01-01-PLAN.md', 'a');
      await h.adapter.putRecord('research/plans/01-02-PLAN.md', 'b');
      const refs = await h.adapter.listCollection('research/plans');
      const names = refs.map((r) => r.name);
      expect(names.some((n) => n === '01-01-PLAN.md')).toBe(true);
      expect(names.some((n) => n === '01-02-PLAN.md')).toBe(true);
    } finally {
      await h.cleanup();
    }
  });

  it('updateFrontmatter mutates a single field idempotently', async () => {
    const h = await setupFreshAdapter();
    try {
      const path = 'research/plans/test-plan.md';
      await h.adapter.putRecord(
        path,
        "---\nphase: '01'\nplan: '01'\n---\n\nBody.\n",
      );
      await h.adapter.updateFrontmatter(path, 'wave', 3);
      expect(await h.adapter.getFrontmatter(path, 'wave')).toBe(3);
      // other fields untouched
      expect(await h.adapter.getFrontmatter(path, 'phase')).toBe('01');
    } finally {
      await h.cleanup();
    }
  });
});
