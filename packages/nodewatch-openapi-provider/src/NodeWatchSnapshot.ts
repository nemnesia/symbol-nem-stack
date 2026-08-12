import {
  type Configuration,
  type HeightInfo,
  type InitOverrideFunction,
  NEMNodesApi,
  type Node,
  SymbolNodesApi,
} from '@nemnesia/nodewatch-openapi-typescript-fetch-client';

import { FailoverApi } from './FailoverApi.js';

/** NodeWatchから同一URL組で取得したheightとノード一覧 */
export interface NodeWatchSnapshot {
  heightInfo: HeightInfo;
  nodes: Node[];
}

type NodeWatchInitOverrides = RequestInit | InitOverrideFunction;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasUsableEndpoint(value: unknown): value is Node {
  return isRecord(value) && typeof value.endpoint === 'string' && value.endpoint.trim().length > 0;
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum;
}

function isPublicKey(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9A-Fa-f]{64}$/.test(value);
}

function isAbsoluteUri(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidHeightInfo(value: unknown): value is HeightInfo {
  if (!isRecord(value)) return false;

  return isIntegerAtLeast(value.height, 1) && isIntegerAtLeast(value.finalizedHeight, 1);
}

function isValidNode(value: unknown): value is Node {
  if (!isRecord(value)) return false;

  return (
    isPublicKey(value.mainPublicKey) &&
    typeof value.endpoint === 'string' &&
    value.endpoint.trim().length > 0 &&
    isAbsoluteUri(value.endpoint) &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    isIntegerAtLeast(value.height, 0) &&
    isIntegerAtLeast(value.finalizedHeight, 0) &&
    typeof value.balance === 'number' &&
    Number.isFinite(value.balance) &&
    value.balance >= 0
  );
}

function validateHeightInfo(value: unknown): HeightInfo {
  if (!isValidHeightInfo(value)) throw new Error('Invalid NodeWatch height response');
  return value;
}

function validateNodeList(value: unknown): Node[] {
  if (!Array.isArray(value)) throw new Error('Invalid NodeWatch node list response');

  const usableNodes = value.filter(hasUsableEndpoint);
  if (!usableNodes.every(isValidNode)) throw new Error('Invalid NodeWatch node response');
  return usableNodes.filter((node) => node.height !== 0 && node.finalizedHeight !== 0);
}

function prepareInitOverrides(initOverrides?: NodeWatchInitOverrides): {
  requestInitOverrides?: NodeWatchInitOverrides;
  getSignal: () => AbortSignal | undefined;
} {
  if (typeof initOverrides !== 'function') {
    return {
      requestInitOverrides: initOverrides,
      getSignal: () => initOverrides?.signal ?? undefined,
    };
  }

  const signals = new Set<AbortSignal>();
  const requestInitOverrides: InitOverrideFunction = async (requestContext) => {
    const requestInit = await initOverrides(requestContext);
    if (requestInit.signal) signals.add(requestInit.signal);
    return requestInit;
  };

  return {
    requestInitOverrides,
    getSignal: () => [...signals].find((signal) => signal.aborted) ?? [...signals][0],
  };
}

async function fetchSnapshot<TApi>(
  ApiClass: new (configuration: Configuration) => TApi,
  baseUrls: readonly string[],
  request: (api: TApi, initOverrides?: NodeWatchInitOverrides) => Promise<NodeWatchSnapshot>,
  initOverrides?: NodeWatchInitOverrides
): Promise<NodeWatchSnapshot> {
  const failoverApi = new FailoverApi(ApiClass, baseUrls, true);
  const preparedInitOverrides = prepareInitOverrides(initOverrides);
  return failoverApi.executeBatch(
    (api) => request(api, preparedInitOverrides.requestInitOverrides),
    preparedInitOverrides.getSignal
  );
}

/** Symbolのheightとpeer node一覧を同じNodeWatch URL組から取得する */
export function fetchSymbolNodeWatchSnapshot(
  baseUrls: readonly string[],
  initOverrides?: NodeWatchInitOverrides
): Promise<NodeWatchSnapshot> {
  return fetchSnapshot(
    SymbolNodesApi,
    baseUrls,
    async (api, requestInit) => {
      const [heightInfo, nodes] = await Promise.all([
        api.getSymbolHeight(requestInit),
        api.getSymbolPeerNodes({}, requestInit),
      ]);
      return { heightInfo: validateHeightInfo(heightInfo), nodes: validateNodeList(nodes) };
    },
    initOverrides
  );
}

/** NEMのheightとnode一覧を同じNodeWatch URL組から取得する */
export function fetchNemNodeWatchSnapshot(
  baseUrls: readonly string[],
  initOverrides?: NodeWatchInitOverrides
): Promise<NodeWatchSnapshot> {
  return fetchSnapshot(
    NEMNodesApi,
    baseUrls,
    async (api, requestInit) => {
      const [heightInfo, nodes] = await Promise.all([api.getNemHeight(requestInit), api.getNemNodes(requestInit)]);
      return { heightInfo: validateHeightInfo(heightInfo), nodes: validateNodeList(nodes) };
    },
    initOverrides
  );
}
