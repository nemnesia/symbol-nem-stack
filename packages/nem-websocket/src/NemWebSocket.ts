import { Client, type IFrame, StompSubscription } from '@stomp/stompjs';
import WebSocket from 'isomorphic-ws';

import {
  NemWebSocketError,
  NemWebSocketErrorSeverity,
  NemWebSocketErrorType,
  NemWebSocketOptions,
  NemWebSocketUnsubscribe,
} from './nem.types.js';
import { nemChannelPaths } from './nemChannelPaths.js';
import type { NemAddressChannel, NemChannel, NemGlobalChannel } from './nemChannelPaths.js';

/**
 * NEM NIS1 ノードの STOMP WebSocket クライアント。
 *
 * インスタンス生成時に接続を開始します。接続前に登録した購読は、接続成功時に自動で登録されます。
 * 異常切断時は、`autoReconnect` が有効であれば購読を復元して再接続を試みます。
 */
export class NemWebSocket {
  private _client!: Client;
  private _isConnected = false;
  private _uid: string | null = null;
  private subscriptions: Map<string, Map<(message: string) => void, StompSubscription>> = new Map();
  private errorCallbacks = new Set<(err: NemWebSocketError) => void>();
  private closeCallbacks = new Set<(event: WebSocket.CloseEvent) => void>();
  private connectCallbacks = new Set<(uid: string) => void>();
  private reconnectCallbacks = new Set<(attemptCount: number) => void>();

  // 再接続関連のプロパティ
  private options: Required<NemWebSocketOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private activeSubscriptions: Map<string, Set<(message: string) => void>> = new Map();
  private activePublishRequests: Map<string, { destination: string; body: string }> = new Map();

  /**
   * コンストラクタ
   *
   * @param options 接続先と再接続動作を指定するオプション
   */
  constructor(options: NemWebSocketOptions) {
    this.options = this.validateOptions({
      timeout: 5000,
      ssl: false,
      autoReconnect: true,
      maxReconnectAttempts: Infinity,
      reconnectInterval: 3000,
      ...options,
    });

    this.createConnection();
  }

