import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NemWebSocket } from '../src/NemWebSocket.js';
import type { NemWebSocketOptions } from '../src/nem.types.js';

const mockStompState = vi.hoisted(() => ({
  clients: [] as Array<Record<string, any>>,
  sockets: [] as Array<Record<string, any>>,
}));

// モック用
vi.mock('@stomp/stompjs', () => ({
  Client: function ClientMock(config: { webSocketFactory: () => unknown }) {
    const client = {
      activate: vi.fn(),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      publish: vi.fn(),
      unsubscribe: vi.fn(),
      deactivate: vi.fn(),
      forceDisconnect: vi.fn(),
      webSocketFactory: config.webSocketFactory,
      onWebSocketError: undefined,
      onWebSocketClose: undefined,
      onConnect: undefined,
      onStompError: undefined,
    };
    mockStompState.clients.push(client);
    return client;
  },
}));
vi.mock('isomorphic-ws', () => ({
  default: function WebSocketMock(url: string) {
    const socket = {
      url,
      readyState: 1,
      binaryType: 'arraybuffer',
      onopen: undefined,
      onerror: undefined,
      onclose: undefined,
      onmessage: undefined,
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
    };
    mockStompState.sockets.push(socket);
    return socket;
  },
}));

const defaultOptions: NemWebSocketOptions = {
  host: 'localhost',
  timeout: 1000,
  ssl: false,
};

