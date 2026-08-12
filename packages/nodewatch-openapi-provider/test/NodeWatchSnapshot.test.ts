import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNemNodeWatchSnapshot, fetchSymbolNodeWatchSnapshot } from '../src/NodeWatchSnapshot.js';

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function nodeResponse(
  endpoint = 'https://node.example.com',
  height = 100,
  finalizedHeight = height
): Record<string, unknown> {
  return {
    mainPublicKey: 'a'.repeat(64),
    endpoint,
    name: 'node',
    version: '1.0.0',
    height,
    finalizedHeight,
    balance: 0,
  };
}

describe('NodeWatch snapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SymbolのheightとNode一覧を同じURLから取得する', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/symbol/height')) {
        return Promise.resolve(jsonResponse({ height: 100, finalizedHeight: 99 }));
      }
      return Promise.resolve(
        jsonResponse([{ endpoint: '' }, { endpoint: '  ' }, nodeResponse('https://valid.example.com')])
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://symbol.example.com']);

    expect(result.heightInfo).toEqual({ height: 100, finalizedHeight: 99 });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].endpoint).toBe('https://valid.example.com');
    expect(fetchMock).toHaveBeenCalledWith('https://symbol.example.com/api/symbol/height', expect.anything());
    expect(fetchMock).toHaveBeenCalledWith('https://symbol.example.com/api/symbol/nodes/peer', expect.anything());
  });

  it('Nodeのheight 0またはfinalizedHeight 0を除外する', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/symbol/height')) {
        return Promise.resolve(jsonResponse({ height: 100, finalizedHeight: 99 }));
      }
      return Promise.resolve(
        jsonResponse([
          nodeResponse('https://unsynced.example.com', 0, 0),
          nodeResponse('https://valid.example.com', 1, 1),
        ])
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://symbol.example.com']);

    expect(result.heightInfo.height).toBe(100);
    expect(result.nodes[0].endpoint).toBe('https://valid.example.com');
    expect(result.nodes).toHaveLength(1);
  });

  it('全Nodeのheight 0またはfinalizedHeight 0の場合は空一覧を返す', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/symbol/height')) {
        return Promise.resolve(jsonResponse({ height: 100, finalizedHeight: 99 }));
      }
      return Promise.resolve(jsonResponse([nodeResponse('https://unsynced.example.com', 0, 0)]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://symbol.example.com']);

    expect(result.nodes).toEqual([]);
  });

  it('heightまたはNode一覧の失敗時はURL組全体をfailoverする', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const origin = new URL(url).origin;
      if (origin === 'https://first.example.com') {
        return Promise.reject(new Error('first endpoint failed'));
      }
      if (url.endsWith('/api/symbol/height')) {
        return Promise.resolve(jsonResponse({ height: 200, finalizedHeight: 200 }));
      }
      return Promise.resolve(jsonResponse([nodeResponse('https://second-node.example.com')]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com']);

    expect(result.heightInfo.height).toBe(200);
    expect(result.nodes.map((node) => node.endpoint)).toEqual(['https://second-node.example.com']);
    expect(
      fetchMock.mock.calls.filter(([input]) => {
        const parsed = new URL(String(input));
        return parsed.protocol === 'https:' && parsed.hostname === 'first.example.com';
      })
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([input]) => {
        const parsed = new URL(String(input));
        return parsed.protocol === 'https:' && parsed.hostname === 'second.example.com';
      })
    ).toHaveLength(2);
  });

  it('NEMのheightとNode一覧を取得しAbortSignalを転送する', async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal;
      return Promise.resolve(jsonResponse([nodeResponse('https://nem-node.example.com')]));
    });
    fetchMock.mockImplementationOnce((_input, init) => {
      receivedSignal = init?.signal;
      return Promise.resolve(jsonResponse({ height: 300, finalizedHeight: 299 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNemNodeWatchSnapshot(['https://nem.example.com'], { signal: controller.signal });

    expect(result.heightInfo).toEqual({ height: 300, finalizedHeight: 299 });
    expect(result.nodes[0].endpoint).toBe('https://nem-node.example.com');
    expect(receivedSignal).toBe(controller.signal);
  });

  it('不正なheight responseでURL組全体をfailoverする', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'first.example.com') {
        if (url.endsWith('/api/symbol/height')) return Promise.resolve(jsonResponse({ height: 'invalid' }));
        return Promise.resolve(jsonResponse([nodeResponse('https://first-node.example.com')]));
      }
      if (url.endsWith('/api/symbol/height'))
        return Promise.resolve(jsonResponse({ height: 300, finalizedHeight: 299 }));
      return Promise.resolve(jsonResponse([nodeResponse('https://second-node.example.com')]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com']);

    expect(result.heightInfo.height).toBe(300);
    expect(result.nodes[0].endpoint).toBe('https://second-node.example.com');
    expect(fetchMock.mock.calls.every(([input]) => new URL(String(input)).hostname !== 'third.example.com')).toBe(true);
  });

  it('不正なNode responseでURL組全体をfailoverする', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'first.example.com') {
        if (url.endsWith('/api/symbol/height'))
          return Promise.resolve(jsonResponse({ height: 400, finalizedHeight: 399 }));
        return Promise.resolve(jsonResponse([{ endpoint: 'https://missing-required-fields.example.com' }]));
      }
      if (url.endsWith('/api/symbol/height'))
        return Promise.resolve(jsonResponse({ height: 401, finalizedHeight: 400 }));
      return Promise.resolve(jsonResponse([nodeResponse('https://valid-node.example.com')]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com']);

    expect(result.heightInfo.height).toBe(401);
    expect(result.nodes[0].endpoint).toBe('https://valid-node.example.com');
  });

  it('絶対URIでないNode endpointでURL組全体をfailoverする', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://first.example.com')) {
        if (url.endsWith('/api/symbol/height'))
          return Promise.resolve(jsonResponse({ height: 500, finalizedHeight: 499 }));
        return Promise.resolve(jsonResponse([nodeResponse('node.example.com')]));
      }
      if (url.endsWith('/api/symbol/height'))
        return Promise.resolve(jsonResponse({ height: 501, finalizedHeight: 500 }));
      return Promise.resolve(jsonResponse([nodeResponse('https://valid-node.example.com', 1, 1)]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com']);

    expect(result.heightInfo.height).toBe(501);
    expect(result.nodes[0].endpoint).toBe('https://valid-node.example.com');
  });

  it('AbortSignal中止時は後続URLへfailoverしない', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL) => {
      controller.abort();
      return Promise.reject(new Error('request cancelled'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com'], {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls.every(([input]) => String(input).startsWith('https://first.example.com'))).toBe(true);
  });

  it('関数形式InitOverrideFunctionのAbortSignalでも後続URLへfailoverしない', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL) => {
      controller.abort();
      return Promise.reject(new Error('request cancelled'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com'], async () => ({
        signal: controller.signal,
      }))
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls.every(([input]) => String(input).startsWith('https://first.example.com'))).toBe(true);
  });

  it('空URL配列を拒否する', async () => {
    await expect(fetchSymbolNodeWatchSnapshot([])).rejects.toThrow('At least one base URL is required');
    await expect(fetchNemNodeWatchSnapshot([])).rejects.toThrow('At least one base URL is required');
  });
});
