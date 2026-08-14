# Symbol Event Stream 仕様書

## 1. 文書の位置付けと根拠

本仕様書は、@nemnesia/symbol-event-stream の実装可能な設計を定める。規範仕様の根拠は、次の順序で扱う。

1. packages/symbol-event-stream/docs/requirements/requirements.md の要件と受け入れ条件
2. packages/symbol-event-stream/docs/consept/concept-sheet.md の目的、v1スコープおよび責任境界
3. 本仕様書で要件を実装可能にするために明示した設計決定
4. AGENTS.md および確認済みの依存パッケージ契約

既存仕様書およびREADMEは移行対象・公開説明の確認に限って参照し、規範根拠にはしない。実装コードとテストは本仕様書の根拠資料および補助資料に含めない。

本仕様書はSymbolプロトコル、Gateway、NodeWatchまたはProviderの適合性を保証するプロトコル仕様ではない。Providerが提供する候補、Gateway通信契約および通知形式をEvent Streamが利用するためのアプリケーション設計を定める。

## 2. 目的と適用範囲

### 2.1 目的

Event Streamは、複数のSymbol WebSocket Gateway接続からの通知を、利用者アプリケーションから一つの論理的なリアルタイム監視として扱えるようにする。監視対象の継続、通知レベルの重複抑制、異常接続の扱い、接続状態と監視状態の観測、および明示的な終了後の継続処理停止を対象とする。

「一つの監視」は、複数接続を一つの論理的な監視状態として統合することを意味する。完全配信、通知順序、通知の真正性・完全性、欠落補償または業務処理の一度だけの実行を意味しない。

### 2.2 対象

- Symbol WebSocket Gatewayから、利用者が選択した監視対象に対応する通知を受信すること
- 複数のGateway接続を一つの論理的な監視へ統合すること
- 同一監視の範囲で、同一イベントとして識別できる通知の通知レベル重複を抑制すること
- 初回接続時の状態差を許容し、初回受入れ後のブロック進行差を監視すること
- 遅延・異常接続の一時除外、Provider候補による補充、要件に従った接続再利用を行うこと
- 異常処理後の接続状態および監視状態を利用者が確認できること
- 明示的な監視終了後に、接続、購読およびその他の監視継続処理を停止すること

### 2.3 対象外

- NEMチェーンおよびSymbol WebSocket Gateway以外の通知方式
- Mainnet、Testnetその他のネットワークの選択、切替または自動判定
- Gateway接続候補のチェーン、ネットワーク、プロトコルまたはGateway適合性の保証・自動検証
- トランザクションの作成、署名、暗号化、アナウンスおよび秘密情報管理
- 通知の署名検証、真正性、完全性、業務上の正当性、完全配信、順序または欠落補償
- 通知履歴の永続化、履歴取得、リプレイ、外部履歴サービスによる欠落補完
- 短時間フォークの発生有無または正当性の判定

## 3. 用語と責任境界

| 用語 | 定義 |
| --- | --- |
| 監視対象 | 利用者が選択した、ProviderのSymbol WebSocket Gateway契約上の購読対象範囲。 |
| 通知 | 監視対象に関して、Providerが提供するSymbol WebSocket Gateway契約から届くイベント情報。 |
| Gateway接続候補 | Providerが提供し、利用者がEvent Streamへ渡す未接続の接続先候補。候補であることは接続成立または健全性を意味しない。 |
| 成立済み接続 | Event Streamと一つのGatewayとの接続が、下位Gateway接続契約上成立した状態。初回接続に失敗した候補は成立済み接続ではない。 |
| 初回受入れ | 成立済み接続を他接続との状態差にかかわらず監視へ利用し始める段階。初回受入れ後は通常の遅延・異常判定を適用する。 |
| 健全な接続 | 本仕様で定める異常条件に該当せず、監視の継続に利用できる成立済み接続。 |
| ブラックリスト | 一時的に監視から除外された接続または候補を、除外原因と関連付けて管理する状態。 |
| 同一イベント | 同じ監視対象について、Provider契約上同じイベントと判断できる通知。具体的な識別は10章で定める。 |
| 監視終了 | 利用者が明示的にEvent Streamの監視を終了させる操作。終了後は同一インスタンスで再開しない。 |

