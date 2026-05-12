/**
 * Conformance invocation for BeadsAdapter against live bd v1.0.4.
 *
 * Fork's runAdapterConformanceSuite harness (Phase 1 D-15, locked) does
 * `mkdtemp + mkdir .planning` per test, then invokes `adapterFactory(tmpDir)`
 * synchronously. The harness does NOT run `bd init` — the BeadsAdapter
 * factory is responsible for per-tmpDir bd setup.
 *
 * This closes RESEARCH Open Question #1 without extending the locked harness
 * signature: the factory owns bd initialization via the same seed-jsonl +
 * BEADS_ACTOR=seed discipline used by setupFreshAdapter in tests/fixture.ts.
 *
 * bd v1.0.4 `--from-jsonl` is a boolean flag; the seed file must pre-exist
 * at `.beads/issues.jsonl` inside projectDir before `bd init` runs. The
 * factory copies the committed seed into place before invoking init.
 *
 * Landmine discipline applied:
 *   - Landmine 11: BEADS_ACTOR=seed for byte-identity across runs
 *   - Landmine 9:  chmod 0o700 on .beads/ post-init
 *
 * Plan 06-06 ADR D-2026-05-12-OQ06-CREATED-SECTION: BeadsAdapter in
 * D-MAPPING Outcome A never emits `created_section`. If the fork's
 * write-outcome matrix fails the BeadsAdapter invocation on those cases,
 * the conformance test is fork-side-misconfigured (Phase 7 CONFORM-01..04
 * territory), not a Phase 6 gap.
 */
import { runAdapterConformanceSuite } from 'get-shit-done-cc/conformance';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chmodSync, copyFileSync, mkdirSync } from 'node:fs';
import { BeadsAdapter } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, 'fixtures/seed.jsonl');

runAdapterConformanceSuite('beads', (projectDir: string) => {
  // Harness pre-created projectDir + .planning/. Initialize bd here.

  // 1. git init — bd init v1.0.4 expects a git repo at projectRoot.
  const gitInit = spawnSync('git', ['init', '-q'], {
    cwd: projectDir,
    encoding: 'utf-8',
  });
  if (gitInit.status !== 0) {
    throw new Error(
      `conformance factory: git init failed: ${gitInit.stderr}`,
    );
  }
  spawnSync('git', ['config', 'user.email', 'seed@test.local'], {
    cwd: projectDir,
  });
  spawnSync('git', ['config', 'user.name', 'Seed Test'], {
    cwd: projectDir,
  });

  // 2. bd v1.0.4: --from-jsonl is boolean; seed must pre-exist at
  //    .beads/issues.jsonl before `bd init` runs. Copy committed seed
  //    into place.
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
      `conformance factory: bd init failed (status=${bdInit.status}): ${bdInit.stderr}\n\nSTDOUT:\n${bdInit.stdout}`,
    );
  }

  // 4. Landmine 9: chmod 0o700 on .beads/ (defense-in-depth; ignore
  //    platform-specific no-op failures).
  try {
    chmodSync(join(projectDir, '.beads'), 0o700);
  } catch {
    // non-fatal
  }

  return new BeadsAdapter(projectDir);
});
