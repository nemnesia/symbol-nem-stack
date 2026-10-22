import { describe, expect, it } from 'vitest';

import { type ExpiryReference, createExpiryReference, estimateKeyExpiry } from './votingKeyExpiry';

const baseTime = Date.parse('2026-01-01T00:00:00Z');
const reference: ExpiryReference = {
  height: 100n,
  timestampMs: BigInt(baseTime),
  observedAtMs: BigInt(baseTime),
  votingSetGrouping: 100n,
  blockGenerationTargetTimeMs: 30_000n,
};
const properties = {
  network: { epochAdjustment: '1s' },
  chain: { votingSetGrouping: "1'440", blockGenerationTargetTime: '30s' },
};

describe('voting key expiry estimates', () => {
  it('uses the inclusive end epoch and rounds positive remaining days up', () => {
    // Epoch 31 ends at height 3000: 2900 blocks * 30s = 1 day and 10 minutes.
    expect(estimateKeyExpiry(31, reference, 2)).toEqual({
      kind: 'estimated',
      timestampMs: baseTime + 87_000_000,
      remainingDays: 2n,
      lessThanOneDay: false,
    });
  });

  it('uses the selected network configuration instead of a fixed epoch duration', () => {
    const otherNetwork = { ...reference, votingSetGrouping: 50n, blockGenerationTargetTimeMs: 60_000n };
    expect(estimateKeyExpiry(4, otherNetwork)).toEqual({
      kind: 'estimated',
      timestampMs: baseTime + 3_000_000,
      remainingDays: 1n,
      lessThanOneDay: true,
    });
  });

  it('does not report expiry before finalization advances past the end epoch', () => {
    expect(estimateKeyExpiry(2, reference, 2)).toEqual({ kind: 'awaiting-finalization' });
    expect(estimateKeyExpiry(2, { ...reference, height: 101n }, 2)).toEqual({ kind: 'awaiting-finalization' });
    expect(estimateKeyExpiry(2, reference, 3)).toEqual({ kind: 'expired' });
  });

  it('handles the special first epoch and does not estimate a historical expiry date', () => {
    expect(estimateKeyExpiry(1, { ...reference, height: 1n }, 1)).toEqual({ kind: 'awaiting-finalization' });
    expect(estimateKeyExpiry(1, reference, 2)).toEqual({ kind: 'expired' });
  });

  it('preserves integer precision for heights greater than Number.MAX_SAFE_INTEGER', () => {
    const grouping = 9_007_199_254_740_993n;
    expect(estimateKeyExpiry(2, { ...reference, height: grouping - 1n, votingSetGrouping: grouping })).toEqual({
      kind: 'estimated',
      timestampMs: baseTime + 30_000,
      remainingDays: 1n,
      lessThanOneDay: true,
    });
  });

  it('declines estimates for stale timestamps or dates outside the JavaScript Date range', () => {
    expect(estimateKeyExpiry(3, { ...reference, observedAtMs: BigInt(baseTime) + 4_000_000n })).toEqual({
      kind: 'unavailable',
    });
    expect(estimateKeyExpiry(3, { ...reference, timestampMs: 8_640_000_000_000_000n })).toEqual({
      kind: 'unavailable',
    });
    expect(estimateKeyExpiry(0, reference)).toEqual({ kind: 'unavailable' });
    expect(estimateKeyExpiry(Number.NaN, reference)).toEqual({ kind: 'unavailable' });
  });
});

describe('expiry reference input validation', () => {
  it('reads raw network properties and converts the network-relative timestamp', () => {
    expect(createExpiryReference(properties, '100', '2000', baseTime)).toEqual({
      height: 100n,
      timestampMs: 3000n,
      observedAtMs: BigInt(baseTime),
      votingSetGrouping: 1440n,
      blockGenerationTargetTimeMs: 30_000n,
    });
  });

  it.each([
    ['500ms', 500n],
    ['2m', 120_000n],
    ['1h', 3_600_000n],
  ])('supports the Catapult duration unit in %s', (duration, expected) => {
    expect(
      createExpiryReference(
        { ...properties, chain: { ...properties.chain, blockGenerationTargetTime: duration } },
        '100',
        '0',
        baseTime
      ).blockGenerationTargetTimeMs
    ).toBe(expected);
  });

  it.each([
    { network: properties.network, chain: { blockGenerationTargetTime: '30s' } },
    { network: properties.network, chain: { votingSetGrouping: '0', blockGenerationTargetTime: '30s' } },
    { network: properties.network, chain: { votingSetGrouping: '1440', blockGenerationTargetTime: '0s' } },
    { network: properties.network, chain: { votingSetGrouping: '1440', blockGenerationTargetTime: '30' } },
    { network: {}, chain: properties.chain },
    {
      network: properties.network,
      chain: { votingSetGrouping: '18446744073709551616', blockGenerationTargetTime: '30s' },
    },
  ])('rejects missing or invalid network settings without a default', (invalid) => {
    expect(() => createExpiryReference(invalid, '100', '0', baseTime)).toThrow();
  });
});
