import { gcm } from '@noble/ciphers/aes.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { clean, utf8ToBytes } from '@noble/hashes/utils.js';

import { fromBase64 } from './base64.js';
import {
  ARGON2ID_PARAMS,
  CIPHER,
  ENCRYPTED_DATA_VERSION,
  KDF,
  MAX_CIPHERTEXT_BASE64_LENGTH,
  MAX_COMBINED_LENGTH,
  MAX_SALT_BASE64_LENGTH,
  NONCE_LENGTH,
  SALT_LENGTH,
  SUPPORTED_ARGON2ID_PARAMS,
  TAG_LENGTH,
  metadataToAad,
} from './constants.js';
import type { Argon2idParams, DecryptOptions, EncryptedData, LegacyEncryptedData, Password } from './types.js';

function hasSupportedParameters(params: unknown): params is Argon2idParams {
  if (typeof params !== 'object' || params === null) return false;
  const candidate = params as Argon2idParams;
  return SUPPORTED_ARGON2ID_PARAMS.some(
    (supported) =>
      candidate.memoryCost === supported.memoryCost &&
      candidate.timeCost === supported.timeCost &&
      candidate.parallelism === supported.parallelism
  );
}

function isVersionedData(data: EncryptedData | LegacyEncryptedData): data is EncryptedData {
  return 'version' in data;
}

function validateData(data: EncryptedData | LegacyEncryptedData): void {
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof data.salt !== 'string' ||
    typeof data.ciphertext !== 'string'
  ) {
    throw new Error('Invalid encrypted data');
  }
  if (data.salt.length > MAX_SALT_BASE64_LENGTH || data.ciphertext.length > MAX_CIPHERTEXT_BASE64_LENGTH) {
    throw new Error('Invalid encrypted data');
  }

  if (isVersionedData(data)) {
    if (
      data.version !== ENCRYPTED_DATA_VERSION ||
      data.kdf !== KDF ||
      data.cipher !== CIPHER ||
      !hasSupportedParameters(data.kdfParams)
    ) {
      throw new Error('Invalid encrypted data');
    }
  }
}

function passwordToBytes(password: Password): Uint8Array {
  if (typeof password === 'string') return utf8ToBytes(password);
  if (password instanceof Uint8Array) return password;
  throw new TypeError('Invalid password');
}

function validatePassword(password: Password): void {
  if ((typeof password !== 'string' && !(password instanceof Uint8Array)) || password.length === 0) {
    throw new Error('Invalid password');
  }
}

async function deriveKey(password: Password, salt: Uint8Array, params: Argon2idParams): Promise<Uint8Array> {
  const passwordBytes = passwordToBytes(password);
  const shouldCleanPasswordBytes = typeof password === 'string';
  try {
    return await argon2idAsync(passwordBytes, salt, {
      m: params.memoryCost,
      t: params.timeCost,
      p: params.parallelism,
      dkLen: 32,
    });
  } finally {
    if (shouldCleanPasswordBytes) clean(passwordBytes);
  }
}

/**
 * 復号に成功したデータを、現在の既定 KDF パラメータで再暗号化すべきか判定します。
 *
 * この結果は認証前の入力にも使えるため、`true` は移行の必要性を示すだけです。実際の
 * 再暗号化は必ず `decrypt` が成功した後に行ってください。
 */
export function needsReencryption(data: EncryptedData | LegacyEncryptedData): boolean {
  if (!isVersionedData(data)) return true;
  return (
    data.version !== ENCRYPTED_DATA_VERSION ||
    data.kdf !== KDF ||
    data.cipher !== CIPHER ||
    data.kdfParams?.memoryCost !== ARGON2ID_PARAMS.memoryCost ||
    data.kdfParams?.timeCost !== ARGON2ID_PARAMS.timeCost ||
    data.kdfParams?.parallelism !== ARGON2ID_PARAMS.parallelism
  );
}

/**
 * 暗号化データをパスワードで復号します。
 *
 * バージョン付き形式ではメタデータを AAD として検証します。旧 `{ salt, ciphertext }`
 * 形式は、`{ allowLegacy: true }` を指定した移行目的でのみ読み取れます。メタデータの
 * 認証は行えないため、旧形式を復号した後は `encrypt` で再暗号化してください。
 *
 * 失敗理由（パスワード誤り、改ざん、形式不正）は区別せず同じエラーを返します。
 *
 * @param data - `encrypt` の戻り値、または移行対象の旧形式データ
 * @param password - 鍵導出に使用した空でないパスワード。`Uint8Array` も指定可能
 * @param options - Legacy 形式を許可する移行用オプション
 * @returns 復号した平文
 * @throws {Error} 復号できない、または入力が不正な場合。メッセージは常に `Decryption failed`
 */
export async function decrypt(
  data: EncryptedData | LegacyEncryptedData,
  password: Password,
  options: DecryptOptions = {}
): Promise<Uint8Array> {
  try {
    validatePassword(password);
    validateData(data);
    if (!isVersionedData(data) && options.allowLegacy !== true) throw new Error('Legacy data is not allowed');

    const salt = fromBase64(data.salt);
    const combined = fromBase64(data.ciphertext);
    if (
      salt.length !== SALT_LENGTH ||
      combined.length < NONCE_LENGTH + TAG_LENGTH ||
      combined.length > MAX_COMBINED_LENGTH
    ) {
      throw new Error('Invalid encrypted data');
    }

    const nonce = combined.slice(0, NONCE_LENGTH);
    const tag = combined.slice(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH);
    const ciphertext = combined.slice(NONCE_LENGTH + TAG_LENGTH);
    const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
    ciphertextWithTag.set(ciphertext);
    ciphertextWithTag.set(tag, ciphertext.length);

    const params = isVersionedData(data) ? data.kdfParams : ARGON2ID_PARAMS;
    const key = await deriveKey(password, salt, params);
    const aad = isVersionedData(data) ? metadataToAad(params) : undefined;
    try {
      return gcm(key, nonce, aad).decrypt(ciphertextWithTag);
    } finally {
      clean(key);
    }
  } catch {
    // Do not distinguish wrong passwords, unauthenticated data or malformed data.
    throw new Error('Decryption failed');
  }
}
