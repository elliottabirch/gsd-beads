# Phase 7: Capabilities flag + Bin A primitives + foundational primitives — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 13 (4 modify/enrich + 9 create)
**Analogs found:** 13/13 — every new/modified file has a strong codebase analog

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/adapter.mjs` (MODIFY: capabilities literal only) | adapter shell | config / static metadata | self (lines 53-61) | exact (already in place; only literal value + JSDoc rationale change) |
| `src/adapter/primitives.mjs` (MODIFY: replace 16 stub bodies) | adapter cluster method-bag | request-response (CRUD + event-driven + transform) | `src/adapter/primitives.mjs` (its own current stub form) + `src/bd/helper.mjs` (spawn pattern) | partial — stub style is exact; method bodies are net-new |
| `src/bd/errors.mjs` (MODIFY: add `UnsupportedOperationError`) | error class hierarchy | sentinel taxonomy | self lines 18-55 (`BeadsUnavailableError` + 4 subtypes) | exact — same file, sibling class |
| `src/adapter/pathRouter.mjs` (CREATE) | routing helper / pure registry | transform (path → shape descriptor) | `src/helpers/parsePhaseId.mjs` (named-export pure parser) + `src/format/phase.mjs` (regex-constants-at-top) | role-match (different problem; same module shape) |
| `src/format/section.mjs` (CREATE) | format helper / pure parser | transform (markdown text ↔ section bounds) | `src/format/phase.mjs` | exact — same directory, same module shape, same JSDoc convention |
| `src/format/frontmatter.mjs` (CREATE — discretion per RESEARCH §"Architecture Patterns") | format helper / pure parser | transform (YAML scalar ↔ flat object) | `src/format/phase.mjs` | exact — same directory, same module shape |
| `tests/conformance/run.mjs` (CREATE) | test driver | event-driven dispatch | `tests/unit/format-phase.test.mjs` (dynamic-import + dispatch loop) | role-match — driver pattern |
| `tests/conformance/fixture.mjs` (CREATE) | test setup helper | request-response (mkdtemp + bd init) | `tests/unit/findBeadsRoot.test.mjs:14-28` (`worktreeBeadsFixture`) | exact — same fixture pattern |
| `tests/conformance/binA-records.test.mjs` (CREATE) | conformance test | request-response | `tests/unit/format-phase.test.mjs` (node:test + dynamic-import) | role-match |
| `tests/conformance/binA-section.test.mjs` (CREATE) | conformance test | request-response | `tests/unit/format-phase.test.mjs` | role-match |
| `tests/conformance/binA-frontmatter.test.mjs` (CREATE) | conformance test | request-response | `tests/unit/format-phase.test.mjs` | role-match |
| `tests/conformance/foundational-events.test.mjs` (CREATE) | conformance test | event-driven (10 dispatch types) | `tests/unit/bd-helper.test.mjs:15-28` (`withMockBd` shim style — for negative cases) + `tests/unit/findBeadsRoot.test.mjs` (live bd) | exact for live-bd portion; partial for shim portion |
| `tests/conformance/foundational-namedDoc.test.mjs` (CREATE) | conformance test | request-response (disk + memory dual-write) | `tests/unit/findBeadsRoot.test.mjs` | role-match |
| `tests/conformance/foundational-snapshot.test.mjs` (CREATE) | conformance test | round-trip / batch | `tests/unit/findBeadsRoot.test.mjs:30-36` (mkdtempSync + bd init + assert) | role-match |
| `tests/conformance/capabilities.test.mjs` (CREATE) | lint test | static metadata / shape check | `tests/unit/beads-errors.test.mjs:21-23` (`Object.isFrozen` lint) | role-match |
| `tests/fixtures/seed.jsonl` (ENRICH via build-seed.sh) | test fixture | bulk fixture data | self + `tests/fixtures/build-seed.sh` (D-07 determinism) | exact — additive edit; CONF-03 byte-identity preserved |
| `package.json` (verify `test:conformance` script body) | config | static metadata | self lines 27-32 | exact — script slot already declared, body must match `node --test 'tests/conformance/**/*.test.mjs'` |

## Pattern Assignments

---

### `src/adapter.mjs` (MODIFY — capabilities literal only)

**Analog:** self, lines 51-61

**Existing literal** (untouched mechanism, edit values + add JSDoc per `false`):

```javascript
// Static capabilities flag per D-03 / CAP-01 / D-2026-04-30-05.
// Placeholder booleans; Phase 7 sets to implementation reality.
BeadsAdapter.capabilities = Object.freeze({
  record: true,
  section: true,
  binaryAsset: false,
  snapshot: true,
  transaction: false,
  namedDoc: true,
  commitPlanningState: false,
});
```

**Differences for Phase 7 (per D-16):**
- Replace lead JSDoc "Phase 7 sets to implementation reality" with the locked rationale comment block.
- Add per-`false` JSDoc rationale (binaryAsset, transaction, commitPlanningState) so SC#1 lint passes.
- Values themselves are already correct; this is a comment-and-rationale edit, not a value flip.

**Anti-patterns to avoid:**
- Do NOT change the `Object.freeze(...)` call shape (D-19 / Phase 6 D-03 carry-forward).
- Do NOT mutate `BeadsAdapter.capabilities` post-declaration; the `false` JSDoc rationales are inline comments on the literal, not a separate descriptor.
- Do NOT add new boolean keys; D-2026-04-30-05 fixed the seven-bit shape.

---

### `src/adapter/primitives.mjs` (MODIFY — replace 16 stub bodies)

**Analog (current stub style, lines 1-29):**

```javascript
// src/adapter/primitives.mjs
// Bin A (10 methods, PRIM-01) + 6 foundational (PRIM-02). Phase 7 / IMPL.
// Stub style per D-05.

const NOT_IMPLEMENTED = (name, phase, impl) => {
  throw new Error('BeadsAdapter.' + name + ': not implemented (Phase ' + phase + ' / ' + impl + ')');
};

export default {
  async getRecord(path)            { NOT_IMPLEMENTED('getRecord', 7, 'PRIM-01'); },
  async putRecord(path, body)      { NOT_IMPLEMENTED('putRecord', 7, 'PRIM-01'); },
  // ... 14 more stubs ...
};
```

**Bd-call pattern to copy (from `src/bd/helper.mjs` lines 21-36):**

```javascript
import { spawnSync } from 'node:child_process';
import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty } from './errors.mjs';

