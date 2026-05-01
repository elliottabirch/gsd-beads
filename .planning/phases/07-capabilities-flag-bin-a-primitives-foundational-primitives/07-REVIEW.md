---
phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/adapter.mjs
  - src/adapter/_atomicWrite.mjs
  - src/adapter/pathRouter.mjs
  - src/adapter/primitives.mjs
  - src/bd/errors.mjs
  - src/format/frontmatter.mjs
  - src/format/section.mjs
  - tests/conformance/binA-frontmatter.test.mjs
  - tests/conformance/binA-records.test.mjs
  - tests/conformance/binA-section.test.mjs
  - tests/conformance/capabilities.test.mjs
  - tests/conformance/fixture.mjs
  - tests/conformance/foundational-events.test.mjs
  - tests/conformance/foundational-namedDoc.test.mjs
  - tests/conformance/foundational-snapshot.test.mjs
  - tests/conformance/run.mjs
  - tests/fixtures/build-seed.sh
  - tests/fixtures/seed.jsonl
  - tests/unit/adapter-shell.test.mjs
  - tests/unit/atomicWrite.test.mjs
  - tests/unit/beads-errors.test.mjs
  - tests/unit/format-frontmatter.test.mjs
  - tests/unit/format-section.test.mjs
  - tests/unit/pathRouter.test.mjs
  - tests/unit/primitives-events.smoke.test.mjs
  - tests/unit/primitives-frontmatter.smoke.test.mjs
  - tests/unit/primitives-namedDoc.smoke.test.mjs
  - tests/unit/primitives-records.smoke.test.mjs
  - tests/unit/primitives-section.smoke.test.mjs
  - tests/unit/primitives-snapshot.smoke.test.mjs
  - tests/unit/seed-determinism.test.sh
findings:
  blocker: 2
  warning: 11
  total: 13
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-01
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 07 ships the BeadsAdapter shell (capabilities flag), Bin A
primitives (record / section / frontmatter), six foundational
primitives (events / snapshot / namedDoc / writeBinaryAsset), the
closed-enum path router, and the conformance harness. Implementation
quality is solid: ESM hygiene is good, errors are sentinelized via the
BeadsCause enum, BEADS_ACTOR=seed is consistently passed on writes,
atomic-write semantics use POSIX rename, and the closed-enum routing
table is well-bounded.

The review surfaces **two BLOCKERs** that the test suite does not
catch:

1. **Arbitrary-path writes / reads.** Every Bin A primitive resolves
   the caller's path via `pathResolve(this.projectRoot, path)`. When
   `path` is absolute or contains `..` segments that escape
   `projectRoot`, `pathResolve` returns the unrelated path. The
   "repo-relative paths everywhere (D-02)" contract is enforced only
   at the doc level — no runtime check rejects out-of-tree paths.
   `putRecord('/etc/passwd', body)` will write `/etc/passwd`. This is
   not just a doc / contract issue; it is a directory-traversal
   primitive baked into the adapter's most generic write surface.
2. **`putRecord` on namedDoc paths silently bypasses the D-10 dual-
   write contract.** `pathRouter.resolve('.planning/intel/foo.md')`
   returns `tier: 'hybrid'`, but `primitives.mjs` only branches on
   `tier === 'bd'` — every other tier (including `'hybrid'`) falls
   through to disk-only write. So callers who reach for the generic
   `putRecord` instead of `putNamedDoc` get the disk file written
   without the bd memory index entry. Phase 9 aggregation logic that
   walks the bd memory index will silently miss these docs.

The remaining 11 findings are WARNINGs ranging from misleading
comments (`_resolveMilestoneBead` doc lies about its sort), to
round-trip-lossy YAML frontmatter (`formatFrontmatter` quotes are
not escaped), to functional-limit issues (`restore()` hardcodes
prefix `'sd'`).

## BLOCKER

### CR-01: Path traversal via `_abs()` — every Bin A primitive accepts absolute / `..`-escape paths

**Severity:** BLOCKER

**File:** `src/adapter/primitives.mjs:64-66` (helper) — affects
`getRecord`, `putRecord`, `removeRecord`, `getSection`,
`updateSection`, `getFrontmatter`, `updateFrontmatter`,
`mergeFrontmatter`, `listCollection`, `getNamedDoc` (read disk side).

