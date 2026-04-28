#!/usr/bin/env bash
# Test suite for hooks/bd-sync.sh
# [STUB] Wave 0 — exits 1 until implementation is complete.
#
# 17 cases total:
#
# --- Spike 001 parity (7 cases from original bd-sync tests) ---
# CASE 01 (FIRES): bd list → hook fires (bd prefix matches)
# CASE 02 (FIRES): bd create -t task --title hello → hook fires
# CASE 03 (FIRES): bd export -o issues.jsonl → hook fires (note: read-only filter skips regen internally)
# CASE 04 (FIRES): bd ready --json → hook fires (note: read-only filter skips regen internally)
# CASE 05 (SKIPS): ls -la → hook does NOT fire (no bd prefix; if-filter blocks)
# CASE 06 (SKIPS): grep -r foo . → hook does NOT fire
# CASE 07 (SKIPS): echo bd not at start → hook does NOT fire (bd not at start)
#
# --- Read-only filter cases (8 cases — Pitfall 3) ---
# CASE 08 (read-only SKIPS cascade): bd list → cascade/regen NOT invoked
# CASE 09 (read-only SKIPS cascade): bd show abc-1 → cascade/regen NOT invoked
# CASE 10 (read-only SKIPS cascade): bd ready → cascade/regen NOT invoked
# CASE 11 (read-only SKIPS cascade): bd memories → cascade/regen NOT invoked
# CASE 12 (read-only SKIPS cascade): bd status → cascade/regen NOT invoked
# CASE 13 (read-only SKIPS cascade): bd prime → cascade/regen NOT invoked
# CASE 14 (read-only SKIPS cascade): bd export → cascade/regen NOT invoked
# CASE 15 (read-only SKIPS cascade): bd help → cascade/regen NOT invoked
#
# --- State-change cases (2 cases — cascade FIRES) ---
# CASE 16 (STATE CHANGE): bd close abc-1 → cascade-loop + regen-roadmap + regen-requirements all invoked
# CASE 17 (STATE CHANGE): bd q "X" -t epic → cascade-loop + regen-roadmap + regen-requirements all invoked
set -euo pipefail

echo "[STUB] bd-sync.test.sh — Wave 0 placeholder. Run after Task 4 implementation."
exit 1
