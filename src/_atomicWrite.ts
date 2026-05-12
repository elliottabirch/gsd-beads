// src/_atomicWrite.ts
// Atomic file replace via tmpfile + POSIX rename.
//
// Ported from sibling src/adapter/_atomicWrite.mjs (v0.2 D-08, Pitfall 7)
// with the Landmine 13 / WR-05 fix baked in:
//
//   Sibling used `${pid}.${Date.now()}` as the tmpfile suffix. Under
//   ms-resolution concurrent writers from the same process (e.g. Promise.all
//   of parallel atomicWriteFile calls), Date.now() collides — two writers
//   both pick the same suffix, the second renameSync wins but the first
//   writer's renameSync target can be gone by the time it runs.
//
//   Fix: `${pid}.${crypto.randomBytes(6).toString('hex')}` gives 48 bits of
//   entropy per tmpfile. Collision probability is effectively zero across
//   realistic concurrency levels.
//
// POSIX rename(2) is atomic against concurrent readers when source and
// destination are on the SAME filesystem (Pitfall 7 — inherited from sibling).
// The tmp file is created NEXT TO the target (same directory) to guarantee
// same-filesystem placement. Do NOT move tmpfile to /tmp or equivalent.
//
// Used by putRecord (Plan 06-05), updateSection / updateFrontmatter /
// mergeFrontmatter / putNamedDoc (Plan 06-05+), and snapshot/restore
// (Plan 06-06).
//
// History: `git log --follow src/_atomicWrite.ts` traces back through the
// .mjs origin at src/adapter/_atomicWrite.mjs.

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Write `body` to `absPath` atomically via tmpfile + POSIX rename.
 *
 * Creates the parent directory if needed (recursive). The tmpfile lives in
 * the destination's directory to preserve POSIX same-filesystem atomicity.
 *
 * @param absPath - absolute path of target file
 * @param body    - string or Buffer to write
 */
export function atomicWriteFile(absPath: string, body: string | Buffer): void {
  const dir = dirname(absPath);
  mkdirSync(dir, { recursive: true });
  const suffix = `${process.pid}.${randomBytes(6).toString('hex')}`;
  const tmpPath = resolve(dir, `.${basename(absPath)}.tmp.${suffix}`);
  writeFileSync(tmpPath, body);
  renameSync(tmpPath, absPath); // POSIX-atomic per Pitfall 7 / WR-05 fixed
}
