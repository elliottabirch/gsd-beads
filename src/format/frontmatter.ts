// src/format/frontmatter.ts
// YAML frontmatter parser/formatter/merger. Ported from sibling
// src/format/frontmatter.mjs (107 LOC) during Plan 06-04.
//
// ──────────────────────────────────────────────────────────────────────
// Conditional escalation decision (Plan 06-04 Task 2 corpus scan, 2026-05-11):
// Fork corpus scan found EXTENSIVE nested-object frontmatter (PLAN.md files
// use `must_haves.truths: [...]` + `artifacts: - path: ... provides: ...`
// two-level maps-inside-lists). Sibling's hand-roll flat-scalar parser
// would silently drop every nested key (WR-02/WR-03 class bug).
//
// Escalated to js-yaml@4.1.1. The exported signatures match the sibling's
// contract (parseFrontmatter / formatFrontmatter / mergeFrontmatter) so
// callers see no observable change other than richer parsed structure
// for nested inputs.
// ──────────────────────────────────────────────────────────────────────

import { load, dump } from 'js-yaml';

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export interface ParsedFrontmatter {
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
}

/**
 * Parse YAML frontmatter at the top of a markdown file.
 *
 * Returns `{ frontmatter: {}, body: text }` when no `---` delimited block
 * is found (matches sibling's legacy null-absent semantics). Nested maps,
 * maps-in-lists, and multi-line scalars are ALL supported via js-yaml.
 *
 * @throws {YAMLException} on malformed YAML — callers in Plan 06-05 wrap
 *         and re-throw as UnsupportedCapabilityError / BdError variants
 *         as appropriate for their codepath.
 */
export function parseFrontmatter(text: string): ParsedFrontmatter {
  const m = FRONTMATTER_RE.exec(text);
  if (!m) return { frontmatter: {}, body: text };

  const loaded = load(m[1]!);
  // js-yaml.load returns `unknown` — if the YAML block was empty or
  // produced a non-object (scalar / list at the top level), coerce to
  // empty object; frontmatter is a map by contract.
  const frontmatter =
    loaded && typeof loaded === 'object' && !Array.isArray(loaded)
      ? (loaded as Record<string, FrontmatterValue>)
      : {};

  return { frontmatter, body: m[2]! };
}

/**
 * Render a frontmatter object back to delimited YAML + body.
 * Returns body verbatim when fm is empty/null (no `---` block emitted).
 *
 * js-yaml's dump is used for serialization. Output differs cosmetically
 * from the hand-roll (e.g., list items aligned; nested maps indented
 * consistently). The idempotency contract holds: parse(format(parse(x)))
 * yields the same parsed structure — NOT byte-equality, per D-15 style.
 */
export function formatFrontmatter(
  fm: Record<string, FrontmatterValue> | null | undefined,
  body: string,
): string {
  if (!fm || !Object.keys(fm).length) return body;
  // Options chosen to match .planning/ corpus conventions:
  //   lineWidth: -1       disable auto-wrap (long goal strings stay on one line)
  //   noRefs: true        no YAML anchors/aliases (corpus never uses them)
  //   sortKeys: false     preserve insertion order (authoring intent matters)
  //   quotingType: '"'    double-quote when quoting (matches corpus style)
  const yaml = dump(fm, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
  });
  // dump() always produces a trailing newline; strip it so the delimiter
  // placement is deterministic.
  const yamlTrimmed = yaml.endsWith('\n') ? yaml.slice(0, -1) : yaml;
  return `---\n${yamlTrimmed}\n---\n${body}`;
}

/**
 * Shallow-merge a patch over a base frontmatter. Patch keys override base.
 * Either argument may be null/undefined. Nested values are NOT deep-merged
 * (sibling's semantics — deep-merge was explicitly rejected to preserve
 * caller control; callers wanting deep-merge compose it client-side).
 */
export function mergeFrontmatter(
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return { ...(base ?? {}), ...(patch ?? {}) };
}
