import type { SnifError, SnifErrorCode, SnifResult } from './types.js';

const MESSAGES: Record<SnifErrorCode, string> = {
  INVALID_JSON: 'Input is not valid JSON.',
  ROOT_NOT_OBJECT: 'SNIF root must be a JSON object.',
  INVALID_JSON_VALUE: 'Input contains a value outside the JSON value model.',
  NON_FINITE_NUMBER: 'Input contains a non-finite number.',
  CIRCULAR_REFERENCE: 'Input contains a circular reference.',
  UNSUPPORTED_VERSION: 'SNIF version is not supported.',
  MISSING_REQUIRED_FIELD: 'A required field is missing.',
  INVALID_FIELD_TYPE: 'A field has an invalid type.',
  INVALID_FIELD_VALUE: 'A field has an invalid value.',
  INVALID_HEX: 'A field is not a valid hex string.',
  PAYLOAD_MISSING: 'A payload is missing.',
  PAYLOAD_CONFLICT: 'payload and protectedPayload cannot be used together.',
  PROTECTED_PAYLOAD_NOT_ALLOWED: 'protectedPayload is not allowed for this type.',
  INVALID_STANDARD_VALUE: 'A field has an invalid standard value.',
  UNSUPPORTED_PROTECTION: 'The protection profile is not supported.',
  INVALID_PROTECTION_PARAMETERS: 'Protection parameters are invalid.',
  RESOURCE_LIMIT_EXCEEDED: 'Protection parameters exceed the provider policy.',
  PROTECTION_FAILED: 'Protection processing failed.',
  AUTHENTICATION_FAILED: 'Authentication failed.',
  DECRYPTED_PAYLOAD_INVALID: 'The decrypted payload is invalid.',
};

export function error(code: SnifErrorCode, path?: string, message: string = MESSAGES[code]): SnifError {
  return path === undefined ? { code, message } : { code, path, message };
}

export function failure<T>(code: SnifErrorCode, path?: string): SnifResult<T> {
  return { ok: false, error: error(code, path) };
}

export function success<T>(value: T): SnifResult<T> {
  return { ok: true, value };
}

const PROVIDER_CODES: ReadonlySet<SnifErrorCode> = new Set([
  'UNSUPPORTED_PROTECTION',
  'INVALID_PROTECTION_PARAMETERS',
  'RESOURCE_LIMIT_EXCEEDED',
  'AUTHENTICATION_FAILED',
  'PROTECTION_FAILED',
]);

export function sanitizeProviderFailure<T>(result: SnifResult<T>): SnifResult<T> {
  if (result.ok) return result;
  const code = PROVIDER_CODES.has(result.error.code) ? result.error.code : 'PROTECTION_FAILED';
  return failure<T>(code);
}

export function providerException<T>(): SnifResult<T> {
  return failure<T>('PROTECTION_FAILED');
}
