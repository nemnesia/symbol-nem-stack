import { describe, expect, it } from 'vitest';

import { type SnifDocument, decode, encode, inspect } from '../src/index.js';

const generationHashSeed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const address = Uint8Array.from(
  '988E1191A25A88142C2FB3F69787576E3DC713EFC1CE4DE9'.match(/../g)!.map((value) => Number.parseInt(value, 16))
);
const document: SnifDocument<'address'> = {
  type: 'address',
  chain: 'symbol',
  network: { id: 0x98, generationHashSeed },
  payload: { address },
};

describe('SNIF codec', () => {
  it('deterministically round-trips an unencrypted address document', async () => {
    const first = await encode(document, { compression: 'none' });
    const second = await encode(document, { compression: 'none' });
    expect(first).toEqual(second);
    expect(await decode(first)).toEqual(document);
    expect(inspect(first)).toEqual({
      protocol: 'snif',
      version: 1,
      type: 'address',
      chain: 'symbol',
      network: document.network,
      compression: 'none',
      encryption: { algorithm: 'none' },
    });
  });

  it('rejects duplicate CBOR map keys', async () => {
    const duplicateMap = Uint8Array.of(0xa2, 0x61, 0x61, 0x01, 0x61, 0x61, 0x02);
    await expect(decode(duplicateMap)).rejects.toMatchObject({ code: 'invalid-envelope' });
  });

  it('rejects an unknown payload field', async () => {
    await expect(
      encode({ ...document, payload: { address, unknown: true } }, { compression: 'none' })
    ).rejects.toMatchObject({ code: 'invalid-payload' });
  });

  it('requires password encryption for mnemonic documents', async () => {
    const mnemonic: SnifDocument<'mnemonic'> = {
      type: 'mnemonic',
      chain: 'nem',
      network: { id: 0x68 },
      payload: {
        scheme: 'bip39',
        language: 'english',
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      },
    };
    await expect(encode(mnemonic)).rejects.toMatchObject({ code: 'password-required' });
  });

  it('encrypts and authenticates mnemonic documents', async () => {
    const mnemonic: SnifDocument<'mnemonic'> = {
      type: 'mnemonic',
      chain: 'nem',
      network: { id: 0x68 },
      payload: {
        scheme: 'bip39',
        language: 'english',
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      },
    };
    const encoded = await encode(mnemonic, { password: 'correct horse battery staple' });
    expect(inspect(encoded).encryption.algorithm).toBe('password-v1');
    await expect(decode(encoded, { password: 'correct horse battery staple' })).resolves.toEqual(mnemonic);
    await expect(decode(encoded, { password: 'wrong password' })).rejects.toMatchObject({
      code: 'decryption-failed',
    });
  });
});
