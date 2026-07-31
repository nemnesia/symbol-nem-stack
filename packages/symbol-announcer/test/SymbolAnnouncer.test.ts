import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SymbolAnnouncer } from '../src/SymbolAnnouncer.js';

const monitor = {
  disconnect: vi.fn(),
  on: vi.fn(),
  onConnect: vi.fn(),
  onError: vi.fn(),
};

vi.mock('@nemnesia/symbol-websocket', () => ({
  SymbolWebSocket: vi.fn(function SymbolWebSocketMock() {
    return monitor;
  }),
}));

describe('SymbolAnnouncer', () => {
  const nodeUrl = 'https://example.com:3000';
  const signerAddress = 'TABC1234567890ABCDEF';
  const transaction = '{"payload":"test"}';
  const transactionHash = 'ABC123DEF456';

  let announcer: SymbolAnnouncer;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'accepted' }) })
    );
    announcer = new SymbolAnnouncer(nodeUrl);
  });

  const connect = (): void => {
    const callback = monitor.onConnect.mock.calls[0]?.[0];
    callback?.('gateway-uid');
  };

  it('HTTP(S) URLからWebSocket接続設定を作成するべきである', async () => {
    const { SymbolWebSocket } = await import('@nemnesia/symbol-websocket');

    expect(announcer).toBeInstanceOf(SymbolAnnouncer);
    expect(SymbolWebSocket).toHaveBeenCalledWith({ host: 'example.com', ssl: true, timeout: 5000 });
    expect(monitor.onError).toHaveBeenCalledTimes(1);
  });

  it('不正なノードURLを拒否するべきである', () => {
    expect(() => new SymbolAnnouncer('not a url')).toThrow('nodeUrl must be a valid HTTP(S) URL');
    expect(() => new SymbolAnnouncer('ftp://example.com')).toThrow('nodeUrl must be a valid HTTP(S) URL');
  });

  it('接続後に購読を登録してトランザクションをアナウンスするべきである', async () => {
    const announced = vi.fn();
    announcer.on('announced', announced);

    announcer.announce(signerAddress, transaction, transactionHash);
    connect();
    await vi.waitFor(() => expect(announced).toHaveBeenCalledWith({ message: 'accepted' }));

    expect(monitor.on).toHaveBeenCalledWith('confirmedAdded', signerAddress, expect.any(Function));
    expect(monitor.on).toHaveBeenCalledWith('status', signerAddress, expect.any(Function));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      'https://example.com:3000/transactions',
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: transaction },
    ]);
  });

  it('再接続時に同じアナウンス要求を送信しないべきである', async () => {
    announcer.announce(signerAddress, transaction, transactionHash);
    connect();
    connect();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('一致する承認通知だけを発火するべきである', () => {
    const confirmed = vi.fn();
    announcer.on('confirmedAdded', confirmed);
    announcer.announce(signerAddress, transaction, transactionHash);
    connect();

    const callback = monitor.on.mock.calls.find(([event]) => event === 'confirmedAdded')?.[2];
    callback({ data: { meta: { hash: transactionHash } } });
    callback({ data: { meta: { hash: 'different' } } });

    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('一致するステータス通知だけを発火するべきである', () => {
    const status = vi.fn();
    announcer.on('status', status);
    announcer.announce(signerAddress, transaction, transactionHash);
    connect();

    const callback = monitor.on.mock.calls.find(([event]) => event === 'status')?.[2];
    callback({ data: { hash: transactionHash } });
    callback({ data: { hash: 'different' } });

    expect(status).toHaveBeenCalledTimes(1);
  });

  it('入力値を検証するべきである', () => {
    expect(() => announcer.announce('', transaction, transactionHash)).toThrow('signerAddress must be a non-empty address');
    expect(() => announcer.announce(signerAddress, 'invalid', transactionHash)).toThrow(
      'transaction must be a valid JSON string'
    );
    expect(() => announcer.announce(signerAddress, transaction, '')).toThrow('transactionHash must be a non-empty string');
  });

  it('REST APIの失敗をerrorイベントで通知するべきである', async () => {
    const error = vi.fn();
    announcer.on('error', error);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) } as Response);

    announcer.announce(signerAddress, transaction, transactionHash);
    connect();

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Transaction announcement failed with HTTP 400' }))
    );
  });

  it('WebSocketエラーをerrorイベントで通知するべきである', () => {
    const error = vi.fn();
    announcer.on('error', error);

    const callback = monitor.onError.mock.calls[0]?.[0];
    callback({ message: 'connection failed' });

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'connection failed' }));
  });

  it('disconnectで内部WebSocketを切断するべきである', () => {
    announcer.disconnect();
    expect(monitor.disconnect).toHaveBeenCalledTimes(1);
  });
});
