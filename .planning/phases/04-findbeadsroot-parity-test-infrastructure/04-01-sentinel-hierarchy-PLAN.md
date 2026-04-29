---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/beads-errors.mjs
  - bin/bd-helper.mjs
  - tests/shadow-tests/beads-errors.test.mjs
  - tests/shadow-tests/bd-helper.test.mjs
autonomous: true
requirements:
  - REQ-QUAL-02
must_haves:
  truths:
    - "BeadsUnavailableError is the base class; BeadsNotInstalled / BeadsCorrupt / BeadsVersionMismatch / BeadsEmpty all subtype it"
    - "instanceof works across module boundaries (subtype instance is instanceof base AND instanceof Error)"
    - "BeadsCause enum is frozen; mutation is a no-op (or throws in strict mode)"
    - "Each subtype sets its own .name string (cross-ESM-boundary fallback per Pitfall 1)"
    - "originalError is preserved on construction when supplied via opts"
    - "bd() helper invokes spawnSync('bd', args) — never string-concatenates into a shell"
    - "bd() throws BeadsNotInstalled when result.error?.code === 'ENOENT'"
    - "bd() throws BeadsCorrupt when result.status !== 0 (covers stderr-mention-of database/dolt/metadata.json)"
    - "bd() throws BeadsEmpty when parsed JSON has shape { error, schema_version }"
    - "bd() returns parsed JSON on success"
    - "bd() unit tests cover ENOENT (BeadsNotInstalled), version-mismatch stderr (BeadsVersionMismatch — see WARN-2 caveat below), corrupt-store stderr (BeadsCorrupt), and successful JSON return path (4 cases minimum)"
  artifacts:
    - path: "bin/beads-errors.mjs"
      provides: "BeadsCause enum + BeadsUnavailableError + 4 subtypes"
      exports: ["BeadsCause", "BeadsUnavailableError", "BeadsNotInstalled", "BeadsCorrupt", "BeadsVersionMismatch", "BeadsEmpty"]
      min_lines: 25
    - path: "bin/bd-helper.mjs"
      provides: "bd() wrapper around spawnSync that throws sentinel subtypes on failure"
      exports: ["bd"]
      min_lines: 30
    - path: "tests/shadow-tests/beads-errors.test.mjs"
      provides: "instanceof + frozen-enum + subtype-name + originalError tests (4 cases)"
      contains: "BeadsCause"
    - path: "tests/shadow-tests/bd-helper.test.mjs"
      provides: "bd() unit tests via PATH-mocked bd shim — 4 cases (ENOENT, version-mismatch stderr, corrupt-store stderr, successful JSON)"
      min_lines: 60
  key_links:
    - from: "bin/bd-helper.mjs"
      to: "bin/beads-errors.mjs"
      via: "named import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty }"
      pattern: "from ['\"]\\./beads-errors\\.mjs['\"]"
    - from: "tests/shadow-tests/beads-errors.test.mjs"
      to: "bin/beads-errors.mjs"
      via: "named imports for all 6 exports"
      pattern: "from ['\"]\\.\\./\\.\\./bin/beads-errors\\.mjs['\"]"
    - from: "tests/shadow-tests/bd-helper.test.mjs"
      to: "bin/bd-helper.mjs"
      via: "named import { bd } + PATH-mocked shell-script bd shim under mkdtempSync"
      pattern: "from ['\"]\\.\\./\\.\\./bin/bd-helper\\.mjs['\"]"
---

<objective>
Land the sentinel error class hierarchy and the `bd()` invocation helper that
every Phase 5–9 read handler will throw through. Plans 2, 3, and 4 all depend on
`bin/beads-errors.mjs` being importable; the helper module rounds out the
"helpers throw, handlers stay clean" contract from D-13.

Purpose: Provide the typed failure vocabulary the dispatcher's read-side
fall-through (Plan 2) keys off, and the spawnSync wrapper that translates
bd-CLI failures into that vocabulary (D-11, D-13, D-14, REQ-QUAL-02).

