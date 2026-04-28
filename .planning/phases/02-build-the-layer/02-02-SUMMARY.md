---
phase: 02-build-the-layer
plan: 02
subsystem: hook-layer
tags: [hooks, bash, jq, tdd, write-path-enforcement, narrative-protection]
dependency_graph:
  requires: [02-01-bd-helpers]
  provides: [block-state-md, bd-sync, block-gsd-sdk-mutation, settings.fragment.json, hook-test-suites]
  affects: [02-05-install-script]
tech_stack:
  added: []
  patterns: [synthetic-claude-payload-driver, exit0-json-deny, case-pattern-deny-list, marker-file-test-doubles]
key_files:
  created:
    - hooks/block-state-md.sh
    - hooks/bd-sync.sh
    - hooks/block-gsd-sdk-mutation.sh
    - settings.fragment.json
    - tests/run-quick.sh
    - tests/run-all.sh
    - tests/hook-tests/block-state-md.test.sh
    - tests/hook-tests/bd-sync.test.sh
    - tests/hook-tests/block-gsd-sdk-mutation.test.sh
  modified: []
decisions:
  - "bd-sync.sh honors SCRIPTS env var override for test stub injection — avoids needing full CLAUDE_PROJECT_DIR dir structure in tests"
  - "bd-sync.sh comment word changed from 'eval' to 'execute' to ensure grep -c 'eval' returns 0 per acceptance criterion"
metrics:
  duration_seconds: 382
  tasks_completed: 5
  files_created: 9
  completed_date: "2026-04-28"
requirements_addressed: [REQ-04, REQ-07]
---

# Phase 2 Plan 2: Hooks Summary

Three production hook scripts plus settings fragment — deterministic write-path enforcement (REQ-04) with narrative markdown left untouched (REQ-07), 90 test cases all passing.

## What Was Built

### hooks/block-state-md.sh
PreToolUse(Edit|Write) hook that denies writes to state-bearing markdown. Matches both absolute (`*/.planning/ROADMAP.md`) and relative (`.planning/ROADMAP.md`) path shapes — both forms verified (Spike 001 iter-2 regression prevention). Verbatim copy from Spike 001 with D-06 reason text update: redirects to upstream `/gsd-*` commands (routed through shadow) or `bd` directly, no `/gsd-beads-*` references.

Permission-denied targets:
- `.planning/ROADMAP.md` (abs + rel)
- `.planning/REQUIREMENTS.md` (abs + rel)
- `.planning/todos/**` (abs + rel)
- `.planning/seeds/**` (abs + rel)

Allowed (narrative — REQ-07): `PLAN.md`, `RESEARCH.md`, `AI-SPEC.md`, `UI-SPEC.md`, `DISCUSSION-LOG.md`, all source code, all other files.

### hooks/block-gsd-sdk-mutation.sh
PreToolUse(Bash) hook firing only under `if: "Bash(gsd-sdk *)"`. Parses argv to extract the command after `gsd-sdk ... query`, handles both dotted (`phase.add`) and space-aliased (`phase add`) forms. Denies 13 state-bearing mutations. Verbatim copy from Spike 012 with D-06 reason text update.

Deny-list (13 mutations):
- `phase.add/add-batch/insert/remove/complete/scaffold`
- `phases.clear/archive`
- `roadmap.update-plan-progress/annotate-dependencies`
- `requirements.mark-complete`
- `todo.complete`
- `milestone.complete`

### hooks/bd-sync.sh
PostToolUse(Bash) hook firing under `if: "Bash(bd *)"`. Extended from Spike 001 stub with:
- **Read-only filter** (Pitfall 3): skips cascade+regen for `bd list/show/ready/memories/status/prime/export/deps/children/search/help/version`
- **Debounce**: skips regen if ROADMAP.md modified <1s ago
- **Chain**: invokes `cascade-loop.sh --quiet` then `regen-roadmap.sh` then `regen-requirements.sh` (Plan 02-01 scripts)
- **SCRIPTS override**: honors `SCRIPTS` env var if set (enables test stub injection)
- **T-02-03 mitigation**: bd prefix gate before cascade; no eval

### settings.fragment.json
Three hook entries for deep-merge into `~/.claude/settings.json` by Plan 02-05:

| Hook | Event | Matcher | If | Timeout |
|------|-------|---------|-----|---------|
| block-state-md.sh | PreToolUse | Edit\|Write | — | 5s |
| block-gsd-sdk-mutation.sh | PreToolUse | Bash | Bash(gsd-sdk *) | 5s |
| bd-sync.sh | PostToolUse | Bash | Bash(bd *) | 30s |

