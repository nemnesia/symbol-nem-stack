// @vitest-environment jsdom
import { ChainInfoDTOFromJSON } from '@nemnesia/symbol-openapi-typescript-fetch-client';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findChainInfo } from '../utils/restClient';
import ChainInfoCard from './ChainInfoCard';

vi.mock('../utils/restClient', () => ({ findChainInfo: vi.fn() }));
const chain = {
  height: '100',
  scoreHigh: '0',
  scoreLow: '0',
  latestFinalizedBlock: { height: '90', finalizationEpoch: 12, finalizationPoint: 1, hash: 'C'.repeat(64) },
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('chain info rejection and recovery', () => {
  it.each([
    { height: '100', scoreHigh: '0', scoreLow: '0' },
    { ...chain, height: 100 },
    { ...chain, latestFinalizedBlock: { ...chain.latestFinalizedBlock, height: '18446744073709551616' } },
  ])('keeps the screen and retry action available after invalid REST data %#', async (json) => {
    // Use the generated converter to reproduce the unchecked shape of a real successful REST response.
    vi.mocked(findChainInfo).mockResolvedValueOnce(ChainInfoDTOFromJSON(json)).mockResolvedValueOnce(chain);
    await act(async () => root.render(<ChainInfoCard networkName="testnet" />));
    expect(container.textContent).toContain('チェーン情報を取得できませんでした');
    const retry = container.querySelector('button')!;
    expect(retry.textContent).toBe('再取得');
    await act(async () => retry.click());
    expect(container.textContent).not.toContain('取得できませんでした');
    expect(container.textContent).toContain('100');
    expect(container.textContent).toContain('90');
    expect(findChainInfo).toHaveBeenCalledTimes(2);
  });
});
