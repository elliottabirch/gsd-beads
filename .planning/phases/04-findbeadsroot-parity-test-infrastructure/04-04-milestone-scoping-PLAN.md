---
phase: 04-findbeadsroot-parity-test-infrastructure
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/regen-state.sh
  - tests/fixtures/build-seed.sh
  - tests/fixtures/seed.jsonl
  - tests/fixtures/seed-fixture.sh
  - tests/shadow-tests/seed-determinism.test.sh
  - tests/shadow-tests/milestone-scoping.test.mjs
autonomous: true
requirements:
  - REQ-QUAL-03
must_haves:
  truths:
    - "scripts/regen-state.sh reads worktree-local milestone source via `git config --worktree gsd-beads.milestone` (with `${GSD_MILESTONE:-}` env override for tests); never reads from bd"
    - "scripts/regen-state.sh writes to `.planning/STATE.md` atomically via tmp + mv (per scripts/regen-roadmap.sh:52-56 pattern)"
    - "scripts/regen-state.sh includes the verbatim `--- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---` block from regen-roadmap.sh:16-39"
    - "tests/fixtures/build-seed.sh constructs multi-milestone bd state: v0.1 (closed), v0.2 (in-progress), v0.3 (planned) — labels `gsd:phase`, `version:v0.1`/`v0.2`/`v0.3`"
    - "tests/fixtures/build-seed.sh ends with `bd export --json -o tests/fixtures/seed.jsonl` and is run ONCE manually to produce the committed seed.jsonl"
    - "tests/fixtures/seed-fixture.sh restores the canonical seed via `bd init --from-jsonl tests/fixtures/seed.jsonl --prefix sd --non-interactive --skip-agents`; produces byte-identical bd state"
    - "tests/fixtures/seed.jsonl is committed; embeds bd's JSONL export shape with fixed IDs and timestamps"
    - "tests/shadow-tests/seed-determinism.test.sh asserts `bd export --json` produces byte-identical output across two seed-fixture invocations (D-07)"
    - "tests/shadow-tests/seed-determinism.test.sh also asserts the seed contains v0.1-closed, v0.2-in-progress, v0.3-planned phases (D-08)"
    - "tests/shadow-tests/milestone-scoping.test.mjs proves: WT-A with `git config --worktree gsd-beads.milestone v0.2` regen-state.sh produces STATE.md mentioning v0.2 but NOT v0.3; WT-B with milestone v0.3 produces STATE.md mentioning v0.3 but NOT v0.2; both worktrees share one bd store"
  artifacts:
    - path: "scripts/regen-state.sh"
      provides: "Per-worktree STATE.md regenerator reading worktree-local milestone source"
      contains: "BEGIN GSD-BEADS LOCK PREAMBLE v1"
      min_lines: 60
    - path: "tests/fixtures/build-seed.sh"
      provides: "Source script that builds multi-milestone bd state and exports to tests/fixtures/seed.jsonl"
      min_lines: 40
    - path: "tests/fixtures/seed.jsonl"
      provides: "Committed canonical bd state (output of build-seed.sh)"
      min_lines: 5
    - path: "tests/fixtures/seed-fixture.sh"
      provides: "Restorer that reproduces the committed seed in a target dir via bd init --from-jsonl"
      min_lines: 15
    - path: "tests/shadow-tests/seed-determinism.test.sh"
      provides: "D-07 + D-08: byte-identical bd export across seed runs + multi-milestone phase content"
      min_lines: 40
    - path: "tests/shadow-tests/milestone-scoping.test.mjs"
      provides: "D-05: worktree-A v0.2 view differs from worktree-B v0.3 view against shared bd store"
      min_lines: 50
  key_links:
    - from: "scripts/regen-state.sh"
      to: ".planning/STATE.md"
      via: "tmp file + mv atomic write"
      pattern: "STATE\\.md"
    - from: "tests/fixtures/seed-fixture.sh"
      to: "tests/fixtures/seed.jsonl"
      via: "bd init --from-jsonl"
      pattern: "bd init --from-jsonl"
    - from: "tests/shadow-tests/seed-determinism.test.sh"
      to: "tests/fixtures/seed-fixture.sh"
      via: "bash invocation against two separate tempdirs"
      pattern: "seed-fixture\\.sh"
    - from: "tests/shadow-tests/milestone-scoping.test.mjs"
      to: "scripts/regen-state.sh + tests/fixtures/seed-fixture.sh"
      via: "execSync(`bash ${REPO_ROOT}/scripts/regen-state.sh`) + execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${src}`)"
      pattern: "regen-state\\.sh|seed-fixture\\.sh"
---

<objective>
Land the milestone-scoping plumbing (D-05) plus the deterministic multi-
milestone seeder (D-07/D-08) and the proof-of-scoping integration test.
This is the substrate that makes per-worktree STATE.md views work without
duplicating bd state.