Path placeholder: `$CLAUDE_PROJECT_DIR/.claude/hooks/...` — resolved by install.sh in Plan 02-05.

### Test Suites

| Suite | Cases | Result |
|-------|-------|--------|
| block-state-md.test.sh | 30 | 30/30 PASS |
| bd-sync.test.sh | 17 | 17/17 PASS |
| block-gsd-sdk-mutation.test.sh | 43 | 43/43 PASS |
| **Total** | **90** | **90/90 PASS** |

Test infrastructure uses synthetic Claude Code hook payloads (jq-constructed JSON piped to scripts), marker-file stub injection for cascade scripts, and if-filter simulation for the bd-prefix gate.

## Threat Mitigations

| Threat ID | Description | Implementation | Verifying Test |
|-----------|-------------|----------------|----------------|
| T-02-01 | Path traversal in block-state-md | Case-pattern anchored on `*/.planning/X` and `.planning/X`; no leading wildcard on relative arm | CASE29 in block-state-md.test.sh |
| T-02-02 | Command injection in block-gsd-sdk-mutation | Case-pattern matches `*"gsd-sdk "*"query "*` exactly (spaces required) | deny-with-flags case in block-gsd-sdk-mutation.test.sh |
| T-02-03 | Payload tampering in bd-sync | `case "$command" in "bd "*)` gate BEFORE cascade; no eval | CASE01-03 (skips non-bd) + `grep -c 'eval' = 0` |

## bd-sync Chain to Plan 02-01 Scripts

```
bd close <id>        →  bd-sync.sh fires
                     →  cascade-loop.sh --quiet   (closes eligible epics)
                     →  regen-roadmap.sh           (regenerates .planning/ROADMAP.md)
                     →  regen-requirements.sh      (regenerates .planning/REQUIREMENTS.md)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SCRIPTS env var not honored — test stubs unreachable**
- **Found during:** Task 4 (bd-sync.sh test suite)
- **Issue:** bd-sync.sh computed `SCRIPTS` from `CLAUDE_PROJECT_DIR` unconditionally; test stubs set `SCRIPTS=<tmpdir>` but the script's computed value overrode it
- **Fix:** Added `if [ -z "${SCRIPTS:-}" ]` guard so externally-set `SCRIPTS` is honored; only computes from `CLAUDE_PROJECT_DIR` when unset
- **Files modified:** hooks/bd-sync.sh
- **Commit:** a13707c

**2. [Rule 1 - Bug] Comment containing word "eval" caused acceptance criterion failure**
- **Found during:** Task 4 post-commit verification
- **Issue:** Plan acceptance criterion: `grep -c 'eval' hooks/bd-sync.sh` returns 0; comment read "never eval payload contents"
- **Fix:** Changed comment wording to "never execute payload contents"
- **Files modified:** hooks/bd-sync.sh
- **Commit:** a13707c

**3. [Rule 2 - Missing functionality] Test env var exports needed explicit `export`**
- **Found during:** Task 4 (test run)
- **Issue:** Inline variable assignment syntax (`VAR=val function_call`) only works for actual commands, not shell functions; cascade marker vars not propagating to hook subprocess
- **Fix:** Added explicit `export` calls before `run_bd_payload` in each test helper and `unset` after
- **Files modified:** tests/hook-tests/bd-sync.test.sh
- **Commit:** a13707c

## Self-Check: PASSED

All 9 created files found on disk. All 5 task commits verified in git log.

| Check | Result |
|-------|--------|
| hooks/block-state-md.sh | FOUND |
| hooks/bd-sync.sh | FOUND |
| hooks/block-gsd-sdk-mutation.sh | FOUND |
| settings.fragment.json | FOUND |
| tests/run-quick.sh | FOUND |
| tests/run-all.sh | FOUND |
| tests/hook-tests/block-state-md.test.sh | FOUND |
| tests/hook-tests/bd-sync.test.sh | FOUND |
| tests/hook-tests/block-gsd-sdk-mutation.test.sh | FOUND |
| Commit e29cd0f (Wave 0 stubs) | FOUND |
| Commit 4f794ae (block-state-md) | FOUND |
| Commit afdcbcf (block-gsd-sdk-mutation) | FOUND |
| Commit a13707c (bd-sync) | FOUND |
| Commit 55436ea (settings.fragment.json) | FOUND |
