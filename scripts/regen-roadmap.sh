#!/usr/bin/env bash
# Regenerate .planning/ROADMAP.md from the beads bead store.
#
# Source of truth: bd list --type=epic -l gsd:phase + bd children + bd show
# Output: .planning/ROADMAP.md (written atomically via tmp file + mv)
#
# Idempotency: produces byte-stable output for unchanged bd state.
# Phases sorted by priority then created_at (jq sort_by) for stable ordering.
#
# T-02-09 mitigation: only writes to .planning/ROADMAP.md — never touches
# GSD core files or any path outside the project directory.
#
# Stack: bash + jq + bd CLI only (no Node, no Python).
set -euo pipefail

# ---------------------------------------------------------------------------
# Pre-flight: locate project root
# ---------------------------------------------------------------------------
if root=$(git rev-parse --show-toplevel 2>/dev/null); then
  : # git root found
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  root="$CLAUDE_PROJECT_DIR"
else
  root="$PWD"
fi

OUT="$root/.planning/ROADMAP.md"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

mkdir -p "$(dirname "$OUT")"

# ---------------------------------------------------------------------------
# Helper: extract first line of a description field
# ---------------------------------------------------------------------------
desc_first_line() {
  printf '%s' "$1" | head -1
}

# ---------------------------------------------------------------------------
# Helper: extract value after "Goal:" in description
# ---------------------------------------------------------------------------
extract_goal() {
  local desc="$1"
  # Look for a line starting with "Goal:" and return the remainder
  printf '%s' "$desc" | grep -m1 '^Goal:' | sed 's/^Goal:[[:space:]]*//' || true
}

# ---------------------------------------------------------------------------
# Helper: extract lines under "Success Criteria:" in description
# ---------------------------------------------------------------------------
extract_success_criteria() {
  local desc="$1"
  printf '%s' "$desc" | awk '
    /^Success Criteria:/ { found=1; next }
    found && /^[A-Z]/ { exit }
    found { print }
  ' | grep -v '^[[:space:]]*$' | head -10 || true
}

# ---------------------------------------------------------------------------
# Pull project name
# ---------------------------------------------------------------------------
project_name=$(bd config get project.name 2>/dev/null | sed 's/^project\.name = //' | grep -v '(not set)' || true)
if [ -z "$project_name" ]; then
  project_name=$(basename "$root")
fi

# ---------------------------------------------------------------------------
# Pull all phase beads, sorted by priority then created_at (determinism)
# ---------------------------------------------------------------------------
phases_json=$(bd list --type=epic -l gsd:phase --status=all -n 0 --json | \
  jq 'sort_by(.priority, .created_at)')

phase_count=$(printf '%s' "$phases_json" | jq 'length')

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
printf '# Roadmap: %s\n\n' "$project_name" >> "$tmp"