export function bd(args, { cwd, parseJson = true } = {}) {
  const result = spawnSync('bd', args, { cwd, encoding: 'utf-8' });

  if (result.error?.code === 'ENOENT') {
    throw new BeadsNotInstalled('bd binary not found on PATH', { originalError: result.error });
  }

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    if (/database|dolt|metadata\.json/i.test(stderr)) {
      throw new BeadsCorrupt(`bd ${args[0]} failed: ${stderr}`, { originalError: new Error(stderr) });
    }
    throw new BeadsCorrupt(`bd ${args[0]} failed (status ${result.status}): ${stderr}`);
  }
  // ...
}
```

**Lazy-bd guard pattern (from `src/adapter.mjs` lines 36-48):**

```javascript
/** Lazy bd validation per D-02. */
_ensureBd() {
  if (this._beadsValidated) return this._beadsRoot;
  const root = findBeadsRoot(this.projectRoot);
  if (!root) {
    throw new BeadsEmpty(
      'BeadsAdapter: project at ' + this.projectRoot + ' is not bd-managed'
    );
  }
  this._beadsRoot = root;
  this._beadsValidated = true;
  return root;
}
```

**Method body shape per primitive (router-first dispatch — from RESEARCH.md §"Architecture Patterns" Pattern 1):**

```javascript
import { resolve as routerResolve } from './pathRouter.mjs';
import { bd } from '../bd/helper.mjs';
import { UnsupportedOperationError } from '../bd/errors.mjs';
import { rewriteSection, locateSection } from '../format/section.mjs';
import { writeFileSync, renameSync, readFileSync, existsSync } from 'node:fs';
import { resolve as pathResolve, dirname, basename } from 'node:path';

export default {
  async getRecord(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // ≤2 bd spawns per public method (QUAL-07 / D-21)
      const records = bd(['list', '-l', route.label, '--json', '-n', '0']);
      // client-side filter to specific id derived from path...
    }
    // disk-routed
    const abs = pathResolve(this.projectRoot, path);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, 'utf-8');
  },

  async writeBinaryAsset(path, bytes) {
    throw new UnsupportedOperationError(
      `BeadsAdapter.writeBinaryAsset: not supported (capabilities.binaryAsset=false). bd has no binary blob store; configure an external sink in v1.1+.`
    );
  },
};
```

**Atomic file replace (from RESEARCH.md §"Pattern 3"; copy verbatim):**

```javascript
function atomicWriteFile(absPath, body) {
  const tmpPath = pathResolve(
    dirname(absPath),
    `.${basename(absPath)}.tmp.${process.pid}.${Date.now()}`
  );
  writeFileSync(tmpPath, body);
  renameSync(tmpPath, absPath);   // POSIX-atomic per D-08
}
```

**Differences vs the stub form:**
- Each method opens with `const route = routerResolve(path)` then branches on `route.tier`.
- Bd-routed branches call `this._ensureBd()` first; disk-routed branches do NOT (D-18).
- BEADS_ACTOR=seed env override on every `bd()` invocation that affects determinism (snapshot, restore, named-doc index, recordStateEvent memory writes — D-20).
- ≤2 bd spawns per public method invocation; if a method needs more, refactor to one `bd export --json` and parse client-side (D-21 / QUAL-07).
- `writeBinaryAsset` is the SOLE method that throws unconditionally — it constructs `UnsupportedOperationError` with the locked message format from D-16.

**Anti-patterns to avoid:**
- Do NOT use `execSync` — `spawnSync` only (Phase 6 D-04 carry-forward; CLAUDE.md "Established Patterns").
- Do NOT bypass `bd()` from `helper.mjs` — every `bd` invocation must go through it so sentinel errors map cleanly.
- Do NOT skip `BEADS_ACTOR=seed` on snapshot/restore/recordStateEvent memory writes — spike-validated determinism contract (D-20).
- Do NOT issue >2 bd spawns per public-method invocation; conformance has timing assertions (D-21).
- Do NOT `await` a synchronous `bd()` — it's `spawnSync`; the `async` on the method declaration is for symmetry with Markdown adapter peer, not for actual await.
- Do NOT change the cluster method-bag export shape: keep `export default { method1() {...}, method2() {...} }` (D-17 / Phase 6 D-04 — the `Object.assign(BeadsAdapter.prototype, primitives, ...)` call in `src/adapter.mjs:64-74` requires it).

---

### `src/bd/errors.mjs` (MODIFY — add `UnsupportedOperationError`)

**Analog:** self, lines 18-55 (`BeadsUnavailableError` and 4 existing subtypes).

**Existing subtype pattern to replicate (lines 29-35, `BeadsNotInstalled`):**

```javascript
export class BeadsNotInstalled extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.NotInstalled });
    this.name = 'BeadsNotInstalled';
  }
}
```

**Frozen-cause-enum pattern to extend (lines 10-16):**

```javascript
export const BeadsCause = Object.freeze({
  NotInstalled:    'not-installed',
  Corrupt:         'corrupt',
  VersionMismatch: 'version-mismatch',
  Empty:           'empty',
  Unknown:         'unknown',
});
```

**New addition for D-16 — sibling subtype, follow exact shape:**

```javascript
// Add to the BeadsCause enum:
//   Unsupported: 'unsupported',
// Then, sibling to the existing 4 subtype classes:

export class UnsupportedOperationError extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.Unsupported });
    this.name = 'UnsupportedOperationError';
  }
}
```

**Locked throw-message format (D-16):**
`"BeadsAdapter.<method>: not supported (capabilities.<flag>=false). <hint>"`

**Differences from existing subtypes:**
- Extends `BeadsUnavailableError` (CONTEXT D-16: "extending the existing `BeadsUnavailableError` hierarchy") — sibling to `BeadsNotInstalled`/`BeadsCorrupt`/`BeadsVersionMismatch`/`BeadsEmpty`, not a child of any of them. Plan-phase already settled this per CONTEXT discretion item.
- Adds one new entry to `BeadsCause`: `Unsupported: 'unsupported'`. Order at end of frozen enum to avoid disturbing existing entries.
- The conformance test for D-16 verifies the throw-message format byte-for-content; do NOT improvise the wording.

**Anti-patterns to avoid:**
- Do NOT mutate `BeadsCause` at runtime — extend the literal in source (`Object.freeze` makes runtime mutation a silent no-op in non-strict mode, throw in strict; preserve the contract).
- Do NOT set `this.name = 'BeadsUnsupported'` or other variant — must be `'UnsupportedOperationError'` so dispatchers using `err.name === '…'` fallback work (per the existing class convention, "Pitfall 1 mitigation" in `errors.mjs:3-6`).
- Do NOT skip `Error.captureStackTrace` — inherited from `BeadsUnavailableError` constructor; just call `super(...)` and the stack is preserved.

---

### `src/adapter/pathRouter.mjs` (CREATE — closed-enum routing registry)

**Analog (closest):** `src/format/phase.mjs` for the regex-constants-at-top + named-exports-with-JSDoc shape; `src/helpers/parsePhaseId.mjs` for the pure-function-with-JSDoc convention.

**Module-shape pattern (from `src/format/phase.mjs:1-25`):**

```javascript
// src/format/phase.mjs
// Bidirectional parser/formatter for ROADMAP.md phase titles + descriptions.
// Implements ARCH-03 (REQUIREMENTS.md) per Phase 6 decisions:
//   - D-14: 4 named exports
//   - D-15: idempotency contract
//   - D-16: tail is opaque
//   - D-17: 11 fixture files

const TITLE_RE = /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;

/**
 * Parses "Phase N: Name" (or "Phase N.M: Name" for decimal phases).
 *
 * @param {string} line
 * @returns {{ number: string, name: string }}
 * @throws {Error} if line doesn't match the title pattern
 */
