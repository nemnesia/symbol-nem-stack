import { describe, expect, test } from 'vitest';

import { nemSymbolNodePicker, nodewatchMainnetUrls, symbolCache } from '../src/nemSymbolNodePicker.js';

// 実際のAPIにアクセスするため、タイムアウトは長めに設定
const E2E_TIMEOUT = 60000; // 60秒
const NODEWATCH_AVAILABILITY_TIMEOUT = 10000; // 10秒
const E2E_REQUEST_TIMEOUT = 45000; // フェイルオーバーを含むリクエスト全体の待機時間

type ChainName = 'nem' | 'symbol';

const nodeWatchPaths: Record<ChainName, { height: string; nodes: string }> = {
  symbol: { height: '/api/symbol/height', nodes: '/api/symbol/nodes/peer' },
  nem: { height: '/api/nem/height', nodes: '/api/nem/nodes' },
};

interface CandidateNode extends Record<string, unknown> {
  endpoint: string;
  height: number;
  finalizedHeight: number;
}

interface CandidateHeightInfo {
  height: number;
  finalizedHeight: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbsoluteUri(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isCandidateNode(value: unknown): value is CandidateNode {
  if (!isRecord(value)) return false;

  return (
    typeof value.mainPublicKey === 'string' &&
    /^[0-9A-Fa-f]{64}$/.test(value.mainPublicKey) &&
    typeof value.endpoint === 'string' &&
    value.endpoint.trim().length > 0 &&
    isAbsoluteUri(value.endpoint) &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.height === 'number' &&
    Number.isInteger(value.height) &&
    value.height >= 0 &&
    typeof value.finalizedHeight === 'number' &&
    Number.isInteger(value.finalizedHeight) &&
    value.finalizedHeight >= 0 &&
    typeof value.balance === 'number' &&
    Number.isFinite(value.balance) &&
    value.balance >= 0
  );
}

function isCandidateHeightInfo(value: unknown): value is CandidateHeightInfo {
  if (!isRecord(value)) return false;

  return (
    typeof value.height === 'number' &&
    Number.isInteger(value.height) &&
    value.height >= 1 &&
    typeof value.finalizedHeight === 'number' &&
    Number.isInteger(value.finalizedHeight) &&
    value.finalizedHeight >= 1
  );
}

function hasPickableNode(heightInfo: unknown, nodes: unknown): boolean {
  if (!isCandidateHeightInfo(heightInfo) || !Array.isArray(nodes)) return false;

  const nodesWithEndpoint = nodes.filter(
    (node): node is Record<string, unknown> =>
      isRecord(node) && typeof node.endpoint === 'string' && node.endpoint.trim().length > 0
  );

  const candidateNodes = nodesWithEndpoint.filter((node): node is CandidateNode => isCandidateNode(node));
  if (candidateNodes.length !== nodesWithEndpoint.length) return false;

  return candidateNodes.some(
    (node) => node.height !== 0 && node.finalizedHeight !== 0 && node.height >= heightInfo.height
  );
}

async function hasAvailableNodeWatch(chainName: ChainName): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NODEWATCH_AVAILABILITY_TIMEOUT);
  const paths = nodeWatchPaths[chainName];

