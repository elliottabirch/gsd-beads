// tests/unit/format-section.test.mjs
// Verifies PRIM-01 + PRIM-02 (slugify + locateSection + rewriteSection)
// per Phase 7 decisions D-05, D-06, D-07 and the Pitfall 8 code-fence guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Test 1 — slugify happy paths (D-05)
// ---------------------------------------------------------------------------

test('slugify: basic two-word title', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify('Current Test'), 'current-test');
});

test('slugify: phase title with colon and number', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify('Phase 7: Decisions'), 'phase-7-decisions');
});

test('slugify: decision identifier preserves digits', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify('D-01'), 'd-01');
});

test('slugify: collapses runs of whitespace', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify('  Mixed   Whitespace  '), 'mixed-whitespace');
});

test('slugify: underscore becomes hyphen (RESEARCH §slugify rule 3)', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify('foo_bar_baz'), 'foo-bar-baz');
});

test('slugify: strips markdown emphasis (RESEARCH §slugify rule 1)', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify('**bold**'), 'bold');
});

test('slugify: empty string returns empty', async () => {
  const { slugify } = await import('../../src/format/section.mjs');
  assert.equal(slugify(''), '');
});

// ---------------------------------------------------------------------------
// Test 2 — locateSection on a 3-level-deep document (D-06)
// ---------------------------------------------------------------------------

test('locateSection: finds 3-level nested decision body', async () => {
  const { locateSection } = await import('../../src/format/section.mjs');
  const text = '# Phase 7\n\n## Decisions\n\n### D-01\nbody one\n\n### D-02\nbody two\n';
  const loc1 = locateSection(text, 'phase-7/decisions/d-01');
  assert.ok(loc1, 'phase-7/decisions/d-01 should resolve');
  assert.equal(loc1.bodyText, 'body one\n');
  const loc2 = locateSection(text, 'phase-7/decisions/d-02');
  assert.ok(loc2, 'phase-7/decisions/d-02 should resolve');
  assert.equal(loc2.bodyText, 'body two\n');
});

// ---------------------------------------------------------------------------
// Test 3 — locateSection returns null on missing anchor
// ---------------------------------------------------------------------------

test('locateSection: returns null on missing anchor', async () => {
  const { locateSection } = await import('../../src/format/section.mjs');
  assert.equal(locateSection('# A\nbody\n', 'b/c'), null);
});

// ---------------------------------------------------------------------------
// Test 4 — code-fence guard (Pitfall 8)
// ---------------------------------------------------------------------------

test('locateSection: code-fence guard skips in-fence pseudo-headings', async () => {
  const { locateSection } = await import('../../src/format/section.mjs');
  const text = '# A\n\n```bash\n# this is a bash comment, NOT a heading\n```\n\n## B\nbody\n';
  const loc = locateSection(text, 'a/b');
  assert.ok(loc, 'a/b should resolve past the code fence');
  // Plan: "ends with 'body'" — canonical join over [..., 'body', ''] = 'body\n'.
  // Match either trailing form so the assertion is robust to the trailing-newline
  // convention (see Test 2 which expects 'body one\n').
  assert.ok(
    loc.bodyText === 'body' || loc.bodyText === 'body\n',
    `expected bodyText to be 'body' or 'body\\n', got ${JSON.stringify(loc.bodyText)}`
  );
  // Must not match the in-fence pseudo-heading
  assert.equal(
    locateSection(text, 'this-is-a-bash-comment-not-a-heading'),
    null,
    'in-fence # comment must not register as a heading'
  );
});

// ---------------------------------------------------------------------------
// Test 5 — section-bounds end at next sibling-or-shallower heading (D-07)
// ---------------------------------------------------------------------------

test('locateSection: bodyText stops at next sibling heading', async () => {
  const { locateSection } = await import('../../src/format/section.mjs');
  const text = '# A\n## B\nb body\n## C\nc body\n';
  const loc = locateSection(text, 'a/b');
  assert.ok(loc, 'a/b should resolve');
  assert.equal(loc.bodyText, 'b body');
});

// ---------------------------------------------------------------------------
// Test 6 — leading-slash variant per D-06
// ---------------------------------------------------------------------------

test('locateSection: leading slash variant (D-06)', async () => {
  const { locateSection } = await import('../../src/format/section.mjs');
  const loc = locateSection('## Foo\nbody\n', '/foo');
  assert.ok(loc, '/foo should resolve');
  // Canonical algorithm output: input ends with '\n' so the line-split tail
  // is ['## Foo', 'body', ''] and bodyText = lines.slice(1, 3).join('\n')
  // = 'body\n'. Plan literally wrote 'body' (loose) — accept either form,
  // consistent with Test 2's 'body one\n' expectation.
  assert.ok(
    loc.bodyText === 'body' || loc.bodyText === 'body\n',
    `expected bodyText to be 'body' or 'body\\n', got ${JSON.stringify(loc.bodyText)}`
  );
});

// ---------------------------------------------------------------------------
// Test 7 — rewriteSection mode='overwrite' (D-07)
// ---------------------------------------------------------------------------

test("rewriteSection: 'overwrite' replaces body, preserves heading line", async () => {
  const { rewriteSection } = await import('../../src/format/section.mjs');
  const text = '# A\n## B\nold body\n## C\nc body\n';
  const result = rewriteSection(text, 'a/b', 'NEW', 'overwrite');
  assert.equal(result, '# A\n## B\nNEW\n## C\nc body\n');
});

// ---------------------------------------------------------------------------
// Test 8 — rewriteSection mode='append'
// ---------------------------------------------------------------------------

test("rewriteSection: 'append' inserts before next sibling", async () => {
  const { rewriteSection } = await import('../../src/format/section.mjs');
  const text = '# A\n## B\nold body\n## C\nc body\n';
  const result = rewriteSection(text, 'a/b', 'NEW', 'append');
  // 'old body' preserved; 'NEW' inserted before '## C'
  assert.ok(
    result.includes('old body\nNEW\n## C'),
    `expected 'old body\\nNEW\\n## C' in result, got ${JSON.stringify(result)}`
  );
  // '## B' heading preserved
  assert.ok(result.includes('## B\nold body'), 'heading + old body intact');
});

// ---------------------------------------------------------------------------
// Test 9 — rewriteSection mode='prepend'
// ---------------------------------------------------------------------------

test("rewriteSection: 'prepend' inserts after heading line, before existing body", async () => {
  const { rewriteSection } = await import('../../src/format/section.mjs');
  const text = '# A\n## B\nold body\n## C\nc body\n';
  const result = rewriteSection(text, 'a/b', 'NEW', 'prepend');
  // 'NEW' between '## B' and 'old body'
  assert.ok(
    result.includes('## B\nNEW\nold body'),
    `expected '## B\\nNEW\\nold body' in result, got ${JSON.stringify(result)}`
  );
});

// ---------------------------------------------------------------------------
// Test 10 — rewriteSection throws on missing anchor
// ---------------------------------------------------------------------------

test('rewriteSection: throws on missing anchor', async () => {
  const { rewriteSection } = await import('../../src/format/section.mjs');
  assert.throws(
    () => rewriteSection('# A\n', 'no/such', 'x', 'overwrite'),
    /section not found/
  );
});

// ---------------------------------------------------------------------------
// Test 11 — rewriteSection throws on unknown mode
// ---------------------------------------------------------------------------

test('rewriteSection: throws on unknown mode', async () => {
  const { rewriteSection } = await import('../../src/format/section.mjs');
  assert.throws(
    () => rewriteSection('# A\nbody', 'a', 'x', 'random'),
    /unknown mode/
  );
});