export function parsePhaseTitle(line) {
  const m = TITLE_RE.exec(line);
  if (!m) {
    throw new Error(
      `parsePhaseTitle: not a phase title: ${JSON.stringify(line)}`
    );
  }
  return { number: m[1], name: m[2] };
}
```

**Closed-enum router skeleton to ship (from RESEARCH.md §"Pattern 1", lines 296-356):**

```javascript
// src/adapter/pathRouter.mjs
// Closed-enum routing registry per D-01.
// Every Bin A method's first line is `const route = pathRouter.resolve(path)`.
// Pure function — no I/O, no spawn — unit-testable in isolation.

const PATTERNS = Object.freeze([
  // Static singletons
  {
    test: (path) => path === '.planning/ROADMAP.md',
    shape: () => ({ kind: 'roadmap', tier: 'bd', label: 'gsd:roadmap', singleton: true }),
  },
  // Phase plans: .planning/phases/NN-<slug>/NN-<plan>-PLAN.md
  {
    test: (path) => /^\.planning\/phases\/(\d+)-[^/]+\/(\1)-([^/]+)-PLAN\.md$/.test(path),
    shape: (path) => {
      const m = path.match(/^\.planning\/phases\/(\d+)-[^/]+\/\1-([^/]+)-PLAN\.md$/);
      return { kind: 'plan', tier: 'disk', phase: m[1], plan: m[2] };
    },
  },
  // ... more patterns ...
]);

export const NAMED_DOC_CATEGORIES = Object.freeze([
  'intel', 'codebase', 'research', 'archived-milestone', 'debug-knowledge-base',
  'learnings', 'methodology', 'discussion-log', 'discovery',
]);

/**
 * @param {string} path  repo-relative
 * @returns {{kind:string, tier:'bd'|'disk'|'hybrid', ...}} shape descriptor
 */
export function resolve(path) {
  if (typeof path !== 'string' || !path.length) {
    throw new TypeError('pathRouter.resolve: path must be a non-empty string');
  }
  for (const entry of PATTERNS) {
    if (entry.test(path)) return entry.shape(path);
  }
  return { kind: 'opaque', tier: 'disk' };
}
```

**Differences from analogs:**
- Exposes a frozen `PATTERNS` table + a `resolve(path)` named export (vs. `format/phase.mjs`'s 4 parsers).
- Uses `Object.freeze` on the registry per D-19 / Phase 6 D-03 enum-freezing convention (compare `BeadsCause` in `src/bd/errors.mjs:10-16`).
- Also exports a frozen `NAMED_DOC_CATEGORIES` enum so the conformance test for D-10 can iterate the allowlist directly.

**Anti-patterns to avoid:**
- Do NOT use `path.startsWith` for file extension matching — use regex with anchors so trailing slashes / nested dirs don't false-positive.
- Do NOT make the registry mutable — the frozen `Object.freeze([...])` is the spine of D-01 (one-line additions for new kinds in Phase 8+; ad-hoc mutation defeats this).
- Do NOT add async logic — router must remain pure / synchronous so `getRecord` etc. can call it before the lazy `_ensureBd()`.
- Do NOT couple the router to `this.projectRoot` — paths in/out are repo-relative (D-02). Caller joins to absolute when it actually hits disk.

---

### `src/format/section.mjs` (CREATE — slugify + section-bounds parser)

**Analog:** `src/format/phase.mjs` (same directory, same module shape, same JSDoc convention).

**Imports + module-header pattern (from `src/format/phase.mjs:1-15`):**

```javascript
// src/format/phase.mjs
// Bidirectional parser/formatter for ROADMAP.md phase titles + descriptions.
// Implements ARCH-03 (REQUIREMENTS.md) per Phase 6 decisions:
//   - D-14: 4 named exports
//   - D-15: idempotency contract — parse(format(parse(x))) === parse(x)

// (no imports — pure string manipulation only)
```

**Regex-constant-at-top + JSDoc pattern (lines 22-52):**

```javascript
/**
 * Title regex per RESEARCH.md §2 (line 167).
 * Anchored at both ends; allows ONE optional decimal segment ("Phase 72.1");
 * non-greedy name capture absorbs em-dashes / asterisks / plus-signs / etc.
 * Bounded backtracking O(n) — see threat T-6.05-01.
 */
const TITLE_RE = /^Phase\s+(\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;

/**
 * Parses "Phase N: Name" (or "Phase N.M: Name" for decimal phases).
 *
 * @param {string} line
 * @returns {{ number: string, name: string }}
 * @throws {Error} if line doesn't match the title pattern
 */
export function parsePhaseTitle(line) {
  const m = TITLE_RE.exec(line);
  if (!m) {
    throw new Error(
      `parsePhaseTitle: not a phase title: ${JSON.stringify(line)}`
    );
  }
  return { number: m[1], name: m[2] };
}
```

**Verbatim adoption from RESEARCH.md §"Pattern 2" (lines 388-501):**

```javascript
// src/format/section.mjs

/**
 * GitHub-style ASCII slugify (subset). Per D-05.
 *
 * Rules (chosen over full github-slugger to avoid the dep):
 *  1. Lowercase
 *  2. Strip everything that isn't [a-z0-9 -]
 *  3. Collapse whitespace + hyphens to single hyphens
 *  4. Trim leading/trailing hyphens
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*_~]/g, '')           // strip markdown emphasis
    .replace(/[^\w\s-]/g, ' ')         // non-word / non-space / non-hyphen → space
    .replace(/[\s_]+/g, '-')           // whitespace / underscore → hyphen
    .replace(/-+/g, '-')               // collapse runs
    .replace(/^-+|-+$/g, '');          // trim ends
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/**
 * Locate a section by path-slug.
 * @returns {{headingLine, headingLevel, bodyStart, bodyEnd, bodyText} | null}
 */
export function locateSection(text, anchor) {
  const target = anchor.replace(/^\/+/, '');
  const targetParts = target.split('/').filter(Boolean);
  if (!targetParts.length) return null;

  const lines = text.split('\n');
  const stack = [];
  let foundLine = -1;
  let foundLevel = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    const slug = slugify(m[2]);
    stack.length = level;
    stack[level - 1] = slug;
    const currentParts = stack.slice(0, level).filter(Boolean);
    if (
      currentParts.length === targetParts.length &&
      currentParts.every((p, idx) => p === targetParts[idx])
    ) {
      foundLine = i;
      foundLevel = level;
      break;
    }
  }
  if (foundLine === -1) return null;

  let bodyEnd = lines.length;
  for (let j = foundLine + 1; j < lines.length; j++) {
    const m = HEADING_RE.exec(lines[j]);
    if (m && m[1].length <= foundLevel) {
      bodyEnd = j;
      break;
    }
  }
  return {
    headingLine: foundLine,
    headingLevel: foundLevel,
    bodyStart: foundLine + 1,
    bodyEnd,
    bodyText: lines.slice(foundLine + 1, bodyEnd).join('\n'),
  };
}

