---
phase: 02-build-the-layer
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/worktree-post-checkout.sh
  - tests/worktree-tests/auto-config.test.sh
  - tests/worktree-tests/append-idempotency.test.sh
autonomous: true
requirements: [REQ-03]
requirements_addressed: [REQ-03]
must_haves:
  truths:
    - "hooks/worktree-post-checkout.sh is the sentinel-marker block that gets appended to .beads/hooks/post-checkout by Plan 02-05's install.sh"
    - "Running `git worktree add <path>` in a beads-managed source repo automatically configures `git config --worktree gsd-beads.dir <source>/.beads` in the new worktree (REQ-03)"
    - "The shim writes a marker file `<gitdir>/info/.gsd-beads-configured` so it's idempotent (re-checkouts don't reconfigure)"
    - "The append into post-checkout is also idempotent (Pitfall 7) — re-running shim install removes any existing BEGIN..END block before re-adding"
    - "Sentinel-marker shape is `# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---` / `# --- END GSD-BEADS WORKTREE INIT ---` matching CONVENTIONS"
  artifacts:
    - path: "hooks/worktree-post-checkout.sh"
      provides: "Sentinel-marked block appended to .beads/hooks/post-checkout"
      min_lines: 35
    - path: "tests/worktree-tests/auto-config.test.sh"
      provides: "Asserts `git worktree add` triggers post-checkout with flag=1, sets git config --worktree gsd-beads.dir"
    - path: "tests/worktree-tests/append-idempotency.test.sh"
      provides: "Asserts running install-append shim twice produces only one BEGIN..END block"
  key_links:
    - from: "hooks/worktree-post-checkout.sh"
      to: "git config --worktree gsd-beads.dir"
      via: "git config invocation in script body"
      pattern: "git config --worktree gsd-beads\\.dir"
    - from: "hooks/worktree-post-checkout.sh"
      to: "<gitdir>/info/.gsd-beads-configured marker"
      via: "touch marker file after config"
      pattern: "\\.gsd-beads-configured"
---

<objective>
Build the worktree post-checkout shim (sentinel-marked block) and its idempotency tests. The shim auto-configures `git config --worktree gsd-beads.dir <source-repo>/.beads` in any new worktree of a beads-managed source repo, removing the need for env-var discipline (REQ-03).

The script is itself idempotent (uses marker file). Plan 02-05's install.sh handles installing the SHIM into bd's `.beads/hooks/post-checkout` chain idempotently (Pitfall 7).

Wave-1 (no dependencies; runs parallel with 02-01, 02-02).

Purpose: Cross-worktree state sharing without env-var ceremony.
Output: 1 shim script + 2 test suites.
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
@.claude/skills/spike-findings-gsd-beads/SKILL.md
@.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md
@.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh

<interfaces>
<!-- git post-checkout hook contract -->

`post-checkout` is invoked with three args:
- `$1` (old_sha): SHA before checkout
- `$2` (new_sha): SHA after checkout
- `$3` (flag): "1" if branch checkout (worktree add fires this), "0" if file checkout

For new-worktree case (`git worktree add`), `$3 == "1"` and `git rev-parse --git-dir` returns the worktree-specific gitdir (`<repo>/.git/worktrees/<name>`).

`git rev-parse --git-common-dir` returns the SHARED gitdir (`<repo>/.git`) — used to derive source-repo location.

`git config --worktree <key> <value>` writes to per-worktree config (`<gitdir>/config.worktree`).

