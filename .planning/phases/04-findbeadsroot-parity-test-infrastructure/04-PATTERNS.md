# Phase 4: findBeadsRoot() + parity test infrastructure - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 17 new + 1 modified
**Analogs found:** 17 / 18 (no close analog for `update-snapshots.mjs`; 1 line lockfile is trivial)

## Scope

Phase 4 ships **plumbing only**. The pattern map below classifies each new file
by role + data flow, points at the closest existing file in this codebase, and
extracts the concrete imports / fixture idiom / teardown idiom / error idiom
that the planner should copy. Where verbatim copy is appropriate, the snippet
is reproduced; where adaptation is needed, the deltas are called out.

A few global notes that apply to every Phase 4 plan:

- **All new ESM modules in `bin/`** must use `import`/`export` syntax and
  Node-built-in modules only (no npm deps). The repo has no `package.json`
  today and the install.sh pre-flight only checks system tools.
- **Tests in `tests/shadow-tests/`** use `node --test` (Node 22+). Existing
  fixtures are `mkdtempSync(join(tmpdir(), 'gsd-…-test-')) + try/finally rmSync`
  — keep this idiom even when adding `t.after()` (research recommends `t.after`
  for the worktree fixture, but the existing `try/finally` is also acceptable).
- **Shell tests in `tests/shadow-tests/*.test.sh`, `tests/install-tests/*.test.sh`**
  use `pass=0/fail=0` accumulators with `_pass`/`_fail` helpers and
  `[ "$fail" -eq 0 ]` as the final exit. Mirror that exactly.
- **All bash scripts** that mutate planning state lock on
  `<source>/.beads/.gsd-beads.lock` via the `--- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---`
  block from `scripts/regen-roadmap.sh:16-39`. `regen-state.sh` MUST include
  this preamble verbatim; the seeder fixture does NOT touch any source-repo
  state and should NOT lock.
- **All `bin/` ESM files use the same `SDK_BASE` discovery convention** — see
  `bin/wrap-mutation.mjs:7-9`. New `bin/` modules that need upstream paths
  copy this verbatim.

---

## File Classification

### New files in `bin/` (production runtime)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `bin/beads-errors.mjs` | utility (sentinel error classes) | request-response (throw/catch) | `bin/wrap-mutation.mjs` (sibling ESM module pattern) + research §Pattern 2 | role-match — wrap-mutation gives module skeleton; the class hierarchy itself has no in-repo analog |
| `bin/bd-helper.mjs` | service (subprocess wrapper) | request-response | `bin/gsd-sdk-shadow.mjs:27-35` (existing `execSync('bd …')` pattern in mutation handlers) — **adapt to spawnSync** per Pitfall 2 | role-match (analog uses execSync; helper MUST switch to spawnSync) |

### New files in `scripts/` (build/cascade)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `scripts/regen-state.sh` | build script (markdown regen) | file-I/O + subprocess | `scripts/regen-roadmap.sh` | exact (same role, same atomic-write idiom, same lock preamble required) |

### New files in `tests/shadow-tests/` (Node tests)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/shadow-tests/_parity-helpers.mjs` | utility module (assertions) | pure function (transform) | NEW pattern — research §Pattern 4 supplies canonical body; module-style mirrors `bin/wrap-mutation.mjs` exports | hand-rolled (no in-repo analog; underscore prefix is the new convention) |
| `tests/shadow-tests/_parity-helpers.test.mjs` | test (unit, pure JS) | request-response | `tests/shadow-tests/wrap-mutation.test.mjs` | exact (no fixture; pure function tests; same `node:test`/`assert/strict` skeleton) |
| `tests/shadow-tests/findBeadsRoot.test.mjs` | test (integration, real worktree) | event-driven (subprocess + fs) | `tests/shadow-tests/argv-routing.test.mjs` (helper pattern) + `tests/cross-worktree/lib/setup.sh` (real `git worktree add`) | role-match (combine the two) |
| `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` | test (integration, shadow CLI) | request-response | `tests/shadow-tests/handler-phase-add.test.mjs` | exact (per-handler test layout; setup-fixture + runShadow + try/finally) |
| `tests/shadow-tests/beads-errors.test.mjs` | test (unit) | pure function | `tests/shadow-tests/wrap-mutation.test.mjs` | exact (no fixture) |
| `tests/shadow-tests/milestone-scoping.test.mjs` | test (integration, multi-worktree) | event-driven (multi-fs + subprocess) | `tests/cross-worktree/simulation.sh` (multi-worktree topology) + `tests/shadow-tests/argv-routing.test.mjs` (Node test runner) | role-match (combine: simulation.sh-style topology, executed from `node:test`) |
| `tests/shadow-tests/seed-determinism.test.sh` | test (bash, integration) | file-I/O + subprocess | `tests/hook-tests/regen-roadmap.test.sh` CASE 1 (byte-stable run-twice-and-diff pattern) | exact (research §Pattern 6 verification example mirrors this) |
| `tests/shadow-tests/bd-allowlist-grep.test.sh` | test (bash, static analysis grep) | transform (grep) | `tests/install-tests/no-gsd-core-mutation.test.sh` CASE 1 (static grep guard) | exact (same `grep -qE` against repo files; same pass/fail accumulator) |
| `tests/shadow-tests/snapshots/_phase4-test-stub.json` | test fixture (static JSON) | data | NEW directory; format defined by §Pattern 4 in research | hand-rolled (~10 lines literal JSON; no analog) |

### New files in `tests/install-tests/` (bash tests)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/install-tests/upstream-version-pin.test.sh` | test (bash, version-check) | subprocess + file-I/O | `tests/install-tests/path-precedence.test.sh` (sandbox-HOME + run install.sh + grep stdout) — **adapt** for version compare | role-match (replace path-precedence's "shadow active" grep with a `gsd-sdk --version`/file-content match) |

### New files in `tests/fixtures/` (seeder + canonical state)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/fixtures/seed-fixture.sh` | fixture script (restorer) | file-I/O + subprocess | `tests/fixtures/bd-helpers/3-level-hierarchy.sh` (existing fixture builder) | role-match (analog uses `bd q` for live build; seed-fixture must use `bd init --from-jsonl` per D-07) |
| `tests/fixtures/build-seed.sh` | fixture script (source for seed.jsonl) | file-I/O + subprocess | `tests/fixtures/bd-helpers/3-level-hierarchy.sh` | exact (build-seed.sh is essentially a 3-level-hierarchy.sh writ large for v0.1/v0.2/v0.3 milestones; ends with `bd export --json -o tests/fixtures/seed.jsonl`) |
| `tests/fixtures/seed.jsonl` | data (committed canonical bd state) | data | NEW — generated artifact | hand-rolled (output of build-seed.sh; checked in) |

