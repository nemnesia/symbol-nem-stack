# Symbol WebSocket

Symbol ブロックチェーンのリアルタイムデータを監視する TypeScript ライブラリ。

## 特徴

- 型安全な通知データ取得（ブロック、トランザクション、ステータスなど）
- 接続完了前・再接続待機中の購読を保留して送信
- サブスクリプション管理
- エラー・クローズイベントのハンドリング
- 自動再接続とサブスクリプション復元

## インストール

```bash
npm install @nemnesia/symbol-websocket
```

## 使い方

```typescript
import { SymbolWebSocket } from '@nemnesia/symbol-websocket';

const ws = new SymbolWebSocket({
  host: 'localhost',
  ssl: true,
  timeout: 5000,
});

// チャネルにサブスクライブ
ws.on('block', (message) => {
  console.log('New block height:', message.data.block.height);
});

// 個別に解除する場合
const stopBlocks = ws.on('block', (message) => {
  console.log('Another block height:', message.data.block.height);
});
stopBlocks();

// エラーイベントの登録（構造化エラー情報を受け取る）
ws.onError((err) => {
  console.error('WebSocket error:', err.message);
  console.error('Error type:', err.type); // 'timeout' | 'network' | 'parse' | 'connection' | 'unknown'
  console.error('Severity:', err.severity); // 'fatal' | 'recoverable'

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

## API

### プロパティ

- `uid: string | null`
  - 現在の Gateway UID。接続完了前・切断中・切断後は `null`。
- `isConnected: boolean`
  - 内部 WebSocket が `OPEN` 状態かどうか。UID 受信前でも `true` になる場合があります。
- `client: WebSocket`
  - 現在の内部 WebSocket クライアント。自動再接続後は別インスタンスに置き換わります。直接操作せず、公開メソッドを使用してください。

### コンストラクタ

```typescript
new SymbolWebSocket(options: SymbolWebSocketOptions);
```

- `options`: 接続設定。
  - `host`: プロトコル・ポートを含まない接続先ホスト名または IP アドレス。
  - `ssl`: SSL を使用するかどうか（デフォルト: `true`）。有効時は `wss://{host}:3001/ws`、無効時は `ws://{host}:3000/ws` に接続します。
  - `timeout`: Gateway UID を受信するまでの接続タイムアウト（ミリ秒、デフォルト: `10000`）。各接続試行に適用され、`0` で無効化できます。
  - `autoReconnect`: 自動再接続を有効にするか（デフォルト: `true`）。
  - `maxReconnectAttempts`: 初回接続を除く最大再接続試行回数（デフォルト: `Infinity`）。
  - `reconnectInterval`: 再接続の間隔（ミリ秒、デフォルト: `3000`）。

### 解除関数

`SymbolWebSocketUnsubscribe` は `() => void` 型です。`on` と各イベント登録メソッドの返り値を呼び出すと、登録した callback だけを解除できます。

#### メソッド

- `on<K extends SymbolChannel>(channel: K, callback: (message: SymbolNotificationMap[K]) => void): SymbolWebSocketUnsubscribe`
  - 指定したチャネルにサブスクライブします。接続完了前または再接続待機中なら、接続完了後に送信されます。返り値を呼ぶと、その callback だけを解除します。
- `on<K extends SymbolChannel>(channel: K, address: string, callback: (message: SymbolNotificationMap[K]) => void): SymbolWebSocketUnsubscribe`
  - アドレスを指定してチャネルにサブスクライブします。対象は `confirmedAdded`、`unconfirmedAdded`、`unconfirmedRemoved`、`partialAdded`、`partialRemoved`、`cosignature`、`status` です。`address` にはエンコード済み Symbol アドレスまたは16桁の16進数形式の namespace ID を指定できます。返り値を呼ぶと、その callback だけを解除します。
- `off(channel: SymbolChannel): void`
  - 指定したチャネルのサブスクリプションと、そのチャネルに登録したすべてのコールバックを解除します。
