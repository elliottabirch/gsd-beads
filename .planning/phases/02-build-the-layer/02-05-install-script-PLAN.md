---
phase: 02-build-the-layer
plan: 05
type: execute
wave: 3
depends_on: [01, 02, 03, 04]
files_modified:
  - install.sh
  - install/memories/vocabulary.md
  - install/memories/state-paths.md
  - install/memories/type-strategy.md
  - install/memories/link-default.md
  - install/memories/discovered-from.md
  - install/memories/todowrite.md
  - install/memories/dolt-push.md
  - recipe/gsd-beads-recipe.md
  - tests/install-tests/idempotency.test.sh
  - tests/install-tests/settings-merge.test.sh
  - tests/install-tests/memory-seeding.test.sh
  - tests/install-tests/path-precedence.test.sh
  - tests/install-tests/no-gsd-core-mutation.test.sh
autonomous: true
requirements: [REQ-02, REQ-06, REQ-08]
requirements_addressed: [REQ-02, REQ-06, REQ-08]
must_haves:
  truths:
    - "install.sh runs as `git clone <repo> && cd gsd-beads && ./install.sh` and produces a fully working layer in one invocation (REQ-06; D-04 revised)"
    - "install.sh deep-merges settings.fragment.json into ~/.claude/settings.json with array dedup on (matcher, command, if) tuple — Pitfall 6"
    - "install.sh symlinks bin/gsd-sdk-shadow.mjs to ~/.local/bin/gsd-sdk and verifies PATH precedence; warns (not aborts) if shadowed (Volta trap — RESEARCH.md A5)"
    - "install.sh seeds 7 bd memories under gsd-beads:* namespace; idempotent via `bd forget` then `bd remember` (REQ-08 — gsd-beads:vocabulary surfaces ready-set guidance)"
    - "install.sh appends hooks/worktree-post-checkout.sh to .beads/hooks/post-checkout via atomic mktemp+mv (Pitfall 7 / T-02-06)"
    - "install.sh NEVER writes anything under ~/.claude/get-shit-done/ (REQ-02; T-02-09 grep guard)"
    - "install.sh is idempotent — running twice produces zero diff in ~/.claude/settings.json, no duplicate marker blocks, refreshes memories"
    - "recipe/gsd-beads-recipe.md is a single-file informational pointer (D-03 revised — bd recipe is discovery surface, not installer; per Pitfall 1)"
  artifacts:
    - path: "install.sh"
      provides: "Self-contained installer — preflight + symlink + settings merge + memory seed + worktree append"
      min_lines: 150
    - path: "install/memories/*.md"
      provides: "7 memory texts seeded into bd under gsd-beads:* namespace"
    - path: "recipe/gsd-beads-recipe.md"
      provides: "Pointer text registered via `bd setup --add gsd-beads <path>` (D-03 revised)"
    - path: "tests/install-tests/idempotency.test.sh"
      provides: "Snapshot 4 files (settings.json, post-checkout, symlink, memories), run install twice, diff = empty"
    - path: "tests/install-tests/settings-merge.test.sh"
      provides: "4 deep-merge cases (empty/no-overlap/partial-overlap/full-conflict) + dedupe on (matcher, command, if)"
    - path: "tests/install-tests/memory-seeding.test.sh"
      provides: "Asserts 7 keys present under gsd-beads:*"
    - path: "tests/install-tests/path-precedence.test.sh"
      provides: "Asserts ~/.local/bin/gsd-sdk resolves via `command -v`; emits remediation if shadowed"
    - path: "tests/install-tests/no-gsd-core-mutation.test.sh"
      provides: "Grep guard: `grep -r '~/.claude/get-shit-done' install.sh` → 0; sentinel test: drop a sentinel file under ~/.claude/get-shit-done/, run install in a sandboxed HOME, verify sentinel untouched"
  key_links:
    - from: "install.sh"
      to: "settings.fragment.json"
      via: "jq -s deep-merge with dedup pattern"
      pattern: "jq.*\\.hooks.*unique_by"
    - from: "install.sh"
      to: "bin/gsd-sdk-shadow.mjs"
      via: "ln -sf to ~/.local/bin/gsd-sdk"
      pattern: "ln -sf.*gsd-sdk-shadow\\.mjs.*\\.local/bin/gsd-sdk"
    - from: "install.sh"
      to: "bd remember --key gsd-beads:*"
      via: "loop over install/memories/*.md"
      pattern: "bd remember.*gsd-beads:"
    - from: "install.sh"
      to: "hooks/worktree-post-checkout.sh"
      via: "mktemp + sed strip + cat append + mv"
      pattern: "worktree-post-checkout\\.sh"
