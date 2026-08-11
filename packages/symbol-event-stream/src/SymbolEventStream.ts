import { SymbolWebSocket } from '@nemnesia/symbol-websocket';
import type { SymbolChannel } from '@nemnesia/symbol-websocket';

import { EventDeduplicator } from './EventDeduplicator.js';
import { SubscriptionRegistry } from './SubscriptionRegistry.js';
import type {
  AddressableSymbolChannel,
  ConnectCallback,
  DisconnectCallback,
  ErrorCallback,
  EventCallback,
  NodeConnectionStatus,
  SymbolEventStreamOptions,
} from './SymbolEventStreamTypes.js';

export type { NodeConnectionStatus, SymbolEventStreamOptions } from './SymbolEventStreamTypes.js';

interface BlacklistedNode {
  /** 切替候補から除外する対象ノード。 */
  nodeUrl: string;
  /** blacklistへ登録した時刻（エポックミリ秒）。 */
  timestamp: number;
}

/**
 * 複数の Symbol ノードからイベントを受信するストリーム。
 *
 * @remarks
 * インスタンス生成時に指定数の接続を開始します。同じチャネル・アドレス購読に同じ ID
 * （`meta.hash`、`hash`、`uid`、または `cosignature` の3識別フィールド）の通知が複数ノードから届いた
 * 場合は、`cacheTtl` の間は1回だけ配信します。別チャネルまたは別アドレス購読の通知は重複として扱いません。
 * {@link close} 後に接続を再開することはできません。再利用する場合は新しいインスタンスを作成してください。
 */
export class SymbolEventStream {
  private sockets: SymbolWebSocket[] = [];
  private readonly subscriptions: SubscriptionRegistry;
  private readonly deduplicator: EventDeduplicator;
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private connectCallbacks: Set<ConnectCallback> = new Set();
  private disconnectCallbacks: Set<DisconnectCallback> = new Set();
  private pendingCloseSockets: Set<SymbolWebSocket> = new Set();
  private replacingSockets: Set<SymbolWebSocket> = new Set();

  // WebSocketとノードURLのマッピング。切替元の識別に使用します。
  private socketNodeMap: Map<SymbolWebSocket, string> = new Map();
  // WebSocketと再接続試行回数のマッピング。切替閾値の判定に使用します。
  private socketReconnectCount: Map<SymbolWebSocket, number> = new Map();

  // ノード切り替え関連
  private readonly allNodeUrls: string[];
  private readonly maxReconnectBeforeSwitching: number;
  private blacklistedNodes: Map<string, BlacklistedNode> = new Map();
  private readonly blacklistTtl: number;
  /** blacklistの期限切れを削除するタイマー。重複排除タイマーはEventDeduplicatorが所有します。 */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private closed = false;

  /**
   * 接続を開始します。
   *
   * @param options 接続・重複排除の設定。
   * @throws {Error} `nodeUrls` が空、または数値設定が指定範囲外の場合。
   * @remarks
   * WebSocketの生成に失敗した場合は、その例外を呼び出し元へ伝播します。重複排除タイマーは
   * 全接続の生成後に開始するため、途中失敗時にタイマーだけが残らないようになっています。
   */
  constructor(options: SymbolEventStreamOptions) {
    const {
      nodeUrls,
      connections,
      ssl = true,
      maxCacheSize = 10_000,
      cacheTtl = 60_000,
      maxReconnectBeforeSwitching = 5,
      blacklistTtl = 300_000,
    } = options;

    if (nodeUrls.length === 0) {
      throw new Error('nodeUrls must not be empty');
    }
    if (!Number.isSafeInteger(connections) || connections < 1) {
      throw new Error('connections must be a positive integer');
    }
    if (!Number.isSafeInteger(maxCacheSize) || maxCacheSize < 1) {
      throw new Error('maxCacheSize must be a positive integer');
    }
    if (!Number.isFinite(cacheTtl) || cacheTtl <= 0) {
      throw new Error('cacheTtl must be a positive finite number');
    }
    if (!Number.isSafeInteger(maxReconnectBeforeSwitching) || maxReconnectBeforeSwitching < 1) {
      throw new Error('maxReconnectBeforeSwitching must be a positive integer');
    }
    if (!Number.isFinite(blacklistTtl) || blacklistTtl <= 0) {
      throw new Error('blacklistTtl must be a positive finite number');
    }

    this.deduplicator = new EventDeduplicator(maxCacheSize, cacheTtl);
    this.subscriptions = new SubscriptionRegistry((key, message) => this.dispatch(key, message));
    this.allNodeUrls = [...nodeUrls];
    this.maxReconnectBeforeSwitching = maxReconnectBeforeSwitching;
    this.blacklistTtl = blacklistTtl;

    const picked = this.pickNodes(nodeUrls, connections);

    try {
      for (const host of picked) {
        this.createWebSocketConnection(host, ssl);
      }

      this.deduplicator.start();
      // 定期的な重複排除キャッシュのクリーンアップは EventDeduplicator が管理します。
      this.cleanupInterval = setInterval(() => this.cleanupBlacklist(), this.blacklistTtl / 2);
    } catch (error) {
      // コンストラクタはインスタンスを返さないため、途中まで作成した接続をここで解放します。
      this.cleanupInitializationFailure();
      throw error;
    }
  }

