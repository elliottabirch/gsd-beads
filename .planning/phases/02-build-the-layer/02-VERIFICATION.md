---
phase: 02-build-the-layer
verified: 2026-04-28T13:00:00Z
status: gaps_found
score: 11/13 must-haves verified
overrides_applied: 0
gaps:
  - truth: "install.sh deep-merges settings.fragment.json into ~/.claude/settings.json with array dedup on (matcher, command, if) tuple"
    status: partial
    reason: "The deep-merge logic and dedup are present and correct, but install.sh does NOT substitute the $CLAUDE_PROJECT_DIR/.claude/hooks/ placeholder paths with the actual ~/.claude/hooks/ location before writing. The merged settings.json will contain literal $CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh (and the other two hooks), which Claude Code will expand to [user-project]/.claude/hooks/ — a directory that never exists. Hooks will not fire. PATTERNS.md line 'Confirm path layout in 02-05 install script before locking the fragment paths' was never resolved. Plan 02-02 Task 5 explicitly says 'Plan 02-05's install.sh resolves these to actual ~/.claude/hooks/ location during deep-merge' — this resolution is absent."
    artifacts:
      - path: "install.sh"
        issue: "jq merge emits fragment hook commands verbatim with $CLAUDE_PROJECT_DIR placeholder; no sed/envsubst substitution to ~/.claude/hooks/ anywhere in the file"
      - path: "settings.fragment.json"
        issue: "Hook commands use $CLAUDE_PROJECT_DIR/.claude/hooks/ paths; hooks are installed to ~/.claude/hooks/ — these are different directories"
    missing:
      - "Before or during the jq deep-merge, substitute $CLAUDE_PROJECT_DIR/.claude/hooks with $HOME/.claude/hooks in the fragment (e.g., envsubst or sed replacement), so the merged settings.json contains resolvable absolute paths"
  - truth: "All three scripts use bash + jq + bd CLI only (no Node, no Python — per CONVENTIONS Standard Stack)"
    status: partial
    reason: "The scripts use bash + jq + bd CLI correctly. However regen-requirements.sh uses a GNU-only sed escape (\\U for uppercase) at line 105 that silently produces literal '\\Uauth' on macOS BSD sed. CLAUDE.md lists macOS as a primary supported platform. This breaks the REQUIREMENTS.md category heading format contract from Spike 007."
    artifacts:
      - path: "scripts/regen-requirements.sh"
        issue: "Line 105: sed 's/^./\\U&/; s/-/ /g' uses GNU sed \\U extension; breaks on macOS; the subsequent awk pipeline was sufficient alone"
    missing:
      - "Replace the sed '\\U' call with a portable awk expression as specified in CR-04 of 02-REVIEW.md"
---

# Phase 02: Build the Layer — Verification Report

