import { zlibSync } from 'fflate';
import { Inflate } from 'pako';

import { SnifError } from '../errors.js';
import type { DecodeOptions, EncodeOptions, EncryptionHeader, SnifDocument, SnifHeader } from '../types.js';
import { MAX_SNIF_SIZE, assertNotAborted, requireBytes } from './bytes.js';
import { decodeCanonical, encodeCanonical } from './cbor.js';
import { decrypt, encrypt, secureRandom } from './crypto.js';
import { isFormatType, isRecord, validateDocument, validateNetwork, validatePayload } from './validation.js';

type Envelope = SnifHeader & { payload: Uint8Array };

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
  } as Envelope;
};

const headerOf = (envelope: Envelope): SnifHeader =>
  ({
    protocol: envelope.protocol,
    version: envelope.version,
    type: envelope.type,
    chain: envelope.chain,
    network: envelope.network,
    compression: envelope.compression,
    encryption: envelope.encryption,
  }) as SnifHeader;

export const decompress = (payload: Uint8Array): Uint8Array => {
  try {
    const result = new Uint8Array(MAX_SNIF_SIZE);
    let length = 0;
    const stream = new Inflate({ windowBits: 15, chunkSize: 64 * 1024 });
    stream.onData = (data) => {
      const chunk = new Uint8Array(data);
      length += chunk.byteLength;
      if (length > MAX_SNIF_SIZE) throw new SnifError('resource-limit');
      result.set(chunk, length - chunk.byteLength);
    };
    const succeeded = stream.push(payload, true);
    const state = stream as Inflate & {
      ended: boolean;
      strm: { avail_in: number; total_in: number; total_out: number };
    };
    if (
      !succeeded ||
      stream.err ||
      !state.ended ||
      0 !== state.strm.avail_in ||
      payload.byteLength !== state.strm.total_in ||
      length !== state.strm.total_out
    )
      throw new SnifError('invalid-payload');
    return result.subarray(0, length);
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError('invalid-payload');
  }
};

export const inspect = (data: Uint8Array): SnifHeader =>
  headerOf(validateEnvelope(decodeCanonical(data, 'invalid-envelope')));

export const encodeDocument = async (input: SnifDocument, options: EncodeOptions = {}): Promise<Uint8Array> => {
  assertNotAborted(options.signal);
  const document = validateDocument(input);
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
  const header = {
    protocol: 'snif',
    version: 1,
    type: document.type,
    chain: document.chain,
    network: document.network,
    compression,
    encryption,
  } as SnifHeader;
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
  const secret = 'account' === envelope.type || 'mnemonic' === envelope.type;
  if (secret && 'none' !== envelope.compression) throw new SnifError('invalid-envelope');
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
  if (secret && 'password-v1' !== envelope.encryption.algorithm) throw new SnifError('invalid-envelope');
  const document = { type: envelope.type, chain: envelope.chain, network: envelope.network, payload: validated };
  return document;
};
