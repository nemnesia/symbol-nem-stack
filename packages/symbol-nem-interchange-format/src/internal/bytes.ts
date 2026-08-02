import { SnifError, type SnifErrorCode } from '../errors.js';

export const MAX_SNIF_SIZE = 16 * 1024 * 1024;
export const MAX_TRANSACTION_SIZE = 8 * 1024 * 1024;
export const MAX_MESSAGE_SIZE = 1024 * 1024;

export const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let i = 0; i < left.byteLength; ++i) difference |= left[i]! ^ right[i]!;
  return difference === 0;
};

export const requireBytes = (
  value: unknown,
  minimum: number,
  maximum = minimum,
  code: SnifErrorCode = 'invalid-payload'
): Uint8Array => {
  if (!(value instanceof Uint8Array) || value.byteLength < minimum || value.byteLength > maximum)
    throw new SnifError(code);
  return value;
};

export const isAllZero = (value: Uint8Array): boolean => value.every((byte) => byte === 0);

export const requireNotAllZero = (value: Uint8Array, code: SnifErrorCode = 'invalid-payload'): void => {
  if (isAllZero(value)) throw new SnifError(code);
};

export const utf8Length = (value: string): number => new TextEncoder().encode(value).byteLength;

export const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new SnifError('operation-cancelled');
};
