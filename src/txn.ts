/**
 * withTransaction + snapshot + restore — D-TXN Outcome A (in-memory buffer).
 *
 * Per Plan 06-03 SPIKE-RESULTS §7 and DECISIONS.md
 * `D-2026-05-12-OQ06-TXN`: BeadsAdapter ships Outcome A (in-memory write
 * buffer). Outcome B (store-clone + bookmark) is INFEASIBLE in bd v1.0.4
 * (`bd dolt` lacks `clone/branch/bookmark`). Outcome C (file-snapshot via
 * `bd export` + `bd init --from-jsonl`) is feasible but rejected by user
 * override for scope-simplicity reasons. Outcome A documented mid-txn
 * partial-commit gap → Phase 6.1 follow-up (Deferred-04).
 *
 * Capabilities:
 *   - transaction: true  (buffer doubles as dry-run — pipeline.ts needs it)
 *   - snapshot:    false (Outcome A has no dedicated snapshot/restore)
 *
 * Scope:
 *   - bd-tier writes are buffered during an active txn; replayed on commit;
 *     discarded on rollback.
 *   - disk-tier writes (atomicWriteFile) pass THROUGH directly and are NOT
 *     rolled back on error. Documented here and on MarkdownAdapter's Outcome
 *     C analog; acceptable per Phase 6 scope.
 *
 * Reentrancy:
 *   - Nested `withTransaction` JOINS the outer buffer (matches MarkdownAdapter
 *     shadow-dir reentrancy — Phase 5 D-04/D-10). Nested commit is a no-op;
 *     only the outer-most call replays the buffer.
 *
 * Mid-txn partial-commit gap (Deferred-04, Phase 6.1):
 *   - If the commit phase fails after k-of-N ops applied, bd is left with
 *     ops 1..k applied and ops (k+1)..N unapplied. Outcome A cannot roll
 *     these back — no snapshot was taken. The commit phase surfaces a
 *     structured `BeadsPartialCommitError` with {committedOps, failedOp,
 *     remainingOps} so callers can decide recovery policy.
 *
 * BdRunner identity:
 *   - Active txn state is keyed by `BdRunner` instance (WeakMap). Each
 *     BeadsAdapter constructs a single BdRunner via `_ensureBd`, so a
 *     per-adapter transaction context is the result.
 */

import type { BdRunner, BdRunOptions } from './bd/helper.js';
import type { BeadsRuntimeState } from './init.js';

/**
 * A single buffered bd operation. Stored as raw argv so commit is a straight
 * replay through BdRunner.run(). Callers that need structured inspection can
 * also peek at `kind` for dedupe purposes during an active txn.
 */
export interface BufferedOp {
  /** Human-readable tag — 'comments.add', 'remember', 'forget', 'update.metadata', etc. */
  kind: string;
  /** Raw argv handed to `bd`. */
  args: string[];
  /** Options to pass to BdRunner.run (primarily `parseJson`). */
  opts?: BdRunOptions;
}

/**
 * Per-adapter transaction context. `depth === 0` means no active txn.
 */
interface TxnContext {
  depth: number;
  buffer: BufferedOp[];
  /** True on the outer-most call when a dry-run was requested. */
  dryRun: boolean;
  /** True once commit/rollback has begun; guards against re-entry weirdness. */
  finalizing: boolean;
}

/**
 * Structured partial-commit error surfaced when commit-phase replay fails
 * mid-way. Callers can inspect to decide on manual recovery. Matches the
 * SPIKE-RESULTS §7 "Mid-txn commit failure" recommendation.
 */
export class BeadsPartialCommitError extends Error {
  override readonly name = 'BeadsPartialCommitError';
  readonly __brand = 'BeadsPartialCommitError' as const;
  readonly committedOps: number;
  readonly failedOp: number;
  readonly remainingOps: number;
  readonly failedKind: string;
  override readonly cause?: unknown;

  constructor(args: {
    committedOps: number;
    failedOp: number;
    remainingOps: number;
    failedKind: string;
    cause?: unknown;
  }) {
    super(
      `BeadsAdapter withTransaction: commit failed after ${args.committedOps}/${args.committedOps + args.remainingOps + 1} ops. ` +
        `Failing op: #${args.failedOp} (${args.failedKind}). ${args.remainingOps} ops not applied. ` +
        `bd store is in a PARTIALLY-COMMITTED state (Outcome A known gap — Phase 6.1).`,
    );
    this.committedOps = args.committedOps;
    this.failedOp = args.failedOp;
    this.remainingOps = args.remainingOps;
    this.failedKind = args.failedKind;
    this.cause = args.cause;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'BeadsPartialCommitError'
    );
  }
}

/** BdRunner → active TxnContext map. One entry max per adapter. */
const txnStacks = new WeakMap<BdRunner, TxnContext>();

/**
 * Is a transaction currently active on this BdRunner? Consumers of
 * events.ts use this (indirectly via `queueOrRun`) to decide whether to
 * buffer an op or pass it through.
 */
