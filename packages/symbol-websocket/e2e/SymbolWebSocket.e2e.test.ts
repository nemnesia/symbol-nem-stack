import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SymbolWebSocket } from '../src/SymbolWebSocket.js';
import type { SymbolNotificationMap } from '../src/symbolNotifications.types.js';

const envPath = resolve(fileURLToPath(new URL('../.env', import.meta.url)));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const e2eHost = process.env.SYMBOL_E2E_HOST;
const e2eAddress = process.env.SYMBOL_E2E_ADDRESS?.trim();
const e2eSsl = process.env.SYMBOL_E2E_SSL !== 'false';
const CONNECTION_TIMEOUT_MS = 15_000;
const BLOCK_TIMEOUT_MS = 90_000;

type BlockWaiter = {
  minimumCount: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

describe.skipIf(!e2eHost)('SymbolWebSocket Symbol testnet E2E', () => {
  let monitor!: SymbolWebSocket;
  const blockMessages: Array<SymbolNotificationMap['block']> = [];
  const blockWaiters = new Set<BlockWaiter>();
  const unsubscribes: Array<() => void> = [];

  const observeBlock = (message: SymbolNotificationMap['block']): void => {
    blockMessages.push(message);
    [...blockWaiters].forEach((waiter) => {
      if (blockMessages.length < waiter.minimumCount) return;

      clearTimeout(waiter.timer);
      blockWaiters.delete(waiter);
      waiter.resolve();
    });
  };

  const waitForBlockCount = (minimumCount: number): Promise<void> => {
    if (blockMessages.length >= minimumCount) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const waiter: BlockWaiter = {
        minimumCount,
        resolve,
        reject,
        timer: setTimeout(() => {
          blockWaiters.delete(waiter);
          reject(new Error('block notification was not received within ' + BLOCK_TIMEOUT_MS + 'ms'));
        }, BLOCK_TIMEOUT_MS),
      };
      blockWaiters.add(waiter);
    });
  };

  const waitForConnection = (client: SymbolWebSocket): Promise<void> =>
    new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribeConnect = (): void => {};
      let unsubscribeError = (): void => {};
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribeConnect();
        unsubscribeError();
        reject(new Error('Symbol testnet WebSocket connection timed out after ' + CONNECTION_TIMEOUT_MS + 'ms'));
      }, CONNECTION_TIMEOUT_MS);

      unsubscribeError = client.onError((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeConnect();
        unsubscribeError();
        reject(new Error('Symbol testnet WebSocket connection failed: ' + error.message));
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
    monitor = new SymbolWebSocket({
      host: e2eHost!,
      ssl: e2eSsl,
      timeout: CONNECTION_TIMEOUT_MS,
      autoReconnect: true,
      reconnectInterval: 1_000,
    });

    try {
      await waitForConnection(monitor);
      unsubscribes.push(monitor.on('block', observeBlock));
      if (e2eAddress) {
        unsubscribes.push(monitor.on('confirmedAdded', e2eAddress, () => {}));
      }
    } catch (error) {
      monitor.disconnect();
      throw error;
    }
  });

  afterAll(() => {
    blockWaiters.forEach((waiter) => clearTimeout(waiter.timer));
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    monitor.disconnect();
  });

  it('Symbolノードへ接続し、blockチャネルを購読できるべきである', () => {
    expect(monitor.isConnected).toBe(true);
    expect(monitor.uid).toBeTruthy();
    expect(unsubscribes).toHaveLength(e2eAddress ? 2 : 1);
  });

  it('実際のblock通知を受信できるべきである', async () => {
    const nextMessageCount = blockMessages.length + 1;
    await waitForBlockCount(nextMessageCount);

    const message = blockMessages[nextMessageCount - 1];
    expect(message.topic).toBe('block');
    expect(message.data.block.height).toMatch(/^\d+$/);
    expect(message.data.meta.hash).toMatch(/^[A-F0-9]+$/);
  });
});
