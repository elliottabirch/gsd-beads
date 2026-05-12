// src/paths.ts
// Path router — classifies .planning/-relative paths into typed routing records.
//
// Ported from sibling src/adapter/pathRouter.mjs (97 LOC) during Plan 06-04.
// Flat top-level filename per D-SCAFFOLD whitelist (flattened from
// src/adapter/pathRouter.mjs).
//
// ─── Amendments vs sibling ───────────────────────────────────────────────
//   1. NamedDocCategory union aligned with fork (types.ts:15-23):
//        'research' | 'intel' | 'codebase' | 'archived-milestone' |
//        'reports' | 'sketches' | 'tmp' | 'root'.
//      Sibling's 'debug-knowledge-base' / 'learnings' / 'methodology' /
//      'discussion-log' / 'discovery' are REMOVED (domain logic, not
//      primitives — fork SDK handles these via generic named-doc).
//
//   2. 'root' category handles fork's RootNamedDocKey singletons at
//      .planning/ root ('HANDOFF', 'CONTINUE-HERE', 'DECISIONS-INDEX').
//
//   3. CR-02 BLOCKER (Landmines item 2) resolution — DELETED 'hybrid' tier.
//      Sibling's pathRouter emitted tier='hybrid' for named-docs;
//      primitives.mjs putRecord threw on 'bd' tier but lacked explicit
//      dispatch for 'hybrid' → silent fall-through to disk, bypassing
//      D-10 dual-write contract.
//      Fork resolution: named-docs route to tier='disk'; BeadsAdapter's
//      putNamedDoc impl (Plan 06-05) writes the disk body AND adds an
//      optional bd-memory index key as a post-write side-effect — NOT a
//      tier indirection.
//
//   4. Path shape: accepts .planning/-RELATIVE paths (e.g. 'ROADMAP.md',
//      'phases/06-x/06-CONTEXT.md', 'research/foo/bar.md').
//      Matches fork MarkdownAdapter convention (types.ts D-04). Sibling
//      used .planning/-prefixed paths ('.planning/ROADMAP.md'); we strip
//      a leading `.planning/` if present for defensive interop but the
//      canonical contract is relative.
//
//   5. Canonical-file list extended to fork's shape (STATE.md, PROJECT.md,
//      REQUIREMENTS.md, DECISIONS.md are all bd-tier singletons; HANDOFF /
//      CONTINUE-HERE / DECISIONS-INDEX are root-named-doc singletons).

import type {
  NamedDocCategory,
  RootNamedDocKey,
} from 'get-shit-done-cc/adapters/types.js';

/**
 * Routing tier. `'hybrid'` was deleted per CR-02 resolution; every path
 * resolves to either bd (bead-backed) or disk (filesystem) exclusively.
 */
export type Tier = 'bd' | 'disk';

/** Closed enum of route kinds emitted by resolveRoute. */
export type RouteKind =
  | 'roadmap-singleton'
  | 'state-singleton'
  | 'project-singleton'
  | 'requirements-singleton'
  | 'decisions-singleton'
  | 'phase-context'
  | 'phase-research'
  | 'phase-discussion'
  | 'phase-plan'
  | 'phase-summary'
  | 'phase-uat'
  | 'phase-verification'
  | 'phase-collection'
  | 'named-doc'
  | 'named-doc-root'
  | 'opaque';

export interface Route {
  kind: RouteKind;
  tier: Tier;
  label?: string;
  singleton?: boolean;
  collection?: boolean;
  phase?: string;
  plan?: string;
  category?: NamedDocCategory;
  key?: string | RootNamedDocKey;
}

/**
 * Closed enum of fork NamedDocCategory values (aligned with types.ts:15-23).
 * Frozen so downstream code cannot mutate the allowlist by accident.
 */
export const NAMED_DOC_CATEGORIES: readonly NamedDocCategory[] = Object.freeze([
  'research',
  'intel',
  'codebase',
  'archived-milestone',
  'reports',
  'sketches',
  'tmp',
  'root',
] as const);

// Phase-addressed patterns. The phase identifier is everything before the
// first `/` after `phases/`; phases are named like `06-beadsadapter-implementation`.
const PHASE_RE = /^phases\/([^/]+)(?:\/(.+))?$/;

// Phase document patterns (applied inside a phase dir):
const PHASE_PLAN_RE = /-(\d+)-PLAN\.md$/;
const PHASE_SUMMARY_RE = /-(\d+)-SUMMARY\.md$/;
const PHASE_CONTEXT_RE = /-CONTEXT\.md$/;
const PHASE_RESEARCH_RE = /-RESEARCH\.md$/;
const PHASE_DISCUSSION_RE = /-DISCUSSION-LOG\.md$/;
const PHASE_UAT_RE = /-UAT\.md$/;
const PHASE_VERIFICATION_RE = /-VERIFICATION\.md$/;

