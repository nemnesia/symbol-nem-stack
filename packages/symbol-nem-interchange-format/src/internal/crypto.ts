import { gcm } from '@noble/ciphers/aes.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';

import { SnifError } from '../errors.js';
import type { Password } from '../types.js';
import { assertNotAborted, utf8Length } from './bytes.js';

interface PendingKdf {
  password: Uint8Array;
  salt: Uint8Array;
  signal?: AbortSignal;
  resolve: (key: Uint8Array) => void;
  reject: (error: unknown) => void;
}

let active = false;
let queued: PendingKdf | undefined;
let browserWorker: Worker | undefined;

const passwordBytes = (password: Password): Uint8Array => {
  const bytes = 'string' === typeof password ? new TextEncoder().encode(password) : new Uint8Array(password);
  if (bytes.byteLength < 1 || bytes.byteLength > 1024 || ('string' === typeof password && utf8Length(password) > 1024))
    throw new SnifError('invalid-payload');
  return bytes;
};

const deriveInBrowserWorker = (pending: PendingKdf): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    browserWorker ??= new Worker(new URL('./argon2-worker.js', import.meta.url), { type: 'module' });
    const worker = browserWorker;
    const cleanup = (): void => {
      worker.onmessage = null;
      worker.onerror = null;
      pending.signal?.removeEventListener('abort', abort);
    };
    const abort = (): void => {
      cleanup();
      worker.terminate();
      browserWorker = undefined;
      reject(new SnifError('operation-cancelled'));
    };
    worker.onerror = () => {
      cleanup();
      worker.terminate();
      browserWorker = undefined;
      reject(new SnifError('resource-limit'));
    };
    worker.onmessage = ({ data }: MessageEvent<{ key?: Uint8Array; error?: string }>) => {
      cleanup();
      if (data.error || !(data.key instanceof Uint8Array)) reject(new SnifError('resource-limit'));
      else resolve(data.key);
    };
    pending.signal?.addEventListener('abort', abort, { once: true });
    worker.postMessage({ password: new Uint8Array(pending.password), salt: new Uint8Array(pending.salt) }, []);
  });

const deriveInCurrentRealm = (pending: PendingKdf): Promise<Uint8Array> =>
  argon2idAsync(pending.password, pending.salt, {
    t: 3,
    m: 65_536,
    p: 4,
    dkLen: 32,
    version: 0x13,
    asyncTick: 10,
    onProgress: () => assertNotAborted(pending.signal),
  });

const run = async (pending: PendingKdf): Promise<void> => {
  active = true;
  try {
    assertNotAborted(pending.signal);
    const key =
      'undefined' !== typeof Worker && 'undefined' !== typeof document
        ? await deriveInBrowserWorker(pending)
        : await deriveInCurrentRealm(pending);
    assertNotAborted(pending.signal);
    pending.resolve(key);
  } catch (error) {
    pending.reject(
      error instanceof SnifError ? error : new SnifError('resource-limit', 'resource-limit', { cause: error })
    );
  } finally {
    pending.password.fill(0);
    active = false;
    const next = queued;
    queued = undefined;
    if (next) void run(next);
  }
};

export const deriveKey = (password: Password, salt: Uint8Array, signal?: AbortSignal): Promise<Uint8Array> => {
  assertNotAborted(signal);
  const bytes = passwordBytes(password);
  return new Promise((resolve, reject) => {
    const pending = { password: bytes, salt: new Uint8Array(salt), signal, resolve, reject };
    if (!active) void run(pending);
    else if (!queued) queued = pending;
    else {
      bytes.fill(0);
      reject(new SnifError('resource-limit'));
    }
  });
};

export const encrypt = async (
  plaintext: Uint8Array,
  password: Password,
  salt: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  signal?: AbortSignal
): Promise<Uint8Array> => {
  const key = await deriveKey(password, salt, signal);
  try {
    return gcm(key, nonce, aad).encrypt(plaintext);
  } finally {
    key.fill(0);
  }
};

export const decrypt = async (
  ciphertext: Uint8Array,
  password: Password,
  salt: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  signal?: AbortSignal
): Promise<Uint8Array> => {
  const key = await deriveKey(password, salt, signal);
  try {
    return gcm(key, nonce, aad).decrypt(ciphertext);
  } catch (error) {
    if (error instanceof SnifError) throw error;
    throw new SnifError('decryption-failed');
  } finally {
    key.fill(0);
  }
};

export const secureRandom = (length: number): Uint8Array => {
  try {
    const output = new Uint8Array(length);
    globalThis.crypto.getRandomValues(output);
    return output;
  } catch (error) {
    throw new SnifError('entropy-unavailable', 'entropy-unavailable', { cause: error });
  }
};
