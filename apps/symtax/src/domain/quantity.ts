import { type Result, failure, success } from './result';

declare const nativeAmountBrand: unique symbol;
declare const decimalBrand: unique symbol;

export type NativeAmount = string & { readonly [nativeAmountBrand]: true };
export type DecimalString = string & { readonly [decimalBrand]: true };

const UINT64_MAX = 18_446_744_073_709_551_615n;

export function parseNativeAmount(value: unknown): Result<NativeAmount> {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  const normalized = value.replace(/^0+(?=\d)/, '');
  try {
    if (BigInt(normalized) > UINT64_MAX) return failure({ code: 'invalid-input', retryable: false });
  } catch {
    return failure({ code: 'invalid-input', retryable: false });
  }
  return success(normalized as NativeAmount);
}

export function parseDecimalString(value: unknown): Result<DecimalString> {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  return success(value as DecimalString);
}

export function nativeAmountToDisplay(amount: NativeAmount): DecimalString {
  const divisibility = 6;
  const digits = amount.padStart(divisibility + 1, '0');
  const integer = digits.slice(0, -divisibility);
  const fractional = digits.slice(-divisibility).replace(/0+$/, '');
  return `${integer}${fractional ? `.${fractional}` : ''}` as DecimalString;
}

export function serializeNativeAmount(amount: NativeAmount): string {
  return amount;
}
