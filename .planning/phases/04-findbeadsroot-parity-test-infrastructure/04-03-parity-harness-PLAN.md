---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/shadow-tests/_parity-helpers.mjs
  - tests/shadow-tests/_parity-helpers.test.mjs
  - tests/shadow-tests/snapshots/_phase4-test-stub.json
  - tests/scripts/update-snapshots.mjs
  - tests/install-tests/upstream-version-pin.test.sh
  - tests/shadow-tests/bd-allowlist-grep.test.sh
  - gsd-sdk-cc.version.lock
autonomous: true
requirements:
  - REQ-QUAL-01
must_haves:
  truths:
    - "assertKeySetParity(actual, snapshot) recursively asserts every key in `snapshot` exists in `actual`; throws AssertionError with a path like '.phases[0].disk_status' on missing keys"
    - "assertKeySetParity tolerates value differences (D-09: values may differ between bd-state and file-state)"
    - "assertTypeParity(actual, snapshot) asserts matching value types using vocabulary string|number|boolean|null|array|object (folds typeof null === 'object' bug)"
    - "null in snapshot is a wildcard — assertTypeParity does NOT throw when snapshot has null at a position where actual has any type"
    - "Snapshot file _phase4-test-stub.json is loadable JSON with shape { data: { ok: <boolean>, backend: <string> } }"
    - "tests/scripts/update-snapshots.mjs reads gsd-sdk-cc.version.lock; refuses to write when installed gsd-sdk version doesn't match the pin (Pitfall 3)"
    - "gsd-sdk-cc.version.lock contains exactly one line with the pinned version (1.38.5)"
    - "tests/install-tests/upstream-version-pin.test.sh fails when lockfile is missing/empty OR when installed gsd-sdk version doesn't match"
    - "tests/shadow-tests/bd-allowlist-grep.test.sh: CASE 1 asserts the allowlist source string is intact in hooks/bd-sync.sh (Phase 4 precursor — full read-handler grep enforcement deferred to Phase 11). CASE 2 is a tampered-allowlist counter-test: copies hooks/bd-sync.sh into a tempdir, edits the copy to invoke a write-side bd subcommand (e.g. `bd close`), runs the same allowlist-presence check against the tampered copy, and asserts the check FAILS — proving the test catches violations rather than passing tautologically (WARN-3 strengthening)."
  artifacts:
    - path: "tests/shadow-tests/_parity-helpers.mjs"
      provides: "assertKeySetParity + assertTypeParity (~28 LOC, no deps)"
      exports: ["assertKeySetParity", "assertTypeParity"]
      min_lines: 28
    - path: "tests/shadow-tests/_parity-helpers.test.mjs"
      provides: "6 unit cases per VALIDATION.md (missing-key, missing-nested, type-mismatch, null-snapshot-allows-anything, array-shape, recursion)"
      min_lines: 40
    - path: "tests/shadow-tests/snapshots/_phase4-test-stub.json"
      provides: "Single committed parity snapshot proving wiring + parity loop work"
      contains: "\"backend\""
    - path: "tests/scripts/update-snapshots.mjs"
      provides: "Snapshot regenerator with lockfile pre-check"
      min_lines: 40
    - path: "tests/install-tests/upstream-version-pin.test.sh"
      provides: "CI drift detection — D-10"
      min_lines: 30
    - path: "tests/shadow-tests/bd-allowlist-grep.test.sh"
      provides: "REQ-QUAL-05 precursor — static grep guard with self-test (tampered-allowlist counter-test proving CASE 1 catches violations)"
      min_lines: 50
    - path: "gsd-sdk-cc.version.lock"
      provides: "1-line pin: 1.38.5"
      min_lines: 1
  key_links:
    - from: "tests/shadow-tests/_parity-helpers.test.mjs"
      to: "tests/shadow-tests/_parity-helpers.mjs"
      via: "named imports { assertKeySetParity, assertTypeParity }"
      pattern: "from ['\"]\\./_parity-helpers\\.mjs['\"]"
    - from: "tests/scripts/update-snapshots.mjs"
      to: "gsd-sdk-cc.version.lock"
      via: "readFileSync at REPO_ROOT/gsd-sdk-cc.version.lock; spawnSync('gsd-sdk', ['--version']); compare"
      pattern: "gsd-sdk-cc\\.version\\.lock"
    - from: "tests/install-tests/upstream-version-pin.test.sh"
      to: "gsd-sdk-cc.version.lock"
      via: "head -1 + gsd-sdk --version compare"
      pattern: "gsd-sdk-cc\\.version\\.lock"
    - from: "tests/shadow-tests/bd-allowlist-grep.test.sh"
      to: "hooks/bd-sync.sh"
      via: "allowlist source documented inline (extracted from bd-sync.sh:23) — Phase 4 grep target is bin/ read handlers"
      pattern: "list\\|show\\|ready"
