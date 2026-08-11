import {
  Configuration,
  NEMNodesApi as NemNodeWatchApi,
  SymbolNodesApi as SymbolNodeWatchApi,
} from '@nemnesia/nodewatch-openapi-typescript-fetch-client';

/** NodeWatch メインネット用URLリスト */
export const nodewatchMainnetUrls = ['https://sse.nemnesia.com', 'https://sse2.nemnesia.com'];
/** NodeWatch テストネット用URLリスト */
export const nodewatchTestnetUrls = ['https://testnet.sse.nemnesia.com', 'https://testnet.sse2.nemnesia.com'];

/** APIクラスのコンストラクタの型定義 */
type ApiConstructor<T> = new (config: Configuration) => T;

/** NodeWatchが提供するネットワーク。 */
export type NodeWatchNetwork = 'mainnet' | 'testnet';

/**
 * フェールオーバー対応のAPIクラス
 */
export class FailoverApi<T> {
  private apis: T[];
  private currentIndex = 0;
  private maxRetries: number;

  /**
   * コンストラクタ
   *
   * @param ApiClass APIクラスのコンストラクタ
   * @param baseUrls ベースURLの配列
   * @param retryOnError リトライを有効にするかどうか
   * @param maxRetries 最大リトライ回数（省略時はbaseUrlsの長さと同じ）
   * @returns フェールオーバー対応のAPIインスタンス
   */
  constructor(
    ApiClass: ApiConstructor<T>,
    baseUrls: readonly string[],
    private retryOnError = true,
    maxRetries?: number
  ) {
    if (baseUrls.length === 0) {
      throw new Error('At least one base URL is required');
    }
    this.apis = baseUrls.map((url) => new ApiClass(new Configuration({ basePath: url })));
    this.maxRetries = maxRetries ?? baseUrls.length;

    // Proxyですべてのメソッドを自動的にラップ
    return new Proxy(this, {
      get(target, prop, receiver) {
        const originalValue = Reflect.get(target, prop, receiver);

        // 既存のプロパティやメソッドはそのまま返す
        if (typeof originalValue !== 'undefined' || typeof prop !== 'string') {
          return originalValue;
        }

        // APIのメソッドをフェールオーバー対応で呼び出す
        return function (...args: any[]) {
          return target.executeWithFailover((api) => (api as any)[prop](...args));
        };
      },
    }) as any;
  }

  /**
   * フェールオーバー対応でAPIメソッドを実行
   *
   * @param apiMethod APIメソッド
   * @returns APIメソッドの結果
   */
  private async executeWithFailover<R>(apiMethod: (api: T) => Promise<R>): Promise<R> {
    let lastError: Error | undefined;
    const attemptLimit = Math.min(this.maxRetries, this.apis.length);

    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      const api = this.apis[this.currentIndex];

      try {
        const result = await apiMethod(api);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Request failed on endpoint ${this.currentIndex} (attempt ${attempt + 1}/${attemptLimit}):`,
          error
        );

        this.currentIndex = (this.currentIndex + 1) % this.apis.length;

        if (!this.retryOnError || attempt === attemptLimit - 1) {
          break;
        }
      }
    }

    throw new Error(`All endpoints failed after ${attemptLimit} attempts. Last error: ${lastError?.message}`);
  }
}

/**
 * フェールオーバー対応のNodeWatch SymbolNodesAPIインスタンスを作成
 *
 * @param network 対象ネットワーク（`mainnet` または `testnet`）
 * @param baseUrls NodeWatchのベースURLリスト（省略時はネットワークの既定値）
 * @returns SymbolNodesApi互換のフェールオーバー対応APIインスタンス
 */
export function createSymbolNodeWatchApi(network: NodeWatchNetwork, baseUrls?: readonly string[]): SymbolNodeWatchApi {
  const urls = getNodeWatchUrls(network, baseUrls);
  return new FailoverApi(SymbolNodeWatchApi, urls, true) as unknown as SymbolNodeWatchApi;
}

/**
 * フェールオーバー対応のNodeWatch NEMNodesAPIインスタンスを作成
 *
 * @param network 対象ネットワーク（`mainnet` または `testnet`）
 * @param baseUrls NodeWatchのベースURLリスト（省略時はネットワークの既定値）
 * @returns NEMNodesApi互換のフェールオーバー対応APIインスタンス
 */
export function createNemNodeWatchApi(network: NodeWatchNetwork, baseUrls?: readonly string[]): NemNodeWatchApi {
  const urls = getNodeWatchUrls(network, baseUrls);
  return new FailoverApi(NemNodeWatchApi, urls, true) as unknown as NemNodeWatchApi;
}

function getNodeWatchUrls(network: NodeWatchNetwork, baseUrls?: readonly string[]): readonly string[] {
  if (network !== 'mainnet' && network !== 'testnet') {
    throw new Error(`Invalid network: ${String(network)}. Must be 'mainnet' or 'testnet'.`);
  }

  return baseUrls ?? (network === 'mainnet' ? nodewatchMainnetUrls : nodewatchTestnetUrls);
}
