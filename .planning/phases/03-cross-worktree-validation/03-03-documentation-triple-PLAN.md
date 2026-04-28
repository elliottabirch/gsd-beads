---
phase: 03
plan: 03
type: execute
wave: 3
depends_on: ["03-02"]
files_modified:
  - install/memories/worktrees.md
  - docs/WORKTREES.md
  - docs/WORKTREES-EVIDENCE.md
  - README.md
autonomous: true
gap_closure: false
requirements_addressed: [REQ-03]
tags: [documentation, memory-seeding, worktrees, REQ-03, install.sh]
user_setup: []

must_haves:
  goal: "Three-layer documentation surface ships: bd memory #8 (gsd-beads:worktrees) seeded by install.sh's existing memory-loop, README \"Multi-worktree setup\" section linking out, and full docs/WORKTREES.md (setup + lifecycle + troubleshooting). docs/WORKTREES-EVIDENCE.md curated from a real simulation run captures observed invariants."
  truths:
    - "install/memories/worktrees.md exists with self-contained worktree briefing content (D-11: full content, NOT a thin pointer)"
    - "install.sh's existing memory-seeding loop (lines 105-110) automatically picks up worktrees.md and seeds it as bd memory `gsd-beads:worktrees` (memory #8 — D-09 layer 1)"
    - "docs/WORKTREES.md exists with three sections: setup walkthrough, lifecycle ops (add/remove/reactivate per D-05), troubleshooting (4 failure modes from D-13 with one-line recoveries) (D-10)"
    - "docs/WORKTREES.md documents the source-repo-rename recovery as the literal `git config --worktree gsd-beads.dir <new-source-path>/.beads` one-liner (D-14)"
    - "docs/WORKTREES.md documents the macOS `brew install flock` requirement (RESEARCH.md Pitfall 1)"
    - "docs/WORKTREES-EVIDENCE.md exists with one `## Observed: <invariant>` section per invariant from D-04, each with a 5-10-line transcript excerpt from a real simulation run (D-12)"
    - "README.md gains a `## Multi-worktree setup` section linking to docs/WORKTREES.md (D-09 layer 2)"
    - "Memory file count goes from 7 to 8: `ls install/memories/*.md | wc -l` returns 8"
    - "install.sh is unchanged (the existing memory-seeding loop auto-discovers the new file)"
  artifacts:
    - path: "install/memories/worktrees.md"
      provides: "bd memory #8 source — self-contained briefing surfaced at every `bd prime`"
      min_lines: 15
    - path: "docs/WORKTREES.md"
      provides: "Full walkthrough: setup + lifecycle ops + troubleshooting"
      min_lines: 100
      contains: "git config --worktree"
    - path: "docs/WORKTREES-EVIDENCE.md"
      provides: "Curated transcript distillation — one section per D-04 invariant"
      min_lines: 60
      contains: "## Observed:"
    - path: "README.md"
      provides: "Multi-worktree setup section linking to docs/WORKTREES.md"
      contains: "Multi-worktree"
  key_links:
    - from: "install.sh memory-seeding loop (lines 105-110)"
      to: "install/memories/worktrees.md"
      via: "for f in install/memories/*.md ; do bd remember --key gsd-beads:$(basename $f .md) ... done"
      pattern: "install/memories/\\*.md"
    - from: "README.md `## Multi-worktree setup` section"
      to: "docs/WORKTREES.md"
      via: "markdown link `[full setup walkthrough](docs/WORKTREES.md)`"
      pattern: "docs/WORKTREES.md"
    - from: "docs/WORKTREES.md troubleshooting section"
      to: "the 4 D-13 failure modes"
      via: "one subsection per failure mode with the one-line recovery"
      pattern: "## Troubleshooting"
    - from: "docs/WORKTREES-EVIDENCE.md"
      to: "tests/cross-worktree/simulation.sh transcript output"
      via: "5-10-line excerpts under each `## Observed:` heading"
      pattern: "## Observed:"
    - from: "install.sh's `seeded $(ls .../*.md | wc -l)` line"
      to: "memory count of 8 (was 7)"
      via: "wc -l auto-counts the new file"
      pattern: "wc -l"
---

<objective>
Ship the three-layer documentation surface mandated by D-09..D-12:

1. **Layer 1 — bd memory #8 (`gsd-beads:worktrees`):** create
   `install/memories/worktrees.md` containing a self-contained briefing on
   gsd-beads + git worktrees. Per D-11, this is the FULL content (NOT a
   thin pointer to docs/WORKTREES.md), surfaced at every `bd prime`. The
   existing install.sh memory-seeding loop (lines 105-110) auto-seeds
   any `*.md` file in `install/memories/`, so install.sh is **unchanged**
   for this plan — adding the file is sufficient.

2. **Layer 2 — README section:** add a short `## Multi-worktree setup`
   section to README.md that links out to `docs/WORKTREES.md`.

