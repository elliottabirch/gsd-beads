/**
 * BeadsAdapter Bin A primitives + foundational primitives (except
 * transaction/snapshot/restore — Plan 06-06 scope).
 *
 * Every method dispatches via `resolveRoute(path)` — SP-1 router-first
 * pattern. Bd-tier calls go through BdRunner (Plan 06-02); disk-tier uses
 * atomicWriteFile (WR-05 fixed via crypto.randomBytes) + the `_abs()` guard.
 *
 * CR-01 BLOCKER fix: `_abs(projectRoot, path)` guards every disk-tier path
 * conversion. Rejects absolute paths, `..` escapes, and symlink-escape
 * scenarios with a TypeError.
 *
 * Per D-04 (Phase 3): adapter stays thin. Domain logic (addPhase, etc.)
 * lives in the fork SDK, not here. These primitives are the Bin A contract
 * only.
 *
 * Method shape: each export takes (projectRoot, ensure, ...args). The
 * BeadsAdapter class in ./index.ts delegates to these, providing
 * `() => this._ensureBd()` as the `ensure` callback so disk-tier paths
 * never touch bd.
 */

import {
  readFileSync,
  existsSync,
  statSync,
  rmSync,
  readdirSync,
  unlinkSync,
  realpathSync,
} from 'node:fs';
import {
  resolve as pathResolve,
  sep as pathSep,
  dirname as pathDirname,
} from 'node:path';
import type {
  RecordRef,
  RecordFilter,
  SectionMode,
  NamedDocCategory,
} from 'get-shit-done-cc/adapters/types.js';
import { resolveRoute } from './paths.js';
import type { BeadsRuntimeState } from './init.js';
import { BeadsEmpty } from './bd/errors.js';
import { atomicWriteFile } from './_atomicWrite.js';
import { locateSection, rewriteSection } from './format/section.js';
import {
  parseFrontmatter,
  formatFrontmatter,
  mergeFrontmatter,
  type FrontmatterValue,
} from './format/frontmatter.js';
import { materializeGraphJson } from './dep-graph.js';

/**
 * CR-01 BLOCKER fix: centralized path-traversal guard. Resolves `relPath`
 * against `projectRoot` and asserts the resolved path stays inside
 * `projectRoot`. Throws TypeError on:
 *   - absolute paths (e.g. `/etc/passwd`)
 *   - `..` escapes (e.g. `../../etc/passwd`)
 *   - Windows-style escapes (e.g. `..\..\windows\system32`)
 *   - any symlink-resolved path that escapes root (CR-01-A hardening)
 *
 * Symlink hardening (CR-01-A, REVIEW 06 CR-01 follow-up):
 *   `path.resolve()` is a lexical operation and does NOT follow symlinks.
 *   An intermediate component that is a symlink pointing OUTSIDE `projectRoot`
 *   would pass the lexical `startsWith(root + pathSep)` check but the actual
 *   syscall (writeFileSync/readFileSync) follows the symlink to the escape
 *   target. To close this gap we canonicalize the deepest EXISTING ancestor
 *   of `abs` via `realpathSync` and verify it remains inside `realpathSync(root)`.
 *   Non-existent tail components cannot be symlinks yet (a TOCTOU window
 *   remains between this check and the follow-up syscall, but that is the
 *   same window MarkdownAdapter accepts).
 *
 * Legitimate nested paths whose canonical form remains inside root are
 * allowed. Callers obtain the absolute path from the return value.
 */
