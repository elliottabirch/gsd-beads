// src/format/schemas/plan.ts
// Per-canonical-file schema for <phase>-<plan>-PLAN.md (D-MAPPING Outcome A).
//
// Scope: typed declaration. PLAN.md is the heaviest canonical file —
// rich YAML frontmatter (must_haves.truths/artifacts/key_links arrays
// with nested maps) + XML-tagged body (<objective>, <tasks>,
// <verification>, <success_criteria>). Parse/format for the XML is
// opaque from storage POV; frontmatter uses js-yaml via frontmatter.ts.

import type { FrontmatterValue } from '../frontmatter.js';

export const PLAN_KIND = 'plan' as const;

/**
 * Canonical PLAN.md record shape.
 *
 * The XML-tagged body sections (objective, tasks, verification,
 * success_criteria, interfaces, threat_model, output) are NOT parsed
 * at this layer — they're opaque strings. Callers that need structured
 * access (e.g. the planner/executor orchestration) extract them via
 * their own XML-aware helpers.
 */
export interface PlanRecord {
  kind: typeof PLAN_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  /** XML-tagged body, verbatim */
  body: string;
}