3. **Layer 3 — `docs/WORKTREES.md`:** the deep dive. Per D-10: setup
   walkthrough + lifecycle ops (add/remove/reactivate per D-05) +
   troubleshooting (4 failure modes from D-13, including the
   `git config --worktree gsd-beads.dir <new>/.beads` one-line recovery
   for source-repo rename per D-14). Documents the macOS `brew install
   flock` requirement.

4. **Curated evidence — `docs/WORKTREES-EVIDENCE.md`:** per D-12, distill
   one or more real simulation runs (output from Plan 03-02's
   `tests/cross-worktree/simulation.sh`) into a short doc with one
   `## Observed: <invariant>` section per invariant from D-04. Each
   section contains a 5-10-line transcript excerpt that proves the
   invariant held during the run.

Purpose: REQ-03's documentation surface. Without this, users hitting the
4 failure modes have no recovery path; without memory #8, agents in
beads-managed projects don't surface worktree context at session start.

Output: 4 new files (~300 lines of prose), 1 README addition (~10 lines).
install.sh is **NOT** modified — the existing `for f in
$REPO/install/memories/*.md` loop at lines 105-110 picks up the new file
and the `seeded N bd memories` summary line at line 111 auto-counts to 8.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/03-cross-worktree-validation/03-CONTEXT.md
@.planning/phases/03-cross-worktree-validation/03-RESEARCH.md
@.planning/phases/03-cross-worktree-validation/03-VALIDATION.md
@.planning/phases/03-cross-worktree-validation/03-01-SUMMARY.md
@.planning/phases/03-cross-worktree-validation/03-02-SUMMARY.md
@.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md
@./CLAUDE.md
@README.md
@install.sh
@install/memories/vocabulary.md
@install/memories/state-paths.md
@install/memories/type-strategy.md
@hooks/worktree-post-checkout.sh

<interfaces>
<!-- Existing memory file shape — short, direct, plain text. Mirror this for worktrees.md. -->
<!-- From install/memories/vocabulary.md (5 lines): -->
```
gsd-beads vocabulary:

- Workflow state lives in beads (.beads/issues.jsonl auto-exported, git-tracked).
- State-bearing markdown (.planning/ROADMAP.md, REQUIREMENTS.md, todos/, seeds/) is REGENERATED from bd state by bd-sync.sh — DO NOT edit those files directly; the PreToolUse hook denies it.
- Narrative markdown (PLAN.md, RESEARCH.md, AI-SPEC.md, UI-SPEC.md, DISCUSSION-LOG.md) is unaffected.
- Upstream /gsd-* commands (e.g., /gsd-add-phase, /gsd-add-todo) work transparently via the gsd-sdk shadow at ~/.local/bin/gsd-sdk in beads-managed projects.
- `bd ready` is the canonical "what should I work on next?" — replaces manual roadmap scanning (REQ-08).
```

<!-- install.sh's existing memory-seeding loop (UNCHANGED — auto-discovers any .md in install/memories/): -->
```bash
for f in "$REPO"/install/memories/*.md; do
  key="gsd-beads:$(basename "$f" .md)"
  bd forget "$key" 2>/dev/null || true
  bd remember --key "$key" "$(cat "$f")"
done
echo "seeded $(ls "$REPO"/install/memories/*.md | wc -l | tr -d ' ') bd memories under gsd-beads:*"
```

<!-- The 4 failure modes from D-13 (must each have a troubleshooting subsection in docs/WORKTREES.md): -->
1. Source `.beads/` deleted mid-run.
2. Concurrent regen-roadmap.sh from two worktrees (handled by flock — D-15).
3. Source repo renamed mid-flow → recovery via `git config --worktree gsd-beads.dir <new-source-path>/.beads` (D-14).
4. BEADS_DIR env var unset in a worktree → discovery fallback via `git config --worktree gsd-beads.dir` cwd-scan.

<!-- Memory #8 content suggested by CONTEXT.md §"Specific Ideas" (1-2 paragraphs): -->
```
gsd-beads supports git worktrees natively. Run
`git worktree add ../<name> -b <branch>`; the post-checkout hook
auto-configures the new worktree to share the source repo's bead store.
See docs/WORKTREES.md for setup, removal, and troubleshooting.
```
But D-11 mandates "FULL content (NOT a thin pointer)" — so the memory
must include enough operational detail that agents don't need to chase
the link.

<!-- Existing README.md (16 lines, ends with `## Status:` placeholder text): -->
<!-- The new section goes BEFORE `## Status:` line. -->

