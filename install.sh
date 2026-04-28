#!/usr/bin/env bash
# gsd-beads installer — self-contained per D-04 revised.
# Idempotent (REQ-06). REQ-02: never writes outside ~/.claude/{hooks,scripts}/ and ~/.local/bin/.
# T-02-06 canonical mitigation (B6 fix): atomic mktemp+mv only — never uses in-place editing.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd -P)"
HOOKS_DEST="$HOME/.claude/hooks"
SCRIPTS_DEST="$HOME/.claude/scripts"
BIN_DEST="$HOME/.local/bin"
SETTINGS="$HOME/.claude/settings.json"
FRAGMENT="$REPO/settings.fragment.json"

# ── Step 1: Pre-flight ──────────────────────────────────────────────
command -v bd >/dev/null 2>&1 || { echo "ERROR: bd not installed"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not installed"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not installed"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "ERROR: git not installed"; exit 1; }
node -e 'process.exit(parseInt(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' \
  || { echo "ERROR: node >=22 required (have $(node --version))"; exit 1; }

# ── Step 2: Mirror hook + script files into ~/.claude/ ──────────────
# REQ-02: write only under ~/.claude/{hooks,scripts}/ and ~/.local/bin/ — nowhere else.
mkdir -p "$HOOKS_DEST" "$SCRIPTS_DEST" "$BIN_DEST"

install_file() {
  local src="$1" dest="$2"
  cp -p "$src" "$dest"
  chmod +x "$dest"
}
install_file "$REPO/hooks/block-state-md.sh"          "$HOOKS_DEST/block-state-md.sh"
install_file "$REPO/hooks/bd-sync.sh"                 "$HOOKS_DEST/bd-sync.sh"
install_file "$REPO/hooks/block-gsd-sdk-mutation.sh"  "$HOOKS_DEST/block-gsd-sdk-mutation.sh"
install_file "$REPO/scripts/cascade-loop.sh"          "$SCRIPTS_DEST/cascade-loop.sh"
install_file "$REPO/scripts/regen-roadmap.sh"         "$SCRIPTS_DEST/regen-roadmap.sh"
install_file "$REPO/scripts/regen-requirements.sh"    "$SCRIPTS_DEST/regen-requirements.sh"