---

<objective>
Land the snapshot-parity test harness, the canonical snapshot for the
`_phase4-test-stub` handler, the snapshot regenerator script, the lockfile
pin + drift-detection test, and the bd-allowlist grep precursor. This is the
test infrastructure Phases 5-9 plug into for every real read handler they ship.

Purpose: REQ-QUAL-01 (output-shape parity via snapshot tests written before
handler implementation, red→green). Plus D-06 (static JSON snapshots), D-09
(key-set + types only), D-10 (CI drift detection via lockfile pin), and
REQ-QUAL-05 precursor (hook allowlist grep — full test in Phase 11).

Output:
- `tests/shadow-tests/_parity-helpers.mjs` — 28-LOC assertion module
- `tests/shadow-tests/_parity-helpers.test.mjs` — 6 unit cases
- `tests/shadow-tests/snapshots/_phase4-test-stub.json` — 1-snapshot fixture
- `tests/scripts/update-snapshots.mjs` — regenerator with lockfile pre-check
- `tests/install-tests/upstream-version-pin.test.sh` — drift detection
- `tests/shadow-tests/bd-allowlist-grep.test.sh` — REQ-QUAL-05 precursor (CASE 1 allowlist intact + CASE 2 tampered counter-test per WARN-3)
- `gsd-sdk-cc.version.lock` — 1-line plain-text pin (1.38.5)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-CONTEXT.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-RESEARCH.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-PATTERNS.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-VALIDATION.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-01-SUMMARY.md

@bin/wrap-mutation.mjs
@bin/gsd-sdk-shadow.mjs
@hooks/bd-sync.sh
@install.sh
@tests/install-tests/path-precedence.test.sh
@tests/install-tests/no-gsd-core-mutation.test.sh
@tests/shadow-tests/wrap-mutation.test.mjs

<interfaces>
<!-- Contracts this plan creates. Phases 5-9 import the parity helpers in every read-handler test. -->

tests/shadow-tests/_parity-helpers.mjs (NEW — created here):
```javascript
/**
 * Recursively assert every key in `snapshot` exists in `actual`.
 * Throws AssertionError with path like ".phases[0].disk_status" on missing key.
 * Values are NOT compared (D-09).
 */
export function assertKeySetParity(actual: any, snapshot: any, path?: string): void;

/**
 * Recursively assert matching value types between actual and snapshot.
 * Type vocabulary: 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'
 * null in snapshot = "any type allowed" (wildcard for upstream's "no value yet" convention).
 */
export function assertTypeParity(actual: any, snapshot: any, path?: string): void;
```

gsd-sdk-cc.version.lock (NEW — created here):
```
1.38.5
```

Snapshot file format (per RESEARCH §Pattern 4):
```json
{ "data": { "ok": true, "backend": "beads" } }
```

Existing patterns (PATTERNS.md):
- `tests/install-tests/path-precedence.test.sh` — sandbox-HOME + run install.sh + grep stdout (analog for upstream-version-pin.test.sh)
- `tests/install-tests/no-gsd-core-mutation.test.sh` CASE 1 — static grep guard (analog for bd-allowlist-grep.test.sh)
- `bin/gsd-sdk-shadow.mjs:248-252` — spawnUpstream pattern (UPSTREAM_BIN const for update-snapshots.mjs)
- `install.sh:14-21` — lockfile pre-check pattern
- `bin/wrap-mutation.mjs:1-11` — ESM module skeleton + SDK_BASE discovery
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create _parity-helpers.mjs + .test.mjs (D-09 key-set + types harness)</name>
  <files>
    tests/shadow-tests/_parity-helpers.mjs
    tests/shadow-tests/_parity-helpers.test.mjs
  </files>
  <behavior>
    Module:
    - `assertKeySetParity(actual, snapshot, path = '')` recursively asserts every key in snapshot exists in actual; on missing keys throws Error with message containing `parity: <path|'<root>'> missing keys: <comma-list>`
    - On objects, recurses into every key snapshot has
    - On arrays, checks element-0 shape only (snapshot must have ≥1 element)
    - When `snapshot === null`, allows any actual value (no throw)
    - When snapshot is a primitive type, no key comparison (only type comparison applies — that's assertTypeParity's job)

    Module:
    - `assertTypeParity(actual, snapshot, path = '')` uses internal `typeOf(v)` returning one of: 'string'|'number'|'boolean'|'null'|'array'|'object'|'undefined'
    - When typeOf(snapshot) === 'null', returns without throwing (wildcard)
    - When types mismatch, throws with message `parity: <path|'<root>'> type mismatch — snapshot=<ts>, actual=<ta>`
    - On 'object', recurses into every snapshot key
    - On 'array', recurses into element-0 (when both have ≥1 elements)

    Tests (6 cases):
    - CASE 1: assertKeySetParity — missing key throws with path containing the missing key name
    - CASE 2: assertKeySetParity — missing key in NESTED object throws with dotted path
    - CASE 3: assertTypeParity — type mismatch throws with `snapshot=number, actual=string` (or matching format)
    - CASE 4: assertTypeParity — null in snapshot allows any actual type (number, string, object — no throw)
    - CASE 5: assertKeySetParity — array shape check uses element-0 (mismatching shapes inside element-0 throw; mismatching lengths do NOT throw)
    - CASE 6: assertKeySetParity — recursion through 3-level nested object surfaces correct path
  </behavior>
  <action>