Purpose: REQ-QUAL-03 (worktree-aware project-root detection extended into
the cascade scripts). D-05 expanded acceptance: `regen-state.sh` reads a
worktree-local milestone source (NOT bd) so two worktrees on different
milestones see different STATE.md against ONE shared bd store. D-07/D-08
land a deterministic multi-milestone fixture (v0.1 closed, v0.2 in-progress,
v0.3 planned) that Phases 5-9 reuse for every read-handler parity test.

Output:
- `scripts/regen-state.sh` — NEW per-worktree STATE.md regenerator
- `tests/fixtures/build-seed.sh` — source script for seed.jsonl
- `tests/fixtures/seed.jsonl` — committed canonical multi-milestone state
- `tests/fixtures/seed-fixture.sh` — restorer used by all Phase 4-9 tests
- `tests/shadow-tests/seed-determinism.test.sh` — D-07 reproducibility
- `tests/shadow-tests/milestone-scoping.test.mjs` — D-05 worktree scoping

This plan is independent of Plans 1, 2, 3 — none of its files import from the
sentinel hierarchy or the parity harness. It runs in parallel with Plans 1
and 3 in Wave 1; Plan 2 is the only Wave 2 plan (it depends on Plan 1).
No `files_modified` overlap with any other plan in this phase (WARN-4 fix:
prose previously said "share Wave 2", which contradicted the `wave: 1`
frontmatter — the frontmatter is correct).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-CONTEXT.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-RESEARCH.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-PATTERNS.md
@.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-VALIDATION.md

@scripts/regen-roadmap.sh
@scripts/regen-requirements.sh
@hooks/worktree-post-checkout.sh
@hooks/bd-sync.sh
@tests/fixtures/bd-helpers/3-level-hierarchy.sh
@tests/cross-worktree/lib/setup.sh
@tests/cross-worktree/simulation.sh
@tests/hook-tests/regen-roadmap.test.sh

<interfaces>
<!-- Existing patterns to mirror. -->

scripts/regen-roadmap.sh — exact analog for regen-state.sh:
- Lines 1-14: header pattern (shebang, comment, `set -euo pipefail`)
- Lines 16-39: GSD-BEADS LOCK PREAMBLE v1 (verbatim copy required)
- Lines 44-50: project root resolution
- Lines 52-56 + 261-263: atomic write (tmp + mv) idiom

hooks/worktree-post-checkout.sh:29 — milestone-scoping convention to MIRROR:
```bash
git config --worktree gsd-beads.dir "$source_beads"
```
This plan adds: `git config --worktree gsd-beads.milestone <milestone>`
(read from existing config; SET in milestone-scoping.test.mjs).

tests/fixtures/bd-helpers/3-level-hierarchy.sh — analog for build-seed.sh:
- Header pattern + arg validation
- Pattern of repeated `bd q "Title" -t epic -p N` then `bd label add <id> <label>`

bd version 1.0.3 supports `bd init --from-jsonl <file>` (verified in RESEARCH).
The committed seed.jsonl is bd's JSONL export format (one JSON object per line).

tests/cross-worktree/simulation.sh:46-58 — multi-worktree topology pattern:
- Co-located src + 2 worktrees under one tempdir
- `git -C src worktree add wt-a -b branch-a`
- Cross-worktree assertions via shared BEADS_DIR

REQ-QUAL-03 → D-05 expanded acceptance:
- WT-A: `git config --worktree gsd-beads.milestone v0.2` → regen-state.sh produces STATE.md showing v0.2 phases
- WT-B: `git config --worktree gsd-beads.milestone v0.3` → same shared bd store, different STATE.md

bd label vocabulary (from CONTEXT/RESEARCH):
- `gsd:phase` — marks an epic as a phase
- `version:v0.1` / `version:v0.2` / `version:v0.3` — milestone scoping
- `phase-id:NN` (e.g., `phase-id:01`) — optional ordering aid
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create scripts/regen-state.sh (per-worktree STATE.md regen with lock preamble)</name>
  <files>scripts/regen-state.sh</files>
  <behavior>
    - Has shebang `#!/usr/bin/env bash` and `set -euo pipefail`
    - Includes the GSD-BEADS LOCK PREAMBLE v1 block VERBATIM from `scripts/regen-roadmap.sh:16-39`
    - Resolves project root via `git rev-parse --show-toplevel` → `$CLAUDE_PROJECT_DIR` → `$PWD` (per regen-roadmap.sh:44-50)
    - Reads worktree-local milestone source: `milestone=$(git config --worktree gsd-beads.milestone 2>/dev/null || true)`; falls back to `${GSD_MILESTONE:-}` env override
    - Output path: `$root/.planning/STATE.md`
    - Atomic write: `tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT; ...; mv "$tmp" "$OUT"; trap - EXIT`
    - The STATE.md content includes the milestone label somewhere parseable (e.g., a `**Current milestone:** vX.Y` line) so the milestone-scoping test can grep for it
    - The STATE.md content can be minimal for Phase 4 — the goal is to prove the milestone-scoping wiring; full content lives in Phases 6-7 where progress.* and state.* read handlers ship
    - Phase 4 specifically does NOT call bd from regen-state.sh (D-05: STATE.md is parameterized by worktree-local milestone, NOT bd; milestone-FILTERING of bd state for content lands in Phases 5+)
    - Script is executable (`chmod +x`)
    - Idempotent: byte-stable output for unchanged milestone value
  </behavior>
  <action>
