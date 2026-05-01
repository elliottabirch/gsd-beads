// tests/unit/format-frontmatter.test.mjs
// Verifies D-03 disk-routed frontmatter primitives:
//   parseFrontmatter / formatFrontmatter / mergeFrontmatter
//
// Plan 07-03: 11 behavior tests covering scalar parse, list parse,
// quoted strings, null/empty values, no-frontmatter passthrough,
// scalar/list round-trips, empty-fm short-circuit, and shallow-merge
// edge cases (undefined patch, null base).

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('parseFrontmatter: happy-path scalar parse', async () => {
  const { parseFrontmatter } = await import('../../src/format/frontmatter.mjs');
  const input = '---\nphase: 7\nname: foo\nopen: true\n---\n# Body\n';
  assert.deepStrictEqual(parseFrontmatter(input), {
    frontmatter: { phase: 7, name: 'foo', open: true },
    body: '# Body\n',
  });
});

test('parseFrontmatter: flat string list parse', async () => {
  const { parseFrontmatter } = await import('../../src/format/frontmatter.mjs');
  const input =
    '---\nfiles_modified:\n  - src/a.mjs\n  - src/b.mjs\n---\nbody';
  const { frontmatter } = parseFrontmatter(input);
  assert.deepStrictEqual(frontmatter.files_modified, [
    'src/a.mjs',
    'src/b.mjs',
  ]);
});

test('parseFrontmatter: quoted strings unwrap', async () => {
  const { parseFrontmatter } = await import('../../src/format/frontmatter.mjs');
  const input = '---\nkey: "quoted"\nkey2: \'single\'\n---\nbody';
  assert.deepStrictEqual(parseFrontmatter(input).frontmatter, {
    key: 'quoted',
    key2: 'single',
  });
});

test('parseFrontmatter: null/empty/false values', async () => {
  const { parseFrontmatter } = await import('../../src/format/frontmatter.mjs');
  const input = '---\nx: null\ny: ~\nz: false\n---\nbody';
  assert.deepStrictEqual(parseFrontmatter(input).frontmatter, {
    x: null,
    y: null,
    z: false,
  });
});

test('parseFrontmatter: no delimiters → empty fm + body verbatim', async () => {
  const { parseFrontmatter } = await import('../../src/format/frontmatter.mjs');
  const input = 'just a body\n';
  assert.deepStrictEqual(parseFrontmatter(input), {
    frontmatter: {},
    body: 'just a body\n',
  });
});

test('formatFrontmatter: scalar round-trip', async () => {
  const { parseFrontmatter, formatFrontmatter } = await import(
    '../../src/format/frontmatter.mjs'
  );
  const formatted = formatFrontmatter({ phase: 7, name: 'foo' }, 'body');
  assert.ok(formatted.startsWith('---\n'), 'output must start with --- delimiter');
  assert.ok(formatted.endsWith('body'), 'output must end with body verbatim');
  assert.deepStrictEqual(parseFrontmatter(formatted).frontmatter, {
    phase: 7,
    name: 'foo',
  });
});

test('formatFrontmatter: list round-trip', async () => {
  const { parseFrontmatter, formatFrontmatter } = await import(
    '../../src/format/frontmatter.mjs'
  );
  const formatted = formatFrontmatter({ files: ['a.mjs', 'b.mjs'] }, 'body');
  assert.deepStrictEqual(parseFrontmatter(formatted).frontmatter, {
    files: ['a.mjs', 'b.mjs'],
  });
});

test('formatFrontmatter: empty fm returns body verbatim', async () => {
  const { formatFrontmatter } = await import(
    '../../src/format/frontmatter.mjs'
  );
  assert.strictEqual(formatFrontmatter({}, 'body'), 'body');
});

test('mergeFrontmatter: shallow merge — patch overrides base', async () => {
  const { mergeFrontmatter } = await import(
    '../../src/format/frontmatter.mjs'
  );
  assert.deepStrictEqual(
    mergeFrontmatter({ a: 1, b: 2 }, { b: 99, c: 3 }),
    { a: 1, b: 99, c: 3 }
  );
});

test('mergeFrontmatter: undefined patch yields base', async () => {
  const { mergeFrontmatter } = await import(
    '../../src/format/frontmatter.mjs'
  );
  assert.deepStrictEqual(mergeFrontmatter({ a: 1 }, undefined), { a: 1 });
});

test('mergeFrontmatter: null base yields patch', async () => {
  const { mergeFrontmatter } = await import(
    '../../src/format/frontmatter.mjs'
  );
  assert.deepStrictEqual(mergeFrontmatter(null, { a: 1 }), { a: 1 });
});