**File 1: tests/shadow-tests/_parity-helpers.mjs**

Create the module with the verbatim body from RESEARCH §Pattern 4 (lines
465-527). Include the header comment per PATTERNS.md "tests/shadow-tests/
_parity-helpers.mjs" section:

```javascript
// tests/shadow-tests/_parity-helpers.mjs
// Source: hand-rolled. ~28 LOC. No npm dep — see RESEARCH §Alternatives Considered.
// D-09: key-set + types parity only; values may differ between bd-state and file-state.

export function assertKeySetParity(actual, snapshot, path = '') {
  // ... verbatim from RESEARCH lines 465-500 ...
}

export function assertTypeParity(actual, snapshot, path = '') {
  // ... verbatim from RESEARCH lines 507-521 ...
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
```

Critical detail per PATTERNS.md (and RESEARCH line 510): null in snapshot =
"any type allowed". This is what lets the harness tolerate "upstream returns
null when no data; bd returns 0" without false-positive — do NOT remove this
branch.

**File 2: tests/shadow-tests/_parity-helpers.test.mjs**

Create the test file mirroring `tests/shadow-tests/wrap-mutation.test.mjs:1-3`
imports per PATTERNS.md "tests/shadow-tests/_parity-helpers.test.mjs":

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertKeySetParity, assertTypeParity } from './_parity-helpers.mjs';
```

Six `test('CASE N: ...', () => { ... })` blocks per `<behavior>`. Use `CASE N:`
title prefix. Sample for CASE 1:

```javascript
test('CASE 1: assertKeySetParity — missing key throws with path', () => {
  assert.throws(
    () => assertKeySetParity({}, { foo: 1 }),
    /missing keys: foo/
  );
});
```

For CASE 4 (null wildcard):
```javascript
test('CASE 4: assertTypeParity — null snapshot allows any actual type', () => {
  assert.doesNotThrow(() => assertTypeParity(42, null));
  assert.doesNotThrow(() => assertTypeParity('s', null));
  assert.doesNotThrow(() => assertTypeParity({}, null));
  assert.doesNotThrow(() => assertTypeParity([], null));
});
```

For CASE 5 (array shape):
```javascript
test('CASE 5: assertKeySetParity — array element-0 shape comparison', () => {
  // Mismatching length: no throw (we only check element-0 shape)
  assert.doesNotThrow(() => assertKeySetParity(
    [{ a: 1 }, { a: 2 }, { a: 3 }],
    [{ a: 1 }]
  ));
  // Mismatching shape inside element-0: throws
  assert.throws(
    () => assertKeySetParity([{}], [{ a: 1 }]),
    /missing keys: a/
  );
});
```

For CASE 6 (3-level recursion):
```javascript
test('CASE 6: assertKeySetParity — nested missing key surfaces dotted path', () => {
  assert.throws(
    () => assertKeySetParity(
      { phases: [{ id: 'p1' }] },
      { phases: [{ id: 'p1', disk_status: 'open' }] }
    ),
    /\.phases\[0\].*missing keys:.*disk_status/
  );
});
```

DO NOT add a CASE 7 testing JSON file loading from the snapshots/ directory —
that's covered by the snapshot file existing (Task 2) and the Phases 5-9
real-handler tests, not the harness's internal contract.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/_parity-helpers.test.mjs</automated>
  </verify>
  <done>
    - Both files exist
    - `node --test tests/shadow-tests/_parity-helpers.test.mjs` reports `# pass 6 # fail 0`
    - `_parity-helpers.mjs` has zero npm imports (only ESM exports)
    - File line count for `_parity-helpers.mjs` is ≤ 35 lines including comments (the ~28-LOC budget per RESEARCH §Pattern 4)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create snapshot fixture + update-snapshots.mjs + version lock</name>
  <files>
    tests/shadow-tests/snapshots/_phase4-test-stub.json
    tests/scripts/update-snapshots.mjs
    gsd-sdk-cc.version.lock
  </files>
  <behavior>
    - `tests/shadow-tests/snapshots/_phase4-test-stub.json` exists and contains valid JSON `{ "data": { "ok": true, "backend": "beads" } }` (with trailing newline)
    - `gsd-sdk-cc.version.lock` exists at repo root and contains exactly the line `1.38.5\n`
    - `tests/scripts/update-snapshots.mjs` is executable Node script (shebang `#!/usr/bin/env node`)
    - update-snapshots.mjs reads `gsd-sdk-cc.version.lock` from repo root; if missing → exit 1 with error
    - update-snapshots.mjs spawns `gsd-sdk --version`, extracts the semver `(\d+\.\d+\.\d+)`, compares to lockfile contents; mismatch → exit 1 with error
    - Phase 4: only the `_phase4-test-stub` snapshot is regenerated (Phases 5-9 add more entries to a list inside this script)
    - Successful regen writes `tests/shadow-tests/snapshots/_phase4-test-stub.json` with the canonical shape
  </behavior>
  <action>