Output:
- `bin/beads-errors.mjs` — pure-JS class hierarchy (~28 LOC, no imports)
- `bin/bd-helper.mjs` — `bd(args, opts)` helper using `spawnSync` (~30 LOC)
- `tests/shadow-tests/beads-errors.test.mjs` — 4 cases asserting instanceof
  parity, frozen enum, per-subtype `.name`, originalError preservation
- `tests/shadow-tests/bd-helper.test.mjs` — 4 cases asserting bd() throws the
  correct sentinel subtype for each failure mode (ENOENT, version-mismatch
  stderr, corrupt-store stderr, success → returns parsed JSON). Per WARN-2
  this gives Phase 4 a real test gate on bd-helper before Phases 5–9 import it.
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

@bin/wrap-mutation.mjs
@bin/gsd-sdk-shadow.mjs
@tests/shadow-tests/wrap-mutation.test.mjs

<interfaces>
<!-- Contracts this plan creates. Plans 2, 3, 4 import from these files. -->
<!-- Use these directly — no codebase exploration needed. -->

bin/beads-errors.mjs (NEW — created by this plan):
```javascript
export const BeadsCause: Readonly<{
  NotInstalled:    'not-installed',
  Corrupt:         'corrupt',
  VersionMismatch: 'version-mismatch',
  Empty:           'empty',
  Unknown:         'unknown',
}>;

export class BeadsUnavailableError extends Error {
  constructor(message: string, opts?: { cause?: string, originalError?: Error });
  name: 'BeadsUnavailableError';
  cause: string;            // BeadsCause enum value
  originalError?: Error;
}
export class BeadsNotInstalled extends BeadsUnavailableError {
  // .name = 'BeadsNotInstalled'; cause = BeadsCause.NotInstalled
}
export class BeadsCorrupt extends BeadsUnavailableError {
  // .name = 'BeadsCorrupt'; cause = BeadsCause.Corrupt
}
export class BeadsVersionMismatch extends BeadsUnavailableError {
  // .name = 'BeadsVersionMismatch'; cause = BeadsCause.VersionMismatch
}
export class BeadsEmpty extends BeadsUnavailableError {
  // .name = 'BeadsEmpty'; cause = BeadsCause.Empty
}
```