**Issue:** `_abs(adapter, path)` calls `pathResolve(adapter.projectRoot, path)`.
`path.resolve` semantics: when the second argument is absolute it
**replaces** the first; when it contains `..` segments those collapse
against the joined prefix. A caller passing `/etc/passwd` or
`../../etc/passwd` lands outside `projectRoot`. The adapter
documentation (D-02 "repo-relative paths everywhere") is not enforced
at runtime.

Reproducer (Node REPL):
```js
import { resolve } from 'node:path';
resolve('/tmp/proj', '/etc/passwd');           // → '/etc/passwd'
resolve('/tmp/proj', '../../../etc/passwd');   // → '/etc/passwd'
```

Then `await adapter.putRecord('/etc/passwd', 'hi')` writes
`/etc/passwd` (subject to OS permissions). `removeRecord` similarly
unlinks any disk path. `putRecord` is currently the only generic
disk-write primitive, but every read primitive will also silently
exfiltrate file contents from outside the repo.

The conformance suite (`binA-records.test.mjs`, `binA-section.test.mjs`,
`binA-frontmatter.test.mjs`) does not include any traversal /
absolute-path test cases — there is no negative test that
`putRecord('/abs/path', ...)` rejects.

**Note on namedDoc:** `putNamedDoc` / `getNamedDoc` already enforce a
T-7-01 path-separator guard on `key` (`/[/\\]|\.\./.test(key)`). The
fact that *only* the namedDoc surface guards this, while the more
generic Bin A surface does not, suggests the threat was scoped to
namedDoc and not extended to the rest of Bin A.

**Fix:** Validate every `path` argument at the top of each public
primitive (or centralize in `_abs`), rejecting absolute paths and
paths that resolve outside `projectRoot`:

```js
function _abs(adapter, path) {
  const projectRoot = pathResolve(adapter.projectRoot);
  const abs = pathResolve(projectRoot, path);
  // Refuse paths that are absolute (bypass projectRoot) or escape via `..`
  if (!abs.startsWith(projectRoot + sep) && abs !== projectRoot) {
    throw new TypeError(
      `BeadsAdapter: path "${path}" must be repo-relative and inside ${projectRoot}`
    );
  }
  return abs;
}
```

(Add `sep` to imports from `node:path`. Treat the guard as a contract
boundary; both the read- and write-side helpers must call it.)

Also: extend the conformance suite with a negative case asserting
`putRecord('/etc/passwd', ...)` rejects — the absence of this test is
how the gap got past Wave 4.

---

### CR-02: `putRecord` on namedDoc paths silently bypasses D-10 dual-write

**Severity:** BLOCKER

**File:** `src/adapter/primitives.mjs:104-119`

**Issue:** `pathRouter.resolve` tags `.planning/<category>/<key>.md`
paths with `tier: 'hybrid'` (line 75 of `pathRouter.mjs`). The
`putRecord` implementation only branches on `tier === 'bd'`:

```js
async putRecord(path, body) {
  const route = routerResolve(path);
  if (route.tier === 'bd') {
    // ...refuses with Bin B redirect...
  }
  // disk-routed: atomic write via tmpfile + rename (D-08)
  atomicWriteFile(_abs(this, path), body);   // ← also runs for tier='hybrid'
},
```

The disk fallthrough fires for `tier: 'disk'` *and* `tier: 'hybrid'`.
Result: `await adapter.putRecord('.planning/intel/foo.md', body)`
writes the disk file but never writes the bd memory index entry that
`putNamedDoc('intel', 'foo', body)` writes. The D-10 contract
specifies dual-write (disk + bd memory index for existence /
timestamp / byte_length); the index is the substrate Phase 9
aggregation will scan. Callers that reach for `putRecord` instead of
`putNamedDoc` produce silent inconsistency between disk and the bd
index.

Symmetric problem on `removeRecord` (line 121): a namedDoc disk file
gets unlinked without removing its bd memory index entry — leaving an
orphaned index pointing at a non-existent file.

This is not theoretical: the StorageAdapter surface that the fork
calls is the *generic* `putRecord(path, body)` shape. If any consumer
treats namedDoc paths as "just disk paths", the D-10 invariant is
broken.

**Fix:** Make `putRecord` / `removeRecord` either delegate to
`putNamedDoc` / `removeNamedDoc` (when added) for `tier === 'hybrid'`
paths, or refuse with a clear error directing callers at the
domain-specific method:

