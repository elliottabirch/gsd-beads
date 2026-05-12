// src/helpers/deriveDiskStatus.ts
// Ported from sibling src/helpers/deriveDiskStatus.mjs (v0.2 Phase 5
// deliverable, D-07 priority chain). Direct TS port — priority-chain
// ordering preserved verbatim against sibling's `.mjs` body.
//
// History: `git log --follow src/helpers/deriveDiskStatus.ts` traces back
// through the .mjs origin.

export type DiskStatus =
  | 'no_directory'
  | 'complete'
  | 'partial'
  | 'planned'
  | 'researched'
  | 'discussed'
  | 'empty';

export interface DiskStatusInput {
  planCount: number;
  summaryCount: number;
  hasContext: boolean;
  hasResearch: boolean;
  dirExists: boolean;
}

/**
 * D-07: 7-value disk_status enum with priority chain.
 *
 * planCount/summaryCount are bd-derived (D-06); hasContext/hasResearch are
 * disk-derived. Priority order (first match wins):
 *
 *   no_directory → complete → partial → planned → researched → discussed → empty
 *
 * Sibling semantics preserved verbatim — in particular `summaryCount > 0`
 * alone (without planCount > 0) still returns 'partial', matching sibling's
 * behavior for orphan-summary detection.
 *
 * WR-08 caller-semantic note (Phase 7 CONFORM-04 follow-up):
 *   The 'partial' value conflates two distinct conditions:
 *     (a) summaryCount > 0 AND summaryCount < planCount
 *         (typical: some plans done, some not)
 *     (b) summaryCount > 0 AND planCount === 0
 *         (orphan summary — summaries without any plan)
 *   Downstream consumers that interpret 'partial' strictly as (a) will
 *   mis-route orphan-summary cases. v1.0 keeps the collapsed semantic
 *   for sibling-carry-forward parity; Phase 7 may introduce a distinct
 *   'orphan-summary' enum value once consumers are audited.
 *   `tests/unit/deriveDiskStatus.test.ts` locks in the current semantic
 *   so unintentional drift is caught in CI.
 */
export function deriveDiskStatus(input: DiskStatusInput): DiskStatus {
  const { planCount, summaryCount, hasContext, hasResearch, dirExists } = input;
  if (!dirExists) return 'no_directory';
  if (planCount > 0 && summaryCount >= planCount) return 'complete';
  if (summaryCount > 0) return 'partial';
  if (planCount > 0) return 'planned';
  if (hasResearch) return 'researched';
  if (hasContext) return 'discussed';
  return 'empty';
}
