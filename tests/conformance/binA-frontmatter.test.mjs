// tests/conformance/binA-frontmatter.test.mjs
// PRIM-01 Bin A frontmatter conformance:
//   getFrontmatter, updateFrontmatter, mergeFrontmatter
//
// Per D-03: bd-routed paths synthesize from labels (label-to-frontmatter
//          mapping); disk-routed paths use flat-scalar YAML parser.
//
// Two invocation paths supported (mirrors capabilities.test.mjs):
//   - `npm run test:conformance` (glob): top-level auto-invoke fires
//     because GSD_CONFORMANCE_AUTORUN is unset.
//   - `node tests/conformance/run.mjs` (driver): driver suppresses the
//     auto-invoke via GSD_CONFORMANCE_AUTORUN=0 and dispatches its own
//     factory.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Helper for direct bd CLI in tests (creates the gsd:requirement bead etc.).
 * Mirrors the driver-fixture's BEADS_ACTOR=seed convention so JSONL
 * byte-identity is preserved if any test ever exports the resulting state.
 */
function bdq(projectRoot, args) {
  return spawnSync('bd', args, {
    cwd: projectRoot,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  });
}

/**
 * @param {(t: import('node:test').TestContext) => Promise<{adapter: any, projectRoot: string}>} makeAdapter
 * @param {string} label
 */
export function runConformance(makeAdapter, label) {
  describe(`Bin A: frontmatter [${label}]`, () => {

    test('PRIM-01 getFrontmatter on disk-routed returns scalar field (numeric coercion)', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '---\nphase: 7\nname: foo\n---\nbody\n'
      );
      assert.equal(await adapter.getFrontmatter('.planning/PLAN.md', 'phase'), 7);
      const fm = await adapter.getFrontmatter('.planning/PLAN.md');
      assert.deepEqual(fm, { phase: 7, name: 'foo' });
    });

    test('PRIM-01 updateFrontmatter on disk-routed mutates field; preserves body', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '---\nphase: 7\n---\nbody-line-1\nbody-line-2\n'
      );
      await adapter.updateFrontmatter('.planning/PLAN.md', 'phase', 8);
      assert.equal(await adapter.getFrontmatter('.planning/PLAN.md', 'phase'), 8);
      const text = readFileSync(join(projectRoot, '.planning/PLAN.md'), 'utf-8');
      assert.match(text, /body-line-1\nbody-line-2/);
    });

    test('PRIM-01 mergeFrontmatter on disk-routed preserves unrelated keys', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '---\nphase: 7\nname: foo\n---\nbody\n'
      );
      await adapter.mergeFrontmatter('.planning/PLAN.md', { phase: 8, status: 'open' });
      const fm = await adapter.getFrontmatter('.planning/PLAN.md');
      assert.deepEqual(fm, { phase: 8, name: 'foo', status: 'open' });
    });

    test('PRIM-01 getFrontmatter on bd-routed synthesizes from labels (D-03)', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      // Create a gsd:requirement bead (seed.jsonl doesn't include one).
      // bd q outputs only the issue ID on stdout per --help.
      const create = bdq(projectRoot, ['q', 'Test Requirement', '-t', 'task', '-p', '1']);
      assert.equal(create.status, 0, `bd q failed: ${create.stderr}`);
      const issueId = create.stdout.trim().split('\n').slice(-1)[0].trim();
      const r1 = bdq(projectRoot, ['label', 'add', issueId, 'gsd:requirement']);
      assert.equal(r1.status, 0, `label add gsd:requirement failed: ${r1.stderr}`);
      bdq(projectRoot, ['label', 'add', issueId, 'version:v1.0']);
      bdq(projectRoot, ['label', 'add', issueId, 'status:ready']);

      const fm = await adapter.getFrontmatter('.planning/REQUIREMENTS.md');
      // Verify label-to-frontmatter synthesis: keys derived from label prefixes
      // per _labelsToFrontmatter() in src/adapter/primitives.mjs (D-03).
      assert.equal(fm.gsd, 'requirement');
      assert.equal(fm.version, 'v1.0');
      // Bare bd issue status is included by _labelsToFrontmatter as
      // {id, status: <bd issue status>}; the `status:ready` label
      // overrides via the labels iteration so fm.status === 'ready'.
      assert.equal(fm.status, 'ready');
      assert.equal(fm.id, issueId);
    });

    test('PRIM-01 updateFrontmatter on bd-routed rewrites label', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      // Set up a gsd:requirement bead with version:v1.0
      const create = bdq(projectRoot, ['q', 'Requirement v1', '-t', 'task', '-p', '1']);
      assert.equal(create.status, 0, `bd q failed: ${create.stderr}`);
      const issueId = create.stdout.trim().split('\n').slice(-1)[0].trim();
      bdq(projectRoot, ['label', 'add', issueId, 'gsd:requirement']);
      bdq(projectRoot, ['label', 'add', issueId, 'version:v1.0']);

      await adapter.updateFrontmatter('.planning/REQUIREMENTS.md', 'version', 'v1.1');
      // Verify via direct bd show. bd show --json returns an ARRAY (one
      // entry per show'd id) — destructure [0] to get the issue object.
      const show = bdq(projectRoot, ['show', issueId, '--json']);
      assert.equal(show.status, 0, `bd show failed: ${show.stderr}`);
      const [issue] = JSON.parse(show.stdout);
      assert.ok((issue.labels ?? []).includes('version:v1.1'), 'version:v1.1 added');
      assert.ok(!(issue.labels ?? []).includes('version:v1.0'), 'version:v1.0 removed');
    });

    test('PRIM-01 mergeFrontmatter on bd-routed adds new label without removing siblings', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      const create = bdq(projectRoot, ['q', 'Req merge', '-t', 'task', '-p', '1']);
      assert.equal(create.status, 0, `bd q failed: ${create.stderr}`);
      const issueId = create.stdout.trim().split('\n').slice(-1)[0].trim();
      bdq(projectRoot, ['label', 'add', issueId, 'gsd:requirement']);
      bdq(projectRoot, ['label', 'add', issueId, 'version:v1.0']);

      await adapter.mergeFrontmatter('.planning/REQUIREMENTS.md', { status: 'open' });
      // bd show --json returns an array; destructure [0].
      const show = bdq(projectRoot, ['show', issueId, '--json']);
      assert.equal(show.status, 0, `bd show failed: ${show.stderr}`);
      const [issue] = JSON.parse(show.stdout);
      // Both labels present (set-equality via includes — bd doesn't
      // guarantee deterministic label ordering per PATTERNS anti-pattern).
      assert.ok((issue.labels ?? []).includes('version:v1.0'), 'version:v1.0 preserved');
      assert.ok((issue.labels ?? []).includes('status:open'), 'status:open added');
    });

    test('PRIM-01 getFrontmatter on disk-routed file without delimiters returns {} or undefined', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      mkdirSync(join(projectRoot, '.planning'), { recursive: true });
      writeFileSync(join(projectRoot, '.planning/PLAN.md'), 'just a body\n');
      assert.deepEqual(await adapter.getFrontmatter('.planning/PLAN.md'), {});
      assert.equal(await adapter.getFrontmatter('.planning/PLAN.md', 'phase'), undefined);
    });
  });
}

// Auto-invoke for `node --test tests/conformance/binA-frontmatter.test.mjs` standalone runs.
if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') {
  const { setupFreshAdapter } = await import('./fixture.mjs');
  runConformance((t) => setupFreshAdapter(t, 'beads'), 'beads');
}
