// tests/unit/atomicWrite.test.mjs
// Phase 7 Plan 04 — Atomic file replace helper (D-08).
// Verifies tmpfile + rename pattern: same-fs tmpfile, no leftover, parent-dir
// recursion. Pure unit test (no bd, no spawn).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWriteFile } from '../../src/adapter/_atomicWrite.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'gsd-atomic-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('atomicWriteFile: writes new file', (t) => {
  const root = fixture(t);
  const target = join(root, 'foo.md');
  atomicWriteFile(target, 'hello');
  assert.equal(readFileSync(target, 'utf-8'), 'hello');
});

test('atomicWriteFile: overwrites existing file', (t) => {
  const root = fixture(t);
  const target = join(root, 'foo.md');
  writeFileSync(target, 'a');
  atomicWriteFile(target, 'b');
  assert.equal(readFileSync(target, 'utf-8'), 'b');
});

test('atomicWriteFile: no leftover tmp file on success', (t) => {
  const root = fixture(t);
  const target = join(root, 'foo.md');
  atomicWriteFile(target, 'hello');
  const entries = readdirSync(root).filter(e => !e.startsWith('.foo.md.tmp'));
  // Only the target file should remain (no .tmp.* leftover)
  const leftoverTmps = readdirSync(root).filter(e => e.startsWith('.foo.md.tmp'));
  assert.equal(leftoverTmps.length, 0, 'no tmp leftover');
  assert.deepEqual(entries, ['foo.md']);
});

test('atomicWriteFile: creates missing parent directories', (t) => {
  const root = fixture(t);
  const target = join(root, 'a/b/c/foo.md');
  atomicWriteFile(target, 'nested');
  assert.equal(readFileSync(target, 'utf-8'), 'nested');
});
