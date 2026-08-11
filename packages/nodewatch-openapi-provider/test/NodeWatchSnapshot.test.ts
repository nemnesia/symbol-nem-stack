import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNemNodeWatchSnapshot, fetchSymbolNodeWatchSnapshot } from '../src/NodeWatchSnapshot.js';

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
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
        jsonResponse([{ endpoint: '' }, { endpoint: '  ' }, { endpoint: 'https://valid.example.com' }])
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

  it('heightまたはNode一覧の失敗時はURL組全体をfailoverする', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://first.example.com')) {
        return Promise.reject(new Error('first endpoint failed'));
      }
      if (url.endsWith('/api/symbol/height')) {
        return Promise.resolve(jsonResponse({ height: 200, finalizedHeight: 200 }));
      }
      return Promise.resolve(jsonResponse([{ endpoint: 'https://second-node.example.com' }]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSymbolNodeWatchSnapshot(['https://first.example.com', 'https://second.example.com']);

    expect(result.heightInfo.height).toBe(200);
    expect(result.nodes.map((node) => node.endpoint)).toEqual(['https://second-node.example.com']);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).startsWith('https://first.example.com'))
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).startsWith('https://second.example.com'))
    ).toHaveLength(2);
  });

  it('NEMのheightとNode一覧を取得しAbortSignalを転送する', async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | null | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal;
      return Promise.resolve(jsonResponse([{ endpoint: 'https://nem-node.example.com' }]));
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

  it('空URL配列を拒否する', async () => {
    await expect(fetchSymbolNodeWatchSnapshot([])).rejects.toThrow('At least one base URL is required');
    await expect(fetchNemNodeWatchSnapshot([])).rejects.toThrow('At least one base URL is required');
  });
});
