import {
  createNemNodeWatchApi as createProviderNemNodeWatchApi,
  createSymbolNodeWatchApi as createProviderSymbolNodeWatchApi,
} from '@nemnesia/nodewatch-openapi-provider';

export const createSymbolNodeWatchApi = (baseUrls: readonly string[]) => createProviderSymbolNodeWatchApi(baseUrls);

export const createNemNodeWatchApi = (baseUrls: readonly string[]) => createProviderNemNodeWatchApi(baseUrls);
