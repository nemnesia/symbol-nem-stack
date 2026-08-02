import { describe, expect, it } from 'vitest';

import { PrivateKey, PublicKey } from '../../src/CryptoTypes.js';
import { utils } from '../../src/index.js';
import { KeyPair } from '../../src/nem/KeyPair.js';
import MessageEncoder from '../../src/nem/MessageEncoder.js';
import { models } from '../../src/nem/index.js';
import { Message, MessageType } from '../../src/nem/models.js';

// テスト用の固定キーペア
const TEST_PRIVATE_KEY_1 = new PrivateKey('abf4cf663c81e461db1fef2d145e6993b62e8b67801edea143335aec4cbec6cd');
const TEST_PRIVATE_KEY_2 = new PrivateKey('71bc0db348a25d163290c44ef863b031fd5251d4e3674dce37d78fe8c5dbbbb6');

describe('MessageEncoder', () => {
  const createEncoder = () => {
    const keyPair = new KeyPair(TEST_PRIVATE_KEY_1);
    return new MessageEncoder(keyPair);
  };

  it('キーペアから公開鍵を取得できる', () => {
    const encoder = createEncoder();
    const keyPair = new KeyPair(TEST_PRIVATE_KEY_1);
    expect(encoder.publicKey).toEqual(keyPair.publicKey);
  });

  it('メッセージをエンコード/デコードできる', async () => {
    const encoder = createEncoder();
    const recipientKeyPair = new KeyPair(TEST_PRIVATE_KEY_2);
    const message = new Uint8Array([1, 2, 3, 4, 5]);

    const encoded = await encoder.encode(recipientKeyPair.publicKey, message);
    expect(encoded.messageType).toBe(MessageType.ENCRYPTED);
    expect(encoded.message).toBeInstanceOf(Uint8Array);

    // デコード側で受信者の秘密鍵を使用
    const recipientEncoder = new MessageEncoder(recipientKeyPair);
    const result = await recipientEncoder.tryDecode(encoder.publicKey, encoded);
    expect(result.isDecoded).toBe(true);
    expect(result.message).toEqual(message);
  });

  it('無効なmessageTypeの場合はエラーをスローする', async () => {
    const encoder = createEncoder();
    const recipientKeyPair = new KeyPair(TEST_PRIVATE_KEY_2);
    const message = new Message();
    message.messageType = MessageType.PLAIN;
    message.message = new Uint8Array([1, 2, 3]);

    await expect(encoder.tryDecode(recipientKeyPair.publicKey, message)).rejects.toThrow('invalid message format');
  });

  it('破損した暗号文では復号エラーを投げる', async () => {
    const encoder = createEncoder();
    const recipientKeyPair = new KeyPair(TEST_PRIVATE_KEY_2);
    const message = new Uint8Array([11, 22, 33, 44]);

    const encoded = await encoder.encode(recipientKeyPair.publicKey, message);
    encoded.message[encoded.message.length - 1] ^= 0xff;

    const recipientEncoder = new MessageEncoder(recipientKeyPair);
    await expect(recipientEncoder.tryDecode(encoder.publicKey, encoded)).rejects.toThrow();
  });

  it('deprecated形式でエンコードできる', async () => {
    const encoder = createEncoder();
    const recipientKeyPair = new KeyPair(TEST_PRIVATE_KEY_2);
    const message = new Uint8Array([99, 88, 77, 66]);

    const encoded = await encoder.encodeDeprecated(recipientKeyPair.publicKey, message);

    expect(encoded.messageType).toBe(MessageType.ENCRYPTED);
    expect(encoded.message.length).toBeGreaterThan(message.length);
  });

  it('短すぎる暗号文では復号エラーを投げる', async () => {
    const encoder = createEncoder();
    const recipientKeyPair = new KeyPair(TEST_PRIVATE_KEY_2);
    const message = new Message();
    message.messageType = MessageType.ENCRYPTED;
    message.message = new Uint8Array([1, 2, 3]);

    await expect(encoder.tryDecode(recipientKeyPair.publicKey, message)).rejects.toThrow();
  });

  describe('SDK互換性', () => {
    it('暗号化メッセージをでコードできる', async () => {
      const privateKey = new PrivateKey('2222222222222222222222222222222222222222222222222222222222222222');
      const keyPair = new KeyPair(privateKey);
      const encoder = new MessageEncoder(keyPair);
      const decodedMessage = await encoder.tryDecode(
        new PublicKey('E59EF184A612D4C3C4D89B5950EB57262C69862B2F96E59C5043BF41765C482F'),
        models.Message.deserialize(
          utils.hexToUint8(
            '020000002A000000BAE0F10CAB0D723A32C9551BB84A2C2A24F92BD69312F80B7B4AEACE40A33B85EE0C0D32E4904A10BE00'
          )
        )
      );
      const message = new TextDecoder().decode(decodedMessage.message as Uint8Array);

      expect(message).toEqual('Hello, Symbol!');
    });
  });
});
