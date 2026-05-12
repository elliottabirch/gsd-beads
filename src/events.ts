/**
 * recordState* family implementations — BEADS-02.
 *
 * Three event families (StorageAdapter contract):
 *   - recordStateAppend(event)   → new entry into a list/log
 *   - recordStateMutation(event) → modify an existing collection item
 *   - recordStateSignal(event)   → write/remove a stateless flag
 *
 * All three return `StateWriteOutcome` (three-state contract D-2026-05-10-08):
 *   - { applied: true }                            — data landed
 *   - { applied: true, created_section: string }   — data landed AND helper scaffolded
 *   - { applied: false, reason: 'duplicate' }      — dedupe hit
 *   - { applied: false, reason: 'nothing_to_remove' } — structural no-op on remove
 *
 * Dispatch under D-MAPPING Outcome A (DECISIONS.md D-2026-05-12-OQ06-MAPPING):
 *   - High-freq AppendEvent (session / quick_task / forensic_session):
 *       `bd comments add <milestoneBead> --author gsd:event:<type> <payload_json>`
 *       (Landmine 4 discipline — v1.0.4 hard-rejects `--label` with exit 1).
 *   - Low-freq AppendEvent (decision / metric / roadmap_evolution):
 *       `bd remember <payload_json> --key <milestone>:<type>:<id>`
 *       (dedupe via `bd recall <key>`).
 *   - MutationEvent:
 *       blocker_added/resolved → label add/remove on the milestone bead;
 *       todo_count_update → `bd remember ... --key <milestone>:todo_count:current`;
 *       deferred_items:add/remove → `bd remember`/`bd forget` on keyed memory.
 *   - SignalEvent:
 *       waiting → label add `gsd:waiting:<waitType>` on milestone bead;
 *       resume  → label remove all `gsd:waiting:*` on milestone bead.
 *
 * Transactional wrapping:
 *   - Every family method wraps its bd calls in `withTransaction` so a
 *     multi-spawn failure rolls back.
 *
 * created_section policy (Plan 06-06 ADR D-2026-05-12-OQ06-CREATED-SECTION):
 *   - Under Outcome A, bd metadata sub-records are set via `bd update
 *     --metadata <json>` (OVERWRITE semantics) or `--set-metadata key=value`.
 *     These do not have a MarkdownAdapter-style "heading scaffolding"
 *     semantic — the absence of a sub-key is invisible to the caller.
 *     Policy: BeadsAdapter NEVER emits `created_section`. Always the
 *     bare `{ applied: true }` on first write. Documented in ADR.
 *
 * Exhaustive dispatch:
 *   - Every `switch(event.type)` ends with a `const _exhaustive: never = event`
 *     check (SP-5). Adding a new AppendEvent / MutationEvent / SignalEvent
 *     variant without a corresponding branch will fail the typecheck —
 *     compile-time coverage of the 16-case matrix.
 *
 * BEADS_ACTOR discipline: BdRunner's baseEnv enforces BEADS_ACTOR=seed
 * (Landmine 11 — CONF-03 byte-identity). events.ts does not override env.
 */

import type {
  AppendEvent,
  MutationEvent,
  SignalEvent,
} from 'get-shit-done-cc/adapters/state-event-types.js';
import type { StateWriteOutcome } from 'get-shit-done-cc/adapters/types.js';
import type { BeadsRuntimeState } from './init.js';
import { BeadsEmpty, BeadsUnavailableError } from './bd/errors.js';
import { withTransaction, queueOrRun, isTxnActive, peekBuffer } from './txn.js';

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Active milestone key. For v1.0 we default to `v1.0`. The seed fixture
 * ships a `gsd:milestone + version:v1.0` bead; production callers who
 * operate across milestones would extend this helper to read from a
 * well-known memory key or a STATE.md frontmatter lookup. Deferred to
 * Phase 6.1 / Phase 7 alongside the dedicated `currentMilestone()` API.
 */
