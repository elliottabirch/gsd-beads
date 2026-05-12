// src/format/schemas/spec.ts
// Per-canonical-file schema for SPEC.md (D-MAPPING Outcome A).
//
// Scope: type-only. SPEC.md is the human-authored product spec
// counterpart to AI-SPEC.md — freeform prose with L2 sections for
// Goals / Non-Goals / Open Questions / etc. No per-section parser;
// callers use section.ts generic dispatch.

import type { FrontmatterValue } from '../frontmatter.js';

export const SPEC_KIND = 'spec' as const;

export interface SpecRecord {
  kind: typeof SPEC_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  /** L2-section map (Goals, Non-Goals, Open Questions, etc.) */
  sections: Record<string, string>;
  /** Prose outside any L2 section */
  prose: string;
}
