import type { NetworkName } from '@nemnesia/symbol-nem-node-picker';
import {
  AccountInfoDTO,
  AccountRoutesApi,
  BlockRoutesApi,
  ChainRoutesApi,
  Configuration,
  FinalizationProofDTO,
  FinalizationRoutesApi,
  MosaicRoutesApi,
  NetworkRoutesApi,
} from '@nemnesia/symbol-openapi-typescript-fetch-client';

import { pickSymbolNode } from './nodewatch';
import { type ExpiryReference, createExpiryReference } from './votingKeyExpiry';

export const findAccountByPublicKey = async (
  publicKey: string,
  networkName: NetworkName = 'testnet'
): Promise<AccountInfoDTO> => {
  // 利用可能なSymbolノードを取得
  const selectedNode = await pickSymbolNode(networkName);

  const accountRoutesApi = new AccountRoutesApi(new Configuration({ basePath: selectedNode }));
  const accountInfo = await accountRoutesApi.getAccountInfo({ accountId: publicKey });

  return accountInfo;
};

export const searchAccountsByPublicKeys = async (
  publicKeys: string[],
  networkName: NetworkName = 'testnet'
): Promise<AccountInfoDTO[]> => {
  // 利用可能なSymbolノードを取得
  const selectedNode = await pickSymbolNode(networkName);

  const accountRoutesApi = new AccountRoutesApi(new Configuration({ basePath: selectedNode }));

  const accountInfos: AccountInfoDTO[] = [];
  for (const publicKey of publicKeys) {
    const accountInfo = await accountRoutesApi.getAccountInfo({ accountId: publicKey });
    accountInfos.push(accountInfo);
  }

  return accountInfos;
};

export const findChainInfo = async (networkName: NetworkName = 'testnet') => {
  // 利用可能なSymbolノードを取得
  const selectedNode = await pickSymbolNode(networkName);

  const chainRoutesApi = new ChainRoutesApi(new Configuration({ basePath: selectedNode }));
  const chainInfo = await chainRoutesApi.getChainInfo();

  return chainInfo;
};

export const findFinalizationProofAtEpoch = async (
  currentEpoch: number,
  networkName: NetworkName = 'testnet'
): Promise<FinalizationProofDTO> => {
  // 利用可能なSymbolノードを取得
  const selectedNode = await pickSymbolNode(networkName);

  const finalizationRoutesApi = new FinalizationRoutesApi(new Configuration({ basePath: selectedNode }));
  const finalizationProof = await finalizationRoutesApi.getFinalizationProofAtEpoch({ epoch: currentEpoch });

  return finalizationProof;
};

// Resolve the chain currency explicitly; account mosaic ordering does not identify XYM.
export const findCurrencyMosaicId = async (networkName: NetworkName): Promise<string> => {
  const basePath = await pickSymbolNode(networkName);
  const configuration = new Configuration({ basePath });
  const properties = await new NetworkRoutesApi(configuration).getNetworkProperties();
  const mosaicId = properties.chain.currencyMosaicId?.replace(/^0x/i, '').replaceAll("'", '').toUpperCase();
  if (!mosaicId || !/^[0-9A-F]{16}$/.test(mosaicId)) throw new Error('Invalid currency mosaic ID');
  const { mosaic } = await new MosaicRoutesApi(configuration).getMosaic({ mosaicId });
  if (mosaic.id.toUpperCase() !== mosaicId || mosaic.divisibility !== 6) throw new Error('Unexpected currency mosaic');
  return mosaicId;
};

export const findVotingKeyExpiryReference = async (networkName: NetworkName): Promise<ExpiryReference> => {
  const basePath = await pickSymbolNode(networkName);
  const configuration = new Configuration({ basePath });
  const [response, chain] = await Promise.all([
    new NetworkRoutesApi(configuration).getNetworkPropertiesRaw(),
    new ChainRoutesApi(configuration).getChainInfo(),
  ]);
  // The generated ChainPropertiesDTO drops votingSetGrouping. Preserve the raw REST field locally.
  const properties: unknown = await response.raw.json();
  const { block } = await new BlockRoutesApi(configuration).getBlockByHeight({ height: chain.height });
  if (block.height !== chain.height) throw new Error('Unexpected reference block height');
  return createExpiryReference(properties, block.height, block.timestamp, Date.now());
};
