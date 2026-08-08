/** SNIF v1のバージョン番号です。 */
export const SNIF_VERSION = 1 as const;

/** 対応するSNIFバージョンです。 */
export type SnifVersion = 1;
/** SNIF上でbyte列を表すhex文字列です。 */
export type HexString = string;
/** SNIFが扱うJSONのプリミティブ値です。 */
export type JsonPrimitive = string | number | boolean | null;
/** SNIFが扱うJSON値です。 */
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

/** JSON objectとして扱う値です。 */
export interface JsonObject {
  [key: string]: JsonValue;
}

/** SNIF v1で定義された標準typeです。 */
export type StandardSnifType =
  'address' | 'contact' | 'account' | 'mnemonic' | 'transaction' | 'connection-request' | 'connection-response';

/** SNIF v1で定義された標準transaction actionです。 */
export type StandardTransactionAction =
  'display' | 'sign' | 'sign-response' | 'cosign' | 'announce' | 'sign-and-announce' | 'cosign-and-announce';

/** transactionへ格納できる処理意図の文字列です。 */
export type TransactionAction = string;
/** SNIF v1で定義された標準connection permissionです。 */
export type StandardConnectionPermission = 'address' | 'public-key';
/** connection requestへ格納できるpermissionの文字列です。 */
export type ConnectionPermission = string;
/** connection responseの結果です。 */
export type ConnectionStatus = 'approved' | 'rejected';

/** 標準Symbol/NEMチェーン識別子です。 */
export const STANDARD_CHAINS = ['symbol', 'nem'] as const;
/** 標準ネットワーク識別子です。 */
export const STANDARD_NETWORKS = ['mainnet', 'testnet'] as const;
/** SNIF v1の標準type一覧です。 */
export const STANDARD_TYPES = [
  'address',
  'contact',
  'account',
  'mnemonic',
  'transaction',
  'connection-request',
  'connection-response',
] as const;
/** SNIF v1の標準transaction action一覧です。 */
export const STANDARD_TRANSACTION_ACTIONS = [
  'display',
  'sign',
  'sign-response',
  'cosign',
  'announce',
  'sign-and-announce',
  'cosign-and-announce',
] as const;
/** SNIF v1の標準connection permission一覧です。 */
export const STANDARD_CONNECTION_PERMISSIONS = ['address', 'public-key'] as const;

/** 全SNIFデータで共有するエンベロープです。 */
export interface SnifEnvelopeBase<TType extends string> {
  version: 1;
  type: TType;
  chain: string;
  network: string;
  generationHashSeed?: HexString;
  id?: string;
  replyTo?: string;
}

/** address typeのpayloadです。 */
export interface AddressPayload {
  address: string;
}

export interface AddressSnif extends SnifEnvelopeBase<'address'> {
  payload: AddressPayload;
}

/** contact typeのpayloadです。 */
export interface ContactPayload {
  name: string;
  address?: string;
  publicKey?: HexString;
  note?: string;
  icon?: string;
}

export interface ContactSnif extends SnifEnvelopeBase<'contact'> {
  payload: ContactPayload;
}

/** account typeの平文payloadです。 */
export interface AccountPayload {
  privateKey: HexString;
  publicKey: HexString;
  address: string;
}

export interface PlainAccountSnif extends SnifEnvelopeBase<'account'> {
  payload: AccountPayload;
  protectedPayload?: never;
}

export interface ProtectedAccountSnif extends SnifEnvelopeBase<'account'> {
  payload?: never;
  protectedPayload: ProtectedPayload;
}

export type AccountSnif = PlainAccountSnif | ProtectedAccountSnif;

/** mnemonic typeの平文payloadです。 */
export interface MnemonicPayload {
  mnemonic: string;
}

export interface PlainMnemonicSnif extends SnifEnvelopeBase<'mnemonic'> {
  payload: MnemonicPayload;
  protectedPayload?: never;
}

export interface ProtectedMnemonicSnif extends SnifEnvelopeBase<'mnemonic'> {
  payload?: never;
  protectedPayload: ProtectedPayload;
}

export type MnemonicSnif = PlainMnemonicSnif | ProtectedMnemonicSnif;

/** transaction typeのpayloadです。 */
export interface TransactionPayload {
  action?: TransactionAction;
  payload: HexString;
  result?: TransactionResult;
  signature?: HexString;
}

export type TransactionResult = 'approved' | 'rejected';

