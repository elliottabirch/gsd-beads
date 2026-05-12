// src/bd/findRoot.mjs
// findBeadsRoot — read-side project-root discovery.
//
// Extracted VERBATIM from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:237-282
// per Phase 6 D-11. Phase 4 D-01..D-04 + REQ-QUAL-03 semantics:
//   - BEADS_DIR env wins (D-01)
//   - Parent-walk bounded at git root (D-02)
//   - realpathSync follows symlinks (D-03)
//   - .git-as-FILE worktree resolution: read gitdir, walk to source repo
//
// History: see `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs`
// for the original ship history (Phase 4 deliverable).

import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

// ===== VERBATIM EXTRACTION FROM SHADOW LINES 237-282 =====
// Do not modify this function body. The migrated test
// tests/unit/findBeadsRoot.test.mjs validates 4 cases (worktree,
// BEADS_DIR, symlink, non-bd) — any re-implementation breaks one.

export function findBeadsRoot(start) {
  const envDir = process.env.BEADS_DIR;
  if (envDir) {
    let resolved;
    try { resolved = realpathSync(resolve(envDir)); } catch { resolved = null; }
    if (resolved && existsSync(join(resolved, 'metadata.json'))) {
      return dirname(resolved);
    }
  }
  let dir;
  try { dir = realpathSync(resolve(start)); } catch { return null; }
  while (true) {
    const gitMarker = join(dir, '.git');
    const hasGit = existsSync(gitMarker);
    if (hasGit) {
      // Check worktree first: bd init commits .beads/metadata.json into git, so a
      // worktree always has its own (transitive) .beads/metadata.json copy — but the
      // real bd state (Dolt store, etc.) lives only in the source repo. We must
      // resolve to the source repo per REQ-QUAL-03 plan contract.
      const stat = statSync(gitMarker);
      if (stat.isFile()) {
        // Worktree: .git file contains "gitdir: /path/to/source/.git/worktrees/<name>"
        const content = readFileSync(gitMarker, 'utf-8').trim();
        const m = content.match(/^gitdir:\s*(.+)$/m);
        if (m) {
          const sourceGitDir = m[1].trim();
          // sourceGitDir ends in /.git/worktrees/<name>; walk up three dirnames to source root
          const sourceRoot = dirname(dirname(dirname(sourceGitDir)));
          if (existsSync(join(sourceRoot, '.beads', 'metadata.json'))) {
            return sourceRoot;
          }
        }
        return null;
      }
      // Regular git repo (.git is a directory): check for .beads/ at this level
      // (D-02: halt walk at git root). Return dir if bd-managed, else null.
      if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
      return null;
    }
    // No .git at this level — check for .beads/ then walk up
    if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
