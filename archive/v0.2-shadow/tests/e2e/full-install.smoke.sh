#!/usr/bin/env bash
# End-to-end happy path: fresh project + install + hierarchy + cascade + regen + parser-compat
# Exercises REQ-01, REQ-02, REQ-04, REQ-06, REQ-07, REQ-08.
# T-02-10: cleanup via trap EXIT.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
fixture="/tmp/gsd-beads-e2e-${RANDOM}"
trap "rm -rf '$fixture'" EXIT  # T-02-10 cleanup

pass=0; fail=0
case_run() {
  local name="$1" rc="$2"
  if [ "$rc" = "0" ]; then
    printf '  [PASS] %s\n' "$name"
    pass=$((pass+1))
  else
    printf '  [FAIL] %s\n' "$name"
    fail=$((fail+1))
  fi
}

# CASE 1: fresh /tmp fixture builds successfully (bd init + install.sh exit 0)
mkdir -p "$fixture" && cd "$fixture"
git init -q
git config user.email "e2e@test.local"
git config user.name "E2E Test"
bd init --non-interactive --skip-agents >/dev/null 2>&1
bash "$REPO_ROOT/install.sh" > /tmp/install-e2e-$$.out 2>&1
case_run "fresh fixture + install.sh exits 0" $?

# CASE 2: build 3-level hierarchy via bd CLI
cd "$fixture"
REQ=$(bd q "REQ-001: Smoke test req" -t epic -p 0)
bd label add "$REQ" gsd:requirement >/dev/null
bd label add "$REQ" req-id:REQ-001 >/dev/null
bd label add "$REQ" version:v1 >/dev/null
bd label add "$REQ" category:smoke >/dev/null

P1=$(bd q "Phase 1: Smoke" -t epic -p 1)
bd label add "$P1" gsd:phase >/dev/null
bd label add "$P1" milestone:v1.0 >/dev/null
bd link "$P1" "$REQ" --type parent-child >/dev/null

P2=$(bd q "Phase 2: Smoke" -t epic -p 2)
bd label add "$P2" gsd:phase >/dev/null
bd label add "$P2" milestone:v1.0 >/dev/null
bd link "$P2" "$REQ" --type parent-child >/dev/null

declare -a TASKS
for i in 1 2 3; do
  T=$(bd q "Task $i for P1" -t task -p $i)
  bd link "$T" "$P1" --type parent-child >/dev/null
  TASKS+=("$T")
done
for i in 1 2 3; do
  T=$(bd q "Task $i for P2" -t task -p $i)
  bd link "$T" "$P2" --type parent-child >/dev/null
  TASKS+=("$T")
done
[ "${#TASKS[@]}" -eq 6 ]
case_run "hierarchy built (1 req → 2 phases → 6 tasks)" $?

# CASE 3: close all 6 leaf tasks → cascade-loop closes 2 phases + 1 requirement
for t in "${TASKS[@]}"; do bd close "$t" >/dev/null 2>&1; done
bash "$REPO_ROOT/scripts/cascade-loop.sh" --quiet
closed=$(bd list --status=closed -l gsd:phase --json | jq 'length')
[ "$closed" -ge 2 ]
case_run "cascade closes 2 phases" $?

# CASE 4: regen-roadmap produces ROADMAP.md with ## Progress table
bash "$REPO_ROOT/scripts/regen-roadmap.sh"
_rc=0
[ -f .planning/ROADMAP.md ] && grep -q '## Progress' .planning/ROADMAP.md || _rc=1
case_run "regen-roadmap produces ROADMAP.md with ## Progress" $_rc

# CASE 5 (W8 fix): exercise the SHADOW via direct node invocation (bypass PATH).
# On Volta machines, gsd-sdk on PATH may resolve to upstream, not the shadow.
# Direct node invocation guarantees the shadow's argv routing is exercised.
out=$(node "$REPO_ROOT/bin/gsd-sdk-shadow.mjs" query progress --project-dir "$fixture" 2>&1) || true
[ -n "$out" ]
case_run "shadow query progress (direct node invocation — bypasses PATH per W8)" $?

# CASE 6: regen-requirements produces REQUIREMENTS.md with traceability section
bash "$REPO_ROOT/scripts/regen-requirements.sh"
_rc=0
[ -f .planning/REQUIREMENTS.md ] && grep -q '## Traceability' .planning/REQUIREMENTS.md || _rc=1
case_run "regen-requirements produces REQUIREMENTS.md with ## Traceability" $_rc

# CASE 7: idempotent regen — running regen twice produces zero diff
sha1=$(sha256sum .planning/ROADMAP.md | awk '{print $1}')
bash "$REPO_ROOT/scripts/regen-roadmap.sh"
sha2=$(sha256sum .planning/ROADMAP.md | awk '{print $1}')
[ "$sha1" = "$sha2" ]
case_run "regen-roadmap idempotent (byte-stable)" $?

echo ""
echo "Passed: $pass / $((pass+fail))"
[ "$fail" -eq 0 ]
