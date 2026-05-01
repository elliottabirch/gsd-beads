// src/adapter/_atomicWrite.mjs
// Atomic file replace via tmpfile + rename per D-08.
//
// POSIX rename(2) is atomic against concurrent readers when source and
// destination are on the SAME filesystem (Pitfall 7). The tmp file is
// created NEXT TO the target (same directory) to guarantee that.
//
// Used by putRecord (Plan 04) + updateSection / updateFrontmatter /
// mergeFrontmatter / putNamedDoc (Plans 05+).

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

/**
 * Write `body` to `absPath` atomically.
 *
 * @param {string} absPath  absolute path of target file
 * @param {string|Buffer} body
 */
export function atomicWriteFile(absPath, body) {
  const dir = dirname(absPath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = resolve(
    dir,
    `.${basename(absPath)}.tmp.${process.pid}.${Date.now()}`
  );
  writeFileSync(tmpPath, body);
  renameSync(tmpPath, absPath);   // POSIX-atomic per D-08 / Pitfall 7
}
