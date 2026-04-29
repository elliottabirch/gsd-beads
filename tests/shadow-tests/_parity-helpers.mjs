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
