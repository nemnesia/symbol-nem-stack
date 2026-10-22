import type { FinalizationProofDTO } from '@nemnesia/symbol-openapi-typescript-fetch-client';

import type {
  CurrencyState,
  NodeFilter,
  ProofState,
  VotingNodeInfoData,
  VotingPublicKeyInfo,
} from '../types/votingNode';
import { isHex, isRecord, isUint32, isUint64String } from './restValidation';
import type { ExpiryState } from './votingKeyExpiry';

export const keyStatus = (epoch: number | undefined, key: VotingPublicKeyInfo) => {
  if (epoch === undefined) return 'Unknown';
  if (epoch < key.startEpoch) return 'Next';
  if (epoch > key.endEpoch) return 'Expired';
  return 'Current';
};

// Stage values are defined by the REST OpenAPI StageEnum (0: Prevote, 1: Precommit).
export const stageSignatures = (node: VotingNodeInfoData, proof: ProofState, stage: 0 | 1): string[] | null => {
  if (node.accountStatus !== 'ready' || proof.status !== 'ready' || !proof.proof) return null;
  const publicKeys = new Set(node.votingPublicKeys.map((key) => key.votingPublicKey.toUpperCase()));
  return proof.proof.messageGroups
    .filter((group) => group.stage === stage)
    .flatMap((group) => group.signatures)
    .filter((signature) => publicKeys.has(signature.root.parentPublicKey.toUpperCase()))
    .map((signature) => signature.bottom.signature);
};

export const nodeAmount = (node: VotingNodeInfoData, currency: CurrencyState): string | null => {
  if (node.accountStatus !== 'ready' || currency.status !== 'ready' || !currency.mosaicId) return null;
  const amount = node.mosaics?.find((mosaic) => mosaic.id.toUpperCase() === currency.mosaicId)?.amount ?? '0';
  return isUint64String(amount) ? amount : null;
};

export const filterVotingNodes = (
  nodes: VotingNodeInfoData[],
  search: string,
  filter: NodeFilter,
  proof: ProofState,
  currency: CurrencyState,
  expiry?: ExpiryState
) => {
  const query = search.trim().toLowerCase();
  return nodes.filter((node) => {
    if (![node.host, node.publicKey, node.address ?? ''].some((value) => value.toLowerCase().includes(query)))
      return false;
    if (filter === 'all') return true;
    if (filter === 'error')
      return (
        node.accountStatus === 'error' ||
        proof.status === 'error' ||
        currency.status === 'error' ||
        expiry?.status === 'error'
      );
    const vote = stageSignatures(node, proof, 0);
    const commit = stageSignatures(node, proof, 1);
    if (vote === null || commit === null) return false;
    return filter === 'signed' ? vote.length > 0 || commit.length > 0 : vote.length === 0 || commit.length === 0;
  });
};

// Validate the fields consumed by the UI, without claiming cryptographic proof verification.
export const isDisplayableProof = (proof: unknown, epoch: number): proof is FinalizationProofDTO =>
  isRecord(proof) &&
  isUint32(proof.finalizationEpoch) &&
  proof.finalizationEpoch === epoch &&
  Array.isArray(proof.messageGroups) &&
  proof.messageGroups.every(
    (group: unknown) =>
      isRecord(group) &&
      (group.stage === 0 || group.stage === 1 || group.stage === 2) &&
      isUint64String(group.height) &&
      BigInt(group.height) > 0n &&
      Array.isArray(group.signatures) &&
      group.signatures.every(
        (signature: unknown) =>
          isRecord(signature) &&
          isRecord(signature.root) &&
          isRecord(signature.bottom) &&
          isHex(signature.root.parentPublicKey, 32) &&
          isHex(signature.bottom.signature, 64)
      )
  );
