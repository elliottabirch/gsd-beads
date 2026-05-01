// tests/conformance/run.mjs
// Driver: invokes each conformance file's runConformance with concrete
// adapter factories.
//
// Wave-progressive FILES list — Plans 09/10 add binA-* and foundational-*.
// Per D-14, this driver is the spine; each conformance file exports
// runConformance(makeAdapter, label) and does NOT auto-register at the
// top level when GSD_CONFORMANCE_AUTORUN=0 (set below before imports).
//
// RUN_CROSS_ADAPTER=1 toggle reserved for Phase 13: when fork's
// MarkdownAdapter is reachable via npm link, push a second factory.

// Suppress per-file auto-run; the driver dispatches runConformance with
// its own factories. Without this gate, `npm run test:conformance`
// (which globs *.test.mjs) and the driver path would double-register
// the same suite.
process.env.GSD_CONFORMANCE_AUTORUN = '0';

import { setupFreshAdapter } from './fixture.mjs';

const FILES = [
  './capabilities.test.mjs',
  // Plan 09 adds: './binA-records.test.mjs', './binA-section.test.mjs', './binA-frontmatter.test.mjs'
  // Plan 10 adds: './foundational-events.test.mjs', './foundational-namedDoc.test.mjs', './foundational-snapshot.test.mjs'
];

const factories = [
  { label: 'beads', factory: (t) => setupFreshAdapter(t, 'beads') },
];

if (process.env.RUN_CROSS_ADAPTER === '1') {
  // Phase 13: when the fork's MarkdownAdapter ships, npm-link it and
  // uncomment below. Phase 7 reserves the toggle without taking a fork dep.
  // const { MarkdownAdapter } = await import('get-shit-done-cc/adapter/markdown');
  // factories.push({ label: 'markdown', factory: (t) => setupMarkdownAdapter(t) });
  throw new Error(
    'RUN_CROSS_ADAPTER=1 set but fork integration is Phase 13 work; remove the env var or wait for fork.'
  );
}

for (const file of FILES) {
  const { runConformance } = await import(file);
  for (const f of factories) {
    runConformance(f.factory, f.label);
  }
}