bin/bd-helper.mjs (NEW — created by this plan):
```javascript
/**
 * Invoke bd via spawnSync. Returns parsed JSON on success.
 * Throws BeadsNotInstalled on ENOENT, BeadsCorrupt on non-zero exit or
 * non-JSON stdout, BeadsEmpty on bd's `{ error, schema_version }` shape.
 */
export function bd(
  args: string[],
  opts?: { cwd?: string, parseJson?: boolean }
): any;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create bin/beads-errors.mjs (sentinel hierarchy)</name>
  <files>bin/beads-errors.mjs</files>
  <behavior>
    - `BeadsCause` is a frozen object exporting 5 string values: 'not-installed', 'corrupt', 'version-mismatch', 'empty', 'unknown'
    - `BeadsUnavailableError` extends `Error`, sets `this.name = 'BeadsUnavailableError'`, accepts `(message, { cause = BeadsCause.Unknown, originalError } = {})`, calls `Error.captureStackTrace(this, this.constructor)` when available
    - 4 subclasses (`BeadsNotInstalled`, `BeadsCorrupt`, `BeadsVersionMismatch`, `BeadsEmpty`) each pass `{ ...opts, cause: <matching enum> }` up to super and override `this.name` to their own class name
    - All exports are named (no default exports)
    - File uses ESM `import`/`export` syntax; no imports from npm or Node built-ins (pure JS classes)
  </behavior>
  <action>
Create `bin/beads-errors.mjs` with the verbatim hierarchy from
RESEARCH.md §Pattern 2 (lines 319-369). Specifically:

1. Header comment block (3 lines) attributing source: "Source: derived from
   MDN ECMA-262 Error subclassing pattern; cause enum mirrors D-14 sentinel
   metadata schema."
2. `export const BeadsCause = Object.freeze({ NotInstalled: 'not-installed',
   Corrupt: 'corrupt', VersionMismatch: 'version-mismatch',
   Empty: 'empty', Unknown: 'unknown' });`
3. `export class BeadsUnavailableError extends Error` with constructor
   `(message, { cause = BeadsCause.Unknown, originalError } = {})` that:
   - calls `super(message)`
   - sets `this.name = 'BeadsUnavailableError'`
   - sets `this.cause = cause`
   - sets `this.originalError = originalError` only if truthy
   - calls `Error.captureStackTrace(this, this.constructor)` only if
     `Error.captureStackTrace` is defined (V8 guard — harmless on other engines)
4. Four subclasses (BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch,
   BeadsEmpty), each with constructor `(message, opts = {})` that calls
   `super(message, { ...opts, cause: BeadsCause.<matching> })` then sets
   `this.name = '<ClassName>'`. The `this.name` reassignment is load-bearing
   per Pitfall 1 (cross-ESM-boundary fallback when `instanceof` splits).

DO NOT add a `bd-helper` import here; this file has zero imports. DO NOT use
`Symbol.toPrimitive` or any cleverness — vanilla class syntax only.

PATTERNS.md analog: header comment style mirrors `bin/wrap-mutation.mjs:1-11`
(short attribution block + ESM exports). The class shape itself has no in-repo
analog; verbatim from RESEARCH §Pattern 2 verified against MDN.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/beads-errors.test.mjs</automated>
  </verify>
  <done>
    - File exists at `bin/beads-errors.mjs`
    - Six named exports: BeadsCause, BeadsUnavailableError, BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty
    - `node -e "import('./bin/beads-errors.mjs').then(m => { const e = new m.BeadsNotInstalled('x'); console.log(e instanceof m.BeadsUnavailableError, e.name, e.cause); })"` prints `true BeadsNotInstalled not-installed`
    - All 4 cases of `tests/shadow-tests/beads-errors.test.mjs` pass green
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create tests/shadow-tests/beads-errors.test.mjs (4 unit cases)</name>
  <files>tests/shadow-tests/beads-errors.test.mjs</files>
  <behavior>
    - CASE 1: `new BeadsNotInstalled('bd missing')` is `instanceof BeadsUnavailableError`, is `instanceof Error`, has `cause === BeadsCause.NotInstalled`
    - CASE 2: `Object.isFrozen(BeadsCause)` returns `true`
    - CASE 3: each subtype's constructed instance has `.name` matching its class name (4 sub-asserts: 'BeadsNotInstalled', 'BeadsCorrupt', 'BeadsVersionMismatch', 'BeadsEmpty')
    - CASE 4: `new BeadsCorrupt('wrapper', { originalError: inner })` exposes the same Error reference at `.originalError`
  </behavior>
  <action>
Create `tests/shadow-tests/beads-errors.test.mjs` mirroring the imports and
test-case structure from `tests/shadow-tests/wrap-mutation.test.mjs:1-3` (per
PATTERNS.md "exact" match — pure JS class tests, no fixture, no subprocess).

Imports verbatim:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BeadsCause,
  BeadsUnavailableError,
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsVersionMismatch,
  BeadsEmpty,
} from '../../bin/beads-errors.mjs';
```

Then 4 `test('CASE N: ...', () => { ... })` blocks per the per-task behavior
list above, using the bodies from PATTERNS.md lines 532-560 verbatim. Use
the `CASE N: <description>` title prefix per PATTERNS.md "CASE numbering
convention" section. No fixture setup needed — these are pure-JS class tests.

