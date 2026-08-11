import { Configuration, NEMNodesApi, SymbolNodesApi } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';

export const createSymbolNodeWatchApi = (baseUrl: string) =>
  new SymbolNodesApi(new Configuration({ basePath: baseUrl }));

export const createNemNodeWatchApi = (baseUrl: string) => new NEMNodesApi(new Configuration({ basePath: baseUrl }));
