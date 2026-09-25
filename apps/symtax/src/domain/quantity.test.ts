import { describe, expect, it } from 'vitest';

import { nativeAmountToDisplay, parseDecimalString, parseNativeAmount, serializeNativeAmount } from './quantity';

describe('exact quantity and decimal contract', () => {
  it('keeps uint64 quantities exact, including values above Number.MAX_SAFE_INTEGER', () => {
    const parsed = parseNativeAmount('18446744073709551615');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(serializeNativeAmount(parsed.value)).toBe('18446744073709551615');
      expect(nativeAmountToDisplay(parsed.value)).toBe('18446744073709.551615');
    }
    expect(parseNativeAmount('18446744073709551616').ok).toBe(false);
    expect(parseNativeAmount('-1').ok).toBe(false);
    const zero = parseNativeAmount('000000');
    expect(zero.ok && serializeNativeAmount(zero.value)).toBe('0');
  });

  it('accepts exact decimal strings without floating-point conversion', () => {
    expect(parseDecimalString('12345678901234567890.123456789012345')).toMatchObject({ ok: true });
    expect(parseDecimalString('1e-8').ok).toBe(false);
    expect(parseDecimalString('NaN').ok).toBe(false);
    expect(parseDecimalString('Infinity').ok).toBe(false);
  });
});
