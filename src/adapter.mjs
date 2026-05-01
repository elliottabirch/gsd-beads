// src/adapter.mjs
// BeadsAdapter shell. Per D-01..D-05 + RESEARCH.md §4.
//
// All methods are bound to BeadsAdapter.prototype via Object.assign at
// module load. Each cluster file exports a method-bag object whose
// property names match the public adapter surface. Stack traces show
// real method names because Object.assign preserves the function name.

import { findBeadsRoot } from './bd/findRoot.mjs';
import { BeadsEmpty } from './bd/errors.mjs';

import primitives       from './adapter/primitives.mjs';
import phaseLifecycle   from './adapter/phaseLifecycle.mjs';
import roadmapMilestone from './adapter/roadmapMilestone.mjs';
import state            from './adapter/state.mjs';
import verifyReviews    from './adapter/verifyReviews.mjs';
import discussTodos     from './adapter/discussTodos.mjs';
import longTail         from './adapter/longTail.mjs';
import initBundlers     from './adapter/initBundlers.mjs';

export class BeadsAdapter {
  /**
   * @param {string} projectRoot — absolute path to project root.
   * Per D-02: bd availability is NOT validated here; first method call
   * triggers _ensureBd which runs findBeadsRoot and caches the result.
   */
  constructor(projectRoot) {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
      throw new TypeError('BeadsAdapter: projectRoot must be a non-empty string');
    }
    this.projectRoot = projectRoot;
    this._beadsRoot = null;
    this._beadsValidated = false;
  }

  /** Lazy bd validation per D-02. */
  _ensureBd() {
    if (this._beadsValidated) return this._beadsRoot;
    const root = findBeadsRoot(this.projectRoot);
    if (!root) {
      throw new BeadsEmpty(
        'BeadsAdapter: project at ' + this.projectRoot + ' is not bd-managed'
      );
    }
    this._beadsRoot = root;
    this._beadsValidated = true;
    return root;
  }
}

// Static capabilities flag per D-03 / CAP-01 / D-2026-04-30-05.
// Placeholder booleans; Phase 7 sets to implementation reality.
BeadsAdapter.capabilities = Object.freeze({
  record: true,
  section: true,
  binaryAsset: false,
  snapshot: true,
  transaction: false,
  namedDoc: true,
  commitPlanningState: false,
});

// Bind cluster methods to prototype per D-04.
Object.assign(
  BeadsAdapter.prototype,
  primitives,
  phaseLifecycle,
  roadmapMilestone,
  state,
  verifyReviews,
  discussTodos,
  longTail,
  initBundlers,
);

export default BeadsAdapter;
