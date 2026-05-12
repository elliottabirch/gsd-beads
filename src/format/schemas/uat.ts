// src/format/schemas/uat.ts
// Per-canonical-file schema for <phase>-UAT.md (D-MAPPING Outcome A).
//
// Scope: typed declaration. UAT.md contains a per-phase user-acceptance
// checklist (similar shape to REQUIREMENTS.md categories — L2 categories
// with checkbox items). Read is generic section.ts dispatch; writes
// are structured via appendToOrCreateSection-style helpers in Plan 06-05.

import type { FrontmatterValue } from '../frontmatter.js';

export const UAT_KIND = 'uat' as const;

/**
 * A single UAT scenario entry.
 * `id` optional — freeform scenarios allowed.
 * `status`: pass | fail | pending (from checkbox + prose annotation).
 */
export interface UatScenario {
  id?: string;
  description: string;
  status: 'pass' | 'fail' | 'pending';
  /** Optional multi-line detail/notes for this scenario. */
  details?: string;
}

export interface UatCategory {
  name: string;
  level: 2 | 3;
  scenarios: UatScenario[];
}

export interface UatRecord {
  kind: typeof UAT_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  categories: UatCategory[];
  prose: string;
}
