---
phase: 02-build-the-layer
verified: 2026-04-28T18:00:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/13
  previous_verified: 2026-04-28T13:00:00Z
  gaps_closed:
    - "Truth #12 — install.sh deep-merges settings.fragment.json with dedup AND hook paths resolve correctly after merge"
    - "Truth #3 — regen-requirements.sh produces deterministic REQUIREMENTS.md (BSD/macOS portability)"
  gaps_remaining: []
  regressions: []
---

# Phase 02: Build the Layer — Re-Verification Report

**Phase Goal:** Productionize the 13 spike POCs into a `git clone && ./install.sh` distribution that gates GSD planning state behind beads, leaving GSD core untouched (REQ-01..REQ-08).
**Verified:** 2026-04-28T18:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure plan 02-07 (commits `4d8f1e0`, `c75ab78`, `efbe57c`, `ffe6aba`)

## Re-Verification Summary

The prior verification at 2026-04-28T13:00:00Z reported **11/13 must-haves verified** with two gaps blocking full goal achievement:

1. **Gap 1 (BLOCKER, REQ-04)** — Truth #12: install.sh deep-merge produced merged settings.json with literal `$CLAUDE_PROJECT_DIR/.claude/hooks/...` placeholders, which Claude Code expanded to the user's project directory rather than the actual `~/.claude/hooks/` install location. REQ-04 hook gate silently broken.
2. **Gap 2 (WARNING, REQ-06)** — Truth #3: scripts/regen-requirements.sh:105 used GNU-only `sed '\U'` escape, breaking category-header capitalization on macOS BSD sed.

