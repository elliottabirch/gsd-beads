// src/helpers/parsePhaseId.mjs
/**
 * D-02: Strip "phase-id:" prefix and zero-padding; preserve decimal segments.
 *
 * Carry-forward from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:293-296.
 * Phase 5 deliverable; unchanged in Phase 6 (D-11 verbatim extraction).
 *
 * See `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` for
 * the original ship history.
 *
 * @param {string|null|undefined} label - e.g. "phase-id:05" or "phase-id:72.1"
 * @returns {string|null} - e.g. "5" or "72.1" or null
 */
export function parsePhaseId(label) {
  if (!label) return null;
  return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
}