# ---------------------------------------------------------------------------
# Overview (from PROJECT.md if present, else empty placeholder)
# ---------------------------------------------------------------------------
project_md="$root/.planning/PROJECT.md"
printf '## Overview\n\n' >> "$tmp"
if [ -f "$project_md" ]; then
  # Extract first paragraph after the title line
  overview=$(awk '
    /^# Project:/ { skip=1; next }
    skip && /^$/ { empty++; next }
    skip && empty > 0 && /^[^#]/ { print; empty=0; next }
    skip && empty == 0 && /^[^#]/ { print; next }
    /^##/ && skip { exit }
  ' "$project_md" | head -5)
  if [ -n "$overview" ]; then
    printf '%s\n\n' "$overview" >> "$tmp"
  else
    printf '\n' >> "$tmp"
  fi
else
  printf '\n' >> "$tmp"
fi

# ---------------------------------------------------------------------------
# Phase summary list
# ---------------------------------------------------------------------------
if [ "$phase_count" -gt 0 ]; then
  printf '%s' "$phases_json" | jq -r '.[] | @base64' | while IFS= read -r b64; do
    phase=$(printf '%s' "$b64" | base64 -d)
    p_title=$(printf '%s' "$phase" | jq -r '.title')
    p_status=$(printf '%s' "$phase" | jq -r '.status')
    p_desc=$(printf '%s' "$phase" | jq -r '.description // ""')
    p_first=$(desc_first_line "$p_desc")

    if [ "$p_status" = "closed" ]; then
      p_checkbox="x"
    else
      p_checkbox=" "
    fi

    if [ -n "$p_first" ] && [ "$p_first" != "null" ]; then
      printf -- '- [%s] **%s** - %s\n' "$p_checkbox" "$p_title" "$p_first" >> "$tmp"
    else
      printf -- '- [%s] **%s**\n' "$p_checkbox" "$p_title" >> "$tmp"
    fi
  done
  printf '\n' >> "$tmp"
fi

# ---------------------------------------------------------------------------
# Per-phase detail blocks
# ---------------------------------------------------------------------------
if [ "$phase_count" -gt 0 ]; then
  printf '%s' "$phases_json" | jq -r '.[] | @base64' | while IFS= read -r b64; do
    phase=$(printf '%s' "$b64" | base64 -d)
    phase_id=$(printf '%s' "$phase" | jq -r '.id')
    p_title=$(printf '%s' "$phase" | jq -r '.title')
    p_status=$(printf '%s' "$phase" | jq -r '.status')
    p_desc=$(printf '%s' "$phase" | jq -r '.description // ""')

    # Phase header
    printf '### %s\n' "$p_title" >> "$tmp"

    # Goal
    goal=$(extract_goal "$p_desc")
    if [ -n "$goal" ]; then
      printf '**Goal**: %s\n' "$goal" >> "$tmp"
    else
      printf '**Goal**: (see description)\n' >> "$tmp"
    fi

    # Depends on: look for blocks-type dependencies (not parent-child)
    # For now emit empty (plan 02-01 scope; full dep graph in 02-02+)
    printf '**Depends on**: (none)\n' >> "$tmp"

    # Requirements: get parent req-id labels via bd show (.[0].dependencies contains parent beads)
    req_ids=$(bd show "$phase_id" --json | \
      jq -r '.[0].dependencies[] | select(.dependency_type=="parent-child") | .labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | \
      sort | paste -sd ',' - 2>/dev/null || true)
    if [ -n "$req_ids" ]; then
      printf '**Requirements**: [%s]\n' "$req_ids" >> "$tmp"
    else
      printf '**Requirements**: []\n' >> "$tmp"
    fi

    # Success Criteria
    criteria=$(extract_success_criteria "$p_desc")
    printf '**Success Criteria** (what must be TRUE):\n' >> "$tmp"
    if [ -n "$criteria" ]; then
      printf '%s\n' "$criteria" >> "$tmp"
    else
      printf '(see description)\n' >> "$tmp"
    fi

    # Children (plans)
    children_json=$(bd children "$phase_id" --json 2>/dev/null || printf '[]')
    child_count=$(printf '%s' "$children_json" | jq 'length')
    printf '**Plans**: %s plans\n' "$child_count" >> "$tmp"

    if [ "$child_count" -gt 0 ]; then
      printf '%s' "$children_json" | jq -r 'sort_by(.priority, .created_at) | .[] | @base64' | \
        while IFS= read -r cb64; do
          child=$(printf '%s' "$cb64" | base64 -d)
          child_id=$(printf '%s' "$child" | jq -r '.id')
          child_title=$(printf '%s' "$child" | jq -r '.title')
          child_bead_status=$(printf '%s' "$child" | jq -r '.status')
          if [ "$child_bead_status" = "closed" ]; then
            printf -- '- [x] %s: %s\n' "$child_id" "$child_title" >> "$tmp"
          else
            printf -- '- [ ] %s: %s\n' "$child_id" "$child_title" >> "$tmp"
          fi
        done
    fi

    printf '\n' >> "$tmp"
  done
fi

# ---------------------------------------------------------------------------
# Progress table
# ---------------------------------------------------------------------------
printf '## Progress\n' >> "$tmp"
printf '| Phase | Status | Plans Done | Plans Total |\n' >> "$tmp"
printf '|-------|--------|------------|-------------|\n' >> "$tmp"

if [ "$phase_count" -gt 0 ]; then
  printf '%s' "$phases_json" | jq -r '.[] | @base64' | while IFS= read -r b64; do
    phase=$(printf '%s' "$b64" | base64 -d)
    phase_id=$(printf '%s' "$phase" | jq -r '.id')
    p_title=$(printf '%s' "$phase" | jq -r '.title')
    p_status=$(printf '%s' "$phase" | jq -r '.status')

    # Derive human-readable status
    case "$p_status" in
      open)        human_status="Not started" ;;
      in_progress) human_status="In progress" ;;
      closed)      human_status="Complete" ;;
      deferred)    human_status="Deferred" ;;
      *)           human_status="$p_status" ;;
    esac

    # Count children (plans done vs total)
    children_json=$(bd children "$phase_id" --json 2>/dev/null || printf '[]')
    plans_total=$(printf '%s' "$children_json" | jq 'length')
    plans_done=$(printf '%s' "$children_json" | jq '[.[] | select(.status=="closed")] | length')

    printf '| %s | %s | %s | %s |\n' "$p_title" "$human_status" "$plans_done" "$plans_total" >> "$tmp"
  done
fi

printf '\n' >> "$tmp"

# ---------------------------------------------------------------------------
# Atomic write: mv tmp → .planning/ROADMAP.md
# ---------------------------------------------------------------------------
mv "$tmp" "$OUT"  # OUT=$root/.planning/ROADMAP.md
trap - EXIT
