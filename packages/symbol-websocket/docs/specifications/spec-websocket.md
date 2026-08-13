# Symbol WebSocket 仕様書

## 1. 文書情報

| 項目 | 内容 |
| --- | --- |
| 対象パッケージ | `@nemnesia/symbol-websocket` |
| 対象チェーン | Symbol |
| 対象ネットワーク | 接続先ホストにより決定する。パッケージ自身は Mainnet / Testnet を選択・検証しない。 |
| 仕様の位置付け | 現行パッケージ契約 |

## 2. 概要

本パッケージは、SymbolノードのWebSocket Gatewayへ接続し、Gatewayの通知チャネルを購読して、通知をTypeScript callbackへ配送する。主な機能は次のとおり。

- WebSocket接続の作成と接続先URLの生成
- Gateway UIDの受信と購読要求の送信
- ブロック、トランザクション、連署、ステータス通知の購読
- callback単位および購読path単位の解除
- 接続前・再接続待機中の購読保留
- 自動再接続と既存購読の復元
- 構造化エラー、接続クローズ、接続完了、再接続開始の通知

## 3. 適用範囲と対象外

### 3.1 適用範囲

- Symbol GatewayとのWebSocket接続
- `uid`、`subscribe`、`unsubscribe` を用いた購読管理
- JSON通知の構文解析とtopicに基づくcallback配送
- 本書で定義する公開型と公開メソッド

### 3.2 対象外

次の処理は本パッケージの責務ではない。

- トランザクションの作成、署名、暗号化、announce
- WebSocketのアプリケーション認証
- 通知payloadの署名検証または真正性検証
- Symbolアドレスのchecksum検証、network byte検証、接続先ネットワークとの整合性検証
- Gatewayの通知payloadに対するruntime schema検証
- NEMのSTOMP接続およびNEM固有のアドレス処理

`ssl` の既定値は `true` だが、`ssl: false` による平文WebSocket接続も公開契約上許容される。TLS必須性は本書では定めない。

## 4. 用語

| 用語 | 定義 |
| --- | --- |
| Gateway UID | 接続後の最初のJSONメッセージから取得する、空でない文字列の `uid`。購読要求に含める。 |
| channel | APIで指定する9種類の通知名。 |
| subscribe path | Gatewayへ送信する購読単位。`channel` または `channel/address`。 |
| base path | アドレスを付加しない購読path。 |
| active subscription | 現在の接続で送信済みとして管理され、再接続時に復元される購読path。 |
| pending subscription | UID未受信またはWebSocket未接続のため、後で送信する購読path。 |
| 接続完了 | WebSocketが `OPEN` であることではなく、非空のGateway UIDを受信した状態。 |

## 5. 公開API

### 5.1 コンストラクター

```ts
new SymbolWebSocket(options: SymbolWebSocketOptions)
```

コンストラクターは引数を検証した後、直ちにWebSocket接続を開始する。接続開始前に検証で失敗した場合、WebSocketを作成してはならない。

`SymbolWebSocketOptions` は次のとおり。

| フィールド | 型 | 既定値 | 制約と意味 |
| --- | --- | --- | --- |
| `host` | `string` | なし | 空でないホスト名またはIPアドレス。プロトコル、userinfo、ポート、パス、空白、`?`、`#`、バックスラッシュを含めない。 |
| `ssl` | `boolean` | `true` | `true` は `wss`、`false` は `ws` を使用する。 |
| `timeout` | `number` | `10000` | 0以上の有限値。単位はミリ秒。`0` はUID受信タイムアウトを無効化する。 |
| `autoReconnect` | `boolean` | `true` | 手動切断またはfatalエラーでないclose後の自動再接続を制御する。 |
| `maxReconnectAttempts` | `number` | `Infinity` | 0以上の整数または `Infinity`。初回接続を試行回数に含めない。 |
| `reconnectInterval` | `number` | `3000` | 0以上の有限値。単位はミリ秒。再接続開始までの固定待機時間。 |

IPv6アドレスは角括弧で囲む。例として `[2001:db8::1]` は許可し、`2001:db8::1` と `node.example:3000` は拒否する。

### 5.2 接続先URL

`host` を `host` 部分として、次のURLを生成する。

