/**
 * Shared test fixture for BeadsAdapter smoke + conformance tests.
 *
 * setupFreshAdapter: mkdtemp + git init + bd init --from-jsonl with
 * BEADS_ACTOR=seed discipline (Landmine 11) + chmod 0o700 on .beads/
 * (Landmine 9). Returns a handle with a cleanup() function callers must
 * invoke in afterEach / finally.
 *
 * setupNonBdDir: mkdtemp without bd init — used by init.test.ts to probe
 * BdManagedMismatchError.
 *
 * Design note (RESEARCH Open Q #1, A3): fork's runAdapterConformanceSuite
 * does NOT bd-init the harness tmpdir. Plan 06-07 wraps the conformance
 * factory around setupFreshAdapter to preserve harness contract.
 */

import { mkdtemp, mkdir, chmod, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { BeadsAdapter } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface FreshAdapterHandle {
  projectDir: string;
  adapter: BeadsAdapter;
  cleanup: () => Promise<void>;
}

export interface NonBdDirHandle {
  projectDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a fresh tmp dir, git init, bd init --from-jsonl with the committed
 * seed, chmod 0o700 (Landmine 9), and construct a BeadsAdapter.
 * BEADS_ACTOR=seed enforced for byte-identity discipline (Landmine 11).
 */
export async function setupFreshAdapter(): Promise<FreshAdapterHandle> {
  const projectDir = await mkdtemp(join(tmpdir(), 'gsd-beads-smoke-'));
  await mkdir(join(projectDir, '.planning'), { recursive: true });

  // git init — bd init v1.0.4 expects a git repo at projectRoot
  spawnSync('git', ['init', '-q'], { cwd: projectDir, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 'seed@test.local'], { cwd: projectDir });
  spawnSync('git', ['config', 'user.name', 'Seed Test'], { cwd: projectDir });

  // bd v1.0.4: `--from-jsonl` is a boolean flag; the seed file must pre-exist
  // at `.beads/issues.jsonl` in the project dir before `bd init` runs.
  // Copy the committed seed into place before invoking init.
  const seedSrc = join(__dirname, '../src/testing/fixtures/seed.jsonl');
  const beadsDir = join(projectDir, '.beads');
  await mkdir(beadsDir, { recursive: true });
  await copyFile(seedSrc, join(beadsDir, 'issues.jsonl'));

  const init = spawnSync(
    'bd',
    [
      'init',
      '--from-jsonl',
      '--non-interactive',
      '--skip-agents',
      '--skip-hooks',
      '--quiet',
    ],
    {
      cwd: projectDir,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      encoding: 'utf-8',
    },
  );

  if (init.status !== 0) {
    await rm(projectDir, { recursive: true, force: true });
    throw new Error(
      `bd init failed in fixture setup (status=${init.status}): ${init.stderr}`,
    );
  }

  // Landmine 9: chmod 0o700 on .beads/ (ignore errors on platforms where it
  // is a no-op — the intent is defense-in-depth, not a hard contract).
  await chmod(join(projectDir, '.beads'), 0o700).catch(() => undefined);

  const adapter = new BeadsAdapter(projectDir);
  const cleanup = () => rm(projectDir, { recursive: true, force: true });

  return { projectDir, adapter, cleanup };
}

/**
 * Fresh non-bd dir — used by init.test.ts to probe BdManagedMismatchError.
 * Creates .planning/ but NOT .beads/. Also initializes a git repo so that
 * findBeadsRoot halts at the git-root boundary (D-02) rather than walking
 * up into /tmp's parent hierarchy which may or may not be bd-managed.
 */
export async function setupNonBdDir(): Promise<NonBdDirHandle> {
  const projectDir = await mkdtemp(join(tmpdir(), 'gsd-beads-nonbd-'));
  await mkdir(join(projectDir, '.planning'), { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: projectDir, stdio: 'ignore' });
  return { projectDir, cleanup: () => rm(projectDir, { recursive: true, force: true }) };
}
