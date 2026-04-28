import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapMutation, buildMutationEvent } from '../../bin/wrap-mutation.mjs';

// CASE 1: phase.add — buildMutationEvent emits StateMutation type with cmd, args, success
test('CASE 1: buildMutationEvent — phase.add → StateMutation shape', () => {
  const event = buildMutationEvent('session-1', 'phase.add', ['Test phase', 'extra'], { data: {} });
  assert.equal(event.sessionId, 'session-1');
  assert.equal(event.command, 'phase.add');
  assert.deepStrictEqual(event.fields, ['Test phase', 'extra']);
  assert.equal(event.success, true);
  assert.equal(event.type, 'state_mutation');
  assert.ok(event.timestamp, 'timestamp should be set');
});

// CASE 2: roadmap.update-plan-progress — same StateMutation shape
test('CASE 2: buildMutationEvent — roadmap.update-plan-progress → StateMutation shape', () => {
  const event = buildMutationEvent('session-2', 'roadmap.update-plan-progress', ['plan-1', 'complete'], { data: {} });
  assert.equal(event.command, 'roadmap.update-plan-progress');
  assert.deepStrictEqual(event.fields, ['plan-1', 'complete']);
  assert.equal(event.success, true);
  assert.equal(event.type, 'state_mutation');
});

// CASE 3: requirements.mark-complete — same StateMutation shape
test('CASE 3: buildMutationEvent — requirements.mark-complete → StateMutation shape', () => {
  const event = buildMutationEvent('session-3', 'requirements.mark-complete', ['REQ-01'], { data: {} });
  assert.equal(event.command, 'requirements.mark-complete');
  assert.deepStrictEqual(event.fields, ['REQ-01']);
  assert.equal(event.success, true);
  assert.equal(event.type, 'state_mutation');
});

// CASE 4: todo.complete — same StateMutation shape
test('CASE 4: buildMutationEvent — todo.complete → StateMutation shape', () => {
  const event = buildMutationEvent('session-4', 'todo.complete', ['todo-1'], { data: {} });
  assert.equal(event.command, 'todo.complete');
  assert.deepStrictEqual(event.fields, ['todo-1']);
  assert.equal(event.type, 'state_mutation');
});

// CASE 5: milestone.complete — same StateMutation shape
test('CASE 5: buildMutationEvent — milestone.complete → StateMutation shape', () => {
  const event = buildMutationEvent('session-5', 'milestone.complete', ['ms-1'], { data: {} });
  assert.equal(event.command, 'milestone.complete');
  assert.deepStrictEqual(event.fields, ['ms-1']);
  assert.equal(event.type, 'state_mutation');
});

// CASE 6: SPY SNAPSHOT — wrapMutation captures expected event shape (W2 fix)
// Uses mock handler + mock eventStream. No upstream invocation, no FS side effects.
test('CASE 6: spy snapshot — wrapMutation captures expected event shape', async () => {
  const captured = [];
  const eventStream = { emitEvent: (e) => captured.push(e) };
  const mockHandler = async (args, projectDir) => ({ ok: true, args, projectDir });

  const wrapped = wrapMutation(mockHandler, 'phase.add', eventStream, 'session-id');
  const result = await wrapped(['Test phase', 'extra'], '/proj');

  assert.equal(captured.length, 1, 'exactly one event captured');
  const event = captured[0];

  // Verify against documented buildMutationEvent contract (modulo timestamp)
  assert.equal(event.sessionId, 'session-id');
  assert.equal(event.command, 'phase.add');
  assert.deepStrictEqual(event.fields, ['Test phase', 'extra']);
  assert.equal(event.success, true);
  assert.equal(event.type, 'state_mutation', 'GSDEventType.StateMutation value');
  assert.ok(event.timestamp, 'timestamp should be set');

  // Handler result is unaffected by event emission
  assert.deepStrictEqual(result, { ok: true, args: ['Test phase', 'extra'], projectDir: '/proj' });
});

// CASE 7: fire-and-forget — eventStream throws, handler still returns result
test('CASE 7: fire-and-forget — eventStream throws, handler still returns result', async () => {
  const eventStream = { emitEvent: () => { throw new Error('emit failed'); } };
  const wrapped = wrapMutation(async () => ({ ok: true }), 'phase.add', eventStream, 's');
  const result = await wrapped([], '/proj');
  assert.deepStrictEqual(result, { ok: true });
});

// CASE 8: NULL eventStream — MVP production no-op (W3 fix)
// Confirms wrap-pass is a no-op in MVP when eventStream=null.
test('CASE 8: null eventStream — MVP production no-op', async () => {
  const wrapped = wrapMutation(async () => ({ ok: true }), 'phase.add', null, 's');
  const result = await wrapped([], '/proj');
  assert.deepStrictEqual(result, { ok: true });
});
