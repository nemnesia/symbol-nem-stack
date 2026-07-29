import { createNemNodeWatchApi, createSymbolNodeWatchApi } from '@nemnesia/nodewatch-openapi-provider';
import type { HeightInfo, Node } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';

/** NodeWatch メインネット用URLリスト */
export const nodewatchMainnetUrls = ['https://sse.nemnesia.com', 'https://sse2.nemnesia.com'];
/** NodeWatch テストネット用URLリスト */
export const nodewatchTestnetUrls = ['https://testnet.sse.nemnesia.com', 'https://testnet.sse2.nemnesia.com'];

/** チェーン名の型定義 */
export type ChainName = 'nem' | 'symbol';
/** ネットワークの型定義 */
export type NetworkName = 'mainnet' | 'testnet';
/** ピッカーオプションのインターフェース */
export interface PickerOptions {
  chainName?: ChainName;
  network?: NetworkName;
  count?: number;
  isSsl?: boolean;
  timeoutMs?: number;
}

/** ノードエントリのインターフェース */
type NodeEntry = Pick<Node, 'height' | 'endpoint' | 'isSslEnabled'>;

/** キャッシュエントリのインターフェース */
interface CacheEntry {
  heightInfo: HeightInfo;
  nodes: NodeEntry[];
  timestamp: number;
  baseUrl: string;
}

export const symbolCache = new Map<string, CacheEntry>(); // Symbolノード用キャッシュ
export const nemCache = new Map<string, CacheEntry>(); // NEMノード用キャッシュ

// 設定値
const CACHE_DURATION = 60000; // 1分間キャッシュ

/**
 * タイムアウト時にリクエストを中断する関数
 * @param request AbortSignalを受け取るリクエスト関数
 * @param timeoutMs timeout時間（ミリ秒）
 */
async function _fetchWithTimeout<T>(request: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve().then(() => request(controller.signal)), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Symbolノードを取得する
 * @param network ネットワーク[mainnet|testnet]
 * @param count 取得するノード数
 * @param isSsl SSLのみ取得するか
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns ノードのエンドポイント配列
 */
async function _symbolNodePicker(
  network: NetworkName,
  count: number,
  isSsl: boolean,
  timeoutMs: number
): Promise<string[]> {
  // キャッシュチェック
  const cacheKey = `${network}_${isSsl}`;
  const cachedEntry = symbolCache.get(cacheKey);

  let heightInfo: HeightInfo;
  let nodes: NodeEntry[];
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
    ({ heightInfo, nodes } = cachedEntry);
  } else {
    const isMainnet = network === 'mainnet';
    // FailoverApiは切替先の状態を保持するため、並列リクエスト間で共有しない。
    const heightApi = createSymbolNodeWatchApi(isMainnet);
    const nodesApi = createSymbolNodeWatchApi(isMainnet);
    try {
      const [height, nodeList] = await Promise.all([
        _fetchWithTimeout((signal) => heightApi.getSymbolHeight({ signal }), timeoutMs),
        _fetchWithTimeout((signal) => nodesApi.getSymbolPeerNodes({}, { signal }), timeoutMs),
      ]);
      heightInfo = height;
      nodes = nodeList;
      symbolCache.set(cacheKey, {
        heightInfo,
        nodes,
        timestamp: Date.now(),
        baseUrl: '',
      });
    } catch (error) {
      throw new Error('No available NodeWatch found. ' + (error instanceof Error ? error.message : String(error)), {
        cause: error,
      });
    }
  }
  // フィルタリング
  let filteredNodes = nodes.filter((node) => node.height >= heightInfo!.height);

  if (isSsl) {
    filteredNodes = filteredNodes.filter((node) => node.isSslEnabled === true);
  }
  // ランダムに取得する
  filteredNodes = filteredNodes.sort(() => 0.5 - Math.random()).slice(0, count);

  return filteredNodes.map((node) => node.endpoint);
}

