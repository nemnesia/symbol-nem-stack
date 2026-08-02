import { describe, expect, it } from 'vitest';

import { Hash256, PrivateKey, PublicKey, Signature } from '../../src/CryptoTypes.js';
import { utils } from '../../src/index.js';
import {
  KeyPair,
  Network,
  SymbolAccount,
  SymbolFacade,
  SymbolPublicAccount,
  SymbolTransactionFactory,
} from '../../src/symbol/index.js';

// テスト用のダミーキー
const TEST_PRIVATE_KEY = new PrivateKey(new Uint8Array(32).fill(1));
const TEST_PUBLIC_KEY = new PublicKey(new Uint8Array(32).fill(2));

// テスト用ネットワーク
const network = Network.TESTNET;
const facade = new SymbolFacade(network);

describe('SymbolFacadeのテスト', () => {
  it('static getterでクラス型を取得できる', () => {
    expect(facade.static).toBe(SymbolFacade);
  });

  it('now()でNetworkTimestampを取得できる', () => {
    const timestamp = facade.now();
    expect(timestamp).toBeDefined();
    expect(typeof timestamp.addSeconds).toBe('function');
  });

  it('公開鍵からSymbolPublicAccountを生成できる', () => {
    const account = facade.createPublicAccount(TEST_PUBLIC_KEY);
    expect(account).toBeInstanceOf(SymbolPublicAccount);
    expect(account.publicKey).toEqual(TEST_PUBLIC_KEY);
    expect(account.address).toBeDefined();
  });

  it('秘密鍵からSymbolAccountを生成できる', () => {
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    expect(account).toBeInstanceOf(SymbolAccount);
    expect(account.keyPair).toBeInstanceOf(KeyPair);
    expect(account.publicKey).toEqual(account.keyPair.publicKey);
    expect(account.address).toBeDefined();
  });

  it('SymbolAccountからmessageEncoderを生成できる', () => {
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    const encoder = account.messageEncoder();
    expect(encoder).toBeDefined();
    expect(encoder.publicKey).toEqual(account.publicKey);
  });

  it('型付きディスクリプタからトランザクションを生成できる', () => {
    // テスト用のダミーdescriptor
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    const descriptor = {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        recipientAddress: account.address,
        mosaics: [],
        message: new Uint8Array(),
      }),
    };
    const tx = facade.createTransactionFromTypedDescriptor(descriptor, TEST_PUBLIC_KEY, 100, 60);
    expect(tx).toBeDefined();
    expect(tx.signerPublicKey).toEqual(TEST_PUBLIC_KEY);
    expect(tx.deadline).toBeDefined();
    expect(tx.fee).toBeDefined();
  });

  it('型付きディスクリプタから埋め込みトランザクションを生成できる', () => {
    const descriptor = {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        recipientAddress: facade.createAccount(TEST_PRIVATE_KEY).address,
        mosaics: [],
        message: new Uint8Array(),
      }),
    };

    const embedded = facade.createEmbeddedTransactionFromTypedDescriptor(descriptor, TEST_PUBLIC_KEY);
    expect(embedded).toBeDefined();
    expect(embedded.signerPublicKey).toEqual(TEST_PUBLIC_KEY);
  });

  it('トランザクションの署名と検証ができる', () => {
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    const descriptor = {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        recipientAddress: account.address,
        mosaics: [],
        message: new Uint8Array(),
      }),
    };
    const tx = facade.createTransactionFromTypedDescriptor(descriptor, account.publicKey, 100, 60);
    const signature = account.signTransaction(tx);
    expect(signature).toBeInstanceOf(Signature);
    const verified = facade.verifyTransaction(tx, signature);
    expect(verified).toBe(true);
  });

  it('トランザクションのハッシュ値を取得できる', () => {
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    const descriptor = {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        recipientAddress: account.address,
        mosaics: [],
        message: new Uint8Array(),
      }),
    };
    const tx = facade.createTransactionFromTypedDescriptor(descriptor, account.publicKey, 100, 60);
    const hash = facade.hashTransaction(tx);
    expect(hash).toBeInstanceOf(Hash256);
  });

  it('cosignTransactionHashはdetached/attachedの両形式を生成できる', () => {
    const keyPair = new KeyPair(TEST_PRIVATE_KEY);
    const transactionHash = Hash256.zero();

    const attached = SymbolFacade.cosignTransactionHash(keyPair, transactionHash, false);
    const detached = SymbolFacade.cosignTransactionHash(keyPair, transactionHash, true);

    expect(attached).toBeDefined();
    expect(detached).toBeDefined();
  });

  it('SymbolAccountのcosignTransactionHashもdetached/attached両形式を生成できる', () => {
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    const transactionHash = Hash256.zero();

    const attached = account.cosignTransactionHash(transactionHash, false);
    const detached = account.cosignTransactionHash(transactionHash, true);

    expect(attached).toBeDefined();
    expect(detached).toBeDefined();
  });

  it('cosignatures指定がcosignatureCountを上回る場合は追加枠を確保しない', () => {
    const localFacade = new SymbolFacade(network);
    const originalCreate = localFacade.transactionFactory.create.bind(localFacade.transactionFactory);
    localFacade.transactionFactory.create = (() => ({ size: 100, fee: undefined })) as any;

    const descriptor = {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        cosignatures: [{}, {}],
      }),
    };

    const tx = localFacade.createTransactionFromTypedDescriptor(descriptor, TEST_PUBLIC_KEY, 100, 60, 1);
    expect(tx.fee.value).toBe(10000n);

    localFacade.transactionFactory.create = originalCreate as any;
  });

  it('aggregate version 2/3で署名ペイロード長が変わる', () => {
    const aggregateTx = SymbolTransactionFactory.deserialize(
      utils.hexToUint8(
        '0801000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
          '00000000000000000000000000000000000000000000D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332' +
          'C97787370000000002684142C08F000000000000D53BD545230000007A1801B2EEB095EAC6703CF90A640E0D5FF7E9A7ED41' +
          '0915EFA9A7954923043160000000000000006000000000000000A09AA5F47A6759802FF955F8DC2D2A14A5C99D23BE97F864' +
          '127FF9383455A4F0000000000168544168AD8BAAB80B1DC684542EC175259711AB2C41D2FEA8D50F0000010000000000EEAF' +
          'F441BA994BE7081BF40500000000'
      )
    );

    const version2Bytes = aggregateTx.serialize();
    const version3Bytes = new Uint8Array(version2Bytes);
    version3Bytes[108] = 3;

    const payloadV2 = facade.extractSigningPayload({ serialize: () => version2Bytes } as any);
    const payloadV3 = facade.extractSigningPayload({ serialize: () => version3Bytes } as any);

    expect(payloadV3.length).toBe(payloadV2.length + 4);
  });

  it('hashEmbeddedTransactionsで埋め込みトランザクション群をハッシュ化できる', () => {
    const account = facade.createAccount(TEST_PRIVATE_KEY);
    const descriptor = {
      toMap: () => ({
        type: 'transfer_transaction_v1',
        recipientAddress: account.address,
        mosaics: [],
        message: new Uint8Array(),
      }),
    };

    const embedded = facade.createEmbeddedTransactionFromTypedDescriptor(descriptor, account.publicKey);
    const hash = SymbolFacade.hashEmbeddedTransactions([embedded]);
    expect(hash).toBeInstanceOf(Hash256);
  });

  it('bip32Pathを生成できる', () => {
    const mainFacade = new SymbolFacade('mainnet');
    const testFacade = new SymbolFacade('testnet');

    expect(mainFacade.bip32Path(5)).toEqual([44, 4343, 5, 0, 0]);
    expect(testFacade.bip32Path(5)).toEqual([44, 1, 5, 0, 0]);
  });

  it('bip32NodeToKeyPairで鍵ペアを生成できる', () => {
    const bip32Node = {
      privateKey: {
        bytes: new Uint8Array(32).fill(3),
      },
    } as any;

    const keyPair = SymbolFacade.bip32NodeToKeyPair(bip32Node);
    expect(keyPair).toBeInstanceOf(KeyPair);
  });

  describe('SDK互換性', () => {
    it('トランザクション署名が一致する', async () => {
      const facade = new SymbolFacade('mainnet');
      const tx = SymbolTransactionFactory.deserialize(
        utils.hexToUint8(
          'BF0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332C977873700000000016854419C4A00000000000067EDC645230000006887C68BB54134420761157A98AC2D4DF03B761D4ADC6ACC0F00010000000000EEAFF441BA994BE720D61300000000000048656C6C6F2C2053796D626F6C21'
        )
      );
      const privateKey = new PrivateKey('1111111111111111111111111111111111111111111111111111111111111111');
      const account = facade.createAccount(privateKey);
      const signature = account.signTransaction(tx);
      SymbolTransactionFactory.attachSignature(tx, signature);

      expect(utils.uint8ToHex(signature.bytes)).toBe(
        'E54CDB87E3D0BC29C0990FDD9CE502E0E2E75A26D3041E84E82711532C410639DF5A04F84C703A4B7B368F49A50C4232DF6CFAC97978674A177D96A1483E7403'
      );
      expect(utils.uint8ToHex(tx.serialize())).toBe(
        'BF00000000000000E54CDB87E3D0BC29C0990FDD9CE502E0E2E75A26D3041E84E82711532C410639DF5A04F84C703A4B7B36' +
          '8F49A50C4232DF6CFAC97978674A177D96A1483E7403D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332' +
          'C977873700000000016854419C4A00000000000067EDC645230000006887C68BB54134420761157A98AC2D4DF03B761D4ADC' +
          '6ACC0F00010000000000EEAFF441BA994BE720D61300000000000048656C6C6F2C2053796D626F6C21'
      );
    });

    it('マルチシグトランザクション署名が一致する', async () => {
      const facade = new SymbolFacade('mainnet');
      const tx = SymbolTransactionFactory.deserialize(
        utils.hexToUint8(
          '0801000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
            '00000000000000000000000000000000000000000000D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332' +
            'C97787370000000002684142C08F000000000000D53BD545230000007A1801B2EEB095EAC6703CF90A640E0D5FF7E9A7ED41' +
            '0915EFA9A7954923043160000000000000006000000000000000A09AA5F47A6759802FF955F8DC2D2A14A5C99D23BE97F864' +
            '127FF9383455A4F0000000000168544168AD8BAAB80B1DC684542EC175259711AB2C41D2FEA8D50F0000010000000000EEAF' +
            'F441BA994BE7081BF40500000000'
        )
      );
      const privateKey = new PrivateKey('1111111111111111111111111111111111111111111111111111111111111111');
      const account = facade.createAccount(privateKey);
      const signature = account.signTransaction(tx);
      SymbolTransactionFactory.attachSignature(tx, signature);
      const txHash = facade.hashTransaction(tx);

      expect(txHash.toString()).toBe('509B869153D57C3DFF60B8AFF29DB4841E5CC48ACA6EB24A33B899FADB244C35');
      expect(utils.uint8ToHex(signature.bytes)).toBe(
        'B749DE6BDBC65083D4C31FC6F1BF296AC31CE8A69758804D3D9C83EAD044856A7359CCD5B33AEE4872049225477A0B1407828DA79E213B27650231E996F74205'
      );
      expect(utils.uint8ToHex(tx.serialize())).toBe(
        '0801000000000000B749DE6BDBC65083D4C31FC6F1BF296AC31CE8A69758804D3D9C83EAD044856A7359CCD5B33AEE487204' +
          '9225477A0B1407828DA79E213B27650231E996F74205D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332' +
          'C97787370000000002684142C08F000000000000D53BD545230000007A1801B2EEB095EAC6703CF90A640E0D5FF7E9A7ED41' +
          '0915EFA9A7954923043160000000000000006000000000000000A09AA5F47A6759802FF955F8DC2D2A14A5C99D23BE97F864' +
          '127FF9383455A4F0000000000168544168AD8BAAB80B1DC684542EC175259711AB2C41D2FEA8D50F0000010000000000EEAF' +
          'F441BA994BE7081BF40500000000'
      );
    });

    it('連署が一致する', async () => {
      const privateKey = new PrivateKey('2222222222222222222222222222222222222222222222222222222222222222');
      const tx = SymbolTransactionFactory.deserialize(
        utils.hexToUint8(
          '0801000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
            '00000000000000000000000000000000000000000000D04AB232742BB4AB3A1368BD4615E4E6D0224AB71A016BAF8520A332' +
            'C97787370000000002684142C08F000000000000D53BD545230000007A1801B2EEB095EAC6703CF90A640E0D5FF7E9A7ED41' +
            '0915EFA9A7954923043160000000000000006000000000000000A09AA5F47A6759802FF955F8DC2D2A14A5C99D23BE97F864' +
            '127FF9383455A4F0000000000168544168AD8BAAB80B1DC684542EC175259711AB2C41D2FEA8D50F0000010000000000EEAF' +
            'F441BA994BE7081BF40500000000'
        )
      );
      const facade = new SymbolFacade('mainnet');
      const keyPair = new KeyPair(privateKey);
      const account = new SymbolAccount(facade, keyPair);
      const cosignature = account.cosignTransaction(tx, true);

      expect(utils.uint8ToHex(cosignature.serialize())).toBe(
        '0000000000000000A09AA5F47A6759802FF955F8DC2D2A14A5C99D23BE97F864127FF9383455A4F070C1D49C7A480D399AF5' +
          '97059076E6DF33536427F0FE456AFCD61AAD2F9CF478DF330364ACC8C3C49F0FB63240C3780C50ED255241881C86EA73D3A2' +
          '8764690090406699ED7CE26870F1B8E287A74552A604EC62B62EF53BA907D3808753B897'
      );
    });
  });
});
