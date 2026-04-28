#!/usr/bin/env bash
# tests/cross-worktree/lib/assertions.sh
# Pure-function library: 4 D-04 invariant assertions for the cross-worktree simulation.
#
# Each assertion:
#   - Takes context args (sandbox paths, audit log path, etc.).
#   - Emits `[PASS] <msg>` or `[FAIL] <reason>` to stdout.
#   - Increments the caller's `pass`/`fail` counters via dynamic scoping (bash function).
#   - Returns 0 on PASS, 1 on FAIL (caller chooses whether to abort).
#
# The 4 invariants (from 03-CONTEXT.md D-04):
#   1. assert_no_data_loss     — every CREATED issue in audit log appears in `bd list --status=all`.
#   2. assert_no_id_collision  — all IDs in audit log are unique.
#   3. assert_no_stale_state   — write in wt-A is observable from wt-B without manual sync.
#   4. assert_atomic_markdown  — no roadmap snapshot captured during the burst is mid-write truncated.

# ---------------------------------------------------------------------------
# Shared helpers (caller is expected to have `pass` and `fail` set in scope).
# ---------------------------------------------------------------------------
__assert_pass() {
  echo "[PASS] $1"
  pass=$((pass + 1))
}
__assert_fail() {
  echo "[FAIL] $1"
  fail=$((fail + 1))
}

# ---------------------------------------------------------------------------
# assert_no_data_loss <source_beads_dir> <audit_log>
# Counts CREATED entries in the audit log; compares to bd list --status=all length.
# D-04 invariant 1.
# ---------------------------------------------------------------------------
assert_no_data_loss() {
  local source_beads="$1" audit_log="$2"
  local created listed
  created=$(grep -c '^CREATED' "$audit_log" 2>/dev/null || echo 0)
  listed=$(BEADS_DIR="$source_beads" bd list --status=all --json 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
  if [ "$created" -le "$listed" ] && [ "$created" -gt 0 ]; then
    __assert_pass "Invariant 1 (no data loss): created=$created listed=$listed"
    return 0
  else
    __assert_fail "Invariant 1 (no data loss): created=$created listed=$listed (expected created>0 AND listed>=created)"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_no_id_collision <audit_log>
# All IDs emitted via `CREATED <id>` lines must be unique.
# D-04 invariant 2.
# ---------------------------------------------------------------------------
assert_no_id_collision() {
  local audit_log="$1"
  local created uniq
  created=$(grep -c '^CREATED' "$audit_log" 2>/dev/null || echo 0)
  uniq=$(awk '$1=="CREATED"{print $2}' "$audit_log" 2>/dev/null | sort -u | wc -l)
  if [ "$created" -gt 0 ] && [ "$created" -eq "$uniq" ]; then
    __assert_pass "Invariant 2 (no ID collision): created=$created unique=$uniq"
    return 0
  else
    __assert_fail "Invariant 2 (no ID collision): created=$created unique=$uniq (expected equal and >0)"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_no_stale_state <source_beads_dir> <wt_a> <wt_b>
# Writes a uniquely-titled task in wt_a; reads it back from wt_b.
# Asserts seen=1 (cross-worktree state sharing without manual sync).
# D-04 invariant 3.
# ---------------------------------------------------------------------------
assert_no_stale_state() {
  local source_beads="$1" wt_a="$2" wt_b="$3"
  local title="stale-test-$RANDOM-$RANDOM"
  local seen
  ( cd "$wt_a" && BEADS_DIR="$source_beads" bd q "$title" -t task -p 3 ) >/dev/null 2>&1 || true
  seen=$(cd "$wt_b" && BEADS_DIR="$source_beads" bd list --status=all --json 2>/dev/null \
    | jq --arg t "$title" '[.[] | select(.title==$t)] | length' 2>/dev/null || echo 0)
  if [ "$seen" = "1" ]; then
    __assert_pass "Invariant 3 (no stale state): wt-A wrote, wt-B saw '$title'"
    return 0
  else
    __assert_fail "Invariant 3 (no stale state): wt-A wrote '$title', wt-B saw $seen matches (expected 1)"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_atomic_markdown <snapshot_dir>
# Checks every roadmap-snap-*.md in $snapshot_dir for valid structure.
# An atomic write produces a complete file (with the ## Progress table at the end).
# A mid-write read would either be empty OR cut off mid-table.
# D-04 invariant 4.
# ---------------------------------------------------------------------------
assert_atomic_markdown() {
  local snap_dir="$1"
  local total=0 bad=0
  shopt -s nullglob
  for snap in "$snap_dir"/roadmap-snap-*.md; do
    total=$((total + 1))
    # An atomic ROADMAP.md must contain the literal "## Progress" header (regen-roadmap.sh always emits it).
    # A truncated mid-write would lack this terminator.
    if [ ! -s "$snap" ]; then
      bad=$((bad + 1))
      continue
    fi
    if ! grep -q '^## Progress' "$snap"; then
      bad=$((bad + 1))
    fi
  done
  shopt -u nullglob
  if [ "$total" -eq 0 ]; then
    __assert_fail "Invariant 4 (atomic markdown): NO snapshots captured in $snap_dir (expected >0 from concurrent burst)"
    return 1
  fi
  if [ "$bad" -eq 0 ]; then
    __assert_pass "Invariant 4 (atomic markdown): $total/$total snapshots well-formed (no mid-write reads)"
    return 0
  else
    __assert_fail "Invariant 4 (atomic markdown): $bad/$total snapshots truncated/empty (expected 0 truncations)"
    return 1
  fi
}
