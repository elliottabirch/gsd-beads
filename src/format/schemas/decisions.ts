// src/format/schemas/decisions.ts
// Per-canonical-file schema for DECISIONS.md (D-MAPPING Outcome A).
//
// Scope: typed declaration. DECISIONS.md is an append-only log of ADRs
// (Architectural Decision Records) with ID-prefixed headings like
// `## D-2026-05-12-OQ06-MAPPING`. Read access uses generic section.ts;
// write access is append-only via `updateSection(..., mode='append')`.
// No per-decision parser body lives here — each ADR is opaque prose
// from the storage layer's perspective.

import type { FrontmatterValue } from '../frontmatter.js';

export const DECISIONS_KIND = 'decisions' as const;

/**
 * A single ADR entry within DECISIONS.md.
 * `id` is the heading text after the L2 hash (e.g. 'D-2026-05-12-OQ06-MAPPING').
 * `body` is the prose between this heading and the next L2 heading.
 */
export interface DecisionEntry {
  id: string;
  body: string;
}

/**
 * Canonical DECISIONS.md record shape.
 */
export interface DecisionsRecord {
  kind: typeof DECISIONS_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  entries: DecisionEntry[];
}
