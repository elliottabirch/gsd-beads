---
phase: 05-roadmap-read-handlers
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/fixtures/build-seed.sh
  - tests/fixtures/seed.jsonl
  - tests/fixtures/memories-seeded.test.mjs
autonomous: true
requirements: [REQ-READ-01]
tags:
  - fixture
  - bd-seed
  - phase-id-labels
  - milestone-memories

key_decisions:
  - "Q4 Option A: Extend build-seed.sh to 11 phases + 24 plan children (research recommendation; investing once pays back in Phases 6-9). The 7-phase keep-as-is option was rejected because SC #2 contract is 'count parity with bd', not '11/24 literal' — but extending now lets later phases reuse the larger fixture without a second migration."
  - "phase-id mapping: P11→01, P12→02, P21→03, P22→04, P23→05, P31→06, P32→07. The 4 new phases extend the v0.2 milestone (already in-progress) to bring v0.2 to 7 phases (matching the v0.2 ROADMAP), giving us 11 total across milestones. Plan children attach to v0.2 phases only."
  - "v0.3 deliberately omits the milestone-heading memory to test the fallback path (D-17). v0.1 and v0.2 memories are seeded."
  - "Plan 01 supplies the phase-id:NN labels + 11-phase / 24-plan fixture that REQ-READ-01 SC #2 validates against (`total_plans == bd count -l gsd:plan` parity needs the substrate)."

must_haves:
  truths:
    - "build-seed.sh emits phase-id:NN labels (01..11) on every phase epic via BEADS_ACTOR=seed"
    - "build-seed.sh emits gsd-beads:milestone:v0.1:heading=Foundation and gsd-beads:milestone:v0.2:heading='Beads-backed reads' memories (v0.3 deliberately omitted to exercise D-17 fallback)"
    - "seed.jsonl is regenerated, contains 11 phase epics + 24 plan children + memory keys, and reseeds byte-identically (seed-determinism.test.sh stays green)"
  artifacts:
    - path: "tests/fixtures/build-seed.sh"
      provides: "Source-of-truth seeder with phase-id:NN labels + milestone-heading memories + plan-children"
      contains: "phase-id:01"
    - path: "tests/fixtures/seed.jsonl"
      provides: "Regenerated canonical bd state"
    - path: "tests/fixtures/memories-seeded.test.mjs"
      provides: "Wave 0 test verifying build-seed.sh emits 3 memory keys"
  key_links:
    - from: "tests/fixtures/build-seed.sh"
      to: "tests/fixtures/seed.jsonl"
      via: "bd export --json -o ..."
      pattern: "bd export --json -o"
    - from: "tests/fixtures/seed.jsonl"
      to: "tests/shadow-tests/seed-determinism.test.sh"
      via: "bd init --from-jsonl byte-identical reseed"
      pattern: "from-jsonl"
---

<objective>
Migrate `tests/fixtures/build-seed.sh` to emit (a) `phase-id:NN` labels on every phase epic per D-03, (b) `gsd-beads:milestone:vX.Y:heading` memories per D-18, and (c) a larger 11-phase / 24-plan fixture per Q4 Option A so SC #2's count-parity assertion has the substrate it requires. Regenerate `seed.jsonl`. Wave 0 test stub `memories-seeded.test.mjs` proves the memory keys land.

Purpose: Phase 5 read handlers cannot lookup phases without `phase-id:NN` labels (D-01/D-02), cannot resolve milestone headings without seeded memory keys (D-15..D-17), and cannot prove SC #2 (`total_plans == bd count -l gsd:plan`) without plan children in the fixture. This plan creates that substrate. **REQ-READ-01 SC #2** validates against the substrate this plan supplies.

