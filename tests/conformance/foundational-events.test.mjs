// tests/conformance/foundational-events.test.mjs
// PRIM-02 foundational events conformance.
// Per D-09: 7 memory types (bd remember --key <milestone>:<type>:<id>) +
//           3 comment types (bd comments add --author "gsd:event:<type>"
//           on milestone bead). D-09 amendment: --author NOT --label
//           (bd v1.0.3 doesn't support label on comments — Pitfall 1).
// Per D-12: read-back via direct bd calls, NOT Phase 9+ adapter methods.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const MEMORY_EVENT_TYPES = [
  'decision',
  'blocker_added',
  'blocker_resolved',
  'metric',
  'todo_count_update',
  'deferred_items',
  'roadmap_evolution',
];

const COMMENT_EVENT_TYPES = [
  'session',
  'quick_task',
  'forensic_session',
];

/**
 * @param {(t: import('node:test').TestContext) => Promise<{adapter: any, projectRoot: string}>} makeAdapter
 * @param {string} label
 */
export function runConformance(makeAdapter, label) {
  describe(`Foundational: events [${label}]`, () => {

    for (const type of MEMORY_EVENT_TYPES) {
      test(`PRIM-02 recordStateEvent type=${type} writes bd memory at v1.0:${type}:<id>`, async (t) => {
        const { adapter, projectRoot } = await makeAdapter(t);
        const id = `${type}-id-1`;
        const payload = { id, milestone: 'v1.0', body: `test ${type}` };
        const ret = await adapter.recordStateEvent({ type, payload });
        assert.equal(ret.storage, 'memory');
        assert.equal(ret.key, `v1.0:${type}:${id}`);

        // Direct bd read per D-12 — NOT Phase 9+ adapter method
        const recall = spawnSync('bd', ['recall', `v1.0:${type}:${id}`], {
          cwd: projectRoot, encoding: 'utf-8',
        });
        assert.equal(recall.status, 0, `bd recall failed: ${recall.stderr}`);
        const stored = JSON.parse(recall.stdout);
        assert.deepEqual(stored, payload);
      });
    }

    for (const type of COMMENT_EVENT_TYPES) {
      test(`PRIM-02 recordStateEvent type=${type} writes bd comment authored as gsd:event:${type}`, async (t) => {
        const { adapter, projectRoot } = await makeAdapter(t);
        const payload = { milestone: 'v1.0', body: `test ${type} payload` };
        const ret = await adapter.recordStateEvent({ type, payload });
        assert.equal(ret.storage, 'comment');
        assert.equal(ret.author, `gsd:event:${type}`);
        assert.ok(ret.bead, 'must report milestone bead id');

        // Direct bd read per D-12 — bd comments <bead> --json then filter on author
        const cmt = spawnSync('bd', ['comments', ret.bead, '--json'], {
          cwd: projectRoot, encoding: 'utf-8',
        });
        assert.equal(cmt.status, 0, `bd comments failed: ${cmt.stderr}`);
        const comments = JSON.parse(cmt.stdout);
        assert.ok(Array.isArray(comments), `expected array, got ${typeof comments}`);
        const ours = comments.filter((c) => c.author === `gsd:event:${type}`);
        assert.equal(ours.length, 1, `expected 1 ${type} comment, got ${ours.length}`);
        // Comment text round-trips the payload
        const stored = JSON.parse(ours[0].text);
        assert.deepEqual(stored, payload);
      });
    }

    test('PRIM-02 recordStateEvent throws on unknown type', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.recordStateEvent({ type: 'unknown_xyz', payload: { milestone: 'v1.0', id: 'x' } }),
        /recordStateEvent: unknown type/
      );
    });

    test('PRIM-02 _resolveMilestoneBead finds v1.0 milestone bead from enriched seed.jsonl', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      // The COMMENT_EVENT_TYPES dispatch above already exercises this path,
      // but a focused test: Plan 08 added M10 with gsd:milestone + version:v1.0.
      // Verify the helper resolves it (smoke via session dispatch).
      const ret = await adapter.recordStateEvent({
        type: 'session', payload: { milestone: 'v1.0', note: 'milestone-resolution-test' },
      });
      assert.ok(ret.bead && ret.bead.length > 0);
      // Verify the bead has the expected milestone labels.
      // NB: `bd show <id> --json` returns an array (single-element) per
      // bd v1.0.3, not a single object; unwrap before reading labels.
      const show = spawnSync('bd', ['show', ret.bead, '--json'], {
        cwd: projectRoot, encoding: 'utf-8',
      });
      assert.equal(show.status, 0);
      const shown = JSON.parse(show.stdout);
      const issue = Array.isArray(shown) ? shown[0] : shown;
      assert.ok((issue.labels ?? []).includes('gsd:milestone'));
      assert.ok((issue.labels ?? []).includes('version:v1.0'));
    });
  });
}

// Auto-invoke for `node --test tests/conformance/foundational-events.test.mjs` standalone runs.
// The driver (run.mjs) imports the export instead and provides its own factories;
// this auto-invocation is skipped when GSD_CONFORMANCE_AUTORUN=0 (driver sets it).
if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') {
  const { setupFreshAdapter } = await import('./fixture.mjs');
  runConformance((t) => setupFreshAdapter(t, 'beads'), 'beads');
}
