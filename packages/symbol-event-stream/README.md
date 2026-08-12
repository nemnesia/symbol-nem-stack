# @nemnesia/symbol-event-stream

Symbol ブロックチェーンのイベントを、複数ノードから冗長に受け取りながら、アプリケーションには 1 つのイベントストリームとして渡す TypeScript ライブラリです。

[![npm version](https://img.shields.io/npm/v/@nemnesia/symbol-event-stream.svg)](https://www.npmjs.com/package/@nemnesia/symbol-event-stream)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

たとえば「ブロック生成を監視する」「あるアドレスの承認済みトランザクションを処理する」といった用途で、単一ノードの一時的な切断・遅延に依存したくない場合に使います。

## 何を解決するか

単一の Symbol ノードだけを監視すると、ノードの切断や遅延中にイベントを受け取りにくくなります。一方で複数ノードを購読すると、同じ通知が複数回届きます。

`SymbolEventStream` はこの 2 つをまとめて扱います。

- 複数のノードへ同時に WebSocket 接続する
- 同じ購読に複数ノードから届いた同一イベントを 1 回だけ配信する
- 切断したノードを再接続し、失敗が続けば未使用の別ノードへ切り替える
- 切り替えたノードを一時的に候補から除外する

つまり、利用側は通常の `on()` コールバックを 1 回登録するだけで、複数ノード監視を利用できます。

## 向いている用途

- 新しいブロックやファイナライズを継続して監視する
- アドレスに関する承認済み・未承認トランザクションを受け取る
- ノード障害の間も、可能な範囲でイベント受信を継続したい

これは永続キューやイベント履歴の再取得を提供するライブラリではありません。プロセス停止中や、すべての接続先からイベントを受信できなかった期間を補完する必要がある場合は、REST API などでチェーンの状態を照合してください。

## インストール

```bash
npm install @nemnesia/symbol-event-stream
```

```bash
pnpm add @nemnesia/symbol-event-stream @nemnesia/symbol-nem-node-picker
```

## 最短の例

```typescript
import { SymbolEventStream } from '@nemnesia/symbol-event-stream';
import { nemSymbolNodePicker } from '@nemnesia/symbol-nem-node-picker';

const nodewatchUrls = await nemSymbolNodePicker({ count: 3, isSsl: true });
const stream = new SymbolEventStream({ nodewatchUrls, connections: 2 });

// 2 ノードのどちらから届いても、同じブロックは 1 回だけ処理される。
stream.on('block', (message) => {
  console.log('新しいブロック:', message);
});

stream.onError((error) => {
  console.error('WebSocket error:', error);
});

// アプリケーション終了時に呼び出す。終了後にこのインスタンスは再利用できない。
process.on('SIGINT', () => stream.close());
```

`nodewatchUrls` には `nemSymbolNodePicker()` が返すノード endpoint URLを指定します。利用側でhostへ変換する必要はありません。入力は `http://` または `https://` の root endpoint（path、query、fragmentなし）とし、ポートは省略するか `http` では `3000`、`https` では `3001` を指定します。`https` endpointは `wss://{host}:3001/ws`、`http` endpointは `ws://{host}:3000/ws`へ接続します。非標準のport/pathを含むendpointは受け付けません。
ノードの選出数は picker の `count` で指定します。

## 購読する

アドレスを指定しない購読と、アドレスで絞り込む購読の両方を利用できます。

```typescript
// ブロックの監視
stream.on('block', (message) => {
  console.log(message);
});

// 特定アドレスの承認済みトランザクションの監視
const address = 'TBQLP7SU7WMUK3XYMIJZPWIT2HJ3PTVJPWFJNJQ';
const onConfirmed = (message: unknown) => {
  console.log('confirmed:', message);
};

stream.on('confirmedAdded', address, onConfirmed);

// このコールバックだけを解除
stream.off('confirmedAdded', address, onConfirmed);

// このアドレスの confirmedAdded 購読をすべて解除
stream.off('confirmedAdded', address);
```

### 対応チャネル

| チャネル                                  | 通知                                               |
| ----------------------------------------- | -------------------------------------------------- |
| `block`                                   | 新しいブロック                                     |
| `finalizedBlock`                          | ファイナライズされたブロック                       |
| `confirmedAdded`                          | 承認済みトランザクション                           |
| `unconfirmedAdded` / `unconfirmedRemoved` | 未承認トランザクションの追加／削除                 |
| `partialAdded` / `partialRemoved`         | アグリゲートボンデッドトランザクションの追加／削除 |
| `cosignature`                             | 連署                                               |
| `status`                                  | トランザクションステータス                         |

## 重複排除の範囲

通知の `meta.hash`、`hash`、または `uid` を ID として使用します。`cosignature` 通知は `parentHash`、`signerPublicKey`、`signature` の組み合わせを ID として使用します。同じ**チャネル・アドレス購読**に同じ ID が `cacheTtl` の間に複数ノードから届いた場合、最初の 1 回だけを配信します。

別のチャネルや別アドレス購読は独立しています。したがって、同じトランザクションが `unconfirmedAdded` の後に `confirmedAdded` として届く場合や、複数アドレスに関係するトランザクションは、それぞれ配信されます。

ID を持たない通知は重複排除できないため、届くたびに配信します。

## 接続とノード切り替え

各接続は自動再接続します。あるノードの再接続回数が `maxReconnectBeforeSwitching` に達し、未使用かつブラックリスト外の候補がある場合は、そのノードを新しい候補へ切り替えます。既存の購読は新しい接続へ復元されます。

切り替え元ノードは `blacklistTtl` の間だけ候補から除外されます。代替候補がない場合は、現在の接続で再接続を継続します。

```typescript
stream.onConnect((nodeUrl, uid) => {
  console.log('接続完了:', nodeUrl, uid);
});

stream.onDisconnect((nodeUrl) => {
  console.log('切断:', nodeUrl);
});

console.log(stream.getConnectionStatus());
console.log(stream.getBlacklistedNodes());
```

`getActiveConnectionCount()` は管理中の接続数です。実際に OPEN 状態のノードを確認するには `getConnectedNodes()` または `getConnectionStatus()` を使ってください。

## オプション

| オプション                    | 必須   | 既定値   | 説明                                                                             |
| ----------------------------- | ------ | -------- | -------------------------------------------------------------------------------- |
| `nodewatchUrls`               | はい   | —        | pickerが返すノード endpoint URL。1件以上必要です。                               |
| `connections`                 | はい   | —        | 同時接続数。正の安全な整数を指定します。候補数を超える場合は全候補へ接続します。 |
| `maxCacheSize`                | いいえ | `10000`  | 重複排除キャッシュの最大件数。正の安全な整数です。                               |
| `cacheTtl`                    | いいえ | `60000`  | 重複排除の有効期間（ミリ秒）。正の有限数です。                                   |
| `maxReconnectBeforeSwitching` | いいえ | `5`      | ノード切り替えを試みる再接続回数。正の安全な整数です。                           |
| `blacklistTtl`                | いいえ | `300000` | 切り替え元ノードを候補から除外する時間（ミリ秒）。正の有限数です。               |

```typescript
const stream = new SymbolEventStream({
  nodewatchUrls: [
    'https://node-1.example.com:3001',
    'https://node-2.example.com:3001',
    'https://node-3.example.com:3001',
  ],
  connections: 2,
  maxCacheSize: 5_000,
  cacheTtl: 30_000,
  maxReconnectBeforeSwitching: 3,
  blacklistTtl: 5 * 60_000,
});
```

## 公開 API

```typescript
import type { NodeConnectionStatus, SymbolEventStreamOptions } from '@nemnesia/symbol-event-stream';

const options: SymbolEventStreamOptions = {
  nodewatchUrls: ['https://node.example.com:3001'],
  connections: 1,
};

const stream = new SymbolEventStream(options);
const statuses: NodeConnectionStatus[] = stream.getConnectionStatus();
```

- `on(channel, callback)` / `on(channel, address, callback)` — 購読を追加
- `off(channel, callback?)` / `off(channel, address, callback?)` — 購読を解除
- `onError(callback)` — 構造化された WebSocket エラーを受信
- `onConnect(callback)` / `onDisconnect(callback)` — 接続状態の変化を監視
- `isConnected()`、`getIsClosed()`、`getConnectedNodes()`、`getConnectionStatus()` — 状態を取得
- `getBlacklistedNodes()` — 一時的に除外中の候補を取得
- `close()` — すべての接続とコールバックを破棄

## 動作環境

- Node.js 20 以上
- TypeScript 5 以上（TypeScript で利用する場合）

## 関連パッケージ

- [@nemnesia/symbol-websocket](https://www.npmjs.com/package/@nemnesia/symbol-websocket) — 単一ノード接続用の WebSocket クライアント
- [@nemnesia/symbol-nem-node-picker](https://www.npmjs.com/package/@nemnesia/symbol-nem-node-picker) — NodeWatchから接続候補を選出

## コントリビューション

バグ報告や機能提案は [GitHub Issues](https://github.com/nemnesia/symbol-tools/issues) へお願いします。

## ライセンス

MIT
