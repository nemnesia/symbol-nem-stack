import type { FinalizationProofDTO } from '@nemnesia/symbol-openapi-typescript-fetch-client';

export type FetchStatus = 'loading' | 'ready' | 'error';
export type NodeFilter = 'all' | 'signed' | 'unsigned' | 'error';

export type VotingPublicKeyInfo = {
  votingPublicKey: string;
  startEpoch: number;
  endEpoch: number;
};

export type VotingNodeInfoData = {
  host: string;
  publicKey: string;
  address?: string;
  accountStatus: FetchStatus;
  mosaics?: { id: string; amount: string }[];
  votingPublicKeys: VotingPublicKeyInfo[];
};

export type ProofState = {
  status: FetchStatus;
  epoch?: number;
  proof?: FinalizationProofDTO;
};

export type CurrencyState = {
  status: FetchStatus;
  mosaicId?: string;
};
