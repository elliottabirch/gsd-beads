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
import type {
  AppendEvent,
  MutationEvent,
  SignalEvent,
} from 'get-shit-done-cc/adapters/state-event-types.js';
import { beadsCapabilities } from './capabilities.js';
import { NotYetImplementedError } from './errors.js';

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

  // Bin A — record
  async getRecord(_path: string): Promise<string | null> { throw new NotYetImplementedError('getRecord', 'Plan 06-05'); }
  async putRecord(_path: string, _body: string): Promise<void> { throw new NotYetImplementedError('putRecord', 'Plan 06-05'); }
  async removeRecord(_path: string): Promise<void> { throw new NotYetImplementedError('removeRecord', 'Plan 06-05'); }
  async removeCollection(_prefix: string): Promise<void> { throw new NotYetImplementedError('removeCollection', 'Plan 06-05'); }
  async listCollection(_prefix: string, _filter?: RecordFilter): Promise<RecordRef[]> { throw new NotYetImplementedError('listCollection', 'Plan 06-05'); }
  async exists(_path: string): Promise<boolean> { throw new NotYetImplementedError('exists', 'Plan 06-05'); }
  async stat(_path: string): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> { throw new NotYetImplementedError('stat', 'Plan 06-05'); }

  // Bin A — section
  async getSection(_path: string, _anchor: string): Promise<string | null> { throw new NotYetImplementedError('getSection', 'Plan 06-05'); }
  async updateSection(_path: string, _anchor: string, _body: string, _mode: SectionMode): Promise<void> { throw new NotYetImplementedError('updateSection', 'Plan 06-05'); }

  // Bin A — frontmatter
  async getFrontmatter(_path: string, _field?: string): Promise<unknown> { throw new NotYetImplementedError('getFrontmatter', 'Plan 06-05'); }
  async updateFrontmatter(_path: string, _field: string, _value: unknown): Promise<void> { throw new NotYetImplementedError('updateFrontmatter', 'Plan 06-05'); }
  async mergeFrontmatter(_path: string, _patch: Record<string, unknown>): Promise<void> { throw new NotYetImplementedError('mergeFrontmatter', 'Plan 06-05'); }

  // markdownLockfile group — BeadsAdapter intentionally does NOT support (capability declared false)
  async replaceInCurrentMilestone(_pattern: string | RegExp, _replacement: string): Promise<void> { throw new NotYetImplementedError('replaceInCurrentMilestone', 'Plan 06-05 (throws UnsupportedCapabilityError)'); }
  async readModifyWriteRoadmapMd(_mutator: (content: string) => string): Promise<void> { throw new NotYetImplementedError('readModifyWriteRoadmapMd', 'Plan 06-05 (throws UnsupportedCapabilityError)'); }

  // Foundational primitives
  async writeBinaryAsset(_path: string, _bytes: Uint8Array): Promise<void> { throw new NotYetImplementedError('writeBinaryAsset', 'Plan 06-05 (throws UnsupportedCapabilityError per D-BINARY)'); }
  async snapshot(): Promise<string> { throw new NotYetImplementedError('snapshot', 'Plan 06-06'); }
  async restore(_snapshotId: string): Promise<void> { throw new NotYetImplementedError('restore', 'Plan 06-06'); }
  async withTransaction<T>(_fn: () => Promise<T>): Promise<T> { throw new NotYetImplementedError('withTransaction', 'Plan 06-06'); }

  putNamedDoc(category: 'root', key: RootNamedDocKey, body: string, opts?: { workstream?: string }): Promise<void>;
  putNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, body: string, opts?: { workstream?: string }): Promise<void>;
  async putNamedDoc(_category: NamedDocCategory, _key: string, _body: string, _opts?: { workstream?: string }): Promise<void> {
    throw new NotYetImplementedError('putNamedDoc', 'Plan 06-05');
  }

  getNamedDoc(category: 'root', key: RootNamedDocKey, opts?: { workstream?: string }): Promise<string | null>;
  getNamedDoc(category: Exclude<NamedDocCategory, 'root'>, key: string, opts?: { workstream?: string }): Promise<string | null>;
  async getNamedDoc(_category: NamedDocCategory, _key: string, _opts?: { workstream?: string }): Promise<string | null> {
    throw new NotYetImplementedError('getNamedDoc', 'Plan 06-05');
  }

  async commitPlanningState(_message: string, _files?: string[]): Promise<void> { throw new NotYetImplementedError('commitPlanningState', 'Plan 06-06'); }

  // Event families (D-01/D-04) — return StateWriteOutcome per D-2026-05-10-08
  async recordStateAppend(_event: AppendEvent): Promise<StateWriteOutcome> { throw new NotYetImplementedError('recordStateAppend', 'Plan 06-06'); }
  async recordStateMutation(_event: MutationEvent): Promise<StateWriteOutcome> { throw new NotYetImplementedError('recordStateMutation', 'Plan 06-06'); }
  async recordStateSignal(_event: SignalEvent): Promise<StateWriteOutcome> { throw new NotYetImplementedError('recordStateSignal', 'Plan 06-06'); }
}

export default BeadsAdapter;