export function isTxnActive(bd: BdRunner): boolean {
  const ctx = txnStacks.get(bd);
  return ctx !== undefined && ctx.depth > 0 && !ctx.finalizing;
}

/**
 * Peek at the buffered ops for the active txn on this BdRunner. Returns an
 * empty array if no txn is active. Used by recordState* dedupe logic to
 * consult pending writes for "read-your-own-writes" within a txn.
 */
export function peekBuffer(bd: BdRunner): readonly BufferedOp[] {
  const ctx = txnStacks.get(bd);
  return ctx?.buffer ?? [];
}

/**
 * Queue a bd op on the active txn, OR execute it directly if no txn is
 * active. Returns the parsed result (undefined for queued ops, since the
 * result is not yet available). For queued ops callers MUST NOT rely on
 * a return value — structure your dedupe check around `peekBuffer` before
 * calling this.
 */
export function queueOrRun(
  bd: BdRunner,
  kind: string,
  args: string[],
  opts?: BdRunOptions,
): unknown {
  const ctx = txnStacks.get(bd);
  if (ctx && ctx.depth > 0 && !ctx.finalizing) {
    ctx.buffer.push({ kind, args, opts });
    return undefined;
  }
  return bd.run(args, opts);
}

/**
 * Outcome A withTransaction. See file-header JSDoc for semantics.
 *
 * `dryRun` (optional) discards the buffer unconditionally on exit — never
 * replays. Satisfies pipeline.ts dry-run requirement.
 */
export async function withTransaction<T>(
  state: BeadsRuntimeState,
  fn: () => Promise<T>,
  opts?: { dryRun?: boolean },
): Promise<T> {
  const bd = state.bd;
  let ctx = txnStacks.get(bd);
  const dryRun = opts?.dryRun ?? false;

  if (!ctx) {
    ctx = { depth: 0, buffer: [], dryRun: false, finalizing: false };
    txnStacks.set(bd, ctx);
  }

  // Reentrant JOIN: nested withTransaction calls share the outer buffer.
  // The outer-most call owns commit/rollback.
  if (ctx.depth > 0) {
    ctx.depth++;
    try {
      return await fn();
    } finally {
      ctx.depth--;
    }
  }

  // Outer-most call: allocate a fresh buffer.
  ctx.depth = 1;
  ctx.buffer = [];
  ctx.dryRun = dryRun;
  ctx.finalizing = false;

  let result: T;
  try {
    result = await fn();
  } catch (e) {
    // Rollback: discard buffer. bd store never received these ops — no-op.
    ctx.finalizing = true;
    ctx.buffer = [];
    ctx.depth = 0;
    ctx.dryRun = false;
    ctx.finalizing = false;
    throw e;
  }

  // Commit phase — replay buffer unless dry-run.
  ctx.finalizing = true;
  const ops = ctx.buffer;
  const total = ops.length;

  if (ctx.dryRun) {
    // Discard buffer; do NOT replay. Matches MarkdownAdapter Phase 5 D-05.
    ctx.buffer = [];
    ctx.depth = 0;
    ctx.dryRun = false;
    ctx.finalizing = false;
    return result;
  }

  // Replay ops in order. Direct bd.run() — must bypass queueOrRun since the
  // outer txn is finalizing.
  let committed = 0;
  for (let i = 0; i < total; i++) {
    const op = ops[i]!;
    try {
      bd.run(op.args, op.opts);
      committed++;
    } catch (e) {
      // Clear state BEFORE throwing so a caller's catch can reliably
      // observe isTxnActive(bd) === false.
      ctx.buffer = [];
      ctx.depth = 0;
      ctx.dryRun = false;
      ctx.finalizing = false;
      throw new BeadsPartialCommitError({
        committedOps: committed,
        failedOp: i,
        remainingOps: total - i - 1,
        failedKind: op.kind,
        cause: e,
      });
    }
  }

  ctx.buffer = [];
  ctx.depth = 0;
  ctx.dryRun = false;
  ctx.finalizing = false;
  return result;
}

/**
 * `snapshot()` is NOT supported under Outcome A. The BeadsAdapter method
 * throws `UnsupportedCapabilityError` directly; this export is a stub
 * retained for structural symmetry so future Phase 6.1 migrations to
 * Outcome C can swap in a real body without changing `index.ts`.
 */
export function snapshot(_state: BeadsRuntimeState): Promise<string> {
  return Promise.reject(
    new Error(
      "BeadsAdapter.snapshot: not supported under D-TXN Outcome A (capabilities.snapshot=false). " +
        "Phase 6.1 may migrate to Outcome C (file-snapshot). See DECISIONS.md D-2026-05-12-OQ06-TXN.",
    ),
  );
}

/** Mirror of `snapshot` — Phase 6.1 migration hook. */
export function restore(_state: BeadsRuntimeState, _snapshotId: string): Promise<void> {
  return Promise.reject(
    new Error(
      "BeadsAdapter.restore: not supported under D-TXN Outcome A (capabilities.snapshot=false). " +
        "Phase 6.1 may migrate to Outcome C. See DECISIONS.md D-2026-05-12-OQ06-TXN.",
    ),
  );
}