Output:
- Edited `tests/fixtures/build-seed.sh` (4 new phases, 24 plan children, 7 `phase-id:NN` labels, 2 `bd remember` invocations)
- Regenerated `tests/fixtures/seed.jsonl` (committed binary diff acceptable)
- New `tests/fixtures/memories-seeded.test.mjs` (Wave 0 stub: red-then-green)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-roadmap-read-handlers/05-CONTEXT.md
@.planning/phases/05-roadmap-read-handlers/05-RESEARCH.md
@.planning/phases/05-roadmap-read-handlers/05-VALIDATION.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-VERIFICATION.md
@tests/fixtures/build-seed.sh
@tests/fixtures/seed.jsonl
@tests/fixtures/seed-fixture.sh
@tests/shadow-tests/seed-determinism.test.sh
@.claude/skills/spike-findings-gsd-beads/SKILL.md

<interfaces>
<!-- Existing build-seed.sh structure (read tests/fixtures/build-seed.sh first) -->
<!-- Pattern to mirror for every new bd call: -->

```bash
PXX=$(BEADS_ACTOR=seed bd q "Phase title" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$PXX" gsd:phase >/dev/null
BEADS_ACTOR=seed bd label add "$PXX" version:vX.Y >/dev/null
# NEW (D-03):
BEADS_ACTOR=seed bd label add "$PXX" phase-id:NN >/dev/null
```

