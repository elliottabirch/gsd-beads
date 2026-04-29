# Phase 4 Plan Check (iteration 2)

**Verified:** 2026-04-29 (revision pass)
**Plans checked:** 4 (04-01 sentinel-hierarchy, 04-02 shadow-integration, 04-03 parity-harness, 04-04 milestone-scoping)
**Iteration-1 findings:** 1 BLOCKER + 4 WARNINGS
**Verdict:** PLANS VERIFIED — all 5 iteration-1 findings closed; no regressions detected.

---

## Per-Issue Status

| ID | Issue (iteration 1) | Status | Evidence in revised plans |
|----|---------------------|--------|---------------------------|
| BLOCKER-1 | Plan 02 catch lacked explicit `return;` after `spawnUpstream(argv)`; CASE 6 only asserted exit | **RESOLVED** | Plan 02 Task 1(f) action lines 304-308 add `return;` with rationale comment; done step line 345 adds `grep -A2 'spawnUpstream(argv);' \| grep -q 'return;'` gate; Task 3 CASE 6 (lines 547-551) now asserts BOTH `assert.notEqual(result.status, 0, …)` AND `assert.match(result.stderr, /\[gsd-sdk-shadow\] dispatch failed/, …)` |
| WARN-1 | Plan 04 Task 1 verify mutated live `.planning/STATE.md` | **RESOLVED** | Plan 04 Task 1 verify (line 286) wraps the smoke check in `d=$(mktemp -d) && ( cd "$d" && git init -q … GSD_MILESTONE=v-test bash "$REPO_ROOT/scripts/regen-state.sh" && grep -q "Current milestone: v-test" .planning/STATE.md ) && rm -rf "$d"`; done step (line 293) explicitly forbids regression to a `$PWD`-mutating verify |
| WARN-2 | Plan 01 had no in-Phase-4 test for `bin/bd-helper.mjs` | **RESOLVED** | Plan 01 adds Task 4 (`tests/shadow-tests/bd-helper.test.mjs`) with 4 cases (ENOENT → BeadsNotInstalled, version-mismatch stderr → sentinel subtype, corrupt-store metadata.json stderr → BeadsCorrupt, successful JSON return). PATH-injected bash shim helper `withMockBd` with chmod 755 + finally-restore PATH. Wave 1 (parallel-safe; explicit comment at lines 464-465). bd-helper.test.mjs added to `files_modified` and to `tests/shadow-tests/bd-helper.test.mjs` artifact entry. Threat model row T-04-21 covers PATH-injection leakage. |
| WARN-3 | Plan 03 Task 3 CASE 1 was tautological (allowlist grep against the file that defines it) | **RESOLVED** | Plan 03 Task 3 adds CASE 2: copies `hooks/bd-sync.sh` to `mktemp -d`, uses `awk -v canon=… 'index($0, canon) > 0 { print "  TAMPERED_ALLOWLIST=…"; next } { print }'` to overwrite the canonical allowlist line, sanity-checks the tampered copy no longer contains the regex (with explicit failure if so), then asserts `allowlist_present` against the tampered copy returns non-zero. trap cleans up tempdir. Pass/fail uses bash `if` inversion (not `grep -c \| == 0`), avoiding the self-invalidating-grep anti-pattern. Threat model T-04-11 updated. |
| WARN-4 | Plan 04 prose said "share Wave 2" while frontmatter said `wave: 1` | **RESOLVED** | Plan 04 frontmatter unchanged at `wave: 1`; objective prose lines 89-94 corrected to "It runs in parallel with Plans 1 and 3 in Wave 1; Plan 02 is the only Wave 2 plan (it depends on Plan 1). … (WARN-4 fix: prose previously said 'share Wave 2', which contradicted the `wave: 1` frontmatter — the frontmatter is correct)." |

---

## Regression Sweep (iteration 2 only — no new full-dimension run unless something regressed)

