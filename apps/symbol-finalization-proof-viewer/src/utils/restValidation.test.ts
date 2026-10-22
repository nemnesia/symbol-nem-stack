import { describe, expect, it } from 'vitest';

import { isUint64String, validateAccountInfo, validateChainInfo } from './restValidation';

// Public address vectors: _symbol/tests/vectors/symbol/crypto/1.test-address.json, entry 1.
// Addresses decoded from the fixed Base32 vectors, independently of the SDK derivation under test.
const publicKey = '2E834140FD66CF87B254A693A2C7862C819217B676D3943267156625E816EC6F';
const mainnetAddress = '6826D27E1D0A26CA4E316F901E23E55C8711DB20DF250DEF';
const testnetAddress = '9826D27E1D0A26CA4E316F901E23E55C8711DB20DFD26776';
const account = {
  account: {
    publicKey,
    address: testnetAddress,
    mosaics: [{ id: '1234567890ABCDEF', amount: '18446744073709551615' }],
    supplementalPublicKeys: { voting: { publicKeys: [{ publicKey: 'B'.repeat(64), startEpoch: 10, endEpoch: 20 }] } },
  },
};
const chain = {
  height: '100',
  scoreHigh: '0',
  scoreLow: '18446744073709551615',
  latestFinalizedBlock: { height: '90', finalizationEpoch: 12, finalizationPoint: 1, hash: 'C'.repeat(64) },
};

describe('REST uint64 validation', () => {
  it.each(['0', '9007199254740993', '18446744073709551615'])('accepts exact string integer %s', (value) => {
    expect(isUint64String(value)).toBe(true);
  });
  it.each([0, 3500000000000, null, undefined, '', '-1', '1.0', '1e6', '18446744073709551616', '9'.repeat(1000)])(
    'rejects invalid amount %s',
    (value) => {
      expect(isUint64String(value)).toBe(false);
    }
  );
});

describe('chain response validation', () => {
  it('accepts the required chain and finalized-block fields', () => {
    expect(() => validateChainInfo(chain)).not.toThrow();
  });
  it.each([
    null,
    {},
    { ...chain, latestFinalizedBlock: undefined },
    { ...chain, latestFinalizedBlock: null },
    { ...chain, height: 100 },
    { ...chain, height: '0' },
    { ...chain, height: '18446744073709551616' },
    { ...chain, latestFinalizedBlock: { ...chain.latestFinalizedBlock, height: '101' } },
    { ...chain, latestFinalizedBlock: { ...chain.latestFinalizedBlock, finalizationEpoch: -1 } },
    { ...chain, latestFinalizedBlock: { ...chain.latestFinalizedBlock, finalizationEpoch: 0x100000000 } },
    { ...chain, latestFinalizedBlock: { ...chain.latestFinalizedBlock, hash: 'invalid' } },
  ])('rejects malformed response %#', (value) => {
    expect(() => validateChainInfo(value)).toThrow();
  });
});

describe('account identity and display-field validation', () => {
  it.each([
    ['mainnet', mainnetAddress],
    ['testnet', testnetAddress],
  ] as const)('matches the fixed %s address vector', (network, address) => {
    expect(() => validateAccountInfo({ account: { ...account.account, address } }, publicKey, network)).not.toThrow();
  });

  it('accepts case differences and an account without voting keys or mosaics', () => {
    expect(() =>
      validateAccountInfo(
        {
          account: {
            ...account.account,
            publicKey: publicKey.toLowerCase(),
            address: testnetAddress.toLowerCase(),
            mosaics: [],
            supplementalPublicKeys: {},
          },
        },
        publicKey,
        'testnet'
      )
    ).not.toThrow();
  });

  it.each([
    { ...account.account, publicKey: 'A'.repeat(64) },
    { ...account.account, address: mainnetAddress },
    { ...account.account, address: '98E3E25B5609D301E18D316FAA072763322EBCCBD602EDA8' },
    { ...account.account, address: testnetAddress.slice(0, -1) + '0' },
    { ...account.account, mosaics: [{ id: '1234567890ABCDEF', amount: 3500000000000 }] },
    { ...account.account, mosaics: [{ id: '1234567890ABCDEF', amount: '18446744073709551616' }] },
    { ...account.account, mosaics: [null] },
    { ...account.account, supplementalPublicKeys: undefined },
    { ...account.account, supplementalPublicKeys: { voting: { publicKeys: null } } },
    {
      ...account.account,
      supplementalPublicKeys: { voting: { publicKeys: [{ publicKey: 'B'.repeat(64), startEpoch: 0, endEpoch: 20 }] } },
    },
    {
      ...account.account,
      supplementalPublicKeys: {
        voting: { publicKeys: [{ publicKey: 'B'.repeat(64), startEpoch: 10, endEpoch: 0x100000000 }] },
      },
    },
  ])('rejects a mismatched identity or invalid display field %#', (invalid) => {
    expect(() => validateAccountInfo({ account: invalid }, publicKey, 'testnet')).toThrow();
  });
});
