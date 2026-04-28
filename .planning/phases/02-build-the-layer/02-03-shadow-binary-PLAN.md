---
phase: 02-build-the-layer
plan: 03
type: execute
wave: 2
depends_on: [02]
files_modified:
  - bin/gsd-sdk-shadow.mjs
  - bin/wrap-mutation.mjs
  - tests/shadow-tests/argv-routing.test.mjs
  - tests/shadow-tests/wrap-mutation.test.mjs
  - tests/shadow-tests/handler-phase-add.test.mjs
  - tests/shadow-tests/handler-phase-add-batch.test.mjs
  - tests/shadow-tests/handler-phase-insert.test.mjs
  - tests/shadow-tests/handler-phase-complete.test.mjs
  - tests/shadow-tests/handler-phase-remove.test.mjs
  - tests/shadow-tests/handler-phase-scaffold.test.mjs
  - tests/shadow-tests/handler-phases-clear.test.mjs
  - tests/shadow-tests/handler-phases-archive.test.mjs
  - tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs
  - tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs
  - tests/shadow-tests/handler-requirements-mark-complete.test.mjs
  - tests/shadow-tests/handler-todo-complete.test.mjs
  - tests/shadow-tests/handler-milestone-complete.test.mjs
autonomous: true
requirements: [REQ-01, REQ-02, REQ-04]
requirements_addressed: [REQ-01, REQ-02, REQ-04]
must_haves:
  truths:
    - "bin/gsd-sdk-shadow.mjs is a Node ESM binary that imports upstream's createRegistry, resolveQueryArgv, extractField via dynamic import (REQ-02 — no fork)"
    - "BEADS_OVERRIDES exports exactly 13 bd-backed handlers covering all state-bearing mutations (REQ-04, per shadow-binary-architecture.md)"
    - "Shadow detects beads-managed projects via existsSync('.beads/metadata.json') (Spike 013)"
    - "Shadow falls through to spawnUpstream(argv) for non-query, non-overridden commands, and non-beads-managed projects (REQ-02 — passthrough preserves upstream behavior)"
    - "wrap-mutation.mjs reproduces upstream buildMutationEvent's prefix-dispatch logic (Pitfall 2 — buildMutationEvent NOT exported)"
    - "Per D-02, all 13 BEADS_OVERRIDES handlers live in a single `bin/gsd-sdk-shadow.mjs` (not split per-handler) — shared `spawnUpstream` + argv routing scaffolding (B3 fix — D-02 explicit reference)."
    - "argv routing handles --project-dir AFTER `query <cmd>` per Pitfall 4 (Spike 013 iter-4)"
    - "Each of 13 handlers calls bd CLI subprocess, returns { data: {...} } QueryResult shape"
    - "wrap-mutation runs as a no-op in MVP (eventStream=null in production); the helper exists for forward-compat with a future dashboard / GSDEvent consumer (D-09 preserved). W3 fix — production wrap-pass is a no-op behind the null eventStream."
    - "Snapshot test for wrap-mutation uses a SPY pattern (mock eventStream + mock handler) and asserts the captured event shape vs the documented buildMutationEvent contract — does NOT invoke real upstream handlers (W2 fix — Pitfall 2 mitigation via in-process spy, no upstream side effects)."
  artifacts:
    - path: "bin/gsd-sdk-shadow.mjs"
      provides: "Y1 shadow gsd-sdk binary with 13 bd-backed mutation handlers (single file per D-02)"
      min_lines: 250
    - path: "bin/wrap-mutation.mjs"
      provides: "GSDEvent emission helper reproducing upstream's prefix dispatch"
      min_lines: 80
    - path: "tests/shadow-tests/argv-routing.test.mjs"
      provides: "Tests for query detection, --project-dir parsing, --pick handling, non-beads passthrough"
    - path: "tests/shadow-tests/wrap-mutation.test.mjs"
      provides: "Spy-based snapshot test against documented buildMutationEvent contract (W2 fix)"
    - path: "tests/shadow-tests/handler-*.test.mjs"
      provides: "Per-handler tests for all 13 BEADS_OVERRIDES entries"
  key_links:
    - from: "bin/gsd-sdk-shadow.mjs"
      to: "createRegistry, resolveQueryArgv, extractField"
      via: "await import(QUERY_INDEX_PATH) + await import(REGISTRY_PATH)"
      pattern: "await import.*query/index\\.js"
    - from: "bin/gsd-sdk-shadow.mjs"
      to: "wrap-mutation.mjs"
      via: "import { wrapMutation } from './wrap-mutation.mjs'"
      pattern: "wrapMutation"
    - from: "bin/gsd-sdk-shadow.mjs"
      to: "bd CLI"
      via: "execSync('bd q ...', execSync('bd label add ...'), execSync('bd link ...')"
      pattern: "execSync.*'bd "
    - from: "bin/gsd-sdk-shadow.mjs"
      to: "upstream gsd-sdk binary"
      via: "spawnSync(UPSTREAM_BIN, argv) for passthrough"
      pattern: "spawnSync.*UPSTREAM_BIN"
---

<objective>
Build the shadow `gsd-sdk` binary (Architecture Y1, registry-override variant — D-09). The shadow imports upstream's SDK primitives via dynamic ESM import, registers 13 bd-backed handler overrides, dispatches via the SDK's own machinery, and falls through to upstream for everything else. Adds a `wrap-mutation.mjs` helper to re-emit GSDEvents (Pitfall 2 — `buildMutationEvent` is NOT exported by upstream so we reproduce it).

**Per D-02 (CONTEXT.md):** all 13 handlers live in a SINGLE file `bin/gsd-sdk-shadow.mjs` (not split per-handler) — they share argv routing + spawnUpstream + import boilerplate. Per-handler tests live separately under `tests/shadow-tests/handler-*.test.mjs`.

**MVP wrap-pass clarification (W3 fix):** in production, `eventStream=null`, so `wrapMutation` is a NO-OP — it returns the handler's result and the `?.emitEvent` chain short-circuits. The helper exists in MVP solely for forward-compat with a future dashboard/GSDEvent consumer (preserves D-09's option without shipping a consumer).

