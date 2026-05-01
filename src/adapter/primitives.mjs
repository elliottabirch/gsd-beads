// src/adapter/primitives.mjs
// Bin A (10 methods, PRIM-01) + 6 foundational (PRIM-02). Phase 7 / IMPL.
//
// Router-first dispatch per D-01: every method opens with
//   const route = routerResolve(path)
// and branches on route.tier ('bd' | 'disk' | 'hybrid').
//
// ≤2 bd spawns per public method invocation (D-21 / QUAL-07 carry-forward).
// BEADS_ACTOR=seed on every bd call that affects committed state (D-20).
// Heading line itself NEVER touched in updateSection (D-07; Plan 05 owns).

import {
  existsSync, readFileSync, readdirSync, unlinkSync,
  mkdtempSync, mkdirSync, copyFileSync, chmodSync,
} from 'node:fs';
import { resolve as pathResolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve as routerResolve, NAMED_DOC_CATEGORIES } from './pathRouter.mjs';
import { atomicWriteFile } from './_atomicWrite.mjs';
import { locateSection, rewriteSection } from '../format/section.mjs';
import {
  parseFrontmatter,
  formatFrontmatter,
  mergeFrontmatter as fmMerge,
} from '../format/frontmatter.mjs';
import { bd } from '../bd/helper.mjs';
import { BeadsEmpty, UnsupportedOperationError } from '../bd/errors.mjs';

/**
 * Discriminated-union event types per D-09. Memory types are stored
 * via `bd remember --key <milestone>:<type>:<id>`. Comment types are
 * stored via `bd comments add <milestoneBead> --author gsd:event:<type>`
 * (D-09 amendment per RESEARCH Pitfall 1: bd v1.0.3 doesn't support
 * `--label` on comments; `--author` provides the structured slot).
 */
const MEMORY_EVENT_TYPES = Object.freeze(new Set([
  'decision',
  'blocker_added',
  'blocker_resolved',
  'metric',
  'todo_count_update',
  'deferred_items',
  'roadmap_evolution',
]));

const COMMENT_EVENT_TYPES = Object.freeze(new Set([
  'session',
  'quick_task',
  'forensic_session',
]));

// NOTE: the canonical stub helper that other cluster files still carry was
// removed at the end of Phase 7 (Plan 07) — every primitive in this file
// is now a real implementation. The shell-level stub-message contract
// for the OTHER adapter clusters (phaseLifecycle, roadmapMilestone, ...)
// is enforced by `tests/unit/adapter-shell.test.mjs`. If a future plan
// needs to re-introduce stubs here, copy the helper from one of the
// other cluster files (e.g. src/adapter/phaseLifecycle.mjs).

/**
 * Convert a repo-relative path to an absolute path under this.projectRoot.
 * Repo-relative discipline per D-02.
 */
function _abs(adapter, path) {
  return pathResolve(adapter.projectRoot, path);
}

