#!/usr/bin/env bash
# Tests for the install-time append of worktree-post-checkout.sh into .beads/hooks/post-checkout.
# Note: the SCRIPT itself is idempotent via marker file. This test covers the APPEND idempotency (Pitfall 7).
# B6 note: the load-bearing T-02-06 mitigation (no in-place sed, atomic mktemp+mv) lives on install.sh in Plan 02-05.
# The actual append helper lives in Plan 02-05's install.sh; this test exercises just the append logic with a defensive in-test helper.
# CASE 1: appending the BEGIN..END block to an empty post-checkout file → exactly 1 block
# CASE 2: appending TWICE to the same file → still exactly 1 block (sed /BEGIN/,/END/d then re-append)
# CASE 3: appending into a file that already has bd's BEGIN BEADS INTEGRATION block → coexists; both blocks present
# CASE 4: appending with newer version (`v2`) → old `v1` block removed first
set -euo pipefail

SHIM="$(cd "$(dirname "$0")/../.." && pwd)/hooks/worktree-post-checkout.sh"

if [ ! -f "$SHIM" ]; then
  echo "ERROR: shim not found at $SHIM" >&2
  exit 1
fi

pass=0
fail=0

case_run() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    status=PASS
    pass=$((pass + 1))
  else
    status=FAIL
    fail=$((fail + 1))
  fi
  printf '  [%s] %-60s expected=%-30s actual=%s\n' "$status" "$name" "$expected" "$actual"
}

# count_pattern: safely count lines matching a grep pattern in a file.
# Under set -euo pipefail, grep exits 1 on 0 matches which kills the script.
# Use `{ grep ... || true; }` to absorb the non-zero exit, then pipe to wc.
count_pattern() {
  local pattern="$1" file="$2"
  { grep "$pattern" "$file" 2>/dev/null || true; } | wc -l | tr -d ' '
}

# In-test append helper: mirrors the atomic mktemp+mv pattern that Plan 02-05's install.sh must use.
# T-02-06 defensive guard: uses mktemp+mv (atomic rename), NOT in-place sed.
# The canonical load-bearing mitigation lives in Plan 02-05's install.sh.
append_shim() {
  local target="$1" shim="$2"
  mkdir -p "$(dirname "$target")"
  [ -f "$target" ] || { echo '#!/usr/bin/env bash' > "$target"; chmod +x "$target"; }
  # Atomic strip-then-append to avoid in-place sed race (T-02-06 mitigation)
  tmp=$(mktemp)
  sed '/^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$/,/^# --- END GSD-BEADS WORKTREE INIT ---$/d' "$target" > "$tmp"
  cat "$shim" >> "$tmp"
  mv "$tmp" "$target"
  chmod +x "$target"
}

tmpdir=$(mktemp -d /tmp/gsdtest.XXXXXX)
trap "rm -rf $tmpdir" EXIT

# CASE 1: append to empty file → exactly 1 BEGIN..END block
target1="$tmpdir/post-checkout-1"
append_shim "$target1" "$SHIM"
block_count=$(count_pattern '^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$' "$target1")
case_run "CASE 1: first append → exactly 1 BEGIN block" "1" "$block_count"

# CASE 2: append twice to same file → still exactly 1 block
target2="$tmpdir/post-checkout-2"
append_shim "$target2" "$SHIM"
append_shim "$target2" "$SHIM"
block_count2=$(count_pattern '^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$' "$target2")
case_run "CASE 2: double append → still exactly 1 BEGIN block" "1" "$block_count2"

# CASE 3: file already has bd's BEADS INTEGRATION block → both blocks coexist after append
target3="$tmpdir/post-checkout-3"
cat > "$target3" << 'BDBLOCK'
#!/usr/bin/env bash
# --- BEGIN BEADS INTEGRATION v1.0.3 ---
echo "bd hook here"
# --- END BEADS INTEGRATION ---
BDBLOCK
chmod +x "$target3"
append_shim "$target3" "$SHIM"
beads_blocks=$(count_pattern '^# --- BEGIN BEADS INTEGRATION' "$target3")
gsd_blocks=$(count_pattern '^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$' "$target3")
case_run "CASE 3: bd block preserved after append (beads block count=1)" "1" "$beads_blocks"
case_run "CASE 3: gsd-beads block present alongside bd block (gsd block count=1)" "1" "$gsd_blocks"

# CASE 4: file has old v1 block, append a mock v2 shim → v1 removed, v2 present
target4="$tmpdir/post-checkout-4"
# First, append the real shim (creates v1 block)
append_shim "$target4" "$SHIM"

# Create a mock v2 shim
mock_v2="$tmpdir/mock-v2-shim.sh"
cat > "$mock_v2" << 'EOF'
# --- BEGIN GSD-BEADS WORKTREE INIT v2 ---
echo "v2 shim"
# --- END GSD-BEADS WORKTREE INIT ---
EOF

# Append helper for v2 (strips v1 OR v2 old blocks before appending v2)
append_shim_v2() {
  local target="$1" shim="$2"
  mkdir -p "$(dirname "$target")"
  [ -f "$target" ] || { echo '#!/usr/bin/env bash' > "$target"; chmod +x "$target"; }
  tmp=$(mktemp)
  sed '/^# --- BEGIN GSD-BEADS WORKTREE INIT v[0-9]* ---$/,/^# --- END GSD-BEADS WORKTREE INIT ---$/d' "$target" > "$tmp"
  cat "$shim" >> "$tmp"
  mv "$tmp" "$target"
  chmod +x "$target"
}

append_shim_v2 "$target4" "$mock_v2"
v1_after=$(count_pattern '^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$' "$target4")
v2_after=$(count_pattern '^# --- BEGIN GSD-BEADS WORKTREE INIT v2 ---$' "$target4")
case_run "CASE 4: v1 block removed when v2 appended" "0" "$v1_after"
case_run "CASE 4: v2 block present after upgrade" "1" "$v2_after"

echo ""
echo "Passed: $pass / $((pass + fail))"
[ "$fail" -eq 0 ]
