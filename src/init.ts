/**
 * BeadsAdapter runtime-state initializer. BEADS-04.
 *
 * Lazy probe pattern (RESEARCH Pattern 1 + sibling D-18):
 *   - capabilities flag is statically readable at construction (no bd needed)
 *   - first bd-using method call invokes ensureBd(); subsequent calls reuse
 *   - non-bd dir → throws BdManagedMismatchError with code
 *     PROJECT_BD_MANAGED_MISMATCH (see bd/errors.ts)
 *
 * Harness-compatibility note (RESEARCH Open Q #1, A3): fork's
 * runAdapterConformanceSuite does `mkdtemp + mkdir .planning + new Adapter(tmpDir)`
 * but does NOT bd init. BeadsAdapter consumers in conformance must wrap their
 * factory to bd-init the tmpdir before handing off — see tests/fixture.ts
 * setupFreshAdapter pattern. Plan 06-07 makes this explicit in the conformance
 * invocation.
 *
 * Disk-tier paths do NOT go through ensureBd() — disk-tier primitives skip
 * the bd probe entirely (tests/smoke/init.test.ts has a case asserting this).
 */

import { findBeadsRoot } from './bd/findRoot.js';
import { BdRunner } from './bd/helper.js';
import { BdManagedMismatchError } from './bd/errors.js';

export interface BeadsRuntimeState {
  readonly beadsRoot: string;
  readonly bd: BdRunner;
}

/**
 * Synchronous variant of ensureBd — useful when a caller already knows it
 * is in a sync context. `ensureBd()` below is the primary async entry point.
 */
export function ensureBdSync(
  projectRoot: string,
  cached: BeadsRuntimeState | null,
): BeadsRuntimeState {
  if (cached) return cached;
  const root = findBeadsRoot(projectRoot);
  if (root === null) {
    throw new BdManagedMismatchError(
      projectRoot,
      'Expected .beads/metadata.json at or above projectRoot. Run `bd init` or set BEADS_DIR.',
    );
  }
  return { beadsRoot: root, bd: new BdRunner(root) };
}

/**
 * Lazy bd-managed probe. Returns the cached state on hit; on miss, walks
 * `projectRoot` via findBeadsRoot() and constructs a BdRunner if found. On
 * non-bd dirs throws BdManagedMismatchError (code=PROJECT_BD_MANAGED_MISMATCH).
 *
 * Every bd-using BeadsAdapter method goes through this helper so the probe
 * cost is paid once per adapter instance.
 */
export async function ensureBd(
  projectRoot: string,
  cached: BeadsRuntimeState | null,
): Promise<BeadsRuntimeState> {
  return ensureBdSync(projectRoot, cached);
}