  /**
   * 初期化失敗時に、コンストラクタが作成したリソースを解放します。
   *
   * @remarks
   * cleanup自身の例外で初期化時の元例外を隠さないよう、各WebSocketのclose失敗は無視します。
   */
  private cleanupInitializationFailure(): void {
    // close()由来のonClose/onError callbackが、失敗した初期化を再開しないようにします。
    this.closed = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.deduplicator.close();
    this.subscriptions.clear();
    this.pendingCloseSockets.clear();
    this.replacingSockets.clear();
    this.socketNodeMap.clear();
    this.socketReconnectCount.clear();
    this.blacklistedNodes.clear();

    for (const ws of this.sockets) {
      try {
        ws.close();
      } catch {
        // 初期化時の元例外を維持するため、closeの例外は無視します。
      }
    }
    this.sockets = [];
  }

  /**
   * WebSocket接続を作成
   *
   * @param host ノードURL
   * @param ssl SSL使用有無
   * @remarks
   * 接続イベントはここで一括登録します。切替後に作成されるWebSocketも同じcallback配線を通ります。
   */
  private createWebSocketConnection(host: string, ssl: boolean): void {
    const ws = new SymbolWebSocket({
      host,
      ssl,
      autoReconnect: true,
    });

    // callback登録中に例外が発生しても、初期化失敗時のcleanup対象から漏れないよう先に管理します。
    this.sockets.push(ws);

    // ノードとWebSocketのマッピングを保存
    this.socketNodeMap.set(ws, host);
    this.socketReconnectCount.set(ws, 0);

    // 接続イベント
    ws.onConnect((uid) => {
      // 接続成功したらカウントをリセット
      this.socketReconnectCount.set(ws, 0);
      this.notifyCallbacks(this.connectCallbacks, [host, uid], 'connect');
    });

    // 再接続イベント
    ws.onReconnect((attemptCount) => {
      this.pendingCloseSockets.delete(ws);
      this.socketReconnectCount.set(ws, attemptCount);

      // 最大再接続回数を超えたらノードを切り替え
      if (attemptCount >= this.maxReconnectBeforeSwitching) {
        this.switchNode(ws, ssl);
      }
    });

    // 切断イベント
    ws.onClose(() => {
      const wasReplacing = this.replacingSockets.delete(ws);
      this.notifyCallbacks(this.disconnectCallbacks, [host], 'disconnect');

      if (wasReplacing || this.closed) return;

      // SymbolWebSocket は通常の切断時、onClose の直後に onReconnect を呼ぶ。
      // 同じターン内に再接続通知がなければ terminal close とみなし、切替する。
      this.pendingCloseSockets.add(ws);
      queueMicrotask(() => {
        if (!this.pendingCloseSockets.delete(ws) || this.closed) return;
        this.switchNode(ws, ssl);
      });
    });

    // エラーイベント
    ws.onError((err) => {
      this.notifyCallbacks(this.errorCallbacks, [err], 'error');
      if (err.severity === 'fatal' && !this.closed) {
        this.switchNode(ws, ssl);
      }
    });
  }

  /**
   * ノードを切り替え
   *
   * @param oldWs 古いWebSocket
   * @param ssl SSL使用有無
   * @remarks
   * 明示的なcloseと切替用closeを区別するため、close前に`replacingSockets`へ登録します。
   * 既存購読の復元はSubscriptionRegistryへ委譲します。
   */
  private switchNode(oldWs: SymbolWebSocket, ssl: boolean): void {
    if (this.closed) return;

    const oldNode = this.socketNodeMap.get(oldWs);
    if (!oldNode) return;

    // 利用可能なノードを取得（ブラックリスト以外で未使用のノード）
    const availableNodes = this.getAvailableNodes();
    if (availableNodes.length === 0) {
      // 利用可能なノードがない場合は何もしない（既存の接続を維持）
      return;
    }

    // 実際に切り替えるノードだけをブラックリストに追加
    this.blacklistedNodes.set(oldNode, {
      nodeUrl: oldNode,
      timestamp: Date.now(),
    });

    // 新しいノードを選択
    const newNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];

