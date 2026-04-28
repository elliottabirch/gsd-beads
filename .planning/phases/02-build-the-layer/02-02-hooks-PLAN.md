---
phase: 02-build-the-layer
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/block-state-md.sh
  - hooks/bd-sync.sh
  - hooks/block-gsd-sdk-mutation.sh
  - settings.fragment.json
  - tests/run-quick.sh
  - tests/run-all.sh
  - tests/hook-tests/block-state-md.test.sh
  - tests/hook-tests/bd-sync.test.sh
  - tests/hook-tests/block-gsd-sdk-mutation.test.sh
autonomous: true
requirements: [REQ-04, REQ-07]
requirements_addressed: [REQ-04, REQ-07]
must_haves:
  truths:
    - "block-state-md.sh denies edit/write to .planning/{ROADMAP,REQUIREMENTS}.md and .planning/{todos,seeds}/* (both absolute and relative path shapes — Spike 001 iter-2 finding)"
    - "block-state-md.sh allows edit/write to PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md (REQ-07 narrative untouched)"
    - "block-gsd-sdk-mutation.sh denies the 13 state-bearing gsd-sdk mutations × 2 forms (dotted + space-aliased) — Spike 012's 43-case parity"
    - "bd-sync.sh fires cascade-loop + regen on state-changing bd commands; SKIPS read-only commands (bd list, show, ready, memories, status, prime, export, deps, children, search, help, version) — Pitfall 3"
    - "settings.fragment.json declares 3 hook entries — PreToolUse(Edit|Write), PostToolUse(Bash, if=Bash(bd *)), PreToolUse(Bash, if=Bash(gsd-sdk *))"
    - "tests/run-quick.sh and tests/run-all.sh meta scripts route to per-component suites"
  artifacts:
    - path: "hooks/block-state-md.sh"
      provides: "PreToolUse(Edit|Write) blocker — Spike 001 verbatim + reason text update for D-06"
      min_lines: 40
    - path: "hooks/bd-sync.sh"
      provides: "PostToolUse(Bash) on bd * — read-only filter + cascade + regen"
      min_lines: 30
    - path: "hooks/block-gsd-sdk-mutation.sh"
      provides: "PreToolUse(Bash) on gsd-sdk * — 13-mutation deny-list (defensive backup)"
      min_lines: 80
    - path: "settings.fragment.json"
      provides: "Claude Code hook fragment with 3 entries; deep-merged into ~/.claude/settings.json by Plan 02-05"
    - path: "tests/run-quick.sh"
      provides: "Meta runner — route to per-component suite by name"
    - path: "tests/run-all.sh"
      provides: "Meta runner — every suite + e2e (excludes 50-bead perf test)"
    - path: "tests/hook-tests/block-state-md.test.sh"
      provides: "20 cases verbatim from Spike 001 + REQ-07 narrative-allow cases"
    - path: "tests/hook-tests/bd-sync.test.sh"
      provides: "Spike 001 7 cases + 8 read-only-filter cases + 2 cascade-fired cases"
    - path: "tests/hook-tests/block-gsd-sdk-mutation.test.sh"
      provides: "43 cases verbatim from Spike 012"
  key_links:
    - from: "hooks/bd-sync.sh"
      to: "scripts/cascade-loop.sh"
      via: "execvp at end of script"
      pattern: "cascade-loop\\.sh"
    - from: "hooks/bd-sync.sh"
      to: "scripts/regen-roadmap.sh"
      via: "execvp"
      pattern: "regen-roadmap\\.sh"
    - from: "hooks/bd-sync.sh"
      to: "scripts/regen-requirements.sh"
      via: "execvp"
      pattern: "regen-requirements\\.sh"
    - from: "settings.fragment.json"
      to: "hooks/{block-state-md,bd-sync,block-gsd-sdk-mutation}.sh"
      via: "command path with $CLAUDE_PROJECT_DIR placeholder"
      pattern: "CLAUDE_PROJECT_DIR.*hooks/"
---