- `off(channel: SymbolChannel, address: string): void`
  - アドレスを指定してチャネルのサブスクリプションと、そのパスに登録したすべてのコールバックを解除します。対象チャネルと `address` の形式は、アドレス指定付きの `on` と同じです。
- `onConnect(callback: (uid: string) => void): SymbolWebSocketUnsubscribe`
  - 接続完了時のコールバックを追加します。初回接続・自動再接続で呼ばれ、すでに接続済みなら登録時に直ちに呼ばれます。
- `onReconnect(callback: (attemptCount: number) => void): SymbolWebSocketUnsubscribe`
  - 自動再接続の開始直前に呼ばれるコールバックを追加します。`attemptCount` は 1 始まりです。
- `onError(callback: (err: SymbolWebSocketError) => void): SymbolWebSocketUnsubscribe`
  - 構造化エラーを受け取るコールバックを追加します。未登録時はエラーが `console.warn` に出力されます。
- `onClose(callback: (event: WebSocket.CloseEvent) => void): SymbolWebSocketUnsubscribe`
  - クローズイベントのコールバックを追加します。複数登録できます。
- `disconnect(): void`
  - WebSocket 接続を手動で切断し、すべての購読とコールバックを破棄します。自動再接続は行われません。
- `close(): void`
  - WebSocket 接続を切断します（`disconnect()`のエイリアス）。

## エラー処理

### 構造化エラー情報

`onError`コールバックは、以下のプロパティを持つ構造化エラーオブジェクトを提供します：

```typescript
interface SymbolWebSocketError {
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
  - `timeout`: Gateway UID の受信タイムアウト（fatal）
  - `network`: ネットワークエラー
  - `parse`: 受信メッセージの JSON パース失敗
  - `connection` / `unknown`: 型として予約されているエラー種別

- **severity**: エラーの重大度
  - `fatal`: 致命的エラー（自動再接続しません）
  - `recoverable`: 回復可能エラー（自動再接続します）

- **reconnecting**: recoverable なエラーが再接続試行中に発生したかどうか
- **reconnectAttempts**: エラー発生時点の再接続試行回数（初回接続中は `0`）

### エラーハンドリング例

```typescript
ws.onError((err) => {
  switch (err.type) {
    case 'timeout':
      console.error(`${err.host}への接続がタイムアウト`);
      break;
    case 'network':
      console.warn('ネットワークエラー');
      break;
    case 'parse':
      console.error('メッセージのパースに失敗');
      break;
  }

  if (err.severity === 'fatal') {
    // 再接続は自動停止
    // 必要に応じてユーザーに通知
  }
});
```

**注意**: エラーコールバックが登録されていない場合、エラーは`console.warn`に出力されます。
利用者が登録した callback が例外を送出した場合は、ライブラリが `console.error` に記録して接続管理を継続します。

## 注意点

- 再接続は自動で行われる（デフォルト有効）
- 再接続時は既存のサブスクリプションを自動復元
- 接続完了前・再接続待機中に `on()` した購読は、接続完了後に送信
- `autoReconnect: false`で自動再接続を無効化可能
- `severity: 'fatal'`のエラーが発生した場合は自動再接続停止
- `off()`は指定チャネルのすべてのコールバックを解除（subscribePath単位）
- `disconnect()` / `close()` の後に接続を再開する場合は、新しい `SymbolWebSocket` インスタンスを作成
- `host`、タイムアウト、再接続設定、アドレスは実行時にも検証されます。不正な値は接続前に例外になります。
- `block` と `finalizedBlock` はアドレス指定に対応していません。非空のアドレスを指定すると例外になります。

## ライセンス

このプロジェクトは [MITライセンス](./LICENSE) のもとで公開されています。

## 貢献方法

バグ報告・機能要望・プルリクエストは [GitHubリポジトリ](https://github.com/nemnesia/symbol-tools/tree/main/packages/symbol-websocket) で受け付けています。

## バグ報告・質問

問題や質問は [GitHub Issues](https://github.com/nemnesia/symbol-tools/issues) まで。
