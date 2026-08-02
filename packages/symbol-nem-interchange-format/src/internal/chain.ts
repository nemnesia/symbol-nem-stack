import { Hash256, PrivateKey, PublicKey, Signature } from '@nemnesia/symbol-sdk';
import { NemFacade, Network as NemSdkNetwork, Verifier as NemVerifier } from '@nemnesia/symbol-sdk/nem';
import { SymbolFacade, Network as SymbolSdkNetwork, Verifier as SymbolVerifier } from '@nemnesia/symbol-sdk/symbol';
import { validateMnemonic as validateBip39Mnemonic } from '@scure/bip39';
import { wordlist as czech } from '@scure/bip39/wordlists/czech.js';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { wordlist as french } from '@scure/bip39/wordlists/french.js';
import { wordlist as italian } from '@scure/bip39/wordlists/italian.js';
import { wordlist as japanese } from '@scure/bip39/wordlists/japanese.js';
import { wordlist as korean } from '@scure/bip39/wordlists/korean.js';
import { wordlist as portuguese } from '@scure/bip39/wordlists/portuguese.js';
import { wordlist as chineseSimplified } from '@scure/bip39/wordlists/simplified-chinese.js';
import { wordlist as spanish } from '@scure/bip39/wordlists/spanish.js';
import { wordlist as chineseTraditional } from '@scure/bip39/wordlists/traditional-chinese.js';

import { SnifError } from '../errors.js';
import type { SnifDocument } from '../types.js';
import { equalBytes } from './bytes.js';
import { isRecord } from './validation.js';

const wordlists: Record<string, string[]> = {
  english,
  japanese,
  korean,
  spanish,
  'chinese-simplified': chineseSimplified,
  'chinese-traditional': chineseTraditional,
  french,
  italian,
  czech,
  portuguese,
};

export const facadeFor = (document: SnifDocument): SymbolFacade | NemFacade => {
  if ('symbol' === document.chain) {
    const network = document.network as { id: number; generationHashSeed: Uint8Array };
    return new SymbolFacade(
      new SymbolSdkNetwork('snif', network.id, new Date(0), new Hash256(network.generationHashSeed))
    );
  }
  return new NemFacade(new NemSdkNetwork('snif', document.network.id, new Date(0)));
};

export const verifyRawSignature = (
  document: SnifDocument,
  publicKey: Uint8Array,
  data: Uint8Array,
  signature: Uint8Array
): boolean => {
  try {
    const verifier =
      'symbol' === document.chain
        ? new SymbolVerifier(new PublicKey(publicKey))
        : new NemVerifier(new PublicKey(publicKey));
    return verifier.verify(data, new Signature(signature));
  } catch {
    return false;
  }
};

const isValidAddress = (document: SnifDocument, bytes: Uint8Array): boolean => {
  const facade = facadeFor(document);
  const AddressClass = 'symbol' === document.chain ? SymbolFacade.Address : NemFacade.Address;
  try {
    return facade.network.isValidAddress(new AddressClass(bytes) as never);
  } catch {
    return false;
  }
};

const derivedAddress = (document: SnifDocument, publicKey: Uint8Array): Uint8Array => {
  const account = facadeFor(document).createPublicAccount(new PublicKey(publicKey));
  return account.address.bytes;
};

const validateReference = (document: SnifDocument, value: unknown): void => {
  if (!isRecord(value)) return;
  const address = value.address;
  if (address instanceof Uint8Array && !isValidAddress(document, address)) throw new SnifError('network-mismatch');
  if (address instanceof Uint8Array && value.publicKey instanceof Uint8Array) {
    if (!equalBytes(address, derivedAddress(document, value.publicKey))) throw new SnifError('verification-failed');
  }
};

export const validateChainSemantics = (document: SnifDocument): void => {
  const payload = document.payload;
  if (payload.address instanceof Uint8Array && !isValidAddress(document, payload.address))
    throw new SnifError('network-mismatch');
  if (payload.address instanceof Uint8Array && payload.publicKey instanceof Uint8Array) {
    if (!equalBytes(payload.address, derivedAddress(document, payload.publicKey)))
      throw new SnifError('verification-failed');
  }
  if ('account' === document.type) {
    const facade = facadeFor(document);
    const account = facade.createAccount(new PrivateKey(payload.privateKey as Uint8Array));
    if (
      !equalBytes(account.publicKey.bytes, payload.publicKey as Uint8Array) ||
      !equalBytes(account.address.bytes, payload.address as Uint8Array)
    )
      throw new SnifError('verification-failed');
  }
  if ('mnemonic' === document.type) {
    const list = wordlists[payload.language as string];
    if (!list || !validateBip39Mnemonic(payload.mnemonic as string, list)) throw new SnifError('invalid-payload');
  }
  if ('connection-response' === document.type && true === payload.approved)
    validateReference(document, payload.account);
};