export function rewriteSection(text, anchor, body, mode) {
  const loc = locateSection(text, anchor);
  if (!loc) throw new Error(`section not found: ${anchor}`);
  const lines = text.split('\n');
  const bodyLines = body.split('\n');

  let head, mid, tail;
  if (mode === 'overwrite') {
    head = lines.slice(0, loc.bodyStart);
    mid = bodyLines;
    tail = lines.slice(loc.bodyEnd);
  } else if (mode === 'append') {
    head = lines.slice(0, loc.bodyEnd);
    mid = bodyLines;
    tail = lines.slice(loc.bodyEnd);
  } else if (mode === 'prepend') {
    head = lines.slice(0, loc.bodyStart);
    mid = bodyLines;
    tail = lines.slice(loc.bodyStart);
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }
  return [...head, ...mid, ...tail].join('\n');
}
```

**Differences from `phase.mjs`:**
- Operates on generic markdown (any heading levels) rather than the fixed phase-description schema.
- 3 named exports (`slugify`, `locateSection`, `rewriteSection`) vs. phase.mjs's 4.
- No idempotency contract — `rewriteSection` is a one-way transform; D-08 atomicity comes from the caller (`atomicWriteFile`), not the parser.

**Anti-patterns to avoid:**
- Do NOT pull in `mdast-util-from-markdown` or `unified` — RESEARCH.md §"Alternatives Considered" rejects (50KB+ for a strictly-bounded ATX-headings subset).
- Do NOT pull in `github-slugger` unless non-ASCII headings appear in the corpus — RESEARCH.md verifies current `.planning/` is 100% ASCII English.
- Do NOT touch the heading line itself in any mode — D-07 forbids this; would break path-slug stability when callers rewrite headings.
- Do NOT use `String.prototype.normalize('NFKD')` etc. — slugify must be deterministic byte-for-byte across runs (CONF-03 / spike-findings-gsd-beads determinism).

---

### `src/format/frontmatter.mjs` (CREATE — flat-scalar YAML parser)

**Analog:** `src/format/phase.mjs` (same shape, same JSDoc convention; hand-rolled parser).

**Frontmatter delimiter pattern (RESEARCH.md §"Architecture Patterns" pattern):**

```javascript
// src/format/frontmatter.mjs
// Flat-scalar YAML frontmatter parser per D-03.
//
// Schema is restricted to:
//   - Top-level keys are strings
//   - Values are scalars (string/number/boolean) OR flat string lists
//   - No nested objects, no anchors, no tags, no multi-line scalars
//
// PLAN.md frontmatter we have today is 100% within this schema; the
// hand-roll avoids 8 transitive deps (gray-matter + js-yaml + ...).
// If schema needs grow, swap to gray-matter@4.0.3 in v1.1.

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * Parse YAML-like frontmatter at the top of a markdown file.
 * @param {string} text
 * @returns {{ frontmatter: Record<string, string|number|boolean|string[]>, body: string }}
 */
export function parseFrontmatter(text) {
  const m = FRONTMATTER_RE.exec(text);
  if (!m) return { frontmatter: {}, body: text };
  // ... flat YAML scalar parser ...
}
```

**Differences:**
- New export-shape: `{ parseFrontmatter, formatFrontmatter, mergeFrontmatter }` mirrors phase.mjs's 4-export pattern.
- Idempotency contract NOT required — frontmatter is unordered key/value; round-trip equality is "object-equal", not "byte-equal".

**Anti-patterns to avoid:**
- Do NOT pull in `gray-matter` or `js-yaml` for Phase 7 — RESEARCH.md §"Standard Stack" rejects (8 transitive deps).
- Do NOT support nested objects — D-03 limits synthesized frontmatter to flat values; deeper schemas would force bd label representations to grow accordingly.

---

### `tests/conformance/run.mjs` (CREATE — driver)

**Analog:** `tests/unit/format-phase.test.mjs` (dynamic-import + dispatch loop).

**Dispatch-loop pattern from analog (lines 48-66):**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures/phase-format');

if (existsSync(FIXTURE_DIR)) {
  const fixtures = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.md'));
  for (const fixture of fixtures) {
    test(`round-trip idempotent description: ${fixture}`, async () => {
      const { parsePhaseDescription, formatPhaseDescription } =
        await import('../../src/format/phase.mjs');
      // ...
    });
  }
}
```

**Driver shape to ship (from RESEARCH.md §"Pattern 6", lines 681-711):**

```javascript
// tests/conformance/run.mjs
import { setupFreshAdapter } from './fixture.mjs';

const FILES = [
  './binA-records.test.mjs',
  './binA-section.test.mjs',
  './binA-frontmatter.test.mjs',
  './foundational-events.test.mjs',
  './foundational-namedDoc.test.mjs',
  './foundational-snapshot.test.mjs',
  './capabilities.test.mjs',
];

const factories = [
  { label: 'beads', factory: (t) => setupFreshAdapter(t, 'beads') },
];
if (process.env.RUN_CROSS_ADAPTER === '1') {
  // Phase 13 wires once fork publishes
  // const { MarkdownAdapter } = await import('get-shit-done-cc/adapter/markdown');
  // factories.push({ label: 'markdown', factory: (t) => setupMarkdownAdapter(t) });
}

for (const file of FILES) {
  const { runConformance } = await import(file);
  for (const f of factories) {
    runConformance(f.factory, f.label);
  }
}
```

**Differences:**
- Driver is the spine; each conformance test file exports `runConformance(makeAdapter, label)` (not auto-registers).
- `node:test` does NOT have `describe.each`; the explicit `for` loop is the idiomatic pattern (RESEARCH §"Alternatives Considered").
- `RUN_CROSS_ADAPTER=1` env var gates the second factory invocation — shipped in Phase 7, FLIPPED in Phase 13 (no harness rewrite).

**Anti-patterns to avoid:**
- Do NOT import the conformance files at top-level when the file path is dynamic — dynamic `await import()` so missing files surface as proper errors.
- Do NOT run the same `runConformance` twice with the same `label` — `describe(\`<cluster> [\${label}]\`, ...)` collisions confuse the test reporter.

---

### `tests/conformance/fixture.mjs` (CREATE — `setupFreshAdapter` helper)

**Analog:** `tests/unit/findBeadsRoot.test.mjs` lines 14-28 (`worktreeBeadsFixture`).

**Mkdtempsync + bd-init + t.after pattern (from analog):**

```javascript
function worktreeBeadsFixture() {
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

test('findBeadsRoot CASE 1: worktree resolves to source repo', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(findBeadsRoot(wt), src);
});
```

**Conformance-fixture pattern to ship (from RESEARCH.md §"Pattern 6", lines 720-750):**

```javascript
// tests/conformance/fixture.mjs

import { mkdtempSync, mkdirSync, copyFileSync, rmSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BeadsAdapter } from '../../src/adapter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '../fixtures/seed.jsonl');

export async function setupFreshAdapter(t, kind = 'beads') {
  const root = mkdtempSync(join(tmpdir(), 'gsd-conf-'));
  spawnSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  mkdirSync(join(root, '.beads'));
  copyFileSync(SEED, join(root, '.beads/issues.jsonl'));
  const init = spawnSync('bd', ['init', '--from-jsonl', '--prefix', 'sd',
      '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet'], {
    cwd: root,
    env: { ...process.env, BEADS_ACTOR: 'seed' },
    encoding: 'utf-8',
  });
  if (init.status !== 0) {
    throw new Error(`bd init failed: ${init.stderr}`);
  }
  chmodSync(join(root, '.beads'), 0o700);
  mkdirSync(join(root, '.planning'), { recursive: true });
  // Register cleanup on test context (D-15: t.after teardown)
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { adapter: new BeadsAdapter(root), projectRoot: root };
}
```

