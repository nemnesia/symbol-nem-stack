import { describe, expect, it } from 'vitest';

import { decrypt, encrypt, needsReencryption } from '../src/index.js';

describe('互換性テスト', () => {
  it('文字列データを正しく処理できる', async () => {
    const testString = 'Test String 123';
    const plaintext = new TextEncoder().encode(testString);
    const password = 'password123';

    const encrypted = await encrypt(plaintext, password);
    const decrypted = await decrypt(encrypted, password);
    const result = new TextDecoder().decode(decrypted);

    expect(result).toBe(testString);
  });

  it('JSONデータを正しく処理できる', async () => {
    const testData = { name: 'Alice', age: 30, items: [1, 2, 3] };
    const jsonString = JSON.stringify(testData);
    const plaintext = new TextEncoder().encode(jsonString);
    const password = 'json-password';

    const encrypted = await encrypt(plaintext, password);
    const decrypted = await decrypt(encrypted, password);
    const result = JSON.parse(new TextDecoder().decode(decrypted));

    expect(result).toEqual(testData);
  });

  it('複数のパスワードで異なるデータを暗号化・復号できる', { timeout: 30000 }, async () => {
    const data1 = new TextEncoder().encode('Data 1');
    const data2 = new TextEncoder().encode('Data 2');
    const password1 = 'password1';
    const password2 = 'password2';

    const encrypted1 = await encrypt(data1, password1);
    const encrypted2 = await encrypt(data2, password2);

    const decrypted1 = await decrypt(encrypted1, password1);
    const decrypted2 = await decrypt(encrypted2, password2);

    expect(decrypted1).toEqual(data1);
    expect(decrypted2).toEqual(data2);

    // 異なるパスワードでは復号できない
    await expect(decrypt(encrypted1, password2)).rejects.toThrow();
    await expect(decrypt(encrypted2, password1)).rejects.toThrow();
  });

  it('同じパスワードで複数のデータを暗号化・復号できる', { timeout: 30000 }, async () => {
    const password = 'shared-password';
    const data1 = new TextEncoder().encode('Message 1');
    const data2 = new TextEncoder().encode('Message 2');
    const data3 = new TextEncoder().encode('Message 3');

    const encrypted1 = await encrypt(data1, password);
    const encrypted2 = await encrypt(data2, password);
    const encrypted3 = await encrypt(data3, password);

    const decrypted1 = await decrypt(encrypted1, password);
    const decrypted2 = await decrypt(encrypted2, password);
    const decrypted3 = await decrypt(encrypted3, password);

    expect(decrypted1).toEqual(data1);
    expect(decrypted2).toEqual(data2);
    expect(decrypted3).toEqual(data3);
  });

  it('絵文字を含むデータを正しく処理できる', async () => {
    const emojiText = '🔐 Secure Data 🔑 パスワード 💻';
    const plaintext = new TextEncoder().encode(emojiText);
    const password = 'emoji-password';

    const encrypted = await encrypt(plaintext, password);
    const decrypted = await decrypt(encrypted, password);
    const result = new TextDecoder().decode(decrypted);

    expect(result).toBe(emojiText);
  });

  it('改行を含むデータを正しく処理できる', async () => {
    const multilineText = 'Line 1\nLine 2\r\nLine 3\rLine 4';
    const plaintext = new TextEncoder().encode(multilineText);
    const password = 'multiline-password';

    const encrypted = await encrypt(plaintext, password);
    const decrypted = await decrypt(encrypted, password);
    const result = new TextDecoder().decode(decrypted);

    expect(result).toBe(multilineText);
  });

  it('固定された v1 テストベクトルを復号できる', async () => {
    const encrypted = {
      version: 1 as const,
      kdf: 'argon2id' as const,
      kdfParams: { memoryCost: 32768, timeCost: 2, parallelism: 1 },
      cipher: 'aes-256-gcm' as const,
      salt: 'AAECAwQFBgcICQoLDA0ODw==',
      ciphertext: 'EBESExQVFhcYGRobcbvUQ4gv5fKvFHvo0P1IsaHlBHDGZfB/kiRHwGuzJKuG/25bC+I=',
    };

    await expect(decrypt(encrypted, 'fixed-vector-password')).resolves.toEqual(
      new TextEncoder().encode('fixed versioned vector')
    );
    expect(needsReencryption(encrypted)).toBe(false);
  });

  it('Legacy 形式は明示的な移行オプションでのみ復号できる', async () => {
    const legacy = {
      salt: 'AAECAwQFBgcICQoLDA0ODw==',
      ciphertext: 'EBESExQVFhcYGRobyTGOun70xsfQssK7Nw/b66HlBHDGZep/hzZN1iWgJeiE9X8=',
    };

    await expect(decrypt(legacy, 'fixed-vector-password')).rejects.toThrow('Decryption failed');
    await expect(decrypt(legacy, 'fixed-vector-password', { allowLegacy: true })).resolves.toEqual(
      new TextEncoder().encode('fixed legacy vector')
    );
    expect(needsReencryption(legacy)).toBe(true);
  });
});