### New files in `tests/scripts/` (snapshot regeneration)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/scripts/update-snapshots.mjs` | utility script (regen snapshots) | subprocess + file-I/O | `bin/gsd-sdk-shadow.mjs:248-252` (`spawnUpstream` pattern) + research §Pattern 4 (snapshot writer) | partial — hand-roll using `spawnSync` against `UPSTREAM_BIN`; lockfile pre-check pattern follows `install.sh:14-21` |

### New files at repo root

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `gsd-sdk-cc.version.lock` | config (1 line plain text) | data | None — first lockfile in this repo. 1 line: `1.38.5\n`. | trivial (no analog needed) |

### Modified file

| Modified File | Role | Change | Reference |
|---------------|------|--------|-----------|
| `bin/gsd-sdk-shadow.mjs` | dispatcher (extend, do not rewrite) | (a) new `findBeadsRoot()` function near line 232; (b) new `BEADS_READ_OVERRIDES = {}` exported table after line 219; (c) optional `_phase4-test-stub` registered conditionally on `process.env.GSD_SHADOW_TEST_STUB`; (d) second `register()` loop after line 279 without `wrapMutation`; (e) extended try/catch at lines 303-312 to catch `BeadsUnavailableError` and `isKnownBdCliError`; (f) update header comment at line 4 (D-02 invariant text) | self-analog (the file IS the existing pattern; copy idioms from within itself) |

---

## Pattern Assignments

### `bin/beads-errors.mjs` (utility, request-response)

**Analog:** `bin/wrap-mutation.mjs` (sibling ESM module pattern; same export style)

**Module skeleton (copy from `bin/wrap-mutation.mjs:1-11`)** — header comment style + ESM exports:

```javascript
// Source-attribution: derived from <upstream pattern reference>
// Pitfall 1 mitigation: <ESM-identity reasoning>
// Test parity in tests/shadow-tests/beads-errors.test.mjs

// (no imports needed — pure JS class hierarchy)
```

**Class hierarchy (verbatim from research §Pattern 2; verified):**

Use the exact `BeadsCause` enum + `BeadsUnavailableError` + 4 subtypes from
RESEARCH.md lines 323-369. Three load-bearing details:

1. `Object.freeze(BeadsCause)` — research line 323 — prevents accidental
   enum mutation across import boundaries (Pitfall 1).
2. `Error.captureStackTrace(this, this.constructor)` — research line 338 —
   preserves V8 stack traces.
3. Subtypes set their own `this.name` (research lines 345, 352, 359, 366) so
   the dispatcher's `err.name === 'BeadsUnavailableError'` fallback works
   even if `instanceof` ever splits across module copies.

**No in-repo analog for the class shape itself** — gsd-beads has no Error
subclasses today. The MDN ECMA-262 pattern (research §Pattern 2 attribution)
is the source.

---

### `bin/bd-helper.mjs` (service, request-response)

**Analog:** `bin/gsd-sdk-shadow.mjs:27-35` (existing `execSync('bd …')` pattern)
— **but the helper MUST adapt: switch from `execSync` to `spawnSync`** per
Pitfall 2 in research.

**Imports pattern (from `bin/wrap-mutation.mjs:1-11` + Phase 4 needs):**

```javascript
// bin/bd-helper.mjs
// Wraps spawnSync('bd', …); throws BeadsUnavailableError subtypes on failure.
// Pitfall 2 mitigation: spawnSync (not execSync) so reads can fall through.
import { spawnSync } from 'node:child_process';
import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty } from './beads-errors.mjs';
```

**Existing call-site to AVOID copying verbatim** — `bin/gsd-sdk-shadow.mjs:29-32`:

```javascript
// THIS IS THE ANTI-PATTERN for read handlers:
const beadId = execSync(
  `bd q ${JSON.stringify(title)} -t epic -p 1`,
  { cwd: projectDir, encoding: 'utf-8' }
).trim();
```

**Required helper body (verbatim from research §Pattern 3, lines 416-449)** —
this is the canonical: spawnSync → check `result.error.code === 'ENOENT'` →
check `result.status !== 0` → parse JSON → detect bd's empty-error
`{ error: '…', schema_version: 1 }` shape. Three load-bearing details:

1. `spawnSync('bd', args, { cwd, encoding: 'utf-8' })` — never string-concat
   into a shell. Args is an array.
2. `result.error?.code === 'ENOENT'` → throw `BeadsNotInstalled`. (Optional
   chaining matters; `result.error` may be undefined on success.)
3. bd "no issues found" returns an OBJECT not an array (STACK.md edge case);
   detect `parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed`
   → throw `BeadsEmpty`.

**SDK base path discovery (NOT needed for bd-helper.mjs)** — bd-helper only
calls `bd`, not the upstream SDK. Don't copy `SDK_BASE` from wrap-mutation.

---

### `scripts/regen-state.sh` (build script, file-I/O)

**Analog:** `scripts/regen-roadmap.sh` (exact match — same role, same data flow)

**Mandatory header pattern (lines 1-14 of regen-roadmap.sh)** — copy structure
verbatim, change comments to match regen-state's role:

```bash
#!/usr/bin/env bash
# Regenerate .planning/STATE.md from worktree-local milestone source + bd state.
#
# Source of truth: git config --worktree gsd-beads.milestone (worktree-local)
#   + bd list --type=epic -l gsd:phase --label-filter milestone:vX.Y --json
# Output: .planning/STATE.md (written atomically via tmp file + mv)
#
# Idempotency: byte-stable output for unchanged bd state + milestone.
# T-02-09 mitigation: only writes to .planning/STATE.md.
#
# Stack: bash + jq + bd CLI only.
set -euo pipefail
```

**Lock preamble (verbatim copy of `scripts/regen-roadmap.sh:16-39`)** — every
script that touches `.planning/` must include this block. Specifically:

