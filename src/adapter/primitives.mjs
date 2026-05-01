// src/adapter/primitives.mjs
// Bin A (10 methods, PRIM-01) + 6 foundational (PRIM-02). Phase 7 / IMPL.
//
// Router-first dispatch per D-01: every method opens with
//   const route = routerResolve(path)
// and branches on route.tier ('bd' | 'disk' | 'hybrid').
//
// ≤2 bd spawns per public method invocation (D-21 / QUAL-07 carry-forward).
// BEADS_ACTOR=seed on every bd call that affects committed state (D-20).
// Heading line itself NEVER touched in updateSection (D-07; Plan 05 owns).

import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { resolve as routerResolve } from './pathRouter.mjs';
import { atomicWriteFile } from './_atomicWrite.mjs';
import { bd } from '../bd/helper.mjs';
import { BeadsEmpty } from '../bd/errors.mjs';

const NOT_IMPLEMENTED = (name, phase, impl) => {
  throw new Error('BeadsAdapter.' + name + ': not implemented (Phase ' + phase + ' / ' + impl + ')');
};

/**
 * Convert a repo-relative path to an absolute path under this.projectRoot.
 * Repo-relative discipline per D-02.
 */
function _abs(adapter, path) {
  return pathResolve(adapter.projectRoot, path);
}

