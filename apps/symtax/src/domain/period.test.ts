import { describe, expect, it } from 'vitest';

import { currentJstMonthPeriod, jstDateAt, todayJstPeriod, validatePeriod } from './period';

describe('JST period contract', () => {
  it('converts calendar boundaries to JST instants and clips the end at request time', () => {
    const now = new Date('2026-09-25T02:34:56.123Z');
    expect(validatePeriod({ fromDate: '2026-09-24', toDateExclusive: '2026-09-26' }, now)).toMatchObject({
      ok: true,
      value: {
        fromInstant: '2026-09-23T15:00:00.000Z',
        calendarEndInstant: '2026-09-25T15:00:00.000Z',
        effectiveEndInstant: '2026-09-25T02:34:56.123Z',
      },
    });
  });

  it('accepts today and the current month but rejects a future-only period', () => {
    const now = new Date('2026-09-25T02:34:56.123Z');
    expect(todayJstPeriod(now)).toEqual({ fromDate: '2026-09-25', toDateExclusive: '2026-09-26' });
    expect(currentJstMonthPeriod(now)).toEqual({ fromDate: '2026-09-01', toDateExclusive: '2026-10-01' });
    expect(validatePeriod(todayJstPeriod(now), now).ok).toBe(true);
    expect(validatePeriod({ fromDate: '2026-09-26', toDateExclusive: '2026-09-27' }, now)).toMatchObject({
      ok: false,
      error: { code: 'future-period' },
    });
  });

  it('rejects invalid dates and non-increasing ranges, and derives calendar dates in JST', () => {
    const now = new Date('2026-09-25T02:34:56.123Z');
    expect(validatePeriod({ fromDate: '2026-02-30', toDateExclusive: '2026-03-01' }, now)).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
    expect(validatePeriod({ fromDate: '2026-09-25', toDateExclusive: '2026-09-25' }, now)).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
    expect(jstDateAt(new Date('2026-09-24T15:00:00.000Z'))).toBe('2026-09-25');
  });
});
