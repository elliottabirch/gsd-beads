// tests/shadow-tests/findBeadsRoot.test.mjs
// REQ-QUAL-03 — findBeadsRoot worktree-aware root discovery (D-01..D-04).
// Worktree fixture pattern from RESEARCH §Pattern 5 + tests/cross-worktree/lib/setup.sh.
// Co-locates src + wt under one tempdir so a single rm -rf cleans both.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBeadsRoot } from '../../bin/gsd-sdk-shadow.mjs';

function worktreeBeadsFixture() {
  // Co-locate src + wt under one tempdir (avoids orphan refs in
  // <source>/.git/worktrees/ — pattern from tests/cross-worktree/lib/setup.sh:81-103).
  const root = mkdtempSync(join(tmpdir(), 'gsd-wt-test-'));
  const src = join(root, 'src');
  const wt = join(root, 'wt');
  mkdirSync(src);
  execSync('git init -q', { cwd: src });
  execSync('git config user.email t@t.t', { cwd: src });
  execSync('git config user.name t', { cwd: src });
  execSync('git commit -q --allow-empty -m init', { cwd: src });
  execSync('bd init --non-interactive --skip-agents --prefix wt >/dev/null 2>&1', { cwd: src });
  execSync(`git -C ${src} worktree add ${wt} -b feat`, { stdio: 'ignore' });
  return { root, src, wt };
}

// CASE 1: from a worktree, findBeadsRoot returns the source repo path
test('findBeadsRoot CASE 1: worktree resolves to source repo', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // From the worktree dir, .beads/ is in src — findBeadsRoot must follow .git file.
  assert.equal(findBeadsRoot(wt), src);
});

// CASE 2: BEADS_DIR env wins over parent-walk
test('findBeadsRoot CASE 2: BEADS_DIR env wins over walk', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  const otherSrc = join(root, 'other');
  mkdirSync(otherSrc);
  execSync('git init -q', { cwd: otherSrc });
  execSync('git config user.email t@t.t', { cwd: otherSrc });
  execSync('git config user.name t', { cwd: otherSrc });
  execSync('git commit -q --allow-empty -m i', { cwd: otherSrc });
  execSync('bd init --non-interactive --skip-agents --prefix oth >/dev/null 2>&1', { cwd: otherSrc });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const prev = process.env.BEADS_DIR;
  process.env.BEADS_DIR = join(otherSrc, '.beads');
  try {
    assert.equal(findBeadsRoot(wt), otherSrc);
  } finally {
    if (prev === undefined) delete process.env.BEADS_DIR;
    else process.env.BEADS_DIR = prev;
  }
});

// CASE 3: symlinked .beads/ is resolved via realpathSync
test('findBeadsRoot CASE 3: symlinked .beads/ resolves via realpath', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  const linkRoot = join(root, 'linked');
  mkdirSync(linkRoot);
  symlinkSync(join(src, '.beads'), join(linkRoot, '.beads'));
  // also need a .git so the walk knows linkRoot is a project (and to halt the walk)
  execSync('git init -q', { cwd: linkRoot });
  execSync('git config user.email t@t.t', { cwd: linkRoot });
  execSync('git config user.name t', { cwd: linkRoot });
  execSync('git commit -q --allow-empty -m i', { cwd: linkRoot });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = findBeadsRoot(linkRoot);
  // realpath dereferences the symlink; the answer is whichever side findBeadsRoot
  // encounters first — RESEARCH §Pattern 5 line 595 documents this latitude.
  assert.ok(result === linkRoot || result === src,
    `expected either symlink-side or realpath-target, got: ${result}`);
});

// CASE 4: a directory under git but with no .beads/ anywhere returns null
test('findBeadsRoot CASE 4: non-bd project returns null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-no-beads-'));
  try {
    execSync('git init -q', { cwd: dir });
    execSync('git config user.email t@t.t', { cwd: dir });
    execSync('git config user.name t', { cwd: dir });
    execSync('git commit -q --allow-empty -m i', { cwd: dir });
    assert.equal(findBeadsRoot(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CASE 5: bare directory NOT under git, NOT a real .beads/ — halts at filesystem root, returns null
test('findBeadsRoot CASE 5: halts at filesystem root, returns null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-bare-'));
  try {
    // No git init, no bd init. Walk must terminate at filesystem root, not throw or hang.
    assert.equal(findBeadsRoot(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
