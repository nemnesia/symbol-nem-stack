import { describe, expect, it } from 'vitest';

import { parseRuntimeNetworkConfiguration } from './runtime-config';

const mainnetEnv = {
  SYMTAX_EXPECTED_NETWORK: 'mainnet',
  SYMTAX_EXPECTED_NETWORK_TYPE: '104',
  SYMTAX_EXPECTED_GENERATION_HASH_SEED: '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
  SYMTAX_EXPECTED_EPOCH_ADJUSTMENT_SECONDS: '1615853185',
};

describe('server runtime network configuration', () => {
  it('accepts a complete pinned Mainnet configuration', () => {
    expect(parseRuntimeNetworkConfiguration(mainnetEnv)).toMatchObject({ ok: true, value: { network: 'mainnet' } });
  });

  it('rejects missing, malformed, unsupported and inconsistent settings', () => {
    expect(parseRuntimeNetworkConfiguration({})).toMatchObject({ ok: false, error: { code: 'missing' } });
    expect(
      parseRuntimeNetworkConfiguration({ ...mainnetEnv, SYMTAX_EXPECTED_NETWORK_TYPE: 'not-a-number' })
    ).toMatchObject({ ok: false, error: { code: 'malformed' } });
    expect(parseRuntimeNetworkConfiguration({ ...mainnetEnv, SYMTAX_EXPECTED_NETWORK: 'private' })).toMatchObject({
      ok: false,
      error: { code: 'unsupported' },
    });
    expect(parseRuntimeNetworkConfiguration({ ...mainnetEnv, SYMTAX_EXPECTED_NETWORK_TYPE: '152' })).toMatchObject({
      ok: false,
      error: { code: 'inconsistent' },
    });
  });
});
