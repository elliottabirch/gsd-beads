// src/format/phase.ts
// Bidirectional parser/formatter for ROADMAP.md phase titles + descriptions.
// Ported from sibling src/format/phase.mjs (251 LOC) during Plan 06-04.
//
// Implements ARCH-03 (REQUIREMENTS.md) per Phase 6 decisions:
//   - D-14: 4 named exports — parsePhaseTitle / formatPhaseTitle /
//           parsePhaseDescription / formatPhaseDescription
//   - D-15: idempotency contract — parse(format(parse(x))) === parse(x)
//           (NOT byte-equality; format() may normalize whitespace, label
//           style, and blank-line conventions)
//   - D-16: tail is opaque — everything after Success Criteria (the
//           "Plans:" tail with checkboxes) round-trips byte-equal but is
//           not structurally parsed; Phase 8's phasePlanIndex derives
//           plan data from bd children, not from this view

// -----------------------------------------------------------------------
// Title parsing/formatting
// -----------------------------------------------------------------------

/**
 * Title regex per RESEARCH.md §2 (line 167).
 * Anchored at both ends; allows ONE optional decimal segment ("Phase 72.1");
 * non-greedy name capture absorbs em-dashes / asterisks / plus-signs / etc.
 * Bounded backtracking O(n) — see threat T-6.05-01.
 */
const TITLE_RE = /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;

export interface PhaseTitle {
  number: string;
  name: string;
}

/**
 * Parses "Phase N: Name" (or "Phase N.M: Name" for decimal phases).
 *
 * @throws {Error} if line doesn't match the title pattern
 */
export function parsePhaseTitle(line: string): PhaseTitle {
  const m = TITLE_RE.exec(line);
  if (!m) {
    throw new Error(
      `parsePhaseTitle: not a phase title: ${JSON.stringify(line)}`,
    );
  }
  return { number: m[1]!, name: m[2]! };
}

/**
 * Formats { number, name } back to "Phase N: Name" (no trailing newline).
 */
export function formatPhaseTitle({ number, name }: PhaseTitle): string {
  return `Phase ${number}: ${name}`;
}

// -----------------------------------------------------------------------
// Description parsing/formatting
// -----------------------------------------------------------------------

// The four canonical labels recognized as section anchors. Anything else
// that looks like a `**Foo**:` label (e.g., `**Status:**`, `**Plans:**`)
// is treated either as continuation of the current section or — for
// `**Plans...` specifically — as the start of the opaque tail per D-16.
const SECTIONS = ['Goal', 'Depends on', 'Requirements', 'Success Criteria'] as const;
type SectionKey = typeof SECTIONS[number];

function isSectionKey(s: string): s is SectionKey {
  return (SECTIONS as readonly string[]).includes(s);
}

/**
 * Tolerates both `**Foo**:` and `**Foo:**` styles (codebase uses both)
 * AND tolerates a parenthetical between `**Foo**` and `:` for the
 * Success Criteria header form `**Success Criteria** (what must be TRUE):`.
 *
 * Capture groups:
 *   1: label name (e.g., "Goal", "Success Criteria", "Status", "Plans")
 *   2: rest of line after the label and trailing whitespace
 */
const LABEL_RE =
  /^\*\*([A-Za-z][A-Za-z ]*?)(?:\*\*\s*(?:\([^)]*\)\s*)?:|\:\s*\*\*)\s*(.*)$/;

// The opaque tail begins at the first `**Plans` line encountered after
// any SECTIONS label has opened. Per D-16, every Plans variant in the
// real ROADMAP is `**Plans:**`, `**Plans**:`, or `**Plans**: TBD` — all
// start with `**Plans`.
const TAIL_RE = /^\s*\*\*Plans\b/;

// SC items use `<n>. <text>` (with optional leading whitespace).
const SC_ITEM_RE = /^\s*(\d+)\.\s+(.*)$/;

export interface PhaseDescription {
  goal: string;
  depends_on: string;
  requirements: string;
  success_criteria: string[];
  tail: string;
}

/**
 * Parses a phase description body into structured form.
 */
