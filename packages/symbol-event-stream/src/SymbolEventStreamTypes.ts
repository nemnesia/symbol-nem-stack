import type { SymbolChannel, SymbolNotificationMap, SymbolWebSocketError } from '@nemnesia/symbol-websocket';

export type AddressableSymbolChannel = Exclude<SymbolChannel, 'block' | 'finalizedBlock'>;
export type EventCallback<K extends SymbolChannel = SymbolChannel> = (payload: SymbolNotificationMap[K]) => void;
export type InternalEventCallback = (payload: unknown) => void;
export type ErrorCallback = (error: SymbolWebSocketError) => void;
export type ConnectCallback = (nodeUrl: string, uid: string) => void;
export type DisconnectCallback = (nodeUrl: string) => void;

/**
 * 管理対象ノードの現在の接続状態。
 */
export interface NodeConnectionStatus {
  /** ノードのホスト名または IP アドレス。 */
  nodeUrl: string;
  /** 内部 WebSocket が OPEN 状態かどうか。 */
  connected: boolean;
  /** Gateway から受信した接続 UID。接続完了前・切断中は `null`。 */
  uid: string | null;
}

/**
 * {@link SymbolEventStream} の接続・重複排除設定。
 */
export interface SymbolEventStreamOptions {
  /**
   * 接続候補となるノードのホスト名または IP アドレス。プロトコル・ポート・パスは含めません。
   * 少なくとも 1 つ指定します。
   */
  nodeUrls: string[];
  /**
   * 同時に維持する接続数。正の安全な整数を指定します。
   * `nodeUrls` の件数を超える場合は、すべての候補ノードへ接続します。
   */
  connections: number;
  /** SSL を使用するかどうか。 @defaultValue true */
  ssl?: boolean;
  /**
   * 重複排除キャッシュの最大エントリ数。正の安全な整数を指定します。
   * @defaultValue 10000
   */
  maxCacheSize?: number;
  /**
   * 重複排除キャッシュの有効期間（ミリ秒）。正の有限数を指定します。
   * @defaultValue 60000
   */
  cacheTtl?: number;
  /**
   * ノード切り替えを試みる再接続回数。正の安全な整数を指定します。
   * 代替ノードがない場合は、現在の接続で再接続を継続します。
   * @defaultValue 5
   */
  maxReconnectBeforeSwitching?: number;
  /**
   * 切り替え元ノードを候補から除外する期間（ミリ秒）。正の有限数を指定します。
   * @defaultValue 300000
   */
  blacklistTtl?: number;
}
