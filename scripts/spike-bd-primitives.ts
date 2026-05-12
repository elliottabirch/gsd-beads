#!/usr/bin/env node
/**
 * D-MAPPING-SPIKE + D-TXN-SPIKE evidence gatherer for Plan 06-03.
 *
 * Produces SPIKE-RESULTS.md §§1-8 at
 *   /Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-03-SPIKE-RESULTS.md
 * §7 (chosen outcomes) and §9 (shipped bd CLI commands) are filled by
 * human review in Task 3 based on the evidence this script gathers.
 *
 * Usage:
 *   npx tsx scripts/spike-bd-primitives.ts
 *
 * Requires: bd (v1.0.3 or v1.0.4 family) on PATH (fails fast if absent).
 *
 * Self-contained: does NOT import from src/bd/helper.ts because Plan 06-02
 * (the .mjs → .ts port) is executing in parallel and the TS helper does not
 * yet exist. The spike embeds a minimal BdRunner class locally, matching
 * sibling's helper.mjs shape, so downstream plans can diff the two for
 * parity verification.
 */
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const OUT_PATH = resolve(
  '/Volumes/code/get-shit-done/.planning/phases/06-beadsadapter-implementation/06-03-SPIKE-RESULTS.md',
);

type Verdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'INCONCLUSIVE';

interface ProbeResult {
  section: string;
  question: string;
  verdict: Verdict;
  command?: string;
  output?: string;
  notes?: string;
}

const results: ProbeResult[] = [];
const version = { raw: '', family: '' };
const discoveredSubcommands: string[] = [];

// ---------- Minimal BdRunner (mirrors sibling helper.mjs shape; local to this script) ----------
class BdRunner {
  constructor(private readonly cwd: string) {}

  run(args: string[], opts: { parseJson?: boolean; env?: NodeJS.ProcessEnv } = {}): unknown {
    const { parseJson = true, env } = opts;
    const r = spawnSync('bd', args, {
      cwd: this.cwd,
      env: env ?? { ...process.env, BEADS_ACTOR: 'seed' },
      encoding: 'utf-8',
    });
    if (r.error) throw new Error(`bd ${args.join(' ')} spawn error: ${r.error.message}`);
    if (r.status !== 0) {
      const stderr = (r.stderr || '').trim();
      throw new Error(`bd ${args.join(' ')} exit ${r.status}: ${stderr}`);
    }
    const stdout = r.stdout ?? '';
    if (!parseJson) return stdout;
    try {
      const parsed = JSON.parse(stdout);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
        throw new Error(`bd empty-store sentinel: ${(parsed as { error: string }).error}`);
      }
      return parsed;
    } catch (_e) {
      // JSONL fallback (Landmine 6)
      const lines = stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      return lines.map((line) => JSON.parse(line));
    }
  }
}

