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
