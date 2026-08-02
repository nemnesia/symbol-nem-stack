import { SnifError } from '../errors.js';
import type { Chain, FormatType, Network, Payload, SnifDocument } from '../types.js';
import {
  MAX_MESSAGE_SIZE,
  MAX_TRANSACTION_SIZE,
  isAllZero,
  requireBytes,
  requireNotAllZero,
  utf8Length,
} from './bytes.js';

const FORMAT_TYPES: ReadonlySet<string> = new Set([
  'contact',
  'address',
  'account',
  'mnemonic',
  'sign-request',
  'signed-transaction',
  'message-sign-request',
  'signature',
  'connection-request',
  'connection-response',
]);
const PERMISSIONS = new Set(['account', 'sign-transaction', 'sign-message']);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array);

const exactKeys = (value: Record<string, unknown>, required: string[], optional: string[] = []): void => {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(value, key)) || Object.keys(value).some((key) => !allowed.has(key)))
    throw new SnifError('invalid-payload');
};

const text = (value: unknown, minimum: number, maximum: number): string => {
  if (typeof value !== 'string' || utf8Length(value) < minimum || utf8Length(value) > maximum)
    throw new SnifError('invalid-payload');
  return value;
};

const uint = (value: unknown, maximum = 253_402_300_799): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum)
    throw new SnifError('invalid-payload');
  return value as number;
};

const absoluteUri = (value: unknown, maximum = 2048): string => {
  const uri = text(value, 1, maximum);
  try {
    const parsed = new URL(uri);
    if (!parsed.protocol) throw new Error();
  } catch {
    throw new SnifError('invalid-payload');
  }
  return uri;
};

const address = (value: unknown, chain: Chain): Uint8Array => requireBytes(value, 'symbol' === chain ? 24 : 25);

const publicKey = (value: unknown): Uint8Array => {
  const bytes = requireBytes(value, 32);
  requireNotAllZero(bytes);
  return bytes;
};

const requestId = (value: unknown): Uint8Array => {
  const bytes = requireBytes(value, 16);
  requireNotAllZero(bytes);
  return bytes;
};

const context = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new SnifError('invalid-context');
  try {
    exactKeys(value, ['requestId', 'createdAt', 'expiresAt', 'audience']);
    requestId(value.requestId);
    const createdAt = uint(value.createdAt);
    const expiresAt = uint(value.expiresAt);
    if (createdAt >= expiresAt || expiresAt - createdAt > 86_400) throw new SnifError('invalid-context');
    absoluteUri(value.audience, 256);
  } catch (error) {
    if (error instanceof SnifError) throw new SnifError('invalid-context');
    throw error;
  }
  return value;
};

const connectionProof = (value: unknown): void => {
  if (!isRecord(value)) throw new SnifError('invalid-payload');
  exactKeys(value, ['sessionId', 'requesterPublicKey', 'signature']);
  requestId(value.sessionId);
  publicKey(value.requesterPublicKey);
  const signature = requireBytes(value.signature, 64);
  requireNotAllZero(signature);
};

const permissions = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new SnifError('invalid-payload');
  if (value.some((item) => typeof item !== 'string' || !PERMISSIONS.has(item))) throw new SnifError('invalid-payload');
  if (new Set(value).size !== value.length || !value.includes('account')) throw new SnifError('invalid-payload');
  return value as string[];
};

const accountReference = (value: unknown, chain: Chain): void => {
  if (!isRecord(value)) throw new SnifError('invalid-payload');
  exactKeys(value, ['address', 'publicKey']);
  address(value.address, chain);
  publicKey(value.publicKey);
};

const validateCommonRequest = (payload: Record<string, unknown>): void => {
  context(payload.context);
  if (payload.expectedSignerPublicKey !== undefined) publicKey(payload.expectedSignerPublicKey);
  if (payload.connection !== undefined) connectionProof(payload.connection);
};