export function parsePhaseDescription(body: string): PhaseDescription {
  const lines = body.split('\n');
  const sections: Record<SectionKey, string> = {
    Goal: '',
    'Depends on': '',
    Requirements: '',
    'Success Criteria': '',
  };
  let current: SectionKey | null = null; // current SECTIONS-recognized section, or null
  let tailStart: number | null = null; // index of first tail line, or null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // First check: did we just hit the opaque tail? Tail begins at the
    // first `**Plans` line AFTER we've opened any SECTIONS-recognized
    // section. The `current !== null` guard ensures we don't mistake
    // leading-prose Plans-mentions (none observed; defensive) for tail.
    if (current !== null && TAIL_RE.test(line)) {
      tailStart = i;
      break;
    }

    const m = LABEL_RE.exec(line);
    if (m && isSectionKey(m[1]!)) {
      // New canonical section starts.
      current = m[1] as SectionKey;
      sections[current] = m[2] ?? '';
      continue;
    }

    // Either a non-label line OR an unrecognized label (e.g., `**Status:**`).
    // Treat as continuation of the current section.
    if (current !== null) {
      // Append with newline separator. If section content is empty (just
      // started), the newline still goes in — trimming at the end strips
      // any trailing whitespace cleanly.
      if (sections[current]) {
        sections[current] += '\n' + line;
      } else if (line !== '') {
        sections[current] = line;
      } else {
        // Preserve a leading blank as a single \n so multi-line goal
        // bodies that start with a blank line don't lose paragraph breaks.
        sections[current] = '\n';
      }
    }
    // If current === null (still in leading prose before any label),
    // drop the line. Information lost is irrelevant to the round-trip
    // contract because format() doesn't emit leading prose.
  }

  // Trim trailing whitespace on every section.
  for (const k of Object.keys(sections) as SectionKey[]) {
    sections[k] = sections[k].replace(/\s+$/, '');
  }

  // Re-parse the Success Criteria accumulator into numbered items.
  const success_criteria = parseScItems(sections['Success Criteria']);

  // Capture the tail byte-equal (mod trailing whitespace).
  let tail = '';
  if (tailStart !== null) {
    tail = lines.slice(tailStart).join('\n').replace(/\s+$/, '');
  }

  return {
    goal: sections.Goal,
    depends_on: sections['Depends on'],
    requirements: sections.Requirements,
    success_criteria,
    tail,
  };
}

/**
 * Splits the Success Criteria accumulator into a list of items.
 * Each item is the text after the `<n>. ` prefix; continuation lines
 * (lines without a leading number) are joined with their item, leading
 * whitespace stripped so subsequent re-formatting can re-add canonical
 * indent without growing it on each round-trip.
 */
function parseScItems(sc: string): string[] {
  const out: string[] = [];
  let curItem: string | null = null;
  for (const line of sc.split('\n')) {
    const m = SC_ITEM_RE.exec(line);
    if (m) {
      if (curItem !== null) out.push(curItem);
      curItem = m[2]!;
    } else if (curItem !== null && line.trim() !== '') {
      // Continuation line within an item — strip leading whitespace so
      // canonical re-indent during format() is idempotent.
      curItem += '\n' + line.trim();
    }
  }
  if (curItem !== null) out.push(curItem);
  return out;
}

/**
 * Formats parsed phase description back to canonical markdown.
 *
 * Idempotency contract per D-15: parse(format(parse(x))) === parse(x).
 * Whitespace and label-style normalization are PERMITTED (the canonical
 * label form is `**Foo**:` and SC items use 2-space indent + numeric
 * prefix). Tail is emitted verbatim per D-16.
 */
export function formatPhaseDescription(parsed: PhaseDescription): string {
  const {
    goal = '',
    depends_on = '',
    requirements = '',
    success_criteria = [],
    tail = '',
  } = parsed;

  const out: string[] = [];
  out.push(`**Goal**: ${goal}`);
  out.push('');
  out.push(`**Depends on**: ${depends_on}`);
  out.push('');
  out.push(`**Requirements**: ${requirements}`);
  out.push('');
  out.push('**Success Criteria** (what must be TRUE):');
  for (let idx = 0; idx < success_criteria.length; idx++) {
    const item = success_criteria[idx]!;
    const itemLines = item.split('\n');
    out.push(`  ${idx + 1}. ${itemLines[0]}`);
    // Continuation lines: 5-space indent (so number-prefix column lines up
    // with the item text). Storage strips leading whitespace, so adding
    // canonical indent here doesn't grow on round-trip.
    for (let j = 1; j < itemLines.length; j++) {
      out.push(`     ${itemLines[j]}`);
    }
  }
  if (tail) {
    out.push('');
    out.push(tail);
  }
  return out.join('\n');
}