| `ssl` | URL |
| --- | --- |
| `true` | `wss://{host}:3001/ws` |
| `false` | `ws://{host}:3000/ws` |

ポート、プロトコル、pathを `host` に含めることはできない。

### 5.3 公開プロパティ

| プロパティ | 型 | 動作 |
| --- | --- | --- |
| `uid` | `string \| null` | Gateway UID。UID受信前、切断中、切断後は `null`。 |
| `isConnected` | `boolean` | 内部WebSocketの `readyState === OPEN` を返す。UID受信前でも `true` になり得る。 |
| `client` | `WebSocket` | 現在の内部WebSocket。自動再接続後は別インスタンスに置換される。外部からイベントハンドラや `send` を操作しない。 |

### 5.4 購読と解除

```ts
on<K extends SymbolChannel>(
  channel: K,
  callback: (message: SymbolNotificationMap[K]) => void
): SymbolWebSocketUnsubscribe

on<K extends SymbolChannel>(
  channel: K,
  address: string,
  callback: (message: SymbolNotificationMap[K]) => void
): SymbolWebSocketUnsubscribe

off(channel: SymbolChannel): void
off(channel: SymbolChannel, address: string): void
```

`on` は購読pathへcallbackを登録し、解除関数を返す。解除関数は同じcallbackだけを解除し、複数回呼び出しても安全である。同一pathには異なる複数callbackを登録できる。

`off` は対象購読pathの全callbackを解除する。購読pathに最後のcallbackがなくなったとき、現在の接続でactiveなら `unsubscribe` を送信する。

### 5.5 接続・エラー・クローズイベント

```ts
onConnect(callback: (uid: string) => void): SymbolWebSocketUnsubscribe
onReconnect(callback: (attemptCount: number) => void): SymbolWebSocketUnsubscribe
onError(callback: (error: SymbolWebSocketError) => void): SymbolWebSocketUnsubscribe
onClose(callback: (event: WebSocket.CloseEvent) => void): SymbolWebSocketUnsubscribe
```

- `onConnect` は初回接続および再接続で、購読復元後に呼び出す。既にUIDを保持している場合は登録直後に現在のUIDで呼び出す。
- `onReconnect` は再接続タイマーを設定する直前に呼び出す。`attemptCount` は1始まりである。
- `onError` は構造化エラーを受け取る。
- `onClose` は現在のWebSocketがcloseしたときに、登録済みcallbackすべてへ呼び出す。
- 各登録メソッドの返却解除関数は、登録したcallbackだけを解除する。

`disconnect()` と `close()` は同じ動作をする。手動切断ではタイマー、購読、保留path、callback、UIDを破棄し、WebSocketを閉じ、自動再接続を行わない。切断後に同じインスタンスで接続を再開するAPIはない。

手動切断時は `onClose` callbackを破棄してからWebSocketを閉じるため、手動切断に対する `onClose` 通知は行われない。

## 6. チャネルと購読path

対応する `SymbolChannel` は次の9種類である。

| channel | base path | address付きpath |
| --- | --- | --- |
| `block` | `block` | 不可 |
| `finalizedBlock` | `finalizedBlock` | 不可 |
| `confirmedAdded` | `confirmedAdded` | `confirmedAdded/{address}` |
| `unconfirmedAdded` | `unconfirmedAdded` | `unconfirmedAdded/{address}` |
| `unconfirmedRemoved` | `unconfirmedRemoved` | `unconfirmedRemoved/{address}` |
| `partialAdded` | `partialAdded` | `partialAdded/{address}` |
| `partialRemoved` | `partialRemoved` | `partialRemoved/{address}` |
| `cosignature` | `cosignature` | `cosignature/{address}` |
| `status` | `status` | `status/{address}` |

アドレス引数が `undefined` または空文字の場合、アドレス付きpathを生成せずbase pathを使用する。`block` と `finalizedBlock` に非空アドレスを指定した場合は `TypeError` とし、購読・解除メッセージを送信しない。

アドレス引数は次の字句形式だけを受け付ける。

- 空文字
- 16桁の16進数: `[A-Fa-f0-9]{16}`。namespace IDとして扱う。
- 39文字の大文字Base32文字列: `[A-Z2-7]{39}`。エンコード済みSymbolアドレスとして扱う。

