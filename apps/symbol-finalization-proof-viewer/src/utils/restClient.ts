import {
  AccountInfoDTO,
  AccountRoutesApi,
  ChainRoutesApi,
  Configuration,
  FinalizationProofDTO,
  FinalizationRoutesApi,
} from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { type NetworkName, nemSymbolNodePicker } from 'nem-symbol-node-picker';

export const findAccountByPublicKey = async (
  publicKey: string,
  networkName: NetworkName = 'testnet'
): Promise<AccountInfoDTO> => {
  // 利用可能なSymbolノードを取得
  const symbolNodes = await nemSymbolNodePicker({
    chainName: 'symbol',
    network: networkName,
    count: 1,
    isSsl: true,
  });
  const selectedNode = symbolNodes[0];

  const accountRoutesApi = new AccountRoutesApi(new Configuration({ basePath: selectedNode }));
  const accountInfo = await accountRoutesApi.getAccountInfo({ accountId: publicKey });

  return accountInfo;
};

export const searchAccountsByPublicKeys = async (
  publicKeys: string[],
  networkName: NetworkName = 'testnet'
): Promise<AccountInfoDTO[]> => {
  // 利用可能なSymbolノードを取得
  const symbolNodes = await nemSymbolNodePicker({
    chainName: 'symbol',
    network: networkName,
    count: 1,
    isSsl: true,
  });
  const selectedNode = symbolNodes[0];

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
  const symbolNodes = await nemSymbolNodePicker({
    chainName: 'symbol',
    network: networkName,
    count: 1,
    isSsl: true,
  });
  const selectedNode = symbolNodes[0];

  const chainRoutesApi = new ChainRoutesApi(new Configuration({ basePath: selectedNode }));
  const chainInfo = await chainRoutesApi.getChainInfo();

  return chainInfo;
};

export const findFinalizationProofAtEpoch = async (
  currentEpoch: number,
  networkName: NetworkName = 'testnet'
): Promise<FinalizationProofDTO> => {
  // 利用可能なSymbolノードを取得
  const symbolNodes = await nemSymbolNodePicker({
    chainName: 'symbol',
    network: networkName,
    count: 1,
    isSsl: true,
  });
  const selectedNode = symbolNodes[0];

  const finalizationRoutesApi = new FinalizationRoutesApi(new Configuration({ basePath: selectedNode }));
  const finalizationProof = await finalizationRoutesApi.getFinalizationProofAtEpoch({ epoch: currentEpoch });

  return finalizationProof;
};