**Differences:**
- Replaces `execSync` (used in `findBeadsRoot.test.mjs` for legacy reasons) with `spawnSync` — Phase 6 D-04 / CLAUDE.md "Established Patterns" mandate `spawnSync` for new code; `findBeadsRoot.test.mjs` uses `execSync` only for the test fixture setup, not for production code.
- Returns `{ adapter, projectRoot }` per CONTEXT discretion item; tearteown registered on `t.after()` (vs. analog's manual `t.after(() => rmSync(...))` after fixture-build).
- `BEADS_ACTOR=seed` on the bd init invocation — D-20 / determinism contract.
- `--from-jsonl` path: `.beads/issues.jsonl` is bd's expected input file name (verified live in RESEARCH.md §"Pattern 5", line 588).

**Anti-patterns to avoid:**
- Do NOT skip `chmodSync(join(root, '.beads'), 0o700)` — bd ignores world-readable `.beads/` on some systems (defensive practice from `findBeadsRoot.test.mjs`).
- Do NOT modify `tests/fixtures/seed.jsonl` in place — D-15 / CONF-03 byte-identity requires `seed.jsonl` is read-only relative to the test (always `copyFileSync` to per-test scratch).
- Do NOT skip the t.after cleanup — `mkdtempSync` files accumulate; the registration must succeed even if the test body throws.

---

### `tests/conformance/binA-records.test.mjs` (CREATE)

**Analog:** `tests/unit/format-phase.test.mjs` (node:test + dynamic-import + per-test setup).

**Test-shape pattern (from analog):**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
// ...
test('parsePhaseTitle: simple single-digit', async () => {
  const { parsePhaseTitle } = await import('../../src/format/phase.mjs');
  assert.deepEqual(
    parsePhaseTitle('Phase 1: Spike — validate beads + GSD topology'),
    { number: '1', name: 'Spike — validate beads + GSD topology' }
  );
});
```

**Conformance shape per D-14 / RESEARCH.md §"Pattern 6":**

```javascript
// tests/conformance/binA-records.test.mjs
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

export function runConformance(makeAdapter, label) {
  describe(`Bin A: records [${label}]`, () => {

    test('getRecord returns null for missing record', async (t) => {
      const { adapter } = await makeAdapter(t);
      const result = await adapter.getRecord('.planning/does-not-exist.md');
      assert.equal(result, null);
    });

    test('putRecord then getRecord round-trips body', async (t) => {
      const { adapter } = await makeAdapter(t);
      const body = '# Hello\n\nbody\n';
      await adapter.putRecord('.planning/intel/test-key.md', body);
      const result = await adapter.getRecord('.planning/intel/test-key.md');
      assert.equal(result, body);
    });

    test('listCollection: phases yields seeded records sorted by phase-id', async (t) => {
      const { adapter } = await makeAdapter(t);
      const phases = await adapter.listCollection('.planning/phases');
      assert.ok(Array.isArray(phases));
      // seed.jsonl has phase-id:01..11 — assert deterministic order
      assert.deepEqual(phases.map(p => p.phaseId), ['01','02','03','04','05','06','07','08','09','10','11']);
    });
  });
}
```

**Differences:**
- File EXPORTS `runConformance(makeAdapter, label)` — does NOT auto-register tests at top-level.
- Test bodies use `await makeAdapter(t)` to get a fresh adapter (factory closure injects from driver).
- `listCollection` ordering test is deterministic against the enriched seed.jsonl (CONF-03 / D-04 sort-by-phase-id-numeric).

**Anti-patterns to avoid:**
- Do NOT import `BeadsAdapter` directly in this file — receive it via the factory so cross-adapter (Phase 13) can swap to MarkdownAdapter.
- Do NOT skip `makeAdapter(t)` per test — each test starts from a fresh seed.jsonl clone (D-15) so order independence is maintained.
- Do NOT use `assert.equal` for deep arrays — use `assert.deepEqual` per CLAUDE.md / format-phase.test.mjs:43-44.

---

### `tests/conformance/binA-section.test.mjs` (CREATE)

**Analog:** `tests/unit/format-phase.test.mjs` (round-trip property-style tests).

**Round-trip property pattern (from analog lines 50-60):**

```javascript
test(`round-trip idempotent description: ${fixture}`, async () => {
  const { parsePhaseDescription, formatPhaseDescription } =
    await import('../../src/format/phase.mjs');
  const body = readFileSync(resolve(FIXTURE_DIR, fixture), 'utf-8');
  const parsed1 = parsePhaseDescription(body);
  const formatted = formatPhaseDescription(parsed1);
  const parsed2 = parsePhaseDescription(formatted);
  assert.deepStrictEqual(parsed2, parsed1,
    `parse(format(parse(${fixture}))) must equal parse(${fixture})`);
});
```

**Conformance for `updateSection × 3 modes` (D-07):**

```javascript
export function runConformance(makeAdapter, label) {
  describe(`Bin A: section [${label}]`, () => {

    test('getSection returns body for known anchor', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      const text = '# Phase 7\n## Decisions\n### D-01\nbody\n';
      writeFileSync(join(projectRoot, '.planning/PLAN.md'), text);
      const body = await adapter.getSection('.planning/PLAN.md', 'phase-7/decisions/d-01');
      assert.equal(body, 'body');
    });

    test('updateSection overwrite mode replaces body within heading bounds', async (t) => {
      // Heading line itself NEVER touched per D-07
      const { adapter, projectRoot } = await makeAdapter(t);
      // ...
    });

    test('updateSection append mode inserts before next sibling heading', async (t) => {
      // ...
    });

    test('updateSection prepend mode inserts after addressed heading', async (t) => {
      // ...
    });

    test('lint: no documented anchored file has duplicate path-slugs (D-06)', async (t) => {
      // ... walk .planning/, parse all path-slugs, assert no dupes
    });
  });
}
```

**Differences:**
- 3 tests × `updateSection` modes per D-07; one test per `getSection` happy-path; one lint test for path-slug uniqueness (D-06 mandate).
- The "lint: no duplicate path-slugs" test enforces D-06 anti-shadowing rule across the whole `.planning/` corpus.

**Anti-patterns to avoid:**
- Do NOT touch the heading line in any mode test — D-07 forbids; would break path-slug stability when callers rewrite headings.
- Do NOT skip writing the file via `atomicWriteFile` — D-08 / POSIX rename atomicity is the contract.

---

### `tests/conformance/binA-frontmatter.test.mjs` (CREATE)

**Analog:** `tests/unit/format-phase.test.mjs` + `tests/unit/bd-helper.test.mjs`.

**Two-tier test (bd-routed AND disk-routed per D-03):**

```javascript
export function runConformance(makeAdapter, label) {
  describe(`Bin A: frontmatter [${label}]`, () => {

    test('getFrontmatter on bd-routed path synthesizes from labels', async (t) => {
      const { adapter } = await makeAdapter(t);
      // seed.jsonl includes phase-id:07 + version:v1.0 labels on a phase bead
      const fm = await adapter.getFrontmatter('.planning/phases/07-...', 'phase_id');
      assert.equal(fm, '07');
    });

    test('updateFrontmatter on bd-routed path mutates bd labels', async (t) => {
      // Calls bd label add/remove via helper.mjs
    });

    test('getFrontmatter on disk-routed path parses YAML scalars', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);
      writeFileSync(
        join(projectRoot, '.planning/PLAN.md'),
        '---\nphase_id: 07\nstatus: open\n---\n# Phase 7\n'
      );
      assert.equal(await adapter.getFrontmatter('.planning/PLAN.md', 'phase_id'), '07');
    });

    test('mergeFrontmatter on disk-routed path preserves unrelated keys', async (t) => {
      // ...
    });
  });
}
```

**Differences:**
- Tests both tiers (bd via labels; disk via flat-scalar YAML) since D-03 generalizes across both routes — Bin B callers (`phasePlanIndex`) must work uniformly.

**Anti-patterns to avoid:**
- Do NOT depend on bd label ordering — bd does NOT guarantee deterministic label ordering; tests must use set-equality, not array-equality.
- Do NOT mutate `seed.jsonl` — copyFileSync to scratch dir; mutate via the adapter (CONF-03 byte-identity).

---

### `tests/conformance/foundational-events.test.mjs` (CREATE — 10 dispatch types)

**Analog:** `tests/unit/findBeadsRoot.test.mjs` (live bd) + `tests/unit/bd-helper.test.mjs` (mock-bd shim for negative cases).

**Live-bd pattern (from `findBeadsRoot.test.mjs:14-36`):**

```javascript
// uses execSync('bd init --non-interactive --skip-agents --prefix wt') — real bd
function worktreeBeadsFixture() { /* ... */ }

