import type { Capabilities } from 'get-shit-done-cc/adapters/types.js';

/**
 * BeadsAdapter capabilities (9-key shape per fork's Capabilities interface).
 *
 * Decision provenance:
 * - binaryAsset: false            — D-BINARY (skip-and-warn)
 * - snapshot: false               — LOCKED via D-2026-05-12-OQ06-TXN (D-TXN Outcome A, user override).
 *                                   Outcome A ships an in-memory write buffer in src/txn.ts; no dedicated
 *                                   snapshot/restore primitives. Phase 6.1 may migrate to Outcome C
 *                                   (file-snapshot via bd export + bd init --from-jsonl) if the
 *                                   `bd init` side-effect surface is mitigated upstream.
 * - transaction: true             — D-TXN-CAPS (all 3 outcomes declare true — pipeline.ts dry-run needs it;
 *                                   Outcome A's buffer doubles as dry-run via discard-on-exit).
 * - namedDoc: true                — named-doc dispatch via disk-tier writes (Plan 06-05 CR-02 hybrid-tier deletion).
 * - markdownLockfile: false       — bd is not a markdown lockfile format (throw-stub).
 * - graphEdges.semantic: false    — D-OQ06: graphify.cjs does not target bd (deferred post-v1.0).
 * - graphEdges.dependency: true   — D-OQ06: dep-edge synthesizer produces edges from bd `blocks` (Plan 06-06).
 */
export const beadsCapabilities: Capabilities = Object.freeze({
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: false,
  snapshot: false,
  transaction: true,
  namedDoc: true,
  markdownLockfile: false,
  graphEdges: { semantic: false, dependency: true },
});