// ---------- Helpers ----------
function spawnCapture(
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): { status: number | null; stdout: string; stderr: string } {
  const baseOpts: SpawnSyncOptionsWithStringEncoding = {
    encoding: 'utf-8',
    env: opts.env ?? { ...process.env, BEADS_ACTOR: 'seed' },
  };
  const finalOpts: SpawnSyncOptionsWithStringEncoding = opts.cwd
    ? { ...baseOpts, cwd: opts.cwd }
    : baseOpts;
  const r = spawnSync('bd', args, finalOpts);
  return {
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

// ---------- Pre-flight ----------
function preflight(): void {
  const which = spawnSync('which', ['bd'], { encoding: 'utf-8' });
  if (which.status !== 0) {
    console.error('FAIL: bd CLI not on PATH. Install bd (v1.0.3 family) before running spike.');
    process.exit(1);
  }
  const v = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
  version.raw = (v.stdout || '').trim();
  if (!/v?1\.0\.(3|4)/.test(version.raw)) {
    console.warn(
      `WARN: bd --version = "${version.raw}" — expected v1.0.3/v1.0.4 family. Continuing with caveat.`,
    );
  }
  const m = /1\.0\.\d+/.exec(version.raw);
  version.family = m ? m[0] : 'unknown';
  if (version.family === '1.0.4') {
    console.log(
      `NOTE: bd v1.0.4 installed (sibling pinned v1.0.3 at 1b2dd2cb). Patch-release variance flagged in §1.`,
    );
  }
}

function catalogSubcommands(): void {
  const help = spawnSync('bd', ['--help'], { encoding: 'utf-8' });
  const body = help.stdout || '';
  // Parse subcommand names from the bd help output (lines indented, two-space first col).
  for (const line of body.split('\n')) {
    const m = /^  ([a-z][a-z-]+)\s{2,}\S/.exec(line);
    if (m) discoveredSubcommands.push(m[1]);
  }
  results.push({
    section: '§1.1',
    question: 'bd --version',
    verdict: 'PASS',
    command: 'bd --version',
    output: version.raw,
    notes: `family: ${version.family}`,
  });
  results.push({
    section: '§1.2',
    question: 'bd subcommand catalog (top-level)',
    verdict: 'PASS',
    command: 'bd --help',
    output: discoveredSubcommands.join(', ') || '(none parsed)',
    notes: `${discoveredSubcommands.length} subcommands discovered`,
  });
}

// ---------- Fixture ----------
function setupFixture(): { dir: string; bd: BdRunner } {
  const dir = mkdtempSync(join(tmpdir(), 'spike-bd-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });

  spawnSync('git', ['init', '-q'], { cwd: dir });
  const init = spawnCapture(
    ['init', '--non-interactive', '--quiet'],
    { cwd: dir },
  );
  if (init.status !== 0) {
    console.error('FAIL: bd init failed in fixture:', init.stderr);
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }
  const bd = new BdRunner(dir);

  // Seed a few issues.
  spawnCapture(['create', 'probe-issue-1', '-d', 'seed body 1'], { cwd: dir });
  spawnCapture(['create', 'probe-issue-2', '-d', 'seed body 2'], { cwd: dir });

  return { dir, bd };
}

// ---------- §2: Named-JSON-field availability (D-MAPPING) ----------
function probe_namedJsonField(dir: string, bd: BdRunner): void {
  let issueList: Array<{ id: string }> = [];
  try {
    const raw = bd.run(['list', '--json', '--all']);
    issueList = Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
  } catch (e) {
    results.push({
      section: '§2.0',
      question: 'bd list --json --all (fixture sanity)',
      verdict: 'FAIL',
      output: (e as Error).message.slice(0, 200),
    });
    return;
  }
  const id = issueList[0]?.id;
  if (!id) {
    results.push({
      section: '§2.0',
      question: 'fixture seeded issue available',
      verdict: 'INCONCLUSIVE',
      notes: 'no seeded issue surfaced by bd list --json --all',
    });
    return;
  }

  // §2.1: `bd update --metadata <json>` — v1.0.4 exposes this per `bd update --help`.
  const metaJson = '{"gsd_section":"Evidence","gsd_body":"probe-value"}';
  const metaSet = spawnCapture(['update', id, '--metadata', metaJson], { cwd: dir });
  results.push({
    section: '§2.1',
    question: 'bd update <id> --metadata <json> accepted?',
    verdict: metaSet.status === 0 ? 'PASS' : 'FAIL',
    command: `bd update ${id} --metadata '${metaJson}'`,
    output: `exit=${metaSet.status}; stdout=${metaSet.stdout.slice(0, 120)}; stderr=${metaSet.stderr.slice(0, 120)}`,
    notes:
      metaSet.status === 0
        ? '--metadata primitive ACCEPTED by v1.0.4 — candidate for named-JSON-field storage'
        : 'metadata rejected — downgrade D-MAPPING toward Outcome B',
  });

  // §2.1b: roundtrip through `bd show --json` + `bd export --json`
  const showOut = spawnCapture(['show', id, '--json'], { cwd: dir });
  let showParsed: unknown = null;
  try {
    showParsed = JSON.parse(showOut.stdout || 'null');
  } catch {
    // ignore
  }
  const shown = Array.isArray(showParsed) ? showParsed[0] : showParsed;
  const showJson = JSON.stringify(shown ?? {});
  const showHasGsd = showJson.includes('gsd_section') && showJson.includes('probe-value');
  results.push({
    section: '§2.2',
    question: 'Does `bd show <id> --json` roundtrip the metadata?',
    verdict: showHasGsd ? 'PASS' : showJson.includes('metadata') ? 'PARTIAL' : 'FAIL',
    command: `bd show ${id} --json`,
    output: `stdout first 400 chars: ${(showOut.stdout || '').slice(0, 400)}`,
    notes: showHasGsd
      ? 'metadata key+value both visible in show output'
      : 'metadata key/value not obviously present — inspect output',
  });

  const exportOut = spawnCapture(['export', '--json'], { cwd: dir });
  const exportBody = exportOut.stdout || '';
  const exportHasGsd =
    exportBody.includes('gsd_section') && exportBody.includes('probe-value');
  results.push({
    section: '§2.3',
    question: 'Does `bd export --json` roundtrip the metadata byte-level?',
    verdict: exportHasGsd ? 'PASS' : 'FAIL',
    command: 'bd export --json',
    output: `body length=${exportBody.length}; contains "gsd_section"? ${exportBody.includes('gsd_section')}; contains "probe-value"? ${exportBody.includes('probe-value')}`,
    notes: exportHasGsd
      ? 'metadata survives export — candidate storage for L2/L3 section content in Outcome A'
      : 'metadata dropped from export — Outcome A infeasible for persisted state',
  });

  // §2.4: `--set-metadata key=value` form.
  const setMeta = spawnCapture(['update', id, '--set-metadata', 'gsd_probe=setmeta'], { cwd: dir });
  const afterSetMeta = spawnCapture(['show', id, '--json'], { cwd: dir });
  results.push({
    section: '§2.4',
    question: 'bd update <id> --set-metadata key=value accepted and visible?',
    verdict:
      setMeta.status === 0 && (afterSetMeta.stdout || '').includes('gsd_probe') ? 'PASS' : 'FAIL',
    command: `bd update ${id} --set-metadata gsd_probe=setmeta`,
    output: `setmeta exit=${setMeta.status}; show contains "gsd_probe"? ${(afterSetMeta.stdout || '').includes('gsd_probe')}`,
  });

  // §2.5: `bd update --help` flag inventory (for the record).
  const help = spawnCapture(['update', '--help']);
  const flagMatches = (help.stdout || '').match(/^\s+--[a-z][a-zA-Z0-9-]+/gm) || [];
  results.push({
    section: '§2.5',
    question: 'bd update --help flag inventory (first 20)',
    verdict: 'PASS',
    command: 'bd update --help',
    output: flagMatches.slice(0, 20).map((s) => s.trim()).join('\n'),
  });
}

// ---------- §3: Store-clone / bookmark (D-TXN Outcome B) ----------
function probe_storeClone(): void {
  // bd dolt primary.
  const doltHelp = spawnCapture(['dolt', '--help']);
  results.push({
    section: '§3.1',
    question: 'bd dolt subcommand inventory',
    verdict: doltHelp.status === 0 ? 'PASS' : 'INCONCLUSIVE',
    command: 'bd dolt --help',
    output: (doltHelp.stdout || doltHelp.stderr).slice(0, 800),
    notes:
      doltHelp.status === 0
        ? 'bd dolt passthrough exists — inspect for branch/clone/bookmark'
        : 'bd dolt unavailable',
  });

  // Specific subcommand probes.
  const candidates: string[][] = [
    ['dolt', 'branch', '--help'],
    ['dolt', 'clone', '--help'],
    ['dolt', 'bookmark', '--help'],
    ['branch', '--help'], // top-level bd branch
  ];
  for (const args of candidates) {
    const r = spawnCapture(args);
    results.push({
      section: '§3.2',
      question: `bd ${args.join(' ')} available?`,
      verdict: r.status === 0 ? 'PASS' : 'FAIL',
      command: `bd ${args.join(' ')}`,
      output: `exit=${r.status}; stdout head=${r.stdout.slice(0, 160)}; stderr head=${r.stderr.slice(0, 160)}`,
    });
  }
}

// ---------- §4: File-snapshot primitives (D-TXN Outcome C) ----------
function probe_snapshotRestore(dir: string): void {
  const snapshotPath = join(dir, 'snapshot.jsonl');
  const t0 = Date.now();
  const exp = spawnCapture(['export', '--json', '-o', snapshotPath], { cwd: dir });
  const expMs = Date.now() - t0;
  results.push({
    section: '§4.1',
    question: 'bd export --json -o <path> succeeds and writes a file?',
    verdict: exp.status === 0 && existsSync(snapshotPath) ? 'PASS' : 'FAIL',
    command: `bd export --json -o ${snapshotPath}`,
    output: `exit=${exp.status}; file exists=${existsSync(snapshotPath)}; time=${expMs}ms; stderr=${exp.stderr.slice(0, 200)}`,
  });

  const freshDir = mkdtempSync(join(tmpdir(), 'spike-restore-'));
  spawnSync('git', ['init', '-q'], { cwd: freshDir });
  const t1 = Date.now();
  const rst = spawnCapture(
    [
      'init',
      '--from-jsonl',
      snapshotPath,
      '--non-interactive',
      '--quiet',
    ],
    { cwd: freshDir },
  );
  const rstMs = Date.now() - t1;
  // Verify restored store has at least one issue.
  const listRestored = spawnCapture(['list', '--json', '--all'], { cwd: freshDir });
  let restoredCount = 0;
  try {
    const parsed = JSON.parse(listRestored.stdout || 'null');
    restoredCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    // JSONL fallback
    restoredCount = (listRestored.stdout || '')
      .split('\n')
      .filter((l) => l.trim().length > 0).length;
  }
  results.push({
    section: '§4.2',
    question: 'bd init --from-jsonl restores exported state?',
    verdict:
      rst.status === 0 && restoredCount > 0
        ? 'PASS'
        : rst.status === 0
          ? 'PARTIAL'
          : 'FAIL',
    command: `bd init --from-jsonl ${snapshotPath} --non-interactive --quiet`,
    output: `init exit=${rst.status}; time=${rstMs}ms; list-restored count=${restoredCount}; init stderr=${rst.stderr.slice(0, 200)}`,
    notes: `RESEARCH Pitfall 6 predicted 400-700ms cold-start; measured ${rstMs}ms`,
  });

  rmSync(freshDir, { recursive: true, force: true });
}

// ---------- §5: Comments label vs author (Landmine 4 reverify) ----------
function probe_commentsLabelVsAuthor(dir: string, bd: BdRunner): void {
  let issueList: Array<{ id: string }> = [];
  try {
    const raw = bd.run(['list', '--json', '--all']);
    issueList = Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
  } catch {
    // ignore
  }
  const id = issueList[0]?.id;
  if (!id) {
    results.push({
      section: '§5.0',
      question: 'comments label/author reverify (fixture)',
      verdict: 'INCONCLUSIVE',
      notes: 'no seeded issue',
    });
    return;
  }

  // v1.0.4's `bd comments add --help` shows only --author, --file. No --label.
  // Probe --label anyway to surface current behavior.
  const labelAttempt = spawnCapture(['comments', 'add', id, '--label', 'test:label', 'label-body'], { cwd: dir });
  const authorAttempt = spawnCapture(['comments', 'add', id, '--author', 'gsd:event:test', 'author-body'], { cwd: dir });
  const show = spawnCapture(['comments', id, '--json'], { cwd: dir });
  const bodyStr = show.stdout || '';

  results.push({
    section: '§5.1',
    question: 'Does bd comments add --label work? (Landmine 4 reverify)',
    verdict: bodyStr.includes('test:label') ? 'PASS' : 'FAIL',
    command: `bd comments add ${id} --label test:label label-body`,
    output: `labelAttempt exit=${labelAttempt.status}; export contains 'test:label'? ${bodyStr.includes('test:label')}; stderr=${labelAttempt.stderr.slice(0, 160)}`,
    notes:
      labelAttempt.status !== 0
        ? `--label rejected (stderr: ${labelAttempt.stderr.slice(0, 120)}) — Landmine 4 TIGHTENED (was silent, now hard-rejects)`
        : 'Landmine 4 may have changed — inspect',
  });
  results.push({
    section: '§5.2',
    question: 'Does bd comments add --author preserve in export?',
    verdict: bodyStr.includes('gsd:event:test') ? 'PASS' : 'FAIL',
    command: `bd comments add ${id} --author gsd:event:test author-body`,
    output: `authorAttempt exit=${authorAttempt.status}; export contains 'gsd:event:test'? ${bodyStr.includes('gsd:event:test')}`,
    notes: '--author remains the structured channel per sibling D-09 amendment',
  });
  results.push({
    section: '§5.3',
    question: 'bd comments add --help inventory',
    verdict: 'PASS',
    command: 'bd comments add --help',
    output: (spawnCapture(['comments', 'add', '--help']).stdout || '').slice(0, 500),
  });
}

// ---------- §6: Memory API (reverify) ----------
function probe_memoryApi(dir: string): void {
  const key = 'test-mem-1';
  const remember = spawnCapture(['remember', 'probe-value-42', '--key', key], { cwd: dir });
  const recall = spawnCapture(['recall', key], { cwd: dir });
  results.push({
    section: '§6.1',
    question: 'bd remember + bd recall round-trip?',
    verdict:
      remember.status === 0 && recall.status === 0 && recall.stdout.includes('probe-value-42')
        ? 'PASS'
        : 'FAIL',
    command: `bd remember 'probe-value-42' --key ${key}; bd recall ${key}`,
    output: `remember exit=${remember.status}; recall exit=${recall.status}; recall stdout=${(recall.stdout || '').slice(0, 200)}; recall stderr=${(recall.stderr || '').slice(0, 160)}`,
    notes: 'memory-key format v1.0.4: simple string keys; JSON body is freeform',
  });
  results.push({
    section: '§6.2',
    question: 'bd remember --help inventory',
    verdict: 'PASS',
    command: 'bd remember --help',
    output: (spawnCapture(['remember', '--help']).stdout || '').slice(0, 400),
  });
}

// ---------- §8: Landmines 5/6/7 reverify ----------
function probe_landmineReverify(dir: string, bd: BdRunner): void {
  // Landmine 5: bd show <id> --json returns array?
  try {
    const listRaw = bd.run(['list', '--json', '--all']);
    const list = Array.isArray(listRaw) ? (listRaw as Array<{ id: string }>) : [];
    const id = list[0]?.id;
    if (id) {
      const show = spawnCapture(['show', id, '--json'], { cwd: dir });
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(show.stdout || 'null');
      } catch {
        // ignore
      }
      results.push({
        section: '§8.1',
        question: 'Landmine 5: bd show <id> --json returns single-element array?',
        verdict: Array.isArray(parsed) ? 'PASS' : parsed && typeof parsed === 'object' ? 'FAIL' : 'INCONCLUSIVE',
        command: `bd show ${id} --json`,
        output: `type=${Array.isArray(parsed) ? 'array' : typeof parsed}; length=${Array.isArray(parsed) ? parsed.length : 'n/a'}; stdout head=${(show.stdout || '').slice(0, 80)}`,
        notes: Array.isArray(parsed)
          ? 'Landmine 5 STILL PRESENT — BdRunner.show() array-unwrap continues correct'
          : 'shape changed — update BdRunner.show() unwrap logic',
      });
    }
  } catch (e) {
    results.push({
      section: '§8.1',
      question: 'Landmine 5 reverify',
      verdict: 'INCONCLUSIVE',
      output: (e as Error).message.slice(0, 120),
    });
  }

  // Landmine 6: bd export --json is JSONL (not JSON array)?
  const exp = spawnCapture(['export', '--json'], { cwd: dir });
  const body = exp.stdout || '';
  const isJsonl = body.length > 0 && !body.startsWith('[') && body.split('\n').some((l) => l.trim().startsWith('{'));
  results.push({
    section: '§8.2',
    question: 'Landmine 6: bd export --json emits JSONL (not JSON array)?',
    verdict: isJsonl ? 'PASS' : body.startsWith('[') ? 'FAIL' : 'INCONCLUSIVE',
    command: 'bd export --json',
    output: `body first 120 chars: ${body.slice(0, 120)}; length=${body.length}`,
    notes: isJsonl
      ? 'JSONL — BdRunner JSONL fallback correct'
      : 'body starts with "[" — bd emits JSON array; BdRunner fallback still safe',
  });

  // Landmine 7: empty store → {error, schema_version} with exit 0?
  const empty = mkdtempSync(join(tmpdir(), 'spike-empty-'));
  spawnSync('git', ['init', '-q'], { cwd: empty });
  spawnCapture(['init', '--non-interactive', '--quiet'], { cwd: empty });
  const listEmpty = spawnCapture(['list', '--json', '--all'], { cwd: empty });
  const emptyBody = listEmpty.stdout || '';
  let emptyParsed: unknown = null;
  try {
    emptyParsed = JSON.parse(emptyBody);
  } catch {
    // ignore
  }
  const emptyShape =
    emptyParsed !== null &&
    typeof emptyParsed === 'object' &&
    'error' in (emptyParsed as object) &&
    'schema_version' in (emptyParsed as object);
  const emptyArray = Array.isArray(emptyParsed) && (emptyParsed as unknown[]).length === 0;
  results.push({
    section: '§8.3',
    question: 'Landmine 7: empty store → {error, schema_version} at exit 0?',
    verdict: emptyShape ? 'PASS' : emptyArray ? 'FAIL' : 'PARTIAL',
    command: 'bd list --json --all (empty store)',
    output: `exit=${listEmpty.status}; body first 160 chars: ${emptyBody.slice(0, 160)}`,
    notes: emptyShape
      ? 'BdRunner Landmine 7 sentinel detection still correct'
      : emptyArray
        ? 'bd NOW returns empty array for empty store — update BdRunner sentinel match'
        : 'shape unexpected — inspect',
  });
  rmSync(empty, { recursive: true, force: true });

  // Bonus: probe `bd delete --cascade` for Open Q #2 (removeCollection cascade)
  try {
    const listRaw = bd.run(['list', '--json', '--all']);
    const list = Array.isArray(listRaw) ? (listRaw as Array<{ id: string }>) : [];
    if (list.length >= 2) {
      const [parent, child] = list;
      // link child as blocked-by parent
      spawnCapture(['dep', 'add', parent.id, child.id, '--type', 'blocks'], { cwd: dir });
      const del = spawnCapture(['delete', parent.id, '--cascade', '--force'], { cwd: dir });
      results.push({
        section: '§8.4',
        question: 'Open Q #2: bd delete --cascade --force works on parent→child?',
        verdict: del.status === 0 ? 'PASS' : 'FAIL',
        command: `bd delete ${parent.id} --cascade --force`,
        output: `exit=${del.status}; stdout=${del.stdout.slice(0, 200)}; stderr=${del.stderr.slice(0, 160)}`,
        notes:
          del.status === 0
            ? 'removeCollection CAN use --cascade; avoids listCollection + remove-per-issue loop'
            : 'cascade not viable — fall back to listCollection + per-issue remove',
      });
    } else {
      results.push({
        section: '§8.4',
        question: 'Open Q #2: bd delete --cascade probe',
        verdict: 'INCONCLUSIVE',
        notes: 'fewer than 2 seeded issues surviving prior probes',
      });
    }
  } catch (e) {
    results.push({
      section: '§8.4',
      question: 'Open Q #2: bd delete --cascade probe',
      verdict: 'INCONCLUSIVE',
      output: (e as Error).message.slice(0, 160),
    });
  }
}

// ---------- Emit SPIKE-RESULTS.md ----------
function emit(): void {
  const lines: string[] = [];
  lines.push('# Plan 06-03: bd Primitives Spike — Results');
  lines.push('');
  lines.push(`**Executed:** ${new Date().toISOString()}`);
  lines.push(`**bd version:** \`${version.raw}\` (family ${version.family})`);
  lines.push(
    version.family === '1.0.3'
      ? '**Version match:** matches sibling-pinned v1.0.3 `1b2dd2cb`; no point-release variance.'
      : version.family === '1.0.4'
        ? '**Version variance:** sibling was pinned at v1.0.3 `1b2dd2cb`; user ran spike against v1.0.4 (Homebrew patch release). New subcommands visible in §1.2 (e.g. `delete`, `comment`, `q`). Flagged for Task-3 human-verify checkpoint.'
        : `**Version variance:** unexpected family \`${version.family}\` — downstream plans must re-verify primitives against this build.`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## §1. bd CLI catalog discovered');
  lines.push('');
  for (const r of results.filter((x) => x.section.startsWith('§1'))) {
    lines.push(`### ${r.section} — ${r.question}`);
    lines.push('');
    lines.push(`**Verdict:** ${r.verdict}`);
    if (r.command) lines.push(`**Command:** \`${r.command}\``);
    if (r.output) {
      lines.push('');
      lines.push('```');
      lines.push(r.output);
      lines.push('```');
    }
    if (r.notes) {
      lines.push('');
      lines.push(`**Notes:** ${r.notes}`);
    }
    lines.push('');
  }

  const sectionOrder: Array<{ prefix: string; title: string }> = [
    { prefix: '§2', title: '§2. Named-JSON-field availability (D-MAPPING)' },
    { prefix: '§3', title: '§3. Store-clone + bead-hash bookmark primitives (D-TXN Outcome B)' },
    { prefix: '§4', title: '§4. File-snapshot primitives (D-TXN Outcome C)' },
    { prefix: '§5', title: '§5. Comment structure (Landmine 4 reverify)' },
    { prefix: '§6', title: '§6. Memory API reverify' },
    { prefix: '§8', title: '§8. Landmines 5/6/7 reverify + bd delete --cascade (Open Q #2)' },
  ];

  for (const { prefix, title } of sectionOrder) {
    lines.push(`## ${title}`);
    lines.push('');
    const section = results.filter((x) => x.section.startsWith(prefix));
    if (section.length === 0) {
      lines.push('_No results recorded for this section — probe skipped or errored._');
      lines.push('');
      continue;
    }
    for (const r of section) {
      lines.push(`### ${r.section} — ${r.question}`);
      lines.push('');
      lines.push(`**Verdict:** ${r.verdict}`);
      if (r.command) lines.push(`**Command:** \`${r.command}\``);
      if (r.output) {
        lines.push('');
        lines.push('```');
        lines.push(r.output);
        lines.push('```');
      }
      if (r.notes) {
        lines.push('');
        lines.push(`**Notes:** ${r.notes}`);
      }
      lines.push('');
    }
  }

  lines.push('## §7. CHOSEN OUTCOMES');
  lines.push('');
  lines.push('### D-MAPPING: _to be filled by Task 3 (developer review)_');
  lines.push('');
  lines.push('Candidates: **A** (sub-records / named-JSON-field available) / **B** (labels-first ships)');
  lines.push('');
  lines.push('Evidence: see §2 results above.');
  lines.push('');
  lines.push('### D-TXN: _to be filled by Task 3 (developer review)_');
  lines.push('');
  lines.push('Candidates: **A** (in-memory buffer) / **B** (staging + bookmark) / **C** (file-snapshot)');
  lines.push('');
  lines.push('Evidence: see §3 + §4 results above.');
  lines.push('');

  lines.push('## §9. Shipped bd CLI commands for chosen outcomes');
  lines.push('');
  lines.push('_To be filled by Task 3 once §7 outcomes lock._');
  lines.push('');

  writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`Wrote ${OUT_PATH} (${lines.length} lines)`);
}

// ---------- Main ----------
function main(): void {
  preflight();
  catalogSubcommands();
  const { dir, bd } = setupFixture();
  try {
    probe_namedJsonField(dir, bd);
    probe_storeClone();
    probe_snapshotRestore(dir);
    probe_commentsLabelVsAuthor(dir, bd);
    probe_memoryApi(dir);
    probe_landmineReverify(dir, bd);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  emit();

  const failureCount = results.filter((r) => r.verdict === 'FAIL').length;
  const inconclusiveCount = results.filter((r) => r.verdict === 'INCONCLUSIVE').length;
  console.log(
    `Probes: ${results.length}; PASS=${results.filter((r) => r.verdict === 'PASS').length}; PARTIAL=${results.filter((r) => r.verdict === 'PARTIAL').length}; FAIL=${failureCount}; INCONCLUSIVE=${inconclusiveCount}`,
  );
}

main();
