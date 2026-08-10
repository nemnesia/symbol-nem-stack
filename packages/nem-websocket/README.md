# NEM WebSocket

NEM WebSocket は、NEM ブロックチェーンのリアルタイムデータを監視するための TypeScript ライブラリです。このライブラリは、WebSocket を使用してブロックチェーンデータを効率的に取得し、サブスクリプションベースのイベントリスニングを提供します。

## 特徴

- **リアルタイムデータ取得**: ブロック、トランザクション、アカウント情報などをリアルタイムで取得可能。
- **柔軟なサブスクリプション管理**: 必要なチャネルに簡単にサブスクライブおよびアンサブスクライブ可能。
- **エラーおよびクローズイベントのハンドリング**: WebSocket のエラーや接続終了を簡単に処理可能。
- **自動再接続**: 接続が切断された場合、自動的に再接続し、サブスクリプションを復元。

信頼できないネットワークでは `ssl: true` を使用してください。`ssl: false` は `ws://` を使用するため、通信路の完全性や内容の秘匿性を保証しません。

## インストール

```bash
yarn add @nemnesia/nem-websocket
```

または:

```bash
npm install @nemnesia/nem-websocket
```

### モジュール形式

このパッケージは ESM 専用です。`tsx` で実行するプロジェクトでは、呼び出し元の `package.json` に `"type": "module"` を設定するか、エントリーファイルを `.mts` 拡張子にしてください。CommonJS の `require()` はサポートしていません。

## 使用方法

```typescript
import { NemWebSocket } from '@nemnesia/nem-websocket';

const ws = new NemWebSocket({
  host: 'localhost',
  ssl: false,
  timeout: 5000,
});

// チャネルにサブスクライブ
ws.on('blocks', (message) => {
  console.log('New block:', message);
});

// 個別に解除する場合
const stopBlocks = ws.on('blocks', (message) => {
  console.log('Another block listener:', message);
});
stopBlocks();

// エラーイベントの登録
ws.onError((err) => {
  console.error('WebSocket error:', err.message);
  console.error('Error type:', err.type);
  console.error('Severity:', err.severity);

  if (err.severity === 'fatal') {
    console.error('致命的エラー - 再接続しません');
  } else if (err.reconnecting) {
    console.log(`再接続試行中: ${err.reconnectAttempts}回目`);
  }
});

// クローズイベントの登録
ws.onClose((event) => {
  console.log('WebSocket closed:', event);
});

// 切断
ws.disconnect();
```

## E2Eテスト

実NIS1テストネットへ接続するE2Eテストは、パッケージディレクトリの`.env`から設定を読み込みます。
設定項目の例は[`.env.example`](./.env.example)にあります。パッケージディレクトリでコピーしてから、テストネットの接続先とアドレスを設定してください。

```dotenv
NEM_E2E_HOST=<テストネットノードのホスト>
NEM_E2E_ADDRESS=<テストネットアカウントのアドレス>
NEM_E2E_SSL=false
```

```bash
cp .env.example .env
```

通常のユニットテストは実NIS1へ接続せず、E2Eテストは次のコマンドで明示的に実行します。

```bash
pnpm --filter @nemnesia/nem-websocket test:e2e
```

E2Eテストは全チャネルを1接続で購読し、アドレスの初期通知をまとめて確認します。`newBlock`と`blocks`は同じ次ブロックで確認します。`transactions`や`unconfirmed`の将来通知を発生させるトランザクションはテストから送信しないため、これらは購読登録までを確認し、実トランザクションを用いた通知確認は別途行います。

## API

### コンストラクタ

```typescript
new NemWebSocket(options: NemWebSocketOptions);
```

- `options`: 接続設定。
  - `host`: 接続先ホスト。
    プロトコル、ポート、パスは含めません。
  - `ssl`: SSL を使用するかどうか（デフォルト: `false`）。
  - `timeout`: 接続タイムアウト（ミリ秒、デフォルト: `5000`）。
  - `autoReconnect`: 自動再接続を有効にするか（デフォルト: `true`）。
  - `maxReconnectAttempts`: 安定接続になるまでの最大再接続試行回数（デフォルト: `10`）。30秒間接続が維持されると回数をリセットします。
  - `reconnectInterval`: 再接続待機時間の基準値（ミリ秒、デフォルト: `3000`）。試行ごとに指数バックオフとjitterを適用します。0は指定できません。

### プロパティ

