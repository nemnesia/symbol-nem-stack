# Symbol Event Stream 仕様書

## 1. 文書の位置付け

本仕様書は、`@nemnesia/symbol-event-stream` v1.0.0 の現行コード、公開README、CHANGELOG、型定義およびテストから確認できる実装契約を記述する。

対象パッケージ内には、承認済みのコンセプトシート、要件定義書、既存仕様書、対応する仕様レビュー結果および実装者フィードバックが存在しない。そのため、本仕様書はSymbolプロトコルの規範仕様ではなく、次の実装と依存パッケージの公開契約に基づく。

- `@nemnesia/symbol-event-stream` の実装契約
- `@nemnesia/symbol-websocket` が公開する接続・購読・通知型契約
- リポジトリ内のREADME、CHANGELOGおよびテストで確認できる利用契約

Symbol Gatewayの対象ネットワーク、通知スキーマの対象バージョン、通知の配信保証およびネットワーク整合性は、本仕様書では確定しない。

## 2. 概要

### 2.1 目的

`SymbolEventStream` は、複数のSymbol WebSocket Gateway接続から受信した通知を、購読単位で重複排除してTypeScriptアプリケーションへ配信する。

接続の切断や再接続が発生した場合は、利用可能な候補ノードへの切り替えと購読の復元を試みる。利用者は、通知購読、接続状態、接続エラーおよびノード切り替え後の状態を公開APIから扱う。

### 2.2 対象範囲

- Symbol WebSocket Gatewayへの複数接続
- NodeWatch endpoint URLの入力検証とWebSocket接続先への変換
- Symbol通知チャネルの購読・解除
- TypeScriptのチャネル別通知型
- 購読単位の通知重複排除
- 接続・切断・再接続・fatalエラー時のノード切り替え
- NodeProviderによる接続候補の補充
- 接続状態、UIDおよびblacklist状態の取得
- 明示的な終了とリソース解放

### 2.3 対象外

- トランザクションの作成、署名、暗号化、アナウンスおよび秘密情報管理
- Symbolネットワークの自動選択またはMainnet/Testnetの自動判定
- NodeProviderが返すノードのチェーン・ネットワーク一致性の検証
- 通知の署名、真正性、業務上の意味または完全性の検証
- 通知の永続化、履歴取得、リプレイ、欠落・重複・遅延の補償
- REST APIを用いたイベント履歴の照合
- NEMのWebSocketまたはSTOMP接続
- Gatewayの可用性、通知生成、通知配信の保証

## 3. 用語

| 用語 | 定義 |
| --- | --- |
| EventStream | `SymbolEventStream` のインスタンス。複数の `SymbolWebSocket` を統合する。 |
| NodeWatch endpoint | `http://` または `https://` のroot endpoint URL。EventStreamの入力候補となる。 |
| WebSocket接続 | NodeWatch endpointをhostとSSL設定へ変換して生成する `SymbolWebSocket` インスタンス。 |
| 購読キー | アドレスなしではチャネル名、アドレスありではチャネル名とアドレスを結合した内部識別子。 |
| 通知ID | 通知の重複排除に利用する文字列。通常は `meta.hash`、`hash` または `uid`、cosignatureでは3フィールドの組み合わせである。 |
| blacklist | ノード切り替え成功後、指定時間だけ候補から除外するノード集合。 |
| NodeProvider | 候補が不足したときに追加のendpoint URL配列を返す利用者callback。 |
| Gateway UID | WebSocket接続の最初の通知で受信する接続識別子。 |

## 4. 公開API

### 4.1 エントリポイントの公開物

パッケージエントリポイントは、次を公開する。

- `SymbolEventStream` クラス
- `NodeConnectionStatus` 型
- `NodeProvider` 型
- `SymbolEventStreamOptions` 型

通知callbackの型は、`SymbolEventStream` のジェネリックなメソッドシグネチャを通じてチャネル別に適用される。`EventCallback`、`ErrorCallback`、`ConnectCallback`、`DisconnectCallback` および `AddressableSymbolChannel` はパッケージエントリポイントから直接exportされない。

### 4.2 `SymbolEventStream` の公開メソッド