| 主体 | 責任 |
| --- | --- |
| 開発者・利用者アプリケーション | 監視対象と候補を準備し、Event Streamを開始・終了する。通知を業務処理へ渡す。 |
| 運用者 | 接続状態と監視状態を確認し、継続・停止・復旧を判断する。 |
| 利用者アプリケーション | 通知の必要な真正性・完全性確認、保存、欠落時の照合および復旧を行う。 |
| Provider | NodeWatch情報等を利用してGateway接続候補を提供する。候補の具体的な契約はProviderに従う。 |
| Gateway・ネットワーク | 通知の生成、接続サービスおよび配信を提供する。 |
| Event Stream | 複数接続の統合、監視対象の購読、通知レベルの重複抑制、接続・監視状態の観測、異常接続処理および終了を担う。 |

同じ監視へ渡す候補は、同じSymbolネットワーク、互換性のあるGateway通信・通知契約、および同じ監視対象を共有することを前提とする。この確認と候補の準備は利用者の責任であり、Event Streamはその前提を自動検証または保証しない。

## 4. 設計原則

- 複数接続で監視を継続するが、完全配信または一度だけの業務処理を保証しない。
- 初回受入れと通常監視を分離し、初回の状態差だけで成立済み接続を除外しない。
- 遅延判定はブロック進行差だけで行い、短時間フォークの正当性を判断しない。
- Provider候補の提供とEvent Streamの監視処理を分離し、候補の適合性をEvent Streamの保証に含めない。
- 監視状態の公開は異常対処後の最終状態を主とし、ブラックリスト移動や候補補充などの途中経過を個別通知しない。
- 高さなどの整数文字列表現は正確な整数として比較し、浮動小数を使用しない。

## 5. 監視モデルと状態

### 5.1 監視状態

一つのEvent Streamインスタンスは一つの監視を表す。監視は、監視対象、候補集合、成立済み接続集合、ブラックリスト、同一イベント識別状態および監視状態を持つ。

| 状態 | 意味 |
| --- | --- |
| active | 1つ以上の健全な接続を利用して監視対象を扱っている。 |
| degraded | 健全な接続は残るが、候補不足または一部接続の異常により指定接続数を満たしていない。 |
| stopped | 健全な接続がすべてなくなり、監視を停止した。監視上の異常として観測できる。 |
| closed | 利用者が明示的に監視を終了した。 |

stoppedは接続健全性の喪失、closedは利用者の終了操作を表し、混同してはならない。

### 5.2 接続状態

接続は少なくとも次を区別する。

- candidate: 未接続の候補
- connecting: 接続処理中
- accepted: 初回受入れ済みで監視に利用中
- excluded: 原因付きで一時除外中
- closed: 終了済みまたは監視から破棄済み

遅延、初回接続失敗、タイムアウト切断は同じexcludedにまとめず、除外原因として区別する。

## 6. 入力と公開データモデル

### 6.1 公開APIの設計方針

既存パッケージの公開名（SymbolEventStream、SymbolEventStreamOptions、NodeProvider、NodeConnectionStatus、on、off、close等）は、公開パッケージの利用契約との整合性を保つ設計基準として維持する。これはリポジトリ固有の設計判断であり、Symbolプロトコルの規範ではない。

既存APIだけではFR-006の監視状態・健全性・異常原因を十分に観測できないため、次の状態取得契約を追加または同等の公開表現へ拡張する。