**Phase Goal:** Productionize the 13 spike POCs into a `git clone && ./install.sh` distribution that gates GSD planning state behind beads, leaving GSD core untouched (REQ-01..REQ-08).
**Verified:** 2026-04-28T13:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Running cascade-loop.sh on a hierarchy with all leaves closed cascades up and closes parent epics | VERIFIED | `bd epic close-eligible` present (4 occurrences); MAX_ITER=20 cap; --quiet flag; no eval |
| 2 | Running regen-roadmap.sh produces deterministic .planning/ROADMAP.md from bd state | VERIFIED | sort_by(.priority, .created_at) present; bd list -l gsd:phase + bd children used; atomic mv write; no ~/.claude/get-shit-done writes |
| 3 | Running regen-requirements.sh produces .planning/REQUIREMENTS.md grouped by version + category with traceability | PARTIAL | bd list -l gsd:requirement, out-of-scope filter, parent-child traceability all present. BUT: uses GNU-only sed \\U on line 105; breaks category headers on macOS (CR-04) |
| 4 | block-state-md.sh denies writes to state-bearing markdown (abs + rel paths); allows narrative MD (REQ-07) | VERIFIED | Both absolute (*/.planning/X) and relative (.planning/X) deny-arms present; permissionDecision:deny; 48-line implementation; no /gsd-beads-* refs |
| 5 | block-gsd-sdk-mutation.sh denies 13 state-bearing mutations × 2 forms | VERIFIED | All 13 mutations present in deny-list (14 grep matches — 13 unique mutations); no /gsd-beads- refs |
| 6 | bd-sync.sh fires cascade+regen for state-changing bd commands; skips read-only | VERIFIED | Read-only filter: list|show|ready|memories|status|prime|export|deps|children|search|help|version. Chains to cascade-loop.sh, regen-roadmap.sh, regen-requirements.sh. "bd "*) gate present. No eval |
| 7 | settings.fragment.json declares 3 hook entries with correct matcher/if filters | VERIFIED | PreToolUse[0]: Edit|Write; PreToolUse[1]: Bash(gsd-sdk *); PostToolUse[0]: Bash(bd *); timeout 30 for bd-sync |
| 8 | bin/gsd-sdk-shadow.mjs is a Node ESM binary importing upstream SDK via dynamic import; 13 BEADS_OVERRIDES; beads detection; falls through to spawnUpstream | VERIFIED | 313 lines (< 800); BEADS_OVERRIDES has exactly 13 entries; await import for queryModule + registryModule; existsSync .beads/metadata.json; spawnSync(UPSTREAM_BIN); eventStream=null (W3); resolveQueryArgv used |
| 9 | wrap-mutation.mjs exports wrapMutation + buildMutationEvent with 7 prefix branches; fire-and-forget; null eventStream no-op | VERIFIED | 147 lines; both exports present; 7 cmd.startsWith branches; try/catch around emitEvent; null guard via ?. |
| 10 | hooks/worktree-post-checkout.sh auto-configures git config --worktree gsd-beads.dir; idempotent via marker file | VERIFIED | Sentinel markers present (BEGIN/END v1); git config --worktree gsd-beads.dir; .gsd-beads-configured marker; flag=1 gate |
| 11 | install.sh runs as `git clone && ./install.sh` and produces a fully working layer in one invocation (REQ-06) | VERIFIED | Pre-flight (bd/jq/node/git + node>=22); copies all 6 hooks+scripts; symlinks gsd-sdk; seeds 7 memories; appends worktree shim (sentinel, atomic mktemp+mv); no sed -i (B6); no heredoc (W5); no get-shit-done refs (REQ-02 / T-02-09) |
| 12 | install.sh deep-merges settings.fragment.json with dedup AND hook paths resolve correctly after merge | FAILED | Dedup logic correct (unique_by command+if within each matcher group). BUT: $CLAUDE_PROJECT_DIR placeholder paths in fragment are NOT substituted during merge. After install, settings.json contains $CLAUDE_PROJECT_DIR/.claude/hooks/*.sh paths. Claude Code expands $CLAUDE_PROJECT_DIR to the user's project directory, NOT to ~/.claude/. Hooks installed to ~/.claude/hooks/ will NOT be found. REQ-04 hook gate breaks silently. |
| 13 | install/memories/vocabulary.md contains `bd ready`; 7 memories seeded (REQ-08) | VERIFIED | `bd ready` present in vocabulary.md (grep-c returns 1); 7 memory files in install/memories/ |

**Score:** 11/13 truths verified (1 FAILED, 1 PARTIAL)

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `scripts/cascade-loop.sh` | 25 | 47 | VERIFIED | bd epic close-eligible + MAX_ITER cap + --quiet |
| `scripts/regen-roadmap.sh` | 60 | 238 | VERIFIED | sort_by, bd list/children, atomic mv |
| `scripts/regen-requirements.sh` | 50 | 270 | STUB (macOS) | GNU sed \\U on line 105 breaks on non-Linux |
| `hooks/block-state-md.sh` | 40 | 48 | VERIFIED | abs+rel deny, narrative allow |
| `hooks/bd-sync.sh` | 30 | 48 | VERIFIED | read-only filter, chain calls, bd prefix gate |
| `hooks/block-gsd-sdk-mutation.sh` | 80 | 108 | VERIFIED | 13-mutation deny-list |
| `hooks/worktree-post-checkout.sh` | 35 | 35 | VERIFIED | sentinel, marker file, flag gate |
| `settings.fragment.json` | — | 843B | VERIFIED | 3 hooks, correct matchers/ifs/timeouts |
| `bin/gsd-sdk-shadow.mjs` | 250 | 313 | VERIFIED | 13 BEADS_OVERRIDES, dynamic imports, passthrough |
| `bin/wrap-mutation.mjs` | 80 | 147 | VERIFIED | 7 branches, fire-and-forget, null-safe |
| `install.sh` | 150 | 114 | VERIFIED | All 7 steps; all acceptance criteria met except path substitution |
| `install/memories/*.md` | 7 files | 7 files | VERIFIED | All 7 files including vocabulary.md with `bd ready` |
| `recipe/gsd-beads-recipe.md` | — | 769B | VERIFIED | Contains `git clone` and `install.sh` |
| `tests/hook-tests/*.test.sh` | 6 files | 6 files | VERIFIED | cascade-loop, regen-roadmap, regen-requirements, block-state-md, bd-sync, block-gsd-sdk-mutation |
| `tests/shadow-tests/*.test.mjs` | 15 files | 15 files | VERIFIED | 13 handler tests + argv-routing + wrap-mutation |
| `tests/install-tests/*.test.sh` | 5 files | 5 files | VERIFIED | idempotency, settings-merge, memory-seeding, path-precedence, no-gsd-core-mutation |
| `tests/worktree-tests/*.test.sh` | 2 files | 2 files | VERIFIED | auto-config, append-idempotency |
| `tests/e2e/*.sh` | 5 files | 5 files | VERIFIED | full-install, bd-sync-latency, concurrent-merge, post-gsd-update, bd-ready |
| `tests/e2e/fixtures/scale-50-bead.sh` | — | present | VERIFIED | 50-bead builder |
| `tests/run-quick.sh` | — | present | VERIFIED | Meta runner |
| `tests/run-all.sh` | — | present | VERIFIED | Full-suite runner |
| `tests/fixtures/bd-helpers/3-level-hierarchy.sh` | — | present | VERIFIED | Shared fixture |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| hooks/bd-sync.sh | scripts/cascade-loop.sh | "$SCRIPTS/cascade-loop.sh" call | VERIFIED | Pattern cascade-loop.sh present |
| hooks/bd-sync.sh | scripts/regen-roadmap.sh | "$SCRIPTS/regen-roadmap.sh" | VERIFIED | Pattern regen-roadmap.sh present |
| hooks/bd-sync.sh | scripts/regen-requirements.sh | "$SCRIPTS/regen-requirements.sh" | VERIFIED | Pattern regen-requirements.sh present |
| settings.fragment.json | hooks/*.sh | $CLAUDE_PROJECT_DIR/.claude/hooks/ path | FAILED | Paths reference $CLAUDE_PROJECT_DIR/.claude/hooks/ but install.sh puts hooks at ~/.claude/hooks/. No path substitution performed during merge. After install, hook commands point to wrong directory. |
| install.sh | settings.fragment.json | jq -s deep-merge | PARTIAL | Merge logic correct (dedup on command+if within matcher groups) but does not substitute $CLAUDE_PROJECT_DIR placeholder before writing |
| install.sh | bin/gsd-sdk-shadow.mjs | ln -sfn to ~/.local/bin/gsd-sdk | VERIFIED | ln -sfn present; $SHADOW variable set |
| install.sh | bd remember | loop over install/memories/*.md | VERIFIED | gsd-beads: namespace loop with bd forget + bd remember present |
| install.sh | hooks/worktree-post-checkout.sh | mktemp + sed strip + cat append + mv | VERIFIED | Sentinel strip-and-append pattern present; no sed -i |
| bin/gsd-sdk-shadow.mjs | upstream createRegistry/resolveQueryArgv/extractField | await import(QUERY_INDEX_PATH) + await import(REGISTRY_PATH) | VERIFIED | Both dynamic imports present |
| bin/gsd-sdk-shadow.mjs | bin/wrap-mutation.mjs | import { wrapMutation } | VERIFIED | Import present |
| bin/gsd-sdk-shadow.mjs | bd CLI | execSync('bd ...') | VERIFIED | Multiple bd CLI calls (execSync count >= 4) |
| bin/gsd-sdk-shadow.mjs | upstream binary (passthrough) | spawnSync(UPSTREAM_BIN, argv) | VERIFIED | spawnSync(UPSTREAM_BIN) present |
| scripts/regen-roadmap.sh | bd list -l gsd:phase | execvp via $(...) | VERIFIED | bd list.*-l gsd:phase pattern present |
| scripts/regen-roadmap.sh | bd children | per-phase iteration | VERIFIED | bd children calls present |
| scripts/regen-requirements.sh | bd list -l gsd:requirement | main query | VERIFIED | Pattern present |
| scripts/cascade-loop.sh | bd epic close-eligible | while-loop body | VERIFIED | 4 occurrences |

### Data-Flow Trace (Level 4)

Scripts produce markdown files from bd CLI output — not React components. The data pipeline is: bd CLI → jq transform → atomic write to .planning/*.md. Tracing done via code inspection:

| Script | Data Source | bd Query | Real Data? | Status |
|--------|------------|---------|-----------|--------|
| regen-roadmap.sh | bd list --type=epic -l gsd:phase --json | jq sort_by(.priority, .created_at) | Yes | FLOWING |
| regen-requirements.sh | bd list --type=epic -l gsd:requirement --json | jq filter | Yes (macOS broken) | STATIC on macOS (GNU sed \\U) |
| cascade-loop.sh | bd epic close-eligible output | grep/sed parse | Yes | FLOWING |

### Behavioral Spot-Checks

Tests are bash-driven using synthetic payloads — no live server needed. Node.js handler tests require `bd` CLI. Not running live here (would require bd init in temp dir).

| Behavior | Evidence | Status |
|----------|---------|--------|
| cascade-loop.sh syntax valid | `bash -n scripts/cascade-loop.sh` | PASS (verified) |
| regen-roadmap.sh syntax valid | `bash -n scripts/regen-roadmap.sh` | PASS (verified) |
| regen-requirements.sh syntax valid | `bash -n scripts/regen-requirements.sh` | PASS |
| hooks/block-state-md.sh syntax valid | `bash -n hooks/block-state-md.sh` | PASS (verified) |
| hooks/bd-sync.sh syntax valid | `bash -n hooks/bd-sync.sh` | PASS (verified) |
| hooks/worktree-post-checkout.sh syntax valid | `bash -n hooks/worktree-post-checkout.sh` | PASS (verified) |
| install.sh syntax valid | `bash -n install.sh` | PASS (verified) |
| gsd-sdk-shadow.mjs syntax valid | `node --check bin/gsd-sdk-shadow.mjs` | PASS (verified) |
| wrap-mutation.mjs syntax valid | `node --check bin/wrap-mutation.mjs` | PASS (verified) |
| settings.fragment.json valid JSON | `jq . settings.fragment.json` | PASS |
| BEADS_OVERRIDES has 13 entries | grep + visual inspection | PASS |
| settings.fragment.json path gap | paths are $CLAUDE_PROJECT_DIR not $HOME | FAIL — hooks won't resolve |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| REQ-01 | 02-01, 02-03 | Beads is source of truth | SATISFIED | regen-roadmap.sh + regen-requirements.sh regenerate from bd state; shadow routes 13 mutations to bd |
| REQ-02 | 02-03, 02-05 | GSD core unmodified | SATISFIED | No writes to ~/.claude/get-shit-done/ in any script (grep returns 0); shadow uses dynamic import (no fork/modify) |
| REQ-03 | 02-04 | Cross-worktree state sharing | SATISFIED | worktree-post-checkout.sh sets git config --worktree gsd-beads.dir; sentinel-marker idempotent append |
| REQ-04 | 02-02 | Deterministic write-path enforcement | PARTIAL | Hooks exist and are correct. BUT hook paths in merged settings.json ($CLAUDE_PROJECT_DIR/.claude/hooks/) won't resolve to installed location (~/.claude/hooks/). Hooks may not fire in production. |
| REQ-05 | 02-06 | Conflict-free concurrent updates | SATISFIED | concurrent-merge.test.sh verifies both writers commit, close_reason is one of {wt-source, wt-secondary}, no DB corruption (B1 fix per Pitfall 8 last-writer-wins interpretation) |
| REQ-06 | 02-05 | Versioned, installable distribution | SATISFIED | install.sh: 7-step idempotent installer; all pre-flights; atomic writes; dedup merge; PATH check |
| REQ-07 | 02-02 | Narrative markdown untouched | SATISFIED | block-state-md.sh case arms only match .planning/ROADMAP.md|REQUIREMENTS.md|todos/*|seeds/*; PLAN.md, RESEARCH.md etc. fall through to the default allow arm |
| REQ-08 | 02-05, 02-06 | Ready-set query is canonical "what's next" | SATISFIED | gsd-beads:vocabulary seeded with `bd ready` (W7 gate); bd-ready.smoke.sh CASE 4 verifies bd prime surfaces vocabulary (B2/D-07) |

### Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|---------|--------|
| `settings.fragment.json` | $CLAUDE_PROJECT_DIR/.claude/hooks/ path that won't resolve to ~/.claude/hooks/ after install | BLOCKER | REQ-04 hooks silently don't fire in user projects |
| `scripts/regen-requirements.sh` line 105 | GNU-only sed \\U escape; breaks on macOS BSD sed | WARNING | Malformed category headers on macOS; Spike 007 format contract violated on macOS |
| `install.sh` lines 99-103 | mktemp with no -p; temp files go to /tmp (different filesystem on WSL2/macOS); mv is copy+unlink not rename(2) | WARNING | T-02-06/T-02-07 mitigations are claimed but not truly atomic on cross-filesystem setups (CR-01 in 02-REVIEW.md) |
| `bin/gsd-sdk-shadow.mjs` | execSync string interpolation with user-controlled IDs (phaseId, beadId, etc.) without array-form protection | WARNING | Command injection if bd returns a malformed ID or args contain shell metacharacters (CR-02 in 02-REVIEW.md) |
| `tests/install-tests/path-precedence.test.sh` lines 57-59 | exit_code2 captured after `|| true`; always 0; CASE 2b structurally cannot fail | WARNING | Test masks regression where install.sh aborts instead of warns (CR-03 in 02-REVIEW.md) |

Note: the 4 CRITICAL and 11 WARNING findings in 02-REVIEW.md are advisory and tracked separately for `/gsd-code-review-fix`. The gaps above are load-bearing for the phase goal.

### Human Verification Required

None — all must-have truths are either verified or failed via static analysis. No UI/visual/real-time behaviors require human testing.

### Gaps Summary

**Gap 1 — BLOCKER (REQ-04): settings.fragment.json hook paths not resolved during install**

The install.sh deep-merge pipeline does not substitute the `$CLAUDE_PROJECT_DIR/.claude/hooks/` placeholder in settings.fragment.json with the actual `~/.claude/hooks/` path where hooks are installed. After running `./install.sh`, the merged `~/.claude/settings.json` will contain hook commands like `$CLAUDE_PROJECT_DIR/.claude/hooks/block-state-md.sh`. Claude Code expands `$CLAUDE_PROJECT_DIR` to the user's active project directory (e.g., `~/my-project`). The hooks live at `~/.claude/hooks/`, not at `~/my-project/.claude/hooks/`. The hooks will not be found, will not fire, and the entire REQ-04 write-path gate is silently broken.

This was explicitly documented as a TODO in PATTERNS.md: "Confirm path layout in 02-05 install script before locking the fragment paths." Plan 02-02 Task 5 stated "Plan 02-05's install.sh resolves these to actual `~/.claude/hooks/` location during deep-merge." This resolution was not implemented.

Fix: before the jq merge, substitute paths via e.g. `sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$HOME/.claude/hooks|g"` on the fragment, or pass the resolved paths as jq variables.

**Gap 2 — WARNING (Platform): regen-requirements.sh uses GNU-only sed \\U**

`scripts/regen-requirements.sh` line 105 uses `sed 's/^./\U&/'` for category-header capitalization. This is a GNU sed extension not available on macOS BSD sed. The CLAUDE.md identifies macOS as a primary supported platform. On macOS, category headers will render as `## \Uauth` rather than `## Auth`, violating the Spike 007 REQUIREMENTS.md format contract. The subsequent `awk` pipeline was sufficient alone for word capitalization and should replace the sed call.

Both gaps must be closed before the phase goal ("git clone && ./install.sh distribution that gates GSD planning state behind beads") is fully achieved. Gap 1 is the blocking one — without it, REQ-04 doesn't work.

---

_Verified: 2026-04-28T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
