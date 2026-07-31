# Symbol Announcer

`@nemnesia/symbol-announcer` は、Symbol ノードへトランザクションをアナウンスし、その承認・ステータス通知を WebSocket で監視する TypeScript ライブラリです。

## 特徴

- REST API を使ったトランザクションアナウンス
- 承認・ステータス通知の自動監視
- 型安全なイベントリスナー
- WebSocket の再接続時にアナウンス要求を重複送信しない保護
- ノードURL、アドレス、ペイロード、ハッシュの実行時検証

## インストール

```bash
npm install @nemnesia/symbol-announcer
```

このパッケージは ESM と CommonJS の両方から利用できます。

## 使用方法

```typescript
import { SymbolAnnouncer } from '@nemnesia/symbol-announcer';

const announcer = new SymbolAnnouncer('https://node.example.com:3001');

announcer.on('connected', () => {
  console.log('WebSocket connected');
});
announcer.on('announced', (response) => {
  console.log('Transaction accepted:', response);
});
announcer.on('confirmedAdded', (notification) => {
  console.log('Transaction confirmed:', notification);
  announcer.disconnect();
});
announcer.on('status', (notification) => {
  console.error('Transaction status:', notification);
  announcer.disconnect();
});
announcer.on('error', (error) => {
  console.error('Announcement failed:', error);
});

announcer.announce(
  signerAddress,
  transactionPayloadJson,
  transactionHash
);
```

## API

### コンストラクタ

```typescript
new SymbolAnnouncer(nodeUrl: string);
```

- `nodeUrl`: Symbol REST ノードの完全な HTTP(S) URL。プロトコルに応じて WebSocket 接続も設定されます。

### メソッド

- `announce(signerAddress, transaction, transactionHash): void`
  - 接続完了後にトランザクションをアナウンスし、同じ署名者アドレスの承認・ステータス通知を監視します。
  - `transaction` は有効なJSON文字列、ほかの引数は空でない文字列を指定します。
  - WebSocket の再接続後も購読は復元されますが、同じアナウンス要求は再送しません。
- `disconnect(): void`
  - WebSocket 接続と監視を終了します。

### イベント

- `connected`
  - WebSocket 接続が確立されたときに発火します。
- `announced(data)`
  - REST API がアナウンス要求を受理したときに発火します。
- `confirmedAdded(notification)`
  - 指定したトランザクションハッシュと一致する承認通知を受信したときに発火します。
- `status(notification)`
  - 指定したトランザクションハッシュと一致するステータス通知を受信したときに発火します。
- `error(error)`
  - WebSocket または REST API で発生したエラーを通知します。未登録の場合は `console.error` に記録します。

## 動作環境

- Node.js 20 以降

## ライセンス

[MIT](./LICENSE)
