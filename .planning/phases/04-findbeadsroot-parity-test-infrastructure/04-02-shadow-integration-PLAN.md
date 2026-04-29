---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 02
type: execute
wave: 2
depends_on:
  - 04-01-sentinel-hierarchy
files_modified:
  - bin/gsd-sdk-shadow.mjs
  - tests/shadow-tests/findBeadsRoot.test.mjs
  - tests/shadow-tests/handler-_phase4-test-stub.test.mjs
autonomous: true
requirements:
  - REQ-QUAL-02
  - REQ-QUAL-03
must_haves:
  truths:
    - "findBeadsRoot(start) returns the project root containing .beads/metadata.json, OR null when none is found"
    - "findBeadsRoot(start) returns dirname(BEADS_DIR) when $BEADS_DIR is set and points at a valid .beads/ (D-01)"
    - "findBeadsRoot(start) walks parents, halting at .git file/dir or filesystem root (D-02)"
    - "findBeadsRoot(start) follows symlinks via realpathSync (D-03); ENOENT returns null but ELOOP/EACCES propagate (Pitfall 4)"
    - "From a worktree, findBeadsRoot reads the .git file and returns the source repo path that owns .beads/"
    - "BEADS_READ_OVERRIDES is exported and registered in dispatch via a SECOND register loop, AFTER the existing BEADS_OVERRIDES loop, WITHOUT wrapMutation"
    - "Dispatcher try/catch falls through to spawnUpstream(argv) when err instanceof BeadsUnavailableError OR err.code === 'ENOENT' OR err.message matches known bd-CLI patterns; the catch returns immediately after spawnUpstream so the dispatch-failed branch is structurally unreachable for sentinel/bd-CLI errors (independent of spawnUpstream's process.exit side effect)"
    - "Real bugs (TypeError etc.) still hit `console.error('[gsd-sdk-shadow] dispatch failed: ...')` + process.exit(1) — v0.1 loud-fail unchanged"
    - "_phase4-test-stub handler is registered ONLY when process.env.GSD_SHADOW_TEST_STUB === '1'; happy path returns { data: { ok: true, backend: 'beads' } }"
    - "Stub configured with GSD_SHADOW_TEST_STUB_THROW=corrupt|not-installed|version-mismatch|empty|typeerror produces the named subtype (or TypeError) so end-to-end tests prove dispatch fall-through"
    - "All existing v0.1 mutation tests still pass (BEADS_OVERRIDES register loop and wrapMutation invocation unchanged)"
  artifacts:
    - path: "bin/gsd-sdk-shadow.mjs"
      provides: "Shadow with findBeadsRoot, BEADS_READ_OVERRIDES, conditional stub, second register loop, sentinel-aware dispatch try/catch, updated D-02 invariant comment"
      contains: "BEADS_READ_OVERRIDES"
    - path: "tests/shadow-tests/findBeadsRoot.test.mjs"
      provides: "5 cases (worktree, BEADS_DIR, symlink, non-bd, root-halt) using real `git worktree add` fixture"
      min_lines: 80
    - path: "tests/shadow-tests/handler-_phase4-test-stub.test.mjs"
      provides: "6 cases (happy + 4 sentinel subtypes + real-bug) proving dispatch wiring + sentinel fall-through"
      min_lines: 90
  key_links:
    - from: "bin/gsd-sdk-shadow.mjs"
      to: "bin/beads-errors.mjs"
      via: "named import { BeadsUnavailableError } at top of file"
      pattern: "from ['\"]\\./beads-errors\\.mjs['\"]"
    - from: "bin/gsd-sdk-shadow.mjs::dispatch try/catch"
      to: "spawnUpstream(argv)"
      via: "if (err instanceof BeadsUnavailableError || isKnownBdCliError(err)) { spawnUpstream(argv); return; }"
      pattern: "instanceof BeadsUnavailableError"
    - from: "tests/shadow-tests/findBeadsRoot.test.mjs"
      to: "bin/gsd-sdk-shadow.mjs"
      via: "import { findBeadsRoot } from '../../bin/gsd-sdk-shadow.mjs'"
      pattern: "import \\{ findBeadsRoot \\}"
    - from: "tests/shadow-tests/handler-_phase4-test-stub.test.mjs"
      to: "bin/gsd-sdk-shadow.mjs"
      via: "spawnSync('node', [SHADOW, ...]) with GSD_SHADOW_TEST_STUB env"
      pattern: "GSD_SHADOW_TEST_STUB"
