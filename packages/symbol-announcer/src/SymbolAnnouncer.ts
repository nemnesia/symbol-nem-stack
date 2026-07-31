import { SymbolWebSocket } from '@nemnesia/symbol-websocket';
import { EventEmitter } from 'events';

/** Symbol Gateway から受信する、トランザクションに関連する通知。 */
export interface SymbolAnnouncerNotification {
  data?: {
    meta?: { hash?: string };
    hash?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** SymbolAnnouncer が発行するイベント型。 */
export type SymbolAnnouncerEvents = {
  /** WebSocket 接続時。 */
  connected: () => void;
  /** 指定したトランザクションが承認された時。 */
  confirmedAdded: (message: SymbolAnnouncerNotification) => void;
  /** 指定したトランザクションのステータスを受信した時。 */
  status: (message: SymbolAnnouncerNotification) => void;
  /** REST API がアナウンス要求を受理した時。 */
  announced: (data: unknown) => void;
  /** 接続またはアナウンスでエラーが発生した時。 */
  error: (error: Error) => void;
};

/**
 * Symbol ノードへのトランザクションアナウンスと、結果の WebSocket 監視を行うクラス。
 *
 * @remarks インスタンス生成時に WebSocket 接続を開始します。`announce()` は接続完了後に
 * トランザクションを送信し、承認・ステータス通知を同じ署名者アドレスで監視します。
 */
export class SymbolAnnouncer extends EventEmitter {
  private readonly monitor: SymbolWebSocket;
  private readonly nodeUrl: string;

  /**
   * @param nodeUrl Symbol REST ノードの URL。`http:` または `https:` を指定します。
   */
  constructor(nodeUrl: string) {
    super();

    let url: URL;
    try {
      url = new URL(nodeUrl);
    } catch {
      throw new TypeError('nodeUrl must be a valid HTTP(S) URL');
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
      throw new TypeError('nodeUrl must be a valid HTTP(S) URL');
    }

    this.nodeUrl = url.origin;
    this.monitor = new SymbolWebSocket({
      host: url.hostname,
      ssl: url.protocol === 'https:',
      timeout: 5000,
    });
    this.monitor.onError((error) => this.emitError(new Error(error.message)));
  }

  /**
   * トランザクションをアナウンスし、承認・ステータス通知を監視します。
   *
   * @param signerAddress 署名者の Symbol アドレス。
   * @param transaction REST API に渡す JSON 形式のトランザクションペイロード。
   * @param transactionHash 監視対象のトランザクションハッシュ。
   */
  public announce(signerAddress: string, transaction: string, transactionHash: string): void {
    this.validateAnnouncement(signerAddress, transaction, transactionHash);

    let requestStarted = false;
    this.monitor.onConnect(() => {
      if (requestStarted) return;
      requestStarted = true;

      this.emit('connected');
      this.monitor.on('confirmedAdded', signerAddress, (message) => {
        const notification = message as unknown as SymbolAnnouncerNotification;
        if (notification.data?.meta?.hash === transactionHash) {
          this.emit('confirmedAdded', notification);
        }
      });
      this.monitor.on('status', signerAddress, (message) => {
        const notification = message as unknown as SymbolAnnouncerNotification;
        if (notification.data?.hash === transactionHash) {
          this.emit('status', notification);
        }
      });

      void this.sendAnnouncement(transaction);
    });
  }

  /** WebSocket 接続を切断します。 */
  public disconnect(): void {
    this.monitor.disconnect();
  }

  public on<K extends keyof SymbolAnnouncerEvents>(event: K, listener: SymbolAnnouncerEvents[K]): this {
    return super.on(event, listener);
  }

  public once<K extends keyof SymbolAnnouncerEvents>(event: K, listener: SymbolAnnouncerEvents[K]): this {
    return super.once(event, listener);
  }

  public emit<K extends keyof SymbolAnnouncerEvents>(event: K, ...args: Parameters<SymbolAnnouncerEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  private validateAnnouncement(signerAddress: string, transaction: string, transactionHash: string): void {
    if (typeof signerAddress !== 'string' || signerAddress.trim() === '' || /[\s/?#]/.test(signerAddress)) {
      throw new TypeError('signerAddress must be a non-empty address without URL separators');
    }
    if (typeof transaction !== 'string' || transaction.trim() === '') {
      throw new TypeError('transaction must be a non-empty JSON string');
    }
    try {
      JSON.parse(transaction);
    } catch {
      throw new TypeError('transaction must be a valid JSON string');
    }
    if (typeof transactionHash !== 'string' || transactionHash.trim() === '') {
      throw new TypeError('transactionHash must be a non-empty string');
    }
  }

  private async sendAnnouncement(transaction: string): Promise<void> {
    try {
      const response = await fetch(new URL('/transactions', this.nodeUrl).toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: transaction,
      });
      const data = await response.json();
      if (response.ok === false) {
        throw new Error(`Transaction announcement failed with HTTP ${response.status}`);
      }
      this.emit('announced', data);
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private emitError(error: Error): void {
    if (this.listenerCount('error') > 0) {
      this.emit('error', error);
    } else {
      console.error('[SymbolAnnouncer]', error);
    }
  }
}
