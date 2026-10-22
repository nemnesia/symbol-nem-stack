import { type Node, type NodeWatchSnapshot, fetchSymbolNodeWatchSnapshot } from '@nemnesia/nodewatch-openapi-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nemnesia/nodewatch-openapi-provider', () => ({ fetchSymbolNodeWatchSnapshot: vi.fn() }));

const fetchSnapshot = vi.mocked(fetchSymbolNodeWatchSnapshot);
const node = (overrides: Partial<Node> = {}): Node => ({
  mainPublicKey: 'A'.repeat(64),
  endpoint: 'https://node.example.com:3001',
  name: 'test',
  version: '1.0.0',
  height: 100,
  finalizedHeight: 90,
  balance: 0,
  isSslEnabled: true,
  ...overrides,
});
const snapshot = (nodes: Node[] = [node()]): NodeWatchSnapshot => ({
  heightInfo: { height: 100, finalizedHeight: 90 },
  nodes,
});

beforeEach(() => {
  vi.resetModules();
  fetchSnapshot.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('official NodeWatch connections', () => {
  it('shares one snapshot request during cold and expired cache fan-out', async () => {
    fetchSnapshot.mockResolvedValue(snapshot());
    const { pickSymbolNode } = await import('./nodewatch');
    const selectAll = () => Promise.all(Array.from({ length: 30 }, () => pickSymbolNode('testnet')));
    expect(await selectAll()).toEqual(Array(30).fill('https://node.example.com:3001'));
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    await selectAll();
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it('keeps concurrent network requests separate', async () => {
    fetchSnapshot
      .mockResolvedValueOnce(snapshot([node({ endpoint: 'https://main.example.com' })]))
      .mockResolvedValueOnce(snapshot([node({ endpoint: 'https://test.example.com' })]));
    const { pickSymbolNode } = await import('./nodewatch');
    expect(
      await Promise.all([pickSymbolNode('mainnet'), pickSymbolNode('testnet'), pickSymbolNode('mainnet')])
    ).toEqual(['https://main.example.com', 'https://test.example.com', 'https://main.example.com']);
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it.each(['failure', 'timeout'])('allows retry after a shared request ends in %s', async (reason) => {
    if (reason === 'timeout') fetchSnapshot.mockImplementationOnce(() => new Promise(() => {}));
    else fetchSnapshot.mockRejectedValueOnce(new Error('Unavailable'));
    const { pickSymbolNode } = await import('./nodewatch');
    const results = Promise.allSettled(Array.from({ length: 30 }, () => pickSymbolNode('testnet')));
    if (reason === 'timeout') await vi.advanceTimersByTimeAsync(3000);
    expect((await results).every((result) => result.status === 'rejected')).toBe(true);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    fetchSnapshot.mockResolvedValueOnce(snapshot());
    expect(await pickSymbolNode('testnet')).toBe('https://node.example.com:3001');
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['mainnet', 'https://nodewatch.symbol.tools'],
    ['testnet', 'https://nodewatch.symbol.tools/testnet'],
  ] as const)('uses only the official %s endpoint', async (network, url) => {
    fetchSnapshot.mockResolvedValue(snapshot());
    const { fetchNodeWatchSnapshot } = await import('./nodewatch');
    await fetchNodeWatchSnapshot(network);
    expect(fetchSnapshot).toHaveBeenCalledExactlyOnceWith([url], { signal: expect.any(AbortSignal) });
  });

  it('selects an up-to-date SSL node and keeps network caches separate', async () => {
    fetchSnapshot.mockResolvedValueOnce(
      snapshot([node({ height: 99 }), node({ isSslEnabled: false }), node({ endpoint: 'https://main.example.com' })])
    );
    fetchSnapshot.mockResolvedValueOnce(snapshot([node({ endpoint: 'https://test.example.com' })]));
    const { pickSymbolNode } = await import('./nodewatch');
    expect(await pickSymbolNode('mainnet')).toBe('https://main.example.com');
    expect(await pickSymbolNode('mainnet')).toBe('https://main.example.com');
    expect(await pickSymbolNode('testnet')).toBe('https://test.example.com');
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60000);
    fetchSnapshot.mockResolvedValueOnce(snapshot());
    await pickSymbolNode('mainnet');
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  });

  it('rejects when no eligible node exists', async () => {
    fetchSnapshot.mockResolvedValue(snapshot([node({ height: 99 })]));
    const { pickSymbolNode } = await import('./nodewatch');
    await expect(pickSymbolNode('mainnet')).rejects.toThrow('No nodes match the requested criteria');
  });

  it.each(['http://node.example.com:3000', 'javascript:alert(1)', 'ftp://node.example.com', 'not-a-url'])(
    'rejects non-HTTPS endpoint %s even when the SSL flag is true',
    async (endpoint) => {
      fetchSnapshot.mockResolvedValue(snapshot([node({ endpoint })]));
      const { pickSymbolNode } = await import('./nodewatch');
      await expect(pickSymbolNode('testnet')).rejects.toThrow('No nodes match the requested criteria');
    }
  );

  it('selects HTTPS when a conflicting HTTP record is present', async () => {
    fetchSnapshot.mockResolvedValue(
      snapshot([node({ endpoint: 'http://bad.example.com' }), node({ endpoint: 'https://good.example.com' })])
    );
    const { pickSymbolNode } = await import('./nodewatch');
    expect(await pickSymbolNode('mainnet')).toBe('https://good.example.com');
  });

  it('does not fall back to another NodeWatch on failure', async () => {
    fetchSnapshot.mockRejectedValue(new Error('Unavailable'));
    const { fetchNodeWatchSnapshot } = await import('./nodewatch');
    await expect(fetchNodeWatchSnapshot('mainnet')).rejects.toThrow('Unavailable');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('aborts a request after three seconds', async () => {
    fetchSnapshot.mockImplementation(() => new Promise(() => {}));
    const { fetchNodeWatchSnapshot } = await import('./nodewatch');
    const result = expect(fetchNodeWatchSnapshot('testnet')).rejects.toThrow('Request timeout');
    await vi.advanceTimersByTimeAsync(3000);
    await result;
    expect((fetchSnapshot.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });
});
