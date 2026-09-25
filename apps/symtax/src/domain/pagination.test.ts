import { describe, expect, it } from 'vitest';

import {
  type ContinuationPayload,
  type PageBinding,
  decodeContinuation,
  encodeContinuation,
  validatePageSize,
} from './pagination';

const binding: PageBinding = {
  network: 'mainnet',
  address: 'ND6JFGH64RIDEQC3HQUEW2CIO7PGWRJD4KMTARQ',
  category: 'transactions',
  fromDate: '2026-01-01',
  toDateExclusive: '2026-02-01',
  pageSize: 100,
};

const payload: ContinuationPayload = {
  version: 1,
  binding,
  orderVersion: 'symbol-history-order-1',
  snapshotTip: { height: '12345', hash: 'AB'.repeat(32) },
  lastKey: ['12345', '4', '-1', 'CD'.repeat(32)],
};

describe('keyset pagination contract', () => {
  it('uses the specified default and maximum page size', () => {
    expect(validatePageSize(undefined)).toMatchObject({ ok: true, value: 100 });
    expect(validatePageSize(1)).toMatchObject({ ok: true, value: 1 });
    expect(validatePageSize(100)).toMatchObject({ ok: true, value: 100 });
    expect(validatePageSize(101).ok).toBe(false);
    expect(validatePageSize(1.5).ok).toBe(false);
  });

  it('round-trips a stable continuation and binds it to all query conditions', () => {
    const token = encodeContinuation(payload);
    expect(decodeContinuation(token, binding)).toMatchObject({ ok: true, value: payload });
    expect(decodeContinuation(token, { ...binding, address: 'TAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPNG6Y' })).toMatchObject(
      { ok: false, error: { code: 'invalid-continuation' } }
    );
    expect(decodeContinuation(token, { ...binding, network: 'testnet' })).toMatchObject({
      ok: false,
      error: { code: 'invalid-continuation' },
    });
    expect(decodeContinuation(token, { ...binding, toDateExclusive: '2026-03-01' })).toMatchObject({
      ok: false,
      error: { code: 'invalid-continuation' },
    });
  });

  it('rejects malformed and non-canonical tokens', () => {
    expect(decodeContinuation('not-a-cursor', binding)).toMatchObject({
      ok: false,
      error: { code: 'invalid-continuation' },
    });
    const token = encodeContinuation(payload);
    expect(decodeContinuation(`${token}=`, binding)).toMatchObject({
      ok: false,
      error: { code: 'invalid-continuation' },
    });
  });
});