```typescript
type MonitoringState = 'active' | 'degraded' | 'stopped' | 'closed';

type ConnectionExclusionReason =
  | 'block-progress-lag'
  | 'initial-connection-failure'
  | 'timeout-disconnect';

interface NodeConnectionStatus {
  nodeUrl: string;
  state: 'candidate' | 'connecting' | 'accepted' | 'excluded' | 'closed';
  healthy: boolean;
  uid: string | null;
  latestBlockProgress: string | null;
  exclusionReason: ConnectionExclusionReason | null;
}

interface MonitoringStatus {
  state: MonitoringState;
  healthyConnectionCount: number;
  anomaly: 'candidate-shortage' | 'all-connections-unhealthy' | null;
}
```

latestBlockProgressはProviderのブロック通知から得た正確な整数文字列表現で、存在しない場合はnullとする。anomalyは異常対処後に残る監視上の状態を表し、候補追加のイベントログではない。

### 6.2 Event Streamの操作

| 操作 | 規範動作 |
| --- | --- |
| 監視開始 | 利用者が監視対象とGateway接続候補を指定してインスタンスを初期化する。 |
| on | 監視対象に対応する通知購読と利用者callbackを追加する。接続交換後も同じ監視へ復元する。 |
| off | 指定した通知購読またはcallbackを解除する。監視終了とは異なる。 |
| getConnectionStatus | 接続中、受入れ済み、除外中の状態を原因付きで取得する。 |
| getMonitoringStatus | 異常対処後の監視状態、健全な接続数および監視上の異常を取得する。 |
| onError / onConnect / onDisconnect | 下位接続の状態変化または接続エラーを通知する。最終的な監視状態はgetMonitoringStatusで確認する。 |
| close | 監視を終了し、継続処理を停止する。同一インスタンスで再開しない。 |

getActiveConnectionCount、isConnected、getConnectedNodes、getBlacklistedNodesなどの既存操作は、状態モデルと矛盾しない範囲で互換性のために提供してよい。これらだけをFR-006の監視状態の代替にしてはならない。

### 6.3 初期化入力

リポジトリ固有の公開設計として、監視開始時の入力は次の形を基準とする。

```typescript
interface SymbolEventStreamOptions {
  nodewatchUrls: string[];
  nodeProvider?: NodeProvider;
  connections: number;
}
```

nodewatchUrlsは1件以上の候補endpoint、connectionsは1以上の安全な整数とする。候補数がconnections未満でも、Event Streamは不足分を不健全な接続で補ってはならない。候補数、接続数およびProvider候補の適合性は利用者の責任境界に属する。

既存実装にあるmaxCacheSize、cacheTtl、maxReconnectBeforeSwitching、blacklistTtl等のオプションは、要件から定まる規範入力ではない。これらを採用する場合も、10.3の重複抑制範囲、8章の遅延判定および9章の原因別再利用条件を弱めてはならない。

### 6.4 候補供給

Provider候補の補充を実装するリポジトリ固有の公開設計として、次の型を採用する。

```typescript
type NodeProvider = () => Promise<string[]>;
```

NodeProviderはProvider実装そのものではなく、利用者が候補取得条件を束縛したcallbackである。NodeWatch情報、対象ネットワーク、候補の信頼性およびGateway適合性をEvent Streamが検証する契約ではない。

### 6.5 候補endpoint

リポジトリ固有の接続入力契約として、候補endpointは次を満たすものを受け付ける。

- 絶対URLであること
- schemeがhttpまたはhttpsであること
- username、password、query、fragmentを含まないこと
- root endpointであり、pathは/だけであること
- httpの明示ポートは3000、httpsの明示ポートは3001であること。ポート省略はschemeに対応する標準ポートとして扱う

接続先は、httpでは ws://{host}:3000/ws、httpsでは wss://{host}:3001/ws へ変換する。この構文検証は、チェーン・ネットワーク・Gateway適合性の検証ではない。

### 6.6 通知チャネル

通知チャネルと通知データ型は、@nemnesia/symbol-websocketおよびProviderのGateway契約に従う。現行の依存契約で扱うチャネルは次のとおりである。Event Streamはこの表を独自のwire仕様として再定義しない。