| メソッド | 動作 |
| --- | --- |
| `on(channel, callback)` | アドレスなしのチャネル購読を追加する。 |
| `on(channel, address, callback)` | アドレス付きのチャネル購読を追加する。アドレス指定可能なチャネルだけで利用できる。 |
| `off(channel, callback?)` | アドレスなし購読について、指定callbackまたは全callbackを解除する。 |
| `off(channel, address, callback?)` | アドレス付き購読について、指定callbackまたは全callbackを解除する。 |
| `onError(callback)` | 下位 `SymbolWebSocket` から受け取ったエラーを転送するcallbackを追加する。 |
| `onConnect(callback)` | ノードURLとGateway UIDを受け取る接続callbackを追加する。 |
| `onDisconnect(callback)` | 切断ノードのURLを受け取る切断callbackを追加する。 |
| `close()` | 全接続、購読、callback、タイマーおよび内部状態を破棄する。冪等である。 |
| `getActiveConnectionCount()` | EventStreamが管理しているWebSocket数を返す。OPEN状態の数ではない。 |
| `getIsClosed()` | `close()` 実行後かどうかを返す。 |
| `isConnected()` | 管理中のいずれかのWebSocketがOPEN状態なら `true` を返す。 |
| `getConnectedNodes()` | OPEN状態のノードの入力endpoint URL配列を返す。 |
| `getConnectionStatus()` | 管理中の全ノードについてURL、OPEN状態およびUIDを返す。 |
| `getBlacklistedNodes()` | blacklist中の入力endpoint URL配列を返す。 |

各callback登録メソッドは解除関数を返さない。callbackの登録・解除は同期的に行われる。

### 4.3 `NodeConnectionStatus`

`getConnectionStatus()` の各要素は次の形を持つ。

```ts
interface NodeConnectionStatus {
  nodeUrl: string;
  connected: boolean;
  uid: string | null;
}
```

- `nodeUrl` はEventStreamが管理する入力endpoint URLである。
- `connected` は下位 `SymbolWebSocket.isConnected` の値であり、Gateway UID受信済みかどうかとは独立している。
- `uid` はGateway UID受信前または切断中に `null` である。

### 4.4 `NodeProvider`

```ts
type NodeProvider = () => Promise<string[]>;
```

ProviderはEventStreamに直接依存するpickerではなく、利用者が候補取得条件を束縛するcallbackである。

## 5. 入力データモデルと制約

### 5.1 `SymbolEventStreamOptions`

```ts
interface SymbolEventStreamOptions {
  nodewatchUrls: string[];
  nodeProvider?: NodeProvider;
  connections: number;
  maxCacheSize?: number;
  cacheTtl?: number;
  maxReconnectBeforeSwitching?: number;
  blacklistTtl?: number;
}
```

| 項目 | 必須 | 既定値 | 制約 |
| --- | --- | --- | --- |
| `nodewatchUrls` | MUST | なし | 1件以上のendpoint URLを指定する。 |
| `nodeProvider` | MAY | なし | `Promise<string[]>` を返すcallback。 |
| `connections` | MUST | なし | 1以上の安全な整数。 |
| `maxCacheSize` | MAY | `10000` | 1以上の安全な整数。 |
| `cacheTtl` | MAY | `60000` ms | 正の有限数。 |
| `maxReconnectBeforeSwitching` | MAY | `5` | 1以上の安全な整数。 |
| `blacklistTtl` | MAY | `300000` ms | 正の有限数。 |

### 5.2 NodeWatch endpoint URL

各 `nodewatchUrls` 要素は、次の条件をすべて満たさなければならない。

- 絶対URLである。
- schemeは `http:` または `https:` である。
- usernameとpasswordを含まない。
- root endpointであり、pathは `/` だけである。
- queryとfragmentを含まない。
- `http:` の明示ポートは `3000`、`https:` の明示ポートは `3001` である。ポート省略は許可され、schemeに応じた標準ポートとして扱う。

URLが条件を満たさない場合、コンストラクタは `TypeError` を送出し、接続生成を開始しない。

EventStreamはendpointを次の情報へ変換して `SymbolWebSocket` を生成する。

