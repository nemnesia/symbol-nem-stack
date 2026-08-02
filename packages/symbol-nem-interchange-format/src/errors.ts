export type SnifErrorCode =
  | 'invalid-envelope'
  | 'unsupported-version'
  | 'unsupported-type'
  | 'unsupported-codec'
  | 'password-required'
  | 'decryption-failed'
  | 'resource-limit'
  | 'operation-cancelled'
  | 'entropy-unavailable'
  | 'invalid-payload'
  | 'invalid-context'
  | 'expired-request'
  | 'authorization-failed'
  | 'unauthenticated-rejection'
  | 'network-mismatch'
  | 'verification-failed';

export class SnifError extends Error {
  public readonly code: SnifErrorCode;

  public constructor(code: SnifErrorCode, message = code, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SnifError';
    this.code = code;
  }
}