```js
async putRecord(path, body) {
  const route = routerResolve(path);
  if (route.tier === 'bd') { /* existing refusal */ }
  if (route.tier === 'hybrid' && route.kind === 'namedDoc') {
    return this.putNamedDoc(route.category, route.key, body);
  }
  // genuinely disk-only (tier === 'disk', e.g. plan / opaque)
  atomicWriteFile(_abs(this, path), body);
}
```

Add a conformance test that `putRecord('.planning/intel/foo.md', body)`
results in *both* the disk file AND the
`gsd-beads:named-doc:intel:foo` memory entry. The current
`foundational-namedDoc.test.mjs` tests `putNamedDoc` directly and
never exercises the generic surface.

---

## WARNING

### WR-01: `_resolveMilestoneBead` doc lies about sort behavior

**Severity:** WARNING

**File:** `src/adapter/primitives.mjs:632-647`

**Issue:** The function comment + inline note claim "Deterministic
pick: most recently updated open milestone wins" (line 645). The
implementation does no such thing:

```js
const items = bd(args, { cwd: adapter._beadsRoot });
if (!Array.isArray(items) || !items.length) { /* throw */ }
return items[0].id;   // no sort, no status filter
```

`bd list` currently returns issues in some bd-internal order
(typically reverse-chronological by created_at, but unspecified).
`items[0]` is whatever happened to come first. There is no
`status === 'open'` filter, no `updated_at` sort, and no fallback
explanation. With `--all` enabled (line 637), closed milestones are
returned alongside open ones, and the picked bead may not be the
most recent OR the open one.

For the phase-07 happy-path (single milestone bead per version,
seed.jsonl has at most one matching `gsd:milestone + version:vX.Y`),
this works by accident. As soon as a project accumulates per-
milestone churn (closing v1.0, opening v1.1, both labeled
`gsd:milestone`), the `items[0]` pick will become non-deterministic
or surprise callers.

**Fix:** Either drop the misleading comment and document the
"first-bd-list-result" behavior honestly, OR implement what the
comment claims:

```js
// Filter to open milestones, sort by updated_at desc
const open = items.filter((i) => i.status === 'open');
if (!open.length) {
  throw new Error(`recordStateEvent: no OPEN milestone bead found ...`);
}
open.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
return open[0].id;
```

---

### WR-02: `formatFrontmatter` produces invalid YAML for values with `:`, quotes, or newlines

**Severity:** WARNING

**File:** `src/format/frontmatter.mjs:79-94`

**Issue:** `formatFrontmatter` writes `${k}: ${v}` verbatim with no
escaping. Round-tripping a value containing characters that are
significant to the parser produces incorrect output:

```js
import { formatFrontmatter, parseFrontmatter } from './frontmatter.mjs';
const fm = { other: '"quoted"' };
const out = formatFrontmatter(fm, 'body');
// out: '---\nother: "quoted"\n---\nbody'
parseFrontmatter(out).frontmatter;
// → { other: 'quoted' }   (parser strips the quotes via coerce())
```

Other fragile inputs:
- Newline in value: produces a multi-line YAML that the regex parser
  splits on, dropping content after the first newline silently.
- Value matching booleans / numbers (`'true'`, `'42'`): coerced on
  parse, type-mismatched on next read.
- Value starting with `"` or `'` and ending with the same quote: the
  `coerce` regex `^("|').*\1$` strips the surrounding quotes.
- Empty string (`''`): emitted as `${k}: \n`, but the parser treats
  `key:` (empty value) as a *list header*, returning `[]` not `''`
  (see WR-03).

**Fix:** Either escape values that contain YAML-significant
characters (quote them, doubling internal quotes), or — since the
parser docstring already warns "If a nested-object frontmatter
appears in the future, escalate to gray-matter@4.0.3" — add a guard
that throws on unsafe-to-emit scalars:

```js
function _emitScalar(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  if (/[:#\n"']/.test(s) || s !== s.trim()) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
```

Add a round-trip test for inputs containing `:`, quotes, leading /
trailing whitespace, and newlines.

---

### WR-03: `parseFrontmatter` empty-value ambiguity: `key:` → `[]` (never `''`)

**Severity:** WARNING

**File:** `src/format/frontmatter.mjs:43-53`

**Issue:** When a key has no value (`key:` followed by EOL), the
parser unconditionally treats it as a list header:

```js
if (v === '') {
  // List header — collect items on subsequent lines
  currentKey = k;
  currentList = [];
  fm[k] = currentList;
}
```

This means an empty scalar string can NEVER round-trip:
- `formatFrontmatter({ key: '' }, 'body')` emits `key: \n`
- `parseFrontmatter('---\nkey:\n---\nbody')` returns `{ key: [] }`

