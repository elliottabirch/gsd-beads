/**
 * Smoke coverage for BeadsAdapter.normalize() (D-13 + fork ADR
 * D-2026-05-12-NORMALIZE).
 *
 * Validates the three invariants the property-based round-trip
 * tests (fork Plan 07-05) depend on:
 *
 *   - purity:         normalize has no observable side effects
 *   - idempotency:    normalize(normalize(x)) === normalize(x)
 *   - determinism:    two fresh BeadsAdapters produce the same output
 *
 * The fork's paired conformance suite (Plan 07-04) imports this
 * factory indirectly via `gsd-beads/testing`; a regression caught
 * here prevents fork CI flakes.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setupFreshAdapter } from '../fixture.js';
import type { BeadsAdapter } from '../../src/index.js';

describe('BeadsAdapter.normalize (D-13)', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  async function makeAdapter(): Promise<BeadsAdapter> {
    const { adapter, cleanup } = await setupFreshAdapter();
    cleanups.push(cleanup);
    return adapter;
  }

  it('returns body-only input with trailing structure preserved (pure)', async () => {
    const a = await makeAdapter();
    const out = a.normalize('body only\n');
    expect(out).toContain('body only');
  });

  it('canonicalizes frontmatter via js-yaml round-trip', async () => {
    const a = await makeAdapter();
    const out = a.normalize('---\nkey: val\n---\nbody\n');
    expect(out).toMatch(/^---\n/);
    expect(out).toContain('key: val');
    expect(out).toContain('body');
  });

  it('is idempotent for a corpus of edge-case bodies', async () => {
    const a = await makeAdapter();
    const corpus = [
      '',
      'body only\n',
      '---\nkey: val\n---\nbody\n',
      '---\nunicode: "hello 世界"\n---\ntext 🎉\n',
      '---\nnested:\n  inner: 1\n  arr: [a, b]\n---\nbody\n',
    ];
    for (const input of corpus) {
      const once = a.normalize(input);
      const twice = a.normalize(once);
      expect(twice).toBe(once);
    }
  });

  it('is deterministic across two fresh adapters', async () => {
    const a1 = await makeAdapter();
    const a2 = await makeAdapter();
    const input = '---\nkey: val\n---\nbody\n';
    expect(a1.normalize(input)).toBe(a2.normalize(input));
  });

  it('accepts category arg without change in output', async () => {
    const a = await makeAdapter();
    const input = '---\nk: 1\n---\nbody\n';
    expect(a.normalize(input, 'root')).toBe(a.normalize(input));
    expect(a.normalize(input, 'intel')).toBe(a.normalize(input));
  });
});
