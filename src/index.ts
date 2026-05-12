import type {
  StorageAdapter,
  Capabilities,
  RecordRef,
  RecordFilter,
  SectionMode,
  NamedDocCategory,
  RootNamedDocKey,
  StateWriteOutcome,
} from 'get-shit-done-cc/adapters/types.js';
import { UnsupportedCapabilityError } from 'get-shit-done-cc/adapters/types.js';
import type {
  AppendEvent,
  MutationEvent,
  SignalEvent,
} from 'get-shit-done-cc/adapters/state-event-types.js';
import { beadsCapabilities } from './capabilities.js';
import { NotYetImplementedError } from './errors.js';
import { ensureBd, type BeadsRuntimeState } from './init.js';
import * as P from './primitives.js';

/**
 * BeadsAdapter — StorageAdapter implementation against `bd` CLI v1.0.3.
 *
 * Plan 06-01: scaffold only. Every method throws NotYetImplementedError.
 *   - Plan 06-02 ports bd/helper + bd/findRoot + bd/errors + _atomicWrite
 *   - Plan 06-03 runs bd-primitive spike + locks D-MAPPING + D-TXN outcomes
 *   - Plan 06-04 ports format/{phase,section,frontmatter} + paths.ts
 *   - Plan 06-05 implements Bin A primitives + init() probe + writeBinaryAsset throw (BEADS-01, BEADS-04, BEADS-05)
 *   - Plan 06-06 implements 3 recordState* families + withTransaction + dep-graph synthesizer (BEADS-02, BEADS-03)
 *   - Plan 06-07 ships smoke tests + README/CLAUDE.md/CONTRIBUTING.md
 *
 * Dual export per D-RUNTIME-RESOLUTION satisfies both:
 *   - Named: `import { BeadsAdapter } from 'gsd-beads'` (TS consumers)
 *   - Default: `const Adapter = (await import('gsd-beads')).default` (Phase 8 DIST-01 resolver)
 */
export class BeadsAdapter implements StorageAdapter {
  readonly name = 'beads' as const;
  readonly capabilities: Capabilities = beadsCapabilities;

