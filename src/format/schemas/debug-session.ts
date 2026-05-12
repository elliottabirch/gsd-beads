// src/format/schemas/debug-session.ts
// Per-canonical-file schema for debug-session docs (D-MAPPING Outcome A).
//
// Scope: type-only. Debug session docs live under named-doc category
// (research/ or reports/ depending on convention) with per-session
// L2 headings + investigation prose. Generic section.ts dispatch.

import type { FrontmatterValue } from '../frontmatter.js';

export const DEBUG_SESSION_KIND = 'debug-session' as const;

export interface DebugSessionEntry {
  /** Heading text (session ID or title) */
  id: string;
  /** Investigation body — prose, snippets, findings */
  body: string;
  /** Optional date extracted from heading or frontmatter */
  date?: string;
}

export interface DebugSessionRecord {
  kind: typeof DEBUG_SESSION_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  entries: DebugSessionEntry[];
}