```bash
# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---
# Resolve source repo's .beads/ from any worktree, absolutize via cd+pwd -P.
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"

# Pre-flight: flock present? (Pitfall 1 — macOS users must brew install flock)
if ! command -v flock >/dev/null 2>&1; then
  echo "[gsd-beads] ERROR: flock not installed (macOS: brew install flock)" >&2
  exit 1
fi

# Lazy-create lock file (zero bytes, never deleted; *.lock is already in .beads/.gitignore).
mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"

# Acquire exclusive lock (30s timeout matches bd-sync.sh hook timeout in settings.fragment.json).
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen is in progress at $LOCK — retry shortly" >&2
  exit 1
fi
# Lock auto-released when fd 9 closes (script exit).
# --- END GSD-BEADS LOCK PREAMBLE v1 ---
```

**Project root resolution (verbatim from regen-roadmap.sh:44-50):**

```bash
if root=$(git rev-parse --show-toplevel 2>/dev/null); then
  : # git root found
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  root="$CLAUDE_PROJECT_DIR"
else
  root="$PWD"
fi
```

**Atomic write idiom (verbatim from regen-roadmap.sh:52-56 + 261-263):**

```bash
OUT="$root/.planning/STATE.md"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

mkdir -p "$(dirname "$OUT")"

# … build $tmp content via repeated `printf … >> "$tmp"` …

# Atomic write: mv tmp → .planning/STATE.md
mv "$tmp" "$OUT"
trap - EXIT
```

**Worktree-local milestone source resolution** — Open Question #2 in research
(line 941). Plan-phase decides between `git config --worktree gsd-beads.milestone`
vs sentinel file. For the `git config` option, mirror the existing pattern in
`hooks/worktree-post-checkout.sh:29` and `tests/cross-worktree/lib/setup.sh:71`.

```bash
# Read worktree-local milestone (D-05). git config returns empty + non-zero on missing key.
milestone=$(git config --worktree gsd-beads.milestone 2>/dev/null || true)
[ -z "$milestone" ] && milestone="${GSD_MILESTONE:-}"  # env override for tests
```

**Existing call-site to integrate with (`hooks/bd-sync.sh:66-70`)** — already
calls `regen-state.sh` opportunistically; once the script exists, the hook
finds it via `$PROJECT_DIR/scripts/regen-state.sh` first then `$SCRIPTS/regen-state.sh`.
No hook change is required for Phase 4.

---

### `tests/shadow-tests/_parity-helpers.mjs` (utility, pure function)

**Analog:** Hand-rolled per research §Pattern 4 (lines 455-528). No in-repo
analog — the underscore prefix is the new convention for "non-handler shared
test module."

**Module structure** — exports two named functions:

```javascript
// tests/shadow-tests/_parity-helpers.mjs
// Source: hand-rolled per RESEARCH §Pattern 4. ~28 LOC. No npm dep.
// D-09: key-set + types parity only; values may differ between bd-state and file-state.

export function assertKeySetParity(actual, snapshot, path = '') { /* per RESEARCH §Pattern 4 */ }
export function assertTypeParity(actual, snapshot, path = '') { /* per RESEARCH §Pattern 4 */ }
```

**Body (verbatim from research §Pattern 4, lines 465-527)** — copy as-is. The
internal `typeOf(v)` helper (lines 523-527) folds `null` into its own type so
`typeof null === 'object'` JS bug doesn't pollute the type vocabulary.

**Critical detail not to drop:** `null` in snapshot = "any type allowed"
(research line 510). This is what lets the harness tolerate
"upstream returns null when no data; bd returns 0" without false-positive.

---

### `tests/shadow-tests/_parity-helpers.test.mjs` (test, unit)

**Analog:** `tests/shadow-tests/wrap-mutation.test.mjs` (exact match — pure
function tests, no fixture, no subprocess)

**Imports pattern (verbatim from `wrap-mutation.test.mjs:1-3`):**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertKeySetParity, assertTypeParity } from './_parity-helpers.mjs';
```

**Test case structure (model from `wrap-mutation.test.mjs:6-14`)** — one test
per CASE, descriptive title with `CASE N:` prefix:

```javascript
// CASE 1: missing key in actual → throws with path
test('CASE 1: assertKeySetParity — missing key throws with path', () => {
  assert.throws(
    () => assertKeySetParity({}, { foo: 1 }),
    /missing keys: foo/
  );
});

// CASE 2: type mismatch → throws with type-mismatch message
test('CASE 2: assertTypeParity — type mismatch throws', () => {
  assert.throws(
    () => assertTypeParity('a string', 42),
    /type mismatch — snapshot=number, actual=string/
  );
});

// CASE 3: null in snapshot allows any actual
test('CASE 3: assertTypeParity — null snapshot allows any actual type', () => {
  assert.doesNotThrow(() => assertTypeParity(42, null));
  assert.doesNotThrow(() => assertTypeParity('s', null));
  assert.doesNotThrow(() => assertTypeParity({}, null));
});
```

Cover the 6 cases from RESEARCH lines 842 (missing-key, missing-nested,
type-mismatch, null-snapshot-allows-anything, array-shape, recursion).

---

### `tests/shadow-tests/findBeadsRoot.test.mjs` (test, integration)

**Analog (helpers):** `tests/shadow-tests/argv-routing.test.mjs:13-29`
**Analog (worktree fixture):** `tests/cross-worktree/lib/setup.sh:29-50` (`mk_source_repo` + `mk_worktree`)

**Imports pattern (adapted from `argv-routing.test.mjs:1-9`)** — add `mkdirSync`
and `symlinkSync` for the symlink case:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBeadsRoot } from '../../bin/gsd-sdk-shadow.mjs';
```

**Worktree fixture pattern — translate `tests/cross-worktree/lib/setup.sh:29-50`
to a Node helper.** The existing setup.sh `mk_source_repo` does:

```bash
git init -q
git config user.email "cross-worktree@test.local"
git config user.name "Cross Worktree Test"
git config extensions.worktreeConfig true
git commit -q --allow-empty -m "init"
bd init --non-interactive --skip-agents >/dev/null 2>&1
```

The Node equivalent (verbatim from research §Pattern 5, lines 542-557):

