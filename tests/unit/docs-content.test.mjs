// tests/unit/docs-content.test.mjs
// Verifies DOC-01 (README.md) + DOC-02 (CLAUDE.md) + CONTRIBUTING.md.
// Wave 0 file: red until Plan 07 lands the documentation rewrite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');
const exists = (rel) => existsSync(resolve(ROOT, rel));

test('DOC-01: README mentions BeadsAdapter', () => {
  const readme = read('README.md');
  assert.match(readme, /BeadsAdapter/,
    'README.md must reference BeadsAdapter');
});

test('DOC-01: README mentions sibling fork at ~/code/get-shit-done', () => {
  const readme = read('README.md');
  assert.match(readme, /~\/code\/get-shit-done|get-shit-done-cc/,
    'README.md must reference sibling fork');
});

test('DOC-01: README does NOT promote install.sh as active', () => {
  const readme = read('README.md');
  // install.sh should NOT appear as install instruction. It may
  // appear in a "Removed in v1.0" note, but not as ./install.sh.
  assert.doesNotMatch(readme, /^\s*\.\/install\.sh/m,
    'README.md must not show ./install.sh as an active install step');
});

test('DOC-02: CLAUDE.md describes sibling adapter library role', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /sibling|adapter library/i,
    'CLAUDE.md must describe sibling adapter library role');
});

test('DOC-02 (D-24): CLAUDE.md preserves spike-findings auto-load', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /Skill\("spike-findings-gsd-beads"\)/,
    'CLAUDE.md MUST preserve `Skill("spike-findings-gsd-beads")` auto-load (D-24)');
});

test('DOC-02: CLAUDE.md mentions fork repo location', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /~\/code\/get-shit-done/,
    'CLAUDE.md must reference fork at ~/code/get-shit-done');
});

test('CONTRIBUTING.md exists with npm link workflow (D-06)', () => {
  assert.ok(exists('CONTRIBUTING.md'),
    'CONTRIBUTING.md must exist (D-06)');
  const contrib = read('CONTRIBUTING.md');
  assert.match(contrib, /npm link/,
    'CONTRIBUTING.md must document npm link workflow');
});

test('DOC-02: CLAUDE.md drops stale "skill + hook layer" framing', () => {
  const claude = read('CLAUDE.md');
  assert.doesNotMatch(claude, /skill \+ hook layer/,
    'CLAUDE.md must remove the v0.2 "skill + hook layer" framing');
});
