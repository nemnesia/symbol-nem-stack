import type WebSocket from 'isomorphic-ws';

/**
 * WebSocket エラーの分類。
 *
 * 下位 WebSocket のエラーは `network`、STOMP サーバーの ERROR フレームは `connection` として通知します。
 */
export type NemWebSocketErrorType = 'connection' | 'timeout' | 'parse' | 'network' | 'unknown';

/**
 * WebSocket エラーの回復可能性。
 *
 * STOMP ERROR フレームは `fatal`、下位 WebSocket の一時的なエラーは `recoverable` として通知します。
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
   * 安定接続になるまでの最大再接続試行回数。30秒間接続が維持されると回数はリセットされる。
   * @default 10
   */
  maxReconnectAttempts?: number;
  /**
   * 再接続待機時間の基準値（ミリ秒）。試行ごとに指数バックオフとjitterを適用する。0は指定できない。
   * @default 3000
   */
  reconnectInterval?: number;
}
