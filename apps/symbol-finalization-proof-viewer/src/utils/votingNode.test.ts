import type { FinalizationProofDTO, MessageGroup } from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { describe, expect, it } from 'vitest';

import type { CurrencyState, ProofState, VotingNodeInfoData } from '../types/votingNode';
import { filterVotingNodes, isDisplayableProof, keyStatus, nodeAmount, stageSignatures } from './votingNode';

const votingPublicKey = 'A'.repeat(64);
const signature = {
  root: { parentPublicKey: votingPublicKey, signature: 'B'.repeat(128) },
  bottom: { parentPublicKey: 'C'.repeat(64), signature: 'D'.repeat(128) },
};
const group = (stage: 0 | 1, signed = true): MessageGroup => ({
  stage,
  height: '100',
  hashes: [],
  signatures: signed ? [signature] : [],
});
const proofData: FinalizationProofDTO = {
  version: 1,
  finalizationEpoch: 12,
  finalizationPoint: 1,
  height: '100',
  hash: 'E'.repeat(64),
  messageGroups: [group(1), group(0, false)],
};
const proof: ProofState = { status: 'ready', epoch: 12, proof: proofData };
const currency: CurrencyState = { status: 'ready', mosaicId: '1234567890ABCDEF' };
const node: VotingNodeInfoData = {
  host: 'node.example.com',
  publicKey: 'F'.repeat(64),
  address: 'TEXAMPLEADDRESS',
  accountStatus: 'ready',
  votingPublicKeys: [{ votingPublicKey, startEpoch: 10, endEpoch: 20 }],
  mosaics: [
    { id: '0000000000000001', amount: '99' },
    { id: '1234567890abcdef', amount: '9007199254740993123' },
  ],
};

describe('voting node presentation', () => {
  it('keeps loading and failure separate from an absent signature', () => {
    expect(stageSignatures(node, { status: 'loading' }, 0)).toBeNull();
    expect(stageSignatures(node, { status: 'error' }, 0)).toBeNull();
    expect(stageSignatures({ ...node, accountStatus: 'error' }, proof, 0)).toBeNull();
    expect(stageSignatures(node, proof, 0)).toEqual([]);
  });

  it('matches stages by their value and checks all registered voting keys', () => {
    const withOldKey = {
      ...node,
      votingPublicKeys: [{ votingPublicKey: '0'.repeat(64), startEpoch: 1, endEpoch: 9 }, ...node.votingPublicKeys],
    };
    expect(stageSignatures(withOldKey, proof, 1)).toEqual([signature.bottom.signature]);
    expect(stageSignatures(withOldKey, proof, 0)).toEqual([]);
  });

  it('does not mistake signatures from other accounts for a matching signature', () => {
    expect(stageSignatures({ ...node, votingPublicKeys: [] }, proof, 1)).toEqual([]);
  });

  it('requires completed data for signature filters', () => {
    expect(filterVotingNodes([node], '', 'unsigned', { status: 'error' }, currency)).toEqual([]);
    expect(filterVotingNodes([{ ...node, accountStatus: 'loading' }], '', 'unsigned', proof, currency)).toEqual([]);
    expect(filterVotingNodes([node], '', 'unsigned', proof, currency)).toEqual([node]);
    expect(filterVotingNodes([node], '', 'signed', proof, currency)).toEqual([node]);
    expect(filterVotingNodes([node], '', 'error', { status: 'error' }, currency)).toEqual([node]);
  });

  it.each([' NODE.EXAMPLE ', 'ffff', 'texampleaddress'])(
    'searches host, public key and address without case sensitivity: %s',
    (query) => {
      expect(filterVotingNodes([node], query, 'all', proof, currency)).toEqual([node]);
      expect(filterVotingNodes([node], 'missing', 'all', proof, currency)).toEqual([]);
    }
  );

  it('selects the chain currency by ID and preserves integer precision', () => {
    expect(nodeAmount(node, currency)).toBe('9007199254740993123');
    expect(nodeAmount({ ...node, mosaics: [] }, currency)).toBe('0');
    expect(nodeAmount(node, { status: 'error' })).toBeNull();
    expect(nodeAmount({ ...node, accountStatus: 'error' }, currency)).toBeNull();
  });

  it('keeps key periods unknown until the epoch is available, including both endpoints', () => {
    const key = node.votingPublicKeys[0];
    expect(keyStatus(undefined, key)).toBe('Unknown');
    expect(keyStatus(9, key)).toBe('Next');
    expect(keyStatus(10, key)).toBe('Current');
    expect(keyStatus(20, key)).toBe('Current');
    expect(keyStatus(21, key)).toBe('Expired');
  });

  it('rejects mismatched epochs and malformed display fields in a proof', () => {
    expect(isDisplayableProof(proofData, 12)).toBe(true);
    expect(isDisplayableProof(proofData, 13)).toBe(false);
    expect(isDisplayableProof({ ...proofData, messageGroups: [{ ...group(0), height: 'unknown' }] }, 12)).toBe(false);
    expect(
      isDisplayableProof(
        {
          ...proofData,
          messageGroups: [
            { ...group(1), signatures: [{ ...signature, bottom: { ...signature.bottom, signature: '-' } }] },
          ],
        },
        12
      )
    ).toBe(false);
  });
});
