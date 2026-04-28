---
phase: 02-build-the-layer
plan: 06
type: execute
wave: 4
depends_on: [01, 02, 03, 04, 05]
files_modified:
  - tests/e2e/full-install.smoke.sh
  - tests/e2e/bd-sync-latency.test.sh
  - tests/e2e/concurrent-merge.test.sh
  - tests/e2e/post-gsd-update.smoke.sh
  - tests/e2e/bd-ready.smoke.sh
  - tests/e2e/fixtures/scale-50-bead.sh
autonomous: true
requirements: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08]
requirements_addressed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08]
must_haves:
  truths:
    - "Fresh fixture project at /tmp/gsd-beads-e2e-${RANDOM}: bd init + install.sh + 3-level hierarchy build + close all leaves + cascade fires + ROADMAP.md regenerated + gsd-progress can parse it (REQ-01..REQ-08 cross-cutting)"
    - "On a 50-bead fixture, bd-sync.sh wall-clock is < 5s (Pitfall 3 perf gate per RESEARCH.md A3)"
    - "Two worktrees writing same bead ID concurrently merge without conflict (REQ-05 / Spike 005 parity)"
    - "After running `gsd-update` on the upstream package, the shadow imports still resolve (REQ-02 — assumption A2)"
    - "`bd ready` works as-is in a beads-managed project — gsd-beads-vocabulary memory mentions it (REQ-08)"
    - "Cleanup-on-failure: trap EXIT removes all /tmp fixture dirs (T-02-10)"
    - "B1: REQ-05 acceptance is no-conflict-no-corruption (last-writer-wins per Pitfall 8 / Spike 005); recovery of overwritten close_reason is OUT OF SCOPE for MVP. concurrent-merge.test.sh asserts (a) both writers' bd close commands return non-empty IDs (no exception thrown / both transactions committed), and (b) `bd show <id> --json` returns state=closed with close_reason matching ONE of the two writer values (not null, not corrupted)."
    - "Per D-07 (CONTEXT.md), `bd prime` must surface gsd-beads:vocabulary content at session-start (verified by smoke test — B2 fix)."
    - "Per W8: CASE 5 of full-install.smoke.sh invokes `node \"$REPO_ROOT/bin/gsd-sdk-shadow.mjs\" query progress --project-dir <fixture>` to bypass PATH lookup and explicitly exercise the shadow (Volta machines may resolve `gsd-sdk` to upstream not the shadow)."
  artifacts:
    - path: "tests/e2e/full-install.smoke.sh"
      provides: "End-to-end happy path: fresh project + install + hierarchy + cascade + regen + parser-compat"
    - path: "tests/e2e/bd-sync-latency.test.sh"
      provides: "50-bead perf gate; <5s budget for cascade+regen"
    - path: "tests/e2e/concurrent-merge.test.sh"
      provides: "REQ-05 — 2 worktrees writing same bead ID, merge without conflict (B1 fix — interpretation per Pitfall 8)"
    - path: "tests/e2e/post-gsd-update.smoke.sh"
      provides: "REQ-02 — npm update upstream then verify shadow imports still resolve"
    - path: "tests/e2e/bd-ready.smoke.sh"
      provides: "REQ-08 — `bd ready` works in beads-managed project; D-07 — `bd prime` surfaces gsd-beads:vocabulary (B2 fix)"
    - path: "tests/e2e/fixtures/scale-50-bead.sh"
      provides: "Builds 50-bead hierarchy for the perf test"
  key_links:
    - from: "tests/e2e/full-install.smoke.sh"
      to: "/tmp/gsd-beads-e2e-${RANDOM}"
      via: "mktemp + cd"
      pattern: "/tmp/gsd-beads-e2e"
    - from: "tests/e2e/full-install.smoke.sh"
      to: "install.sh"
      via: "bash $REPO/install.sh"
      pattern: "install\\.sh"
    - from: "tests/e2e/full-install.smoke.sh"
      to: "scripts/regen-roadmap.sh"
      via: "regen check after cascade"
      pattern: "regen-roadmap"
---

<objective>
Build the cross-cutting end-to-end suite that exercises the full layer on a fresh fixture project. Each test isolates in `/tmp/gsd-beads-e2e-${RANDOM}` with `trap EXIT` cleanup (T-02-10).

Plans 02-01 through 02-05 must all be complete (Wave 4 — final integration). This is the phase gate before `/gsd-verify-work`.

**B1 REQ-05 interpretation:** REQ-05 ("conflict-free concurrent merge") is interpreted strictly per Pitfall 8 / Spike 005: bd's Dolt-backed concurrent writes are last-writer-wins on the same field. Acceptance is (a) no exception thrown by either writer, (b) database not corrupted (`bd list` post-merge succeeds), (c) bead final state is `closed` with `close_reason` set to ONE of the two writer values. Recovering the overwritten `close_reason` is out of scope for MVP.

