// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

vi.mock('./components/FinalizationProofViewer', () => ({
  default: ({ networkName }: { networkName: string }) => <div data-testid="network">{networkName}</div>,
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  window.history.replaceState(null, '', '/?network=testnet&filter=example.com');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('network selection', () => {
  it('starts from the URL and updates the network, persisted selection and URL together', async () => {
    localStorage.setItem('networkName', 'mainnet');
    await act(async () => root.render(<App />));
    expect(container.querySelector('[data-testid="network"]')?.textContent).toBe('testnet');
    const mainnet = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Mainnet'
    )!;
    const testnet = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Testnet'
    )!;
    expect(testnet.getAttribute('aria-pressed')).toBe('true');
    await act(async () => mainnet.click());
    expect(mainnet.getAttribute('aria-pressed')).toBe('true');
    expect(testnet.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="network"]')?.textContent).toBe('mainnet');
    expect(localStorage.getItem('networkName')).toBe('mainnet');
    expect(new URL(window.location.href).searchParams.get('network')).toBe('mainnet');
    expect(new URL(window.location.href).searchParams.get('filter')).toBe('example.com');
    await act(async () => mainnet.click());
    expect(container.querySelector('[data-testid="network"]')?.textContent).toBe('mainnet');
  });
});