| endpoint scheme | WebSocket接続先 | `ssl` |
| --- | --- | --- |
| `http` | `ws://{host}:3000/ws` | `false` |
| `https` | `wss://{host}:3001/ws` | `true` |

入力URLのネットワーク、チェーン、ノード実体およびGateway互換性は検証しない。

## 6. 通知データモデル

### 6.1 通知エンベロープ

購読callbackには、下位 `SymbolWebSocket` が受信した通知エンベロープを渡す。通知エンベロープは `topic` と `data` を持つ。

EventStreamは通知のJSON解析、topicの再解釈またはpayloadの実行時スキーマ変換を行わない。通知の解析とチャネル振り分けは依存する `SymbolWebSocket` の責任である。

### 6.2 対応チャネル

| チャネル | `data` 型の概要 | アドレス指定 |
| --- | --- | --- |
| `block` | ブロック情報と `meta.hash`、`meta.generationHash` | 不可 |
| `finalizedBlock` | finalization epoch、point、height、hash | 不可 |
| `confirmedAdded` | transactionとmeta情報 | 可 |
| `unconfirmedAdded` | transactionとmeta情報 | 可 |
| `unconfirmedRemoved` | `meta.hash` | 可 |
| `partialAdded` | transactionとmeta情報 | 可 |
| `partialRemoved` | `meta.hash` | 可 |
| `cosignature` | version、signerPublicKey、signature、parentHash | 可 |
| `status` | hash、code、deadline | 可 |

`transaction` の具体的な型は依存パッケージの公開型で `unknown` とされており、EventStreamは内容を検証しない。

### 6.3 アドレス付き購読

アドレス指定可能なチャネルの購読パスは、下位パッケージの定義に従い、次の形式で生成される。

```text
{channel}/{address}
```

`block` と `finalizedBlock` にアドレスを指定した場合、下位 `SymbolWebSocket` が `TypeError` を送出する。アドレスの形式検証も下位 `SymbolWebSocket` に委譲され、空文字、Symbol encoded addressまたは16文字の16進数namespace IDが受け付けられる。

## 7. 初期化と接続管理

### 7.1 初期化順序

コンストラクタは次の順序で処理する。

1. `nodewatchUrls`、URL、数値オプションを検証する。
2. 候補URLから、`connections` 件を上限としてランダムに候補を選択する。
3. 選択した各候補に `SymbolWebSocket({ host, ssl, autoReconnect: true })` を生成する。
4. 全接続生成後に重複排除のクリーンアップタイマーを開始する。
5. blacklistクリーンアップタイマーを `blacklistTtl / 2` 間隔で開始する。

接続生成はコンストラクタ中に開始される。接続完了を待つPromiseは返さない。

候補数が `connections` 未満の場合、候補数まで接続する。候補の選択順序や乱数分布は公開契約ではない。

### 7.2 初期化失敗

接続生成または初期化中に例外が発生した場合、コンストラクタは次を行った後、元の例外を再送出する。

- EventStreamを終了状態にする。
- 開始済みタイマーを停止する。
- 重複排除キャッシュを破棄する。
- 購読状態、コールバック、接続管理状態およびblacklistを破棄する。
- 既に生成したWebSocketを閉じる。

初期化時のcleanupで発生したWebSocket close例外は、初期化時の元例外を隠さないため無視する。

### 7.3 接続数

- `getActiveConnectionCount()` は管理中のWebSocket配列の要素数を返す。
- `isConnected()` は管理中のWebSocketのうち少なくとも1つがOPENなら `true` を返す。
- 初期候補選択およびノード切り替え時の候補選択はランダムである。

## 8. 購読ライフサイクル

### 8.1 購読登録

購読キーは次のように扱う。

- アドレスなし: `{channel}`
- アドレスあり: `{channel}:{address}`

同一購読キーに複数callbackを登録できる。callbackはSetで保持されるため、同一関数オブジェクトを同じキーへ複数回登録しても1回だけ保持する。

購読キーに対する最初のcallback登録時だけ、管理中の全WebSocketへ下位購読を登録する。同じキーへ後からcallbackを追加しても、下位WebSocket購読は追加作成しない。

