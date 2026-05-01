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

// Static capabilities flag per D-2026-04-30-05 / D-16. Frozen 7-key shape;
// each `false` carries a rationale (Phase 7 SC#1 lint reads them).
BeadsAdapter.capabilities = Object.freeze({
  /** Generic record CRUD (getRecord/putRecord/removeRecord) — supported via path router. */
  record: true,
  /** Section-scoped reads/writes (getSection/updateSection) — supported via section.mjs. */
  section: true,
  /**
   * Binary asset writes — UNSUPPORTED. bd does not store binaries
   * natively; `writeBinaryAsset` throws UnsupportedOperationError.
   * v1.1+ may add a configurable external blob sink.
   */
  binaryAsset: false,
  /** Snapshot/restore — supported via `bd export --json` + `bd init --from-jsonl`. */
  snapshot: true,
  /**
   * Multi-bead atomic transactions — UNSUPPORTED. bd has no native
   * transaction primitive. Consumers compose `snapshot/restore` for
   * transactional semantics.
   */
  transaction: false,
  /** Named-doc category writes (intel/codebase/research/etc.) — supported via disk + bd memory index. */
  namedDoc: true,
  /**
   * `commitPlanningState` — UNSUPPORTED (no-op semantics). beads is its
   * own transactional store; the cross-adapter contract for committing
   * planning state is owned by Phase 13 / OQ-08. Calling raises
   * UnsupportedOperationError.
   */
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