test('findBeadsRoot CASE 1: worktree resolves to source repo', (t) => {
  const { root, src, wt } = worktreeBeadsFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(findBeadsRoot(wt), src);
});
```

**10 dispatch-type tests per D-09 (memory + comment storage shapes):**

```javascript
import { spawnSync } from 'node:child_process';

const MEMORY_TYPES = ['decision', 'blocker_added', 'blocker_resolved',
  'metric', 'todo_count_update', 'deferred_items', 'roadmap_evolution'];
const COMMENT_TYPES = ['session', 'quick_task', 'forensic_session'];

export function runConformance(makeAdapter, label) {
  describe(`Foundational: events [${label}]`, () => {

    for (const type of MEMORY_TYPES) {
      test(`recordStateEvent type=${type} writes to bd memory`, async (t) => {
        const { adapter, projectRoot } = await makeAdapter(t);
        const payload = { id: `${type}-id-1`, milestone: 'v1.0', body: 'test' };
        await adapter.recordStateEvent({ type, payload });

        // Read-back via direct bd call (D-12 — NOT Phase 9+ read methods)
        const out = spawnSync('bd', ['recall', `v1.0:${type}:${type}-id-1`], {
          cwd: projectRoot, encoding: 'utf-8'
        });
        assert.equal(out.status, 0);
        const stored = JSON.parse(out.stdout);
        assert.deepEqual(stored, payload);
      });
    }

    for (const type of COMMENT_TYPES) {
      test(`recordStateEvent type=${type} writes to bd comment authored as gsd:event:${type}`, async (t) => {
        // bd comments do NOT support labels; D-09 amended: --author gsd:event:<type>
        // Read-back via `bd comments <milestoneBead> --json` then filter
      });
    }
  });
}
```

**Differences:**
- 10 dispatch tests per D-12 (write+read storage shape; read-back uses bd directly, NOT Phase 9+ adapter methods).
- D-09 amended in RESEARCH.md: comments are authored-as `gsd:event:<type>` (not labeled) — bd comments do NOT support labels in v1.0.3.

**Anti-patterns to avoid:**
- Do NOT skip `BEADS_ACTOR=seed` on the recordStateEvent calls — D-20 / determinism. Conformance asserts memory-key shape; without the env, key prefix may drift.
- Do NOT use `bd remember get` (verified non-existent in v1.0.3) — use `bd recall <key>`.
- Do NOT use Phase 9+ read methods — D-12 mandates direct `bd` calls for the storage-shape assertions.

---

### `tests/conformance/foundational-namedDoc.test.mjs` (CREATE)

**Analog:** `tests/unit/findBeadsRoot.test.mjs` (mkdtemp + live bd).

**Per-category dual-write test (D-10):**

```javascript
const CATEGORIES = ['intel', 'codebase', 'research', 'archived-milestone',
  'debug-knowledge-base', 'learnings', 'methodology', 'discussion-log', 'discovery'];