### 8.2 購読登録の失敗

複数WebSocketへの購読登録中に例外が発生した場合、登録を試みたWebSocketの購読を解除し、EventStream内部へ購読キーとcallbackを保存せず、元の例外を再送出する。

ロールバック中の解除例外は、元の購読登録例外を維持するため無視する。

### 8.3 購読解除

- callbackを指定した場合、そのcallbackだけを購読キーから削除する。
- callbackが残っている場合、下位WebSocketの購読は解除しない。
- 最後のcallbackが削除された場合、またはcallbackを省略した場合、購読キーを削除し、全WebSocketから下位購読を解除する。
- 未登録の購読キーを解除しても何もしない。

### 8.4 ノード切り替え時の購読復元

EventStreamが保持する全購読キーを、新たに生成したWebSocketへ登録する。復元途中で失敗した場合は、部分的に登録した購読を解除し、新WebSocketを閉じ、旧接続を管理対象として維持する。

復元失敗時は旧ノードをblacklistへ登録せず、復元処理の例外を `onError` へ転送しない。

## 9. 通知配信と重複排除

### 9.1 ID抽出

通知のpayloadは、通知オブジェクトに `data` プロパティが存在する場合は `data` の値、存在しない場合は通知オブジェクト自身として扱う。

`cosignature` 以外の通知では、次の順で文字列IDを抽出する。

1. `data.meta.hash`
2. `data.hash`
3. `data.uid`

`cosignature` では、`parentHash`、`signerPublicKey`、`signature` のすべてが文字列の場合、3値のJSON配列表現をIDとして使用する。3値が揃わない場合は通常の `meta.hash`、`hash`、`uid` の抽出へ進む。

文字列でない値はIDとして扱わない。IDが存在しない、または空文字列の場合、重複排除せず受信ごとにcallbackへ渡す。

### 9.2 重複排除キー

重複排除キーは次の連結で構成する。

```text
購読キー + U+0000 + 通知ID
```

したがって、同じIDでも次の単位が異なれば別通知として扱う。

- チャネル
- アドレス付き購読のアドレス

### 9.3 TTL

同じ重複排除キーが登録されており、現在時刻と登録時刻の差が `cacheTtl` 未満の場合、通知は重複として破棄する。それ以外の場合は新規通知としてcallbackへ渡し、登録時刻を現在時刻へ更新する。

TTLは正の有限数で、既定値は `60000` msである。判定は厳密な「未満」であり、差がちょうど `cacheTtl` の場合は重複として扱わない。

### 9.4 キャッシュ容量

`maxCacheSize` は重複排除エントリの最大数で、既定値は `10000` である。

新しいエントリの追加によって容量を超えた場合、登録timestampが古い順に削除し、最大数以内に戻す。同一timestampの場合の削除順序は仕様上定義しない。

重複排除キャッシュの期限切れエントリは、`min(cacheTtl / 2, 60000)` ms間隔のタイマーで削除する。期限切れ判定は `現在時刻 - 登録時刻 > cacheTtl` である。

### 9.5 配信callbackの例外

同じ購読キーのcallbackは、通知開始時点のcallback集合を基準に個別実行する。あるcallbackが例外を送出しても、他のcallbackの実行を中断しない。callback例外はEventStreamの内部で `console.error` に出力する。

## 10. 再接続とノード切り替え

### 10.1 切り替え開始条件

管理中WebSocketについて、次のいずれかが成立した場合、代替ノードへの切り替えを試みる。

- 下位WebSocketの再接続試行回数が `maxReconnectBeforeSwitching` 以上になった。
- 下位WebSocketから `severity: 'fatal'` のエラーを受け取った。
- `onClose` 後、同じ処理ターン内に再接続callbackが発生せず、terminal closeと判定された。

`maxReconnectBeforeSwitching` の既定値は `5` である。

通常の切断で `onClose` に続いて同じ処理ターン内に再接続callbackが発生した場合、即時にノード切り替えを開始しない。

### 10.2 利用可能候補

切り替え候補は、次の条件を満たす候補から選択する。

