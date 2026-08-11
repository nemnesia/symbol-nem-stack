import {
  Configuration,
  NEMNodesApi as NemNodeWatchApi,
  SymbolNodesApi as SymbolNodeWatchApi,
} from '@nemnesia/nodewatch-openapi-typescript-fetch-client';

/** APIクラスのコンストラクタの型定義 */
type ApiConstructor<T> = new (config: Configuration) => T;

/** NodeWatchのノード一覧を返すAPIメソッド */
const NODE_LIST_METHODS = new Set(['getSymbolApiNodes', 'getSymbolPeerNodes', 'getNemNodes']);

/** 利用可能なendpointを持つNodeかどうかを判定 */
function hasUsableEndpoint(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;

  const endpoint = (value as { endpoint?: unknown }).endpoint;
  return typeof endpoint === 'string' && endpoint.trim().length > 0;
}

/** ノード一覧からendpointが空のNodeを除外 */
function filterNodeListResult<R>(methodName: string, result: R): R {
  if (!NODE_LIST_METHODS.has(methodName) || !Array.isArray(result)) return result;

  return result.filter(hasUsableEndpoint) as R;
}

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
    if (!Array.isArray(baseUrls) || baseUrls.length === 0) {
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
          return target.executeWithFailover((api) => (api as any)[prop](...args), prop);
        };
      },
    }) as any;
  }

  /**
   * フェールオーバー対応で複数のAPIメソッドを同じAPIインスタンス上で実行
   */
  async executeBatch<R>(apiMethod: (api: T) => Promise<R>): Promise<R> {
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

  /**
   * フェールオーバー対応でAPIメソッドを実行
   */
  private async executeWithFailover<R>(apiMethod: (api: T) => Promise<R>, methodName: string): Promise<R> {
    const result = await this.executeBatch(apiMethod);
    return filterNodeListResult(methodName, result);
  }
}

/**
 * フェールオーバー対応のNodeWatch SymbolNodesAPIインスタンスを作成
 *
 * @param baseUrls NodeWatchのベースURLリスト
 * @returns SymbolNodesApi互換のフェールオーバー対応APIインスタンス
 */
export function createSymbolNodeWatchApi(baseUrls: readonly string[]): SymbolNodeWatchApi {
  return new FailoverApi(SymbolNodeWatchApi, baseUrls, true) as unknown as SymbolNodeWatchApi;
}

/**
 * フェールオーバー対応のNodeWatch NEMNodesAPIインスタンスを作成
 *
 * @param baseUrls NodeWatchのベースURLリスト
 * @returns NEMNodesApi互換のフェールオーバー対応APIインスタンス
 */
export function createNemNodeWatchApi(baseUrls: readonly string[]): NemNodeWatchApi {
  return new FailoverApi(NemNodeWatchApi, baseUrls, true) as unknown as NemNodeWatchApi;
}