The user's empty-string scalar is silently transformed to an empty
array. This is observable when `updateFrontmatter('foo.md', 'k', '')`
is followed by `getFrontmatter('foo.md', 'k')` returning `[]`.

**Fix:** Disambiguate by peeking at the next line: if it begins with
the list-item marker (`/^\s+-\s+/`), treat as list header; otherwise
treat as empty scalar (or `null`).

```js
if (v === '') {
  const nextLine = lines[lineIdx + 1] ?? '';
  if (/^\s+-\s+/.test(nextLine)) {
    currentKey = k; currentList = []; fm[k] = currentList;
  } else {
    fm[k] = '';   // or null, depending on convention
  }
}
```

---

### WR-04: `restore()` hardcodes prefix `'sd'` — fails silently for other-prefix snapshots

**Severity:** WARNING

**File:** `src/adapter/primitives.mjs:480-482`

**Issue:**

```js
bd(['init', '--from-jsonl', '--prefix', 'sd', /* … */], { cwd: dir, /* … */ });
```

The doc admits this ("a future plan derives prefix dynamically from
the snapshot's issue ids"). Effect: any snapshot whose issue ids are
`gb-…`, `proj-…`, etc., gets restored into a `.beads/` initialized
with prefix `'sd'`. bd's hash-ID generation uses the prefix during
verification; mixed-prefix state may either reject the import or
write inconsistent ids on subsequent mutations.

This breaks snapshot/restore as a consumer-portable primitive — it
only works for the gsd-beads test fixture, which is exactly the
seed.jsonl. Any consumer who calls `snapshot` on their real project
and `restore` on the same snapshot loses prefix fidelity.

**Fix:** Derive the prefix from the snapshot itself:

```js
async restore(snapshotRef) {
  // ... existing validation ...
  // Read the first non-empty JSONL line, extract the prefix from its `id` field
  const firstLine = readFileSync(snapshotRef, 'utf-8')
    .split('\n').find((l) => l.trim().length > 0);
  let prefix = 'sd';
  if (firstLine) {
    const parsed = JSON.parse(firstLine);
    const m = /^([a-z]+)-/.exec(parsed.id ?? '');
    if (m) prefix = m[1];
  }
  // ... continue with derived prefix ...
}
```

Add a conformance test that takes a snapshot of a `gb-`-prefixed
project and asserts the restored project preserves the `gb-` prefix.

---

### WR-05: `atomicWriteFile` tmpfile name collides on concurrent same-target writes

**Severity:** WARNING

**File:** `src/adapter/_atomicWrite.mjs:23-26`

**Issue:** Tmp filename uses `${pid}.${Date.now()}` — millisecond
resolution. Two concurrent `atomicWriteFile` calls in the same
process targeting the same path within ≤1 ms produce identical
tmpfile paths:

```js
> `tmp.${process.pid}.${Date.now()}` === `tmp.${process.pid}.${Date.now()}`
true   // if both expressions evaluate inside the same millisecond
```

Effect: writer B may overwrite writer A's tmpfile content before A's
rename runs. The rename(2) is atomic, but the *content* placed there
is the wrong writer's. Final state is last-rename-wins (normal
contention), but the content can be a torn mix if writers interleave
between writeFileSync + renameSync.

The atomic-write primitive is called from `putRecord`,
`updateSection`, `updateFrontmatter`, `mergeFrontmatter`,
`putNamedDoc`. Any node:test parallelism (or app-level concurrency)
on the same path triggers the race.

**Fix:** Append a process-unique random suffix:

```js
import { randomBytes } from 'node:crypto';
// ...
const tmpPath = resolve(
  dir,
  `.${basename(absPath)}.tmp.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}`
);
```

`randomBytes(4)` is 32 bits — collision-free for any practical
contention level.

---

### WR-06: `_resolveMilestoneBead` does not validate `payload.milestone` for COMMENT_EVENT_TYPES

**Severity:** WARNING

**File:** `src/adapter/primitives.mjs:366-420`

**Issue:** Inside `recordStateEvent`, the MEMORY_EVENT_TYPES branch
explicitly validates that `payload.milestone` is set (line 383).
The COMMENT_EVENT_TYPES branch does not:

```js
if (COMMENT_EVENT_TYPES.has(type)) {
  const milestoneBead = _resolveMilestoneBead(this, payload.milestone);
  // payload.milestone may be undefined here; falls through to fallback
}
```