**B2 D-07 verification:** D-07 mandates `bd prime` surfaces the `gsd-beads:vocabulary` memory at every session-start. This plan adds a CASE to `bd-ready.smoke.sh` that invokes `bd prime` in the fixture and greps the output for the literal string from the vocabulary memory.

**W8 PATH-bypass:** on Volta-trap machines `command -v gsd-sdk` may resolve to upstream, not the shadow. Tests exercising the shadow's overrides invoke `node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs"` directly to bypass PATH lookup.

Purpose: prove the entire layer works in concert; verify each REQ has a green smoke.
Output: 5 smoke/perf/integration tests + 1 fixture builder.
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
@.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md
@install.sh
@scripts/cascade-loop.sh
@scripts/regen-roadmap.sh
@scripts/regen-requirements.sh
@hooks/bd-sync.sh
@bin/gsd-sdk-shadow.mjs
@tests/fixtures/bd-helpers/3-level-hierarchy.sh

<interfaces>
<!-- E2E fixture pattern (from PATTERNS.md lines 891-918) -->
```bash
fixture=/tmp/gsd-beads-e2e-${RANDOM}
trap "rm -rf $fixture" EXIT
mkdir -p "$fixture" && cd "$fixture"
git init -q
bd init --non-interactive --skip-agents
bash "$REPO_ROOT/install.sh"
# build hierarchy
# close leaves
# verify cascade
# verify regen
```

