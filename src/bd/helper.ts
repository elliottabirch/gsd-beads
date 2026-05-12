// src/bd/helper.ts
// Adapter-context-bound bd CLI wrapper.
//
// Ported from sibling src/bd/helper.mjs with the following landmine fixes
// baked in per Phase 6 CONTEXT.md §Landmines (Plan 06-02 scope):
//
//   - Landmine 3 (CRITICAL): cwd baked at construction. Sibling's bd()
//     function took cwd as per-call opt; misuse across primitives.ts led
//     to wrong-.beads resolution. BdRunner bakes cwd into each instance
//     so primitives.ts/events.ts/dep-graph.ts never forget.
//
//   - Landmine 4 (CRITICAL): env forwarded to spawnSync. Sibling's bd()
//     wrapper did NOT forward env; BEADS_ACTOR never reached bd unless
//     the caller invoked bd through a different path. BdRunner.run()
//     threads env through every invocation.
//
//   - Landmine 5 (CRITICAL): `bd show <id> --json` returns a
//     single-element array in v1.0.3. BdRunner.show() unwraps:
//     `Array.isArray(r) ? r[0] : r`.
//
//   - Landmine 6 (CRITICAL): `bd export --json` emits JSONL, not a JSON
//     array. run() tries JSON.parse first; on failure falls back to
//     line-by-line parse.
//
//   - Landmine 7 (CRITICAL): bd's "no issues found" path returns
//     `{error, schema_version}` at exit 0. run() detects this shape
//     and throws BeadsEmpty instead of returning success.
//
//   - Landmine 11 (CRITICAL): `BEADS_ACTOR=seed` default in baseEnv
//     preserves CONF-03 byte-identity guarantee when running against
//     seed fixtures.
//
// Sentinel-error dispatch (inherited from sibling):
//   - ENOENT → BeadsNotInstalled
//   - non-zero exit with stderr matching /database is locked|schema
//     mismatch|corrupt/i → BeadsCorrupt
//   - non-zero exit otherwise → BeadsUnavailableError (Unknown cause)

import { spawnSync } from 'node:child_process';
import {
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsEmpty,
  BeadsUnavailableError,
  BeadsCause,
} from './errors.js';

export interface BdRunOptions {
  /**
   * Parse stdout as JSON (default: true). When false, `run()` returns the
   * trimmed raw stdout string (or null if empty).
   */
  parseJson?: boolean;
  /**
   * Additional env vars to merge on top of the runner's baseEnv. Caller
   * values win over baseEnv values; PATH + BEADS_ACTOR from baseEnv are
   * preserved unless explicitly overridden here.
   */
  env?: Record<string, string>;
}

/**
 * Adapter-context-bound bd CLI wrapper. See file header for landmine-fix
 * provenance. Consumers (BeadsAdapter primitives, recordState* families,
 * dep-graph synthesizer) instantiate one per adapter instance and share it
 * across method calls on that instance.
 */
export class BdRunner {
  private readonly cwd: string;
  private readonly baseEnv: NodeJS.ProcessEnv;

  constructor(
    cwd: string,
    baseEnv: NodeJS.ProcessEnv = { ...process.env, BEADS_ACTOR: 'seed' },
  ) {
    this.cwd = cwd;
    this.baseEnv = baseEnv;
  }

  /**
   * Invoke bd with `args`. Returns parsed JSON on success (default), or
   * trimmed raw stdout when `opts.parseJson === false`.
   *
   * Throws BeadsNotInstalled / BeadsCorrupt / BeadsEmpty /
   * BeadsUnavailableError per sentinel-dispatch table in file header.
   */
  run(args: string[], opts?: BdRunOptions): unknown {
    const parseJson = opts?.parseJson ?? true;
    const env: NodeJS.ProcessEnv = { ...this.baseEnv, ...(opts?.env ?? {}) };

    const result = spawnSync('bd', args, {
      cwd: this.cwd,
      env,
      encoding: 'utf-8',
    });

    // ENOENT: bd binary not on PATH.
    const errNo = (result.error as NodeJS.ErrnoException | null)?.code;
    if (errNo === 'ENOENT') {
      throw new BeadsNotInstalled('bd binary not found on PATH', result.error!);
    }

    // Spawn errored for another reason, OR bd returned non-zero.
    if (result.error || (typeof result.status === 'number' && result.status !== 0)) {
      const stderr = (result.stderr ?? '').toString().trim();
      // Corruption signals (inherited from sibling's discipline).
      if (/database is locked|schema mismatch|corrupt|database|dolt|metadata\.json/i.test(stderr)) {
        throw new BeadsCorrupt(
          `bd ${args[0]} failed: ${stderr.slice(0, 200)}`,
          result.error ?? undefined,
        );
      }
      throw new BeadsUnavailableError(
        `bd ${args[0]} failed (status ${result.status}): ${stderr.slice(0, 200)}`,
        { cause: BeadsCause.Unknown, originalError: result.error ?? undefined },
      );
    }

    // parseJson === false → return trimmed raw stdout (or null if empty).
    const rawStdout = (result.stdout ?? '').toString();
    if (!parseJson) {
      const trimmed = rawStdout.trim();
      return trimmed.length === 0 ? null : trimmed;
    }

    const stdoutText = rawStdout.trim();
    if (stdoutText.length === 0) return null;

    // Landmine 7 detection happens inside the JSON.parse branch below.
    // Landmine 6 fallback happens on JSON.parse failure.
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdoutText);
    } catch {
      // Landmine 6 (JSONL fallback): `bd export --json` emits one JSON
      // object per line, not a JSON array.
      const lines = stdoutText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      try {
        return lines.map((line) => JSON.parse(line));
      } catch (jsonlErr) {
        throw new BeadsCorrupt(
          `bd ${args[0]} returned non-JSON: ${stdoutText.slice(0, 200)}`,
          jsonlErr instanceof Error ? jsonlErr : new Error(String(jsonlErr)),
        );
      }
    }

    // Landmine 7: bd's empty-store shape `{error, schema_version}` at exit 0.
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'error' in parsed &&
      'schema_version' in parsed
    ) {
      const emptyErr = (parsed as { error: unknown }).error;
      throw new BeadsEmpty(
        typeof emptyErr === 'string' ? emptyErr : 'bd store reports empty',
      );
    }

    return parsed;
  }

  /**
   * Landmine 5 fix: `bd show <id> --json` returns a single-element array in
   * v1.0.3. Always unwrap; throw BeadsEmpty if the array is empty (no such
   * issue).
   */
  show(id: string): Record<string, unknown> {
    const r = this.run(['show', id, '--json']);
    if (Array.isArray(r)) {
      if (r.length === 0) throw new BeadsEmpty(`bd show ${id}: no result`);
      return r[0] as Record<string, unknown>;
    }
    return r as Record<string, unknown>;
  }
}
