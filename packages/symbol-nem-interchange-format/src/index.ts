import { clean, utf8ToBytes } from '@noble/hashes/utils.js';

import { failure, providerException, sanitizeProviderFailure, success } from './errors.js';
import type {
  PlainProtectableSnif,
  ProtectedPayload,
  ProtectedSnif,
  ProtectionProvider,
  ProtectionState,
  SnifData,
  SnifResult,
} from './types.js';
import { validatePlainPayload, validateProtectedPayload, validateValue } from './validation.js';

export * from './types.js';
export { standardProtectionProvider } from './protection.js';
export { isStandardType } from './validation.js';

/**
 * JSON文字列をSNIF v1データとして解析し、形式を検証します。
 *
 * JSONのプロパティ順や空白の正規化は行いません。不正な入力は例外ではなく、
 * 機械判定可能な`SnifError`として返します。
 *
 * @param input 解析対象のJSON文字列
 * @returns 検証済みSNIFデータまたは形式エラー
 */
export function parse(input: string): SnifResult<SnifData> {
  if (typeof input !== 'string') return failure('INVALID_JSON');
  let value: unknown;
  try {
    // JSON.parseは重複キーを独自検出せず、SNIFの通常のJSON解析規則に委ねる。
    value = JSON.parse(input) as unknown;
  } catch {
    return failure('INVALID_JSON');
  }
  // JSON解析とSNIF固有の形式検証を分離し、parseとvalidateで同じ規則を使う。
  return validateValue(value);
}

/**
 * 既存のJavaScript値をSNIF v1データとして形式検証します。
 *
 * 成功時は入力オブジェクトをdeep cloneせず、そのまま型付けして返します。
 * 入力オブジェクト自体は変更しません。
 *
 * @param input 検証対象のJavaScript値
 * @returns 検証済みSNIFデータまたは形式エラー
 */
export function validate(input: unknown): SnifResult<SnifData> {
  return validateValue(input);
}

/**
 * SNIFデータを形式検証したうえでJSON文字列へ変換します。
 *
 * JSON canonicalization、自動暗号化、識別子の自動生成および処理意図の
 * 自動実行は行いません。
 *
 * @param data シリアライズ対象のSNIFデータ
 * @returns JSON文字列または形式エラー
 */
export function serialize(data: SnifData): SnifResult<string> {
  // serializeでも先にvalidateを通し、型アサーションだけで外部入力を信頼しない。
  const validation = validate(data);
  if (!validation.ok) return validation;
  try {
    const json = JSON.stringify(validation.value);
    return json === undefined ? failure('INVALID_JSON_VALUE') : success(json);
  } catch {
    return failure('INVALID_JSON_VALUE');
  }
}

/**
 * SNIFデータが`account`または`mnemonic`の保護済み表現か判定します。
 *
 * 保護状態だけを判定し、復号や秘密情報の意味検証は行いません。
 *
 * @param data 判定対象のSNIFデータ
 * @returns 保護済みデータの場合は`true`
 */
export function isProtected(data: SnifData): data is ProtectedSnif {
  return (
    (data.type === 'account' || data.type === 'mnemonic') &&
    Object.prototype.hasOwnProperty.call(data, 'protectedPayload')
  );
}

/**
 * SNIFデータの機密payload保護状態を判定します。
 *
 * @param data 判定対象のSNIFデータ
 * @returns `plain`、`protected`または`not-applicable`
 */
export function getProtectionState(data: SnifData): ProtectionState {
  if (data.type !== 'account' && data.type !== 'mnemonic') return 'not-applicable';
  return isProtected(data) ? 'protected' : 'plain';
}

function protectedEnvelope(data: PlainProtectableSnif, payload: ProtectedPayload): ProtectedSnif {
  // 共通エンベロープの識別情報は保持し、平文payloadだけをprotectedPayloadへ置き換える。
  const { payload: _plainPayload, ...envelope } = data;
  return { ...envelope, protectedPayload: payload } as ProtectedSnif;
}

function plainEnvelope(data: ProtectedSnif, payload: PlainProtectableSnif['payload']): PlainProtectableSnif {
  // 復号済みpayloadを検証した後にだけ、保護済み表現から平文表現へ戻す。
  const { protectedPayload: _protectedPayload, ...envelope } = data;
  return { ...envelope, payload } as PlainProtectableSnif;
}

/**
 * 平文の`account`または`mnemonic` payload全体をproviderで保護します。
 *
 * payloadはJSON文字列のUTF-8 byte列としてproviderへ渡されます。共通
 * エンベロープは保持され、呼び出し元の入力オブジェクトは変更されません。
 * secretはSNIFデータへ保存されず、providerへだけ渡されます。
 *
 * @param data 保護対象の平文SNIFデータ
 * @param secret providerへ渡す秘密情報
 * @param provider 使用する保護provider
 * @returns 保護済みSNIFデータまたは保護エラー
 */
