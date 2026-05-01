// tests/unit/package-json-shape.test.mjs
// Verifies ARCH-05 / D-06..D-09 package.json shape.
// Wave 0 file: red until Plan 07 writes package.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const PKG_PATH = resolve(ROOT, 'package.json');

test('ARCH-05: package.json exists and parses', () => {
  assert.ok(existsSync(PKG_PATH), 'package.json must exist at repo root');
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.ok(pkg);
});

test('ARCH-05/D-07: name + version + type', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.equal(pkg.name, 'gsd-beads', 'name must be gsd-beads (D-07)');
  assert.equal(pkg.version, '1.0.0-alpha.0', 'version must be 1.0.0-alpha.0 (D-07)');
  assert.equal(pkg.type, 'module', 'type must be "module" (ESM)');
});

test('ARCH-05/D-08: exports map subpath structure', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.equal(pkg.exports['.'], './src/adapter.mjs',
    '"." must point at src/adapter.mjs');
  const required = ['./bd', './bd/errors', './bd/findRoot', './helpers', './format/phase', './package.json'];
  for (const sub of required) {
    assert.ok(pkg.exports[sub] !== undefined,
      `exports must include subpath "${sub}" (D-08)`);
  }
});

test('ARCH-05/D-09: no bin entries (library shape)', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.equal(pkg.bin, undefined, 'package.json must have no "bin" field (D-09)');
});

test('ARCH-05/D-06: peer deps optional fork', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.equal(pkg.peerDependencies?.['get-shit-done-cc'], '*',
    'peerDependencies must declare "get-shit-done-cc": "*" (D-06)');
  assert.equal(pkg.peerDependenciesMeta?.['get-shit-done-cc']?.optional, true,
    'peerDependenciesMeta must mark fork as optional (D-06)');
});

test('ARCH-05/D-09: scripts have test/test:unit/test:conformance/link:fork; no install/postinstall', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  for (const s of ['test', 'test:unit', 'test:conformance', 'link:fork']) {
    assert.ok(pkg.scripts?.[s], `scripts.${s} must be present (D-09)`);
  }
  assert.equal(pkg.scripts?.install, undefined, 'no install script allowed (CLEAN-04)');
  assert.equal(pkg.scripts?.postinstall, undefined, 'no postinstall script allowed (CLEAN-04)');
});

test('ARCH-05/D-09: engines.node >=20', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.match(pkg.engines?.node ?? '', /^>=\s*20/, 'engines.node must be ">=20" (D-09)');
});
