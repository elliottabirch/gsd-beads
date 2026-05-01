#!/usr/bin/env bash
# Regenerate .planning/REQUIREMENTS.md from the beads bead store.
#
# Source of truth: bd list --type=epic -l gsd:requirement + bd show
# Output: .planning/REQUIREMENTS.md (written atomically via tmp file + mv)
#
# Idempotency: produces byte-stable output for unchanged bd state.
# Requirements sorted by priority then created_at (jq sort_by) for stable ordering.
#
# T-02-09 mitigation: only writes to .planning/REQUIREMENTS.md — never touches
# GSD core files or any path outside the project directory.
#
# Stack: bash + jq + bd CLI only (no Node, no Python).
set -euo pipefail

# --- BEGIN GSD-BEADS LOCK PREAMBLE v1 ---
# Resolve source repo's .beads/ from any worktree, absolutize via cd+pwd -P.
common=$(git rev-parse --git-common-dir 2>/dev/null) || common="$PWD/.git"
source_root="$(dirname "$(cd "$common" && pwd -P)")"
LOCK="$source_root/.beads/.gsd-beads.lock"

# Pre-flight: flock present? (Pitfall 1 — macOS users must brew install flock)
if ! command -v flock >/dev/null 2>&1; then
  echo "[gsd-beads] ERROR: flock not installed (macOS: brew install flock)" >&2
  exit 1
fi

# Lazy-create lock file (zero bytes, never deleted; *.lock is already in .beads/.gitignore).
mkdir -p "$(dirname "$LOCK")"
[ -e "$LOCK" ] || : > "$LOCK"

# Acquire exclusive lock (30s timeout matches bd-sync.sh hook timeout in settings.fragment.json).
exec 9>"$LOCK"
if ! flock -x -w 30 9; then
  echo "[gsd-beads] another regen is in progress at $LOCK — retry shortly" >&2
  exit 1
fi
# Lock auto-released when fd 9 closes (script exit).
# --- END GSD-BEADS LOCK PREAMBLE v1 ---

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

OUT="$root/.planning/REQUIREMENTS.md"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

mkdir -p "$(dirname "$OUT")"

# ---------------------------------------------------------------------------
# Pull project name (same as regen-roadmap.sh)
# ---------------------------------------------------------------------------
project_name=$(bd config get project.name 2>/dev/null | sed 's/^project\.name = //' | grep -v '(not set)' || true)
if [ -z "$project_name" ]; then
  project_name=$(basename "$root")
fi

