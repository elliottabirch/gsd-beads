---
phase: 6
slug: cleanup-adapter-library-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` (Node 20+; `engines.node >= 20`) |
| **Config file** | none — `node --test <dir>` driven by `package.json#scripts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds (unit + conformance; conformance is empty Phase 6) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

> Filled by planner — every task gets a row mapping it to a Wave 0 test.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-XX-XX | XX | N | CLEAN-/ARCH-/DOC-/TEST-XX | — | N/A | structural / property / smoke | `node --test tests/unit/<file>.test.mjs` | ✅ / ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

New test files Phase 6 must create:

- [ ] `tests/unit/structural-cleanup.test.mjs` — covers CLEAN-01..04 (file-existence + REQUIREMENTS.md grep)
- [ ] `tests/unit/structural-imports.test.mjs` — covers ARCH-01, ARCH-02 (import resolves)
- [ ] `tests/unit/format-phase.test.mjs` — covers ARCH-03 (round-trip per fixture)
- [ ] `tests/unit/fixtures/phase-format/` — fixture files per RESEARCH §2 table
- [ ] `tests/unit/adapter-shell.test.mjs` — covers ARCH-04 (constructor, capabilities, stub-throw)
- [ ] `tests/unit/package-json-shape.test.mjs` — covers ARCH-05 (parse + assert structure)
- [ ] `tests/unit/docs-content.test.mjs` — covers DOC-01, DOC-02 (grep assertions)

Existing test files migrated (TEST-01):

- [ ] `tests/unit/bd-helper.test.mjs` (re-import from `src/bd/helper.mjs`)
- [ ] `tests/unit/beads-errors.test.mjs` (re-import from `src/bd/errors.mjs`)
- [ ] `tests/unit/findBeadsRoot.test.mjs` (re-import from `src/bd/findRoot.mjs`)
- [ ] `tests/unit/helpers-parsePhaseId.test.mjs` (re-import from `src/helpers/`)
- [ ] `tests/unit/helpers-deriveDiskStatus.test.mjs` (idem)
- [ ] `tests/unit/helpers-detectDrift.test.mjs` (idem)
- [ ] `tests/unit/helpers-loadMilestoneHeading.test.mjs` (idem)
- [ ] `tests/unit/milestone-scoping.test.mjs`
- [ ] `tests/unit/seed-determinism.test.sh` (CONF-03 byte-identity invariant)
- [ ] `tests/unit/memories-seeded.test.mjs`

Framework install: **none needed** — Node 20+ ships with `node:test` and `node:assert/strict`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Documentation prose quality (README clarity, CLAUDE.md updates) | DOC-01, DOC-02 | Subjective readability | Author + plan-checker review the prose; structural grep covers presence-of-keywords. |

*Most phase behaviors have automated verification via `tests/unit/`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
