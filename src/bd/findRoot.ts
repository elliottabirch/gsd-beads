// src/bd/findRoot.ts
// findBeadsRoot — read-side project-root discovery.
//
// Ported from sibling src/bd/findRoot.mjs (Phase 6 D-SCAFFOLD whitelist).
// Semantics preserved VERBATIM — the 4 topology cases are validated by
// tests/unit/findRoot.test.ts.
//
// Phase 4 D-01..D-04 + REQ-QUAL-03 semantics (inherited from sibling):
//   - BEADS_DIR env wins (D-01); returns dirname(metadata.json parent)
//   - Parent-walk bounded at git root (D-02)
//   - realpathSync follows symlinks (D-03)
//   - .git-as-FILE worktree resolution: read gitdir, walk to source repo
//
// History: `git log --follow src/bd/findRoot.ts` traces back through the
// .mjs origin (Phase 4 deliverable).

import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

/**
 * Locate the project root of a bd-managed workspace by walking upward from
 * `start`. Returns the project root path (parent of `.beads/`), or `null`
 * if no bd-managed ancestor is found.
 *
 * 4 topology cases (preserved from sibling — any reimplementation breaks one):
 *   1. BEADS_DIR env set and points at a directory containing metadata.json
 *      → returns dirname(resolved BEADS_DIR).
 *   2. Parent-walk finds `<dir>/.beads/metadata.json` → returns `<dir>`.
 *   3. Git-root boundary: `.git` as directory stops the walk; returns
 *      `<dir>` if bd-managed at that level, else null.
 *   4. Worktree: `.git` as file (contains `gitdir:` pointer) → resolves to
 *      source repo root; returns source root if bd-managed there, else null.
 *
 * Returns `null` on non-bd dirs or when realpath fails.
 */
export function findBeadsRoot(start: string): string | null {
  const envDir = process.env.BEADS_DIR;
  if (envDir) {
    let resolved: string | null;
    try {
      resolved = realpathSync(resolve(envDir));
    } catch {
      resolved = null;
    }
    if (resolved && existsSync(join(resolved, 'metadata.json'))) {
      return dirname(resolved);
    }
  }
  let dir: string;
  try {
    dir = realpathSync(resolve(start));
  } catch {
    return null;
  }
  while (true) {
    const gitMarker = join(dir, '.git');
    const hasGit = existsSync(gitMarker);
    if (hasGit) {
      // Worktree first: bd init commits .beads/metadata.json into git, so a
      // worktree always has its own (transitive) .beads/metadata.json copy —
      // but the real bd state (Dolt store, etc.) lives only in the source
      // repo. Resolve to the source repo per REQ-QUAL-03 plan contract.
      const stat = statSync(gitMarker);
      if (stat.isFile()) {
        // .git file contains "gitdir: /path/to/source/.git/worktrees/<name>"
        const content = readFileSync(gitMarker, 'utf-8').trim();
        const m = content.match(/^gitdir:\s*(.+)$/m);
        if (m && m[1]) {
          const sourceGitDir = m[1].trim();
          // sourceGitDir ends in /.git/worktrees/<name>; walk up three
          // dirnames to source root.
          const sourceRoot = dirname(dirname(dirname(sourceGitDir)));
          if (existsSync(join(sourceRoot, '.beads', 'metadata.json'))) {
            return sourceRoot;
          }
        }
        return null;
      }
      // Regular git repo (.git is a directory): check for .beads/ at this
      // level (D-02: halt walk at git root). Return dir if bd-managed,
      // else null.
      if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
      return null;
    }
    // No .git at this level — check for .beads/ then walk up.
    if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
