import {
  Configuration,
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

function hasUsableEndpoint(value: Node): boolean {
  return typeof value.endpoint === 'string' && value.endpoint.trim().length > 0;
}

async function fetchSnapshot<TApi>(
  ApiClass: new (configuration: Configuration) => TApi,
  baseUrls: readonly string[],
  request: (api: TApi, initOverrides?: NodeWatchInitOverrides) => Promise<NodeWatchSnapshot>,
  initOverrides?: NodeWatchInitOverrides
): Promise<NodeWatchSnapshot> {
  const failoverApi = new FailoverApi(ApiClass, baseUrls, true);
  return failoverApi.executeBatch((api) => request(api, initOverrides));
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
      return { heightInfo, nodes: nodes.filter(hasUsableEndpoint) };
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
      return { heightInfo, nodes: nodes.filter(hasUsableEndpoint) };
    },
    initOverrides
  );
}
