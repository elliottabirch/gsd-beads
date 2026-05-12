import { describe, it, expect } from 'vitest';
import { resolveRoute, NAMED_DOC_CATEGORIES } from '../../src/paths.js';

describe('NAMED_DOC_CATEGORIES closed union', () => {
  it('matches fork NamedDocCategory exactly (8 entries)', () => {
    const sorted = [...NAMED_DOC_CATEGORIES].sort();
    expect(sorted).toEqual(
      ['archived-milestone', 'codebase', 'intel', 'reports', 'research', 'root', 'sketches', 'tmp'].sort(),
    );
  });

  it('is frozen (Object.freeze)', () => {
    expect(Object.isFrozen(NAMED_DOC_CATEGORIES)).toBe(true);
  });
});

describe('resolveRoute — top-level singletons', () => {
  it('ROADMAP.md → bd tier + gsd:roadmap label', () => {
    const r = resolveRoute('ROADMAP.md');
    expect(r).toEqual({
      kind: 'roadmap-singleton', tier: 'bd',
      label: 'gsd:roadmap', singleton: true,
    });
  });

  it('STATE.md → bd tier + gsd:state label', () => {
    const r = resolveRoute('STATE.md');
    expect(r.tier).toBe('bd');
    expect(r.kind).toBe('state-singleton');
    expect(r.label).toBe('gsd:state');
  });

  it('PROJECT.md / REQUIREMENTS.md / DECISIONS.md all bd-tier singletons', () => {
    expect(resolveRoute('PROJECT.md').kind).toBe('project-singleton');
    expect(resolveRoute('REQUIREMENTS.md').kind).toBe('requirements-singleton');
    expect(resolveRoute('DECISIONS.md').kind).toBe('decisions-singleton');
  });

  it('accepts .planning/-prefixed form (defensive)', () => {
    const r = resolveRoute('.planning/ROADMAP.md');
    expect(r.kind).toBe('roadmap-singleton');
  });

  it('strips leading `./`', () => {
    expect(resolveRoute('./ROADMAP.md').kind).toBe('roadmap-singleton');
  });
});

describe('resolveRoute — phase-addressed paths', () => {
  it('phases/06-x/06-CONTEXT.md → phase-context', () => {
    const r = resolveRoute('phases/06-beadsadapter-implementation/06-CONTEXT.md');
    expect(r.kind).toBe('phase-context');
    expect(r.phase).toBe('06-beadsadapter-implementation');
    expect(r.tier).toBe('bd');
  });

  it('phases/06-x/06-02-PLAN.md → phase-plan with plan number', () => {
    const r = resolveRoute('phases/06-x/06-02-PLAN.md');
    expect(r.kind).toBe('phase-plan');
    expect(r.plan).toBe('02');
    expect(r.tier).toBe('bd');
  });

  it('phases/06-x/06-04-SUMMARY.md → phase-summary', () => {
    const r = resolveRoute('phases/06-x/06-04-SUMMARY.md');
    expect(r.kind).toBe('phase-summary');
    expect(r.plan).toBe('04');
  });

  it('phases/06-x/06-RESEARCH.md → phase-research', () => {
    expect(resolveRoute('phases/06-x/06-RESEARCH.md').kind).toBe('phase-research');
  });

  it('phases/06-x/06-DISCUSSION-LOG.md → phase-discussion', () => {
    expect(resolveRoute('phases/06-x/06-DISCUSSION-LOG.md').kind).toBe('phase-discussion');
  });

  it('phases/06-x/06-UAT.md → phase-uat', () => {
    expect(resolveRoute('phases/06-x/06-UAT.md').kind).toBe('phase-uat');
  });

  it('phases/06-x/06-VERIFICATION.md → phase-verification', () => {
    expect(resolveRoute('phases/06-x/06-VERIFICATION.md').kind).toBe('phase-verification');
  });

  it('phases/06-x/ (no trailing file) → phase-collection', () => {
    const r = resolveRoute('phases/06-x');
    expect(r.kind).toBe('phase-collection');
    expect(r.collection).toBe(true);
  });

  it('phase-scoped random path → opaque/disk', () => {
    const r = resolveRoute('phases/06-x/scratch-notes.md');
    expect(r.kind).toBe('opaque');
    expect(r.tier).toBe('disk');
  });
});