async function _getCurrentMilestone(_state: BeadsRuntimeState): Promise<string> {
  return 'v1.0';
}

/**
 * Resolve the milestone bead's ID for a given milestone key (e.g. `v1.0`).
 * Returns null if no matching bead exists (e.g. a harness ran without
 * seeding). Callers translate null into `{applied: false, reason:
 * 'nothing_to_remove'}` — a gentle failure rather than a thrown error,
 * since the state-event layer is not responsible for scaffolding the
 * milestone bead itself.
 */
async function _resolveMilestoneBead(
  state: BeadsRuntimeState,
  milestoneKey: string,
): Promise<string | null> {
  try {
    const raw = state.bd.run([
      'list',
      '-l',
      'gsd:milestone',
      '-l',
      `version:${milestoneKey}`,
      '--json',
      '--all',
      '-n',
      '0',
    ]);
    const items = Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
    return items.length > 0 ? items[0]!.id : null;
  } catch (e) {
    if (e instanceof BeadsEmpty) return null;
    throw e;
  }
}

/**
 * Stable hash of a JSON-serializable payload. Used to derive a bounded
 * memory-key suffix so `{milestone}:{type}:{deriveEventId(payload)}`
 * deduplicates identical payloads without pulling in a full hash library.
 *
 * Djb2-style; collision-resistant enough for dedupe at event-family
 * frequencies (see threat-model T-06-06-01 — dedupe false-positive
 * treated as `{applied: false, reason: 'duplicate'}`, which is a valid
 * outcome for a record that already matches byte-for-byte).
 */
