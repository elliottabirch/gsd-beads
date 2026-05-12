// src/helpers/parsePhaseId.ts
// Ported from sibling src/helpers/parsePhaseId.mjs (v0.2 Phase 5 deliverable,
// Phase 4 D-02 semantics). Direct TS port — semantics preserved verbatim.
//
// History: `git log --follow src/helpers/parsePhaseId.ts` traces back through
// the .mjs origin.

/**
 * D-02: Strip "phase-id:" prefix and zero-padding; preserve decimal segments.
 *
 * Returns null for empty / null / undefined input (D-02 no-op semantics).
 *
 * Examples:
 *   parsePhaseId('phase-id:05')   → '5'
 *   parsePhaseId('phase-id:72.1') → '72.1'
 *   parsePhaseId('phase-id:00')   → '0'
 *   parsePhaseId(null)            → null
 *
 * @param label - bd label value (e.g. 'phase-id:05' or 'phase-id:72.1')
 * @returns normalized phase id string, or null if input is falsy
 */
export function parsePhaseId(label: string | null | undefined): string | null {
  if (!label) return null;
  return label.replace(/^phase-id:/, '').replace(/^0+(\d)/, '$1');
}