Sentinel-marker convention (from CONVENTIONS):
```
# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---
<block content>
# --- END GSD-BEADS WORKTREE INIT ---
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Create test stubs for worktree shim</name>
  <files>
    tests/worktree-tests/auto-config.test.sh,
    tests/worktree-tests/append-idempotency.test.sh
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (Test files NEW — tests/worktree-tests section, lines 871-889 — fixture pattern with git worktree add)
    - .planning/phases/02-build-the-layer/02-VALIDATION.md (per-task verification map for 02-04)
    - .claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh (the shim source for case awareness)
  </read_first>
  <action>
    Create 2 stub test files. **Bash + git + bd CLI.**

    **File 1: `tests/worktree-tests/auto-config.test.sh`** — Wave 0 stub.
    ```bash
    #!/usr/bin/env bash
    # Tests for hooks/worktree-post-checkout.sh — auto-configuration of new worktrees.
    set -euo pipefail
    echo "[auto-config.test.sh] STUB — production code not yet written"
    # CASE 1: git worktree add in beads-managed source → new wt has git config --worktree gsd-beads.dir set
    # CASE 2: marker file <wt-gitdir>/info/.gsd-beads-configured exists after first checkout
    # CASE 3: re-checkout in same worktree (e.g., git checkout other-branch) → script no-ops (marker present)
    # CASE 4: source repo lacks .beads/ → script emits warning to stderr, exits 0 cleanly (no abort)
    # CASE 5: flag=0 (file checkout, not worktree-add) → script no-ops
    exit 1
    ```

    **File 2: `tests/worktree-tests/append-idempotency.test.sh`** — Wave 0 stub.
    ```bash
    #!/usr/bin/env bash
    # Tests for the install-time append of worktree-post-checkout.sh into .beads/hooks/post-checkout.
    # Note: the SCRIPT itself is idempotent via marker file. This test covers the APPEND idempotency (Pitfall 7).
    # The actual append helper lives in Plan 02-05's install.sh; this test exercises just the append logic.
    set -euo pipefail
    echo "[append-idempotency.test.sh] STUB — append helper not yet written"
    # CASE 1: appending the BEGIN..END block to an empty post-checkout file → exactly 1 block
    # CASE 2: appending TWICE to the same file → still exactly 1 block (sed /BEGIN/,/END/d then re-append)
    # CASE 3: appending into a file that already has bd's BEGIN BEADS INTEGRATION block → coexists; both blocks present
    # CASE 4: appending with newer version (`v2`) → old `v1` block removed first
    exit 1
    ```

    `chmod +x tests/worktree-tests/*.test.sh`.
  </action>
  <acceptance_criteria>
    - Both files exist, executable.
    - `bash -n tests/worktree-tests/auto-config.test.sh` exits 0.
    - `bash -n tests/worktree-tests/append-idempotency.test.sh` exits 0.
    - Both stubs exit 1 (Wave 0 red).
    - `grep -c '^# CASE' tests/worktree-tests/auto-config.test.sh` returns at least 5.
    - `grep -c '^# CASE' tests/worktree-tests/append-idempotency.test.sh` returns at least 4.
  </acceptance_criteria>
  <verify>
    <automated>bash -n tests/worktree-tests/auto-config.test.sh && bash -n tests/worktree-tests/append-idempotency.test.sh && ! bash tests/worktree-tests/auto-config.test.sh 2>/dev/null && ! bash tests/worktree-tests/append-idempotency.test.sh 2>/dev/null</automated>
  </verify>
  <done>2 stubs in place, syntax-valid, red Wave 0 markers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 1): Implement hooks/worktree-post-checkout.sh + complete its tests</name>
  <files>
    hooks/worktree-post-checkout.sh,
    tests/worktree-tests/auto-config.test.sh,
    tests/worktree-tests/append-idempotency.test.sh
  </files>
  <read_first>
    - .claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh (EXACT verbatim source — production-ready per PATTERNS.md)
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (hooks/worktree-post-checkout.sh section — Phase 2 deltas: T-02-06 mitigation + atomic-rename for the install append; sentinel-marker shape)
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Pitfall 7 — worktree append idempotency)
    - .planning/spikes/CONVENTIONS.md (sentinel-marker pattern documentation)
  </read_first>
  <behavior>
    - auto-config Test 1: `git worktree add` in beads source → new wt has `git config --worktree --get gsd-beads.dir` returning `<source>/.beads`.
    - auto-config Test 2: marker file `<wt-gitdir>/info/.gsd-beads-configured` exists post-checkout.
    - auto-config Test 3: re-running shim in same worktree (marker exists) — exits 0 immediately, no config rewrite.
    - auto-config Test 4: source lacks `.beads/` → stderr contains "Source repo at ... has no .beads/", exit 0.
    - auto-config Test 5: shim invoked with $3=0 (file checkout) → exits 0 silently with no config write.
    - append-idempotency Test 1-4: covered via a small `install/append-worktree-shim.sh` helper script that the test exercises.
  </behavior>
  <action>
    **Step A: Implement `hooks/worktree-post-checkout.sh`.** Copy verbatim from `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/worktree-post-checkout.sh`. The spike POC is production-ready. Wrap the entire body in the v1 sentinel-marker block (so install.sh can later strip-and-replace this block):

    ```bash
    #!/usr/bin/env bash
    # gsd-beads worktree-init shim — wrapped in sentinel-marker block.
    # Designed to be APPENDED into .beads/hooks/post-checkout by install.sh.
    # Idempotent via marker file in worktree gitdir.
    # T-02-06 mitigation: marker check uses `[ -f ... ]` only (no symlink follow risk because the dir is git-managed).

    # --- BEGIN GSD-BEADS WORKTREE INIT v1 ---
    old_sha=$1; new_sha=$2; flag=$3
    [ "$flag" = "1" ] || exit 0

    gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
    marker="$gitdir/info/.gsd-beads-configured"
    [ -f "$marker" ] && exit 0

    common=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0
    source_root="$(dirname "$(cd "$common" && pwd -P)")"
    source_beads="$source_root/.beads"

    if [ ! -d "$source_beads" ]; then
      printf '[gsd-beads] ⚠ Source repo at %s has no .beads/ — run `bd init` in source first\n' "$source_root" >&2
      exit 0
    fi

    git config --worktree gsd-beads.dir "$source_beads" 2>/dev/null || \
      git config gsd-beads.dir "$source_beads"

    mkdir -p "$gitdir/info"
    touch "$marker"
    printf '[gsd-beads] ✓ Worktree configured (gsd-beads.dir=%s)\n' "$source_beads"
    # --- END GSD-BEADS WORKTREE INIT ---
    ```
    `chmod +x hooks/worktree-post-checkout.sh`.

    **Step B: Fill in `tests/worktree-tests/auto-config.test.sh`.** Use ephemeral fixture per PATTERNS.md lines 871-885:
    ```bash
    set -euo pipefail
    pass=0; fail=0
    case_run() {
      local name="$1" expected="$2" actual="$3"
      if [ "$expected" = "$actual" ]; then status=PASS; pass=$((pass+1)); else status=FAIL; fail=$((fail+1)); fi
      printf '  [%s] %-50s expected=%-30s actual=%s\n' "$status" "$name" "$expected" "$actual"
    }

    # Locate the project shim
    SHIM="$(pwd)/hooks/worktree-post-checkout.sh"

    # CASE 1: happy path
    fixture=$(mktemp -d); cd "$fixture"
    git init -q && git commit -q --allow-empty -m init
    bd init --non-interactive --skip-agents >/dev/null
    # Append the shim into bd's post-checkout chain (simulating install.sh's append)
    cat "$SHIM" >> .beads/hooks/post-checkout
    chmod +x .beads/hooks/post-checkout
    git config core.hooksPath .beads/hooks
    # Now create a worktree
    git worktree add ../wt main -q 2>&1 | head -5
    cd ../wt
    got=$(git config --worktree --get gsd-beads.dir 2>/dev/null || echo MISSING)
    case_run "auto-config sets gsd-beads.dir" "$fixture/.beads" "$got"

    # CASE 2: marker present
    case_run "marker file present" "yes" "$([ -f "$(git rev-parse --git-dir)/info/.gsd-beads-configured" ] && echo yes || echo no)"

    # ... CASE 3-5 ...

    cd /; rm -rf "$fixture" "$(dirname "$fixture")/wt" 2>/dev/null

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    **Step C: Implement `tests/worktree-tests/append-idempotency.test.sh`.** Build a small inline helper in the test that mimics the install.sh append-with-strip pattern:
    ```bash
    append_shim() {
      local target="$1" shim="$2"
      mkdir -p "$(dirname "$target")"
      [ -f "$target" ] || { echo '#!/usr/bin/env bash' > "$target"; chmod +x "$target"; }
      # Atomic strip-then-append to avoid the sed -i.bak race on T-02-06
      tmp=$(mktemp)
      sed '/^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$/,/^# --- END GSD-BEADS WORKTREE INIT ---$/d' "$target" > "$tmp"
      cat "$shim" >> "$tmp"
      mv "$tmp" "$target"
      chmod +x "$target"
    }
    ```
    Test all 4 CASEs:
    - Empty target file → 1 block
    - Append twice → still 1 block (verified: `grep -c '^# --- BEGIN GSD-BEADS' file` == 1)
    - Target has bd's BEGIN BEADS INTEGRATION block already → both coexist
    - Old v1 block exists, append v2 (mock by changing marker version in shim copy) → old block removed, new block present

    **Threat mitigation (T-02-06):** the append helper uses `mktemp + mv` (atomic rename), avoiding `sed -i.bak` race. Test acceptance criterion verifies `grep -c '\.bak' tests/worktree-tests/append-idempotency.test.sh` is 0 (no `.bak` artifacts left over from sed -i).
  </action>
  <acceptance_criteria>
    - `hooks/worktree-post-checkout.sh` exists and is executable.
    - `grep -c '# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---' hooks/worktree-post-checkout.sh` returns at least 1.
    - `grep -c '# --- END GSD-BEADS WORKTREE INIT ---' hooks/worktree-post-checkout.sh` returns at least 1.
    - `grep -c 'git config --worktree gsd-beads\.dir' hooks/worktree-post-checkout.sh` returns at least 1.
    - `grep -c '\.gsd-beads-configured' hooks/worktree-post-checkout.sh` returns at least 1.
    - `grep -c '\[ "\$flag" = "1" \]' hooks/worktree-post-checkout.sh` returns at least 1 (flag=1 gate).
    - `bash -n hooks/worktree-post-checkout.sh` exits 0.
    - `bash tests/worktree-tests/auto-config.test.sh` exits 0 with `Passed: 5 / 5` (or all listed CASEs pass).
    - `bash tests/worktree-tests/append-idempotency.test.sh` exits 0 with `Passed: 4 / 4`.
    - `grep -c 'sed -i' tests/worktree-tests/append-idempotency.test.sh` returns 0 (T-02-06 mitigation: use mktemp+mv not sed -i).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/worktree-tests/auto-config.test.sh && bash tests/worktree-tests/append-idempotency.test.sh</automated>
  </verify>
  <done>worktree-post-checkout.sh production-ready (sentinel-marked, idempotent via marker, both auto-config and append-idempotency PASS).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| git → post-checkout hook | git invokes hook with controlled args (old_sha, new_sha, flag) — trusted contract |
| install.sh → .beads/hooks/post-checkout (append) | Plan 02-05 modifies user file; race on file write |
| shim → marker file | Worktree gitdir is owned by user — trusted |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-06 | Tampering | install.sh's append into .beads/hooks/post-checkout | mitigate | Use `mktemp + mv` (atomic rename); avoid `sed -i.bak`. Acceptance criterion: `grep -c 'sed -i' tests/worktree-tests/append-idempotency.test.sh` returns 0. The shim itself only writes to `<gitdir>/info/.gsd-beads-configured` (user-owned dir). |
| (Information disclosure on `gsd-beads.dir` value) | — | git config —worktree | accept | Path of source repo is not secret; config is per-worktree (not committed). |
</threat_model>

<verification>
- `bash tests/worktree-tests/auto-config.test.sh` PASSES.
- `bash tests/worktree-tests/append-idempotency.test.sh` PASSES.
- `bash tests/run-quick.sh auto-config && bash tests/run-quick.sh append-idempotency` exits 0.
- `grep -c '^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---' hooks/worktree-post-checkout.sh` returns 1.
- `bash -n hooks/worktree-post-checkout.sh` syntax-clean.
</verification>

<success_criteria>
- hooks/worktree-post-checkout.sh exists with sentinel-marker block, marker-file idempotency, and the bd source-detection guard.
- 2 worktree test suites all PASS (≥9 cases combined).
- REQ-03 satisfied: new worktrees auto-configure `gsd-beads.dir` via `git worktree add` triggering post-checkout.
- Plan 02-05's install.sh has a clear append target — this plan's tests verify the append helper logic.
- T-02-06 mitigated: atomic-write append helper in tests; install.sh in 02-05 will use the same approach.
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-04-SUMMARY.md` documenting:
- The shim script behavior + the 5 cases its handling covers
- The append idempotency contract (Plan 02-05 must use the same `mktemp + mv` pattern)
- T-02-06 mitigation summary
</output>
