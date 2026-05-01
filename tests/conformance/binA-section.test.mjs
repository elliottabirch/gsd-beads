// tests/conformance/binA-section.test.mjs
// PRIM-01 Bin A section conformance:
//   getSection, updateSection × 3 modes (overwrite / append / prepend)
//
// Per D-05/D-06: anchors are path-slugs from H1 down (e.g., 'phase-7/decisions/d-01').
// Per D-07: heading line itself is NEVER touched in any mode.
// Per D-08: updateSection writes via atomic tmpfile + rename.
//
// Two invocation paths supported (mirrors capabilities.test.mjs / binA-records.test.mjs):
//   - `npm run test:conformance` (glob): top-level auto-invoke fires
//     because GSD_CONFORMANCE_AUTORUN is unset → registers tests against
//     a default BeadsAdapter factory.
//   - `node tests/conformance/run.mjs` (driver): driver sets
//     GSD_CONFORMANCE_AUTORUN=0 BEFORE importing this file, suppressing
//     the auto-invoke. The driver then dispatches runConformance with
//     its own factory.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {(t: import('node:test').TestContext) => Promise<{adapter: any, projectRoot: string}>} makeAdapter
 * @param {string} label
 */
export function runConformance(makeAdapter, label) {
  describe(`Bin A: section [${label}]`, () => {

    test('PRIM-01 getSection returns body for known path-slug', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '# Phase 7\n\n## Decisions\n\n### D-01\nbody one\n\n### D-02\nbody two\n'
      );
      const result = await adapter.getSection('.planning/PLAN.md', 'phase-7/decisions/d-01');
      // locateSection returns body lines joined with '\n'; trailing blank line
      // is part of the body since the parser slices [bodyStart..bodyEnd) and
      // the next sibling heading is at bodyEnd. Confirm the contract by
      // matching the leading content rather than asserting an exact terminator.
      assert.match(result, /^body one/);
    });

    test('PRIM-01 getSection returns null for missing anchor', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(join(projectRoot, '.planning/PLAN.md'), '# A\nbody\n');
      assert.equal(await adapter.getSection('.planning/PLAN.md', 'no/such'), null);
    });

    test('PRIM-01 updateSection overwrite preserves heading line (D-07)', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '# A\n## B\nold body\n## C\nc-body\n'
      );
      await adapter.updateSection('.planning/PLAN.md', 'a/b', 'NEW body', 'overwrite');
      const result = readFileSync(join(projectRoot, '.planning/PLAN.md'), 'utf-8');
      // ## B heading present, body replaced, ## C untouched
      assert.match(result, /## B\nNEW body\n## C\nc-body/);
    });

    test('PRIM-01 updateSection append inserts before next sibling', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '# A\n## B\nold\n## C\nc\n'
      );
      await adapter.updateSection('.planning/PLAN.md', 'a/b', 'EXTRA', 'append');
      const result = readFileSync(join(projectRoot, '.planning/PLAN.md'), 'utf-8');
      assert.match(result, /## B\nold\nEXTRA\n## C\nc/);
    });

    test('PRIM-01 updateSection prepend inserts after heading', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '# A\n## B\nold\n'
      );
      await adapter.updateSection('.planning/PLAN.md', 'a/b', 'TOP', 'prepend');
      const result = readFileSync(join(projectRoot, '.planning/PLAN.md'), 'utf-8');
      assert.match(result, /## B\nTOP\nold/);
    });

    test('PRIM-01 updateSection throws on missing anchor', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(join(projectRoot, '.planning/PLAN.md'), '# A\nbody\n');
      await assert.rejects(
        () => adapter.updateSection('.planning/PLAN.md', 'no/such', 'x', 'overwrite'),
        /section not found/
      );
    });

    test('PRIM-01 code-fence guard: # inside ```bash fence is NOT a heading (Pitfall 8)', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '# A\n\n```bash\n# this is bash, not a heading\n```\n\n## B\nbody\n'
      );
      // The 'a/b' lookup must succeed, ignoring the in-fence pseudo-heading
      assert.match(
        await adapter.getSection('.planning/PLAN.md', 'a/b'),
        /body/
      );
      // The pseudo-heading must NOT match
      assert.equal(
        await adapter.getSection('.planning/PLAN.md', 'a/this-is-bash-not-a-heading'),
        null
      );
    });

    test('PRIM-01 updateSection atomic-write: no .tmp leftover (D-08)', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '# A\n## B\nold\n'
      );
      await adapter.updateSection('.planning/PLAN.md', 'a/b', 'NEW', 'overwrite');
      const entries = readdirSync(join(projectRoot, '.planning'));
      const tmps = entries.filter((e) => e.startsWith('.PLAN.md.tmp'));
      assert.equal(tmps.length, 0, 'no .tmp leftover from atomic write');
    });
  });
}

// Auto-invoke for `node --test tests/conformance/binA-section.test.mjs` standalone runs.
if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') {
  const { setupFreshAdapter } = await import('./fixture.mjs');
  runConformance((t) => setupFreshAdapter(t, 'beads'), 'beads');
}
