import type { SymbolWebSocketError } from '@nemnesia/symbol-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SymbolEventStream } from '../src/SymbolEventStream.js';

// WebSocketのモッククラス
class MockSymbolWebSocket {
  public on = vi.fn();
  public off = vi.fn();
  public close = vi.fn();
  public onError = vi.fn();
  public onConnect = vi.fn();
  public onClose = vi.fn();
  public onReconnect = vi.fn();
  public uid: string | null = 'test-uid';
  public isConnected = true;

  constructor(public options: any) {}
}

// グローバルなモックインスタンスの追跡
let mockInstances: MockSymbolWebSocket[] = [];
let mockConstructionError: Error | null = null;
let mockConstructionAttempt = 0;
let mockConstructionErrorOnAttempt = 0;
let mockRestoreFailureOnReplacement = false;

vi.mock('@nemnesia/symbol-websocket', () => {
  return {
    SymbolWebSocket: class {
      public on: any;
      public off: any;
      public close: any;
      public onError: any;
      public onConnect: any;
      public onClose: any;
      public onReconnect: any;
      public uid: string | null;
      public isConnected: boolean;
      public options: any;

      constructor(options: any) {
        mockConstructionAttempt += 1;
        if (mockConstructionError && mockConstructionAttempt === mockConstructionErrorOnAttempt) {
          const error = mockConstructionError;
          mockConstructionError = null;
          throw error;
        }

        const instance = new MockSymbolWebSocket(options);
        if (mockRestoreFailureOnReplacement && mockInstances.length > 0) {
          instance.on.mockImplementation((channel: string) => {
            if (channel === 'confirmedAdded') throw new TypeError('replacement subscription failed');
          });
          mockRestoreFailureOnReplacement = false;
        }
        mockInstances.push(instance);
        this.on = instance.on;
        this.off = instance.off;
        this.close = instance.close;
        this.onError = instance.onError;
        this.onConnect = instance.onConnect;
        this.onClose = instance.onClose;
        this.onReconnect = instance.onReconnect;
        this.uid = instance.uid;
        this.isConnected = instance.isConnected;
        this.options = instance.options;
        return instance;
      }
    },
  };
});