Plan 02-07 shipped surgical fixes for both gaps. This re-verification confirms:
- Both gaps are now **closed** with regression-permanent CASE 6 tests in both test files.
- The other 11 previously-verified truths **still hold** (no regressions caused by 02-07's changes).
- All 8 phase requirements (REQ-01..REQ-08) remain satisfied.

**New score: 13/13 must-haves verified.**

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Running cascade-loop.sh on a hierarchy with all leaves closed cascades up and closes parent epics                                                                    | VERIFIED   | `bd epic close-eligible` present (4 occurrences); MAX_ITER=20 cap; `--quiet` flag; no `eval`. cascade-loop.test.sh: 4/4 PASS                                                                                                                                                                                                                                                                                                       |
| 2   | Running regen-roadmap.sh produces deterministic .planning/ROADMAP.md from bd state                                                                                   | VERIFIED   | `sort_by(.priority, .created_at)` present; `bd list -l gsd:phase` + `bd children` used; atomic mv write. regen-roadmap.test.sh: 5/5 PASS                                                                                                                                                                                                                                                                                            |
| 3   | Running regen-requirements.sh produces .planning/REQUIREMENTS.md grouped by version + category with traceability                                                     | VERIFIED   | **GAP 2 CLOSED.** Line 105's GNU-only `sed '\U'` removed; replaced with portable `printf | tr '-' ' ' | awk '{...toupper(substr($i,1,1))...}'`. `! grep -q '\\U' scripts/regen-requirements.sh` succeeds (no `\U` literal anywhere). regen-requirements.test.sh: 6/6 PASS including new CASE 6 (zero `\U` literals + `### Auth Flow` exact + `### Auth` exact + standalone-pipeline POSIX-portability proof produces `Auth Flow`) |
| 4   | block-state-md.sh denies writes to state-bearing markdown (abs + rel paths); allows narrative MD (REQ-07)                                                            | VERIFIED   | Both absolute (`*/.planning/X`) and relative (`.planning/X`) deny-arms present; `permissionDecision:deny`; 48-line implementation. block-state-md.test.sh: 30/30 PASS                                                                                                                                                                                                                                                              |
| 5   | block-gsd-sdk-mutation.sh denies 13 state-bearing mutations × 2 forms                                                                                                | VERIFIED   | 13 unique mutations in deny-list. block-gsd-sdk-mutation.test.sh: 43/43 PASS                                                                                                                                                                                                                                                                                                                                                       |
| 6   | bd-sync.sh fires cascade+regen for state-changing bd commands; skips read-only                                                                                       | VERIFIED   | Read-only filter and chain calls intact. bd-sync.test.sh: 17/17 PASS                                                                                                                                                                                                                                                                                                                                                               |
| 7   | settings.fragment.json declares 3 hook entries with correct matcher/if filters                                                                                       | VERIFIED   | PreToolUse[0]: Edit\|Write; PreToolUse[1]: Bash(gsd-sdk \*); PostToolUse[0]: Bash(bd \*); timeout 30 for bd-sync. `git diff -- settings.fragment.json` is empty (on-disk fragment byte-unchanged after install.sh end-to-end run — CASE 6c regression guard)                                                                                                                                                                       |
| 8   | bin/gsd-sdk-shadow.mjs is a Node ESM binary importing upstream SDK via dynamic import; 13 BEADS_OVERRIDES; beads detection; falls through to spawnUpstream           | VERIFIED   | 313 lines; 13 BEADS_OVERRIDES; await imports; `node --check` clean                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | wrap-mutation.mjs exports wrapMutation + buildMutationEvent with 7 prefix branches; fire-and-forget; null eventStream no-op                                          | VERIFIED   | 147 lines; both exports; 7 branches; `node --check` clean                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | hooks/worktree-post-checkout.sh auto-configures git config --worktree gsd-beads.dir; idempotent via marker file                                                      | VERIFIED   | Sentinel markers; `git config --worktree`; marker; flag gate. auto-config.test.sh: 5/5; append-idempotency.test.sh: 6/6                                                                                                                                                                                                                                                                                                            |
| 11  | install.sh runs as `git clone && ./install.sh` and produces a fully working layer in one invocation (REQ-06)                                                         | VERIFIED   | All 7 steps present including new substitution at line 47-48; pre-flight, copies, symlink, memories, worktree shim, recipe register; no `sed -i`; no get-shit-done refs; `bash -n install.sh` clean                                                                                                                                                                                                                                |
| 12  | install.sh deep-merges settings.fragment.json with dedup AND hook paths resolve correctly after merge                                                                | VERIFIED   | **GAP 1 CLOSED.** install.sh:47-48 now substitutes via `sed "s\|\$CLAUDE_PROJECT_DIR/.claude/hooks\|$HOOKS_DEST\|g"` to a mktemp tempfile before jq merge; tempfile cleaned up at line 70. CASE 6a (zero `$CLAUDE_PROJECT_DIR` survivors), 6b (all hook commands under `$HOME/.claude/hooks/`), 6c (on-disk fragment unchanged), 6d (post-Step-3 invariant) all PASS. settings-merge.test.sh: 9/9 PASS (5 original + 4 new sub-cases) |
| 13  | install/memories/vocabulary.md contains `bd ready`; 7 memories seeded (REQ-08)                                                                                       | VERIFIED   | `bd ready` in vocabulary.md; 7 memory files in install/memories/                                                                                                                                                                                                                                                                                                                                                                   |

**Score:** 13/13 truths verified (was 11/13 — 2 gaps closed)

### Required Artifacts

| Artifact                                          | Status   | Details                                                                                                                                                                                  |
| ------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/cascade-loop.sh` (47 lines)              | VERIFIED | bd epic close-eligible + MAX_ITER cap + --quiet                                                                                                                                          |
| `scripts/regen-roadmap.sh` (238 lines)            | VERIFIED | sort_by, bd list/children, atomic mv                                                                                                                                                     |
| `scripts/regen-requirements.sh` (275 lines)       | VERIFIED | **NOW PORTABLE.** Line 105's `sed '\U'` removed; `tr '-' ' ' \| awk` Title-Case pipeline at lines 107-109. POSIX-mandated tools, BSD/GNU equivalent. `bash -n` clean                     |
| `hooks/block-state-md.sh` (48 lines)              | VERIFIED | abs+rel deny, narrative allow                                                                                                                                                            |
| `hooks/bd-sync.sh` (48 lines)                     | VERIFIED | read-only filter, chain calls, bd prefix gate                                                                                                                                            |
| `hooks/block-gsd-sdk-mutation.sh` (108 lines)     | VERIFIED | 13-mutation deny-list                                                                                                                                                                    |
| `hooks/worktree-post-checkout.sh` (35 lines)      | VERIFIED | sentinel, marker, flag gate                                                                                                                                                              |
| `settings.fragment.json` (843B)                   | VERIFIED | 3 hooks, correct matchers/ifs/timeouts. **Byte-unchanged** after install.sh end-to-end (regression-guarded by CASE 6c)                                                                   |
| `bin/gsd-sdk-shadow.mjs` (313 lines)              | VERIFIED | 13 BEADS_OVERRIDES, dynamic imports, passthrough                                                                                                                                         |
| `bin/wrap-mutation.mjs` (147 lines)               | VERIFIED | 7 branches, fire-and-forget, null-safe                                                                                                                                                   |
| `install.sh` (123 lines, was 114)                 | VERIFIED | **NOW SUBSTITUTES PATHS.** Lines 47-48 add `mktemp` + `sed "s\|\$CLAUDE_PROJECT_DIR/.claude/hooks\|$HOOKS_DEST\|g"`; line 68 jq reads from tempfile; line 70 cleans up. `bash -n` clean |
| `install/memories/*.md` (7 files)                 | VERIFIED | All present including vocabulary.md with `bd ready`                                                                                                                                      |
| `recipe/gsd-beads-recipe.md`                      | VERIFIED | Contains `git clone` and `install.sh`                                                                                                                                                    |
| `tests/hook-tests/*.test.sh` (6 files)            | VERIFIED | All 6 pass; regen-requirements adds CASE 6                                                                                                                                               |
| `tests/shadow-tests/*.test.mjs` (15 files)        | VERIFIED | 13 handler tests + argv-routing + wrap-mutation                                                                                                                                          |
| `tests/install-tests/*.test.sh` (5 files)         | VERIFIED | settings-merge: 9/9 (was 5/5); 3 others pass; idempotency CASE 4 + memory-seeding CASE 8 pre-existing dev-env failure (stray `gsd-beads-vocabulary` hyphen-key in user's bd memory store), unrelated to 02-07 — verified by re-running on baseline `e5aeadf` (same FAIL) |
| `tests/worktree-tests/*.test.sh` (2 files)        | VERIFIED | auto-config 5/5; append-idempotency 6/6                                                                                                                                                  |
| `tests/e2e/*.sh` (5 files)                        | VERIFIED | All 5 e2e files present                                                                                                                                                                  |

### Key Link Verification

| From                              | To                                | Via                                            | Status   | Details                                                                                                                                                            |
| --------------------------------- | --------------------------------- | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hooks/bd-sync.sh                  | scripts/cascade-loop.sh           | "$SCRIPTS/cascade-loop.sh" call                | VERIFIED | Pattern present                                                                                                                                                    |
| hooks/bd-sync.sh                  | scripts/regen-roadmap.sh          | "$SCRIPTS/regen-roadmap.sh"                    | VERIFIED | Pattern present                                                                                                                                                    |
| hooks/bd-sync.sh                  | scripts/regen-requirements.sh     | "$SCRIPTS/regen-requirements.sh"               | VERIFIED | Pattern present                                                                                                                                                    |
| settings.fragment.json            | hooks/*.sh                        | $CLAUDE_PROJECT_DIR/.claude/hooks/ → resolved  | VERIFIED | **GAP 1 CLOSED.** Fragment placeholder paths are SUBSTITUTED to `$HOME/.claude/hooks/` in-flight by install.sh:47-48 BEFORE the jq merge. CASE 6a/6b confirms.    |
| install.sh                        | settings.fragment.json            | sed substitution → mktemp → jq -s deep-merge   | VERIFIED | install.sh:47-68 chain: `mktemp` → `sed s\|...\|...\|g $FRAGMENT > $fragment_resolved` → `jq -s ... $SETTINGS $fragment_resolved` → `mv` → `rm -f $fragment_resolved` |
| install.sh                        | bin/gsd-sdk-shadow.mjs            | ln -sfn to ~/.local/bin/gsd-sdk                | VERIFIED | ln -sfn present                                                                                                                                                    |
| install.sh                        | bd remember                       | loop over install/memories/*.md                | VERIFIED | gsd-beads: namespace loop with bd forget + bd remember                                                                                                             |
| install.sh                        | hooks/worktree-post-checkout.sh   | mktemp + sed strip + cat append + mv           | VERIFIED | Sentinel strip-and-append; no sed -i                                                                                                                               |
| bin/gsd-sdk-shadow.mjs            | upstream SDK                      | await import dynamic                           | VERIFIED | Both QUERY_INDEX_PATH and REGISTRY_PATH dynamic imports                                                                                                            |
| bin/gsd-sdk-shadow.mjs            | bin/wrap-mutation.mjs             | import { wrapMutation }                        | VERIFIED | Import present                                                                                                                                                     |
| bin/gsd-sdk-shadow.mjs            | bd CLI                            | execSync('bd ...')                             | VERIFIED | Multiple bd CLI calls                                                                                                                                              |
| bin/gsd-sdk-shadow.mjs            | upstream binary (passthrough)     | spawnSync(UPSTREAM_BIN, argv)                  | VERIFIED | spawnSync present                                                                                                                                                  |
| scripts/regen-roadmap.sh          | bd list -l gsd:phase              | execvp via $(...)                              | VERIFIED | Pattern present                                                                                                                                                    |
| scripts/regen-roadmap.sh          | bd children                       | per-phase iteration                            | VERIFIED | Calls present                                                                                                                                                      |
| scripts/regen-requirements.sh     | bd list -l gsd:requirement        | main query                                     | VERIFIED | Line 70                                                                                                                                                            |
| scripts/cascade-loop.sh           | bd epic close-eligible            | while-loop body                                | VERIFIED | 4 occurrences                                                                                                                                                      |

### Data-Flow Trace (Level 4)

| Script                          | Data Source                                              | Real Data?              | Status   |
| ------------------------------- | -------------------------------------------------------- | ----------------------- | -------- |
| regen-roadmap.sh                | bd list --type=epic -l gsd:phase --json + jq sort_by     | Yes                     | FLOWING  |
| regen-requirements.sh           | bd list --type=epic -l gsd:requirement --json + jq filter | Yes (now portable)      | FLOWING  |
| cascade-loop.sh                 | bd epic close-eligible output                            | Yes                     | FLOWING  |
| install.sh path substitution    | settings.fragment.json placeholder → $HOOKS_DEST         | Yes (substituted)       | FLOWING  |
| install.sh jq deep-merge        | $SETTINGS + $fragment_resolved (substituted tempfile)    | Yes                     | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                                          | Command                                                                          | Result        | Status |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------- | ------ |
| install.sh syntax valid                                                           | `bash -n install.sh`                                                             | exit 0        | PASS   |
| regen-requirements.sh syntax valid                                                | `bash -n scripts/regen-requirements.sh`                                          | exit 0        | PASS   |
| All 4 hooks syntax valid                                                          | `bash -n hooks/*.sh`                                                             | exit 0        | PASS   |
| Both Node binaries syntax valid                                                   | `node --check bin/*.mjs`                                                         | exit 0        | PASS   |
| settings-merge.test.sh end-to-end                                                 | `bash tests/install-tests/settings-merge.test.sh`                                | 9/9           | PASS   |
| regen-requirements.test.sh end-to-end                                             | `bash tests/hook-tests/regen-requirements.test.sh`                               | 6/6           | PASS   |
| `! grep -q '\\U' scripts/regen-requirements.sh` (no GNU `\U` literal anywhere)    | grep                                                                             | exit 1        | PASS   |
| `grep -c "tr '-' ' '" scripts/regen-requirements.sh` returns 1                    | grep                                                                             | 1             | PASS   |
| install.sh contains substitution sed line                                         | `grep -n "sed.*CLAUDE_PROJECT_DIR.*HOOKS_DEST" install.sh`                       | line 48 found | PASS   |
| `git diff -- settings.fragment.json` after sandbox install.sh run                 | git diff                                                                         | exit 0        | PASS   |
| Sandboxed merged settings.json has 0 `$CLAUDE_PROJECT_DIR` literals               | jq + grep -c -F                                                                  | 0             | PASS   |
| All hook commands resolve under sandboxed `$HOME/.claude/hooks/`                  | jq + path filter                                                                 | empty (good)  | PASS   |
| All other hook tests pass                                                         | bd-sync 17/17 + block-gsd-sdk-mutation 43/43 + block-state-md 30/30 + cascade 4/4 + regen-roadmap 5/5 | -    | PASS   |
| All worktree tests pass                                                           | auto-config 5/5 + append-idempotency 6/6                                         | -             | PASS   |
| 3 of 5 install-tests pass; 2 pre-existing dev-env failures unrelated to 02-07     | settings-merge 9/9 + no-gsd-core-mutation 3/3 + path-precedence 4/4 + idempotency 3/4 (CASE 4 fails on stray bd key) + memory-seeding 7/8 (CASE 8 fails on stray bd key) | - | PASS (with documented pre-existing dev-env caveat) |

### Requirements Coverage

| Requirement | Source Plans                          | Description                              | Status    | Evidence                                                                                                                                                                                                                                |
| ----------- | ------------------------------------- | ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-01      | 02-01, 02-03, 02-06                   | Beads is source of truth                 | SATISFIED | regen-roadmap.sh + regen-requirements.sh (now portable) regenerate from bd state; shadow routes 13 mutations to bd                                                                                                                      |
| REQ-02      | 02-03, 02-05, 02-06                   | GSD core unmodified                      | SATISFIED | No writes to ~/.claude/get-shit-done/; shadow uses dynamic import; no upstream files modified by 02-07                                                                                                                                  |
| REQ-03      | 02-04, 02-06                          | Cross-worktree state sharing             | SATISFIED | worktree-post-checkout.sh sets gsd-beads.dir; sentinel-marker idempotent append (auto-config 5/5, append-idempotency 6/6)                                                                                                              |
| REQ-04      | 02-02, 02-03, 02-06, **02-07**        | Deterministic write-path enforcement     | SATISFIED | **GAP 1 CLOSED.** Hooks now point to actual `$HOME/.claude/hooks/` after install.sh path substitution; CASE 6a/6b/6c/6d regression-guard the substitution                                                                              |
| REQ-05      | 02-06                                 | Conflict-free concurrent updates         | SATISFIED | concurrent-merge.test.sh verified in prior verification (no regressions in 02-07)                                                                                                                                                       |
| REQ-06      | 02-05, 02-06, **02-07**               | Versioned, installable distribution      | SATISFIED | **GAP 2 CLOSED.** install.sh complete; regen-requirements.sh now portable on macOS BSD sed via tr+awk; CASE 6 standalone-pipeline POSIX-portability proof produces `Auth Flow` from `auth-flow`                                       |
| REQ-07      | 02-02                                 | Narrative markdown untouched             | SATISFIED | block-state-md.sh allow-arms for narrative MD verified by block-state-md.test.sh: 30/30                                                                                                                                                |
| REQ-08      | 02-05, 02-06                          | Ready-set query is canonical "what's next" | SATISFIED | gsd-beads:vocabulary seeded with `bd ready`; bd-ready.smoke.sh CASE 4 verified prior                                                                                                                                                    |

All 8 phase requirements satisfied (REQ-04 and REQ-06 flipped from PARTIAL to SATISFIED via 02-07).

### Anti-Patterns Found (Post-02-07)

| File                              | Issue                                                                                                                          | Severity | Impact                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `install.sh` lines 47, 49        | mktemp with no `-p`; temp files go to `/tmp` (different filesystem on WSL2/macOS); `mv` is copy+unlink not rename(2)            | INFO     | T-02-06/T-02-07 mitigations are not strictly atomic on cross-filesystem setups (tracked separately in 02-REVIEW.md CR-01) |
| `bin/gsd-sdk-shadow.mjs`          | execSync string interpolation with user-controlled IDs without array-form protection                                            | INFO     | Tracked separately in 02-REVIEW.md CR-02; not load-bearing for phase goal                                           |
| `tests/install-tests/path-precedence.test.sh` lines 57-59 | exit_code2 captured after `\|\| true` — always 0; CASE 2b structurally cannot fail                                              | INFO     | Tracked separately in 02-REVIEW.md CR-03                                                                            |

The two original BLOCKER findings (path-substitution gap and GNU-sed `\U`) are now CLOSED. The remaining items above are advisory-only and tracked for `/gsd-code-review-fix`. None block the phase goal.

### Pre-Existing Test Environment Caveats

Two install-tests fail on this dev machine due to a stray `gsd-beads-vocabulary` (hyphen, not colon) bd memory key from prior development work — `bd memories gsd-beads` shows 8 keys instead of 7:

- `tests/install-tests/idempotency.test.sh` CASE 4: "expected 7 gsd-beads:* memories, got 8"
- `tests/install-tests/memory-seeding.test.sh` CASE 8: "expected 7 gsd-beads:* keys after second install, got 8"

Verified pre-existing by checking out the baseline commit `e5aeadf` (immediately before 02-07): same failures occur. These failures are dev-environment artifacts, not phase-02 production gaps. They're documented in `.planning/phases/02-build-the-layer/deferred-items.md` per the SCOPE BOUNDARY rule.

### Human Verification Required

None — all must-have truths are verified via static analysis and automated tests. The phase goal ("git clone && ./install.sh distribution that gates GSD planning state behind beads") is achievable on Linux, WSL2, and macOS as evidenced by:
- POSIX-only tools in shell scripts (no GNU sed extensions)
- Sandboxed end-to-end install.sh test in CASE 6 (settings-merge.test.sh) confirms hook-path resolution works against a clean `$HOME`
- Standalone-pipeline POSIX-portability proof in CASE 6 (regen-requirements.test.sh) confirms BSD-equivalent capitalization by construction

### Re-Verification Notes

**Gap closure verification:**

1. **Gap 1 (Truth #12, REQ-04)** — install.sh path substitution:
   - Code change verified at install.sh:47-48 (sed substitution with `\|` delimiter, `\$CLAUDE_PROJECT_DIR/.claude/hooks` literal LHS, `$HOOKS_DEST` shell-expanded RHS) and line 70 (tempfile cleanup).
   - settings-merge.test.sh CASE 6 (a/b/c/d) all PASS with sandboxed `$HOME` end-to-end install.sh execution.
   - On-disk settings.fragment.json byte-unchanged: `git diff -- settings.fragment.json` is empty.
   - Vacuous-pass guard present: hook_count >= 1 sentinel before sub-assertions.

2. **Gap 2 (Truth #3, REQ-06)** — regen-requirements.sh BSD portability:
   - Code change verified at scripts/regen-requirements.sh:107-109 (no `sed`, only `tr '-' ' '` + `awk` Title-Case pipeline).
   - `! grep -q '\\U' scripts/regen-requirements.sh` succeeds (no `\U` literal anywhere, including comments).
   - regen-requirements.test.sh CASE 6 PASSes including the standalone-pipeline portability proof (`auth-flow` → `Auth Flow` via POSIX-only tr+awk).

**Regression check:**

The 11 previously-VERIFIED truths still hold:
- All 6 hook-tests PASS (bd-sync 17/17, block-gsd-sdk-mutation 43/43, block-state-md 30/30, cascade-loop 4/4, regen-roadmap 5/5, regen-requirements 6/6).
- Both worktree-tests PASS (auto-config 5/5, append-idempotency 6/6).
- 3 of 5 install-tests fully PASS; 2 have pre-existing dev-env failures unrelated to 02-07.
- Both Node binaries syntax-check clean.
- All shell hooks syntax-check clean.

No regressions introduced by 02-07. The diff is surgical: 9 insertions / 1 deletion in install.sh, 6 insertions / 2 deletions in scripts/regen-requirements.sh, plus net-additive test cases.

### Score Progression

| Verification Run                | Truths VERIFIED | Truths FAILED/PARTIAL | Status     |
| ------------------------------- | --------------- | --------------------- | ---------- |
| Initial (2026-04-28T13:00:00Z)  | 11              | 2                     | gaps_found |
| Re-verification (2026-04-28T18:00:00Z)  | **13**          | **0**                 | **passed** |

---

_Re-Verified: 2026-04-28T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Prior verification: 2026-04-28T13:00:00Z (gaps_found, 11/13)_
