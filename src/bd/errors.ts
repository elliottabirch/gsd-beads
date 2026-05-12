// Source: derived from MDN ECMA-262 Error subclassing pattern;
//         cause enum mirrors D-14 sentinel metadata schema.
// Pitfall 1 mitigation: each subtype overrides `this.name` so the dispatcher
//                       can fall back to `err.name === '…'` if `instanceof`
//                       ever splits across module copies. Test parity in
//                       tests/shadow-tests/beads-errors.test.mjs.

// (no imports — pure JS class hierarchy)

export const BeadsCause = Object.freeze({
  NotInstalled:    'not-installed',
  Corrupt:         'corrupt',
  VersionMismatch: 'version-mismatch',
  Empty:           'empty',
  Unknown:         'unknown',
  Unsupported:     'unsupported',
});

export class BeadsUnavailableError extends Error {
  constructor(message, { cause = BeadsCause.Unknown, originalError } = {}) {
    super(message);
    this.name = 'BeadsUnavailableError';
    this.cause = cause;                         // D-14 enum
    if (originalError) this.originalError = originalError;
    // Preserve stack trace (V8-specific; harmless on other engines)
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export class BeadsNotInstalled extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.NotInstalled });
    this.name = 'BeadsNotInstalled';
  }
}

export class BeadsCorrupt extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.Corrupt });
    this.name = 'BeadsCorrupt';
  }
}

export class BeadsVersionMismatch extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.VersionMismatch });
    this.name = 'BeadsVersionMismatch';
  }
}

export class BeadsEmpty extends BeadsUnavailableError {
  constructor(message, opts = {}) {
    super(message, { ...opts, cause: BeadsCause.Empty });
    this.name = 'BeadsEmpty';
  }
}

export class UnsupportedOperationError extends BeadsUnavailableError {
  /**
   * @param {string} method  adapter method name (e.g., 'writeBinaryAsset')
   * @param {string} flag    capabilities flag name (e.g., 'binaryAsset')
   * @param {string} [hint]  optional caller guidance
   *
   * D-16 locks the throw-message format byte-for-byte; conformance asserts it.
   */
  constructor(method, flag, hint = '') {
    const msg = `BeadsAdapter.${method}: not supported (capabilities.${flag}=false).${hint ? ' ' + hint : ''}`;
    super(msg, { cause: BeadsCause.Unsupported });
    this.name = 'UnsupportedOperationError';
    this.method = method;
    this.flag = flag;
  }
}
