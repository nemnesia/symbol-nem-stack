import { describe, expect, it } from 'vitest';

import { decrypt, encrypt } from '../src/index.js';
import type { EncryptedData } from '../src/index.js';

describe('エラーハンドリング', () => {
  // テスト用: nonce(12) + tag(16) + ciphertext(4)
  const validEncryptedData: EncryptedData = {
    version: 1,
    kdf: 'argon2id',
    kdfParams: { memoryCost: 32768, timeCost: 2, parallelism: 1 },
    cipher: 'aes-256-gcm',
    salt: 'dGVzdHNhbHQ=',
    ciphertext: Buffer.from(
      new Uint8Array([
        // nonce (12 bytes)
        ...Array(12).fill(1),
        // tag (16 bytes)
        ...Array(16).fill(2),
        // ciphertext (4 bytes)
        ...Array(4).fill(3),
      ])
    ).toString('base64'),
  };

  it('破損したbase64データでエラーを返す', async () => {
    const invalidData = {
      ...validEncryptedData,
      salt: 'invalid!!!base64',
    };
    await expect(decrypt(invalidData, 'password')).rejects.toThrow('Decryption failed');
  });

  it('非正規または不正なbase64データを拒否する', async () => {
    await expect(decrypt({ ...validEncryptedData, salt: 'dGVzdHNhbHQ' }, 'password')).rejects.toThrow(
      'Decryption failed'
    );
    await expect(decrypt({ ...validEncryptedData, salt: 'dGVzdHNhbHQ===' }, 'password')).rejects.toThrow(
      'Decryption failed'
    );
  });

  it('認証済みメタデータの改ざんを拒否する', async () => {
    await expect(
      decrypt({ ...validEncryptedData, version: 2 } as unknown as EncryptedData, 'password')
    ).rejects.toThrow('Decryption failed');
    await expect(
      decrypt({ ...validEncryptedData, kdfParams: { memoryCost: 65536, timeCost: 2, parallelism: 1 } }, 'password')
    ).rejects.toThrow('Decryption failed');
    await expect(
      decrypt({ ...validEncryptedData, kdf: 'other' } as unknown as EncryptedData, 'password')
    ).rejects.toThrow('Decryption failed');
    await expect(
      decrypt({ ...validEncryptedData, cipher: 'other' } as unknown as EncryptedData, 'password')
    ).rejects.toThrow('Decryption failed');
  });

  it('実際に暗号化したデータの salt、nonce、tag、ciphertext 改ざんを拒否する', async () => {
    const encrypted = await encrypt(new TextEncoder().encode('authenticated value'), 'tamper-test-password');
    const alter = (base64: string, index: number): string => {
      const bytes = Buffer.from(base64, 'base64');
      bytes[index] ^= 1;
      return bytes.toString('base64');
    };

    await expect(decrypt({ ...encrypted, salt: alter(encrypted.salt, 0) }, 'tamper-test-password')).rejects.toThrow(
      'Decryption failed'
    );
    await expect(
      decrypt({ ...encrypted, ciphertext: alter(encrypted.ciphertext, 0) }, 'tamper-test-password')
    ).rejects.toThrow('Decryption failed');
    await expect(
      decrypt({ ...encrypted, ciphertext: alter(encrypted.ciphertext, 12) }, 'tamper-test-password')
    ).rejects.toThrow('Decryption failed');
    await expect(
      decrypt({ ...encrypted, ciphertext: alter(encrypted.ciphertext, 28) }, 'tamper-test-password')
    ).rejects.toThrow('Decryption failed');
  });

  it('改ざんされた暗号文でエラーを返す', async () => {
    // ciphertextを壊す
    const invalidData = {
      ...validEncryptedData,
      ciphertext: Buffer.from(new Uint8Array(32).fill(9)).toString('base64'),
    };
    await expect(decrypt(invalidData, 'password')).rejects.toThrow('Decryption failed');
  });

  it('改ざんされた認証タグでエラーを返す', async () => {
    // tag部分だけ壊す
    const broken = Buffer.from(
      new Uint8Array([
        ...Array(12).fill(1), // nonce
        ...Array(16).fill(99), // tag (壊す)
        ...Array(4).fill(3), // ciphertext
      ])
    ).toString('base64');
    const invalidData = {
      ...validEncryptedData,
      ciphertext: broken,
    };
    await expect(decrypt(invalidData, 'password')).rejects.toThrow('Decryption failed');
  });
  it('改ざんされたnonceでエラーを返す', async () => {
    // nonce部分だけ壊す
    const broken = Buffer.from(
      new Uint8Array([
        ...Array(12).fill(88), // nonce (壊す)
        ...Array(16).fill(2), // tag
        ...Array(4).fill(3), // ciphertext
      ])
    ).toString('base64');
    const invalidData = {
      ...validEncryptedData,
      ciphertext: broken,
    };
    await expect(decrypt(invalidData, 'password')).rejects.toThrow('Decryption failed');
  });
});