export async function protect<TSecret>(
  data: PlainProtectableSnif,
  secret: TSecret,
  provider: ProtectionProvider<TSecret>
): Promise<SnifResult<ProtectedSnif>> {
  // protectの処理順序は、平文形式の検証、provider処理、結果の形式検証とする。
  const validation = validate(data);
  if (!validation.ok) return validation;
  if (validation.value.type !== 'account' && validation.value.type !== 'mnemonic') {
    return failure('INVALID_FIELD_VALUE', '/type');
  }
  const plainData = validation.value as PlainProtectableSnif;
  if (isProtected(plainData)) return failure('INVALID_FIELD_VALUE', '/protectedPayload');

  let plaintext: Uint8Array | undefined;
  try {
    // JSON canonicalizationは行わず、呼び出し元payloadのJSON表現をUTF-8化する。
    plaintext = utf8ToBytes(JSON.stringify(plainData.payload));
    let protectedResult: SnifResult<ProtectedPayload>;
    try {
      protectedResult = await provider.protect(plaintext, secret);
    } catch {
      return providerException<ProtectedSnif>();
    }
    const sanitized = sanitizeProviderFailure(protectedResult);
    if (!sanitized.ok) return sanitized;
    // providerの戻り値も外部境界として再検証し、任意のprovider実装を無条件に信頼しない。
    const protectedValidation = validateProtectedPayload(sanitized.value);
    if (!protectedValidation.ok) return protectedValidation;
    return success(protectedEnvelope(plainData, sanitized.value));
  } catch {
    return providerException<ProtectedSnif>();
  } finally {
    if (plaintext) clean(plaintext);
  }
}

/**
 * 保護済みの`account`または`mnemonic` payloadをproviderで復元します。
 *
 * 認証成功後にUTF-8、JSONおよび対象typeのpayload構造を検証します。
 * 復元済みの秘密情報をエラー、ログまたはprovider外の診断情報へ含めません。
 *
 * @param data 復元対象の保護済みSNIFデータ
 * @param secret providerへ渡す秘密情報
 * @param provider 使用する保護provider
 * @returns 平文SNIFデータまたは復元・形式エラー
 */
export async function unprotect<TSecret>(
  data: ProtectedSnif,
  secret: TSecret,
  provider: ProtectionProvider<TSecret>
): Promise<SnifResult<PlainProtectableSnif>> {
  // 復号前にprofile対応可否とprovider自身の安全ポリシーを確認する。
  const validation = validate(data);
  if (!validation.ok) return validation;
  if (!isProtected(validation.value)) return failure('INVALID_FIELD_VALUE', '/protectedPayload');
  const protectedPayload = validation.value.protectedPayload;

  try {
    if (!provider.supports(protectedPayload)) return failure('UNSUPPORTED_PROTECTION');
  } catch {
    return providerException<PlainProtectableSnif>();
  }

  let providerValidation: SnifResult<void>;
  try {
    providerValidation = provider.validate(protectedPayload);
  } catch {
    return providerException<PlainProtectableSnif>();
  }
  const sanitizedValidation = sanitizeProviderFailure(providerValidation);
  if (!sanitizedValidation.ok) return sanitizedValidation;

  let decrypted: Uint8Array | undefined;
  try {
    let decryptedResult: SnifResult<Uint8Array>;
    try {
      decryptedResult = await provider.unprotect(protectedPayload, secret);
    } catch {
      return providerException<PlainProtectableSnif>();
    }
    const sanitized = sanitizeProviderFailure(decryptedResult);
    if (!sanitized.ok) return sanitized;
    decrypted = sanitized.value;

    // 認証成功後のbyte列だけをUTF-8、JSON、type固有payloadの順で解釈する。
    let decoded: string;
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
    } catch {
      return failure('DECRYPTED_PAYLOAD_INVALID');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(decoded) as unknown;
    } catch {
      return failure('DECRYPTED_PAYLOAD_INVALID');
    }
    const payloadValidation = validatePlainPayload(validation.value.type, payload);
    if (!payloadValidation.ok) return failure('DECRYPTED_PAYLOAD_INVALID');
    return success(plainEnvelope(validation.value, payload as PlainProtectableSnif['payload']));
  } finally {
    // JavaScriptでは完全消去を保証できないが、内部で作成したbyte列は可能な範囲で消去する。
    if (decrypted) clean(decrypted);
  }
}

export type { PlainProtectableSnif, ProtectedSnif, ProtectionProvider, ProtectionState, SnifData, SnifResult };
