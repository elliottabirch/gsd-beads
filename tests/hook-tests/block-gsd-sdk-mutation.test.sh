#!/usr/bin/env bash
# Test suite for hooks/block-gsd-sdk-mutation.sh
# [STUB] Wave 0 — exits 1 until implementation is complete.
#
# 43 cases verbatim from Spike 012 test-runner.sh:
#
# === State-bearing mutations: should DENY ===
# CASE deny-phase.add: gsd-sdk query phase.add 'Phase 5: New feature' → deny
# CASE deny-phase add (space alias): gsd-sdk query phase add 'Phase 5' → deny
# CASE deny-phase.add-batch: gsd-sdk query phase.add-batch --json @phases.json → deny
# CASE deny-phase add-batch alias: gsd-sdk query phase add-batch --json @phases.json → deny
# CASE deny-phase.insert: gsd-sdk query phase.insert --after 2 'Critical fix' → deny
# CASE deny-phase insert alias: gsd-sdk query phase insert --after 2 'Critical fix' → deny
# CASE deny-phase.remove: gsd-sdk query phase.remove 5 → deny
# CASE deny-phase remove alias: gsd-sdk query phase remove 5 → deny
# CASE deny-phase.complete: gsd-sdk query phase.complete 3 → deny
# CASE deny-phase complete alias: gsd-sdk query phase complete 3 → deny
# CASE deny-phase.scaffold: gsd-sdk query phase.scaffold 5 → deny
# CASE deny-phase scaffold alias: gsd-sdk query phase scaffold 5 → deny
# CASE deny-phases.clear: gsd-sdk query phases.clear --confirm → deny
# CASE deny-phases.archive: gsd-sdk query phases.archive 1-4 --milestone v1.0 → deny
# CASE deny-roadmap.update-plan: gsd-sdk query roadmap.update-plan-progress --plan 03-02 --status complete → deny
# CASE deny-roadmap update alias: gsd-sdk query roadmap update-plan-progress --plan 03-02 → deny
# CASE deny-roadmap.annotate: gsd-sdk query roadmap.annotate-dependencies → deny
# CASE deny-requirements.mark: gsd-sdk query requirements.mark-complete AUTH-01 → deny
# CASE deny-requirements mark alias: gsd-sdk query requirements mark-complete AUTH-01 → deny
# CASE deny-todo.complete: gsd-sdk query todo.complete TODO-042 → deny
# CASE deny-todo complete alias: gsd-sdk query todo complete TODO-042 → deny
# CASE deny-milestone.complete: gsd-sdk query milestone.complete v1.0 → deny
# CASE deny-milestone alias: gsd-sdk query milestone complete v1.0 → deny
#
# Mutation deny-list count: 13 mutations × 2 forms = 26 deny cases (some have dotted form only for phases.clear/archive)
#
# === Read-only queries: should ALLOW ===
# CASE allow-list.todos: gsd-sdk query list.todos --json → allow
# CASE allow-progress: gsd-sdk query progress → allow
# CASE allow-config-get: gsd-sdk query config-get commit_docs → allow
# CASE allow-audit-open: gsd-sdk query audit-open --json → allow
# CASE allow-decisions: gsd-sdk query decisions → allow
#
# === Non-state-bearing mutations: should ALLOW ===
# CASE allow-state.update: gsd-sdk query state.update --phase 3 → allow
# CASE allow-state.patch: gsd-sdk query state.patch --field foo → allow
# CASE allow-frontmatter.set: gsd-sdk query frontmatter.set PLAN.md status active → allow
# CASE allow-config-set: gsd-sdk query config-set commit_docs true → allow
# CASE allow-commit: gsd-sdk query commit 'docs: update' → allow
# CASE allow-template.fill: gsd-sdk query template.fill plan 03-02 → allow
# CASE allow-workstream.create: gsd-sdk query workstream.create feature-x → allow
# CASE allow-intel.snapshot: gsd-sdk query intel.snapshot → allow
#
# === Non-gsd-sdk Bash calls: should ALLOW ===
# CASE allow-ls: ls -la → allow
# CASE allow-bd-list: bd list → allow
# CASE allow-grep: grep -r foo . → allow
#
# === Edge cases ===
# CASE allow-gsd-sdk-no-query: gsd-sdk init → allow
# CASE allow-gsd-sdk-help: gsd-sdk --help → allow
# CASE allow-gsd-sdk-with-flags: gsd-sdk --project-dir /x query progress → allow
# CASE deny-with-flags: gsd-sdk --project-dir /x query phase.add 'New phase' → deny
set -euo pipefail

echo "[STUB] block-gsd-sdk-mutation.test.sh — Wave 0 placeholder. Run after Task 3 implementation."
exit 1
