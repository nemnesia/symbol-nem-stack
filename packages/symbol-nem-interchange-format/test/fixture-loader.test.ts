import { describe, expect, it } from 'vitest';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decode, encode } from '../src/index.js';
import { loadFixtures } from './fixture-loader.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../doc/fixtures');

describe('normative fixture loader', () => {
  it('loads and validates every manifest fixture', async () => {
    const loaded = await loadFixtures(fixtures);
    expect(loaded.map((item) => item.entry.id)).toEqual(['mnemonic-derivation-v1', 'cbor-envelope-symbol-address-v1']);
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
    const bytes = (hex: string): Uint8Array =>
      Uint8Array.from(hex.match(/../g)!.map((value) => Number.parseInt(value, 16)));
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
