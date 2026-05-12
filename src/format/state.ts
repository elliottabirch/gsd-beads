// src/format/state.ts
// Typed parser/formatter for BeadsAdapter's STATE.md event-log sections.
//
// This file ships the FULL parse/format bodies per Plan 06-04 Task 4
// (B6 revision — no TODO scaffolds). Plan 06-06 CONSUMES this file
// to implement the 3 recordState* families against bd primitives;
// Plan 06-06 does NOT extend this file.
//
// ─── Canonical event-log line shape ─────────────────────────────────────
//
//   - **<type>** (<ISO-date>): <JSON-serialized payload>
//
// Example STATE.md section:
//
//   ## Append Events
//
//   - **decision** (2026-05-11T18:00:00Z): {"phase":"06","summary":"..."}
//   - **metric** (2026-05-11T18:05:00Z): {"phase":"06","plan":"04",...}
//
//   ## Mutation Events
//
//   - **blocker_added** (2026-05-11T18:10:00Z): {"text":"..."}
//
//   ## Signal Events
//
//   - **waiting** (2026-05-11T18:15:00Z): {"waitType":"checkpoint"...}
//
// Each event family has its own L2 section. Events are always appended
// in temporal order (new events at end of section body). Dates are
// ISO-8601 UTC strings. Payloads are whatever the fork's AppendEvent /
// MutationEvent / SignalEvent discriminated unions carry — verbatim JSON.
//
// The parser is lenient about the exact date format (anything inside the
// parentheses is captured verbatim); validation is the caller's job. The
// formatter emits whatever `date` the caller passes. This keeps state.ts
// focused on the line-level shape contract and delegates semantics to
// the discriminated-union callers.
// ────────────────────────────────────────────────────────────────────────

import type {
  AppendEvent,
  MutationEvent,
  SignalEvent,
} from 'get-shit-done-cc/adapters/state-event-types.js';
import { parseFrontmatter, formatFrontmatter } from './frontmatter.js';
import type { FrontmatterValue } from './frontmatter.js';

// ─── Section heading-text (exact match against `## <heading>`) ──────────
//
// We scan-find by exact heading match rather than using section.ts's
// path-slug locator, because state.ts operates at a lower level: a
// STATE.md document may or may not have an H1, and the event sections
// are always L2 regardless. locateSection's path-from-root semantic
// would require knowing whether H1 is present — an irrelevant detail
// for event-log management.
const APPEND_HEADING = '## Append Events';
const MUTATION_HEADING = '## Mutation Events';
const SIGNAL_HEADING = '## Signal Events';

// ─── Line regex ─────────────────────────────────────────────────────────
//
// Matches `- **<type>** (<date>): <json-payload>`
// Capture groups:
//   1: event type slug (lowercase alpha / underscore)
//   2: date string (ISO-8601 expected; captured verbatim)
//   3: JSON payload (brace-delimited; must start with `{` and end with `}`)
const EVENT_LINE_RE = /^- \*\*([a-z_]+)\*\* \(([^)]+)\): (\{.*\})\s*$/;

/** Envelope used internally to attach a date to an event union. */
export interface EventRecord<E> {
  date: string;
  event: E;
}

export interface ParsedState {
  /** Frontmatter (may be empty). Preserved verbatim through round-trip. */
  frontmatter: Record<string, FrontmatterValue>;
  /** Full body text minus frontmatter (preserved for round-trip of non-event sections). */
  rawBody: string;
  /** Parsed events from `## Append Events` section. */
  appendEvents: EventRecord<AppendEvent>[];
  /** Parsed events from `## Mutation Events` section. */
  mutationEvents: EventRecord<MutationEvent>[];
  /** Parsed events from `## Signal Events` section. */
  signalEvents: EventRecord<SignalEvent>[];
}

/**
 * Parse a STATE.md document into typed event arrays + raw body + frontmatter.
 *
 * Lines in each event-family section that don't match EVENT_LINE_RE are
 * IGNORED (not an error — allows prose, bullet lists, scaffolding comments
 * to coexist alongside machine-appended events).
 */
export function parseState(text: string): ParsedState {
  const { frontmatter, body } = parseFrontmatter(text);

  const appendEvents = parseEventSection<AppendEvent>(body, APPEND_HEADING);
  const mutationEvents = parseEventSection<MutationEvent>(body, MUTATION_HEADING);
  const signalEvents = parseEventSection<SignalEvent>(body, SIGNAL_HEADING);

  return {
    frontmatter,
    rawBody: body,
    appendEvents,
    mutationEvents,
    signalEvents,
  };
}

