export type Chain = 'symbol' | 'nem';
export type FormatType =
  | 'contact'
  | 'address'
  | 'account'
  | 'mnemonic'
  | 'sign-request'
  | 'signed-transaction'
  | 'message-sign-request'
  | 'signature'
  | 'connection-request'
  | 'connection-response';

export interface SymbolNetwork {
  id: number;
  generationHashSeed: Uint8Array;
}

export interface NemNetwork {
  id: number;
}

export type Network = SymbolNetwork | NemNetwork;
export type Payload = Record<string, unknown>;

export interface SnifDocument<T extends FormatType = FormatType> {
  type: T;
  chain: Chain;
  network: Network;
  payload: Payload;
}

export type RequestDocument = SnifDocument<'sign-request' | 'message-sign-request' | 'connection-request'>;
export type ResponseDocument = SnifDocument<'signature' | 'signed-transaction' | 'connection-response'>;
export type SignedTransactionDocument = SnifDocument<'signed-transaction'>;

export type Password = string | Uint8Array;

export interface EncodeOptions {
  password?: Password;
  compression?: 'auto' | 'none' | 'zlib';
  signal?: AbortSignal;
}

export interface DecodeOptions {
  password?: Password;
  signal?: AbortSignal;
}

export type EncryptionHeader =
  { algorithm: 'none' } | { algorithm: 'password-v1'; salt: Uint8Array; nonce: Uint8Array };

interface SnifHeaderBase {
  protocol: 'snif';
  version: 1;
  type: FormatType;
  compression: 'none' | 'zlib';
  encryption: EncryptionHeader;
}

export type SnifHeader =
  | (SnifHeaderBase & { chain: 'symbol'; network: SymbolNetwork })
  | (SnifHeaderBase & { chain: 'nem'; network: NemNetwork });

export interface ConnectionRecord {
  sessionId: Uint8Array;
  chain: Chain;
  network: Network;
  requesterPublicKey: Uint8Array;
  application: { name: string; origin: string; iconUrl?: string };
  account: { address: Uint8Array; publicKey: Uint8Array };
  permissions: Array<'account' | 'sign-transaction' | 'sign-message'>;
  sessionCreatedAt: number;
  sessionExpiresAt: number;
  state: 'active' | 'revoked';
}

export interface VerifyRequestOptions {
  now: number;
  trustedAudience?: string;
  connection?: ConnectionRecord;
}

export interface VerifyResponseOptions {
  now: number;
  authenticatedRejection?: boolean;
}

export type AudienceVerification =
  | { status: 'verified'; evidence: 'trusted-audience' | 'connection' | 'trusted-audience-and-connection' }
  | { status: 'unverified'; evidence: 'self-asserted' }
  | { status: 'not-applicable'; evidence: 'no-audience' };

export interface RequestVerificationResult<T extends RequestDocument> {
  document: T;
  requestHash: Uint8Array;
  audience: AudienceVerification;
}

export interface ResponseVerificationResult<T extends ResponseDocument> {
  document: T;
  responseHash: Uint8Array;
  audience: { status: 'not-applicable'; evidence: 'no-audience' };
}

export interface StandaloneTransactionVerificationResult {
  document: SignedTransactionDocument;
  documentHash: Uint8Array;
  audience: { status: 'not-applicable'; evidence: 'no-audience' };
}
