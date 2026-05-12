/**
 * BEADS-05 smoke: writeBinaryAsset + markdownLockfile methods throw
 * UnsupportedCapabilityError; capability flags report false.
 */
import { describe, it, expect } from 'vitest';
import {
  hasBinaryAsset,
  hasMarkdownLockfile,
  UnsupportedCapabilityError,
} from 'get-shit-done-cc/adapters/types.js';
import { BeadsAdapter } from '../../src/index.js';
import { setupFreshAdapter } from '../fixture.js';

describe('BeadsAdapter capabilities.binaryAsset (BEADS-05 — D-BINARY)', () => {
  it('capabilities.binaryAsset === false', () => {
    const adapter = new BeadsAdapter('/tmp/unused');
    expect(adapter.capabilities.binaryAsset).toBe(false);
  });

  it('hasBinaryAsset(adapter) returns false', () => {
    const adapter = new BeadsAdapter('/tmp/unused');
    expect(hasBinaryAsset(adapter)).toBe(false);
  });

  it('writeBinaryAsset throws UnsupportedCapabilityError (capability=binaryAsset, adapterName=beads)', async () => {
    const h = await setupFreshAdapter();
    try {
      await expect(
        h.adapter.writeBinaryAsset('x.png', new Uint8Array([1, 2, 3])),
      ).rejects.toSatisfy((e: unknown) => {
        return (
          e instanceof UnsupportedCapabilityError &&
          (e as UnsupportedCapabilityError).capability === 'binaryAsset' &&
          (e as UnsupportedCapabilityError).adapterName === 'beads'
        );
      });
    } finally {
      await h.cleanup();
    }
  });
});

describe('BeadsAdapter capabilities.markdownLockfile (capability-lint)', () => {
  it('capabilities.markdownLockfile === false', () => {
    const adapter = new BeadsAdapter('/tmp/unused');
    expect(adapter.capabilities.markdownLockfile).toBe(false);
  });

  it('hasMarkdownLockfile(adapter) returns false', () => {
    const adapter = new BeadsAdapter('/tmp/unused');
    expect(hasMarkdownLockfile(adapter)).toBe(false);
  });

  it('replaceInCurrentMilestone throws UnsupportedCapabilityError', async () => {
    const adapter = new BeadsAdapter('/tmp/unused');
    await expect(
      adapter.replaceInCurrentMilestone(/x/, 'y'),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });

  it('readModifyWriteRoadmapMd throws UnsupportedCapabilityError', async () => {
    const adapter = new BeadsAdapter('/tmp/unused');
    await expect(
      adapter.readModifyWriteRoadmapMd((s) => s),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });
});
