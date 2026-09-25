import { type Result, failure, success } from './result';

export function symbolTimestampToUnixMilliseconds(
  timestampMilliseconds: string,
  epochAdjustmentSeconds: bigint
): Result<string> {
  if (!/^(0|[1-9]\d*)$/.test(timestampMilliseconds) || epochAdjustmentSeconds < 0n) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  const unixMilliseconds = BigInt(timestampMilliseconds) + epochAdjustmentSeconds * 1000n;
  const maxDateMilliseconds = 8_640_000_000_000_000n;
  if (unixMilliseconds > maxDateMilliseconds) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  return success(unixMilliseconds.toString());
}

export function unixMillisecondsToIsoInstant(unixMilliseconds: string): Result<string> {
  if (!/^(0|[1-9]\d*)$/.test(unixMilliseconds)) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  const milliseconds = BigInt(unixMilliseconds);
  if (milliseconds > 8_640_000_000_000_000n) {
    return failure({ code: 'invalid-input', retryable: false });
  }
  return success(new Date(Number(milliseconds)).toISOString());
}