export default {
  // ---------------------------------------------------------------------
  // PRIM-01 Bin A: records (Plan 04)
  // ---------------------------------------------------------------------

  async getRecord(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // ≤2 bd spawns per D-21. Single `bd list` with the singleton/label
      // filter; client-side single-element pick.
      // `--all` so closed records are returned (Rule 1 fix during Plan 09 —
      // bd's default filter drops status=closed which would silently miss
      // closed roadmap/requirements entries).
      // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
      const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
      // The shape returned is the bd issue object (or undefined for missing).
      // For singleton kinds (roadmap, requirements), the first match is
      // returned. For multi-record kinds, this primitive is not the lookup
      // path — callers route to listCollection / a Bin B method instead.
      if (route.singleton) {
        return Array.isArray(items) && items.length ? items[0] : null;
      }
      // Non-singleton bd-routed path: caller is expected to use
      // listCollection or a Bin B-specific lookup. Throw a clear error so
      // misrouting surfaces during execution rather than returning null.
      throw new Error(
        `BeadsAdapter.getRecord: bd-routed path ${path} (kind=${route.kind}) requires listCollection or Bin B lookup`
      );
    }
    // disk-routed (kind: 'plan' | 'opaque' | namedDoc 'hybrid' read-side)
    const abs = _abs(this, path);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, 'utf-8');
  },

  async putRecord(path, body) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // bd-routed put for singleton kinds is performed via Bin B domain
      // methods (e.g., addPhase, evolveRoadmap). The generic putRecord
      // primitive is NOT the path for adding new bd records — that would
      // require domain-specific label setup that Phase 8+ owns. We refuse
      // here so misrouting fails loudly.
      throw new Error(
        `BeadsAdapter.putRecord: bd-routed paths (kind=${route.kind}) are written via Bin B domain methods (Phase 8+); generic putRecord is for disk-routed paths only`
      );
    }
    // disk-routed: atomic write via tmpfile + rename (D-08)
    atomicWriteFile(_abs(this, path), body);
  },

  async removeRecord(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // Same boundary as putRecord — bd-side removal is Bin B's domain.
      throw new Error(
        `BeadsAdapter.removeRecord: bd-routed paths (kind=${route.kind}) are removed via Bin B domain methods (Phase 8+); generic removeRecord is for disk-routed paths only`
      );
    }
    // disk-routed: idempotent unlink (no throw if missing)
    const abs = _abs(this, path);
    if (existsSync(abs)) unlinkSync(abs);
  },

  async listCollection(prefix, filter) {
    const route = routerResolve(prefix);
    if (route.tier === 'bd' && route.collection) {
      this._ensureBd();
      // ≤2 bd spawns per D-21. Single `bd list -l <primary-label>` call;
      // optional `filter` adds an additional --label arg (still 1 spawn
      // because both labels are passed in the same invocation).
      // `--all` so closed records are returned alongside open ones (D-04
      // requires deterministic ordering across the full collection; bd's
      // default filters out status=closed which would silently drop seed
      // content like the v0.1 closed phases — Rule 1 fix during Plan 09).
      const args = ['list', '-l', route.label, '--json', '--all', '-n', '0'];
      if (filter && typeof filter === 'string') {
        args.push('-l', filter);
      }
      // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
      const items = bd(args, { cwd: this._beadsRoot });
      // Deterministic sort per D-04 / QUAL-06 carry-forward. Sort by
      // numeric phase-id when present, else by id (string). Phase epics
      // carry phase-id:NN labels; plans carry plan-id:NN-MM labels.
      const arr = Array.isArray(items) ? items.slice() : [];
      arr.sort((a, b) => {
        const akey = _firstSortKey(a);
        const bkey = _firstSortKey(b);
        if (akey === bkey) return 0;
        return akey < bkey ? -1 : 1;
      });
      return arr;
    }
    // disk-routed: fs.readdir; filter is a predicate function or undefined
    const abs = _abs(this, prefix);
    if (!existsSync(abs)) return [];
    const entries = readdirSync(abs);
    const filtered = typeof filter === 'function'
      ? entries.filter(filter)
      : entries;
    // Deterministic ordering — fs.readdir order is OS-dependent
    return filtered.slice().sort();
  },

  async exists(path) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // Pitfall 5: `bd show <missing-id> --json` exits 0 with
      // {error, schema_version}. The src/bd/helper.mjs:bd() wrapper
      // detects this and throws BeadsEmpty. Catch + return false.
      try {
        // For singleton kinds, listing by label is the cheapest existence
        // check (≤1 spawn). Returns the bd export-shape array; non-empty
        // implies at least one matching record. `--all` so closed records
        // are detected (Rule 1 fix during Plan 09).
        // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
        const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
        return Array.isArray(items) && items.length > 0;
      } catch (err) {
        if (err instanceof BeadsEmpty) return false;
        throw err;
      }
    }
    // disk-routed
    return existsSync(_abs(this, path));
  },

  // ---------------------------------------------------------------------
  // PRIM-01 Bin A: section + frontmatter (Plan 05 owns these 5 methods)
  // ---------------------------------------------------------------------

  async getSection(path, anchor) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      // bd-routed sections (rare — only the singleton kinds with description bodies)
      this._ensureBd();
      // `--all` so closed records' descriptions are still readable (Rule 1
      // fix during Plan 09).
      // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
      const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
      if (!Array.isArray(items) || !items.length) return null;
      // Description body is rendered to text and parsed via locateSection
      const text = items[0].description ?? '';
      const loc = locateSection(text, anchor);
      return loc ? loc.bodyText : null;
    }
    // disk-routed
    const abs = _abs(this, path);
    if (!existsSync(abs)) return null;
    const text = readFileSync(abs, 'utf-8');
    const loc = locateSection(text, anchor);
    return loc ? loc.bodyText : null;
  },

  async updateSection(path, anchor, body, mode = 'overwrite') {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // bd-routed: read description, rewrite section, write back via
      // `bd update --description`. 2 spawns total (read + write).
      // `--all` so closed records remain mutable (Rule 1 fix during Plan 09).
      // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
      const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
      if (!Array.isArray(items) || !items.length) {
        throw new Error(
          `BeadsAdapter.updateSection: bd-routed record not found at ${path}`,
        );
      }
      const issue = items[0];
      const oldText = issue.description ?? '';
      const newText = rewriteSection(oldText, anchor, body, mode);
      bd(['update', issue.id, '--description', newText], {
        cwd: this._beadsRoot,
        env: { ...process.env, BEADS_ACTOR: 'seed' },
        parseJson: false,
      });
      return;
    }
    // disk-routed: read, rewrite, atomic write per D-08
    const abs = _abs(this, path);
    const oldText = existsSync(abs) ? readFileSync(abs, 'utf-8') : '';
    const newText = rewriteSection(oldText, anchor, body, mode);
    atomicWriteFile(abs, newText);
  },

  async getFrontmatter(path, field) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // `--all` so frontmatter on closed records is still inspectable
      // (Rule 1 fix during Plan 09).
      // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
      const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
      if (!Array.isArray(items) || !items.length) {
        return field ? undefined : {};
      }
      const fm = _labelsToFrontmatter(items[0]);
      return field ? fm[field] : fm;
    }
    // disk-routed
    const abs = _abs(this, path);
    if (!existsSync(abs)) return field ? undefined : {};
    const text = readFileSync(abs, 'utf-8');
    const { frontmatter } = parseFrontmatter(text);
    return field ? frontmatter[field] : frontmatter;
  },

  /**
   * Update a single frontmatter field.
   *
   * NOTE on bd-routed spawn budget (RESEARCH §OQ-2): label-rewrite paths
   * may spawn bd up to 3 times (`bd list` for read + `bd label remove`
   * for old value + `bd label add` for new value). QUAL-07's ≤2-spawn
   * budget targets read-side methods; write-side label rewrites are
   * exempt per CONTEXT discretion. Consumers needing a tighter budget
   * should batch via Bin B domain methods.
   */
  async updateFrontmatter(path, field, value) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // `--all` so frontmatter on closed records remains mutable
      // (Rule 1 fix during Plan 09).
      // cwd: this._beadsRoot per deferred-items.md (Rule 3 — Plan 09 cwd-pass audit).
      const items = bd(['list', '-l', route.label, '--json', '--all', '-n', '0'], { cwd: this._beadsRoot });
      if (!Array.isArray(items) || !items.length) {
        throw new Error(
          `BeadsAdapter.updateFrontmatter: bd-routed record not found at ${path}`,
        );
      }
      const issue = items[0];
      // Remove any existing labels with this field's prefix
      const existingPrefixed = (issue.labels ?? [])
        .filter((l) => l.startsWith(`${field}:`));
      for (const old of existingPrefixed) {
        bd(['label', 'remove', issue.id, old], {
          cwd: this._beadsRoot,
          env: { ...process.env, BEADS_ACTOR: 'seed' },
          parseJson: false,
        });
      }
      if (value !== undefined && value !== null) {
        bd(['label', 'add', issue.id, `${field}:${value}`], {
          cwd: this._beadsRoot,
          env: { ...process.env, BEADS_ACTOR: 'seed' },
          parseJson: false,
        });
      }
      return;
    }
    // disk-routed: read, merge, write atomically
    const abs = _abs(this, path);
    const text = existsSync(abs) ? readFileSync(abs, 'utf-8') : '';
    const { frontmatter, body } = parseFrontmatter(text);
    const next = { ...frontmatter, [field]: value };
    atomicWriteFile(abs, formatFrontmatter(next, body));
  },

  async mergeFrontmatter(path, patch) {
    const route = routerResolve(path);
    if (route.tier === 'bd') {
      this._ensureBd();
      // Apply each patch entry sequentially via updateFrontmatter
      for (const [field, value] of Object.entries(patch ?? {})) {
        await this.updateFrontmatter(path, field, value);
      }
      return;
    }
    // disk-routed
    const abs = _abs(this, path);
    const text = existsSync(abs) ? readFileSync(abs, 'utf-8') : '';
    const { frontmatter, body } = parseFrontmatter(text);
    const merged = fmMerge(frontmatter, patch);
    atomicWriteFile(abs, formatFrontmatter(merged, body));
  },

  // ---------------------------------------------------------------------
  // PRIM-02 foundational primitives (Plans 06/07 own these 6 methods)
  // ---------------------------------------------------------------------

  /**
   * Record a state event into bd via discriminated-union dispatch (D-09).
   *
   * - MEMORY_EVENT_TYPES (7) — decision, blocker_added, blocker_resolved,
   *   metric, todo_count_update, deferred_items, roadmap_evolution —
   *   write a bd memory under `<milestone>:<type>:<id>` (1 spawn).
   * - COMMENT_EVENT_TYPES (3) — session, quick_task, forensic_session —
   *   author a bd comment on the active milestone bead via
   *   `--author gsd:event:<type>` (D-09 amendment per RESEARCH Pitfall 1:
   *   bd v1.0.3 doesn't accept `--label` on comments). 2 spawns
   *   (resolve milestone bead + write comment).
   *
   * Unknown types throw `Error('recordStateEvent: unknown type "<x>"')`.
   */
  async recordStateEvent({ type, payload }) {
    if (typeof type !== 'string' || type.length === 0) {
      throw new TypeError('recordStateEvent: type must be a non-empty string');
    }
    if (!payload || typeof payload !== 'object') {
      throw new TypeError('recordStateEvent: payload must be an object');
    }
    this._ensureBd();

    if (MEMORY_EVENT_TYPES.has(type)) {
      // Per D-09: <milestone>:<type>:<id>
      const id = payload.id ?? payload.decision_id ?? payload.metric_id;
      if (!id) {
        throw new Error(
          `recordStateEvent: type=${type} requires payload.id (or .decision_id/.metric_id)`
        );
      }
      const milestone = payload.milestone;
      if (!milestone) {
        throw new Error(
          `recordStateEvent: type=${type} requires payload.milestone`
        );
      }
      const key = `${milestone}:${type}:${id}`;
      // bd remember overwrites in place per spike-findings memory key namespacing.
      // Single spawn — within QUAL-07 budget.
      // cwd routed through this._beadsRoot so the call targets the adapter's
      // bd database, not whatever process.cwd() happens to be (Rule 1 fix —
      // also required for COMMENT_EVENT_TYPES dispatch below).
      bd(['remember', JSON.stringify(payload), '--key', key], {
        cwd: this._beadsRoot,
        env: { ...process.env, BEADS_ACTOR: 'seed' },
        parseJson: false,
      });
      return { storage: 'memory', key };
    }

    if (COMMENT_EVENT_TYPES.has(type)) {
      // Per D-09 amendment: comments authored as `gsd:event:<type>`
      // (bd v1.0.3 does NOT support --label on comments — RESEARCH Pitfall 1).
      // 2 spawns: 1 to resolve milestone bead, 1 to write the comment.
      const milestoneBead = _resolveMilestoneBead(this, payload.milestone);
      bd(
        ['comments', 'add', milestoneBead, '--author', `gsd:event:${type}`, JSON.stringify(payload)],
        {
          cwd: this._beadsRoot,
          env: { ...process.env, BEADS_ACTOR: 'seed' },
          parseJson: false,
        }
      );
      return { storage: 'comment', bead: milestoneBead, author: `gsd:event:${type}` };
    }

    throw new Error(`recordStateEvent: unknown type "${type}"`);
  },

  /**
   * Snapshot the bd database to a JSONL file in a fresh tmp dir.
   *
   * Behavior per RESEARCH §Pattern 5 + Pitfall 3 + Pitfall 4:
   * - bd v1.0.3 `bd export --json` includes memories by default (no
   *   `--memories` flag exists; use `--no-memories` to exclude — Pitfall 3).
   * - Output goes to a real tmp file; `/dev/null` errors with fsync (Pitfall 4).
   * - Caller owns the lifecycle of the returned tmp dir/file (cleanup is
   *   theirs); accepts `T-7-17` per the plan threat model.
   *
   * Single bd spawn — within QUAL-07 budget. `cwd: this._beadsRoot` per
   * the deferred-items.md cwd-pass pattern established in Plan 06.
   */
  async snapshot() {
    this._ensureBd();
    const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-snap-'));
    const path = join(dir, 'snapshot.jsonl');
    bd(['export', '--json', '-o', path], {
      cwd: this._beadsRoot,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      parseJson: false,
    });
    return path;
  },

  /**
   * Restore a fresh bd store in a new tmp dir from a JSONL snapshot.
   *
   * Behavior per RESEARCH §Pattern 5 + Pitfall 6:
   * - Validates snapshotRef is a non-empty string + that the file exists
   *   (T-7-02 mitigation: surfaces malformed JSONL as BeadsCorrupt via the
   *   bd helper's stderr inspection).
   * - Spawns `git init` in the tmp dir so `bd init` checks pass.
   * - Hardcodes prefix 'sd' (matches build-seed.sh / fixtures); a future
   *   plan derives prefix dynamically from the snapshot's issue ids.
   * - chmodSync 0o700 on .beads (Pitfall 6: bd nags on every subsequent
   *   invocation against modes wider than 0o700).
   * - 2 spawns: git init + bd init.
   *
   * Returns the tmp project root path.
   */
  async restore(snapshotRef) {
    if (typeof snapshotRef !== 'string' || !snapshotRef.length) {
      throw new TypeError('restore: snapshotRef must be a non-empty path string');
    }
    if (!existsSync(snapshotRef)) {
      throw new Error(`restore: snapshot file does not exist: ${snapshotRef}`);
    }
    const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-restore-'));
    // Use spawnSync directly for git init (the bd() helper is bd-specific).
    const { spawnSync } = await import('node:child_process');
    const gitInit = spawnSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
    if (gitInit.status !== 0) {
      throw new Error(`restore: git init failed in ${dir}`);
    }
    mkdirSync(join(dir, '.beads'), { recursive: true });
    copyFileSync(snapshotRef, join(dir, '.beads/issues.jsonl'));
    bd(
      [
        'init', '--from-jsonl',
        '--prefix', 'sd',
        '--non-interactive', '--skip-agents', '--skip-hooks', '--quiet',
      ],
      {
        cwd: dir,
        env: { ...process.env, BEADS_ACTOR: 'seed' },
        parseJson: false,
      },
    );
    // Pitfall 6: bd warns on .beads != 0700 on every subsequent invocation
    chmodSync(join(dir, '.beads'), 0o700);
    return dir;
  },
  /**
   * Write a named-doc body to disk + write a bd memory index entry (D-10).
   *
   * Dual-write per D-10:
   *   - Disk: <projectRoot>/.planning/<category>/<key>.md (atomic via D-08)
   *   - bd memory: gsd-beads:named-doc:<category>:<key> = JSON({category, key, last_write, byte_length})
   *
   * The body is NOT inlined into the bd memory entry — D-10 explicitly
   * stores existence + timestamp + length only (REQ-07: bodies live on
   * disk for grep-readability).
   *
   * Validation:
   *   - category MUST be one of NAMED_DOC_CATEGORIES (closed allowlist).
   *   - key MUST be a non-empty string.
   *   - key MUST NOT contain `..`, `/`, or `\` (T-7-01 path-traversal mitigation).
   *
   * 1 bd spawn (within QUAL-07 budget). cwd: this._beadsRoot.
   */
  async putNamedDoc(category, key, body) {
    if (typeof category !== 'string' || !NAMED_DOC_CATEGORIES.includes(category)) {
      throw new Error(
        `BeadsAdapter.putNamedDoc: category "${category}" not in NAMED_DOC_CATEGORIES — closed allowlist per D-10. Allowed: ${NAMED_DOC_CATEGORIES.join(', ')}`,
      );
    }
    if (typeof key !== 'string' || !key.length) {
      throw new TypeError('putNamedDoc: key must be a non-empty string');
    }
    // T-7-01: refuse keys that would escape the <category>/ directory.
    if (/[/\\]|\.\./.test(key)) {
      throw new TypeError(
        'putNamedDoc: key must not contain path separators (`/`, `\\`) or `..`',
      );
    }
    this._ensureBd();
    // Disk write (atomic): .planning/<category>/<key>.md
    const relPath = `.planning/${category}/${key}.md`;
    atomicWriteFile(_abs(this, relPath), body);
    // bd memory index (D-10: existence + timestamp + length only).
    const index = {
      category,
      key,
      last_write: new Date().toISOString(),
      byte_length: Buffer.byteLength(body, 'utf-8'),
    };
    const memKey = `gsd-beads:named-doc:${category}:${key}`;
    bd(['remember', JSON.stringify(index), '--key', memKey], {
      cwd: this._beadsRoot,
      env: { ...process.env, BEADS_ACTOR: 'seed' },
      parseJson: false,
    });
  },

  /**
   * Read a named-doc body from disk (D-10).
   *
   * The bd memory index is for existence/timestamp listings (D-10 / Phase 9
   * aggregation); it never stores bodies. 0 bd spawns.
   *
   * Returns the disk file contents (utf-8) or `null` if absent.
   *
   * Validation matches putNamedDoc — closed-allowlist on category and
   * T-7-01 path-traversal guard on key (read-side defense in depth).
   */
  async getNamedDoc(category, key) {
    if (typeof category !== 'string' || !NAMED_DOC_CATEGORIES.includes(category)) {
      throw new Error(
        `BeadsAdapter.getNamedDoc: category "${category}" not in NAMED_DOC_CATEGORIES — closed allowlist per D-10. Allowed: ${NAMED_DOC_CATEGORIES.join(', ')}`,
      );
    }
    if (typeof key !== 'string' || !key.length) {
      throw new TypeError('getNamedDoc: key must be a non-empty string');
    }
    if (/[/\\]|\.\./.test(key)) {
      throw new TypeError(
        'getNamedDoc: key must not contain path separators (`/`, `\\`) or `..`',
      );
    }
    const abs = _abs(this, `.planning/${category}/${key}.md`);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, 'utf-8');
  },

  /**
   * Always throws UnsupportedOperationError with the locked D-16 message
   * format. bd does not store binaries natively (capabilities.binaryAsset
   * = false). v1.1+ may add a configurable external blob sink.
   */
  async writeBinaryAsset(path, bytes) {
    throw new UnsupportedOperationError(
      'writeBinaryAsset',
      'binaryAsset',
      'bd does not store binaries natively. Configure an external sink in v1.1+.'
    );
  },
};

