// src/adapter/pathRouter.mjs
// Closed-enum routing registry per D-01 / Phase 7.
// Every Bin A method's first line is `const route = pathRouter.resolve(path)`.
// Pure function — no I/O, no spawn — unit-testable in isolation.
//
// Decisions referenced:
//   D-01: closed-enum routing table (this file is THE registry)
//   D-02: repo-relative paths everywhere
//   D-04: listCollection routes via the same registry
//   D-10: NAMED_DOC_CATEGORIES is the closed allowlist for namedDoc routing

/**
 * The closed-enum named-doc category allowlist (D-10).
 * Anything outside this set falls through to opaque/disk routing.
 */
export const NAMED_DOC_CATEGORIES = Object.freeze([
  'intel',
  'codebase',
  'research',
  'archived-milestone',
  'debug-knowledge-base',
  'learnings',
  'methodology',
  'discussion-log',
  'discovery',
]);

// Pre-built regex from the named-doc enum (joined with `|`) so adding a
// category is a single line edit to the array above.
const NAMED_DOC_RE = new RegExp(
  `^\\.planning\\/(${NAMED_DOC_CATEGORIES.join('|')})\\/([^/]+)\\.md$`
);

// Phase plan path: .planning/phases/NN-<slug>/NN-<plan>-PLAN.md (back-ref ensures NN matches)
const PLAN_RE = /^\.planning\/phases\/(\d+(?:\.\d+)?)-[^/]+\/(\1-[^/]+-PLAN\.md)$/;

const PATTERNS = Object.freeze([
  // Static singletons
  {
    test: (p) => p === '.planning/ROADMAP.md',
    shape: () => ({ kind: 'roadmap', tier: 'bd', label: 'gsd:roadmap', singleton: true }),
  },
  {
    test: (p) => p === '.planning/REQUIREMENTS.md',
    shape: () => ({ kind: 'requirements', tier: 'bd', label: 'gsd:requirement' }),
  },

  // Phase plans (narrative — disk-routed per REQ-07; not bd)
  {
    test: (p) => PLAN_RE.test(p),
    shape: (p) => {
      const m = p.match(PLAN_RE);
      return { kind: 'plan', tier: 'disk', phase: m[1], plan: m[2] };
    },
  },

  // Collections (prefix matches)
  {
    test: (p) => p === '.planning/phases' || /^\.planning\/phases\/?$/.test(p),
    shape: () => ({ kind: 'phase', tier: 'bd', label: 'gsd:phase', collection: true }),
  },
  {
    test: (p) => p === '.planning/todos' || p.startsWith('.planning/todos/'),
    shape: () => ({ kind: 'todo', tier: 'bd', label: 'gsd:todo', collection: true }),
  },
  {
    test: (p) => p === '.planning/seeds' || p.startsWith('.planning/seeds/'),
    shape: () => ({ kind: 'seed', tier: 'bd', label: 'gsd:seed', collection: true }),
  },

  // Named-doc enum (closed allowlist per D-10)
  {
    test: (p) => NAMED_DOC_RE.test(p),
    shape: (p) => {
      const m = p.match(NAMED_DOC_RE);
      return { kind: 'namedDoc', tier: 'hybrid', category: m[1], key: m[2] };
    },
  },
]);

/**
 * Resolve a repo-relative path to its routing-shape descriptor.
 *
 * @param {string} path  repo-relative path (D-02)
 * @returns {{kind: string, tier: 'bd'|'disk'|'hybrid', ...}} shape descriptor
 * @throws {TypeError} if path is not a non-empty string
 */
export function resolve(path) {
  if (typeof path !== 'string' || !path.length) {
    throw new TypeError('pathRouter.resolve: path must be a non-empty string');
  }
  for (const entry of PATTERNS) {
    if (entry.test(path)) return entry.shape(path);
  }
  // Fall through: disk-routed, opaque kind
  return { kind: 'opaque', tier: 'disk' };
}
