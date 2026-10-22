// @vitest-environment jsdom
import type { Node } from '@nemnesia/nodewatch-openapi-typescript-fetch-client';
import type {
  AccountInfoDTO,
  ChainInfoDTO,
  FinalizationProofDTO,
} from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { AccountInfoDTOFromJSON, ChainInfoDTOFromJSON } from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as rest from '../utils/restClient';
import VotingNodeList from './VotingNodeList';

vi.mock('../utils/restClient', () => ({
  findAccountByPublicKey: vi.fn(),
  findChainInfo: vi.fn(),
  findCurrencyMosaicId: vi.fn(),
  findVotingKeyExpiryReference: vi.fn(),
  findFinalizationProofAtEpoch: vi.fn(),
}));

// Public key/address: _symbol/tests/vectors/symbol/crypto/1.test-address.json, entry 1.
const publicKey = '2E834140FD66CF87B254A693A2C7862C819217B676D3943267156625E816EC6F';
const votingKey = 'B'.repeat(64);
const discoveryNode: Node = {
  mainPublicKey: publicKey,
  endpoint: 'https://node.example.com',
  name: 'test',
  version: '1',
  height: 100,
  finalizedHeight: 90,
  balance: 0,
};
const chain: ChainInfoDTO = {
  height: '100',
  scoreHigh: '0',
  scoreLow: '0',
  latestFinalizedBlock: { finalizationEpoch: 12, finalizationPoint: 1, height: '90', hash: 'C'.repeat(64) },
};
const proof: FinalizationProofDTO = {
  version: 1,
  finalizationEpoch: 12,
  finalizationPoint: 1,
  height: '90',
  hash: 'C'.repeat(64),
  messageGroups: [
    { stage: 0, height: '90', hashes: [], signatures: [] },
    { stage: 1, height: '90', hashes: [], signatures: [] },
  ],
};
const account: AccountInfoDTO = {
  id: 'test',
  account: {
    version: 1,
    address: '9826D27E1D0A26CA4E316F901E23E55C8711DB20DFD26776',
    addressHeight: '1',
    publicKey,
    publicKeyHeight: '1',
    accountType: 1,
    supplementalPublicKeys: {
      voting: {
        publicKeys: [
          { publicKey: votingKey, startEpoch: 10, endEpoch: 20 },
          { publicKey: 'D'.repeat(64), startEpoch: 1, endEpoch: 9 },
        ],
      },
    },
    activityBuckets: [],
    mosaics: [{ id: '1234567890ABCDEF', amount: '3500000000000' }],
    importance: '0',
    importanceHeight: '1',
  },
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(rest.findVotingKeyExpiryReference).mockResolvedValue({
    height: 100n,
    timestampMs: BigInt(Date.now()),
    observedAtMs: BigInt(Date.now()),
    votingSetGrouping: 10n,
    blockGenerationTargetTimeMs: 30_000n,
  });
  vi.mocked(rest.findChainInfo).mockResolvedValue(chain);
  vi.mocked(rest.findCurrencyMosaicId).mockResolvedValue('1234567890ABCDEF');
  vi.mocked(rest.findFinalizationProofAtEpoch).mockResolvedValue(proof);
  vi.mocked(rest.findAccountByPublicKey).mockResolvedValue(account);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const render = async (nodes = [discoveryNode], onRetry = vi.fn()) => {
  await act(async () =>
    root.render(
      <VotingNodeList
        votingNodes={nodes}
        urlFilter={null}
        networkName="testnet"
        discoveryStatus="ready"
        onRetry={onRetry}
      />
    )
  );
};
const chipLabels = () => Array.from(container.querySelectorAll('.MuiChip-label')).map((element) => element.textContent);

describe('voting node screen states', () => {
  it('shows pending data without inventing zero balances or absent signatures', async () => {
    vi.mocked(rest.findAccountByPublicKey).mockReturnValue(new Promise(() => {}));
    vi.mocked(rest.findFinalizationProofAtEpoch).mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.textContent).toContain('取得中');
    expect(container.textContent).not.toContain('0.000000 XYM');
    expect(chipLabels()).toEqual(['確認中', '確認中']);
  });

  it('keeps account failures visible while the proof succeeds', async () => {
    vi.mocked(rest.findAccountByPublicKey).mockRejectedValue(new Error('Unavailable'));
    await render();
    expect(container.textContent).toContain('アカウント情報の取得失敗');
    expect(container.textContent).not.toContain('0.000000 XYM');
    expect(chipLabels()).toEqual(['取得失敗', '取得失敗']);
  });

  it('keeps proof failures separate from fetched balances and missing signatures', async () => {
    vi.mocked(rest.findFinalizationProofAtEpoch).mockRejectedValue(new Error('Unavailable'));
    await render();
    expect(container.textContent).toContain('対象Proofを取得できませんでした');
    expect(container.textContent).toContain('3,500,000.000000 XYM');
    expect(chipLabels().slice(0, 2)).toEqual(['取得失敗', '取得失敗']);
  });

  it('shows completed signatures, folds old keys, and searches locally', async () => {
    await render();
    expect(chipLabels().slice(0, 2)).toEqual(['署名なし', '署名なし']);
    const oldKeys = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('過去・次回のキー')
    )!;
    expect(oldKeys.getAttribute('aria-expanded')).toBe('false');
    await act(async () => oldKeys.click());
    expect(oldKeys.getAttribute('aria-expanded')).toBe('true');
    const input = container.querySelector('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'missing');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('条件に一致するノードがありません');
    expect(rest.findAccountByPublicKey).toHaveBeenCalledTimes(1);
    const clear = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '条件をクリア'
    )!;
    await act(async () => clear.click());
    expect(container.querySelector('article')?.textContent).toContain('node.example.com');
    expect(rest.findAccountByPublicKey).toHaveBeenCalledTimes(1);
  });

  it('shows an estimated expiry date with remaining time for a current voting key', async () => {
    await render();
    expect(container.textContent).toContain('期限の目安：');
    expect(container.textContent).toContain('1日未満');
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBeTruthy();
    expect(container.textContent).toContain('期限切れ（対象Proof基準）');
    expect(rest.findVotingKeyExpiryReference).toHaveBeenCalledWith('testnet');
  });

  it('keeps fetched account and proof data visible when expiry settings are unavailable', async () => {
    vi.mocked(rest.findVotingKeyExpiryReference).mockRejectedValue(new Error('Unavailable'));
    await render();
    expect(container.textContent).toContain('期限の目安：推定できません（情報取得失敗）');
    expect(container.querySelector('time')).toBeNull();
    expect(container.textContent).toContain('3,500,000.000000 XYM');
    expect(chipLabels().slice(0, 2)).toEqual(['署名なし', '署名なし']);
  });

  it.each([
    { ...account.account, publicKey: 'A'.repeat(64) },
    { ...account.account, address: '6826D27E1D0A26CA4E316F901E23E55C8711DB20DF250DEF' },
    { ...account.account, mosaics: [{ id: '1234567890ABCDEF', amount: 3500000000000 }] },
    { ...account.account, mosaics: [{ id: '1234567890ABCDEF', amount: '18446744073709551616' }] },
  ])('keeps invalid account data out of the display and allows retry %#', async (invalidAccount) => {
    vi.mocked(rest.findAccountByPublicKey).mockResolvedValue(
      AccountInfoDTOFromJSON({ id: 'invalid', account: invalidAccount })
    );
    const retry = vi.fn();
    await render([discoveryNode], retry);
    expect(container.querySelector('article')?.textContent).toContain('アカウント情報の取得失敗');
    expect(container.textContent).not.toContain('3,500,000.000000 XYM');
    expect(chipLabels().slice(0, 2)).toEqual(['取得失敗', '取得失敗']);
    const button = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent === '再取得'
    )!;
    await act(async () => button.click());
    expect(retry).toHaveBeenCalledOnce();
  });

  it('rejects a malformed chain response without crashing the account list', async () => {
    vi.mocked(rest.findChainInfo).mockResolvedValue(
      ChainInfoDTOFromJSON({ height: '100', scoreHigh: '0', scoreLow: '0' })
    );
    await render();
    expect(container.textContent).toContain('対象Proofを取得できませんでした');
    expect(container.querySelector('article')).not.toBeNull();
    expect(rest.findFinalizationProofAtEpoch).not.toHaveBeenCalled();
  });

  it('provides a retry action and an explicit empty state', async () => {
    const retry = vi.fn();
    await render([], retry);
    expect(container.textContent).toContain('表示できる投票ノードがありません');
    const button = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent === '再取得'
    )!;
    await act(async () => button.click());
    expect(retry).toHaveBeenCalledOnce();
  });
});