Do NOT add a CASE asserting `instanceof` works after re-import via different
URL (Pitfall 1 cross-ESM-boundary case is exercised end-to-end by Plan 2's
handler stub tests, not here — these are isolated unit tests for the module
itself).
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/beads-errors.test.mjs</automated>
  </verify>
  <done>
    - File exists at `tests/shadow-tests/beads-errors.test.mjs`
    - `node --test tests/shadow-tests/beads-errors.test.mjs` reports `# pass 4 # fail 0`
    - Each test title begins with `CASE N:` (1, 2, 3, 4)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create bin/bd-helper.mjs (spawnSync wrapper)</name>
  <files>bin/bd-helper.mjs</files>
  <behavior>
    - Exports `bd(args, opts)` where args is an Array<string> and opts has optional `{ cwd?: string, parseJson?: boolean }` (default `parseJson: true`)
    - Internally calls `spawnSync('bd', args, { cwd, encoding: 'utf-8' })` — args is an Array so no shell interpretation
    - When `result.error?.code === 'ENOENT'` → throws `new BeadsNotInstalled('bd binary not found on PATH', { originalError: result.error })`
    - When `result.status !== 0` and stderr matches `/database|dolt|metadata\.json/i` → throws `BeadsCorrupt` with the stderr as message and a wrapping originalError
    - When `result.status !== 0` and stderr does NOT match those patterns → throws `BeadsCorrupt(`bd ${args[0]} failed (status ${status}): ${stderr}`)`
    - When `parseJson === false` → returns raw `result.stdout` string (no JSON.parse)
    - When stdout is not parseable as JSON → throws `BeadsCorrupt` quoting the first 200 chars of stdout
    - When parsed JSON is a non-array object containing an `'error'` key → throws `new BeadsEmpty(parsed.error, { originalError: new Error(parsed.error) })`
    - On success, returns the parsed JSON value (could be array, object, primitive)
  </behavior>
  <action>
Create `bin/bd-helper.mjs` per RESEARCH.md §Pattern 3 (lines 405-449) verbatim,
with the header docstring identifying purpose and citing Pitfall 2.

Imports:
```javascript
// bin/bd-helper.mjs
// Wraps spawnSync('bd', …); throws BeadsUnavailableError subtypes on failure.
// Pitfall 2 mitigation: spawnSync (not execSync) so reads can fall through to upstream.
// Helpers-throw / handlers-stay-clean per D-13.
import { spawnSync } from 'node:child_process';
import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty } from './beads-errors.mjs';
```

Body verbatim from RESEARCH.md lines 416-449. The four load-bearing details
(per PATTERNS.md "bin/bd-helper.mjs" section):

1. `spawnSync('bd', args, { cwd, encoding: 'utf-8' })` — args is an array;
   never string-concatenate into a shell. Phase 4 explicitly avoids the
   anti-pattern at `gsd-sdk-shadow.mjs:29-32` (which uses execSync with
   string concat — that's the existing mutation-side pattern Phase 4 does
   NOT extend to reads).
2. Optional chaining on `result.error?.code` — `result.error` is `undefined`
   on success.