---

<objective>
Wire the read-side dispatch path. Add a worktree-aware project-root finder
(`findBeadsRoot`), declare and register the `BEADS_READ_OVERRIDES` table
without `wrapMutation`, plug in a conditional `_phase4-test-stub` handler,
and extend the dispatcher's try/catch to fall through to upstream when a
`BeadsUnavailableError` or known bd-CLI error fires.

Purpose: REQ-QUAL-02 (read-shaped fall-through) and REQ-QUAL-03 (worktree-
aware findBeadsRoot for reads). Phase 5-9 read handlers will all register
into `BEADS_READ_OVERRIDES` and rely on the fall-through contract proved here.
The stub handler exists purely to prove the wiring end-to-end before any real
read handler ships.

Output:
- `bin/gsd-sdk-shadow.mjs` — extended (NOT rewritten) per PATTERNS.md
- `tests/shadow-tests/findBeadsRoot.test.mjs` — REQ-QUAL-03 (5 cases)
- `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` — REQ-QUAL-02 (6 cases)
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

@bin/gsd-sdk-shadow.mjs
@bin/wrap-mutation.mjs
@bin/beads-errors.mjs
@hooks/worktree-post-checkout.sh
@tests/shadow-tests/argv-routing.test.mjs
@tests/shadow-tests/handler-phase-add.test.mjs
@tests/cross-worktree/lib/setup.sh

<interfaces>
<!-- Existing contracts the executor needs. -->

bin/gsd-sdk-shadow.mjs (current — exports BEADS_OVERRIDES; this plan ADDS findBeadsRoot, BEADS_READ_OVERRIDES; modifies main()):
```javascript
// At top (lines 7-11) — current imports:
import { spawnSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapMutation } from './wrap-mutation.mjs';

// Existing exports/structure:
export const BEADS_OVERRIDES = { /* 13 mutation handlers */ };

// Inside main() — current dispatch (lines 274-279):
const registry = queryModule.createRegistry(eventStream, sessionId);
for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, wrapMutation(handler, cmd, eventStream, sessionId));
}

// Existing try/catch (lines 303-312):
try {
  const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
  console.log(pickField !== undefined ? registryModule.extractField(result.data, pickField) : JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error(`[gsd-sdk-shadow] dispatch failed: ${err.message}`);
  process.exit(1);
}
```

bin/beads-errors.mjs (CREATED in Plan 04-01):
```javascript
export const BeadsCause: Readonly<{ ... }>;
export class BeadsUnavailableError extends Error { ... }
export class BeadsNotInstalled extends BeadsUnavailableError { ... }
export class BeadsCorrupt extends BeadsUnavailableError { ... }
export class BeadsVersionMismatch extends BeadsUnavailableError { ... }
export class BeadsEmpty extends BeadsUnavailableError { ... }
```

NEW exports this plan adds to bin/gsd-sdk-shadow.mjs:
```javascript
export function findBeadsRoot(start: string): string | null;
export const BEADS_READ_OVERRIDES: Record<string, (args: string[], projectDir: string) => Promise<{data: unknown}>>;
```