```javascript
function worktreeBeadsFixture() {
  // Co-locate src + wt under one tempdir (avoids orphan refs in
  // <source>/.git/worktrees/ — pattern from tests/cross-worktree/lib/setup.sh:81-103).
  const root = mkdtempSync(join(tmpdir(), 'gsd-wt-test-'));
  const src = join(root, 'src');
  const wt = join(root, 'wt');
  mkdirSync(src);
  execSync('git init -q', { cwd: src });
  execSync('git config user.email t@t.t', { cwd: src });
  execSync('git config user.name t', { cwd: src });
  execSync('git commit -q --allow-empty -m init', { cwd: src });
  execSync('bd init --non-interactive --skip-agents --prefix wt >/dev/null 2>&1', { cwd: src });
  execSync(`git -C ${src} worktree add ${wt} -b feat`, { stdio: 'ignore' });
  return { root, src, wt };
}
```

**Teardown pattern** — research recommends `t.after()` (lines 561, 572, 591,
602). The existing `argv-routing.test.mjs` uses `try/finally rmSync`; either
works. Recommend `t.after()` for the worktree fixture because cleanup is more
involved (single `rm -rf root` cleans both `src` and `wt`):

```javascript
test('findBeadsRoot CASE: worktree resolves to source repo', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(findBeadsRoot(wt), src);
});
```

**5 cases required** (RESEARCH §Validation Architecture line 820-824):
worktree-resolves-to-source / BEADS_DIR-env-wins / symlink-via-realpath /
non-bd-returns-null / halt-at-fs-root.

---

### `tests/shadow-tests/handler-_phase4-test-stub.test.mjs` (test, integration)

**Analog:** `tests/shadow-tests/handler-phase-add.test.mjs` (exact match — same
shadow-CLI integration pattern; same `setupFixture`/`runShadow` skeleton)

**Imports pattern (verbatim from `handler-phase-add.test.mjs:1-9`):**

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

**Setup helper (verbatim from `handler-phase-add.test.mjs:11-19`):**

```javascript
function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-handler-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

function runShadow(args, dir, env = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    cwd: dir,
    env: { ...process.env, ...env },   // ← extension for D-16: env-flag throws
  });
}
```

**Note the `env` parameter extension** — `handler-phase-add.test.mjs:17` does
NOT take an env. Phase 4's stub uses `GSD_SHADOW_TEST_STUB=1` to register +
`GSD_SHADOW_TEST_STUB_THROW=corrupt|not-installed|version-mismatch|empty` to
configure the throw. This requires extending the spawn helper to forward env.

**Per-case structure (model from `handler-phase-add.test.mjs:21-35`)** — happy
path then sentinel-throw variants:

```javascript
// CASE 1: happy path — stub registered + dispatched, returns {data:{ok:true,backend:'beads'}}
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

// CASE 2-5: sentinel subtypes (BeadsNotInstalled, BeadsCorrupt, BeadsVersionMismatch, BeadsEmpty)
//   — each asserts shadow does NOT print '[gsd-sdk-shadow] dispatch failed' (i.e., fall-through worked).
//   Mirror the not-crashing pattern from argv-routing.test.mjs CASE 6 line 113-117.

// CASE 6: real bug (TypeError) — dispatcher exits 1 (preserves v0.1 loud-fail)
test('_phase4-test-stub CASE 6: real TypeError — exits 1, NOT fall-through', () => {
  const dir = setupFixture();
  try {
    const result = runShadow(
      ['query', '_phase4-test-stub', '--project-dir', dir],
      dir,
      { GSD_SHADOW_TEST_STUB: '1', GSD_SHADOW_TEST_STUB_THROW: 'typeerror' }
    );
    assert.notEqual(result.status, 0, 'real bug must exit non-zero');
    assert.match(result.stderr, /\[gsd-sdk-shadow\] dispatch failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

**6 cases required** (RESEARCH lines 813-818): happy / 4 sentinel subtypes /
real-bug-exits-1.

---

### `tests/shadow-tests/beads-errors.test.mjs` (test, unit)

**Analog:** `tests/shadow-tests/wrap-mutation.test.mjs` (exact match — pure JS
class tests, no fixture, no subprocess)

**Imports pattern (adapted from `wrap-mutation.test.mjs:1-3`):**

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

**4 cases (RESEARCH line 819 + Pitfall 1 line 691-704):**

```javascript
// CASE 1: subtype is instanceof base
test('CASE 1: BeadsNotInstalled instanceof BeadsUnavailableError', () => {
  const e = new BeadsNotInstalled('bd missing');
  assert.ok(e instanceof BeadsUnavailableError);
  assert.ok(e instanceof Error);
  assert.equal(e.cause, BeadsCause.NotInstalled);
});

// CASE 2: cause enum is frozen
test('CASE 2: BeadsCause is frozen — mutation throws or no-op', () => {
  assert.ok(Object.isFrozen(BeadsCause));
});

// CASE 3: name is set per subtype (Pitfall 1 fallback for ESM split)
test('CASE 3: each subtype sets its own .name', () => {
  assert.equal(new BeadsNotInstalled('').name, 'BeadsNotInstalled');
  assert.equal(new BeadsCorrupt('').name, 'BeadsCorrupt');
  assert.equal(new BeadsVersionMismatch('').name, 'BeadsVersionMismatch');
  assert.equal(new BeadsEmpty('').name, 'BeadsEmpty');
});

