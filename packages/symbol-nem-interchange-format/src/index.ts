export { decodeDocument as decode, encodeDocument as encode, inspect } from './internal/codec.js';
export { SnifError, type SnifErrorCode } from './errors.js';
export type {
  Chain,
  DecodeOptions,
  EncodeOptions,
  FormatType,
  Network,
  Password,
  SnifDocument,
  SnifHeader,
} from './types.js';
