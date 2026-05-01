// tests/conformance/fixture.mjs
// Per-test bd-init from seed.jsonl + teardown via t.after().
// D-15: setupFreshAdapter(t, kind) returns {adapter, projectRoot}.
// Uses mkdtempSync + bd init --from-jsonl --skip-hooks per spike-findings
// storage-and-distribution.md.
//
// CRITICAL: BEADS_ACTOR=seed on bd init (Pitfall 8 / D-20).
// CRITICAL: chmodSync(.beads, 0o700) post-init (Pitfall 6).

import { mkdtempSync, mkdirSync, copyFileSync, rmSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../fixtures/seed.jsonl');

/**
 * Set up a fresh adapter against a tmp project initialized from
 * seed.jsonl. Cleanup is registered on the test context.
 *
 * @param {import('node:test').TestContext} t
 * @param {'beads'} [kind] - reserved for Phase 13 cross-adapter pairing
 * @returns {Promise<{adapter: BeadsAdapter, projectRoot: string}>}
 */
export async function setupFreshAdapter(t, kind = 'beads') {
  if (kind !== 'beads') {
    throw new Error(`unknown adapter kind: ${kind} (Phase 13 wires 'markdown')`);
  }

  const root = mkdtempSync(join(tmpdir(), 'gsd-conf-'));
  // git init for bd init's repo-detection
  const gitInit = spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  if (gitInit.status !== 0) {
    throw new Error(`setupFreshAdapter: git init failed in ${root}`);
  }
  // bd init --from-jsonl needs a git author identity for its initial
  // commit; mirror primitives-events.smoke.test.mjs:freshBdFixture so
  // the conformance fixture works on machines without global git config.
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: root, stdio: 'ignore' });
  spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root, stdio: 'ignore' });
  mkdirSync(join(root, '.beads'));
  copyFileSync(SEED, join(root, '.beads/issues.jsonl'));
  const init = spawnSync(
    'bd',
    ['init', '--from-jsonl', '--prefix', 'sd', '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'],
    {
      cwd: root,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      encoding: 'utf-8',
    }
  );
  if (init.status !== 0) {
    throw new Error(`setupFreshAdapter: bd init failed: ${init.stderr}`);
  }
  // Pitfall 6: bd warns on .beads != 0700 on every subsequent invocation
  chmodSync(join(root, '.beads'), 0o700);

  // .planning skeleton for disk-routed tests (PLAN.md, intel/, codebase/, etc.)
  mkdirSync(join(root, '.planning'), { recursive: true });

  // Cleanup on test exit; t.after also fires on test failure
  t.after(() => rmSync(root, { recursive: true, force: true }));

  return { adapter: new BeadsAdapter(root), projectRoot: root };
}