export interface TransactionSnif extends SnifEnvelopeBase<'transaction'> {
  payload: TransactionPayload;
}

/** connection-request typeのpayloadです。 */
export interface ConnectionRequestPayload {
  name?: string;
  url: string;
  permissions: ConnectionPermission[];
  icon?: string;
  note?: string;
}

export interface ConnectionRequestSnif extends SnifEnvelopeBase<'connection-request'> {
  payload: ConnectionRequestPayload;
}

/** 許可時のconnection-response payloadです。 */
export interface ApprovedConnectionResponsePayload {
  status: 'approved';
  address?: string;
  publicKey?: HexString;
}

/** 拒否時のconnection-response payloadです。 */
export interface RejectedConnectionResponsePayload {
  status: 'rejected';
  address?: never;
  publicKey?: never;
}

export interface ApprovedConnectionResponseSnif extends SnifEnvelopeBase<'connection-response'> {
  payload: ApprovedConnectionResponsePayload;
}

export interface RejectedConnectionResponseSnif extends SnifEnvelopeBase<'connection-response'> {
  payload: RejectedConnectionResponsePayload;
}

export type ConnectionResponseSnif = ApprovedConnectionResponseSnif | RejectedConnectionResponseSnif;

/** 標準type以外のアプリケーション固有SNIFデータです。 */
export interface CustomSnif extends SnifEnvelopeBase<string> {
  payload: JsonObject;
  protectedPayload?: never;
}

export type StandardSnifData =
  | AddressSnif
  | ContactSnif
  | AccountSnif
  | MnemonicSnif
  | TransactionSnif
  | ConnectionRequestSnif
  | ConnectionResponseSnif;

export type SnifData = StandardSnifData | CustomSnif;

/** protectedPayload内のKDF記述子です。 */
export interface KdfDescriptor {
  name: string;
  salt?: HexString;
  params?: JsonObject;
}

/** accountまたはmnemonicの保護済みpayloadです。 */
export interface ProtectedPayload {
  cipher: string;
  kdf?: KdfDescriptor;
  nonce?: HexString;
  ciphertext: HexString;
  tag?: HexString;
}

/** SNIF APIが返す機械判定可能なエラーコードです。 */
export type SnifErrorCode =
  | 'INVALID_JSON'
  | 'ROOT_NOT_OBJECT'
  | 'INVALID_JSON_VALUE'
  | 'NON_FINITE_NUMBER'
  | 'CIRCULAR_REFERENCE'
  | 'UNSUPPORTED_VERSION'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_FIELD_VALUE'
  | 'INVALID_HEX'
  | 'PAYLOAD_MISSING'
  | 'PAYLOAD_CONFLICT'
  | 'PROTECTED_PAYLOAD_NOT_ALLOWED'
  | 'INVALID_STANDARD_VALUE'
  | 'UNSUPPORTED_PROTECTION'
  | 'INVALID_PROTECTION_PARAMETERS'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'PROTECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'DECRYPTED_PAYLOAD_INVALID';

/** SNIF APIの安全な公開エラーです。 */
export interface SnifError {
  code: SnifErrorCode;
  path?: string;
  message: string;
}

/** SNIF APIの成功または失敗を表すResult型です。 */
export type SnifResult<T> = { ok: true; value: T } | { ok: false; error: SnifError };

/** 暗号方式を差し替えるための保護provider境界です。 */
export interface ProtectionProvider<TSecret = unknown> {
  /** providerが指定された保護プロファイルを扱えるか判定します。 */
  supports(payload: ProtectedPayload): boolean;
  /** 暗号処理前に保護プロファイルのパラメータを検証します。 */
  validate(payload: ProtectedPayload): SnifResult<void>;
  /** 平文byte列をsecretで保護します。 */
  protect(plaintext: Uint8Array, secret: TSecret): Promise<SnifResult<ProtectedPayload>>;
  /** 保護済みpayloadをsecretで復号します。 */
  unprotect(payload: ProtectedPayload, secret: TSecret): Promise<SnifResult<Uint8Array>>;
}

/** protectが受け取る平文account/mnemonicです。 */
export type PlainProtectableSnif = PlainAccountSnif | PlainMnemonicSnif;
/** unprotectが受け取る保護済みaccount/mnemonicです。 */
export type ProtectedSnif = ProtectedAccountSnif | ProtectedMnemonicSnif;
/** account/mnemonicの保護状態です。 */
export type ProtectionState = 'plain' | 'protected' | 'not-applicable';
