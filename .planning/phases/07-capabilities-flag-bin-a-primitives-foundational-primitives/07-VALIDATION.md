---
phase: 7
slug: capabilities-flag-bin-a-primitives-foundational-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 24.14.0 built-in) |
| **Config file** | none — invoked via `node --test <pattern>` |
| **Quick run command** | `npm run test:conformance` (already declared in package.json: `node --test 'tests/conformance/**/*.test.mjs'`) |
| **Full suite command** | `npm test` (runs `tests/unit/**` + `tests/conformance/**`) |
| **Estimated runtime** | ~3-5s on a hot bd; ~6-10s with `bd init --from-jsonl` per test (each conformance file independently runnable) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:conformance`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-* | 01-pathRouter-helper | 1 | PRIM-01 | — | path resolution does not leak outside projectRoot | unit (conformance) | `node --test tests/conformance/binA-records.test.mjs` | ❌ W0 | ⬜ pending |
| 07-02-* | 02-binA-records | 2 | PRIM-01 | — | reads/writes of bd-routed paths use ≤2 bd spawns per call | unit (conformance) | same | ❌ W0 | ⬜ pending |
| 07-03-* | 03-binA-section | 2 | PRIM-01, PRIM-02 | — | atomic file replace via tmpfile + rename for OQ-09 three-author concurrency | unit (conformance) | `node --test tests/conformance/binA-section.test.mjs` | ❌ W0 | ⬜ pending |
| 07-04-* | 04-binA-frontmatter | 2 | PRIM-01 | — | bd label add/remove preserves non-target labels | unit (conformance) | `node --test tests/conformance/binA-frontmatter.test.mjs` | ❌ W0 | ⬜ pending |
| 07-05-* | 05-foundational-events | 3 | PRIM-02 | — | recordStateEvent storage shape is the locked write+read contract for Phase 9 | unit (conformance) | `node --test tests/conformance/foundational-events.test.mjs` | ❌ W0 | ⬜ pending |
| 07-06-* | 06-foundational-namedDoc | 3 | PRIM-02 | — | writes BOTH disk + bd memory index | unit (conformance) | `node --test tests/conformance/foundational-namedDoc.test.mjs` | ❌ W0 | ⬜ pending |
| 07-07-* | 07-foundational-snapshot | 3 | PRIM-02 | — | snapshot → mutate → restore round-trips bd issues + memories + comments byte-for-content | unit (conformance) | `node --test tests/conformance/foundational-snapshot.test.mjs` | ❌ W0 | ⬜ pending |
| 07-08-* | 08-capabilities-finalize | 4 | CAP-01, PRIM-02 | — | flag shape exactly 7 keys; writeBinaryAsset throws UnsupportedOperationError | unit (conformance) | `node --test tests/conformance/capabilities.test.mjs` | ❌ W0 | ⬜ pending |
| 07-09-* | 09-conformance-driver | 4 | CONF-01 | — | RUN_CROSS_ADAPTER=1 toggle is wired without fork dep | structure-only / grep-test | grep `RUN_CROSS_ADAPTER` in `tests/conformance/run.mjs` | ❌ W0 | ⬜ pending |
| 07-10-* | 10-format-phase-coverage | 4 | CONF-02 | — | parsePhase{Title,Description}/formatPhase{Title,Description} round-trip on all canonical inputs | unit | `node --test tests/unit/format-phase.test.mjs` | ✅ Phase 6 (audit + extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Wave numbering tentative — plan-phase decides exact wave assignment based on dependency analysis.*

---

## Wave 0 Requirements

The following test-infrastructure files do not exist yet and must be created
before or during the wave that produces the corresponding implementation:

- [ ] `tests/conformance/run.mjs` — driver invokes each `runConformance` export with the BeadsAdapter factory; gates `RUN_CROSS_ADAPTER=1` for the future MarkdownAdapter pairing
- [ ] `tests/conformance/fixture.mjs` — `setupFreshAdapter(t, kind)` returns `{adapter, projectRoot}`; uses `mkdtempSync` + `t.after()` cleanup; clones `tests/fixtures/seed.jsonl` into the tmp dir per-test
- [ ] `tests/conformance/binA-records.test.mjs` — exports `runConformance(makeAdapter, label)`; covers `getRecord`, `putRecord`, `removeRecord`, `exists`, `listCollection`
- [ ] `tests/conformance/binA-section.test.mjs` — covers `getSection`, `updateSection × 3 modes`, with path-slug addressing examples
- [ ] `tests/conformance/binA-frontmatter.test.mjs` — covers `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter` on BOTH bd-routed (label synthesis) and disk-routed (yaml parse) paths
- [ ] `tests/conformance/foundational-events.test.mjs` — write-then-read for each of 10 `recordStateEvent` types; asserts memory key shape AND comment author shape per D-09
- [ ] `tests/conformance/foundational-namedDoc.test.mjs` — `putNamedDoc` per category, `getNamedDoc`, mem-index assertion (`gsd-beads:named-doc:<category>:<key>` exists)
- [ ] `tests/conformance/foundational-snapshot.test.mjs` — snapshot → mutate → restore → re-read (issues + memories + comments)
- [ ] `tests/conformance/capabilities.test.mjs` — flag shape lint, JSDoc rationale lint on `false` values, `writeBinaryAsset` throw assertion
- [ ] `tests/fixtures/seed.jsonl` enrichment via `tests/fixtures/build-seed.sh` — Phase 7 adds whatever records are needed for primitive conformance (per-test mutators handle the rest); `BEADS_ACTOR=seed` discipline preserved; CONF-03 byte-identity invariant must hold

*Existing infrastructure (Phase 6 Wave 0): `tests/unit/{bd-helper,beads-errors,findBeadsRoot,format-phase,helpers-*}.test.mjs` already covers regression for the helpers Phase 7 imports. No new unit tests required for Phase 7 — conformance is the layer.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-adapter parity (BeadsAdapter ↔ MarkdownAdapter) | CONF-01 (scaffolding) | Fork's MarkdownAdapter has not shipped yet — only the harness wiring is verified now; cross-adapter run is Phase 13 | `RUN_CROSS_ADAPTER=1 npm run test:conformance` after the fork is `npm link`-ed; expected: TODO at Phase 13 |
| ROADMAP fixture coverage audit (Phase 7 SC#5) | CONF-02 | Determines whether 11 Phase-6 fixtures cover every "canonical input called out in ROADMAP §Phase 7 SC#5" | Plan-phase enumerates the canonical input list from ROADMAP §"Phase 7 SC#5" wording (single-line goals, multi-line success criteria, empty values, edge cases per ARCH-03 spec); execute-phase audits the fixture set and adds any gap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] D-09 amendment confirmed (comment author "gsd:event:<type>" vs label) before plan ships
- [ ] D-12 storage shape contract is testable today via direct bd reads in conformance

**Approval:** pending
