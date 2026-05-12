import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:child_process.spawnSync BEFORE importing the module under test.
const spawnSyncMock = vi.fn();
vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

// Import after mock so BdRunner's spawnSync binding points at the mock.
import { BdRunner } from '../../src/bd/helper.js';
import { BeadsEmpty, BeadsNotInstalled, BeadsCorrupt } from '../../src/bd/errors.js';

describe('BdRunner (Landmines 3/4/5/6/7/11)', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it('Landmine 3: bakes cwd at construction', () => {
    const runner = new BdRunner('/tmp/projX');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '[]', stderr: '' });
    runner.run(['list']);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'bd',
      ['list'],
      expect.objectContaining({ cwd: '/tmp/projX' }),
    );
  });

  it('Landmine 11: bakes BEADS_ACTOR=seed into baseEnv by default', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '[]', stderr: '' });
    runner.run(['list']);
    const callArgs = spawnSyncMock.mock.calls[0]!;
    const callEnv = (callArgs[2] as { env: NodeJS.ProcessEnv }).env;
    expect(callEnv.BEADS_ACTOR).toBe('seed');
  });

  it('Landmine 4 fix: forwards opts.env into spawnSync merged with baseEnv', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '[]', stderr: '' });
    runner.run(['list'], { env: { EXTRA_VAR: 'yes' } });
    const callEnv = (spawnSyncMock.mock.calls[0]![2] as { env: NodeJS.ProcessEnv }).env;
    expect(callEnv.EXTRA_VAR).toBe('yes');
    expect(callEnv.BEADS_ACTOR).toBe('seed');
  });

  it('Landmine 5: show() unwraps single-element array', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: JSON.stringify([{ id: 'xx-1', title: 't' }]),
      stderr: '',
    });
    const r = runner.show('xx-1');
    expect(r.id).toBe('xx-1');
  });

  it('Landmine 5: show() passes through non-array payload', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ id: 'xx-1' }),
      stderr: '',
    });
    expect(runner.show('xx-1').id).toBe('xx-1');
  });

  it('Landmine 6: JSONL fallback when output is newline-delimited JSON', () => {
    const runner = new BdRunner('/tmp/x');
    const jsonl = [JSON.stringify({ id: 'xx-1' }), JSON.stringify({ id: 'xx-2' })].join('\n');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: jsonl, stderr: '' });
    const r = runner.run(['export', '--json']) as Array<{ id: string }>;
    expect(r).toHaveLength(2);
    expect(r[0]!.id).toBe('xx-1');
    expect(r[1]!.id).toBe('xx-2');
  });

  it('Landmine 7: {error, schema_version} shape at exit 0 → BeadsEmpty', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ error: 'no issues found', schema_version: '1.0' }),
      stderr: '',
    });
    expect(() => runner.run(['list'])).toThrow(BeadsEmpty);
  });

  it('ENOENT on spawn → BeadsNotInstalled', () => {
    const runner = new BdRunner('/tmp/x');
    const err = new Error('spawn bd ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    spawnSyncMock.mockReturnValue({ status: null, error: err, stdout: '', stderr: '' });
    expect(() => runner.run(['list'])).toThrow(BeadsNotInstalled);
  });

  it('non-zero exit with database-corrupt stderr → BeadsCorrupt', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'database is locked',
    });
    expect(() => runner.run(['list'])).toThrow(BeadsCorrupt);
  });

  it('parseJson: false returns raw stdout trimmed', () => {
    const runner = new BdRunner('/tmp/x');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'hello\n', stderr: '' });
    const r = runner.run(['version'], { parseJson: false });
    expect(r).toBe('hello');
  });
});