describe('NemWebSocket', () => {
  let monitor: NemWebSocket;
  let clientMock: any;

  beforeEach(() => {
    mockStompState.clients.length = 0;
    mockStompState.sockets.length = 0;
    monitor = new NemWebSocket(defaultOptions);
    clientMock = monitor.client;
  });

  it('エラーなくインスタンス化されるべきである', () => {
    expect(monitor).toBeInstanceOf(NemWebSocket);
  });

  it('エラーコールバックが登録され、エラー時に呼び出されるべきである', () => {
    const cb = vi.fn();
    monitor.onError(cb);
    // @ts-ignore
    monitor.client.onWebSocketError({ type: 'error' });
    expect(cb).toHaveBeenCalled();
  });

  it('クローズコールバックが登録され、クローズ時に呼び出されるべきである', () => {
    const cb = vi.fn();
    monitor.onClose(cb);
    // @ts-ignore
    monitor.client.onWebSocketClose({ type: 'close' });
    expect(cb).toHaveBeenCalled();
  });

  it('不正な接続オプションを拒否するべきである', () => {
    expect(() => new NemWebSocket({ host: '' })).toThrow('host must be a non-empty hostname or IP address');
    expect(() => new NemWebSocket({ host: 'wss://node.example' })).toThrow('host must not include a protocol');
    expect(() => new NemWebSocket({ host: 'user@127.0.0.1' })).toThrow(
      'host must not include a protocol, path, port, userinfo, or URL separators'
    );
    expect(() => new NemWebSocket({ host: 'node\\example' })).toThrow(
      'host must not include a protocol, path, port, userinfo, or URL separators'
    );
    expect(() => new NemWebSocket({ host: 'node.example:7778' })).toThrow(
      'IPv6 hosts must be enclosed in brackets and ports are not supported'
    );
    expect(() => new NemWebSocket({ host: '[invalid]' })).toThrow('host must be a valid hostname or IP address');
    expect(() => new NemWebSocket({ host: 'node%41' })).toThrow('host must be a valid hostname or IP address');
    expect(() => new NemWebSocket({ host: 'node.example', timeout: 0 })).toThrow(
      'timeout must be a positive finite number'
    );
    expect(() => new NemWebSocket({ host: 'node.example', reconnectInterval: 0 })).toThrow(
      'reconnectInterval must be a positive finite number'
    );
    expect(() => new NemWebSocket({ host: 'node.example', maxReconnectAttempts: 1.5 })).toThrow(
      'maxReconnectAttempts must be a non-negative integer or Infinity'
    );
  });

  it('addressが必要だが提供されていない場合、例外がスローされるべきである', () => {
    // nemChannelPathsのaccountはfunction型
    expect(() => {
      monitor.on('account' as any, vi.fn());
    }).toThrow();
  });

  it.each([
    'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT'.slice(0, 39),
    'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT'.replace('A', '0'),
    'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT'.slice(0, -1) + 'A',
    'NALICELGU3IVY4DPJKHYLSSVYFFWYS5QPLYEZDJJ',
    'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJ\u0000',
  ])('不正なNEMアドレスを購読前に拒否するべきである: %s', (address) => {
    expect(() => monitor.on('account', address, vi.fn())).toThrow('address must be a valid NEM testnet address');
    expect(() => monitor.off('account', address)).toThrow('address must be a valid NEM testnet address');
  });

  it('有効な小文字アドレスを購読解除時にも正規化するべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';
    monitor.on('account', address, vi.fn());

    monitor.off('account', address.toLowerCase());

    expect(clientMock.subscribe.mock.results[0].value.unsubscribe).toHaveBeenCalled();
  });

  it('接続されていない場合、購読は接続時まで保持されるべきである', () => {
    // @ts-ignore
    monitor._isConnected = false;
    const callback = vi.fn();
    monitor.on('blocks', callback);
    // @ts-ignore
    expect(monitor.activeSubscriptions.get('/blocks')).toEqual(new Set([callback]));
  });

  it('接続されている場合、subscribeが呼び出されるべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const spy = vi.spyOn(clientMock, 'subscribe');
    monitor.on('blocks', vi.fn());
    expect(spy).toHaveBeenCalled();
  });

  it('アドレス付きチャネルの購読時にNISの初期取得をpublishするべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';

    monitor.on('account', address, vi.fn());

    expect(clientMock.publish).toHaveBeenCalledWith({
      destination: '/w/api/account/get',
      body: JSON.stringify({ account: address }),
    });
  });

  it('小文字アドレスをNISの大文字表記へ正規化して購読・publishするべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';

    monitor.on('account', address.toLowerCase(), vi.fn());

    expect(clientMock.subscribe).toHaveBeenCalledWith('/account/' + address, expect.any(Function));
    expect(clientMock.publish).toHaveBeenCalledWith({
      destination: '/w/api/account/get',
      body: JSON.stringify({ account: address }),
    });
  });

  it.each(['transactions', 'unconfirmed'] as const)(
    '%sの単独購読時にアドレス登録をpublishするべきである',
    (channel) => {
      // @ts-ignore
      monitor._isConnected = true;
      const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';

      monitor.on(channel, address, vi.fn());

      expect(clientMock.publish).toHaveBeenCalledWith({
        destination: '/w/api/account/subscribe',
        body: JSON.stringify({ account: address }),
      });
    }
  );

  it('同じアドレス付きチャネルに複数callbackを登録しても初期取得を重複publishしないべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';

    monitor.on('recenttransactions', address, vi.fn());
    monitor.on('recenttransactions', address, vi.fn());

    expect(clientMock.publish).toHaveBeenCalledTimes(1);
    expect(clientMock.publish).toHaveBeenCalledWith({
      destination: '/w/api/account/transfers/all',
      body: JSON.stringify({ account: address }),
    });
  });

  it('unsubscribeが呼び出されるべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    monitor.on('blocks', vi.fn());
    const unsubscribe = clientMock.subscribe.mock.results[0].value.unsubscribe;
    monitor.off('blocks');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('接続時に未接続中の購読が実行されるべきである', () => {
    // @ts-ignore
    monitor._isConnected = false;
    const cb = vi.fn();
    monitor.on('blocks', cb);
    // @ts-ignore
    expect(monitor.activeSubscriptions.get('/blocks')).toEqual(new Set([cb]));
    // onConnectを呼ぶ
    // @ts-ignore
    monitor.client.onConnect();
    expect(clientMock.subscribe).toHaveBeenCalledWith('/blocks', expect.any(Function));
  });

  it('接続コールバック内で登録した購読を二重に作成しないべきである', () => {
    const callback = vi.fn();
    monitor.onConnect(() => monitor.on('blocks', callback));

    // @ts-ignore
    monitor.client.onConnect();

    expect(clientMock.subscribe).toHaveBeenCalledTimes(1);
    monitor.off('blocks');
    expect(clientMock.subscribe.mock.results[0].value.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('未接続中に解除した購読は接続時に登録されないべきである', () => {
    const cb = vi.fn();
    monitor.on('blocks', cb);
    monitor.off('blocks');

    // @ts-ignore
    monitor.client.onConnect();

    expect(clientMock.subscribe).not.toHaveBeenCalled();
  });

  it('WebSocket切断後は接続状態とUIDをリセットするべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    // @ts-ignore
    monitor._uid = 'session-1';
    // @ts-ignore
    monitor.isManualDisconnect = true;
    monitor.on('blocks', vi.fn());

    // @ts-ignore
    monitor.client.onWebSocketClose({ type: 'close' });

    expect(monitor.isConnected).toBe(false);
    expect(monitor.uid).toBeNull();
    // @ts-ignore
    expect(monitor.subscriptions.size).toBe(0);
    expect(() => monitor.on('blocks', vi.fn())).not.toThrow();
  });

  it('同じチャネルの複数コールバックをすべて解除するべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    monitor.on('blocks', vi.fn());
    monitor.on('blocks', vi.fn());

    const firstUnsubscribe = clientMock.subscribe.mock.results[0].value.unsubscribe;
    const secondUnsubscribe = clientMock.subscribe.mock.results[1].value.unsubscribe;
    monitor.off('blocks');
    // @ts-ignore
    monitor.client.onConnect();

    expect(firstUnsubscribe).toHaveBeenCalled();
    expect(secondUnsubscribe).toHaveBeenCalled();
    expect(clientMock.subscribe).toHaveBeenCalledTimes(2);
  });

  it('サブスクライブされたメッセージを受信したときにコールバックが呼び出されるべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const cb = vi.fn();
    monitor.on('blocks', cb);
    // subscribe時のコールバックを取得
    const subscribeCall = clientMock.subscribe.mock.calls[0];
    const handler = subscribeCall[1];
    handler({ body: 'test-message' });
    expect(cb).toHaveBeenCalledWith('test-message');
  });

  it('購読解除関数は対象の callback だけを解除するべきである', () => {
    // @ts-ignore
    monitor._isConnected = true;
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = monitor.on('blocks', first);
    monitor.on('blocks', second);

    unsubscribeFirst();

    expect(clientMock.subscribe.mock.results[0].value.unsubscribe).toHaveBeenCalledTimes(1);
    expect(clientMock.subscribe.mock.results[1].value.unsubscribe).not.toHaveBeenCalled();
    // @ts-ignore
    expect(monitor.activeSubscriptions.get('/blocks')).toEqual(new Set([second]));
  });

  it('利用者 callback の例外で接続状態と購読復元を中断しないべきである', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    monitor.on('blocks', vi.fn());
    monitor.onConnect(() => {
      throw new Error('connect callback failed');
    });

    // @ts-ignore
    expect(() => monitor.client.onConnect()).not.toThrow();
    expect(monitor.isConnected).toBe(true);
    expect(clientMock.subscribe).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[NemWebSocket] connect callback failed', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('クライアントからのエラーおよびクローズイベントが伝播されるべきである', () => {
    const errorCb = vi.fn();
    const closeCb = vi.fn();
    monitor.onError(errorCb);
    monitor.onClose(closeCb);
    monitor.client.onWebSocketError({ type: 'error' });
    monitor.client.onWebSocketClose({ type: 'close' });
    expect(errorCb).toHaveBeenCalled();
    expect(closeCb).toHaveBeenCalled();
  });

  it('エラーコールバックが未登録の場合は警告が出力されるべきである', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    monitor.client.onWebSocketError({ type: 'error' } as any);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('STOMP ERRORをfatalとして通知し、自動再接続を停止するべきである', () => {
    const errorCallback = vi.fn();
    const reconnectCallback = vi.fn();
    monitor.onError(errorCallback);
    monitor.onReconnect(reconnectCallback);

    // @ts-ignore
    monitor.client.onStompError({ headers: { message: 'authentication failed' } });
    // @ts-ignore
    monitor.client.onWebSocketClose({ type: 'close' });

    expect(errorCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connection',
        severity: 'fatal',
        message: 'STOMP server error: authentication failed',
      })
    );
    expect(clientMock.forceDisconnect).toHaveBeenCalled();
    expect(reconnectCallback).not.toHaveBeenCalled();
  });

  it('巨大なアドレスはuppercase化する前に拒否するべきである', () => {
    const address = 'T' + 'A'.repeat(10_000_000);
    const toUpperCase = vi.spyOn(String.prototype, 'toUpperCase');

    expect(() => monitor.on('account', address, vi.fn())).toThrow('address must be a valid NEM testnet address');
    expect(toUpperCase).not.toHaveBeenCalled();
    toUpperCase.mockRestore();
  });

  it('接続時にuidが設定され、取得できるべきである', () => {
    // @ts-ignore
    monitor.client.onConnect({ headers: { session: 'session-1' } });
    expect(monitor.uid).toBe('session-1');
  });

  it('フレームにuidがない場合、フォールバックが設定されるべきである', () => {
    // @ts-ignore
    monitor.client.onConnect({ headers: {} });
    expect(monitor.uid).toBe('localhost:7778');
  });

  it('isConnectedは接続状態を返すべきである', () => {
    // @ts-ignore
    monitor._isConnected = false;
    expect(monitor.isConnected).toBe(false);
    // @ts-ignore
    monitor._isConnected = true;
    expect(monitor.isConnected).toBe(true);
  });

  it('clientが取得できるべきである', () => {
    expect(monitor.client).toBeDefined();
  });

  describe('追加の挙動', () => {
    let monitor: NemWebSocket;
    let clientMock: any;

    beforeEach(() => {
      mockStompState.clients.length = 0;
      mockStompState.sockets.length = 0;
      monitor = new NemWebSocket(defaultOptions);
      clientMock = monitor.client;
    });

    it.each([
      { ssl: false, endpoint: 'ws://example:7778/w/messages/websocket' },
      { ssl: true, endpoint: 'wss://example:7779/w/messages/websocket' },
    ])('ssl=$ssl の接続endpointが正しい', ({ ssl, endpoint }) => {
      const options: NemWebSocketOptions = { host: 'example', timeout: 1234, ssl };
      const sslMonitor = new NemWebSocket(options);

      expect((sslMonitor.client as any).webSocketFactory().url).toBe(endpoint);
    });

    it('STOMPフレームを転送し、上限超過時はWebSocketを切断する', () => {
      const socketFactory = (monitor.client as any).webSocketFactory;
      const guardedSocket = socketFactory();
      const messageHandler = vi.fn();
      guardedSocket.onmessage = messageHandler;
      const rawSocket = mockStompState.sockets.at(-1)!;

      rawSocket.onmessage({ data: 'MESSAGE\n\nbody\0' });
      expect(messageHandler).toHaveBeenCalledTimes(1);

      rawSocket.onmessage({ data: 'MESSAGE\ncontent-length:999999999999\n\n' });
      expect(rawSocket.close).toHaveBeenCalledWith(1009, 'STOMP frame exceeds the maximum size');
      expect(messageHandler).toHaveBeenCalledTimes(1);
    });

    it('切断すると、すべてのサブスクリプションが解除され、クライアントが無効化されます', () => {
      // @ts-ignore
      monitor._isConnected = true;
      const unsubSpy = vi.fn();
      // @ts-ignore
      monitor.subscriptions.set('/test', new Map([[vi.fn(), { unsubscribe: unsubSpy }]]));
      // ensure client has deactivate
      clientMock.deactivate = vi.fn();

      monitor.disconnect();

      expect(unsubSpy).toHaveBeenCalled();
      expect(clientMock.deactivate).toHaveBeenCalled();
      // @ts-ignore
      expect(monitor.subscriptions.size).toBe(0);
    });

    it('closeはdisconnectのエイリアスとして動作するべきである', () => {
      // @ts-ignore
      monitor._isConnected = true;
      // @ts-ignore
      monitor._uid = 'uid-1';
      clientMock.deactivate = vi.fn();

      monitor.close();

      expect(clientMock.deactivate).toHaveBeenCalled();
      expect(monitor.uid).toBeNull();
    });
  });

  describe('再接続機能', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('自動再接続が有効な場合、切断時に再接続を試みるべきである', () => {
      const options: NemWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      const reconnectMonitor = new NemWebSocket(options);

      const reconnectCallback = vi.fn();
      reconnectMonitor.onReconnect(reconnectCallback);

      // @ts-ignore
      reconnectMonitor.isManualDisconnect = false;
      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });

      vi.advanceTimersByTime(1000);

      expect(reconnectCallback).toHaveBeenCalledWith(1);
    });

    it('接続が30秒間安定した場合だけ再接続試行回数をリセットするべきである', () => {
      // @ts-ignore
      monitor._isConnected = false;
      // @ts-ignore
      monitor.reconnectAttempts = 2;
      // @ts-ignore
      monitor.client.onConnect();

      vi.advanceTimersByTime(29_999);
      // @ts-ignore
      expect(monitor.reconnectAttempts).toBe(2);
      vi.advanceTimersByTime(1);
      // @ts-ignore
      expect(monitor.reconnectAttempts).toBe(0);
    });

    it('再接続callback内で切断した場合はタイマーを登録しないべきである', () => {
      const reconnectMonitor = new NemWebSocket({
        host: 'localhost',
        autoReconnect: true,
        reconnectInterval: 1000,
      });
      const reconnectCallback = vi.fn(() => reconnectMonitor.disconnect());
      reconnectMonitor.onReconnect(reconnectCallback);
      const clientCount = mockStompState.clients.length;

      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });

      expect(reconnectCallback).toHaveBeenCalledWith(1);
      // @ts-ignore
      expect(reconnectMonitor.reconnectTimer).toBeNull();
      vi.advanceTimersByTime(1000);
      expect(mockStompState.clients).toHaveLength(clientCount);
    });

    it('close callback が例外を送出しても自動再接続を予約するべきである', () => {
      const options: NemWebSocketOptions = {
        host: 'localhost',
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      const reconnectMonitor = new NemWebSocket(options);
      const reconnectCallback = vi.fn();
      reconnectMonitor.onReconnect(reconnectCallback);
      reconnectMonitor.onClose(() => {
        throw new Error('close callback failed');
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // @ts-ignore
      expect(() => reconnectMonitor.client.onWebSocketClose({ type: 'close' })).not.toThrow();
      expect(reconnectCallback).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith('[NemWebSocket] close callback failed', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('maxReconnectAttemptsに達したら再接続を停止するべきである', () => {
      const options: NemWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectInterval: 500,
      };
      const reconnectMonitor = new NemWebSocket(options);

      // @ts-ignore
      reconnectMonitor.isManualDisconnect = false;

      // 1回目
      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });
      vi.advanceTimersByTime(500);

      // 2回目
      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });
      vi.advanceTimersByTime(500);

      // 3回目は試みない
      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });
      vi.advanceTimersByTime(500);

      // @ts-ignore
      expect(reconnectMonitor.reconnectAttempts).toBe(2);
    });

    it('手動切断時は再接続しないべきである', () => {
      const options: NemWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
      };
      const reconnectMonitor = new NemWebSocket(options);

      const reconnectCallback = vi.fn();
      reconnectMonitor.onReconnect(reconnectCallback);

      reconnectMonitor.disconnect();
      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });

      vi.advanceTimersByTime(5000);

      expect(reconnectCallback).not.toHaveBeenCalled();
    });

    it('再接続成功時にactiveSubscriptionsを復元するべきである', () => {
      // @ts-ignore
      monitor._isConnected = true;

      const cb1 = vi.fn();
      // 既にサブスクライブ済み
      monitor.on('blocks', cb1);

      const subscribeSpy = vi.spyOn(monitor.client, 'subscribe');

      // 再接続をシミュレート
      // @ts-ignore
      monitor._isConnected = false;
      // @ts-ignore
      monitor.client.onConnect();

      // activeSubscriptionsの復元を確認
      expect(subscribeSpy).toHaveBeenCalled();
    });

    it('新しいClientへの再接続時に購読とpublishを復元し、旧Clientのイベントを無視するべきである', () => {
      // @ts-ignore
      monitor._isConnected = true;
      const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';
      monitor.on('account', address.toLowerCase(), vi.fn());
      const closeCallback = vi.fn();
      monitor.onClose(closeCallback);
      const firstClient = monitor.client as any;
      firstClient.onWebSocketClose({ type: 'close' });
      vi.advanceTimersByTime(3000);

      expect(mockStompState.clients).toHaveLength(2);
      const secondClient = monitor.client as any;
      expect(secondClient).not.toBe(firstClient);

      closeCallback.mockClear();
      firstClient.onWebSocketClose({ type: 'late-close' });
      secondClient.onConnect({ headers: { session: 'session-2' } });

      expect(closeCallback).not.toHaveBeenCalled();
      // @ts-ignore
      expect(monitor.reconnectTimer).toBeNull();
      expect(secondClient.subscribe).toHaveBeenCalledWith('/account/' + address, expect.any(Function));
      expect(secondClient.publish).toHaveBeenCalledWith({
        destination: '/w/api/account/get',
        body: JSON.stringify({ account: address }),
      });
      expect(monitor.uid).toBe('session-2');
    });

    it('再接続前に解除した購読を新しいClientへ復元しないべきである', () => {
      // @ts-ignore
      monitor._isConnected = true;
      const unsubscribe = monitor.on('account', 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT', vi.fn());
      const firstClient = monitor.client as any;
      unsubscribe();
      firstClient.onWebSocketClose({ type: 'close' });
      vi.advanceTimersByTime(3000);

      const secondClient = monitor.client as any;
      secondClient.onConnect();

      expect(secondClient.subscribe).not.toHaveBeenCalled();
      expect(secondClient.publish).not.toHaveBeenCalled();
    });

    it('再接続成功時にアドレス付きチャネルの初期取得を再送するべきである', () => {
      // @ts-ignore
      monitor._isConnected = true;
      const address = 'TALICE6KJ2SRSIJFVVFFH6ICUIYZ2ZZGNFUDJGRT';
      monitor.on('accountMosaic', address, vi.fn());
      clientMock.publish.mockClear();

      // @ts-ignore
      monitor._isConnected = false;
      // @ts-ignore
      monitor.client.onConnect();

      expect(clientMock.publish).toHaveBeenCalledWith({
        destination: '/w/api/account/mosaic/owned',
        body: JSON.stringify({ account: address }),
      });
    });

    it('手動切断フラグが立っている場合は再接続を開始しないべきである', () => {
      const options: NemWebSocketOptions = {
        host: 'localhost',
        timeout: 1000,
        ssl: false,
        autoReconnect: true,
        reconnectInterval: 1000,
      };
      const reconnectMonitor = new NemWebSocket(options);
      const reconnectCallback = vi.fn();
      reconnectMonitor.onReconnect(reconnectCallback);

      // @ts-ignore
      reconnectMonitor.isManualDisconnect = true;
      // @ts-ignore
      reconnectMonitor.client.onWebSocketClose({ type: 'close' });

      vi.advanceTimersByTime(1000);

      expect(reconnectCallback).not.toHaveBeenCalled();
    });
  });

  describe('接続コールバック', () => {
    it('onConnectコールバックが接続時に呼び出されるべきである', () => {
      const connectCallback = vi.fn();
      monitor.onConnect(connectCallback);

      // @ts-ignore
      monitor.client.onConnect();

      expect(connectCallback).toHaveBeenCalledWith('localhost:7778');
    });

    it('既に接続済みの場合、onConnectは即座に呼び出されるべきである', () => {
      // @ts-ignore
      monitor._isConnected = true;
      // @ts-ignore
      monitor._uid = 'uid-1';

      const connectCallback = vi.fn();
      monitor.onConnect(connectCallback);

      expect(connectCallback).toHaveBeenCalledWith('uid-1');
    });
  });
});