本パッケージは、上記形式に加えてchecksum、network byte、接続先ネットワークとの整合性を検証しない。

## 7. Wire形式

### 7.1 UID受信

各WebSocket接続で最初に受信したJSON値を接続完了判定に使用する。JSON値がオブジェクトで、`uid` が空でない文字列なら接続完了とする。

```json
{"uid":"gateway-session-id"}
```

最初のメッセージに有効なUIDがなければ、そのメッセージをcallbackへ配送せず、UID受信待ちを継続する。UID受信時に接続タイムアウトを解除し、再接続試行回数を `0` に戻す。

### 7.2 購読要求

UID受信後、未送信の購読pathについて、次のJSONを `JSON.stringify` した文字列を送信する。

```json
{"uid":"test-uid","subscribe":"block"}
```

アドレス付きpathの例:

```json
{"uid":"test-uid","subscribe":"confirmedAdded/TB6BPSISSTI4RKEBKY7OWN2O3HWN2FC3C7XLZ4Y"}
```

### 7.3 購読解除要求

購読解除時は、次のJSONを `JSON.stringify` した文字列を送信する。

```json
{"uid":"test-uid","unsubscribe":"block"}
```

購読要求・解除要求には、それぞれ `uid` と `subscribe` または `unsubscribe` を含める。これら以外のフィールドは追加しない。

### 7.4 送信条件

- UID未受信、またはWebSocketが `OPEN` でない場合、購読pathを保留する。
- 同一購読pathに異なるcallbackを複数登録しても、activeなsubscribeは1回だけ送信する。
- 最後のcallbackを解除したときだけ、activeなpathのunsubscribeを送信する。
- 再接続後に新しいUIDを受信したら、activeな購読pathを新しいUIDで送信し直す。
- 再接続待機中に登録されたpending pathは、active pathの復元後に送信する。ただし同じpathが既にactiveなら重複送信しない。
- 購読復元・pending path送信の後に `onConnect` callbackを呼び出す。

購読成功・失敗のacknowledgementや、Gatewayからのunsubscribe応答は本パッケージの公開APIで扱わない。

## 8. 通知データモデルと配送

### 8.1 共通エンベロープ

受信JSONは、次の形の通知エンベロープとして公開型で表現する。

```ts
interface SymbolNotificationEnvelope<TTopic extends string, TData> {
  topic: TTopic;
  data: TData;
}
```

受信JSONの構文解析後、`topic` が文字列であり、登録済み購読pathと完全一致する場合に限り、そのJSON値全体を対応するcallbackへ渡す。topicがない、topicが文字列でない、または一致する購読pathがない場合は配送しない。

`data`、未知フィールド、通知payloadのruntime schemaは検証しない。TypeScript型はコンパイル時の公開型であり、runtime validatorではない。

### 8.2 通知型

`HexString` と `UInt64String` はいずれも実体が `string` の型aliasである。

| channel | `data` 型と必須フィールド |
| --- | --- |
| `block` | `block`: `signature`, `signerPublicKey`, `version`, `network`, `type`, `height`, `timestamp`, `difficulty`, `previousBlockHash`, `transactionsHash`, `receiptsHash`, `stateHash`, `beneficiaryAddress`, `feeMultiplier`, `proofGamma`, `proofVerificationHash`, `proofScalar`; `meta`: `hash`, `generationHash`。`votingEligibleAccountsCount`, `harvestingEligibleAccountsCount`, `totalVotingBalance`, `previousImportanceBlockHash` は任意。 |
| `finalizedBlock` | `finalizationEpoch`, `finalizationPoint`, `height`, `hash` |
| `confirmedAdded` | `transaction`、`meta.hash`, `meta.merkleComponentHash`, `meta.height`。`transaction` は `unknown`。 |
| `unconfirmedAdded` | `transaction`、`meta.hash`, `meta.merkleComponentHash`, `meta.height`。`transaction` は `unknown`。 |
| `unconfirmedRemoved` | `meta.hash` |
| `partialAdded` | `transaction`、`meta.hash`, `meta.merkleComponentHash`, `meta.height`。`transaction` は `unknown`。 |
| `partialRemoved` | `meta.hash` |
| `cosignature` | `version`, `signerPublicKey`, `signature`, `parentHash` |
| `status` | `hash`, `code`, `deadline` |

