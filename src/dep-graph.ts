/**
 * Dependency-edge synthesizer — BEADS-03 / D-OQ06.
 *
 * Produces `{ type: 'dependency', confidence: 1.0 }` edges from bd's
 * `blocks`-type dependency edges. Intercepts `getRecord('graphs/graph.json')`
 * at the primitives layer and materializes lazily on each read (one
 * `bd export --json` spawn per call; fits within the ≤2-spawn budget
 * established by Spike 014).
 *
 * Spike-014 semantics (preserved verbatim from sibling evidence at
 * `.planning/research/spike-014-bd-blocks.md`):
 *   - Field name in `bd export --json` is `type`, NOT `dependency_type`
 *     (`dependency_type` is a quirk of `bd show` output — different shape).
 *   - Direction: `depends_on_id` is the BLOCKER (upstream side). Edge
 *     convention is `{from: blocker, to: blocked}` so a topological walk
 *     naturally processes blockers before blocked.
 *   - Single `bd export --json` surfaces ALL edges — no per-bead
 *     round-trip required.
 *   - Cascade-loop (parent-child) walks IGNORE `blocks` edges; so these
 *     edges encode ordering semantics distinct from the cascade tree.
 *
 * Capability declaration (D-OQ06):
 *   - `capabilities.graphEdges.dependency: true` — this synthesizer.
 *   - `capabilities.graphEdges.semantic: false` — no semantic (vector /
 *     embedding) edge support; graphify.cjs does not target bd.
 *
 * Interception point (primitives.ts::getRecord):
 *   ```ts
 *   if (path === 'graphs/graph.json') {
 *     const { bd } = await ensure();
 *     return materializeGraphJson(bd);
 *   }
 *   ```
 *
 * Lazy vs eager: lazy wins because `bd export --json` is a single spawn
 * (~100ms typical, cold-start ~400ms) and callers fetch graph.json on-
 * demand. Eager (cache invalidated on each mutation) would require
 * hooking every bd write path and complicate the code for no measurable
 * win given the natural read-frequency is low.
 */

import type { BdRunner } from './bd/helper.js';
import { BeadsEmpty } from './bd/errors.js';

export interface DepGraphEdge {
  from: string;
  to: string;
  type: 'dependency';
  confidence: 1.0;
}

export interface DepGraphPayload {
  edges: DepGraphEdge[];
}

interface ExportedBead {
  _type?: string;
  id?: string;
  dependencies?: Array<{
    issue_id?: string;
    depends_on_id?: string;
    type?: string;
  }>;
}

/**
 * Materialize `graphs/graph.json` from the current bd state. Returns a
 * JSON string (matches `getRecord` contract — string | null).
 *
 * Empty bd store → `{ edges: [] }` JSON. No error surface for the empty
 * case; callers who consume graph.json should treat "no edges" as the
 * identity case.
 */
export async function materializeGraphJson(bd: BdRunner): Promise<string> {
  let beads: ExportedBead[] = [];
  try {
    const result = bd.run(['export', '--json']);
    if (Array.isArray(result)) {
      beads = result as ExportedBead[];
    } else if (result !== null && typeof result === 'object') {
      // Defensive: single-bead export shapes are not observed in v1.0.4
      // but handle anyway.
      beads = [result as ExportedBead];
    }
  } catch (e) {
    if (e instanceof BeadsEmpty) {
      // Empty store → no edges. `{ edges: [] }` is the identity case.
      const payload: DepGraphPayload = { edges: [] };
      return JSON.stringify(payload);
    }
    throw e;
  }

  const issues = beads.filter((b) => b._type === 'issue' && typeof b.id === 'string');

  const edges: DepGraphEdge[] = [];
  for (const issue of issues) {
    const deps = issue.dependencies ?? [];
    for (const d of deps) {
      // spike-014 filter: `type === 'blocks'` (NOT dependency_type).
      if (d.type !== 'blocks') continue;
      if (typeof d.depends_on_id !== 'string' || d.depends_on_id.length === 0) continue;
      // WR-09 defensive filter: skip self-loops (`depends_on_id === issue.id`).
      // Spike-014 says cascade walks IGNORE `blocks` edges so a self-loop on
      // `blocks` won't wedge cascade today, but the emitted `graph.json` is
      // consumed by graphify.cjs for MarkdownAdapter + pipeline dry-run, which
      // may not defensively handle self-loops. Filter at the synthesizer tier
      // so downstream consumers never see one.
      if (d.depends_on_id === issue.id) continue;
      edges.push({
        from: d.depends_on_id, // blocker direction (spike-014)
        to: issue.id!,          // blocked issue
        type: 'dependency',
        confidence: 1.0,
      });
    }
  }

  const payload: DepGraphPayload = { edges };
  return JSON.stringify(payload);
}
