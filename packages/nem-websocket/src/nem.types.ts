import type WebSocket from 'isomorphic-ws';

/**
 * WebSocket エラーの分類。
 *
 * 現在の実装では下位 WebSocket のエラーを `network` として通知します。その他の値は将来の詳細な分類のために予約されています。
 */
export type NemWebSocketErrorType = 'connection' | 'timeout' | 'parse' | 'network' | 'unknown';

/**
 * WebSocket エラーの回復可能性。
 *
 * 現在の実装では下位 WebSocket のエラーを `recoverable` として通知します。`fatal` は将来の分類のために予約されています。
 */
export type NemWebSocketErrorSeverity = 'fatal' | 'recoverable';

/** イベントリスナーまたは購読を解除する関数。何度呼び出しても安全です。 */
export type NemWebSocketUnsubscribe = () => void;

/**
 * コンテキスト付きエラー情報
 */
export interface NemWebSocketError {
  /**
   * エラータイプ
   */
  type: NemWebSocketErrorType;
  /**
   * エラー重大度
   */
  severity: NemWebSocketErrorSeverity;
  /**
   * 接続先ホスト
   */
  host: string;
  /**
   * エラー発生時点で再接続試行中かどうか
   */
  reconnecting: boolean;
  /**
   * エラー発生時点の再接続試行回数
   */
  reconnectAttempts: number;
  /**
   * 下位 WebSocket から渡された元のエラー
   */
  originalError: WebSocket.ErrorEvent | Error;
  /**
   * エラー発生時刻（UNIX エポックからのミリ秒）
   */
  timestamp: number;
  /**
   * エラーメッセージ
   */
  message: string;
}

/**
 * NEM WebSocket の接続オプション
 */
export interface NemWebSocketOptions {
  /**
   * 接続先のホスト名または IP アドレス。プロトコルやポート番号は含めません。
   */
  host: string;
  /**
   * STOMP 接続が確立するまでのタイムアウト（ミリ秒）
   * @default 5000
   */
  timeout?: number;
  /**
   * `true` の場合は `wss` とポート 7779、`false` の場合は `ws` とポート 7778 を使用する
   * @default false
   */
  ssl?: boolean;
  /**
   * 異常切断時の自動再接続を有効にする。`disconnect()` を呼んだ場合は再接続しない。
   * @default true
   */
  autoReconnect?: boolean;
  /**
   * 連続した最大再接続試行回数。接続に成功すると回数はリセットされる。
   * @default Infinity
   */
  maxReconnectAttempts?: number;
  /**
   * 再接続試行を開始するまでの待機時間（ミリ秒）
   * @default 3000
   */
  reconnectInterval?: number;
}
