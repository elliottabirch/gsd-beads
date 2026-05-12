import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { findBeadsRoot } from '../../src/bd/findRoot.js';

describe('findBeadsRoot — 4 topology cases', () => {
  let base: string;
  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'findroot-'));
  });
  afterEach(async () => {
    delete process.env.BEADS_DIR;
    await rm(base, { recursive: true, force: true });
  });

  it('case 1: BEADS_DIR env override with metadata.json present', async () => {
    const bd = join(base, '.beads');
    await mkdir(bd, { recursive: true });
    await writeFile(join(bd, 'metadata.json'), '{}');
    process.env.BEADS_DIR = bd;
    // env-override returns PARENT of .beads (the project root)
    const expected = realpathSync(base);
    expect(findBeadsRoot(base)).toBe(expected);
  });

  it('case 1b: BEADS_DIR env set but metadata.json missing → walks up (env not honored without metadata)', async () => {
    const bd = join(base, 'beads-dir-empty');
    await mkdir(bd, { recursive: true });
    process.env.BEADS_DIR = bd;
    // env doesn't resolve; fall through to parent-walk, which finds nothing
    expect(findBeadsRoot(base)).toBeNull();
  });

  it('case 2: parent-walk finds .beads/metadata.json', async () => {
    const project = join(base, 'project');
    const nested = join(project, 'sub/deep');
    await mkdir(nested, { recursive: true });
    await mkdir(join(project, '.beads'), { recursive: true });
    await writeFile(join(project, '.beads/metadata.json'), '{}');
    const expected = realpathSync(project);
    expect(findBeadsRoot(nested)).toBe(expected);
  });

  it('case 3: non-bd dir → null', () => {
    expect(findBeadsRoot(base)).toBeNull();
  });

  it('case 4: worktree (.git-as-file) stops walk at primary repo boundary; no .beads → null', async () => {
    const main = join(base, 'main');
    const work = join(base, 'worktree');
    await mkdir(main, { recursive: true });
    await mkdir(work, { recursive: true });
    // worktree .git is a file pointing at main's worktrees subdir
    await writeFile(join(work, '.git'), `gitdir: ${main}/.git/worktrees/wt\n`);
    // No .beads anywhere → null
    expect(findBeadsRoot(work)).toBeNull();
  });
});