Plan 02-02 must be complete first (the defensive-backup hook depends on the shadow being the primary mutation path). Wave-2 alongside Plan 02-04 (worktree-init) which has no file conflicts.

Purpose: Beads becomes the source of truth for the 13 state-bearing mutations transparently — upstream `/gsd-*` skills work without modification (REQ-01, REQ-02, REQ-04).
Output: 1 shadow binary + 1 wrap-mutation helper + 14 test files (13 handler-* + 1 argv-routing + 1 wrap-mutation snapshot).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-build-the-layer/02-CONTEXT.md
@.planning/phases/02-build-the-layer/02-RESEARCH.md
@.planning/phases/02-build-the-layer/02-PATTERNS.md
@.planning/phases/02-build-the-layer/02-VALIDATION.md
@.planning/spikes/CONVENTIONS.md
@.planning/spikes/MANIFEST.md
@.claude/skills/spike-findings-gsd-beads/SKILL.md
@.claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md
@.claude/skills/spike-findings-gsd-beads/references/beads-modeling.md
@.claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs

<interfaces>
<!-- Upstream SDK exports the shadow consumes via dynamic import (verified Spike 013 + Phase 2 RESEARCH.md) -->

From `~/.volta/.../get-shit-done-cc/sdk/dist/query/index.js`:
- `createRegistry(eventStream?, sessionId?) → QueryRegistry` — returns a registry; wraps QUERY_MUTATION_COMMANDS handlers with GSDEvent emission AT CONSTRUCTION TIME (this is why our overrides via register() bypass the wrap — D-09 reasoning)
- `QUERY_MUTATION_COMMANDS: Set<string>` — the 89-entry mutation set used for wrap-pass
- `buildMutationEvent` — INTERNAL function (NOT exported, line 121) — reproduce in wrap-mutation.mjs

From `~/.volta/.../get-shit-done-cc/sdk/dist/query/registry.js`:
- `QueryRegistry` — class with `.register(cmd, handler)`, `.dispatch(cmd, args, projectDir) → Promise<QueryResult>`
- `resolveQueryArgv(argv, registry) → { cmd, args } | null` — handles dotted vs space-aliased forms via longest-prefix scan
- `extractField(data, fieldPath) → any` — implements --pick semantics

From `~/.volta/.../get-shit-done-cc/sdk/dist/types.js`:
- `GSDEventType: enum` — StateMutation, GitCommit, FrontmatterMutation, etc. (lines 24-67)

QueryHandler signature (verified):
```typescript
type QueryHandler = (args: string[], projectDir: string) => Promise<QueryResult>;
type QueryResult = { data: any };  // upstream's printers expect exactly this shape
```

The 13 state-bearing mutations (per shadow-binary-architecture.md):
- `phase.add`, `phase.add-batch`, `phase.insert`, `phase.complete`, `phase.remove`, `phase.scaffold`
- `phases.clear`, `phases.archive`
- `roadmap.update-plan-progress`, `roadmap.annotate-dependencies`
- `requirements.mark-complete`
- `todo.complete`
- `milestone.complete`