TypeScript上のtopic型は、`block` と `finalizedBlock` ではbase名のみ、その他のチャネルではbase名または ``${channel}/${string}`` とする。ただしruntimeの配送判定は常に登録pathとの完全一致である。

## 9. 状態と処理フロー

### 9.1 初回接続

1. コンストラクターでoptionsを検証する。
2. 接続先URLを生成し、WebSocketを作成する。
3. `timeout > 0` なら、その接続のUID受信待ちタイマーを開始する。
4. UIDを受信するまで、登録された購読pathをpendingとして保持する。
5. 有効なUIDを受信したら、UIDを設定し、pending購読を送信する。
6. 購読送信後に `onConnect` callbackを呼び出す。
7. 以後のJSON受信はtopicに基づく通知として処理する。

### 9.2 再接続

現在のWebSocketが手動切断でなく、fatalエラー状態でもなく、`autoReconnect` が有効な状態でcloseした場合、再接続を試みる。

1. `maxReconnectAttempts` に達していなければ試行回数を1増やす。
2. `onReconnect(attemptCount)` を呼び出す。
3. `reconnectInterval` ミリ秒待機する。
4. 古いWebSocketが `OPEN` または `CONNECTING` ならcloseする。
5. 新しいWebSocketを作成し、新しいUIDを待つ。
6. 新しいUID受信後、active購読を復元し、その後pending購読を送信する。
7. 購読処理後に `onConnect` を呼び出し、試行回数を0に戻す。

接続成功するまでの試行回数は接続成功時にリセットされる。指数バックオフ、ジッター、close codeごとの分岐は本仕様に含めない。

### 9.3 手動切断

`disconnect()` または `close()` は次を行う。

- 再接続タイマーと接続タイムアウトを解除する。
- callback、active購読、pending購読を破棄する。
- WebSocketが `OPEN` または `CONNECTING` ならcloseする。
- UIDを `null` にし、再接続試行回数を0にする。
- 以後の自動再接続を停止する。

手動切断後に同じインスタンスを再接続に使用してはならない。再接続が必要な場合は新しいインスタンスを作成する。

## 10. エラー仕様

### 10.1 構造化エラー

`onError` callbackへ渡す `SymbolWebSocketError` は次のフィールドを持つ。

| フィールド | 型 | 内容 |
| --- | --- | --- |
| `type` | `'connection' \| 'timeout' \| 'parse' \| 'network' \| 'unknown'` | エラー種別。 |
| `severity` | `'fatal' \| 'recoverable'` | fatalは自動再接続を停止する分類、recoverableは接続処理を継続可能な分類。 |
| `host` | `string` | optionsで指定したhost。 |
| `reconnecting` | `boolean` | recoverableで、エラー時の再接続試行回数が1以上なら `true`。 |
| `reconnectAttempts` | `number` | エラー発生時点の再接続試行回数。初回接続中は0。 |
| `originalError` | `WebSocket.ErrorEvent \| Error` | WebSocket実装またはJSON parserの元エラー。 |
| `timestamp` | `number` | `Date.now()` によるエラー発生時刻。 |
| `message` | `string` | 利用者向けエラーメッセージ。 |

生成される種別は次のとおり。

| 発生条件 | `type` | `severity` | 動作 |
| --- | --- | --- | --- |
| UID受信前にtimeout | `timeout` | `fatal` | エラーを通知し、ソケットをcloseし、自動再接続しない。 |
| WebSocket `onerror` | `network` | `recoverable` | 構造化エラーを通知する。再接続は後続のclose処理で判断する。 |
| 受信データのJSON構文エラー | `parse` | `recoverable` | 構造化エラーを通知し、受信処理を継続する。 |

`connection` と `unknown` は公開unionに含まれるが、発生条件は定義しない。

### 10.2 同期引数エラー

次の入力不正は、WebSocket接続またはwireメッセージ送信を行う前に同期例外として扱う。

- コンストラクターの `host`、`ssl`、`autoReconnect`、`timeout`、`maxReconnectAttempts`、`reconnectInterval` が制約に違反する場合
- 未知のchannelを指定した場合
- `on` のcallbackが関数でない場合
- アドレス形式が不正な場合
- `block` または `finalizedBlock` に非空アドレスを指定した場合