export function runConformance(makeAdapter, label) {
  describe(`Foundational: namedDoc [${label}]`, () => {

    for (const category of CATEGORIES) {
      test(`putNamedDoc(${category}, key) writes disk + memory index`, async (t) => {
        const { adapter, projectRoot } = await makeAdapter(t);
        const body = `# ${category} doc\n\nbody\n`;
        await adapter.putNamedDoc(category, 'test-key', body);

        // Disk file present
        const filePath = join(projectRoot, '.planning', category, 'test-key.md');
        assert.ok(existsSync(filePath));
        assert.equal(readFileSync(filePath, 'utf-8'), body);

        // bd memory index present
        const out = spawnSync('bd', ['recall', `gsd-beads:named-doc:${category}:test-key`], {
          cwd: projectRoot, encoding: 'utf-8'
        });
        assert.equal(out.status, 0);
        const idx = JSON.parse(out.stdout);
        assert.ok(idx.last_write);  // ISO timestamp
      });

      test(`getNamedDoc(${category}, key) reads from disk`, async (t) => {
        // ...
      });
    }
  });
}
```

**Differences:**
- Iterates the 9-category enum (`NAMED_DOC_CATEGORIES` from `pathRouter.mjs`) so adding a category is a one-line registry edit + automatic conformance coverage.

**Anti-patterns to avoid:**
- Do NOT inline the body in the bd memory value — D-10 stores `existence + last_write timestamp + (optional) content hash`, NOT the body itself.
- Do NOT skip the disk write — D-10 / REQ-07 mandates body-on-disk for grep-readability.

---

### `tests/conformance/foundational-snapshot.test.mjs` (CREATE)

**Analog:** `tests/unit/findBeadsRoot.test.mjs` (mkdtempSync + bd init + assert).

**Round-trip pattern (from RESEARCH.md §"Pattern 5", lines 583-597):**

```javascript
export function runConformance(makeAdapter, label) {
  describe(`Foundational: snapshot/restore [${label}]`, () => {

    test('snapshot then mutate then restore round-trips bd state', async (t) => {
      const { adapter, projectRoot } = await makeAdapter(t);

      // 1. snapshot the initial bd state
      const snap = await adapter.snapshot();
      assert.ok(existsSync(snap));

      // 2. mutate: add a memory
      spawnSync('bd', ['remember', 'mutation-marker', '--key', 'gsd-beads:test:marker'], {
        cwd: projectRoot,
        env: { ...process.env, BEADS_ACTOR: 'seed' },
        encoding: 'utf-8',
      });

      // 3. verify mutation present
      let recall = spawnSync('bd', ['recall', 'gsd-beads:test:marker'], {
        cwd: projectRoot, encoding: 'utf-8',
      });
      assert.equal(recall.status, 0);

      // 4. restore from snapshot
      const restored = await adapter.restore(snap);

      // 5. mutation MUST be absent in restored bd
      recall = spawnSync('bd', ['recall', 'gsd-beads:test:marker'], {
        cwd: restored, encoding: 'utf-8',
      });
      assert.notEqual(recall.status, 0);  // not found
    });
  });
}
```

**Differences:**
- Snapshot scope is bd-only per D-11 (`bd export --json -o <path>`; memories included by default in v1.0.3 — verified RESEARCH §"Standard Stack").
- Restore re-imports via `bd init --from-jsonl --prefix --non-interactive --skip-agents --skip-hooks --quiet` per D-11 / spike-findings storage-and-distribution.

**Anti-patterns to avoid:**
- Do NOT skip `--skip-hooks` on restore — would re-trigger archived v0.2 hooks if any reach the restored project.
- Do NOT skip `BEADS_ACTOR=seed` — D-20 / determinism contract.
- Do NOT snapshot disk-routed records — D-11 narrows scope; consumer cp -r the `.planning/` tree if needed.

---

### `tests/conformance/capabilities.test.mjs` (CREATE — flag shape lint)

**Analog:** `tests/unit/beads-errors.test.mjs:21-23` (`Object.isFrozen` lint).

**Lint pattern (from analog):**

```javascript
test('CASE 2: BeadsCause is frozen — mutation throws or no-op', () => {
  assert.ok(Object.isFrozen(BeadsCause));
});
```

**Three-test capabilities lint:**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BeadsAdapter } from '../../src/adapter.mjs';
import { UnsupportedOperationError } from '../../src/bd/errors.mjs';

export function runConformance(makeAdapter, label) {
  describe(`Capabilities flag [${label}]`, () => {

    test('shape: 7 keys exactly with locked booleans (D-16 / D-2026-04-30-05)', () => {
      assert.ok(Object.isFrozen(BeadsAdapter.capabilities));
      assert.deepEqual(BeadsAdapter.capabilities, {
        record: true,
        section: true,
        binaryAsset: false,
        snapshot: true,
        transaction: false,
        namedDoc: true,
        commitPlanningState: false,
      });
    });

    test('lint: each `false` value has JSDoc rationale comment in source', () => {
      // Read src/adapter.mjs as text; verify a comment block precedes each
      // `false` literal — Phase 7 SC#1 requirement
    });

    test('writeBinaryAsset throws UnsupportedOperationError with locked message format (D-16)', async (t) => {
      const { adapter } = await makeAdapter(t);
      await assert.rejects(
        () => adapter.writeBinaryAsset('.planning/foo.png', new Uint8Array()),
        (err) => {
          assert.ok(err instanceof UnsupportedOperationError);
          assert.match(err.message,
            /^BeadsAdapter\.writeBinaryAsset: not supported \(capabilities\.binaryAsset=false\)\./);
          return true;
        }
      );
    });
  });
}
```

**Differences:**
- Three locked tests: shape, JSDoc-rationale lint (regex-grep against source), throw-message format.
- The JSDoc lint test parses `src/adapter.mjs` as TEXT and asserts comment proximity to each `false` literal — minimal but sufficient.

**Anti-patterns to avoid:**
- Do NOT change the literal shape — D-2026-04-30-05 fixed the seven-bit shape.
- Do NOT use `expect(...).rejects` style — node:test uses `assert.rejects` (per existing tests).
- Do NOT match the throw message loosely — RESEARCH.md §D-16 locks the exact prefix: `"BeadsAdapter.<method>: not supported (capabilities.<flag>=false). <hint>"`.

---

### `tests/fixtures/seed.jsonl` (ENRICH via build-seed.sh)

**Analog:** `tests/fixtures/build-seed.sh` (the canonical regenerator; D-07 byte-identity).

**Existing convention (from `build-seed.sh:1-29`):**

```bash
#!/usr/bin/env bash
# Source-of-truth bash script for tests/fixtures/seed.jsonl.
# CONVENTION (Pitfall 7): seed.jsonl is regenerated from this script,
# NOT hand-edited.
#
# Pitfall 8 mitigation: BEADS_ACTOR=seed on every bd invocation.
# D-07 determinism contract: byte-identical bd state across runs.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

BEADS_ACTOR=seed bd init --non-interactive --skip-agents --prefix sd --quiet >/dev/null
```

**Existing label-add pattern (lines 33-43 — multiply this for additive enrichment):**

```bash
P11=$(BEADS_ACTOR=seed bd q "v0.1 Phase A: Spike" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P11" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$P11" version:v0.1 >/dev/null
BEADS_ACTOR=seed bd label add "$P11" phase-id:01 >/dev/null
BEADS_ACTOR=seed bd close "$P11" >/dev/null
```

**Existing memory-write pattern (lines 144-146):**

```bash
BEADS_ACTOR=seed bd remember "Foundation" --key "gsd-beads:milestone:v0.1:heading" >/dev/null
BEADS_ACTOR=seed bd remember "Beads-backed reads" --key "gsd-beads:milestone:v0.2:heading" >/dev/null
```

**Phase 7 enrichments (one-time additive; preserve CONF-03 byte-identity post-edit):**
- Add records for path-router exercises (specific phase beads with all the Phase 7 router-resolvable label combinations).
- Add sample memories for `recordStateEvent` reads (one of each MEMORY_EVENT_TYPE per D-09).
- Add sample comments for COMMENT_EVENT_TYPES (authored-as `gsd:event:<type>`).
- Add named-doc index memories (`gsd-beads:named-doc:<category>:<key>`).

**Differences from existing seed:**
- Additive only — never modify or remove existing records (CONF-03 byte-identity invariant).
- Each new bd invocation MUST use `BEADS_ACTOR=seed` (Pitfall 8 / D-20).
- Final step (line 152) re-exports the canonical JSONL — Phase 7 reruns `build-seed.sh` and commits the regenerated file.

**Anti-patterns to avoid:**
- Do NOT hand-edit `seed.jsonl` — Pitfall 7 / D-07 demands regeneration from `build-seed.sh` only.
- Do NOT omit `BEADS_ACTOR=seed` on any new bd call — Pitfall 8 / committed-actor leak risk.
- Do NOT delete existing records — CONF-03 byte-identity requires the existing assertions in `tests/unit/{seed-determinism, memories-seeded, milestone-scoping}.test.mjs` continue to pass.

---

### `package.json` (verify `test:conformance` script body)

**Analog:** self, lines 27-32.

**Existing scripts block:**

```json
"scripts": {
  "test": "node --test 'tests/unit/**/*.test.mjs' 'tests/conformance/**/*.test.mjs'",
  "test:unit": "node --test 'tests/unit/**/*.test.mjs'",
  "test:conformance": "node --test 'tests/conformance/**/*.test.mjs'",
  "link:fork": "npm link ../get-shit-done"
}
```

