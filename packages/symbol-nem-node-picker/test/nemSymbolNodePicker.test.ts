import type { Node, NodeWatchSnapshot } from '@nemnesia/nodewatch-openapi-provider';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { nemCache, nodewatchMainnetUrls, nodewatchTestnetUrls, symbolCache } from '../src/nemSymbolNodePicker.js';
import { fetchNemNodeWatchSnapshot, fetchSymbolNodeWatchSnapshot } from '../src/nodeWatchApi.js';

vi.mock('../src/nodeWatchApi.js', () => ({
  fetchNemNodeWatchSnapshot: vi.fn(),
  fetchSymbolNodeWatchSnapshot: vi.fn(),
}));

const mockFetchNemNodeWatchSnapshot = vi.mocked(fetchNemNodeWatchSnapshot);
const mockFetchSymbolNodeWatchSnapshot = vi.mocked(fetchSymbolNodeWatchSnapshot);

function createNode(overrides: Partial<Node> = {}): Node {
  return {
    mainPublicKey: 'a'.repeat(64),
    endpoint: 'https://node.example.com',
    name: 'node',
    version: '1.0.0',
    height: 100,
    finalizedHeight: 100,
    balance: 0,
    ...overrides,
  };
}

function createSnapshot(nodes: Node[], height = 100): NodeWatchSnapshot {
  return {
    heightInfo: { height, finalizedHeight: height },
    nodes,
  };
}

describe('nemSymbolNodePicker - 基本テスト', () => {
  it('モジュールが正しくエクスポートされている', async () => {
    const module = await import('../src/nemSymbolNodePicker.js');
    expect(typeof module.nemSymbolNodePicker).toBe('function');
    expect(module.nodewatchMainnetUrls).toEqual(nodewatchMainnetUrls);
    expect(module.nodewatchTestnetUrls).toEqual(nodewatchTestnetUrls);
  });
});

describe('nemSymbolNodePicker - 引数テスト', () => {
  it('不正なchainNameでエラー', async () => {
    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ chainName: 'invalid' as never })).rejects.toThrow(
      "Invalid chainName: invalid. Must be 'nem' or 'symbol'."
    );
  });

  it('不正なnetworkでエラー', async () => {
    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ network: 'invalid' as never })).rejects.toThrow(
      "Invalid network: invalid. Must be 'mainnet' or 'testnet'."
    );
  });

  it('不正なcountでエラー', async () => {
    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ count: 0 })).rejects.toThrow('Count must be a positive integer');
    await expect(nemSymbolNodePicker({ count: -1 })).rejects.toThrow('Count must be a positive integer');
    await expect(nemSymbolNodePicker({ count: 1.5 })).rejects.toThrow('Count must be a positive integer');
  });

  it('不正なisSslでエラー', async () => {
    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ isSsl: 'true' as never })).rejects.toThrow('isSsl must be a boolean');
  });

  it('不正なtimeoutMsでエラー', async () => {
    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ timeoutMs: 0 })).rejects.toThrow('timeoutMs must be a positive integer (ms)');
    await expect(nemSymbolNodePicker({ timeoutMs: -100 })).rejects.toThrow('timeoutMs must be a positive integer (ms)');
    await expect(nemSymbolNodePicker({ timeoutMs: 100.5 })).rejects.toThrow(
      'timeoutMs must be a positive integer (ms)'
    );
  });
});

describe('nemSymbolNodePicker - snapshot取得後の選択', () => {
  beforeEach(() => {
    symbolCache.clear();
    nemCache.clear();
    vi.resetAllMocks();
  });

  it('SymbolのURLリストをproviderへ渡す', async () => {
    mockFetchSymbolNodeWatchSnapshot.mockResolvedValue(
      createSnapshot([createNode({ endpoint: 'https://symbol.example.com', isSslEnabled: true })])
    );

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker()).resolves.toEqual(['https://symbol.example.com']);
    expect(mockFetchSymbolNodeWatchSnapshot).toHaveBeenCalledWith(
      nodewatchMainnetUrls,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('NEMのsnapshotを使う', async () => {
    mockFetchNemNodeWatchSnapshot.mockResolvedValue(
      createSnapshot([createNode({ endpoint: 'https://nem.example.com', isSslEnabled: true })])
    );

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ chainName: 'nem', network: 'testnet', isSsl: true })).resolves.toEqual([
      'https://nem.example.com',
    ]);
    expect(mockFetchNemNodeWatchSnapshot).toHaveBeenCalledWith(
      nodewatchTestnetUrls,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('height未満のノードとSSL対象外を除外する', async () => {
    mockFetchSymbolNodeWatchSnapshot.mockResolvedValue(
      createSnapshot([
        createNode({ endpoint: 'https://current-ssl.example.com', height: 100, isSslEnabled: true }),
        createNode({ endpoint: 'http://current.example.com', height: 100, isSslEnabled: false }),
        createNode({ endpoint: 'https://old.example.com', height: 99, isSslEnabled: true }),
      ])
    );

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ isSsl: true, count: 10 })).resolves.toEqual(['https://current-ssl.example.com']);
  });

  it('testnetのSymbolノードを選択する', async () => {
    mockFetchSymbolNodeWatchSnapshot.mockResolvedValue(
      createSnapshot([createNode({ endpoint: 'https://testnet.example.com', height: 200, finalizedHeight: 200 })], 200)
    );

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ network: 'testnet' })).resolves.toEqual(['https://testnet.example.com']);
  });

  it('キャッシュヒット時はproviderを呼ばない', async () => {
    symbolCache.set('mainnet_true', {
      heightInfo: { height: 100, finalizedHeight: 100 },
      nodes: [
        { height: 100, endpoint: 'https://cached-1.example.com', isSslEnabled: true },
        { height: 100, endpoint: 'https://cached-2.example.com', isSslEnabled: true },
      ],
      timestamp: Date.now(),
      baseUrl: '',
    });

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    const result = await nemSymbolNodePicker({ count: 2, isSsl: true });
    expect(result.sort()).toEqual(['https://cached-1.example.com', 'https://cached-2.example.com'].sort());
    expect(mockFetchSymbolNodeWatchSnapshot).not.toHaveBeenCalled();
  });

  it('providerエラー時にpicker固有のエラーへ変換する', async () => {
    mockFetchSymbolNodeWatchSnapshot.mockRejectedValue(new Error('Network error'));

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker()).rejects.toThrow('No available NodeWatch found. Network error');
  });

  it('timeout時にproviderへAbortSignalを通知する', async () => {
    let signal: AbortSignal | undefined;
    mockFetchSymbolNodeWatchSnapshot.mockImplementation((_baseUrls, initOverrides) => {
      signal = (initOverrides as RequestInit).signal ?? undefined;
      return new Promise<NodeWatchSnapshot>(() => {});
    });

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker({ timeoutMs: 10 })).rejects.toThrow(
      'No available NodeWatch found. Request timeout'
    );
    expect(signal?.aborted).toBe(true);
  });

  it('条件に合うノードがない場合はエラーを投げる', async () => {
    mockFetchSymbolNodeWatchSnapshot.mockResolvedValue(
      createSnapshot([createNode({ endpoint: 'https://old.example.com', height: 99 })])
    );

    const { nemSymbolNodePicker } = await import('../src/nemSymbolNodePicker.js');
    await expect(nemSymbolNodePicker()).rejects.toThrow('No nodes match the requested criteria');
  });
});
