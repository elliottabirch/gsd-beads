import type { Capabilities } from 'get-shit-done-cc/adapters/types.js';

/**
 * BeadsAdapter capabilities (9-key shape per fork's Capabilities interface).
 *
 * Decision provenance:
 * - binaryAsset: false            — D-BINARY (skip-and-warn)
 * - snapshot: true                — tentative; Plan 06-03 (spike) + Plan 06-05 (withTransaction impl)
 *                                   may flip to false if D-TXN Outcome A ships (in-memory buffer only)
 * - transaction: true             — D-TXN-CAPS (all 3 outcomes declare true — pipeline.ts dry-run needs it)
 * - namedDoc: true                — named-doc dispatch via bd memory + path-sniff map (Plan 06-05 / Plan 06-06)
 * - markdownLockfile: false       — bd is not a markdown lockfile format (throw-stub)
 * - graphEdges.semantic: false    — D-OQ06: graphify.cjs does not target bd (deferred post-v1.0)
 * - graphEdges.dependency: true   — D-OQ06: dep-edge synthesizer produces edges from bd `blocks`
 */
export const beadsCapabilities: Capabilities = Object.freeze({
  record: true,
  section: true,
  frontmatter: true,
  binaryAsset: false,
  snapshot: true,
  transaction: true,
  namedDoc: true,
  markdownLockfile: false,
  graphEdges: { semantic: false, dependency: true },
});
