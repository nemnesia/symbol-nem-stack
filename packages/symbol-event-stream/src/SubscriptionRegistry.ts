import type { SymbolChannel, SymbolWebSocket } from '@nemnesia/symbol-websocket';

import type { AddressableSymbolChannel, EventCallback, InternalEventCallback } from './SymbolEventStreamTypes.js';

/** WebSocket callbackからEventStream本体へ通知を渡す関数。 */
type MessageDispatcher = (key: string, message: unknown) => void;

/**
 * 購読の登録・解除・WebSocket切替後の復元を担当します。
 *
 * @remarks
 * WebSocketへの登録が途中で失敗した場合は、登録済みのソケットを解除してから例外を
 * 再送出します。EventStreamの内部購読状態と実際の購読状態がずれないようにするためです。
 */
export class SubscriptionRegistry {
  private readonly callbacks = new Map<string, Set<InternalEventCallback>>();

  /**
   * @param dispatchMessage 受信通知を重複排除処理へ渡す関数。
   */
  public constructor(private readonly dispatchMessage: MessageDispatcher) {}

  /**
   * 指定した全WebSocketへ購読を登録し、購読キーにcallbackを追加します。
   * 同じキーへの2回目以降の登録では、WebSocket購読を重複作成しません。
   */
  public on<K extends SymbolChannel>(
    sockets: readonly SymbolWebSocket[],
    channel: K,
    addressOrCallback: string | EventCallback<K>,
    maybeCallback?: EventCallback<K>
  ): void {
    const address = typeof addressOrCallback === 'string' ? addressOrCallback : undefined;
    const callback = typeof addressOrCallback === 'function' ? addressOrCallback : maybeCallback!;
    const key = this.makeKey(channel, address);

    if (!this.callbacks.has(key)) {
      const attemptedSockets: SymbolWebSocket[] = [];
      try {
        for (const ws of sockets) {
          attemptedSockets.push(ws);
          this.subscribeSocket(ws, channel, address, key);
        }
      } catch (error) {
        for (const ws of attemptedSockets) {
          try {
            this.unsubscribeSocket(ws, channel, address);
          } catch {
            // 元の購読登録エラーを維持する。
          }
        }
        throw error;
      }

      this.callbacks.set(key, new Set());
    }

    this.callbacks.get(key)!.add(callback as InternalEventCallback);
  }

  /**
   * callbackまたは購読キー単位で購読を解除します。
   * 最後のcallbackがなくなった場合だけ、各WebSocketの購読も解除します。
   */
  public off<K extends SymbolChannel>(
    sockets: readonly SymbolWebSocket[],
    channel: K,
    addressOrCallback?: string | EventCallback<K>,
    maybeCallback?: EventCallback<K>
  ): void {
    const address = typeof addressOrCallback === 'string' ? addressOrCallback : undefined;
    const callback = (typeof addressOrCallback === 'function' ? addressOrCallback : maybeCallback) as
      InternalEventCallback | undefined;
    const key = this.makeKey(channel, address);
    const callbacks = this.callbacks.get(key);

    if (!callbacks) return;

    if (callback) {
      callbacks.delete(callback);
      if (callbacks.size > 0) return;
    }

    this.callbacks.delete(key);
    for (const ws of sockets) {
      this.unsubscribeSocket(ws, channel, address);
    }
  }

  /** 現在保持している全購読を新しいWebSocketへ復元します。失敗時は部分購読を解除します。 */
  public restore(ws: SymbolWebSocket): void {
    const attempted: Array<[SymbolChannel, string | undefined]> = [];
    try {
      for (const key of this.callbacks.keys()) {
        const [channel, address] = this.parseKey(key);
        attempted.push([channel, address]);
        this.subscribeSocket(ws, channel, address, key);
      }
    } catch (error) {
      for (const [channel, address] of attempted) {
        try {
          this.unsubscribeSocket(ws, channel, address);
        } catch {
          // 元の購読復元エラーを維持する。
        }
      }
      throw error;
    }
  }

  /** 指定キーの利用者callbackを例外隔離付きで実行します。 */
  public dispatch(key: string, message: unknown): void {
    const callbacks = this.callbacks.get(key);
    if (!callbacks) return;

    [...callbacks].forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        console.error(`[SymbolEventStream] event callback failed`, error);
      }
    });
  }

  /** 内部購読状態を破棄します。WebSocket自体のcloseは呼び出し元が行います。 */
  public clear(): void {
    this.callbacks.clear();
  }

  private subscribeSocket(ws: SymbolWebSocket, channel: SymbolChannel, address: string | undefined, key: string): void {
    if (address) {
      ws.on(channel as AddressableSymbolChannel, address, (message) => this.dispatchMessage(key, message));
    } else {
      ws.on(channel, (message) => this.dispatchMessage(key, message));
    }
  }

  private unsubscribeSocket(ws: SymbolWebSocket, channel: SymbolChannel, address: string | undefined): void {
    if (address) {
      ws.off(channel as AddressableSymbolChannel, address);
    } else {
      ws.off(channel);
    }
  }

  private parseKey(key: string): [SymbolChannel, string | undefined] {
    const parts = key.split(':');
    return [parts[0] as SymbolChannel, parts.length > 1 ? parts[1] : undefined];
  }

  private makeKey(channel: SymbolChannel, address?: string): string {
    return address ? `${channel}:${address}` : channel;
  }
}
