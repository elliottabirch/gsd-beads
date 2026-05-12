// src/helpers/deriveDiskStatus.mjs
/**
 * D-07: 7-value disk_status enum priority chain.
 *
 * Carry-forward from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:305-313.
 * Phase 5 deliverable; unchanged in Phase 6 (D-11 verbatim extraction).
 *
 * See `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` for
 * the original ship history.
 *
 * planCount/summaryCount come from bd (D-06); hasContext/hasResearch from disk.
 * Priority: no_directory → complete → partial → planned → researched → discussed → empty.
 * @param {{planCount:number, summaryCount:number, hasContext:boolean, hasResearch:boolean, dirExists:boolean}} opts
 * @returns {'complete'|'partial'|'planned'|'researched'|'discussed'|'empty'|'no_directory'}
 */
export function deriveDiskStatus({ planCount, summaryCount, hasContext, hasResearch, dirExists }) {
  if (!dirExists) return 'no_directory';
  if (planCount > 0 && summaryCount >= planCount) return 'complete';
  if (summaryCount > 0) return 'partial';
  if (planCount > 0) return 'planned';
  if (hasResearch) return 'researched';
  if (hasContext) return 'discussed';
  return 'empty';
}