/**
 * Pull a deterministic sort key from a bd issue. Prefers numeric phase-id
 * or plan-id when present; falls back to issue.id. Per D-04 / QUAL-06.
 */
function _firstSortKey(issue) {
  const labels = issue?.labels ?? [];
  for (const prefix of ['phase-id:', 'plan-id:']) {
    const lab = labels.find((l) => l.startsWith(prefix));
    if (lab) return lab.slice(prefix.length);
  }
  return issue?.id ?? '';
}

/**
 * Synthesize a flat frontmatter object from a bd issue's labels.
 * Per D-03: bd labels of the form `<key>:<value>` become
 * {<key-with-hyphens-as-underscores>: <value>}; bare labels become
 * boolean flags. Slice on first colon preserves colons in values.
 */
function _labelsToFrontmatter(issue) {
  const fm = { id: issue.id, status: issue.status };
  for (const label of issue?.labels ?? []) {
    const idx = label.indexOf(':');
    if (idx === -1) {
      fm[label.replace(/-/g, '_')] = true;
    } else {
      const k = label.slice(0, idx).replace(/-/g, '_');
      fm[k] = label.slice(idx + 1);
    }
  }
  return fm;
}

/**
 * Resolve the milestone bead for comment event dispatch.
 * Looks up an issue with labels `gsd:milestone` + `version:<milestone>`.
 * Falls back to the most recent open milestone if `payload.milestone`
 * is absent.
 *
 * Returns the bead id (e.g., 'sd-abc'). Throws if no milestone bead is found.
 */
function _resolveMilestoneBead(adapter, milestoneVersion) {
  adapter._ensureBd();
  // 1 spawn: list bd issues with the milestone label-pair.
  // `--all` so closed milestones (e.g. v0.1, v0.2) are also resolvable
  // (Rule 1 fix during Plan 09).
  const args = ['list', '-l', 'gsd:milestone', '--json', '--all', '-n', '0'];
  if (milestoneVersion) args.push('-l', `version:${milestoneVersion}`);
  const items = bd(args, { cwd: adapter._beadsRoot });
  if (!Array.isArray(items) || !items.length) {
    throw new Error(
      `recordStateEvent: no milestone bead found (milestone=${milestoneVersion ?? '<active>'})`
    );
  }
  // Deterministic pick: most recently updated open milestone wins
  return items[0].id;
}
