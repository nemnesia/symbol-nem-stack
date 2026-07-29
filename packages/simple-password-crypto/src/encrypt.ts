import { gcm } from '@noble/ciphers/aes.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { clean, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { toBase64 } from './base64.js';
import {
  ARGON2ID_PARAMS,
  CIPHER,
  ENCRYPTED_DATA_VERSION,
  KDF,
  MAX_PLAINTEXT_LENGTH,
  NONCE_LENGTH,
  SALT_LENGTH,
  TAG_LENGTH,
  metadataToAad,
} from './constants.js';
import type { EncryptedData, Password } from './types.js';

function passwordToBytes(password: Password): Uint8Array {
  if (typeof password === 'string') return utf8ToBytes(password);
  if (password instanceof Uint8Array) return password;
  throw new TypeError('password must be a string or Uint8Array');
}

function validatePassword(password: Password): void {
  if (typeof password !== 'string' && !(password instanceof Uint8Array)) {
    throw new TypeError('password must be a string or Uint8Array');
  }
  if (password.length === 0) throw new RangeError('password must not be empty');
}

async function deriveKey(password: Password, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = passwordToBytes(password);
  const shouldCleanPasswordBytes = typeof password === 'string';
  try {
    return await argon2idAsync(passwordBytes, salt, {
      m: ARGON2ID_PARAMS.memoryCost,
      t: ARGON2ID_PARAMS.timeCost,
      p: ARGON2ID_PARAMS.parallelism,
      dkLen: 32,
    });
  } finally {
    // The caller owns a Uint8Array password and may clear it after this promise settles.
    if (shouldCleanPasswordBytes) clean(passwordBytes);
  }
}

/**
 * パスワードから Argon2id で鍵を導出し、AES-256-GCM で平文を暗号化します。
 *
 * 新規データはバージョン付き形式で出力されます。バージョン、KDF、KDF パラメータ、
 * 暗号方式は追加認証データ（AAD）として認証されます。
 *
 * @param plaintext - 暗号化する 16 MiB 以下のバイト列
 * @param password - 鍵導出に使用する空でないパスワード。`Uint8Array` も指定可能
 * @returns JSON に安全に保存できる、バージョン付き暗号化データ
 * @throws {TypeError} 引数の型が不正な場合
 * @throws {RangeError} 平文が 16 MiB を超える場合
 */
export async function encrypt(plaintext: Uint8Array, password: Password): Promise<EncryptedData> {
  if (!(plaintext instanceof Uint8Array)) throw new TypeError('plaintext must be a Uint8Array');
  if (plaintext.length > MAX_PLAINTEXT_LENGTH) throw new RangeError('plaintext is too large');
  validatePassword(password);

  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  const nonce = randomBytes(NONCE_LENGTH);
  let ciphertextWithTag: Uint8Array;
  try {
    ciphertextWithTag = gcm(key, nonce, metadataToAad(ARGON2ID_PARAMS)).encrypt(plaintext);
  } finally {
    clean(key);
  }

  const combined = new Uint8Array(nonce.length + ciphertextWithTag.length);
  combined.set(nonce);
  // Store tag before ciphertext to retain the historical binary layout.
  combined.set(ciphertextWithTag.slice(-TAG_LENGTH), nonce.length);
  combined.set(ciphertextWithTag.slice(0, -TAG_LENGTH), nonce.length + TAG_LENGTH);

  return {
    version: ENCRYPTED_DATA_VERSION,
    kdf: KDF,
    kdfParams: { ...ARGON2ID_PARAMS },
    cipher: CIPHER,
    salt: toBase64(salt),
    ciphertext: toBase64(combined),
  };
}
