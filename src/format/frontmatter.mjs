// src/format/frontmatter.mjs
// Flat-scalar YAML frontmatter parser per D-03.
//
// Schema is restricted to:
//   - Top-level keys are strings
//   - Values are scalars (string/number/boolean/null) OR flat string lists
//   - No nested objects, no anchors, no tags, no multi-line scalars
//
// RESEARCH §"Standard Stack" verifies the entire current .planning/* corpus
// is within this schema. If a nested-object frontmatter appears in the
// future, escalate to gray-matter@4.0.3 (do NOT silently expand this parser
// — see Pitfall in 07-RESEARCH.md).
//
// (no imports — pure string manipulation only)

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * Parse YAML-like frontmatter at the top of a markdown file.
 *
 * @param {string} text
 * @returns {{frontmatter: Record<string, string|number|boolean|null|string[]>, body: string}}
 */
export function parseFrontmatter(text) {
  const m = FRONTMATTER_RE.exec(text);
  if (!m) return { frontmatter: {}, body: text };

  const fm = {};
  const lines = m[1].split('\n');
  let currentKey = null;
  let currentList = null;

  for (const line of lines) {
    // List item: leading whitespace + `- value`
    const listItem = /^\s+-\s+(.+)$/.exec(line);
    if (listItem && currentKey && currentList) {
      currentList.push(coerce(listItem[1].trim()));
      continue;
    }
    // key: value (key may have hyphens/underscores; value optional)
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === '') {
      // List header — collect items on subsequent lines
      currentKey = k;
      currentList = [];
      fm[k] = currentList;
    } else {
      fm[k] = coerce(v);
      currentKey = null;
      currentList = null;
    }
  }
  return { frontmatter: fm, body: m[2] };
}

function coerce(v) {
  // Quoted string (single or double)
  if (/^("|').*\1$/.test(v)) return v.slice(1, -1);
  // Number (integer or decimal)
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // Booleans
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Null / tilde
  if (v === 'null' || v === '~') return null;
  return v;
}

/**
 * Render a frontmatter object back to delimited YAML + body.
 * Returns body verbatim when fm is empty/null (no `---` block emitted).
 *
 * @param {Record<string, any>|null|undefined} fm
 * @param {string} body
 * @returns {string}
 */
export function formatFrontmatter(fm, body) {
  if (!fm || !Object.keys(fm).length) return body;
  const out = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      out.push(`${k}:`);
      for (const item of v) out.push(`  - ${item}`);
    } else if (v === null) {
      out.push(`${k}: null`);
    } else {
      out.push(`${k}: ${v}`);
    }
  }
  out.push('---', '');
  return out.join('\n') + body;
}

/**
 * Shallow-merge a patch over a base frontmatter. Patch keys override base.
 * Either argument may be null/undefined.
 *
 * @param {Record<string, any>|null|undefined} base
 * @param {Record<string, any>|null|undefined} patch
 * @returns {Record<string, any>}
 */
export function mergeFrontmatter(base, patch) {
  return { ...(base ?? {}), ...(patch ?? {}) };
}
