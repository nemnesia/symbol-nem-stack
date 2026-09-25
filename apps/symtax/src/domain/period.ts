import { type Result, failure, success } from './result';

export const TIME_ZONE = 'Asia/Tokyo';
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DatePeriodInput {
  readonly fromDate: unknown;
  readonly toDateExclusive: unknown;
}

export interface ValidatedPeriod {
  readonly fromDate: string;
  readonly toDateExclusive: string;
  readonly fromInstant: string;
  readonly calendarEndInstant: string;
  readonly effectiveEndInstant: string;
  readonly requestNow: string;
}

function parseDate(value: unknown): { normalized: string; utcMidnightMs: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const match = DATE_PATTERN.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }

  return { normalized: value, utcMidnightMs: date.getTime() };
}

function instant(ms: number): string {
  return new Date(ms).toISOString();
}

export function validatePeriod(input: DatePeriodInput, requestNow: Date): Result<ValidatedPeriod> {
  const from = parseDate(input.fromDate);
  const to = parseDate(input.toDateExclusive);
  if (!from || !to || !Number.isFinite(requestNow.getTime())) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  if (from.normalized >= to.normalized) return failure({ code: 'invalid-input', retryable: false });

  const fromMs = from.utcMidnightMs - JST_OFFSET_MS;
  const endMs = to.utcMidnightMs - JST_OFFSET_MS;
  const nowMs = requestNow.getTime();
  const effectiveEndMs = Math.min(endMs, nowMs);
  if (effectiveEndMs <= fromMs) return failure({ code: 'future-period', retryable: false });

  return success({
    fromDate: from.normalized,
    toDateExclusive: to.normalized,
    fromInstant: instant(fromMs),
    calendarEndInstant: instant(endMs),
    effectiveEndInstant: instant(effectiveEndMs),
    requestNow: instant(nowMs),
  });
}

export function jstDateAt(instantValue: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instantValue);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function currentJstMonthPeriod(now: Date): DatePeriodInput {
  const today = jstDateAt(now);
  const [year, month] = today.split('-').map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { fromDate: `${today.slice(0, 7)}-01`, toDateExclusive: nextMonth };
}

export function todayJstPeriod(now: Date): DatePeriodInput {
  const today = jstDateAt(now);
  const parsed = parseDate(today);
  if (!parsed) throw new Error('Current JST date is invalid');
  const next = instant(parsed.utcMidnightMs + 24 * 60 * 60 * 1000).slice(0, 10);
  return { fromDate: today, toDateExclusive: next };
}
