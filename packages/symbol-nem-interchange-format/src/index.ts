export { decodeDocument as decode, encodeDocument as encode, inspect } from './internal/codec.js';
export { verifyRequest, verifyResponse, verifySignedTransaction } from './verification.js';
export { SnifError, type SnifErrorCode } from './errors.js';
export type {
  AudienceVerification,
  Chain,
  ConnectionRecord,
  DecodeOptions,
  EncodeOptions,
  FormatType,
  Network,
  Password,
  RequestDocument,
  RequestVerificationResult,
  ResponseDocument,
  ResponseVerificationResult,
  SignedTransactionDocument,
  SnifDocument,
  SnifHeader,
  StandaloneTransactionVerificationResult,
  VerifyRequestOptions,
  VerifyResponseOptions,
} from './types.js';
