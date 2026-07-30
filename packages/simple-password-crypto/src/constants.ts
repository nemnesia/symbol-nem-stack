import { utf8ToBytes } from '@noble/hashes/utils.js';

import type { Argon2idParams, CipherType, KdfType } from './types.js';

export const ENCRYPTED_DATA_VERSION = 1;
export const KDF: KdfType = 'argon2id';
export const CIPHER: CipherType = 'aes-256-gcm';

// This meets OWASP's Argon2id minimum (19 MiB, t=2, p=1). Re-benchmark before
// changing it; the parameters are persisted in every versioned envelope.
export const ARGON2ID_PARAMS: Readonly<Argon2idParams> = {
  memoryCost: 32768,
  timeCost: 2,
  parallelism: 1,
};

/**
 * 復号を許可する Argon2id パラメータの明示的なホワイトリストです。
 *
 * 新しい既定値へ移行する際は、`ARGON2ID_PARAMS` を更新し、以前の値をこの配列に
 * 残してください。復号はこの配列以外の、攻撃者が指定した任意のコストを使用しません。
 */
export const SUPPORTED_ARGON2ID_PARAMS: readonly Readonly<Argon2idParams>[] = [ARGON2ID_PARAMS];

export const SALT_LENGTH = 16;
export const NONCE_LENGTH = 12;
export const TAG_LENGTH = 16;

// Bound attacker-controlled input before base64 decoding or allocating ciphertext buffers.
export const MAX_PLAINTEXT_LENGTH = 16 * 1024 * 1024;
export const MAX_COMBINED_LENGTH = NONCE_LENGTH + TAG_LENGTH + MAX_PLAINTEXT_LENGTH;
export const MAX_CIPHERTEXT_BASE64_LENGTH = 4 * Math.ceil(MAX_COMBINED_LENGTH / 3);
export const MAX_SALT_BASE64_LENGTH = 4 * Math.ceil(SALT_LENGTH / 3);

export function metadataToAad(params: Readonly<Argon2idParams>): Uint8Array {
  // The byte representation is deliberately fixed rather than derived from object key order.
  return utf8ToBytes(
    `simple-password-crypto:v${ENCRYPTED_DATA_VERSION};kdf=${KDF};m=${params.memoryCost};t=${params.timeCost};p=${params.parallelism};cipher=${CIPHER}`
  );
}