| チャネル | アドレス指定 | 主な意味 |
| --- | --- | --- |
| block | 不可 | ブロック生成通知。ブロック進行値を含む。 |
| finalizedBlock | 不可 | ファイナライズ通知。 |
| confirmedAdded | 可 | 承認済みトランザクション追加通知。 |
| unconfirmedAdded | 可 | 未承認トランザクション追加通知。 |
| unconfirmedRemoved | 可 | 未承認トランザクション削除通知。 |
| partialAdded | 可 | アグリゲートボンデッドトランザクション追加通知。 |
| partialRemoved | 可 | アグリゲートボンデッドトランザクション削除通知。 |
| cosignature | 可 | 連署通知。 |
| status | 可 | トランザクション状態通知。 |

Providerが提供しないイベント種別、通知方式、通知フォーマットまたはプロトコルバージョンをEvent Streamが追加・固定・自動判定してはならない。

## 7. 購読と通知処理

### 7.1 購読の適用範囲

監視対象と購読は、監視に参加するすべての成立済み接続へ適用する。接続切替、Provider候補による補充、許可された接続再利用、再接続および再購読の後も同じ監視対象を扱う。

具体的なチャネル・アドレス表現はProviderおよびsymbol-websocket契約に従う。Event Streamは通知payloadを業務データとして再解釈、永続化または補償しない。

### 7.2 通知の採用

1. Gateway接続から通知を受信する。
2. 下位Gateway契約の購読結果として、監視対象に対応する通知を扱う。
3. ブロック進行を含む通知を8章の状態更新へ反映する。
4. 10章の同一イベント判定を行う。
5. 重複でない通知だけを利用者callbackへ渡す。

Event StreamはProvider契約にない通知を合成してはならない。Gatewayから連続して届いた通知は、同一イベントと判定できる根拠がない限り別通知として扱う。

### 7.3 通知がない状態

通知がないことだけを、ブロック進行の遅延、異常または停止の根拠にしてはならない。通知がない状態で下位接続がタイムアウト切断になった場合は、timeout-disconnectとして異常処理する。

## 8. 初回受入れと遅延判定

### 8.1 初回受入れ

Gateway接続契約上成立した接続は、他接続とのブロック進行差にかかわらず初回受入れし、監視へ利用する。初回受入れ時点では状態差だけを理由に除外してはならない。

初回接続に失敗した候補は初回受入れせず、initial-connection-failureとして除外対象に関連付ける。

### 8.2 ブロック進行の観測

Event Streamは、監視に利用する接続ごとに、Gatewayから届いた最新のblock通知のブロック進行を保持する。利用者のblock購読とは独立して、遅延判定に必要な内部観測を行う。

ブロック進行を持たない接続は、その事実だけで遅延と判定しない。比較可能な最新値が得られた接続についてだけ比較する。

### 8.3 遅延判定

初回受入れ後、各接続の最新ブロック進行を比較する。最大値をHmax、対象接続の値をHnodeとすると、次を満たす接続を遅延・異常と扱う。

```text
Hmax - Hnode >= 3
```

判定はブロック進行差だけで行い、一時的な差も遅延として扱う。通知の他のフィールド、Gatewayの評判、NodeWatch情報または短時間フォークの正当性を判定材料に加えてはならない。

高さが整数文字列の場合は、任意精度または同等の正確な整数演算で比較する。浮動小数へ変換してはならない。

## 9. 異常接続、候補補充および再利用

### 9.1 除外と原因

| 原因 | 対象 | 同一監視中の再利用 |
| --- | --- | --- |
| block-progress-lag | 3ブロック以上遅れた成立済み接続 | 条件を満たす場合に限り許可 |
| initial-connection-failure | 初回接続に失敗した候補 | 禁止 |
| timeout-disconnect | タイムアウトにより切断された成立済み接続または候補 | 禁止 |

除外は対象を監視から一時的に外す処理であり、利用者へ途中経過イベントを送ることを意味しない。