<!-- gsd-progress parser invocation -->
The upstream `gsd-progress` skill reads `.planning/ROADMAP.md`. Smoke test invokes the SHADOW directly via `node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query progress --project-dir <fixture>` (W8 fix — bypass PATH lookup) and asserts the output contains a non-trivial Progress block.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Create 6 e2e test stubs</name>
  <files>
    tests/e2e/full-install.smoke.sh,
    tests/e2e/bd-sync-latency.test.sh,
    tests/e2e/concurrent-merge.test.sh,
    tests/e2e/post-gsd-update.smoke.sh,
    tests/e2e/bd-ready.smoke.sh,
    tests/e2e/fixtures/scale-50-bead.sh
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (Test files NEW — tests/e2e/*.smoke.sh section, lines 894-919; fixture builder pattern from Spike 002, lines 522-535)
    - .planning/phases/02-build-the-layer/02-VALIDATION.md (per-task verification map for 02-06)
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Open Question 4 — 50-bead fixture for perf test)
  </read_first>
  <action>
    Create 6 stub files. **Bash + bd CLI + git.**

    Each test stub:
    - shebang + `set -uo pipefail` (NOT `-e` for the smoke tests — we want to count failures, not abort)
    - Echoes `[STUB]` and exits 1
    - Comment block with the CASEs
    - `chmod +x`

    **`tests/e2e/full-install.smoke.sh`** cases:
    - CASE 1: fresh /tmp fixture builds successfully (bd init + install.sh exit 0)
    - CASE 2: build 3-level hierarchy via shadow's phase.add + bd link
    - CASE 3: close all 6 leaf tasks → cascade-loop closes 2 phases + 1 requirement (3 epic closures)
    - CASE 4: regen-roadmap.sh produces .planning/ROADMAP.md with `## Progress` table
    - CASE 5 (W8 fix): `node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query progress --project-dir "$fixture"` returns non-empty parser-compat output (bypasses PATH lookup so Volta-trap machines exercise the shadow explicitly)
    - CASE 6: regen-requirements.sh produces .planning/REQUIREMENTS.md with version + traceability sections
    - CASE 7: idempotent regen — running regen twice produces zero diff
    - cleanup: `trap "rm -rf $fixture" EXIT`

    **`tests/e2e/bd-sync-latency.test.sh`** cases:
    - CASE 1: build 50-bead fixture (1 req → 5 phases × 10 tasks)
    - CASE 2: invoke bd-sync.sh on a state-changing payload, measure wall-clock
    - CASE 3: assert wall-clock < 5s (Pitfall 3 budget); print actual ms

    **`tests/e2e/concurrent-merge.test.sh`** cases (B1 fix — REQ-05 interpretation per Pitfall 8):
    - CASE 1: build fixture, add second worktree via `git worktree add`
    - CASE 2: spawn 2 parallel processes that each `bd close <bead> --reason wt-X` on the same bead. **Both invocations return a non-empty bead ID and exit 0** (proves no exception thrown / both transactions committed).
    - CASE 3: wait for both, **`bd show <bead> --json` returns state=closed AND close_reason is one of {wt-source, wt-secondary} (not null, not corrupted JSON)**. Last-writer-wins is acceptable per Pitfall 8.
    - CASE 4: assert no .beads/embeddeddolt corruption (run `bd list --json` post-merge, jq-parses successfully).

    **`tests/e2e/post-gsd-update.smoke.sh`** cases:
    - CASE 1: capture current upstream version via `node -e "console.log(require('get-shit-done-cc/package.json').version)"`
    - CASE 2: simulate gsd-update by `volta install get-shit-done-cc@latest` (or skip if version already latest; print SKIPPED)
    - CASE 3: run shadow with `node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query phase` (read-only) on fixture; assert exit 0 (REQ-02 — shadow's dynamic import still resolves after upstream upgrade)
    - CASE 4: run shadow with `node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query phase.add "Test phase" --project-dir <fixture>`; assert exit 0 + JSON has `backend:'beads'`

    **`tests/e2e/bd-ready.smoke.sh`** cases (B2 fix — D-07 verification added):
    - CASE 1: build 3-level fixture with 1 ready task (no `blocks` deps)
    - CASE 2: run `bd ready`, assert output mentions the ready task ID
    - CASE 3: run `bd memories gsd-beads:vocabulary`, assert output mentions string `bd ready`
    - CASE 4 (B2 fix — D-07 verification): run `bd prime` in the fixture, assert stdout/stderr contains a literal string from the vocabulary memory (e.g., `gsd-beads:vocabulary` key name OR the literal `Upstream` keyword from the vocabulary memory). Validates D-07: agents see vocabulary at session start via `bd prime`.

    **`tests/e2e/fixtures/scale-50-bead.sh`** — fixture builder (called from bd-sync-latency.test.sh):
    ```bash
    #!/usr/bin/env bash
    # Build a 50-bead hierarchy: 1 requirement → 5 phases × 10 tasks each = 56 beads.
    # Stub: production code creates the requirement+phases+tasks via bd CLI.
    set -euo pipefail
    cd "${1:?usage: scale-50-bead.sh <project-dir>}"
    echo "[scale-50-bead] STUB"
    exit 1
    ```
  </action>
  <acceptance_criteria>
    - 6 files exist, executable.
    - `bash -n` is clean for all 6.
    - All 5 .smoke.sh / .test.sh stubs exit 1.
    - `grep -c '^# CASE' tests/e2e/full-install.smoke.sh` returns at least 7.
    - `grep -c '^# CASE' tests/e2e/bd-sync-latency.test.sh` returns at least 3.
    - `grep -c '^# CASE' tests/e2e/concurrent-merge.test.sh` returns at least 4.
    - `grep -c '^# CASE' tests/e2e/post-gsd-update.smoke.sh` returns at least 4.
    - `grep -c '^# CASE' tests/e2e/bd-ready.smoke.sh` returns at least 4 (B2 fix — CASE 4 added for D-07).
    - `grep -c 'trap.*rm -rf' tests/e2e/full-install.smoke.sh` returns at least 1 (T-02-10 cleanup).
  </acceptance_criteria>
  <verify>
    <automated>for f in tests/e2e/*.sh tests/e2e/fixtures/*.sh; do bash -n "$f"; done</automated>
  </verify>
  <done>6 stub files in place, syntax-clean, red Wave 0 markers; cleanup traps documented.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 4): Implement full-install + bd-ready + post-gsd-update smokes</name>
  <files>
    tests/e2e/full-install.smoke.sh,
    tests/e2e/bd-ready.smoke.sh,
    tests/e2e/post-gsd-update.smoke.sh
  </files>
  <read_first>
    - install.sh, hooks/*, scripts/*, bin/* (the entire installed surface — these tests exercise them all)
    - tests/fixtures/bd-helpers/3-level-hierarchy.sh (reuse for hierarchy building)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (E2E flow lines 905-916; perf budget Pitfall 3)
    - .planning/phases/02-build-the-layer/02-CONTEXT.md (D-07 — `bd prime` surfaces gsd-beads:vocabulary)
    - install/memories/vocabulary.md (the literal text the bd prime smoke test will grep for — B2 fix)
  </read_first>
  <behavior>
    - full-install.smoke: 7 cases as listed above; total runtime <60s. CASE 5 explicitly invokes the shadow via `node` to bypass PATH (W8 fix).
    - bd-ready.smoke: 4 cases (B2 fix — D-07 bd prime verification added); total runtime <10s.
    - post-gsd-update.smoke: 4 cases; total runtime <60s (or skipped if version already latest).
  </behavior>
  <action>
    **Step A: `tests/e2e/full-install.smoke.sh`.** Implementation skeleton:

    ```bash
    #!/usr/bin/env bash
    set -uo pipefail
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    fixture="/tmp/gsd-beads-e2e-${RANDOM}"
    trap "rm -rf '$fixture'" EXIT  # T-02-10
    mkdir -p "$fixture" && cd "$fixture"

    pass=0; fail=0
    case_run() {
      local name="$1" success="$2"
      if [ "$success" = "0" ]; then status=PASS; pass=$((pass+1))
      else status=FAIL; fail=$((fail+1)); fi
      printf '  [%s] %s\n' "$status" "$name"
    }

    # CASE 1: fresh fixture builds + install.sh exits 0
    git init -q
    bd init --non-interactive --skip-agents >/dev/null 2>&1
    bash "$REPO_ROOT/install.sh" > /tmp/install.out 2>&1
    case_run "fresh fixture + install.sh exits 0" $?

    # CASE 2: build 3-level hierarchy
    REQ=$(bd q "REQ-001: Smoke test req" -t epic -p 0)
    bd label add "$REQ" gsd:requirement
    bd label add "$REQ" req-id:REQ-001 version:v1 category:smoke
    P1=$(bd q "Phase 1: Smoke" -t epic -p 1)
    bd label add "$P1" gsd:phase milestone:v1.0
    bd link "$P1" "$REQ" --type parent-child
    P2=$(bd q "Phase 2: Smoke" -t epic -p 2)
    bd label add "$P2" gsd:phase milestone:v1.0
    bd link "$P2" "$REQ" --type parent-child
    declare -a TASKS
    for i in 1 2 3; do
      T=$(bd q "Task $i for P1" -t task -p $i)
      bd link "$T" "$P1" --type parent-child
      TASKS+=("$T")
    done
    for i in 1 2 3; do
      T=$(bd q "Task $i for P2" -t task -p $i)
      bd link "$T" "$P2" --type parent-child
      TASKS+=("$T")
    done
    [ "${#TASKS[@]}" -eq 6 ]
    case_run "hierarchy built (1 req → 2 phases → 6 tasks)" $?

    # CASE 3: close all 6 tasks → cascade closes phases + requirement
    for t in "${TASKS[@]}"; do bd close "$t" >/dev/null; done
    bash "$REPO_ROOT/scripts/cascade-loop.sh" --quiet
    closed=$(bd list --status=closed -l gsd:phase --json | jq 'length')
    [ "$closed" -ge 2 ]
    case_run "cascade closes 2 phases" $?

    # CASE 4: regen-roadmap produces ROADMAP.md
    bash "$REPO_ROOT/scripts/regen-roadmap.sh"
    [ -f .planning/ROADMAP.md ] && grep -q '## Progress' .planning/ROADMAP.md
    case_run "regen-roadmap produces ROADMAP.md with ## Progress" $?

    # CASE 5 (W8 fix): exercise the SHADOW via direct node invocation (bypass PATH)
    # On Volta machines, `gsd-sdk` on PATH may resolve to upstream, not the shadow.
    # Direct node invocation guarantees the shadow's argv routing is exercised.
    out=$(node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query progress --project-dir "$fixture" 2>&1) || rc=$?
    [ -n "$out" ]
    case_run "shadow query progress (direct node invocation — bypasses PATH per W8)" $?

    # CASE 6: regen-requirements
    bash "$REPO_ROOT/scripts/regen-requirements.sh"
    [ -f .planning/REQUIREMENTS.md ] && grep -q '## Traceability' .planning/REQUIREMENTS.md
    case_run "regen-requirements produces REQUIREMENTS.md with ## Traceability" $?

    # CASE 7: idempotent regen
    sha1=$(sha256sum .planning/ROADMAP.md | awk '{print $1}')
    bash "$REPO_ROOT/scripts/regen-roadmap.sh"
    sha2=$(sha256sum .planning/ROADMAP.md | awk '{print $1}')
    [ "$sha1" = "$sha2" ]
    case_run "regen-roadmap idempotent (byte-stable)" $?

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Step B: `tests/e2e/bd-ready.smoke.sh`** (B2 fix — adds CASE 4 for D-07):
    ```bash
    #!/usr/bin/env bash
    set -uo pipefail
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    fixture="/tmp/gsd-beads-e2e-ready-${RANDOM}"
    trap "rm -rf '$fixture'" EXIT
    mkdir -p "$fixture" && cd "$fixture"
    pass=0; fail=0
    git init -q
    bd init --non-interactive --skip-agents >/dev/null 2>&1
    bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

    # CASE 1: build minimal fixture with one ready task (no blocks deps)
    bash "$REPO_ROOT/tests/fixtures/bd-helpers/3-level-hierarchy.sh" "$fixture"

    # CASE 2: bd ready returns at least one task
    out=$(bd ready 2>&1)
    if [ -n "$out" ]; then pass=$((pass+1)); else fail=$((fail+1)); fi
    echo "[CASE 2] bd ready output: $out"

    # CASE 3: gsd-beads:vocabulary memory mentions bd ready
    voc=$(bd memories gsd-beads:vocabulary 2>&1 || true)
    if echo "$voc" | grep -q 'bd ready'; then pass=$((pass+1)); else fail=$((fail+1)); fi

    # CASE 4 (B2 fix — D-07 verification): bd prime surfaces gsd-beads:vocabulary
    # D-07 mandates: agents see vocabulary memory at session start via bd prime.
    # We grep for either the memory key name itself or a literal string from the vocabulary text
    # (e.g., "Upstream" — present in vocabulary.md per W7 fix).
    prime_out=$(bd prime 2>&1 || true)
    if echo "$prime_out" | grep -qE 'gsd-beads:vocabulary|Upstream `/gsd-\*` commands'; then
      pass=$((pass+1))
      echo "[CASE 4] PASS — bd prime surfaces gsd-beads:vocabulary (D-07 verified)"
    else
      fail=$((fail+1))
      echo "[CASE 4] FAIL — bd prime did not surface gsd-beads:vocabulary"
      echo "[CASE 4] bd prime output (first 500 chars): $(printf '%s' "$prime_out" | head -c 500)"
    fi

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Step C: `tests/e2e/post-gsd-update.smoke.sh`** (uses direct shadow invocation per W8 in CASE 3-4):
    ```bash
    #!/usr/bin/env bash
    set -uo pipefail
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    fixture="/tmp/gsd-beads-e2e-postupd-${RANDOM}"
    trap "rm -rf '$fixture'" EXIT
    pass=0; fail=0

    # CASE 1: capture current version
    SDK_VERSION_BEFORE=$(node -e "console.log(require('get-shit-done-cc/package.json').version)" 2>/dev/null || echo "unknown")
    [ "$SDK_VERSION_BEFORE" != "unknown" ] && pass=$((pass+1)) || fail=$((fail+1))

    # CASE 2: simulate update — try `volta install get-shit-done-cc@latest`. If failure or no-op, log SKIPPED.
    if volta install get-shit-done-cc@latest >/dev/null 2>&1; then
      SDK_VERSION_AFTER=$(node -e "console.log(require('get-shit-done-cc/package.json').version)" 2>/dev/null)
      echo "[CASE 2] $SDK_VERSION_BEFORE → $SDK_VERSION_AFTER"
      pass=$((pass+1))
    else
      echo "[CASE 2] SKIPPED (volta install failed or already latest)"
      pass=$((pass+1))
    fi

    # CASE 3: shadow's read-only passthrough still works (W8 — direct node invocation)
    mkdir -p "$fixture" && cd "$fixture"
    git init -q && bd init --non-interactive --skip-agents >/dev/null
    if node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query phase --project-dir "$fixture" 2>&1 | head -1 | grep -q '.'; then
      pass=$((pass+1))
    else
      fail=$((fail+1))
    fi

    # CASE 4: shadow's mutation handler still works (W8 — direct node invocation)
    out=$(node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query phase.add "Post-update phase" --project-dir "$fixture" 2>&1)
    if echo "$out" | jq -e '.data.backend == "beads"' >/dev/null 2>&1; then
      pass=$((pass+1))
    else
      fail=$((fail+1))
      echo "[CASE 4 FAIL] shadow output: $out"
    fi

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Threat mitigation (T-02-10):** all three tests use `trap "rm -rf '$fixture'" EXIT` so /tmp dirs are cleaned even on failure.
  </action>
  <acceptance_criteria>
    - All 3 test files updated, executable, syntax-clean.
    - `grep -c 'trap.*rm -rf.*EXIT' tests/e2e/full-install.smoke.sh` returns at least 1.
    - `grep -c 'trap.*rm -rf.*EXIT' tests/e2e/bd-ready.smoke.sh` returns at least 1.
    - `grep -c 'trap.*rm -rf.*EXIT' tests/e2e/post-gsd-update.smoke.sh` returns at least 1.
    - **W8 fix:** `grep -c 'node "\$REPO_ROOT/bin/gsd-sdk-shadow.mjs"' tests/e2e/full-install.smoke.sh` returns at least 1 (CASE 5 invokes shadow directly).
    - **W8 fix:** `grep -c 'node "\$REPO_ROOT/bin/gsd-sdk-shadow.mjs"' tests/e2e/post-gsd-update.smoke.sh` returns at least 2 (CASE 3 + 4 invoke shadow directly).
    - **B2 fix:** `grep -c 'bd prime' tests/e2e/bd-ready.smoke.sh` returns at least 1 (D-07 verification).
    - **B2 fix:** `grep -c '^# CASE 4\|CASE 4' tests/e2e/bd-ready.smoke.sh` returns at least 1.
    - `bash tests/e2e/full-install.smoke.sh` exits 0 with `Passed: 7 / 7`.
    - `bash tests/e2e/bd-ready.smoke.sh` exits 0 (4/4 — B2 CASE 4 PASSES).
    - `bash tests/e2e/post-gsd-update.smoke.sh` exits 0 (4/4 — Volta install may print SKIPPED but counts pass).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/e2e/full-install.smoke.sh && bash tests/e2e/bd-ready.smoke.sh && bash tests/e2e/post-gsd-update.smoke.sh</automated>
  </verify>
  <done>3 e2e smokes PASSING. Full install path verified end-to-end. REQ-01, REQ-02, REQ-04, REQ-06, REQ-07, REQ-08 covered. W8 PATH-bypass + B2 D-07 verification active.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (Wave 4): Implement bd-sync-latency perf gate + concurrent-merge integration (B1 REQ-05 fidelity fix)</name>
  <files>
    tests/e2e/bd-sync-latency.test.sh,
    tests/e2e/concurrent-merge.test.sh,
    tests/e2e/fixtures/scale-50-bead.sh
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Pitfall 3 — 50-bead fixture target, <5s budget; Spike 005 concurrent-merge findings; Pitfall 8 — last-writer-wins on same-field updates)
    - hooks/bd-sync.sh (the script under test)
    - .claude/skills/spike-findings-gsd-beads/references/beads-modeling.md (concurrent writes safe via Dolt file lock)
    - tests/e2e/full-install.smoke.sh (just-built — reuse fixture pattern)
  </read_first>
  <behavior>
    - bd-sync-latency: perf gate — 50-bead fixture, run bd-sync.sh on a state-change payload, assert <5s.
    - concurrent-merge (B1 fix — REQ-05 interpretation per Pitfall 8): 2 parallel processes close the same bead from different worktrees. Acceptance: (a) both writers' `bd close` returns non-empty bead-ID stdout (no exception thrown / both transactions committed), (b) `bd show <id> --json` returns state=closed AND close_reason ∈ {wt-source, wt-secondary} (not null, not corrupted JSON), (c) `bd list` post-merge succeeds (no DB corruption).
    - scale-50-bead: builds 1 req → 5 phases × 10 tasks = 56 beads via bd CLI.
  </behavior>
  <action>
    **Step A: `tests/e2e/fixtures/scale-50-bead.sh`.**
    ```bash
    #!/usr/bin/env bash
    # Build 1 req → 5 phases × 10 tasks each = 56 beads in cwd.
    set -euo pipefail
    cd "${1:?usage: scale-50-bead.sh <dir>}"
    REQ=$(bd q "REQ-100: scale test" -t epic -p 0)
    bd label add "$REQ" gsd:requirement req-id:REQ-100 version:v1
    for p in 1 2 3 4 5; do
      P=$(bd q "Phase $p: scale" -t epic -p $p)
      bd label add "$P" gsd:phase
      bd link "$P" "$REQ" --type parent-child
      for t in 1 2 3 4 5 6 7 8 9 10; do
        T=$(bd q "Phase-$p task-$t" -t task -p $t)
        bd link "$T" "$P" --type parent-child
      done
    done
    echo "[scale-50-bead] built 56 beads"
    ```
    `chmod +x`.

    **Step B: `tests/e2e/bd-sync-latency.test.sh`.**
    ```bash
    #!/usr/bin/env bash
    set -uo pipefail
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    fixture="/tmp/gsd-beads-e2e-perf-${RANDOM}"
    trap "rm -rf '$fixture'" EXIT
    pass=0; fail=0
    mkdir -p "$fixture" && cd "$fixture"
    git init -q
    bd init --non-interactive --skip-agents >/dev/null

    # Symlink the scripts the bd-sync hook expects
    mkdir -p .claude/scripts
    ln -sf "$REPO_ROOT/scripts/cascade-loop.sh" .claude/scripts/cascade-loop.sh
    ln -sf "$REPO_ROOT/scripts/regen-roadmap.sh" .claude/scripts/regen-roadmap.sh
    ln -sf "$REPO_ROOT/scripts/regen-requirements.sh" .claude/scripts/regen-requirements.sh

    # CASE 1: build 50-bead fixture
    bash "$REPO_ROOT/tests/e2e/fixtures/scale-50-bead.sh" "$fixture"
    count=$(bd list --json | jq 'length')
    [ "$count" -ge 50 ] && pass=$((pass+1)) || fail=$((fail+1))
    echo "[CASE 1] bead count: $count"

    # CASE 2: invoke bd-sync.sh on a state-changing payload, measure ms
    payload=$(jq -n '{
      session_id:"perf",transcript_path:"/tmp/x",cwd:".",permission_mode:"default",
      hook_event_name:"PostToolUse",tool_name:"Bash",
      tool_input:{command:"bd close fake-1",description:"close"},
      tool_response:{stdout:"",stderr:"",interrupted:false},
      tool_use_id:"perf",duration_ms:1
    }')
    export CLAUDE_PROJECT_DIR="$fixture"
    start_ns=$(date +%s%N)
    printf '%s' "$payload" | "$REPO_ROOT/hooks/bd-sync.sh" 2>/dev/null || true
    end_ns=$(date +%s%N)
    elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
    echo "[CASE 2] bd-sync wall-clock: ${elapsed_ms}ms"
    pass=$((pass+1))

    # CASE 3: assert <5000ms (Pitfall 3)
    if [ "$elapsed_ms" -lt 5000 ]; then
      pass=$((pass+1))
      echo "[CASE 3] PASS — ${elapsed_ms}ms < 5000ms budget"
    else
      fail=$((fail+1))
      echo "[CASE 3] FAIL — ${elapsed_ms}ms exceeds 5000ms budget"
    fi

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Step C: `tests/e2e/concurrent-merge.test.sh` (B1 fix — REQ-05 interpretation per Pitfall 8).**
    ```bash
    #!/usr/bin/env bash
    set -uo pipefail
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    fixture="/tmp/gsd-beads-e2e-cmerge-${RANDOM}"
    wt="${fixture}-wt"
    trap "rm -rf '$fixture' '$wt'" EXIT
    pass=0; fail=0
    mkdir -p "$fixture" && cd "$fixture"
    git init -q
    git commit -q --allow-empty -m init
    bd init --non-interactive --skip-agents >/dev/null
    bash "$REPO_ROOT/install.sh" >/dev/null 2>&1

    # CASE 1: create a worktree (post-checkout shim should auto-config)
    git worktree add "$wt" -q
    if [ -d "$wt" ]; then pass=$((pass+1)); else fail=$((fail+1)); fi

    # CASE 2 (B1 fix): create a target bead, then 2 parallel processes close it from different cwds.
    # Acceptance: BOTH writers' bd close stdout must be non-empty (proves transaction committed,
    # no exception thrown). Last-writer-wins on close_reason is acceptable per Pitfall 8.
    BEAD=$(bd q "concurrent target" -t task -p 1)
    out1_file=$(mktemp); out2_file=$(mktemp)
    rc1_file=$(mktemp); rc2_file=$(mktemp)
    (cd "$fixture" && bd close "$BEAD" --reason "wt-source" 2>&1 > "$out1_file"; echo $? > "$rc1_file") &
    pid1=$!
    (cd "$wt" && BEADS_DIR="$fixture/.beads" bd close "$BEAD" --reason "wt-secondary" 2>&1 > "$out2_file"; echo $? > "$rc2_file") &
    pid2=$!
    wait $pid1; wait $pid2
    rc1=$(cat "$rc1_file"); rc2=$(cat "$rc2_file")
    out1=$(cat "$out1_file"); out2=$(cat "$out2_file")
    rm -f "$out1_file" "$out2_file" "$rc1_file" "$rc2_file"
    # Both writers committed (rc=0 AND non-empty bead-ID-bearing stdout)
    if [ "$rc1" = "0" ] && [ "$rc2" = "0" ] && [ -n "$out1" ] && [ -n "$out2" ]; then
      pass=$((pass+1))
      echo "[CASE 2] PASS — both writers committed (rc1=$rc1, rc2=$rc2; outputs non-empty)"
    else
      fail=$((fail+1))
      echo "[CASE 2] FAIL — rc1=$rc1, rc2=$rc2, out1=$out1, out2=$out2"
    fi

    # CASE 3 (B1 fix): final state — bead is closed AND close_reason ∈ {wt-source, wt-secondary}.
    # Last-writer-wins is acceptable per Pitfall 8 / Spike 005; recovering the overwritten value is OUT OF SCOPE for MVP.
    final_json=$(bd show "$BEAD" --json 2>&1)
    final_status=$(echo "$final_json" | jq -r '.[0].status' 2>/dev/null)
    final_reason=$(echo "$final_json" | jq -r '.[0].close_reason // ""' 2>/dev/null)
    if [ "$final_status" = "closed" ] && \
       { [ "$final_reason" = "wt-source" ] || [ "$final_reason" = "wt-secondary" ]; }; then
      pass=$((pass+1))
      echo "[CASE 3] PASS — status=closed, close_reason=$final_reason (one of two writer values; last-writer-wins per Pitfall 8 acceptable)"
    else
      fail=$((fail+1))
      echo "[CASE 3] FAIL — status=$final_status close_reason=$final_reason (raw json: $final_json)"
    fi

    # CASE 4: no corruption — `bd list --json` parses successfully
    if bd list --json 2>/dev/null | jq -e 'type == "array"' >/dev/null 2>&1; then
      pass=$((pass+1))
      echo "[CASE 4] PASS — bd list --json parses (no DB corruption)"
    else
      fail=$((fail+1))
      echo "[CASE 4] FAIL — bd list output not valid JSON array"
    fi

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Note on perf budget:** if Test 3 (latency) fails on this machine, the failure is informational — the budget is per Pitfall 3's estimate (~2-4s). A real failure means `bd-sync.sh` regen takes longer than the 30s hook timeout would allow.
  </action>
  <acceptance_criteria>
    - All 3 files updated, executable, syntax-clean.
    - `bash tests/e2e/fixtures/scale-50-bead.sh /tmp/scale-test-$$ 2>&1 | grep -q 'built 56 beads'` returns success after providing a fresh bd init.
    - `bash tests/e2e/bd-sync-latency.test.sh` exits 0 (3/3 cases; <5s budget met).
    - `bash tests/e2e/concurrent-merge.test.sh` exits 0 (4/4 cases — B1 fix interpretations honored).
    - `grep -c 'trap.*rm -rf.*EXIT' tests/e2e/concurrent-merge.test.sh` returns at least 1 (T-02-10).
    - `grep -c 'date +%s%N' tests/e2e/bd-sync-latency.test.sh` returns at least 2 (timing measurement).
    - **B1 fix:** `grep -c 'wt-source\|wt-secondary' tests/e2e/concurrent-merge.test.sh` returns at least 4 (both writer values referenced in CASE 2 + CASE 3 assertions).
    - **B1 fix:** `grep -c 'close_reason' tests/e2e/concurrent-merge.test.sh` returns at least 1 (CASE 3 verifies close_reason).
    - **B1 fix:** `grep -c 'Pitfall 8\|last-writer-wins' tests/e2e/concurrent-merge.test.sh` returns at least 1 (interpretation note documented inline).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/e2e/bd-sync-latency.test.sh && bash tests/e2e/concurrent-merge.test.sh</automated>
  </verify>
  <done>Perf gate (Pitfall 3) green: 50-bead bd-sync <5s. REQ-05 concurrent-merge integration green per Pitfall 8 interpretation (B1 fix — both writers commit, no DB corruption, close_reason is one of the two values). T-02-10 cleanup verified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| /tmp fixture → user shell | Tests run as user; cleanup must be guaranteed |
| Concurrent processes → shared .beads/ | Two writers; bd's Dolt file lock is the trust line |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-10 | Information disclosure / DoS | tests/e2e/*/fixtures in /tmp | mitigate | All e2e tests use `trap "rm -rf '$fixture'" EXIT` so fixtures clean up even on failure. Acceptance: `grep -c 'trap.*rm -rf.*EXIT' tests/e2e/*.sh` returns ≥1 per file. |
| (Concurrent merge data loss) | Information disclosure | concurrent-merge.test.sh | accept | Per Spike 005 + Pitfall 8: same-field updates are last-writer-wins; tests assert no corruption (bd list succeeds), both writers commit (non-empty stdout), and close_reason matches one of two writer values (B1 fix — explicit acceptance criteria). Recovery of overwritten value is out of scope for MVP. |
</threat_model>

<verification>
- All 5 e2e suites PASS (`bash tests/run-all.sh` includes them).
- Combined runtime <5 minutes (full-install ~60s, bd-ready ~10s, post-gsd-update ~60s, bd-sync-latency ~30s, concurrent-merge ~20s).
- All trap-EXIT cleanups verified via `grep` acceptance criteria.
- No /tmp pollution after `bash tests/run-all.sh` completes.
- B1 invariants: concurrent-merge.test.sh CASE 3 asserts close_reason ∈ {wt-source, wt-secondary} (not null/corrupted).
- B2 invariant: bd-ready.smoke.sh CASE 4 asserts bd prime surfaces gsd-beads:vocabulary content (D-07 verified).
- W8 invariant: full-install.smoke.sh CASE 5 + post-gsd-update.smoke.sh CASE 3+4 invoke `node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs"` directly to bypass PATH lookup.
</verification>

<success_criteria>
- `bash tests/run-all.sh` exits 0 with full pass tally — every Wave 0 stub now has matching production code, every test green.
- E2E full-install verifies REQ-01 (regen), REQ-02 (no GSD core mutation), REQ-04 (hooks active), REQ-06 (install idempotent), REQ-07 (narrative untouched), REQ-08 (bd ready works).
- Performance gate met: 50-bead bd-sync <5s (Pitfall 3 budget).
- Concurrent merge verified per Pitfall 8 / B1 fix: 2 worktrees, both committed, close_reason ∈ {wt-source, wt-secondary}, no corruption (REQ-05).
- Post-update smoke verified: shadow imports survive `volta install get-shit-done-cc@latest` (REQ-02 / Assumption A2).
- D-07 verified (B2 fix): bd prime surfaces gsd-beads:vocabulary content at session-start.
- W8 PATH-bypass active: shadow exercised via direct node invocation in CASE 5 + post-update CASEs.
- Phase 2 ready for `/gsd-verify-work` gate.
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-06-SUMMARY.md` documenting:
- E2E pass tally (full-install: 7/7, bd-sync-latency: 3/3, concurrent-merge: 4/4 per B1 interpretation, post-gsd-update: 4/4, bd-ready: 4/4 per B2 D-07 verification)
- Measured bd-sync wall-clock on the 50-bead fixture
- Any cases that produced SKIPPED (volta install precondition)
- Confirmation that no /tmp dirs leaked after suite run
- T-02-10 cleanup invariant verified
- B1 REQ-05 interpretation honored (Pitfall 8 last-writer-wins acceptable)
- B2 D-07 bd prime verification PASS
- W8 PATH-bypass invariants verified by grep gates
</output>
