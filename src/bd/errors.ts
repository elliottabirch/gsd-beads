/**
 * Sentinel errors for bd CLI invocation + BeadsAdapter lifecycle.
 *
 * Ported from sibling src/bd/errors.mjs (v0.2 Phase 4 deliverable) with
 * two amendments for v1.0 fork integration:
 *
 *   1. Sibling's capability-mismatch throw class was REMOVED — consumers
 *      now import `UnsupportedCapabilityError` from
 *      `get-shit-done-cc/adapters/types` per CONTEXT.md §D-BINARY.
 *
 *   2. BdManagedMismatchError ADDED per CONTEXT.md §D-INIT-ERR (BEADS-04
 *      requirement surface). Shape mirrors fork's UnsupportedCapabilityError
 *      at `adapters/types.ts:130-149`: `__brand` symbol enables cross-module
 *      instanceof resilience under vitest transforms / dual-package hazards.
 *
 * Pitfall 1 mitigation (inherited from sibling): each subtype overrides
 * `this.name` so cross-module consumers can fall back to `err.name === '…'`
 * if `instanceof` ever splits across module copies.
 */

export const BeadsCause = Object.freeze({
  NotInstalled: 'not-installed',
  Corrupt: 'corrupt',
  VersionMismatch: 'version-mismatch',
  Empty: 'empty',
  Unknown: 'unknown',
  Unsupported: 'unsupported',
} as const);
export type BeadsCauseValue = typeof BeadsCause[keyof typeof BeadsCause];

export class BeadsUnavailableError extends Error {
  override readonly name: string = 'BeadsUnavailableError';
  override readonly cause: BeadsCauseValue;
  readonly originalError?: Error;

  constructor(message: string, opts: { cause?: BeadsCauseValue; originalError?: Error } = {}) {
    super(message);
    this.cause = opts.cause ?? BeadsCause.Unknown;
    if (opts.originalError !== undefined) this.originalError = opts.originalError;
    // Preserve stack trace (V8-specific; harmless on other engines)
    const ErrorCtor = Error as unknown as {
      captureStackTrace?: (obj: object, ctor: Function) => void;
    };
    if (typeof ErrorCtor.captureStackTrace === 'function') {
      ErrorCtor.captureStackTrace(this, this.constructor);
    }
  }
}

export class BeadsNotInstalled extends BeadsUnavailableError {
  override readonly name = 'BeadsNotInstalled';
  constructor(message = 'bd CLI not found on PATH', originalError?: Error) {
    super(message, { cause: BeadsCause.NotInstalled, originalError });
  }
}

export class BeadsCorrupt extends BeadsUnavailableError {
  override readonly name = 'BeadsCorrupt';
  constructor(message: string, originalError?: Error) {
    super(message, { cause: BeadsCause.Corrupt, originalError });
  }
}

export class BeadsVersionMismatch extends BeadsUnavailableError {
  override readonly name = 'BeadsVersionMismatch';
  constructor(message: string, originalError?: Error) {
    super(message, { cause: BeadsCause.VersionMismatch, originalError });
  }
}

export class BeadsEmpty extends BeadsUnavailableError {
  override readonly name = 'BeadsEmpty';
  constructor(message = 'bd store is empty', originalError?: Error) {
    super(message, { cause: BeadsCause.Empty, originalError });
  }
}

/**
 * D-INIT-ERR (BEADS-04): typed error thrown by BeadsAdapter when the target
 * project directory is not bd-managed. Shape mirrors fork's
 * UnsupportedCapabilityError (__brand symbol enables cross-module instanceof
 * resilience under vitest transforms / dual-package hazards).
 *
 * Fields:
 *   - code: 'PROJECT_BD_MANAGED_MISMATCH' (literal; machine-readable)
 *   - projectDir: path that failed the bd-managed probe
 *   - hint: human-readable next-step guidance (e.g., "Run `bd init`.")
 */
export class BdManagedMismatchError extends Error {
  override readonly name = 'BdManagedMismatchError';
  readonly code = 'PROJECT_BD_MANAGED_MISMATCH' as const;
  readonly projectDir: string;
  readonly hint: string;
  readonly __brand = 'BdManagedMismatchError' as const;

  constructor(projectDir: string, hint: string) {
    super(`Project directory '${projectDir}' is not bd-managed. ${hint}`);
    this.projectDir = projectDir;
    this.hint = hint;
  }

  static [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance != null &&
      typeof instance === 'object' &&
      (instance as Record<string, unknown>).__brand === 'BdManagedMismatchError'
    );
  }
}