---

<objective>
Build the self-contained `install.sh` (per D-04 revised — `git clone && ./install.sh` is the canonical install path) and the 7 bd memory seed files. The recipe itself becomes a single-file pointer (D-03 revised — Pitfall 1).

This is the single user-facing entry point. After running it on a fresh project, the user has:
1. 3 hook entries deep-merged into `~/.claude/settings.json`
2. Shadow binary symlinked to `~/.local/bin/gsd-sdk` with PATH-precedence warning
3. 7 bd memories seeded under `gsd-beads:*` namespace (REQ-08 — vocabulary mentions `bd ready`)
4. `worktree-post-checkout.sh` appended to `.beads/hooks/post-checkout` (sentinel-marked, idempotent)
5. Discovery via `bd setup --list` showing `gsd-beads` (recipe registration; informational)

Hard constraint: install.sh MUST NOT write anywhere under `~/.claude/get-shit-done/` (REQ-02 / T-02-09).

Wave-3, depends on Plans 02-01 (helper scripts), 02-02 (hook scripts + settings.fragment.json), 02-03 (shadow binary), 02-04 (worktree shim).

Purpose: Versioned, installable distribution (REQ-06).
Output: 1 install script + 7 memory files + 1 recipe pointer + 5 test suites.
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
@.claude/skills/spike-findings-gsd-beads/references/gsd-ecosystem-integration.md
@settings.fragment.json
@hooks/block-state-md.sh
@hooks/bd-sync.sh
@hooks/block-gsd-sdk-mutation.sh
@hooks/worktree-post-checkout.sh
@bin/gsd-sdk-shadow.mjs
@bin/wrap-mutation.mjs
@scripts/cascade-loop.sh
@scripts/regen-roadmap.sh
@scripts/regen-requirements.sh

<interfaces>
<!-- bd CLI surface for install -->