### 9.2 Provider候補の優先

接続が減少した場合、利用可能なProvider候補がある限り、それをブラックリスト接続の再利用より優先して補充する。Provider候補が残っている間、ブラックリスト接続を再利用してはならない。

Provider候補の取得結果が空、利用可能候補なし、または補充に失敗した場合は、補充できない状態として扱う。補充できないことだけで、健全な接続を停止してはならない。補充失敗の再試行間隔、Providerへのエラー通知およびProvider内部の再試行は本仕様で定めない。

NodeProviderの候補endpoint構文検証と重複除外は6章の設計に従う。ただし、候補のチェーン・ネットワーク適合性検証ではない。

### 9.3 候補枯渇時の再利用

Provider候補が枯渇した場合に限り、次のすべてを満たすblock-progress-lag対象の成立済み接続を再利用候補とする。

- 再利用時点で最新ブロック進行値を持つこと
- 再利用時点の成立済み接続の最新ブロック進行最大値との差が3未満であること
- 初回接続失敗またはタイムアウト切断を原因とする除外対象ではないこと

候補が複数ある場合は、その集合からランダムに1接続を選択する。選択された接続は監視へ戻し、以後ふたたび8章の判定対象とする。

### 9.4 継続と停止

補充または再利用できなくても、1つ以上の健全な接続が残る限り、その接続だけで監視対象の扱いを継続する。この場合、監視状態は少なくともdegradedとして観測できる。

健全な接続がすべてなくなった場合、監視をstoppedへ遷移させ、監視上の異常として利用者が把握できるようにする。stoppedから自動的に監視を再開してはならない。再度監視する場合は新しいインスタンスを初期化する。指定接続数を無理に満たすこと、完全配信を維持することまたは不健全な接続を隠すことをしてはならない。

## 10. 通知レベルの重複抑制

### 10.1 適用範囲

一つの監視の開始から明示的な終了まで、同一監視対象に関する同一イベントとして識別できる通知を、接続切替、候補補充、許可された接続再利用、再接続および再購読をまたいで重複抑制する。

同じ監視対象でも同一イベントと識別できない通知は別通知として扱う。明示的終了後または新しいインスタンスとの間で重複抑制を保証しない。通知レベルの重複抑制は、業務処理の二重実行を制御または保証しない。

### 10.2 同一イベント識別

現行のProvider依存契約に対応するリポジトリ固有設計として、通知IDは次の優先順で抽出する。これはSymbolプロトコル全体の規範ではない。

| 通知 | 識別値 |
| --- | --- |
| cosignature | parentHash、signerPublicKey、signatureの3値を順序どおりに組み合わせた値。3値が揃わない場合は共通規則へ進む。 |
| その他 | data.meta.hash、data.hash、data.uidの順で、文字列値が存在する最初の値。 |

dataを持つ通知はdataを対象にし、持たない通知は通知オブジェクト自体を対象にする。文字列IDがない通知は同一性を判定できないため、受信ごとに渡す。

重複抑制キーは、監視インスタンス、購読チャネル、アドレス指定がある場合のアドレス、および通知IDから構成する。異なるチャネルまたはアドレス購読を監視対象が同じという理由だけで統合してはならない。

### 10.3 保持期間

同一監視中の重複抑制に使用した識別状態は、明示的終了まで有効でなければならない。cacheTtlや固定サイズによる早期破棄で、この範囲を短縮してはならない。内部保持方式、容量対策または永続化方式は本仕様の対象外であり、通知履歴の永続化・リプレイを提供するものではない。

## 11. 状態・エラーの公開契約

### 11.1 観測可能な状態

異常対処後、利用者は少なくとも次を確認できなければならない。

- 各接続の状態（候補、接続中、受入れ済み、除外中、終了済み）
- 各接続の健全性
- 除外原因（ブロック進行遅延、初回接続失敗、タイムアウト切断）
- 接続先識別子と、Gateway契約上利用可能な接続UID
- 監視状態、健全な接続数および全接続不健全による異常

