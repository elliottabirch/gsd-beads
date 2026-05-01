// tests/unit/milestone-scoping.test.mjs
//
// Asserts D-05: per-worktree STATE.md scoping. Two worktrees on different
// milestones (v0.2 vs v0.3) sharing one bd store see DIFFERENT STATE.md
// content because regen-state.sh reads `git config --worktree gsd-beads.milestone`
// (worktree-local), NOT bd.
//
// Topology pattern: tests/cross-worktree/simulation.sh:46-58 — co-located
// src + 2 worktrees under one tempdir; single rm -rf cleans up.
//
// T-04-19 mitigation: `git config extensions.worktreeConfig true` MUST be
// set on the source repo BEFORE adding worktrees, otherwise
// `git config --worktree` writes fall back to shared config and BOTH
// worktrees see the same milestone (silent false-positive).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');

function multiMilestoneFixture() {
  const root = mkdtempSync(join(tmpdir(), 'gsd-milestone-'));
  const src = join(root, 'source');
  const wtA = join(root, 'wt-a');
  const wtB = join(root, 'wt-b');
  mkdirSync(src);

  // Init source repo with extensions.worktreeConfig=true (T-04-19 mitigation:
  // must be set BEFORE `git worktree add` so per-worktree config writes don't
  // fall back to shared config).
  execSync('git init -q', { cwd: src });
  execSync('git config user.email t@t.t', { cwd: src });
  execSync('git config user.name t', { cwd: src });
  execSync('git config extensions.worktreeConfig true', { cwd: src });
  execSync('git commit -q --allow-empty -m init', { cwd: src });

  // Seed multi-milestone bd state in source (shared bd store).
  execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${src}`);

  // Add 2 worktrees as siblings of src (T-04-18: co-located cleanup).
  execSync(`git -C ${src} worktree add ${wtA} -b m-v0.2`, { stdio: 'ignore' });
  execSync(`git -C ${src} worktree add ${wtB} -b m-v0.3`, { stdio: 'ignore' });

  // Set worktree-local milestone (D-05).
  execSync(`git -C ${wtA} config --worktree gsd-beads.milestone v0.2`);
  execSync(`git -C ${wtB} config --worktree gsd-beads.milestone v0.3`);

  // Each worktree needs its own .planning/ for STATE.md output.
  mkdirSync(join(wtA, '.planning'), { recursive: true });
  mkdirSync(join(wtB, '.planning'), { recursive: true });

  return { root, src, wtA, wtB };
}

test('milestone-scoping CASE 1: WT-A milestone v0.2 produces v0.2 STATE.md', (t) => {
  const { root, wtA } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  execSync(`bash ${REPO_ROOT}/archive/v0.2-shadow/scripts/regen-state.sh`, { cwd: wtA });
  const stateA = readFileSync(join(wtA, '.planning/STATE.md'), 'utf-8');
  assert.match(stateA, /v0\.2/, 'WT-A STATE.md should mention v0.2');
  assert.doesNotMatch(stateA, /v0\.3/, 'WT-A STATE.md should NOT mention v0.3');
});

test('milestone-scoping CASE 2: WT-B milestone v0.3 produces v0.3 STATE.md', (t) => {
  const { root, wtB } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  execSync(`bash ${REPO_ROOT}/archive/v0.2-shadow/scripts/regen-state.sh`, { cwd: wtB });
  const stateB = readFileSync(join(wtB, '.planning/STATE.md'), 'utf-8');
  assert.match(stateB, /v0\.3/, 'WT-B STATE.md should mention v0.3');
  assert.doesNotMatch(stateB, /v0\.2/, 'WT-B STATE.md should NOT mention v0.2');
});
