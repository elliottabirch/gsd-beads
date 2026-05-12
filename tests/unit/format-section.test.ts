import { describe, it, expect } from 'vitest';
import {
  slugify,
  locateSection,
  rewriteSection,
} from '../../src/format/section.js';

describe('slugify (D-05)', () => {
  it('lowercases + replaces non-alphanum with -', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
  });

  it('collapses runs of whitespace/underscores', () => {
    expect(slugify('A  B   C')).toBe('a-b-c');
    expect(slugify('foo_bar_baz')).toBe('foo-bar-baz');
  });

  it('strips markdown emphasis but not underscores', () => {
    expect(slugify('**Bold**')).toBe('bold');
    expect(slugify('`code`')).toBe('code');
    expect(slugify('~~strike~~')).toBe('strike');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify(' hi ')).toBe('hi');
    expect(slugify('---hi---')).toBe('hi');
  });
});

describe('locateSection — path-slug navigation (D-06)', () => {
  it('locates a top-level heading', () => {
    const text = '## Intro\nbody\n## Next\n';
    const loc = locateSection(text, 'intro');
    expect(loc).not.toBeNull();
    expect(loc!.headingLevel).toBe(2);
    expect(loc!.bodyText).toBe('body');
  });

  it('returns null when heading not found', () => {
    const text = '## Intro\nbody\n';
    expect(locateSection(text, 'missing')).toBeNull();
  });

  it('locates nested slash-separated slug path', () => {
    const text = '# Root\n## Child\n### Grand\nG-body\n## Other\n';
    const loc = locateSection(text, 'root/child/grand');
    expect(loc).not.toBeNull();
    expect(loc!.headingLevel).toBe(3);
    expect(loc!.bodyText).toBe('G-body');
  });

  it('respects code-fence guard (heading in code block not matched)', () => {
    const text = '## Real\nbody\n```\n## Fake\nignored\n```\n';
    expect(locateSection(text, 'fake')).toBeNull();
    expect(locateSection(text, 'real')).not.toBeNull();
  });

  it('empty/blank anchor returns null', () => {
    expect(locateSection('## H\n', '')).toBeNull();
    expect(locateSection('## H\n', '/')).toBeNull();
  });
});

describe('rewriteSection (D-07)', () => {
  it('overwrite mode replaces body, heading untouched', () => {
    const text = '## Header\nold body\n## Next\n';
    const result = rewriteSection(text, 'header', 'new body', 'overwrite');
    expect(result).toContain('## Header\nnew body\n## Next');
    expect(result).not.toContain('old body');
  });

  it('append mode adds to end of section body', () => {
    const text = '## H\nline-1\n## Next\n';
    const result = rewriteSection(text, 'h', 'added', 'append');
    expect(result).toContain('line-1\nadded');
  });

  it('prepend mode adds at top of section body', () => {
    const text = '## H\nline-1\n## Next\n';
    const result = rewriteSection(text, 'h', 'added', 'prepend');
    expect(result).toContain('## H\nadded\nline-1');
  });

  it('throws on unknown mode', () => {
    const text = '## H\nbody\n';
    expect(() => rewriteSection(text, 'h', 'x', 'frob' as never)).toThrow(/unknown mode/);
  });

  it('throws when anchor not found', () => {
    expect(() => rewriteSection('## X\n', 'y', 'z', 'overwrite')).toThrow(/section not found/);
  });

  it('code-fence guard preserved during rewrite (fake heading is part of body)', () => {
    // When `## Fake` is inside a fenced block it's NOT a sibling heading,
    // so `## Real`'s body extends through end-of-file (or next real heading).
    // Overwriting 'real' therefore REPLACES the entire tail including the
    // fenced block — this is the sibling's intended behavior; the invariant
    // proven here is simply that the fake heading was not misidentified as
    // a sibling split point during locate.
    const text = '## Real\nbody\n```\n## Fake\n```\nmore\n## Sibling\nsib-body\n';
    const result = rewriteSection(text, 'real', 'new', 'overwrite');
    // After overwrite, 'new' body extends to `## Sibling` (the REAL next heading).
    expect(result).toContain('## Real\nnew\n## Sibling\nsib-body');
    // Fenced block is gone because it was inside 'real's body — not the guard's job to preserve it.
    expect(result).not.toContain('## Fake');
  });
});