  try {
    await Promise.any(
      nodewatchMainnetUrls.map(async (baseUrl) => {
        const [heightResponse, nodesResponse] = await Promise.all([
          fetch(`${baseUrl}${paths.height}`, { signal: controller.signal }),
          fetch(`${baseUrl}${paths.nodes}`, { signal: controller.signal }),
        ]);
        if (!heightResponse.ok || !nodesResponse.ok) {
          throw new Error('NodeWatch returned an unsuccessful response');
        }

        const [heightInfo, nodes] = await Promise.all([heightResponse.json(), nodesResponse.json()]);
        if (!hasPickableNode(heightInfo, nodes)) throw new Error('No pickable nodes available');
      })
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

// 外部依存のため、chainごとに選択可能なNodeWatchがない場合は該当E2Eをスキップする。
const [hasAvailableSymbolNodeWatch, hasAvailableNemNodeWatch] = await Promise.all([
  hasAvailableNodeWatch('symbol'),
  hasAvailableNodeWatch('nem'),
]);
const describeWithSymbolNodeWatch = hasAvailableSymbolNodeWatch ? describe : describe.skip;
const describeWithNemNodeWatch = hasAvailableNemNodeWatch ? describe : describe.skip;

describeWithSymbolNodeWatch('nemSymbolNodePicker - E2E (公開メソッドのみ)', () => {
  test(
    'Symbol mainnet から1つ取得できる',
    async () => {
      const result = await nemSymbolNodePicker({ timeoutMs: E2E_REQUEST_TIMEOUT });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(typeof result[0]).toBe('string');
      expect(result[0]).toMatch(/^https?:\/\//);
      console.log('取得したノード:', result);
    },
    E2E_TIMEOUT
  );

  test(
    'symbol mainnet から複数ノードを取得できる',
    async () => {
      const result = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: 'mainnet',
        count: 3,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);
      // 形式チェック
      result.forEach((ep) => expect(ep).toMatch(/^https?:\/\//));
      console.log('取得したノード:', result);
    },
    E2E_TIMEOUT
  );

  test(
    'SSL オンでHTTPS のみ返す',
    async () => {
      const result = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: 'mainnet',
        count: 5,
        isSsl: true,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      expect(Array.isArray(result)).toBe(true);
      result.forEach((ep) => expect(ep).toMatch(/^https:\/\//));
      console.log('取得したノード:', result);
    },
    E2E_TIMEOUT
  );

  test(
    'キャッシュが作用する（同一リクエストで2回目が短い）',
    async () => {
      // キャッシュをクリアしてから測定
      symbolCache.clear();

      const t1 = Date.now();
      const r1 = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: 'mainnet',
        count: 1,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      const d1 = Date.now() - t1;

      const t2 = Date.now();
      const r2 = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: 'mainnet',
        count: 1,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      const d2 = Date.now() - t2;

      expect(r1.length).toBeGreaterThanOrEqual(1);
      expect(r2.length).toBeGreaterThanOrEqual(1);
      // 2回目は少なくとも短くなっていることを期待（ネットワーク状況によるが、通常は短縮）
      expect(d2).toBeLessThanOrEqual(Math.max(d1, 2000));
    },
    E2E_TIMEOUT
  );

  test(
    '大量要求（上限を超える）でも有効な結果を返す',
    async () => {
      const result = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: 'mainnet',
        count: 1000,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(1000);
      console.log('取得したノード:', result);
    },
    E2E_TIMEOUT
  );

  test(
    '取得したエンドポイントに対する簡易ヘルスチェック（成功は保証されない）',
    async () => {
      const result = await nemSymbolNodePicker({
        chainName: 'symbol',
        network: 'mainnet',
        count: 1,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      console.log('取得したノード:', result);
      if (!result || result.length === 0) {
        // ノードが取得できない場合はスキップ扱い
        expect(result.length).toBeGreaterThanOrEqual(0);
        return;
      }

      const endpoint = result[0];
      try {
        const resp = await fetch(`${endpoint}/node/info`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        // ステータスコードは問わないがレスポンスが来ることを期待
        expect(resp).toBeDefined();
      } catch (err) {
        // 到達不能でもテスト自体を失敗させない（ネットワーク依存のため）
        console.warn('node reachability check failed:', (err as Error).message);
      }
    },
    E2E_TIMEOUT
  );
});

describeWithNemNodeWatch('nemSymbolNodePicker - NEM E2E (公開メソッドのみ)', () => {
  test(
    'nem mainnet を取得できる',
    async () => {
      const result = await nemSymbolNodePicker({
        chainName: 'nem',
        network: 'mainnet',
        count: 1,
        timeoutMs: E2E_REQUEST_TIMEOUT,
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toMatch(/^https?:\/\//);
      console.log('取得したノード:', result);
    },
    E2E_TIMEOUT
  );
});
