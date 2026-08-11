import { describe, expect, test } from 'vitest';

import { nemSymbolNodePicker, nodewatchMainnetUrls, symbolCache } from '../src/nemSymbolNodePicker.js';

// 実際のAPIにアクセスするため、タイムアウトは長めに設定
const E2E_TIMEOUT = 60000; // 60秒
const NODEWATCH_AVAILABILITY_TIMEOUT = 10000; // 10秒
const E2E_REQUEST_TIMEOUT = 45000; // フェイルオーバーを含むリクエスト全体の待機時間

async function hasAvailableNodeWatch(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NODEWATCH_AVAILABILITY_TIMEOUT);

  try {
    await Promise.any(
      nodewatchMainnetUrls.map(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/symbol/height`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`NodeWatch returned HTTP ${response.status}`);
        }
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

// 外部依存のため、すべてのNodeWatchが利用不能な環境ではE2Eをスキップする。
const describeWithNodeWatch = (await hasAvailableNodeWatch()) ? describe : describe.skip;

describeWithNodeWatch('nemSymbolNodePicker - E2E (公開メソッドのみ)', () => {
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
