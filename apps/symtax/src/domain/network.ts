import { type Result, failure, success } from './result';

export type NetworkName = 'mainnet' | 'testnet';
export type NetworkIdentityStatus = 'match' | 'mismatch' | 'unavailable' | 'malformed' | 'unsupported';

export interface NetworkIdentity {
  readonly network: NetworkName;
  readonly networkType: number;
  readonly generationHashSeed: string;
  readonly epochAdjustmentSeconds: bigint;
}

export interface ObservedNetworkIdentity {
  readonly networkType: unknown;
  readonly generationHashSeed: unknown;
  readonly epochAdjustment: unknown;
}

export function parseEpochAdjustment(value: unknown): bigint | undefined {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).replace(/s$/, '');
  if (!/^\d+$/.test(normalized)) return undefined;
  try {
    return BigInt(normalized);
  } catch {
    return undefined;
  }
}

export function compareNetworkIdentity(
  expected: NetworkIdentity | undefined,
  observed: ObservedNetworkIdentity | undefined
): NetworkIdentityStatus {
  if (!observed) return 'unavailable';
  if (!expected) return 'unsupported';

  if (
    !Number.isInteger(observed.networkType) ||
    typeof observed.generationHashSeed !== 'string' ||
    (typeof observed.epochAdjustment !== 'string' && typeof observed.epochAdjustment !== 'number')
  ) {
    return 'malformed';
  }

  const seed = observed.generationHashSeed.toUpperCase();
  const epoch = parseEpochAdjustment(observed.epochAdjustment);
  if (!/^[0-9A-F]{64}$/.test(seed) || epoch === undefined) return 'malformed';
  if (observed.networkType !== 0x68 && observed.networkType !== 0x98) return 'unsupported';

  return observed.networkType === expected.networkType &&
    seed === expected.generationHashSeed &&
    epoch === expected.epochAdjustmentSeconds
    ? 'match'
    : 'mismatch';
}

export function requireNetworkMatch(
  expected: NetworkIdentity | undefined,
  observed: ObservedNetworkIdentity | undefined
): Result<NetworkName> {
  const status = compareNetworkIdentity(expected, observed);
  if (status === 'match' && expected) return success(expected.network);
  if (status === 'mismatch') return failure({ code: 'wrong-network', retryable: false });
  if (status === 'unsupported') return failure({ code: 'unsupported-network', retryable: false });
  return failure({ code: 'network-identity-unavailable', retryable: true });
}
