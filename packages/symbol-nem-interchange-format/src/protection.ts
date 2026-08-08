import { gcm } from '@noble/ciphers/aes.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { clean, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { failure, success } from './errors.js';
import type { ProtectedPayload, ProtectionProvider, SnifResult } from './types.js';
import { validateProtectedPayload } from './validation.js';

const CIPHER = 'aes-256-gcm';
const KDF = 'argon2id';
const ARGON2_VERSION = 19;
const MEMORY_COST = 65_536;
const TIME_COST = 3;
const PARALLELISM = 1;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const MAX_MEMORY_COST = 262_144;
const MAX_TIME_COST = 10;
const MAX_PARALLELISM = 4;

/** Uint8ArrayをSNIFの小文字hex表現へ変換します。 */
function bytesToHex(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
  return output;
}

/** 検証済みのhex文字列を新しいUint8Arrayへ変換します。 */
function hexToBytes(value: string): Uint8Array {
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

/** 標準providerが使用するKDF・nonce・tagの値を取り出します。 */
function getStandardParams(payload: ProtectedPayload):
  | {
      salt: string;
      nonce: string;
      tag: string;
      version: number;
      memoryCost: number;
      timeCost: number;
      parallelism: number;
    }
  | undefined {
  if (
    payload.cipher !== CIPHER ||
    payload.kdf?.name !== KDF ||
    payload.kdf.salt === undefined ||
    payload.kdf.params === undefined ||
    payload.nonce === undefined ||
    payload.tag === undefined
  ) {
    return undefined;
  }
  const params = payload.kdf.params;
  if (
    typeof params.version !== 'number' ||
    typeof params.memoryCost !== 'number' ||
    typeof params.timeCost !== 'number' ||
    typeof params.parallelism !== 'number'
  ) {
    return undefined;
  }
  return {
    salt: payload.kdf.salt,
    nonce: payload.nonce,
    tag: payload.tag,
    version: params.version,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
  };
}

/**
 * 標準provider固有の検証を行います。
 *
 * 共通のJSON型・hex表現はSNIF検証へ委譲し、ここではArgon2idの値と
 * providerが許容する処理資源の上限を確認します。
 */
function validateStandardPayload(payload: ProtectedPayload): SnifResult<void> {
  const base = validateProtectedPayload(payload);
  if (!base.ok) return failure(base.error.code, base.error.path);
  if (payload.cipher !== CIPHER || payload.kdf?.name !== KDF) {
    return failure('UNSUPPORTED_PROTECTION');
  }
  const params = getStandardParams(payload);
  if (!params) return failure('INVALID_PROTECTION_PARAMETERS');
  if (params.version !== ARGON2_VERSION || !Number.isInteger(params.version)) {
    return failure('INVALID_PROTECTION_PARAMETERS');
  }
  if (
    !Number.isInteger(params.memoryCost) ||
    !Number.isInteger(params.timeCost) ||
    !Number.isInteger(params.parallelism) ||
    params.memoryCost < 8 * params.parallelism ||
    params.timeCost < 1 ||
    params.parallelism < 1
  ) {
    return failure('INVALID_PROTECTION_PARAMETERS');
  }
  if (params.memoryCost > MAX_MEMORY_COST || params.timeCost > MAX_TIME_COST || params.parallelism > MAX_PARALLELISM) {
    return failure('RESOURCE_LIMIT_EXCEEDED');
  }
  if (hexToBytes(params.salt).length !== SALT_LENGTH) {
    return failure('INVALID_PROTECTION_PARAMETERS', '/kdf/salt');
  }
  if (hexToBytes(params.nonce).length !== NONCE_LENGTH) {
    return failure('INVALID_PROTECTION_PARAMETERS', '/nonce');
  }
  if (hexToBytes(params.tag).length !== TAG_LENGTH) {
    return failure('INVALID_PROTECTION_PARAMETERS', '/tag');
  }
  return success(undefined);
}

/** passwordをUnicode正規化せずUTF-8化してArgon2idで鍵導出します。 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  params: {
    version: number;
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  }
): Promise<Uint8Array> {
  const passwordBytes = utf8ToBytes(password);
  try {
    return await argon2idAsync(passwordBytes, salt, {
      version: params.version,
      m: params.memoryCost,
      t: params.timeCost,
      p: params.parallelism,
      dkLen: KEY_LENGTH,
    });
  } finally {
    clean(passwordBytes);
  }
}

/**
 * SNIF v1標準のArgon2id + AES-256-GCM保護providerです。
 *
 * 新規保護時はArgon2id v19、memoryCost 65536 KiB、timeCost 3、
 * parallelism 1、16 byte salt、12 byte nonceを使用します。AES-GCMのAADは
 * 使用せず、秘密情報や内部エラーの詳細をログへ出力しません。
 */
export const standardProtectionProvider: ProtectionProvider<string> = {
  supports(payload): boolean {
    return payload.cipher === CIPHER && payload.kdf?.name === KDF;
  },

  validate(payload): SnifResult<void> {
    return validateStandardPayload(payload);
  },

  async protect(plaintext, secret): Promise<SnifResult<ProtectedPayload>> {
    if (typeof secret !== 'string') return failure('PROTECTION_FAILED');
    // saltとnonceは毎回CSPRNGで生成し、同じsecretから同じnonceを再利用しない。
    const salt = randomBytes(SALT_LENGTH);
    const nonce = randomBytes(NONCE_LENGTH);
    let key: Uint8Array | undefined;
    try {
      key = await deriveKey(secret, salt, {
        version: ARGON2_VERSION,
        memoryCost: MEMORY_COST,
        timeCost: TIME_COST,
        parallelism: PARALLELISM,
      });
      // 標準プロファイルはAADを使用しないため、外側エンベロープは認証対象に含めない。
      const encrypted = gcm(key, nonce).encrypt(plaintext);
      const ciphertext = encrypted.slice(0, -TAG_LENGTH);
      const tag = encrypted.slice(-TAG_LENGTH);
      const result = success<ProtectedPayload>({
        cipher: CIPHER,
        kdf: {
          name: KDF,
          salt: bytesToHex(salt),
          params: {
            version: ARGON2_VERSION,
            memoryCost: MEMORY_COST,
            timeCost: TIME_COST,
            parallelism: PARALLELISM,
          },
        },
        nonce: bytesToHex(nonce),
        ciphertext: bytesToHex(ciphertext),
        tag: bytesToHex(tag),
      });
      clean(encrypted);
      clean(ciphertext);
      clean(tag);
      return result;
    } catch {
      return failure('PROTECTION_FAILED');
    } finally {
      if (key) clean(key);
      clean(salt);
      clean(nonce);
    }
  },

  async unprotect(payload, secret): Promise<SnifResult<Uint8Array>> {
    if (typeof secret !== 'string') return failure('AUTHENTICATION_FAILED');
    const validation = validateStandardPayload(payload);
    if (!validation.ok) return failure(validation.error.code, validation.error.path);
    const params = getStandardParams(payload);
    if (!params) return failure('INVALID_PROTECTION_PARAMETERS');

    const salt = hexToBytes(params.salt);
    const nonce = hexToBytes(params.nonce);
    const tag = hexToBytes(params.tag);
    const ciphertext = hexToBytes(payload.ciphertext);
    // noble-ciphersの戻り値に合わせ、復号前にciphertextとtagを結合する。
    const encrypted = new Uint8Array(ciphertext.length + tag.length);
    encrypted.set(ciphertext);
    encrypted.set(tag, ciphertext.length);
    let key: Uint8Array | undefined;
    try {
      key = await deriveKey(secret, salt, params);
      return success(gcm(key, nonce).decrypt(encrypted));
    } catch {
      // secret不一致、改ざん、tag不一致などは外部から区別しない。
      return failure('AUTHENTICATION_FAILED');
    } finally {
      if (key) clean(key);
      clean(salt);
      clean(nonce);
      clean(tag);
      clean(ciphertext);
      clean(encrypted);
    }
  },
};

export { CIPHER as STANDARD_CIPHER, KDF as STANDARD_KDF };