- 現在管理中の接続で使用されていない。
- blacklistに登録されていない。
- endpoint URLとして検証に合格している。

代替候補がない場合、固定候補だけで動作しているときは切り替えず、現在の下位WebSocketの自動再接続に委ねる。代替候補がなくても旧ノードをblacklistへ登録しない。

### 10.3 切り替え処理

候補がある場合、次の順序で処理する。

1. 候補から1件をランダムに選ぶ。
2. 新しい `SymbolWebSocket` を生成する。
3. EventStreamが保持する全購読を新しいWebSocketへ復元する。
4. 購読復元が完了した後、旧WebSocketを閉じる。
5. 旧ノードをblacklistへ登録する。
6. 旧WebSocketを管理対象から除去する。

新しいWebSocketの生成または購読復元に失敗した場合、次を行う。

- 新しいWebSocketが生成済みなら閉じる。
- 新しいWebSocketを管理対象から除去する。
- 旧WebSocketを管理対象として維持する。
- 旧ノードをblacklistへ登録しない。
- 失敗を `onError` へ転送しない。

切り替え処理は、新しいWebSocketがGateway UIDを受信して接続完了callbackを発火するまで待たない。新接続の生成と購読登録要求が完了した時点で旧接続を切り替える。

### 10.4 blacklist

切り替えに成功した旧ノードは、入力endpoint URLをキーとしてblacklistへ登録する。blacklistの有効期間は `blacklistTtl` で、既定値は `300000` msである。

blacklistエントリは `blacklistTtl / 2` ms間隔のタイマーで確認し、登録時刻との差が `blacklistTtl` を超えたエントリを削除する。TTLと同値の時点では削除しない。

`getBlacklistedNodes()` は、有効なblacklistキーを入力endpoint URL配列として返す。

### 10.5 NodeProviderによる候補補充

候補枯渇時に `nodeProvider` が指定されている場合、EventStreamはProviderを呼び出して候補を補充する。

- 同時に複数の接続が候補補充を要求しても、進行中のProvider呼出しを共有する。
- Providerがrejectした場合、候補を追加せず、既存接続を維持する。
- Providerの結果が配列でない場合、候補を追加しない。
- 配列要素が文字列でない場合、その要素を無視する。
- endpoint検証に失敗した候補を無視する。
- 既知候補、使用中候補、blacklist中候補および正規化キーが重複する候補を無視する。
- 有効候補を追加できた場合、候補枯渇による切り替えを1回再試行する。
- Provider結果の処理中に `close()` が呼ばれた場合、解決後に新接続を作成しない。

Provider自身の再試行、呼び出し間隔、チェーン・ネットワーク一致性およびProvider失敗の `onError` 通知は本仕様で定義しない。現行実装ではProvider失敗を `onError` へ転送しない。

## 11. 接続・切断・エラー通知

### 11.1 接続callback

`onConnect(callback)` に登録したcallbackは、次の引数を受け取る。

```ts
(nodeUrl: string, uid: string) => void
```

- 初回接続と下位WebSocketの自動再接続成功時に呼び出す。
- `onConnect` 登録時に、すでにOPENかつUID受信済みの管理接続がある場合は、その接続ごとに直ちに呼び出す。
- callback例外は他の接続callbackおよびEventStream処理を中断しない。

### 11.2 切断callback

`onDisconnect(callback)` に登録したcallbackは、次の引数を受け取る。

```ts
(nodeUrl: string) => void
```

予期しない切断およびノード切り替えのための旧接続終了時に呼び出す。`close()` による明示的な終了時は、callback集合が破棄されるため利用者の切断callbackを呼び出さない。

### 11.3 エラーcallback

`onError(callback)` は、下位 `SymbolWebSocket` の `SymbolWebSocketError` をそのまま転送する。

エラー型の主要な項目は次のとおりである。

```ts
interface SymbolWebSocketError {
  type: 'connection' | 'timeout' | 'parse' | 'network' | 'unknown';
  severity: 'fatal' | 'recoverable';
  host: string;
  reconnecting: boolean;
  reconnectAttempts: number;
  originalError: Error | WebSocket.ErrorEvent;
  timestamp: number;
  message: string;
}
```