3. Detect bd's empty-error shape: `parsed && typeof parsed === 'object' &&
   !Array.isArray(parsed) && 'error' in parsed` → throw `BeadsEmpty`. Per
   STACK.md edge case "memories returns object not array".
4. Do NOT import `SDK_BASE` here — bd-helper only invokes the `bd` CLI, not
   upstream gsd-sdk. (PATTERNS.md "SDK base path discovery (NOT needed for
   bd-helper.mjs)".)

Per WARN-2 follow-up: this plan now ships a dedicated `tests/shadow-tests/
bd-helper.test.mjs` (Task 4 below) so each throw branch has direct coverage in
Phase 4, before Phases 5–9 build on top. The earlier "no test for bd-helper.mjs
in this plan or in Phase 4" stance is REPLACED by Task 4.

Do NOT add `BeadsVersionMismatch` throw paths here — version detection is
out of scope for `bd()` itself; it's the dispatcher's job (or a future
version-check helper) to read `bd --version` and throw that subtype. Phase 4
exercises the BeadsVersionMismatch branch via the test stub (Plan 2). The
"version-mismatch stderr" CASE in Task 4 therefore asserts that bd-helper
throws BeadsCorrupt (the correct subtype for an unrecognized stderr pattern),
NOT BeadsVersionMismatch — Task 4's CASE 2 is named for the stderr content
the shim emits, not the resulting subtype.
  </action>
  <verify>
    <automated>node -e "import('./bin/bd-helper.mjs').then(m => { try { m.bd(['nonexistent-subcommand-xyz'], { cwd: '/tmp' }); console.log('FAIL: should have thrown'); process.exit(1); } catch (e) { console.log('threw:', e.name); }})"</automated>
  </verify>
  <done>
    - File exists at `bin/bd-helper.mjs`
    - Single named export: `bd`
    - File imports `{ BeadsNotInstalled, BeadsCorrupt, BeadsEmpty }` from `./beads-errors.mjs`
    - Manual smoke check: `node -e "import('./bin/bd-helper.mjs').then(m => m.bd(['list', '--type=epic', '--json']))"` against a non-bd directory throws `BeadsCorrupt` (or `BeadsNotInstalled` if bd absent); never prints unhandled-rejection
    - Verify command above prints `threw: BeadsCorrupt` (bd is installed, returns non-zero on unknown subcommand) — note: if bd happens to print a different stderr, the threw type may be BeadsCorrupt OR BeadsNotInstalled — either is acceptable since it proves the helper doesn't return success on a bd error
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Create tests/shadow-tests/bd-helper.test.mjs (WARN-2 — 4 cases via PATH-mocked bd shim)</name>
  <files>tests/shadow-tests/bd-helper.test.mjs</files>
  <behavior>
    - CASE 1 (ENOENT — bd binary missing): set `PATH=/nonexistent` (or another path that contains no `bd` executable) for the duration of one bd() call; assert it throws `BeadsNotInstalled` and the thrown error is `instanceof BeadsUnavailableError`
    - CASE 2 (version-mismatch stderr — non-zero exit + stderr containing the word "version"): write a shell-script `bd` shim under a mkdtempSync directory that prints `bd: requires version >=1.0; got 0.9.5` to stderr and `exit 1`; prepend that dir to PATH; assert bd() throws a sentinel subtype (`instanceof BeadsUnavailableError`) — concretely `BeadsCorrupt` per the current bd-helper stderr branching (the "version-mismatch" name in this CASE refers to the stderr CONTENT, not the resulting subtype; promotion to BeadsVersionMismatch is reserved for a future version-detection helper per Task 3)
    - CASE 3 (corrupt-store stderr — non-zero exit + stderr matching `/database|dolt|metadata\.json/i`): shim prints `error: failed to open .beads/metadata.json` to stderr and exits 1; assert bd() throws `BeadsCorrupt` and `instanceof BeadsUnavailableError`
    - CASE 4 (successful invocation returns parsed JSON): shim prints `[{"id":"sd-1","status":"open"}]` to stdout and exits 0; assert bd() returns the parsed JSON (an array of length 1, with first element `{ id: 'sd-1', status: 'open' }`)
    - All cases use PATH-injection (NOT module-mocking) — the test scripts are tiny shell shims under mkdtempSync directories, prepended to PATH for the duration of one bd() call, then removed via t.after(rmSync)
  </behavior>
  <action>
Create `tests/shadow-tests/bd-helper.test.mjs` per the WARN-2 follow-up. The
goal is to give bd-helper.mjs direct unit coverage in Phase 4, so a regression
in stderr-pattern matching or in the `'error' in parsed` JSON-payload branch
surfaces here, not in a Phase 5+ read-handler test where it would look like a
mysterious handler failure.

Imports (mirror `tests/shadow-tests/handler-phase-add.test.mjs` analog —
mkdtempSync + writeFileSync + rmSync; node:test + assert/strict):
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bd } from '../../bin/bd-helper.mjs';
import { BeadsNotInstalled, BeadsCorrupt, BeadsUnavailableError } from '../../bin/beads-errors.mjs';
```

