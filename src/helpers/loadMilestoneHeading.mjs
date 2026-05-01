// src/helpers/loadMilestoneHeading.mjs
/**
 * D-15..D-17: Format milestone heading from bd memory or fall back to bare version.
 *
 * Carry-forward from archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs:356-364.
 * Phase 5 deliverable; unchanged in Phase 6 (D-11 verbatim extraction).
 *
 * See `git log --follow archive/v0.2-shadow/bin/gsd-sdk-shadow.mjs` for
 * the original ship history.
 *
 * Heading format mirrors upstream's milestonePattern capture: "Milestone <version> — <heading>".
 * Logs a stderr note exactly once per call when the memory is absent (D-17).
 * @param {Record<string,string>} memories - kv object from `bd memories --json`
 * @param {string} version - milestone version string (e.g. "v0.2")
 * @returns {string} - formatted heading or bare version string
 */
export function loadMilestoneHeading(memories, version) {
  const key = `gsd-beads:milestone:${version}:heading`;
  const heading = memories?.[key];
  if (heading) {
    return `Milestone ${version} — ${heading}`;
  }
  console.error(`[gsd-shadow] note: no milestone heading memory for ${version}`);
  return version;
}
