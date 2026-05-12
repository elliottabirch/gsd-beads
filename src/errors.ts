/**
 * Sentinel errors for BeadsAdapter. Plan 06-01 scaffold established
 * NotYetImplementedError. Plan 06-02 port adds the bd-CLI sentinel
 * hierarchy + BdManagedMismatchError (D-INIT-ERR, BEADS-04); they
 * live in `./bd/errors.ts` and are re-exported here so external
 * consumers (`import { BdManagedMismatchError } from 'gsd-beads'`)
 * don't reach into src/bd/.
 */

export {
  BeadsCause,
  BeadsUnavailableError,
  BeadsNotInstalled,
  BeadsCorrupt,
  BeadsVersionMismatch,
  BeadsEmpty,
  BdManagedMismatchError,
} from './bd/errors.js';
export type { BeadsCauseValue } from './bd/errors.js';

export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
  readonly method: string;
  readonly eta: string;
  readonly __brand = 'NotYetImplementedError' as const;

  constructor(method: string, eta: string) {
    super(`BeadsAdapter.${method} not yet implemented (eta: ${eta})`);
    this.method = method;
    this.eta = eta;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'NotYetImplementedError'
    );
  }
}
