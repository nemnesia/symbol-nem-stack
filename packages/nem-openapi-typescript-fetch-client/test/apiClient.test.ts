import { describe, expect, it, vi } from 'vitest';

import {
  AccountApi,
  BlockApi,
  ChainApi,
  Configuration,
  DebugApi,
  HeartbeatApi,
  LocalApi,
  NamespaceApi,
  NodeApi,
  ResponseError,
  StatusApi,
  TransactionApi,
} from '../src/index.js';

describe('NEM NIS API client', () => {
  it('loads all generated API classes through the ESM entrypoint', () => {
    expect([
      AccountApi,
      BlockApi,
      ChainApi,
      DebugApi,
      HeartbeatApi,
      LocalApi,
      NamespaceApi,
      NodeApi,
      StatusApi,
      TransactionApi,
    ]).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('uses the configured fetch implementation and converts a JSON response', async () => {
    const fetchApi: typeof fetch = vi.fn(async (input, init) => {
      expect(input).toBe('https://example.test/heartbeat');
      expect(init?.method).toBe('GET');

      return new Response(JSON.stringify({ code: 1, type: 2, message: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    });
    const api = new HeartbeatApi(
      new Configuration({
        basePath: 'https://example.test',
        fetchApi,
      })
    );

    await expect(api.getHeartbeat()).resolves.toEqual({
      code: 1,
      type: 2,
      message: 'ok',
    });
    expect(fetchApi).toHaveBeenCalledOnce();
  });

  it('throws ResponseError when the NIS node returns a non-2xx response', async () => {
    const fetchApi: typeof fetch = vi.fn(async () => new Response(null, { status: 500 }));
    const api = new HeartbeatApi(new Configuration({ basePath: 'https://example.test', fetchApi }));

    await expect(api.getHeartbeat()).rejects.toBeInstanceOf(ResponseError);
  });
});