| Concern | Result |
|---------|--------|
| Wave correctness | Wave 1 = Plans 01, 03, 04 (each `depends_on: []`); Wave 2 = Plan 02 (`depends_on: [04-01-sentinel-hierarchy]`). Plan 01's new Task 4 file `tests/shadow-tests/bd-helper.test.mjs` does not collide with any other Wave 1 plan's `files_modified`. |
| Plan 01 frontmatter consistency | `files_modified` includes `tests/shadow-tests/bd-helper.test.mjs`; `must_haves.artifacts` adds the new file with `min_lines: 60`; `must_haves.key_links` adds the bd-helper.test → bin/bd-helper.mjs link with named-import pattern. Self-consistent. |
| Plan 02 must_haves alignment with BLOCKER-1 fix | `must_haves.truths` line 24 reframed: "the catch returns immediately after spawnUpstream so the dispatch-failed branch is structurally unreachable for sentinel/bd-CLI errors (independent of spawnUpstream's process.exit side effect)". Matches the `return;` in Task 1(f). The corresponding `key_links` row (lines 45-47) embeds `spawnUpstream(argv); return;` in the `via` description. |
| Plan 03 must_haves alignment with WARN-3 fix | `must_haves.truths` line 28 expanded to mention CASE 2 explicitly. Artifact `min_lines` raised from 30 to 50. Done step asserts `Passed: 2 / 2` (was previously 1/1). |
| Plan 04 must_haves alignment with WARN-1 fix | Done step (line 293) explicitly references the WARN-1 fix and forbids regression. No must_haves change required since the truth is "regen-state.sh writes to .planning/STATE.md atomically" — the verify command is the regression risk, and that risk is now contained. |
| Decision honor | All 18 D-XX still mapped: D-12 now structurally enforced via the `return;` in Plan 02 Task 1(f), not just by spawnUpstream's process.exit side effect. The structural change strengthens D-12, not weakens it. |
| Threat model updates | Plan 01 adds T-04-21 (PATH-injected test shim leakage — mitigated by withMockBd's `finally`-restored PATH and tempdir rmSync). Plan 03 T-04-11 updated to cite CASE 2's tampering self-test as part of the mitigation. Plans 02 and 04 threat models unchanged from iteration 1. |
| VALIDATION.md mapping | 20 rows, all still mapped to task verifications. Note: VALIDATION.md does NOT add a separate row for `bd-helper.test.mjs`; the WARN-2 fix is internal to Plan 01 and the existing row "REQ-QUAL-02 — `bd()` helper that translates failures to sentinels" is now backed by Plan 01 Task 4 instead of being deferred to Phase 5 stub coverage. Plan-checker accepts this without flagging — VALIDATION.md is a contract surface, and `bd-helper.test.mjs` is implementation detail of REQ-QUAL-02 coverage. |
| Cross-plan data contracts | No shared-data-pipeline conflicts; Plans 01-04 share no transformation paths. |
| CLAUDE.md compliance | Project-level CLAUDE.md (`gsd-beads/CLAUDE.md`) only mandates auto-loading of the `spike-findings-gsd-beads` skill; revisions are consistent. Global CLAUDE.md is environment-only (no behavioral directives applicable to plan content). |
| Architectural tier compliance | No RESEARCH.md responsibility map declared at this depth; not applicable. |
| Pattern compliance (Dimension 12) | Plans 01 Task 4 cites `tests/shadow-tests/handler-phase-add.test.mjs` (mkdtempSync + writeFileSync + rmSync + node:test) as the analog — consistent with PATTERNS.md. Plans 02, 03, 04 unchanged from iteration 1's PASS. |
| Research resolution | RESEARCH.md `## Open Questions` section was already RESOLVED in iteration 1; no change. |
| Nyquist (Dimension 8) | Each plan's tasks each have an `<automated>` verify; no watch flags; sampling continuity holds (no 3-task gap). The new Plan 01 Task 4 has its own `<automated>node --test tests/shadow-tests/bd-helper.test.mjs</automated>` (~< 5s). |
| Scope sanity | Plan 01 grew from 3 tasks to 4 tasks (still within the 4-warning / 5-blocker threshold). Other plans unchanged. Plan 01 estimated context still well under 70%. |

---

## Cross-Plan Foundation Audit (deltas from iteration 1)

| Phase 5+ need | Phase 4 provides | Iteration 2 status |
|---------------|------------------|--------------------|
| `bd()` helper that translates failures to sentinels | `bin/bd-helper.mjs` (Plan 01 Task 3) + dedicated unit test (Plan 01 Task 4 — WARN-2 follow-up) | UPGRADED — direct in-Phase-4 unit coverage closes the Phase 5+ regression-discovery gap |
| Hook-allowlist guard | `bd-allowlist-grep.test.sh` CASE 1 (presence) + CASE 2 (tampered counter-test — WARN-3 follow-up) | UPGRADED — CASE 1 is no longer tautological |
| Read-shaped dispatch fall-through (D-12) | Plan 02 Task 1(f) try/catch with explicit `return;` (BLOCKER-1 fix) | UPGRADED — structural correctness independent of spawnUpstream's side effect |
| Worktree-scoped STATE.md substrate | `scripts/regen-state.sh` (Plan 04 Task 1, smoke-tested in tempdir per WARN-1 fix) | UPGRADED — verify command no longer mutates live `.planning/STATE.md` |

All other rows from iteration 1's foundation audit unchanged.

---

## Decision Coverage (final)

18/18 D-XX still covered. D-12 (dispatcher catches sentinel + bd-CLI errors) is now structurally enforced via the `return;` in Plan 02 Task 1(f) — strengthening, not weakening, the contract.

---

## Recommendation

All 5 iteration-1 findings are closed by the planner's revisions. The plan set is executable as-revised. Proceed to `/gsd-execute-phase 4`.
