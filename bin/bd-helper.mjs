// bin/bd-helper.mjs
// Wraps spawnSync('bd', …); throws BeadsUnavailableError subtypes on failure.
// Pitfall 2 mitigation: spawnSync (NOT the throwing exec-sync helper) so reads can fall through to upstream.
// Helpers-throw / handlers-stay-clean per D-13.
// Test parity in tests/shadow-tests/bd-helper.test.mjs.

import { spawnSync } from 'node:child_process';
import { BeadsNotInstalled, BeadsCorrupt, BeadsEmpty } from './beads-errors.mjs';

/**
 * Invoke bd. Returns parsed JSON on success; throws sentinel subtypes on failure.
 * Handlers call this and let exceptions propagate to the dispatcher's catch.
 *
 * @param {string[]} args                       — argv passed to `bd` (no shell)
 * @param {{ cwd?: string, parseJson?: boolean }} [opts]
 * @returns {*}                                 — parsed JSON (default) or raw stdout
 * @throws {BeadsNotInstalled}                  — bd binary not on PATH (ENOENT)
 * @throws {BeadsCorrupt}                       — non-zero exit or non-JSON stdout
 * @throws {BeadsEmpty}                         — bd's `{ error, schema_version }` shape
 */
export function bd(args, { cwd, parseJson = true } = {}) {
  const result = spawnSync('bd', args, { cwd, encoding: 'utf-8' });

  // Spawn failure → bd binary not on PATH
  if (result.error?.code === 'ENOENT') {
    throw new BeadsNotInstalled('bd binary not found on PATH', { originalError: result.error });
  }

  if (result.status !== 0) {
    // bd returned non-zero. Distinguish corruption vs other failures.
    const stderr = (result.stderr ?? '').trim();
    if (/database|dolt|metadata\.json/i.test(stderr)) {
      throw new BeadsCorrupt(`bd ${args[0]} failed: ${stderr}`, { originalError: new Error(stderr) });
    }
    throw new BeadsCorrupt(`bd ${args[0]} failed (status ${result.status}): ${stderr}`);
  }

  const stdout = result.stdout ?? '';
  if (!parseJson) return stdout;

  // bd's "no issues found" returns an OBJECT not an array (Pitfall — STACK.md:115).
  // bd export --json returns JSONL (one JSON object per line), not a JSON array.
  // Detect JSONL by trying JSON.parse first; if it fails, try JSONL parse.
  let parsed;
  try { parsed = JSON.parse(stdout); }
  catch {
    // Not JSON — try JSONL (newline-delimited JSON, each line is a JSON object).
    const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let jsonlParsed;
    try {
      jsonlParsed = lines.map(line => JSON.parse(line));
    } catch (jsonlErr) {
      throw new BeadsCorrupt(`bd ${args[0]} returned non-JSON: ${stdout.slice(0, 200)}`, { originalError: jsonlErr });
    }
    return jsonlParsed;
  }

  // Detect bd's empty-error shape: { error: '...', schema_version: 1 }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
    throw new BeadsEmpty(parsed.error, { originalError: new Error(parsed.error) });
  }

  return parsed;
}