`severity: 'fatal'` のエラーはノード切り替えの契機になる。`recoverable` のエラーはEventStream自身がノード切り替えを開始せず、下位WebSocketの自動再接続に委ねる。

EventStream callbackの例外は、他のcallbackの実行を中断しない。EventStreamはcallback例外を別の `onError` callbackへ変換しない。

## 12. 終了とライフサイクル

### 12.1 `close()`

`close()` は次を行う。

- 終了フラグを設定する。
- blacklistクリーンアップタイマーを停止する。
- 重複排除タイマーとキャッシュを破棄する。
- 管理中の全WebSocketを閉じる。
- 管理中WebSocket、購読、接続・切断・エラーcallbackおよびblacklistを破棄する。
- Providerの進行状態を解放する。

`close()` は複数回呼び出しても追加処理を行わない。終了後、接続、ノード切り替え、購読復元およびProvider解決後の接続作成は再開しない。再利用する場合は新しい `SymbolEventStream` を生成する。

### 12.2 終了後の公開メソッド

`getIsClosed()`、`getActiveConnectionCount()`、`isConnected()`、`getConnectedNodes()`、`getConnectionStatus()` および `getBlacklistedNodes()` は、破棄後の状態を返す。

終了後に `on()` または `off()` を呼び出した場合の利用者向け契約は、現行実装で明示されていないため要確認とする。現行コードでは `on()` が内部購読状態へcallbackを追加する可能性があるが、接続は再開しない。

## 13. エラー仕様

### 13.1 入力エラー

| 条件 | エラー |
| --- | --- |
| `nodewatchUrls` が空 | `Error` |
| endpointが絶対 `http(s)` root URLでない | `TypeError` |
| endpointが認証情報、非標準ポート、path、queryまたはfragmentを含む | `TypeError` |
| `connections` が正の安全整数でない | `Error` |
| `maxCacheSize` が正の安全整数でない | `Error` |
| `cacheTtl` が正の有限数でない | `Error` |
| `maxReconnectBeforeSwitching` が正の安全整数でない | `Error` |
| `blacklistTtl` が正の有限数でない | `Error` |

### 13.2 購読エラー

購読登録または購読復元が下位WebSocketで同期的に失敗した場合、登録済み部分を解除して元の例外を扱う。部分復元失敗は旧接続を維持するノード切り替え失敗として処理する。

### 13.3 下位WebSocketエラー

JSON解析、接続、ネットワークおよびtimeoutのエラー分類は下位 `SymbolWebSocket` の契約に従う。EventStreamはエラーを再分類しない。

### 13.4 Providerエラー

Providerのreject、不正な戻り値および不正候補は、既存接続を維持し、候補を追加せず、EventStreamの `onError` へ転送しない。

## 14. セキュリティと責任境界

- EventStreamは秘密鍵、ニーモニック、パスワード、署名対象データを扱わない。
- EventStreamは認証、署名検証、暗号化、通知の真正性検証を行わない。
- `http` endpointでは平文WebSocket、`https` endpointではTLS WebSocketを下位WebSocketへ指定するが、証明書、CA、プロキシおよび信頼設定の詳細は本仕様の対象外である。
- endpointのuserinfo、path、queryおよびfragmentは受け付けない。
- NodeProviderが返す候補のチェーン・ネットワーク一致性と、候補が正しいGatewayであることの確認は利用者の責任である。
- 通知の欠落、重複、遅延、偽装および内容の不正利用をEventStreamが補償または防止するとは限らない。

## 15. 互換性

- 実行環境の最低Node.jsバージョンは20である。
- 公開依存は `@nemnesia/symbol-websocket: ^1.0.0` である。
- 通知チャネル名、通知型および下位WebSocketのエラー契約は依存パッケージの公開契約に依存する。
- Symbolプロトコル、Gatewayおよび通知スキーマの対象バージョンは未確認であり、パッケージSemVerから推定しない。

## 16. 検証項目

現行テストで確認されている主な動作は次のとおりである。これらは実装の検証範囲であり、外部Gatewayとの適合性を保証するものではない。

