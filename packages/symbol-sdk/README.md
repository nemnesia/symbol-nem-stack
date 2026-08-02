# @nemnesia/symbol-sdk

[![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-sdk?style=flat-square)](https://www.npmjs.com/package/@nemnesia/symbol-sdk)
[![license](https://img.shields.io/npm/l/@nemnesia/symbol-sdk?style=flat-square)](./LICENSE)

> Node.js・ブラウザ・React Native対応のSymbol公式SDK移植版（[symbol-sdk公式](https://github.com/symbol/symbol/tree/main/sdk) ベース）

---

## 概要

このパッケージは [symbol-sdk](https://github.com/symbol/symbol/tree/main/sdk) 公式リポジトリをベースに、Node.js だけでなくモダンブラウザ（ES2020以降）と React Native でも利用できるよう再構成した JavaScript SDK です。

### 主な変更点

この移植版では、実行環境への依存を減らすため、主に次の変更を加えています。

- **Node.js 組み込み暗号 API への依存を削減**
  - 乱数生成を `@noble/hashes/utils.js` の `randomBytes` に変更。`randomBytes` は利用環境の Web Crypto API（`crypto.getRandomValues`）を利用します。
  - HMAC を `@noble/hashes/hmac.js` の `hmac` に変更
  - RIPEMD160 を `@noble/hashes/legacy.js` の `ripemd160` に変更
- **BIP32/BIP39 の依存を更新**
  - ニーモニック生成を `bitcore-mnemonic` から `@scure/bip39` に変更
- **`Buffer` への依存を削除**
  - バイト列は `Uint8Array` を使用します。
- **メッセージ暗号化 API を非同期化**
  - `MessageEncoder` の `encode`、`tryDecode`、`encodeDeprecated`、`tryDecodeDeprecated`（Symbol）は `Promise` を返します。
  - 呼び出し側では `await`、または `Promise` のハンドリングが必要です。

## インストール

Node.js、ブラウザ、React Native いずれの環境でも利用可能です。

```sh
# npm
npm install symbol-sdk@npm:@nemnesia/symbol-sdk
# pnpm
pnpm add symbol-sdk@npm:@nemnesia/symbol-sdk
# yarn
yarn add symbol-sdk@npm:@nemnesia/symbol-sdk
```

## クイックスタート

```js
import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

// ランダムな秘密鍵生成
const privateKey = PrivateKey.random();

// アカウント生成
const facade = new SymbolFacade('testnet');
const account = facade.createAccount(privateKey);

console.log('publicKey :', account.publicKey.toString());
console.log('address   :', account.address.toString());
```

TypeScriptでもそのまま利用できます。

## メッセージの暗号化と復号

`MessageEncoder` の暗号化・復号メソッドは非同期です。`await` を付けて結果を取得してください。

```js
import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

const facade = new SymbolFacade('testnet');
const sender = facade.createAccount(PrivateKey.random());
const recipient = facade.createAccount(PrivateKey.random());

const clearMessage = new TextEncoder().encode('Hello, Symbol!');
const encryptedMessage = await sender.messageEncoder().encode(
  recipient.publicKey,
  clearMessage
);

const result = await recipient.messageEncoder().tryDecode(
  sender.publicKey,
  encryptedMessage
);

if (!result.isDecoded)
  throw new Error('メッセージを復号できませんでした');

console.log(new TextDecoder().decode(result.message)); // Hello, Symbol!
```

Symbol の `tryDecode` は、復号できた場合に `{ isDecoded: true, message: Uint8Array }` を返します。暗号化されていない形式や、受信者が異なるメッセージでは `isDecoded` が `false` になります。NEM の `MessageEncoder` も `encode` と `tryDecode` を非同期で提供しますが、入出力は NEM の `Message` モデルです。

## 注意事項

- 公式 symbol-sdk と一部 API や挙動が異なります。特に暗号化 API の戻り値は `Promise` です。
- 暗号処理や依存パッケージの違いにより、公式 SDK および既存ウォレットとの完全な互換性は保証されません。
- 秘密鍵やニーモニックをログ、エラー出力、リポジトリへ保存しないでください。

## ライセンス

MIT License

## 参考リンク

- [symbol-sdk公式リポジトリ](https://github.com/symbol/symbol/tree/main/sdk)
- [symbol/catbuffer-parser](https://github.com/symbol/symbol/tree/main/catbuffer)