Create `scripts/regen-state.sh` per PATTERNS.md "scripts/regen-state.sh"
section, copying analog idioms from `scripts/regen-roadmap.sh` verbatim.

```bash
#!/usr/bin/env bash
# Regenerate .planning/STATE.md from worktree-local milestone source.
#
# Source of truth: git config --worktree gsd-beads.milestone (worktree-local)
#   + ${GSD_MILESTONE:-} env override (for tests)
# Output: .planning/STATE.md (written atomically via tmp file + mv)
#
# D-05: STATE.md is parameterized by the worktree, NOT bd. Two worktrees on
# different milestones see different STATE.md content while sharing one bd
# store. Milestone-FILTERING of bd state for content (e.g., "show me only
# v0.2 phases") lands in Phases 5+ where progress.* / state.* read handlers
# ship.
#
# Idempotency: byte-stable output for unchanged milestone value.
# T-04-14 mitigation: only writes to .planning/STATE.md.
#
# Stack: bash + git CLI only. No bd, no jq.
set -euo pipefail

# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---
# (verbatim copy from scripts/regen-roadmap.sh:16-39)
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"

if ! command -v flock >/dev/null 2>&1; then
  echo "[gsd-beads] ERROR: flock not installed (macOS: brew install flock)" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"

exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen is in progress at $LOCK — retry shortly" >&2
  exit 1
fi
# --- END GSD-BEADS LOCK PREAMBLE v1 ---

# Project root resolution (verbatim from regen-roadmap.sh:44-50)
if root=$(git rev-parse --show-toplevel 2>/dev/null); then
  : # git root found
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  root="$CLAUDE_PROJECT_DIR"
else
  root="$PWD"
fi

# Read worktree-local milestone source (D-05).
# `git config --worktree` returns empty + non-zero when the key is unset.
milestone=$(git config --worktree gsd-beads.milestone 2>/dev/null || true)
[ -z "$milestone" ] && milestone="${GSD_MILESTONE:-}"
[ -z "$milestone" ] && milestone="(unset)"

OUT="$root/.planning/STATE.md"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

mkdir -p "$(dirname "$OUT")"

# Minimal STATE.md content for Phase 4. Phases 6-7 expand to include
# bd-derived progress + decisions filtered by milestone.
{
  printf -- "---\n"
  printf -- "gsd_state_version: 1.0\n"
  printf -- "milestone: %s\n" "$milestone"
  printf -- "---\n"
  printf -- "\n"
  printf -- "# Project State\n"
  printf -- "\n"
  printf -- "**Current milestone:** %s\n" "$milestone"
  printf -- "\n"
  printf -- "(Generated by scripts/regen-state.sh — do not edit by hand.)\n"
} > "$tmp"

# Atomic write
mv "$tmp" "$OUT"
trap - EXIT
```

`chmod +x scripts/regen-state.sh`.

CRITICAL DETAILS per PATTERNS.md:
- The lock preamble MUST be byte-identical to `regen-roadmap.sh:16-39`
- Project root resolution MUST be byte-identical to `regen-roadmap.sh:44-50`
- Atomic write MUST use `mv "$tmp" "$OUT"; trap - EXIT` to avoid leaving the
  trap firing on the renamed file
