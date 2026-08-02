import { describe, expect, it } from 'vitest';

import type { SnifHeader } from '../src/index.js';

const symbolHeader: SnifHeader = {
  protocol: 'snif',
  version: 1,
  type: 'address',
  chain: 'symbol',
  network: { id: 0x98, generationHashSeed: new Uint8Array(32).fill(1) },
  compression: 'none',
  encryption: { algorithm: 'none' },
};

// @ts-expect-error Symbol headers require a Symbol network.
const invalidSymbolHeader: SnifHeader = { ...symbolHeader, network: { id: 0x68 } };

describe('public type contracts', () => {
  it('preserves chain and network correlation', () => {
    expect(symbolHeader.network).toHaveProperty('generationHashSeed');
    expect(invalidSymbolHeader).toBeDefined();
  });
});
