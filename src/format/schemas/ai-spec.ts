// src/format/schemas/ai-spec.ts
// Per-canonical-file schema for AI-SPEC.md (D-MAPPING Outcome A).
//
// Scope: type-only. AI-SPEC.md is prose + XML-tagged sections (e.g.
// <context>, <constraints>, <interfaces>). Parse/format flows through
// generic section.ts + frontmatter.ts; this file names the canonical
// shape so Plan 06-05 primitives can dispatch by route.kind.

import type { FrontmatterValue } from '../frontmatter.js';

export const AI_SPEC_KIND = 'ai-spec' as const;

export interface AiSpecRecord {
  kind: typeof AI_SPEC_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  /** Full body text (XML-tagged sections are opaque to the storage layer). */
  body: string;
}