export function _abs(projectRoot: string, relPath: string): string {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw new TypeError("BeadsAdapter: path must be a non-empty string");
  }
  // Reject absolute paths explicitly even if they resolve inside root — the
  // `_abs()` contract is relative-path only. This catches the case where a
  // malicious caller passes an absolute path that happens to match the
  // projectRoot's prefix (defense-in-depth against path substitution attacks).
  // Accept: platform-independent absolute-path detection via `isAbsolute`
  // composed with cross-platform drive-letter/backslash checks.
  const looksAbsolute =
    relPath.startsWith('/') ||
    relPath.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(relPath);
  if (looksAbsolute) {
    throw new TypeError(
      `BeadsAdapter: absolute path '${relPath}' is not allowed (use relative path)`,
    );
  }
  const lexicalRoot = pathResolve(projectRoot);
  const abs = pathResolve(projectRoot, relPath);
  if (abs !== lexicalRoot && !abs.startsWith(lexicalRoot + pathSep)) {
    throw new TypeError(
      `BeadsAdapter: path '${relPath}' escapes projectRoot '${lexicalRoot}'`,
    );
  }
  // CR-01-A: canonicalize the deepest existing ancestor and re-check
  // containment against the canonicalized root. This rejects paths that
  // lexically stay inside `projectRoot` but resolve through a symlink
  // component whose target is outside.
  let canonicalRoot: string;
  try {
    canonicalRoot = realpathSync(lexicalRoot);
  } catch {
    // If projectRoot itself cannot be canonicalized (e.g. doesn't exist yet),
    // fall back to the lexical form. This is safe: a non-existent root
    // cannot contain attacker-controlled symlinks.
    canonicalRoot = lexicalRoot;
  }
  // Walk upward from `abs` to find the deepest ancestor that already exists,
  // then realpath THAT. Components beneath the deepest-existing ancestor
  // are necessarily non-existent (so cannot be symlinks at this instant).
  let probe = abs;
  while (probe !== pathDirname(probe) && !existsSync(probe)) {
    probe = pathDirname(probe);
  }
  let canonical: string;
  try {
    canonical = existsSync(probe) ? realpathSync(probe) : probe;
  } catch {
    canonical = probe;
  }
  if (canonical !== canonicalRoot && !canonical.startsWith(canonicalRoot + pathSep)) {
    throw new TypeError(
      `BeadsAdapter: path '${relPath}' resolves via symlink outside projectRoot '${canonicalRoot}'`,
    );
  }
  return abs;
}

// ─── Bin A — record primitives ──────────────────────────────────────────

export async function getRecord(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
): Promise<string | null> {
  // BEADS-03 / D-OQ06: intercept graph.json reads and materialize lazily
  // from bd's `blocks`-type dependency edges. Spike-014 established that
  // a single `bd export --json` surfaces all edges (≤2-spawn budget).
  if (path === 'graphs/graph.json') {
    const { bd } = await ensure();
    return materializeGraphJson(bd);
  }
  const route = resolveRoute(path);
  if (route.tier === 'bd' && route.label) {
    const { bd } = await ensure();
    try {
      const items = bd.run([
        'list',
        '-l',
        route.label,
        '--json',
        '--all',
        '-n',
        '0',
      ]) as Array<Record<string, unknown>> | null;
      const arr = Array.isArray(items) ? items : [];
      if (route.singleton) {
        if (arr.length === 0) return null;
        const first = arr[0]!;
        return (first.description as string | undefined) ?? null;
      }
      if (route.phase) {
        const phaseMatch = arr.find((it) => {
          const labels = (it.labels as string[] | undefined) ?? [];
          if (!labels.some((l) => l === `phase-id:${route.phase}` || l === `phase:${route.phase}`)) {
            return false;
          }
          if (route.plan) {
            return labels.some((l) => l === `plan-id:${route.plan}` || l === `plan:${route.plan}`);
          }
          return true;
        });
        return phaseMatch ? ((phaseMatch.description as string | undefined) ?? null) : null;
      }
      return null;
    } catch (e) {
      if (e instanceof BeadsEmpty) return null;
      throw e;
    }
  }
  const abs = _abs(projectRoot, path);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf-8');
}

export async function putRecord(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
  body: string,
): Promise<void> {
  const route = resolveRoute(path);
  if (route.tier === 'bd' && route.label) {
    const { bd } = await ensure();
    if (route.singleton) {
      let list: Array<{ id: string }> = [];
      try {
        const raw = bd.run([
          'list',
          '-l',
          route.label,
          '--json',
          '--all',
          '-n',
          '0',
        ]);
        list = Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
      } catch (e) {
        if (!(e instanceof BeadsEmpty)) throw e;
      }
      if (list.length > 0) {
        bd.run(['update', list[0]!.id, '--description', body], { parseJson: false });
      } else {
        const title = route.label.replace(/^gsd:/, '').toUpperCase();
        // `bd create <title> -l <label> -d <body>` — v1.0.4 accepts label on create
        bd.run(['create', title, '-l', route.label, '-d', body], { parseJson: false });
      }
      return;
    }
    // Phase-addressed bd writes: Plan 06-06 scope (recordState* families own this).
    throw new Error(
      `BeadsAdapter.putRecord: phase-addressed bd writes not implemented in Bin A (Plan 06-06): ${path}`,
    );
  }
  atomicWriteFile(_abs(projectRoot, path), body);
}