# ---------------------------------------------------------------------------
# Pull project core value from PROJECT.md (if available)
# ---------------------------------------------------------------------------
project_md="$root/.planning/PROJECT.md"
core_value=""
if [ -f "$project_md" ]; then
  # Extract text after "## Why" heading (first paragraph)
  core_value=$(awk '
    /^## Why/ { found=1; next }
    found && /^$/ { empty++; next }
    found && empty > 0 && /^[^#]/ { print; exit }
    /^##/ && found { exit }
  ' "$project_md" | head -3 | tr '\n' ' ' | sed 's/[[:space:]]*$//')
fi

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
printf '# Requirements: %s\n\n' "$project_name" >> "$tmp"
printf '**Defined:** %s\n' "$(date +%F)" >> "$tmp"
if [ -n "$core_value" ]; then
  printf '**Core Value:** %s\n\n' "$core_value" >> "$tmp"
else
  printf '**Core Value:**\n\n' >> "$tmp"
fi

# ---------------------------------------------------------------------------
# Pull all requirement beads, sorted by priority then created_at (determinism)
# ---------------------------------------------------------------------------
reqs_json=$(bd list --type=epic -l gsd:requirement --status=all -n 0 --json | \
  jq 'sort_by(.priority, .created_at)')

req_count=$(printf '%s' "$reqs_json" | jq 'length')

# ---------------------------------------------------------------------------
# Group by version:v* label, then sub-group by category:* label
# ---------------------------------------------------------------------------

# Extract all unique version values (sorted)
versions=$(printf '%s' "$reqs_json" | \
  jq -r '.[] | .labels[] | select(startswith("version:")) | ltrimstr("version:")' | \
  sort -u)

if [ -n "$versions" ]; then
  for version in $versions; do
    # Filter reqs with this version label
    version_reqs=$(printf '%s' "$reqs_json" | \
      jq --arg v "version:$version" '[.[] | select(.labels[] == $v)]')
    v_count=$(printf '%s' "$version_reqs" | jq 'length')

    if [ "$v_count" -eq 0 ]; then
      continue
    fi

    printf '## %s Requirements\n\n' "$version" >> "$tmp"

    # Extract all unique categories for this version's reqs
    categories=$(printf '%s' "$version_reqs" | \
      jq -r '.[] | .labels[] | select(startswith("category:")) | ltrimstr("category:")' | \
      sort -u)

    if [ -n "$categories" ]; then
      for cat in $categories; do
        # Capitalize category slug for header (Gap 2 fix, REQ-06 portability):
        # macOS BSD sed does not support the GNU uppercase escape — drop
        # sed entirely and rely on POSIX-mandated tr+awk for Title-Case.
        cat_header=$(printf '%s' "$cat" \
          | tr '-' ' ' \
          | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')

        printf '### %s\n\n' "$cat_header" >> "$tmp"

        # Filter reqs with this category label
        cat_reqs=$(printf '%s' "$version_reqs" | \
          jq --arg c "category:$cat" '[.[] | select(.labels[] == $c)]')

        printf '%s' "$cat_reqs" | jq -r '.[] | @base64' | while IFS= read -r b64; do
          req=$(printf '%s' "$b64" | base64 -d)
          r_title=$(printf '%s' "$req" | jq -r '.title')
          r_status=$(printf '%s' "$req" | jq -r '.status')
          req_id=$(printf '%s' "$req" | jq -r '.labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | head -1)

          if [ -z "$req_id" ]; then
            req_id=$(printf '%s' "$req" | jq -r '.id')
          fi

          if [ "$r_status" = "closed" ]; then
            printf -- '- [x] **%s**: %s\n' "$req_id" "$r_title" >> "$tmp"
          else
            printf -- '- [ ] **%s**: %s\n' "$req_id" "$r_title" >> "$tmp"
          fi
        done

        printf '\n' >> "$tmp"
      done
    else
      # No category labels — list reqs directly under the version section
      printf '%s' "$version_reqs" | jq -r '.[] | @base64' | while IFS= read -r b64; do
        req=$(printf '%s' "$b64" | base64 -d)
        r_title=$(printf '%s' "$req" | jq -r '.title')
        r_status=$(printf '%s' "$req" | jq -r '.status')
        req_id=$(printf '%s' "$req" | jq -r '.labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | head -1)

        if [ -z "$req_id" ]; then
          req_id=$(printf '%s' "$req" | jq -r '.id')
        fi

        if [ "$r_status" = "closed" ]; then
          printf -- '- [x] **%s**: %s\n' "$req_id" "$r_title" >> "$tmp"
        else
          printf -- '- [ ] **%s**: %s\n' "$req_id" "$r_title" >> "$tmp"
        fi
      done
      printf '\n' >> "$tmp"
    fi
  done
else
  # No version labels at all — list all reqs under a generic section
  if [ "$req_count" -gt 0 ]; then
    printf '## Requirements\n\n' >> "$tmp"
    printf '%s' "$reqs_json" | jq -r '.[] | @base64' | while IFS= read -r b64; do
      req=$(printf '%s' "$b64" | base64 -d)
      r_title=$(printf '%s' "$req" | jq -r '.title')
      r_status=$(printf '%s' "$req" | jq -r '.status')
      req_id=$(printf '%s' "$req" | jq -r '.labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | head -1)

      if [ -z "$req_id" ]; then
        req_id=$(printf '%s' "$req" | jq -r '.id')
      fi

      if [ "$r_status" = "closed" ]; then
        printf -- '- [x] **%s**: %s\n' "$req_id" "$r_title" >> "$tmp"
      else
        printf -- '- [ ] **%s**: %s\n' "$req_id" "$r_title" >> "$tmp"
      fi
    done
    printf '\n' >> "$tmp"
  fi
fi

# ---------------------------------------------------------------------------
# Out of Scope table: closed beads with close_reason=out-of-scope
# ---------------------------------------------------------------------------
oos=$(bd list --type=epic -l gsd:requirement --status=closed --json | \
  jq '[.[] | select(.close_reason=="out-of-scope")]')
oos_count=$(printf '%s' "$oos" | jq 'length')

printf '## Out of Scope\n\n' >> "$tmp"
printf '| ID | Title | Reason |\n' >> "$tmp"
printf '|-----|-------|--------|\n' >> "$tmp"

if [ "$oos_count" -gt 0 ]; then
  printf '%s' "$oos" | jq -r '.[] | @base64' | while IFS= read -r b64; do
    req=$(printf '%s' "$b64" | base64 -d)
    r_title=$(printf '%s' "$req" | jq -r '.title')
    r_reason=$(printf '%s' "$req" | jq -r '.close_reason // "closed"')
    req_id=$(printf '%s' "$req" | jq -r '.labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | head -1)

    if [ -z "$req_id" ]; then
      req_id=$(printf '%s' "$req" | jq -r '.id')
    fi

    printf '| %s | %s | %s |\n' "$req_id" "$r_title" "$r_reason" >> "$tmp"
  done
fi

printf '\n' >> "$tmp"

# ---------------------------------------------------------------------------
# Traceability table: requirement → phases via parent-child
# ---------------------------------------------------------------------------
printf '## Traceability\n\n' >> "$tmp"
printf '| Requirement | Phases |\n' >> "$tmp"
printf '|-------------|--------|\n' >> "$tmp"

if [ "$req_count" -gt 0 ]; then
  # Two-pass approach:
  # Pass 1: iterate phases, emit "TRACE:<req-id>:<phase-title>" lines to a temp file
  # Pass 2: aggregate by req-id, emit table rows

  trace_tmp=$(mktemp)

  phases_json=$(bd list --type=epic -l gsd:phase --status=all -n 0 --json | \
    jq 'sort_by(.priority, .created_at)')

  printf '%s' "$phases_json" | jq -r '.[] | @base64' | while IFS= read -r pb64; do
    phase=$(printf '%s' "$pb64" | base64 -d)
    phase_id=$(printf '%s' "$phase" | jq -r '.id')
    p_title=$(printf '%s' "$phase" | jq -r '.title')

    # Get parent req-id labels for this phase (redirect bd stdin to avoid pipe contamination)
    parent_req_ids=$(bd show "$phase_id" --json </dev/null | \
      jq -r '.[0].dependencies[] | select(.dependency_type=="parent-child") | .labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' \
      2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)

    if [ -n "$parent_req_ids" ]; then
      # Write one TRACE entry per comma-separated req-id
      # Using direct append to avoid nested pipe-subshell issue
      old_IFS="$IFS"
      IFS=','
      for rid in $parent_req_ids; do
        printf 'TRACE:%s:%s\n' "$rid" "$p_title" >> "$trace_tmp"
      done
      IFS="$old_IFS"
    fi
  done

  # Pass 2: for each requirement in sorted order, look up its phases in trace_tmp
  printf '%s' "$reqs_json" | jq -r '.[] | @base64' | while IFS= read -r rb64; do
    req=$(printf '%s' "$rb64" | base64 -d)
    req_id=$(printf '%s' "$req" | jq -r '.labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | head -1)
    req_bead_id=$(printf '%s' "$req" | jq -r '.id')

    if [ -z "$req_id" ]; then
      req_id="$req_bead_id"
    fi

    # Collect all phase titles for this req_id from trace_tmp
    phase_titles=$(grep "^TRACE:${req_id}:" "$trace_tmp" 2>/dev/null | \
      sed "s|^TRACE:${req_id}:||" | sort | paste -sd ',' - 2>/dev/null | sed 's/,/, /g' || true)

    printf '| %s | %s |\n' "$req_id" "${phase_titles:-(none)}" >> "$tmp"
  done

  rm -f "$trace_tmp"
fi

printf '\n' >> "$tmp"

# ---------------------------------------------------------------------------
# Atomic write: mv tmp → .planning/REQUIREMENTS.md
# ---------------------------------------------------------------------------
mv "$tmp" "$OUT"  # OUT=$root/.planning/REQUIREMENTS.md
trap - EXIT
