// tests/shadow-tests/_parity-helpers.mjs
// Source: hand-rolled per RESEARCH §Pattern 4. ~28 LOC. No npm dep.
// D-09: key-set + types parity only; values may differ between bd-state and file-state.

export function assertKeySetParity(actual, snapshot, path = '') {
  if (snapshot === null) return; // null in snapshot = wildcard
  const here = path || '<root>';
  if (actual === null) throw new Error(`parity: ${here} snapshot has type ${typeof snapshot}, actual is null`);
  if (typeof actual !== 'object' || typeof snapshot !== 'object') return;
  if (Array.isArray(snapshot)) {
    if (!Array.isArray(actual)) throw new Error(`parity: ${here} snapshot is array, actual is ${typeof actual}`);
    if (snapshot.length > 0 && actual.length > 0) assertKeySetParity(actual[0], snapshot[0], `${path}[0]`);
    return;
  }
  const missing = Object.keys(snapshot).filter((k) => !Object.keys(actual).includes(k));
  if (missing.length > 0) throw new Error(`parity: ${here} missing keys: ${missing.join(', ')}`);
  for (const k of Object.keys(snapshot)) assertKeySetParity(actual[k], snapshot[k], `${path}.${k}`);
}

export function assertTypeParity(actual, snapshot, path = '') {
  const ts = typeOf(snapshot);
  if (ts === 'null') return; // wildcard
  const ta = typeOf(actual);
  if (ta !== ts) throw new Error(`parity: ${path || '<root>'} type mismatch — snapshot=${ts}, actual=${ta}`);
  if (ts === 'object') for (const k of Object.keys(snapshot)) assertTypeParity(actual[k], snapshot[k], `${path}.${k}`);
  else if (ts === 'array' && snapshot.length > 0 && actual.length > 0) assertTypeParity(actual[0], snapshot[0], `${path}[0]`);
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * D-13: Like assertKeySetParity but tolerates `extensions` keys present in
 * actual but absent from snapshot. Used by Phase 5+ handler tests to whitelist
 * bd-backend-only keys (e.g., 'drift', 'backend') without contaminating the
 * upstream parity contract.
 *
 * @param {object} actual    - object under test (handler output)
 * @param {object} snapshot  - reference shape captured from upstream
 * @param {string[]} extensions - keys allowed to appear in actual but not snapshot
 * @param {string} [path]    - dotted path for error messages
 */
export function assertKeySetParityWithExt(actual, snapshot, extensions = [], path = '') {
  if (snapshot === null) return;
  const here = path || '<root>';
  // Only throw on structural mismatch: snapshot is an object/array but actual is null.
  // Leaf-level null in actual (snapshot is a primitive) is a valid value difference — not a parity failure.
  if (actual === null && typeof snapshot === 'object') throw new Error(`parity: ${here} snapshot has type ${typeof snapshot}, actual is null`);
  if (typeof actual !== 'object' || typeof snapshot !== 'object') return;
  if (Array.isArray(snapshot)) {
    if (!Array.isArray(actual)) throw new Error(`parity: ${here} snapshot is array, actual is ${typeof actual}`);
    if (snapshot.length > 0 && actual.length > 0) assertKeySetParityWithExt(actual[0], snapshot[0], extensions, `${path}[0]`);
    return;
  }
  // Snapshot is a plain object: every snapshot key must exist in actual (extensions don't apply this direction)
  const missing = Object.keys(snapshot).filter((k) => !Object.keys(actual).includes(k));
  if (missing.length > 0) throw new Error(`parity: ${here} missing keys: ${missing.join(', ')}`);
  // Recurse on shared keys; extensions in actual that aren't in snapshot are silently allowed
  for (const k of Object.keys(snapshot)) assertKeySetParityWithExt(actual[k], snapshot[k], extensions, `${path}.${k}`);
}
