import { describe, expect, it } from 'vitest';

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { decompress } from '../src/internal/codec.js';
import { loadFixtures } from './fixture-loader.js';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../doc/fixtures');
const assertIndependentlyInflated = (stream: string, plaintextBytes: number, plaintextSha256: string): void => {
  const plaintext = new Uint8Array(inflateSync(Buffer.from(stream, 'hex')));
  expect(plaintext).toHaveLength(plaintextBytes);
  expect(createHash('sha256').update(plaintext).digest('hex').toUpperCase()).toBe(plaintextSha256);
};

describe('zlib Phase 1 fixture', () => {
  it('accepts 16 MiB and rejects 16 MiB plus one before payload decoding', async () => {
    const loaded = await loadFixtures(fixtures);
    const fixture = loaded.find((item) => item.entry.id === 'zlib-profile-v1')!.data as {
      cases: Array<{
        id: string;
        input: { stream: string };
        expected: { plaintextBytes?: number; plaintextSha256?: string; error?: string };
      }>;
    };
    const limit = fixture.cases.find(({ id }) => 'limit-16mib' === id)!;
    assertIndependentlyInflated(limit.input.stream, limit.expected.plaintextBytes!, limit.expected.plaintextSha256!);
    const limitPlaintext = decompress(Uint8Array.from(Buffer.from(limit.input.stream, 'hex')));
    expect(limitPlaintext).toHaveLength(limit.expected.plaintextBytes!);
    expect(createHash('sha256').update(limitPlaintext).digest('hex').toUpperCase()).toBe(
      limit.expected.plaintextSha256
    );

    const overflow = fixture.cases.find(({ id }) => 'limit-16mib-plus-one' === id)!;
    expect(new Uint8Array(inflateSync(Buffer.from(overflow.input.stream, 'hex')))).toHaveLength(16 * 1024 * 1024 + 1);
    expect(() => decompress(Uint8Array.from(Buffer.from(overflow.input.stream, 'hex')))).toThrowError(
      expect.objectContaining({ code: overflow.expected.error })
    );
  });
});