- Phase 4 does NOT call bd from this script (D-05 explicitly: "STATE.md is
  parameterized by the worktree, NOT bd"). DO NOT add `bd list ...` calls
  even if it would feel "complete" — that's Phases 6-7 work.
- The minimal STATE.md content includes the milestone label so the
  milestone-scoping test can grep for `v0.2` / `v0.3` / `(unset)`.

DO NOT add a frontmatter `last_updated` timestamp — that would break
idempotency (D-05 acceptance: "byte-stable output for unchanged milestone").

DO NOT touch `hooks/bd-sync.sh:66-70` — that hook already calls
`scripts/regen-state.sh` opportunistically (per CONTEXT.md commit f8903ca);
once this script exists at the canonical install location, the hook finds it
automatically. PATTERNS.md confirms "No hook change is required for Phase 4."
  </action>
  <verify>
    <automated>chmod +x scripts/regen-state.sh && REPO_ROOT="$PWD" && d=$(mktemp -d) && ( cd "$d" && git init -q && git commit -q --allow-empty -m init && GSD_MILESTONE=v-test bash "$REPO_ROOT/scripts/regen-state.sh" && grep -q "Current milestone: v-test" .planning/STATE.md ) && rm -rf "$d" && echo OK</automated>
  </verify>
  <done>
    - `scripts/regen-state.sh` exists, is executable
    - Running `bash scripts/regen-state.sh` from this repo produces a `.planning/STATE.md` with a `**Current milestone:**` line
    - The script contains the verbatim LOCK PREAMBLE block (verifiable via `grep -c "BEGIN GSD-BEADS LOCK PREAMBLE v1" scripts/regen-state.sh` returning 1)
    - Running the script twice produces byte-identical STATE.md (idempotency)
    - WARN-1 fix: the verify command runs the smoke check inside `mktemp -d` (initializes a fresh git repo, sets `GSD_MILESTONE=v-test`, invokes the script there), so it does NOT mutate the live repo's `.planning/STATE.md`. Do NOT replace this with a verify command that runs against `$PWD` — that would re-introduce the WARN-1 hazard the plan-checker flagged.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create build-seed.sh + commit seed.jsonl + create seed-fixture.sh</name>
  <files>
    tests/fixtures/build-seed.sh
    tests/fixtures/seed.jsonl
    tests/fixtures/seed-fixture.sh
  </files>
  <behavior>
    build-seed.sh:
    - Builds multi-milestone bd state in a tempdir, then exports to `tests/fixtures/seed.jsonl`
    - v0.1 milestone: 2 phases (closed) — labels `gsd:phase` + `version:v0.1`
    - v0.2 milestone: 3 phases (in-progress, i.e., open) — labels `gsd:phase` + `version:v0.2`
    - v0.3 milestone: 2 phases (planned, i.e., open) — labels `gsd:phase` + `version:v0.3`
    - Uses `BEADS_ACTOR=seed` on every bd invocation (Pitfall 8 — prevents dev's actor identity from leaking)
    - Uses `--prefix sd` for stable IDs across rebuilds (combined with `--from-jsonl` → byte-identical state)
    - Final step: `BEADS_ACTOR=seed bd export --json -o $REPO_ROOT/tests/fixtures/seed.jsonl`
    - Cleans up tempdir on exit (`trap 'rm -rf $WORK' EXIT`)

    seed.jsonl:
    - Committed artifact produced by build-seed.sh
    - Contains the multi-milestone state in bd's JSONL export format (one JSON object per line)
    - Embedded IDs and timestamps are fixed (preserved by `bd init --from-jsonl`)
    - DO NOT hand-edit this file — regenerate via build-seed.sh

    seed-fixture.sh:
    - Restorer: takes `$1` = target dir, copies seed.jsonl into `$1/.beads/issues.jsonl`, runs `bd init --from-jsonl --prefix sd --non-interactive --skip-agents` in $1
    - Sets `chmod 700 "$target/.beads"` (bd warns at 0755)
    - Idempotent: re-running on the same target reproduces the same bd state
    - Used by every Phase 4-9 fixture that needs multi-milestone bd content
  </behavior>
  <action>
**File 1: tests/fixtures/build-seed.sh**

Create following PATTERNS.md "tests/fixtures/build-seed.sh" section, mirroring
`tests/fixtures/bd-helpers/3-level-hierarchy.sh:1-23` for header + arg
validation, then constructing 7 phases across 3 milestones:

```bash
#!/usr/bin/env bash
# Source-of-truth bash script for tests/fixtures/seed.jsonl.
# CONVENTION (Pitfall 7): seed.jsonl is regenerated from this script,
# NOT hand-edited. PRs change THIS file + commit the regenerated JSONL.
#
# Output: tests/fixtures/seed.jsonl (multi-milestone bd state)
#   - v0.1: 2 phases, all closed
#   - v0.2: 3 phases, in-progress (open)
#   - v0.3: 2 phases, planned (open)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
BEADS_ACTOR=seed bd init --non-interactive --skip-agents --prefix sd >/dev/null

# v0.1 milestone — 2 phases, closed
P11=$(BEADS_ACTOR=seed bd q "v0.1 Phase A: Spike" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P11" gsd:phase
BEADS_ACTOR=seed bd label add "$P11" version:v0.1
BEADS_ACTOR=seed bd close "$P11" >/dev/null

P12=$(BEADS_ACTOR=seed bd q "v0.1 Phase B: Build the layer" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P12" gsd:phase
BEADS_ACTOR=seed bd label add "$P12" version:v0.1
BEADS_ACTOR=seed bd close "$P12" >/dev/null

# v0.2 milestone — 3 phases, open
P21=$(BEADS_ACTOR=seed bd q "v0.2 Phase A: findBeadsRoot" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P21" gsd:phase
BEADS_ACTOR=seed bd label add "$P21" version:v0.2

P22=$(BEADS_ACTOR=seed bd q "v0.2 Phase B: roadmap reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P22" gsd:phase
BEADS_ACTOR=seed bd label add "$P22" version:v0.2

P23=$(BEADS_ACTOR=seed bd q "v0.2 Phase C: progress reads" -t epic -p 1)
BEADS_ACTOR=seed bd label add "$P23" gsd:phase
BEADS_ACTOR=seed bd label add "$P23" version:v0.2

# v0.3 milestone — 2 phases, planned (open)
P31=$(BEADS_ACTOR=seed bd q "v0.3 Phase A: caching" -t epic -p 2)
BEADS_ACTOR=seed bd label add "$P31" gsd:phase
BEADS_ACTOR=seed bd label add "$P31" version:v0.3

P32=$(BEADS_ACTOR=seed bd q "v0.3 Phase B: query optimization" -t epic -p 2)
BEADS_ACTOR=seed bd label add "$P32" gsd:phase
BEADS_ACTOR=seed bd label add "$P32" version:v0.3

# Export to canonical JSONL (committed)
BEADS_ACTOR=seed bd export --json -o "$REPO_ROOT/tests/fixtures/seed.jsonl"
echo "[build-seed] seed.jsonl regenerated at $REPO_ROOT/tests/fixtures/seed.jsonl"
```

`chmod +x tests/fixtures/build-seed.sh`.

**File 2: tests/fixtures/seed.jsonl**

Run `bash tests/fixtures/build-seed.sh` ONCE during this task. The script
produces `tests/fixtures/seed.jsonl` as a side effect; commit the resulting
file. The contents are bd's JSONL export shape — do not hand-craft it.

If `bd init` reports the prefix `sd` is already in use globally on the dev's
machine (rare, but possible if the dev has another `--prefix sd` project),
the build-seed.sh tempdir will fail. In that case, fall back to a more unique
prefix (e.g., `seedv02`); update both build-seed.sh AND seed-fixture.sh to
match. Document this in the SUMMARY.

**File 3: tests/fixtures/seed-fixture.sh**

Create following PATTERNS.md "tests/fixtures/seed-fixture.sh" section + RESEARCH
§Pattern 6 (lines 612-628):

```bash
#!/usr/bin/env bash
# Restores canonical multi-milestone bd fixture into $1.
# Determinism contract (D-07): byte-identical state across runs.
# Strategy: bd init --from-jsonl preserves IDs and created_at/updated_at exactly.
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <directory>" >&2
  exit 1
fi

target="$1"
seed_jsonl="${SEED_JSONL:-$(dirname "$0")/seed.jsonl}"
prefix="${SEED_PREFIX:-sd}"

[ -f "$seed_jsonl" ] || { echo "seed JSONL not found: $seed_jsonl" >&2; exit 1; }

mkdir -p "$target/.beads"
cp "$seed_jsonl" "$target/.beads/issues.jsonl"
( cd "$target" && BEADS_ACTOR=seed bd init --from-jsonl --prefix "$prefix" --non-interactive --skip-agents >/dev/null 2>&1 )
chmod 700 "$target/.beads"
```

`chmod +x tests/fixtures/seed-fixture.sh`.

CRITICAL per PATTERNS.md:
- `BEADS_ACTOR=seed` is load-bearing for determinism (Pitfall 8)
- `--prefix sd` must match the build-seed.sh prefix
- `chmod 700` mitigates bd's 0755-warning at startup

DO NOT pre-load issues.jsonl manually — `bd init --from-jsonl` is the official
mechanism that preserves IDs + timestamps byte-for-byte (RESEARCH verified).
The `cp seed_jsonl > issues.jsonl` step is a hint for bd to find the source;
the `bd init --from-jsonl` argument is what triggers the restore.
  </action>
  <verify>
    <automated>chmod +x tests/fixtures/build-seed.sh tests/fixtures/seed-fixture.sh && bash tests/fixtures/build-seed.sh && test -s tests/fixtures/seed.jsonl && head -1 tests/fixtures/seed.jsonl | grep -qE '^\{' && echo OK</automated>
  </verify>
  <done>
    - All three files exist; build-seed.sh and seed-fixture.sh are executable
    - `tests/fixtures/seed.jsonl` is non-empty and contains bd's JSONL export shape (each line is a JSON object starting with `{`)
    - `wc -l tests/fixtures/seed.jsonl` reports at least 7 lines (one per phase) — likely more due to label/ledger entries
    - `bash tests/fixtures/build-seed.sh` runs cleanly (the tempdir is cleaned on exit)
    - Restoring via `bash tests/fixtures/seed-fixture.sh /tmp/sample-seed-target` produces a working bd store: `cd /tmp/sample-seed-target && bd list --json` returns the 7 phases
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create seed-determinism.test.sh + milestone-scoping.test.mjs</name>
  <files>
    tests/shadow-tests/seed-determinism.test.sh
    tests/shadow-tests/milestone-scoping.test.mjs
  </files>
  <behavior>
    seed-determinism.test.sh:
    - CASE 1 (D-07): Runs `bash $SEED_FIXTURE $tempdir_a` and `bash $SEED_FIXTURE $tempdir_b`; asserts `bd export --json` from each tempdir produces byte-identical output
    - CASE 2 (D-08): Asserts the seed contains `version:v0.1` (closed phases), `version:v0.2` (open phases), `version:v0.3` (open phases) — verified via `bd list -l version:v0.X --type=epic --json | jq` queries against one of the seeded fixtures
    - Uses `pass=0/fail=0` accumulator; final `[ "$fail" -eq 0 ]` exit
    - Cleans up tempdirs

    milestone-scoping.test.mjs:
    - CASE 1 (D-05): Multi-worktree fixture with co-located src + 2 worktrees; seed-fixture.sh produces shared bd store at src/.beads; WT-A configures `git config --worktree gsd-beads.milestone v0.2`; running `bash scripts/regen-state.sh` from WT-A produces `wt-a/.planning/STATE.md` matching `/v0\.2/` and NOT matching `/v0\.3/`
    - CASE 2 (D-05): Same fixture; WT-B configures milestone v0.3; running `bash scripts/regen-state.sh` from WT-B produces `wt-b/.planning/STATE.md` matching `/v0\.3/` and NOT matching `/v0\.2/`
    - Both assertions run against the SAME fixture (shared bd store; different worktrees)
    - Uses `t.after()` for tempdir cleanup
  </behavior>
  <action>
**File 1: tests/shadow-tests/seed-determinism.test.sh**

Create following PATTERNS.md "tests/shadow-tests/seed-determinism.test.sh"
section, mirroring `tests/hook-tests/regen-roadmap.test.sh` CASE 1 (lines
19-51) byte-stable run-twice-and-diff pattern:

```bash
#!/usr/bin/env bash
# seed-determinism.test.sh
# Asserts seeder reproducibility (D-07): two invocations produce byte-identical bd export.
# Asserts multi-milestone content (D-08): v0.1-closed, v0.2-open, v0.3-open phases present.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_FIXTURE="$REPO_ROOT/tests/fixtures/seed-fixture.sh"

pass=0
fail=0

_pass() { echo "[PASS] $1"; pass=$((pass + 1)); }
_fail() { echo "[FAIL] $1"; fail=$((fail + 1)); }

echo "[seed-determinism.test.sh] Running 2 test cases..."
echo ""

# CASE 1: byte-identical bd export across two seeds (D-07)
case1_ok=1
{
  fixture_a=$(mktemp -d)
  fixture_b=$(mktemp -d)
  bash "$SEED_FIXTURE" "$fixture_a" >/dev/null 2>&1
  bash "$SEED_FIXTURE" "$fixture_b" >/dev/null 2>&1
  export_a=$(cd "$fixture_a" && bd export --json)
  export_b=$(cd "$fixture_b" && bd export --json)
  if [ "$export_a" != "$export_b" ]; then
    case1_ok=0
    diff <(printf '%s' "$export_a") <(printf '%s' "$export_b") | head -10
  fi
  rm -rf "$fixture_a" "$fixture_b"
}
if [ "$case1_ok" -eq 1 ]; then
  _pass "CASE 1 (D-07): seed-fixture produces byte-identical bd state"
else
  _fail "CASE 1 (D-07): seed-fixture produces non-deterministic state"
fi

# CASE 2: multi-milestone content (D-08)
case2_ok=1
{
  fixture=$(mktemp -d)
  bash "$SEED_FIXTURE" "$fixture" >/dev/null 2>&1
  v01_count=$(cd "$fixture" && bd list --status=closed -l version:v0.1 --type=epic --json | jq 'length')
  v02_count=$(cd "$fixture" && bd list --status=open -l version:v0.2 --type=epic --json | jq 'length')
  v03_count=$(cd "$fixture" && bd list --status=open -l version:v0.3 --type=epic --json | jq 'length')
  if [ "$v01_count" -ne 2 ] || [ "$v02_count" -ne 3 ] || [ "$v03_count" -ne 2 ]; then
    case2_ok=0
    echo "  v0.1 closed=$v01_count (expected 2), v0.2 open=$v02_count (expected 3), v0.3 open=$v03_count (expected 2)"
  fi
  rm -rf "$fixture"
}
if [ "$case2_ok" -eq 1 ]; then
  _pass "CASE 2 (D-08): seed contains v0.1-closed (2), v0.2-open (3), v0.3-open (2)"
else
  _fail "CASE 2 (D-08): multi-milestone content mismatch"
fi

echo ""
total=$((pass + fail))
echo "Passed: $pass / $total"
[ "$fail" -eq 0 ]
```

`chmod +x tests/shadow-tests/seed-determinism.test.sh`.

NOTE per RESEARCH §Pitfall 5: the determinism contract is on **bd state**
(via `bd export --json`), NOT on filesystem mtimes. Do NOT compare
`.beads/issues.jsonl` files directly — auto-export mtimes will diverge.

**File 2: tests/shadow-tests/milestone-scoping.test.mjs**

Create following PATTERNS.md "tests/shadow-tests/milestone-scoping.test.mjs"
section. Translate `tests/cross-worktree/simulation.sh:46-58` topology to
Node test runner:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '../../..');

function multiMilestoneFixture() {
  const root = mkdtempSync(join(tmpdir(), 'gsd-milestone-'));
  const src = join(root, 'source');
  const wtA = join(root, 'wt-a');
  const wtB = join(root, 'wt-b');
  mkdirSync(src);
  // Init source repo
  execSync('git init -q', { cwd: src });
  execSync('git config user.email t@t.t', { cwd: src });
  execSync('git config user.name t', { cwd: src });
  execSync('git config extensions.worktreeConfig true', { cwd: src });
  execSync('git commit -q --allow-empty -m init', { cwd: src });
  // Seed multi-milestone bd state in source
  execSync(`bash ${REPO_ROOT}/tests/fixtures/seed-fixture.sh ${src}`);
  // Add 2 worktrees
  execSync(`git -C ${src} worktree add ${wtA} -b m-v0.2`, { stdio: 'ignore' });
  execSync(`git -C ${src} worktree add ${wtB} -b m-v0.3`, { stdio: 'ignore' });
  // Set worktree-local milestone (D-05)
  execSync(`git -C ${wtA} config --worktree gsd-beads.milestone v0.2`);
  execSync(`git -C ${wtB} config --worktree gsd-beads.milestone v0.3`);
  // Each worktree needs its own .planning/ dir for STATE.md output
  mkdirSync(join(wtA, '.planning'), { recursive: true });
  mkdirSync(join(wtB, '.planning'), { recursive: true });
  return { root, src, wtA, wtB };
}

test('milestone-scoping CASE 1: WT-A milestone v0.2 produces v0.2 STATE.md', (t) => {
  const { root, wtA } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  execSync(`bash ${REPO_ROOT}/scripts/regen-state.sh`, { cwd: wtA });
  const stateA = readFileSync(join(wtA, '.planning/STATE.md'), 'utf-8');
  assert.match(stateA, /v0\.2/, 'WT-A STATE.md should mention v0.2');
  assert.doesNotMatch(stateA, /v0\.3/, 'WT-A STATE.md should NOT mention v0.3');
});

test('milestone-scoping CASE 2: WT-B milestone v0.3 produces v0.3 STATE.md', (t) => {
  const { root, wtB } = multiMilestoneFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  execSync(`bash ${REPO_ROOT}/scripts/regen-state.sh`, { cwd: wtB });
  const stateB = readFileSync(join(wtB, '.planning/STATE.md'), 'utf-8');
  assert.match(stateB, /v0\.3/, 'WT-B STATE.md should mention v0.3');
  assert.doesNotMatch(stateB, /v0\.2/, 'WT-B STATE.md should NOT mention v0.2');
});
```

CRITICAL per PATTERNS.md "Co-locate src + wt under one tempdir":
- The `root` tempdir contains `src`, `wt-a`, `wt-b` as siblings
- A single `rm -rf root` cleans up both worktree refs and the source repo
- This avoids orphan refs in `<source>/.git/worktrees/`

CRITICAL per PATTERNS.md "milestone-scoping.test.mjs" line about `git config
extensions.worktreeConfig true`: this MUST be set in the source repo before
adding worktrees, otherwise `git config --worktree` writes to the shared
config and BOTH worktrees will see the same milestone (the test will
silently false-positive).

DO NOT add a CASE 3 testing the GSD_MILESTONE env var fallback. Phase 4 only
exercises the git-config path; the env var is for future test hooks.

DO NOT add a CASE testing what happens when neither git-config nor env is
set — that produces `(unset)` in STATE.md (per regen-state.sh fallback);
documented but not asserted in Phase 4 tests.
  </action>
  <verify>
    <automated>bash tests/shadow-tests/seed-determinism.test.sh && node --test tests/shadow-tests/milestone-scoping.test.mjs</automated>
  </verify>
  <done>
    - Both test files exist; `seed-determinism.test.sh` is executable
    - `bash tests/shadow-tests/seed-determinism.test.sh` reports `Passed: 2 / 2`
    - `node --test tests/shadow-tests/milestone-scoping.test.mjs` reports `# pass 2 # fail 0`
    - Multi-milestone fixture is set up + torn down cleanly (no orphan `/tmp/gsd-milestone-*` after run)
    - The `extensions.worktreeConfig true` git config flag is set in the source repo before each worktree-config write (verified by reading the test source)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `git config --worktree gsd-beads.milestone` → `regen-state.sh` STATE.md content | Worktree-local config is OS-user-controlled; gsd-beads has no remote sync of this value |
| `seed.jsonl` (committed) → bd state via `bd init --from-jsonl` | Committed at PR-review time; treated as trusted test data per RESEARCH §Security Domain |
| `BEADS_ACTOR=seed` env override | Forces test fixtures to write with a non-default actor; isolates dev's identity from committed data |
| Multi-worktree test fixture cleanup | mkdtempSync provides random suffix; co-located src+wt under one tempdir means a single rm -rf is sufficient |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-14 | Tampering | `regen-state.sh` writes outside `.planning/STATE.md` | mitigate | Script hard-codes `OUT="$root/.planning/STATE.md"`; atomic mv; no other file writes; mirrors regen-roadmap.sh's T-02-09 mitigation |
| T-04-15 | Tampering | Concurrent regen-state.sh invocations corrupt STATE.md | mitigate | LOCK PREAMBLE v1 (`flock -x -w 30`) on `<source>/.beads/.gsd-beads.lock`; same lock used by other regen scripts so cross-script serialization holds |
| T-04-16 | Information Disclosure | `BEADS_ACTOR` of dev's identity leaks into committed seed.jsonl | mitigate | `BEADS_ACTOR=seed` on every bd invocation in `build-seed.sh` (Pitfall 8) |
| T-04-17 | DoS | seed.jsonl grows unbounded as Phases 5-9 add fixture content | accept | Seed is deliberately small (7 phases); Phase 5+ may extend, but the convention "regenerate from build-seed.sh" keeps growth managed and reviewable |
| T-04-18 | Tampering | Worktree fixture cleanup leaves orphan refs in source `.git/worktrees/` | mitigate | Co-located src + wt-a + wt-b under one tempdir; single rm -rf cleans both (PATTERNS.md verified pattern from cross-worktree/simulation.sh) |
| T-04-19 | Tampering | `git config --worktree` falls back to shared config without `extensions.worktreeConfig true`, causing milestone leakage between worktrees | mitigate | milestone-scoping.test.mjs explicitly sets `git config extensions.worktreeConfig true` on the source repo before adding worktrees |
| T-04-20 | DoS | Multi-milestone fixture parallelism: two test files spawning fixtures collide on bd's global state | mitigate | Each test creates its own mkdtempSync tempdir; `BEADS_ACTOR=seed` env scoped to spawn; node:test default per-file parallelism is acceptable per RESEARCH Pitfall 8 |
</threat_model>

<verification>
After all 3 tasks complete:

```bash
# Verify all artifacts exist
test -x scripts/regen-state.sh
test -x tests/fixtures/build-seed.sh
test -x tests/fixtures/seed-fixture.sh
test -x tests/shadow-tests/seed-determinism.test.sh
test -s tests/fixtures/seed.jsonl
test -f tests/shadow-tests/milestone-scoping.test.mjs

# Run all Phase 4 Plan 04 tests
bash tests/shadow-tests/seed-determinism.test.sh
# Expected: Passed: 2 / 2

node --test tests/shadow-tests/milestone-scoping.test.mjs
# Expected: # pass 2 # fail 0

# Verify lock preamble copy is byte-identical
diff <(sed -n '/--- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---/,/--- END GSD-BEADS LOCK PREAMBLE v1 ---/p' scripts/regen-roadmap.sh) \
     <(sed -n '/--- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---/,/--- END GSD-BEADS LOCK PREAMBLE v1 ---/p' scripts/regen-state.sh)
# Expected: no diff output (byte-identical preamble)

# Verify seed.jsonl is JSONL
head -1 tests/fixtures/seed.jsonl | grep -qE '^\{' && echo OK

# Smoke-test regen-state.sh idempotency
mkdir -p /tmp/gsd-state-check && cd /tmp/gsd-state-check && \
  git init -q && git commit --allow-empty -q -m i && \
  GSD_MILESTONE=v0.99-test bash $REPO/scripts/regen-state.sh && \
  cp .planning/STATE.md state-1.md && \
  GSD_MILESTONE=v0.99-test bash $REPO/scripts/regen-state.sh && \
  diff state-1.md .planning/STATE.md && echo "OK: idempotent"
```
</verification>

<success_criteria>
- `scripts/regen-state.sh` exists, is executable, contains LOCK PREAMBLE v1 verbatim
- Running `regen-state.sh` produces byte-identical STATE.md across runs (idempotency)
- `tests/fixtures/build-seed.sh` produces a valid `tests/fixtures/seed.jsonl` (committed)
- `tests/fixtures/seed-fixture.sh` restores byte-identical bd state across runs
- `tests/shadow-tests/seed-determinism.test.sh` passes 2/2 cases (D-07 + D-08)
- `tests/shadow-tests/milestone-scoping.test.mjs` passes 2/2 cases (D-05 acceptance)
- Multi-worktree fixture is properly torn down (no orphan refs, no orphan tempdirs)
- The lock preamble in `regen-state.sh` is byte-identical to the one in `regen-roadmap.sh` (verified via `diff`)
- Phases 5-9 can `bash tests/fixtures/seed-fixture.sh <tempdir>` to set up a multi-milestone bd state for any read-handler integration test
</success_criteria>

<output>
After completion, create `.planning/phases/04-findbeadsroot-parity-test-infrastructure/04-04-SUMMARY.md` documenting:
- Files created (6) including the committed seed.jsonl
- Test case results (2 + 2 = 4 cases passing)
- Multi-milestone fixture content: 7 phases (2 v0.1 closed, 3 v0.2 open, 2 v0.3 open)
- Key contract: every Phase 5-9 integration test that needs bd state runs `bash tests/fixtures/seed-fixture.sh <tempdir>` for a deterministic multi-milestone fixture
- Key contract: regen-state.sh reads `git config --worktree gsd-beads.milestone` (fallback `${GSD_MILESTONE:-}`); per-worktree STATE.md is the proof point that bd milestone-FILTERING (Phase 6/7 work) lands on a stable substrate
- Note: this plan does NOT touch hooks/bd-sync.sh — the existing opportunistic call site at line 66-70 finds scripts/regen-state.sh automatically once it exists at the canonical install location
- Any deviations from RESEARCH §Pattern 6 / PATTERNS.md (e.g., if `--prefix sd` collided and a different prefix had to be used)
</output>
</content>
</invoke>