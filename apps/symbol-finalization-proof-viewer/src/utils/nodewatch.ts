import { type NodeWatchSnapshot, fetchSymbolNodeWatchSnapshot } from '@nemnesia/nodewatch-openapi-provider';
import type { NetworkName } from '@nemnesia/symbol-nem-node-picker';

// NodeWatch OpenAPI servers: packages/nodewatch-openapi-typescript-fetch-client/openapi-nodewatch.yaml
const NODEWATCH_URLS: Record<NetworkName, readonly string[]> = {
  mainnet: ['https://nodewatch.symbol.tools'],
  testnet: ['https://nodewatch.symbol.tools/testnet'],
};
const REQUEST_TIMEOUT_MS = 3000;
const CACHE_DURATION_MS = 60000;
const nodeCache = new Map<NetworkName, { snapshot: NodeWatchSnapshot; timestamp: number }>();
const pendingSnapshots = new Map<NetworkName, Promise<NodeWatchSnapshot>>();

export const fetchNodeWatchSnapshot = async (networkName: NetworkName): Promise<NodeWatchSnapshot> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timeout'));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      fetchSymbolNodeWatchSnapshot(NODEWATCH_URLS[networkName], { signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    controller.abort();
  }
};

const isHttpsEndpoint = (endpoint: string): boolean => {
  try {
    return new URL(endpoint).protocol === 'https:';
  } catch {
    return false;
  }
};

export const pickSymbolNode = async (networkName: NetworkName): Promise<string> => {
  const cached = nodeCache.get(networkName);
  let snapshot: NodeWatchSnapshot;
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    snapshot = cached.snapshot;
  } else {
    let pending = pendingSnapshots.get(networkName);
    if (!pending) {
      pending = fetchNodeWatchSnapshot(networkName)
        .then((result) => {
          nodeCache.set(networkName, { snapshot: result, timestamp: Date.now() });
          return result;
        })
        .finally(() => pendingSnapshots.delete(networkName));
      pendingSnapshots.set(networkName, pending);
    }
    snapshot = await pending;
  }

  const candidates = snapshot.nodes.filter(
    (node) => node.height >= snapshot.heightInfo.height && node.isSslEnabled === true && isHttpsEndpoint(node.endpoint)
  );
  if (candidates.length === 0) throw new Error('No nodes match the requested criteria');
  return candidates[Math.floor(Math.random() * candidates.length)].endpoint;
};
