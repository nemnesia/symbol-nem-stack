import 'server-only';

import type { NetworkName } from './network';
import { type Result, failure, success } from './result';

export type RecordCategory = 'transactions' | 'receipts';
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 100;
export const ORDER_VERSION = 'symbol-history-order-1';
export const ORDERING = {
  transactions: [
    { field: 'blockHeight', direction: 'descending' },
    { field: 'transactionIndex', direction: 'descending' },
    { field: 'embeddedIndex', direction: 'descending', outerSentinel: '-1' },
    { field: 'transactionIdentity', direction: 'descending' },
  ],
  receipts: [
    { field: 'blockHeight', direction: 'descending' },
    { field: 'statementKind', direction: 'descending' },
    { field: 'sourcePrimaryId', direction: 'descending' },
    { field: 'sourceSecondaryId', direction: 'descending' },
    { field: 'receiptIndex', direction: 'descending' },
    { field: 'receiptIdentity', direction: 'descending' },
  ],
} as const;
export interface PageBinding {
  readonly network: NetworkName;
  readonly address: string;
  readonly category: RecordCategory;
  readonly fromDate: string;
  readonly toDateExclusive: string;
  readonly pageSize: number;
}

export interface ContinuationPayload {
  readonly version: 1;
  readonly binding: PageBinding;
  readonly orderVersion: typeof ORDER_VERSION;
  readonly snapshotTip: { readonly height: string; readonly hash: string };
  readonly lastKey: readonly string[];
}

function isUnsignedInteger(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validatePageSize(value: unknown): Result<number> {
  const pageSize = value === undefined ? DEFAULT_PAGE_SIZE : value;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > MAX_PAGE_SIZE) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  return success(pageSize as number);
}

export function encodeContinuation(payload: ContinuationPayload): string {
  const canonical = {
    version: payload.version,
    binding: {
      network: payload.binding.network,
      address: payload.binding.address,
      category: payload.binding.category,
      fromDate: payload.binding.fromDate,
      toDateExclusive: payload.binding.toDateExclusive,
      pageSize: payload.binding.pageSize,
    },
    orderVersion: payload.orderVersion,
    snapshotTip: { height: payload.snapshotTip.height, hash: payload.snapshotTip.hash },
    lastKey: [...payload.lastKey],
  };
  return Buffer.from(JSON.stringify(canonical), 'utf8').toString('base64url');
}

export function decodeContinuation(token: unknown, expectedBinding: PageBinding): Result<ContinuationPayload> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return failure({ code: 'invalid-continuation', retryable: false });
  }

  if (Buffer.from(token, 'base64url').toString('base64url') !== token) {
    return failure({ code: 'invalid-continuation', retryable: false });
  }

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;
  } catch {
    return failure({ code: 'invalid-continuation', retryable: false });
  }
  if (!isPlainObject(value) || !isPlainObject(value.binding) || !isPlainObject(value.snapshotTip)) {
    return failure({ code: 'invalid-continuation', retryable: false });
  }

  const binding = value.binding;
  const snapshotTip = value.snapshotTip;
  const lastKey = value.lastKey;
  if (
    value.version !== 1 ||
    value.orderVersion !== ORDER_VERSION ||
    typeof binding.network !== 'string' ||
    typeof binding.address !== 'string' ||
    typeof binding.category !== 'string' ||
    typeof binding.fromDate !== 'string' ||
    typeof binding.toDateExclusive !== 'string' ||
    !Number.isInteger(binding.pageSize) ||
    !isUnsignedInteger(snapshotTip.height) ||
    typeof snapshotTip.hash !== 'string' ||
    !Array.isArray(lastKey) ||
    lastKey.length !== (binding.category === 'transactions' ? 4 : 6) ||
    !lastKey.every((part) => typeof part === 'string' && part.length <= 128)
  ) {
    return failure({ code: 'invalid-continuation', retryable: false });
  }

  const keyParts = lastKey as string[];
  const safeText = (part: string) => /^[A-Za-z0-9_.:-]+$/.test(part);
  const validOrderingKey =
    binding.category === 'transactions'
      ? isUnsignedInteger(keyParts[0]) &&
        isUnsignedInteger(keyParts[1]) &&
        (keyParts[2] === '-1' || isUnsignedInteger(keyParts[2])) &&
        safeText(keyParts[3])
      : isUnsignedInteger(keyParts[0]) &&
        safeText(keyParts[1]) &&
        isUnsignedInteger(keyParts[2]) &&
        isUnsignedInteger(keyParts[3]) &&
        isUnsignedInteger(keyParts[4]) &&
        safeText(keyParts[5]);
  if (!validOrderingKey || !/^[0-9A-Fa-f]{64}$/.test(snapshotTip.hash)) {
    return failure({ code: 'invalid-continuation', retryable: false });
  }

  const actualBinding: PageBinding = {
    network: binding.network as NetworkName,
    address: binding.address,
    category: binding.category as RecordCategory,
    fromDate: binding.fromDate,
    toDateExclusive: binding.toDateExclusive,
    pageSize: binding.pageSize as number,
  };
  if (
    actualBinding.network !== expectedBinding.network ||
    actualBinding.address !== expectedBinding.address ||
    actualBinding.category !== expectedBinding.category ||
    actualBinding.fromDate !== expectedBinding.fromDate ||
    actualBinding.toDateExclusive !== expectedBinding.toDateExclusive ||
    actualBinding.pageSize !== expectedBinding.pageSize
  ) {
    return failure({ code: 'invalid-continuation', retryable: false });
  }

  return success({
    version: 1,
    binding: actualBinding,
    orderVersion: ORDER_VERSION,
    snapshotTip: { height: snapshotTip.height, hash: snapshotTip.hash },
    lastKey: lastKey as string[],
  });
}
