/**
 * CR-04 regression: concurrent `withTransaction` callers must NOT share
 * buffer state.
 *
 * Before the AsyncLocalStorage fix, transaction context was stored on a
 * `WeakMap<BdRunner, TxnContext>`. Two async callers that both invoked
 * `adapter.withTransaction(...)` WITHOUT awaiting the first would collide:
 * the second would see `depth > 0` (left by the first's in-flight await),
 * JOIN the outer buffer, queue its ops onto the wrong transaction's log,
 * and commit them under the WRONG transaction's identity. Silent
 * cross-contamination and mis-attributed partial-commit errors.
 *
 * Post-fix (AsyncLocalStorage): each `withTransaction` call runs in its
 * own async-hooks context. Concurrent callers each get an isolated buffer;
 * nested calls within the SAME async flow still JOIN the outer buffer
 * (reentrancy semantics preserved — see tests/smoke/transaction.test.ts).
 *
 * This is a unit test (does not spawn bd) — it exercises the ALS context
 * lifecycle directly against the txn.ts helpers with a mock BdRunner that
 * records the argv it would have run. Running against a live bd would
 * also work but is unnecessary for asserting the isolation invariant.
 */

import { describe, it, expect } from 'vitest';
import { withTransaction, queueOrRun, peekBuffer, isTxnActive } from '../../src/txn.js';
import type { BdRunner } from '../../src/bd/helper.js';
import type { BeadsRuntimeState } from '../../src/init.js';

/**
 * Minimal BdRunner stand-in. txn.ts only touches `bd.run(args, opts)` during
 * commit replay; the peek/queue helpers identify it by object identity
 * (referential equality inside the WeakMap / ALS context match). A bare
 * object with a stub `run` suffices for the concurrency isolation test.
 */
function makeMockBd(recorded: string[][]): BdRunner {
  const mock = {
    run(args: string[]) {
      recorded.push([...args]);
      return undefined;
    },
  } as unknown as BdRunner;
  return mock;
}

function makeState(bd: BdRunner): BeadsRuntimeState {
  return { beadsRoot: '/tmp/mock-beads-root', bd };
}

