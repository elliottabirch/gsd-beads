// tests/conformance/capabilities.test.mjs
// CAP-01 conformance: flag shape, rationale lint, writeBinaryAsset throw.
// Per D-16 / D-2026-04-30-05.
//
// Two invocation paths are supported:
//   - `npm run test:conformance` (glob expands to this file): top-level
//     auto-invoke at the bottom of this file fires (GSD_CONFORMANCE_AUTORUN
//     unset) and registers tests against the BeadsAdapter factory.
//   - `node tests/conformance/run.mjs` (driver): driver sets
//     GSD_CONFORMANCE_AUTORUN=0 BEFORE importing this file, suppressing
//     the auto-invoke. The driver dispatches runConformance with its own
//     factory (and any cross-adapter factories under RUN_CROSS_ADAPTER=1).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';
import { UnsupportedOperationError } from '../../src/bd/errors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADAPTER_SRC_PATH = resolve(__dirname, '../../src/adapter.mjs');

/**
 * @param {(t: import('node:test').TestContext) => Promise<{adapter: BeadsAdapter, projectRoot: string}>} makeAdapter
 * @param {string} label
 */
export function runConformance(makeAdapter, label) {
  describe(`Capabilities flag [${label}]`, () => {

    test('CAP-01 shape: 7 keys exactly with locked booleans (D-16 / D-2026-04-30-05)', () => {
      assert.ok(Object.isFrozen(BeadsAdapter.capabilities));
      assert.deepEqual(BeadsAdapter.capabilities, {
        record: true,
        section: true,
        binaryAsset: false,
        snapshot: true,
        transaction: false,
        namedDoc: true,
        commitPlanningState: false,
      });
    });

    test('CAP-01 rationale lint: each `false` value has rationale comment in src/adapter.mjs', () => {
      const src = readFileSync(ADAPTER_SRC_PATH, 'utf-8');
      // Every `false` capability MUST have a comment block (single or
      // multi-line `//` or `/** ... */`) immediately preceding it.
      // Strategy: for each `<flag>: false,` line, look at the preceding
      // 5 lines for a comment that mentions UNSUPPORTED or the flag name.
      const FLAGS_FALSE = ['binaryAsset', 'transaction', 'commitPlanningState'];
      const lines = src.split('\n');
      for (const flag of FLAGS_FALSE) {
        const idx = lines.findIndex((l) => new RegExp(`^\\s*${flag}:\\s*false`).test(l));
        assert.notEqual(idx, -1, `flag ${flag} false line not found`);
        const window = lines.slice(Math.max(0, idx - 5), idx).join('\n');
        assert.match(
          window,
          /UNSUPPORTED|unsupported/,
          `flag ${flag} missing rationale comment with "UNSUPPORTED" within 5 lines preceding`
        );
      }
    });

    test('CAP-01 writeBinaryAsset throws UnsupportedOperationError with locked message format (D-16)', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.writeBinaryAsset('docs/foo.png', new Uint8Array([1, 2, 3])),
        (err) => {
          assert.ok(err instanceof UnsupportedOperationError, 'must be UnsupportedOperationError');
          assert.match(
            err.message,
            /^BeadsAdapter\.writeBinaryAsset: not supported \(capabilities\.binaryAsset=false\)\./
          );
          return true;
        }
      );
    });

    test('CAP-01 writeBinaryAsset error has structured method + flag fields', async (t) => {
      const { adapter } = await makeAdapter(t);
      try {
        await adapter.writeBinaryAsset('docs/foo.png', new Uint8Array([1]));
        assert.fail('expected throw');
      } catch (err) {
        assert.equal(err.method, 'writeBinaryAsset');
        assert.equal(err.flag, 'binaryAsset');
      }
    });
  });
}

// Auto-invoke for `node --test tests/conformance/capabilities.test.mjs` standalone runs.
// The driver (run.mjs) imports the export instead and provides its own factories;
// this auto-invocation is skipped when GSD_CONFORMANCE_AUTORUN=0 (driver sets it).
if (process.env.GSD_CONFORMANCE_AUTORUN !== '0') {
  const { setupFreshAdapter } = await import('./fixture.mjs');
  runConformance((t) => setupFreshAdapter(t, 'beads'), 'beads');
}