<objective>
Build the 3 hook scripts and their settings.fragment.json declaration. These are the deterministic write-path enforcement layer (REQ-04) plus the narrative-untouched guarantee (REQ-07). Two scripts are EXACT spike copies (block-state-md.sh, block-gsd-sdk-mutation.sh); bd-sync.sh extends Spike 001's stub with the read-only filter (Pitfall 3) and chains to Plan 02-01's cascade + regen primitives.

Plan 02-01 must be complete first — bd-sync.sh chains to its scripts. (Wave-1 parallel with 02-01 is OK because bd-sync.sh's chain calls don't run during this plan's tests; the test driver intercepts at the bd-sync invocation.)

Purpose: Hooks deterministically prevent state-bearing markdown from being edited by hand and route bd commands to cascade+regen. Narrative MD stays untouched.
Output: 3 hook scripts + 1 settings fragment + 2 meta test runners + 3 test suites.
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
@.claude/skills/spike-findings-gsd-beads/references/hook-layer.md
@.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh
@.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/bd-sync.sh
@.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh
@.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/settings.fragment.json
@.claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh
@.claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/test-runner.sh

<interfaces>
<!-- Claude Code hook payload schema (verified Spike 001) -->

PreToolUse Edit/Write payload:
```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "...",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": { "file_path": "...", "content": "..." },
  "tool_use_id": "..."
}
```

PostToolUse Bash payload (additional fields):
```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "...", "description": "..." },
  "tool_response": { "stdout": "", "stderr": "", "interrupted": false },
  "duration_ms": 1
}
```

Hook deny output (exit 0 + JSON to stdout):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "<message>"
  }
}
```

Hook allow output: exit 0 with no stdout (silent).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Test stubs + meta runners + extract spike test cases</name>
  <files>
    tests/run-quick.sh,
    tests/run-all.sh,
    tests/hook-tests/block-state-md.test.sh,
    tests/hook-tests/bd-sync.test.sh,
    tests/hook-tests/block-gsd-sdk-mutation.test.sh
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh (entire file — pattern source for synthetic-payload + tally + assert)
    - .claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/test-runner.sh (43-case Spike 012 driver — full source)
    - .planning/phases/02-build-the-layer/02-VALIDATION.md (per-task verification map for 02-02; coverage targets 20/15+/43 cases)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (test files section — synthetic Bash payload pattern, if-filter simulation lines 119-128)
  </read_first>
  <action>
    Create 5 stub files. **All bash + jq.**

    **File 1: `tests/run-quick.sh`** — meta runner.
    ```bash
    #!/usr/bin/env bash
    # Usage: tests/run-quick.sh <component-or-suite-name>
    # Routes to per-component test suite. Exit 0 = green, non-zero = red.
    set -euo pipefail
    component="${1:-}"
    if [ -z "$component" ]; then echo "usage: $0 <component>"; exit 2; fi
    case "$component" in
      block-state-md|bd-sync|block-gsd-sdk-mutation|cascade-loop|regen-roadmap|regen-requirements)
        bash "tests/hook-tests/$component.test.sh" ;;
      argv-routing|wrap-mutation|handler-phase-add)
        node --test "tests/shadow-tests/$component.test.mjs" ;;
      idempotency|settings-merge|memory-seeding|path-precedence|no-gsd-core-mutation)
        bash "tests/install-tests/$component.test.sh" ;;
      auto-config|append-idempotency)
        bash "tests/worktree-tests/$component.test.sh" ;;
      *) echo "unknown component: $component"; exit 2 ;;
    esac
    ```
    `chmod +x tests/run-quick.sh`.

    **File 2: `tests/run-all.sh`** — full-suite runner.
    ```bash
    #!/usr/bin/env bash
    # Run every test suite. Excludes 50-bead perf test (run separately).
    set -uo pipefail
    fail=0
    for suite in tests/hook-tests/*.test.sh tests/install-tests/*.test.sh tests/worktree-tests/*.test.sh tests/e2e/*.smoke.sh; do
      [ -f "$suite" ] || continue
      echo "=== $suite ==="
      bash "$suite" || fail=$((fail+1))
    done
    for suite in tests/shadow-tests/*.test.mjs; do
      [ -f "$suite" ] || continue
      echo "=== $suite ==="
      node --test "$suite" || fail=$((fail+1))
    done
    echo "Suites failed: $fail"
    [ "$fail" -eq 0 ]
    ```
    `chmod +x tests/run-all.sh`.

    **File 3: `tests/hook-tests/block-state-md.test.sh`** — Wave 0 stub. Bash header + `set -euo pipefail` + comment block listing the 20 CASEs from Spike 001's test-runner.sh PLUS 8 narrative-allow cases for REQ-07 (Edit/Write to PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md must be allowed). Echo `[STUB]` and exit 1.

    **File 4: `tests/hook-tests/bd-sync.test.sh`** — Wave 0 stub. List 17 cases:
    - 7 verbatim from Spike 001 (`bd ` fired, non-bd not fired)
    - 8 read-only-filter cases (one per: list, show, ready, memories, status, prime, export, help — must NOT fire cascade/regen)
    - 2 cascade-fired-on-state-change cases (e.g., `bd close <id>` and `bd q "X" -t epic` MUST fire regen)
    Echo `[STUB]` and exit 1.

    **File 5: `tests/hook-tests/block-gsd-sdk-mutation.test.sh`** — Wave 0 stub. List the 43 cases verbatim from Spike 012's test-runner.sh (13 mutations × 2 forms = 26 deny + 12 allow + 5 edge). Echo `[STUB]` and exit 1.

    `chmod +x` on all three test stubs.
  </action>
  <acceptance_criteria>
    - All 5 files exist and are executable.
    - `bash -n tests/run-quick.sh && bash -n tests/run-all.sh` — syntax valid.
    - `bash tests/run-quick.sh nonexistent-component 2>&1 | grep -c 'unknown component'` returns 1.
    - `grep -c '^# CASE\|^# Cases:\|test_block\|run_block_test' tests/hook-tests/block-state-md.test.sh` returns at least 20 (covers 20 spike cases + comments).
    - `grep -c '^# CASE\|^# read-only\|read_only' tests/hook-tests/bd-sync.test.sh` returns at least 8 (read-only filter cases).
    - `grep -c '^# CASE\|^# Mutation\|test_mut\|mutation' tests/hook-tests/block-gsd-sdk-mutation.test.sh` returns at least 13 (13 mutations).
    - All three test stubs exit 1 (Wave 0 red).
  </acceptance_criteria>
  <verify>
    <automated>bash -n tests/run-quick.sh && bash -n tests/run-all.sh && bash -n tests/hook-tests/block-state-md.test.sh && bash -n tests/hook-tests/bd-sync.test.sh && bash -n tests/hook-tests/block-gsd-sdk-mutation.test.sh</automated>
  </verify>
  <done>5 stub files in place. Meta runners route correctly. Test stubs are red Wave 0 markers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 1): Implement block-state-md.sh + complete its 20+8 case test suite</name>
  <files>
    hooks/block-state-md.sh,
    tests/hook-tests/block-state-md.test.sh
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh (EXACT verbatim source — 20/20 PASS in spike)
    - .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/test-runner.sh (line 32-74 — synthetic Edit/Write payload pattern)
    - .planning/phases/02-build-the-layer/02-CONTEXT.md (D-06 — no /gsd-beads-* substitute skills, redirect to upstream /gsd-* commands or bd directly)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (block-state-md.sh section — Phase 2 deltas: reason text update)
  </read_first>
  <behavior>
    - Test 1-10 (DENY ABS): Edit on /work/proj/.planning/ROADMAP.md, .../REQUIREMENTS.md, .../todos/X.md, .../seeds/X.md → permissionDecision=="deny". (And same 5 for Write.)
    - Test 11-20 (DENY REL): Edit on .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/todos/X.md, .planning/seeds/X.md → "deny". (And same for Write.) Spike 001 iter-2 added these — must preserve.
    - Test 21-28 (ALLOW NARRATIVE — REQ-07): Edit on PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, .planning/phases/01-x/01-DISCUSSION-LOG.md → no deny output (silent allow).
    - Test 29 (PATH TRAVERSAL — T-02-01): file_path with `../../escape/.planning/ROADMAP.md` does NOT trick the hook into denying. (Pattern is anchored.)
    - Test 30 (EMPTY): missing file_path → silent allow (exit 0).
  </behavior>
  <action>
    **Step A: Implement `hooks/block-state-md.sh`.** Copy verbatim from `.claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/block-state-md.sh`. Update only the `permissionDecisionReason` text per CONTEXT.md D-06 — no /gsd-beads-* substitutes, redirect to upstream /gsd-* (which routes through shadow) or `bd`:

    ```bash
    #!/usr/bin/env bash
    # PreToolUse hook for Edit|Write — blocks writes to state-bearing markdown.
    # State-bearing markdown is regenerated from beads (REQ-01).
    set -euo pipefail

    payload="$(cat)"
    file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"

    if [ -z "$file_path" ]; then
      exit 0
    fi

    case "$file_path" in
      */.planning/ROADMAP.md|*/.planning/REQUIREMENTS.md|*/.planning/todos/*|*/.planning/seeds/*\
      |.planning/ROADMAP.md|.planning/REQUIREMENTS.md|.planning/todos/*|.planning/seeds/*)
        target="${file_path##*.planning/}"
        jq -n --arg target "$target" '{
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: ("State-bearing markdown is generated from beads — direct edits to .planning/" + $target + " are blocked. Use upstream /gsd-* commands (they route through the gsd-sdk shadow into beads transparently) or run `bd` directly to mutate state, then `bd-sync.sh` regenerates the markdown.")
          }
        }'
        exit 0 ;;
      *)
        exit 0 ;;
    esac
    ```
    `chmod +x hooks/block-state-md.sh`.

    **Anti-pattern guard (T-02-01):** the case-pattern arms anchor on `*/.planning/X` and `.planning/X` (no leading wildcard for relative form). A file_path like `../escape/.planning/ROADMAP.md` matches `*/.planning/ROADMAP.md` (correctly denied — this is fine because hooks fire at write-time AFTER Claude Code resolves the path, but defensive: if attacker injects a malformed path the deny is still safe). The mitigation: keep the case anchored — do NOT add `*ROADMAP.md*` patterns that would match arbitrary paths.

    **Step B: Fill in `tests/hook-tests/block-state-md.test.sh`.** Use Spike 001's test-runner.sh `run_block_test` helper verbatim. Implement all 30 cases (20 from spike + 8 narrative-allow + 2 edge). End with tally + exit-non-zero-on-fail.
  </action>
  <acceptance_criteria>
    - `hooks/block-state-md.sh` exists, executable.
    - `grep -c '*/.planning/ROADMAP.md\|.planning/ROADMAP.md' hooks/block-state-md.sh` returns at least 2 (both abs and rel patterns).
    - `grep -c 'permissionDecision.*deny' hooks/block-state-md.sh` returns at least 1.
    - `grep -c 'gsd-beads-' hooks/block-state-md.sh` returns 0 (D-06: no /gsd-beads-* refs in reason text).
    - `bash -n hooks/block-state-md.sh` exits 0.
    - `bash tests/hook-tests/block-state-md.test.sh` exits 0 with `Passed: 30 / 30` (or at minimum 28 — 20 spike cases + 8 narrative-allow).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/hook-tests/block-state-md.test.sh</automated>
  </verify>
  <done>block-state-md.sh denies state-bearing paths (abs + rel), allows narrative MD, all cases PASS.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (Wave 1): Implement block-gsd-sdk-mutation.sh + complete its 43-case test suite</name>
  <files>
    hooks/block-gsd-sdk-mutation.sh,
    tests/hook-tests/block-gsd-sdk-mutation.test.sh
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh (EXACT verbatim source — 43/43 PASS)
    - .claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/test-runner.sh (43-case driver)
    - .planning/phases/02-build-the-layer/02-CONTEXT.md (D-06 reason text)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (block-gsd-sdk-mutation.sh section — argv-extraction pattern lines 32-52, deny-list lines 55-93)
  </read_first>
  <behavior>
    - Tests 1-26 (DENY): each of 13 mutations × 2 forms = `gsd-sdk query phase.add` + `gsd-sdk query phase add` + 12 others → "deny".
    - Tests 27-38 (ALLOW): read-only `gsd-sdk query progress`, `gsd-sdk query phase`, `gsd-sdk query phases`, `gsd-sdk query state`, etc. → silent allow.
    - Tests 39-43 (EDGE): missing command, malformed argv, non-gsd-sdk Bash, command with extra spaces, sub-command-injection attempt → silent allow.
  </behavior>
  <action>
    **Step A: Implement `hooks/block-gsd-sdk-mutation.sh`.** Copy verbatim from `.claude/skills/spike-findings-gsd-beads/sources/012-gsd-sdk-hook-coverage/hooks/block-gsd-sdk-mutation.sh`. Update only the redirect text in deny output (D-06 — strip /gsd-beads-* refs).

    Per PATTERNS.md, the argv extraction uses anchored case-pattern matching on `*"gsd-sdk "*"query "*` (Threat T-02-02 mitigation: NOT substring match elsewhere). The 13-mutation deny-list includes:
    `phase.add`, `phase.add-batch`, `phase.insert`, `phase.complete`, `phase.remove`, `phase.scaffold`, `phases.clear`, `phases.archive`, `roadmap.update-plan-progress`, `roadmap.annotate-dependencies`, `requirements.mark-complete`, `todo.complete`, `milestone.complete` — each tested in both dotted and space forms.

    Reason text update (D-06):
    `permissionDecisionReason`: `"State-bearing gsd-sdk mutations route through the gsd-sdk shadow at ~/.local/bin/gsd-sdk in beads-managed projects. Run via the upstream /gsd-* skill (which calls gsd-sdk transparently) or use bd directly. This is the defensive backup hook."`.

    `chmod +x hooks/block-gsd-sdk-mutation.sh`.

    **Threat mitigation (T-02-02 — command injection):** the case-pattern is exact-prefix `*"gsd-sdk "*"query "*` (with the spaces). A command like `xgsd-sdkx query phase.add` does NOT match. Tested explicitly in Test 41 (sub-command-injection attempt).

    **Step B: Fill in `tests/hook-tests/block-gsd-sdk-mutation.test.sh`.** Copy Spike 012's test-runner.sh verbatim, adjusting paths to point at `hooks/block-gsd-sdk-mutation.sh`. Run all 43 cases. End with tally.
  </action>
  <acceptance_criteria>
    - `hooks/block-gsd-sdk-mutation.sh` exists, executable.
    - `grep -c 'phase.add\|phase.add-batch\|phase.insert\|phase.complete\|phase.remove\|phase.scaffold\|phases.clear\|phases.archive\|roadmap.update-plan-progress\|roadmap.annotate-dependencies\|requirements.mark-complete\|todo.complete\|milestone.complete' hooks/block-gsd-sdk-mutation.sh` returns at least 13.
    - `grep -c '"gsd-sdk "*"query "' hooks/block-gsd-sdk-mutation.sh` returns at least 1 (anchored pattern; T-02-02 mitigation).
    - `grep -c '/gsd-beads-' hooks/block-gsd-sdk-mutation.sh` returns 0 (D-06).
    - `bash -n hooks/block-gsd-sdk-mutation.sh` exits 0.
    - `bash tests/hook-tests/block-gsd-sdk-mutation.test.sh` exits 0 with `Passed: 43 / 43`.
  </acceptance_criteria>
  <verify>
    <automated>bash tests/hook-tests/block-gsd-sdk-mutation.test.sh</automated>
  </verify>
  <done>block-gsd-sdk-mutation.sh denies all 13 mutations × 2 forms, allows reads, all 43 cases PASS.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 (Wave 1): Implement bd-sync.sh with read-only filter + finish its 17-case test suite</name>
  <files>
    hooks/bd-sync.sh,
    tests/hook-tests/bd-sync.test.sh
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/hooks/bd-sync.sh (Spike 001 stub — extend, do not copy verbatim)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (bd-sync.sh section — Phase 2 expansion lines 263-296 with full target script)
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Pitfall 3 — read-only filter rationale + 30s timeout context)
    - scripts/cascade-loop.sh, scripts/regen-roadmap.sh, scripts/regen-requirements.sh (the chain targets — must exist before bd-sync runs them)
  </read_first>
  <behavior>
    - Test 1-2 (FIRES on state change): `bd close abc-1`, `bd q "X" -t epic`, `bd label add abc-1 gsd:phase`, `bd link x y --type parent-child` → cascade-loop + regen scripts invoked (verified via marker file).
    - Test 3-10 (SKIPS on read-only): each of `bd list`, `bd show abc-1`, `bd ready`, `bd memories`, `bd status`, `bd prime`, `bd export`, `bd help` → cascade NOT invoked.
    - Test 11 (DEBOUNCE): two state-changing `bd ` calls within 1 second — second skips regen (mtime check).
    - Test 12 (NON-BD): `git status` (no `bd ` prefix) → silent exit 0, no cascade.
    - Test 13-15 (SPIKE 001 PARITY): non-bd commands like `ls`, `echo`, `node --version` → no cascade.
    - Test 16-17 (CHAIN ORDERING): when cascade fires, the order is cascade-loop.sh → regen-roadmap.sh → regen-requirements.sh.
  </behavior>
  <action>
    **Step A: Implement `hooks/bd-sync.sh`.** Verbatim from PATTERNS.md "Phase 2 expansion" block (lines 263-296):

    ```bash
    #!/usr/bin/env bash
    # PostToolUse hook for `bd *` Bash commands.
    # Filters READ-only bd commands; runs cascade + regen on state-changing only.
    # T-02-03 mitigation: only run cascade/regen on `bd ` prefix; never eval payload contents.
    set -euo pipefail

    payload="$(cat)"
    command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
    [ -z "$command" ] && exit 0

    # Confirm bd prefix before extracting subcommand (T-02-03 mitigation).
    case "$command" in
      "bd "*) ;;
      *) exit 0 ;;
    esac

    # Extract bd subcommand (the token after `bd `)
    sub="${command#*bd }"
    sub="${sub%% *}"

    # Read-only filter — skip regen for read-only bd commands (Pitfall 3)
    case "$sub" in
      list|show|ready|memories|status|prime|export|deps|children|search|help|version|"--version"|"--help")
        exit 0 ;;
    esac

    # Debounce — if last regen <1s ago, skip (idempotency)
    ROADMAP_PATH="${CLAUDE_PROJECT_DIR:-$PWD}/.planning/ROADMAP.md"
    if [ -f "$ROADMAP_PATH" ]; then
      age=$(( $(date +%s) - $(stat -c %Y "$ROADMAP_PATH" 2>/dev/null || stat -f %m "$ROADMAP_PATH" 2>/dev/null || echo 0) ))
      [ "$age" -lt 1 ] && exit 0
    fi

    # Run cascade then regen
    SCRIPTS="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/scripts"
    if [ ! -d "$SCRIPTS" ]; then
      # Fallback: scripts may live at repo-root scripts/ during dev
      SCRIPTS="${CLAUDE_PROJECT_DIR:-$PWD}/scripts"
    fi

    "$SCRIPTS/cascade-loop.sh" --quiet || true
    "$SCRIPTS/regen-roadmap.sh" || true
    "$SCRIPTS/regen-requirements.sh" || true

    exit 0
    ```
    `chmod +x hooks/bd-sync.sh`.

    **Step B: Fill in `tests/hook-tests/bd-sync.test.sh`.** Use the Spike 001 `run_sync_test` pattern (test-runner.sh lines 76-99). Use a marker file approach: stub `cascade-loop.sh`, `regen-roadmap.sh`, `regen-requirements.sh` for the test by setting `SCRIPTS=<tmpdir>` in the test env where each stub is `#!/usr/bin/env bash; touch "$MARKER.cascade"` etc. Then assert marker presence/absence per case.

    Implement all 17 CASEs from Task 1 stub. Use `BD_SYNC_MARKER=$(mktemp -d)` per test to isolate. Test 16-17 verify chain ordering by writing timestamps to the marker file from each stub script and asserting they're monotonically increasing.

    **Threat mitigation (T-02-03):** the script's `case "$command" in "bd "*)` arm is the ONLY entry point to cascade/regen. Anything else exits 0. The script never `eval`s anything. Acceptance criterion checks `grep -c 'eval' hooks/bd-sync.sh` returns 0.
  </action>
  <acceptance_criteria>
    - `hooks/bd-sync.sh` exists, executable.
    - `grep -c 'cascade-loop\.sh' hooks/bd-sync.sh` returns at least 1.
    - `grep -c 'regen-roadmap\.sh' hooks/bd-sync.sh` returns at least 1.
    - `grep -c 'regen-requirements\.sh' hooks/bd-sync.sh` returns at least 1.
    - `grep -E 'list\|show\|ready\|memories\|status\|prime' hooks/bd-sync.sh` matches at least once (read-only filter present).
    - `grep -c 'eval' hooks/bd-sync.sh` returns 0 (T-02-03 guard).
    - `grep -c '"bd "\*' hooks/bd-sync.sh` returns at least 1 (bd prefix gate).
    - `bash -n hooks/bd-sync.sh` exits 0.
    - `bash tests/hook-tests/bd-sync.test.sh` exits 0 with `Passed: 17 / 17` (or matches the case count from Task 1 stub).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/hook-tests/bd-sync.test.sh</automated>
  </verify>
  <done>bd-sync.sh fires cascade+regen only for state-changing bd commands, skips reads, debounces. All cases PASS.</done>