<!-- 4 D-04 invariants (each maps to one `## Observed:` heading in WORKTREES-EVIDENCE.md): -->
1. No data loss — every issue created in any worktree survives.
2. No ID collision — hash-based IDs unique across all worktrees + concurrent batches.
3. No stale state — write in worktree-A → read in worktree-B sees it without manual sync.
4. Atomic markdown views — regenerated ROADMAP.md / REQUIREMENTS.md never observed mid-write.
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| docs/WORKTREES.md → user reading the doc | Documentation may include shell commands; users will copy-paste. Commands MUST be safe-by-default and never assume sudo. |
| install/memories/worktrees.md → bd memory store at install time | Content is consumed by `bd remember --key gsd-beads:worktrees`. bd treats memory content as opaque text — no shell expansion at seed time. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-09 | Tampering | Documented recovery command (`git config --worktree`) writes to user's repo config | accept | Per D-14, this is the exact one-line recovery; users explicitly run it after a rename. The command is read-by-the-user, not auto-executed. No privilege escalation. |
| T-03-10 | Information disclosure | docs/WORKTREES-EVIDENCE.md transcript excerpts contain user-specific paths | mitigate | Sanitize paths in transcript excerpts: replace `/tmp/gsd-beads-cross-NNNNN/` with `/tmp/<sandbox>/`, replace user-specific bd IDs with the literal IDs (bd hash IDs are content-derived and not sensitive). |
| T-03-11 | Repudiation | Memory #8 content drifts from docs/WORKTREES.md | mitigate | Memory #8 is a self-contained briefing per D-11; it contains operational context but DEFERS to docs/WORKTREES.md for setup commands and troubleshooting. The memory states "see docs/WORKTREES.md for the full walkthrough" so future doc updates only require editing one place. |

