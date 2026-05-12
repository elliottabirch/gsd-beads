// src/format/schemas/verification.ts
// Per-canonical-file schema for <phase>-VERIFICATION.md (D-MAPPING Outcome A).
//
// Scope: type-only. VERIFICATION.md holds phase-completion acceptance
// command output + pass/fail tables. Generic section.ts dispatch; no
// per-row parser.

import type { FrontmatterValue } from '../frontmatter.js';

export const VERIFICATION_KIND = 'verification' as const;

export interface VerificationRecord {
  kind: typeof VERIFICATION_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  /** L2-section map (Commands Run, Output, Pass/Fail Summary, etc.) */
  sections: Record<string, string>;
  prose: string;
}
