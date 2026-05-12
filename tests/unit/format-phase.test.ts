import { describe, it, expect } from 'vitest';
import {
  parsePhaseTitle,
  formatPhaseTitle,
  parsePhaseDescription,
  formatPhaseDescription,
} from '../../src/format/phase.js';

describe('parsePhaseTitle / formatPhaseTitle round-trip', () => {
  it('round-trips integer phase numbers', () => {
    const title = 'Phase 6: BeadsAdapter implementation';
    const parsed = parsePhaseTitle(title);
    expect(parsed).toEqual({ number: '6', name: 'BeadsAdapter implementation' });
    expect(formatPhaseTitle(parsed)).toBe(title);
  });

  it('round-trips decimal phase numbers (4.1)', () => {
    const title = 'Phase 4.1: Urgent leak plug';
    const parsed = parsePhaseTitle(title);
    expect(parsed.number).toBe('4.1');
    expect(formatPhaseTitle(parsed)).toBe(title);
  });

  it('tolerates em-dashes in name', () => {
    const title = 'Phase 7: Conformance — cross-adapter proofs';
    const parsed = parsePhaseTitle(title);
    expect(parsed.name).toBe('Conformance — cross-adapter proofs');
  });

  it('throws on malformed input', () => {
    expect(() => parsePhaseTitle('not a phase title')).toThrow(/parsePhaseTitle/);
    expect(() => parsePhaseTitle('')).toThrow();
  });
});

describe('parsePhaseDescription idempotency contract (D-15)', () => {
  // Fixture 1 — minimal canonical shape (all four label styles mixed).
  const FIX_MINIMAL = [
    '**Goal**: Test goal line',
    '',
    '**Depends on**: Nothing prior',
    '',
    '**Requirements**: REQ-01, REQ-02',
    '',
    '**Success Criteria** (what must be TRUE):',
    '  1. First criterion',
    '  2. Second criterion',
    '',
    '**Plans:** TBD',
  ].join('\n');

  // Fixture 2 — mixed label styles (`**Foo:**` alternate form) + tail with checkboxes.
  const FIX_MIXED = [
    '**Goal:** Ship the adapter seam',
    '**Depends on:** Upstream refactor',
    '**Requirements:** ARCH-01',
    '**Success Criteria** (what must be TRUE):',
    '  1. All tests green',
    '  2. No leaks detected',
    '  3. Conformance suite passes',
    '**Plans**:',
    '- [x] Plan 01',
    '- [ ] Plan 02',
  ].join('\n');

  // Fixture 3 — multi-line Goal body (line continuation) + SC item continuation.
  const FIX_MULTILINE = [
    '**Goal**: Prove the thing',
    '  continued goal text',
    '**Depends on**: Phases 1-4',
    '**Requirements**: REQ-99',
    '**Success Criteria** (what must be TRUE):',
    '  1. First item',
    '     continuation of first',
    '  2. Second item',
    '**Plans:** See below',
  ].join('\n');

  const fixtures = [FIX_MINIMAL, FIX_MIXED, FIX_MULTILINE];

  for (let i = 0; i < fixtures.length; i++) {
    it(`fixture ${i}: parse(format(parse(x))) === parse(x)`, () => {
      const parsed1 = parsePhaseDescription(fixtures[i]!);
      const formatted = formatPhaseDescription(parsed1);
      const parsed2 = parsePhaseDescription(formatted);
      expect(parsed2).toEqual(parsed1);
    });
  }

  it('captures goal/depends_on/requirements from minimal fixture', () => {
    const parsed = parsePhaseDescription(FIX_MINIMAL);
    expect(parsed.goal).toBe('Test goal line');
    expect(parsed.depends_on).toBe('Nothing prior');
    expect(parsed.requirements).toBe('REQ-01, REQ-02');
    expect(parsed.success_criteria).toEqual(['First criterion', 'Second criterion']);
    // Tail is opaque but captured byte-equal modulo trailing whitespace.
    expect(parsed.tail).toContain('**Plans');
  });

  it('empty input returns empty structure (edge case)', () => {
    const parsed = parsePhaseDescription('');
    expect(parsed.goal).toBe('');
    expect(parsed.success_criteria).toEqual([]);
    expect(parsed.tail).toBe('');
  });
});