ブラックリスト移動、候補補充、ブラックリスト接続再利用などの途中経過は、個別の通常通知として公開しない。

### 11.2 エラー

下位WebSocketの接続・timeout・parse・networkその他のエラーを、onError等の既存公開契約へ渡してよい。ただし、下位エラーの転送だけではFR-006を満たさない。最終状態は11.1の状態取得契約で確認できなければならない。

Providerのreject、不正候補または候補枯渇は、健全な接続が残る場合に監視を継続する。これらをSymbol通知として扱ってはならない。Providerエラーの詳細なcallback分類は上流根拠がないため、本仕様で固定しない。

## 12. 終了とライフサイクル

### 12.1 明示的終了

利用者が監視を終了した後、Event Streamは次を停止する。

- 管理中のGateway接続
- Gateway購読
- 自動再接続および候補補充
- ブロック進行の監視
- 重複抑制に関する監視継続処理
- 終了前に開始したProvider処理の解決結果による新しい接続・購読の作成

終了済みインスタンスは監視を開始または再開してはならない。再度監視する場合は新しいインスタンスを初期化する。

### 12.2 終了後の操作

終了後に監視対象の追加・解除、接続交換またはProvider候補補充を行っても、監視を再開してはならない。終了状態の取得操作は、終了済みであることと最終状態を返せるものとする。終了操作の冪等性、終了後操作の戻り値または例外は、既存公開契約と互換性を保つ範囲で定義する。

## 13. セキュリティと信頼境界

- Event Streamは秘密鍵、ニーモニック、パスワードその他の署名・認証用秘密情報を要求、保存または処理してはならない。
- Event Streamはトランザクション署名、署名検証、暗号化、認証または通知の真正性検証を行わない。
- Event StreamはGateway通知の完全性、真正性、業務上の正当性、完全配信、順序または欠落補償を保証しない。
- 利用者アプリケーションは、業務利用に必要な通知検証、保存、欠落時の照合および復旧を担う。
- endpointの構文検証と接続先変換は、候補が正しいネットワークまたはGatewayであることの証明ではない。
- 例外、ログ、状態通知へ秘密情報を出力してはならない。

## 14. エンコード、相互運用性およびバージョン

Event Streamは、Providerが指定するGateway通信契約、購読パスおよび通知エンベロープを利用する。通知のwire形式、Symbolプロトコル、Gatewayおよび通知スキーマのバージョンを独自に固定または自動判定しない。

候補の相互適合性、対象ネットワーク、ノードのプロトコル・バージョンおよびGateway通知契約の確認は、利用者とProviderの責任境界に属する。

TypeScriptの通知型、チャネル名、アドレス付き購読パスおよび下位WebSocketエラー型は、@nemnesia/symbol-websocketの公開契約に依存する。型定義だけで実Gatewayのwire形式、対象ネットワークまたは対象バージョンへの適合性を保証しない。

## 15. 適合試験

実装は少なくとも次の要件適合試験を持つ。既存のモックテストだけでは、実Gatewayとのwire適合性を証明しない。