`_resolveMilestoneBead(adapter, undefined)` skips the
`version:<milestone>` filter and returns whichever bead bd lists
first (see WR-01 for the determinism issue). So a caller writing a
session event without `payload.milestone` silently writes the comment
on whichever milestone bead happens to be `items[0]` — no error, no
warning.

**Fix:** Add the same `payload.milestone` validation gate at the
start of the COMMENT_EVENT_TYPES branch:

```js
if (COMMENT_EVENT_TYPES.has(type)) {
  if (!payload.milestone) {
    throw new Error(`recordStateEvent: type=${type} requires payload.milestone`);
  }
  const milestoneBead = _resolveMilestoneBead(this, payload.milestone);
  // ...
}
```

---

### WR-07: `bd helper` JSONL fallback masks malformed JSON as empty array

**Severity:** WARNING

**File:** `src/bd/helper.mjs:43-56`

**Issue:** When `JSON.parse(stdout)` throws, the helper falls through
to "split on `\n`, parse each line as JSON". If the original stdout
was a single malformed JSON object (e.g. truncated), and after split
the empty-line filter leaves no lines, the helper returns `[]`
without surfacing an error:

```js
const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
let jsonlParsed;
try {
  jsonlParsed = lines.map(line => JSON.parse(line));
} catch (jsonlErr) { throw new BeadsCorrupt(...); }
return jsonlParsed;   // could be [] for empty stdout
```

Empty `stdout` (or stdout containing only whitespace) returns `[]`,
which is indistinguishable from "no records". A malformed JSON that
becomes empty after filtering is masked.

This is mostly defensive — bd is unlikely to emit empty stdout
without exit non-zero. But it's a quiet failure mode for "JSON parse
fails AND lines.length === 0".

**Fix:** Reject empty parse results on the JSON-fallback path:

```js
} catch {
  const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) {
    throw new BeadsCorrupt(
      `bd ${args[0]} returned non-JSON empty/blank stdout`,
      { originalError: new Error('empty stdout after JSON parse failure') }
    );
  }
  // ... existing JSONL parse ...
}
```

(Note: `helper.mjs` is in `<files_to_read>` indirectly — it is
imported by primitives.mjs and exercises the same JSONL path. The
file itself is not in the diff scope, but the issue surfaces because
`bd export --json -o <path>` is now used by `snapshot()`.)

---

### WR-08: `listCollection` on non-collection bd path silently disk-falls-through

**Severity:** WARNING

**File:** `src/adapter/primitives.mjs:135-173`

**Issue:**

```js
if (route.tier === 'bd' && route.collection) { /* bd branch */ }
// fall-through: disk
```

