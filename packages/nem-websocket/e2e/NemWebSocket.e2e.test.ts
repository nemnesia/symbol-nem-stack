import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NemWebSocket } from '../src/NemWebSocket.js';
import type { NemAddressChannel, NemChannel, NemGlobalChannel } from '../src/nemChannelPaths.js';

config({ path: resolve(fileURLToPath(new URL('../.env', import.meta.url))), quiet: true });

const e2eHost = process.env.NEM_E2E_HOST;
const e2eAddress = process.env.NEM_E2E_ADDRESS;
const e2eSsl = process.env.NEM_E2E_SSL === 'true';
const MESSAGE_TIMEOUT_MS = 15_000;
const BLOCK_TIMEOUT_MS = 75_000;
const CONNECTION_TIMEOUT_MS = 15_000;

if (!e2eHost || !e2eAddress) {
  throw new Error('NEM_E2E_HOST and NEM_E2E_ADDRESS must be set in packages/nem-websocket/.env');
}

const address = e2eAddress.trim().toUpperCase();
if (!/^T[A-Z2-7]{39}$/.test(address)) {
  throw new Error('NEM_E2E_ADDRESS must be a 40-character NEM testnet address');
}

const globalChannels: NemGlobalChannel[] = ['newBlock', 'blocks'];
const addressChannels: NemAddressChannel[] = [
  'account',
  'accountMosaic',
  'accountMosaicDef',
  'accountNamespace',
  'transactions',
  'unconfirmed',
  'recenttransactions',
];
const allChannels: NemChannel[] = [...globalChannels, ...addressChannels];

type MessageWaiter = {
  minimumCount: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

describe('NemWebSocket NEM testnet E2E', () => {
  let monitor: NemWebSocket;
  let unsubscribes: Array<() => void> = [];
  const messages = new Map<NemChannel, string[]>(allChannels.map((channel) => [channel, []]));
  const waiters = new Map<NemChannel, Set<MessageWaiter>>();

  const observe =
    (channel: NemChannel) =>
    (message: string): void => {
      messages.get(channel)?.push(message);
      const channelWaiters = waiters.get(channel);
      channelWaiters?.forEach((waiter) => {
        if ((messages.get(channel)?.length ?? 0) < waiter.minimumCount) return;
        clearTimeout(waiter.timer);
        waiter.resolve();
        channelWaiters.delete(waiter);
      });
    };

  const waitForMessageCount = (channel: NemChannel, minimumCount: number, timeoutMs: number): Promise<void> => {
    if ((messages.get(channel)?.length ?? 0) >= minimumCount) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const waiter: MessageWaiter = {
        minimumCount,
        resolve,
        reject,
        timer: setTimeout(() => {
          waiters.get(channel)?.delete(waiter);
          reject(new Error(`${channel} message was not received within ${timeoutMs}ms`));
        }, timeoutMs),
      };
      let channelWaiters = waiters.get(channel);
      if (!channelWaiters) {
        channelWaiters = new Set();
        waiters.set(channel, channelWaiters);
      }
      channelWaiters.add(waiter);
    });
  };

  const waitForConnection = (client: NemWebSocket): Promise<void> =>
    new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribeConnect = (): void => {};
      let unsubscribeError = (): void => {};
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribeConnect();
        unsubscribeError();
        reject(new Error(`NEM testnet WebSocket connection timed out after ${CONNECTION_TIMEOUT_MS}ms`));
      }, CONNECTION_TIMEOUT_MS);
      unsubscribeError = client.onError((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeConnect();
        unsubscribeError();
        reject(new Error(`NEM testnet WebSocket connection failed: ${error.message}`));
      });
      unsubscribeConnect = client.onConnect(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeError();
        resolve();
      });
      if (settled) unsubscribeConnect();
    });

  beforeAll(async () => {
    monitor = new NemWebSocket({
      host: e2eHost,
      ssl: e2eSsl,
      timeout: 10_000,
      autoReconnect: true,
      reconnectInterval: 1_000,
    });

    try {
      await waitForConnection(monitor);

      globalChannels.forEach((channel) => {
        unsubscribes.push(monitor.on(channel, observe(channel)));
      });

      // アドレス登録が必要なチャネルを先に登録し、最後に recenttransactions の初期取得を実行する。
      // これにより、アドレス系チャネルを1接続・1回の初期取得で検証できる。
      addressChannels.forEach((channel) => {
        unsubscribes.push(monitor.on(channel, address, observe(channel)));
      });
    } catch (error) {
      monitor.disconnect();
      throw error;
    }
  });

  afterAll(() => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    if (monitor) monitor.disconnect();
  });

  it('テストネットへ接続し、全チャネルの購読を開始できるべきである', () => {
    expect(monitor.isConnected).toBe(true);
    expect(unsubscribes).toHaveLength(allChannels.length);
  });

  it('アドレス系チャネルの初期通知を同じ接続で受信できるべきである', async () => {
    await Promise.all([
      waitForMessageCount('account', 1, MESSAGE_TIMEOUT_MS),
      waitForMessageCount('recenttransactions', 1, MESSAGE_TIMEOUT_MS),
    ]);

    expect(messages.get('account')?.[0]).toBeTruthy();
    expect(messages.get('recenttransactions')?.[0]).toBeTruthy();
  });

  it('次の1ブロックでnewBlockとblocksの通知を受信できるべきである', async () => {
    const nextNewBlockMessage = (messages.get('newBlock')?.length ?? 0) + 1;
    const nextBlocksMessage = (messages.get('blocks')?.length ?? 0) + 1;

    await Promise.all([
      waitForMessageCount('newBlock', nextNewBlockMessage, BLOCK_TIMEOUT_MS),
      waitForMessageCount('blocks', nextBlocksMessage, BLOCK_TIMEOUT_MS),
    ]);

    expect(messages.get('newBlock')?.length).toBeGreaterThanOrEqual(nextNewBlockMessage);
    expect(messages.get('blocks')?.length).toBeGreaterThanOrEqual(nextBlocksMessage);
  });
});
