/**
 * Dep-graph synthesizer smoke — BEADS-03 / D-OQ06.
 *
 * Validates that `getRecord('graphs/graph.json')` materializes
 * `{ type: 'dependency', confidence: 1.0 }` edges from bd's `blocks`-type
 * dependency edges per Spike 014 semantics.
 *
 * Test set (≥7 cases per VALIDATION row 6-06-03):
 *   1. Capability declaration: graphEdges = { semantic: false, dependency: true }
 *   2. Empty bd (no issues / no deps) → valid JSON with empty edges array
 *   3. Two linked beads via `bd dep add` → one {type:'dependency'} edge
 *   4. Edge direction: `from` = blocker (depends_on_id), `to` = blocked (issue.id)
 *   5. Two chained deps (A blocks B, B blocks C) → two edges, both direction-correct
 *   6. Non-blocks dep type (parent-child from seed) → NOT emitted as dep edge
 *   7. Multiple unrelated beads → no spurious edges
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { setupFreshAdapter } from '../fixture.js';

interface GraphEdge {
  from: string;
  to: string;
  type: string;
  confidence: number;
}

interface GraphPayload {
  edges: GraphEdge[];
}

function bd(projectDir: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync('bd', args, {
    cwd: projectDir,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  });
  return {
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    status: typeof r.status === 'number' ? r.status : -1,
  };
}

function createBead(projectDir: string, title: string): string {
  const r = bd(projectDir, ['create', title, '-d', `body-for-${title}`]);
  if (r.status !== 0) {
    throw new Error(`bd create failed: ${r.stderr}`);
  }
  // bd create output: "✓ Created issue: <id> — <title>"
  const m = r.stdout.match(/Created issue: (\S+)/);
  if (!m) throw new Error(`could not parse bd create output: ${r.stdout}`);
  return m[1]!;
}

describe('BeadsAdapter dep-graph synthesizer — BEADS-03 (D-OQ06)', () => {
  it('capabilities.graphEdges = { semantic: false, dependency: true }', async () => {
    const h = await setupFreshAdapter();
    try {
      expect(h.adapter.capabilities.graphEdges).toEqual({
        semantic: false,
        dependency: true,
      });
    } finally {
      await h.cleanup();
    }
  });

  it('empty-ish bd store (seed with no blocks edges) → valid JSON with empty edges', async () => {
    // setupFreshAdapter seeds 39 beads including milestones; none have
    // `blocks`-type deps (only parent-child). So materializeGraphJson
    // should return { edges: [] }.
    const h = await setupFreshAdapter();
    try {
      const raw = await h.adapter.getRecord('graphs/graph.json');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as GraphPayload;
      expect(parsed).toHaveProperty('edges');
      expect(Array.isArray(parsed.edges)).toBe(true);
      expect(parsed.edges.length).toBe(0);
    } finally {
      await h.cleanup();
    }
  });

  it('parent-child deps in the seed do NOT surface as dependency edges (spike-014 filter)', async () => {
    // The seed has many parent-child edges. Spike-014 established that
    // materializeGraphJson only emits edges with `d.type === 'blocks'`.
    // So the parent-child edges must be filtered out.
    const h = await setupFreshAdapter();
    try {
      const raw = await h.adapter.getRecord('graphs/graph.json');
      const parsed = JSON.parse(raw!) as GraphPayload;
      for (const edge of parsed.edges) {
        expect(edge.type).toBe('dependency');
      }
    } finally {
      await h.cleanup();
    }
  }, 30_000);

  it('bd dep add creates a blocks edge; getRecord reflects {type:"dependency"} edge', async () => {
    const h = await setupFreshAdapter();
    try {
      const A = createBead(h.projectDir, 'dep-test-A');
      const B = createBead(h.projectDir, 'dep-test-B');
      // `bd dep add A B` → A depends on B (A blocked by B). In export, A's
      // `dependencies` array has { depends_on_id: B, type: 'blocks' }.
      const dep = bd(h.projectDir, ['dep', 'add', A, B]);
      expect(dep.status).toBe(0);

      const raw = await h.adapter.getRecord('graphs/graph.json');
      const parsed = JSON.parse(raw!) as GraphPayload;
      const relevant = parsed.edges.find((e) => e.from === B && e.to === A);
      expect(relevant).toBeDefined();
      expect(relevant!.type).toBe('dependency');
      expect(relevant!.confidence).toBe(1.0);
    } finally {
      await h.cleanup();
    }
  }, 30_000);

  it('edge direction: `from` = blocker (depends_on_id), `to` = blocked (issue.id)', async () => {
    const h = await setupFreshAdapter();
    try {
      const A = createBead(h.projectDir, 'direction-test-A');
      const B = createBead(h.projectDir, 'direction-test-B');
      // A depends on B → B blocks A → edge {from: B, to: A}.
      bd(h.projectDir, ['dep', 'add', A, B]);

      const raw = await h.adapter.getRecord('graphs/graph.json');
      const parsed = JSON.parse(raw!) as GraphPayload;
      const edge = parsed.edges.find((e) => e.from === B && e.to === A);
      expect(edge).toBeDefined();
      // Reverse direction should NOT exist.
      expect(parsed.edges.find((e) => e.from === A && e.to === B)).toBeUndefined();
    } finally {
      await h.cleanup();
    }
  }, 30_000);

  it('chained deps (A→B→C): two dep edges, both direction-correct', async () => {
    const h = await setupFreshAdapter();
    try {
      const A = createBead(h.projectDir, 'chain-A');
      const B = createBead(h.projectDir, 'chain-B');
      const C = createBead(h.projectDir, 'chain-C');
      // A depends on B; B depends on C.
      bd(h.projectDir, ['dep', 'add', A, B]);
      bd(h.projectDir, ['dep', 'add', B, C]);

      const raw = await h.adapter.getRecord('graphs/graph.json');
      const parsed = JSON.parse(raw!) as GraphPayload;
      const BtoA = parsed.edges.find((e) => e.from === B && e.to === A);
      const CtoB = parsed.edges.find((e) => e.from === C && e.to === B);
      expect(BtoA).toBeDefined();
      expect(CtoB).toBeDefined();
      for (const e of parsed.edges) {
        expect(e.type).toBe('dependency');
        expect(e.confidence).toBe(1.0);
      }
    } finally {
      await h.cleanup();
    }
  }, 30_000);

  it('unrelated beads yield no spurious edges', async () => {
    const h = await setupFreshAdapter();
    try {
      const before = JSON.parse((await h.adapter.getRecord('graphs/graph.json'))!) as GraphPayload;
      // Add 3 unrelated beads with no deps.
      createBead(h.projectDir, 'iso-1');
      createBead(h.projectDir, 'iso-2');
      createBead(h.projectDir, 'iso-3');
      const after = JSON.parse((await h.adapter.getRecord('graphs/graph.json'))!) as GraphPayload;
      expect(after.edges.length).toBe(before.edges.length);
    } finally {
      await h.cleanup();
    }
  }, 30_000);

  it('dep-graph JSON shape matches fork contract (edges: [{from, to, type, confidence}])', async () => {
    const h = await setupFreshAdapter();
    try {
      const A = createBead(h.projectDir, 'shape-A');
      const B = createBead(h.projectDir, 'shape-B');
      bd(h.projectDir, ['dep', 'add', A, B]);

      const raw = await h.adapter.getRecord('graphs/graph.json');
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveProperty('edges');
      expect(Array.isArray(parsed.edges)).toBe(true);
      for (const e of parsed.edges as GraphEdge[]) {
        expect(typeof e.from).toBe('string');
        expect(typeof e.to).toBe('string');
        expect(e.type).toBe('dependency');
        expect(e.confidence).toBe(1.0);
      }
    } finally {
      await h.cleanup();
    }
  }, 30_000);
});