`route.tier === 'bd' && !route.collection` paths (e.g.
`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — singletons)
silently fall through to `readdirSync(_abs(this, '.planning/ROADMAP.md'))`.
Because that path is a *file* (not a dir), the `existsSync` short-
circuit returns `[]`. Caller receives empty array with no error
indicating that `listCollection` is the wrong primitive.

**Fix:** Add an explicit refusal for `tier === 'bd' && !collection`:

```js
if (route.tier === 'bd' && !route.collection) {
  throw new Error(
    `BeadsAdapter.listCollection: path "${prefix}" routes to bd singleton (kind=${route.kind}); use getRecord instead`
  );
}
```

---

### WR-09: Section parser collapses skipped heading levels via `.filter(Boolean)`

**Severity:** WARNING

**File:** `src/format/section.mjs:51-77`

**Issue:** When the document skips levels (e.g. `# A` → `### Foo`)
or has a heading whose slug is empty (`## ***` → `slugify` returns
`''`), the path-slug stack is built with `.filter(Boolean)`:

```js
stack.length = level;
stack[level - 1] = slugify(m[2]);
const path = stack.slice(0, level).filter(Boolean);
```

Effect: `# A` → `### Foo` produces `path === ['a', 'foo']` even
though no `## foo` heading exists. Both anchors `'a/foo'` and
`'a//foo'` (with double slash) match the same heading, since
`anchor.split('/').filter(Boolean)` and `path.filter(Boolean)` apply
the same transform.

For Phase 7 the impact is small (well-formed planning docs use
contiguous heading levels). But this is a parsing ambiguity: two
different anchors resolve to the same section, and the parser
silently accepts non-existent intermediate levels.

**Fix:** Reject the path if any intermediate slug was empty (i.e. do
not `.filter(Boolean)`; require explicit empty-slug match) — or
document the level-skip behavior as intentional in `section.mjs`'s
header comment. The current behavior is undocumented.

---

### WR-10: `writeBinaryAsset(path, bytes)` — parameters declared but unused, no validation

**Severity:** WARNING

**File:** `src/adapter/primitives.mjs:582-588`

**Issue:** `writeBinaryAsset(path, bytes)` declares both parameters
but uses neither:

```js
async writeBinaryAsset(path, bytes) {
  throw new UnsupportedOperationError(/* ... */);
}
```

Per current spec the method always throws — but:
1. No type validation: `writeBinaryAsset(null, undefined)` and
   `writeBinaryAsset({}, 'oops')` both throw the same
   `UnsupportedOperationError`. Consumers cannot distinguish a
   "wrong-arity call" from a "feature flag off" call.
2. When v1.1+ adds a configurable external sink (per the rationale
   comment at `adapter.mjs:60`), the signature is the only contract
   surface. Adding parameter validation now (even just
   `typeof path === 'string'` and `bytes instanceof Uint8Array`)
   tightens the contract before the implementation lands.

**Fix:** Either drop the parameter names (`writeBinaryAsset()`) to
make "unused" explicit, or add basic shape validation:

```js
async writeBinaryAsset(path, bytes) {
  if (typeof path !== 'string' || !path.length) {
    throw new TypeError('writeBinaryAsset: path must be a non-empty string');
  }
  if (!(bytes instanceof Uint8Array || Buffer.isBuffer(bytes))) {
    throw new TypeError('writeBinaryAsset: bytes must be Uint8Array or Buffer');
  }
  throw new UnsupportedOperationError(/* ... */);
}
```

---

### WR-11: `_labelsToFrontmatter` `id` / `status` precedence is non-obvious

**Severity:** WARNING

**File:** `src/adapter/primitives.mjs:610-622`

**Issue:** The helper synthesizes a frontmatter object from a bd
issue's labels:

```js
function _labelsToFrontmatter(issue) {
  const fm = { id: issue.id, status: issue.status };
  for (const label of issue?.labels ?? []) {
    // ... label like 'status:ready' overrides fm.status here ...
  }
  return fm;
}
```

Behavior: `fm.status` starts as `issue.status` (bd's intrinsic
issue status — `'open'` / `'closed'`), but a label like
`status:ready` *overrides* it. `binA-frontmatter.test.mjs:78-100`
asserts this precedence (`assert.equal(fm.status, 'ready')`),
but the docstring on `_labelsToFrontmatter` does not call it out:

> "bd labels of the form `<key>:<value>` become {key: value};
> bare labels become boolean flags."

The `id` / `status` seed values are silently shadowed by labels of
the same key. A consumer expecting `fm.status` to mean "bd issue
status" will see the label-status instead, with no warning.

**Fix:** Either rename the seed slots (e.g.
`{ _bd_id, _bd_status }`) so labels don't collide, or document the
override precedence in the helper's docstring:

```js
/**
 * ...
 * NOTE: Reserved keys `id` and `status` are seeded from the bd issue's
 * intrinsic id + status fields, but a label of the form `status:<v>`
 * (or `id:<v>`) WILL override the seeded value. Callers should treat
 * fm.status as "label-status if present, else bd-status".
 */
```

---

## Out-of-scope notes

The following observations are NOT findings — they are noted to help
the next reviewer / fixer triage:

- `tests/fixtures/seed.jsonl` is currently `git status: M` (modified
  but uncommitted). Either the recently-regenerated seed or stale
  state. Confirm before/after fixes that committed seed matches what
  `build-seed.sh` produces.
- `src/format/section.mjs` references "Pitfall 8" (code-fence
  guard) which collides with `tests/fixtures/build-seed.sh`'s
  "Pitfall 8" (BEADS_ACTOR=seed). These come from different RESEARCH
  documents. Cosmetic / cross-doc, not a code defect.
- `primitives.mjs:55-58` retains a comment block describing the
  "now-removed canonical stub helper" — historical noise. Safe to
  delete in a future cleanup pass.
- `restore()` uses dynamic `import('node:child_process')` inline
  (line 472). Top-level `import` would be cleaner; current form is
  fine and only imports once due to ESM caching.

---

_Reviewed: 2026-05-01_
_Reviewer: Claude Opus 4.7 (gsd-code-reviewer)_
_Depth: standard_
