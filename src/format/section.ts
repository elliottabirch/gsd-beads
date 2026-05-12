// src/format/section.mjs
// Section parser/locator/rewriter for path-slug-addressed markdown sections.
// Implements PRIM-01 + PRIM-02 (Bin A getSection/updateSection) per Phase 7
// decisions:
//   - D-05: anchor is a heading-text slug (lowercase, hyphen-separated)
//   - D-06: anchor is a slash-separated path of slugs from H1 down
//   - D-07: updateSection modes overwrite/append/prepend; heading line
//          itself is NEVER touched
//
// Code-fence guard (Pitfall 8): a `# heading` inside a ```code fence```
// is NOT a heading. Tracked via a single inFence boolean during the scan.
//
// (no imports — pure string manipulation only)

/**
 * GitHub-style ASCII slugify (subset). Per D-05.
 * Underscore is NOT stripped (truth contract: 'foo_bar_baz' → 'foo-bar-baz').
 * @param {string} text
 * @returns {string} slug
 */
export function slugify(text) {
  return String(text)
    .replace(/[`*~]/g, '')             // strip markdown emphasis (NOT underscore)
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')         // non-word / non-space / non-hyphen → space
    .replace(/[\s_]+/g, '-')           // whitespace / underscore → hyphen
    .replace(/-+/g, '-')               // collapse runs
    .replace(/^-+|-+$/g, '');          // trim ends
}

/**
 * ATX heading per CommonMark §4.2: 1-6 leading hashes, single required
 * space, optional trailing hash decoration.
 */
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^```/;

/**
 * Locate a section by path-slug.
 *
 * @param {string} text    full file contents
 * @param {string} anchor  path-slug like 'phase-7/decisions/d-01' or '/decisions'
 * @returns {{
 *   headingLine: number,    // 0-based heading line index
 *   headingLevel: number,   // 1-6
 *   bodyStart: number,      // 0-based line AFTER heading (inclusive)
 *   bodyEnd: number,        // 0-based line BEFORE next sibling heading (exclusive)
 *   bodyText: string,       // join of [bodyStart..bodyEnd) with '\n'
 * } | null}
 */
export function locateSection(text, anchor) {
  const target = anchor.replace(/^\/+/, '').split('/').filter(Boolean);
  if (!target.length) return null;
  const lines = text.split('\n');
  const stack = [];
  let inFence = false;
  let foundLine = -1, foundLevel = -1;

  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = HEADING_RE.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    stack.length = level;
    stack[level - 1] = slugify(m[2]);
    const path = stack.slice(0, level).filter(Boolean);
    if (
      path.length === target.length &&
      path.every((p, idx) => p === target[idx])
    ) {
      foundLine = i;
      foundLevel = level;
      break;
    }
  }
  if (foundLine === -1) return null;

  let bodyEnd = lines.length;
  inFence = false;
  for (let j = foundLine + 1; j < lines.length; j++) {
    if (FENCE_RE.test(lines[j])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = HEADING_RE.exec(lines[j]);
    if (m && m[1].length <= foundLevel) { bodyEnd = j; break; }
  }
  return {
    headingLine: foundLine,
    headingLevel: foundLevel,
    bodyStart: foundLine + 1,
    bodyEnd,
    bodyText: lines.slice(foundLine + 1, bodyEnd).join('\n'),
  };
}

/**
 * Rewrite a section. The heading line itself is NEVER modified (D-07).
 *
 * @param {string} text
 * @param {string} anchor
 * @param {string} body                          new content
 * @param {'overwrite'|'append'|'prepend'} mode
 * @returns {string}                             new full text
 * @throws {Error} if anchor not found or mode is unknown
 */
export function rewriteSection(text, anchor, body, mode) {
  const loc = locateSection(text, anchor);
  if (!loc) throw new Error(`section not found: ${anchor}`);
  const lines = text.split('\n');
  const bodyLines = body.split('\n');

  let head, mid, tail;
  if (mode === 'overwrite') {
    head = lines.slice(0, loc.bodyStart);
    mid = bodyLines;
    tail = lines.slice(loc.bodyEnd);
  } else if (mode === 'append') {
    head = lines.slice(0, loc.bodyEnd);
    mid = bodyLines;
    tail = lines.slice(loc.bodyEnd);
  } else if (mode === 'prepend') {
    head = lines.slice(0, loc.bodyStart);
    mid = bodyLines;
    tail = lines.slice(loc.bodyStart);
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }
  return [...head, ...mid, ...tail].join('\n');
}
