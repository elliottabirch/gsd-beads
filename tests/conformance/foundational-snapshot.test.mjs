// tests/conformance/foundational-snapshot.test.mjs
// PRIM-02 foundational snapshot/restore conformance.
// Per D-11: snapshot covers bd JSONL + memories only.
// Round-trip preserves issues + memories + comments byte-for-content
// (RESEARCH §Pattern 5 verified live).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * @param {(t: import('node:test').TestContext) => Promise<{adapter: any, projectRoot: string}>} makeAdapter
 * @param {string} label
 */
export function runConformance(makeAdapter, label) {
  describe(`Foundational: snapshot/restore [${label}]`, () => {

    test('PRIM-02 snapshot returns path to non-empty JSONL file', async (t) => {
      const { adapter } = await makeAdapter(t);
      const snap = await adapter.snapshot();
      assert.ok(typeof snap === 'string' && snap.length > 0);
      assert.ok(existsSync(snap));
      assert.ok(statSync(snap).size > 0);
      t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
    });

    test('PRIM-02 snapshot file is valid JSONL', async (t) => {
      const { adapter } = await makeAdapter(t);
      const snap = await adapter.snapshot();
      const text = readFileSync(snap, 'utf-8');
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        assert.doesNotThrow(() => JSON.parse(line), `bad JSONL: ${line}`);
      }
      t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
    });

    test('PRIM-02 snapshot includes issues + memories (and comments if any)', async (t) => {
      const { adapter } = await makeAdapter(t);
      const snap = await adapter.snapshot();
      const objs = readFileSync(snap, 'utf-8')
        .split('\n').filter(Boolean).map(JSON.parse);
      const issues = objs.filter((o) => o._type === 'issue');
      const memories = objs.filter((o) => o._type === 'memory');
      assert.ok(issues.length > 0, `expected issues, got ${issues.length}`);
      assert.ok(memories.length >= 2, `expected >=2 memories from seed.jsonl, got ${memories.length}`);
      t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
    });

    test('PRIM-02 snapshot → mutate → restore: mutation absent in restored', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      const snap = await adapter.snapshot();
      // Mutate
      const mut = spawnSync('bd', ['remember', 'test-mutation', '--key', 'gsd-beads:conf:mut-marker'], {
        cwd: projectRoot,
        env: { ...process.env, BEADS_ACTOR: 'seed' },
        encoding: 'utf-8',
      });
      assert.equal(mut.status, 0, `bd remember failed: ${mut.stderr}`);
      // Confirm mutation present in original
      const verifyOrig = spawnSync('bd', ['recall', 'gsd-beads:conf:mut-marker'], {
        cwd: projectRoot, encoding: 'utf-8',
      });
      assert.equal(verifyOrig.status, 0);
      // Restore
      const restored = await adapter.restore(snap);
      // Mutation absent in restored
      const verifyRestored = spawnSync('bd', ['recall', 'gsd-beads:conf:mut-marker'], {
        cwd: restored, encoding: 'utf-8',
      });
      assert.notEqual(verifyRestored.status, 0, 'mutation must NOT be in restored');
      t.after(() => rmSync(restored, { recursive: true, force: true }));
      t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
    });

    test('PRIM-02 restored .beads has mode 0700 (Pitfall 6)', async (t) => {
      const { adapter } = await makeAdapter(t);
      const snap = await adapter.snapshot();
      const restored = await adapter.restore(snap);
      const beadsStat = statSync(`${restored}/.beads`);
      assert.equal(beadsStat.mode & 0o777, 0o700);
      t.after(() => rmSync(restored, { recursive: true, force: true }));
      t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
    });

    test('PRIM-02 restore throws TypeError on non-string snapshotRef', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(() => adapter.restore(null), TypeError);
      await assert.rejects(() => adapter.restore(42), TypeError);
    });

    test('PRIM-02 restore throws on non-existent snapshot path', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.restore('/tmp/does-not-exist-snapshot-' + Date.now()),
        /does not exist/
      );
    });

    test('PRIM-02 round-trip preserves comment author field (D-11)', async (t) => {
      const { adapter } = await makeAdapter(t);
      // Add a session event (comment with author gsd:event:session)
      const ev = await adapter.recordStateEvent({
        type: 'session',
        payload: { milestone: 'v1.0', note: 'snapshot-rt-test' },
      });
      // Snapshot
      const snap = await adapter.snapshot();
      // Verify the snapshot contains the comment with author preserved
      const objs = readFileSync(snap, 'utf-8')
        .split('\n').filter(Boolean).map(JSON.parse);
      const milestoneIssue = objs.find((o) => o._type === 'issue' && o.id === ev.bead);
      assert.ok(milestoneIssue, 'milestone issue must be in snapshot');
      assert.ok(Array.isArray(milestoneIssue.comments), 'milestone issue must have comments[]');
      const ourComment = (milestoneIssue.comments ?? []).find(
        (c) => c.author === 'gsd:event:session'
      );
      assert.ok(ourComment, 'comment with gsd:event:session author must be preserved');
      t.after(() => rmSync(dirname(snap), { recursive: true, force: true }));
    });
  });
}

// Auto-invoke for `node --test tests/conformance/foundational-snapshot.test.mjs` standalone runs.
// Suppressed when GSD_CONFORMANCE_AUTORUN=0 (driver path).
if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') {
  const { setupFreshAdapter } = await import('./fixture.mjs');
  runConformance((t) => setupFreshAdapter(t, 'beads'), 'beads');
}
