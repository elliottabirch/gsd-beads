import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWriteFile } from '../../src/_atomicWrite.js';

describe('atomicWriteFile (WR-05 race-resistance)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'atw-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the full body at the destination', async () => {
    const p = join(dir, 'hello.txt');
    atomicWriteFile(p, 'world');
    expect(await readFile(p, 'utf-8')).toBe('world');
  });

  it('writes a Buffer body', async () => {
    const p = join(dir, 'bin.dat');
    atomicWriteFile(p, Buffer.from([0x68, 0x69]));
    expect(readFileSync(p, 'utf-8')).toBe('hi');
  });

  it('creates parent dirs recursively', async () => {
    const p = join(dir, 'a/b/c/file.txt');
    atomicWriteFile(p, 'deep');
    expect(await readFile(p, 'utf-8')).toBe('deep');
  });

  it('WR-05: 10 parallel writers produce no tmpfile collisions', async () => {
    // Parallel Promise.all exercises the race the sibling's Date.now() suffix
    // could hit. With randomBytes(6) suffix, all 10 renames succeed and no
    // tmpfiles remain on disk.
    const paths = Array.from({ length: 10 }, (_, i) => join(dir, `f-${i}.txt`));
    await Promise.all(
      paths.map((p, i) => Promise.resolve(atomicWriteFile(p, String(i)))),
    );
    const entries = await readdir(dir);
    const finalFiles = entries.filter((e) => e.startsWith('f-'));
    const tmpFiles = entries.filter((e) => e.includes('.tmp.'));
    expect(finalFiles.length).toBe(10);
    expect(tmpFiles.length).toBe(0);
    // Contents preserved per-writer:
    for (let i = 0; i < 10; i++) {
      expect(await readFile(paths[i]!, 'utf-8')).toBe(String(i));
    }
  });

  it('WR-05: 50 parallel writers to the SAME target produce exactly one file', async () => {
    // Worst case: 50 writers all targeting `shared.txt`. randomBytes(6) gives
    // 48-bit entropy per tmpfile → no collisions across 50 writers. Final
    // file exists with one of the written bodies; no tmpfiles leak.
    const target = join(dir, 'shared.txt');
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(atomicWriteFile(target, `writer-${i}`)),
      ),
    );
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.includes('.tmp.')).length).toBe(0);
    expect(entries.filter((e) => e === 'shared.txt').length).toBe(1);
    const body = await readFile(target, 'utf-8');
    expect(body).toMatch(/^writer-\d+$/);
  });
});
