---
phase: 07-capabilities-flag-bin-a-primitives-foundational-primitives
verified: 2026-05-01T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "All 10 Bin A primitives are implemented per SYNTHESIS.md §4 Bin A signatures and behaviour is verified by adapter unit tests on tests/fixtures/seed.jsonl (Must-have 2 / PRIM-01)."
    status: partial
    reason: |
      The 10 method signatures exist and pass happy-path conformance + smoke
      tests on the seed fixture, but two contract violations are present in
      the implementation that the test suite does not exercise:
      (a) CR-01 — `_abs(adapter, path)` accepts absolute paths and `..`
          escapes, breaking the documented D-02 "repo-relative paths
          everywhere" contract at runtime.
      (b) CR-02 — `putRecord`/`removeRecord` on `tier === 'hybrid'`
          (named-doc) paths fall through to disk-only writes, bypassing
          the D-10 dual-write contract that `putNamedDoc` enforces.
    artifacts:
      - path: "src/adapter/primitives.mjs"
        issue: "_abs() at line 64-66 has no path-traversal guard; putRecord/removeRecord at lines 104-133 do not branch on tier === 'hybrid'."
      - path: "tests/conformance/binA-records.test.mjs"
        issue: "No negative test for putRecord('/abs/path', body) or putRecord('../../etc/passwd', body); no test that putRecord('.planning/intel/foo.md', body) writes BOTH disk and bd memory index."
    missing:
      - "Centralize a path guard in `_abs(adapter, path)` (or per-primitive entry validation) that throws TypeError on absolute paths or paths that resolve outside `projectRoot`. CR-01 fix."
      - "Add a `tier === 'hybrid' && kind === 'namedDoc'` branch in putRecord and removeRecord that delegates to putNamedDoc / (forthcoming) removeNamedDoc, OR throws a redirect error pointing callers at the domain method. CR-02 fix."
      - "Add conformance tests covering both (a) absolute/`..`-escape rejection on putRecord/getRecord/removeRecord and (b) putRecord('.planning/intel/foo.md', body) producing both the disk file and the gsd-beads:named-doc:intel:foo memory entry."
    note: |
      Plan 04 frontmatter §threats explicitly accepts T-7-01 (path
      traversal) as low-risk for the v1.0 single-developer / single-
      process model and defers a `startsWith(projectRoot)` guard to v1.1.
      That justification only addresses CR-01. CR-02 is NOT documented
      in the plan; it is a real gap between the closed-enum router (which
      tags namedDoc paths `tier: 'hybrid'`) and primitives.mjs (which
      treats every non-`bd` tier as disk-only).
    suggested_override: |
      If the team accepts CR-01 per Plan 04's documented threat model AND
      reframes CR-02 as a "callers must use putNamedDoc for hybrid paths"
      contract (which Plan 04 implies but doesn't enforce), an override
      could carry this must-have past the gate. Recommended override
      payload:

      ```yaml
      overrides:
        - must_have: "All 10 Bin A primitives are implemented per SYNTHESIS.md §4 Bin A signatures and behaviour is verified by adapter unit tests on tests/fixtures/seed.jsonl (Must-have 2 / PRIM-01)."
          reason: |
            CR-01 path-traversal accepted per Plan 04 frontmatter T-7-01
            (single-developer / single-process consumer model; v1.1 will
            add startsWith guard). CR-02 hybrid-tier disk-fallthrough
            documented in primitives.mjs comment "namedDoc 'hybrid'
            read-side"; consumers MUST use putNamedDoc for hybrid writes.
          accepted_by: "<reviewer>"
          accepted_at: "<ISO timestamp>"
      ```

      WITHOUT the override, this must-have is `partial` — implementation
      and signatures are present, contract enforcement is not.
human_verification: []
---

# Phase 7: Capabilities flag + Bin A primitives + foundational primitives — Verification Report

**Phase Goal:** The BeadsAdapter contract surface is complete — 10 generic CRUD primitives + 6 foundational primitives + a static `capabilities` flag — backing every domain method that follows. Conformance scaffolding exists for cross-adapter parity testing.

**Verified:** 2026-05-01
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `BeadsAdapter.capabilities` is a static frozen 7-key object (record/section/binaryAsset/snapshot/transaction/namedDoc/commitPlanningState) with rationale comments for each `false` value, readable without constructing the adapter against a beads-managed project. | ✓ VERIFIED | `src/adapter.mjs:53-81` defines `Object.freeze({...})` with the required 7 keys and concrete booleans (record:true, section:true, binaryAsset:false, snapshot:true, transaction:false, namedDoc:true, commitPlanningState:false). `tests/conformance/capabilities.test.mjs` confirms (a) frozen-shape equality, (b) rationale-comment lint on each `false` flag (must contain "UNSUPPORTED" within 5 preceding lines), (c) standalone read works (no `_ensureBd` invoked). All 4 capability tests pass. |
| 2 | All 10 Bin A primitives (`getRecord`, `putRecord`, `removeRecord`, `listCollection`, `exists`, `getSection`, `updateSection`, `getFrontmatter`, `updateFrontmatter`, `mergeFrontmatter`) are implemented per SYNTHESIS.md §4 Bin A signatures, behaviour verified by adapter unit tests on tests/fixtures/seed.jsonl. | ✗ FAILED (PARTIAL) | All 10 methods are present in `src/adapter/primitives.mjs` (lines 73-346) and pass conformance tests (binA-records / binA-section / binA-frontmatter — 17 tests green). HOWEVER two contract-level BLOCKERs from `07-REVIEW.md` violate the implicit "behaviour" portion of this must-have: **CR-01** (path-traversal in `_abs()`: absolute and `..`-escape paths silently route outside `projectRoot`, breaking D-02) and **CR-02** (`putRecord`/`removeRecord` on `tier: 'hybrid'` paths bypass D-10 dual-write). See "Gaps" below for fix paths. |
| 3 | The 6 foundational primitives (`updateSection`, `getSection`, `recordStateEvent`, `snapshot`/`restore`, `putNamedDoc`/`getNamedDoc`, `writeBinaryAsset`) are implemented; `recordStateEvent` dispatches on discriminated-union type; `writeBinaryAsset` throws `UnsupportedOperationError` consistent with `capabilities.binaryAsset = false`. | ✓ VERIFIED | All 6 implemented in `src/adapter/primitives.mjs` (lines 366-588). `recordStateEvent` dispatches over `MEMORY_EVENT_TYPES` (7 types → bd memory) vs `COMMENT_EVENT_TYPES` (3 types → bd comment with `--author gsd:event:<type>`). `writeBinaryAsset` throws `UnsupportedOperationError` with locked D-16 message format. Conformance tests pass: events × 12, namedDoc × 22, snapshot/restore × 8 (including binaryAsset rejection × 2). |
| 4 | `tests/conformance/` directory exists with adapter-shape tests runnable against the BeadsAdapter standalone using tests/fixtures/seed.jsonl; harness structured for future cross-adapter parity (CONF-01). | ✓ VERIFIED | `tests/conformance/` contains 7 test files + `run.mjs` driver + `fixture.mjs` setup. Driver structure: `factories = [{label: 'beads', factory: ...}]` with `RUN_CROSS_ADAPTER=1` toggle reserved for Phase 13 (currently throws to enforce the boundary). `runConformance(makeAdapter, label)` exported by every test file. `npm run test:conformance` runs 71 tests green against `tests/fixtures/seed.jsonl` via `setupFreshAdapter`. |
| 5 | Round-trip property tests for `src/format/phase.mjs` pass for all canonical inputs — `parsePhaseTitle(formatPhaseTitle(x)) === x` and `parsePhaseDescription(formatPhaseDescription(x)) === x`. | ✓ VERIFIED | `src/format/phase.mjs` exports the 4 named functions. `tests/unit/format-phase.test.mjs` runs 4 title-shape tests + 11 round-trip-idempotent fixture tests (decimal-72-1, depends-nothing, empty-success, multiline-goal, no-plans-section, phase-1-spike, phase-13-final, phase-2-build, phase-5-roadmap, phase-6-cleanup, requirements-tbd) — all green. Plan 10 frontmatter documents the CONF-02 audit confirming the 11 fixtures cover all four ROADMAP §SC#5 categories. |

**Score:** 4/5 truths VERIFIED (1 partial / failed).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/adapter.mjs` | BeadsAdapter class + frozen capabilities flag + Object.assign cluster bindings | ✓ VERIFIED | 96 LoC; class at line 21, capabilities at line 53 (frozen), Object.assign at line 84. Imports 8 cluster modules. |
| `src/adapter/primitives.mjs` | 10 Bin A + 6 foundational implementations | ⚠️ ORPHANED-CONTRACT | 648 LoC; all 16 methods present and exported via the cluster default-export. Substantive (not stubs). Wired (Object.assign in adapter.mjs). BUT contract violations CR-01 + CR-02 mean two of the 10 Bin A methods (`putRecord`, `removeRecord`) silently bypass two documented contracts (D-02 path-safety, D-10 dual-write). Code smell: 2 BLOCKERs from `07-REVIEW.md`. |
| `src/adapter/pathRouter.mjs` | Closed-enum routing registry | ✓ VERIFIED | 97 LoC; 7 patterns including the `tier: 'hybrid'` branch for `.planning/<category>/<key>.md`. Pure function — no I/O. NAMED_DOC_CATEGORIES exported as a frozen 9-element allowlist. Unit tests at `tests/unit/pathRouter.test.mjs` pass. |
| `src/adapter/_atomicWrite.mjs` | tmpfile + POSIX rename | ✓ VERIFIED | atomicWriteFile is the POSIX-rename primitive used by 5 disk-write paths; unit tests at `tests/unit/atomicWrite.test.mjs` pass. (Note: WR-05 flagged a tmpfile-name race — warning, not blocker.) |
| `src/format/section.mjs` | slugify + locateSection + rewriteSection | ✓ VERIFIED | Imported by primitives.mjs (getSection / updateSection). Unit tests at `tests/unit/format-section.test.mjs` pass. |
| `src/format/frontmatter.mjs` | flat-scalar parser/formatter/merger | ✓ VERIFIED | Imported by primitives.mjs. (Note: WR-02/WR-03 flag round-trip fragility for values with `:`/quotes/empty — warnings, not blockers; round-trip on the 11 phase-format fixtures still passes.) |
| `src/format/phase.mjs` | parsePhaseTitle / formatPhaseTitle / parsePhaseDescription / formatPhaseDescription | ✓ VERIFIED | 250 LoC; 4 named exports per ARCH-03 / D-14. Implements TITLE_RE + LABEL_RE + TAIL_RE patterns. |
| `src/bd/errors.mjs` | UnsupportedOperationError class | ✓ VERIFIED | Imported by primitives.mjs writeBinaryAsset; locked D-16 message format verified by `tests/conformance/capabilities.test.mjs`. |
| `tests/conformance/run.mjs` | Driver wiring 7 conformance files into FILES list | ✓ VERIFIED | FILES list contains exactly 7 entries (capabilities + 3 binA + 3 foundational). `RUN_CROSS_ADAPTER=1` reserved for Phase 13. |
| `tests/conformance/fixture.mjs` | setupFreshAdapter(t, kind) — bd init from seed.jsonl + chmod 0o700 + cleanup | ✓ VERIFIED | Implements per-test mkdtempSync + git init + bd init --from-jsonl --prefix sd + chmodSync(.beads, 0o700) + t.after cleanup. Pitfall 6 + Pitfall 8 (BEADS_ACTOR=seed) honored. |
| `tests/conformance/capabilities.test.mjs` | CAP-01 conformance | ✓ VERIFIED | 4 tests: shape equality, rationale-lint, throw-shape on writeBinaryAsset (×2). |
| `tests/conformance/binA-*.test.mjs` (×3) | PRIM-01 conformance | ✓ VERIFIED | 17 tests across records / section / frontmatter. NB: NO negative tests for absolute-path / `..`-escape rejection; NO test of putRecord on hybrid-tier paths. (See Gaps.) |
| `tests/conformance/foundational-*.test.mjs` (×3) | PRIM-02 conformance | ✓ VERIFIED | 42 tests across events (12), namedDoc (22), snapshot/restore (8). |
| `tests/unit/format-phase.test.mjs` | CONF-02 round-trip property tests | ✓ VERIFIED | 4 title-tests + 11 fixture round-trip tests. |
| `tests/unit/fixtures/phase-format/*.md` | 11 ARCH-03 fixtures | ✓ VERIFIED | 11 fixtures in directory: decimal-72-1, depends-nothing, empty-success, multiline-goal, no-plans-section, phase-1-spike, phase-13-final, phase-2-build, phase-5-roadmap, phase-6-cleanup, requirements-tbd. |
| `tests/fixtures/seed.jsonl` | enriched seed (gsd:milestone + version:v1.0) | ✓ VERIFIED | 41 lines; contains v1.0 milestone bead used by the foundational-events conformance tests. *Caveat:* `git status` shows seed.jsonl as `M` (modified, uncommitted) — parent-orchestrator should confirm before/after fixes that the committed seed matches what `build-seed.sh` produces. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `BeadsAdapter` (`src/adapter.mjs`) | `primitives.mjs` cluster | `Object.assign(BeadsAdapter.prototype, primitives, ...)` line 84 | ✓ WIRED | All 16 method names from primitives default-export are bound to the prototype; verified by `tests/unit/adapter-shell.test.mjs`. |
| `primitives.mjs::*` (every method) | `pathRouter.resolve(path)` | `import { resolve as routerResolve } from './pathRouter.mjs'` + first-line `const route = routerResolve(path)` | ✓ WIRED | Every public Bin A primitive opens with `const route = routerResolve(path)` per D-01. |
| `primitives.mjs::*` (write paths) | `_atomicWrite.atomicWriteFile` | `import { atomicWriteFile }` + 5 call sites | ✓ WIRED | putRecord, updateSection, updateFrontmatter, mergeFrontmatter, putNamedDoc all atomic-write through the primitive. |
| `primitives.mjs::recordStateEvent` | `bd remember --key` (memory branch) and `bd comments add --author` (comment branch) | `bd(['remember', JSON.stringify(payload), '--key', key], {cwd: this._beadsRoot, env: BEADS_ACTOR=seed, parseJson: false})` and analogous for comments | ✓ WIRED | Discriminated-union dispatch over `MEMORY_EVENT_TYPES` × 7 / `COMMENT_EVENT_TYPES` × 3; default branch throws on unknown. Conformance tests `foundational-events.test.mjs` confirm the 7+3+1 dispatches plus `_resolveMilestoneBead` against the seed's v1.0 milestone bead. |
| `primitives.mjs::putNamedDoc` | bd memory index `gsd-beads:named-doc:<category>:<key>` | `bd(['remember', JSON.stringify(index), '--key', memKey], ...)` | ✓ WIRED | D-10 dual-write happens via `putNamedDoc` directly. (NB: `putRecord` on the same hybrid path bypasses this — see CR-02 / Gaps.) |
| `tests/conformance/run.mjs` | each `runConformance` export | `await import(file)` then `runConformance(factory.factory, factory.label)` | ✓ WIRED | Driver invokes 7 files × 1 factory = 7 suites = 71 tests. |
| `BeadsAdapter` capabilities flag | static read by consumer (no constructor required) | `BeadsAdapter.capabilities` static property | ✓ WIRED | `tests/conformance/capabilities.test.mjs::CAP-01 shape` reads the flag without invoking `new BeadsAdapter(...)`; lint test reads `src/adapter.mjs` source for rationale comments. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `tests/conformance/foundational-events.test.mjs::recordStateEvent type=session` | bd comment author | `bd comments` against fixture milestone bead | ✓ Yes — milestone bead seeded in `tests/fixtures/seed.jsonl` (gsd:milestone + version:v1.0) | ✓ FLOWING |
| `tests/conformance/foundational-namedDoc.test.mjs::putNamedDoc` | bd memory index | `bd remember --key gsd-beads:named-doc:<cat>:<key>` | ✓ Yes — verified by `bd recall` against the same key | ✓ FLOWING |
| `tests/conformance/foundational-snapshot.test.mjs::snapshot` | tmpfile path | `bd export --json -o <path>` | ✓ Yes — JSONL byte-validated + memory-presence asserted | ✓ FLOWING |
| `tests/conformance/binA-records.test.mjs::putRecord` (hybrid path) | NOT TESTED | `putRecord('.planning/intel/foo.md', body)` | ✗ NO — hybrid-tier write writes disk only, the bd memory index entry is missing | ⚠️ HOLLOW (untested gap; CR-02) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All conformance tests pass on seed.jsonl | `npm run test:conformance` | 71/71 tests pass, 0 fail, 38.6s | ✓ PASS |
| All unit tests pass (179 tests) | `npm run test:unit` | 179/179 tests pass, 0 fail, 172s | ✓ PASS |
| Capabilities flag is statically readable without bd | `node -e "import('./src/adapter.mjs').then(m => console.log(Object.keys(m.BeadsAdapter.capabilities).length))"` | Prints `7` | ✓ PASS |
| Path-traversal demonstrability (CR-01) | `node -e "console.log(require('node:path').resolve('/tmp/proj', '/etc/passwd'))"` | Prints `/etc/passwd` (the second arg replaces the first when absolute) | ✗ FAIL — confirms `_abs()` is a path-traversal primitive with no runtime guard |
| Hybrid-tier dispatch in primitives.mjs (CR-02) | `grep -n "tier === 'hybrid'" src/adapter/primitives.mjs` | Returns no match (only references in comments) | ✗ FAIL — confirms putRecord/removeRecord do not branch on hybrid tier |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAP-01 | 07-08-PLAN.md | Adapter capabilities flag — frozen 7-key shape per D-2026-04-30-05 | ✓ SATISFIED | `BeadsAdapter.capabilities` frozen object + 4 conformance tests in `capabilities.test.mjs`. |
| PRIM-01 | 07-04 + 07-05 + 07-09 + 07-01 + 07-02 + 07-03 | 10 Bin A generic CRUD methods | ⚠️ PARTIAL | 10 methods exist with happy-path coverage, but CR-01 + CR-02 violate D-02 / D-10 contracts respectively. |
| PRIM-02 | 07-06 + 07-07 + 07-10 | 6 foundational primitives | ✓ SATISFIED | All 6 implemented; 42 conformance tests green. |
| CONF-01 | 07-09 + 07-10 | Conformance scaffolding (Phase 7) + cross-adapter ready (Phase 13) | ✓ SATISFIED | `tests/conformance/` × 7 files + driver + fixture. |
| CONF-02 | 07-10 | Round-trip property tests for src/format/phase.mjs | ✓ SATISFIED | 11 fixture round-trip + title round-trip pass; CONF-02 audit documented in 07-10-SUMMARY frontmatter. |

ORPHANED requirements: NONE. Every Phase 7 requirement ID (CAP-01, PRIM-01, PRIM-02, CONF-01, CONF-02) is claimed by at least one plan in the phase.

### Anti-Patterns Found

Detection limited to scope of Phase 7 modifications. Source: `07-REVIEW.md` (already-completed code review at depth=standard, 28 files reviewed).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/adapter/primitives.mjs` | 64-66 (`_abs`) | Path-resolve without traversal guard | 🛑 BLOCKER (CR-01) | `putRecord('/etc/passwd', body)` writes `/etc/passwd`; every read primitive can exfiltrate files outside projectRoot. Plan 04 documents this as `accept (low-risk)` for v1.0 single-developer model — accepted-risk decision but visible in conformance behaviour. |
| `src/adapter/primitives.mjs` | 104-119, 121-133 | `putRecord` / `removeRecord` only branch on `tier === 'bd'` — `tier === 'hybrid'` falls through to disk-only path | 🛑 BLOCKER (CR-02) | `putRecord('.planning/intel/foo.md', body)` writes the disk file but skips the `gsd-beads:named-doc:intel:foo` memory entry; D-10 dual-write contract broken for the generic surface. |
| `src/adapter/primitives.mjs` | 480-482 | `restore()` hardcodes `--prefix 'sd'` | ⚠️ WARNING (WR-04) | Restore breaks for non-`sd-` prefixed snapshots. |
| `src/adapter/primitives.mjs` | 632-647 | `_resolveMilestoneBead` doc claims "most recently updated open milestone" but no sort/filter | ⚠️ WARNING (WR-01) | Misleading comment; first-bd-list-result returned. Works by accident on single-milestone fixture. |
| `src/adapter/primitives.mjs` | 366-420 | `_resolveMilestoneBead` not validating payload.milestone for COMMENT_EVENT_TYPES | ⚠️ WARNING (WR-06) | Session events without payload.milestone silently land on first bd-list result. |
| `src/format/frontmatter.mjs` | 79-94 | `formatFrontmatter` no escaping for YAML-significant chars | ⚠️ WARNING (WR-02) | Round-trip-lossy for values with `:`/quotes/newlines; phase-7 happy path unaffected. |
| `src/format/frontmatter.mjs` | 43-53 | `parseFrontmatter` empty-value `key:` always becomes `[]` | ⚠️ WARNING (WR-03) | Empty-string scalars cannot round-trip; observable when updateFrontmatter('foo.md', 'k', '') then getFrontmatter returns `[]`. |
| `src/adapter/_atomicWrite.mjs` | 23-26 | tmpfile name `${pid}.${Date.now()}` — ms resolution | ⚠️ WARNING (WR-05) | Concurrent writes within ≤1ms can write same tmpfile name; phase-7 sequential test path unaffected. |
| `src/bd/helper.mjs` | 43-56 | JSONL fallback masks malformed JSON as empty array | ⚠️ WARNING (WR-07) | Defensive issue; bd is unlikely to emit empty stdout. |
| `src/adapter/primitives.mjs` | 135-173 | `listCollection` on bd singleton path silently returns `[]` | ⚠️ WARNING (WR-08) | Misroute (`listCollection('.planning/ROADMAP.md')`) returns empty rather than erroring. |
| `src/format/section.mjs` | 51-77 | `.filter(Boolean)` collapses skipped heading levels | ⚠️ WARNING (WR-09) | Two anchors can resolve to same section; phase-7 well-formed docs unaffected. |
| `src/adapter/primitives.mjs` | 582-588 | `writeBinaryAsset(path, bytes)` — params declared but unused | ⚠️ WARNING (WR-10) | Wrong-arity calls indistinguishable from feature-flag-off; cosmetic. |
| `src/adapter/primitives.mjs` | 610-622 | `_labelsToFrontmatter` `id`/`status` silently shadowed by labels | ⚠️ WARNING (WR-11) | Documented behavior in test but not in helper docstring. |

### Human Verification Required

None. All goal-relevant behavior is verifiable via existing test suite + grep checks. The 2 BLOCKERs (CR-01, CR-02) are programmatically demonstrable.

### Gaps Summary

Phase 7 ships a complete **shape**: capabilities flag is correct, all 16 methods (10 Bin A + 6 foundational) exist with non-stub implementations, the closed-enum router is exported, conformance harness runs 71 tests green, format-phase round-trips on 11 fixtures, all 5 phase requirement IDs (CAP-01, PRIM-01, PRIM-02, CONF-01, CONF-02) have at least one passing test.

The phase falls short of "implemented per SYNTHESIS.md §4 Bin A signatures **and behaviour verified**" (Must-have 2) on two real contract violations that the conformance suite does not exercise:

1. **CR-01 — Path-traversal primitive in `_abs()`**. Documented by Plan 04's threat-model frontmatter as `accept (low-risk)` for the v1.0 consumer model. Whether to treat this as a real gap depends on whether the team accepts that documented decision. If so, it should be closed by an explicit `overrides:` entry in this VERIFICATION.md frontmatter (template included in `gaps[0].suggested_override`).

2. **CR-02 — `putRecord`/`removeRecord` bypass D-10 dual-write on hybrid-tier paths**. NOT documented as accepted in any plan. The `pathRouter.resolve('.planning/intel/foo.md')` returns `tier: 'hybrid'` but `primitives.mjs::putRecord` only branches on `tier === 'bd'` — every other tier (including `'hybrid'`) writes disk only. Phase 9 aggregation logic that walks the `gsd-beads:named-doc:*` memory index will silently miss any docs written via the generic `putRecord` rather than `putNamedDoc`. This is a real gap.

**Recommended next step:** A small Plan 11 (gap-closure) that adds (a) traversal guard in `_abs()` plus (b) hybrid-tier delegation in putRecord/removeRecord, with (c) two negative conformance tests (`putRecord('/abs/path', ...)` rejects, `putRecord('.planning/intel/foo.md', body)` writes both disk and memory). Estimated 30-45 min implementation; 4 lines of production code + ~30 lines of test.

If CR-01 is accepted per Plan 04 documentation, the override block in `gaps[0].suggested_override` collapses this to a 1-gap closure (CR-02 only).

The 11 WARNINGs are out of scope for must-have verification — they are quality issues that should be triaged into a backlog or into Phase 8+ as opportunistic cleanup.

---

_Verified: 2026-05-01_
_Verifier: Claude Opus 4.7 (gsd-verifier)_
