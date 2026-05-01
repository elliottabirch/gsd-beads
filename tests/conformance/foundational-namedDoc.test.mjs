// tests/conformance/foundational-namedDoc.test.mjs
// PRIM-02 foundational namedDoc conformance.
// Per D-10: putNamedDoc dual-writes (disk + bd memory index).
//          getNamedDoc reads disk only.
//          Closed allowlist via NAMED_DOC_CATEGORIES.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { NAMED_DOC_CATEGORIES } from '../../src/adapter/pathRouter.mjs';

/**
 * @param {(t: import('node:test').TestContext) => Promise<{adapter: any, projectRoot: string}>} makeAdapter
 * @param {string} label
 */
export function runConformance(makeAdapter, label) {
  describe(`Foundational: namedDoc [${label}]`, () => {

    for (const category of NAMED_DOC_CATEGORIES) {
      test(`PRIM-02 putNamedDoc(${category}, key) writes disk + bd memory index`, async (t) => {
        const { adapter, projectRoot } = await makeAdapter(t);
        const body = `# ${category} test\n\nbody for ${category}\n`;
        await adapter.putNamedDoc(category, 'test-key', body);

        // Disk file present with exact body
        const filePath = join(projectRoot, '.planning', category, 'test-key.md');
        assert.ok(existsSync(filePath), `disk file ${filePath} must exist`);
        assert.equal(readFileSync(filePath, 'utf-8'), body);

        // bd memory index present
        const recall = spawnSync('bd', ['recall', `gsd-beads:named-doc:${category}:test-key`], {
          cwd: projectRoot, encoding: 'utf-8',
        });
        assert.equal(recall.status, 0, `bd recall failed: ${recall.stderr}`);
        const idx = JSON.parse(recall.stdout);
        assert.equal(idx.category, category);
        assert.equal(idx.key, 'test-key');
        assert.ok(typeof idx.last_write === 'string' && idx.last_write.length > 0);
        assert.ok(typeof idx.byte_length === 'number' && idx.byte_length > 0);
        assert.equal(idx.byte_length, Buffer.byteLength(body, 'utf-8'));
      });

      test(`PRIM-02 getNamedDoc(${category}, key) reads disk file`, async (t) => {
        const { adapter } = await makeAdapter(t);
        const body = `# ${category}\n`;
        await adapter.putNamedDoc(category, 'rt-key', body);
        const result = await adapter.getNamedDoc(category, 'rt-key');
        assert.equal(result, body);
      });
    }

    test('PRIM-02 putNamedDoc rejects category outside NAMED_DOC_CATEGORIES (D-10 closed allowlist)', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.putNamedDoc('not-a-real-category', 'k', 'b'),
        /not in NAMED_DOC_CATEGORIES/
      );
    });

    test('PRIM-02 putNamedDoc rejects path-separator characters in key (T-7-01)', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.putNamedDoc('intel', '../escape', 'b'),
        /path separators|key must not contain/
      );
    });

    test('PRIM-02 getNamedDoc returns null for missing key', async (t) => {
      const { adapter } = await makeAdapter(t);
      assert.equal(await adapter.getNamedDoc('intel', 'never-written'), null);
    });

    test('PRIM-02 getNamedDoc rejects category outside NAMED_DOC_CATEGORIES', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.getNamedDoc('bogus-cat', 'key'),
        /not in NAMED_DOC_CATEGORIES/
      );
    });
  });
}

// Auto-invoke for `node --test tests/conformance/foundational-namedDoc.test.mjs` standalone runs.
// Suppressed when GSD_CONFORMANCE_AUTORUN=0 (driver path).
if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') {
  const { setupFreshAdapter } = await import('./fixture.mjs');
  runConformance((t) => setupFreshAdapter(t, 'beads'), 'beads');
}
