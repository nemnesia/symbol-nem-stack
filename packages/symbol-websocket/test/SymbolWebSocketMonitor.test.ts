import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { SymbolWebSocket } from '../src/SymbolWebSocket.js';
import type { SymbolWebSocketOptions } from '../src/symbol.types.js';
import type { SymbolNotificationMap } from '../src/symbolNotifications.types.js';

// WebSocketのモック
const sendMock = vi.fn();
const oncloseMock = vi.fn();
const onerrorMock = vi.fn();
const onmessageMock = vi.fn();
const webSocketConstructorMock = vi.fn();

vi.mock('isomorphic-ws', () => {
  return {
    default: function WebSocketMock(url: string) {
      webSocketConstructorMock(url);
      return {
        send: sendMock,
        onclose: oncloseMock,
        onerror: onerrorMock,
        onmessage: onmessageMock,
        close: vi.fn(),
      };
    },
  };
});

const defaultOptions: SymbolWebSocketOptions = {
  host: 'localhost',
  timeout: 1000,
  ssl: false,
};

describe('SymbolWebSocketMonitor', () => {
  let monitor: SymbolWebSocket;

  beforeEach(() => {
    sendMock.mockClear();
    webSocketConstructorMock.mockClear();
    // @ts-ignore
    monitor = new SymbolWebSocket(defaultOptions);
  });

  it('エラーなくインスタンス化されるべきである', () => {
    expect(monitor).toBeInstanceOf(SymbolWebSocket);
  });

  describe('host validation', () => {
    it.each([
      'trusted.example@attacker.example',
      'trusted.example\\attacker.example',
      'node.example:3000',
      'node.example/path',
    ])('URL authority の混入を拒否するべきである: %s', (host) => {
      webSocketConstructorMock.mockClear();
      expect(() => new SymbolWebSocket({ host, timeout: 0, ssl: false })).toThrow();
      expect(webSocketConstructorMock).not.toHaveBeenCalled();
    });

    it('hostname、IPv4、IPv6 を接続 URLへ正しく変換するべきである', () => {
      webSocketConstructorMock.mockClear();

      new SymbolWebSocket({ host: 'node.example', timeout: 0, ssl: false });
      expect(webSocketConstructorMock).toHaveBeenLastCalledWith('ws://node.example:3000/ws');

      new SymbolWebSocket({ host: '127.0.0.1', timeout: 0, ssl: false });
      expect(webSocketConstructorMock).toHaveBeenLastCalledWith('ws://127.0.0.1:3000/ws');

      new SymbolWebSocket({ host: '[2001:db8::1]', timeout: 0, ssl: true });
      expect(webSocketConstructorMock).toHaveBeenLastCalledWith('wss://[2001:db8::1]:3001/ws');
    });
  });

  it('エラーコールバックが登録され、エラー時に呼び出されるべきである', () => {
    const cb = vi.fn();
    monitor.onError(cb);
    // @ts-ignore
    monitor.client.onerror({ type: 'error' });
    expect(cb).toHaveBeenCalled();
  });

  it('クローズコールバックが登録され、クローズ時に呼び出されるべきである', () => {
    const cb = vi.fn();
    monitor.onClose(cb);
    // @ts-ignore
    monitor.client.onclose({ type: 'close' });
    expect(cb).toHaveBeenCalled();
  });

  it('uidが設定されていない場合、pendingSubscribesに追加されるべきである', () => {
    // @ts-ignore
    monitor._uid = null;
    // @ts-ignore
    monitor.on('block', vi.fn());
    // @ts-ignore
    expect(monitor.pendingSubscribes.size).toBe(1);
  });

  it('uidが設定されている場合、sendが呼び出されるべきである', () => {
    // @ts-ignore
    monitor._uid = 'test-uid';
    // @ts-ignore
    monitor.client.readyState = 1; // simulate OPEN
    // @ts-ignore
    monitor.on('block', vi.fn());
    expect(sendMock).toHaveBeenCalled();
  });

  it('unsubscribe時にsendが呼び出されるべきである', () => {
    // @ts-ignore
    monitor._uid = 'test-uid';
    // @ts-ignore
    monitor.client.readyState = 1; // simulate OPEN
    // @ts-ignore
    monitor.off('block');
    expect(sendMock).toHaveBeenCalled();
  });

  describe('Wire payloads', () => {
    it('基底channelのsubscribeとunsubscribeを完全なJSONで送信するべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const unsubscribe = monitor.on('block', vi.fn());

      expect(sendMock).toHaveBeenLastCalledWith(JSON.stringify({ uid: 'test-uid', subscribe: 'block' }));

      sendMock.mockClear();
      unsubscribe();

      expect(sendMock).toHaveBeenCalledWith(JSON.stringify({ uid: 'test-uid', unsubscribe: 'block' }));
    });

    it('アドレス付きchannelのsubscribeとunsubscribeを完全なJSONで送信するべきである', () => {
      const address = 'TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y';
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const unsubscribe = monitor.on('confirmedAdded', address, vi.fn());

      expect(sendMock).toHaveBeenLastCalledWith(
        JSON.stringify({ uid: 'test-uid', subscribe: `confirmedAdded/${address}` })
      );

      sendMock.mockClear();
      unsubscribe();

      expect(sendMock).toHaveBeenCalledWith(
        JSON.stringify({ uid: 'test-uid', unsubscribe: `confirmedAdded/${address}` })
      );
    });

    it('空アドレスのchannelを基底pathとして完全なJSONで送信するべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const unsubscribe = monitor.on('confirmedAdded', '', vi.fn());

      expect(sendMock).toHaveBeenLastCalledWith(JSON.stringify({ uid: 'test-uid', subscribe: 'confirmedAdded' }));

      sendMock.mockClear();
      unsubscribe();

      expect(sendMock).toHaveBeenCalledWith(JSON.stringify({ uid: 'test-uid', unsubscribe: 'confirmedAdded' }));
    });

    it('購読解除関数はcallback単位で解除し、最後の解除時だけunsubscribeを送信するべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const firstUnsubscribe = monitor.on('block', vi.fn());
      const secondUnsubscribe = monitor.on('block', vi.fn());
      sendMock.mockClear();

      firstUnsubscribe();
      expect(sendMock).not.toHaveBeenCalled();

      secondUnsubscribe();
      expect(sendMock).toHaveBeenCalledWith(JSON.stringify({ uid: 'test-uid', unsubscribe: 'block' }));
    });
  });

  it('JSONパースエラー時にエラーコールバックが呼び出されるべきである', () => {
    const cb = vi.fn();
    monitor.onError(cb);
    // @ts-ignore
    monitor.client.onmessage({ data: '{invalid json' });
    expect(cb).toHaveBeenCalled();
  });

  it('エラーコールバックが登録されていない場合、JSONパースエラーを警告して処理を継続するべきである', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-ignore
    expect(() => monitor.client.onmessage({ data: '{invalid json' })).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('最初のメッセージを処理し、uidを設定し、pendingSubscribesをフラッシュするべきである', () => {
    // @ts-ignore
    monitor.isFirstMessage = true;
    // @ts-ignore
    monitor.pendingSubscribes = new Set(['block', 'confirmedAdded']);
    // @ts-ignore
    monitor.client.onmessage({ data: JSON.stringify({ uid: 'abc123' }) });
    // @ts-ignore
    expect(monitor._uid).toBe('abc123');
    // @ts-ignore
    expect(monitor.pendingSubscribes.size).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('特定のトピックに対してすべてのコールバックが呼び出されるべきである', () => {
    // @ts-ignore
    monitor.isFirstMessage = false;
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    // @ts-ignore
    monitor.eventCallbacks.set('block', new Set([cb1, cb2]));
    // @ts-ignore
    monitor.client.onmessage({ data: JSON.stringify({ topic: 'block', foo: 'bar' }) });
    expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ topic: 'block', foo: 'bar' }));
    expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ topic: 'block', foo: 'bar' }));
  });

  it('アドレス指定通知のtopicはアドレス付き形式で配送されるべきである', () => {
    expectTypeOf<SymbolNotificationMap['confirmedAdded']['topic']>().toEqualTypeOf<
      'confirmedAdded' | `confirmedAdded/${string}`
    >();
    expectTypeOf<SymbolNotificationMap['block']['topic']>().toEqualTypeOf<'block'>();

    const address = 'TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y';
    const callback = vi.fn<(message: SymbolNotificationMap['confirmedAdded']) => void>();
    // @ts-ignore
    monitor._uid = 'test-uid';
    // @ts-ignore
    monitor.client.readyState = 1;
    // @ts-ignore
    monitor.isFirstMessage = false;
    // @ts-ignore
    monitor.on('confirmedAdded', address, callback);

    // @ts-ignore
    monitor.client.onmessage({ data: JSON.stringify({ topic: `confirmedAdded/${address}`, data: {} }) });

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ topic: `confirmedAdded/${address}` }));
  });

  it('登録されていないトピックの場合、コールバックが呼び出されないべきである', () => {
    // @ts-ignore
    monitor.isFirstMessage = false;
    const cb = vi.fn();
    // @ts-ignore
    monitor.eventCallbacks.set('block', new Set([cb]));
    // @ts-ignore
    monitor.client.onmessage({ data: JSON.stringify({ topic: 'other', foo: 'bar' }) });
    expect(cb).not.toHaveBeenCalled();
  });

  it('同じsubscribePathに対して複数のコールバックが許可されるべきである', () => {
    // @ts-ignore
    monitor._uid = 'test-uid';
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    // @ts-ignore
    monitor.on('block', cb1);
    // @ts-ignore
    monitor.on('block', cb2);
    // @ts-ignore
    expect(monitor.eventCallbacks.get('block')?.size).toBe(2);
  });

  it('uidが設定されていない場合、off呼び出し時に例外がスローされないべきである', () => {
    // @ts-ignore
    monitor._uid = null;
    // @ts-ignore
    expect(() => monitor.off('block')).not.toThrow();
  });

  it('接続前に解除された保留中の購読を送信しないべきである', () => {
    // @ts-ignore
    monitor.on('block', vi.fn());
    // @ts-ignore
    monitor.off('block');

    // @ts-ignore
    monitor.client.onmessage({ data: JSON.stringify({ uid: 'test-uid' }) });

    expect(sendMock).not.toHaveBeenCalled();
    // @ts-ignore
    expect(monitor.activeSubscriptions.has('block')).toBe(false);
  });

  it('イベントコールバックの例外をパースエラーとして扱わないべきである', () => {
    const errorCallback = vi.fn();
    monitor.onError(errorCallback);
    // @ts-ignore
    monitor.isFirstMessage = false;
    // @ts-ignore
    monitor.eventCallbacks.set(
      'block',
      new Set([
        () => {
          throw new Error('callback failed');
        },
      ])
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // @ts-ignore
    expect(() => monitor.client.onmessage({ data: JSON.stringify({ topic: 'block' }) })).not.toThrow();
    expect(errorCallback).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('[SymbolWebSocket] subscription callback failed', expect.any(Error));
    errorSpy.mockRestore();
  });

  describe('SymbolWebSocketMonitor extra branches', () => {
    let monitor: SymbolWebSocket;
    let clientMock: any;

    beforeEach(() => {
      // @ts-ignore
      monitor = new SymbolWebSocket(defaultOptions);
      // @ts-ignore
      clientMock = monitor.client;
      // reset mocks if present
      if (clientMock.send && (clientMock.send as any).mockClear) (clientMock.send as any).mockClear();
      if (clientMock.close && (clientMock.close as any).mockClear) (clientMock.close as any).mockClear();
      // Ensure the mocked WebSocket class provides OPEN/CONNECTING constants
      // so that comparisons in the module under test behave as expected.

      const wsMod = require('isomorphic-ws');
      if (wsMod && wsMod.default) {
        // @ts-ignore
        wsMod.default.OPEN = 1;
        // @ts-ignore
        wsMod.default.CONNECTING = 0;
      }
    });

    it('SSL=true でインスタンス化できます', () => {
      const options: SymbolWebSocketOptions = { host: 'example', timeout: 2000, ssl: true };
      expect(() => new SymbolWebSocket(options)).not.toThrow();
    });

    it('on sends when uid present and socket OPEN', () => {
      // @ts-ignore
      monitor._uid = 'uid-1';
      // @ts-ignore
      monitor.client.readyState = 1; // WebSocket.OPEN
      // @ts-ignore
      monitor.on('block', vi.fn());
      // @ts-ignore
      expect(monitor.client.send).toHaveBeenCalled();
    });

    it('uidが存在しソケットがOPEN状態の場合、登録解除を送信するべきである', () => {
      // @ts-ignore
      monitor._uid = 'uid-2';
      // @ts-ignore
      monitor.client.readyState = 1; // WebSocket.OPEN
      // @ts-ignore
      monitor.off('block');
      // @ts-ignore
      expect(monitor.client.send).toHaveBeenCalled();
    });

    it('disconnect は OPEN 時にソケットを閉じるべきである', () => {
      // @ts-ignore
      monitor._uid = 'uid-3';
      // @ts-ignore
      monitor.isFirstMessage = false;
      // @ts-ignore
      monitor.client.readyState = 1; // OPEN
      // ensure close exists
      // @ts-ignore
      monitor.client.close = vi.fn();

      monitor.disconnect();

      // @ts-ignore
      expect(monitor.client.close).toHaveBeenCalled();
      // @ts-ignore
      expect(monitor.uid).toBeNull();
      // @ts-ignore
      expect(monitor.isFirstMessage).toBe(true);
    });

    it('disconnect後に旧clientからUIDを受信しても接続状態を復活させないべきである', () => {
      // @ts-ignore
      const oldClient = monitor.client;

      monitor.disconnect();
      sendMock.mockClear();

      // @ts-ignore
      oldClient.onmessage({ data: JSON.stringify({ uid: 'late-uid' }) });

      expect(monitor.uid).toBeNull();
      // @ts-ignore
      expect(monitor.isFirstMessage).toBe(true);
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('自動再接続が有効な場合、切断時に再接続を試みるべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      // @ts-ignore
      const reconnectMonitor = new SymbolWebSocket(options);

      const reconnectCallback = vi.fn();
      reconnectMonitor.onReconnect(reconnectCallback);

      // @ts-ignore
      reconnectMonitor.isManualDisconnect = false;
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });

      vi.advanceTimersByTime(1000);

      expect(reconnectCallback).toHaveBeenCalledWith(1);
    });

    it('onReconnect callback内でdisconnectした場合、再接続タイマーを作成しないべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      // @ts-ignore
      const reconnectMonitor = new SymbolWebSocket(options);
      // @ts-ignore
      const oldClient = reconnectMonitor.client;
      reconnectMonitor.onReconnect(() => reconnectMonitor.disconnect());

      // @ts-ignore
      reconnectMonitor.isManualDisconnect = false;
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });

      // @ts-ignore
      expect(reconnectMonitor.reconnectTimer).toBeNull();
      // @ts-ignore
      expect(reconnectMonitor.client).toBe(oldClient);
    });

    it('maxReconnectAttemptsに達したら再接続を停止するべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectInterval: 500,
      };
      // @ts-ignore
      const reconnectMonitor = new SymbolWebSocket(options);

      // @ts-ignore
      reconnectMonitor.isManualDisconnect = false;

      // 1回目
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });
      vi.advanceTimersByTime(500);

      // 2回目
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });
      vi.advanceTimersByTime(500);

      // 3回目は試みない
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });
      vi.advanceTimersByTime(500);

      // @ts-ignore
      expect(reconnectMonitor.reconnectAttempts).toBe(2);
    });

    it('手動切断時は再接続しないべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
      };
      // @ts-ignore
      const reconnectMonitor = new SymbolWebSocket(options);

      const reconnectCallback = vi.fn();
      reconnectMonitor.onReconnect(reconnectCallback);

      reconnectMonitor.disconnect();
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });

      vi.advanceTimersByTime(5000);

      expect(reconnectCallback).not.toHaveBeenCalled();
    });

    it('再接続成功時にactiveSubscriptionsを復元するべきである', () => {
      // @ts-ignore
      monitor._uid = 'initial-uid';
      // @ts-ignore
      monitor.client.readyState = 1;
      // @ts-ignore
      monitor.isFirstMessage = false;

      // 既にサブスクライブ済み
      // @ts-ignore
      monitor.activeSubscriptions.add('block');
      // @ts-ignore
      monitor.activeSubscriptions.add('confirmedAdded');

      sendMock.mockClear();

      // 再接続をシミュレート
      // @ts-ignore
      monitor.isFirstMessage = true;
      // @ts-ignore
      monitor.client.onmessage({ data: JSON.stringify({ uid: 'new-uid' }) });

      // activeSubscriptionsの復元を確認
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('"subscribe":"block"'));
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('"subscribe":"confirmedAdded"'));
    });

    it('再接続待機中に追加した購読を新しい接続で送信するべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 500,
      };
      // @ts-ignore
      const reconnectMonitor = new SymbolWebSocket(options);
      // @ts-ignore
      reconnectMonitor._uid = 'old-uid';
      // @ts-ignore
      reconnectMonitor.isFirstMessage = false;
      // @ts-ignore
      reconnectMonitor.client.readyState = 3;
      // @ts-ignore
      reconnectMonitor.client.onclose({ type: 'close' });

      // @ts-ignore
      reconnectMonitor.on('status', vi.fn());
      // @ts-ignore
      expect(reconnectMonitor.pendingSubscribes.has('status')).toBe(true);

      vi.advanceTimersByTime(500);
      // @ts-ignore
      reconnectMonitor.client.onmessage({ data: JSON.stringify({ uid: 'new-uid' }) });

      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('"subscribe":"status"'));
    });

    it('切断済み接続のタイムアウトで再接続後のソケットを閉じないべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 500,
      };
      // @ts-ignore
      const reconnectMonitor = new SymbolWebSocket(options);
      const errorCallback = vi.fn();
      reconnectMonitor.onError(errorCallback);
      // @ts-ignore
      const oldClient = reconnectMonitor.client;
      // @ts-ignore
      oldClient.readyState = 3;
      // @ts-ignore
      oldClient.onclose({ type: 'close' });

      vi.advanceTimersByTime(500);
      // @ts-ignore
      const newClient = reconnectMonitor.client;
      newClient.close = vi.fn();
      // @ts-ignore
      newClient.readyState = 0;

      vi.advanceTimersByTime(500);
      expect(newClient.close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(newClient.close).toHaveBeenCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledWith(expect.objectContaining({ type: 'timeout' }));
    });
  });

  describe('Connection callbacks', () => {
    it('onConnectコールバックが接続時に呼び出されるべきである', () => {
      const connectCallback = vi.fn();
      monitor.onConnect(connectCallback);

      // @ts-ignore
      monitor.isFirstMessage = true;
      // @ts-ignore
      monitor.client.onmessage({ data: JSON.stringify({ uid: 'test-uid' }) });

      expect(connectCallback).toHaveBeenCalledWith('test-uid');
    });

    it('既に接続済みの場合、onConnectは即座に呼び出されるべきである', () => {
      // @ts-ignore
      monitor._uid = 'existing-uid';

      const connectCallback = vi.fn();
      monitor.onConnect(connectCallback);

      expect(connectCallback).toHaveBeenCalledWith('existing-uid');
    });

    it('onConnectの解除関数は対象callbackだけを解除するべきである', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();
      const unsubscribe = monitor.onConnect(firstCallback);
      monitor.onConnect(secondCallback);

      unsubscribe();
      // @ts-ignore
      monitor.client.onmessage({ data: JSON.stringify({ uid: 'test-uid' }) });

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith('test-uid');
    });

    it('onReconnectの解除関数は対象callbackだけを解除するべきである', () => {
      vi.useFakeTimers();
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();
      const unsubscribe = monitor.onReconnect(firstCallback);
      monitor.onReconnect(secondCallback);

      unsubscribe();
      // @ts-ignore
      monitor.isManualDisconnect = false;
      // @ts-ignore
      monitor.client.onclose({ type: 'close' });

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith(1);
      monitor.disconnect();
      vi.useRealTimers();
    });

    it('onErrorの解除関数は対象callbackだけを解除するべきである', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();
      const unsubscribe = monitor.onError(firstCallback);
      monitor.onError(secondCallback);

      unsubscribe();
      // @ts-ignore
      monitor.client.onerror({ type: 'error', message: 'network error' });

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalled();
    });

    it('onCloseの解除関数は対象callbackだけを解除するべきである', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();
      const unsubscribe = monitor.onClose(firstCallback);
      monitor.onClose(secondCallback);

      unsubscribe();
      // @ts-ignore
      monitor.isManualDisconnect = true;
      // @ts-ignore
      monitor.client.onclose({ type: 'close' });

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith({ type: 'close' });
    });
  });

  describe('Connection state', () => {
    it('isConnectedプロパティがOPEN状態を正しく返すべきである', () => {
      // @ts-ignore
      monitor.client.readyState = 1; // OPEN
      expect(monitor.isConnected).toBe(true);

      // @ts-ignore
      monitor.client.readyState = 0; // CONNECTING
      expect(monitor.isConnected).toBe(false);

      // @ts-ignore
      monitor.client.readyState = 2; // CLOSING
      expect(monitor.isConnected).toBe(false);

      // @ts-ignore
      monitor.client.readyState = 3; // CLOSED
      expect(monitor.isConnected).toBe(false);
    });
  });

  describe('Address-based subscriptions', () => {
    it('addressを指定してsubscribeできるべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const callback = vi.fn();
      // @ts-ignore
      monitor.on('unconfirmedAdded', 'TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y', callback);

      expect(sendMock).toHaveBeenCalledWith(
        expect.stringContaining('unconfirmedAdded/TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y')
      );
    });

    it('16進 namespace ID を指定してsubscribeできるべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const callback = vi.fn();
      // @ts-ignore
      monitor.on('confirmedAdded', 'C0FB8AA409916260', callback);

      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('confirmedAdded/C0FB8AA409916260'));
    });

    it('空のアドレスはアドレスなし購読として処理されるべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      const callback = vi.fn();
      // @ts-ignore
      monitor.on('confirmedAdded', '', callback);

      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('"subscribe":"confirmedAdded"'));
      expect(sendMock).not.toHaveBeenCalledWith(expect.stringContaining('confirmedAdded/'));
    });

    it.each(['NAAAA', 'not-a-symbol-address', 'T' + 'A'.repeat(37) + '0', 'C0FB8AA40991626G'])(
      '不正なアドレスを送信前に拒否するべきである: %s',
      (address) => {
        // @ts-ignore
        monitor._uid = 'test-uid';
        // @ts-ignore
        monitor.client.readyState = 1;
        sendMock.mockClear();

        expect(() => {
          // @ts-ignore
          monitor.on('confirmedAdded', address, vi.fn());
        }).toThrow('address must be empty');
        expect(sendMock).not.toHaveBeenCalled();
      }
    );

    it('offでも不正なアドレスを送信前に拒否するべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;
      sendMock.mockClear();

      expect(() => {
        // @ts-ignore
        monitor.off('confirmedAdded', 'NAAAA');
      }).toThrow('address must be empty');
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('addressを指定してunsubscribeできるべきである', () => {
      // @ts-ignore
      monitor._uid = 'test-uid';
      // @ts-ignore
      monitor.client.readyState = 1;

      sendMock.mockClear();
      // @ts-ignore
      monitor.off('unconfirmedAdded', 'TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y');

      expect(sendMock).toHaveBeenCalledWith(
        expect.stringContaining('unconfirmedAdded/TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y')
      );
    });
  });

  describe('disconnect cleanup', () => {
    it('disconnect時にすべてのコールバックをクリーンアップするべきである', () => {
      monitor.onError(vi.fn());
      monitor.onConnect(vi.fn());
      monitor.onReconnect(vi.fn());
      // @ts-ignore
      monitor.on('block', vi.fn());

      monitor.disconnect();

      // @ts-ignore
      expect(monitor.errorCallbacks.size).toBe(0);
      // @ts-ignore
      expect(monitor.connectCallbacks.size).toBe(0);
      // @ts-ignore
      expect(monitor.reconnectCallbacks.size).toBe(0);
      // @ts-ignore
      expect(monitor.eventCallbacks.size).toBe(0);
      // @ts-ignore
      expect(monitor.activeSubscriptions.size).toBe(0);
    });

    it('CONNECTING状態でもdisconnectできるべきである', () => {
      // @ts-ignore
      monitor.client.readyState = 0; // CONNECTING
      // @ts-ignore
      monitor.client.close = vi.fn();

      expect(() => monitor.disconnect()).not.toThrow();
      // @ts-ignore
      expect(monitor.client.close).toHaveBeenCalled();
    });

    it('disconnect後に再接続タイマーをクリアするべきである', () => {
      vi.useFakeTimers();

      // @ts-ignore
      monitor.reconnectTimer = setTimeout(() => {}, 5000);

      monitor.disconnect();

      // @ts-ignore
      expect(monitor.reconnectTimer).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Options defaults', () => {
    it('オプションのデフォルト値が正しく設定されるべきである', () => {
      const minimalOptions: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
      };
      // @ts-ignore
      const defaultMonitor = new SymbolWebSocket(minimalOptions);

      // @ts-ignore
      expect(defaultMonitor.options.autoReconnect).toBe(true);
      // @ts-ignore
      expect(defaultMonitor.options.maxReconnectAttempts).toBe(Infinity);
      // @ts-ignore
      expect(defaultMonitor.options.reconnectInterval).toBe(3000);
    });
  });

  describe('Options validation', () => {
    const invalidOptions = (override: Record<string, unknown>): SymbolWebSocketOptions =>
      ({ host: 'test-host', timeout: 0, ssl: false, ...override }) as unknown as SymbolWebSocketOptions;

    it.each([
      [{ timeout: -1 }, 'timeout must be a non-negative finite number'],
      [{ timeout: Infinity }, 'timeout must be a non-negative finite number'],
      [{ ssl: 'true' }, 'ssl must be a boolean'],
      [{ autoReconnect: 'true' }, 'autoReconnect must be a boolean'],
      [{ maxReconnectAttempts: 1.5 }, 'maxReconnectAttempts must be a non-negative integer or Infinity'],
      [{ reconnectInterval: -1 }, 'reconnectInterval must be a non-negative finite number'],
    ])('不正な接続オプションを拒否するべきである: %j', (override, message) => {
      expect(() => new SymbolWebSocket(invalidOptions(override))).toThrow(message);
    });
  });

  describe('接続タイムアウト', () => {
    it('timeout指定時にタイマーが設定されるべきである', () => {
      vi.useFakeTimers();
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 5000,
        ssl: false,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      // @ts-ignore
      expect(testMonitor.connectionTimeoutTimer).not.toBeNull();
      vi.useRealTimers();
    });

    it('timeout未指定時はデフォルトのタイマーが設定されるべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        ssl: false,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      // @ts-ignore
      expect(testMonitor.connectionTimeoutTimer).not.toBeNull();
    });

    it('接続成功時にタイムアウトタイマーがクリアされるべきである', () => {
      vi.useFakeTimers();
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 5000,
        ssl: false,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      // 初期状態でタイマーが設定されている
      // @ts-ignore
      expect(testMonitor.connectionTimeoutTimer).not.toBeNull();

      // uid受信をシミュレート
      // @ts-ignore
      testMonitor._client.onmessage({ data: JSON.stringify({ uid: 'test-uid-123' }) });

      // タイマーがクリアされている
      // @ts-ignore
      expect(testMonitor.connectionTimeoutTimer).toBeNull();
      vi.useRealTimers();
    });

    it('disconnect時にタイムアウトタイマーがクリアされるべきである', () => {
      vi.useFakeTimers();
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 5000,
        ssl: false,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      // @ts-ignore
      expect(testMonitor.connectionTimeoutTimer).not.toBeNull();

      testMonitor.disconnect();

      // @ts-ignore
      expect(testMonitor.connectionTimeoutTimer).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('構造化エラー処理', () => {
    it('createContextualErrorがエラーコンテキストを正しく生成するべきである', () => {
      const errorCallback = vi.fn();
      monitor.onError(errorCallback);

      // @ts-ignore
      monitor.reconnectAttempts = 3;
      // @ts-ignore
      monitor.client.onerror({ message: 'test network error', type: 'error' });

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'network',
          severity: 'recoverable',
          host: 'localhost',
          reconnecting: true,
          reconnectAttempts: 3,
          message: 'test network error',
          timestamp: expect.any(Number),
        })
      );
    });

    it('parseエラー時にcontextualErrorが生成されるべきである', () => {
      const errorCallback = vi.fn();
      monitor.onError(errorCallback);

      // @ts-ignore
      monitor.client.onmessage({ data: '{invalid json' });

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parse',
          severity: 'recoverable',
          message: 'Failed to parse WebSocket message',
        })
      );
    });

    it('エラーコールバックがない場合にconsole.warnが呼ばれるべきである', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // @ts-ignore
      monitor.errorCallbacks = [];
      // @ts-ignore
      monitor.client.onerror({ message: 'test error', type: 'error' });

      expect(warnSpy).toHaveBeenCalledWith(
        '[SymbolWebSocket]',
        expect.objectContaining({
          type: 'network',
          message: 'test error',
        })
      );

      warnSpy.mockRestore();
    });

    it('timeout時にfatalエラーが生成されるべきである', () => {
      vi.useFakeTimers();
      const errorCallback = vi.fn();

      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);
      testMonitor.onError(errorCallback);

      // @ts-ignore
      testMonitor._client.readyState = 0; // CONNECTING

      vi.advanceTimersByTime(1000);

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'timeout',
          severity: 'fatal',
          message: 'Connection timeout',
        })
      );

      vi.useRealTimers();
    });

    it('timeout時でエラーコールバックがない場合にconsole.warnが呼ばれるべきである', () => {
      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);
      // @ts-ignore
      testMonitor._client.readyState = 0; // CONNECTING

      vi.advanceTimersByTime(1000);

      expect(warnSpy).toHaveBeenCalledWith(
        '[SymbolWebSocket]',
        expect.objectContaining({
          type: 'timeout',
          severity: 'fatal',
        })
      );

      warnSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('fatalエラー時の再接続制御', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('fatalエラー時は再接続を試みないべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      const reconnectCallback = vi.fn();
      testMonitor.onReconnect(reconnectCallback);

      // fatalエラーをシミュレート
      // @ts-ignore
      testMonitor.isFatalError = true;
      // @ts-ignore
      testMonitor.isManualDisconnect = false;
      // @ts-ignore
      testMonitor._client.onclose({ type: 'close' });

      vi.advanceTimersByTime(5000);

      expect(reconnectCallback).not.toHaveBeenCalled();
    });

    it('timeout後にoncloseでfatalフラグがリセットされるべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);
      testMonitor.onError(vi.fn());

      // @ts-ignore
      testMonitor._client.readyState = 0; // CONNECTING
      vi.advanceTimersByTime(1000);

      // @ts-ignore
      expect(testMonitor.isFatalError).toBe(true);

      // oncloseが呼ばれるとフラグがリセット
      // @ts-ignore
      testMonitor._client.onclose({ type: 'close' });

      // @ts-ignore
      expect(testMonitor.isFatalError).toBe(false);
    });

    it('disconnect時にfatalフラグがリセットされるべきである', () => {
      // @ts-ignore
      monitor.isFatalError = true;

      monitor.disconnect();

      // @ts-ignore
      expect(monitor.isFatalError).toBe(false);
    });
  });

  describe('再接続時の古いWebSocketクローズ', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('再接続時にOPEN状態の古いWebSocketがcloseされるべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      const closeSpy = vi.fn();
      // @ts-ignore
      testMonitor._client.close = closeSpy;
      // @ts-ignore
      testMonitor._client.readyState = 1; // OPEN

      // @ts-ignore
      testMonitor.isManualDisconnect = false;
      // @ts-ignore
      testMonitor._client.onclose({ type: 'close' });

      vi.advanceTimersByTime(1000);

      expect(closeSpy).toHaveBeenCalled();
    });

    it('再接続時にCONNECTING状態の古いWebSocketがcloseされるべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      const closeSpy = vi.fn();
      // @ts-ignore
      testMonitor._client.close = closeSpy;
      // @ts-ignore
      testMonitor._client.readyState = 0; // CONNECTING

      // @ts-ignore
      testMonitor.isManualDisconnect = false;
      // @ts-ignore
      testMonitor._client.onclose({ type: 'close' });

      vi.advanceTimersByTime(1000);

      expect(closeSpy).toHaveBeenCalled();
    });

    it('再接続時にCLOSED状態のWebSocketはcloseを呼ばないべきである', () => {
      const options: SymbolWebSocketOptions = {
        host: 'test-host',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      // @ts-ignore
      const testMonitor = new SymbolWebSocket(options);

      const closeSpy = vi.fn();
      // @ts-ignore
      testMonitor._client.close = closeSpy;
      // @ts-ignore
      testMonitor._client.readyState = 3; // CLOSED

      // @ts-ignore
      testMonitor.isManualDisconnect = false;
      // タイムアウトが発生した場合、_client.close()が呼ばれる
      // その後oncloseが呼ばれ、再接続タイマーが起動
      // 再接続時、CLOSED状態なのでcloseは呼ばれない

      // タイムアウトを進める前にクリア（タイムアウト処理をスキップ）
      if (testMonitor['connectionTimeoutTimer']) {
        clearTimeout(testMonitor['connectionTimeoutTimer']);
        // @ts-ignore
        testMonitor.connectionTimeoutTimer = null;
      }

      // @ts-ignore
      testMonitor._client.onclose({ type: 'close' });

      vi.advanceTimersByTime(1000);

      expect(closeSpy).not.toHaveBeenCalled();
    });
  });
});
