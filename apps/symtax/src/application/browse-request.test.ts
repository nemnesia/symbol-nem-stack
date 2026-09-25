import { describe, expect, it } from 'vitest';

import { validateBrowseRequest } from './browse-request';

describe('Browser-to-Server browse request contract', () => {
  it('returns only a normalized valid request contract', () => {
    expect(
      validateBrowseRequest(
        {
          address: 'ND6JFGH64RIDEQC3HQUEW2CIO7PGWRJD4KMTARQ',
          fromDate: '2026-09-01',
          toDateExclusive: '2026-10-01',
          category: 'receipts',
        },
        'mainnet',
        new Date('2026-09-25T02:00:00.000Z')
      )
    ).toMatchObject({
      ok: true,
      value: { binding: { network: 'mainnet', category: 'receipts', pageSize: 100 } },
    });
  });

  it('stops before downstream work for invalid address or period', () => {
    expect(
      validateBrowseRequest(
        { address: 'invalid', fromDate: '2026-09-01', toDateExclusive: '2026-10-01', category: 'receipts' },
        'mainnet',
        new Date()
      )
    ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
    expect(
      validateBrowseRequest(
        {
          address: 'ND6JFGH64RIDEQC3HQUEW2CIO7PGWRJD4KMTARQ',
          fromDate: '2026-10-01',
          toDateExclusive: '2026-10-02',
          category: 'receipts',
        },
        'mainnet',
        new Date('2026-09-25T00:00:00.000Z')
      )
    ).toMatchObject({ ok: false, error: { code: 'future-period' } });
  });
});
