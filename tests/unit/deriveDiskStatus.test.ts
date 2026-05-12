/**
 * deriveDiskStatus unit tests — locks in the 7-value priority chain.
 *
 * Particular attention to the WR-08 orphan-summary case:
 * `summaryCount > 0 && planCount === 0` → 'partial'. Sibling's D-07
 * priority chain says summary-without-plan maps to 'partial'; callers
 * interpreting 'partial' as "plans exist and some are done" will
 * misroute the orphan-summary workflow. Until downstream consumers are
 * audited (Phase 7 CONFORM-04) and a distinct 'orphan-summary' enum
 * value is plumbed through the SDK, this test locks in the current
 * semantic so any accidental drift is caught in CI.
 */

import { describe, it, expect } from 'vitest';
import { deriveDiskStatus } from '../../src/helpers/deriveDiskStatus.js';

describe('deriveDiskStatus — D-07 priority chain', () => {
  it('no_directory wins over everything when dirExists=false', () => {
    expect(
      deriveDiskStatus({
        planCount: 3,
        summaryCount: 3,
        hasContext: true,
        hasResearch: true,
        dirExists: false,
      }),
    ).toBe('no_directory');
  });

  it('complete: summaryCount >= planCount AND planCount > 0', () => {
    expect(
      deriveDiskStatus({
        planCount: 2,
        summaryCount: 2,
        hasContext: false,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('complete');
    expect(
      deriveDiskStatus({
        planCount: 2,
        summaryCount: 3,
        hasContext: false,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('complete');
  });

  it('partial: summaryCount > 0 but less than planCount', () => {
    expect(
      deriveDiskStatus({
        planCount: 3,
        summaryCount: 1,
        hasContext: false,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('partial');
  });

  it('WR-08: orphan-summary (summaryCount > 0, planCount === 0) → "partial" — sibling-carry-forward semantic locked', () => {
    // Downstream semantic note: `'partial'` for the orphan-summary case
    // means "summaries exist, plans don't" — DIFFERENT from the
    // "summaries partially complete a plan set" meaning that also maps
    // to 'partial'. If downstream consumers need to distinguish these,
    // Phase 7 CONFORM-04 would plumb through a distinct enum value
    // (e.g. 'orphan-summary'); v1.0 preserves sibling's collapsed
    // semantic intentionally.
    expect(
      deriveDiskStatus({
        planCount: 0,
        summaryCount: 1,
        hasContext: false,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('partial');
  });

  it('planned: planCount > 0 but summaryCount === 0', () => {
    expect(
      deriveDiskStatus({
        planCount: 2,
        summaryCount: 0,
        hasContext: false,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('planned');
  });

  it('researched: planCount === 0, summaryCount === 0, hasResearch', () => {
    expect(
      deriveDiskStatus({
        planCount: 0,
        summaryCount: 0,
        hasContext: false,
        hasResearch: true,
        dirExists: true,
      }),
    ).toBe('researched');
  });

  it('discussed: only hasContext', () => {
    expect(
      deriveDiskStatus({
        planCount: 0,
        summaryCount: 0,
        hasContext: true,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('discussed');
  });

  it('empty: dir exists but nothing else', () => {
    expect(
      deriveDiskStatus({
        planCount: 0,
        summaryCount: 0,
        hasContext: false,
        hasResearch: false,
        dirExists: true,
      }),
    ).toBe('empty');
  });
});
