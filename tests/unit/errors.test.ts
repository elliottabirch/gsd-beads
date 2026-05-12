import { describe, it, expect } from 'vitest';
import {
  BeadsCause,
  BeadsUnavailableError,
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsVersionMismatch,
  BeadsEmpty,
  BdManagedMismatchError,
} from '../../src/bd/errors.js';

describe('BeadsCause enum (ported from sibling)', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(BeadsCause)).toBe(true);
  });
  it('has the 6 known causes', () => {
    expect(Object.values(BeadsCause).sort()).toEqual(
      ['corrupt', 'empty', 'not-installed', 'unknown', 'unsupported', 'version-mismatch'].sort(),
    );
  });
});

describe('Sentinel subclasses', () => {
  it('BeadsNotInstalled sets name + cause', () => {
    const e = new BeadsNotInstalled('bd missing');
    expect(e.name).toBe('BeadsNotInstalled');
    expect(e.cause).toBe(BeadsCause.NotInstalled);
    expect(e instanceof BeadsUnavailableError).toBe(true);
  });
  it('BeadsCorrupt sets name + cause', () => {
    const e = new BeadsCorrupt('database corrupt');
    expect(e.name).toBe('BeadsCorrupt');
    expect(e.cause).toBe(BeadsCause.Corrupt);
  });
  it('BeadsVersionMismatch sets name + cause', () => {
    const e = new BeadsVersionMismatch('schema mismatch');
    expect(e.name).toBe('BeadsVersionMismatch');
    expect(e.cause).toBe(BeadsCause.VersionMismatch);
  });
  it('BeadsEmpty sets name + cause', () => {
    const e = new BeadsEmpty('no issues');
    expect(e.name).toBe('BeadsEmpty');
    expect(e.cause).toBe(BeadsCause.Empty);
  });
});

describe('BdManagedMismatchError (D-INIT-ERR — BEADS-04)', () => {
  it('has the locked code literal', () => {
    const e = new BdManagedMismatchError('/tmp/notbd', 'Run `bd init`.');
    expect(e.code).toBe('PROJECT_BD_MANAGED_MISMATCH');
    expect(e.projectDir).toBe('/tmp/notbd');
    expect(e.hint).toBe('Run `bd init`.');
  });
  it('has __brand for cross-module instanceof', () => {
    const e = new BdManagedMismatchError('/tmp/x', 'y');
    // Simulate a second module copy: reconstruct a plain object with __brand
    const copyShape: unknown = { __brand: 'BdManagedMismatchError' };
    expect(copyShape instanceof BdManagedMismatchError).toBe(true);
    expect(e instanceof BdManagedMismatchError).toBe(true);
  });
  it('has name = "BdManagedMismatchError"', () => {
    const e = new BdManagedMismatchError('/tmp/x', 'y');
    expect(e.name).toBe('BdManagedMismatchError');
  });
  it('message includes projectDir and hint', () => {
    const e = new BdManagedMismatchError('/tmp/notbd', 'Run `bd init`.');
    expect(e.message).toContain('/tmp/notbd');
    expect(e.message).toContain('Run `bd init`.');
  });
});