No `high` severity. Pure documentation surface.
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Create install/memories/worktrees.md (memory #8 source) + verify install.sh auto-seeds it</name>
  <files>install/memories/worktrees.md</files>
  <read_first>
    - install/memories/vocabulary.md (5 lines, plain prose) — for the canonical memory file shape.
    - install/memories/state-paths.md (7 lines) — same shape, slightly more structured.
    - install/memories/type-strategy.md — same shape.
    - install.sh lines 105-111 (memory-seeding loop + summary line) — confirms the loop auto-discovers any `*.md` file under `install/memories/`. **CRITICAL:** verify lines 105-111 do not need changes; the file count in the summary message is computed at install time via `ls install/memories/*.md | wc -l`.
    - 03-CONTEXT.md D-11 — locked: "memory #8 is full content, not a pointer."
    - 03-CONTEXT.md §"Specific Ideas" (3rd bullet — Memory #8 content suggestion) — the 1-2 paragraph suggested content.
    - 03-RESEARCH.md §"Recommended Project Structure" — confirms `install/memories/worktrees.md` is the canonical location.
  </read_first>
  <action>
    Create `install/memories/worktrees.md` with self-contained worktree briefing content. Per D-11, this is FULL content, not a pointer.

    **Required content sections (concise — target ~20-30 lines total, matching existing memories):**

    1. **One-line opener:** `gsd-beads + git worktrees:`
    2. **What works automatically (4-5 bullets):**
       - `git worktree add <path> -b <branch>` auto-configures the new worktree to share the source repo's `.beads/` bead store via `git config --worktree gsd-beads.dir`.
       - All worktrees see the same bd state — no manual sync, no `BEADS_DIR` env var required.
       - Pre-existing worktrees on first install are backfilled by `install.sh` (D-08 — Plan 03-02 implementation).
       - Concurrent writes from multiple worktrees serialize via `flock -x -w 30` at `<source>/.beads/.gsd-beads.lock` (Plan 03-01).
       - `git worktree remove <path>` requires no gsd-beads-side cleanup; git removes the per-worktree config + marker automatically.
    3. **macOS install hint:** "macOS users: `brew install flock` is required (`install.sh` enforces this in pre-flight)."
    4. **Recovery one-liner:** "If the source repo is renamed, run `git config --worktree gsd-beads.dir <new-source>/.beads` from each affected worktree."
    5. **Pointer to deep dive:** "See `docs/WORKTREES.md` for full setup walkthrough, lifecycle ops, and troubleshooting."

    **Format (mirror install/memories/state-paths.md shape):**
    - Plain text, bullets with `-`.
    - No headings (`##` etc) — bd memory content is rendered inline at `bd prime` and headings break the flow.
    - First line: short opener describing what this memory covers.

    **Verify install.sh auto-discovers the new file (no changes needed):**
    The loop at install.sh lines 105-110 does `for f in "$REPO"/install/memories/*.md`. `worktrees.md` matches that glob. The summary at line 111 (`seeded $(ls ... | wc -l)`) auto-increments from 7 to 8. **Do not modify install.sh** — the auto-discovery is by design.

    Sample content (executor may revise prose — content fidelity to D-11 + D-15 + D-08 + D-14 is what matters):

    ```
    gsd-beads + git worktrees:

    - `git worktree add <path> -b <branch>` auto-configures the new worktree to share the source repo's bead store. The post-checkout hook persists `git config --worktree gsd-beads.dir=<source>/.beads`.
    - All worktrees see the same bd state — no manual sync, no `BEADS_DIR` env var required after the auto-config.
    - Pre-existing worktrees on first install are backfilled by `install.sh` (one-time, idempotent).
    - Concurrent regens from multiple worktrees are serialized via `flock -x -w 30` at `<source>/.beads/.gsd-beads.lock`. On lock timeout the script exits non-zero with a "another regen is in progress" message; bd-sync.sh continues fail-soft.
    - `git worktree remove <path>` requires no gsd-beads-side cleanup; git removes the per-worktree config + marker automatically. Run `git worktree prune` to clean stale `.git/worktrees/<name>/` entries.
    - macOS: `brew install flock` is required (install.sh pre-flight enforces this).
    - Recovery if the source repo is renamed: `git config --worktree gsd-beads.dir <new-source>/.beads` from each affected worktree.
    - See `docs/WORKTREES.md` for full setup walkthrough, lifecycle ops, and troubleshooting.
    ```
  </action>
  <acceptance_criteria>
    - `install/memories/worktrees.md` exists.
    - `wc -l < install/memories/worktrees.md` returns >= 15 (substantive content per must_haves.artifacts min_lines: 15, not a stub).
    - File contains the literal string `git config --worktree` (D-14 recovery).
    - File contains the literal string `flock` (D-15 reference).
    - File contains the literal string `brew install flock` (Pitfall 1 hint).
    - File contains the literal string `docs/WORKTREES.md` (pointer to deep dive — D-09 layer cross-link).
    - File does NOT contain markdown `##` headings (mirrors existing memory file shape).
    - `ls install/memories/*.md | wc -l` returns exactly 8 (was 7).
    - install.sh remains BYTE-UNCHANGED: `git diff install.sh` returns empty (the auto-discovery loop handles the new file).
    - The seven prior memory files (vocabulary, state-paths, type-strategy, link-default, discovered-from, todowrite, dolt-push) all still exist.
  </acceptance_criteria>
  <verify>
    <automated>test -f install/memories/worktrees.md && [ "$(ls install/memories/*.md | wc -l)" -eq 8 ] && grep -F 'git config --worktree' install/memories/worktrees.md && grep -F 'brew install flock' install/memories/worktrees.md && grep -F 'docs/WORKTREES.md' install/memories/worktrees.md && [ -z "$(git diff install.sh)" ]</automated>
  </verify>
  <done>
    Memory #8 source created. install.sh auto-seeds it via the existing
    memory-loop. Memory file count is 8 (was 7). install.sh is unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create docs/WORKTREES.md (full walkthrough — setup + lifecycle + troubleshooting)</name>
  <files>docs/WORKTREES.md</files>
  <read_first>
    - 03-CONTEXT.md D-10 (locked: setup + lifecycle + troubleshooting in one doc).
    - 03-CONTEXT.md D-13 (the 4 failure modes; each must get a troubleshooting subsection).
    - 03-CONTEXT.md D-14 (source-repo rename recovery: `git config --worktree gsd-beads.dir <new>/.beads`).
    - 03-CONTEXT.md D-05 (lifecycle scope: setup + remove + reactivate).
    - 03-CONTEXT.md §"Specific Ideas" — WORKTREES.md outline.
    - 03-RESEARCH.md §"Pitfall 1" — macOS flock install requirement.
    - 03-RESEARCH.md §"Pitfall 5" — `git worktree remove` orphan behavior + `git worktree prune` cleanup.
    - 03-02-SUMMARY.md (Plan 03-02's deliverable, available because Plan 03-03 depends on 03-02) — for the empirically-observed `git worktree list --porcelain` output to quote in the setup walkthrough.
    - hooks/worktree-post-checkout.sh — for the exact log message the user sees after `git worktree add`: `[gsd-beads] ✓ Worktree configured (gsd-beads.dir=<source>/.beads)` (line 34).
    - install/memories/worktrees.md (created in Task 1) — for cross-link consistency.
    - .claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md — for the canonical setup-from-source pattern (already implemented; reference for the doc).
  </read_first>
  <action>
    Create `docs/WORKTREES.md`. The directory `docs/` does not exist yet — create it as part of writing the file.

    **Required structure (target ~120-180 lines):**

    ```markdown
    # gsd-beads + git worktrees

    A walkthrough for running gsd-beads across multiple git worktrees of the
    same project. Covers setup, lifecycle ops, and troubleshooting.

    ## Why use worktrees with gsd-beads

    [2-3 sentences: the design promise — source repo's `.beads/` is the
    canonical store; worktrees share it via `git config --worktree
    gsd-beads.dir`. No bd federation, no manual sync, no env-var dance.]

    ## Setup walkthrough

    ### Fresh project
    [4-line copy-pasteable block:]
    ```bash
    cd <source-repo>
    bd init --non-interactive --skip-agents
    cd <gsd-beads-clone> && ./install.sh
    cd <source-repo>   # back to project root
    ```

    [Note about the install.sh pre-flight check for `flock`:]
    > macOS users: install.sh requires `flock`. Install via `brew install flock` first.

    ### Adding a worktree (auto-config)
    ```bash
    git worktree add ../wt-feature -b feature-x
    # Output:
    # [gsd-beads] ✓ Worktree configured (gsd-beads.dir=<source>/.beads)
    ```
    [Explain: the post-checkout hook fires automatically; the marker file
    `<wt-gitdir>/info/.gsd-beads-configured` records the configuration.]

    ### Pre-existing worktrees on first install
    [Document D-08 backfill behavior. If the user installs gsd-beads on a
    project that already has multiple worktrees, install.sh enumerates
    them via `git worktree list --porcelain` and fires the shim against
    each. Quote a sample `git worktree list --porcelain` output (from
    03-02-SUMMARY.md) showing 3 worktree records.]

    ## Lifecycle ops

    ### Removing a worktree
    ```bash
    git worktree remove ../wt-feature
    ```
    [Explain D-06: gsd-beads requires no cleanup; the per-worktree
    `gsd-beads.dir` config and `.gsd-beads-configured` marker live inside
    `.git/worktrees/<name>/`, which `git worktree remove` deletes.]

    ### Reactivating an old worktree path
    [Explain D-07: if a worktree directory existed before, was deleted,
    and a new `git worktree add` reuses the path, the post-checkout
    fires and the marker-gate creates a fresh configuration.]

    ### Cleaning up stale entries (`git worktree prune`)
    [Explain Pitfall 5: dirty/aborted removes can leave orphan
    `.git/worktrees/<name>/` directories. `git worktree prune` cleans them.]

    ## Troubleshooting

    ### Source `.beads/` deleted (D-13.1)
    **Symptom:** bd commands in any worktree fail with "no .beads/" or
    similar.
    **Recovery:** restore from git (`git checkout HEAD -- .beads/issues.jsonl
    && bd init --from-jsonl --prefix $(jq -r .dolt_database
    .beads/metadata.json) --non-interactive --skip-agents`) — see
    spike-findings-gsd-beads/references/storage-and-distribution.md
    "Fresh-clone bootstrap" for the full procedure.

    ### "another regen is in progress" message (D-13.2 / D-15)
    **Symptom:** stderr contains `[gsd-beads] another regen is in progress
    at <path>/.gsd-beads.lock — retry shortly`.
    **Cause:** another worktree's bd-sync.sh is currently running cascade
    + regen.
    **Recovery:** wait a few seconds and retry. The flock timeout is 30s;
    if you see this message under normal use, your bd write throughput
    has exceeded ~3.25 writes/sec for >30s — investigate before tuning.

    ### Source repo renamed (D-13.3 / D-14)
    **Symptom:** worktree's bd commands fail because
    `git config gsd-beads.dir` points at a no-longer-existent path.
    **Recovery:** in EACH affected worktree, run:
    ```bash
    git config --worktree gsd-beads.dir <new-source-path>/.beads
    ```
    No code-side recovery; this is by design (D-14).

    ### `BEADS_DIR` unset in a worktree (D-13.4)
    **Symptom:** [document the precedence observed during the simulation
    — quote the empirical observation from 03-02-SUMMARY.md].
    **Recovery:** [either auto-fallback works OR run the post-checkout
    shim manually:
    ```bash
    bash <source>/.beads/hooks/post-checkout HEAD HEAD 1
    ```]

    ### `flock` not installed (Pitfall 1)
    **Symptom:** install.sh exits with `ERROR: flock not installed
    (macOS: brew install flock)`, OR the regen scripts emit
    `[gsd-beads] ERROR: flock not installed`.
    **Recovery (macOS):** `brew install flock`. Re-run install.sh.

    ## Performance notes
    - Concurrent write throughput on embedded Dolt: ~3.25 writes/sec per
      machine (Spike 003 measurement). Heavier bursts queue rather than
      parallelize.
    - `flock -x -w 30` adds <1ms in the uncontended case. Contended worst
      case is bounded by the 30-second wait timeout.

    ## See also
    - `install/memories/worktrees.md` — bd memory #8 (surfaces at every `bd prime`).
    - `docs/WORKTREES-EVIDENCE.md` — observed simulation behavior.
    - `.claude/skills/spike-findings-gsd-beads/references/storage-and-distribution.md` — design rationale.
    - Spike 003 source: `.claude/skills/spike-findings-gsd-beads/sources/003-cross-worktree-sharing/`.
    ```

    **Important — values that MUST be literal (not paraphrased):**
    - The exact recovery command: `git config --worktree gsd-beads.dir <new-source-path>/.beads`
    - The exact macOS install hint: `brew install flock`
    - The exact stderr message format: `[gsd-beads] another regen is in progress at <path>/.gsd-beads.lock — retry shortly`
    - The exact shim success message: `[gsd-beads] ✓ Worktree configured (gsd-beads.dir=<source>/.beads)`

    These literal strings appear in the production scripts (Plan 03-01) and
    in the install.sh / hooks/worktree-post-checkout.sh code paths. Users
    grep for them; the doc must match.

    Use `mkdir -p docs/` before creating the file (the directory does not
    yet exist).
  </action>
  <acceptance_criteria>
    - `docs/WORKTREES.md` exists.
    - `wc -l docs/WORKTREES.md` returns >= 100.
    - File contains the H1 `# gsd-beads + git worktrees` (or equivalent project-naming heading).
    - File contains a `## Setup walkthrough` heading.
    - File contains a `## Lifecycle ops` heading.
    - File contains a `## Troubleshooting` heading with subsections covering ALL 4 D-13 failure modes plus the Pitfall 1 (flock missing) case (5 subsections total).
    - File contains the literal string `git config --worktree gsd-beads.dir` (D-14 recovery — quoted exactly).
    - File contains the literal string `brew install flock` (Pitfall 1 — quoted exactly).
    - File contains the literal string `another regen is in progress` (D-15 stderr quoted exactly).
    - File contains a copy-pasteable `git worktree add` block with code fences.
    - File contains the literal string `git worktree remove` (D-06 lifecycle op).
    - File contains the literal string `git worktree prune` (Pitfall 5 cleanup).
    - File mentions both `docs/WORKTREES-EVIDENCE.md` and `install/memories/worktrees.md` (cross-links).
  </acceptance_criteria>
  <verify>
    <automated>test -f docs/WORKTREES.md && [ "$(wc -l < docs/WORKTREES.md)" -ge 100 ] && grep -F '## Setup walkthrough' docs/WORKTREES.md && grep -F '## Lifecycle' docs/WORKTREES.md && grep -F '## Troubleshooting' docs/WORKTREES.md && grep -F 'git config --worktree gsd-beads.dir' docs/WORKTREES.md && grep -F 'brew install flock' docs/WORKTREES.md && grep -F 'another regen is in progress' docs/WORKTREES.md && grep -F 'git worktree remove' docs/WORKTREES.md && grep -F 'git worktree prune' docs/WORKTREES.md && grep -F 'WORKTREES-EVIDENCE.md' docs/WORKTREES.md</automated>
  </verify>
  <done>
    docs/WORKTREES.md ships the full deep dive. All 4 D-13 failure modes
    have troubleshooting subsections with literal recovery commands. Cross-
    links to memory #8 and WORKTREES-EVIDENCE.md are in place.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create docs/WORKTREES-EVIDENCE.md (curated simulation transcript) + add README "Multi-worktree setup" section</name>
  <files>
    docs/WORKTREES-EVIDENCE.md,
    README.md
  </files>
  <read_first>
    - .planning/phases/03-cross-worktree-validation/03-02-SUMMARY.md — Plan 03-02's transcript excerpts (the seed material for this doc per its `<output>` block). If the SUMMARY doesn't exist yet (Plan 03-02 not yet executed), the executor of THIS task MUST first run `bash tests/cross-worktree/simulation.sh > /tmp/sim-transcript.log 2>&1` to capture a real transcript.
    - 03-CONTEXT.md D-04 (the 4 invariants in full text — each gets one `## Observed:` heading).
    - 03-CONTEXT.md D-12 (locked: distill simulation transcripts into `## Observed: <invariant>` headings + 5-10-line excerpts).
    - 03-CONTEXT.md §"Claude's Discretion" — "## Observed: <invariant> heading per invariant + 5-10-line transcript excerpt under each."
    - README.md (current 16 lines) — for the insertion point of the new `## Multi-worktree setup` section.
    - tests/cross-worktree/simulation.sh (created in Plan 03-02) — for the script that produces the transcript.
  </read_first>
  <action>
    **Part A — Create `docs/WORKTREES-EVIDENCE.md`:**

    Per D-12, distill a real simulation run into a per-invariant evidence doc. **The executor MUST run the simulation first to capture real output:**

    ```bash
    # Capture a fresh simulation transcript before writing the evidence doc.
    bash tests/cross-worktree/simulation.sh > /tmp/sim-transcript.log 2>&1
    rc=$?
    [ "$rc" -eq 0 ] || { echo "ERROR: simulation failed; cannot generate evidence"; exit 1; }
    ```

    From the captured transcript, extract:
    - 5-10 lines for the data-loss invariant (Day 1+Day 5 CREATED counts vs final `bd list` length).
    - 5-10 lines for the ID-collision invariant (Day 4 burst output showing 40+ unique IDs).
    - 5-10 lines for the stale-state invariant (Day 2's "epic visible in wt-feature" PASS line + Day 3's cross-worktree closure visibility).
    - 5-10 lines for the atomic-markdown invariant (Day 4 snapshot validation PASS line).

    **Required structure (target ~80-120 lines):**

    ```markdown
    # gsd-beads worktree validation — observed evidence

    Curated transcript distillation from a real run of
    `tests/cross-worktree/simulation.sh`. Each section corresponds to one
    of the four invariants from CONTEXT.md D-04.

    **Run captured:** [date of the transcript]
    **Host:** [WSL2 / dev machine descriptor]
    **Wall time:** [elapsed seconds from the simulation summary]

    ## Observed: No data loss (Invariant 1)

    Every issue created across all 3 worktrees in the simulation appears
    in `bd list --status=all --json` from the source store.

    ```
    [5-10 line transcript excerpt — paths sanitized to /tmp/<sandbox>/]
    [PASS] Day 1: 4 issues created in src (1 epic + 3 leaves)
    [PASS] Day 5: 2 issues created in wt-hotfix (1 epic + 1 leaf)
    Created across all worktrees: 6
    bd list --status=all --json | jq 'length' → 6
    [PASS] Invariant 1 (no data loss)
    ```

    ## Observed: No ID collision (Invariant 2)

    All hash-based IDs across the 3 worktrees + Day 4 concurrent burst
    are unique.

    ```
    [5-10 line excerpt — show the unique-ID count vs total CREATED count]
    Audit log CREATED entries: 6
    sort -u | wc -l: 6
    [PASS] Invariant 2 (no ID collision)
    ```

    ## Observed: No stale state (Invariant 3)

    A write in worktree-A is observable from worktree-B without manual
    sync.

    ```
    [5-10 line excerpt — Day 2's "epic visible in wt-feature" PASS]
    Day 2: epic <epic-id> created in src, visible in wt-feature
    Day 3: closure of <epic-id> in wt-feature, visible in wt-hotfix
    [PASS] Invariant 3 (no stale state)
    ```

    ## Observed: Atomic markdown views (Invariant 4)

    Snapshots captured every 0.1s during Day 4's 40-invocation concurrent
    burst all show fully-formed ROADMAP.md (no mid-write truncation).

    ```
    [5-10 line excerpt]
    Day 4 burst: 40 invocations across src + wt-feature
    Snapshots captured: 47
    All snapshots end with expected terminator line — no mid-write reads
    [PASS] Invariant 4 (atomic markdown views)
    ```

    ## Observed: Failure injections behaved as documented

    | Injection (D-13) | Observed | Matches docs/WORKTREES.md? |
    |---|---|---|
    | D-13.1 source `.beads/` deleted | bd commands fail with "no .beads/" | yes |
    | D-13.2 concurrent regen race | flock serializes; no atomic violations | yes |
    | D-13.3 source repo renamed | wt config points at non-existent path | yes (manual recovery documented) |
    | D-13.4 BEADS_DIR unset | [document observed precedence] | yes |

    ## Reproducing this evidence

    ```bash
    bash tests/cross-worktree/simulation.sh
    ```
    ```

    **Sanitization rule (Threat T-03-10 mitigation):** before committing,
    `sed`-replace any `/tmp/gsd-beads-cross-NNNNN-NNNNN/` paths with the
    placeholder `/tmp/<sandbox>/`. bd hash IDs are content-derived and
    not sensitive — keep them literal so future readers can correlate
    with the bd model.

    **Part B — Modify `README.md`:**

    Add a new section `## Multi-worktree setup` BEFORE the existing
    `**Status:** design phase.` line (currently line 15). Section content:

    ```markdown
    ## Multi-worktree setup

    gsd-beads supports git worktrees natively. After
    `git clone && ./install.sh`, run `git worktree add` from the source
    repo and the new worktree auto-configures to share the source repo's
    bead store. No env-var dance, no manual `bd` reconfig.

    See [docs/WORKTREES.md](docs/WORKTREES.md) for the full setup
    walkthrough, lifecycle ops (`git worktree remove`, reactivating an
    old path), and troubleshooting (4 documented failure modes with
    one-line recoveries).

    macOS users: `brew install flock` is required.
    ```

    Insert this section AFTER the existing introductory paragraphs
    (line 14, "Updates to upstream GSD apply cleanly because GSD's source is
    never touched.") and BEFORE the `**Status:**` line (line 15 in
    current file).

    Also update the `**Status:**` line to reflect Phase 3 progress:
    change from `**Status:** design phase. See \`.planning/notes/beads-gsd-architecture.md\`.`
    to `**Status:** Phase 2 shipped (13/13 verified, 2026-04-28). Phase 3 (cross-worktree validation) in progress.`
  </action>
  <acceptance_criteria>
    - `docs/WORKTREES-EVIDENCE.md` exists.
    - `wc -l docs/WORKTREES-EVIDENCE.md` returns >= 60.
    - `grep -c '^## Observed:' docs/WORKTREES-EVIDENCE.md` returns >= 4 (one per D-04 invariant).
    - File contains the literal headings `## Observed: No data loss`, `## Observed: No ID collision`, `## Observed: No stale state`, `## Observed: Atomic markdown` (or equivalent — match the 4 invariants).
    - File contains at least one fenced code block (transcript excerpt).
    - File mentions the simulation script: `grep -F 'tests/cross-worktree/simulation.sh' docs/WORKTREES-EVIDENCE.md` returns >= 1.
    - Sanitization: `! grep -E '/tmp/gsd-beads-cross-[0-9]+-[0-9]+' docs/WORKTREES-EVIDENCE.md` succeeds (no raw sandbox paths leak).
    - `README.md` contains the literal string `## Multi-worktree setup`.
    - `README.md` contains a markdown link to `docs/WORKTREES.md`: `grep -E '\\[.*WORKTREES.*\\]\\(docs/WORKTREES.md\\)' README.md` returns >= 1.
    - `README.md` contains the literal string `brew install flock`.
    - The simulation captured for evidence-doc generation actually passed: `bash tests/cross-worktree/simulation.sh` exits 0 (the executor of this task must rerun the simulation if needed).
  </acceptance_criteria>
  <verify>
    <automated>test -f docs/WORKTREES-EVIDENCE.md && [ "$(grep -c '^## Observed:' docs/WORKTREES-EVIDENCE.md)" -ge 4 ] && grep -F 'tests/cross-worktree/simulation.sh' docs/WORKTREES-EVIDENCE.md && ! grep -E '/tmp/gsd-beads-cross-[0-9]+-[0-9]+' docs/WORKTREES-EVIDENCE.md && grep -F '## Multi-worktree setup' README.md && grep -E '\[.*WORKTREES.*\]\(docs/WORKTREES.md\)' README.md && grep -F 'brew install flock' README.md</automated>
  </verify>
  <done>
    docs/WORKTREES-EVIDENCE.md ships with one section per D-04 invariant
    sourced from a real simulation run. README.md surfaces the
    multi-worktree story and links out to docs/WORKTREES.md. The doc
    triple from D-09..D-12 is complete.
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run:

```bash
# Memory #8 auto-seeds
ls install/memories/*.md | wc -l   # must return 8 (was 7)
test -z "$(git diff install.sh)"   # install.sh BYTE-UNCHANGED

# Documentation files exist
test -f docs/WORKTREES.md
test -f docs/WORKTREES-EVIDENCE.md

# README has the new section
grep -F '## Multi-worktree setup' README.md
grep -E '\[.*WORKTREES.*\]\(docs/WORKTREES.md\)' README.md

# Cross-linking
grep -F 'docs/WORKTREES.md' install/memories/worktrees.md
grep -F 'WORKTREES-EVIDENCE.md' docs/WORKTREES.md
grep -F 'install/memories/worktrees.md' docs/WORKTREES.md

# Literal string fidelity (D-14 / D-15 / Pitfall 1)
grep -F 'git config --worktree gsd-beads.dir' docs/WORKTREES.md
grep -F 'brew install flock' docs/WORKTREES.md
grep -F 'another regen is in progress' docs/WORKTREES.md

# Evidence sanitization
! grep -E '/tmp/gsd-beads-cross-[0-9]+' docs/WORKTREES-EVIDENCE.md

# Optional: run install.sh in a sandbox + verify 8 memories seeded
# (heavyweight; covered by tests/install-tests/memory-seeding.test.sh once it picks up the new file)
```

Anti-pattern guards:
```bash
# Memory file is plain prose, not markdown headings (matches existing memory shape)
! grep -E '^##' install/memories/worktrees.md

# Documentation never instructs the user to run sudo
! grep -F 'sudo ' docs/WORKTREES.md

# README's new section is between intro and status (not at the end)
grep -B1 '## Multi-worktree setup' README.md | head -1   # should not be EOF marker
```
</verification>

<success_criteria>
- D-09 layered docs all ship: bd memory #8 + README section + docs/WORKTREES.md.
- D-10 satisfied: docs/WORKTREES.md covers setup + lifecycle + troubleshooting (4 D-13 modes + Pitfall 1).
- D-11 satisfied: install/memories/worktrees.md is full content (>= 8 lines), not a thin pointer.
- D-12 satisfied: docs/WORKTREES-EVIDENCE.md exists with `## Observed:` heading per D-04 invariant + transcript excerpts.
- D-14 surfaced: the `git config --worktree gsd-beads.dir <new>/.beads` recovery is quoted literally in docs/WORKTREES.md and install/memories/worktrees.md.
- install.sh remains BYTE-UNCHANGED (the existing memory-seeding loop auto-discovers worktrees.md).
- Memory file count goes from 7 to 8.
- README links the user to docs/WORKTREES.md.
- All anti-pattern guards pass.
</success_criteria>

<output>
After completion, create `.planning/phases/03-cross-worktree-validation/03-03-SUMMARY.md` per @$HOME/.claude/get-shit-done/templates/summary.md. The SUMMARY MUST surface:
- The actual content of `install/memories/worktrees.md` (so future memory updates have a baseline reference).
- The number of `## Observed:` sections in docs/WORKTREES-EVIDENCE.md (must be 4 — proves all D-04 invariants are documented).
- A note that install.sh was NOT modified by this plan (the existing memory-seeding loop handled the new file automatically).
- Any sanitization decisions made for docs/WORKTREES-EVIDENCE.md (e.g., paths replaced, IDs preserved).
</output>
