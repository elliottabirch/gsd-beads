// src/helpers/loadMilestoneHeading.ts
// Ported from sibling src/helpers/loadMilestoneHeading.mjs (v0.2 Phase 5
// deliverable, D-15..D-17). Direct TS port — memory-key shape and fallback
// stderr format preserved verbatim against sibling's `.mjs` body.
//
// History: `git log --follow src/helpers/loadMilestoneHeading.ts` traces
// back through the .mjs origin.

/**
 * D-15..D-17: Format milestone heading from bd memory or fall back to bare
 * version.
 *
 * Heading format mirrors upstream's milestonePattern capture:
 *   "Milestone <version> — <heading>"
 *
 * Logs a stderr note exactly once per call when the memory is absent (D-17).
 *
 * @param memories - kv object from `bd memories --json`
 * @param version  - milestone version string (e.g. "v0.2")
 * @returns formatted heading or bare version string
 */
export function loadMilestoneHeading(
  memories: Record<string, string> | null | undefined,
  version: string,
): string {
  const key = `gsd-beads:milestone:${version}:heading`;
  const heading = memories?.[key];
  if (heading) {
    return `Milestone ${version} — ${heading}`;
  }
  console.error(`[gsd-shadow] note: no milestone heading memory for ${version}`);
  return version;
}
