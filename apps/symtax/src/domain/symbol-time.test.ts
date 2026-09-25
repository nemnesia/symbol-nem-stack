import { describe, expect, it } from 'vitest';

import { symbolTimestampToUnixMilliseconds, unixMillisecondsToIsoInstant } from './symbol-time';

describe('Symbol epoch time contract', () => {
  it('converts network milliseconds with the network-specific epoch adjustment using integers', () => {
    expect(symbolTimestampToUnixMilliseconds('0', 1615853185n)).toMatchObject({ ok: true, value: '1615853185000' });
    expect(symbolTimestampToUnixMilliseconds('1001', 1616694977n)).toMatchObject({ ok: true, value: '1616694978001' });
    expect(unixMillisecondsToIsoInstant('1615853185000')).toMatchObject({
      ok: true,
      value: '2021-03-16T00:06:25.000Z',
    });
  });

  it('rejects negative, non-integer and out-of-range timestamps', () => {
    expect(symbolTimestampToUnixMilliseconds('-1', 0n).ok).toBe(false);
    expect(symbolTimestampToUnixMilliseconds('1.5', 0n).ok).toBe(false);
    expect(unixMillisecondsToIsoInstant('8640000000000001').ok).toBe(false);
  });
});
