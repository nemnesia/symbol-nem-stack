import type WebSocket from 'isomorphic-ws';

/**
 * WebSocket エラーの発生源を表す識別子。
 *
 * `timeout` は Gateway UID の受信待機が期限切れになったことを、`parse` は受信メッセージが
 * JSON として解釈できなかったことを、`network` は WebSocket のエラーイベントを表します。
 */
export type SymbolWebSocketErrorType = 'connection' | 'timeout' | 'parse' | 'network' | 'unknown';

/**
 * エラー後に接続を継続できるかを表す重大度。
 */
export type SymbolWebSocketErrorSeverity = 'fatal' | 'recoverable';

/** イベントリスナーまたは購読を解除する関数。何度呼び出しても安全です。 */
export type SymbolWebSocketUnsubscribe = () => void;

/**
 * エラーコールバックへ渡される接続コンテキスト付きのエラー情報。
 */
export interface SymbolWebSocketError {
  /**
   * エラータイプ
   */
  type: SymbolWebSocketErrorType;
  /**
   * エラー重大度
   */
  severity: SymbolWebSocketErrorSeverity;
  /**
   * 接続先ホスト。
   */
  host: string;
  /**
   * エラー発生時点で再接続試行を行っているかどうか。
   */
  reconnecting: boolean;
  /**
   * エラー発生時点の再接続試行回数。初回接続中は `0`。
   */
  reconnectAttempts: number;
  /**
   * WebSocket 実装または JSON パーサーが返した元のエラー。
   */
  originalError: WebSocket.ErrorEvent | Error;
  /**
   * エラー発生時刻
   */
  timestamp: number;
  /**
   * エラーメッセージ
   */
  message: string;
}

/**
 * {@link SymbolWebSocket} の接続・再接続設定。
 */
export interface SymbolWebSocketOptions {
  /**
   * 接続先のホスト名または IP アドレス。プロトコル・ポート・パスは含めません。IPv6 は角括弧で囲みます。
   *
   * SSL 有効時は `wss://{host}:3001/ws`、無効時は `ws://{host}:3000/ws` に接続します。
   */
  host: string;
  /**
   * Gateway UID を受信するまでの接続タイムアウト（ミリ秒）。各接続試行に適用されます。
   * @default 10000
   * @remarks 0 を指定するとタイムアウトを無効化します。
   */
  timeout?: number;
  /**
   * SSL を使用するかどうか。
   * @default true
   */
  ssl?: boolean;
  /**
   * 予期しない切断後に自動再接続を有効にするかどうか。
   * @default true
   */
  autoReconnect?: boolean;
  /**
   * 初回接続を除く最大再接続試行回数。
   * @default Infinity
   */
  maxReconnectAttempts?: number;
  /**
   * 再接続試行までの待機時間（ミリ秒）。
   * @default 3000
   */
  reconnectInterval?: number;
}
