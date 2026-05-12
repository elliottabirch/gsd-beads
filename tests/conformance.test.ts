/**
 * Conformance invocation for BeadsAdapter.
 *
 * This file invokes the fork's shared conformance harness against BeadsAdapter.
 * Plan 06-01: invocation exists but fails — BeadsAdapter's methods throw
 * NotYetImplementedError. Plans 06-05 + 06-06 replace throw-stubs with real
 * implementations; suite flips to green as each family lands.
 *
 * Fork's harness signature is locked (Phase 1 D-15):
 *   runAdapterConformanceSuite(adapterName, adapterFactory)
 */
import { runAdapterConformanceSuite } from 'get-shit-done-cc/conformance';
import { BeadsAdapter } from '../src/index.js';

runAdapterConformanceSuite('beads', (projectDir: string) => {
  // Plan 06-07 resolves RESEARCH Open Question #1: harness pre-creates `.planning/`
  // but NOT `.beads/`. BeadsAdapter's `_ensureBd()` must either tolerate
  // uninitialized dirs (lazy bd init from seed) or the harness grows an adapter
  // fixture callback. Planner defers the resolution to Plan 06-07 which has the
  // full context (seed fixture + spike outcome).
  //
  // In the meantime (Plans 06-01..06-06), this invocation either:
  //   - FAILS with NotYetImplementedError (expected up through Plan 06-04)
  //   - FAILS with BdManagedMismatchError (expected in Plans 06-05 after init() ships but before fixture does)
  // That signal IS the point — conformance is expected to go red→green as
  // throw-stubs get replaced.
  return new BeadsAdapter(projectDir);
});