export default {
  // ---------------------------------------------------------------------
  // PRIM-01 Bin A: records (Plan 04)
  // ---------------------------------------------------------------------

  async getRecord(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // ≤2 bd spawns per D-21. Single `bd list` with the singleton/label
      // filter; client-side single-element pick.
      const items = bd(['list', '-l', route.label, '--json', '-n', '0']);
      // The shape returned is the bd issue object (or undefined for missing).
      // For singleton kinds (roadmap, requirements), the first match is
      // returned. For multi-record kinds, this primitive is not the lookup
      // path — callers route to listCollection / a Bin B method instead.
      if (route.singleton) {
        return Array.isArray(items) && items.length ? items[0] : null;
      }
      // Non-singleton bd-routed path: caller is expected to use
      // listCollection or a Bin B-specific lookup. Throw a clear error so
      // misrouting surfaces during execution rather than returning null.
      throw new Error(
        `BeadsAdapter.getRecord: bd-routed path ${path} (kind=${route.kind}) requires listCollection or Bin B lookup`
      );
    }
    // disk-routed (kind: 'plan' | 'opaque' | namedDoc 'hybrid' read-side)
    const abs = _abs(this, path);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, 'utf-8');
  },

  async putRecord(path, body) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // bd-routed put for singleton kinds is performed via Bin B domain
      // methods (e.g., addPhase, evolveRoadmap). The generic putRecord
      // primitive is NOT the path for adding new bd records — that would
      // require domain-specific label setup that Phase 8+ owns. We refuse
      // here so misrouting fails loudly.
      throw new Error(
        `BeadsAdapter.putRecord: bd-routed paths (kind=${route.kind}) are written via Bin B domain methods (Phase 8+); generic putRecord is for disk-routed paths only`
      );
    }
    // disk-routed: atomic write via tmpfile + rename (D-08)
    atomicWriteFile(_abs(this, path), body);
  },

  async removeRecord(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // Same boundary as putRecord — bd-side removal is Bin B's domain.
      throw new Error(
        `BeadsAdapter.removeRecord: bd-routed paths (kind=${route.kind}) are removed via Bin B domain methods (Phase 8+); generic removeRecord is for disk-routed paths only`
      );
    }
    // disk-routed: idempotent unlink (no throw if missing)
    const abs = _abs(this, path);
    if (existsSync(abs)) unlinkSync(abs);
  },

  async listCollection(prefix, filter) {
    const route = routerResolve(prefix);
    if (route.tier === 'bd' && route.collection) {
      this._ensureBd();
      // ≤2 bd spawns per D-21. Single `bd list -l <primary-label>` call;
      // optional `filter` adds an additional --label arg (still 1 spawn
      // because both labels are passed in the same invocation).
      const args = ['list', '-l', route.label, '--json', '-n', '0'];
      if (filter && typeof filter === 'string') {
        args.push('-l', filter);
      }
      const items = bd(args);
      // Deterministic sort per D-04 / QUAL-06 carry-forward. Sort by
      // numeric phase-id when present, else by id (string). Phase epics
      // carry phase-id:NN labels; plans carry plan-id:NN-MM labels.
      const arr = Array.isArray(items) ? items.slice() : [];
      arr.sort((a, b) => {
        const akey = _firstSortKey(a);
        const bkey = _firstSortKey(b);
        if (akey === bkey) return 0;
        return akey < bkey ? -1 : 1;
      });
      return arr;
    }
    // disk-routed: fs.readdir; filter is a predicate function or undefined
    const abs = _abs(this, prefix);
    if (!existsSync(abs)) return [];
    const entries = readdirSync(abs);
    const filtered = typeof filter === 'function'
      ? entries.filter(filter)
      : entries;
    // Deterministic ordering — fs.readdir order is OS-dependent
    return filtered.slice().sort();
  },

  async exists(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // Pitfall 5: `bd show <missing-id> --json` exits 0 with
      // {error, schema_version}. The src/bd/helper.mjs:bd() wrapper
      // detects this and throws BeadsEmpty. Catch + return false.
      try {
        // For singleton kinds, listing by label is the cheapest existence
        // check (≤1 spawn). Returns the bd export-shape array; non-empty
        // implies at least one matching record.
        const items = bd(['list', '-l', route.label, '--json', '-n', '0']);
        return Array.isArray(items) && items.length > 0;
      } catch (err) {
        if (err instanceof BeadsEmpty) return false;
        throw err;
      }
    }
    // disk-routed
    return existsSync(_abs(this, path));
  },

  // ---------------------------------------------------------------------
  // PRIM-01 Bin A: section + frontmatter (Plan 05 owns these 5 methods)
  // ---------------------------------------------------------------------
  async getSection(path, anchor)              { NOT_IMPLEMENTED('getSection', 7, 'PRIM-01'); },
  async updateSection(path, anchor, body, mode) { NOT_IMPLEMENTED('updateSection', 7, 'PRIM-01'); },
  async getFrontmatter(path, field)           { NOT_IMPLEMENTED('getFrontmatter', 7, 'PRIM-01'); },
  async updateFrontmatter(path, field, value) { NOT_IMPLEMENTED('updateFrontmatter', 7, 'PRIM-01'); },
  async mergeFrontmatter(path, patch)         { NOT_IMPLEMENTED('mergeFrontmatter', 7, 'PRIM-01'); },

  // ---------------------------------------------------------------------
  // PRIM-02 foundational primitives (Plans 06/07 own these 6 methods)
  // ---------------------------------------------------------------------
  async recordStateEvent({ type, payload })   { NOT_IMPLEMENTED('recordStateEvent', 7, 'PRIM-02'); },
  async snapshot()                            { NOT_IMPLEMENTED('snapshot', 7, 'PRIM-02'); },
  async restore(snapshotRef)                  { NOT_IMPLEMENTED('restore', 7, 'PRIM-02'); },
  async putNamedDoc(category, key, body)      { NOT_IMPLEMENTED('putNamedDoc', 7, 'PRIM-02'); },
  async getNamedDoc(category, key)            { NOT_IMPLEMENTED('getNamedDoc', 7, 'PRIM-02'); },
  async writeBinaryAsset(path, bytes)         { NOT_IMPLEMENTED('writeBinaryAsset', 7, 'PRIM-02'); },
};

/**
 * Pull a deterministic sort key from a bd issue. Prefers numeric phase-id
 * or plan-id when present; falls back to issue.id. Per D-04 / QUAL-06.
 */
function _firstSortKey(issue) {
  const labels = issue?.labels ?? [];
  for (const prefix of ['phase-id:', 'plan-id:']) {
    const lab = labels.find((l) => l.startsWith(prefix));
    if (lab) return lab.slice(prefix.length);
  }
  return issue?.id ?? '';
}
