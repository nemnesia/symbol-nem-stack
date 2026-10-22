import {
  BlockRoutesApi,
  ChainRoutesApi,
  MosaicRoutesApi,
  NetworkRoutesApi,
} from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pickSymbolNode } from './nodewatch';
import { findCurrencyMosaicId, findVotingKeyExpiryReference } from './restClient';

vi.mock('./nodewatch', () => ({ pickSymbolNode: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

const configure = (currencyMosaicId = "0x1234'5678'90AB'CDEF", divisibility = 6) => {
  vi.mocked(pickSymbolNode).mockResolvedValue('https://node.example.com');
  vi.spyOn(NetworkRoutesApi.prototype, 'getNetworkProperties').mockResolvedValue({
    network: {},
    chain: { currencyMosaicId },
    plugins: {},
  });
  return vi.spyOn(MosaicRoutesApi.prototype, 'getMosaic').mockResolvedValue({
    id: 'test',
    mosaic: {
      id: '1234567890ABCDEF',
      divisibility,
      version: 1,
      supply: '0',
      startHeight: '1',
      ownerAddress: 'A'.repeat(48),
      revision: 1,
      flags: 0,
      duration: '0',
    },
  });
};

describe('chain currency identification', () => {
  it('resolves the selected network currency and confirms its divisibility', async () => {
    const mosaic = configure();
    expect(await findCurrencyMosaicId('testnet')).toBe('1234567890ABCDEF');
    expect(pickSymbolNode).toHaveBeenCalledWith('testnet');
    expect(mosaic).toHaveBeenCalledWith({ mosaicId: '1234567890ABCDEF' });
  });

  it('does not label an unrecognized currency amount as XYM', async () => {
    configure('1234567890ABCDEF', 0);
    await expect(findCurrencyMosaicId('mainnet')).rejects.toThrow('Unexpected currency mosaic');
  });

  it('rejects an invalid currency ID before looking up a mosaic', async () => {
    const mosaic = configure('invalid');
    await expect(findCurrencyMosaicId('testnet')).rejects.toThrow('Invalid currency mosaic ID');
    expect(mosaic).not.toHaveBeenCalled();
  });
});

const configureExpiry = (height = '100') => {
  vi.mocked(pickSymbolNode).mockResolvedValue('https://node.example.com');
  const value = vi.fn();
  vi.spyOn(NetworkRoutesApi.prototype, 'getNetworkPropertiesRaw').mockResolvedValue({
    raw: new Response(
      JSON.stringify({
        network: { epochAdjustment: '1s' },
        chain: { votingSetGrouping: '1440', blockGenerationTargetTime: '30s' },
      })
    ),
    value,
  });
  vi.spyOn(ChainRoutesApi.prototype, 'getChainInfo').mockResolvedValue({
    height: '100',
    scoreHigh: '0',
    scoreLow: '0',
    latestFinalizedBlock: { finalizationEpoch: 2, finalizationPoint: 1, height: '90', hash: '0'.repeat(64) },
  });
  const block = vi.spyOn(BlockRoutesApi.prototype, 'getBlockByHeight').mockResolvedValue({
    id: 'synthetic-block',
    meta: {
      hash: '0'.repeat(64),
      totalFee: '0',
      generationHash: '0'.repeat(64),
      stateHashSubCacheMerkleRoots: [],
      totalTransactionsCount: 0,
      transactionsCount: 0,
      statementsCount: 0,
    },
    block: {
      size: 424,
      signature: '0'.repeat(128),
      signerPublicKey: '0'.repeat(64),
      version: 1,
      network: 152,
      type: 33347,
      height,
      timestamp: '2000',
      difficulty: '1',
      proofGamma: '0'.repeat(64),
      proofVerificationHash: '0'.repeat(32),
      proofScalar: '0'.repeat(64),
      previousBlockHash: '0'.repeat(64),
      transactionsHash: '0'.repeat(64),
      receiptsHash: '0'.repeat(64),
      stateHash: '0'.repeat(64),
      beneficiaryAddress: '98' + '00'.repeat(23),
      feeMultiplier: 0,
      votingEligibleAccountsCount: 0,
      harvestingEligibleAccountsCount: '0',
      totalVotingBalance: '0',
      previousImportanceBlockHash: '0'.repeat(64),
    },
  });
  return { value, block };
};

describe('expiry reference REST acquisition', () => {
  it.each(['mainnet', 'testnet'] as const)(
    'preserves the raw grouping setting for %s and fetches the corresponding block',
    async (network) => {
      const { value, block } = configureExpiry();
      const reference = await findVotingKeyExpiryReference(network);
      expect(pickSymbolNode).toHaveBeenLastCalledWith(network);
      expect(reference.votingSetGrouping).toBe(1440n);
      expect(reference.timestampMs).toBe(3000n);
      expect(block).toHaveBeenCalledWith({ height: '100' });
      expect(value).not.toHaveBeenCalled();
    }
  );

  it('rejects a block that does not match the requested height', async () => {
    configureExpiry('101');
    await expect(findVotingKeyExpiryReference('testnet')).rejects.toThrow('Unexpected reference block height');
  });
});
