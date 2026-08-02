import { decode, encode } from 'cborg';

import { SnifError, type SnifErrorCode } from '../errors.js';
import { MAX_SNIF_SIZE, equalBytes } from './bytes.js';

const assertResources = (value: unknown, depth = 0): void => {
  if (depth > 16) throw new SnifError('resource-limit');
  if (Array.isArray(value)) {
    if (value.length > 256) throw new SnifError('resource-limit');
    for (const child of value) assertResources(child, depth + 1);
  } else if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    const entries = Object.entries(value);
    if (entries.length > 64) throw new SnifError('resource-limit');
    for (const [, child] of entries) assertResources(child, depth + 1);
  }
};

export const encodeCanonical = (value: unknown, code: SnifErrorCode): Uint8Array => {
  try {
    assertResources(value);
    const result = encode(value);
    if (result.byteLength > MAX_SNIF_SIZE) throw new SnifError('resource-limit');
    return result;
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError(code, code, { cause: error });
  }
};

export const decodeCanonical = (data: Uint8Array, code: SnifErrorCode): unknown => {
  if (!(data instanceof Uint8Array)) throw new SnifError(code);
  if (data.byteLength > MAX_SNIF_SIZE) throw new SnifError('resource-limit');
  try {
    const value = decode(data, {
      strict: true,
      rejectDuplicateMapKeys: true,
      allowIndefinite: false,
      allowUndefined: false,
      allowNaN: false,
      allowInfinity: false,
    });
    assertResources(value);
    if (!equalBytes(data, encodeCanonical(value, code))) throw new SnifError(code);
    return value;
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError(code, code, { cause: error });
  }
};
