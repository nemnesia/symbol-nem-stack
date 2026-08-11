import { PrivateKey, utils } from '@nemnesia/symbol-sdk';
import { SymbolFacade, SymbolTransactionFactory, descriptors } from '@nemnesia/symbol-sdk/symbol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SymbolWebSocket } from '../src/SymbolWebSocket.js';
import type { SymbolNotificationMap } from '../src/symbolNotifications.types.js';

const envPath = resolve(fileURLToPath(new URL('../.env', import.meta.url)));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const e2eHost = process.env.SYMBOL_E2E_HOST;
const e2eSsl = process.env.SYMBOL_E2E_SSL !== 'false';
const e2eRestUrl = e2eSsl
  ? 'https://' + process.env.SYMBOL_E2E_HOST + ':3001'
  : 'http://' + process.env.SYMBOL_E2E_HOST + ':3000';
const e2ePrivateKey = process.env.SYMBOL_E2E_PRIVATE_KEY?.trim();
const CONNECTION_TIMEOUT_MS = 15_000;
const BLOCK_TIMEOUT_MS = 90_000;
const CONFIRMED_ADDED_TIMEOUT_MS = 120_000;

type BlockWaiter = {
  minimumCount: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type ConfirmedAddedWaiter = {
  transactionHash: string;
  resolve: (message: SymbolNotificationMap['confirmedAdded']) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const e2eEnabled = Boolean(e2eHost && e2ePrivateKey && e2eRestUrl);

describe.skipIf(!e2eEnabled)('SymbolWebSocket Symbol testnet E2E', () => {
  let monitor!: SymbolWebSocket;
  let facade!: SymbolFacade;
  let account!: ReturnType<SymbolFacade['createAccount']>;
  const blockMessages: Array<SymbolNotificationMap['block']> = [];
  const blockWaiters = new Set<BlockWaiter>();
  const confirmedAddedWaiters = new Set<ConfirmedAddedWaiter>();
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

  const observeConfirmedAdded = (message: SymbolNotificationMap['confirmedAdded']): void => {
    const transactionHash = message.data.meta.hash;
    [...confirmedAddedWaiters].forEach((waiter) => {
      if (waiter.transactionHash !== transactionHash) return;

      clearTimeout(waiter.timer);
      confirmedAddedWaiters.delete(waiter);
      waiter.resolve(message);
    });
  };

  const waitForConfirmedAdded = (transactionHash: string): Promise<SymbolNotificationMap['confirmedAdded']> =>
    new Promise((resolve, reject) => {
      const waiter: ConfirmedAddedWaiter = {
        transactionHash,
        resolve,
        reject,
        timer: setTimeout(() => {
          confirmedAddedWaiters.delete(waiter);
          reject(new Error('confirmedAdded notification was not received within ' + CONFIRMED_ADDED_TIMEOUT_MS + 'ms'));
        }, CONFIRMED_ADDED_TIMEOUT_MS),
      };
      confirmedAddedWaiters.add(waiter);
    });

  const announceTransaction = async (payload: string): Promise<void> => {
    const response = await fetch(new URL('/transactions', e2eRestUrl!).toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });

    if (!response.ok) {
      throw new Error('Symbol testnet transaction announcement failed with HTTP ' + response.status);
    }
  };

  const createSignedTransfer = (): { hash: string; payload: string } => {
    const message = new TextEncoder().encode(
      `symbol-websocket-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    const descriptor = new descriptors.TransferTransactionV1Descriptor(account.address, [], message);
    const transaction = facade.createTransactionFromTypedDescriptor(descriptor, account.publicKey, 100, 120);
    const signature = account.signTransaction(transaction);
    SymbolTransactionFactory.attachSignature(transaction, signature);

    return {
      hash: facade.hashTransaction(transaction).toString(),
      payload: utils.uint8ToHex(transaction.serialize()),
    };
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
    facade = new SymbolFacade('testnet');
    account = facade.createAccount(new PrivateKey(e2ePrivateKey!));
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
      unsubscribes.push(monitor.on('confirmedAdded', account.address.toString(), observeConfirmedAdded));
    } catch (error) {
      monitor.disconnect();
      throw error;
    }
  });

  afterAll(() => {
    blockWaiters.forEach((waiter) => clearTimeout(waiter.timer));
    confirmedAddedWaiters.forEach((waiter) => clearTimeout(waiter.timer));
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    monitor.disconnect();
  });

  it('Symbolノードへ接続し、blockチャネルを購読できるべきである', () => {
    expect(monitor.isConnected).toBe(true);
    expect(monitor.uid).toBeTruthy();
    expect(unsubscribes).toHaveLength(2);
  });

  it('実際のblock通知を受信できるべきである', async () => {
    const nextMessageCount = blockMessages.length + 1;
    await waitForBlockCount(nextMessageCount);

    const message = blockMessages[nextMessageCount - 1];
    expect(message.topic).toBe('block');
    expect(message.data.block.height).toMatch(/^\d+$/);
    expect(message.data.meta.hash).toMatch(/^[A-F0-9]+$/);
  });

  it('SDKで署名したトランザクションのconfirmedAdded通知を受信できるべきである', async () => {
    const transaction = createSignedTransfer();
    const confirmedAdded = waitForConfirmedAdded(transaction.hash);

    await announceTransaction(transaction.payload);

    const message = await confirmedAdded;
    expect(message.topic).toBe(`confirmedAdded/${account.address.toString()}`);
    expect(message.data.meta.hash).toBe(transaction.hash);
  });
});
