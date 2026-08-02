import { Unzlib, zlibSync } from 'fflate';

import { SnifError } from '../errors.js';
import type { DecodeOptions, EncodeOptions, EncryptionHeader, SnifDocument, SnifHeader } from '../types.js';
import { MAX_SNIF_SIZE, assertNotAborted, requireBytes } from './bytes.js';
import { decodeCanonical, encodeCanonical } from './cbor.js';
import { validateChainSemantics } from './chain.js';
import { decrypt, encrypt, secureRandom } from './crypto.js';
import { isFormatType, isRecord, validateDocument, validateNetwork, validatePayload } from './validation.js';

interface Envelope extends SnifHeader {
  payload: Uint8Array;
}

const envelopeKeys = ['protocol', 'version', 'type', 'chain', 'network', 'compression', 'encryption', 'payload'];

const validateEnvelope = (value: unknown): Envelope => {
  if (!isRecord(value)) throw new SnifError('invalid-envelope');
  if (
    envelopeKeys.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !envelopeKeys.includes(key))
  )
    throw new SnifError('invalid-envelope');
  if ('snif' !== value.protocol) throw new SnifError('invalid-envelope');
  if (1 !== value.version) throw new SnifError('unsupported-version');
  if (!isFormatType(value.type)) throw new SnifError('unsupported-type');
  const { chain, network } = validateNetwork(value.chain, value.network);
  if ('none' !== value.compression && 'zlib' !== value.compression) throw new SnifError('unsupported-codec');
  if (!isRecord(value.encryption)) throw new SnifError('invalid-envelope');
  let encryption: EncryptionHeader;
  if ('none' === value.encryption.algorithm) {
    if (1 !== Object.keys(value.encryption).length) throw new SnifError('invalid-envelope');
    encryption = { algorithm: 'none' };
  } else if ('password-v1' === value.encryption.algorithm) {
    if (
      3 !== Object.keys(value.encryption).length ||
      !Object.hasOwn(value.encryption, 'salt') ||
      !Object.hasOwn(value.encryption, 'nonce')
    )
      throw new SnifError('invalid-envelope');
    encryption = {
      algorithm: 'password-v1',
      salt: requireBytes(value.encryption.salt, 16, 16, 'invalid-envelope'),
      nonce: requireBytes(value.encryption.nonce, 12, 12, 'invalid-envelope'),
    };
  } else throw new SnifError('unsupported-codec');
  return {
    protocol: 'snif',
    version: 1,
    type: value.type,
    chain,
    network,
    compression: value.compression,
    encryption,
    payload: requireBytes(value.payload, 1, MAX_SNIF_SIZE, 'invalid-envelope'),
  };
};

const headerOf = (envelope: Envelope): SnifHeader => ({
  protocol: envelope.protocol,
  version: envelope.version,
  type: envelope.type,
  chain: envelope.chain,
  network: envelope.network,
  compression: envelope.compression,
  encryption: envelope.encryption,
});

const decompress = (payload: Uint8Array): Uint8Array => {
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    const stream = new Unzlib((chunk) => {
      length += chunk.byteLength;
      if (length > MAX_SNIF_SIZE) throw new SnifError('resource-limit');
      chunks.push(chunk);
    });
    for (let offset = 0; offset < payload.byteLength; offset += 1024)
      stream.push(
        payload.subarray(offset, Math.min(offset + 1024, payload.byteLength)),
        offset + 1024 >= payload.byteLength
      );
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (payload.byteLength < 6 || readAdler32(payload) !== adler32(result)) throw new SnifError('invalid-payload');
    return result;
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError('invalid-payload');
  }
};

const readAdler32 = (payload: Uint8Array): number => {
  const offset = payload.byteLength - 4;
  return (
    ((payload[offset]! << 24) | (payload[offset + 1]! << 16) | (payload[offset + 2]! << 8) | payload[offset + 3]!) >>> 0
  );
};

const adler32 = (data: Uint8Array): number => {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  return ((b << 16) | a) >>> 0;
};

export const inspect = (data: Uint8Array): SnifHeader =>
  headerOf(validateEnvelope(decodeCanonical(data, 'invalid-envelope')));

export const encodeDocument = async (input: SnifDocument, options: EncodeOptions = {}): Promise<Uint8Array> => {
  assertNotAborted(options.signal);
  const document = validateDocument(input);
  validateChainSemantics(document);
  let payload: Uint8Array<ArrayBufferLike> = encodeCanonical(document.payload, 'invalid-payload');
  const secret = 'account' === document.type || 'mnemonic' === document.type;
  if (secret && !options.password) throw new SnifError('password-required');
  if (secret && 'zlib' === options.compression) throw new SnifError('invalid-envelope');
  const requestedCompression = options.compression ?? 'auto';
  let compression: 'none' | 'zlib' = 'none';
  if (!secret && 'none' !== requestedCompression) {
    const compressed = zlibSync(payload);
    if ('zlib' === requestedCompression || compressed.byteLength < payload.byteLength) {
      payload = compressed;
      compression = 'zlib';
    }
  }
  let encryption: EncryptionHeader = { algorithm: 'none' };
  if (options.password) encryption = { algorithm: 'password-v1', salt: secureRandom(16), nonce: secureRandom(12) };
  if (secret && 'password-v1' !== encryption.algorithm) throw new SnifError('password-required');
  const header: SnifHeader = {
    protocol: 'snif',
    version: 1,
    type: document.type,
    chain: document.chain,
    network: document.network,
    compression,
    encryption,
  };
  if ('password-v1' === encryption.algorithm) {
    const aad = encodeCanonical(header, 'invalid-envelope');
    payload = await encrypt(payload, options.password!, encryption.salt, encryption.nonce, aad, options.signal);
  }
  assertNotAborted(options.signal);
  return encodeCanonical({ ...header, payload }, 'invalid-envelope');
};

export const decodeDocument = async (data: Uint8Array, options: DecodeOptions = {}): Promise<SnifDocument> => {
  assertNotAborted(options.signal);
  const envelope = validateEnvelope(decodeCanonical(new Uint8Array(data), 'invalid-envelope'));
  let payload: Uint8Array<ArrayBufferLike> = new Uint8Array(envelope.payload);
  if ('password-v1' === envelope.encryption.algorithm) {
    if (!options.password) throw new SnifError('password-required');
    const aad = encodeCanonical(headerOf(envelope), 'invalid-envelope');
    payload = await decrypt(
      payload,
      options.password,
      envelope.encryption.salt,
      envelope.encryption.nonce,
      aad,
      options.signal
    );
  }
  if ('zlib' === envelope.compression) payload = decompress(payload);
  const decodedPayload = decodeCanonical(payload, 'invalid-payload');
  const validated = validatePayload(envelope.type, envelope.chain, decodedPayload);
  if (('account' === envelope.type || 'mnemonic' === envelope.type) && 'password-v1' !== envelope.encryption.algorithm)
    throw new SnifError('invalid-envelope');
  const document = { type: envelope.type, chain: envelope.chain, network: envelope.network, payload: validated };
  validateChainSemantics(document);
  return document;
};
