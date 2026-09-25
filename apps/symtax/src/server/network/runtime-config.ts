import { type NetworkIdentity, type NetworkName } from '@/domain/network';
import 'server-only';

export type RuntimeConfigurationError = { readonly code: 'missing' | 'malformed' | 'unsupported' | 'inconsistent' };
export type RuntimeConfigurationResult =
  | { readonly ok: true; readonly value: NetworkIdentity }
  | { readonly ok: false; readonly error: RuntimeConfigurationError };

const fail = (code: RuntimeConfigurationError['code']): RuntimeConfigurationResult => ({
  ok: false,
  error: { code },
});

const EXPECTED_ENV: Readonly<Record<NetworkName, Omit<NetworkIdentity, 'network'>>> = {
  mainnet: {
    networkType: 0x68,
    generationHashSeed: '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
    epochAdjustmentSeconds: 1615853185n,
  },
  testnet: {
    networkType: 0x98,
    generationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
    epochAdjustmentSeconds: 1616694977n,
  },
};

function parseUnsignedInteger(value: string): bigint | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

export function parseRuntimeNetworkConfiguration(
  env: Readonly<Record<string, string | undefined>>
): RuntimeConfigurationResult {
  const networkValue = env.SYMTAX_EXPECTED_NETWORK;
  const networkTypeValue = env.SYMTAX_EXPECTED_NETWORK_TYPE;
  const seedValue = env.SYMTAX_EXPECTED_GENERATION_HASH_SEED;
  const epochValue = env.SYMTAX_EXPECTED_EPOCH_ADJUSTMENT_SECONDS;

  if (!networkValue || !networkTypeValue || !seedValue || !epochValue) {
    return fail('missing');
  }
  if (networkValue !== 'mainnet' && networkValue !== 'testnet') {
    return fail('unsupported');
  }

  const networkType = parseUnsignedInteger(networkTypeValue);
  const epochAdjustmentSeconds = parseUnsignedInteger(epochValue);
  const generationHashSeed = seedValue.toUpperCase();
  if (networkType === undefined || epochAdjustmentSeconds === undefined || !/^[0-9A-F]{64}$/.test(generationHashSeed)) {
    return fail('malformed');
  }

  const network = networkValue;
  const configured = { network, networkType: Number(networkType), generationHashSeed, epochAdjustmentSeconds };
  const pinned = EXPECTED_ENV[network];
  if (
    configured.networkType !== pinned.networkType ||
    configured.generationHashSeed !== pinned.generationHashSeed ||
    configured.epochAdjustmentSeconds !== pinned.epochAdjustmentSeconds
  ) {
    return fail('inconsistent');
  }

  return {
    ok: true,
    value: {
      network,
      networkType: pinned.networkType,
      generationHashSeed: pinned.generationHashSeed,
      epochAdjustmentSeconds: pinned.epochAdjustmentSeconds,
    },
  };
}

export function getRuntimeNetworkConfiguration(): RuntimeConfigurationResult {
  return parseRuntimeNetworkConfiguration(process.env);
}