**File 1: tests/shadow-tests/snapshots/_phase4-test-stub.json**

Create the directory `tests/shadow-tests/snapshots/` if missing, then write:

```json
{
  "data": {
    "ok": true,
    "backend": "beads"
  }
}
```

(Trailing newline at EOF.)

**File 2: gsd-sdk-cc.version.lock**

Create at repo root with exactly one line:
```
1.38.5
```
(Trailing newline.)

**File 3: tests/scripts/update-snapshots.mjs**

Create directory `tests/scripts/` if missing, then write the regenerator
combining three patterns per PATTERNS.md "tests/scripts/update-snapshots.mjs":

1. Lockfile pre-check (mirror `install.sh:14-21` style)
2. spawnUpstream pattern (mirror `bin/gsd-sdk-shadow.mjs:248-252`)
3. Snapshot writer per RESEARCH §Pattern 4

Imports:
```javascript
#!/usr/bin/env node
// tests/scripts/update-snapshots.mjs
// Regenerates tests/shadow-tests/snapshots/<cmd>.json from upstream gsd-sdk-cc.
// Pre-checks lockfile (gsd-sdk-cc.version.lock) to prevent version drift (Pitfall 3).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
```

Body:
```javascript
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const LOCK = join(REPO_ROOT, 'gsd-sdk-cc.version.lock');
const SNAPSHOT_DIR = join(REPO_ROOT, 'tests/shadow-tests/snapshots');

// Lockfile pre-check (Pitfall 3 mitigation)
if (!existsSync(LOCK)) {
  console.error(`ERROR: ${LOCK} missing — refusing to write snapshots without pin`);
  process.exit(1);
}
const expected = readFileSync(LOCK, 'utf-8').trim();
const v = spawnSync('gsd-sdk', ['--version'], { encoding: 'utf-8' });
const actual = (v.stdout ?? '').match(/(\d+\.\d+\.\d+)/)?.[1];
if (actual !== expected) {
  console.error(`ERROR: gsd-sdk version mismatch — expected=${expected}, installed=${actual ?? '<none>'}`);
  process.exit(1);
}

// Phase 4: just the stub snapshot. Phases 5-9 extend SNAPSHOTS.
const SNAPSHOTS = [
  {
    cmd: '_phase4-test-stub',
    out: join(SNAPSHOT_DIR, '_phase4-test-stub.json'),
    // Phase 4 stub is wired through shadow's GSD_SHADOW_TEST_STUB env var, not upstream.
    // For the stub specifically, we write a static literal — not a captured upstream response.
    // Phases 5-9 swap this with a real spawnSync(UPSTREAM_BIN, [...], { cwd: seededFixture }).
    literal: { data: { ok: true, backend: 'beads' } },
  },
];

mkdirSync(SNAPSHOT_DIR, { recursive: true });
for (const s of SNAPSHOTS) {
  if (s.literal) {
    writeFileSync(s.out, JSON.stringify(s.literal, null, 2) + '\n');
    console.log(`wrote ${s.out} (literal)`);
  } else {
    // Phase 5+ branch: seed fixture, run upstream, capture stdout, parse, write.
    // Reserved for downstream phases.
  }
}
console.log(`update-snapshots: wrote ${SNAPSHOTS.length} snapshot(s) at version ${expected}`);
```

