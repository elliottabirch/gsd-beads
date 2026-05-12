/**
 * Phase 7 D-04 (fork-side ADR): testing subpath export.
 *
 * Factory function that initializes a fresh bd store and returns a
 * BeadsAdapter bound to it. Used by the fork's paired conformance
 * harness via `import { createBeadsAdapter } from 'gsd-beads/testing'`.
 *
 * Single source of truth for bd init discipline:
 *   - git init (bd v1.0.4 requires git repo at projectRoot)
 *   - Seed pre-stage (bd v1.0.4 --from-jsonl is BOOLEAN; seed must
 *     pre-exist at .beads/issues.jsonl before `bd init` runs)
 *   - BEADS_ACTOR=seed env (Landmine 11: determinism across runs)
 *   - chmod 0o700 on .beads/ post-init (Landmine 9: defense-in-depth)
 *
 * Invariants this factory encodes MUST match tests/fixture.ts
 * setupFreshAdapter (which stays for bd-primitive smoke tests).
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { BeadsAdapter } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Seed ships inside dist/testing/fixtures/ via package.json "files":["dist"].
const SEED_PATH = join(__dirname, 'fixtures/seed.jsonl');

/**
 * Create a fresh BeadsAdapter bound to a bd store initialized at
 * `projectDir`. Caller owns `projectDir` lifecycle (mkdtemp + cleanup);
 * this factory does not create or destroy the parent directory.
 */
export function createBeadsAdapter(projectDir: string): BeadsAdapter {
  // 1. git init — bd init v1.0.4 expects a git repo at projectRoot.
  const gitInit = spawnSync('git', ['init', '-q'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });
  if (gitInit.status !== 0) {
    throw new Error(
      `createBeadsAdapter: git init failed: ${gitInit.stderr}`,
    );
  }
  spawnSync('git', ['config', 'user.email', 'seed@test.local'], {
    cwd: projectDir,
  });
  spawnSync('git', ['config', 'user.name', 'Seed Test'], {
    cwd: projectDir,
  });

  // 2. bd v1.0.4: --from-jsonl is boolean; seed must pre-exist at
  //    .beads/issues.jsonl before `bd init` runs.
  const beadsDir = join(projectDir, '.beads');
  mkdirSync(beadsDir, { recursive: true });
  copyFileSync(SEED_PATH, join(beadsDir, 'issues.jsonl'));

  // 3. bd init --from-jsonl with BEADS_ACTOR=seed (Landmine 11).
  const bdInit = spawnSync(
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
  if (bdInit.status !== 0) {
    throw new Error(
      `createBeadsAdapter: bd init failed (status=${bdInit.status}): ` +
        `${bdInit.stderr}\n\nSTDOUT:\n${bdInit.stdout}`,
    );
  }

  // 4. Landmine 9: chmod 0o700 on .beads/ (defense-in-depth;
  //    ignore platform-specific no-op failures).
  try {
    chmodSync(beadsDir, 0o700);
  } catch {
    // non-fatal
  }

  return new BeadsAdapter(projectDir);
}
