import { validateSymbolAddress } from '@/domain/address';
import type { NetworkName } from '@/domain/network';
import {
  type ContinuationPayload,
  type PageBinding,
  type RecordCategory,
  decodeContinuation,
  validatePageSize,
} from '@/domain/pagination';
import { validatePeriod } from '@/domain/period';
import { type Result, failure, success } from '@/domain/result';
import 'server-only';

export interface BrowseRequestInput {
  readonly address?: unknown;
  readonly fromDate?: unknown;
  readonly toDateExclusive?: unknown;
  readonly category?: unknown;
  readonly pageSize?: unknown;
  readonly continuation?: unknown;
}

export interface ValidatedBrowseRequest {
  readonly binding: PageBinding;
  readonly fromInstant: string;
  readonly calendarEndInstant: string;
  readonly effectiveEndInstant: string;
  readonly requestNow: string;
  readonly continuation?: ContinuationPayload;
}

export function validateBrowseRequest(
  input: BrowseRequestInput,
  network: NetworkName,
  now: Date
): Result<ValidatedBrowseRequest> {
  if (input.category !== 'transactions' && input.category !== 'receipts') {
    return failure({ code: 'invalid-input', retryable: false });
  }
  const address = validateSymbolAddress(input.address, network);
  if (!address.ok) return address;
  const period = validatePeriod({ fromDate: input.fromDate, toDateExclusive: input.toDateExclusive }, now);
  if (!period.ok) return period;
  const pageSize = validatePageSize(input.pageSize);
  if (!pageSize.ok) return pageSize;

  const binding: PageBinding = {
    network,
    address: address.value.value,
    category: input.category as RecordCategory,
    fromDate: period.value.fromDate,
    toDateExclusive: period.value.toDateExclusive,
    pageSize: pageSize.value,
  };
  let continuation: ValidatedBrowseRequest['continuation'];
  if (input.continuation !== undefined) {
    const decoded = decodeContinuation(input.continuation, binding);
    if (!decoded.ok) return decoded;
    continuation = decoded.value;
  }

  return success({
    binding,
    fromInstant: period.value.fromInstant,
    calendarEndInstant: period.value.calendarEndInstant,
    effectiveEndInstant: period.value.effectiveEndInstant,
    requestNow: period.value.requestNow,
    continuation,
  });
}
