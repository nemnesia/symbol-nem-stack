import { PrivateKey, PublicKey } from 'symbol-sdk';
import { KeyPair, SymbolFacade } from 'symbol-sdk/symbol';

/** 32バイトの鍵。バイト配列または64文字の16進文字列で指定します。 */
export type KeyInput = Uint8Array | string;

/** 委任ハーベスター1件分の平文の秘密鍵です。 */
export interface HarvesterKeys {
  signingPrivateKey: KeyInput;
  vrfPrivateKey: KeyInput;
}

/** 復号した秘密鍵。各バイト配列は独立しており、呼び出し側が管理します。 */
export interface DecryptedHarvesterKeys {
  signingPrivateKey: Uint8Array;
  vrfPrivateKey: Uint8Array;
}

export const HARVESTER_RECORD_SIZE = 124;

function keyBytes(value: KeyInput, name: string): Uint8Array<ArrayBuffer> {
  if (typeof value === 'string') {
    if (!/^[0-9a-fA-F]{64}$/.test(value)) {
      throw new TypeError(`${name} must be 32 bytes or 64 hexadecimal characters`);
    }
    return Uint8Array.from(value.match(/../g)!, (byte) => Number.parseInt(byte, 16));
  }
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new TypeError(`${name} must be 32 bytes or 64 hexadecimal characters`);
  }
  return new Uint8Array(value);
}

async function aesKey(keyPair: KeyPair, publicKey: PublicKey, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const sharedKey = SymbolFacade.deriveSharedKey(keyPair, publicKey).bytes;
  try {
    return await globalThis.crypto.subtle.importKey('raw', new Uint8Array(sharedKey), 'AES-GCM', false, [usage]);
  } finally {
    sharedKey.fill(0);
  }
}

/** 各レコードに新しい一時鍵とIVを生成して暗号化します。ファイルの入出力は行いません。 */
export async function encryptHarvesters(
  harvesters: readonly HarvesterKeys[],
  nodePublicKey: KeyInput
): Promise<Uint8Array> {
  if (!Array.isArray(harvesters)) throw new TypeError('harvesters must be an array');
  const recipient = new PublicKey(keyBytes(nodePublicKey, 'nodePublicKey'));
  const output = new Uint8Array(harvesters.length * HARVESTER_RECORD_SIZE);

  for (let index = 0; index < harvesters.length; ++index) {
    const payload = new Uint8Array(64);
    try {
      const entry = harvesters[index];
      if (!entry || typeof entry !== 'object')
        throw new TypeError('harvester must contain signing and VRF private keys');
      const signingKey = keyBytes(entry.signingPrivateKey, 'signingPrivateKey');
      payload.set(signingKey);
      signingKey.fill(0);
      const vrfKey = keyBytes(entry.vrfPrivateKey, 'vrfPrivateKey');
      payload.set(vrfKey, 32);
      vrfKey.fill(0);

      const ephemeral = new KeyPair(PrivateKey.random());
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const key = await aesKey(ephemeral, recipient, 'encrypt');
      const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
      const offset = index * HARVESTER_RECORD_SIZE;
      output.set(ephemeral.publicKey.bytes, offset);
      output.set(encrypted.subarray(64), offset + 32); // 保存形式では認証タグ、IV、暗号文の順に配置します。
      output.set(iv, offset + 48);
      output.set(encrypted.subarray(0, 64), offset + 60);
    } finally {
      payload.fill(0);
    }
  }
  return output;
}

/** 不正なレコードや認証失敗を拒否します。途中まで復号した結果は返しません。 */
export async function decryptHarvesters(data: Uint8Array, nodePrivateKey: KeyInput): Promise<DecryptedHarvesterKeys[]> {
  if (!(data instanceof Uint8Array) || data.length % HARVESTER_RECORD_SIZE !== 0) {
    throw new TypeError('harvesters data must contain complete 124-byte records');
  }
  // 認証中の入力変更を防ぐため、最初のawaitより前にデータを複製します。
  const input = new Uint8Array(data);
  const privateBytes = keyBytes(nodePrivateKey, 'nodePrivateKey');
  const node = new KeyPair(new PrivateKey(privateBytes));
  privateBytes.fill(0);
  const harvesters: DecryptedHarvesterKeys[] = [];
  try {
    for (let offset = 0; offset < input.length; offset += HARVESTER_RECORD_SIZE) {
      const record = input.subarray(offset, offset + HARVESTER_RECORD_SIZE);
      const ephemeral = new PublicKey(record.subarray(0, 32));
      const key = await aesKey(node, ephemeral, 'decrypt');
      const encrypted = new Uint8Array(80);
      encrypted.set(record.subarray(60));
      encrypted.set(record.subarray(32, 48), 64);
      const payload = new Uint8Array(
        await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.subarray(48, 60) }, key, encrypted)
      );
      try {
        harvesters.push({ signingPrivateKey: payload.slice(0, 32), vrfPrivateKey: payload.slice(32) });
      } finally {
        payload.fill(0);
      }
    }
    return harvesters;
  } catch {
    for (const entry of harvesters) {
      entry.signingPrivateKey.fill(0);
      entry.vrfPrivateKey.fill(0);
    }
    // 鍵情報を含む可能性があるSDKの例外は外部へ伝播させません。
    throw new Error('Unable to decrypt harvesters data: invalid record or node key');
  }
}
