// src/format/schemas/requirements.ts
// Per-canonical-file schema for REQUIREMENTS.md (D-MAPPING Outcome A).
//
// Scope: typed declaration + lightweight checkbox-parser helper.
// REQUIREMENTS.md contains categorized checkbox lists with ID-prefixed
// items (e.g. `- [x] REQ-01: description`). Structure is uniform enough
// that a tiny purpose-built parser is simpler than the generic
// section.ts/frontmatter.ts combo for this case.

import type { FrontmatterValue } from '../frontmatter.js';

export const REQUIREMENTS_KIND = 'requirements' as const;

/**
 * A single requirement item within a category.
 * `id` is optional — not every line is ID-prefixed (allows freeform items).
 */
export interface RequirementItem {
  /** Requirement ID (e.g. 'REQ-01') — optional if line is freeform */
  id?: string;
  /** Human-readable description text (post-ID, trimmed) */
  description: string;
  /** true if the checkbox is `[x]`, false for `[ ]` */
  done: boolean;
}

/**
 * A category grouping (L2 or L3 heading text → item list).
 */
export interface RequirementCategory {
  /** Heading text verbatim (e.g. 'Architecture', 'Bugs') */
  name: string;
  /** Heading level (2 or 3) */
  level: 2 | 3;
  items: RequirementItem[];
}

/**
 * Canonical REQUIREMENTS.md record shape.
 */
export interface RequirementsRecord {
  kind: typeof REQUIREMENTS_KIND;
  frontmatter: Record<string, FrontmatterValue>;
  categories: RequirementCategory[];
  /** Prose outside any category heading (e.g. file-header preamble). */
  prose: string;
}

// ─── Parser ─────────────────────────────────────────────────────────────

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
// Item regex captures [x] or [ ], optional ID (e.g. REQ-01:), description.
const ITEM_RE = /^- \[([ xX])\]\s+(?:([A-Z]+-\d+):\s*)?(.*)$/;

/**
 * Parse REQUIREMENTS.md body (post-frontmatter) into categorized items.
 * Used by Plan 06-05 getSection when route.kind === 'requirements'.
 */
export function parseRequirementsBody(body: string): {
  categories: RequirementCategory[];
  prose: string;
} {
  const lines = body.split('\n');
  const categories: RequirementCategory[] = [];
  const proseLines: string[] = [];
  let current: RequirementCategory | null = null;
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      // CR-03 fix: fence toggles are no-ops for the content arrays.
      // The previous placeholder `push({} as never)` polluted
      // `current.items` (RequirementItem[]) with empty objects and
      // `proseLines` (string[]) with `{}` that later join'd as
      // `[object Object]`. A fence-delimiting line is neither a
      // requirement item nor prose content when inside a category;
      // when outside a category, preserve it in prose for round-trip.
      inFence = !inFence;
      if (!current) proseLines.push(line);
      continue;
    }
    if (inFence) {
      if (!current) proseLines.push(line);
      continue;
    }
    const hm = HEADING_RE.exec(line);
    if (hm) {
      const level = hm[1]!.length as 2 | 3;
      current = { name: hm[2]!, level, items: [] };
      categories.push(current);
      continue;
    }
    const im = ITEM_RE.exec(line);
    if (im && current) {
      const done = im[1]!.toLowerCase() === 'x';
      const id = im[2] ?? undefined;
      current.items.push({
        done,
        ...(id !== undefined ? { id } : {}),
        description: im[3]!,
      });
      continue;
    }
    if (!current) proseLines.push(line);
  }

  return { categories, prose: proseLines.join('\n').trim() };
}
