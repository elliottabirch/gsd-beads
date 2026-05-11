/**
 * Sentinel errors for BeadsAdapter. Plan 06-01: minimal scaffold
 * (NotYetImplementedError only). Plan 06-02 ports sibling's
 * BeadsCause enum + subclasses and adds BdManagedMismatchError
 * per D-INIT-ERR.
 */

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