describe('SymbolEventStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstances = [];
    mockConstructionError = null;
    mockConstructionAttempt = 0;
    mockConstructionErrorOnAttempt = 0;
    mockRestoreFailureOnReplacement = false;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('コンストラクタ', () => {
    it('正常にインスタンス化されるべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 2,
      });

      expect(stream).toBeInstanceOf(SymbolEventStream);
      expect(stream.getActiveConnectionCount()).toBe(2);
    });

    it('nodewatchUrlsが空の場合、エラーをスローするべきである', () => {
      expect(() => {
        new SymbolEventStream({
          nodewatchUrls: [],
          connections: 1,
        });
      }).toThrow('nodewatchUrls must not be empty');
    });

    it.each([
      [{ connections: 0 }, 'connections must be a positive integer'],
      [{ connections: -1 }, 'connections must be a positive integer'],
      [{ maxCacheSize: 0 }, 'maxCacheSize must be a positive integer'],
      [{ cacheTtl: 0 }, 'cacheTtl must be a positive finite number'],
      [{ cacheTtl: Number.POSITIVE_INFINITY }, 'cacheTtl must be a positive finite number'],
      [{ maxReconnectBeforeSwitching: 0 }, 'maxReconnectBeforeSwitching must be a positive integer'],
      [{ blacklistTtl: 0 }, 'blacklistTtl must be a positive finite number'],
    ])('不正なオプション %o の場合、エラーをスローするべきである', (options, message) => {
      expect(() => {
        new SymbolEventStream({
          nodewatchUrls: ['https://node1.example.com:3001'],
          connections: 1,
          ...options,
        });
      }).toThrow(message);
    });

    it('NodeWatchのabsolute endpointを利用側の変換なしで受け付けるべきである', () => {
      new SymbolEventStream({
        nodewatchUrls: ['https://secure.example.com:3001', 'http://plain.example.com:3000'],
        connections: 2,
      });

      const optionsByHost = new Map(mockInstances.map((instance) => [instance.options.host, instance.options]));
      expect(optionsByHost.get('secure.example.com')).toMatchObject({ ssl: true });
      expect(optionsByHost.get('plain.example.com')).toMatchObject({ ssl: false });
    });

    it('標準ポートを省略したroot endpointを受け付けるべきである', () => {
      new SymbolEventStream({
        nodewatchUrls: ['https://secure.example.com/', 'http://plain.example.com'],
        connections: 2,
      });

      expect(mockInstances.map((instance) => instance.options)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ host: 'secure.example.com', ssl: true }),
          expect.objectContaining({ host: 'plain.example.com', ssl: false }),
        ])
      );
    });

    it.each([
      'node1.example.com',
      'ftp://node1.example.com',
      'not a URL',
      'https://node1.example.com:3443',
      'http://node1.example.com:8080',
      'https://node1.example.com:443',
      'http://node1.example.com:80',
      'https://node1.example.com/custom-path',
      'http://node1.example.com/custom-path',
      'https://node1.example.com?network=test',
      'http://node1.example.com#node',
    ])('完全endpoint以外を拒否するべきである: %s', (url) => {
      expect(() => {
        new SymbolEventStream({
          nodewatchUrls: ['https://valid.example.com:3001', url],
          connections: 1,
        });
      }).toThrow();
      expect(mockInstances).toHaveLength(0);
    });

    it('autoReconnectがtrueで設定されるべきである', () => {
      new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });

      expect(mockInstances[0].options).toMatchObject({
        autoReconnect: true,
      });
    });

    it('指定された数の接続を作成するべきである', () => {
      new SymbolEventStream({
        nodewatchUrls: [
          'https://node1.example.com:3001',
          'https://node2.example.com:3001',
          'https://node3.example.com:3001',
        ],
        connections: 3,
      });

      expect(mockInstances).toHaveLength(3);
    });

    it('接続の初期化に失敗した場合、先に作成した接続を解放して元の例外を再送出するべきである', () => {
      const initializationError = new Error('second connection failed');
      mockConstructionError = initializationError;
      mockConstructionErrorOnAttempt = 2;
      vi.useFakeTimers();

      try {
        expect(() => {
          new SymbolEventStream({
            nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
            connections: 2,
          });
        }).toThrow(initializationError);

        expect(mockInstances).toHaveLength(1);
        expect(mockInstances[0].close).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('nodewatchUrlsより多い接続数を指定しても、nodewatchUrlsの数までしか作成しないべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 5,
      });

      expect(stream.getActiveConnectionCount()).toBe(2);
    });
  });

  describe('on/off メソッド', () => {
    let stream: SymbolEventStream;

    beforeEach(() => {
      stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });
    });

    afterEach(() => {
      stream.close();
    });

    it('チャネル購読時、全てのWebSocketに対してonが呼ばれるべきである', () => {
      const callback = vi.fn();

      stream.on('block', callback);

      expect(mockInstances[0].on).toHaveBeenCalledWith('block', expect.any(Function));
    });

    it('アドレス指定のチャネル購読が正しく動作するべきである', () => {
      const callback = vi.fn();
      const address = 'TCHBDENCLKEBILBPWP3JPB2XNY64OE7PYHHE32I';

      stream.on('confirmedAdded', address, callback);

      expect(mockInstances[0].on).toHaveBeenCalledWith('confirmedAdded', address, expect.any(Function));
    });

    it('同じチャネルに複数のコールバックを登録できるべきである', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      stream.on('block', callback1);
      stream.on('block', callback2);

      // 初回のみWebSocketのonが呼ばれる
      expect(mockInstances[0].on).toHaveBeenCalledTimes(1);
    });

    it('off メソッドで特定のコールバックを削除できるべきである', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      stream.on('block', callback1);
      stream.on('block', callback2);
      stream.off('block', callback1);

      // WebSocketのoffは呼ばれない（まだcallback2が残っているため）
      expect(mockInstances[0].off).not.toHaveBeenCalled();
    });

    it('off メソッドで全てのコールバックを削除するとWebSocketもoffされるべきである', () => {
      const callback = vi.fn();

      stream.on('block', callback);
      stream.off('block', callback);

      expect(mockInstances[0].off).toHaveBeenCalledWith('block');
    });

    it('off メソッドでコールバック指定なしで全て削除できるべきである', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      stream.on('block', callback1);
      stream.on('block', callback2);
      stream.off('block');

      expect(mockInstances[0].off).toHaveBeenCalledWith('block');
    });

    it('アドレス指定のoffが正しく動作するべきである', () => {
      const callback = vi.fn();
      const address = 'TCHBDENCLKEBILBPWP3JPB2XNY64OE7PYHHE32I';

      stream.on('confirmedAdded', address, callback);
      stream.off('confirmedAdded', address);

      expect(mockInstances[0].off).toHaveBeenCalledWith('confirmedAdded', address);
    });
  });

  describe('エラーハンドリング', () => {
    let stream: SymbolEventStream;

    beforeEach(() => {
      stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });
    });

    afterEach(() => {
      stream.close();
    });

    it('onErrorでエラーコールバックを登録できるべきである', () => {
      const errorCallback = vi.fn();

      stream.onError(errorCallback);

      // WebSocketのonErrorが呼ばれていることを確認
      expect(mockInstances[0].onError).toHaveBeenCalled();

      // コールバックをシミュレート
      const wsErrorCallback = mockInstances[0].onError.mock.calls[0][0];
      const error: SymbolWebSocketError = {
        type: 'network',
        severity: 'recoverable',
        host: 'node1.example.com',
        reconnecting: false,
        reconnectAttempts: 0,
        timestamp: Date.now(),
        message: 'Test error',
        originalError: new Error('Test'),
      };

      wsErrorCallback(error);

      expect(errorCallback).toHaveBeenCalledWith(error);
    });
  });

  describe('重複排除機能', () => {
    let stream: SymbolEventStream;

    beforeEach(() => {
      vi.useFakeTimers();
      stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 2,
        maxCacheSize: 5,
        cacheTtl: 10000,
      });
    });

    afterEach(() => {
      stream.close();
      vi.useRealTimers();
    });

    it('同じhashを持つメッセージは1度だけ配信されるべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      // WebSocketのonコールバックを取得
      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      // 同じhashのメッセージを2回送信
      const message = { data: { meta: { hash: 'test-hash-123' } }, topic: 'block' };
      wsCallback(message);
      wsCallback(message);

      // コールバックは1度だけ呼ばれる
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('異なるWebSocketから届く同じ通知も1度だけ配信されるべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const firstWsCallback = mockInstances[0].on.mock.calls[0][1];
      const secondWsCallback = mockInstances[1].on.mock.calls[0][1];
      const message = { data: { meta: { hash: 'cross-node-hash' } }, topic: 'block' };

      firstWsCallback(message);
      secondWsCallback(message);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('異なるhashを持つメッセージは両方配信されるべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      wsCallback({ data: { meta: { hash: 'hash-1' } }, topic: 'block' });
      wsCallback({ data: { meta: { hash: 'hash-2' } }, topic: 'block' });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('TTL経過後は同じhashでも再配信されるべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      const message = { data: { meta: { hash: 'test-hash-123' } }, topic: 'block' };

      wsCallback(message);
      expect(callback).toHaveBeenCalledTimes(1);

      // TTL経過
      vi.advanceTimersByTime(11000);

      wsCallback(message);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('maxCacheSizeを超えると古いキャッシュが削除されるべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      // maxCacheSize + 1 個のメッセージを送信
      for (let i = 0; i < 6; i++) {
        wsCallback({ data: { meta: { hash: `hash-${i}` } }, topic: 'block' });
      }

      expect(callback).toHaveBeenCalledTimes(6);

      // 最初のhashは削除されているはずなので、再送信されるべき
      wsCallback({ data: { meta: { hash: 'hash-0' } }, topic: 'block' });
      expect(callback).toHaveBeenCalledTimes(7);
    });

    it('hashがないメッセージは重複排除されないべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      const message = { data: 'test-without-hash' };
      wsCallback(message);
      wsCallback(message);

      // hashがないので両方配信される
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('meta.hashの他にhashやuidもサポートするべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      // data.hashを使用
      wsCallback({ data: { hash: 'direct-hash' }, topic: 'block' });
      wsCallback({ data: { hash: 'direct-hash' }, topic: 'block' });

      expect(callback).toHaveBeenCalledTimes(1);

      // data.uidを使用
      wsCallback({ data: { uid: 'unique-id' }, topic: 'block' });
      wsCallback({ data: { uid: 'unique-id' }, topic: 'block' });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('cosignatureのparentHash・signerPublicKey・signatureで重複排除するべきである', () => {
      const callback = vi.fn();
      stream.on('cosignature', callback);

      const firstWsCallback = mockInstances[0].on.mock.calls[0][1];
      const secondWsCallback = mockInstances[1].on.mock.calls[0][1];
      const message = {
        topic: 'cosignature',
        data: {
          version: '1',
          parentHash: 'parent-hash',
          signerPublicKey: 'signer-key',
          signature: 'signature',
        },
      };

      firstWsCallback(message);
      secondWsCallback(message);
      secondWsCallback({ ...message, data: { ...message.data, signature: 'different-signature' } });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('文字列でないIDを重複排除キーへ使用するべきではない', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];
      wsCallback({ data: { meta: { hash: {} } }, topic: 'block' });
      wsCallback({ data: { meta: { hash: '[object Object]' } }, topic: 'block' });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('別チャネルで同じhashを持つメッセージはそれぞれ配信されるべきである', () => {
      const unconfirmedCallback = vi.fn();
      const confirmedCallback = vi.fn();
      stream.on('unconfirmedAdded', unconfirmedCallback);
      stream.on('confirmedAdded', confirmedCallback);

      const unconfirmedWsCallback = mockInstances[0].on.mock.calls[0][1];
      const confirmedWsCallback = mockInstances[0].on.mock.calls[1][1];
      const message = { data: { meta: { hash: 'transaction-hash' } } };

      unconfirmedWsCallback(message);
      confirmedWsCallback(message);

      expect(unconfirmedCallback).toHaveBeenCalledTimes(1);
      expect(confirmedCallback).toHaveBeenCalledTimes(1);
    });

    it('別アドレス購読で同じhashを持つメッセージはそれぞれ配信されるべきである', () => {
      const firstAddressCallback = vi.fn();
      const secondAddressCallback = vi.fn();
      stream.on('confirmedAdded', 'first-address', firstAddressCallback);
      stream.on('confirmedAdded', 'second-address', secondAddressCallback);

      const firstAddressWsCallback = mockInstances[0].on.mock.calls[0][2];
      const secondAddressWsCallback = mockInstances[0].on.mock.calls[1][2];
      const message = { data: { meta: { hash: 'transaction-hash' } } };

      firstAddressWsCallback(message);
      secondAddressWsCallback(message);

      expect(firstAddressCallback).toHaveBeenCalledTimes(1);
      expect(secondAddressCallback).toHaveBeenCalledTimes(1);
    });

    it('期限切れキャッシュが定期的にクリーンアップされるべきである', () => {
      const callback = vi.fn();
      stream.on('block', callback);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];

      // いくつかのメッセージを送信
      wsCallback({ data: { meta: { hash: 'hash-1' } }, topic: 'block' });
      wsCallback({ data: { meta: { hash: 'hash-2' } }, topic: 'block' });

      // TTLの半分経過（クリーンアップ実行）
      vi.advanceTimersByTime(5000);

      // まだTTL内なので再送信されない
      wsCallback({ data: { meta: { hash: 'hash-1' } }, topic: 'block' });
      expect(callback).toHaveBeenCalledTimes(2);

      // TTL経過後、さらにクリーンアップ実行
      vi.advanceTimersByTime(6000);

      // 期限切れなので再送信される
      wsCallback({ data: { meta: { hash: 'hash-1' } }, topic: 'block' });
      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('close メソッド', () => {
    it('全てのWebSocketを閉じるべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 2,
      });

      stream.close();

      expect(mockInstances[0].close).toHaveBeenCalled();
      expect(mockInstances[1].close).toHaveBeenCalled();
    });

    it('closeフラグがtrueになるべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });

      expect(stream.getIsClosed()).toBe(false);

      stream.close();

      expect(stream.getIsClosed()).toBe(true);
    });

    it('2回呼んでも問題ないべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });

      stream.close();
      stream.close();

      expect(stream.getIsClosed()).toBe(true);
    });

    it('クリーンアップタイマーが停止されるべきである', () => {
      vi.useFakeTimers();

      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });

      stream.close();

      // タイマーが進んでもクリーンアップが実行されないことを確認
      vi.advanceTimersByTime(100000);

      // エラーが発生しないことを確認
      expect(stream.getIsClosed()).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('購読登録の失敗処理', () => {
    it('一部のWebSocketで購読登録に失敗した場合は内部状態を残さない', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 2,
      });
      const callback = vi.fn();
      mockInstances[1].on.mockImplementationOnce(() => {
        throw new TypeError('invalid subscription');
      });

      expect(() => stream.on('block', callback)).toThrow('invalid subscription');
      expect(mockInstances[0].off).toHaveBeenCalledWith('block');

      mockInstances[1].on.mockImplementation(() => undefined);
      expect(() => stream.on('block', callback)).not.toThrow();
      expect(mockInstances[0].on).toHaveBeenCalledTimes(2);
      expect(mockInstances[1].on).toHaveBeenCalledTimes(2);

      stream.close();
    });
  });

  describe('callback例外の隔離', () => {
    let stream: SymbolEventStream;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorSpy.mockRestore();
      stream.close();
    });

    it('イベントcallbackの例外で後続callbackを中断しない', () => {
      const first = vi.fn(() => {
        throw new Error('event callback failed');
      });
      const second = vi.fn();
      stream.on('block', first);
      stream.on('block', second);

      const wsCallback = mockInstances[0].on.mock.calls[0][1];
      wsCallback({ data: { meta: { hash: 'event-callback' } }, topic: 'block' });

      expect(second).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('connect・disconnect・error callbackの例外で後続callbackを中断しない', () => {
      const firstConnect = vi.fn(() => {
        throw new Error('connect callback failed');
      });
      const secondConnect = vi.fn();
      stream.onConnect(firstConnect);
      stream.onConnect(secondConnect);
      mockInstances[0].onConnect.mock.calls[0][0]('uid-2');

      const firstDisconnect = vi.fn(() => {
        throw new Error('disconnect callback failed');
      });
      const secondDisconnect = vi.fn();
      stream.onDisconnect(firstDisconnect);
      stream.onDisconnect(secondDisconnect);
      mockInstances[0].onClose.mock.calls[0][0]({});

      const firstError = vi.fn(() => {
        throw new Error('error callback failed');
      });
      const secondError = vi.fn();
      stream.onError(firstError);
      stream.onError(secondError);
      mockInstances[0].onError.mock.calls[0][0]({
        type: 'network',
        severity: 'recoverable',
        host: 'node1.example.com',
        reconnecting: false,
        reconnectAttempts: 0,
        timestamp: Date.now(),
        message: 'network error',
        originalError: new Error('network error'),
      });

      expect(secondConnect).toHaveBeenCalledWith('https://node1.example.com:3001', 'uid-2');
      expect(secondDisconnect).toHaveBeenCalledWith('https://node1.example.com:3001');
      expect(secondError).toHaveBeenCalled();
    });
  });

  describe('ヘルパーメソッド', () => {
    it('getActiveConnectionCount が正しい接続数を返すべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: [
          'https://node1.example.com:3001',
          'https://node2.example.com:3001',
          'https://node3.example.com:3001',
        ],
        connections: 2,
      });

      expect(stream.getActiveConnectionCount()).toBe(2);

      stream.close();
    });

    it('getIsClosed がクローズ状態を正しく返すべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
      });

      expect(stream.getIsClosed()).toBe(false);

      stream.close();

      expect(stream.getIsClosed()).toBe(true);
    });
  });

  describe('ノード選択', () => {
    it('ランダムにノードが選択されるべきである', () => {
      // 複数回実行してランダム性を確認
      const hosts = new Set<string>();

      for (let i = 0; i < 10; i++) {
        vi.clearAllMocks();
        mockInstances = [];

        new SymbolEventStream({
          nodewatchUrls: [
            'https://node1.example.com:3001',
            'https://node2.example.com:3001',
            'https://node3.example.com:3001',
            'https://node4.example.com:3001',
          ],
          connections: 2,
        });

        const firstCall = mockInstances[0].options;
        hosts.add(firstCall.host);
      }

      // 複数のホストが選択されていることを確認（完全にランダムなので必ず全て選ばれるわけではない）
      expect(hosts.size).toBeGreaterThan(1);
    });
  });

  describe('接続管理機能', () => {
    let stream: SymbolEventStream;

    beforeEach(() => {
      stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 2,
      });
    });

    afterEach(() => {
      stream.close();
    });

    describe('onConnect', () => {
      it('接続コールバックが登録されるべきである', () => {
        const connectCallback = vi.fn();
        stream.onConnect(connectCallback);

        // 各WebSocketに対してonConnectが呼ばれていることを確認
        expect(mockInstances[0].onConnect).toHaveBeenCalled();
        expect(mockInstances[1].onConnect).toHaveBeenCalled();
      });

      it('接続時にノードURLとUIDがコールバックに渡されるべきである', () => {
        const connectCallback = vi.fn();

        // 既存接続の即座呼び出しをクリア
        connectCallback.mockClear();

        stream.onConnect(connectCallback);

        // WebSocketのonConnectコールバックをシミュレート
        const wsConnectCallback1 = mockInstances[0].onConnect.mock.calls[0][0];
        const wsConnectCallback2 = mockInstances[1].onConnect.mock.calls[0][0];

        // 既存の呼び出し回数を記録
        const beforeCalls = connectCallback.mock.calls.length;

        wsConnectCallback1('uid-1');
        wsConnectCallback2('uid-2');

        // 新たに2回呼ばれたことを確認
        expect(connectCallback.mock.calls.length).toBe(beforeCalls + 2);

        // UIDが渡されていることを確認
        const allCalls = connectCallback.mock.calls;
        const newCalls = allCalls.slice(beforeCalls);
        expect(newCalls.some((call: any[]) => call[1] === 'uid-1')).toBe(true);
        expect(newCalls.some((call: any[]) => call[1] === 'uid-2')).toBe(true);
      });

      it('すでに接続済みの場合は即座にコールバックが呼ばれるべきである', () => {
        const connectCallback = vi.fn();

        // すでに接続済みの状態（モックのデフォルト）
        stream.onConnect(connectCallback);

        expect(connectCallback).toHaveBeenCalledTimes(2);
        expect(connectCallback).toHaveBeenCalledWith(expect.any(String), 'test-uid');
      });
    });

    describe('onDisconnect', () => {
      it('切断コールバックが登録されるべきである', () => {
        const disconnectCallback = vi.fn();
        stream.onDisconnect(disconnectCallback);

        // 各WebSocketに対してonCloseが呼ばれていることを確認
        expect(mockInstances[0].onClose).toHaveBeenCalled();
        expect(mockInstances[1].onClose).toHaveBeenCalled();
      });

      it('切断時にノードURLがコールバックに渡されるべきである', () => {
        const disconnectCallback = vi.fn();
        stream.onDisconnect(disconnectCallback);

        // WebSocketのonCloseコールバックをシミュレート
        const wsCloseCallback1 = mockInstances[0].onClose.mock.calls[0][0];
        const wsCloseCallback2 = mockInstances[1].onClose.mock.calls[0][0];

        wsCloseCallback1();
        wsCloseCallback2();

        expect(disconnectCallback).toHaveBeenCalledWith('https://node1.example.com:3001');
        expect(disconnectCallback).toHaveBeenCalledWith('https://node2.example.com:3001');
      });
    });

    describe('isConnected', () => {
      it('少なくとも1つ接続されている場合はtrueを返すべきである', () => {
        mockInstances[0].isConnected = true;
        mockInstances[1].isConnected = false;

        expect(stream.isConnected()).toBe(true);
      });

      it('全て接続されている場合はtrueを返すべきである', () => {
        mockInstances[0].isConnected = true;
        mockInstances[1].isConnected = true;

        expect(stream.isConnected()).toBe(true);
      });

      it('全て切断されている場合はfalseを返すべきである', () => {
        mockInstances[0].isConnected = false;
        mockInstances[1].isConnected = false;

        expect(stream.isConnected()).toBe(false);
      });
    });

    describe('getConnectedNodes', () => {
      it('接続中のノードURLリストを返すべきである', () => {
        mockInstances[0].isConnected = true;
        mockInstances[1].isConnected = false;

        const connectedNodes = stream.getConnectedNodes();

        expect(connectedNodes).toHaveLength(1);
        // ランダムに選ばれるため、どちらかのノードが含まれることを確認
        expect(connectedNodes[0]).toMatch(/node\d\.example\.com/);
      });

      it('全て接続されている場合は全ノードを返すべきである', () => {
        mockInstances[0].isConnected = true;
        mockInstances[1].isConnected = true;

        const connectedNodes = stream.getConnectedNodes();

        expect(connectedNodes).toHaveLength(2);
        expect(connectedNodes).toContain('https://node1.example.com:3001');
        expect(connectedNodes).toContain('https://node2.example.com:3001');
      });

      it('全て切断されている場合は空配列を返すべきである', () => {
        mockInstances[0].isConnected = false;
        mockInstances[1].isConnected = false;

        const connectedNodes = stream.getConnectedNodes();

        expect(connectedNodes).toHaveLength(0);
      });
    });

    describe('getConnectionStatus', () => {
      it('全ノードの接続状態を返すべきである', () => {
        mockInstances[0].isConnected = true;
        mockInstances[0].uid = 'uid-1';
        mockInstances[1].isConnected = false;
        mockInstances[1].uid = null;

        const status = stream.getConnectionStatus();

        expect(status).toHaveLength(2);

        // ランダムに選ばれるため、配列全体の内容をチェック
        const connectedNode = status.find((s) => s.connected);
        const disconnectedNode = status.find((s) => !s.connected);

        expect(connectedNode).toBeDefined();
        expect(connectedNode?.connected).toBe(true);
        expect(connectedNode?.uid).toBe('uid-1');
        expect(connectedNode?.nodeUrl).toMatch(/node\d\.example\.com/);

        expect(disconnectedNode).toBeDefined();
        expect(disconnectedNode?.connected).toBe(false);
        expect(disconnectedNode?.uid).toBeNull();
        expect(disconnectedNode?.nodeUrl).toMatch(/node\d\.example\.com/);
      });

      it('UIDがnullの場合も正しく処理されるべきである', () => {
        mockInstances[0].isConnected = true;
        mockInstances[0].uid = null;

        const status = stream.getConnectionStatus();

        expect(status[0].uid).toBeNull();
      });
    });

    describe('close時のクリーンアップ', () => {
      it('close時に接続コールバックもクリアされるべきである', () => {
        const connectCallback = vi.fn();
        stream.onConnect(connectCallback);

        stream.close();

        // closeされた後はgetActiveConnectionCountが0を返す
        expect(stream.getActiveConnectionCount()).toBe(0);
      });
    });
  });

  describe('ノード切り替え機能', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('再接続試行回数が上限を超えたら別のノードに切り替えるべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: [
          'https://node1.example.com:3001',
          'https://node2.example.com:3001',
          'https://node3.example.com:3001',
        ],
        connections: 1,
        maxReconnectBeforeSwitching: 3,
      });

      const initialWs = mockInstances[0];
      const initialNodeCount = stream.getActiveConnectionCount();

      // onReconnectコールバックを取得
      const reconnectCallback = initialWs.onReconnect.mock.calls[0][0];

      // 再接続を3回シミュレート（上限に達する）
      reconnectCallback(3);

      // 新しいWebSocketが作成されたことを確認
      expect(mockInstances.length).toBeGreaterThan(initialNodeCount);

      stream.close();
    });

    it('fatalエラー時に代替ノードへ切り替え、購読を復元するべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
      });
      const callback = vi.fn();
      stream.on('block', callback);
      const initialWs = mockInstances[0];

      initialWs.onError.mock.calls[0][0]({
        type: 'timeout',
        severity: 'fatal',
        host: 'node1.example.com',
        reconnecting: false,
        reconnectAttempts: 0,
        timestamp: Date.now(),
        message: 'Connection timeout',
        originalError: new Error('timeout'),
      });

      expect(mockInstances).toHaveLength(2);
      expect(stream.getBlacklistedNodes()).toContain(`https://${initialWs.options.host}:3001`);
      expect(mockInstances[1].on).toHaveBeenCalledWith('block', expect.any(Function));

      const replacementCallback = mockInstances[1].on.mock.calls[0][1];
      replacementCallback({ data: { meta: { hash: 'restored-event' } }, topic: 'block' });
      expect(callback).toHaveBeenCalledTimes(1);

      stream.close();
    });

    it('代替WebSocketの生成に失敗した場合は旧接続を維持するべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
      });
      const callback = vi.fn();
      stream.on('block', callback);
      const initialWs = mockInstances[0];
      mockConstructionError = new Error('replacement construction failed');
      mockConstructionErrorOnAttempt = 2;

      initialWs.onError.mock.calls[0][0]({
        type: 'timeout',
        severity: 'fatal',
        host: 'node1.example.com',
        reconnecting: false,
        reconnectAttempts: 0,
        timestamp: Date.now(),
        message: 'Connection timeout',
        originalError: new Error('timeout'),
      });

      expect(mockInstances).toHaveLength(1);
      expect(stream.getActiveConnectionCount()).toBe(1);
      expect(stream.getBlacklistedNodes()).toEqual([]);

      const oldCallback = initialWs.on.mock.calls[0][1];
      oldCallback({ data: { meta: { hash: 'old-connection-event' } }, topic: 'block' });
      expect(callback).toHaveBeenCalledTimes(1);
      stream.close();
    });

    it('購読復元の途中で失敗した場合は新接続と部分購読をロールバックするべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
      });
      const blockCallback = vi.fn();
      const confirmedCallback = vi.fn();
      stream.on('block', blockCallback);
      stream.on('confirmedAdded', 'TCHBDENCLKEBILBPWP3JPB2XNY64OE7PYHHE32I', confirmedCallback);
      const initialWs = mockInstances[0];
      mockRestoreFailureOnReplacement = true;

      initialWs.onError.mock.calls[0][0]({
        type: 'timeout',
        severity: 'fatal',
        host: 'node1.example.com',
        reconnecting: false,
        reconnectAttempts: 0,
        timestamp: Date.now(),
        message: 'Connection timeout',
        originalError: new Error('timeout'),
      });

      expect(mockInstances).toHaveLength(2);
      expect(stream.getActiveConnectionCount()).toBe(1);
      expect(stream.getBlacklistedNodes()).toEqual([]);
      expect(mockInstances[1].off).toHaveBeenCalledWith('block');
      expect(mockInstances[1].close).toHaveBeenCalledTimes(1);

      const oldCallback = initialWs.on.mock.calls[0][1];
      oldCallback({ data: { meta: { hash: 'old-after-rollback' } }, topic: 'block' });
      expect(blockCallback).toHaveBeenCalledTimes(1);
      expect(confirmedCallback).not.toHaveBeenCalled();
      stream.close();
    });

    it('terminal close時に代替ノードへ切り替えるべきである', async () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
      });
      const initialWs = mockInstances[0];

      vi.useRealTimers();
      initialWs.onClose.mock.calls[0][0]({});
      await Promise.resolve();

      expect(mockInstances).toHaveLength(2);
      expect(stream.getBlacklistedNodes()).toContain(`https://${initialWs.options.host}:3001`);

      stream.close();
    });

    it('通常の再接続に伴うcloseでは即時にノードを切り替えない', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
      });
      const initialWs = mockInstances[0];

      initialWs.onClose.mock.calls[0][0]({});
      initialWs.onReconnect.mock.calls[0][0](1);
      vi.runAllTicks();

      expect(mockInstances).toHaveLength(1);
      expect(stream.getBlacklistedNodes()).toEqual([]);

      stream.close();
    });

    it('明示的なcloseではノードを切り替えない', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
      });
      const initialWs = mockInstances[0];
      const closeCallback = initialWs.onClose.mock.calls[0][0];

      stream.close();
      closeCallback({});
      vi.runAllTicks();

      expect(mockInstances).toHaveLength(1);
      expect(stream.getBlacklistedNodes()).toEqual([]);
    });

    it('ブラックリストに登録されたノードは選択されないべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: [
          'https://node1.example.com:3001',
          'https://node2.example.com:3001',
          'https://node3.example.com:3001',
        ],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
      });

      const initialWs = mockInstances[0];
      const reconnectCallback = initialWs.onReconnect.mock.calls[0][0];

      // 再接続上限を超えてノード切り替え
      reconnectCallback(2);

      const blacklisted = stream.getBlacklistedNodes();
      expect(blacklisted.length).toBeGreaterThan(0);

      stream.close();
    });

    it('ブラックリストはTTL後にクリアされるべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: [
          'https://node1.example.com:3001',
          'https://node2.example.com:3001',
          'https://node3.example.com:3001',
        ],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
        blacklistTtl: 10000,
        cacheTtl: 60000, // cacheTtlを大きくしてブラックリストクリーンアップの間隔がブラックリストTTLに従うようにする
      });

      const initialWs = mockInstances[0];
      const reconnectCallback = initialWs.onReconnect.mock.calls[0][0];

      // ノード切り替えを発生させる
      reconnectCallback(2);

      expect(stream.getBlacklistedNodes().length).toBeGreaterThan(0);

      // クリーンアップ間隔は Math.min(cacheTtl / 2, blacklistTtl / 2) = 5000
      // ブラックリストTTLの10000msを超えた後、次のクリーンアップで削除される
      vi.advanceTimersByTime(10500); // TTLを超える
      vi.advanceTimersByTime(5000); // クリーンアップが実行されるまで待つ

      // ブラックリストがクリアされる
      expect(stream.getBlacklistedNodes().length).toBe(0);

      stream.close();
    });

    it('利用可能なノードがない場合は切り替えを行わないべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
      });

      const initialWs = mockInstances[0];
      const initialCount = mockInstances.length;
      const reconnectCallback = initialWs.onReconnect.mock.calls[0][0];

      // 再接続上限を超える（でも他にノードがないので切り替わらない）
      reconnectCallback(2);

      // 新しいWebSocketは作成されない
      expect(mockInstances.length).toBe(initialCount);
      expect(stream.getBlacklistedNodes()).toEqual([]);

      stream.close();
    });

    it('候補が枯渇した場合はNodeProviderから候補を補充して切り替えるべきである', async () => {
      const nodeProvider = vi.fn(async () => ['https://provided.example.com:3001']);
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
        nodeProvider,
      });

      const initialWs = mockInstances[0];
      initialWs.onReconnect.mock.calls[0][0](2);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(nodeProvider).toHaveBeenCalledTimes(1);
      expect(mockInstances).toHaveLength(2);
      expect(mockInstances[1].options.host).toBe('provided.example.com');
      expect(stream.getBlacklistedNodes()).toContain('https://node1.example.com:3001');

      stream.close();
    });

    it('NodeProviderの不正候補・重複候補を除外するべきである', async () => {
      const nodeProvider = vi.fn(async () => [
        'https://node1.example.com:3001',
        'https://provided.example.com:3001',
        'https://provided.example.com:3001/',
        'ftp://invalid.example.com',
      ]);
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
        nodeProvider,
      });

      mockInstances[0].onReconnect.mock.calls[0][0](2);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockInstances).toHaveLength(2);
      expect(mockInstances[1].options.host).toBe('provided.example.com');
      expect(mockInstances.every((instance) => instance.options.host !== 'invalid.example.com')).toBe(true);

      stream.close();
    });

    it.each([
      ['空配列', () => Promise.resolve<string[]>([])],
      ['reject', () => Promise.reject<string[]>(new Error('provider failed'))],
    ])('NodeProviderが%sを返した場合は既存接続を維持するべきである', async (_label, providerFactory) => {
      const nodeProvider = vi.fn(providerFactory);
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
        nodeProvider,
      });

      mockInstances[0].onReconnect.mock.calls[0][0](2);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(nodeProvider).toHaveBeenCalledTimes(1);
      expect(mockInstances).toHaveLength(1);
      expect(stream.getBlacklistedNodes()).toEqual([]);

      stream.close();
    });

    it('同時に候補が枯渇してもNodeProviderをsingle-flightで1回だけ呼び出すべきである', async () => {
      let resolveProvider!: (nodes: string[]) => void;
      const nodeProvider = vi.fn(
        () =>
          new Promise<string[]>((resolve) => {
            resolveProvider = resolve;
          })
      );
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 2,
        maxReconnectBeforeSwitching: 2,
        nodeProvider,
      });

      mockInstances[0].onReconnect.mock.calls[0][0](2);
      mockInstances[1].onReconnect.mock.calls[0][0](2);

      expect(nodeProvider).toHaveBeenCalledTimes(1);
      resolveProvider(['https://provided1.example.com:3001', 'https://provided2.example.com:3001']);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockInstances).toHaveLength(4);
      expect(stream.getActiveConnectionCount()).toBe(2);

      stream.close();
    });

    it('NodeProviderの処理中にcloseしても解決後に接続を作成しないべきである', async () => {
      let resolveProvider!: (nodes: string[]) => void;
      const nodeProvider = vi.fn(
        () =>
          new Promise<string[]>((resolve) => {
            resolveProvider = resolve;
          })
      );
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001'],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
        nodeProvider,
      });

      mockInstances[0].onReconnect.mock.calls[0][0](2);
      stream.close();
      resolveProvider(['https://provided.example.com:3001']);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockInstances).toHaveLength(1);
      expect(stream.getIsClosed()).toBe(true);
    });

    it('getBlacklistedNodesでブラックリスト一覧を取得できるべきである', () => {
      const stream = new SymbolEventStream({
        nodewatchUrls: ['https://node1.example.com:3001', 'https://node2.example.com:3001'],
        connections: 1,
        maxReconnectBeforeSwitching: 2,
      });

      expect(stream.getBlacklistedNodes()).toEqual([]);

      stream.close();
    });
  });
});