- endpoint URL、接続数および数値オプションの入力検証
- 初期接続数、標準ポート省略および `autoReconnect` 設定
- 購読登録、複数callback、個別解除、全解除および部分登録ロールバック
- 9チャネルの型付き購読とアドレス指定制約
- `meta.hash`、`hash`、`uid` およびcosignature複合IDの重複排除
- 購読キー単位、TTLおよびcache sizeによる重複排除
- callback例外の隔離
- 接続・切断・エラーcallbackと接続状態取得
- fatalエラー、再接続回数閾値、terminal closeによるノード切り替え
- 購読復元失敗時のロールバックと旧接続維持
- blacklistのTTLクリーンアップ
- NodeProviderの候補補充、single-flight、不正候補除外、Provider失敗およびclose競合
- `close()` の冪等性とタイマー停止

## 17. 未決定・要確認事項

次の事項は、現行コードから一意に確定できないため、仕様本文の規範要件とはしない。

| ID | 事項 | 影響 |
| --- | --- | --- |
| U-001 | Mainnet/Testnet、対象ネットワークの固定および複数ネットワーク候補の混在可否 | 利用者が渡す候補の適合条件が定まらない。 |
| U-002 | Symbolプロトコル、Gateway、通知スキーマの対象バージョン | 通知型と実Gatewayの相互運用性を判定できない。 |
| U-003 | 公開型から導出される通知データが、実Gatewayの全チャネル通知と一致するか | 実通知の配信または重複排除が想定どおりにならない可能性がある。 |
| U-004 | チャネル別の通知IDの規範性と、ID抽出優先順位の妥当性 | 誤重複排除または重複排除漏れの可能性がある。 |
| U-005 | EventStream独自の通知payload・topic実行時検証の要否 | 不正または型不一致の通知をどの層で拒否するか定まらない。 |
| U-006 | NodeProvider候補のチェーン・ネットワーク一致性を確認する責任主体 | 異なるネットワークへの接続を防ぐ主体が定まらない。 |
| U-007 | ノード切り替えの完了条件を、購読要求登録とするか、Gateway UID受信・OPEN確認まで待つか | 切り替え中の接続喪失リスクとcallback順序に影響する。 |
| U-008 | 切り替え、購読復元およびProvider失敗を利用者へ別エラーとして通知するか | 運用側が復旧判断に利用できる情報が定まらない。 |
| U-009 | blacklistのノード同一性をURL文字列単位またはscheme・host等の正規化単位で扱う範囲 | URL表記差が候補重複や再利用判定へ影響する。 |
| U-010 | `close()` 後に `on()`、`off()`、callback登録APIを呼んだ場合の公開契約 | 終了後の利用者操作の扱いが定まらない。 |
| U-011 | `getConnectedNodes()` の返却値をendpoint URLとする現在実装と、JSDoc上のhost/IP説明の不一致 | 利用者が返却値を識別子として利用する際の解釈が分かれる。 |
| U-012 | 実Gatewayまたは公式fixtureを使ったチャネル別適合試験の対象ネットワーク・ノードバージョン | モックテストだけでは実wire形式との一致を保証できない。 |

## 18. 参照資料

### 18.1 対象パッケージ

- `packages/symbol-event-stream/src/SymbolEventStream.ts`
- `packages/symbol-event-stream/src/EventDeduplicator.ts`
- `packages/symbol-event-stream/src/SubscriptionRegistry.ts`
- `packages/symbol-event-stream/src/SymbolEventStreamTypes.ts`
- `packages/symbol-event-stream/src/index.ts`
- `packages/symbol-event-stream/README.md`
- `packages/symbol-event-stream/CHANGELOG.md`
- `packages/symbol-event-stream/package.json`
- `packages/symbol-event-stream/test/SymbolEventStream.test.ts`
- `packages/symbol-event-stream/test/SymbolEventStream.types.test.ts`

### 18.2 依存パッケージの契約

- `packages/symbol-websocket/src/SymbolWebSocket.ts`
- `packages/symbol-websocket/src/symbol.types.ts`
- `packages/symbol-websocket/src/symbolChannelPaths.ts`
- `packages/symbol-websocket/src/symbolNotifications.types.ts`