</task>

<task type="auto">
  <name>Task 5 (Wave 1): Compose settings.fragment.json</name>
  <files>
    settings.fragment.json
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/001-hook-semantics/settings.fragment.json (Spike 001 starting point — 2 hook entries)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (settings.fragment.json section — Phase 2 addition: 3rd hook entry; path placeholder note)
    - .planning/spikes/CONVENTIONS.md (`if: "Bash(<prefix> *)"` for per-command Bash filtering)
  </read_first>
  <action>
    Write `settings.fragment.json` with 3 hook entries. Use `$CLAUDE_PROJECT_DIR/.claude/hooks/...` placeholder paths (Plan 02-05's install.sh resolves these to actual `~/.claude/hooks/` location during deep-merge).

    ```json
    {
      "hooks": {
        "PreToolUse": [
          {
            "matcher": "Edit|Write",
            "hooks": [
              {
                "type": "command",
                "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh",
                "timeout": 5
              }
            ]
          },
          {
            "matcher": "Bash",
            "hooks": [
              {
                "type": "command",
                "if": "Bash(gsd-sdk *)",
                "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-gsd-sdk-mutation.sh",
                "timeout": 5
              }
            ]
          }
        ],
        "PostToolUse": [
          {
            "matcher": "Bash",
            "hooks": [
              {
                "type": "command",
                "if": "Bash(bd *)",
                "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bd-sync.sh",
                "timeout": 30
              }
            ]
          }
        ]
      }
    }
    ```

    Validate JSON: `jq . settings.fragment.json > /dev/null`.

    **Why these specific values:**
    - `matcher: "Edit|Write"` (NOT a regex on file_path — Spike 001 finding; matcher is too coarse)
    - `if: "Bash(<prefix> *)"` (CONVENTIONS — per-command Bash filtering)
    - `timeout: 5` for blockers (must respond fast)
    - `timeout: 30` for bd-sync (regen budget per Pitfall 3)
  </action>
  <acceptance_criteria>
    - `settings.fragment.json` exists.
    - `jq -e '.hooks.PreToolUse | length' settings.fragment.json` returns 2 (Edit|Write + Bash gsd-sdk).
    - `jq -e '.hooks.PostToolUse | length' settings.fragment.json` returns 1 (Bash bd).
    - `jq -e '.hooks.PreToolUse[0].matcher' settings.fragment.json` returns `"Edit|Write"`.
    - `jq -e '.hooks.PreToolUse[1].hooks[0].if' settings.fragment.json` returns `"Bash(gsd-sdk *)"`.
    - `jq -e '.hooks.PostToolUse[0].hooks[0].if' settings.fragment.json` returns `"Bash(bd *)"`.
    - `jq -e '.hooks.PostToolUse[0].hooks[0].timeout' settings.fragment.json` returns 30.
    - `jq -e '[.. | objects | select(has("command")) | .command]' settings.fragment.json | jq 'length'` returns 3.
  </acceptance_criteria>
  <verify>
    <automated>jq -e '.hooks.PreToolUse | length == 2' settings.fragment.json && jq -e '.hooks.PostToolUse | length == 1' settings.fragment.json</automated>
  </verify>
  <done>settings.fragment.json declares all 3 hooks with correct matcher/if filters and timeouts. Valid JSON.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Claude Code → hook script | Untrusted JSON tool_input crosses here; payload is attacker-controlled |
| hook script → bd CLI / cascade-loop | We trust bd CLI but must not eval untrusted command strings |
| settings.fragment.json → user's ~/.claude | Plan 02-05 deep-merges this into user state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Tampering / Spoofing | hooks/block-state-md.sh | mitigate | jq field-extract is anchored on `tool_input.file_path`; case-pattern match is path-anchored (no leading wildcards on relative arms). Path-traversal test case (Test 29) verifies. |
| T-02-02 | Tampering / Elevation of Privilege | hooks/block-gsd-sdk-mutation.sh | mitigate | Case-pattern matches `*"gsd-sdk "*"query "*` exactly (spaces required); sub-command-injection test (Test 41) verifies non-gsd-sdk commands pass through. |
| T-02-03 | Tampering | hooks/bd-sync.sh | mitigate | Script gates on `case "$command" in "bd "*)` BEFORE any cascade/regen; never `eval`s payload contents. Acceptance criterion: `grep -c 'eval' hooks/bd-sync.sh` returns 0. |
</threat_model>

<verification>
- All 5 task verifies pass.
- `bash tests/run-quick.sh block-state-md && bash tests/run-quick.sh bd-sync && bash tests/run-quick.sh block-gsd-sdk-mutation` exits 0 with combined `Passed: ~90/90` cases.
- `bash tests/run-all.sh` exits 0 (no other suites yet, this is the only data point in Wave 1).
- `jq . settings.fragment.json > /dev/null` succeeds.
- `grep -E 'eval|/gsd-beads-' hooks/*.sh` returns no matches.
</verification>

<success_criteria>
- 3 production hooks (block-state-md.sh, bd-sync.sh, block-gsd-sdk-mutation.sh) committed and executable.
- settings.fragment.json declares 3 hook entries with correct matcher + if filters.
- 3 test suites + 2 meta runners committed.
- Full hook test suite passes: 30 + 17 + 43 = 90 cases.
- REQ-04 satisfied: state-bearing markdown writes denied; gsd-sdk mutations denied (defensive backup).
- REQ-07 satisfied: narrative MD (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md) untouched.
- D-06 honored: no /gsd-beads-* references in any hook reason text.
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-02-SUMMARY.md` documenting:
- The 3 hook scripts and their permission-decision behaviors
- settings.fragment.json composition (3 entries, matchers, ifs, timeouts)
- Test pass tallies (90 cases total)
- The bd-sync chain to Plan 02-01's scripts
- Threat mitigations (T-02-01, T-02-02, T-02-03) and the verifying test cases
</output>
