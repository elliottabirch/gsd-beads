// src/format/schemas/roadmap.ts
// Per-canonical-file schema for ROADMAP.md (D-MAPPING Outcome A).
//
// Scope: typed declaration + re-export of phase.ts parsers. ROADMAP.md is
// fully-parsed via format/phase.ts (parsePhaseTitle + parsePhaseDescription).
// This file is a thin typed façade that names ROADMAP.md as a distinct
// canonical shape so Plan 06-05 primitives can dispatch by route.kind.

import type { PhaseTitle, PhaseDescription } from '../phase.js';

/**
 * Discriminated-union kind tag for ROADMAP.md records.
 * Plan 06-05 primitives dispatch on route.kind === 'roadmap'.
 */
export const ROADMAP_KIND = 'roadmap' as const;

/**
 * L2-section shape for a single phase entry within ROADMAP.md.
 * Each phase is addressed by its phase number (e.g. '06') and carries
 * title + description structure exposed by format/phase.ts.
 */
export interface RoadmapPhaseRecord {
  kind: typeof ROADMAP_KIND;
  title: PhaseTitle;
  description: PhaseDescription;
}

// Re-exported for caller convenience; the canonical parsers live in
// format/phase.ts and are NOT re-implemented here.
export {
  parsePhaseTitle,
  formatPhaseTitle,
  parsePhaseDescription,
  formatPhaseDescription,
} from '../phase.js';