- `uid: string | null`
  - 現在のWebSocket接続のUID（STOMPセッションIDまたはフォールバック）。未接続時は`null`。
- `isConnected: boolean`
  - WebSocket接続が確立されているかどうか。
- `client: Client`
  - 内部のSTOMPクライアントインスタンス。

### 解除関数

`NemWebSocketUnsubscribe` は `() => void` 型です。`on` と各イベント登録メソッドの返り値を呼び出すと、登録した callback だけを解除できます。

### メソッド

- `on(channel: NemChannel, callback: (message: string) => void): NemWebSocketUnsubscribe`
  - 指定したチャネルにサブスクライブします。返り値を呼ぶと、その callback だけを解除します。
- `on(channel: NemChannel, address: string, callback: (message: string) => void): NemWebSocketUnsubscribe`
  - NIS1テストネットのアドレスを指定してチャネルにサブスクライブします。返り値を呼ぶと、その callback だけを解除します。
- `off(channel: NemChannel): void`
  - 指定したチャネルに登録されたすべてのコールバックとサブスクリプションを解除します。
- `off(channel: NemChannel, address: string): void`
  - NIS1テストネットのアドレスを指定したチャネルに登録されたすべてのコールバックとサブスクリプションを解除します。
- `onConnect(callback: (uid: string) => void): NemWebSocketUnsubscribe`
  - WebSocket 接続完了時のコールバックを登録します。
- `onReconnect(callback: (attemptCount: number) => void): NemWebSocketUnsubscribe`
  - 再接続試行時のコールバックを登録します。
- `onError(callback: (err: NemWebSocketError) => void): NemWebSocketUnsubscribe`
  - エラーイベントのコールバックを登録します（構造化エラー情報を提供）。
- `onClose(callback: (event: WebSocket.CloseEvent) => void): NemWebSocketUnsubscribe`
  - クローズイベントのコールバックを登録します。複数登録できます。
- `disconnect(): void`
  - WebSocket 接続を切断します。
- `close(): void`
  - WebSocket 接続を切断します（`disconnect()`のエイリアス）。

## エラー処理

### 構造化エラー情報

`onError`コールバックは、以下のプロパティを持つ構造化エラーオブジェクトを提供します：

```typescript
interface NemWebSocketError {
  type: 'connection' | 'timeout' | 'parse' | 'network' | 'unknown';
  severity: 'fatal' | 'recoverable';
  host: string;
  reconnecting: boolean;
  reconnectAttempts: number;
  originalError: WebSocket.ErrorEvent | Error;
  timestamp: number;
  message: string;
}
```

- **type**: エラーの種類を示します
  - `timeout`: 接続タイムアウト
  - `network`: ネットワークエラー
  - `parse`: メッセージパースエラー
  - `connection`: 接続エラー
  - `unknown`: その他のエラー

- **severity**: エラーの重大度。STOMP `ERROR` フレームは `fatal` として通知し、自動再接続を停止します。下位 WebSocket の一時的なエラーは `recoverable` として通知します。

- **reconnecting**: 現在再接続中かどうか
- **reconnectAttempts**: 現在の再接続試行回数

**注意**: エラーコールバックが登録されていない場合、エラーは`console.warn`に出力されます。
利用者が登録した callback が例外を送出した場合は、ライブラリが `console.error` に記録して接続管理を継続します。

## 注意点

- 再接続は自動的に行われます（デフォルト有効）。
- 再接続は指数バックオフ（最大60秒）とjitterを使用します。接続が30秒間安定すると再接続試行回数をリセットします。
- 受信STOMPフレームは4 MiBを上限とし、`content-length`が不正または上限超過の場合は接続を破棄します。
- 再接続時は既存のサブスクリプションが自動的に復元されます。
- 接続が切断されると、`isConnected` は `false`、`uid` は `null` になります。
- `autoReconnect: false`を設定することで自動再接続を無効化できます。
- `host`、タイムアウト、再接続設定は接続前に検証され、不正なチャネルやアドレスは `on` / `off` 呼び出し時に例外になります。
- `host` は信頼済み設定値またはallowlistから取得してください。`localhost` やprivate IPを受け付けるため、Webサービスで外部入力をそのまま渡すと内部ネットワークへの接続を許す可能性があります。
- アドレス系チャネルはNIS1テストネットの40文字アドレスに対応し、小文字・混在表記はcanonicalな大文字へ正規化されます。長さ、Base32、network byte、checksumが不正なアドレスは拒否されます。

## ライセンス

[MIT](./LICENSE)