Helper for PATH-mocked bd shim:
```javascript
function withMockBd(scriptBody, cb) {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-bd-shim-'));
  const shim = join(dir, 'bd');
  writeFileSync(shim, `#!/usr/bin/env bash\n${scriptBody}\n`);
  chmodSync(shim, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${dir}:${oldPath}`;
  try {
    return cb();
  } finally {
    process.env.PATH = oldPath;
    rmSync(dir, { recursive: true, force: true });
  }
}
```

Four test cases per `<behavior>`. Use `bd-helper CASE N:` title prefix.

CASE 1 (ENOENT — bd binary missing). Use a PATH that excludes any real `bd`:
```javascript
test('bd-helper CASE 1: ENOENT — bd binary missing throws BeadsNotInstalled', () => {
  const oldPath = process.env.PATH;
  process.env.PATH = '/nonexistent-path-for-gsd-test';
  try {
    assert.throws(
      () => bd(['list', '--json']),
      (err) => {
        assert.ok(err instanceof BeadsNotInstalled, `expected BeadsNotInstalled, got ${err?.name}`);
        assert.ok(err instanceof BeadsUnavailableError, 'must extend BeadsUnavailableError');
        return true;
      }
    );
  } finally {
    process.env.PATH = oldPath;
  }
});
```

CASE 2 (version-mismatch stderr — shim prints version-related stderr, exits 1):
```javascript
test('bd-helper CASE 2: version-mismatch stderr — non-zero exit throws sentinel subtype', () => {
  withMockBd(
    'echo "bd: requires version >=1.0; got 0.9.5" >&2\nexit 1',
    () => {
      assert.throws(
        () => bd(['list', '--json']),
        (err) => {
          // bd-helper today routes ALL non-zero-exit cases through BeadsCorrupt
          // (see Task 3 "version-mismatch is out of scope for bd()"). The CASE
          // name reflects the stderr CONTENT, not the resulting subtype.
          assert.ok(err instanceof BeadsUnavailableError,
            `expected BeadsUnavailableError subtype, got ${err?.name}`);
          assert.ok(err instanceof BeadsCorrupt,
            `expected BeadsCorrupt for non-zero exit, got ${err?.name}`);
          return true;
        }
      );
    }
  );
});
```

CASE 3 (corrupt-store stderr — `metadata.json` in stderr):
```javascript
test('bd-helper CASE 3: corrupt-store stderr — metadata.json mention throws BeadsCorrupt', () => {
  withMockBd(
    'echo "error: failed to open .beads/metadata.json: bad header" >&2\nexit 1',
    () => {
      assert.throws(
        () => bd(['list', '--json']),
        (err) => {
          assert.ok(err instanceof BeadsCorrupt, `expected BeadsCorrupt, got ${err?.name}`);
          assert.ok(err instanceof BeadsUnavailableError, 'must extend BeadsUnavailableError');
          return true;
        }
      );
    }
  );
});
```

CASE 4 (successful invocation returns parsed JSON):
```javascript
test('bd-helper CASE 4: successful invocation returns parsed JSON', () => {
  withMockBd(
    'echo \'[{"id":"sd-1","status":"open"}]\'\nexit 0',
    () => {
      const result = bd(['list', '--json']);
      assert.ok(Array.isArray(result), `expected array, got ${typeof result}`);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'sd-1');
      assert.equal(result[0].status, 'open');
    }
  );
});
```

CRITICAL constraints:
- Use `chmodSync(shim, 0o755)` so PATH lookup actually executes the shim (not
  a permission-denied EACCES that would mask the test).
- DO NOT mock `child_process.spawnSync` directly — PATH injection is more
  robust (no module-cache contamination) and exercises the real spawnSync
  code path the production helper uses.
- DO NOT add a CASE for the BeadsEmpty `'error' in parsed` JSON branch in
  Phase 4 — that's covered indirectly by Phase 2's stub test and will gain
  direct coverage when the first real read handler ships in Phase 5. (If
  desired, add a CASE 5 with `echo '{"error":"no data","schema_version":1}'`
  asserting BeadsEmpty — optional, not required by WARN-2.)
- The shim is bash; on systems without bash this would fail. gsd-beads
  already requires bash (every existing test fixture uses `#!/usr/bin/env
  bash`), so this is consistent with project assumptions.

Wave assignment: this task stays in Wave 1 (parallel-safe with Tasks 1-3 in
this plan, and parallel-safe with Plans 03 and 04 in Wave 1). The new test
file shares no `files_modified` with any other Wave 1 plan.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/bd-helper.test.mjs</automated>
  </verify>
  <done>
    - File exists at `tests/shadow-tests/bd-helper.test.mjs`
    - `node --test tests/shadow-tests/bd-helper.test.mjs` reports `# pass 4 # fail 0`
    - Each test title begins with `bd-helper CASE N:` (1, 2, 3, 4)
    - Suite completes in < 5 seconds
    - No stale `/tmp/gsd-bd-shim-*` directories after run completes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `bd` subprocess → Node helper | Subprocess output is parsed and surfaced as exceptions; injection prevented by array-form spawnSync (no shell) |
| Node import boundary (cross-ESM) | `instanceof` may split if module loaded twice; mitigated by per-subtype `.name` fallback |
| Test-only PATH injection (bd-helper.test.mjs Task 4) | Each test creates a tempdir, writes a bash shim, prepends to PATH for the duration of one bd() call, restores PATH in `finally`; no leakage between tests |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | `bd-helper.mjs::bd()` argv | mitigate | spawnSync receives `args` as an array — Node spawns `bd` directly via execve, no shell interpretation; mirrors the pattern noted at RESEARCH §Security Domain "Subprocess injection via bd argv" |
| T-04-05 | Tampering | `instanceof BeadsUnavailableError` cross-ESM check | mitigate | Each subtype overrides `.name` so dispatcher can fall back to `err.name === 'BeadsUnavailableError'` if `instanceof` ever splits across module copies (Pitfall 1) |
| T-04-06 | Information Disclosure | Stack traces in thrown sentinels | accept | `Error.captureStackTrace` includes file paths from the dev's machine; gsd-beads is a CLI tool with no remote logging — stack traces stay local on the OS user's terminal |
| T-04-07 | DoS | bd subprocess hang | accept | spawnSync inherits the OS user's terminal; bd has its own timeouts; gsd-beads is one-shot per invocation, no daemon |
| T-04-21 | Tampering | PATH-injected test shim leaks into other tests | mitigate | Task 4 helper `withMockBd` saves and restores `process.env.PATH` in a `finally` block; tempdir is rmSync'd in the same finally; no global state survives the test |
</threat_model>

<verification>
After all 4 tasks complete:

```bash
node --test tests/shadow-tests/beads-errors.test.mjs
# Expected: # pass 4 # fail 0

node --test tests/shadow-tests/bd-helper.test.mjs
# Expected: # pass 4 # fail 0

ls -la bin/beads-errors.mjs bin/bd-helper.mjs
# Both files exist, non-empty

# Verify no execSync in bd-helper
grep -c "execSync" bin/bd-helper.mjs | grep -q '^0$' && echo "OK: bd-helper uses spawnSync only"

# Verify name-fallback property is set on each subtype
node -e "
import('./bin/beads-errors.mjs').then(m => {
  const expected = ['BeadsUnavailableError','BeadsNotInstalled','BeadsCorrupt','BeadsVersionMismatch','BeadsEmpty'];
  const actual = expected.map(n => new m[n]('').name);
  console.log(JSON.stringify(actual) === JSON.stringify(expected) ? 'OK' : 'FAIL: '+actual);
})
"
# Expected: OK
```
</verification>

<success_criteria>
- `bin/beads-errors.mjs` exports BeadsCause + 5 classes; `Object.isFrozen(BeadsCause)` is true
- `bin/bd-helper.mjs` exports `bd()` and uses `spawnSync` (not `execSync`) with array-form args
- `tests/shadow-tests/beads-errors.test.mjs` passes 4/4 cases via `node --test`
- `tests/shadow-tests/bd-helper.test.mjs` passes 4/4 cases via `node --test` (WARN-2 follow-up — direct unit coverage of bd-helper's throw branches in Phase 4)
- Plans 2/3/4 can `import { BeadsUnavailableError } from '../../bin/beads-errors.mjs'` after this plan lands
- No npm dependencies introduced; only Node built-in `node:child_process` is added (no other built-ins beyond what's already in the codebase)
</success_criteria>

<output>
After completion, create `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-01-SUMMARY.md` documenting:
- Files created (4) with line counts
- Test case results (4 + 4 = 8 cases passing across beads-errors.test.mjs and bd-helper.test.mjs)
- Cross-plan dependency: Plan 2 imports `BeadsUnavailableError`; Plans 5-9 import `bd` from `bd-helper.mjs`
- WARN-2 follow-up: bd-helper.mjs now has direct in-Phase-4 unit coverage via the PATH-mocked shim approach, closing the Phase 5+ regression-discovery gap the plan-checker flagged
- Any deviations from RESEARCH §Pattern 2/3 (none expected)
</output>
</content>