`chmod +x tests/scripts/update-snapshots.mjs` so the shebang works.

DO NOT actually run the script during this task (it requires gsd-sdk on PATH
and Phase 4's stub snapshot is a literal — Task 1's snapshot file is sufficient).
The script is exercised in Phase 5 when the first real handler ships.

DO NOT create a `package.json` to wrap this in `npm run snapshot:update` —
RESEARCH §Open Question #4 documents that no package.json should be added in
Phase 4. Invoke directly: `node tests/scripts/update-snapshots.mjs`.
  </action>
  <verify>
    <automated>test -s tests/shadow-tests/snapshots/_phase4-test-stub.json && test -s gsd-sdk-cc.version.lock && test -x tests/scripts/update-snapshots.mjs && node -e "JSON.parse(require('fs').readFileSync('tests/shadow-tests/snapshots/_phase4-test-stub.json','utf-8'))" && echo OK</automated>
  </verify>
  <done>
    - `tests/shadow-tests/snapshots/_phase4-test-stub.json` exists and is valid JSON
    - `gsd-sdk-cc.version.lock` exists with content `1.38.5\n`
    - `tests/scripts/update-snapshots.mjs` exists, has shebang, is executable
    - `node tests/scripts/update-snapshots.mjs` (when run with matching gsd-sdk version) re-writes the snapshot file (do NOT run during execution; reserved for Phase 5+ workflow)
    - `node -e "console.log(JSON.parse(require('fs').readFileSync('tests/shadow-tests/snapshots/_phase4-test-stub.json','utf-8')).data.backend)"` prints `beads`
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create upstream-version-pin.test.sh + bd-allowlist-grep.test.sh (with WARN-3 tampered counter-test)</name>
  <files>
    tests/install-tests/upstream-version-pin.test.sh
    tests/shadow-tests/bd-allowlist-grep.test.sh
  </files>
  <behavior>
    upstream-version-pin.test.sh:
    - CASE 1: `gsd-sdk-cc.version.lock` exists and is non-empty (`-s`)
    - CASE 2: First line of lockfile (after stripping whitespace) matches the semver extracted from `gsd-sdk --version`
    - On mismatch, prints `[FAIL] CASE 2: drift — lockfile=<x>, installed=<y>` and exits 1
    - Uses `pass=0/fail=0` accumulator with `_pass`/`_fail` helpers; final `[ "$fail" -eq 0 ]` exit per PATTERNS.md "Pass/fail accumulator"

    bd-allowlist-grep.test.sh:
    - CASE 1 (allowlist source intact): grep `hooks/bd-sync.sh` for the canonical allowlist regex literal; pass when present, fail when missing. Phase 4 caveat: BEADS_READ_OVERRIDES is empty — full read-handler grep enforcement deferred to Phase 11.
    - CASE 2 (WARN-3: tampered-allowlist counter-test — proves CASE 1 actually catches violations): copy `hooks/bd-sync.sh` to a mkdtempSync directory; sed-edit the copy to either (a) add a write-side bd subcommand inline (e.g. `bd close`) AND remove the canonical allowlist string, or (b) overwrite the allowlist line entirely with a tampered allowlist that drops the canonical string. Re-run the same allowlist-presence check against the tampered copy and assert it FAILS (i.e. the grep returns non-zero). If the tampered copy still passes the check, CASE 1 is tautological — fail loudly. Cleans up the tempdir on exit (trap or explicit rm).
    - The allowlist is `list|show|ready|memories|status|prime|export|deps|children|search|help|version` (extracted from `hooks/bd-sync.sh:23`)
    - Uses `pass=0/fail=0` accumulator
    - Phase 4 caveat documented in script comment: "Phase 4 ships zero real read handlers (BEADS_READ_OVERRIDES = {}); CASE 1 asserts the canonical allowlist string still exists at hooks/bd-sync.sh. CASE 2 self-tests CASE 1 by tampering with a copy and asserting the grep fails. Phase 11 ships the full read-handler enforcement test against Phases 5-9's real handlers."
    - `bd-helper.mjs::bd()` is OUT of scope for the grep — its argv is run-time controlled by callers, not statically determinable. The grep targets only the allowlist string literal in `hooks/bd-sync.sh` (Phase 4); per-handler grep enforcement lands in Phase 11.
  </behavior>
  <action>