function _deriveEventId(payload: unknown): string {
  const json = JSON.stringify(payload) ?? '';
  let h = 5381;
  for (let i = 0; i < json.length; i++) {
    h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Attempt `bd recall <key>`. Returns the memory payload on hit, or null if
 * the key doesn't exist. bd v1.0.4 exits 1 with stderr "No memory with key"
 * on miss; BdRunner surfaces this as a `BeadsUnavailableError`, which we
 * translate to null here. Any other bd failure re-throws.
 */
function _bdRecallOrNull(state: BeadsRuntimeState, key: string): string | null {
  try {
    const r = state.bd.run(['recall', key], { parseJson: false });
    if (r === null || r === undefined) return null;
    return typeof r === 'string' ? r : String(r);
  } catch (e) {
    // bd returns exit 1 on missing key. Distinguish by message pattern to
    // avoid swallowing genuine errors (lock / corrupt / other shell-out
    // failures).
    if (e instanceof BeadsUnavailableError && /No memory with key/i.test(e.message)) {
      return null;
    }
    throw e;
  }
}

/**
 * Check whether the buffer of the currently-active txn (if any) already
 * contains an op that would dedupe against the given key. Mirrors the
 * "own-writes-visible-during-txn" invariant the MarkdownAdapter shadow-dir
 * journal provides for its own consumers. Without this check, two
 * recordStateAppend calls on the same event inside a txn would both pass
 * the dedupe guard (since bd hasn't seen either yet) and both land after
 * commit. With it, the second one correctly reports `duplicate`.
 */
function _bufferContainsRememberKey(state: BeadsRuntimeState, key: string): boolean {
  if (!isTxnActive(state.bd)) return false;
  return peekBuffer(state.bd).some((op) => {
    if (op.kind !== 'remember') return false;
    // argv shape: ['remember', '<payload>', '--key', '<key>']
    const keyIdx = op.args.indexOf('--key');
    if (keyIdx === -1 || keyIdx + 1 >= op.args.length) return false;
    return op.args[keyIdx + 1] === key;
  });
}

function _bufferContainsCommentFor(
  state: BeadsRuntimeState,
  beadId: string,
  author: string,
  text: string,
): boolean {
  if (!isTxnActive(state.bd)) return false;
  return peekBuffer(state.bd).some((op) => {
    if (op.kind !== 'comments.add') return false;
    // argv shape: ['comments', 'add', '<beadId>', '--author', '<author>', '<text>']
    if (op.args.length < 6) return false;
    if (op.args[0] !== 'comments' || op.args[1] !== 'add') return false;
    if (op.args[2] !== beadId) return false;
    const aIdx = op.args.indexOf('--author');
    if (aIdx === -1 || aIdx + 1 >= op.args.length) return false;
    if (op.args[aIdx + 1] !== author) return false;
    // text is the final positional arg
    return op.args[op.args.length - 1] === text;
  });
}

function _bufferContainsLabelOp(
  state: BeadsRuntimeState,
  beadId: string,
  label: string,
  direction: 'add' | 'remove',
): boolean {
  if (!isTxnActive(state.bd)) return false;
  const kind = direction === 'add' ? 'label.add' : 'label.remove';
  return peekBuffer(state.bd).some((op) => {
    if (op.kind !== kind) return false;
    // argv shape: ['update', '<beadId>', '--add-label' | '--remove-label', '<label>']
    if (op.args.length < 4) return false;
    if (op.args[0] !== 'update') return false;
    if (op.args[1] !== beadId) return false;
    if (op.args[3] !== label) return false;
    return true;
  });
}

/**
 * Inspect labels on a bead, including any pending buffered label ops from
 * the active txn. Returns the effective label set the next observer would
 * see if all buffered ops committed successfully.
 */
function _getEffectiveLabels(state: BeadsRuntimeState, beadId: string): Set<string> {
  // Base: whatever bd shows today.
  let labels: Set<string>;
  try {
    const shown = state.bd.show(beadId);
    labels = new Set((shown.labels as string[] | undefined) ?? []);
  } catch (e) {
    if (e instanceof BeadsEmpty) {
      labels = new Set();
    } else {
      throw e;
    }
  }
  // Overlay: pending buffered label ops.
  if (isTxnActive(state.bd)) {
    for (const op of peekBuffer(state.bd)) {
      if (op.args[0] !== 'update' || op.args[1] !== beadId) continue;
      if (op.kind === 'label.add' && op.args.length >= 4) {
        labels.add(op.args[3]!);
      } else if (op.kind === 'label.remove' && op.args.length >= 4) {
        labels.delete(op.args[3]!);
      }
    }
  }
  return labels;
}

// ─── AppendEvent ────────────────────────────────────────────────────────

export async function recordStateAppend(
  state: BeadsRuntimeState,
  event: AppendEvent,
): Promise<StateWriteOutcome> {
  return withTransaction(state, async () => {
    switch (event.type) {
      case 'session':
      case 'quick_task':
      case 'forensic_session': {
        // High-frequency → bd comments add --author gsd:event:<type>
        // Landmine 4 discipline: NEVER --label (v1.0.4 hard-rejects; v1.0.3
        // silently dropped). --author is the ONLY structured slot for
        // high-freq append-typing.
        const milestone = await _getCurrentMilestone(state);
        const milestoneBead = await _resolveMilestoneBead(state, milestone);
        if (!milestoneBead) {
          // No milestone bead present — cannot append. Gentle signal.
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        const author = `gsd:event:${event.type}`;
        const payloadJson = JSON.stringify(event.payload);

        // Dedupe: consult bd comments + any pending buffered comment ops.
        let existing: Array<{ author: string; text: string }> = [];
        try {
          const raw = state.bd.run(['comments', milestoneBead, '--json']);
          existing = Array.isArray(raw)
            ? (raw as Array<{ author: string; text: string }>)
            : [];
        } catch (e) {
          if (!(e instanceof BeadsEmpty)) throw e;
        }
        const bdDup = existing.some(
          (c) => c.author === author && c.text === payloadJson,
        );
        const bufDup = _bufferContainsCommentFor(state, milestoneBead, author, payloadJson);
        if (bdDup || bufDup) {
          return { applied: false, reason: 'duplicate' } as const;
        }

        queueOrRun(
          state.bd,
          'comments.add',
          ['comments', 'add', milestoneBead, '--author', author, payloadJson],
          { parseJson: false },
        );
        // Pitfall 7 / ADR D-2026-05-12-OQ06-CREATED-SECTION: BeadsAdapter
        // NEVER emits `created_section`. High-freq comments have no
        // sectioned-heading analog.
        return { applied: true } as const;
      }

      case 'decision':
      case 'metric':
      case 'roadmap_evolution': {
        // Low-frequency → bd remember <json> --key <milestone>:<type>:<id>
        const milestone = await _getCurrentMilestone(state);
        const eventId = _deriveEventId(event.payload);
        const key = `${milestone}:${event.type}:${eventId}`;
        const payloadJson = JSON.stringify(event.payload);

        // Dedupe: compare existing memory payload AND buffer. bd remember
        // is update-in-place on existing keys — only skip when the content
        // is byte-identical; otherwise allow overwrite (idempotent for
        // callers who re-emit the same event).
        const existing = _bdRecallOrNull(state, key);
        if (existing !== null && existing.trim() === payloadJson) {
          return { applied: false, reason: 'duplicate' } as const;
        }
        if (_bufferContainsRememberKey(state, key)) {
          return { applied: false, reason: 'duplicate' } as const;
        }

        queueOrRun(
          state.bd,
          'remember',
          ['remember', payloadJson, '--key', key],
          { parseJson: false },
        );
        // ADR D-2026-05-12-OQ06-CREATED-SECTION: never emit created_section.
        return { applied: true } as const;
      }

      default: {
        // SP-5 exhaustive check — compile-time coverage of AppendEvent union.
        const _exhaustive: never = event;
        throw new Error(
          `Unknown AppendEvent.type: ${(event as { type: string }).type}`,
        );
      }
    }
  });
}

// ─── MutationEvent ──────────────────────────────────────────────────────

export async function recordStateMutation(
  state: BeadsRuntimeState,
  event: MutationEvent,
): Promise<StateWriteOutcome> {
  return withTransaction(state, async () => {
    switch (event.type) {
      case 'blocker_added': {
        const milestone = await _getCurrentMilestone(state);
        const milestoneBead = await _resolveMilestoneBead(state, milestone);
        if (!milestoneBead) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        const label = `gsd:blocker:${_deriveEventId({ text: event.payload.text })}`;
        const effective = _getEffectiveLabels(state, milestoneBead);
        if (effective.has(label)) {
          return { applied: false, reason: 'duplicate' } as const;
        }
        queueOrRun(
          state.bd,
          'label.add',
          ['update', milestoneBead, '--add-label', label],
          { parseJson: false },
        );
        return { applied: true } as const;
      }

      case 'blocker_resolved': {
        const milestone = await _getCurrentMilestone(state);
        const milestoneBead = await _resolveMilestoneBead(state, milestone);
        if (!milestoneBead) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        const label = `gsd:blocker:${_deriveEventId({ text: event.payload.text })}`;
        const effective = _getEffectiveLabels(state, milestoneBead);
        if (!effective.has(label)) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        queueOrRun(
          state.bd,
          'label.remove',
          ['update', milestoneBead, '--remove-label', label],
          { parseJson: false },
        );
        return { applied: true } as const;
      }

      case 'todo_count_update': {
        const milestone = await _getCurrentMilestone(state);
        const key = `${milestone}:todo_count:current`;
        const payloadJson = JSON.stringify(event.payload);
        const existing = _bdRecallOrNull(state, key);
        if (existing !== null && existing.trim() === payloadJson) {
          return { applied: false, reason: 'duplicate' } as const;
        }
        if (_bufferContainsRememberKey(state, key)) {
          // If the buffer has an identical pending write with the SAME payload,
          // dedupe. With a different payload, the subsequent remember replaces
          // the buffered entry on commit (bd remember is update-in-place).
          const bufOps = peekBuffer(state.bd).filter(
            (op) =>
              op.kind === 'remember' &&
              op.args.length >= 4 &&
              op.args[op.args.indexOf('--key') + 1] === key,
          );
          const lastBufPayload = bufOps.length > 0 ? bufOps[bufOps.length - 1]!.args[1] : null;
          if (lastBufPayload === payloadJson) {
            return { applied: false, reason: 'duplicate' } as const;
          }
        }
        queueOrRun(
          state.bd,
          'remember',
          ['remember', payloadJson, '--key', key],
          { parseJson: false },
        );
        return { applied: true } as const;
      }

      case 'deferred_items': {
        const milestone = await _getCurrentMilestone(state);
        const key = `${milestone}:deferred_items:list`;
        const existing = _bdRecallOrNull(state, key);
        const currentItems: string[] = (() => {
          if (existing === null) return [];
          try {
            const parsed = JSON.parse(existing.trim());
            return Array.isArray(parsed) ? (parsed as string[]) : [];
          } catch {
            return [];
          }
        })();

        if (event.payload.action === 'add') {
          // Dedupe: if every item already present, duplicate. Otherwise
          // overwrite with the union.
          const toAdd = event.payload.items;
          const currentSet = new Set(currentItems);
          const newItems = toAdd.filter((i) => !currentSet.has(i));
          if (newItems.length === 0) {
            return { applied: false, reason: 'duplicate' } as const;
          }
          const merged = [...currentItems, ...newItems];
          queueOrRun(
            state.bd,
            'remember',
            ['remember', JSON.stringify(merged), '--key', key],
            { parseJson: false },
          );
          return { applied: true } as const;
        }
        // action === 'remove'
        const toRemove = new Set(event.payload.items);
        const remaining = currentItems.filter((i) => !toRemove.has(i));
        if (remaining.length === currentItems.length) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        if (remaining.length === 0) {
          // Structural: `bd forget` removes the key entirely when empty.
          queueOrRun(state.bd, 'forget', ['forget', key], { parseJson: false });
        } else {
          queueOrRun(
            state.bd,
            'remember',
            ['remember', JSON.stringify(remaining), '--key', key],
            { parseJson: false },
          );
        }
        return { applied: true } as const;
      }

      default: {
        const _exhaustive: never = event;
        throw new Error(
          `Unknown MutationEvent.type: ${(event as { type: string }).type}`,
        );
      }
    }
  });
}

// ─── SignalEvent ────────────────────────────────────────────────────────

export async function recordStateSignal(
  state: BeadsRuntimeState,
  event: SignalEvent,
): Promise<StateWriteOutcome> {
  return withTransaction(state, async () => {
    switch (event.type) {
      case 'waiting': {
        const milestone = await _getCurrentMilestone(state);
        const milestoneBead = await _resolveMilestoneBead(state, milestone);
        if (!milestoneBead) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        const label = `gsd:waiting:${event.payload.waitType}`;
        const effective = _getEffectiveLabels(state, milestoneBead);
        if (effective.has(label)) {
          return { applied: false, reason: 'duplicate' } as const;
        }
        queueOrRun(
          state.bd,
          'label.add',
          ['update', milestoneBead, '--add-label', label],
          { parseJson: false },
        );
        return { applied: true } as const;
      }

      case 'resume': {
        const milestone = await _getCurrentMilestone(state);
        const milestoneBead = await _resolveMilestoneBead(state, milestone);
        if (!milestoneBead) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        const effective = _getEffectiveLabels(state, milestoneBead);
        const waiting = Array.from(effective).filter((l) => l.startsWith('gsd:waiting:'));
        if (waiting.length === 0) {
          return { applied: false, reason: 'nothing_to_remove' } as const;
        }
        for (const label of waiting) {
          queueOrRun(
            state.bd,
            'label.remove',
            ['update', milestoneBead, '--remove-label', label],
            { parseJson: false },
          );
        }
        return { applied: true } as const;
      }

      default: {
        const _exhaustive: never = event;
        throw new Error(
          `Unknown SignalEvent.type: ${(event as { type: string }).type}`,
        );
      }
    }
  });
}