describe('resolveRoute — named-doc categories (disk tier per CR-02)', () => {
  it('research/<key> → disk named-doc', () => {
    const r = resolveRoute('research/fork-investigation/SYNTHESIS.md');
    expect(r.kind).toBe('named-doc');
    expect(r.tier).toBe('disk');
    expect(r.category).toBe('research');
    expect(r.key).toBe('fork-investigation/SYNTHESIS.md');
  });

  it('intel/<key> → disk', () => {
    expect(resolveRoute('intel/x.md').tier).toBe('disk');
    expect(resolveRoute('intel/x.md').category).toBe('intel');
  });

  it('sketches/<key> → disk', () => {
    expect(resolveRoute('sketches/diagram.html').category).toBe('sketches');
  });

  it('tmp/<key> → disk', () => {
    expect(resolveRoute('tmp/foo.txt').category).toBe('tmp');
  });

  it('archived-milestone/<key> → disk', () => {
    expect(resolveRoute('archived-milestone/v0.1/notes.md').category).toBe('archived-milestone');
  });

  it('codebase/<key> → disk', () => {
    expect(resolveRoute('codebase/guide.md').category).toBe('codebase');
  });

  it('reports/<key> → disk', () => {
    expect(resolveRoute('reports/audit.md').category).toBe('reports');
  });

  it('category prefix without key is NOT a named-doc match', () => {
    // `research/` with no key falls through to opaque (nothing to address)
    const r = resolveRoute('research/');
    expect(r.kind).toBe('opaque');
  });
});

describe('resolveRoute — root-category singletons', () => {
  it('HANDOFF.json → named-doc-root with key HANDOFF', () => {
    const r = resolveRoute('HANDOFF.json');
    expect(r).toEqual({
      kind: 'named-doc-root', tier: 'disk',
      category: 'root', key: 'HANDOFF',
    });
  });

  it('CONTINUE-HERE.json → named-doc-root', () => {
    const r = resolveRoute('CONTINUE-HERE.json');
    expect(r.category).toBe('root');
    expect(r.key).toBe('CONTINUE-HERE');
  });

  it('DECISIONS-INDEX.md → named-doc-root', () => {
    const r = resolveRoute('DECISIONS-INDEX.md');
    expect(r.category).toBe('root');
    expect(r.key).toBe('DECISIONS-INDEX');
  });
});

describe('resolveRoute — CR-02 invariant (no hybrid tier)', () => {
  it('every representative path returns tier in {bd, disk} — no hybrid', () => {
    const paths = [
      'ROADMAP.md',
      'STATE.md',
      'PROJECT.md',
      'REQUIREMENTS.md',
      'DECISIONS.md',
      'phases/06-x/06-01-PLAN.md',
      'phases/06-x/06-01-SUMMARY.md',
      'phases/06-x/06-CONTEXT.md',
      'phases/06-x/',
      'research/foo.md',
      'intel/bar.md',
      'codebase/baz.md',
      'sketches/qux.html',
      'tmp/scratch.md',
      'archived-milestone/v0.md',
      'reports/audit.md',
      'HANDOFF.json',
      'CONTINUE-HERE.json',
      'DECISIONS-INDEX.md',
      'arbitrary/thing.txt',
    ];
    for (const p of paths) {
      const t = resolveRoute(p).tier;
      expect(t === 'bd' || t === 'disk').toBe(true);
    }
  });
});

describe('resolveRoute — fall-through', () => {
  it('random unclassified path → opaque/disk', () => {
    const r = resolveRoute('arbitrary/thing.txt');
    expect(r.kind).toBe('opaque');
    expect(r.tier).toBe('disk');
  });

  it('throws on empty/non-string input', () => {
    expect(() => resolveRoute('')).toThrow(TypeError);
    // @ts-expect-error — testing defensive runtime guard
    expect(() => resolveRoute(null)).toThrow(TypeError);
  });
});