**File 1: tests/install-tests/upstream-version-pin.test.sh**

Create following PATTERNS.md "tests/install-tests/upstream-version-pin.test.sh"
section, mirroring `tests/install-tests/path-precedence.test.sh:1-17` structure:

```bash
#!/usr/bin/env bash
# upstream-version-pin.test.sh — D-10 lockfile drift detection.
# Asserts gsd-sdk-cc.version.lock matches what the installed gsd-sdk reports.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOCK="$REPO_ROOT/gsd-sdk-cc.version.lock"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[upstream-version-pin.test.sh] Running 2 test cases..."
echo ""

# CASE 1: lockfile exists and is non-empty
if [ ! -s "$LOCK" ]; then
  _fail "CASE 1: $LOCK missing or empty"
else
  _pass "CASE 1: $LOCK present and non-empty"
fi

# CASE 2: lockfile matches installed gsd-sdk version
expected=$(head -1 "$LOCK" | tr -d '[:space:]')
actual=$(gsd-sdk --version 2>/dev/null || true)
actual_semver=$(printf '%s' "$actual" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ -z "$actual_semver" ]; then
  _fail "CASE 2: gsd-sdk --version returned no parseable semver (got: $actual)"
elif [ "$expected" = "$actual_semver" ]; then
  _pass "CASE 2: lockfile $expected matches installed $actual_semver"
else
  _fail "CASE 2: drift — lockfile=$expected, installed=$actual_semver"
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
```

`chmod +x tests/install-tests/upstream-version-pin.test.sh`.

**File 2: tests/shadow-tests/bd-allowlist-grep.test.sh**

Create following PATTERNS.md "tests/shadow-tests/bd-allowlist-grep.test.sh"
section, mirroring `tests/install-tests/no-gsd-core-mutation.test.sh` CASE 1
pattern. Phase 4 ships TWO cases per WARN-3: CASE 1 is the precursor allowlist-
intact check, CASE 2 is the tampered-allowlist counter-test that proves
CASE 1 catches violations rather than passing tautologically.

```bash
#!/usr/bin/env bash
# bd-allowlist-grep.test.sh — REQ-QUAL-05 precursor.
# Asserts the canonical bd allowlist string is intact in hooks/bd-sync.sh.
#
# Phase 4 caveat: BEADS_READ_OVERRIDES is empty (zero real handlers).
#   CASE 1: asserts the canonical allowlist string still exists at
#           hooks/bd-sync.sh:23.
#   CASE 2: WARN-3 self-test — copies hooks/bd-sync.sh to a tempdir, edits
#           the copy to drop the canonical allowlist string (and add a
#           write-side `bd close` invocation for good measure), runs the
#           same allowlist-presence check against the tampered copy, and
#           asserts that check FAILS. This proves CASE 1 actually catches
#           violations and isn't a tautology.
#
# Phase 11 ships the full read-handler enforcement test against Phases 5-9's
# real handlers (per-handler grep + per-handler allowlist intersection).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[bd-allowlist-grep.test.sh] Running 2 test cases..."
echo ""

# Allowlist source: hooks/bd-sync.sh:23
allowlist='list|show|ready|memories|status|prime|export|deps|children|search|help|version'

# Helper: returns 0 if the canonical allowlist regex literal is present in $1, 1 otherwise.
allowlist_present() {
  grep -qE "$allowlist" "$1"
}

# CASE 1: allowlist intact in hooks/bd-sync.sh
if allowlist_present "$REPO_ROOT/hooks/bd-sync.sh"; then
  _pass "CASE 1: allowlist source intact in hooks/bd-sync.sh"
else
  _fail "CASE 1: allowlist source not found in hooks/bd-sync.sh — has it moved?"
fi

# CASE 2 (WARN-3 self-test): tamper a copy, assert CASE 1's check FAILS against it.
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

tampered="$tmpdir/bd-sync.sh"
cp "$REPO_ROOT/hooks/bd-sync.sh" "$tampered"

# Replace the canonical allowlist regex with a tampered allowlist that drops
# the canonical string AND inserts a write-side `bd close` invocation.
# We use a portable sed expression that replaces any line containing the
# canonical regex with a single tampered line.
#
# Strategy: rewrite the file end-to-end via awk so we don't depend on the
# specific quoting/anchoring sed flavor. We keep all lines that don't contain
# the canonical regex; we replace any matching line with the tampered marker.
awk -v canon="list|show|ready|memories|status|prime|export|deps|children|search|help|version" \
    'index($0, canon) > 0 { print "  TAMPERED_ALLOWLIST=\"close|delete|purge\"  # bd close was added here"; next } { print }' \
    "$tampered" > "$tampered.new"
mv "$tampered.new" "$tampered"

# Sanity check: the tampered file must NOT contain the canonical allowlist
# string. If it still does (e.g., the canonical regex appears in multiple
# places and only one was rewritten), the counter-test is itself broken —
# bail out loudly so we don't silently pass.
if allowlist_present "$tampered"; then
  _fail "CASE 2: tampered copy STILL contains canonical allowlist — counter-test is broken (the canonical string likely appears in multiple lines of bd-sync.sh; rewrite the awk filter to strip them all)"
else
  # Now run the same check CASE 1 ran. The check MUST fail (return non-zero)
  # against the tampered copy — that's what proves CASE 1 catches violations.
  if allowlist_present "$tampered"; then
    # Unreachable per the sanity check above, kept as defense-in-depth.
    _fail "CASE 2: tampered copy passes allowlist check — CASE 1 is tautological"
  else
    _pass "CASE 2: tampered copy fails allowlist check — CASE 1 proven non-tautological"
  fi
fi

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
```

