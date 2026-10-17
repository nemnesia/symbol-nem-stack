import { PrivateKey } from 'symbol-sdk';
import { KeyPair, MessageEncoder, Network } from 'symbol-sdk/symbol';
import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

import { HARVESTER_RECORD_SIZE, decryptHarvesters, encryptHarvesters } from '../src/index.js';

// Shoestringが公開しているテスト専用鍵です。実運用の秘密情報ではありません。
const fixturePrivateKey = '9DD63D277F1DC004FDB849CDD0262AB9FE7BFAF70AB13709DA3D5B1DB01710B2';
const fixture = new Uint8Array(readFileSync(new URL('./fixtures/shoestring-harvesters.dat', import.meta.url)));
const node = new KeyPair(new PrivateKey(new Uint8Array(32).fill(1)));
const entry = {
  signingPrivateKey: new Uint8Array(32).fill(2),
  vrfPrivateKey: new Uint8Array(32).fill(3),
};

describe('harvesters.datの暗号化と復号', () => {
  it('公式Shoestringのデータを復号し、公開テストの4件のTestnetアドレスと一致する', async () => {
    const entries = await decryptHarvesters(fixture, fixturePrivateKey);
    expect(fixture.length).toBe(4 * HARVESTER_RECORD_SIZE);
    expect(
      entries.map((item) =>
        Network.TESTNET.publicKeyToAddress(new KeyPair(new PrivateKey(item.signingPrivateKey)).publicKey).toString()
      )
    ).toEqual([
      'TBDSKUDXUIOYNVQEORWRO2P4TAQMEX5Q36XZD2Q',
      'TB5Y7SWKDDQWRKIFXLLXF4KCMN7KCCZMBI32WXI',
      'TDBNBF5MXGLQIP3AFO4F2BOCMJJHWE5MOZAJOWA',
      'TDT6756NRFDIFJSNWMLOQDAGIXW5EI5AZ3BX47Y',
    ]);
  });

  it('複数レコードの署名用秘密鍵とVRF秘密鍵を順番どおり復元する', async () => {
    const entries = [entry, { signingPrivateKey: entry.vrfPrivateKey, vrfPrivateKey: entry.signingPrivateKey }];
    const encrypted = await encryptHarvesters(entries, node.publicKey.bytes);
    expect(encrypted.length).toBe(2 * HARVESTER_RECORD_SIZE);
    expect(await decryptHarvesters(encrypted, node.privateKey.bytes)).toEqual(entries);
    expect(entry.signingPrivateKey).toEqual(new Uint8Array(32).fill(2));
    expect(entry.vrfPrivateKey).toEqual(new Uint8Array(32).fill(3));
  });

  it('通常版SDKの委任メッセージから8バイトのマーカーを除いたデータを復号する', async () => {
    const encoder = new MessageEncoder(node);
    const encoded = await encoder.encodePersistentHarvestingDelegation(
      node.publicKey,
      new KeyPair(new PrivateKey(entry.signingPrivateKey)),
      new KeyPair(new PrivateKey(entry.vrfPrivateKey))
    );
    expect(await decryptHarvesters(encoded.subarray(8), node.privateKey.bytes)).toEqual([entry]);
  });

  it('生成データに委任マーカーを付けると通常版SDKで復号できる', async () => {
    const encrypted = await encryptHarvesters([entry], node.publicKey.bytes);
    const message = new Uint8Array(8 + encrypted.length);
    message.set([0xfe, 0x2a, 0x80, 0x61, 0x57, 0x73, 0x01, 0xe2]);
    message.set(encrypted, 8);
    const decoded = await new MessageEncoder(node).tryDecode(node.publicKey, message);
    expect(decoded.isDecoded).toBe(true);
    expect(decoded.message).toEqual(new Uint8Array([...entry.signingPrivateKey, ...entry.vrfPrivateKey]));
  });

  it('公式データを別ノードの鍵へ再暗号化しても両方の秘密鍵を維持する', async () => {
    const entries = await decryptHarvesters(fixture, fixturePrivateKey);
    const encrypted = await encryptHarvesters(entries, node.publicKey.toString());
    expect(await decryptHarvesters(encrypted, node.privateKey.toString().toLowerCase())).toEqual(entries);
    await expect(decryptHarvesters(encrypted, fixturePrivateKey)).rejects.toThrow('Unable to decrypt');
  });

  it('同じ鍵と内容でもレコードごとに新しい一時公開鍵とIVを生成する', async () => {
    const encrypted = await encryptHarvesters([entry, entry], node.publicKey.bytes);
    expect(encrypted.slice(0, 32)).not.toEqual(encrypted.slice(124, 156));
    expect(encrypted.slice(48, 60)).not.toEqual(encrypted.slice(172, 184));
  });

  it('空ファイルと空配列を相互に変換する', async () => {
    expect(await encryptHarvesters([], node.publicKey.bytes)).toEqual(new Uint8Array());
    expect(await decryptHarvesters(new Uint8Array(), node.privateKey.bytes)).toEqual([]);
  });

  it('Bufferのオフセット付きビューを扱い、入力を変更しない', async () => {
    const encrypted = await encryptHarvesters([entry], node.publicKey.bytes);
    const buffer = Buffer.concat([Buffer.alloc(7), Buffer.from(encrypted), Buffer.alloc(9)]);
    const before = Buffer.from(buffer);
    expect(await decryptHarvesters(buffer.subarray(7, 131), node.privateKey.bytes)).toEqual([entry]);
    expect(buffer).toEqual(before);
  });

  it('異なるノードの秘密鍵では復号できない', async () => {
    await expect(decryptHarvesters(fixture, node.privateKey.bytes)).rejects.toThrow('Unable to decrypt');
  });

  it.each([1, 123, 125, 495])('不完全なレコードを含む%dバイトのデータを拒否する', async (size) => {
    await expect(decryptHarvesters(new Uint8Array(size), node.privateKey.bytes)).rejects.toThrow('124-byte');
  });

  it.each([0, 32, 48, 60, 123, 156, 247])('位置%dの改ざんを検出し、途中の復号結果も返さない', async (offset) => {
    const encrypted = await encryptHarvesters([entry, entry], node.publicKey.bytes);
    encrypted[offset] ^= 1;
    await expect(decryptHarvesters(encrypted, node.privateKey.bytes)).rejects.toThrow('Unable to decrypt');
  });

  it.each(['', 'ab', 'g'.repeat(64), '01'.repeat(33), new Uint8Array(31)])(
    '不正な鍵入力を値を表示せず拒否する（%#）',
    async (key) => {
      await expect(encryptHarvesters([entry], key)).rejects.toThrow('nodePublicKey must be');
      await expect(decryptHarvesters(fixture, key)).rejects.toThrow('nodePrivateKey must be');
      await expect(encryptHarvesters([{ ...entry, signingPrivateKey: key }], node.publicKey.bytes)).rejects.toThrow(
        'signingPrivateKey must be'
      );
      await expect(encryptHarvesters([{ ...entry, vrfPrivateKey: key }], node.publicKey.bytes)).rejects.toThrow(
        'vrfPrivateKey must be'
      );
    }
  );

  it('不正な公開鍵の点を拒否する', async () => {
    await expect(encryptHarvesters([entry], new Uint8Array(32).fill(0xff))).rejects.toThrow();
  });
});