describe('withTransaction — concurrent isolation (CR-04 regression)', () => {
  it('two concurrent withTransaction calls do NOT share buffer (CR-04 fix)', async () => {
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    // Resolvers we use to orchestrate interleaving: each txn awaits its
    // own barrier before queueing its op. Launching both with Promise.all
    // then releasing them in a controlled order drives the callers
    // through the same interleaving pattern that corrupted the
    // pre-CR-04 WeakMap-keyed buffer.
    let releaseA: () => void = () => {};
    let releaseB: () => void = () => {};
    const barrierA = new Promise<void>((r) => (releaseA = r));
    const barrierB = new Promise<void>((r) => (releaseB = r));

    const txnA = withTransaction(state, async () => {
      await barrierA;
      queueOrRun(bd, 'mark', ['update', 'A', '--add-label', 'txn-A'], { parseJson: false });
      return 'A';
    });

    const txnB = withTransaction(state, async () => {
      await barrierB;
      queueOrRun(bd, 'mark', ['update', 'B', '--add-label', 'txn-B'], { parseJson: false });
      return 'B';
    });

    // Release B first — its queued op must NOT land in A's buffer.
    releaseB();
    // Yield twice so txnB's async body completes + commit replay runs.
    await Promise.resolve();
    await Promise.resolve();
    releaseA();

    const [a, b] = await Promise.all([txnA, txnB]);
    expect(a).toBe('A');
    expect(b).toBe('B');

    // Both ops committed (one each, to the correct transaction — their
    // order at the bd layer depends on scheduling but the SET of replayed
    // argvs must match exactly ONE label-A + ONE label-B; neither buffer
    // contains both).
    const labels = recorded.map((args) => args[args.length - 1]);
    expect(labels.sort()).toEqual(['txn-A', 'txn-B']);
    expect(recorded.length).toBe(2);
  });

  it('nested withTransaction within the SAME async flow still JOINs buffer', async () => {
    // Reentrancy semantics are preserved: a helper that calls another
    // helper that also wraps withTransaction should see the outer buffer,
    // not allocate a fresh one.
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    let innerRan = false;
    await withTransaction(state, async () => {
      queueOrRun(bd, 'outer', ['update', 'outer', '--add-label', 'L1'], { parseJson: false });
      await withTransaction(state, async () => {
        innerRan = true;
        queueOrRun(bd, 'inner', ['update', 'inner', '--add-label', 'L2'], { parseJson: false });
        // Inside the nested txn, peekBuffer must show BOTH ops — they
        // share the buffer.
        expect(peekBuffer(bd).length).toBe(2);
        expect(isTxnActive(bd)).toBe(true);
      });
      // Still inside outer — buffer still shared.
      expect(peekBuffer(bd).length).toBe(2);
    });

    expect(innerRan).toBe(true);
    // Commit replayed both ops in order.
    expect(recorded).toEqual([
      ['update', 'outer', '--add-label', 'L1'],
      ['update', 'inner', '--add-label', 'L2'],
    ]);
  });

  it('concurrent rollback on one txn does not affect the other', async () => {
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    const txnA = withTransaction(state, async () => {
      queueOrRun(bd, 'mark', ['update', 'A', '--add-label', 'txn-A'], { parseJson: false });
      // Yield so B gets scheduled.
      await Promise.resolve();
      return 'A';
    });

    const txnB = withTransaction(state, async () => {
      queueOrRun(bd, 'mark', ['update', 'B', '--add-label', 'txn-B'], { parseJson: false });
      await Promise.resolve();
      throw new Error('B rolled back');
    });

    const results = await Promise.allSettled([txnA, txnB]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');

    // Only A's op should have committed. B rolled back → its queued op
    // must NOT appear in `recorded`.
    const labels = recorded.map((args) => args[args.length - 1]);
    expect(labels).toEqual(['txn-A']);
    expect(recorded.length).toBe(1);
  });

  it('isTxnActive is false OUTSIDE the withTransaction callback', async () => {
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    expect(isTxnActive(bd)).toBe(false);
    await withTransaction(state, async () => {
      expect(isTxnActive(bd)).toBe(true);
    });
    expect(isTxnActive(bd)).toBe(false);
  });
});

describe('withTransaction — nested dryRun semantics (WR-2 iter-2 regression)', () => {
  it('rejects nested { dryRun: true } when outer is non-dryRun', async () => {
    // Before the fix: inner `opts.dryRun` was silently ignored, inner
    // ops queued to outer buffer and committed with outer. This is the
    // OPPOSITE of dry-run semantics and would bite any helper that
    // composes `withTransaction(fn, { dryRun: true })` probes inside a
    // real transaction. Option (a) / fail-loud: throw a TypeError so
    // the caller owns the dry-run decision at the outermost level.
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    let innerEntered = false;
    await expect(
      withTransaction(state, async () => {
        queueOrRun(bd, 'outer', ['update', 'outer'], { parseJson: false });
        await withTransaction(
          state,
          async () => {
            innerEntered = true; // Should NOT reach here.
          },
          { dryRun: true },
        );
      }),
    ).rejects.toThrow(
      /\{ dryRun: true \} cannot be nested inside a non-dryRun transaction/,
    );
    expect(innerEntered).toBe(false);
    // Outer's op must NOT have committed — the inner throw propagates
    // out and triggers outer rollback (buffer discarded).
    expect(recorded).toEqual([]);
  });

  it('allows nested { dryRun: true } when outer is ALSO dryRun (redundant but compatible)', async () => {
    // If the outer is already dry-run, the inner's dryRun request is
    // redundant — buffer discards on outer exit regardless. Accept
    // silently (no false reject) since the semantic is preserved.
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    let innerEntered = false;
    await withTransaction(
      state,
      async () => {
        queueOrRun(bd, 'outer', ['update', 'outer'], { parseJson: false });
        await withTransaction(
          state,
          async () => {
            innerEntered = true;
            queueOrRun(bd, 'inner', ['update', 'inner'], { parseJson: false });
          },
          { dryRun: true },
        );
      },
      { dryRun: true },
    );
    expect(innerEntered).toBe(true);
    // Outer dryRun → nothing replays.
    expect(recorded).toEqual([]);
  });

  it('nested call WITHOUT dryRun is unaffected — JOINs outer buffer as before', async () => {
    // Reentry without opts.dryRun is the common case and must still
    // work. Guards against an over-broad fix that rejects ALL nested
    // calls.
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    await withTransaction(state, async () => {
      queueOrRun(bd, 'outer', ['update', 'outer'], { parseJson: false });
      await withTransaction(state, async () => {
        queueOrRun(bd, 'inner', ['update', 'inner'], { parseJson: false });
      });
    });
    expect(recorded).toEqual([
      ['update', 'outer'],
      ['update', 'inner'],
    ]);
  });

  it('root-level { dryRun: true } still works (no regression)', async () => {
    const recorded: string[][] = [];
    const bd = makeMockBd(recorded);
    const state = makeState(bd);

    await withTransaction(
      state,
      async () => {
        queueOrRun(bd, 'op', ['update', 'thing'], { parseJson: false });
      },
      { dryRun: true },
    );
    // Discarded on exit.
    expect(recorded).toEqual([]);
  });
});