`chmod +x tests/shadow-tests/bd-allowlist-grep.test.sh`.

CRITICAL: avoid the "self-invalidating grep gate" anti-pattern from the
system prompt. Both calls to `allowlist_present` use `grep -qE` (quiet match
on a positive match), not `grep -c | == 0`. The pass/fail logic in CASE 2
inverts the result via the bash `if` — that's a structural inversion, not a
count-based gate, so comments in `bd-sync.sh` cannot pollute the result.

WARN-3 RATIONALE (per plan-checker): without CASE 2, CASE 1 is a tautology —
it asserts "the allowlist string appears in bd-sync.sh", but bd-sync.sh
literally defines that string, so it would pass even if the surrounding
allowlist were tampered with. CASE 2 closes the loop by demonstrating, in
the same test run, that the check actually fails when the allowlist content
is mutated.

DO NOT extend CASE 2 to grep `bin/gsd-sdk-shadow.mjs` for non-allowlisted
bd subcommands — that produces false positives against the 13 mutation
handlers (which intentionally use `bd q`, `bd close`, `bd link`, `bd label
add`, etc., none of which are in the read-only allowlist). Per-read-handler
enforcement is Phase 11 work; Phase 4 only proves the wiring + the self-test.

DO NOT add a CASE 3 yet. Phase 4 ships exactly two cases here: CASE 1 (the
positive check) and CASE 2 (the negative self-test).
  </action>
  <verify>
    <automated>bash tests/install-tests/upstream-version-pin.test.sh && bash tests/shadow-tests/bd-allowlist-grep.test.sh</automated>
  </verify>
  <done>
    - Both shell test files exist and are executable
    - `bash tests/install-tests/upstream-version-pin.test.sh` exits 0; prints `Passed: 2 / 2`
    - `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0; prints `Passed: 2 / 2` (WARN-3: now 2 cases, not 1)
    - CASE 2 in bd-allowlist-grep.test.sh exercises a tampered copy of `hooks/bd-sync.sh` in a mkdtempSync tempdir; the tempdir is cleaned up on exit (no `/tmp/tmp.*` leftovers after the run)
    - Both scripts use the standard pass/fail accumulator pattern (per PATTERNS.md)
    - No script triggers a "self-invalidating grep gate" warning (no `grep -c | == 0` patterns; both grep calls use `grep -qE` and the bash `if` for inversion)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Snapshot file (committed) → parity assertion | Snapshot is repo-trusted; drift detection is the integrity story (D-10) |
| Lockfile → CI / `update-snapshots.mjs` | Lockfile is committed text; CI greps and update-snapshots reads it as the source of truth |
| `bd-sync.sh` allowlist string → grep test | Allowlist string is repo-trusted; if it's mutated (legitimate bug or attack), the grep test surfaces the change. CASE 2 proves the grep test actually catches mutations. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-04 | Tampering | Snapshot drift from upstream gsd-sdk | mitigate | `gsd-sdk-cc.version.lock` pins version; `update-snapshots.mjs` refuses to run when installed version doesn't match; `tests/install-tests/upstream-version-pin.test.sh` fails CI on drift (D-10) |
| T-04-10 | Tampering | Stale snapshot committed from version-mismatched dev machine | mitigate | `update-snapshots.mjs` lockfile pre-check rejects mismatched versions before writing (Pitfall 3) |
| T-04-11 | Tampering | Allowlist string in `hooks/bd-sync.sh` mutated to permit dangerous bd subcommands | mitigate | `bd-allowlist-grep.test.sh` CASE 1 greps for the canonical allowlist string; CASE 2 self-tests CASE 1 by tampering with a copy and asserting the grep fails — closing the tautology gap WARN-3 flagged. Full per-read-handler enforcement in Phase 11. |
| T-04-12 | Information Disclosure | Snapshot files contain bd state with potentially-sensitive titles | accept | Phase 4's only snapshot (`_phase4-test-stub.json`) is a literal `{ ok: true, backend: 'beads' }`; no real bd state. Phase 5+ snapshots may capture bd content but it's drawn from `tests/fixtures/seed.jsonl` which is committed test data, not real project data. |
| T-04-13 | DoS | Pathological JSON in snapshot triggers stack overflow in parity helper | accept | Snapshots are committed JSON authored deliberately; recursion depth is bounded by the snapshot's nesting (typically ≤4 levels in v0.2 schemas) |
</threat_model>

<verification>
After all 3 tasks complete:

```bash
# Run all Phase 4 Plan 03 tests
node --test tests/shadow-tests/_parity-helpers.test.mjs
# Expected: # pass 6 # fail 0

