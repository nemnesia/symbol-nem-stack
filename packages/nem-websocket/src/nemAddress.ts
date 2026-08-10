import { keccak_256 } from '@noble/hashes/sha3.js';

const NEM_ADDRESS_LENGTH = 40;
const NEM_ADDRESS_DECODED_LENGTH = 25;
const NEM_TESTNET_VERSION = 0x98;
const NEM_CHECKSUM_LENGTH = 4;
const NEM_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeNemBase32(address: string): Uint8Array | undefined {
  const decoded = new Uint8Array(NEM_ADDRESS_DECODED_LENGTH);
  let buffer = 0;
  let bits = 0;
  let decodedIndex = 0;

  for (const character of address) {
    const value = NEM_BASE32_ALPHABET.indexOf(character);
    if (value < 0) return undefined;

    buffer = (buffer << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      if (decodedIndex >= decoded.length) return undefined;
      decoded[decodedIndex++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }

  return decodedIndex === decoded.length && bits === 0 ? decoded : undefined;
}

function hasValidNemTestnetChecksum(decoded: Uint8Array): boolean {
  const checksumStart = decoded.length - NEM_CHECKSUM_LENGTH;
  const calculatedChecksum = keccak_256(decoded.subarray(0, checksumStart));

  for (let index = 0; index < NEM_CHECKSUM_LENGTH; index++) {
    if (calculatedChecksum[index] !== decoded[checksumStart + index]) return false;
  }
  return true;
}

/**
 * NIS1 testnetのcanonicalなアドレスへ正規化する。
 *
 * NIS1のデフォルトネットワークはtestnetであるため、network byteは0x98に固定する。
 */
export function normalizeNemTestnetAddress(address: string): string {
  const normalizedAddress = address.toUpperCase();
  if (normalizedAddress.length !== NEM_ADDRESS_LENGTH) {
    throw new TypeError('address must be a valid NEM testnet address');
  }

  const decodedAddress = decodeNemBase32(normalizedAddress);
  if (!decodedAddress || decodedAddress[0] !== NEM_TESTNET_VERSION || !hasValidNemTestnetChecksum(decodedAddress)) {
    throw new TypeError('address must be a valid NEM testnet address');
  }

  return normalizedAddress;
}