/**
 * Format a ParsedState back to STATE.md text.
 *
 * Each event-family section is rewritten (mode='overwrite') with its
 * event array serialized into line-shape. Non-event sections of rawBody
 * are preserved. Frontmatter is re-emitted via formatFrontmatter.
 *
 * If a target event section does not exist in rawBody, it is appended at
 * the end (so a fresh/empty STATE.md materializes the three canonical
 * sections on first event write).
 */
export function formatState(parsed: ParsedState): string {
  let body = parsed.rawBody;

  body = emitEventSection(body, APPEND_HEADING, parsed.appendEvents);
  body = emitEventSection(body, MUTATION_HEADING, parsed.mutationEvents);
  body = emitEventSection(body, SIGNAL_HEADING, parsed.signalEvents);

  return formatFrontmatter(parsed.frontmatter, body);
}

// ─── Internal helpers ───────────────────────────────────────────────────

/**
 * Find the [start, end) line range of a heading's body content.
 * `start` = index of first line after the heading (or -1 if not found).
 * `end`   = index of next heading at same-or-lower level (or lines.length).
 */
function findSectionRange(
  lines: string[],
  heading: string,
): { start: number; end: number } | null {
  // Parse target heading level from the heading string itself (e.g. "## Foo" → 2).
  const headingMatch = /^(#{1,6})\s+/.exec(heading);
  if (!headingMatch) return null;
  const targetLevel = headingMatch[1]!.length;

  let inFence = false;
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line === heading) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  // Scan forward for next heading at <= targetLevel
  let end = lines.length;
  inFence = false;
  for (let j = start; j < lines.length; j++) {
    const line = lines[j]!;
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+/.exec(line);
    if (m && m[1]!.length <= targetLevel) {
      end = j;
      break;
    }
  }
  return { start, end };
}

function parseEventSection<E extends { type: string; payload: unknown }>(
  body: string,
  heading: string,
): EventRecord<E>[] {
  const lines = body.split('\n');
  const range = findSectionRange(lines, heading);
  if (!range) return [];

  const out: EventRecord<E>[] = [];
  for (let i = range.start; i < range.end; i++) {
    const line = lines[i]!;
    const m = EVENT_LINE_RE.exec(line);
    if (!m) continue; // skip blank lines, prose, scaffold comments
    const type = m[1]!;
    const date = m[2]!;
    const payloadJson = m[3]!;

    let payload: unknown;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      // Malformed JSON — skip this event rather than failing the whole
      // parse. Callers that need strictness can re-validate the parsed
      // array against their discriminated-union schema.
      continue;
    }

    // Assemble envelope. The runtime shape is { type, payload } per the
    // discriminated-union contract; the cast is narrowed by the caller's
    // event family (AppendEvent / MutationEvent / SignalEvent).
    const event = { type, payload } as unknown as E;
    out.push({ date, event });
  }

  return out;
}

function emitEventSection<E extends { type: string; payload: unknown }>(
  body: string,
  heading: string,
  events: EventRecord<E>[],
): string {
  // Serialize every event in the array. Even an empty array yields an
  // empty body (the section heading is still emitted — structural marker).
  const newBodyLines: string[] = [];
  for (const entry of events) {
    const json = JSON.stringify(entry.event.payload);
    newBodyLines.push(`- **${entry.event.type}** (${entry.date}): ${json}`);
  }

  const lines = body.split('\n');
  const range = findSectionRange(lines, heading);

  if (range) {
    // Replace [start, end) body lines with new content. Preserve a blank
    // line right after the heading (convention-matching).
    const pre = lines.slice(0, range.start);
    const post = lines.slice(range.end);
    const mid: string[] = [''];          // blank line after heading
    mid.push(...newBodyLines);
    if (newBodyLines.length > 0) mid.push(''); // trailing blank before next section
    return [...pre, ...mid, ...post].join('\n');
  }

  // Section missing — append a fresh heading + body at end of file.
  const trimmedBody = body.endsWith('\n') ? body.slice(0, -1) : body;
  const appended: string[] = [trimmedBody, '', heading, ''];
  if (newBodyLines.length > 0) {
    appended.push(...newBodyLines);
    appended.push('');
  }
  // WR-02 fix: preserve trailing newline when the original body had one.
  // The previous expression `(body.endsWith('\n') ? '' : '')` returned ''
  // on both branches — a tautology that always dropped the trailing
  // newline on section-append, causing round-trip byte drift for any
  // STATE.md that originally ended with '\n' (git diffs, POSIX text-file
  // discipline).
  return appended.join('\n') + (body.endsWith('\n') ? '\n' : '');
}
