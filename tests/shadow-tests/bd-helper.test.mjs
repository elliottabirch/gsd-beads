import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bd } from '../../bin/bd-helper.mjs';
import { BeadsNotInstalled, BeadsCorrupt, BeadsUnavailableError } from '../../bin/beads-errors.mjs';

/**
 * Run `cb` with a PATH-injected `bd` shim whose body is `scriptBody`.
 * The shim is a bash script under a fresh mkdtempSync directory, prepended to
 * PATH for the duration of the callback. PATH and tempdir are restored in
 * `finally` even if the callback throws (T-04-21 mitigation).
 */
function withMockBd(scriptBody, cb) {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-bd-shim-'));
  const shim = join(dir, 'bd');
  writeFileSync(shim, `#!/usr/bin/env bash\n${scriptBody}\n`);
  chmodSync(shim, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${dir}:${oldPath}`;
  try {
    return cb();
  } finally {
    process.env.PATH = oldPath;
    rmSync(dir, { recursive: true, force: true });
  }
}

// CASE 1: ENOENT — bd binary missing throws BeadsNotInstalled
test('bd-helper CASE 1: ENOENT — bd binary missing throws BeadsNotInstalled', () => {
  const oldPath = process.env.PATH;
  process.env.PATH = '/nonexistent-path-for-gsd-test';
  try {
    assert.throws(
      () => bd(['list', '--json']),
      (err) => {
        assert.ok(err instanceof BeadsNotInstalled, `expected BeadsNotInstalled, got ${err?.name}`);
        assert.ok(err instanceof BeadsUnavailableError, 'must extend BeadsUnavailableError');
        return true;
      }
    );
  } finally {
    process.env.PATH = oldPath;
  }
});

// CASE 2: version-mismatch stderr — non-zero exit throws sentinel subtype.
//   bd-helper today routes ALL non-zero-exit cases through BeadsCorrupt
//   (per Task 3 "version-mismatch is out of scope for bd()"). The CASE name
//   reflects the stderr CONTENT, not the resulting subtype. Promotion to
//   BeadsVersionMismatch is reserved for a future version-detection helper.
test('bd-helper CASE 2: version-mismatch stderr — non-zero exit throws sentinel subtype', () => {
  withMockBd(
    'echo "bd: requires version >=1.0; got 0.9.5" >&2\nexit 1',
    () => {
      assert.throws(
        () => bd(['list', '--json']),
        (err) => {
          assert.ok(err instanceof BeadsUnavailableError,
            `expected BeadsUnavailableError subtype, got ${err?.name}`);
          assert.ok(err instanceof BeadsCorrupt,
            `expected BeadsCorrupt for non-zero exit, got ${err?.name}`);
          return true;
        }
      );
    }
  );
});

// CASE 3: corrupt-store stderr — metadata.json mention throws BeadsCorrupt
test('bd-helper CASE 3: corrupt-store stderr — metadata.json mention throws BeadsCorrupt', () => {
  withMockBd(
    'echo "error: failed to open .beads/metadata.json: bad header" >&2\nexit 1',
    () => {
      assert.throws(
        () => bd(['list', '--json']),
        (err) => {
          assert.ok(err instanceof BeadsCorrupt, `expected BeadsCorrupt, got ${err?.name}`);
          assert.ok(err instanceof BeadsUnavailableError, 'must extend BeadsUnavailableError');
          return true;
        }
      );
    }
  );
});

// CASE 4: successful invocation returns parsed JSON
test('bd-helper CASE 4: successful invocation returns parsed JSON', () => {
  withMockBd(
    'echo \'[{"id":"sd-1","status":"open"}]\'\nexit 0',
    () => {
      const result = bd(['list', '--json']);
      assert.ok(Array.isArray(result), `expected array, got ${typeof result}`);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'sd-1');
      assert.equal(result[0].status, 'open');
    }
  );
});