export async function removeRecord(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
): Promise<void> {
  const route = resolveRoute(path);
  // WR-03 fix: mirror putRecord's contract — phase-addressed bd paths
  // (phases/NN-foo/NN-MM-PLAN.md et al.) route `tier: 'bd'` but with
  // `label: undefined` under D-MAPPING Outcome A. Without this guard,
  // the code falls through to the disk-tier unlink path, which either
  // silently succeeds (the file didn't exist on disk — body was in bd)
  // or succeeds while leaving the bd bead intact: phantom-persistence.
  // putRecord throws on this case; removeRecord must too so the contract
  // asymmetry (reads work, writes throw, removes no-op) is eliminated.
  if (route.tier === 'bd' && !route.label) {
    throw new Error(
      `BeadsAdapter.removeRecord: phase-addressed bd removes not implemented in Bin A (Plan 06-06): ${path}`,
    );
  }
  if (route.tier === 'bd' && route.label) {
    const { bd } = await ensure();
    try {
      const raw = bd.run([
        'list',
        '-l',
        route.label,
        '--json',
        '--all',
        '-n',
        '0',
      ]);
      const list = Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
      if (list.length > 0) {
        // `bd delete <id> --force` — without --force, bd shows a preview only.
        bd.run(['delete', list[0]!.id, '--force'], { parseJson: false });
      }
    } catch (e) {
      if (!(e instanceof BeadsEmpty)) throw e;
    }
    return;
  }
  const abs = _abs(projectRoot, path);
  if (existsSync(abs)) unlinkSync(abs);
}

export async function removeCollection(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  prefix: string,
): Promise<void> {
  const route = resolveRoute(prefix);
  // WR-03 fix: see removeRecord for rationale. Phase-addressed bd prefixes
  // must throw (parallel to putRecord) rather than silently falling through
  // to disk-tier rmSync — phantom-persistence otherwise.
  if (route.tier === 'bd' && !route.label) {
    throw new Error(
      `BeadsAdapter.removeCollection: phase-addressed bd removes not implemented in Bin A (Plan 06-06): ${prefix}`,
    );
  }
  if (route.tier === 'bd' && route.label) {
    const { bd } = await ensure();
    try {
      const raw = bd.run([
        'list',
        '-l',
        route.label,
        '--json',
        '--all',
        '-n',
        '0',
      ]);
      const list = Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
      // `bd delete --cascade --force` in a single spawn: pass all ids at once.
      if (list.length > 0) {
        const ids = list.map((it) => it.id);
        bd.run(['delete', ...ids, '--cascade', '--force'], { parseJson: false });
      }
    } catch (e) {
      if (!(e instanceof BeadsEmpty)) throw e;
    }
    return;
  }
  const abs = _abs(projectRoot, prefix);
  if (existsSync(abs)) rmSync(abs, { recursive: true, force: true });
}

export async function listCollection(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  prefix: string,
  filter?: RecordFilter,
): Promise<RecordRef[]> {
  const route = resolveRoute(prefix);
  if (route.tier === 'bd' && route.label) {
    const { bd } = await ensure();
    let items: Array<{ id: string; title?: string }> = [];
    try {
      const raw = bd.run([
        'list',
        '-l',
        route.label,
        '--json',
        '--all',
        '-n',
        '0',
      ]);
      // Deferred-03 resolution: BdRunner already normalizes v1.0.4 empty-store
      // shapes via Landmine 7 (throws BeadsEmpty). We additionally defend
      // against an empty array return here so `listCollection` reports [] on
      // an empty label rather than propagating undefined behavior.
      items = Array.isArray(raw) ? (raw as typeof items) : [];
    } catch (e) {
      if (!(e instanceof BeadsEmpty)) throw e;
    }
    const refs: RecordRef[] = items.map((it) => ({
      path: `${prefix}/${it.id}`,
      name: it.title ?? it.id,
    }));
    return filter ? refs.filter(filter) : refs;
  }
  const abs = _abs(projectRoot, prefix);
  if (!existsSync(abs)) return [];
  const entries = readdirSync(abs, { withFileTypes: true });
  const refs: RecordRef[] = entries.map((e) => ({
    path: `${prefix}/${e.name}`,
    name: e.name,
  }));
  return filter ? refs.filter(filter) : refs;
}

