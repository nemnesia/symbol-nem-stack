import { describe, expect, it } from 'vitest';

import { type NetworkIdentity, compareNetworkIdentity, requireNetworkMatch } from './network';

const identities: Readonly<Record<'mainnet' | 'testnet', NetworkIdentity>> = {
  mainnet: {
    network: 'mainnet',
    networkType: 0x68,
    generationHashSeed: '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
    epochAdjustmentSeconds: 1615853185n,
  },
  testnet: {
    network: 'testnet',
    networkType: 0x98,
    generationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
    epochAdjustmentSeconds: 1616694977n,
  },
};

describe('Network identity contract', () => {
  it('pins public Mainnet and Testnet values', () => {
    expect(identities.mainnet).toMatchObject({
      networkType: 0x68,
      epochAdjustmentSeconds: 1615853185n,
    });
    expect(identities.testnet).toMatchObject({
      networkType: 0x98,
      epochAdjustmentSeconds: 1616694977n,
    });
  });

  it.each(['mainnet', 'testnet'] as const)('accepts observed %s identity', (network) => {
    const expected = identities[network];
    expect(
      compareNetworkIdentity(expected, {
        networkType: expected.networkType,
        generationHashSeed: expected.generationHashSeed.toLowerCase(),
        epochAdjustment: `${expected.epochAdjustmentSeconds}s`,
      })
    ).toBe('match');
  });

  it('fails closed for cross-network, unavailable and malformed evidence', () => {
    const mainnet = identities.mainnet;
    const testnet = identities.testnet;
    expect(
      compareNetworkIdentity(mainnet, {
        networkType: testnet.networkType,
        generationHashSeed: testnet.generationHashSeed,
        epochAdjustment: `${testnet.epochAdjustmentSeconds}s`,
      })
    ).toBe('mismatch');
    expect(requireNetworkMatch(mainnet, undefined)).toMatchObject({
      ok: false,
      error: { code: 'network-identity-unavailable' },
    });
    expect(
      compareNetworkIdentity(mainnet, { networkType: '104', generationHashSeed: 'bad', epochAdjustment: '0' })
    ).toBe('malformed');
    expect(
      compareNetworkIdentity(mainnet, { networkType: 0x42, generationHashSeed: '00'.repeat(32), epochAdjustment: 1 })
    ).toBe('unsupported');
  });
});