bash tests/install-tests/upstream-version-pin.test.sh
# Expected: Passed: 2 / 2

bash tests/shadow-tests/bd-allowlist-grep.test.sh
# Expected: Passed: 2 / 2 (WARN-3: CASE 1 + CASE 2 tampered counter-test)

# Verify all artifacts
test -f tests/shadow-tests/_parity-helpers.mjs
test -f tests/shadow-tests/snapshots/_phase4-test-stub.json
test -f tests/scripts/update-snapshots.mjs
test -f gsd-sdk-cc.version.lock

# Verify lockfile content
cat gsd-sdk-cc.version.lock
# Expected: 1.38.5

# Verify snapshot is valid JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('tests/shadow-tests/snapshots/_phase4-test-stub.json','utf-8')).data.backend)"
# Expected: beads

# Verify _parity-helpers.mjs has zero npm imports
grep -E "^import.*from\s+['\"][^./]" tests/shadow-tests/_parity-helpers.mjs && echo "FAIL: has npm import" || echo "OK: no npm imports"
```
</verification>

<success_criteria>
- All 6 cases of `_parity-helpers.test.mjs` pass green
- `_parity-helpers.mjs` is ≤ 35 lines and has no npm imports (verified via grep)
- `_phase4-test-stub.json` is valid JSON with shape `{ data: { ok: <bool>, backend: <string> } }`
- `gsd-sdk-cc.version.lock` exists at repo root with content `1.38.5\n`
- `update-snapshots.mjs` exists, executable, reads the lockfile, refuses on version mismatch (verified by inspecting code; not run live in this plan)
- `upstream-version-pin.test.sh` reports 2/2 PASS
- `bd-allowlist-grep.test.sh` reports 2/2 PASS (WARN-3: CASE 1 allowlist intact + CASE 2 tampered counter-test)
- All Phases 5-9 can `import { assertKeySetParity, assertTypeParity } from '../_parity-helpers.mjs'` (relative path from a test file in `tests/shadow-tests/`)
</success_criteria>

<output>
After completion, create `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-03-SUMMARY.md` documenting:
- Files created (7)
- Test case results (6 unit + 2 + 2 = 10 cases passing — bd-allowlist-grep CASE 2 is the WARN-3 tampered counter-test)
- Key contract: every Phase 5-9 read-handler test imports the parity helpers and validates against a snapshot in `tests/shadow-tests/snapshots/<cmd>.json`
- Key contract: `update-snapshots.mjs` is the single regenerator; `gsd-sdk-cc.version.lock` is its drift gate
- Key contract: bd-allowlist-grep.test.sh now ships its own self-test (CASE 2 tampered counter-test) so any future drift in the canonical allowlist regex is caught without waiting for Phase 11's full enforcement to land
- Phase 5 expansion notes: Phases 5-9 each add an entry to the `SNAPSHOTS` array in `update-snapshots.mjs` and a corresponding `<cmd>.json` file under `tests/shadow-tests/snapshots/`
</output>
</content>