// CASE 4: originalError preserved
test('CASE 4: originalError preserved on construction', () => {
  const inner = new Error('boom');
  const e = new BeadsCorrupt('wrapper', { originalError: inner });
  assert.equal(e.originalError, inner);
});
```

---

### `tests/shadow-tests/milestone-scoping.test.mjs` (test, integration)

**Analog (multi-worktree topology):** `tests/cross-worktree/simulation.sh:46-58`
(co-located src + 2 worktrees under one tempdir)
**Analog (Node test runner):** `tests/shadow-tests/argv-routing.test.mjs`

**Topology pattern (translate from `simulation.sh:46-58`):**

```javascript
function multiMilestoneFixture() {
  const root = mkdtempSync(join(tmpdir(), 'gsd-milestone-'));
  const src = join(root, 'source');
  const wtA = join(root, 'wt-a');
  const wtB = join(root, 'wt-b');
  mkdirSync(src);
  execSync('git init -q && git config user.email t@t.t && git config user.name t && git commit -q --allow-empty -m i', { cwd: src, shell: '/bin/bash' });
  // Use the seeder fixture to populate multi-milestone bd state
  execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${src}`);
  execSync(`git -C ${src} worktree add ${wtA} -b m-v0.2`, { stdio: 'ignore' });
  execSync(`git -C ${src} worktree add ${wtB} -b m-v0.3`, { stdio: 'ignore' });
  // Set worktree-local milestone (Open Question #2; assumes git config approach)
  execSync(`git -C ${wtA} config --worktree gsd-beads.milestone v0.2`);
  execSync(`git -C ${wtB} config --worktree gsd-beads.milestone v0.3`);
  return { root, src, wtA, wtB };
}
```

**Cross-worktree assertion pattern (from `simulation.sh:84`):**

```bash
# bash analog showing cross-wt visibility check via BEADS_DIR
seen_in_feat=$(cd "$wt_feat" && BEADS_DIR="$src/.beads" bd list --status=all --json | jq …)
```

Translated for milestone scoping (research line 827):

```javascript
test('milestone-scoping CASE: wtA STATE.md shows v0.2 phases', (t) => {
  const { root, src, wtA, wtB } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  execSync(`bash ${REPO_ROOT}/scripts/regen-state.sh`, { cwd: wtA });
  const stateA = readFileSync(join(wtA, '.planning/STATE.md'), 'utf-8');
  assert.match(stateA, /v0\.2/);
  assert.doesNotMatch(stateA, /v0\.3/);

  execSync(`bash ${REPO_ROOT}/scripts/regen-state.sh`, { cwd: wtB });
  const stateB = readFileSync(join(wtB, '.planning/STATE.md'), 'utf-8');
  assert.match(stateB, /v0\.3/);
  assert.doesNotMatch(stateB, /v0\.2/);
});
```

---

### `tests/shadow-tests/seed-determinism.test.sh` (test, bash, integration)

**Analog:** `tests/hook-tests/regen-roadmap.test.sh` CASE 1 (lines 19-51) —
exact match: byte-stable run-twice-and-diff pattern

**Header + accumulator (verbatim from `regen-roadmap.test.sh:1-15`):**

```bash
#!/usr/bin/env bash
# Tests for tests/fixtures/seed-fixture.sh
# Asserts seeder reproducibility (D-07): two invocations produce byte-identical bd export.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_FIXTURE="$REPO_ROOT/tests/fixtures/seed-fixture.sh"

pass=0
fail=0

echo "[seed-determinism.test.sh] Running 2 test cases..."
```

**Determinism case (model from `regen-roadmap.test.sh:19-51`)** — replace
`bash $REGEN_ROADMAP` and ROADMAP.md compare with `bash $SEED_FIXTURE` and
`bd export --json` compare:

```bash
echo "CASE 1: byte-identical bd export across two seeds"
case1_ok=1
{
  fixture_a=$(mktemp -d)
  fixture_b=$(mktemp -d)
  bash "$SEED_FIXTURE" "$fixture_a" >/dev/null 2>&1
  bash "$SEED_FIXTURE" "$fixture_b" >/dev/null 2>&1
  export_a=$(cd "$fixture_a" && bd export --json)
  export_b=$(cd "$fixture_b" && bd export --json)
  if [ "$export_a" != "$export_b" ]; then
    case1_ok=0
    diff <(printf '%s' "$export_a") <(printf '%s' "$export_b") | head -10
  fi
  rm -rf "$fixture_a" "$fixture_b"
}
if [ "$case1_ok" -eq 1 ]; then
  pass=$((pass + 1))
  echo "  PASS: seed-fixture produces byte-identical bd state"
else
  fail=$((fail + 1))
  echo "  FAIL: seed-fixture produces non-deterministic state"
fi
```

**Multi-milestone case (D-08, RESEARCH line 826):** asserts seed produces
v0.1-closed, v0.2-in-progress, v0.3-planned via `bd list … --json | jq` queries.

**Footer (verbatim from `regen-roadmap.test.sh:204-211`):**

```bash
echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
```

---

### `tests/shadow-tests/bd-allowlist-grep.test.sh` (test, bash, static analysis)

**Analog:** `tests/install-tests/no-gsd-core-mutation.test.sh` CASE 1 (lines
13-18) — exact match: static `grep -qE` over repo files, pass/fail accumulator

**Pattern to follow (verbatim from `no-gsd-core-mutation.test.sh:13-18`):**

```bash
# CASE 1: static grep guard — read handlers must not invoke write-side bd subcommands
allowlist='list|show|ready|memories|status|prime|export|deps|children|search|help|version'
# Find all bd-helper or read-handler call sites and check they only use allowlisted subcommands
violations=$(grep -rEn "spawnSync\(.bd.|\bbd \w+" "$REPO_ROOT/bin/" \
  | grep -vE "(${allowlist})\b" \
  | grep -vE "BEADS_OVERRIDES|wrapMutation|/\*|//"  || true)
if [ -n "$violations" ]; then
  _fail "CASE 1: read handlers invoke non-allowlisted bd subcommands: $violations"
else
  _pass "CASE 1: read handlers only use allowlisted (read-only) bd subcommands"
fi
```

**Allowlist source** — `hooks/bd-sync.sh:23` line is the canonical allowlist
(`list|show|ready|memories|status|prime|export|deps|children|search|help|version|--version|--help`).
Phase 4 test must extract from there or match its content.

**Phase 4 caveat:** Since Phase 4 ships zero real read handlers (`BEADS_READ_OVERRIDES = {}`),
this test is a **precursor** that establishes the wiring. RESEARCH line 829:
"full test lands in Phase 11 but the wiring is here." Phase 4's version may
just be a smoke test that the script exists and runs without violations on
the empty handler set.

---

### `tests/install-tests/upstream-version-pin.test.sh` (test, bash, version-check)

**Analog:** `tests/install-tests/path-precedence.test.sh` (sandbox-HOME +
install.sh + grep stdout) — adapt for version-pin assertion

**Pattern from analog (`path-precedence.test.sh:1-17`):**

```bash
#!/usr/bin/env bash
# upstream-version-pin.test.sh — D-10 lockfile drift detection
# Asserts gsd-sdk-cc.version.lock matches the installed gsd-sdk reports.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOCK="$REPO_ROOT/gsd-sdk-cc.version.lock"
pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }
```

**Version-compare case** (D-10, RESEARCH line 828):

```bash
# CASE 1: lockfile exists and is non-empty
if [ ! -s "$LOCK" ]; then
  _fail "CASE 1: $LOCK missing or empty"
else
  _pass "CASE 1: $LOCK present"
fi

# CASE 2: lockfile matches installed gsd-sdk version (drift detection)
expected=$(head -1 "$LOCK" | tr -d '[:space:]')
actual=$(gsd-sdk --version 2>/dev/null | tr -d '[:space:]' || true)
# upstream prints "gsd-sdk vX.Y.Z" (or similar) — extract semver
actual_semver=$(printf '%s' "$actual" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ "$expected" = "$actual_semver" ]; then
  _pass "CASE 2: lockfile $expected matches installed $actual_semver"
else
  _fail "CASE 2: drift — lockfile=$expected, installed=$actual_semver"
fi
```

**Footer (verbatim from `path-precedence.test.sh:91-93`):**

```bash
echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
```

---

### `tests/fixtures/seed-fixture.sh` (fixture, restorer)

**Analog:** `tests/fixtures/bd-helpers/3-level-hierarchy.sh` — same role
(builds bd state in target dir), but **adapt** to use
`bd init --from-jsonl --prefix sd` per D-07 instead of live `bd q` calls.

**Header + arg validation (verbatim from `3-level-hierarchy.sh:1-21`):**

```bash
#!/usr/bin/env bash
# Restores canonical multi-milestone bd fixture into $1.
# Determinism contract (D-07): byte-identical state across runs.
# Strategy: bd init --from-jsonl preserves IDs and created_at/updated_at exactly.
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <directory>" >&2
  exit 1
fi

target="$1"
seed_jsonl="${SEED_JSONL:-$(dirname "$0")/seed.jsonl}"
prefix="${SEED_PREFIX:-sd}"

[ -f "$seed_jsonl" ] || { echo "seed JSONL not found: $seed_jsonl" >&2; exit 1; }
```

**Body (verbatim from research §Pattern 6, lines 619-628):**

```bash
mkdir -p "$target/.beads"
cp "$seed_jsonl" "$target/.beads/issues.jsonl"
( cd "$target" && BEADS_ACTOR=seed bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents >/dev/null 2>&1 )
chmod 700 "$target/.beads"  # bd warns at 0755
```

**Critical detail** — `BEADS_ACTOR=seed` (research line 627 + Pitfall 8 line
770) prevents the dev's actor identity from leaking into the seeded JSONL.

---

### `tests/fixtures/build-seed.sh` (fixture, source script)

**Analog:** `tests/fixtures/bd-helpers/3-level-hierarchy.sh` (exact match —
both scripts build bd state with `bd q`/`bd label add`/`bd link`)

**Header + skeleton (extend `3-level-hierarchy.sh:1-23`)** — but build a
larger multi-milestone fixture (3 milestones × N phases) and end with
`bd export --json -o tests/fixtures/seed.jsonl`:

```bash
#!/usr/bin/env bash
# Source-of-truth bash script for tests/fixtures/seed.jsonl.
# CONVENTION (RESEARCH Pitfall 7): seed.jsonl is regenerated from this script,
# NOT hand-edited. PRs change THIS file + commit the regenerated JSONL.
#
# Output: tests/fixtures/seed.jsonl (multi-milestone bd state)
#   - v0.1: 2 phases, all closed
#   - v0.2: 3 phases, in-progress
#   - v0.3: 2 phases, planned
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
BEADS_ACTOR=seed bd init --non-interactive --skip-agents --prefix sd

# v0.1 milestone — 2 phases, closed
P11=$(BEADS_ACTOR=seed bd q "v0.1 Phase A" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P11" gsd:phase
BEADS_ACTOR=seed bd label add "$P11" version:v0.1
BEADS_ACTOR=seed bd close "$P11"
# … etc for P12, v0.2 phases, v0.3 phases …

BEADS_ACTOR=seed bd export --json -o "$REPO_ROOT/tests/fixtures/seed.jsonl"
echo "[build-seed] seed.jsonl regenerated at $REPO_ROOT/tests/fixtures/seed.jsonl"
```

**Use 3-level-hierarchy.sh as the labeling reference** — labels in that file
(`gsd:phase`, `req-id:REQ-NN`, `version:vN`, `category:auth`, `milestone:v1.0`)
match the v0.2 vocabulary. For Phase 4's seed: `gsd:phase`, `version:v0.1`/
`v0.2`/`v0.3`, `phase-id:NN`.

---

### `tests/fixtures/seed.jsonl` (data, committed)

**Analog:** None (committed generated artifact)

Generated by `build-seed.sh`, committed to repo. Format is bd's JSONL export
shape (one JSON object per line, IDs + timestamps embedded). Not hand-edited.

---

### `tests/scripts/update-snapshots.mjs` (utility, regen)

**Analogs:**
- `bin/gsd-sdk-shadow.mjs:248-252` for the `spawnUpstream` pattern
- `install.sh:14-21` for the lockfile pre-check pattern
- Research §Pattern 4 for the snapshot-write structure

**Imports (mix of shadow.mjs + path.fileURLToPath):**

```javascript
#!/usr/bin/env node
// tests/scripts/update-snapshots.mjs
// Regenerates tests/shadow-tests/snapshots/<cmd>.json from upstream gsd-sdk-cc
// running against tests/fixtures/seed.jsonl. Pre-checks lockfile to prevent
// version drift (Pitfall 3).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
```

**Lockfile pre-check (mirror `install.sh:14-21` style):**

```javascript
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const LOCK = join(REPO_ROOT, 'gsd-sdk-cc.version.lock');

if (!existsSync(LOCK)) {
  console.error(`ERROR: ${LOCK} missing — refusing to write snapshots without pin`);
  process.exit(1);
}
const expected = readFileSync(LOCK, 'utf-8').trim();
const v = spawnSync('gsd-sdk', ['--version'], { encoding: 'utf-8' });
const actual = (v.stdout ?? '').match(/(\d+\.\d+\.\d+)/)?.[1];
if (actual !== expected) {
  console.error(`ERROR: gsd-sdk version mismatch — expected=${expected}, installed=${actual}`);
  process.exit(1);
}
```

**Spawn-upstream pattern (model from `gsd-sdk-shadow.mjs:248-252`):**

```javascript
const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;

function runUpstream(argv, cwd) {
  return spawnSync(UPSTREAM_BIN, argv, { encoding: 'utf-8', cwd });
}
```

For each command in the snapshot list (Phase 4: just `_phase4-test-stub`):
seed a fixture via `seed-fixture.sh`, run upstream against it, capture stdout,
parse + write to `tests/shadow-tests/snapshots/<cmd>.json`.

---

### `tests/shadow-tests/snapshots/_phase4-test-stub.json` (data)

**Analog:** None (literal JSON file)

Format per research §Pattern 4: a snapshot of the `data` key's expected
shape. For the stub: `{ "data": { "ok": true, "backend": "beads" } }`.

---

### `gsd-sdk-cc.version.lock` (config, 1 line)

**Analog:** None (first lockfile in this repo)

Single line: `1.38.5\n` (verified live in research line 138; current upstream
version). No package.json. CI script + `tests/install-tests/upstream-version-pin.test.sh`
read this file directly.

---

### `bin/gsd-sdk-shadow.mjs` (modified — extend, do not rewrite)

**Self-analog** — the file IS the existing pattern. Copy idioms from within.

**(a) Add `findBeadsRoot()` near line 232** (next to the existing
`isBeadsManaged()`). Per D-04 the two coexist. Body verbatim from research
§Pattern 1 (lines 248-309). New imports needed at top:

```javascript
// Add to existing imports at lines 7-11:
import { existsSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
```

`existsSync` and `resolve` are already imported (lines 8-9); add
`realpathSync`, `statSync`, `readFileSync` to the `node:fs` line and `join`,
`dirname` to the `node:path` line.

**Export `findBeadsRoot`** so the test file can import it:

```javascript
export function findBeadsRoot(start) { /* per RESEARCH §Pattern 1 */ }
```

**(b) Add `BEADS_READ_OVERRIDES` table after line 219.** Mirror the existing
`BEADS_OVERRIDES` declaration style:

```javascript
// Existing pattern (lines 202-219):
// ─── BEADS_OVERRIDES table ─────────────────────────────────────────────────
// D-02 invariant: exactly 13 entries, all in this single file.
// T-02-05 threat mitigation: explicit allow-list; unknown commands → spawnUpstream.
export const BEADS_OVERRIDES = { /* 13 entries */ };

// New pattern (after line 219):
// ─── BEADS_READ_OVERRIDES table ────────────────────────────────────────────
// Phase 4: empty for now (stub registered conditionally below). Phases 5–9 fill.
// Registered WITHOUT wrapMutation — reads do NOT emit GSDEvent.StateMutation.
export const BEADS_READ_OVERRIDES = {};
```

**(c) Conditional `_phase4-test-stub` registration.** Per CONTEXT.md "Claude's
Discretion" + RESEARCH Open Question #4: env-flag is recommended. After the
table declaration:

```javascript
// _phase4-test-stub: lifecycle-bound to Phase 4. Phase 5 deletes this block.
if (process.env.GSD_SHADOW_TEST_STUB === '1') {
  BEADS_READ_OVERRIDES['_phase4-test-stub'] = async (args, projectDir) => {
    const throwMode = process.env.GSD_SHADOW_TEST_STUB_THROW;
    if (throwMode === 'not-installed') {
      const { BeadsNotInstalled } = await import('./beads-errors.mjs');
      throw new BeadsNotInstalled('test-stub: simulated bd missing');
    }
    if (throwMode === 'corrupt') { /* throw BeadsCorrupt */ }
    if (throwMode === 'version-mismatch') { /* throw BeadsVersionMismatch */ }
    if (throwMode === 'empty') { /* throw BeadsEmpty */ }
    if (throwMode === 'typeerror') { throw new TypeError('test-stub: real bug'); }
    return { data: { ok: true, backend: 'beads' } };
  };
}
```

**(d) Second register loop after line 279.** Mirror the existing register loop
style (lines 277-279) but WITHOUT `wrapMutation`:

```javascript
// Existing (lines 276-279):
// Register and re-wrap each override with GSDEvent emission (D-09).
for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
  registry.register(cmd, wrapMutation(handler, cmd, eventStream, sessionId));
}

// New (after line 279):
// Register read overrides WITHOUT wrapMutation (reads do not emit StateMutation events).
for (const [cmd, handler] of Object.entries(BEADS_READ_OVERRIDES)) {
  registry.register(cmd, handler);
}
```

**(e) Extend try/catch at lines 303-312.** Replace the existing block with the
sentinel-aware variant from research §Pattern 2 lines 388-402:

```javascript
// New imports near line 11:
import { BeadsUnavailableError } from './beads-errors.mjs';

// Existing (lines 303-312) — REPLACE with:
try {
  const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
  console.log(pickField !== undefined
    ? registryModule.extractField(result.data, pickField)
    : JSON.stringify(result));
  process.exit(0);
} catch (err) {
  if (err instanceof BeadsUnavailableError || isKnownBdCliError(err)) {
    log(`read fall-through (${err.name ?? 'bd CLI error'}): ${err.message}`);
    spawnUpstream(argv);   // never returns
  }
  console.error(`[gsd-sdk-shadow] dispatch failed: ${err.message}`);
  process.exit(1);
}

// Helper near top of main() or as module-level function:
function isKnownBdCliError(err) {
  if (err.code === 'ENOENT') return true;
  return /command not found|bd: not found|ENOENT/i.test(err.message ?? '');
}
```

**(f) Update header comment at line 4** — D-02 invariant text. Existing:

```javascript
// D-02 invariant: all 13 BEADS_OVERRIDES handlers live in this single file.
```

New:

```javascript
// D-02 invariant: 13 mutation entries (BEADS_OVERRIDES) live here.
//                 Reads (BEADS_READ_OVERRIDES) register separately; empty in Phase 4.
```

---

## Shared Patterns

These cross-cutting patterns apply to multiple Phase 4 plans:

### Mkdtemp + try/finally rmSync teardown (Node tests)

**Source:** `tests/shadow-tests/argv-routing.test.mjs:13-22, 32-42` and
`tests/shadow-tests/handler-phase-add.test.mjs:11-15, 23-34`
**Apply to:** Every new `*.test.mjs` file in `tests/shadow-tests/`

```javascript
function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-<purpose>-test-'));
  execSync('bd init --non-interactive --skip-agents', { cwd: dir });
  return dir;
}

test('CASE …', () => {
  const dir = setupFixture();
  try {
    // … test body …
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

For multi-resource fixtures (worktree), prefer `t.after()` (research §Pattern 5
lines 561, 572, 591, 602):

```javascript
test('CASE …', (t) => {
  const { root, /* … */ } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // …
});
```

### Pass/fail accumulator (bash tests)

**Source:** `tests/install-tests/path-precedence.test.sh:7-11` and
`tests/hook-tests/regen-roadmap.test.sh:12-15, 204-211`
**Apply to:** Every new `*.test.sh` file

```bash
pass=0
fail=0
_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

# … cases use _pass/_fail …

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
```

### bd init flags for tests

**Source:** Used identically across `tests/shadow-tests/*.test.mjs`,
`tests/cross-worktree/lib/setup.sh:39`, `tests/fixtures/bd-helpers/3-level-hierarchy.sh:20`
**Apply to:** Every fixture that calls `bd init`

```bash
bd init --non-interactive --skip-agents
```

For seed-fixture.sh (uses `--from-jsonl`):

```bash
BEADS_ACTOR=seed bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents
```

### Repo-root + script-path resolution (bash tests)

**Source:** `tests/install-tests/path-precedence.test.sh:6` and
`tests/hook-tests/regen-roadmap.test.sh:8-10`
**Apply to:** Every bash test

Two flavors are used in the codebase; pick consistent one per test:

```bash
# Flavor A (path-precedence.test.sh): uses git
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Flavor B (regen-roadmap.test.sh): uses BASH_SOURCE
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
```

### Shadow CLI invocation (Node tests)

**Source:** `tests/shadow-tests/argv-routing.test.mjs:9, 23-28` and
`tests/shadow-tests/handler-phase-add.test.mjs:9, 17-19`
**Apply to:** Every Node test that exercises the shadow binary

```javascript
const SHADOW = join(fileURLToPath(import.meta.url), '../../../bin/gsd-sdk-shadow.mjs');

function runShadow(args, dir, env = {}) {
  return spawnSync('node', [SHADOW, ...args], {
    encoding: 'utf-8',
    cwd: dir,
    env: { ...process.env, ...env },
  });
}
```

### Lock preamble (bash scripts that touch .planning/)

**Source:** `scripts/regen-roadmap.sh:16-39` (verbatim block also in
`scripts/regen-requirements.sh:16-39`)
**Apply to:** `scripts/regen-state.sh` ONLY. Test fixtures and seed scripts
do NOT need the lock; they operate in isolated tempdirs.

(Block reproduced under `scripts/regen-state.sh` section above.)

### SDK_BASE + UPSTREAM_BIN path discovery (ESM)

**Source:** `bin/gsd-sdk-shadow.mjs:16-20` and `bin/wrap-mutation.mjs:7-9`
**Apply to:** `tests/scripts/update-snapshots.mjs` (the only new file that
needs upstream paths)

```javascript
const SDK_BASE = process.env.GSD_SDK_PATH
  ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;
```

### CASE numbering convention

**Source:** Used universally — e.g., `argv-routing.test.mjs:31, 47, 62, 79, 93, 103, 124, 140, 155`
**Apply to:** Every test file

Test titles begin with `CASE N:` followed by a one-line description:

```javascript
test('CASE 1: <handler/feature> happy path — <outcome>', () => { … });
test('CASE 2: <handler/feature> <error condition> — <outcome>', () => { … });
```

For per-handler files, prefix with the handler name (`handler-phase-add.test.mjs`
uses `phase.add CASE N:`).

---

## No Analog Found

No file in Phase 4 lacks a meaningful analog — every new file maps to either
an exact in-repo precedent (test files, fixture scripts, regen scripts, bd
helper) or a hand-rolled pattern documented in research with verbatim code
(parity helper, error hierarchy, snapshot writer).

The only files where the in-repo analog is partial:

| File | Why Partial | Compensating Source |
|------|-------------|---------------------|
| `bin/beads-errors.mjs` | gsd-beads has no Error subclasses today | RESEARCH §Pattern 2 supplies verbatim body (lines 323-369), validated against MDN ECMA-262 |
| `tests/scripts/update-snapshots.mjs` | First `tests/scripts/` script | Compose three in-repo patterns: shadow.mjs spawnUpstream, install.sh lockfile pre-check, RESEARCH §Pattern 4 snapshot writer |
| `tests/fixtures/seed.jsonl` | Generated artifact, not hand-edited | Output of `tests/fixtures/build-seed.sh` |
| `gsd-sdk-cc.version.lock` | First version-pin file | Trivial 1-line text; no analog needed |

---

## Open Questions for Plan-Phase

These items are flagged in RESEARCH §Open Questions and §Assumptions Log; the
planner must resolve them before scaffolding files. Pattern map cannot resolve
them since they affect file content, not file pattern.

1. **`BEADS_DIR` semantic — points AT `.beads/` or AT project root?**
   *Verified by reading `hooks/worktree-post-checkout.sh:29-30` (this map).*
   The shim sets `git config --worktree gsd-beads.dir "$source_beads"` where
   `source_beads="$source_root/.beads"` (line 21). So `BEADS_DIR` points AT
   `.beads/`. Reaffirms research Assumption A1 — research §Pattern 1 line 254
   (`return dirname(resolved)`) is correct.

2. **`regen-state.sh` worktree-local milestone source format** — Plan-phase
   decides between `git config --worktree gsd-beads.milestone` (recommended;
   matches install.sh pattern at line 152, hooks/worktree-post-checkout.sh:29,
   tests/cross-worktree/lib/setup.sh:71) vs sentinel file. This map assumes
   `git config --worktree` based on consistency.

3. **Stub-handler placement** (CONTEXT.md "Claude's Discretion"): inline behind
   `process.env.GSD_SHADOW_TEST_STUB` check (recommended in this map; smallest
   delta to existing shadow file) vs separate `bin/_test-stub.mjs` import.

4. **Snapshot file naming convention** — kebab (`_phase4-test-stub.json`)
   matches existing test file convention (`handler-phase-add.test.mjs`).
   This map uses kebab.

---

## Metadata

**Analog search scope:** `bin/`, `scripts/`, `tests/{shadow-tests,install-tests,hook-tests,worktree-tests,cross-worktree,fixtures}/`, `hooks/`, `install.sh`
**Files scanned:** ~35 (full read of 13 referenced files in initial reading; targeted reads of 7 sibling fixtures/tests)
**Pattern extraction date:** 2026-04-29
