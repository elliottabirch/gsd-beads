#!/usr/bin/env bash
# Usage: tests/run-quick.sh <component-or-suite-name>
# Routes to per-component test suite. Exit 0 = green, non-zero = red.
set -euo pipefail
component="${1:-}"
if [ -z "$component" ]; then echo "usage: $0 <component>"; exit 2; fi
case "$component" in
  block-state-md|bd-sync|block-gsd-sdk-mutation|cascade-loop|regen-roadmap|regen-requirements)
    bash "tests/hook-tests/$component.test.sh" ;;
  argv-routing|wrap-mutation|handler-phase-add)
    node --test "tests/shadow-tests/$component.test.mjs" ;;
  idempotency|settings-merge|memory-seeding|path-precedence|no-gsd-core-mutation)
    bash "tests/install-tests/$component.test.sh" ;;
  auto-config|append-idempotency)
    bash "tests/worktree-tests/$component.test.sh" ;;
  *) echo "unknown component: $component"; exit 2 ;;
esac
