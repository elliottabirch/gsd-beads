// tests/unit/primitives-namedDoc.smoke.test.mjs
// Phase 7 Plan 07 Task 2 — smoke tests for putNamedDoc + getNamedDoc (PRIM-02).
//
// Verifies D-10 dual-write contract:
//   - putNamedDoc writes <projectRoot>/.planning/<category>/<key>.md verbatim
//   - putNamedDoc writes a bd memory index at gsd-beads:named-doc:<cat>:<key>
//   - getNamedDoc reads the disk file (returns null when absent)
//   - closed-allowlist enforcement for category (per D-10 closed enum)
//   - all 9 NAMED_DOC_CATEGORIES round-trip cleanly
//   - T-7-01: key with `..` / `/` / `\` rejected (path-traversal mitigation)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, rmSync, copyFileSync, chmodSync, readFileSync, existsSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';
import { NAMED_DOC_CATEGORIES } from '../../src/adapter/pathRouter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../fixtures/seed.jsonl');

function freshBdFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-named-smoke-'));
  spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root, stdio: 'ignore' });
  mkdirSync(join(root, '.beads'));
  copyFileSync(SEED, join(root, '.beads/issues.jsonl'));
  const init = spawnSync(
    'bd',
    ['init', '--from-jsonl', '--prefix', 'sd', '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'],
    { cwd: root, env: { ...process.env, BEADS_ACTOR: 'seed' }, encoding: 'utf-8' },
  );
  if (init.status !== 0) {
    t.diagnostic(`bd init failed: ${init.stderr}`);
    throw new Error(`bd init failed: ${init.stderr}`);
  }
  chmodSync(join(root, '.beads'), 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('SMOKE: putNamedDoc writes disk file under .planning/<category>/<key>.md', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const body = '# Test\n\nintel body\n';
  await a.putNamedDoc('intel', 'smoke-key', body);
  const expected = join(root, '.planning/intel/smoke-key.md');
  assert.ok(existsSync(expected));
  assert.equal(readFileSync(expected, 'utf-8'), body);
});

test('SMOKE: putNamedDoc writes bd memory index at gsd-beads:named-doc:<cat>:<key>', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await a.putNamedDoc('intel', 'smoke-key', '# body\n');
  const recall = spawnSync('bd', ['recall', 'gsd-beads:named-doc:intel:smoke-key'], {
    cwd: root, encoding: 'utf-8',
  });
  assert.equal(recall.status, 0, `bd recall failed: ${recall.stderr}`);
  const idx = JSON.parse(recall.stdout);
  assert.equal(idx.category, 'intel');
  assert.equal(idx.key, 'smoke-key');
  assert.ok(typeof idx.last_write === 'string' && idx.last_write.length > 0);
  assert.ok(typeof idx.byte_length === 'number' && idx.byte_length > 0);
});

test('SMOKE: getNamedDoc reads disk file', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  const body = '# get test\n';
  await a.putNamedDoc('codebase', 'cb-key', body);
  assert.equal(await a.getNamedDoc('codebase', 'cb-key'), body);
});

test('SMOKE: getNamedDoc returns null for missing key', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  assert.equal(await a.getNamedDoc('intel', 'never-written'), null);
});

test('SMOKE: putNamedDoc rejects category outside NAMED_DOC_CATEGORIES', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.putNamedDoc('not-a-real-category', 'k', 'b'),
    /not in NAMED_DOC_CATEGORIES/,
  );
});

test('SMOKE: getNamedDoc rejects category outside NAMED_DOC_CATEGORIES', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.getNamedDoc('not-a-real-category', 'k'),
    /not in NAMED_DOC_CATEGORIES/,
  );
});

test('SMOKE: putNamedDoc rejects key containing path separators (T-7-01)', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.putNamedDoc('intel', '../escape', 'b'),
    TypeError,
  );
  await assert.rejects(
    () => a.putNamedDoc('intel', 'sub/dir', 'b'),
    TypeError,
  );
  await assert.rejects(
    () => a.putNamedDoc('intel', 'win\\style', 'b'),
    TypeError,
  );
});

test('SMOKE: getNamedDoc rejects key containing path separators (T-7-01)', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  await assert.rejects(
    () => a.getNamedDoc('intel', '../escape'),
    TypeError,
  );
  await assert.rejects(
    () => a.getNamedDoc('intel', 'sub/dir'),
    TypeError,
  );
});

test('SMOKE: all 9 NAMED_DOC_CATEGORIES accept putNamedDoc', async (t) => {
  const root = freshBdFixture(t);
  const a = new BeadsAdapter(root);
  for (const category of NAMED_DOC_CATEGORIES) {
    await a.putNamedDoc(category, 'enum-test', `# ${category}\n`);
    const result = await a.getNamedDoc(category, 'enum-test');
    assert.equal(result, `# ${category}\n`, `category=${category} round-trip failed`);
  }
});
