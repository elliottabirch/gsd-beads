// src/format/schemas/project.ts
// Per-canonical-file schema for PROJECT.md (D-MAPPING Outcome A).
//
// Scope: type-only. PROJECT.md is freeform prose + an "## Architecture"
// L2 section. Parse/format goes through generic section.ts + frontmatter.ts;
// no per-field parser lives here. This file names the canonical record
// shape so Plan 06-05 primitives can type-dispatch by route.kind.

import type { FrontmatterValue } from '../frontmatter.js';

export const PROJECT_KIND = 'project' as const;

/**
 * Canonical PROJECT.md record shape.
 *
 * L2 sections are mapped to `sections` keyed by heading text (drift
 * surfaced at sync time per D-MAPPING-SCHEMA — NOT auto-derived).
 */
export interface ProjectRecord {
  kind: typeof PROJECT_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  /**
   * L2-section map. Keys match heading text verbatim (e.g. 'Architecture',
   * 'Constraints'). Values are section body text. Plan 06-05 primitives
   * use this for `getSection(path, anchor)` dispatch.
   */
  sections: Record<string, string>;
  /** Body text outside any L2 section (leading prose, etc.) */
  prose: string;
}