bd CLI commands available to handlers:
- `bd q "<title>" -t epic -p <pri>` — quick-create bead, returns ID
- `bd q "<title>" -t task -p <pri>` — quick-create task
- `bd label add <id> <label>` — apply label
- `bd label remove <id> <label>` — strip label
- `bd link <child> <parent> --type parent-child` — hierarchy edge
- `bd close <id> [--reason <text>]` — close bead
- `bd update <id> --status <s>` — status change
- `bd remember --key <key> "<text>"` — memory write
- `bd list --json` / `bd show <id> --json` / `bd children <id> --json` — read
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Create 14 shadow test stub files</name>
  <files>
    tests/shadow-tests/argv-routing.test.mjs,
    tests/shadow-tests/wrap-mutation.test.mjs,
    tests/shadow-tests/handler-phase-add.test.mjs,
    tests/shadow-tests/handler-phase-add-batch.test.mjs,
    tests/shadow-tests/handler-phase-insert.test.mjs,
    tests/shadow-tests/handler-phase-complete.test.mjs,
    tests/shadow-tests/handler-phase-remove.test.mjs,
    tests/shadow-tests/handler-phase-scaffold.test.mjs,
    tests/shadow-tests/handler-phases-clear.test.mjs,
    tests/shadow-tests/handler-phases-archive.test.mjs,
    tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs,
    tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs,
    tests/shadow-tests/handler-requirements-mark-complete.test.mjs,
    tests/shadow-tests/handler-todo-complete.test.mjs,
    tests/shadow-tests/handler-milestone-complete.test.mjs
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (Test files NEW — tests/shadow-tests section, lines 812-855 — node:test shape with ephemeral bd init fixture)
    - .planning/phases/02-build-the-layer/02-VALIDATION.md (per-task verification map for 02-03)
    - .claude/skills/spike-findings-gsd-beads/references/shadow-binary-architecture.md (the 13 mutation list — must match BEADS_OVERRIDES keys)
  </read_first>
  <action>
    Create 14 stubs. Stack: `node:test` (built-in, ESM-native, zero deps — per CONVENTIONS Standard Stack and RESEARCH.md).

    **Common shape for each handler test stub:**
    ```javascript
    import { test } from 'node:test';
    import assert from 'node:assert/strict';

    test('STUB — handler-{name}: production code not yet written', () => {
      // CASE 1: handler creates correct bead(s) with correct labels
      // CASE 2: handler returns { data: {...} } with backend: 'beads'
      // CASE 3: handler errors gracefully on malformed args
      assert.fail('handler-{name} stub — Wave 0 marker');
    });
    ```
    Each test stub fails by design (Wave 0 red marker).

    **Special stubs:**

    `tests/shadow-tests/argv-routing.test.mjs` — list these CASEs in comment block + a single failing test:
    - CASE 1: `query phase.add "X"` (dotted) — beads-managed → routes to handler
    - CASE 2: `query phase add "X"` (space-aliased) — same
    - CASE 3: `query progress` — read-only, falls through to upstream
    - CASE 4: `query phase.add "X" --pick phase_id` — extractField returns just the ID
    - CASE 5: `--help` — passes through to upstream (no `query` token)
    - CASE 6: non-beads project (no .beads/metadata.json) — passes through
    - CASE 7: `query made-up-command` — resolveQueryArgv returns null → upstream
    - CASE 8: `query phase.add "X" --project-dir /tmp/test` — projectDir parsed correctly (Pitfall 4)
    - CASE 9: `--project-dir` BEFORE `query` — still works (argv.indexOf is position-agnostic for the FIND, but dispatch happens after queryIdx — verify both shapes)

    `tests/shadow-tests/wrap-mutation.test.mjs` — list these CASEs (W2 fix — spy-based, no upstream invocation):
    - CASE 1: phase.add — buildMutationEvent emits StateMutation type with cmd, args, success
    - CASE 2: roadmap.update-plan-progress — same shape
    - CASE 3: requirements.mark-complete — same
    - CASE 4: todo.complete — same
    - CASE 5: milestone.complete — same
    - CASE 6: SPY snapshot — wrapMutation wraps a mock handler that returns a fixed result; mock eventStream captures emitted events; assert captured event matches the documented buildMutationEvent contract (no upstream handler invocation, no filesystem side effects).
    - CASE 7: fire-and-forget — eventStream throws → handler still returns result
    - CASE 8: NULL eventStream — handler with eventStream=null/undefined still returns result (no crash on `?.emitEvent`); MVP production behavior (W3 fix).

    Make all 14 files importable: `node --check tests/shadow-tests/<file>.test.mjs` exits 0 for each.
  </action>
  <acceptance_criteria>
    - All 14 .test.mjs files exist under `tests/shadow-tests/`.
    - File count: `ls tests/shadow-tests/handler-*.test.mjs | wc -l` returns 13.
    - `tests/shadow-tests/argv-routing.test.mjs` exists.
    - `tests/shadow-tests/wrap-mutation.test.mjs` exists.
    - `node --check tests/shadow-tests/argv-routing.test.mjs && node --check tests/shadow-tests/wrap-mutation.test.mjs` — syntax-clean.
    - Running any handler test stub via `node --test tests/shadow-tests/handler-phase-add.test.mjs` exits non-zero (Wave 0 red).
    - `grep -c '// CASE' tests/shadow-tests/argv-routing.test.mjs` returns at least 8.
    - `grep -c '// CASE' tests/shadow-tests/wrap-mutation.test.mjs` returns at least 8.
  </acceptance_criteria>
  <verify>
    <automated>for f in tests/shadow-tests/*.test.mjs; do node --check "$f" || exit 1; done; ls tests/shadow-tests/handler-*.test.mjs | wc -l | grep -q '^13$'</automated>
  </verify>
  <done>14 stub files; node:test syntax-clean; all are red Wave 0 markers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 2): Implement bin/wrap-mutation.mjs + complete its spy-based snapshot test</name>
  <files>
    bin/wrap-mutation.mjs,
    tests/shadow-tests/wrap-mutation.test.mjs
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Pitfall 2 lines 419-440 — buildMutationEvent NOT exported; Code Example 4 lines 571-605 — exact helper structure)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (bin/wrap-mutation.mjs section lines 576-628 — 7 prefix branches, GSDEventType import path, snapshot test requirement)
    - Upstream: ~/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc/sdk/dist/query/index.js lines 121-199 (buildMutationEvent body — re-implement)
    - Upstream: ~/.volta/.../sdk/dist/types.js lines 24-67 (GSDEventType enum — import this)
  </read_first>
  <behavior>
    - Test 1-5 (5 prefix branches): for cmd in [phase.add, roadmap.update-plan-progress, requirements.mark-complete, todo.complete, milestone.complete] — buildMutationEvent returns object with shape `{ timestamp, sessionId, type, command, fields, success }` and correct GSDEventType.
    - Test 6 (SPY SNAPSHOT — W2 fix): use a mock eventStream `{ emitEvent: (e) => captured.push(e) }` and a mock handler `async () => ({ ok: true })`. Call `wrapMutation(handler, 'phase.add', eventStream, 'session-id')` and invoke the wrapped handler with sample args. Assert exactly one event was captured and matches the documented buildMutationEvent shape (modulo timestamp). NO upstream handler invocation, NO filesystem mutations.
    - Test 7 (FIRE-AND-FORGET): eventStream's emitEvent throws synchronously → wrapped handler still returns the handler's result without re-throwing.
    - Test 8 (NULL eventStream — W3 fix): wrapMutation called with eventStream=null (production MVP path). Wrapped handler returns the handler's result; no crash on `?.emitEvent`. Confirms wrap-pass is a no-op in MVP.
  </behavior>
  <action>
    **Step A: Implement `bin/wrap-mutation.mjs`.** Per RESEARCH.md Code Example 4 + PATTERNS.md lines 586-611. The 7 prefix branches from upstream lines 121-199.

    ```javascript
    // Source-attribution: derived from upstream get-shit-done-cc/sdk/dist/query/index.js
    //                     lines 121-199 (buildMutationEvent body — NOT EXPORTED)
    //                     lines 486-503 (wrapMutation wrapper pattern)
    // Pitfall 2 mitigation: re-implemented because upstream does not export buildMutationEvent.
    // Spy-based snapshot test in tests/shadow-tests/wrap-mutation.test.mjs verifies parity.

    const SDK_BASE = process.env.GSD_SDK_PATH
      ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
    const TYPES_PATH = `${SDK_BASE}/sdk/dist/types.js`;

    const { GSDEventType } = await import(TYPES_PATH);

    /**
     * Reproduces upstream buildMutationEvent's prefix-dispatch logic.
     * Returns a GSDEvent matching the shape upstream's wrap-pass emits.
     */
    export function buildMutationEvent(sessionId, cmd, args, result) {
      const base = {
        timestamp: new Date().toISOString(),
        sessionId,
        command: cmd,
        success: true,
      };
      // Branch 1: template.*
      if (cmd.startsWith('template.') || cmd.startsWith('template ')) {
        return { ...base, type: GSDEventType.TemplateMutation, fields: args.slice(0, 2) };
      }
      // Branch 2: commit
      if (cmd === 'commit' || cmd.startsWith('commit ')) {
        return { ...base, type: GSDEventType.GitCommit, fields: args.slice(0, 2) };
      }
      // Branch 3: frontmatter.*
      if (cmd.startsWith('frontmatter.') || cmd.startsWith('frontmatter ')) {
        return { ...base, type: GSDEventType.FrontmatterMutation, fields: args.slice(0, 2) };
      }
      // Branch 4: config-*
      if (cmd.startsWith('config-')) {
        return { ...base, type: GSDEventType.ConfigMutation, fields: args.slice(0, 2) };
      }
      // Branch 5: validate.*
      if (cmd.startsWith('validate.') || cmd.startsWith('validate ')) {
        return { ...base, type: GSDEventType.ValidationMutation, fields: args.slice(0, 2) };
      }
      // Branch 6: phase.* / phases.*
      if (cmd.startsWith('phase.') || cmd.startsWith('phase ') ||
          cmd.startsWith('phases.') || cmd.startsWith('phases ')) {
        return { ...base, type: GSDEventType.StateMutation, fields: args.slice(0, 2) };
      }
      // Branch 7: state.*
      if (cmd.startsWith('state.') || cmd.startsWith('state ')) {
        return { ...base, type: GSDEventType.StateMutation, fields: args.slice(0, 2) };
      }
      // Fallback
      return { ...base, type: GSDEventType.StateMutation, fields: args.slice(0, 2) };
    }

    /**
     * Wrap a QueryHandler with GSDEvent emission post-execution.
     * Fire-and-forget: emit errors do NOT propagate.
     * NULL eventStream → no-op (MVP production path; W3 invariant).
     */
    export function wrapMutation(handler, cmd, eventStream, sessionId) {
      return async (args, projectDir) => {
        const result = await handler(args, projectDir);
        try {
          eventStream?.emitEvent(buildMutationEvent(sessionId, cmd, args, result));
        } catch {
          // Fire-and-forget per upstream pattern (line 502 of index.js).
        }
        return result;
      };
    }
    ```

    **Step B: Fill in `tests/shadow-tests/wrap-mutation.test.mjs` using a SPY pattern (W2 fix — no upstream invocation, no real handlers).** Use `node:test`. Import `wrapMutation` and `buildMutationEvent` from `../../bin/wrap-mutation.mjs`. Implement Tests 1-8:

    Test 6 (SPY SNAPSHOT — W2 fix) example:
    ```javascript
    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { wrapMutation, buildMutationEvent } from '../../bin/wrap-mutation.mjs';

    test('CASE 6: spy snapshot — wrapMutation captures expected event shape', async () => {
      const captured = [];
      const eventStream = { emitEvent: (e) => captured.push(e) };
      const mockHandler = async (args, projectDir) => ({ ok: true, args, projectDir });

      const wrapped = wrapMutation(mockHandler, 'phase.add', eventStream, 'session-id');
      const result = await wrapped(['Test phase', 'extra'], '/proj');

      assert.equal(captured.length, 1, 'exactly one event captured');
      const event = captured[0];
      // Compare against documented buildMutationEvent contract (modulo timestamp)
      assert.equal(event.sessionId, 'session-id');
      assert.equal(event.command, 'phase.add');
      assert.deepStrictEqual(event.fields, ['Test phase', 'extra']);
      assert.equal(event.success, true);
      assert.match(event.type, /StateMutation|state-mutation/i); // GSDEventType enum value
      assert.ok(event.timestamp);
      // Handler result is unaffected
      assert.deepStrictEqual(result, { ok: true, args: ['Test phase', 'extra'], projectDir: '/proj' });
    });

    test('CASE 7: fire-and-forget — eventStream throws, handler still returns result', async () => {
      const eventStream = { emitEvent: () => { throw new Error('emit failed'); } };
      const wrapped = wrapMutation(async () => ({ ok: true }), 'phase.add', eventStream, 's');
      const result = await wrapped([], '/proj');
      assert.deepStrictEqual(result, { ok: true });
    });

    test('CASE 8: null eventStream — MVP production no-op', async () => {
      const wrapped = wrapMutation(async () => ({ ok: true }), 'phase.add', null, 's');
      const result = await wrapped([], '/proj');
      assert.deepStrictEqual(result, { ok: true });
    });
    ```

    **CRITICAL (W2 fix):** the spy-based test does NOT call upstream's `createRegistry`, does NOT invoke real upstream handlers, and does NOT touch the filesystem. The Pitfall 2 mitigation is verified by asserting the captured event matches the documented shape — that's sufficient parity proof.

    **Threat note:** wrap-mutation is a pure transform — no untrusted input crosses a security boundary here.
  </action>
  <acceptance_criteria>
    - `bin/wrap-mutation.mjs` exists.
    - `node --check bin/wrap-mutation.mjs` exits 0.
    - `grep -c 'export function wrapMutation' bin/wrap-mutation.mjs` returns at least 1.
    - `grep -c 'export function buildMutationEvent' bin/wrap-mutation.mjs` returns at least 1.
    - `grep -c "cmd.startsWith" bin/wrap-mutation.mjs` returns at least 7 (the 7 prefix branches).
    - `grep -c 'GSDEventType' bin/wrap-mutation.mjs` returns at least 5 (import + 4+ usages).
    - `grep -c 'eventStream?\.emitEvent\|catch' bin/wrap-mutation.mjs` returns at least 1 (try/catch around emit; MVP null-safe chain).
    - `grep -c 'eventStream = null\|eventStream=null\|MVP\|no-op' bin/gsd-sdk-shadow.mjs` returns at least 1 (W3 — production wires eventStream=null; comment marker).
    - `node --test tests/shadow-tests/wrap-mutation.test.mjs` exits 0; >= 8 tests pass (Tests 1-8).
  </acceptance_criteria>
  <verify>
    <automated>node --test tests/shadow-tests/wrap-mutation.test.mjs</automated>
  </verify>
  <done>wrap-mutation.mjs exports wrapMutation + buildMutationEvent; 7 prefix branches reproduce upstream; spy-based snapshot test PASSES (W2 fix — no upstream invocation, no FS side effects). MVP wrap-pass is a verified no-op (W3 fix).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (Wave 2): Implement bin/gsd-sdk-shadow.mjs (single file per D-02) with all 13 BEADS_OVERRIDES + argv routing test</name>
  <files>
    bin/gsd-sdk-shadow.mjs,
    tests/shadow-tests/argv-routing.test.mjs
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/013-architecture-y1-shadow-poc/gsd-sdk-shadow-v2.mjs (entire file — POC has phase.add fully + 12 stubs)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (bin/gsd-sdk-shadow.mjs section lines 447-573 — imports, handler skeleton, argv routing pattern, dispatch pattern, Phase 2 deltas with the 12 handler implementations)
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Pitfall 4 — --project-dir argv position; Pitfall 5 — bd subprocess timing)
    - bin/wrap-mutation.mjs (just-built helper to import)
    - .claude/skills/spike-findings-gsd-beads/references/beads-modeling.md (parent-child link semantics, label conventions)
    - .planning/phases/02-build-the-layer/02-CONTEXT.md (D-02 — single-file mandate; D-09 — wrapMutation wiring)
  </read_first>
  <behavior>
    - Test 1 (DOTTED): `query phase.add "Phase 1"` on beads project → handler creates bead with `gsd:phase` label + returns `{data:{phase_id, title:'Phase 1', status:'added', backend:'beads'}}`.
    - Test 2 (SPACE-ALIASED): `query phase add "Phase 1"` → same outcome (resolveQueryArgv handles the form).
    - Test 3 (READ-ONLY PASSTHROUGH): `query progress` (NOT in BEADS_OVERRIDES) → SDK dispatches through unmodified upstream handler.
    - Test 4 (--PICK): `query phase.add "X" --pick phase_id` → returns just the ID via extractField.
    - Test 5 (NON-QUERY): `--help` → spawnUpstream(argv) is called, exit code matches upstream.
    - Test 6 (NON-BEADS): cwd has no `.beads/metadata.json` → spawnUpstream(argv).
    - Test 7 (UNKNOWN): `query made-up-command` → resolveQueryArgv null → spawnUpstream(argv).
    - Test 8 (--project-dir AFTER): `query phase.add "X" --project-dir /tmp/test` → handler called with projectDir=/tmp/test.
    - Test 9 (REQ-02 PASSTHROUGH): when shadow falls through, argv passed to upstream is identical to input argv (no mutation/injection).
  </behavior>
  <action>
    **Step A: Implement `bin/gsd-sdk-shadow.mjs` as a SINGLE file (D-02 — B3 fix).** Build on POC + PATTERNS.md Phase 2 deltas. **Node ESM** (`.mjs` extension; first line `#!/usr/bin/env node`). All 13 handlers in this one file — they share argv routing, spawnUpstream, dynamic-import, and BEADS_OVERRIDES scaffolding.

    Structure:
    ```javascript
    #!/usr/bin/env node
    // Y1 (shadow gsd-sdk) — registry-override variant.
    // GSD core unmodified per REQ-02; uses dynamic import of upstream's dist/.
    // D-02 invariant: all 13 BEADS_OVERRIDES handlers live in this single file.
    // D-09 / W3 invariant: production eventStream=null → wrapMutation is a no-op (MVP).

    import { spawnSync, execSync } from 'node:child_process';
    import { existsSync } from 'node:fs';
    import { resolve } from 'node:path';
    import { wrapMutation } from './wrap-mutation.mjs';

    const DEBUG = process.env.GSD_BEADS_DEBUG === '1';
    const log = (...a) => { if (DEBUG) console.error('[gsd-sdk-shadow]', ...a); };

    const SDK_BASE = process.env.GSD_SDK_PATH
      ?? `${process.env.HOME}/.volta/tools/image/packages/get-shit-done-cc/lib/node_modules/get-shit-done-cc`;
    const UPSTREAM_BIN = `${SDK_BASE}/bin/gsd-sdk.js`;
    const QUERY_INDEX_PATH = `${SDK_BASE}/sdk/dist/query/index.js`;
    const REGISTRY_PATH = `${SDK_BASE}/sdk/dist/query/registry.js`;
    ```

    **Implement all 13 handlers** following the `beadsPhaseAdd` skeleton from POC (PATTERNS.md lines 469-481). Each:
    - Parses args
    - Calls 2-4 `bd` commands via `execSync(..., { cwd: projectDir, encoding: 'utf-8' }).trim()`
    - Returns `{ data: {...} }` (QueryResult shape — REQ-02 fidelity)
    - Documents per-handler timing budget in a comment (Pitfall 5)

    Concrete handler implementations:

    - **phase.add (already in POC, copy verbatim)**: `bd q "<title>" -t epic -p 1` + `bd label add <id> gsd:phase` → returns `{phase_id, title, status:'added', backend:'beads'}`. Budget: ~150ms.
    - **phase.add-batch**: parses `args[0]` as JSON array of phases. For each, runs phase.add atomic block. Returns `{ phase_ids: [...], count, backend:'beads' }`. Budget: ~150ms × N (Pitfall 5 — flagged).
    - **phase.insert**: `bd q "<title>" -t epic -p <decimal-priority>` + `bd label add <id> gsd:phase inserted`. Returns `{phase_id, title, priority, status:'inserted', backend:'beads'}`.
    - **phase.complete**: `bd close <phase-id>` (cascade-loop closes parents via PostToolUse). Returns `{phase_id, status:'closed', backend:'beads'}`.
    - **phase.remove**: `bd close <phase-id> --reason removed`. Returns `{phase_id, status:'removed', backend:'beads'}`.
    - **phase.scaffold**: `bd q "<title>" -t epic -p 1` + label gsd:phase + iteratively `bd q "<task>" -t task -p N` + `bd link <task> <phase> --type parent-child` for each scaffold task. Returns `{phase_id, task_ids, backend:'beads'}`.
    - **phases.clear**: enumerates all `gsd:phase` beads via `bd list --type=epic -l gsd:phase --json`, closes each with `--reason cleared`. Returns `{cleared_count, backend:'beads'}`.
    - **phases.archive**: same enumeration, but `bd label add <id> archived` for each. Returns `{archived_count, backend:'beads'}`.
    - **roadmap.update-plan-progress**: takes `<plan-id> <status>`. Maps to `bd update <plan-id> --status <status>`. Returns `{plan_id, status, backend:'beads'}`.
    - **roadmap.annotate-dependencies**: takes `<phase-id> <dep-phase-id-list>`. For each dep: `bd link <phase-id> <dep-id> --type blocks`. Returns `{phase_id, deps_added: N, backend:'beads'}`.
    - **requirements.mark-complete**: takes `<req-id>`. `bd close <req-id>`. Returns `{req_id, status:'completed', backend:'beads'}`.
    - **todo.complete**: takes `<todo-id>`. `bd close <todo-id>`. Returns `{todo_id, status:'completed', backend:'beads'}`.
    - **milestone.complete**: takes `<milestone-id>`. `bd label remove <milestone-id> active` + `bd label add <milestone-id> completed`. Returns `{milestone_id, status:'completed', backend:'beads'}`.

    **BEADS_OVERRIDES table** must export EXACTLY 13 entries from this file (D-02):
    ```javascript
    export const BEADS_OVERRIDES = {
      'phase.add': beadsPhaseAdd,
      'phase.add-batch': beadsPhaseAddBatch,
      'phase.insert': beadsPhaseInsert,
      'phase.complete': beadsPhaseComplete,
      'phase.remove': beadsPhaseRemove,
      'phase.scaffold': beadsPhaseScaffold,
      'phases.clear': beadsPhasesClear,
      'phases.archive': beadsPhasesArchive,
      'roadmap.update-plan-progress': beadsRoadmapUpdatePlanProgress,
      'roadmap.annotate-dependencies': beadsRoadmapAnnotateDependencies,
      'requirements.mark-complete': beadsRequirementsMarkComplete,
      'todo.complete': beadsTodoComplete,
      'milestone.complete': beadsMilestoneComplete,
    };
    ```

    **Argv routing** (per Pitfall 4):
    ```javascript
    const argv = process.argv.slice(2);

    function isBeadsManaged(projectDir) {
      return existsSync(resolve(projectDir, '.beads/metadata.json'));
    }

    function getProjectDir(argv) {
      // Pitfall 4: --project-dir position-agnostic find but value still after queryIdx in upstream contract.
      const idx = argv.indexOf('--project-dir');
      if (idx !== -1 && argv[idx + 1]) {
        const v = resolve(argv[idx + 1]);
        // T-02-04 mitigation: validate it's a real directory before spawnUpstream uses it.
        if (existsSync(v)) return v;
      }
      return process.cwd();
    }

    function spawnUpstream(argv) {
      log('passthrough →', UPSTREAM_BIN, argv.join(' '));
      const result = spawnSync(UPSTREAM_BIN, argv, { stdio: 'inherit', env: process.env });
      process.exit(result.status ?? 1);
    }

    const queryIdx = argv.indexOf('query');
    if (queryIdx === -1) spawnUpstream(argv);

    const projectDir = getProjectDir(argv);
    if (!isBeadsManaged(projectDir)) {
      log(`${projectDir} is not beads-managed; passing to upstream.`);
      spawnUpstream(argv);
    }

    // Beads-managed + query — use SDK primitives.
    const queryModule = await import(QUERY_INDEX_PATH);
    const registryModule = await import(REGISTRY_PATH);

    // sessionId: best-effort from env or random
    const sessionId = process.env.GSD_SESSION_ID ?? `shadow-${process.pid}-${Date.now()}`;
    // MVP: eventStream=null → wrapMutation is a no-op (W3 invariant; D-09 forward-compat preserved).
    const eventStream = null;

    const registry = queryModule.createRegistry(eventStream, sessionId);

    // Override and re-wrap each handler (D-09).
    for (const [cmd, handler] of Object.entries(BEADS_OVERRIDES)) {
      registry.register(cmd, wrapMutation(handler, cmd, eventStream, sessionId));
    }

    // Strip --pick before resolveQueryArgv
    const queryArgv = argv.slice(queryIdx + 1).filter((a, i, arr) => {
      // Strip --project-dir <value> from queryArgv (it was handled outside)
      if (a === '--project-dir') return false;
      if (i > 0 && arr[i - 1] === '--project-dir') return false;
      return true;
    });

    const pickIdx = queryArgv.indexOf('--pick');
    let pickField;
    if (pickIdx !== -1) {
      pickField = queryArgv[pickIdx + 1];
      queryArgv.splice(pickIdx, 2);
    }

    const matched = registryModule.resolveQueryArgv(queryArgv, registry);
    if (!matched) {
      log(`unknown command "${queryArgv.join(' ')}"; passing to upstream.`);
      spawnUpstream(argv);
    }

    try {
      const result = await registry.dispatch(matched.cmd, matched.args, projectDir);
      console.log(pickField !== undefined
        ? registryModule.extractField(result.data, pickField)
        : JSON.stringify(result));
      process.exit(0);
    } catch (err) {
      console.error(`[gsd-sdk-shadow] dispatch failed: ${err.message}`);
      process.exit(1);
    }
    ```

    `chmod +x bin/gsd-sdk-shadow.mjs`.

    **Step B: Fill in `tests/shadow-tests/argv-routing.test.mjs`.** Use `node:test` with ephemeral fixture:
    ```javascript
    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { execSync, spawnSync } from 'node:child_process';
    import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';

    function beadsFixture() {
      const dir = mkdtempSync(join(tmpdir(), 'gsd-beads-test-'));
      execSync('bd init --non-interactive --skip-agents', { cwd: dir });
      return dir;
    }
    function nonBeadsFixture() {
      return mkdtempSync(join(tmpdir(), 'gsd-nonbeads-test-'));
    }
    ```
    Implement all 9 CASEs from Task 1's argv-routing stub.

    **Threat mitigation (T-02-04):** `getProjectDir` validates the path with `existsSync` BEFORE returning it. spawnUpstream receives the original argv (no injection point). `resolveQueryArgv` is the SDK primitive — never naive split.

    **Threat mitigation (T-02-05):** explicit allow-list `BEADS_OVERRIDES`; everything else passes through unchanged. Test 7 (unknown command → spawnUpstream) verifies.
  </action>
  <acceptance_criteria>
    - `bin/gsd-sdk-shadow.mjs` exists and is executable.
    - First line `#!/usr/bin/env node`.
    - `node --check bin/gsd-sdk-shadow.mjs` exits 0.
    - **D-02 single-file invariant (B3 fix):** `grep -c '^export const BEADS_OVERRIDES' bin/gsd-sdk-shadow.mjs` returns 1 (exactly one BEADS_OVERRIDES declaration in this single file).
    - **D-02 single-file invariant (B3 fix):** `wc -l bin/gsd-sdk-shadow.mjs` returns less than 800 (single file holds all 13 handlers + scaffolding without splitting).
    - `grep -c "import { wrapMutation }" bin/gsd-sdk-shadow.mjs` returns at least 1.
    - `grep -c "await import" bin/gsd-sdk-shadow.mjs` returns at least 2 (queryModule + registryModule).
    - `grep -c "spawnSync(UPSTREAM_BIN" bin/gsd-sdk-shadow.mjs` returns at least 1 (passthrough).
    - `grep -c "existsSync.*\\.beads/metadata\\.json" bin/gsd-sdk-shadow.mjs` returns at least 1 (beads detection).
    - `grep -c "BEADS_OVERRIDES" bin/gsd-sdk-shadow.mjs` returns at least 2.
    - **W3 fix invariant:** `grep -c 'eventStream = null' bin/gsd-sdk-shadow.mjs` returns at least 1 (production wires null → wrap-pass is a no-op in MVP).
    - Number of BEADS_OVERRIDES entries verified by parsing: `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m=>process.exit(Object.keys(m.BEADS_OVERRIDES).length===13?0:1)).catch(e=>{console.error(e);process.exit(2)})"` exits 0.
    - `grep -c 'resolveQueryArgv' bin/gsd-sdk-shadow.mjs` returns at least 1 (T-02-04 — using SDK primitive).
    - `grep -c "execSync.*'bd " bin/gsd-sdk-shadow.mjs` returns at least 6 (multiple handlers call bd CLI).
    - `node --test tests/shadow-tests/argv-routing.test.mjs` exits 0; ≥9 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>node --test tests/shadow-tests/argv-routing.test.mjs</automated>
  </verify>
  <done>Shadow binary implements all 13 BEADS_OVERRIDES in a single file (D-02 / B3 fix), argv routing handles all forms incl. --project-dir + --pick, falls through correctly. argv-routing tests PASS. MVP wrap-pass no-op verified via eventStream=null invariant (W3 fix).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 (Wave 2): Complete 13 per-handler test suites</name>
  <files>
    tests/shadow-tests/handler-phase-add.test.mjs,
    tests/shadow-tests/handler-phase-add-batch.test.mjs,
    tests/shadow-tests/handler-phase-insert.test.mjs,
    tests/shadow-tests/handler-phase-complete.test.mjs,
    tests/shadow-tests/handler-phase-remove.test.mjs,
    tests/shadow-tests/handler-phase-scaffold.test.mjs,
    tests/shadow-tests/handler-phases-clear.test.mjs,
    tests/shadow-tests/handler-phases-archive.test.mjs,
    tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs,
    tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs,
    tests/shadow-tests/handler-requirements-mark-complete.test.mjs,
    tests/shadow-tests/handler-todo-complete.test.mjs,
    tests/shadow-tests/handler-milestone-complete.test.mjs
  </files>
  <read_first>
    - bin/gsd-sdk-shadow.mjs (just-built — read each handler's contract)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (test files NEW — tests/shadow-tests section)
    - tests/shadow-tests/argv-routing.test.mjs (just-built — reuse beadsFixture helper)
  </read_first>
  <behavior>
    Each handler test: 3 cases minimum.
    - CASE 1: HAPPY PATH — invoke shadow with valid args, assert correct beads created/labeled, returned shape includes `backend: 'beads'`.
    - CASE 2: LABEL ASSERTION — query bd via `bd show <id> --json` and assert correct `gsd:*` label applied.
    - CASE 3: ERROR PATH — malformed args (missing required, wrong type) → handler throws or returns error result; shadow exits 1.
  </behavior>
  <action>
    **Implementation pattern (use for all 13 — each ~80 lines).** Use `node:test` + ephemeral fixture pattern.

    Template:
    ```javascript
    import { test } from 'node:test';
    import assert from 'node:assert/strict';
    import { execSync, spawnSync } from 'node:child_process';
    import { mkdtempSync, rmSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';

    const SHADOW = join(import.meta.dirname, '../../bin/gsd-sdk-shadow.mjs');

    function setupFixture() {
      const dir = mkdtempSync(join(tmpdir(), 'gsd-handler-test-'));
      execSync('bd init --non-interactive --skip-agents', { cwd: dir });
      return dir;
    }

    test('phase.add creates a bead with gsd:phase label', () => {
      const dir = setupFixture();
      try {
        const result = spawnSync('node', [SHADOW, 'query', 'phase.add', 'Test phase', '--project-dir', dir], { encoding: 'utf-8' });
        assert.equal(result.status, 0, `shadow failed: ${result.stderr}`);
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.data.backend, 'beads');
        assert.match(parsed.data.phase_id, /^[a-z]+-\d+$/);
        const labels = JSON.parse(execSync(`bd show ${parsed.data.phase_id} --json`, { cwd: dir, encoding: 'utf-8' }));
        assert.ok(labels[0].labels.includes('gsd:phase'));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('phase.add returns canonical {data} shape', () => { /* CASE 2 */ });
    test('phase.add errors on empty title (defaults to "Untitled phase")', () => { /* CASE 3 */ });
    ```

    **Per-handler specifics** (the assertion key for each):

    | Handler | Label assertion (CASE 2) | Error case (CASE 3) |
    |---------|--------------------------|---------------------|
    | phase.add | `gsd:phase` label applied | empty args → defaults to 'Untitled phase' |
    | phase.add-batch | N beads created, all labeled `gsd:phase` | non-array JSON → throws |
    | phase.insert | `gsd:phase` + `inserted` labels | invalid priority → throws |
    | phase.complete | bead status closed | unknown phase-id → bd error → handler exits 1 |
    | phase.remove | bead status closed + reason 'removed' | unknown id → exit 1 |
    | phase.scaffold | parent labeled `gsd:phase`, children linked parent-child | empty task list still creates phase only |
    | phases.clear | all `gsd:phase` beads now status closed | no phases → returns count 0 |
    | phases.archive | all `gsd:phase` beads have `archived` label | same |
    | roadmap.update-plan-progress | bead status updated | invalid status → exit 1 |
    | roadmap.annotate-dependencies | `blocks` deps added (bd link --type blocks) | unknown phase-id → exit 1 |
    | requirements.mark-complete | bead status closed, was labeled `gsd:requirement` | unknown id → exit 1 |
    | todo.complete | bead status closed, type=task | unknown id → exit 1 |
    | milestone.complete | `completed` label applied, `active` removed | unknown id → exit 1 |

    **Each test file independent** — no shared state. Each setupFixture creates a fresh tmp dir.

    Make sure each `test('handler-X errors on bad input')` asserts non-zero exit code (per CASE 3 expected behavior).
  </action>
  <acceptance_criteria>
    - All 13 handler-*.test.mjs files exist.
    - For each, `node --check tests/shadow-tests/handler-<name>.test.mjs` exits 0.
    - For each, `node --test tests/shadow-tests/handler-<name>.test.mjs` exits 0 with at least 3 tests passing.
    - `node --test tests/shadow-tests/handler-*.test.mjs` (wildcard) exits 0 with `tests` count ≥ 39 (13 × 3).
    - Cross-plan invariant check: `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m=>{const ovs=Object.keys(m.BEADS_OVERRIDES); const fs=require('fs'); const tests=fs.readdirSync('tests/shadow-tests').filter(f=>f.startsWith('handler-')); for(const cmd of ovs){const slug=cmd.replace(/\\./g,'-'); const want='handler-'+slug+'.test.mjs'; if(!tests.includes(want)){console.error('missing test for '+cmd);process.exit(1);}} process.exit(0);})"` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>node --test tests/shadow-tests/handler-*.test.mjs</automated>
  </verify>
  <done>All 13 handlers tested with happy-path + label-assertion + error-case. Cross-plan invariant (every BEADS_OVERRIDES entry has matching test file) PASSES.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| process.argv → shadow argv routing | Untrusted argv from Bash invocation |
| `--project-dir` value → spawnUpstream / dispatch | Attacker-controlled path; could attempt traversal |
| handler args → bd CLI execSync | Attacker-controlled argv to subprocess |
| spawnUpstream(argv) → upstream binary | Forwards untrusted argv to upstream (which is trusted) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-04 | Tampering / Spoofing | bin/gsd-sdk-shadow.mjs argv routing | mitigate | Use SDK's `resolveQueryArgv` (not naive split). `getProjectDir` validates the path with `existsSync` before returning. argv-routing test cases 8+9 cover --project-dir position variants. |
| T-02-05 | Elevation of Privilege | bin/gsd-sdk-shadow.mjs override fall-through | mitigate | Explicit allow-list: BEADS_OVERRIDES has exactly 13 named entries. resolveQueryArgv returns null for unknown → spawnUpstream. argv-routing test 7 verifies. Acceptance criterion checks `Object.keys(BEADS_OVERRIDES).length === 13`. |
| (passthrough) | — | spawnUpstream argv | accept | argv is forwarded unchanged to upstream binary. Upstream is trusted (REQ-02 — we never modify it; passthrough preserves semantics). |
</threat_model>

<verification>
- `node --test tests/shadow-tests/wrap-mutation.test.mjs` PASSES.
- `node --test tests/shadow-tests/argv-routing.test.mjs` PASSES (≥9 tests).
- `node --test tests/shadow-tests/handler-*.test.mjs` PASSES (≥39 tests).
- `node -e "import('./bin/gsd-sdk-shadow.mjs').then(m=>process.exit(Object.keys(m.BEADS_OVERRIDES).length===13?0:1))"` exits 0.
- `bash tests/run-quick.sh argv-routing && bash tests/run-quick.sh wrap-mutation && bash tests/run-quick.sh handler-phase-add` exit 0 (verifies meta runner routing from Plan 02-02).
- `grep -rn '~/.claude/get-shit-done' bin/` returns no matches (REQ-02 — we use upstream via dynamic import, never write to its source tree).
- D-02 invariant: `grep -c '^export const BEADS_OVERRIDES' bin/gsd-sdk-shadow.mjs` returns 1 AND `wc -l bin/gsd-sdk-shadow.mjs` returns less than 800 (B3 fix).
- W3 invariant: `grep -c 'eventStream = null' bin/gsd-sdk-shadow.mjs` returns at least 1 (production wraps as no-op).
</verification>

<success_criteria>
- bin/gsd-sdk-shadow.mjs is a Node ESM single file (D-02) with 13 BEADS_OVERRIDES handlers, dynamic import of upstream's createRegistry/resolveQueryArgv/extractField, argv routing per Pitfall 4, GSD_BEADS_DEBUG gate.
- bin/wrap-mutation.mjs reproduces upstream's buildMutationEvent (7 prefix branches) and exports wrapMutation; spy-based snapshot test passes (W2 fix).
- 14 shadow tests committed and PASSING (13 handler + argv-routing + wrap-mutation).
- REQ-01: state-bearing mutations route to bd, beads is the SoT.
- REQ-02: GSD core unmodified — only dynamic imports of upstream's dist/.
- REQ-04: 13 mutations covered; passthrough for everything else.
- D-02 honored: single-file shadow, no per-handler split (B3 fix).
- D-09 honored: handlers wrapped post-register with GSDEvent emission (forward-compat preserved despite MVP no-op).
- D-10 honored: buildMutationEvent reproduced (Pitfall 2 mitigation).
- W3 invariant: production wires `eventStream=null` so wrap-pass is a verified no-op in MVP.
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-03-SUMMARY.md` documenting:
- The shadow binary contract (13 overrides, argv routing rules, env vars) — single file per D-02
- wrap-mutation.mjs contract (7 prefix branches, fire-and-forget semantics, MVP no-op via null eventStream)
- Per-handler timing budgets (Pitfall 5 — flag any handler exceeding 500ms)
- The cross-plan invariant: every BEADS_OVERRIDES entry has a matching test file
- Threat mitigations T-02-04, T-02-05
- B3, W2, W3 invariants verified by grep gates and spy-based snapshot test
</output>
