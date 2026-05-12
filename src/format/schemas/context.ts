// src/format/schemas/context.ts
// Per-canonical-file schema for <phase>-CONTEXT.md (D-MAPPING Outcome A).
//
// Scope: type-only. CONTEXT.md is freeform narrative per-phase
// context — prose with L2 sections (Objective, Research Summary,
// Decisions, Landmines, etc.). Generic section.ts dispatch; no
// per-section parser.

import type { FrontmatterValue } from '../frontmatter.js';

export const CONTEXT_KIND = 'context' as const;

export interface ContextRecord {
  kind: typeof CONTEXT_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  sections: Record<string, string>;
  prose: string;
}