| 試験対象 | 確認内容 | 要件 |
| --- | --- | --- |
| 監視対象・複数接続 | 選択した対象の通知を一つの論理監視へ渡し、契約外の通知を追加しない。 | FR-001、FR-002、AC-001、AC-002 |
| 初回受入れ | 状態差がある接続を初回受入れし、初回接続失敗は受入れない。 | FR-001、FR-004、AC-001、AC-004 |
| 遅延判定 | 最大値との差が2では除外せず、3以上では除外する。通知なしだけでは除外せず、timeout切断は異常にする。 | FR-004、AC-004 |
| 原因別除外 | 遅延、初回接続失敗、timeout切断を別原因として状態へ反映する。 | FR-005、FR-006、AC-005、AC-006、AC-012 |
| 候補補充 | Provider候補を優先し、候補が残る間はブラックリスト接続を再利用しない。 | FR-005、AC-005 |
| 候補枯渇時再利用 | 条件を満たす遅延接続だけを候補とし、そこからランダムに選ぶ。初回失敗・timeout対象は再利用しない。 | FR-005、AC-011、AC-012 |
| 継続・停止 | 健全接続が残る間は継続し、全接続不健全時は停止・異常状態を観測できる。 | FR-005、FR-006、AC-013、AC-014 |
| 重複抑制 | 接続交換、補充、再利用、再接続、再購読をまたぐ同一イベントを一度だけ通知し、別イベントを統合しない。 | FR-003、AC-003 |
| 最終状態 | 異常対処後の接続状態、健全性、原因、監視状態を取得でき、途中経過を通常通知しない。 | FR-006、AC-006 |
| 終了 | 接続、購読、再接続、Provider解決後の接続作成等が再開しない。 | FR-007、AC-007 |
| 責任境界 | 署名・暗号化・秘密情報を扱わず、真正性・完全性・完全配信・欠落補償を保証しない。 | SEC-001、SEC-002、DR-001、AC-008〜AC-010 |
| 候補前提 | ネットワーク選択・自動判定・候補相互適合性検証を行わない。 | AC-015〜AC-017 |

AC-009は秘密情報を要求・保存・処理しないこと、AC-016はProviderが提供するノード・Gatewayのプロトコル・通知契約に従い独自固定・自動判定しないことを、それぞれ13章・14章で確認する。AC-015はProvider候補のネットワークに従い、AC-017は候補の共通前提を利用者が確認することに対応する。

### 15.1 外部Gateway適合試験

対象ネットワーク、Symbolプロトコル、Gateway、通知スキーマのバージョンおよび公式fixtureは上流資料で確定していない。実Gateway試験を実施しても、対象版を明記しない限り外部適合性を保証する試験とは扱わない。

## 16. 未確認事項

次は本仕様の規範要件ではなく、外部契約または実装移行時に確認する事項である。

- Providerが提供する対象ネットワーク、NodeWatch情報、Gateway版および通知契約
- ブロック進行値の実wireフィールドと対象Gateway版での型
- 公開パッケージの利用契約を維持したままMonitoringStatusと原因付き接続状態を追加する型互換性
- 通知ID抽出方式が対象Providerの全通知チャネルで妥当であること
- NodeProviderの失敗をどの公開状態または下位エラー通知へ反映するか
- close後にon、off、callback登録操作を呼んだ場合の戻り値・例外
- 実Gatewayおよび公式fixtureを用いたチャネル別wire適合性

上記を埋めるために、要件にないネットワーク自動判定、通知履歴、再送、リトライ間隔、レート制限、監査または将来拡張を追加してはならない。

## 17. 参照資料

### 17.1 上流資料

- packages/symbol-event-stream/docs/consept/concept-sheet.md
- packages/symbol-event-stream/docs/requirements/requirements.md
- packages/symbol-event-stream/docs/reviews/concept/concept-sheet-review-005.md
- packages/symbol-event-stream/docs/reviews/requirements/requirements-review-002.md
- AGENTS.md

### 17.2 補助資料

- packages/symbol-event-stream/README.md
- packages/symbol-event-stream/package.json
- packages/symbol-event-stream/src/SymbolEventStream.ts
- packages/symbol-event-stream/src/SymbolEventStreamTypes.ts
- packages/symbol-event-stream/src/EventDeduplicator.ts
- packages/symbol-event-stream/src/SubscriptionRegistry.ts
- packages/symbol-event-stream/test/SymbolEventStream.test.ts
- packages/symbol-event-stream/test/SymbolEventStream.types.test.ts
- packages/symbol-event-stream/docs/reviews/implementation/implement-spec-feedback.md
- packages/symbol-websocket/src/symbolChannelPaths.ts
- packages/symbol-websocket/src/symbolNotifications.types.ts
