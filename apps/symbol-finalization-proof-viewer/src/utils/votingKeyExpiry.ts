export type ExpiryReference = {
  height: bigint;
  timestampMs: bigint;
  observedAtMs: bigint;
  votingSetGrouping: bigint;
  blockGenerationTargetTimeMs: bigint;
};

export type ExpiryState = {
  status: 'loading' | 'ready' | 'error';
  reference?: ExpiryReference;
};

export type ExpiryEstimate =
  | { kind: 'estimated'; timestampMs: number; remainingDays: bigint; lessThanOneDay: boolean }
  | { kind: 'expired' | 'awaiting-finalization' | 'unavailable' };

const DAY_MS = 86_400_000n;
const MAX_DATE_MS = 8_640_000_000_000_000n;
const MAX_UINT64 = (1n << 64n) - 1n;

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid properties');
  return value as Record<string, unknown>;
};

const unsignedInteger = (value: unknown): bigint => {
  if (typeof value !== 'string' || !/^\d+(?:'\d+)*$/.test(value)) throw new Error('Invalid integer');
  const parsed = BigInt(value.replaceAll("'", ''));
  if (parsed > MAX_UINT64) throw new Error('Integer out of range');
  return parsed;
};

// Catapult ConfigurationValueParsers.cpp supports integer ms, s, m and h durations.
const durationMs = (value: unknown): bigint => {
  if (typeof value !== 'string') throw new Error('Invalid duration');
  const match = /^(\d+(?:'\d+)*)(ms|s|m|h)$/.exec(value);
  if (!match) throw new Error('Invalid duration');
  const factors: Record<string, bigint> = { ms: 1n, s: 1000n, m: 60_000n, h: 3_600_000n };
  const result = unsignedInteger(match[1]) * factors[match[2]];
  if (result > MAX_UINT64) throw new Error('Duration out of range');
  return result;
};

export const createExpiryReference = (
  properties: unknown,
  blockHeight: string,
  blockTimestamp: string,
  observedAtMs: number
): ExpiryReference => {
  const raw = record(properties);
  const chain = record(raw.chain);
  const network = record(raw.network);
  const height = unsignedInteger(blockHeight);
  const votingSetGrouping = unsignedInteger(chain.votingSetGrouping);
  const blockGenerationTargetTimeMs = durationMs(chain.blockGenerationTargetTime);
  const timestampMs = unsignedInteger(blockTimestamp) + durationMs(network.epochAdjustment);
  if (
    height === 0n ||
    votingSetGrouping === 0n ||
    blockGenerationTargetTimeMs === 0n ||
    timestampMs > MAX_DATE_MS ||
    !Number.isSafeInteger(observedAtMs) ||
    observedAtMs < 0 ||
    BigInt(observedAtMs) > MAX_DATE_MS
  ) {
    throw new Error('Invalid expiry reference');
  }
  return { height, timestampMs, observedAtMs: BigInt(observedAtMs), votingSetGrouping, blockGenerationTargetTimeMs };
};

export const estimateKeyExpiry = (
  endEpoch: number,
  reference: ExpiryReference,
  currentEpoch?: number
): ExpiryEstimate => {
  if (!Number.isSafeInteger(endEpoch) || endEpoch < 1 || endEpoch > 0xffffffff) return { kind: 'unavailable' };
  if (currentEpoch !== undefined && currentEpoch > endEpoch) return { kind: 'expired' };

  // The end epoch is inclusive. Match Catapult model/VotingSet.cpp, including epoch 1.
  const endHeight = endEpoch === 1 ? 1n : (BigInt(endEpoch) - 1n) * reference.votingSetGrouping;
  if (endHeight <= reference.height) return { kind: 'awaiting-finalization' };
  const timestampMs = reference.timestampMs + (endHeight - reference.height) * reference.blockGenerationTargetTimeMs;
  const remainingMs = timestampMs - reference.observedAtMs;
  // A stale node clock must not produce a past date for a key that has not expired.
  if (remainingMs <= 0n || timestampMs > MAX_DATE_MS) return { kind: 'unavailable' };
  return {
    kind: 'estimated',
    timestampMs: Number(timestampMs),
    remainingDays: (remainingMs + DAY_MS - 1n) / DAY_MS,
    lessThanOneDay: remainingMs < DAY_MS,
  };
};
