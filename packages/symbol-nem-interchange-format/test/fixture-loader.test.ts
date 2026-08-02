import { Bip32 } from '@nemnesia/symbol-sdk';
import { NemFacade } from '@nemnesia/symbol-sdk/nem';
import { SymbolFacade } from '@nemnesia/symbol-sdk/symbol';
import { gcm } from '@noble/ciphers/aes.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { encode as encodeCbor } from 'cborg';
import { describe, expect, it } from 'vitest';

import { pbkdf2Sync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { decode, encode } from '../src/index.js';
import { loadFixtures } from './fixture-loader.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../doc/fixtures');
const bytes = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/../g)!.map((value) => Number.parseInt(value, 16)));
const hex = (value: Uint8Array): string => Buffer.from(value).toString('hex').toUpperCase();

describe('normative fixture loader', () => {
  it('loads and validates every manifest fixture', async () => {
    const loaded = await loadFixtures(fixtures);
    expect(loaded.map((item) => item.entry.id)).toEqual([
      'mnemonic-derivation-v1',
      'cbor-envelope-symbol-address-v1',
      'codec-structural-matrix-v1',
      'password-v1-fixed-v1',
      'zlib-profile-v1',
      'transaction-primitives-v1',
      'mnemonic-unicode-v1',
    ]);
  });

  it('covers all v1 format types with reviewed CBOR values', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'codec-structural-matrix-v1')!.data as {
      cases: Array<{ id: string; expected: { payloadCbor: string; envelopeCbor: string } }>;
    };
    expect(fixture.cases.map(({ id }) => id)).toEqual([
      'contact',
      'address',
      'account',
      'mnemonic',
      'sign-request',
      'signed-transaction',
      'message-sign-request',
      'signature',
      'connection-request',
      'connection-response',
    ]);
    for (const { expected } of fixture.cases) {
      expect(expected.payloadCbor).toMatch(/^[0-9A-F]+$/);
      expect(expected.envelopeCbor).toMatch(/^[0-9A-F]+$/);
    }
  });

  it('independently reproduces the empty and 1024-byte BIP39 seeds', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'mnemonic-unicode-v1')!.data as {
      cases: Array<{ id: string; input: Record<string, unknown>; expected: { seed?: string } }>;
    };
    const mnemonic = 'ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco ábaco abierto';
    const derive = (passphrase: string): string =>
      pbkdf2Sync(
        Buffer.from(mnemonic.normalize('NFKD')),
        Buffer.from(`mnemonic${passphrase.normalize('NFKD')}`),
        2048,
        64,
        'sha512'
      )
        .toString('hex')
        .toUpperCase();
    const empty = fixture.cases.find(({ id }) => 'spanish-empty-passphrase' === id)!;
    expect(derive('')).toBe(empty.expected.seed);
    const boundaryValue = 'é'.repeat(341) + 'a';
    expect(new TextEncoder().encode(boundaryValue)).toHaveLength(1024);
    const boundary = fixture.cases.find(({ id }) => 'utf8-1024-boundary' === id)!;
    expect(derive(boundaryValue)).toBe(boundary.expected.seed);
  });

  it('reproduces every normative Unicode account derivation for both chains', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'mnemonic-unicode-v1')!.data as {
      cases: Array<{
        input: { mnemonic: string; passphrase: string };
        expected: {
          seed?: string;
          symbol?: { publicKey: string; address: string };
          nem?: { publicKey: string; address: string };
        };
      }>;
    };
    for (const testCase of fixture.cases.filter(({ expected }) => expected.seed)) {
      for (const [chain, Facade] of [
        ['symbol', SymbolFacade],
        ['nem', NemFacade],
      ] as const) {
        const facade = new Facade('mainnet');
        const node = new Bip32()
          .fromMnemonic(testCase.input.mnemonic, testCase.input.passphrase)
          .derivePath(facade.bip32Path(0));
        const keyPair = Facade.bip32NodeToKeyPair(node);
        const account = facade.createAccount(keyPair.privateKey);
        expect(account.publicKey.toString()).toBe(testCase.expected[chain]!.publicKey);
        expect(account.address.toString()).toBe(testCase.expected[chain]!.address);
      }
    }
  });

  it('independently reproduces the password-v1 key, ciphertext, and tag', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'password-v1-fixed-v1')!.data as {
      constants: { password: string; salt: string; nonce: string };
      cases: Array<{
        id: string;
        input: { plaintext: string };
        expected: { derivedKey: string; aad: string; ciphertext: string; tag: string };
      }>;
    };
    const testCase = fixture.cases.find(({ id }) => 'valid-symbol-address' === id)!;
    const key = await argon2idAsync(
      new TextEncoder().encode(fixture.constants.password),
      bytes(fixture.constants.salt),
      {
        t: 3,
        m: 65_536,
        p: 4,
        dkLen: 32,
        version: 0x13,
      }
    );
    expect(hex(key)).toBe(testCase.expected.derivedKey);
    const encrypted = gcm(key, bytes(fixture.constants.nonce), bytes(testCase.expected.aad)).encrypt(
      bytes(testCase.input.plaintext)
    );
    expect(hex(encrypted.subarray(0, -16))).toBe(testCase.expected.ciphertext);
    expect(hex(encrypted.subarray(-16))).toBe(testCase.expected.tag);
  });

  it('executes every registered zlib stream byte-for-byte', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'zlib-profile-v1')!.data as {
      cases: Array<{
        id: string;
        input: { stream: string };
        expected: { plaintext?: string; plaintextBytes?: number; error?: string };
      }>;
    };
    const valid = fixture.cases.find(({ id }) => 'valid' === id)!;
    const plaintext = new Uint8Array(inflateSync(bytes(valid.input.stream)));
    expect(hex(plaintext)).toBe(valid.expected.plaintext);
    expect(plaintext).toHaveLength(valid.expected.plaintextBytes!);

    const network = {
      id: 0x98,
      generationHashSeed: bytes('57F7DA205008026C776CB6AED843393F04CD458E7D55817A54BEBDD4058A7D54'),
    };
    for (const testCase of fixture.cases) {
      const envelope = encodeCbor({
        protocol: 'snif',
        version: 1,
        type: 'address',
        chain: 'symbol',
        network,
        compression: 'zlib',
        encryption: { algorithm: 'none' },
        payload: bytes(testCase.input.stream),
      });
      if (testCase.expected.error)
        await expect(decode(envelope)).rejects.toMatchObject({ code: testCase.expected.error });
      else await expect(decode(envelope)).resolves.toMatchObject({ type: 'address', chain: 'symbol' });
    }
  });

  it('matches the normative Symbol address envelope byte-for-byte', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'cbor-envelope-symbol-address-v1')!.data as {
      document: {
        type: 'address';
        chain: 'symbol';
        networkId: number;
        generationHashSeed: string;
        address: string;
      };
      envelopeCbor: string;
    };
    const document = {
      type: fixture.document.type,
      chain: fixture.document.chain,
      network: {
        id: fixture.document.networkId,
        generationHashSeed: bytes(fixture.document.generationHashSeed),
      },
      payload: { address: bytes(fixture.document.address) },
    } as const;
    const encoded = await encode(document, { compression: 'none' });
    expect(Array.from(encoded)).toEqual(Array.from(bytes(fixture.envelopeCbor)));
    expect(await decode(bytes(fixture.envelopeCbor))).toEqual(document);
  });
});
