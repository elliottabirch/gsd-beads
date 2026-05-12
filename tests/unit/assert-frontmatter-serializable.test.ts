/**
 * WR-1 (iter-2) regression: `_assertFrontmatterSerializable` must reject
 * functions and Symbols at any depth BEFORE any IO happens.
 *
 * The iter-1 WR-06 fix relied on `JSON.stringify` as the sole reject
 * mechanism. `JSON.stringify` only throws on circular refs + BigInt; it
 * silently drops functions and Symbols from object keys and turns Symbols
 * in arrays into `null`. That defeats the purpose of the guard — a
 * caller passing `updateFrontmatter(path, 'foo', () => 1)` or
 * `mergeFrontmatter(path, { fn: () => 1 })` would SLIP PAST the guard
 * and hit `js-yaml.dump`, which can emit `!!js/function` tags that
 * corrupt the YAML on subsequent load.
 *
 * These tests exercise the guard via the exported `updateFrontmatter`
 * and `mergeFrontmatterFn` from `src/primitives.ts`. The `ensure` stub
 * throws unconditionally so if the guard FAILS to reject (i.e. lets the
 * bad value through), the test will fail with "ensure-called" rather
 * than "not thrown" — proving the guard is hit before any IO.
 */

import { describe, it, expect } from 'vitest';
import {
  updateFrontmatter,
  mergeFrontmatterFn,
} from '../../src/primitives.js';
import type { BeadsRuntimeState } from '../../src/init.js';

const projectRoot = '/tmp/mock-project-for-guard-test';

// Ensure stub that MUST NOT be called — the guard should reject long
// before any IO is attempted. If this fires, the guard is broken.
const ensureStub = async (): Promise<BeadsRuntimeState> => {
  throw new Error(
    'ensure() called — guard did not reject; _assertFrontmatterSerializable is broken.',
  );
};

describe('_assertFrontmatterSerializable (WR-1 iter-2 regression)', () => {
  it('updateFrontmatter rejects a top-level function value', async () => {
    await expect(
      updateFrontmatter(
        projectRoot,
        ensureStub,
        'research/x.md',
        'broken',
        () => 'nope',
      ),
    ).rejects.toThrow(/function is not YAML-serializable/);
  });

  it('updateFrontmatter rejects a top-level Symbol value', async () => {
    await expect(
      updateFrontmatter(
        projectRoot,
        ensureStub,
        'research/x.md',
        'broken',
        Symbol('x'),
      ),
    ).rejects.toThrow(/symbol is not YAML-serializable/);
  });

  it('updateFrontmatter rejects a function NESTED inside an object', async () => {
    await expect(
      updateFrontmatter(projectRoot, ensureStub, 'research/x.md', 'broken', {
        nested: { fn: () => 'nope' },
      }),
    ).rejects.toThrow(/function is not YAML-serializable/);
  });

  it('updateFrontmatter rejects a Symbol NESTED inside an array', async () => {
    await expect(
      updateFrontmatter(projectRoot, ensureStub, 'research/x.md', 'broken', {
        list: [1, 2, Symbol('x'), 3],
      }),
    ).rejects.toThrow(/symbol is not YAML-serializable/);
  });

  it('mergeFrontmatterFn rejects a function value in the patch', async () => {
    await expect(
      mergeFrontmatterFn(projectRoot, ensureStub, 'research/x.md', {
        a: 1,
        b: () => 'nope',
      }),
    ).rejects.toThrow(/function is not YAML-serializable/);
  });

  it('mergeFrontmatterFn rejects a Symbol value deep inside the patch', async () => {
    await expect(
      mergeFrontmatterFn(projectRoot, ensureStub, 'research/x.md', {
        a: { b: { c: [Symbol('leaf')] } },
      }),
    ).rejects.toThrow(/symbol is not YAML-serializable/);
  });

  it('updateFrontmatter rejects a circular-reference object (JSON.stringify probe)', async () => {
    const circ: Record<string, unknown> = { a: 1 };
    circ.self = circ;
    await expect(
      updateFrontmatter(
        projectRoot,
        ensureStub,
        'research/x.md',
        'broken',
        circ,
      ),
    ).rejects.toThrow(/circular references or BigInt/);
  });

  it('updateFrontmatter rejects a BigInt value (JSON.stringify probe)', async () => {
    await expect(
      updateFrontmatter(
        projectRoot,
        ensureStub,
        'research/x.md',
        'broken',
        BigInt(12345),
      ),
    ).rejects.toThrow(/circular references or BigInt/);
  });

  it('walker tolerates benign shared references (diamond) without false reject', async () => {
    // WeakSet de-duplication: the walker must not blow up or falsely
    // reject when the same INNOCENT object appears twice under different
    // keys. We assert the guard does NOT throw its own "not
    // YAML-serializable" TypeError. (A DIFFERENT error surfaces from
    // downstream IO in getRecord — that's expected; our mock projectRoot
    // doesn't exist — and proves the guard let the input through.)
    const shared = { a: 1 };
    const diamond = { left: shared, right: shared };
    await expect(
      updateFrontmatter(
        projectRoot,
        ensureStub,
        'research/x.md',
        'ok',
        diamond,
      ),
    ).rejects.not.toThrow(/is not YAML-serializable/);
  });

  it('guard does NOT reject a benign nested object (walker passes clean)', async () => {
    // If the walker mis-classifies a clean input, a TypeError with "is
    // not YAML-serializable" surfaces. Asserting that error is ABSENT
    // proves the walker let the clean input through. Some other
    // downstream error (from getRecord / _abs / ensure) is acceptable
    // and expected.
    const clean = {
      str: 'x',
      num: 42,
      bool: true,
      nul: null,
      arr: [1, 'two', { three: 3 }],
      nested: { deeper: { deepest: 'leaf' } },
    };
    await expect(
      mergeFrontmatterFn(projectRoot, ensureStub, 'research/x.md', clean),
    ).rejects.not.toThrow(/is not YAML-serializable/);
  });
});