  private validateOptions(options: NemWebSocketOptions): Required<NemWebSocketOptions> {
    if (typeof options.host !== 'string' || options.host.trim() === '') {
      throw new TypeError('host must be a non-empty hostname or IP address');
    }
    if (/[\s\\/@?#]/.test(options.host) || options.host.includes('://')) {
      throw new TypeError('host must not include a protocol, path, port, userinfo, or URL separators');
    }
    if (options.host.includes(':') && !(options.host.startsWith('[') && options.host.endsWith(']'))) {
      throw new TypeError('IPv6 hosts must be enclosed in brackets and ports are not supported');
    }
    if (options.host.includes('[') || options.host.includes(']')) {
      if (!(options.host.startsWith('[') && options.host.endsWith(']'))) {
        throw new TypeError('IPv6 hosts must be enclosed in brackets and ports are not supported');
      }
      try {
        const endpoint = new URL('ws://' + options.host + ':7778/');
        if (endpoint.hostname.toLowerCase() !== options.host.toLowerCase()) {
          throw new TypeError('host must be a valid hostname or IP address');
        }
      } catch {
        throw new TypeError('host must be a valid hostname or IP address');
      }
    }
    if (options.ssl !== undefined && typeof options.ssl !== 'boolean') {
      throw new TypeError('ssl must be a boolean');
    }
    if (options.autoReconnect !== undefined && typeof options.autoReconnect !== 'boolean') {
      throw new TypeError('autoReconnect must be a boolean');
    }
    if (!Number.isFinite(options.timeout) || (options.timeout ?? 0) <= 0) {
      throw new RangeError('timeout must be a positive finite number');
    }
    if (
      options.maxReconnectAttempts !== Infinity &&
      (!Number.isInteger(options.maxReconnectAttempts) || (options.maxReconnectAttempts ?? -1) < 0)
    ) {
      throw new RangeError('maxReconnectAttempts must be a non-negative integer or Infinity');
    }
    if (!Number.isFinite(options.reconnectInterval) || (options.reconnectInterval ?? -1) < 0) {
      throw new RangeError('reconnectInterval must be a non-negative finite number');
    }

    return {
      host: options.host,
      timeout: options.timeout ?? 5000,
      ssl: options.ssl ?? false,
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? Infinity,
      reconnectInterval: options.reconnectInterval ?? 3000,
    };
  }

  private notify<T>(callbacks: ReadonlySet<(value: T) => void>, value: T, eventName: string): void {
    callbacks.forEach((callback) => {
      try {
        callback(value);
      } catch (error) {
        console.error(`[NemWebSocket] ${eventName} callback failed`, error);
      }
    });
  }

  /**
   * WebSocket接続を作成
   */
  private createConnection(): void {
    const endPointHost = this.options.host;
    const timeout = this.options.timeout ?? 5000;
    const ssl = this.options.ssl ?? false;

    const protocol = ssl ? 'wss' : 'ws';
    const endPointPort = ssl ? '7779' : '7778';

    // クライアントを作成
    const client = new Client({
      connectionTimeout: timeout,
      reconnectDelay: 0, // 手動で再接続を管理
      webSocketFactory: () => new WebSocket(`${protocol}://${endPointHost}:${endPointPort}/w/messages/websocket`),
    });
    this._client = client;

    // クライアントエラー時の処理
    client.onWebSocketError = (event: WebSocket.ErrorEvent) => {
      if (this._client !== client) {
        return;
      }
      const contextualError = this.createContextualError(
        'network',
        'recoverable',
        event,
        (event as WebSocket.ErrorEvent).message || 'WebSocket network error'
      );
      if (this.errorCallbacks.size > 0) {
        this.notify(this.errorCallbacks, contextualError, 'error');
      } else {
        console.warn('[NemWebSocket]', contextualError);
      }
    };

    // クライアントクローズ時の処理
    client.onWebSocketClose = (event: WebSocket.CloseEvent) => {
      if (this._client !== client) {
        return;
      }
      this._isConnected = false;
      this._uid = null;
      this.subscriptions.clear();
      this.notify(this.closeCallbacks, event, 'close');

      if (!this.isManualDisconnect && this.options.autoReconnect) {
        this.attemptReconnect();
      }
    };

    // クライアント接続時の処理
    client.onConnect = (frame?: IFrame) => {
      if (this._client !== client) {
        return;
      }
      this._isConnected = true;
      // 再接続成功時はカウンターをリセット
      this.reconnectAttempts = 0;

      const connectionId = frame?.headers?.session ?? frame?.headers?.server ?? `${endPointHost}:${endPointPort}`;
      this._uid = connectionId;

      // 再接続時は既存のサブスクリプションを復元
      this.subscriptions.clear();
      this.activeSubscriptions.forEach((callbacks, subscribePath) => {
        callbacks.forEach((callback) => this.subscribe(subscribePath, callback));

        const publishRequest = this.activePublishRequests.get(subscribePath);
        if (publishRequest) {
          this.publish(publishRequest);
        }
      });

      // 接続コールバックを呼び出す。購読の復元後に呼ぶことで、callback 内で `on` を
      // 呼んでも既存 callback が二重にサブスクライブされない。
      this.notify(this.connectCallbacks, this._uid, 'connect');
    };

    // クライアント切断時の処理
    client.onDisconnect = () => {
      if (this._client !== client) {
        return;
      }
      this._isConnected = false;
      this._uid = null;
      // サブスクリプションをクリア（再接続時に復元される）
      this.subscriptions.clear();
    };

    // クライアントをアクティブ化
    client.activate();
  }

  /**
   * アクティブな購読を登録する
   *
   * @returns 新しく登録された場合はtrue
   */
  private addActiveSubscription(subscribePath: string, callback: (message: string) => void): boolean {
    let callbacks = this.activeSubscriptions.get(subscribePath);
    if (!callbacks) {
      callbacks = new Set();
      this.activeSubscriptions.set(subscribePath, callbacks);
    }

    if (callbacks.has(callback)) {
      return false;
    }

    callbacks.add(callback);
    return true;
  }

  /**
   * STOMPサブスクリプションを作成して追跡する
   */
  private subscribe(subscribePath: string, callback: (message: string) => void): void {
    const subscription = this._client.subscribe(subscribePath, (message) => {
      try {
        callback(message.body);
      } catch (error) {
        console.error('[NemWebSocket] subscription callback failed', error);
      }
    });
    let subscriptions = this.subscriptions.get(subscribePath);
    if (!subscriptions) {
      subscriptions = new Map();
      this.subscriptions.set(subscribePath, subscriptions);
    }
    subscriptions.set(callback, subscription);
  }

  /**
   * NIS1にアドレスの登録または初期データ取得を要求する
   */
  private publish(request: { destination: string; body: string }): void {
    this._client.publish(request);
  }

  /**
   * コンテキスト付きエラーを生成
   */
  private createContextualError(
    type: NemWebSocketErrorType,
    severity: NemWebSocketErrorSeverity,
    originalError: WebSocket.ErrorEvent | Error,
    message: string
  ): NemWebSocketError {
    return {
      type,
      severity,
      host: this.options.host,
      reconnecting: severity === 'recoverable' && this.reconnectAttempts > 0,
      reconnectAttempts: this.reconnectAttempts,
      originalError,
      timestamp: Date.now(),
      message,
    };
  }

  /**
   * 再接続を試みる
   */
  private attemptReconnect(): void {
    const maxAttempts = this.options.maxReconnectAttempts ?? Infinity;

    if (this.reconnectAttempts >= maxAttempts) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;

    // 再接続コールバックを呼び出す
    this.notify(this.reconnectCallbacks, this.reconnectAttempts, 'reconnect');

    const interval = this.options.reconnectInterval ?? 3000;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManualDisconnect) {
        this.createConnection();
      }
    }, interval);
  }

  /**
   * クライアントインスタンスを取得
   *
   * 高度な STOMP 操作が必要な場合に使用します。直接接続を停止・変更すると、このクラスが管理する接続状態と一致しなくなる可能性があります。
   */
  public get client(): Client {
    return this._client;
  }

  /**
   * 現在の接続の識別子。
   *
   * STOMP のセッション ID、サーバー識別子、または `host:port` のフォールバック値です。未接続時は `null` です。
   */
  public get uid(): string | null {
    return this._uid;
  }

  /**
   * STOMP 接続が確立済みかどうか。
   *
   * WebSocket の切断を検知すると `false` になり、次回の接続成功時に `true` になります。
   */
  public get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * WebSocket接続完了イベント登録
   *
   * 接続成功ごとに callback を呼び出します。すでに接続済みの場合は、その場で一度呼び出します。
   *
   * @param callback 接続識別子を受け取るコールバック
   */
  public onConnect(callback: (uid: string) => void): NemWebSocketUnsubscribe {
    this.connectCallbacks.add(callback);
    // すでに接続済みなら即時呼び出し
    if (this._isConnected) {
      this.notify(new Set([callback]), this._uid ?? this.options.host, 'connect');
    }
    return () => this.connectCallbacks.delete(callback);
  }

  /**
   * WebSocket再接続イベント登録
   *
   * 再接続をスケジュールする直前に callback を呼び出します。接続成功の通知ではありません。
   *
   * @param callback 1 始まりの再接続試行回数を受け取るコールバック
   */
  public onReconnect(callback: (attemptCount: number) => void): NemWebSocketUnsubscribe {
    this.reconnectCallbacks.add(callback);
    return () => this.reconnectCallbacks.delete(callback);
  }

  /**
   * チャネルサブスクメソッド
   *
   * アドレスを必要としないチャネルに callback を登録します。同じ callback を同じチャネルへ複数回登録しても一度だけ登録されます。
   *
   * @param channel アドレスを必要としないチャネル名
   * @param callback メッセージ本文を受け取るコールバック
   */
  on(channel: NemGlobalChannel, callback: (message: string) => void): NemWebSocketUnsubscribe;

  /**
   * チャネルサブスクメソッド
   *
   * アドレスを必要とするチャネルに callback を登録します。
   *
   * @param channel アドレスを必要とするチャネル名
   * @param address NEM アドレス
   * @param callback メッセージ本文を受け取るコールバック
   */
  on(channel: NemAddressChannel, address: string, callback: (message: string) => void): NemWebSocketUnsubscribe;

  /**
   * チャネルサブスクメソッド実装
   *
   * @param channel チャネル名
   * @param addressOrCallback アドレスまたはコールバック関数
   * @param callback コールバック関数
   */
  on(
    channel: NemChannel,
    addressOrCallback: string | ((message: string) => void),
    callback?: (message: string) => void
  ): NemWebSocketUnsubscribe {
    // 引数を解析
    const address = typeof addressOrCallback === 'string' ? addressOrCallback : undefined;
    const actualCallback = typeof addressOrCallback === 'function' ? addressOrCallback : callback!;

    const channelPath = nemChannelPaths[channel];
    if (!channelPath) {
      throw new TypeError(`Unknown channel: ${channel}`);
    }
    if (typeof actualCallback !== 'function') {
      throw new TypeError('callback must be a function');
    }

    // アドレスが必要なチャネルでアドレスが提供されていない場合、エラーをスロー
    if (typeof channelPath.subscribe === 'function' && !address) {
      throw new Error(`Address parameter is required for channel: ${channel}`);
    }
    if (address && /[\s/?#]/.test(address)) {
      throw new TypeError('address must not include whitespace or URL separators');
    }

    // サブスクライブパスを決定
    const subscribePath =
      typeof channelPath.subscribe === 'function' ? channelPath.subscribe(address) : channelPath.subscribe;
    if (!subscribePath) {
      throw new Error(`Subscribe path could not be determined for channel: ${channel}`);
    }

    const isFirstSubscription = !this.activeSubscriptions.has(subscribePath);
    const publishRequest =
      isFirstSubscription && channelPath.publish && address
        ? { destination: channelPath.publish, body: JSON.stringify({ address }) }
        : undefined;

    if (!this.addActiveSubscription(subscribePath, actualCallback)) {
      return () => this.removeSubscription(subscribePath, actualCallback);
    }
    if (publishRequest) {
      this.activePublishRequests.set(subscribePath, publishRequest);
    }

    // 接続されていない場合、接続時にアクティブな購読を復元する
    if (!this._isConnected) {
      return () => this.removeSubscription(subscribePath, actualCallback);
    }

    // サブスクライブを実行
    try {
      this.subscribe(subscribePath, actualCallback);
      if (publishRequest) {
        this.publish(publishRequest);
      }
    } catch (error) {
      this.removeSubscription(subscribePath, actualCallback);
      throw error;
    }
    return () => this.removeSubscription(subscribePath, actualCallback);
  }

  /**
   * WebSocketエラーイベント登録
   *
   * 下位 WebSocket のエラーを構造化して callback に通知します。
   *
   * @param callback 構造化エラーを受け取るコールバック
   */
  public onError(callback: (err: NemWebSocketError) => void): NemWebSocketUnsubscribe {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * WebSocketクローズイベント登録
   *
   * WebSocket が閉じたときに callback を呼び出します。複数の callback を登録できます。
   *
   * @param callback クローズイベントを受け取るコールバック
   */
  public onClose(callback: (event: WebSocket.CloseEvent) => void): NemWebSocketUnsubscribe {
    this.closeCallbacks.add(callback);
    return () => this.closeCallbacks.delete(callback);
  }

  /**
   * チャネルアンサブスクメソッド
   *
   * 指定チャネルのすべての callback とサブスクリプションを解除します。
   *
   * @param channel アドレスを必要としないチャネル名
   */
  off(channel: NemGlobalChannel): void;

  /**
   * チャネルアンサブスクメソッド
   *
   * 指定アドレスのチャネルに登録されたすべての callback とサブスクリプションを解除します。
   *
   * @param channel アドレスを必要とするチャネル名
   * @param address NEM アドレス
   */
  off(channel: NemAddressChannel, address: string): void;

  /**
   * チャネルアンサブスクメソッド実装
   *
   * @param channel チャネル名
   * @param address アドレス
   */
  off(channel: NemChannel, address?: string): void {
    const channelPath = nemChannelPaths[channel];
    if (!channelPath) {
      throw new TypeError(`Unknown channel: ${channel}`);
    }

    if (typeof channelPath.subscribe === 'function' && !address) {
      throw new Error(`Address parameter is required for channel: ${channel}`);
    }
    if (address && /[\s/?#]/.test(address)) {
      throw new TypeError('address must not include whitespace or URL separators');
    }

    // サブスクライブパスを決定
    const subscribePath =
      typeof channelPath.subscribe === 'function' ? channelPath.subscribe(address) : channelPath.subscribe;
    if (!subscribePath) {
      throw new Error(`Subscribe path could not be determined for channel: ${channel}`);
    }

    // アンサブスクライブを実行
    [...(this.activeSubscriptions.get(subscribePath) ?? [])].forEach((callback) =>
      this.removeSubscription(subscribePath, callback)
    );
  }

  private removeSubscription(subscribePath: string, callback: (message: string) => void): void {
    const subscriptions = this.subscriptions.get(subscribePath);
    subscriptions?.get(callback)?.unsubscribe();
    subscriptions?.delete(callback);
    if (subscriptions?.size === 0) this.subscriptions.delete(subscribePath);

    const callbacks = this.activeSubscriptions.get(subscribePath);
    callbacks?.delete(callback);
    if (callbacks?.size === 0) {
      this.activeSubscriptions.delete(subscribePath);
      this.activePublishRequests.delete(subscribePath);
    }
  }

  /**
   * WebSocket 接続を終了し、すべての callback と購読を破棄します。
   *
   * この操作は終端的です。自動再接続は行われず、同じインスタンスを再接続することはできません。
   */
  disconnect(): void {
    // 手動切断フラグを立てる
    this.isManualDisconnect = true;

    // 再接続タイマーをクリア
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // すべてのサブスクリプションを解除
    this.subscriptions.forEach((subscriptions) => subscriptions.forEach((subscription) => subscription.unsubscribe()));
    this.subscriptions.clear();
    this.activeSubscriptions.clear();
    this.activePublishRequests.clear();

    // すべてのコールバックをクリーンアップ
    this.errorCallbacks.clear();
    this.closeCallbacks.clear();
    this.connectCallbacks.clear();
    this.reconnectCallbacks.clear();

    // クライアントを非アクティブ化
    this._client.deactivate();
    this._isConnected = false;
    this._uid = null;
    this.reconnectAttempts = 0;
  }

  /**
   * `disconnect()` のエイリアス。
   */
  close(): void {
    this.disconnect();
  }
}
