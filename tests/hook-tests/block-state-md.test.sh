#!/usr/bin/env bash
# Test suite for hooks/block-state-md.sh
# [STUB] Wave 0 — exits 1 until implementation is complete.
#
# Cases from Spike 001 (20) + REQ-07 narrative-allow (8) + edge (2) = 30 total
#
# CASE 01 (DENY ABS): Edit on /work/proj/.planning/ROADMAP.md → deny
# CASE 02 (DENY ABS): Edit on /work/proj/.planning/REQUIREMENTS.md → deny
# CASE 03 (DENY ABS): Edit on /work/proj/.planning/todos/pending/foo.md → deny
# CASE 04 (DENY ABS): Edit on /work/proj/.planning/seeds/idea.md → deny
# CASE 05 (DENY ABS): Write on /work/proj/.planning/ROADMAP.md → deny
# CASE 06 (DENY ABS): Write on /work/proj/.planning/REQUIREMENTS.md → deny
# CASE 07 (DENY ABS): Write on /work/proj/.planning/todos/pending/foo.md → deny
# CASE 08 (DENY ABS): Write on /work/proj/.planning/seeds/idea.md → deny
# CASE 09 (DENY ABS): Edit on /deep/nested/project/.planning/ROADMAP.md → deny
# CASE 10 (DENY ABS): Edit on /work/proj/.planning/todos/pending/some idea.md → deny (spaces in path)
# CASE 11 (DENY REL): Edit on .planning/ROADMAP.md → deny
# CASE 12 (DENY REL): Edit on .planning/REQUIREMENTS.md → deny
# CASE 13 (DENY REL): Edit on .planning/todos/pending/foo.md → deny
# CASE 14 (DENY REL): Edit on .planning/seeds/idea.md → deny
# CASE 15 (DENY REL): Write on .planning/ROADMAP.md → deny
# CASE 16 (DENY REL): Write on .planning/REQUIREMENTS.md → deny
# CASE 17 (DENY REL): Write on .planning/todos/pending/foo.md → deny
# CASE 18 (DENY REL): Write on .planning/seeds/idea.md → deny
# CASE 19 (DENY ABS): Edit on /work/proj/.planning/todos/deeply/nested/file.md → deny
# CASE 20 (DENY ABS): Edit on /work/proj/.planning/seeds/some/nested/seed.md → deny
# CASE 21 (ALLOW NARRATIVE REQ-07): Edit on PLAN.md → allow
# CASE 22 (ALLOW NARRATIVE REQ-07): Edit on RESEARCH.md → allow
# CASE 23 (ALLOW NARRATIVE REQ-07): Edit on AI-SPEC.md → allow
# CASE 24 (ALLOW NARRATIVE REQ-07): Edit on UI-SPEC.md → allow
# CASE 25 (ALLOW NARRATIVE REQ-07): Edit on /work/proj/.planning/phases/01-x/01-DISCUSSION-LOG.md → allow
# CASE 26 (ALLOW NARRATIVE REQ-07): Edit on /work/proj/.planning/phases/01-x/01-PLAN.md → allow
# CASE 27 (ALLOW NARRATIVE REQ-07): Edit on /work/proj/.planning/phases/01-x/01-RESEARCH.md → allow
# CASE 28 (ALLOW NARRATIVE REQ-07): Edit on /work/proj/src/index.ts → allow
# CASE 29 (EDGE T-02-01): Edit on ../../escape/.planning/ROADMAP.md — path traversal does NOT bypass (matched by */.planning/ROADMAP.md pattern — deny is safe)
# CASE 30 (EDGE): missing file_path → silent allow (exit 0)
set -euo pipefail

echo "[STUB] block-state-md.test.sh — Wave 0 placeholder. Run after Task 2 implementation."
exit 1