/**
 * NEMノードを取得する
 * @param network ネットワーク[mainnet|testnet]
 * @param count 取得するノード数
 * @param isSsl SSLのみ取得するか
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns ノードのエンドポイント配列
 */
async function _nemNodePicker(
  network: NetworkName,
  count: number,
  isSsl: boolean,
  timeoutMs: number
): Promise<string[]> {
  // キャッシュチェック
  const cacheKey = `${network}_${isSsl}`;
  const cachedEntry = nemCache.get(cacheKey);

  let heightInfo: HeightInfo;
  let nodes: NodeEntry[];
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
    ({ heightInfo, nodes } = cachedEntry);
  } else {
    const isMainnet = network === 'mainnet';
    // FailoverApiは切替先の状態を保持するため、並列リクエスト間で共有しない。
    const heightApi = createNemNodeWatchApi(isMainnet);
    const nodesApi = createNemNodeWatchApi(isMainnet);
    try {
      const [height, nodeList] = await Promise.all([
        _fetchWithTimeout((signal) => heightApi.getNemHeight({ signal }), timeoutMs),
        _fetchWithTimeout((signal) => nodesApi.getNemNodes({ signal }), timeoutMs),
      ]);
      heightInfo = height;
      nodes = nodeList;
      nemCache.set(cacheKey, {
        heightInfo,
        nodes,
        timestamp: Date.now(),
        baseUrl: '',
      });
    } catch (error) {
      throw new Error('No available NodeWatch found. ' + (error instanceof Error ? error.message : String(error)), {
        cause: error,
      });
    }
  }
  // フィルタリング
  let filteredNodes = nodes.filter((node) => node.height >= heightInfo!.height);

  if (isSsl) {
    filteredNodes = filteredNodes.filter((node) => node.isSslEnabled === true);
  }
  // ランダムに取得する
  const randomNodes = filteredNodes.sort(() => 0.5 - Math.random()).slice(0, count);

  return randomNodes.map((node) => node.endpoint);
}

/**
 * NEM/Symbolノードを取得する
 * @param chainName チェーン名[nem|symbol] - default: symbol
 * @param network ネットワーク[mainnet|testnet] - default: mainnet
 * @param count 取得するノード数 - default: 1
 * @param isSsl SSLのみ取得するか - default: false
 * @returns ノードのエンドポイント配列
 */
export async function nemSymbolNodePicker({
  chainName = 'symbol',
  network = 'mainnet',
  count = 1,
  isSsl = false,
  timeoutMs = 3000,
}: PickerOptions = {}): Promise<string[]> {
  // バリデーション: chainName
  const validChainNames = ['nem', 'symbol'];
  if (!validChainNames.includes(chainName)) {
    throw new Error(`Invalid chainName: ${chainName}. Must be 'nem' or 'symbol'.`);
  }
  // バリデーション: network
  const validNetworks = ['mainnet', 'testnet'];
  if (!validNetworks.includes(network)) {
    throw new Error(`Invalid network: ${network}. Must be 'mainnet' or 'testnet'.`);
  }
  // バリデーション: countは正の整数である必要がある
  if (typeof count !== 'number' || count <= 0 || !Number.isInteger(count)) {
    throw new Error('Count must be a positive integer');
  }
  // バリデーション: isSslはboolean
  if (typeof isSsl !== 'boolean') {
    throw new Error('isSsl must be a boolean');
  }
  // バリデーション: timeoutMsは正の整数
  if (typeof timeoutMs !== 'number' || timeoutMs <= 0 || !Number.isInteger(timeoutMs)) {
    throw new Error('timeoutMs must be a positive integer (ms)');
  }

  const result =
    chainName === 'symbol'
      ? await _symbolNodePicker(network, count, isSsl, timeoutMs)
      : await _nemNodePicker(network, count, isSsl, timeoutMs);

  if (result.length === 0) {
    throw new Error('No nodes match the requested criteria');
  }

  return result;
}
