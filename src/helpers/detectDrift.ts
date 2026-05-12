// src/helpers/detectDrift.ts
// Ported from sibling src/helpers/detectDrift.mjs (v0.2 Phase 5 deliverable,
// D-09/D-10 + refined D-06). Direct TS port — dual-channel stderr semantics
// preserved verbatim; stderr format strings match sibling's `.mjs` body
// byte-for-byte.
//
// History: `git log --follow src/helpers/detectDrift.ts` traces back through
// the .mjs origin.

export interface BdState {
  plan_count: number;
  summary_count: number;
  bd_status: string;
}

export interface DiskState {
  disk_plan_count: number;
  disk_summary_count: number;
}

export type DriftKind = 'plan_count' | 'summary_count' | 'closed_without_summary';

export interface DriftEntry {
  phase: string;
  kind: DriftKind;
  bd_value: number | string;
  disk_value: number;
}

/**
 * D-09/D-10 + refined D-06: Drift kinds — plan_count, summary_count,
 * closed_without_summary.
 *
 * Aggregate kind `completed_phases_mismatch` is computed at handler-level
 * (post-loop), not here.
 *
 * Per refined D-06 (commit 7feccb8 in sibling): summary_count is LIVE —
 * bd's "summarized plan count" (closed gsd:plan children) is compared
 * against disk *-SUMMARY.md count. The handler MUST pass distinct
 * bd_summary_count and disk_summary_count values for this comparison to be
 * meaningful (do NOT pass the same value for both).
 *
 * Emits stderr line per drift case (D-09 channel 1) and returns array
 * (channel 2).
 */
export function detectDrift(
  phase: string,
  bdState: BdState,
  diskState: DiskState,
): DriftEntry[] {
  const entries: DriftEntry[] = [];
  if (bdState.plan_count !== diskState.disk_plan_count) {
    console.error(
      `[gsd-shadow] DRIFT: phase ${phase} plan_count bd=${bdState.plan_count} disk=${diskState.disk_plan_count}`,
    );
    entries.push({
      phase,
      kind: 'plan_count',
      bd_value: bdState.plan_count,
      disk_value: diskState.disk_plan_count,
    });
  }
  if (bdState.summary_count !== diskState.disk_summary_count) {
    console.error(
      `[gsd-shadow] DRIFT: phase ${phase} summary_count bd=${bdState.summary_count} disk=${diskState.disk_summary_count}`,
    );
    entries.push({
      phase,
      kind: 'summary_count',
      bd_value: bdState.summary_count,
      disk_value: diskState.disk_summary_count,
    });
  }
  if (bdState.bd_status === 'closed' && diskState.disk_summary_count === 0) {
    console.error(`[gsd-shadow] DRIFT: phase ${phase} closed_without_summary`);
    entries.push({
      phase,
      kind: 'closed_without_summary',
      bd_value: 'closed',
      disk_value: 0,
    });
  }
  return entries;
}
