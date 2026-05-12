import { describe, it, expect } from 'vitest';
import { parseState, formatState } from '../../src/format/state.js';
import type { EventRecord } from '../../src/format/state.js';
import type {
  AppendEvent,
  MutationEvent,
  SignalEvent,
} from 'get-shit-done-cc/adapters/state-event-types.js';

const STATE_MD_FIXTURE = [
  '---',
  'phase: "06"',
  'status: executing',
  '---',
  '# STATE',
  '',
  '## Append Events',
  '',
  '- **decision** (2026-05-11T18:00:00Z): {"phase":"06","summary":"Lock D-MAPPING Outcome A"}',
  '- **metric** (2026-05-11T18:05:00Z): {"phase":"06","plan":"04","duration":"30m"}',
  '',
  '## Mutation Events',
  '',
  '- **blocker_added** (2026-05-11T18:10:00Z): {"text":"waiting on spike"}',
  '',
  '## Signal Events',
  '',
  '- **waiting** (2026-05-11T18:15:00Z): {"waitType":"checkpoint","question":null,"options":[]}',
  '',
].join('\n');

describe('parseState', () => {
  it('parses frontmatter + all 3 event sections', () => {
    const parsed = parseState(STATE_MD_FIXTURE);
    expect(parsed.frontmatter.phase).toBe('06');
    expect(parsed.frontmatter.status).toBe('executing');

    expect(parsed.appendEvents).toHaveLength(2);
    expect(parsed.appendEvents[0]!.event.type).toBe('decision');
    const decisionPayload = parsed.appendEvents[0]!.event.payload as { phase: string; summary: string };
    expect(decisionPayload.summary).toContain('D-MAPPING');

    expect(parsed.mutationEvents).toHaveLength(1);
    expect(parsed.mutationEvents[0]!.event.type).toBe('blocker_added');

    expect(parsed.signalEvents).toHaveLength(1);
    expect(parsed.signalEvents[0]!.event.type).toBe('waiting');
  });

  it('returns empty arrays for sections not present', () => {
    const text = '---\nphase: "06"\n---\n# STATE\n(no event sections)\n';
    const parsed = parseState(text);
    expect(parsed.appendEvents).toEqual([]);
    expect(parsed.mutationEvents).toEqual([]);
    expect(parsed.signalEvents).toEqual([]);
  });

  it('ignores non-matching lines inside event sections (tolerates prose)', () => {
    const text = [
      '## Append Events',
      '',
      'Some prose here.',
      '- not an event (missing ** markers)',
      '- **decision** (2026-05-11T18:00:00Z): {"phase":"06","summary":"ok"}',
      '',
    ].join('\n');
    const parsed = parseState(text);
    expect(parsed.appendEvents).toHaveLength(1);
    expect(parsed.appendEvents[0]!.event.type).toBe('decision');
  });

  it('skips malformed JSON payloads without throwing', () => {
    const text = [
      '## Append Events',
      '',
      '- **decision** (2026-05-11T18:00:00Z): {malformed json',
      '- **metric** (2026-05-11T18:05:00Z): {"phase":"06","plan":"04"}',
      '',
    ].join('\n');
    const parsed = parseState(text);
    expect(parsed.appendEvents).toHaveLength(1);
    expect(parsed.appendEvents[0]!.event.type).toBe('metric');
  });
});

describe('formatState', () => {
  it('round-trips: parse → format → parse invariant', () => {
    const parsed1 = parseState(STATE_MD_FIXTURE);
    const formatted = formatState(parsed1);
    const parsed2 = parseState(formatted);
    expect(parsed2.appendEvents).toEqual(parsed1.appendEvents);
    expect(parsed2.mutationEvents).toEqual(parsed1.mutationEvents);
    expect(parsed2.signalEvents).toEqual(parsed1.signalEvents);
    expect(parsed2.frontmatter).toEqual(parsed1.frontmatter);
  });

  it('creates missing event sections on first emit', () => {
    const parsed = parseState('---\nphase: "06"\n---\n# STATE\n');
    // Add a decision event
    const ev: EventRecord<AppendEvent> = {
      date: '2026-05-11T20:00:00Z',
      event: { type: 'decision', payload: { phase: '06', summary: 'first event' } },
    };
    parsed.appendEvents.push(ev);
    const out = formatState(parsed);
    expect(out).toContain('## Append Events');
    expect(out).toContain('**decision**');
    expect(out).toContain('first event');

    // Re-parse should see the new event
    const re = parseState(out);
    expect(re.appendEvents).toHaveLength(1);
  });

  it('emits empty event sections when arrays are empty', () => {
    const parsed = parseState(STATE_MD_FIXTURE);
    parsed.appendEvents = [];
    parsed.mutationEvents = [];
    parsed.signalEvents = [];
    const out = formatState(parsed);
    // Sections still present but empty
    expect(out).toContain('## Append Events');
    expect(out).toContain('## Mutation Events');
    expect(out).toContain('## Signal Events');
  });

  it('serializes new events with correct line shape', () => {
    const parsed = parseState('---\n---\n');
    const ev: EventRecord<MutationEvent> = {
      date: '2026-05-11T20:00:00Z',
      event: { type: 'blocker_added', payload: { text: 'test blocker' } },
    };
    parsed.mutationEvents.push(ev);
    const out = formatState(parsed);
    expect(out).toMatch(/- \*\*blocker_added\*\* \(2026-05-11T20:00:00Z\): \{.*test blocker.*\}/);
  });

  it('preserves Signal event with nested payload (waiting with options)', () => {
    const parsed = parseState('---\n---\n');
    const ev: EventRecord<SignalEvent> = {
      date: '2026-05-11T21:00:00Z',
      event: {
        type: 'waiting',
        payload: { waitType: 'checkpoint', options: ['a', 'b'], question: 'proceed?' },
      },
    };
    parsed.signalEvents.push(ev);
    const out = formatState(parsed);
    const re = parseState(out);
    expect(re.signalEvents).toHaveLength(1);
    expect(re.signalEvents[0]!.event.payload).toEqual({
      waitType: 'checkpoint', options: ['a', 'b'], question: 'proceed?',
    });
  });
});
