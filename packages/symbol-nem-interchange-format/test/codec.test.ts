import { encode as encodeCbor } from 'cborg';
import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { type SnifDocument, decode, encode, inspect } from '../src/index.js';
import { validatePayload } from '../src/internal/validation.js';

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

  it.each([
    ['decomposed Unicode', 'Cafe\u0301'],
    ['line feed', 'line\nfeed'],
    ['tab', 'tab\tseparated'],
    ['NUL', 'nul\u0000byte'],
    ['DEL', 'delete\u007fbyte'],
  ])('rejects %s in display text', async (_name, value) => {
    await expect(
      encode(
        { type: 'contact', chain: 'symbol', network: document.network, payload: { name: value, address } },
        { compression: 'none' }
      )
    ).rejects.toMatchObject({ code: 'invalid-payload' });
  });

  it('accepts NFC display text at its UTF-8 byte limit', async () => {
    await expect(
      encode(
        { type: 'contact', chain: 'symbol', network: document.network, payload: { name: 'é'.repeat(64), address } },
        { compression: 'none' }
      )
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it('stops zlib expansion above the 16 MiB payload limit', async () => {
    const compressed = zlibSync(new Uint8Array(16 * 1024 * 1024 + 1));
    const envelope = encodeCbor({
      protocol: 'snif',
      version: 1,
      type: 'address',
      chain: 'symbol',
      network: document.network,
      compression: 'zlib',
      encryption: { algorithm: 'none' },
      payload: compressed,
    });
    await expect(decode(envelope)).rejects.toMatchObject({ code: 'resource-limit' });
  });

  it.each([
    ['duplicated checksum', (compressed: Uint8Array) => compressed.subarray(compressed.byteLength - 4)],
    ['another complete stream', (compressed: Uint8Array) => compressed],
    ['a zero byte', () => Uint8Array.of(0)],
    ['arbitrary bytes', () => Uint8Array.of(1, 2, 3, 4)],
  ])('rejects %s appended after a zlib stream', async (_name, trailingData) => {
    const payload = encodeCbor(document.payload);
    const compressed = zlibSync(payload);
    const trailing = trailingData(compressed);
    const withTrailingData = new Uint8Array(compressed.byteLength + trailing.byteLength);
    withTrailingData.set(compressed);
    withTrailingData.set(trailing, compressed.byteLength);
    const envelope = encodeCbor({
      protocol: 'snif',
      version: 1,
      type: 'address',
      chain: 'symbol',
      network: document.network,
      compression: 'zlib',
      encryption: { algorithm: 'none' },
      payload: withTrailingData,
    });
    await expect(decode(envelope)).rejects.toMatchObject({ code: 'invalid-payload' });
  });

  it('accepts an NFKD BIP39 passphrase and rejects its NFC equivalent', () => {
    const payload = {
      scheme: 'bip39',
      language: 'english',
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      passphrase: 'e\u0301',
    };
    expect(validatePayload('mnemonic', 'nem', payload)).toBe(payload);
    expect(() => validatePayload('mnemonic', 'nem', { ...payload, passphrase: 'é' })).toThrowError(
      expect.objectContaining({ code: 'invalid-payload' })
    );
  });

  it('applies the mnemonic passphrase UTF-8 byte boundary without NFC normalization', () => {
    const payload = {
      scheme: 'bip39',
      language: 'english',
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    };
    expect(validatePayload('mnemonic', 'nem', { ...payload, passphrase: 'a'.repeat(1024) })).toBeDefined();
    expect(() => validatePayload('mnemonic', 'nem', { ...payload, passphrase: 'a'.repeat(1025) })).toThrowError(
      expect.objectContaining({ code: 'invalid-payload' })
    );
    expect(validatePayload('mnemonic', 'nem', { ...payload, passphrase: '' })).toBeDefined();
  });
});