**Differences for Phase 7:**
- The `test:conformance` slot is already populated correctly. Verify (no edit needed unless existing body drifts).
- If Phase 7 adopts a driver-only pattern (run.mjs invokes each `runConformance`), the script may shift to `node --test tests/conformance/run.mjs` — plan-phase decides. Both invocations will work; the difference is whether the test reporter sees one bundled file or 7 individual files.

**Anti-patterns to avoid:**
- Do NOT add new npm dependencies for Phase 7 — RESEARCH §"Standard Stack" verifies zero new deps required.
- Do NOT change `engines.node` — `>=20` per Phase 6; `node:test` requires Node 20+.

---

## Shared Patterns

### Authentication / Lazy bd Validation

**Source:** `src/adapter.mjs:36-48` (`_ensureBd`).
**Apply to:** Every primitive that touches bd; primitives that pass through to disk skip it (D-18).

```javascript
/** Lazy bd validation per D-02. */
_ensureBd() {
  if (this._beadsValidated) return this._beadsRoot;
  const root = findBeadsRoot(this.projectRoot);
  if (!root) {
    throw new BeadsEmpty(
      'BeadsAdapter: project at ' + this.projectRoot + ' is not bd-managed'
    );
  }
  this._beadsRoot = root;
  this._beadsValidated = true;
  return root;
}
```

### Error Handling — Sentinel Subtype Hierarchy

**Source:** `src/bd/errors.mjs:18-55` + `src/bd/helper.mjs:23-36`.
**Apply to:** Every `bd()` call site; all primitive method bodies that touch bd.

```javascript
// Throw sentinel subtypes; let propagation surface them at the public boundary.
if (result.error?.code === 'ENOENT') {
  throw new BeadsNotInstalled('bd binary not found on PATH', { originalError: result.error });
}
if (result.status !== 0) {
  const stderr = (result.stderr ?? '').trim();
  if (/database|dolt|metadata\.json/i.test(stderr)) {
    throw new BeadsCorrupt(`bd ${args[0]} failed: ${stderr}`, { originalError: new Error(stderr) });
  }
  throw new BeadsCorrupt(`bd ${args[0]} failed (status ${result.status}): ${stderr}`);
}
```

For `writeBinaryAsset` (the sole intentionally-unsupported op):

```javascript
throw new UnsupportedOperationError(
  `BeadsAdapter.writeBinaryAsset: not supported (capabilities.binaryAsset=false). bd has no binary blob store; configure an external sink in v1.1+.`
);
```

### Validation — Input Type Checks

**Source:** `src/adapter.mjs:28-30` (constructor TypeError) + RESEARCH §Pattern 1 router.
**Apply to:** Every public method's first executable line.

```javascript
if (typeof path !== 'string' || path.length === 0) {
  throw new TypeError('BeadsAdapter.<method>: path must be a non-empty string');
}
```

### Determinism — `BEADS_ACTOR=seed`

**Source:** `tests/fixtures/build-seed.sh` + `src/bd/helper.mjs` (`env` option).
**Apply to:** Every bd invocation that participates in committed state (snapshot, restore, recordStateEvent memory writes, named-doc index, fixture init).

```javascript
bd(['remember', JSON.stringify(payload), '--key', key], {
  env: { ...process.env, BEADS_ACTOR: 'seed' },
  parseJson: false,
});
```

### Test Setup — mkdtempSync + t.after()

**Source:** `tests/unit/findBeadsRoot.test.mjs:14-36`.
**Apply to:** Every conformance test file's per-test setup (via `setupFreshAdapter`).

```javascript
const root = mkdtempSync(join(tmpdir(), 'gsd-conf-'));
// ... build fixture inside root ...
t.after(() => rmSync(root, { recursive: true, force: true }));
```

### Module Shape — Named Exports + JSDoc + Top-Level Constants

**Source:** `src/format/phase.mjs:1-52` + `src/helpers/parsePhaseId.mjs:1-17`.
**Apply to:** All new `src/format/`, `src/adapter/pathRouter.mjs`, and `src/helpers/` files.

```javascript
// File header comment explaining role + decisions referenced
//
// Constants at top of file
const SOMETHING_RE = /.../;

/**
 * One-paragraph description.
 *
 * @param {string} arg — what arg is
 * @returns {ReturnType}
 * @throws {Error} when invalid input
 */
export function namedFunction(arg) { /* ... */ }
```

### Frozen Enums

**Source:** `src/bd/errors.mjs:10-16` (`BeadsCause`).
**Apply to:** `pathRouter.PATTERNS`, `pathRouter.NAMED_DOC_CATEGORIES`, `MEMORY_EVENT_TYPES`, `COMMENT_EVENT_TYPES`, `BeadsCause` (extended with `Unsupported`).

```javascript
export const SOME_ENUM = Object.freeze({
  Foo: 'foo',
  Bar: 'bar',
});
```

### Conformance Test Export Shape

**Source:** RESEARCH.md §"Pattern 6" (lines 644-676).
**Apply to:** Every file under `tests/conformance/*.test.mjs`.

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

export function runConformance(makeAdapter, label) {
  describe(`<cluster> [${label}]`, () => {
    test('test name', async (t) => {
      const { adapter } = await makeAdapter(t);
      // ...
    });
  });
}
```

NB: do NOT auto-register tests at top level — driver invokes via `for (const f of factories) runConformance(f.factory, f.label)`. If `RUN_CROSS_ADAPTER=1` is unset, only `beads` factory runs.

## No Analog Found

None — every Phase 7 file has a viable codebase analog. The closest "no analog" candidates are:

- **`src/format/section.mjs:locateSection`** — there is no existing section-locator in the codebase; however, `src/format/phase.mjs` provides the module-shape analog and RESEARCH.md §"Pattern 2" provides the algorithm. **Verdict:** sufficient analog; no gap.
- **`src/format/frontmatter.mjs`** — no existing YAML parser; same situation as above. RESEARCH.md §"Pattern" describes a 40-line hand-roll. **Verdict:** sufficient analog via RESEARCH.md.
- **`UnsupportedOperationError`** — sibling to existing 4 subtypes in `errors.mjs`; pattern is exact.

## Metadata

**Analog search scope:**
- `src/` (all subdirectories: `adapter/`, `bd/`, `format/`, `helpers/`)
- `tests/unit/` (all 17 test files)
- `tests/fixtures/` (build-seed.sh + seed.jsonl)
- `package.json`

**Files scanned:** ~30 source/test/fixture files.

**Pattern extraction date:** 2026-04-30

**Key invariants (drawn from CLAUDE.md + spike-findings):**
1. `spawnSync` only — never `execSync` for production code.
2. `BEADS_ACTOR=seed` on every bd call that participates in committed state.
3. ≤2 bd spawns per public-method invocation.
4. `Object.freeze` on every enum-like constant.
5. Repo-relative paths in/out at every adapter boundary.
6. Fresh-fixture-per-test via `mkdtempSync` + `t.after()`; `seed.jsonl` is read-only fixture material.
7. Hand-roll over heavy deps when the input vocabulary is bounded (no `mdast-util`, no `gray-matter`, no `github-slugger` in Phase 7).
8. Stub-style `'BeadsAdapter.<m>: not implemented (Phase N / IMPL-NN)'` if execution-time scope reduction needs it (none expected).
