---
title: Spike — validate beads + GSD topology
date: 2026-04-27
context: De-risk gsd-beads integration before committing to full Phase 2 build
---

# Spike: validate beads + GSD topology

## Goal

Confirm the architectural assumptions in `beads-gsd-architecture.md` hold in
practice on this developer's actual machine + worktree setup, before
committing to the full layer build.

Run as `/gsd-spike` when ready.

## What to validate

| # | Assumption | Test |
|---|---|---|
| 1 | `BEADS_DIR` works for cross-worktree sharing | Two worktrees of the same repo, same `BEADS_DIR`. Verify `bd list` returns identical results from both; writes in worktree A appear in worktree B without manual sync. |
| 2 | Dolt cell-merge survives concurrent agent writes | Two parallel sessions mutate different fields of the same issue at the same time. Verify both writes persist. |
| 3 | Hash-based IDs don't collide under load | Rapidly create issues from both worktrees. Verify zero ID conflicts. |
| 4 | JSONL roundtrip is clean | `bd export -o issues.jsonl` → `rm -rf .beads` → `bd init --from-jsonl issues.jsonl`. Confirm graph is byte-identical or semantically equivalent. |
| 5 | `PostToolUse(Bash, "^bd ")` hook fires reliably | Stub `bd-sync.sh` that touches a marker file. Verify marker updates after every `bd` call. |
| 6 | `PreToolUse(Edit, ROADMAP.md)` blocks deterministically | Try to edit a generated ROADMAP.md. Verify the block fires. Verify a friendly error redirects to `/gsd-beads-*`. |
| 7 | Custom issue types (`requirement`, `phase`) work | Define them in `bd config`. Create instances. Verify type filters work and parent/child relationships hold. |
| 8 | Auto-close cascade on parent/child | Create requirement + 2 child phases. Close both phases. Verify requirement auto-closes. |

## Setup

- Throwaway test repo (e.g., `~/code/gsd-beads-spike/`) — separate from
  `gsd-beads/` itself so test pollution can't dirty the source repo.
- Beads installed via Homebrew, npm, or PyPI.
- Two git worktrees of the test repo.
- Stub skill, stub hook, stub script — minimal versions just to prove the
  wiring.

## Exit criteria

All eight rows above pass. Document any surprises in
`research/findings.md`. Failures here mean either changing the architecture or
finding workarounds *before* Phase 2 starts.

## Time budget

~1 day. If exceeding, reassess scope rather than push through — a long spike
usually signals a wrong assumption that's worth surfacing in conversation
before continuing.