/**
 * Classify a .planning/-relative path into a typed Route.
 *
 * Accepts input with or without a leading `.planning/` prefix (defensive);
 * the canonical contract is relative (no prefix). Leading `./` is stripped.
 *
 * Path-traversal safety is NOT this function's responsibility; the
 * primitive-level `_abs()` guard in Plan 06-05 owns that (CR-01). This
 * router is a pure classifier.
 *
 * @throws {TypeError} if path is not a non-empty string
 */
export function resolveRoute(path: string): Route {
  if (typeof path !== 'string' || !path.length) {
    throw new TypeError('resolveRoute: path must be a non-empty string');
  }

  // Normalize: strip optional `.planning/` prefix + optional `./` prefix.
  // Defense-in-depth only — real traversal guard is in Plan 06-05 primitives.
  let p = path.replace(/^\.\//, '');
  if (p.startsWith('.planning/')) p = p.slice('.planning/'.length);

  // 1. Top-level singletons — bd-tier (label-dispatched via bd list -l gsd:<name>)
  if (p === 'ROADMAP.md') {
    return {
      kind: 'roadmap-singleton', tier: 'bd',
      label: 'gsd:roadmap', singleton: true,
    };
  }
  if (p === 'STATE.md') {
    return {
      kind: 'state-singleton', tier: 'bd',
      label: 'gsd:state', singleton: true,
    };
  }
  if (p === 'PROJECT.md') {
    return {
      kind: 'project-singleton', tier: 'bd',
      label: 'gsd:project', singleton: true,
    };
  }
  if (p === 'REQUIREMENTS.md') {
    return {
      kind: 'requirements-singleton', tier: 'bd',
      label: 'gsd:requirement', singleton: true,
    };
  }
  if (p === 'DECISIONS.md') {
    return {
      kind: 'decisions-singleton', tier: 'bd',
      label: 'gsd:decisions', singleton: true,
    };
  }

  // 2. Phase-addressed paths: phases/<NN-slug>/...
  const phaseMatch = PHASE_RE.exec(p);
  if (phaseMatch) {
    const phase = phaseMatch[1]!;
    const rest = phaseMatch[2];

    // Phase collection (the directory itself)
    if (!rest) {
      return {
        kind: 'phase-collection', tier: 'bd',
        label: 'gsd:phase', phase, collection: true,
      };
    }

    // Phase documents — matched in priority order (more specific first).
    if (PHASE_CONTEXT_RE.test(rest)) {
      return { kind: 'phase-context', tier: 'bd', phase, singleton: true };
    }
    if (PHASE_RESEARCH_RE.test(rest)) {
      return { kind: 'phase-research', tier: 'bd', phase, singleton: true };
    }
    if (PHASE_DISCUSSION_RE.test(rest)) {
      return { kind: 'phase-discussion', tier: 'bd', phase, singleton: true };
    }
    if (PHASE_UAT_RE.test(rest)) {
      return { kind: 'phase-uat', tier: 'bd', phase, singleton: true };
    }
    if (PHASE_VERIFICATION_RE.test(rest)) {
      return { kind: 'phase-verification', tier: 'bd', phase, singleton: true };
    }
    const planMatch = PHASE_PLAN_RE.exec(rest);
    if (planMatch) {
      return { kind: 'phase-plan', tier: 'bd', phase, plan: planMatch[1]! };
    }
    const summaryMatch = PHASE_SUMMARY_RE.exec(rest);
    if (summaryMatch) {
      return { kind: 'phase-summary', tier: 'bd', phase, plan: summaryMatch[1]! };
    }

    // Phase-scoped opaque (sketches/scratch inside a phase dir)
    return { kind: 'opaque', tier: 'disk' };
  }

  // 3. Named-doc categories (disk-tier per CR-02 resolution)
  //    Root category is handled in step 4 (its paths live at `.planning/` root
  //    without a subdirectory prefix).
  for (const category of NAMED_DOC_CATEGORIES) {
    if (category === 'root') continue;
    if (p.startsWith(category + '/')) {
      const key = p.slice(category.length + 1);
      if (key.length > 0) {
        return { kind: 'named-doc', tier: 'disk', category, key };
      }
    }
  }

  // 4. Root-category singletons (HANDOFF / CONTINUE-HERE / DECISIONS-INDEX)
  //    Live at .planning/ root without a category subdirectory; matched on
  //    exact filename (both .json and .md variants accepted).
  if (p === 'HANDOFF.json' || p === 'HANDOFF.md') {
    return { kind: 'named-doc-root', tier: 'disk', category: 'root', key: 'HANDOFF' };
  }
  if (p === 'CONTINUE-HERE.json' || p === 'CONTINUE-HERE.md') {
    return { kind: 'named-doc-root', tier: 'disk', category: 'root', key: 'CONTINUE-HERE' };
  }
  if (p === 'DECISIONS-INDEX.md' || p === 'DECISIONS-INDEX.json') {
    return { kind: 'named-doc-root', tier: 'disk', category: 'root', key: 'DECISIONS-INDEX' };
  }

  // 5. Fall-through — disk-routed, opaque kind
  return { kind: 'opaque', tier: 'disk' };
}
