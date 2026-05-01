// tests/unit/format-phase.test.mjs
// Verifies ARCH-03 round-trip contract per D-15 + D-17.
// Wave 0 file: red until Plan 05 lands src/format/phase.mjs and the
// 11 fixture files in tests/unit/fixtures/phase-format/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures/phase-format');

test('parsePhaseTitle: simple single-digit', async () => {
  const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
  assert.deepEqual(
    parsePhaseTitle('Phase 1: Spike — validate beads + GSD topology'),
    { number: '1', name: 'Spike — validate beads + GSD topology' }
  );
});

test('parsePhaseTitle: two-digit', async () => {
  const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
  assert.deepEqual(
    parsePhaseTitle('Phase 13: Workflow init bundlers + conformance test suite + final docs'),
    { number: '13', name: 'Workflow init bundlers + conformance test suite + final docs' }
  );
});

test('parsePhaseTitle: decimal phase number preserved', async () => {
  const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
  assert.deepEqual(
    parsePhaseTitle('Phase 72.1: gap closure'),
    { number: '72.1', name: 'gap closure' }
  );
});

test('formatPhaseTitle: round-trip on single title', async () => {
  const { parsePhaseTitle, formatPhaseTitle } = await import('../../src/format/phase.mjs');
  const original = 'Phase 6: Cleanup + adapter-library scaffolding';
  const parsed1 = parsePhaseTitle(original);
  const formatted = formatPhaseTitle(parsed1);
  const parsed2 = parsePhaseTitle(formatted);
  assert.deepStrictEqual(parsed2, parsed1,
    'parse(format(parse(x))) must equal parse(x) — D-15 idempotency');
});

// Per D-15 + D-17: round-trip idempotency for each fixture.
if (existsSync(FIXTURE_DIR)) {
  const fixtures = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.md'));
  for (const fixture of fixtures) {
    test(`round-trip idempotent description: ${fixture}`, async () => {
      const { parsePhaseDescription, formatPhaseDescription } =
        await import('../../src/format/phase.mjs');
      const body = readFileSync(resolve(FIXTURE_DIR, fixture), 'utf-8');
      const parsed1 = parsePhaseDescription(body);
      const formatted = formatPhaseDescription(parsed1);
      const parsed2 = parsePhaseDescription(formatted);
      assert.deepStrictEqual(parsed2, parsed1,
        `parse(format(parse(${fixture}))) must equal parse(${fixture})`);
    });
  }
} else {
  test('SKIP: fixture dir tests/unit/fixtures/phase-format/ does not exist yet', () => {
    // Plan 05 creates the fixtures; until then this branch fires once.
    assert.ok(true, 'fixture dir absent — Plan 05 will populate');
  });
}
