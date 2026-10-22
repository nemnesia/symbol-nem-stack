import type { NetworkName } from '@nemnesia/symbol-nem-node-picker';
import { PublicKey } from '@nemnesia/symbol-sdk';
import { type Address, Network } from '@nemnesia/symbol-sdk/symbol';

const MAX_UINT64 = (1n << 64n) - 1n;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isHex = (value: unknown, bytes: number): value is string =>
  typeof value === 'string' && value.length === bytes * 2 && /^[0-9a-f]+$/i.test(value);

export const isUint64String = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 20 &&
  /^\d+$/.test(value) &&
  BigInt(value) <= MAX_UINT64;

export const isUint32 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

// Validate the REST fields consumed by this viewer before committing them to UI state.
export const validateChainInfo = (value: unknown): void => {
  if (
    !isRecord(value) ||
    !isUint64String(value.height) ||
    value.height === '0' ||
    !isUint64String(value.scoreHigh) ||
    !isUint64String(value.scoreLow)
  ) {
    throw new Error('Invalid chain info');
  }
  const finalized = value.latestFinalizedBlock;
  if (
    !isRecord(finalized) ||
    !isUint64String(finalized.height) ||
    BigInt(finalized.height) < 1n ||
    BigInt(finalized.height) > BigInt(value.height) ||
    !isUint32(finalized.finalizationEpoch) ||
    finalized.finalizationEpoch < 1 ||
    !isUint32(finalized.finalizationPoint) ||
    !isHex(finalized.hash, 32)
  ) {
    throw new Error('Invalid finalized block info');
  }
};

export const validateAccountInfo = (value: unknown, requestedPublicKey: string, networkName: NetworkName): void => {
  if (!isHex(requestedPublicKey, 32) || !isRecord(value) || !isRecord(value.account))
    throw new Error('Invalid account info');
  const account = value.account;
  if (
    !isHex(account.publicKey, 32) ||
    account.publicKey.toUpperCase() !== requestedPublicKey.toUpperCase() ||
    !isHex(account.address, 24) ||
    !Array.isArray(account.mosaics) ||
    !account.mosaics.every(
      (mosaic: unknown) => isRecord(mosaic) && isHex(mosaic.id, 8) && isUint64String(mosaic.amount)
    ) ||
    !isRecord(account.supplementalPublicKeys)
  ) {
    throw new Error('Invalid account info');
  }

  // SDK address derivation binds the response to both the requested identity and the selected network.
  const networks = { mainnet: Network.MAINNET, testnet: Network.TESTNET };
  const network = networks[networkName];
  if (!network) throw new Error('Invalid network');
  const expectedAddress: Address = network.publicKeyToAddress(new PublicKey(requestedPublicKey));
  const expectedHex = Array.from(expectedAddress.bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (account.address.toUpperCase() !== expectedHex.toUpperCase()) throw new Error('Account identity mismatch');

  const voting = account.supplementalPublicKeys.voting;
  if (
    voting !== undefined &&
    (!isRecord(voting) ||
      !Array.isArray(voting.publicKeys) ||
      !voting.publicKeys.every(
        (key: unknown) =>
          isRecord(key) &&
          isHex(key.publicKey, 32) &&
          isUint32(key.startEpoch) &&
          key.startEpoch > 0 &&
          isUint32(key.endEpoch) &&
          key.endEpoch >= key.startEpoch
      ))
  ) {
    throw new Error('Invalid voting keys');
  }
};