  constructor(public readonly projectRoot: string) {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
      throw new TypeError('BeadsAdapter: projectRoot must be a non-empty string');
    }
  }

  /**
   * Lazy bd-managed state cache. Populated by the first `_ensureBd()` call
   * on this instance; reused thereafter. Disk-tier primitives skip the probe
   * entirely (they do not call `_ensureBd`).
   */
  private _state: BeadsRuntimeState | null = null;

  /**
   * BEADS-04 runtime probe entrypoint. Delegates to `ensureBd()` in
   * `./init.ts`. Throws `BdManagedMismatchError` (code=PROJECT_BD_MANAGED_MISMATCH)
   * on non-bd dirs.
   */
  protected async _ensureBd(): Promise<BeadsRuntimeState> {
    this._state = await ensureBd(this.projectRoot, this._state);
    return this._state;
  }

  private _ensure = (): Promise<BeadsRuntimeState> => this._ensureBd();

  // Bin A — record (delegates to ./primitives.ts)
  async getRecord(path: string): Promise<string | null> {
    return P.getRecord(this.projectRoot, this._ensure, path);
  }
  async putRecord(path: string, body: string): Promise<void> {
    return P.putRecord(this.projectRoot, this._ensure, path, body);
  }
  async removeRecord(path: string): Promise<void> {
    return P.removeRecord(this.projectRoot, this._ensure, path);
  }
  async removeCollection(prefix: string): Promise<void> {
    return P.removeCollection(this.projectRoot, this._ensure, prefix);
  }
  async listCollection(prefix: string, filter?: RecordFilter): Promise<RecordRef[]> {
    return P.listCollection(this.projectRoot, this._ensure, prefix, filter);
  }
  async exists(path: string): Promise<boolean> {
    return P.exists(this.projectRoot, this._ensure, path);
  }
  async stat(path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> {
    return P.stat(this.projectRoot, this._ensure, path);
  }

  // Bin A — section
  async getSection(path: string, anchor: string): Promise<string | null> {
    return P.getSection(this.projectRoot, this._ensure, path, anchor);
  }
  async updateSection(path: string, anchor: string, body: string, mode: SectionMode): Promise<void> {
    return P.updateSection(this.projectRoot, this._ensure, path, anchor, body, mode);
  }

  // Bin A — frontmatter
  async getFrontmatter(path: string, field?: string): Promise<unknown> {
    return P.getFrontmatter(this.projectRoot, this._ensure, path, field);
  }
  async updateFrontmatter(path: string, field: string, value: unknown): Promise<void> {
    return P.updateFrontmatter(this.projectRoot, this._ensure, path, field, value);
  }
  async mergeFrontmatter(path: string, patch: Record<string, unknown>): Promise<void> {
    return P.mergeFrontmatterFn(this.projectRoot, this._ensure, path, patch);
  }

  // markdownLockfile group — BeadsAdapter intentionally does NOT support (capability declared false)
  async replaceInCurrentMilestone(_pattern: string | RegExp, _replacement: string): Promise<void> {
    throw new UnsupportedCapabilityError('markdownLockfile', 'beads');
  }
  async readModifyWriteRoadmapMd(_mutator: (content: string) => string): Promise<void> {
    throw new UnsupportedCapabilityError('markdownLockfile', 'beads');
  }

  // Foundational primitives
  async writeBinaryAsset(_path: string, _bytes: Uint8Array): Promise<void> {
    // D-BINARY: capabilities.binaryAsset === false; throw fork's typed error.
    throw new UnsupportedCapabilityError('binaryAsset', 'beads');
  }
  async snapshot(): Promise<string> { throw new NotYetImplementedError('snapshot', 'Plan 06-06'); }
  async restore(_snapshotId: string): Promise<void> { throw new NotYetImplementedError('restore', 'Plan 06-06'); }
  async withTransaction<T>(_fn: () => Promise<T>): Promise<T> { throw new NotYetImplementedError('withTransaction', 'Plan 06-06'); }

  putNamedDoc(category: 'root', key: RootNamedDocKey, body: string, opts?: { workstream?: string }): Promise<void>;
  putNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, body: string, opts?: { workstream?: string }): Promise<void>;
  async putNamedDoc(
    category: NamedDocCategory,
    key: string,
    body: string,
    opts?: { workstream?: string },
  ): Promise<void> {
    return P.putNamedDoc(this.projectRoot, this._ensure, category, key, body, opts);
  }

  getNamedDoc(category: 'root', key: RootNamedDocKey, opts?: { workstream?: string }): Promise<string | null>;
  getNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, opts?: { workstream?: string }): Promise<string | null>;
  async getNamedDoc(
    category: NamedDocCategory,
    key: string,
    opts?: { workstream?: string },
  ): Promise<string | null> {
    return P.getNamedDoc(this.projectRoot, this._ensure, category, key, opts);
  }

  async commitPlanningState(_message: string, _files?: string[]): Promise<void> { throw new NotYetImplementedError('commitPlanningState', 'Plan 06-06'); }

  // Event families (D-01/D-04) — return StateWriteOutcome per D-2026-05-10-08
  async recordStateAppend(_event: AppendEvent): Promise<StateWriteOutcome> { throw new NotYetImplementedError('recordStateAppend', 'Plan 06-06'); }
  async recordStateMutation(_event: MutationEvent): Promise<StateWriteOutcome> { throw new NotYetImplementedError('recordStateMutation', 'Plan 06-06'); }
  async recordStateSignal(_event: SignalEvent): Promise<StateWriteOutcome> { throw new NotYetImplementedError('recordStateSignal', 'Plan 06-06'); }
}

export default BeadsAdapter;
