import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import type { NetworkName } from './network';
import { type Result, failure, success } from './result';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PLAIN_ADDRESS = /^[A-Z2-7]{39}$/;
const PRETTY_ADDRESS = /^[A-Z2-7]{6}(?:-[A-Z2-7]{6}){5}-[A-Z2-7]{3}$/;

export interface NormalizedAddress {
  readonly value: string;
  readonly network: NetworkName;
}

function decodeAddress(value: string): Uint8Array | undefined {
  let accumulator = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const char of value) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return undefined;
    accumulator = (accumulator << 5) | digit;
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((accumulator >> bitCount) & 0xff);
      accumulator &= (1 << bitCount) - 1;
    }
  }

  if (bitCount !== 3 || accumulator !== 0 || bytes.length !== 24) return undefined;
  return Uint8Array.from(bytes);
}

function hasValidChecksum(bytes: Uint8Array): boolean {
  const expected = createHash('sha3-256').update(bytes.subarray(0, 21)).digest().subarray(0, 3);
  const actual = Buffer.from(bytes.subarray(21));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function unsupportedAddressFormat(value: string): boolean {
  return /^[0-9A-F]{16}$/.test(value) || /^[0-9A-F]{48}$/.test(value) || /^[A-Z2-7]{40}$/.test(value);
}

function trimAsciiWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  const isWhitespace = (code: number) => (code >= 0x09 && code <= 0x0d) || code === 0x20;
  while (start < end && isWhitespace(value.charCodeAt(start))) start += 1;
  while (end > start && isWhitespace(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

export function validateSymbolAddress(input: unknown, expectedNetwork: NetworkName): Result<NormalizedAddress> {
  if (typeof input !== 'string') return failure({ code: 'invalid-input', retryable: false });
  const trimmed = trimAsciiWhitespace(input);
  const uppercase = trimmed.toUpperCase();
  if (unsupportedAddressFormat(uppercase)) return failure({ code: 'unsupported-input', retryable: false });

  const plain = PLAIN_ADDRESS.test(uppercase)
    ? uppercase
    : PRETTY_ADDRESS.test(uppercase)
      ? uppercase.replaceAll('-', '')
      : undefined;
  if (!plain) return failure({ code: 'invalid-input', retryable: false });

  const bytes = decodeAddress(plain);
  if (!bytes || !hasValidChecksum(bytes)) return failure({ code: 'invalid-input', retryable: false });

  const networkByte = bytes[0];
  const actualNetwork = networkByte === 0x68 ? 'mainnet' : networkByte === 0x98 ? 'testnet' : undefined;
  if (!actualNetwork) return failure({ code: 'unsupported-input', retryable: false });
  if (actualNetwork !== expectedNetwork) return failure({ code: 'wrong-network', retryable: false });

  return success({ value: plain, network: actualNetwork });
}