export const validatePayload = (type: FormatType, chain: Chain, payload: unknown): Payload => {
  if (!isRecord(payload)) throw new SnifError('invalid-payload');
  switch (type) {
    case 'contact':
      exactKeys(payload, ['name', 'address'], ['publicKey']);
      text(payload.name, 1, 128);
      address(payload.address, chain);
      if (payload.publicKey !== undefined) publicKey(payload.publicKey);
      break;
    case 'address':
      exactKeys(payload, ['address']);
      address(payload.address, chain);
      break;
    case 'account':
      exactKeys(payload, ['privateKey', 'publicKey', 'address']);
      requireNotAllZero(requireBytes(payload.privateKey, 32));
      publicKey(payload.publicKey);
      address(payload.address, chain);
      break;
    case 'mnemonic': {
      exactKeys(payload, ['scheme', 'language', 'mnemonic'], ['passphrase']);
      const languages = new Set([
        'english',
        'japanese',
        'korean',
        'spanish',
        'chinese-simplified',
        'chinese-traditional',
        'french',
        'italian',
        'czech',
        'portuguese',
      ]);
      if ('bip39' !== payload.scheme || typeof payload.language !== 'string' || !languages.has(payload.language))
        throw new SnifError('invalid-payload');
      const mnemonic = text(payload.mnemonic, 1, 1024);
      if (mnemonic.normalize('NFKD') !== mnemonic || mnemonic.includes('  ')) throw new SnifError('invalid-payload');
      if (payload.passphrase !== undefined) {
        const passphrase = text(payload.passphrase, 0, 1024);
        if (passphrase.normalize('NFKD') !== passphrase) throw new SnifError('invalid-payload');
      }
      break;
    }
    case 'sign-request':
      exactKeys(payload, ['transactionPayload', 'signingType', 'context'], ['expectedSignerPublicKey', 'connection']);
      requireBytes(payload.transactionPayload, 1, MAX_TRANSACTION_SIZE);
      if ('transaction' !== payload.signingType && 'cosignature' !== payload.signingType)
        throw new SnifError('invalid-payload');
      validateCommonRequest(payload);
      break;
    case 'signed-transaction':
      exactKeys(payload, ['transactionPayload'], ['requestId']);
      requireBytes(payload.transactionPayload, 1, MAX_TRANSACTION_SIZE);
      if (payload.requestId !== undefined) requestId(payload.requestId);
      break;
    case 'message-sign-request':
      exactKeys(payload, ['message', 'purpose', 'context'], ['expectedSignerPublicKey', 'connection']);
      requireBytes(payload.message, 0, MAX_MESSAGE_SIZE);
      text(payload.purpose, 1, 256);
      validateCommonRequest(payload);
      break;
    case 'signature':
      validateSignature(payload, chain);
      break;
    case 'connection-request': {
      exactKeys(payload, ['application', 'permissions', 'challenge', 'context', 'requesterPublicKey', 'signature']);
      if (!isRecord(payload.application)) throw new SnifError('invalid-payload');
      exactKeys(payload.application, ['name', 'origin'], ['iconUrl']);
      text(payload.application.name, 1, 128);
      const origin = absoluteUri(payload.application.origin);
      if (payload.application.iconUrl !== undefined) {
        const icon = absoluteUri(payload.application.iconUrl);
        if (!icon.toLowerCase().startsWith('https:')) throw new SnifError('invalid-payload');
      }
      permissions(payload.permissions);
      requireNotAllZero(requireBytes(payload.challenge, 32));
      const requestContext = context(payload.context);
      if (requestContext.audience !== origin) throw new SnifError('invalid-context');
      publicKey(payload.requesterPublicKey);
      requireNotAllZero(requireBytes(payload.signature, 64));
      break;
    }
    case 'connection-response':
      validateConnectionResponse(payload, chain);
      break;
  }
  return payload;
};

