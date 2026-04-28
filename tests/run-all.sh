#!/usr/bin/env bash
# Run every test suite. Excludes 50-bead perf test (run separately).
set -uo pipefail
fail=0
for suite in tests/hook-tests/*.test.sh tests/install-tests/*.test.sh tests/worktree-tests/*.test.sh tests/e2e/*.smoke.sh; do
  [ -f "$suite" ] || continue
  echo "=== $suite ==="
  bash "$suite" || fail=$((fail+1))
done
for suite in tests/shadow-tests/*.test.mjs; do
  [ -f "$suite" ] || continue
  echo "=== $suite ==="
  node --test "$suite" || fail=$((fail+1))
done
echo "Suites failed: $fail"
[ "$fail" -eq 0 ]
