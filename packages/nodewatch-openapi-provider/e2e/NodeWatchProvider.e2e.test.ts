import type { HeightInfo, Node } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import { describe, expect, test } from 'vitest';

import { createNemNodeWatchApi, createSymbolNodeWatchApi } from '../src/index.js';

const E2E_TIMEOUT = 90_000;
const AVAILABILITY_TIMEOUT = 10_000;
const REQUEST_TIMEOUT = 30_000;
// NODEWATCH-PROVIDER-INTEROP-001: 現行NodeWatch実応答では未観測ノードのheightが0になる場合がある。
const MIN_REPORTED_NODE_HEIGHT = 0;
const mainnetUrls = ['https://nodewatch.symbol.tools'];
const testnetUrls = ['https://nodewatch.symbol.tools/testnet'];

type NodeWatchScenario = {
  name: string;
  available: boolean;
  getHeight: (signal: AbortSignal) => Promise<HeightInfo>;
  getNodes: (signal: AbortSignal) => Promise<Node[]>;
};

async function hasAvailableNodeWatch(baseUrls: string[], paths: string[]): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT);

  try {
    await Promise.any(
      baseUrls.map(async (baseUrl) => {
        await Promise.all(
          paths.map(async (path) => {
            const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
            if (!response.ok) {
              throw new Error(`NodeWatch returned HTTP ${response.status}`);
            }
          })
        );
      })
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

function expectHeightInfo(heightInfo: HeightInfo): void {
  expect(Number.isSafeInteger(heightInfo.height)).toBe(true);
  expect(heightInfo.height).toBeGreaterThanOrEqual(1);
  expect(Number.isSafeInteger(heightInfo.finalizedHeight)).toBe(true);
  expect(heightInfo.finalizedHeight).toBeGreaterThanOrEqual(1);
}

function expectNode(node: Node): void {
  expect(node.mainPublicKey).toMatch(/^[0-9a-f]{64}$/i);
  expect(() => new URL(node.endpoint)).not.toThrow();
  expect(node.name).toEqual(expect.any(String));
  expect(node.version).toEqual(expect.any(String));
  expect(Number.isSafeInteger(node.height)).toBe(true);
  expect(node.height).toBeGreaterThanOrEqual(MIN_REPORTED_NODE_HEIGHT);
  expect(Number.isSafeInteger(node.finalizedHeight)).toBe(true);
  expect(node.finalizedHeight).toBeGreaterThanOrEqual(MIN_REPORTED_NODE_HEIGHT);
  expect(typeof node.balance).toBe('number');
  expect(Number.isFinite(node.balance)).toBe(true);
  expect(node.balance).toBeGreaterThanOrEqual(0);
}

const [symbolMainnetAvailable, symbolTestnetAvailable, nemMainnetAvailable, nemTestnetAvailable] = await Promise.all([
  hasAvailableNodeWatch(mainnetUrls, ['/api/symbol/height', '/api/symbol/nodes/peer']),
  hasAvailableNodeWatch(testnetUrls, ['/api/symbol/height', '/api/symbol/nodes/peer']),
  hasAvailableNodeWatch(mainnetUrls, ['/api/nem/height', '/api/nem/nodes']),
  hasAvailableNodeWatch(testnetUrls, ['/api/nem/height', '/api/nem/nodes']),
]);

const scenarios: NodeWatchScenario[] = [
  {
    name: 'Symbol mainnet',
    available: symbolMainnetAvailable,
    getHeight: (signal) => createSymbolNodeWatchApi(mainnetUrls).getSymbolHeight({ signal }),
    getNodes: (signal) => createSymbolNodeWatchApi(mainnetUrls).getSymbolPeerNodes({ limit: 10 }, { signal }),
  },
  {
    name: 'Symbol testnet',
    available: symbolTestnetAvailable,
    getHeight: (signal) => createSymbolNodeWatchApi(testnetUrls).getSymbolHeight({ signal }),
    getNodes: (signal) => createSymbolNodeWatchApi(testnetUrls).getSymbolPeerNodes({ limit: 10 }, { signal }),
  },
  {
    name: 'NEM mainnet',
    available: nemMainnetAvailable,
    getHeight: (signal) => createNemNodeWatchApi(mainnetUrls).getNemHeight({ signal }),
    getNodes: (signal) => createNemNodeWatchApi(mainnetUrls).getNemNodes({ signal }),
  },
  {
    name: 'NEM testnet',
    available: nemTestnetAvailable,
    getHeight: (signal) => createNemNodeWatchApi(testnetUrls).getNemHeight({ signal }),
    getNodes: (signal) => createNemNodeWatchApi(testnetUrls).getNemNodes({ signal }),
  },
];

for (const scenario of scenarios) {
  const describeScenario = scenario.available ? describe : describe.skip;

  describeScenario(`${scenario.name} provider - E2E`, () => {
    test(
      'retrieves a valid height and node list through the public provider API',
      async () => {
        const signal = AbortSignal.timeout(REQUEST_TIMEOUT);
        const [heightInfo, nodes] = await Promise.all([scenario.getHeight(signal), scenario.getNodes(signal)]);

        expectHeightInfo(heightInfo);
        expect(nodes.length).toBeGreaterThan(0);
        nodes.forEach(expectNode);
      },
      E2E_TIMEOUT
    );
  });
}