`host`、channel、callbackの不正は `TypeError`、数値範囲の不正は `RangeError` とする。`off` の引数不正も同じ検証規則に従う。

### 10.3 エラーcallback未登録時

`onError` callbackが1件も登録されていない場合、エラーを例外として呼び出し元へ送出せず、`console.warn` に記録する。

### 10.4 callback例外

任意のcallbackが例外を送出しても、例外を接続エラーやJSONパースエラーへ変換してはならない。例外は `console.error` に記録し、同じ通知の他callback、接続状態更新、購読復元を継続する。通知開始後に登録されたcallbackは、その同一通知では呼び出さない。

## 11. セキュリティおよび相互運用性の境界

- `host` はURL authorityの混入を防ぐ形式検証を通過してからURLへ組み込む。
- `ssl: false` では通信を暗号化しないため、機密性・完全性は本パッケージで保証しない。
- UIDの長さ、文字種、署名、真正性は検証しない。
- 通知JSONは構文解析するが、通知payloadの意味的検証や署名検証は行わない。
- アドレスは字句形式だけを検証し、checksumとnetwork整合性は検証しない。
- 本パッケージは秘密鍵を扱わない。E2Eテストで使用する秘密鍵はテストネット用の外部設定であり、ログへ出力してはならない。

接続URL、UID handshake、wire JSON、チャネル一覧が対象Gatewayのどのプロトコルバージョンで規範化されているかは確定しない。上記のwire記述は本パッケージの送受信形式として扱う。

## 12. 適合試験

### 12.1 ユニット試験

少なくとも次の現行契約を検証する。

- hostname、IPv4、括弧付きIPv6からのURL生成
- protocol、path、port、userinfo、空白を含むhostの拒否
- オプションの既定値と境界値・型不正値の拒否
- UID受信前の購読保留とUID受信後の送信
- subscribe / unsubscribe JSONのキー、path、UID
- 全チャネルのbase pathおよびアドレス付きpath
- `block` / `finalizedBlock`へのアドレス指定拒否
- 39文字Base32形式および16桁16進数namespace IDの受理、形式不正値の拒否
- 同一pathの重複subscribe抑制とcallback単位の解除
- topic完全一致による通知配送と未知topicの破棄
- JSON parse error、network error、timeoutの分類
- callback例外の隔離
- 再接続試行、最大試行回数、購読復元、手動切断

### 12.2 E2E試験

E2E試験ではSymbol Testnetを対象とし、`block` とアドレス付き `confirmedAdded` の受信、およびSDKで署名したTransfer transactionのannounce後の通知を確認する。全チャネル、全通知payload、Mainnetとの相互運用を保証するものではない。

E2Eで使用する外部ホスト、REST接続先、秘密鍵、ネットワーク状態は、ユニット試験の前提に含めない。

## 13. 未決定事項・要確認事項

次の事項は仕様として未確定である。

1. `3000`、`3001`、`/ws`、UID handshake、subscribe / unsubscribe JSON、9チャネルの対象Gatewayにおける正式な規範性。
2. 対象GatewayおよびSymbolプロトコルのバージョン、Mainnet / Testnetごとの互換性。
3. UIDの正式な長さ、文字種、寿命、再接続時の意味、真正性。
4. subscribe / unsubscribe acknowledgement、Gateway側の購読状態保持、通知の再送・欠落の扱い。
5. 通知payloadの完全なruntime schemaと、公開TypeScript型との対応。
6. Symbolアドレスのchecksum・network検証をこのパッケージの責務とするか。
7. TLS必須性、証明書・プロキシ設定、信頼できないhostを入力する用途の有無。
8. `connection` および `unknown` エラーの発生条件。
9. `maxReconnectAttempts` の上流での意味、および最大回数到達時の通知契約。
10. E2EのREST URLを独立設定するか、WebSocketのhostとSSL設定から生成するか。
11. `test:coverage` にE2Eを含めるかどうか。

これらを確定するまで、追加の認証、暗号方式、サイズ上限、再試行方式、互換層、runtime validatorを本仕様へ追加しない。