const validateSignature = (payload: Record<string, unknown>, chain: Chain): void => {
  if ('rejected' === payload.signatureType) {
    exactKeys(payload, ['signatureType', 'requestId']);
    requestId(payload.requestId);
    return;
  }
  if ('transaction' === payload.signatureType || 'message' === payload.signatureType) {
    exactKeys(payload, ['signatureType', 'signature', 'signerPublicKey', 'targetHash', 'requestId']);
    requireNotAllZero(requireBytes(payload.signature, 64));
    publicKey(payload.signerPublicKey);
    requireNotAllZero(requireBytes(payload.targetHash, 32));
    requestId(payload.requestId);
    return;
  }
  if ('cosignature' !== payload.signatureType) throw new SnifError('invalid-payload');
  if ('symbol' === chain) {
    exactKeys(payload, ['signatureType', 'parentHash', 'signature', 'signerPublicKey', 'version', 'requestId']);
    requireNotAllZero(requireBytes(payload.parentHash, 32));
    requireNotAllZero(requireBytes(payload.signature, 64));
    publicKey(payload.signerPublicKey);
    if (0 !== payload.version) throw new SnifError('invalid-payload');
  } else {
    exactKeys(payload, ['signatureType', 'transactionPayload', 'requestId']);
    requireBytes(payload.transactionPayload, 1, MAX_TRANSACTION_SIZE);
  }
  requestId(payload.requestId);
};

const validateConnectionResponse = (payload: Record<string, unknown>, chain: Chain): void => {
  if (false === payload.approved) {
    exactKeys(payload, ['approved', 'requestId']);
    requestId(payload.requestId);
    return;
  }
  if (true !== payload.approved) throw new SnifError('invalid-payload');
  exactKeys(payload, [
    'approved',
    'requestId',
    'sessionId',
    'sessionCreatedAt',
    'sessionExpiresAt',
    'account',
    'permissions',
    'signature',
  ]);
  requestId(payload.requestId);
  requestId(payload.sessionId);
  const created = uint(payload.sessionCreatedAt);
  const expires = uint(payload.sessionExpiresAt);
  if (created >= expires || expires - created > 30 * 86_400) throw new SnifError('invalid-payload');
  accountReference(payload.account, chain);
  permissions(payload.permissions);
  requireNotAllZero(requireBytes(payload.signature, 64));
};

export const validateNetwork = (chain: unknown, network: unknown): { chain: Chain; network: Network } => {
  if ('symbol' !== chain && 'nem' !== chain) throw new SnifError('invalid-envelope');
  if (!isRecord(network)) throw new SnifError('invalid-envelope');
  if ('symbol' === chain) {
    exactEnvelopeKeys(network, ['id', 'generationHashSeed']);
    uintEnvelope(network.id, 255);
    const seed = requireBytes(network.generationHashSeed, 32, 32, 'invalid-envelope');
    if (isAllZero(seed)) throw new SnifError('invalid-envelope');
  } else {
    exactEnvelopeKeys(network, ['id']);
    uintEnvelope(network.id, 255);
  }
  return { chain, network: network as unknown as Network };
};

const exactEnvelopeKeys = (value: Record<string, unknown>, keys: string[]): void => {
  if (keys.some((key) => !Object.hasOwn(value, key)) || Object.keys(value).some((key) => !keys.includes(key)))
    throw new SnifError('invalid-envelope');
};
const uintEnvelope = (value: unknown, maximum: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum)
    throw new SnifError('invalid-envelope');
  return value as number;
};

export const validateDocument = (document: unknown): SnifDocument => {
  if (!isRecord(document)) throw new SnifError('invalid-payload');
  exactKeys(document, ['type', 'chain', 'network', 'payload']);
  if (typeof document.type !== 'string' || !FORMAT_TYPES.has(document.type)) throw new SnifError('unsupported-type');
  const { chain, network } = validateNetwork(document.chain, document.network);
  return {
    type: document.type as FormatType,
    chain,
    network,
    payload: validatePayload(document.type as FormatType, chain, document.payload),
  };
};

export const isFormatType = (value: unknown): value is FormatType =>
  typeof value === 'string' && FORMAT_TYPES.has(value);
