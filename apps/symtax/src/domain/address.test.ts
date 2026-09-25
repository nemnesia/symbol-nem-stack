import { describe, expect, it } from 'vitest';

import { validateSymbolAddress } from './address';

const MAINNET_ADDRESS = 'ND6JFGH64RIDEQC3HQUEW2CIO7PGWRJD4KMTARQ';
const TESTNET_ADDRESS = 'TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPNG6Y';

describe('Symbol address contract', () => {
  it('normalizes valid plain, pretty, lowercase and whitespace-wrapped address forms', () => {
    expect(validateSymbolAddress(MAINNET_ADDRESS, 'mainnet')).toMatchObject({
      ok: true,
      value: { value: MAINNET_ADDRESS, network: 'mainnet' },
    });
    const pretty = MAINNET_ADDRESS.match(/.{1,6}/g)?.join('-');
    expect(validateSymbolAddress(`  ${pretty?.toLowerCase()}\n`, 'mainnet')).toMatchObject({
      ok: true,
      value: { value: MAINNET_ADDRESS },
    });
    expect(validateSymbolAddress(TESTNET_ADDRESS, 'testnet')).toMatchObject({
      ok: true,
      value: { network: 'testnet' },
    });
  });

  it('rejects checksum failures, malformed values and wrong-network addresses distinctly', () => {
    expect(validateSymbolAddress(`${MAINNET_ADDRESS.slice(0, -1)}A`, 'mainnet')).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
    expect(validateSymbolAddress('N'.repeat(39), 'mainnet')).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
    expect(validateSymbolAddress('', 'mainnet')).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
    expect(validateSymbolAddress(TESTNET_ADDRESS, 'mainnet')).toMatchObject({
      ok: false,
      error: { code: 'wrong-network' },
    });
  });

  it('rejects unsupported representations', () => {
    expect(validateSymbolAddress('A'.repeat(48), 'mainnet')).toMatchObject({
      ok: false,
      error: { code: 'unsupported-input' },
    });
    expect(validateSymbolAddress('1'.repeat(16), 'mainnet')).toMatchObject({
      ok: false,
      error: { code: 'unsupported-input' },
    });
    expect(validateSymbolAddress('N'.repeat(40), 'mainnet')).toMatchObject({
      ok: false,
      error: { code: 'unsupported-input' },
    });
  });
});