    // 古いWebSocketをクリーンアップ
    this.pendingCloseSockets.delete(oldWs);
    this.replacingSockets.add(oldWs);
    oldWs.close();
    const index = this.sockets.indexOf(oldWs);
    if (index > -1) {
      this.sockets.splice(index, 1);
    }
    this.socketNodeMap.delete(oldWs);
    this.socketReconnectCount.delete(oldWs);

    // 新しいWebSocket接続を作成
    this.createWebSocketConnection(newNode, ssl);

    // サブスクリプションを再登録
    const newWs = this.sockets[this.sockets.length - 1];
    this.subscriptions.restore(newWs);
  }

  /**
   * 利用可能なノードを取得（ブラックリスト以外で未使用のノード）
   */
  private getAvailableNodes(): string[] {
    const usedNodes = new Set(this.socketNodeMap.values());
    return this.allNodeUrls.filter((nodeUrl) => !usedNodes.has(nodeUrl) && !this.blacklistedNodes.has(nodeUrl));
  }

  /**
   * ブラックリストをクリーンアップ（期限切れのエントリを削除）
   */
  private cleanupBlacklist(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [nodeUrl, entry] of this.blacklistedNodes.entries()) {
      if (now - entry.timestamp > this.blacklistTtl) {
        toDelete.push(nodeUrl);
      }
    }

    for (const nodeUrl of toDelete) {
      this.blacklistedNodes.delete(nodeUrl);
    }
  }

  /**
   * アドレスを指定せずにイベントを購読します。
   *
   * @param channel 購読する Symbol 通知チャネル。
   * @param callback 通知ごとに呼び出すコールバック。
   */
  public on<K extends SymbolChannel>(channel: K, callback: EventCallback<K>): void;

  /**
   * アドレスを指定してイベントを購読します。
   *
   * @param channel 購読する Symbol 通知チャネル。
   * @param address チャネルを絞り込む Symbol アドレス。
   * @param callback 通知ごとに呼び出すコールバック。
   */
  public on<K extends AddressableSymbolChannel>(channel: K, address: string, callback: EventCallback<K>): void;

  /**
   * イベント購読（実装）
   * @param channel チャネル
   * @param addressOrCallback アドレスまたはコールバック
   * @param maybeCallback コールバック（address指定時）
   */
  public on<K extends SymbolChannel>(
    channel: K,
    addressOrCallback: string | EventCallback<K>,
    maybeCallback?: EventCallback<K>
  ): void {
    this.subscriptions.on(this.sockets, channel, addressOrCallback, maybeCallback);
  }

  /**
   * アドレスを指定しない購読を解除します。
   *
   * @remarks
   * `callback` を省略すると、そのチャネルに登録されたすべてのコールバックを解除します。
   * 最後のコールバックを解除した時点で、すべての内部接続からも購読を解除します。
   *
   * @param channel 購読を解除する Symbol 通知チャネル。
   * @param callback 解除するコールバック。省略時はすべて解除します。
   */
  public off<K extends SymbolChannel>(channel: K, callback?: EventCallback<K>): void;

  /**
   * アドレスを指定した購読を解除します。
   *
   * @param channel 購読を解除する Symbol 通知チャネル。
   * @param address 購読時に指定した Symbol アドレス。
   * @param callback 解除するコールバック。省略時はそのアドレスのすべてを解除します。
   */
  public off<K extends AddressableSymbolChannel>(channel: K, address: string, callback?: EventCallback<K>): void;

  /**
   * イベント解除（実装）
   * @param channel チャネル
   * @param addressOrCallback アドレスまたはコールバック
   * @param maybeCallback コールバック（address指定時）
   */
  public off<K extends SymbolChannel>(
    channel: K,
    addressOrCallback?: string | EventCallback<K>,
    maybeCallback?: EventCallback<K>
  ): void {
    this.subscriptions.off(this.sockets, channel, addressOrCallback, maybeCallback);
  }

  /**
   * WebSocket エラーのコールバックを登録します。
   *
   * @param callback 構造化された WebSocket エラーを受け取るコールバック。
   */
  public onError(callback: ErrorCallback): void {
    this.errorCallbacks.add(callback);
  }

  /**
   * ノード接続完了時のコールバックを登録します。
   *
   * @remarks
   * 初回接続と自動再接続の両方で呼び出されます。登録時点ですでに Gateway UID を受信済みの
   * ノードについても、直ちに 1 回呼び出されます。
   *
   * @param callback ノードのホスト名と Gateway UID を受け取るコールバック。
   */
  public onConnect(callback: ConnectCallback): void {
    this.connectCallbacks.add(callback);

    // すでに接続済みのノードがあれば即座にコールバックを呼び出す
    for (const ws of this.sockets) {
      if (ws.isConnected && ws.uid) {
        const nodeUrl = this.socketNodeMap.get(ws);
        if (nodeUrl) {
          this.notifyCallbacks(new Set([callback]), [nodeUrl, ws.uid], 'connect');
        }
      }
    }
  }

  /**
   * ノード切断時のコールバックを登録します。
   *
   * @remarks
   * 予期しない切断と、ノード切り替えのための切断で呼び出されます。{@link close} による
   * 明示的な終了時は、登録済みコールバックを破棄します。
   *
   * @param callback 切断したノードのホスト名を受け取るコールバック。
   */
  public onDisconnect(callback: DisconnectCallback): void {
    this.disconnectCallbacks.add(callback);
  }

  /**
   * 内部ディスパッチ（重複排除付き）
   *
   * @param key コールバックキー
   * @param message 受信メッセージ
   */
  private dispatch(key: string, message: unknown): void {
    // 重複排除を先に行い、通過した通知だけを購読callbackへ渡します。
    if (!this.deduplicator.shouldDispatch(key, message)) return;
    this.subscriptions.dispatch(key, message);
  }

  /** 接続・切断・エラーcallbackを個別に実行し、利用者例外を隔離します。 */
  private notifyCallbacks<T extends unknown[]>(
    callbacks: ReadonlySet<(...args: T) => void>,
    args: T,
    eventName: string
  ): void {
    [...callbacks].forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[SymbolEventStream] ${eventName} callback failed`, error);
      }
    });
  }

  /**
   * ノード選出（ランダム）
   *
   * @param urls ノードURLリスト
   * @param count 選出数
   * @returns 選出されたノードURLリスト
   */
  private pickNodes(urls: string[], count: number): string[] {
    const shuffled = [...urls].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, urls.length));
  }

  /**
   * すべての接続と登録済みコールバックを破棄します。
   *
   * @remarks
   * このメソッドは冪等です。終了後に接続・購読を再開することはできません。
   */
  public close(): void {
    if (this.closed) return;

    this.closed = true;

    // クリーンアップタイマーを停止
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.deduplicator.close();

    // 全てのWebSocket接続を閉じる
    for (const ws of this.sockets) {
      ws.close();
    }

    // リソースをクリア
    this.sockets = [];
    this.subscriptions.clear();
    this.errorCallbacks.clear();
    this.connectCallbacks.clear();
    this.disconnectCallbacks.clear();
    this.pendingCloseSockets.clear();
    this.replacingSockets.clear();
    this.socketNodeMap.clear();
    this.socketReconnectCount.clear();
    this.blacklistedNodes.clear();
  }

  /**
   * 管理中の WebSocket 接続数を取得します。
   *
   * @remarks
   * 接続完了済みの数ではありません。実際に OPEN 状態の接続数は {@link getConnectedNodes} の
   * 長さで確認してください。
   *
   * @returns 管理中の WebSocket 接続数。
   */
  public getActiveConnectionCount(): number {
    return this.sockets.length;
  }

  /**
   * このストリームが終了済みかどうかを確認します。
   *
   * @returns {@link close} が呼ばれた後は `true`。
   */
  public getIsClosed(): boolean {
    return this.closed;
  }

  /**
   * 少なくとも 1 つの内部 WebSocket が OPEN 状態かどうかを確認します。
   *
   * @returns 1 つ以上の WebSocket が OPEN 状態なら `true`。
   */
  public isConnected(): boolean {
    return this.sockets.some((ws) => ws.isConnected);
  }

  /**
   * OPEN 状態のノード一覧を取得します。
   *
   * @returns 接続中のノードのホスト名または IP アドレス。
   */
  public getConnectedNodes(): string[] {
    const connectedNodes: string[] = [];
    for (const ws of this.sockets) {
      if (ws.isConnected) {
        const nodeUrl = this.socketNodeMap.get(ws);
        if (nodeUrl) {
          connectedNodes.push(nodeUrl);
        }
      }
    }
    return connectedNodes;
  }

  /**
   * 管理中の全ノードの接続状態を取得します。
   *
   * @returns ノードごとの接続状態と Gateway UID。
   */
  public getConnectionStatus(): NodeConnectionStatus[] {
    return this.sockets.map((ws) => ({
      nodeUrl: this.socketNodeMap.get(ws) || 'unknown',
      connected: ws.isConnected,
      uid: ws.uid,
    }));
  }

  /**
   * 一時的に切り替え候補から除外されているノード一覧を取得します。
   *
   * @returns ブラックリストの有効期限内にあるノードのホスト名または IP アドレス。
   */
  public getBlacklistedNodes(): string[] {
    return Array.from(this.blacklistedNodes.keys());
  }
}