export async function exists(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
): Promise<boolean> {
  const route = resolveRoute(path);
  if (route.tier === 'bd' && route.label) {
    // Route bd-tier exists through getRecord so we share the BeadsEmpty handling.
    const r = await getRecord(projectRoot, ensure, path);
    return r !== null;
  }
  // disk-tier: avoid reading the file; stat is cheaper.
  const abs = _abs(projectRoot, path);
  return existsSync(abs);
}

export async function stat(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
): Promise<{ kind: 'file' | 'dir'; mtime?: string } | null> {
  const route = resolveRoute(path);
  if (route.tier === 'bd' && route.label) {
    // Collection routes (phase-collection, etc.) represent logical directories —
    // return kind:'dir' without a record lookup (no record exists for them).
    if (route.collection) return { kind: 'dir' };
    const r = await getRecord(projectRoot, ensure, path);
    return r === null ? null : { kind: 'file' };
  }
  const abs = _abs(projectRoot, path);
  if (!existsSync(abs)) return null;
  const st = statSync(abs);
  return {
    kind: st.isDirectory() ? 'dir' : 'file',
    mtime: st.mtime.toISOString(),
  };
}

// ─── Bin A — section primitives ─────────────────────────────────────────

export async function getSection(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
  anchor: string,
): Promise<string | null> {
  const text = await getRecord(projectRoot, ensure, path);
  if (text === null) return null;
  const loc = locateSection(text, anchor);
  return loc ? loc.bodyText : null;
}

export async function updateSection(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
  anchor: string,
  body: string,
  mode: SectionMode,
): Promise<void> {
  const text = (await getRecord(projectRoot, ensure, path)) ?? '';
  const updated = rewriteSection(text, anchor, body, mode);
  await putRecord(projectRoot, ensure, path, updated);
}

// ─── Bin A — frontmatter primitives ─────────────────────────────────────

export async function getFrontmatter(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
  field?: string,
): Promise<unknown> {
  const text = await getRecord(projectRoot, ensure, path);
  if (text === null) return null;
  const { frontmatter } = parseFrontmatter(text);
  if (field !== undefined) return frontmatter[field] ?? null;
  return frontmatter;
}

/**
 * WR-06 runtime guard: the public `updateFrontmatter` and
 * `mergeFrontmatterFn` accept `unknown`, but `formatFrontmatter` (+
 * js-yaml's `dump`) require JSON-serializable values. A caller who
 * hands us a function, Symbol, or circular-reference object would
 * cause `dump` to either throw mid-write (half-written frontmatter on
 * disk) or emit a `!!js/function` tag that subsequent `load` calls
 * reject (unparseable YAML on read).
 *
 * WR-1 (iter-2) fix: `JSON.stringify` alone is INSUFFICIENT. It throws
 * only on circular references and BigInt; functions and Symbols are
 * SILENTLY stripped (`JSON.stringify({fn: () => 1}) === '{}'`), so a
 * broken value would pass the guard and reach `js-yaml.dump`, which
 * may emit a `!!js/function` tag — exactly the failure mode this guard
 * was supposed to block. We now explicitly walk the object tree and
 * throw a `TypeError` on any function or Symbol value (at any depth).
 * The `JSON.stringify` probe is retained to catch circular references
 * and BigInt.
 *
 * The walker is iterative (heap-allocated worklist) rather than
 * recursive so a pathological deeply-nested input cannot blow the
 * call stack before the circular-ref check runs.
 */