# ── Step 3: Settings.json deep-merge with dedup (Pitfall 6) ─────────
# Dedup key: (matcher, command, if) — unique_by("\(.command)\(.if // "")") within each matcher group.
# Path substitution (Gap 1 fix): settings.fragment.json contains
# `$CLAUDE_PROJECT_DIR/.claude/hooks/...` placeholders. Claude Code expands
# `$CLAUDE_PROJECT_DIR` to the user's project directory, NOT to ~/.claude/.
# Hooks live at $HOOKS_DEST. Substitute in-flight before merge so the
# on-disk fragment is unchanged but merged settings.json has resolvable paths.
# Atomic write: mktemp+mv (T-02-07 mitigation).
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
fragment_resolved="$(mktemp)"
tmp="$(mktemp)"
# Localized trap (WR-01 fix): under `set -e`, any failure in sed/jq/mv
# below would abort before the explicit `rm -f` cleanup, leaking the
# tempfiles into /tmp. The trap guarantees cleanup on the error path;
# the happy path clears the trap and removes $fragment_resolved
# explicitly so the post-Step-3 environment is unchanged.
trap 'rm -f "$fragment_resolved" "$tmp"' EXIT
# WR-02 fix: pre-escape sed-replacement metacharacters in $HOOKS_DEST.
# In sed's replacement string the characters `\`, `&`, and the chosen
# delimiter `|` are special. Most posix $HOME values are safe, but a
# pathological value (e.g., HOME=/tmp/build|1, or a misconfigured WSL
# import like HOME=/c\\Users\\me) would silently produce a broken
# settings.json. Escaping the replacement closes the footgun.
hooks_dest_escaped=$(printf '%s' "$HOOKS_DEST" | sed 's/[\&|]/\\&/g')
sed "s|\$CLAUDE_PROJECT_DIR/.claude/hooks|$hooks_dest_escaped|g" "$FRAGMENT" > "$fragment_resolved"
jq -s '
.[0] as $existing | .[1] as $fragment |
($existing.hooks // {}) as $eh | ($fragment.hooks // {}) as $fh |
([$eh, $fh] | map(keys[]) | unique) as $events |
($existing | del(.hooks)) * ($fragment | del(.hooks)) + {
  hooks: (
    reduce $events[] as $evt (
      {};
      . + {
        ($evt): (
          (($eh[$evt] // []) + ($fh[$evt] // [])) |
          group_by(.matcher) |
          map(.[0] + {hooks: (map(.hooks) | flatten | unique_by("\(.command)\(.if // "")"))})
        )
      }
    )
  )
}
' "$SETTINGS" "$fragment_resolved" > "$tmp"
mv "$tmp" "$SETTINGS"
trap - EXIT
rm -f "$fragment_resolved"

# ── Step 4: Shadow binary symlink + PATH precedence check (RESEARCH.md A5) ─
# Volta trap: ~/.volta/bin/gsd-sdk may shadow our ~/.local/bin/gsd-sdk.
# We warn but do not abort — PATH ordering is user's responsibility.
SHADOW="$REPO/bin/gsd-sdk-shadow.mjs"
chmod +x "$SHADOW"
chmod +x "$REPO/bin/wrap-mutation.mjs"
ln -sfn "$SHADOW" "$BIN_DEST/gsd-sdk"

first="$(command -v gsd-sdk 2>/dev/null || true)"
case "$first" in
  "$BIN_DEST/gsd-sdk")
    echo "shadow active at $BIN_DEST/gsd-sdk" ;;
  "")
    echo "shadow at $BIN_DEST/gsd-sdk symlinked but $BIN_DEST not on PATH — add 'export PATH=\"\$HOME/.local/bin:\$PATH\"' to your shell rc" ;;
  *)
    echo "shadow at $BIN_DEST/gsd-sdk is shadowed by $first — prepend ~/.local/bin to PATH (Volta users: edit ~/.profile)" ;;
esac

# ── Step 5: Seed bd memories (idempotent: forget then remember) ────
# bd forget exits 0 even if key does not exist — safe to run on first install.
for f in "$REPO"/install/memories/*.md; do
  key="gsd-beads:$(basename "$f" .md)"
  bd forget "$key" 2>/dev/null || true
  bd remember --key "$key" "$(cat "$f")"
done
echo "seeded $(ls "$REPO"/install/memories/*.md | wc -l | tr -d ' ') bd memories under gsd-beads:*"

# ── Step 6: Worktree post-checkout shim append (Pitfall 7 / T-02-06) ─
# Appends hooks/worktree-post-checkout.sh (contains BEGIN GSD-BEADS WORKTREE INIT v1 sentinel)
# into .beads/hooks/post-checkout via atomic mktemp+mv pattern.
# Only runs when the current working directory is a beads-managed project (has .beads/).
if [ -d "$PWD/.beads" ] && [ "$PWD" != "$REPO" ]; then
  target="$PWD/.beads/hooks/post-checkout"
  mkdir -p "$(dirname "$target")"
  [ -f "$target" ] || { printf '#!/usr/bin/env bash\n' > "$target"; chmod +x "$target"; }
  tmp_pc="$(mktemp)"
  sed '/^# --- BEGIN GSD-BEADS WORKTREE INIT v1 ---$/,/^# --- END GSD-BEADS WORKTREE INIT ---$/d' \
    "$target" > "$tmp_pc"
  cat "$REPO/hooks/worktree-post-checkout.sh" >> "$tmp_pc"
  mv "$tmp_pc" "$target"
  chmod +x "$target"
  echo "appended worktree shim to $target"
fi

# ── Step 7: Register bd recipe (informational discovery — D-03 revised) ─
bd setup --add gsd-beads "$REPO/recipe/gsd-beads-recipe.md" 2>/dev/null || true

echo ""
echo "gsd-beads installed."
echo "  Run \`bd memories gsd-beads\` to verify."
echo "  Run \`gsd-sdk --version\` to verify shadow binding."