Test analog patterns (PATTERNS.md):
- `tests/shadow-tests/argv-routing.test.mjs:13-29` (helper pattern — beadsFixture)
- `tests/cross-worktree/lib/setup.sh:29-50` (mk_source_repo for real `git worktree add`)
- `tests/shadow-tests/handler-phase-add.test.mjs` (per-handler test layout — setupFixture/runShadow)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend bin/gsd-sdk-shadow.mjs with findBeadsRoot, BEADS_READ_OVERRIDES, conditional stub, sentinel-aware dispatch</name>
  <files>bin/gsd-sdk-shadow.mjs</files>
  <behavior>
    - `findBeadsRoot(start)` is exported and is a pure function that:
      • Honors `process.env.BEADS_DIR` first; if set and `metadata.json` exists at that path, returns `dirname(realpath(envDir))`
      • Otherwise resolves `start` via `realpathSync` (catches ENOENT, returns null; lets ELOOP/EACCES propagate)
      • Walks parents; at each level, returns `dir` if `<dir>/.beads/metadata.json` exists
      • If a `.git` marker exists at `<dir>` and is a regular FILE (worktree), reads it, parses `gitdir: <path>`, walks up 3 dirnames to source root, returns source root if `<sourceRoot>/.beads/metadata.json` exists; otherwise returns null
      • If a `.git` marker is a DIRECTORY (non-worktree), returns null at that level (we've reached git root with no .beads/ above)
      • Halts at filesystem root (when `dirname(dir) === dir`) returning null
    - `BEADS_READ_OVERRIDES = {}` is declared as a module-level `export const` AFTER the existing `BEADS_OVERRIDES` block (line 219) with a comment header following the same banner style
    - When `process.env.GSD_SHADOW_TEST_STUB === '1'`, the stub `_phase4-test-stub` is registered into `BEADS_READ_OVERRIDES`. The stub:
      • Reads `process.env.GSD_SHADOW_TEST_STUB_THROW`. Values 'not-installed', 'corrupt', 'version-mismatch', 'empty' throw the matching sentinel subtype (each imported lazily via dynamic `import('./beads-errors.mjs')` inside the stub or imported eagerly at top of file — eager is simpler).
      • Value 'typeerror' throws `new TypeError('test-stub: real bug')` to exercise the loud-fail path
      • Otherwise returns `{ data: { ok: true, backend: 'beads' } }`
    - In `main()`, after the existing `BEADS_OVERRIDES` register loop (lines 277-279), a SECOND loop registers BEADS_READ_OVERRIDES entries WITHOUT `wrapMutation`: `for (const [cmd, h] of Object.entries(BEADS_READ_OVERRIDES)) registry.register(cmd, h);`
    - The try/catch at lines 303-312 is replaced so that the catch first checks `if (err instanceof BeadsUnavailableError || isKnownBdCliError(err)) { spawnUpstream(argv); return; }` — only falls through when the sentinel matches; the explicit `return;` after `spawnUpstream(argv)` ensures the dispatch-failed branch is structurally unreachable for sentinel/bd-CLI errors regardless of spawnUpstream's process.exit side effect (BLOCKER-1 fix). Otherwise prints `[gsd-sdk-shadow] dispatch failed: ${err.message}` and exits 1 (v0.1 behavior preserved)
    - Header comment at line 4 is updated to "D-02 invariant: 13 mutation entries (BEADS_OVERRIDES) live here. Reads (BEADS_READ_OVERRIDES) register separately; empty in Phase 4 (test stub registers only when GSD_SHADOW_TEST_STUB=1)."
  </behavior>
  <action>
Edit `bin/gsd-sdk-shadow.mjs` in place — DO NOT rewrite. Apply six surgical
changes per PATTERNS.md "bin/gsd-sdk-shadow.mjs (modified)" section.

(a) Update imports near lines 7-11. Current `node:fs` line is
`import { existsSync } from 'node:fs';` and `node:path` line is
`import { resolve } from 'node:path';`. Extend both:
```javascript
import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
```
Also add: `import { BeadsUnavailableError, BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty } from './beads-errors.mjs';`

(b) Update the header comment at line 4. Replace the existing line:
`// D-02 invariant: all 13 BEADS_OVERRIDES handlers live in this single file.`
with two lines:
```
// D-02 invariant: 13 mutation entries (BEADS_OVERRIDES) live here.
//                 Reads (BEADS_READ_OVERRIDES) register separately; empty in Phase 4
//                 (test stub registers only when GSD_SHADOW_TEST_STUB=1).
```

(c) Add `findBeadsRoot` near line 232 (just before or just after the existing
`isBeadsManaged` declaration in main(), but as a MODULE-level function so it's
exportable and importable by tests). Place it OUTSIDE main() — between the
BEADS_OVERRIDES export block and the `isMain` guard at line 223 is the
cleanest spot. Body verbatim from RESEARCH §Pattern 1 (lines 246-309) including
the worktree `.git` file handling. Export it: `export function findBeadsRoot(start) { ... }`.

The verbatim body to use, with the worktree handling inlined:
```javascript
// findBeadsRoot — read-side project-root discovery (D-01..D-04, REQ-QUAL-03).
// Symmetric with hooks fix b51abbc. Returns null on no-bd (NOT throws — D-13).
export function findBeadsRoot(start) {
  const envDir = process.env.BEADS_DIR;
  if (envDir) {
    let resolved;
    try { resolved = realpathSync(resolve(envDir)); } catch { resolved = null; }
    if (resolved && existsSync(join(resolved, 'metadata.json'))) {
      return dirname(resolved);
    }
  }
  let dir;
  try { dir = realpathSync(resolve(start)); } catch { return null; }
  while (true) {
    if (existsSync(join(dir, '.beads', 'metadata.json'))) return dir;
    const gitMarker = join(dir, '.git');
    if (existsSync(gitMarker)) {
      const stat = statSync(gitMarker);
      if (stat.isFile()) {
        const content = readFileSync(gitMarker, 'utf-8').trim();
        const m = content.match(/^gitdir:\s*(.+)$/m);
        if (m) {
          const sourceGitDir = m[1].trim();
          const sourceRoot = dirname(dirname(dirname(sourceGitDir)));
          if (existsSync(join(sourceRoot, '.beads', 'metadata.json'))) {
            return sourceRoot;
          }
        }
      }
      return null;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
```

DO NOT remove `isBeadsManaged()` from inside `main()` (D-04: it stays unchanged
for mutations).

(d) Add `BEADS_READ_OVERRIDES` and conditional stub AFTER the existing
`BEADS_OVERRIDES = { ... }` block (after line 219). Use the same banner-comment
style as `BEADS_OVERRIDES`:
```javascript
// ─── BEADS_READ_OVERRIDES table ────────────────────────────────────────────
// Phase 4: empty by default. Test stub registers ONLY when GSD_SHADOW_TEST_STUB=1.
// Phases 5–9 add real read handlers. Registered WITHOUT wrapMutation —
// reads do NOT emit GSDEvent.StateMutation (D-09 forward-compat).
export const BEADS_READ_OVERRIDES = {};

// _phase4-test-stub: lifecycle-bound to Phase 4. Phase 5 deletes this block + the stub registration.
if (process.env.GSD_SHADOW_TEST_STUB === '1') {
  BEADS_READ_OVERRIDES['_phase4-test-stub'] = async function phase4TestStub(args, projectDir) {
    const throwMode = process.env.GSD_SHADOW_TEST_STUB_THROW;
    if (throwMode === 'not-installed')   throw new BeadsNotInstalled('test-stub: simulated bd missing');
    if (throwMode === 'corrupt')         throw new BeadsCorrupt('test-stub: simulated metadata.json corruption');
    if (throwMode === 'version-mismatch') throw new BeadsVersionMismatch('test-stub: simulated bd version out of range');
    if (throwMode === 'empty')           throw new BeadsEmpty('test-stub: simulated empty .beads/');
    if (throwMode === 'typeerror')       throw new TypeError('test-stub: real bug');
    return { data: { ok: true, backend: 'beads' } };
  };
}
```

(e) After the existing register loop at lines 277-279, add a second loop:
```javascript
// Register read overrides WITHOUT wrapMutation (D-09: reads don't emit StateMutation events).
for (const [cmd, handler] of Object.entries(BEADS_READ_OVERRIDES)) {
  registry.register(cmd, handler);
}
```

(f) Replace the try/catch at lines 303-312 with the sentinel-aware variant.
Add the helper `isKnownBdCliError` as a top-level function (alongside
`findBeadsRoot`). Verbatim per RESEARCH §Pattern 2 lines 376-402 + PATTERNS.md
"(e) Extend try/catch":
```javascript
function isKnownBdCliError(err) {
  if (err && err.code === 'ENOENT') return true;
  return /command not found|bd: not found|ENOENT/i.test(err?.message ?? '');
}
```
And inside main(), replace the existing try/catch:
```javascript
try {
  const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
  console.log(pickField !== undefined
    ? registryModule.extractField(result.data, pickField)
    : JSON.stringify(result));
  process.exit(0);
} catch (err) {
  if (err instanceof BeadsUnavailableError || isKnownBdCliError(err)) {
    log(`read fall-through (${err?.name ?? 'bd CLI error'}): ${err?.message}`);
    spawnUpstream(argv);
    return;  // BLOCKER-1: explicit return so dispatch-failed branch is structurally
             // unreachable for sentinel/bd-CLI errors, independent of spawnUpstream's
             // process.exit side effect. Without this, a future refactor that makes
             // spawnUpstream return (e.g., Promise-based, or test-harness mock of
             // process.exit) would silently double-emit and defeat the contract.
  }
  console.error(`[gsd-sdk-shadow] dispatch failed: ${err.message}`);
  process.exit(1);
}
```

CRITICAL (BLOCKER-1 fix): The `return;` after `spawnUpstream(argv)` is
load-bearing. spawnUpstream today calls `process.exit(result.status ?? 1)`,
which means the function never returns — but the catch block must be
structurally correct independent of that side effect. Without the explicit
`return`, every caught error path would run through the dispatch-failed
console.error + process.exit(1) line, which:
  1. Causes Plan 02 Task 3 CASE 6 to pass for the wrong reason (every error
     path emits the dispatch-failed marker), and
  2. Silently regresses Pitfall 1 (instanceof split across ESM module copies)
     because the difference between sentinel and real-bug paths is no longer
     observable.

DO NOT touch the existing 13 mutation handlers, the `BEADS_OVERRIDES` table
contents, the `wrapMutation` register loop, or any of the other dispatch
plumbing (resolveQueryArgv, --pick handling, getProjectDir, isBeadsManaged).
The integrity of v0.1 mutation tests depends on those being byte-identical.

CRITICAL: do not name-clash. The existing `isBeadsManaged` lives inside `main()`
as a nested function. `findBeadsRoot` is a module-level export and must NOT be
nested inside `main()` — tests import it from the module's top-level scope.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/argv-routing.test.mjs tests/shadow-tests/handler-phase-add.test.mjs tests/shadow-tests/wrap-mutation.test.mjs</automated>
  </verify>
  <done>
    - `bin/gsd-sdk-shadow.mjs` exports `findBeadsRoot` and `BEADS_READ_OVERRIDES`
    - All v0.1 mutation tests still green (argv-routing, wrap-mutation, all 13 handler-* test files)
    - `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m => console.log(typeof m.findBeadsRoot, typeof m.BEADS_READ_OVERRIDES))"` prints `function object`
    - `grep -c 'BEADS_READ_OVERRIDES' bin/gsd-sdk-shadow.mjs` reports at least 4 (declaration + conditional stub set + register loop)
    - Without `GSD_SHADOW_TEST_STUB=1`, `BEADS_READ_OVERRIDES` remains empty (no `_phase4-test-stub` registered)
    - The catch block in main()'s try/catch contains an explicit `return;` after `spawnUpstream(argv)` (BLOCKER-1 fix). Verify via: `grep -A2 'spawnUpstream(argv);' bin/gsd-sdk-shadow.mjs | grep -q 'return;' && echo OK` returns OK.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create tests/shadow-tests/findBeadsRoot.test.mjs (5 cases — worktree, BEADS_DIR, symlink, non-bd, root-halt)</name>
  <files>tests/shadow-tests/findBeadsRoot.test.mjs</files>
  <behavior>
    - CASE 1: From a worktree directory created via real `git worktree add`, findBeadsRoot returns the source repo path that owns .beads/
    - CASE 2: When BEADS_DIR points at a different .beads/ than the parent walk would find, findBeadsRoot honors BEADS_DIR (resolves to dirname of BEADS_DIR target)
    - CASE 3: A symlinked .beads/ at <project>/.beads → /elsewhere/.beads is followed via realpathSync; findBeadsRoot returns either the symlink-side directory OR the realpath target (assertion accepts either — research §Pattern 5 line 595 documents this latitude)
    - CASE 4: A directory under git but with no .beads/ anywhere returns null
    - CASE 5: A bare directory NOT under git, NOT a real .beads/ dir, returns null without climbing past the filesystem root
  </behavior>
  <action>
Create `tests/shadow-tests/findBeadsRoot.test.mjs`. Translate the worktree
fixture pattern from `tests/cross-worktree/lib/setup.sh:29-50` to Node per
RESEARCH §Pattern 5 (lines 542-557) and PATTERNS.md "tests/shadow-tests/
findBeadsRoot.test.mjs" section.

Imports (verbatim from PATTERNS.md "Imports pattern"):
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBeadsRoot } from '../../bin/gsd-sdk-shadow.mjs';
```

Define the helper `worktreeBeadsFixture()` verbatim from RESEARCH §Pattern 5
lines 542-557 — co-locate `src` and `wt` under one tempdir (per PATTERNS.md
"co-locate src+wt under one tempdir; single rm -rf cleans both").

Five test cases per `<behavior>`. Use `t.after(() => rmSync(root, { recursive: true, force: true }))`
for teardown of the worktree fixture (multi-resource — PATTERNS.md
"Mkdtemp + try/finally rmSync teardown" recommends t.after for multi-resource).
Use `try/finally rmSync` for the simpler bare-directory cases (4 and 5).

CASE 1 (worktree resolves to source):
```javascript
test('findBeadsRoot CASE 1: worktree resolves to source repo', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(findBeadsRoot(wt), src);
});
```

CASE 2 (BEADS_DIR env wins): use the body from RESEARCH §Pattern 5 lines 566-582,
which sets `process.env.BEADS_DIR` and a finally block to restore it.

CASE 3 (symlinked .beads/): use the body from RESEARCH §Pattern 5 lines 584-597.
Note the "either symlink-side or realpath-target" assertion — both are valid
based on which side of the symlink findBeadsRoot encounters first; the test
accepts both.

CASE 4 (non-bd project returns null): use the body from RESEARCH §Pattern 5
lines 599-604.

CASE 5 (halts at filesystem root): create an isolated bare tempdir via
mkdtempSync, do NOT init git or bd; assert `findBeadsRoot(dir)` returns
`null` and does NOT throw or hang.

Use the `CASE N:` title prefix per PATTERNS.md "CASE numbering convention".

DO NOT add an extra case for ELOOP/EACCES propagation — that's the test
suite's failure mode if those errors leak; covered indirectly by case 5.

Setup time per worktree fixture is ~1s (PATTERNS.md confirmed empirically);
the 5-case suite should run in ~3-5s total.
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/findBeadsRoot.test.mjs</automated>
  </verify>
  <done>
    - File exists at `tests/shadow-tests/findBeadsRoot.test.mjs`
    - `node --test tests/shadow-tests/findBeadsRoot.test.mjs` reports `# pass 5 # fail 0`
    - Suite completes in < 10 seconds
    - No stale `/tmp/gsd-wt-test-*` directories after run completes
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create tests/shadow-tests/handler-_phase4-test-stub.test.mjs (6 cases — happy + 4 sentinels + real-bug)</name>
  <files>tests/shadow-tests/handler-_phase4-test-stub.test.mjs</files>
  <behavior>
    - CASE 1: With GSD_SHADOW_TEST_STUB=1, calling `node bin/gsd-sdk-shadow.mjs query _phase4-test-stub --project-dir <bd-fixture>` exits 0 and prints JSON `{ "data": { "ok": true, "backend": "beads" } }`
    - CASE 2: With GSD_SHADOW_TEST_STUB=1 + GSD_SHADOW_TEST_STUB_THROW=not-installed, the dispatcher does NOT print `[gsd-sdk-shadow] dispatch failed` (proves fall-through to upstream succeeded). Acceptable outcome: any non-error exit (status 0 or whatever upstream returns), and stderr does not contain that error string. Upstream may also exit non-zero with its own error message — that's acceptable as long as it's NOT the shadow's dispatch-failed line.
    - CASE 3: Same shape as CASE 2 with THROW=corrupt
    - CASE 4: Same shape with THROW=version-mismatch
    - CASE 5: Same shape with THROW=empty
    - CASE 6: With GSD_SHADOW_TEST_STUB=1 + GSD_SHADOW_TEST_STUB_THROW=typeerror, the dispatcher BOTH (a) exits non-zero AND (b) stderr matches `/\[gsd-sdk-shadow\] dispatch failed/` — proves real bugs still loud-fail. The `&&` of these two assertions is load-bearing per BLOCKER-1: today every error path emits the dispatch-failed marker (because spawnUpstream's process.exit short-circuits the catch flow), so a regression that broke the BLOCKER-1 `return;` would still pass a check on either condition alone. Asserting BOTH ensures the test catches structural regressions, not just side-effect ordering.
  </behavior>
  <action>
Create `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` mirroring
`tests/shadow-tests/handler-phase-add.test.mjs` exactly per PATTERNS.md
"tests/shadow-tests/handler-_phase4-test-stub.test.mjs" section.

Imports verbatim from `handler-phase-add.test.mjs:1-9` (which PATTERNS.md
shows is the exact analog):
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');
```

Setup helper. PATTERNS.md notes the `env` parameter extension is required so
the stub env vars can be forwarded:
```javascript
function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-stub-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

function runShadow(args, dir, env = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    cwd: dir,
    env: { ...process.env, ...env },
  });
}
```

Six test cases per `<behavior>`. Each uses try/finally rmSync (single-tempdir,
not multi-resource — per PATTERNS.md "Mkdtemp + try/finally rmSync teardown").

CASE 1 (happy path) — verbatim from PATTERNS.md lines 466-482:
```javascript
test('_phase4-test-stub CASE 1: happy path — dispatch reaches read handler', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1' }
    );
    assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.data.ok, true);
    assert.equal(parsed.data.backend, 'beads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

CASES 2-5 (sentinel subtypes — fall-through to upstream): each asserts that
`result.stderr` does NOT match `/\[gsd-sdk-shadow\] dispatch failed/`. Upstream
may print its own "unknown command _phase4-test-stub" or similar — that is
fine; the assertion is only on the absence of the SHADOW's dispatch-failed
line. Status code is NOT asserted to be 0 (upstream's response is what
ultimately surfaces; could be 0 or non-zero depending on upstream's handling
of the unknown command).

Example for CASE 2:
```javascript
test('_phase4-test-stub CASE 2: BeadsNotInstalled — dispatcher falls through', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'not-installed' }
    );
    assert.doesNotMatch(result.stderr,
      /\[gsd-sdk-shadow\] dispatch failed/,
      `expected fall-through, got dispatch-failed: ${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

Repeat the same pattern for CASES 3 (corrupt), 4 (version-mismatch), 5 (empty).

CASE 6 — BLOCKER-1 strengthened: assert BOTH (a) non-zero exit AND (b)
dispatch-failed marker in stderr. Both conditions must be checked together so
a regression in the BLOCKER-1 `return;` (which would cause sentinel paths to
also reach the dispatch-failed line) is caught — not just an exit-code
regression.

```javascript
test('_phase4-test-stub CASE 6: real TypeError — exits non-zero AND emits dispatch-failed', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'typeerror' }
    );
    // BLOCKER-1: assert BOTH conditions. If either fails, the test fails;
    // we explicitly do NOT use a single `||` assertion that would mask the
    // case where only one half holds. The combined check ensures the dispatch
    // contract is exercised — sentinel paths must NOT emit dispatch-failed
    // (CASES 2-5) AND real bugs MUST emit it AND exit non-zero (this case).
    assert.notEqual(result.status, 0,
      `real bug must exit non-zero, got status=${result.status}, stderr=${result.stderr}`);
    assert.match(result.stderr, /\[gsd-sdk-shadow\] dispatch failed/,
      `real bug must emit dispatch-failed marker; stderr=${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

Use `_phase4-test-stub CASE N:` title prefix per PATTERNS.md "CASE numbering
convention" handler-name flavor.

Important: the stub is registered via `BEADS_READ_OVERRIDES['_phase4-test-stub']`,
and `resolveQueryArgv` resolves the literal command token. Verify that the
shadow can resolve `_phase4-test-stub` as a single argv token (it should — it's
a single hyphen-separated identifier; upstream's resolveQueryArgv treats it as
one command).
  </action>
  <verify>
    <automated>node --test tests/shadow-tests/handler-_phase4-test-stub.test.mjs</automated>
  </verify>
  <done>
    - File exists at `tests/shadow-tests/handler-_phase4-test-stub.test.mjs`
    - `node --test tests/shadow-tests/handler-_phase4-test-stub.test.mjs` reports `# pass 6 # fail 0`
    - All 4 sentinel-subtype cases prove fall-through (no `[gsd-sdk-shadow] dispatch failed` in stderr)
    - CASE 6 (TypeError) asserts BOTH non-zero exit AND dispatch-failed marker present (BLOCKER-1 strengthened assertion)
    - Suite completes in < 10 seconds
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Shadow process → upstream gsd-sdk via spawnUpstream(argv) | Argv passed through unchanged; upstream is trusted (Volta-installed) |
| Shadow process → bd subprocess (via Phase 5+ handlers) | spawnSync with array args (Plan 1's bd-helper); no shell |
| `.git` file content (worktree marker) → findBeadsRoot path resolution | Trusted (git-controlled); content is parsed but only used to look up `<sourceRoot>/.beads/metadata.json`, which must independently exist for the result to be returned |
| `BEADS_DIR` env → findBeadsRoot priority resolution | OS-user-controlled env var; validated via `realpathSync` + `existsSync(metadata.json)` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | findBeadsRoot parent-walk path traversal via `BEADS_DIR=/etc/passwd/..` | mitigate | `realpathSync` canonicalizes; `existsSync(metadata.json)` requires a real `.beads/` dir; non-bd paths fall through to upstream silently per RESEARCH §Security Domain |
| T-04-02 | Tampering | Malicious `.git` file (`gitdir: /etc/passwd`) hijacking project root | mitigate | The `gitdir:` path is read but only used to look for `<sourceRoot>/.beads/metadata.json`; that file must exist as bd metadata for the result to be returned |
| T-04-03 | DoS | Symlink loop in `findBeadsRoot` | mitigate | `realpathSync` has built-in cycle detection; throws ELOOP — let it propagate (Pitfall 4); only ENOENT is silently swallowed to null |
| T-04-04 | Information Disclosure | Stack trace leakage via dispatch-failed error message | accept | gsd-beads is a CLI tool with no remote logging; stack traces stay on the OS user's terminal; same posture as v0.1 |
| T-04-08 | Tampering | Stub handler activated in production | mitigate | Stub is registered ONLY when `process.env.GSD_SHADOW_TEST_STUB === '1'`; default-off; Phase 5's first task deletes the stub block entirely, removing the env-var attack surface; documented in code comment |
| T-04-09 | Tampering | Subprocess injection via worktree fixture's git/bd invocations | mitigate | All test fixture spawns use array-form `execSync` arguments where dynamic input is involved (cwd is mkdtempSync output — cryptographically random suffix), or pass strings via shell with literal flags only |
</threat_model>

<verification>
After all 3 tasks complete:

```bash
# Run all Phase 4 Plan 02 tests
node --test tests/shadow-tests/findBeadsRoot.test.mjs tests/shadow-tests/handler-_phase4-test-stub.test.mjs
# Expected: # pass 11 # fail 0

# Verify v0.1 mutation tests still green (no regression)
tests/run-quick.sh
# Expected: all green

# Verify exports
node -e "
import('./bin/gsd-sdk-shadow.mjs').then(m => {
  console.log('findBeadsRoot:', typeof m.findBeadsRoot);
  console.log('BEADS_OVERRIDES count:', Object.keys(m.BEADS_OVERRIDES).length);
  console.log('BEADS_READ_OVERRIDES count:', Object.keys(m.BEADS_READ_OVERRIDES).length);
})
"
# Expected:
#   findBeadsRoot: function
#   BEADS_OVERRIDES count: 13
#   BEADS_READ_OVERRIDES count: 0

# Verify D-02 invariant comment updated
grep -A1 'D-02 invariant' bin/gsd-sdk-shadow.mjs | head -3
# Expected: contains "BEADS_READ_OVERRIDES"

# BLOCKER-1: verify explicit return after spawnUpstream(argv) in catch block
grep -A2 'spawnUpstream(argv);' bin/gsd-sdk-shadow.mjs | grep -q 'return;' && echo "OK: BLOCKER-1 fix present"
# Expected: OK: BLOCKER-1 fix present
```
</verification>

<success_criteria>
- `bin/gsd-sdk-shadow.mjs` exports `findBeadsRoot` (function) and `BEADS_READ_OVERRIDES` (object with 0 entries by default)
- `bin/gsd-sdk-shadow.mjs` imports `BeadsUnavailableError` (and 4 subtypes) from `./beads-errors.mjs`
- All 13 v0.1 mutation tests still green (no regression in argv-routing.test.mjs, wrap-mutation.test.mjs, handler-* test files)
- `tests/shadow-tests/findBeadsRoot.test.mjs` passes 5/5 cases
- `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` passes 6/6 cases (CASE 6 asserts BOTH non-zero exit AND dispatch-failed marker per BLOCKER-1)
- Catch block in main()'s try/catch contains explicit `return;` after `spawnUpstream(argv)` (BLOCKER-1 structural fix)
- D-02 invariant header comment reflects "13 mutation entries; reads register separately"
- Total Phase 4 Plan 02 + v0.1 regression test suite completes in < 30 seconds
</success_criteria>

<output>
After completion, create `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-02-SUMMARY.md` documenting:
- Files modified (1) + created (2)
- Test case results (5 + 6 = 11 new cases passing, plus all v0.1 regression tests still green)
- Key contract: any read handler in BEADS_READ_OVERRIDES that throws `BeadsUnavailableError` (or any subtype) will trigger spawnUpstream(argv) instead of process.exit(1); the explicit `return;` after spawnUpstream is the structural guarantee (BLOCKER-1 fix)
- Cross-plan dependency: Plan 3 imports nothing from this plan; Plan 4 imports nothing from this plan; Phases 5-9 use both findBeadsRoot and BEADS_READ_OVERRIDES
- Any deviations from RESEARCH §Pattern 1, 2 (none expected)
</output>
</content>