`bd setup --add <name> <path>` — register recipe (path is destination of bd's bundled template per Pitfall 1)
`bd setup --list` — list registered recipes
`bd setup --print <name>` — preview registered recipe
`bd remember --key <key> "<text>"` — write a memory (replaces existing if key exists)
`bd forget <key>` — delete a memory
`bd memories` — list all memories
`bd memories <prefix>` — search memories by prefix

<!-- jq deep-merge pattern (Pitfall 6 — verified shape) -->
```bash
jq -s '.[0] * .[1] | .hooks |= (
  to_entries | map(.value |=
    (group_by(.matcher) | map(
      .[0] + {hooks: (map(.hooks) | flatten | unique_by("\(.command)\(.if // "")"))}
    ))
  ) | from_entries
)' existing.json fragment.json > merged.json
```

<!-- Canonical bd memory keys (per SKILL.md) -->
- gsd-beads:vocabulary
- gsd-beads:state-paths
- gsd-beads:type-strategy
- gsd-beads:link-default
- gsd-beads:discovered-from
- gsd-beads:todowrite
- gsd-beads:dolt-push
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0): Create 5 install test stubs + 7 memory text files + recipe pointer</name>
  <files>
    tests/install-tests/idempotency.test.sh,
    tests/install-tests/settings-merge.test.sh,
    tests/install-tests/memory-seeding.test.sh,
    tests/install-tests/path-precedence.test.sh,
    tests/install-tests/no-gsd-core-mutation.test.sh,
    install/memories/vocabulary.md,
    install/memories/state-paths.md,
    install/memories/type-strategy.md,
    install/memories/link-default.md,
    install/memories/discovered-from.md,
    install/memories/todowrite.md,
    install/memories/dolt-push.md,
    recipe/gsd-beads-recipe.md
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (Test files NEW — tests/install-tests section, lines 856-867; recipe/gsd-beads-recipe.md section lines 700-733)
    - .planning/phases/02-build-the-layer/02-VALIDATION.md (per-task verification map for 02-05)
    - .planning/spikes/MANIFEST.md (canonical bd memory key list — line 51)
    - .claude/skills/spike-findings-gsd-beads/references/gsd-ecosystem-integration.md (memory content guidance)
    - .claude/skills/spike-findings-gsd-beads/SKILL.md (vocabulary content for the 7 memories)
  </read_first>
  <action>
    Create 13 files. Total target: 5 stubs + 7 memory texts + 1 recipe pointer.

    **Memory text files** (each is plain markdown, single-paragraph or list — used by install.sh as `bd remember --key gsd-beads:<name> "$(cat install/memories/<name>.md)"`):

    `install/memories/vocabulary.md`:
    ```
    gsd-beads vocabulary:

    - Workflow state lives in beads (.beads/issues.jsonl auto-exported, git-tracked).
    - State-bearing markdown (.planning/ROADMAP.md, REQUIREMENTS.md, todos/, seeds/) is REGENERATED from bd state by bd-sync.sh — DO NOT edit those files directly; the PreToolUse hook denies it.
    - Narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md) is unaffected.
    - Upstream /gsd-* commands (e.g., /gsd-add-phase, /gsd-add-todo) work transparently via the gsd-sdk shadow at ~/.local/bin/gsd-sdk in beads-managed projects.
    - `bd ready` is the canonical "what should I work on next?" — replaces manual roadmap scanning (REQ-08).
    ```

    `install/memories/state-paths.md`:
    ```
    State-bearing paths (denied by PreToolUse(Edit|Write) hook block-state-md.sh):
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/todos/**
    - .planning/seeds/**

    Both absolute and relative path shapes are denied. To mutate state, run upstream /gsd-* commands (they route through the shadow into beads) or use bd directly. After a state-changing bd command, bd-sync.sh regenerates the markdown views.
    ```

    `install/memories/type-strategy.md`:
    ```
    Beads modeling for gsd-beads (per Spike 002):
    - Both requirement-level and phase-level beads use type=epic, distinguished by labels:
      - gsd:requirement for top-level requirements
      - gsd:phase for middle-level phases
    - Tasks use the built-in type=task.
    - Cascade closure is `bd epic close-eligible` in a 5-line loop (cascade-loop.sh) — 3× faster than custom-types alternative.
    - DO NOT use custom types `requirement`/`phase` — rejected in Spike 002.
    ```

    `install/memories/link-default.md`:
    ```
    Always use `bd link <child> <parent> --type parent-child` for hierarchy edges (NOT `bd dep add`'s default `blocks` — wrong semantics).
    For dependency edges between phases (which phase blocks which): `bd link <blocked> <blocker> --type blocks`.
    For tree rendering use `bd children <id>`, NOT `bd dep tree` (which walks blocks not parent-child).
    ```

    `install/memories/discovered-from.md`:
    ```
    The architecture's signature feature: provenance edges via `discovered-from`.

    When you uncover missed work mid-phase, file it with:
      bd link <new-task> <originating-task> --type discovered-from

    In addition to the parent-child link to its proper home in the hierarchy. This preserves the "where did this come from?" forensic trail without polluting the main hierarchy.
    ```

    `install/memories/todowrite.md`:
    ```
    TodoWrite carve-out:
    - Claude Code's built-in TodoWrite tool is allowed for in-session ephemeral progress tracking (current task's sub-steps, scratch state).
    - Cross-session work items, requirements, phases, and todos go in beads — NOT TodoWrite.
    - The PreToolUse hook does NOT match TodoWrite (it only matches Edit|Write).
    ```

    `install/memories/dolt-push.md`:
    ```
    `bd dolt push` is for federation/remote sync, NOT for local cross-worktree sync.
    - Local cross-worktree: shared via BEADS_DIR (set per-worktree by the post-checkout shim). No bd dolt push needed.
    - Federation across machines: bd federation feature (deferred for MVP).
    Don't reflexively call bd dolt push after every cross-worktree change.
    ```

    **`recipe/gsd-beads-recipe.md`** (per PATTERNS.md lines 700-733):
    ```markdown
    # gsd-beads

    This recipe is a discovery pointer. The actual gsd-beads layer ships as a separate repository.

    ## Install

        git clone https://github.com/<owner>/gsd-beads
        cd gsd-beads
        ./install.sh

    After install:
    - `~/.claude/settings.json` is patched with 3 hooks (deep-merged, deduped)
    - `~/.local/bin/gsd-sdk` symlinks to the shadow binary
    - bd memories under `gsd-beads:*` are seeded
    - Worktree post-checkout shim is appended to `.beads/hooks/post-checkout`

    ## Verify

        bd memories | grep gsd-beads:
        command -v gsd-sdk    # should resolve to ~/.local/bin/gsd-sdk

    Per Pitfall 1, this template's content is informational — bd's recipe-add slot is a single-file template writer; the actual install work happens via `install.sh` in the cloned repo.
    ```

    **5 test stubs** (each starts with `#!/usr/bin/env bash`, `set -euo pipefail`, echoes STUB and exits 1):

    `tests/install-tests/idempotency.test.sh` cases:
    - CASE 1: snapshot ~/.claude/settings.json before, run install.sh, run again, diff before-after-2 == after-1.
    - CASE 2: marker block in .beads/hooks/post-checkout count == 1 after running install twice.
    - CASE 3: ~/.local/bin/gsd-sdk symlink exists and points at the same target after both runs.
    - CASE 4: 7 bd memories present after both runs (idempotent forget+remember).

    `tests/install-tests/settings-merge.test.sh` cases:
    - CASE 1: empty existing settings.json + fragment → fragment becomes the entire hooks block.
    - CASE 2: existing has different hooks (no overlap) → both sets present after merge.
    - CASE 3: partial overlap (existing has same matcher, different command) → both retained, no dedup.
    - CASE 4: full conflict (same matcher + command + if) → deduped to one entry.

    `tests/install-tests/memory-seeding.test.sh`:
    - CASE 1-7: each of 7 keys present after install.
    - CASE 8: re-running install does not duplicate (forget then re-add — only 7 keys).

    `tests/install-tests/path-precedence.test.sh`:
    - CASE 1: PATH has ~/.local/bin first → `command -v gsd-sdk` resolves to it; install.sh prints "✓ shadow active".
    - CASE 2: PATH has ~/.volta/bin first → install.sh prints "⚠ shadow at ~/.local/bin/gsd-sdk is shadowed by <other> — fix PATH" (does NOT abort).
    - CASE 3: ~/.local/bin not in PATH at all → warns + suggests adding to ~/.profile.

    `tests/install-tests/no-gsd-core-mutation.test.sh` cases:
    - CASE 1: `grep -r '~/.claude/get-shit-done/' install.sh` → 0 matches (T-02-09 static check).
    - CASE 2: drop a sentinel file `~/.claude/get-shit-done/SENTINEL` (in sandboxed HOME), run install.sh, verify sentinel untouched (mtime unchanged).
    - CASE 3: `grep -r '\.claude/get-shit-done' tests/install-tests/` (excluding self) → only 0 (we don't reference it from other test files).

    `chmod +x` all 5 test stubs.
  </action>
  <acceptance_criteria>
    - All 13 files exist.
    - `ls install/memories/*.md | wc -l` returns 7.
    - `recipe/gsd-beads-recipe.md` contains string `git clone` and string `install.sh`.
    - `grep -c gsd-beads-init recipe/gsd-beads-recipe.md` returns 0 (D-03 revised — recipe is pointer, not installer).
    - All 5 test stubs are executable, syntactically valid (`bash -n`), and exit 1.
    - `grep -c '^# CASE' tests/install-tests/idempotency.test.sh` returns at least 4.
    - `grep -c '^# CASE' tests/install-tests/settings-merge.test.sh` returns at least 4.
    - `grep -c '^# CASE' tests/install-tests/memory-seeding.test.sh` returns at least 7.
    - `grep -c '^# CASE' tests/install-tests/path-precedence.test.sh` returns at least 3.
    - `grep -c '^# CASE' tests/install-tests/no-gsd-core-mutation.test.sh` returns at least 3.
  </acceptance_criteria>
  <verify>
    <automated>for f in tests/install-tests/*.test.sh; do bash -n "$f"; done && [ "$(ls install/memories/*.md | wc -l)" = "7" ] && grep -q 'git clone' recipe/gsd-beads-recipe.md</automated>
  </verify>
  <done>13 input files in place. Tests are red Wave 0 markers. 7 memory texts ready for seeding. Recipe is informational pointer.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 3): Implement install.sh + complete 5 install test suites</name>
  <files>
    install.sh,
    tests/install-tests/idempotency.test.sh,
    tests/install-tests/settings-merge.test.sh,
    tests/install-tests/memory-seeding.test.sh,
    tests/install-tests/path-precedence.test.sh,
    tests/install-tests/no-gsd-core-mutation.test.sh
  </files>
  <read_first>
    - .planning/phases/02-build-the-layer/02-PATTERNS.md (scripts/install.sh section lines 633-697 — pre-flight, settings deep-merge with dedup, symlink + PATH precedence, memory seeding, worktree append)
    - .planning/phases/02-build-the-layer/02-RESEARCH.md (Pitfall 1 — install.sh does the real work; Pitfall 6 — settings.json deep-merge dedup; Pitfall 7 — worktree append; Runtime State Inventory lines 367-386)
    - .planning/phases/02-build-the-layer/02-CONTEXT.md (D-03/D-04/D-05 revised — install is `git clone && ./install.sh`; recipe is pointer)
    - settings.fragment.json (the fragment to merge)
    - bin/gsd-sdk-shadow.mjs, hooks/*.sh, scripts/*.sh (the artifacts to install)
    - install/memories/*.md (the 7 memory texts to seed)
    - hooks/worktree-post-checkout.sh (the shim to append into .beads/hooks/post-checkout)
  </read_first>
  <behavior>
    - Test 1 (PRE-FLIGHT): missing bd → exit non-zero with `ERROR: bd not installed`. Same for jq, node. node <22 → ERROR.
    - Test 2 (SETTINGS MERGE): all 4 settings-merge cases PASS — dedup keyed on (matcher, command, if).
    - Test 3 (SYMLINK): ~/.local/bin/gsd-sdk exists and is symlink to absolute path of bin/gsd-sdk-shadow.mjs.
    - Test 4 (PATH WARN): when ~/.volta/bin precedes ~/.local/bin, install.sh emits `⚠ shadow at ~/.local/bin/gsd-sdk is shadowed by <other>` AND exits 0 (warn-not-abort per RESEARCH.md A5).
    - Test 5 (MEMORY SEED): all 7 keys under gsd-beads:* present after install (verified via `bd memories | grep gsd-beads:`).
    - Test 6 (WORKTREE APPEND): .beads/hooks/post-checkout contains exactly 1 BEGIN..END block; running install twice → still 1 block.
    - Test 7 (T-02-09 GUARD): grep guard + sentinel sandbox test PASS — no writes under ~/.claude/get-shit-done/.
    - Test 8 (IDEMPOTENCY): running install.sh twice produces zero diff in ~/.claude/settings.json, no duplicate marker, refreshes memories.
  </behavior>
  <action>
    **Step A: Implement `install.sh`.** Comprehensive script per PATTERNS.md install.sh section + Runtime State Inventory.

    ```bash
    #!/usr/bin/env bash
    # gsd-beads installer — self-contained per D-04 revised.
    # Idempotent (REQ-06). Never touches ~/.claude/get-shit-done/ (REQ-02 / T-02-09).
    set -euo pipefail

    REPO="$(cd "$(dirname "$0")" && pwd -P)"
    HOOKS_DEST="$HOME/.claude/hooks"
    SCRIPTS_DEST="$HOME/.claude/scripts"
    BIN_DEST="$HOME/.local/bin"
    SETTINGS="$HOME/.claude/settings.json"
    FRAGMENT="$REPO/settings.fragment.json"

    # ── Step 1: Pre-flight ──────────────────────────────────────────────
    require() {
      command -v "$1" >/dev/null 2>&1 || { echo "ERROR: $1 not installed"; exit 1; }
    }
    require bd
    require jq
    require node
    require git
    node -e 'process.exit(parseInt(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' \
      || { echo "ERROR: node ≥22 required (have $(node --version))"; exit 1; }

    # ── Step 2: Mirror hook + script files into ~/.claude/ ──────────────
    # IMPORTANT (REQ-02): we write under ~/.claude/{hooks,scripts}/ — NEVER under ~/.claude/get-shit-done/.
    mkdir -p "$HOOKS_DEST" "$SCRIPTS_DEST" "$BIN_DEST"

    install_file() {
      local src="$1" dest="$2"
      cp -p "$src" "$dest"
      chmod +x "$dest"
    }
    install_file "$REPO/hooks/block-state-md.sh"          "$HOOKS_DEST/block-state-md.sh"
    install_file "$REPO/hooks/bd-sync.sh"                 "$HOOKS_DEST/bd-sync.sh"
    install_file "$REPO/hooks/block-gsd-sdk-mutation.sh"  "$HOOKS_DEST/block-gsd-sdk-mutation.sh"
    install_file "$REPO/scripts/cascade-loop.sh"          "$SCRIPTS_DEST/cascade-loop.sh"
    install_file "$REPO/scripts/regen-roadmap.sh"         "$SCRIPTS_DEST/regen-roadmap.sh"
    install_file "$REPO/scripts/regen-requirements.sh"    "$SCRIPTS_DEST/regen-requirements.sh"

    # ── Step 3: Settings.json deep-merge with dedup (Pitfall 6) ─────────
    [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
    tmp="$(mktemp)"
    jq -s '.[0] * .[1] | .hooks |= (
      to_entries | map(.value |=
        (group_by(.matcher) | map(
          .[0] + {hooks: (map(.hooks) | flatten | unique_by("\(.command)\(.if // "")"))}
        ))
      ) | from_entries
    )' "$SETTINGS" "$FRAGMENT" > "$tmp"
    mv "$tmp" "$SETTINGS"   # Atomic; T-02-07 mitigation

    # ── Step 4: Shadow binary symlink + PATH precedence check (RESEARCH.md A5) ─
    SHADOW="$REPO/bin/gsd-sdk-shadow.mjs"
    chmod +x "$SHADOW"
    chmod +x "$REPO/bin/wrap-mutation.mjs"
    ln -sfn "$SHADOW" "$BIN_DEST/gsd-sdk"

    first="$(command -v gsd-sdk 2>/dev/null || true)"
    case "$first" in
      "$BIN_DEST/gsd-sdk")
        echo "✓ shadow active at $BIN_DEST/gsd-sdk" ;;
      "")
        echo "⚠ ~/.local/bin/gsd-sdk symlinked but ~/.local/bin not on PATH — add 'export PATH=\"\$HOME/.local/bin:\$PATH\"' to your shell rc" ;;
      *)
        echo "⚠ shadow at $BIN_DEST/gsd-sdk is shadowed by $first — prepend ~/.local/bin to PATH (Volta users: edit ~/.profile)" ;;
    esac

    # ── Step 5: Seed bd memories (idempotent: forget then remember) ────
    for f in "$REPO"/install/memories/*.md; do
      key="gsd-beads:$(basename "$f" .md)"
      bd forget "$key" 2>/dev/null || true
      bd remember --key "$key" "$(cat "$f")"
    done
    echo "✓ seeded $(ls "$REPO"/install/memories/*.md | wc -l) bd memories under gsd-beads:*"

    # ── Step 6: Worktree post-checkout shim append (Pitfall 7 / T-02-06) ─
    # Only append if the project has .beads/ AND we're being run inside a project (not just from gsd-beads repo).
    if [ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]; then
      target="$PWD/.beads/hooks/post-checkout"
      mkdir -p "$(dirname "$target")"
      [ -f "$target" ] || { echo '#!/usr/bin/env bash' > "$target"; chmod +x "$target"; }
      tmp_pc="$(mktemp)"
      sed '/^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$/,/^# --- END GSD-BEADS WORKTREE INIT ---$/d' \
        "$target" > "$tmp_pc"
      cat "$REPO/hooks/worktree-post-checkout.sh" >> "$tmp_pc"
      mv "$tmp_pc" "$target"
      chmod +x "$target"
      echo "✓ appended worktree shim to $target"
    fi

    # ── Step 7: Register bd recipe (informational discovery — D-03 revised) ─
    bd setup --add gsd-beads "$REPO/recipe/gsd-beads-recipe.md" 2>/dev/null || true

    echo ""
    echo "✓ gsd-beads installed."
    echo "  Run \`bd memories gsd-beads\` to verify."
    echo "  Run \`gsd-sdk --version\` to verify shadow binding."
    ```
    `chmod +x install.sh`.

    **Step B: Fill in the 5 install test suites.** Each test runs in an isolated `HOME=$(mktemp -d)` sandbox to avoid mutating the real user's settings/memories.

    Pattern for each test:
    ```bash
    set -euo pipefail
    pass=0; fail=0
    SANDBOX=$(mktemp -d)
    export HOME="$SANDBOX"
    mkdir -p "$HOME/.claude" "$HOME/.local/bin"
    REPO_ROOT="$(git rev-parse --show-toplevel)"
    trap "rm -rf '$SANDBOX'" EXIT
    # ... run "$REPO_ROOT/install.sh" and assert ...
    ```

    For `tests/install-tests/no-gsd-core-mutation.test.sh` (T-02-09 — most critical):
    ```bash
    # CASE 1: static grep guard
    if grep -q '~/.claude/get-shit-done\|/.claude/get-shit-done/' "$REPO_ROOT/install.sh"; then
      echo "[FAIL] install.sh references gsd core path (REQ-02 violation)"
      fail=$((fail+1))
    else
      pass=$((pass+1))
    fi

    # CASE 2: sentinel sandbox test
    SANDBOX=$(mktemp -d); export HOME="$SANDBOX"
    mkdir -p "$HOME/.claude/get-shit-done"
    sentinel="$HOME/.claude/get-shit-done/SENTINEL"
    echo "untouched" > "$sentinel"
    chmod 444 "$sentinel"
    sent_mtime_before=$(stat -c %Y "$sentinel" 2>/dev/null || stat -f %m "$sentinel")
    sleep 1
    bash "$REPO_ROOT/install.sh" >/dev/null 2>&1 || true
    sent_mtime_after=$(stat -c %Y "$sentinel" 2>/dev/null || stat -f %m "$sentinel")
    if [ "$sent_mtime_before" = "$sent_mtime_after" ]; then pass=$((pass+1)); else fail=$((fail+1)); fi

    # CASE 3: cross-grep
    if grep -rq '\.claude/get-shit-done' tests/install-tests/ 2>/dev/null | grep -v 'no-gsd-core-mutation'; then
      fail=$((fail+1))
    else
      pass=$((pass+1))
    fi

    echo "Passed: $pass / $((pass+fail))"
    [ "$fail" -eq 0 ]
    ```

    For `tests/install-tests/idempotency.test.sh`:
    ```bash
    # Snapshot ~/.claude/settings.json after first install
    bash "$REPO_ROOT/install.sh"
    snapshot1=$(sha256sum "$HOME/.claude/settings.json" | awk '{print $1}')
    bash "$REPO_ROOT/install.sh"
    snapshot2=$(sha256sum "$HOME/.claude/settings.json" | awk '{print $1}')
    [ "$snapshot1" = "$snapshot2" ] && pass=$((pass+1)) || fail=$((fail+1))
    # ... rest of cases
    ```

    For `tests/install-tests/settings-merge.test.sh`: build 4 fixture settings.json files (empty, no-overlap, partial, full-conflict), run install merge logic on each, assert dedup count.

    For `tests/install-tests/memory-seeding.test.sh`: after install, assert 7 keys via `bd memories | grep '^gsd-beads:' | wc -l` == 7.

    For `tests/install-tests/path-precedence.test.sh`: simulate 3 PATH scenarios via `PATH=...` overrides, run install, capture stdout, grep for `✓ shadow active` or `⚠ shadow at`.

    **Threat mitigation (T-02-07):** settings.json merge uses `jq` (not heredoc) and atomic `mv tmp settings.json`. Acceptance: `grep -c 'cat << ' install.sh` returns 0.

    **Threat mitigation (T-02-09):** Tests 1-3 above. The static grep is the strongest guard.
  </action>
  <acceptance_criteria>
    - `install.sh` exists, executable.
    - `grep -c 'command -v bd' install.sh` returns at least 1.
    - `grep -c 'jq -s' install.sh` returns at least 1 (Pitfall 6 deep-merge).
    - `grep -c 'unique_by' install.sh` returns at least 1 (dedup).
    - `grep -c 'ln -sf' install.sh` returns at least 1.
    - `grep -c 'bd remember' install.sh` returns at least 1.
    - `grep -c 'bd forget' install.sh` returns at least 1 (idempotent seeding).
    - `grep -c 'BEGIN GSD-BEADS WORKTREE INIT' install.sh` returns at least 1 (sentinel).
    - `grep -c 'mv "$tmp"' install.sh` returns at least 1 (atomic write — T-02-07).
    - `grep -c '~/.claude/get-shit-done\|/.claude/get-shit-done/' install.sh` returns 0 (T-02-09; REQ-02).
    - `grep -c 'cat <<\| <<EOF' install.sh` returns 0 (CONVENTIONS — no heredoc for JSON).
    - `bash -n install.sh` exits 0.
    - All 5 install tests pass:
      - `bash tests/install-tests/idempotency.test.sh` exits 0.
      - `bash tests/install-tests/settings-merge.test.sh` exits 0.
      - `bash tests/install-tests/memory-seeding.test.sh` exits 0 (7/7 keys).
      - `bash tests/install-tests/path-precedence.test.sh` exits 0.
      - `bash tests/install-tests/no-gsd-core-mutation.test.sh` exits 0 (3/3 guards green).
  </acceptance_criteria>
  <verify>
    <automated>bash tests/install-tests/no-gsd-core-mutation.test.sh && bash tests/install-tests/idempotency.test.sh && bash tests/install-tests/settings-merge.test.sh && bash tests/install-tests/memory-seeding.test.sh && bash tests/install-tests/path-precedence.test.sh</automated>
  </verify>
  <done>install.sh production-ready with deep-merge + dedup, atomic settings.json write, idempotent memory seeding, sentinel-marker worktree append, PATH-precedence warning, REQ-02 grep guard. All 5 install test suites PASS.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user → install.sh | User-trusted invocation; we operate on user's $HOME |
| install.sh → ~/.claude/settings.json | Mutates user state; must be atomic + dedup-safe |
| install.sh → ~/.local/bin/gsd-sdk | Symlink creation in user space |
| install.sh → bd memories | Seeds workflow guidance |
| install.sh → upstream gsd | MUST NOT touch ~/.claude/get-shit-done/ (REQ-02) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-07 | Tampering / DoS | install.sh settings.json deep-merge | mitigate | Use `jq -s` + atomic `mv tmp settings.json`. Reject heredoc-based JSON construction (acceptance: `grep -c 'cat <<' install.sh` returns 0). The dedup `unique_by("\(.command)\(.if // "")")` includes `if` filter (Pitfall 6 — same command + different if are distinct). |
| T-02-08 | DoS / User experience | install.sh PATH precedence check | accept (warn, do not auto-fix) | Detect Volta-shadow trap; emit warning with remediation steps. Do NOT modify ~/.profile automatically (intrusive — out of scope per RESEARCH.md A5 / Open Question 5). |
| T-02-09 | Tampering (REQ-02 violation) | install.sh + tests | mitigate | Static grep guard rejects any reference to `~/.claude/get-shit-done/`; sentinel sandbox test verifies install does not modify a sentinel file dropped under that path. Both tests in `tests/install-tests/no-gsd-core-mutation.test.sh`. |
| T-02-06 | Tampering | install.sh worktree-post-checkout append | mitigate | Use `mktemp + sed -strip-block + cat append + mv` (atomic rename, no `sed -i.bak`). The sentinel marker `# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---` is the dedup key. |
</threat_model>

<verification>
- All 5 install test suites PASS.
- `grep -c '~/.claude/get-shit-done\|/.claude/get-shit-done/' install.sh` returns 0.
- `grep -c 'jq -s' install.sh` returns at least 1.
- `grep -c 'cat <<\| <<EOF' install.sh` returns 0.
- `bash -n install.sh` exits 0.
- After running install.sh in a sandbox HOME, `[ -L "$HOME/.local/bin/gsd-sdk" ]` is true.
- `bd memories | grep -c '^gsd-beads:'` returns 7 after install.
</verification>

<success_criteria>
- install.sh is the canonical entrypoint (D-04 revised) — `git clone && ./install.sh` produces a fully working layer.
- Settings.json deep-merge correctly handles all 4 cases including `if`-filter dedup (Pitfall 6).
- Symlink to ~/.local/bin/gsd-sdk + PATH precedence warning (Volta-trap aware per RESEARCH.md A5).
- 7 bd memories seeded under `gsd-beads:*` namespace; idempotent.
- worktree-post-checkout.sh appended to .beads/hooks/post-checkout via sentinel-marker (Pitfall 7); idempotent.
- Recipe registered with `bd setup --add gsd-beads <path>` for discovery (D-03 revised — informational pointer only).
- REQ-02 honored: no writes under ~/.claude/get-shit-done/. Verified by static grep + sentinel sandbox test.
- REQ-06 honored: idempotent installation; running twice produces zero diff.
- REQ-08 honored: gsd-beads:vocabulary memory mentions `bd ready` as canonical "what's next".
</success_criteria>

<output>
After completion, create `.planning/phases/02-build-the-layer/02-05-SUMMARY.md` documenting:
- The install.sh contract (steps 1-7), invocation (`git clone && ./install.sh`)
- The 7 bd memory keys seeded
- Settings.json deep-merge dedup key (matcher, command, if)
- T-02-07, T-02-08, T-02-09, T-02-06 mitigations
- The Volta-PATH-trap warning text users will see
</output>