function _assertFrontmatterSerializable(v: unknown, context: string): void {
  // Explicit walk: reject function/symbol at any depth. We track visited
  // objects to avoid infinite loops on circular structures (the
  // JSON.stringify probe below handles circular-ref detection for the
  // final TypeError with a clear message; the visited set here just
  // prevents the walker itself from looping).
  const seen = new WeakSet<object>();
  const worklist: unknown[] = [v];
  while (worklist.length > 0) {
    const cur = worklist.pop();
    const t = typeof cur;
    if (t === 'function' || t === 'symbol') {
      throw new TypeError(
        `BeadsAdapter.${context}: value of type ${t} is not YAML-serializable ` +
          `(functions and Symbols are silently dropped by JSON.stringify and would ` +
          `produce malformed YAML via js-yaml's \`!!js/function\` tag).`,
      );
    }
    if (cur && t === 'object') {
      if (seen.has(cur as object)) continue;
      seen.add(cur as object);
      if (Array.isArray(cur)) {
        for (const entry of cur) worklist.push(entry);
      } else {
        for (const entry of Object.values(cur as Record<string, unknown>)) {
          worklist.push(entry);
        }
      }
    }
  }
  // Defense-in-depth: JSON.stringify catches circular refs + BigInt
  // values, which the walker above does NOT detect (BigInt typeof is
  // 'bigint', not 'symbol'/'function', and we intentionally don't
  // enumerate BigInt further).
  try {
    JSON.stringify(v);
  } catch (e) {
    throw new TypeError(
      `BeadsAdapter.${context}: value is not JSON-serializable (circular references or BigInt): ${String(e)}`,
    );
  }
}

export async function updateFrontmatter(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
  field: string,
  value: unknown,
): Promise<void> {
  _assertFrontmatterSerializable(value, 'updateFrontmatter');
  const text = (await getRecord(projectRoot, ensure, path)) ?? '';
  const { frontmatter, body } = parseFrontmatter(text);
  (frontmatter as Record<string, FrontmatterValue>)[field] = value as FrontmatterValue;
  const out = formatFrontmatter(frontmatter, body);
  await putRecord(projectRoot, ensure, path, out);
}

export async function mergeFrontmatterFn(
  projectRoot: string,
  ensure: () => Promise<BeadsRuntimeState>,
  path: string,
  patch: Record<string, unknown>,
): Promise<void> {
  _assertFrontmatterSerializable(patch, 'mergeFrontmatter');
  const text = (await getRecord(projectRoot, ensure, path)) ?? '';
  const { frontmatter, body } = parseFrontmatter(text);
  const merged = mergeFrontmatter(
    frontmatter as Record<string, unknown>,
    patch,
  ) as Record<string, FrontmatterValue>;
  const out = formatFrontmatter(merged, body);
  await putRecord(projectRoot, ensure, path, out);
}

// ─── Named-doc primitives (disk-tier per CR-02 resolution) ──────────────

/**
 * Compute the relative path for a named-doc key.
 *
 * - `category === 'root'` → HANDOFF / CONTINUE-HERE / DECISIONS-INDEX at
 *   `.planning/` root. HANDOFF + CONTINUE-HERE use `.json`; DECISIONS-INDEX
 *   uses `.md` by convention.
 * - Other categories → `.planning/<category>/[workstream/]<key>`. Workstream
 *   is an optional nested prefix preserved from Phase 4 semantics.
 *
 * The composed path is passed through `_abs()` by callers so traversal
 * attempts via category or key are caught at the guard.
 */
function _namedDocPath(
  category: NamedDocCategory,
  key: string,
  workstream?: string,
): string {
  if (category === 'root') {
    const ext = key === 'HANDOFF' || key === 'CONTINUE-HERE' ? '.json' : '.md';
    return `${key}${ext}`;
  }
  const ws = workstream ? `${workstream}/` : '';
  return `${category}/${ws}${key}`;
}

export async function putNamedDoc(
  projectRoot: string,
  _ensure: () => Promise<BeadsRuntimeState>,
  category: NamedDocCategory,
  key: string,
  body: string,
  opts?: { workstream?: string },
): Promise<void> {
  const relPath = _namedDocPath(category, key, opts?.workstream);
  atomicWriteFile(_abs(projectRoot, relPath), body);
}

export async function getNamedDoc(
  projectRoot: string,
  _ensure: () => Promise<BeadsRuntimeState>,
  category: NamedDocCategory,
  key: string,
  opts?: { workstream?: string },
): Promise<string | null> {
  const relPath = _namedDocPath(category, key, opts?.workstream);
  const abs = _abs(projectRoot, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf-8');
}

// Exported for test-only access to the path composer (not part of the
// public contract).
export { _namedDocPath };
