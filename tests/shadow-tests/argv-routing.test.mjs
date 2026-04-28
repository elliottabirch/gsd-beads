import { test } from 'node:test';
import assert from 'node:assert/strict';

// STUB — argv-routing: production code not yet written (Wave 0 marker)
//
// CASE 1: `query phase.add "X"` (dotted) — beads-managed → routes to handler
// CASE 2: `query phase add "X"` (space-aliased) — same
// CASE 3: `query progress` — read-only, falls through to upstream
// CASE 4: `query phase.add "X" --pick phase_id` — extractField returns just the ID
// CASE 5: `--help` — passes through to upstream (no `query` token)
// CASE 6: non-beads project (no .beads/metadata.json) — passes through
// CASE 7: `query made-up-command` — resolveQueryArgv returns null → upstream
// CASE 8: `query phase.add "X" --project-dir /tmp/test` — projectDir parsed correctly (Pitfall 4)
// CASE 9: `--project-dir` BEFORE `query` — still works (argv.indexOf is position-agnostic for the FIND, but dispatch happens after queryIdx — verify both shapes)

test('STUB — argv-routing: production code not yet written', () => {
  assert.fail('argv-routing stub — Wave 0 marker');
});
