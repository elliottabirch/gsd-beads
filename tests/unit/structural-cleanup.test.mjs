// tests/unit/structural-cleanup.test.mjs
// Verifies CLEAN-01..04 + the D-12 REQUIREMENTS.md wording fix.
// Wave 0 file: red until Plans 02 + 07 land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const exists = (rel) => existsSync(resolve(ROOT, rel));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

test('CLEAN-01: shadow binaries archived, originals removed', () => {
  assert.ok(exists('archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs'),
    'shadow binary should be in archive');
  assert.ok(exists('archive/v0.2-shadow/bin/wrap-mutation.mjs'),
    'wrap-mutation should be in archive');
  assert.ok(!exists('bin/gsd-sdk-shadow.mjs'),
    'bin/gsd-sdk-shadow.mjs should be archived (removed from bin/)');
  assert.ok(!exists('bin/wrap-mutation.mjs'),
    'bin/wrap-mutation.mjs should be archived (removed from bin/)');
});

test('CLEAN-02: shadow hooks archived, originals removed', () => {
  const hooks = ['block-gsd-sdk-mutation', 'block-state-md', 'bd-sync', 'worktree-post-checkout'];
  for (const h of hooks) {
    assert.ok(exists(`archive/v0.2-shadow/hooks/${h}.sh`),
      `${h}.sh should be in archive`);
    assert.ok(!exists(`hooks/${h}.sh`),
      `hooks/${h}.sh should be removed`);
  }
});

test('CLEAN-03 file moves: regen + cascade-loop scripts archived', () => {
  const scripts = ['regen-roadmap', 'regen-requirements', 'regen-state', 'cascade-loop'];
  for (const s of scripts) {
    assert.ok(exists(`archive/v0.2-shadow/scripts/${s}.sh`),
      `${s}.sh should be in archive`);
    assert.ok(!exists(`scripts/${s}.sh`),
      `scripts/${s}.sh should be removed`);
  }
});

test('CLEAN-03 REQUIREMENTS.md wording: D-12 reflected', () => {
  const req = read('.planning/REQUIREMENTS.md');
  assert.match(req, /scripts\/cascade-loop\.sh also archives/,
    'REQUIREMENTS.md CLEAN-03 must reflect D-12 (cascade-loop archives)');
});

test('CLEAN-04: install.sh deleted', () => {
  assert.ok(!exists('install.sh'),
    'install.sh should be deleted (CLEAN-04)');
});
