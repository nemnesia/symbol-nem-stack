import type { NetworkName } from '@nemnesia/symbol-nem-node-picker';
import {
  AccountInfoDTO,
  AccountRoutesApi,
  ChainRoutesApi,
  Configuration,
  FinalizationProofDTO,
  FinalizationRoutesApi,
} from '@nemnesia/symbol-openapi-typescript-fetch-client';

import { pickSymbolNode } from './nodewatch';

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