<!-- Plan children pattern (NEW for SC #2): -->
```bash
PLAN_NN_NN=$(BEADS_ACTOR=seed bd q "Phase NN Plan NN" -t task -p 1)
BEADS_ACTOR=seed bd label add "$PLAN_NN_NN" gsd:plan >/dev/null
BEADS_ACTOR=seed bd label add "$PLAN_NN_NN" version:vX.Y >/dev/null
BEADS_ACTOR=seed bd link "$PLAN_NN_NN" "$PXX" --type parent-child >/dev/null
```

<!-- Memory seeding pattern (D-18): -->
```bash
BEADS_ACTOR=seed bd remember 'gsd-beads:milestone:vX.Y:heading' '<heading text>' >/dev/null
```

<!-- Existing seed-determinism.test.sh asserts: -->
<!-- CASE 1: byte-identical bd export across two `bd init --from-jsonl` reseeds -->
<!-- CASE 2: v01=2-closed, v02=3-open, v03=2-open — THIS WILL CHANGE: update CASE 2 expectation OR keep CASE 2 and verify the larger numbers work -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — Write failing memory-seed test stub</name>
  <files>tests/fixtures/memories-seeded.test.mjs</files>
  <read_first>
    - tests/fixtures/build-seed.sh (existing pattern)
    - tests/shadow-tests/seed-determinism.test.sh (test pattern + how it shells out to build-seed)
    - tests/shadow-tests/handler-_phase4-test-stub.test.mjs (per-handler test file convention with t.after() teardown)
  </read_first>
  <behavior>
    - Test 1: After running tests/fixtures/build-seed.sh, `bd memories --json` contains key `gsd-beads:milestone:v0.1:heading` with value `Foundation`
    - Test 2: After running tests/fixtures/build-seed.sh, `bd memories --json` contains key `gsd-beads:milestone:v0.2:heading` with value `Beads-backed reads`
    - Test 3: After running tests/fixtures/build-seed.sh, `bd memories --json` does NOT contain key `gsd-beads:milestone:v0.3:heading` (D-17 fallback exercise)
    - Tests use t.after() teardown (PITFALLS migration recommendation; see milestone-scoping.test.mjs lines 63, 73)
  </behavior>
  <action>
    Create `tests/fixtures/memories-seeded.test.mjs` with 3 cases (D-18 happy path × 2 + D-17 fallback exercise × 1).

    Implementation:
    1. Import `test` from `node:test`, `assert` from `node:assert/strict`, `execSync` from `node:child_process`, `mkdtempSync, rmSync` from `node:fs`, `tmpdir` from `node:os`, `join, dirname` from `node:path`, `fileURLToPath` from `node:url`.
    2. Define `REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')` (parent of tests/fixtures = repo root).
    3. Helper `buildSeedFixture(t)`:
       - `mkdtempSync(join(tmpdir(), 'gsd-memories-'))`
       - Run `bash ${REPO_ROOT}/tests/fixtures/build-seed.sh` to ensure seed.jsonl is built (the script writes to `$REPO_ROOT/tests/fixtures/seed.jsonl`)
       - Then in the tempdir: `bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh <tempdir>` to restore via `bd init --from-jsonl`
       - Register `t.after(() => rmSync(dir, { recursive: true, force: true }))`
       - Return tempdir
    4. CASE 1 (D-18 v0.1 happy):
       ```javascript
       test('memories-seeded CASE 1: v0.1 milestone heading memory present', (t) => {
         const dir = buildSeedFixture(t);
         const out = execSync('bd memories --json', { cwd: dir, encoding: 'utf-8' });
         const memories = JSON.parse(out);
         assert.equal(memories['gsd-beads:milestone:v0.1:heading'], 'Foundation');
       });
       ```
    5. CASE 2 (D-18 v0.2 happy): same shape; assert `memories['gsd-beads:milestone:v0.2:heading'] === 'Beads-backed reads'`.
    6. CASE 3 (D-17 fallback exercise): assert `memories['gsd-beads:milestone:v0.3:heading'] === undefined` (NOT present — by design per D-17 fallback path).

    Per D-26 / REQ-QUAL-01: this test goes RED first (build-seed.sh has not been edited yet), then GREEN after Task 2.

    Per D-18: each `bd remember` call uses `BEADS_ACTOR=seed` to satisfy Pitfall 8 (preserved seed actor identity).
  </action>
  <verify>
    <automated>node --test tests/fixtures/memories-seeded.test.mjs 2>&amp;1 | tee /tmp/v.log; grep -E "fail [0-9]+" /tmp/v.log</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/fixtures/memories-seeded.test.mjs` exists
    - `grep -c "test(" tests/fixtures/memories-seeded.test.mjs` returns ≥3 (three CASE blocks)
    - `grep -c "t.after(" tests/fixtures/memories-seeded.test.mjs` returns ≥1 (uses migration-recommended teardown)
    - `grep -c "BEADS_ACTOR=seed" tests/fixtures/memories-seeded.test.mjs` returns 0 (the test asserts memories ARE seeded, doesn't seed them itself; build-seed.sh seeds them)
    - At Task 1 completion, the test FAILS (red phase per D-26): `node --test tests/fixtures/memories-seeded.test.mjs` exits non-zero — proving the test would catch the missing memory keys
  </acceptance_criteria>
  <done>Test file committed; `node --test tests/fixtures/memories-seeded.test.mjs` exits non-zero (red — exactly as required by D-26 before Task 2 GREEN).</done>
</task>

<task type="auto">
  <name>Task 2: Edit build-seed.sh to emit phase-id labels, milestone memories, and plan children</name>
  <files>tests/fixtures/build-seed.sh, tests/fixtures/seed.jsonl</files>
  <read_first>
    - tests/fixtures/build-seed.sh (CURRENT 73 LOC structure must be edited in-place)
    - tests/shadow-tests/seed-determinism.test.sh (CASE 2 asserts v01=2-closed, v02=3-open, v03=2-open — Task 2 deliberately changes those numbers; CASE 2 must be updated atomically with this edit OR the new expected numbers must replace the old ones)
    - .claude/skills/spike-findings-gsd-beads/references/beads-modeling.md (parent-child link convention: `bd link --type parent-child` per spike-002 finding)
  </read_first>
  <action>
    Edit `tests/fixtures/build-seed.sh` to:

    **Section A — phase-id labels (D-03), 7 existing phases:**

    After every existing `bd label add "$PXX" version:vX.Y` line, add:
    ```bash
    BEADS_ACTOR=seed bd label add "$P11" phase-id:01 >/dev/null
    # ...for each of P11, P12, P21, P22, P23, P31, P32 with phase-id:01..07 in narrative order
    ```

    Mapping (per Section A research recommendation aligning with narrative sequence):
    - P11 → phase-id:01
    - P12 → phase-id:02
    - P21 → phase-id:03
    - P22 → phase-id:04
    - P23 → phase-id:05
    - P31 → phase-id:06
    - P32 → phase-id:07

    **Section B — extend v0.2 to 4 more phases (Q4 Option A; bring total to 11 phase epics):**

    After P23, add 4 more v0.2 epics. Choose titles that match the v0.2 ROADMAP narrative:
    ```bash
    P24=$(BEADS_ACTOR=seed bd q "v0.2 Phase D: state reads" -t epic -p 1)
    BEADS_ACTOR=seed bd label add "$P24" gsd:phase >/dev/null
    BEADS_ACTOR=seed bd label add "$P24" version:v0.2 >/dev/null
    BEADS_ACTOR=seed bd label add "$P24" phase-id:08 >/dev/null

    P25=$(BEADS_ACTOR=seed bd q "v0.2 Phase E: phase resolution" -t epic -p 1)
    BEADS_ACTOR=seed bd label add "$P25" gsd:phase >/dev/null
    BEADS_ACTOR=seed bd label add "$P25" version:v0.2 >/dev/null
    BEADS_ACTOR=seed bd label add "$P25" phase-id:09 >/dev/null

    P26=$(BEADS_ACTOR=seed bd q "v0.2 Phase F: init reads" -t epic -p 1)
    BEADS_ACTOR=seed bd label add "$P26" gsd:phase >/dev/null
    BEADS_ACTOR=seed bd label add "$P26" version:v0.2 >/dev/null
    BEADS_ACTOR=seed bd label add "$P26" phase-id:10 >/dev/null

    P27=$(BEADS_ACTOR=seed bd q "v0.2 Phase G: hook audit" -t epic -p 1)
    BEADS_ACTOR=seed bd label add "$P27" gsd:phase >/dev/null
    BEADS_ACTOR=seed bd label add "$P27" version:v0.2 >/dev/null
    BEADS_ACTOR=seed bd label add "$P27" phase-id:11 >/dev/null
    ```
    Total now: 11 phase epics (v0.1×2 closed, v0.2×7 open, v0.3×2 open).

    **Section C — 24 plan children attached to v0.2 phases (SC #2 substrate):**

    Distribute 24 plan-children across the 7 v0.2 phases. Recommended allocation (mirrors actual ROADMAP plan-counts):
    - P21 (phase-id:03): 4 plans
    - P22 (phase-id:04): 5 plans (this Phase 5 itself — though for fixture we just need the count)
    - P23 (phase-id:05): 4 plans
    - P24 (phase-id:08): 3 plans
    - P25 (phase-id:09): 3 plans
    - P26 (phase-id:10): 3 plans
    - P27 (phase-id:11): 2 plans

    Total: 4+5+4+3+3+3+2 = 24 plans.

    Loop pattern for each phase (use a bash loop to keep the file readable). **CRITICAL Pitfall 8: every bd call inside the loop, including `bd link`, MUST be prefixed with `BEADS_ACTOR=seed`** (Phase 4 PITFALL: actor identity must be preserved on every bd invocation, including loop-internal parent-child link calls):
    ```bash
    # Plan children for v0.2 phases (D-03 substrate; SC #2 count parity)
    seed_plans() {
      local phase_var="$1"
      local phase_id="$2"   # padded form e.g. "03"
      local count="$3"
      for i in $(seq 1 "$count"); do
        local pid_padded
        pid_padded=$(printf "%02d" "$i")
        local plan_id
        plan_id=$(BEADS_ACTOR=seed bd q "v0.2 Plan ${phase_id}-${pid_padded}" -t task -p 1)
        BEADS_ACTOR=seed bd label add "$plan_id" gsd:plan >/dev/null
        BEADS_ACTOR=seed bd label add "$plan_id" version:v0.2 >/dev/null
        BEADS_ACTOR=seed bd label add "$plan_id" "plan-id:${phase_id}-${pid_padded}" >/dev/null
        BEADS_ACTOR=seed bd link "$plan_id" "$phase_var" --type parent-child >/dev/null
      done
    }

    seed_plans "$P21" "03" 4
    seed_plans "$P22" "04" 5
    seed_plans "$P23" "05" 4
    seed_plans "$P24" "08" 3
    seed_plans "$P25" "09" 3
    seed_plans "$P26" "10" 3
    seed_plans "$P27" "11" 2
    ```

    NOTE: `bd link --type parent-child` is per Spike 002 finding (use `bd link`, NOT `bd dep add`'s default `blocks`). The `plan-id:NN-NN` label is for Phase 8 — Phase 5 doesn't read it but the convention is established here so build-seed.sh doesn't need re-edit later.

    **Section D — milestone heading memories (D-18):**

    Insert BEFORE the final `bd export --json` line:
    ```bash
    # Milestone heading memories (D-18): seeded so Phase 5 tests cover happy-path + fallback
    BEADS_ACTOR=seed bd remember 'gsd-beads:milestone:v0.1:heading' 'Foundation' >/dev/null
    BEADS_ACTOR=seed bd remember 'gsd-beads:milestone:v0.2:heading' 'Beads-backed reads' >/dev/null
    # v0.3 deliberately omitted to test the fallback path (D-17: fallback to bare "v0.3")
    ```

    NOTE on `bd remember` syntax: research §A2 flagged that the exact invocation form is assumed. Verify with `bd remember --help` first; if the invocation requires `--key`, use `bd remember --key 'gsd-beads:milestone:v0.1:heading' 'Foundation'`. The 2-positional form `bd remember 'key' 'value'` is the documented spike convention (SKILL.md §"Canonical bd memory keys").

    **Section E — regenerate seed.jsonl:**

    Run `bash tests/fixtures/build-seed.sh` after edits (the script auto-overwrites `tests/fixtures/seed.jsonl`).

    **Section F — update seed-determinism.test.sh CASE 2 expected counts:**

    The existing CASE 2 asserts v01=2-closed, v02=3-open, v03=2-open. With the larger fixture, the new assertion is v01=2-closed, v02=7-open, v03=2-open. Edit `tests/shadow-tests/seed-determinism.test.sh` CASE 2 to reflect the new counts. Atomically: this edit is part of Task 2 because seed.jsonl regen is part of Task 2.

    Implementation order: (1) edit build-seed.sh; (2) edit seed-determinism.test.sh CASE 2 expected counts; (3) run `bash tests/fixtures/build-seed.sh` to regenerate seed.jsonl; (4) run `bash tests/shadow-tests/seed-determinism.test.sh` to confirm both seed-determinism cases (byte-identical reseed + new counts) pass; (5) run `node --test tests/fixtures/memories-seeded.test.mjs` to confirm Task 1 GREEN.
  </action>
  <verify>
    <automated>bash tests/fixtures/build-seed.sh &amp;&amp; bash tests/shadow-tests/seed-determinism.test.sh &amp;&amp; node --test tests/fixtures/memories-seeded.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "phase-id:" tests/fixtures/build-seed.sh` returns ≥11 (one per phase)
    - `grep -c "bd remember" tests/fixtures/build-seed.sh` returns ≥2 (v0.1 + v0.2 memories)
    - `grep -c "gsd:plan" tests/fixtures/build-seed.sh` returns ≥1 (plan-child label seeding present)
    - `grep -c "bd link" tests/fixtures/build-seed.sh` returns ≥1 (parent-child link seeding present)
    - `grep -c "BEADS_ACTOR=seed bd link" tests/fixtures/build-seed.sh` returns ≥1 (W8 / Pitfall 8: loop-internal parent-child link calls also honor the actor prefix)
    - `grep -c "version:v0.3:heading" tests/fixtures/build-seed.sh` returns 0 (v0.3 deliberately omitted per D-17)
    - `wc -l tests/fixtures/seed.jsonl` returns ≥35 (11 phases + 24 plans = 35 issue lines, plus possible memory lines if export emits them)
    - `bash tests/shadow-tests/seed-determinism.test.sh` exits 0 (CASE 1 byte-identical + CASE 2 updated counts pass)
    - `node --test tests/fixtures/memories-seeded.test.mjs` exits 0 (3/3 cases pass — Task 1 turns GREEN)
    - `grep -c "BEADS_ACTOR=seed" tests/fixtures/build-seed.sh` returns ≥35 (every bd call uses Pitfall 8 mitigation)
  </acceptance_criteria>
  <done>build-seed.sh edited; seed.jsonl regenerated with 11 phase epics + 24 plan children + 2 memory keys; seed-determinism.test.sh CASE 2 updated to expected new counts and passes; memories-seeded.test.mjs turns GREEN; all bd calls retain `BEADS_ACTOR=seed` prefix (including loop-internal `bd link`).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build-seed.sh → bd CLI | Bash array form of bd args (no shell interpolation of user input — all values are literal strings in the script) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | build-seed.sh phase title strings | accept | Titles are literal strings hard-coded in the seed script; no untrusted input. |
| T-05-02 | Tampering | bd memory key/value pairs | mitigate | Keys/values are literal in script; `bd remember 'key' 'value'` uses positional args (no shell expansion of variables) |
| T-05-03 | Repudiation | seed actor identity | mitigate | Pitfall 8: `BEADS_ACTOR=seed` prefix on every bd call so dev's identity does not leak into committed seed |
</threat_model>

<verification>
After both tasks:
- `bash tests/fixtures/build-seed.sh` emits "[build-seed] seed.jsonl regenerated" + 11 phase IDs (echo line)
- `bash tests/shadow-tests/seed-determinism.test.sh` exits 0 (CASE 1 D-07 byte-identical reseed + CASE 2 updated multi-milestone counts both pass)
- `node --test tests/fixtures/memories-seeded.test.mjs` exits 0 (3 cases pass)
- `node --test tests/shadow-tests/*.test.mjs` exits 0 (the 83-test full Phase 4 suite still passes — adding fixture content does not regress any existing test; bd-helper, beads-errors, findBeadsRoot, milestone-scoping all see the larger seed and stay green)
- `bash tests/shadow-tests/bd-allowlist-grep.test.sh` exits 0 (allowlist still intact; this plan adds bd `link` to build-seed.sh which is NOT in the read-handler allowlist — but build-seed.sh is NOT a read handler; the allowlist applies to bin/gsd-sdk-shadow.mjs read overrides only)
</verification>

<success_criteria>
- 11 phase epics with phase-id:01..11 labels exist in regenerated seed.jsonl (verified by `bd list -l gsd:phase --json -n 0` count after seed-fixture.sh restore)
- 24 plan children with gsd:plan label exist (verified by `bd list -l gsd:plan --json -n 0` count after restore)
- 2 milestone-heading memories present (`bd memories --json | jq 'keys'` includes both keys)
- v0.3 milestone-heading memory absent (D-17 fallback substrate)
- seed-determinism CASE 1 still passes (byte-identical reseed proves new fixture is deterministic)
</success_criteria>

<output>
After completion, create `.planning/phases/05-roadmap-read-handlers/05-01-SUMMARY.md` documenting:
- Final phase-id mapping (P11..P27 → phase-id:01..11)
- Final plan distribution (4+5+4+3+3+3+2 = 24)
- seed-determinism.test.sh CASE 2 numeric expectations updated (v0.2: 3 → 7)
- Memory keys seeded (v0.1, v0.2; v0.3 fallback)
- Confirm `bash tests/fixtures/build-seed.sh && diff <(...)` produces byte-identical output across two runs
</output>
</content>
</invoke>