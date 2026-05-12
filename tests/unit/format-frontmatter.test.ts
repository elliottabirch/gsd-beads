import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  formatFrontmatter,
  mergeFrontmatter,
} from '../../src/format/frontmatter.js';

// Decision record (Plan 06-04 Task 2):
//
// Fork's .planning/ corpus contains nested-object frontmatter (PLAN.md files
// use `must_haves.truths: [...]` + `artifacts: - path: ... provides: ...`
// maps-inside-lists). The sibling's hand-roll flat-scalar parser CANNOT
// represent these structures — it would silently drop every nested key.
// We therefore escalated to js-yaml@4.1.1 for this port.
//
// The test below (nested object round-trip) asserts that the escalation
// holds: the hand-roll path would fail this test; js-yaml passes it.

describe('parseFrontmatter / formatFrontmatter — flat scalars', () => {
  it('parses flat key/value pairs', () => {
    const text = '---\nphase: "06"\nstatus: executing\n---\n# Body\n';
    const { frontmatter, body } = parseFrontmatter(text);
    expect(frontmatter.phase).toBe('06');
    expect(frontmatter.status).toBe('executing');
    expect(body.trim()).toBe('# Body');
  });

  it('parses flat string-lists (compact [a, b, c] form)', () => {
    const text = '---\ntags: [port, typescript]\n---\nBody\n';
    const { frontmatter } = parseFrontmatter(text);
    expect(frontmatter.tags).toEqual(['port', 'typescript']);
  });

  it('parses flat string-lists (expanded - item form)', () => {
    const text = '---\nrequirements:\n  - REQ-01\n  - REQ-02\n---\nBody\n';
    const { frontmatter } = parseFrontmatter(text);
    expect(frontmatter.requirements).toEqual(['REQ-01', 'REQ-02']);
  });

  it('returns empty frontmatter when no --- block', () => {
    const text = 'No frontmatter here\n';
    const { frontmatter, body } = parseFrontmatter(text);
    expect(frontmatter).toEqual({});
    expect(body).toBe(text);
  });

  it('coerces booleans / numbers / null correctly', () => {
    const text = '---\nok: true\nbad: false\nn: 42\nf: 1.5\nempty: null\n---\n';
    const { frontmatter } = parseFrontmatter(text);
    expect(frontmatter.ok).toBe(true);
    expect(frontmatter.bad).toBe(false);
    expect(frontmatter.n).toBe(42);
    expect(frontmatter.f).toBe(1.5);
    expect(frontmatter.empty).toBe(null);
  });
});

describe('parseFrontmatter — nested objects (js-yaml escalation)', () => {
  it('parses 2-level nested map (fork PLAN.md must_haves pattern)', () => {
    const text = [
      '---',
      'must_haves:',
      '  truths:',
      '    - "Templates no longer contain @.planning/ references"',
      '    - "References use SDK queries"',
      '---',
      'body',
      '',
    ].join('\n');
    const { frontmatter } = parseFrontmatter(text);
    expect(frontmatter.must_haves).toBeDefined();
    const mh = frontmatter.must_haves as { truths: string[] };
    expect(Array.isArray(mh.truths)).toBe(true);
    expect(mh.truths[0]).toMatch(/@\.planning/);
  });

  it('parses maps-inside-lists (fork PLAN.md artifacts pattern)', () => {
    const text = [
      '---',
      'artifacts:',
      '  - path: "foo.md"',
      '    provides: "thing"',
      '  - path: "bar.md"',
      '    provides: "other"',
      '---',
      'body',
      '',
    ].join('\n');
    const { frontmatter } = parseFrontmatter(text);
    const arts = frontmatter.artifacts as Array<{ path: string; provides: string }>;
    expect(arts).toHaveLength(2);
    expect(arts[0]!.path).toBe('foo.md');
    expect(arts[0]!.provides).toBe('thing');
    expect(arts[1]!.path).toBe('bar.md');
  });

  it('round-trips nested frontmatter (parse → format → parse invariant)', () => {
    const text = [
      '---',
      'phase: "06"',
      'must_haves:',
      '  truths:',
      '    - "first truth"',
      '    - "second truth"',
      '---',
      '# Body\n',
    ].join('\n');
    const { frontmatter: fm1, body: body1 } = parseFrontmatter(text);
    const re_emitted = formatFrontmatter(fm1, body1);
    const { frontmatter: fm2 } = parseFrontmatter(re_emitted);
    expect(fm2).toEqual(fm1);
  });
});

describe('formatFrontmatter', () => {
  it('returns body verbatim for empty/null fm', () => {
    expect(formatFrontmatter(null, 'hi\n')).toBe('hi\n');
    expect(formatFrontmatter({}, 'hi\n')).toBe('hi\n');
    expect(formatFrontmatter(undefined, 'hi\n')).toBe('hi\n');
  });

  it('emits delimited YAML + body for non-empty fm', () => {
    const out = formatFrontmatter({ phase: '06', tags: ['a', 'b'] }, 'body\n');
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('phase:');
    expect(out).toContain('---\nbody');
  });
});

describe('mergeFrontmatter', () => {
  it('patch wins on conflict; base keys preserved', () => {
    const base = { a: 1, b: 2 };
    const patch = { b: 20, c: 30 };
    expect(mergeFrontmatter(base, patch)).toEqual({ a: 1, b: 20, c: 30 });
  });

  it('handles null/undefined inputs', () => {
    expect(mergeFrontmatter(null, { a: 1 })).toEqual({ a: 1 });
    expect(mergeFrontmatter({ a: 1 }, null)).toEqual({ a: 1 });
    expect(mergeFrontmatter(null, null)).toEqual({});
    expect(mergeFrontmatter(undefined, undefined)).toEqual({});
  });
});
