import { argon2idAsync } from '@noble/hashes/argon2.js';

interface KdfWorkerRequest {
  password: Uint8Array;
  salt: Uint8Array;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<KdfWorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = async ({ data }) => {
  try {
    const key = await argon2idAsync(data.password, data.salt, {
      t: 3,
      m: 65_536,
      p: 4,
      dkLen: 32,
      version: 0x13,
      asyncTick: 10,
    });
    data.password.fill(0);
    scope.postMessage({ key }, [key.buffer]);
  } catch {
    data.password.fill(0);
    scope.postMessage({ error: 'resource-limit' });
  }
};
