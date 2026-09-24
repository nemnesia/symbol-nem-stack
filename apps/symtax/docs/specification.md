# SymTax 外部仕様

## 1. 概要と適用範囲

### 1.1 目的

本書は、承認済みの [Concept](concept.md)、[Requirements](requirements.md)、[Design](design.md) に基づき、SymTaxの利用者・Browserから観測できる入力、結果、状態、出力形式を定める。実装者による補完が必要な未決定事項は本書末尾に分離し、必須機能の未決定事項が残る範囲を実装可能と扱わない。

SymTax初期対象はSymbol（XYM）の履歴ビューアと履歴出力である。税額計算、税務判断、秘密鍵・ニーモニック、署名、トランザクション送信は対象外とする。初期の集約対象はReceipt Type `HARVEST_FEE (0x2143)`に分類できるHarvest Fee Receiptのみで、Transactionおよび他Receiptを集約しない。

### 1.2 規範語

| 語 | 意味 |
|---|---|
| MUST / MUST NOT | 初期リリースが満たす必須契約 / 禁止事項 |
| SHOULD / SHOULD NOT | 理由を記録した上で例外を許す推奨事項 |
| MAY | 任意機能 |
| 未決定 / BLOCKING | 根拠不足のため本書で動作を決定しておらず、関連機能の実装開始または公開を妨げる項目 |

### 1.3 上流境界

| 正本 | この仕様で維持する決定 |
|---|---|
| Concept / Requirements | TransactionとReceiptは独立。月→日→個別明細。JST。Harvestのみ日次圧縮。原履歴と価格根拠を追跡。税務判断をSymTaxがしない |
| Design | BrowserはMongoDBへ接続せず、ServerがNode raw表現を正規化する。価格観測とReceipt評価は別。network mismatchはfail-closed。Crypto formatはExport境界に閉じる |
| 外部・技術資料 | Symbol protocol / schema、特定Catapult実装、bitbank Public API、Cryptact公式資料を別々の根拠として扱う。下流実装の観測だけをprotocol規則へ格上げしない |

## 2. 用語、状態、公開結果の共通形

### 2.1 用語

| 用語 | 契約上の意味 |
|---|---|
| Transaction | Symbol Transactionを基にした独立した履歴record。Receiptを子recordとして統合しない |
| Receipt | Statement recordに含まれるSymbol Receipt。Receipt自体のtimestampを持たない |
| Statement source | Receiptが属するStatementのsource識別情報。ReceiptとBlock heightの対応を解決するために使う |
| Price observation | bitbank XYM/JPY 1分足の個別取得観測。市場共通データ |
| Price evaluation | Harvest Fee Receipt、対応Block timestamp、選択されたPrice observation、評価規則から得る派生値 |
| complete / incomplete | 指定範囲を満たす履歴・根拠が揃っている / 取得・解釈・評価の欠損がある状態 |
| unsupported | 当該仕様で意味・処理を定義していないTypeや外部表現 |
| unknown | 入力・データはあるが、分類・network・eligibility等を一意に判定できない状態 |
| unavailable | 必要な外部依存または保存データを現在取得できない状態 |
| invalid | 入力が構文・範囲・整合条件に違反する状態 |

これらの状態は相互に置換してはならない。例えばunsupportedをunknown known typeへ読み替えたり、unavailableを空配列・0円に変えたりしない。

### 2.2 共通結果契約

すべてのBrowse / Summary結果は、意味として以下を持つ。これはHTTP endpointやJSONの具体的な実装形式を規定しない。

| 項目 | 意味 |
|---|---|
| contractVersion | 外部結果契約版。本書の初版は`1` |
| network | `mainnet`または`testnet`。要求に使ったexpected networkと確認済みobserved networkを示す |
| category | `transactions`または`receipts`。混在値は禁止 |
| period | JSTで解釈した`fromDate` inclusive / `toDateExclusive` exclusive |
| completeness | `complete`または`incomplete`。incomplete時は対象範囲・reason集合も返す |
| data | 正規化されたrecordまたはSummary |
| continuation | 続きがある場合の不透明token。終端は値なしで表す |

正常に検索したがrecordが0件の場合は、`complete`と空のrecord集合を返す。取得失敗、未対応schema、coverage不明の場合は空集合を成功として返さず`incomplete`またはerrorを返す。`SPEC-ERR-*`を参照。

## 3. 入力・network・期間

### 3.1 Address入力

**SPEC-IN-001 — 対応表記**

利用者入力としてSymbolの通常Base32 encoded addressを受け付ける。正規表記は39文字。pretty表記は6文字ごとのgrouping hyphenを厳密に満たす場合に受け付け、検証前にhyphenを取り除く。raw 24-byte addressや48桁hex representation、Namespace ID / unresolved addressは初期Address入力では受け付けない。Symbol文書は39文字Base32と24-byte addressを説明するが、製品は入力形式をBase32に限定する。

**SPEC-IN-002 — Normalizationと検証**

外側のASCII whitespaceのみtrimし、ASCII小文字は大文字化する。その他の内部空白・区切り・Unicode類似文字は拒否する。Base32復号後、Symbol encoded addressの形式、24-byte構造、checksum、および第1 byteのnetwork identifierを検証する。Catapult実装では24 bytesがnetwork byte + 20-byte hash + 3-byte SHA3-256 checksumで構成され、Mainnet identifierは`0x68`、Testnetは`0x98`である。Checksum検証に失敗した入力は`invalid-input`。

**SPEC-IN-003 — Network整合**

addressのnetwork byteはruntime expected networkと一致しなければならない。Mainnet runtimeでTestnet address、またはその逆を受け付けない。Address入力からruntime networkを切り替えてはならない。正しい構文だが別networkの場合は`wrong-network`。

**SPEC-IN-004 — 空・不正・非対応**

空文字は`invalid-input`。不正文字、長さ違い、破損pretty形式、checksum不一致は`invalid-input`。Namespace ID、hex形式、NEM addressは`unsupported-input`として拒否し、symbol account searchへ変換しない。

### 3.2 Runtime Network

**SPEC-NET-001 — 固定Network**

各runtimeは一つの`expectedNetwork ∈ {mainnet,testnet}`を持つ。開発・検証環境はTestnet、公開版はMainnet。利用者requestはnetworkを選択・切替できない。

**SPEC-NET-002 — Observed identity**

Serverはnodeから取得したNetworkTypeと、deploymentで承認されたnetwork fingerprintを期待値と照合する。Symbol REST `GET /network`はnetwork name / descriptionを返し、`GET /network/properties`はNodeの`config-network.properties`由来情報を返す。両情報に加え、確認可能なchain identity情報がexpected networkと一致したときだけnodeを利用可能とする。環境変数の文字列だけをobserved identityとしてはならない。

Expected fingerprint値と、どのNode identity evidenceを独立証拠として必須化するかは、公開Mainnet・対象Testnetの配置前に環境構成でpinする。identityが取得不能、未知のnetwork name、fingerprint不一致、証拠同士の不一致の場合は`network-identity-unavailable`または`wrong-network`でfail-closedとする。

**SPEC-NET-003 — 結果・Continuation分離**

結果、continuation、request contextはnetworkに束縛する。別network用continuationは拒否する。Price observationはXYM/JPY市場共通でnetwork非依存だが、chain-derived Receipt / Summary / Evaluationをnetwork間で再利用しない。

**SPEC-NET-004 — Read-only境界**

Symbol Node MongoDBはServer adapterからread-onlyでのみ参照し、Browserへcredentialまたはraw BSONを渡さない。Node DBを書き換える要求は存在しない。Node schema / coverage不整合は`unsupported-schema`または`history-incomplete`。

### 3.3 期間入力

**SPEC-IN-005 — Period契約**

検索期間は`fromDate`と`toDateExclusive`からなるISO 8601暦日`YYYY-MM-DD`。両方ともJST暦日として解釈する。対象instant区間は、`fromDate` JST 00:00:00 inclusive以上、`toDateExclusive` JST 00:00:00 exclusive未満とする。`fromDate < toDateExclusive`が必須。日付のみの入力にUTC暗黙変換を適用しない。

空期間・不正暦日・`fromDate >= toDateExclusive`は`invalid-input`。終了日が現在のJST日より未来なら拒否する。開始日がNodeの保持開始より古くても自動で切り詰めず、requested period全体に対してcoverageを`incomplete`とする。Date rangeに、根拠のない最長日数・最古日を設定しない。最大期間が必要となる全件Export等は`OPEN-SPEC-008`に従う。

月navigationは月初JST日をstart、次月月初をexclusive endとする。日navigationは当日JSTをstart、翌日JSTをexclusive endとする。月・年・うるう日・JST 00:00境界は暦演算で判定する。

## 4. Pagination / Continuation

### 4.1 Page契約

**SPEC-PAGE-001 — Page size**

明細pageは`pageSize`を1〜100の整数とする。省略時100。100超、0、負数、小数、整数として解釈できない値は`invalid-input`。100は各responseの外部payload上限として採用する契約値であり、性能合否値ではない。

**SPEC-PAGE-002 — Keyset ordering**

offset/page-number方式を使わずkeyset continuationを使う。欠番・同時刻recordがあるためtimestamp単独をkeyにしてはならない。

| Category | 安定順序キー（同値時まで全順序化） |
|---|---|
| Transaction | `blockHeight DESC, transactionIndex DESC, embeddedIndex DESC, transactionIdentity DESC`。embeddedでない場合のembeddedIndexは専用sentinel |
| Receipt | `blockHeight DESC, statementKind DESC, sourcePrimaryId DESC, sourceSecondaryId DESC, receiptIndex DESC, receiptIdentity DESC` |

identityはnetworkを含む。各query内で重複identityは1件に正規化し、異なるrecordを同一と判断する場合は`history-incomplete`。

**SPEC-PAGE-003 — Continuation binding**

Continuationはaddress、expected/observed network、category、period、pageSize、contract/order version、snapshot tip、およびlast ordering keyに束縛される不透明token。tokenの意味を利用者に公開しない。tokenが改変・破損・未対応version・別address/category/period/pageSize/networkで再利用された場合は`invalid-continuation`。条件を変更する場合、利用者は最初のpageから開始する。

**SPEC-PAGE-004 — Snapshotと重複防止**

最初のpageが確定したchain tipをcontinuationのsnapshot境界とする。後続pageはsnapshotより後のblockを含めない。基準BlockがNodeから消失・非canonical化した場合、continuationを無効化し`continuation-stale`を返す。利用者が最初から再取得するまで、旧pageと新pageをcompleteな一連の結果として扱わない。

**SPEC-PAGE-005 — Coverage**

最後のpageにはcontinuationなし、続きがあるpageには必ずcontinuationを返す。途中pageの失敗時、既取得pageを保持していても期間全体をcompleteとして宣言しない。API transport / Next.js方式は実装選択とし、外部意味はこの契約に従う。

### 4.2 Summary paging

Summaryはcategory別。月Summaryの列はrequest期間内の月を昇順に返し、日Summaryは選択月内の日を昇順に返す。Summary pageの要素数は最大100 bucket。月数を越えても全履歴を1 responseに集約しない。個別明細への遷移条件は`network + address + category + period(bucket)`であり、同じrecord集合を対象とする。

## 5. Transaction / Receipt Normalized Contract

### 5.1 共通record

**SPEC-TX-001 / SPEC-RCPT-001 — Raw境界**

Browser向けrecordはSymbol MongoDB BSONを公開せず、Symbol adapterが検証・正規化した値に限る。全recordは`network`, `identity`, `typeCode`, `typeName`, `blockHeight`, `blockTimestamp`, `addressRoles`, `sourceReference`, `completeness`の意味を持つ。Block timestampを解決できないrecordはtimestampを偽造せずnull + incomplete reasonとする。

`identity`は同じnetwork / category内で一意かつ継続読取でも安定するsource-derived identity。`sourceReference`は利用者が元recordの照合に使えるSymbol上のidentifier / Block / Statement sourceを含む。MongoDB collection名・内部document IDを公開仕様にしない。

### 5.2 Transaction

**SPEC-TX-002 — Transaction fields**

| Field意味 | 必須性・規則 |
|---|---|
| transaction identity | 必須。outer transactionはconfirmed transaction hash。Aggregate embedded transactionはouter hash + embedded indexで識別 |
| block reference | confirmed recordではblock height必須。未解決時はincomplete |
| timestamp | Symbol Block timestampから変換したUTC instant。Transaction固有の受付時刻で代替しない |
| type | `typeCode`はuint16相当の範囲を10進codeまたは4桁hexとして一意に表現。known type名との対応を保持 |
| signer | public key / networkから解決可能なSymbol account address。未解決ならunknown |
| address roles | request addressがsigner、sender、recipient、cosigner、embedded participant等のどの役割で関係するか。複数可 |
| mosaics / amounts | Amountはmosaic IDと符号なしnative absolute unitsの組。異なるmosaicを合算しない |
| fee | outer Transactionのnative absolute amount。embedded transaction自身のfeeとして重複計上しない |
| type details | 既知typeが持つ利用者確認に必要な、型を保持した意味フィールド。raw BSONを含めない |
| completeness | `complete`, `partial`, `unsupported`。欠損fieldを0・空文字で埋めない |

**SPEC-TX-003 — Address relation**

指定addressがTransactionに関係する場合、少なくとも署名者、Transfer sender / recipient、Aggregate内参加者、Cosignature participantとしての関係を、そのtypeのsource fieldから判定する。Account用履歴に関係しないChain-wide recordは混入させない。特定roleを解決できず期間網羅性へ影響するときはcoverage incomplete。

**SPEC-TX-004 — 初期認識Transaction types**

Symbol REST OpenAPIに列挙される次の25 type codeをrecognized setとする。Transaction typeの名称は同schemaの名称を用いる。recognized typeのうち型別detail mappingが未実装なら`partial`であり、取引の完全明細またはExport成功に見せない。

| Hex | Name | Hex | Name |
|---|---|---|---|
| `0x414C` | AccountKeyLink | `0x4243` | VrfKeyLink |
| `0x4143` | VotingKeyLink | `0x424C` | NodeKeyLink |
| `0x4141` | AggregateComplete | `0x4241` | AggregateBonded |
| `0x414D` | MosaicDefinition | `0x424D` | MosaicSupplyChange |
| `0x434D` | MosaicSupplyRevocation | `0x414E` | NamespaceRegistration |
| `0x424E` | AddressAlias | `0x434E` | MosaicAlias |
| `0x4144` | AccountMetadata | `0x4244` | MosaicMetadata |
| `0x4344` | NamespaceMetadata | `0x4155` | MultisigAccountModification |
| `0x4148` | HashLock | `0x4152` | SecretLock |
| `0x4252` | SecretProof | `0x4150` | AccountAddressRestriction |
| `0x4250` | AccountMosaicRestriction | `0x4350` | AccountOperationRestriction |
| `0x4151` | MosaicGlobalRestriction | `0x4251` | MosaicAddressRestriction |
| `0x4154` | Transfer | | |

### 5.3 Receipt

**SPEC-RCPT-002 — Receipt fields**

| Field意味 | 必須性・規則 |
|---|---|
| receipt identity | network + block height + statement kind / source + receipt ordinalの組。MongoDB IDに依存しない |
| receipt type | `typeCode`とschema名。unknown値をknownへ変換しない |
| mosaic / amount | Receipt typeが持つ場合はmosaic ID + absolute amount。該当しないtypeでは`not-applicable` |
| target / source | schemaが持つtarget、sender、recipient等の意味役割を別々に保持。ないroleはnullではなく`not-applicable` |
| statement source | source primary / secondary identifiersとStatement kind |
| block reference | height必須。Receipt timestamp fieldは定義しない |
| block timestamp | Statement heightに対応するBlockから解決したtimestamp。欠損時はunavailable |
| Harvest classification | `harvest`, `not-harvest`, `unknown`。分類根拠となったReceipt Type codeを付ける |
| completeness | 全必須関係・fieldが検証されたときだけcomplete |

**SPEC-RCPT-003 — 初期認識Receipt types**

Symbol REST OpenAPI / Catbufferで定義される次の16 typeを認識する。

| Code | Name | Contract handling |
|---|---|---|
| `0x124D` | Mosaic_Rental_Fee | recognized Receipt。必要なtarget / transfer / amountを出す |
| `0x134E` | Namespace_Rental_Fee | recognized Receipt。必要なtarget / transfer / amountを出す |
| `0x2143` | Harvest_Fee | Harvest candidate。下記Harvest分類条件に従う |
| `0x2248` | LockHash_Completed | recognized Receipt |
| `0x2348` | LockHash_Expired | recognized Receipt |
| `0x2252` | LockSecret_Completed | recognized Receipt |
| `0x2352` | LockSecret_Expired | recognized Receipt |
| `0x3148` | LockHash_Created | recognized Receipt |
| `0x3152` | LockSecret_Created | recognized Receipt |
| `0x414D` | Mosaic_Expired | recognized Receipt |
| `0x414E` | Namespace_Expired | recognized Receipt |
| `0x424E` | Namespace_Deleted | recognized Receipt |
| `0x5143` | Inflation | recognized Receipt; Harvest candidateではない |
| `0xE143` | Transaction_Group | recognized Receipt / grouping record。XYM取得量へ集計しない |
| `0xF143` | Address_Alias_Resolution | recognized resolution receipt。XYM quantityはnot-applicable |
| `0xF243` | Mosaic_Alias_Resolution | recognized resolution receipt。XYM quantityはnot-applicable |

**SPEC-RCPT-004 — Unknown / unsupported type**

構造的に識別可能な未知Receiptはtype code、source reference、block refを表示し、`unsupported-receipt-type`かつscope incompleteとする。type固有のamount、target、Harvest分類を推測しない。Receipt Typeが不正値・欠落し、identityやStatement構造も解釈できない場合は`unsupported-schema`。未知型が期間内に存在すれば完全Summary・Exportを拒否する。

### 5.4 Harvest Receipt識別

**SPEC-RCPT-005 — Protocol上のHarvest判定**

Harvest Fee ReceiptはReceipt Type `0x2143 HARVEST_FEE`であり、Symbol公式Receipt資料上、harvestしたBlockについてharvesterが受け取るfeeのrecipient / account / amountを記録する。初期`harvest`分類は次の全条件を満たすrecordのみ:

1. `typeCode == 0x2143`。
2. recordがSymbol Statementから得られ、target address / mosaic / amountを正規化できる。
3. Request addressが当該Receiptのtarget addressと一致する。
4. block height・block timestamp・source referenceが解決済み。

`0x5143 INFLATION`はnetwork currency creation amountのReceiptであり、harvester個人へのHarvest Fee Receiptとして分類しない。`0x2143`以外のknown Receiptは`not-harvest`。未知type、矛盾するsource/target、HARVEST_FEEだが必須情報欠損は`unknown`。税務上の分類は行わない。

## 6. TimestampとSummary

### 6.1 Block timestamp

**SPEC-TIME-001 — Symbol epoch conversion**

Symbol TimestampはNemesis block生成時点からのmillisecond count。`GET /network/properties`の`epochAdjustment`はUnix epochからNemesis block生成時点までのsecond offsetである。Block Unix instantは正確に次式で求める。

`unixMilliseconds = epochAdjustmentSeconds × 1000 + blockTimestampMilliseconds`

計算は整数精度を保つ。NetworkごとのepochAdjustmentを用い、Mainnet値をTestnetへ流用しない。

**SPEC-TIME-002 — Receipt timestamp derivation**

Receiptにtimestampを割り当てない。`Receipt → Statement source / height → canonical Block → block timestamp`の対応を解決し、そのBlock Unix instantをReceipt evaluationの時間根拠とする。StatementまたはBlockを一意に解決できない場合`block-timestamp-unavailable`。

### 6.2 JST calendarと価格時刻

**SPEC-TIME-003 — JST bucket**

月・日SummaryおよびHarvest daily aggregationは`Asia/Tokyo` calendarである。日bucketはJST 00:00 inclusive、翌日JST 00:00 exclusive。月bucketはJST月初00:00 inclusive、次月月初00:00 exclusive。epoch instantは保存時にJSTへ改変しない。

**SPEC-TIME-004 — Price lookup instant**

Price lookupはBlockの実Unix instantを用いる。JST dateまたはbitbankのrequest date pathを検索keyとして代用しない。bitbankのrequest日境界とSymTaxのJST bucket境界は独立。

**SPEC-TIME-005 — Cryptact date**

Cryptact CSVの日時欄はblock instantをJSTへ変換した`YYYY/MM/DD HH:mm:ss`とし、JST帳簿設定で取り込む契約案とする。ただし、Cryptactはアップロード時に帳簿time zoneがdefault適用され、fileと異なるとき変更する案内をしている。CSV datetimeにoffset欄がないため、実取込でJST・秒切捨て・DST扱いを検証するまでHarvest Exportをrelease-readyとしない。

### 6.3 Summary values

**SPEC-SUM-001 — Category separation**

Transaction SummaryとReceipt Summaryは別request / result category。Transaction明細をReceipt Summaryへ含めず、ReceiptをTransaction fee/amountへ重複計上しない。

**SPEC-SUM-002 — Month / day hierarchy**

Month summary itemはJST year-month、record count、coverage/completeness、意味がある数量/fee aggregateを示す。Day summary itemはJST date、count、category-specific aggregate、構成sourceへのnavigation conditionを示す。Summaryの値は個別detail集合と同じnetwork・period・categoryに限定する。

**SPEC-SUM-003 — Applicability and zero**

集計fieldは`value`と`applicability`を分離する。`applicability=not-applicable`は型として意味を持たない場合、`value=0`は意味を持つquantity / feeが実際に0の場合に限る。Harvest量はReceipt側の`0x2143` XYM amountのみを示す。他mosaic量をXYMへ換算しない。

**SPEC-SUM-004 — JPY aggregate**

XYM JPY評価は全対象Receiptが同じ評価規則でcompleteのときだけcomplete totalとして表示する。未評価が含まれる場合はtotalを確定値として出さず、incomplete coverageと未評価件数を返す。Summaryは個別recordへの追跡情報を失わない。

## 7. Numeric / Quantity / Serialization

### 7.1 Exact numeric rules

**SPEC-NUM-001 — Symbol amount**

Symbol absolute Amountはunsigned 64-bit整数で表現し、wire / Browser表現は基数10の整数文字列とする。JavaScript `number`やbinary floating pointへの変換は禁止。XYMはmosaic IDとnetworkのnative currency設定を確認し、Mainnet native XYM IDをTestnetへ流用しない。Public Symbol XYM divisibilityは6、1 XYM = 1,000,000 absolute units。

**SPEC-NUM-002 — Relative display**

XYM表示値はabsolute integerを厳密に1,000,000で除したdecimal文字列で、小数部は最大6桁、不要な末尾0を省く。丸めは発生しない。他mosaicを表示する場合はそのmosaic divisibilityが検証できない限りrelative表記へ変換せずabsolute値を表示する。

**SPEC-NUM-003 — Price decimals**

bitbankのOHLCV価格とvolumeはJSON string decimalとして受け取り、指数表記・NaN・Infinity・負数・不正scaleを拒否する。原decimal valueをbinary floatへ変換しない。API応答上のdecimal文字列を正規化して保存する。

**SPEC-NUM-004 — Valuation arithmetic**

価格選択が承認された後、`evaluatedJPY = absoluteXYMAmount × selectedJPYPerXYM ÷ 1,000,000`をdecimal/rational exact arithmeticで計算する。評価中間値で丸めない。Harvest aggregate JPYは個別evaluatedJPYのexact sum。JPY表示currency roundingとCSV serialization roundingは未決`OPEN-SPEC-003`であり、値を0円へ丸めることは禁止。

**SPEC-NUM-005 — Overflow / malformed number**

UInt64範囲外、負のon-chain amount、数値文字列構文違反は`unsupported-schema`。Symbol native unitsの加算にoverflowがあればAggregateをcompleteにせず`internal-failure`。応答値の上限・任意精度実装量を超える場合も0や上限値へclampせず失敗とする。

### 7.2 Currency applicability

Price sourceはXYM/JPYのみ。他mosaicはXYMとして評価しない。円金額には`JPY`と明示し、価格・数量の単位を省略しない。

## 8. bitbank Price Observation / Evaluation

### 8.1 Provider contract

**SPEC-PRICE-001 — Market**

初期sourceはbitbank Public API、pair `xym_jpy`、candle type `1min`。Public docsはcandle request path `/{pair}/candlestick/{candle-type}/{YYYY}`、1minではdate pathを`YYYYMMDD`、ohlcv entryを`[open,high,low,close,volume,unixTimestampMilliseconds]`と定義する。Docsは`timestamp`のmillisecond値を規定するが、分足timestampの区間anchor/timezoneの説明は見つからなかった。

### 8.2 Observation record

**SPEC-PRICE-002 — Required observation data**

Price observationの公開意味は以下を持つ。

| Field | 意味 |
|---|---|
| provider | 固定値`bitbank-public` |
| pair | 固定値`XYM/JPY` |
| interval | 固定値`1min` |
| candleTimestamp | ProviderのUnix timestamp millisecondsを整数で保持 |
| open/high/low/close/volume | Provider decimal stringをexact decimalとして保持 |
| fetchedAt | Serverが取得成功を認識したUTC instant |
| sourceReference | Provider pair / interval / request date / returned row位置 |
| observationIdentity | pair + interval + candleTimestamp + canonical OHLCV decimal tuple |
| observationState | `observed`, `correction-candidate`, `ambiguous`。重複取得は新規観測を増やさず、採用観測はReceipt Price Evaluationから参照する |

response内にないProvider version / request IDは推測で生成せず、取得API版とresponse schemaの識別情報をprovenanceに含める。過去のPublic API payload全体を保存するか、保存量のretentionは運用決定として残す。

### 8.3 Append-only / re-fetch

**SPEC-PRICE-003 — Duplicate and changed observation**

同一pair・interval・candleTimestampと全く同じcanonical OHLCVは同一観測としてidempotentに扱う。時刻keyは同一だがいずれかのOHLCVが異なる応答は新しい`correction-candidate`観測であり、既存observationを書き換えない。二つ以上異なる候補があるtimestampはambiguousとする。

`selected`の価格観測は、対応する既存Receipt evaluationから暗黙に差し替えない。再取得自体は既存評価を自動再計算・Export更新しない。明示的な再評価機能は要件にないため初期仕様では提供しない。Conflictに選択観測がすでに固定されていない場合は`price-observation-conflict`。

**SPEC-PRICE-004 — Retention / reuse**

ObservationはSymbol Node DBから独立したSymTax市場データとして永続保存し、address/network単位に複製しない。保存済み価格はProvider停止中にも読める。経過期間のみを理由に削除しない。価格Store利用不能時は保存価格hit/missを確定できず、該当評価をcompleteにしない。

### 8.4 Price selection blocker

**SPEC-PRICE-005 — Timestamp to candle**

候補minuteはblock Unix instantに対応する60,000ms区間でなければならない。JST日付を使って選択しない。bitbank公式資料からentry timestampがminuteの開始・終了どちらを示すか、exact boundaryでの足包含規則、過去APIのdate pathと時刻basisが確定できなかった。

**OHLC採用値は未決定でBLOCKING。** Official docsは4値の存在を示すだけで税務上の唯一正しい値・市場評価値を定めない。Close等を暫定採用しない。bucket anchor、exact-boundary、OHLC値が承認されるまで`Price evaluation`、JPY Summary、Harvest Exportをcompleteとして実装しない。

### 8.5 Missing price cases

**SPEC-PRICE-006 — Missing / provider failure**

| Condition | Result | retry | Evaluation / aggregation / export |
|---|---|---|---|
| candle rowなし | `price-unavailable` | 後続要求で再取得可能 | 評価・集約不可、価格必須Export拒否 |
| responseに該当minuteなし | `price-unavailable` | 後続要求可 | 上記と同じ |
| volume = 0 | 価格値を保持するがeligible priceと確定しない。価格根拠状態は未決OPEN | 自動近傍探索なし | BLOCKING until policy; 0 volumeを0 JPYとして扱わない |
| timeout / provider error | `price-provider-unavailable` | 再試行可能 | 保存済みで確定選択済み観測のみ利用可 |
| malformed response / invalid decimal | `price-provider-invalid-response` | responseの修正後 | 当該取得を受理・評価しない |
| Storeなし / Store unavailable | `price-unavailable` / `price-store-unavailable` | Store復旧後 | complete評価にしない |
| block timestamp不明 | `block-timestamp-unavailable` | Node参照復旧後 | price lookupを実行しない |

自動補間、前後candle検索、Volume 0 fallbackは初期仕様では定義しない。具体挙動の最終決定は`OPEN-SPEC-004`。

### 8.6 Receipt evaluation

**SPEC-PRICE-007 — Evaluation evidence**

各評価結果は`receiptReference`, `amountAbsolute`, `blockTimestamp`, `priceObservationIdentity`, `provider`, `pair`, `interval`, `selectedJPYPerXYM`, `evaluatedJPY`, `ruleVersion`, `completeness`, `unavailableReason`を追跡できる。入力は同一Receipt、同一block instant、同一選択observation、同一rule versionなら決定的に同一結果とする。

Evaluation結果自体は利用者別履歴として永続保存しない。ただし、同じ結果の再現に必要なselected observationとrule versionを閲覧・Export結果と結び付ける。selected observation selection rule versionの正式値はprice rule blocker解消時に定義する。根拠を再現できない価格値を表示しない。

## 9. Harvest Eligibility / Daily Aggregation

### 9.1 Eligibility

**SPEC-AGG-001 — State contract**

Eligibilityは`eligible`, `ineligible`, `unknown`のいずれか。`unknown`を`eligible`へfallbackしない。分類はprotocol-level Harvest Fee Receiptの識別であり、税務上の取得・所得区分を表さない。

**SPEC-AGG-002 — Candidate set**

候補は`SPEC-RCPT-005`を満たした個別`HARVEST_FEE (0x2143)`のみ。`INFLATION (0x5143)`、他Receipt、Transactionはineligibleで、Daily aggregateに混ぜない。

### 9.2 Eligibility rules and blocker

次の条件をすべて満たすrecordは構造上`eligible-candidate`とする: Harvest classification `harvest`; native XYM mosaic ID確認; amount valid; block timestamp/price evaluation complete; JST date known; source reference unique; same type/asset grouping. `ineligible`: known non-Harvest, no amount movement, invalid structural amount, or non-XYM asset under XYM daily mode. `unknown`: type/relationship/price classification incomplete, duplicate/conflicting source, or unresolved rule.

しかし本仕様では、Cryptact上の取引分類、総平均法 / 移動平均法、同日売却をまたぐ集約、時系列順序による損益差について、税務上安全なeligibleを決定する根拠がない。よって実装用最終状態は **Harvest daily aggregation eligibility = BLOCKING**。上の候補条件だけでCryptact用`eligible`と確定してはならない。

### 9.3 Aggregation result

**SPEC-AGG-003 — Required result contract**

Eligibility blockers解消後の集約行は、`aggregationDate`(JST), `asset=XYM`, `totalQuantityAbsolute`, `totalEvaluatedJPY`, `componentCount`, `componentReceiptReferences[]`, `componentEvaluationReferences[]`, `completeness`, `aggregationRuleVersion`を含む。total quantityはabsolute unit integer exact sum。totalJPYは個別evaluationのexact sumでありaggregate quantityから価格を逆算してsource of truthにしない。

**SPEC-AGG-004 — Group partition**

日が同じことだけでまとめない。初期候補group keyはJST date + asset + Receipt type + evaluation / eligibility rule version。税務方式・取引順序上の境界が検証されるまではgroupの最終partitionを承認しない。異種asset、Receipt type、rule versionを同じ行へ混ぜない。

**SPEC-AGG-005 — Reversibility**

Aggregateは派生recordであり元Receiptを削除・置換しない。各集約行から全構成Receiptと個別Price Evaluationへ戻れなければならない。unknown / incomplete memberを落として集約件数を減らす部分成功は不可。`weightedAveragePrice`を出す場合もdisplay-only派生値で、totalJPYおよび個別評価の代わりにしない。

## 10. Cryptact Export Contract

### 10.1 Current official file schema

**SPEC-EXPORT-001 — Supported template**

最新確認したCryptact公式日本語カスタムCSV例はUTF-8 BOM付きの日本語CSVで、headerは次の10列をこの順で持つ。公式ページ本文は日時を`YYYY/MM/DD HH:mm:ss`とし、コメント以外をrequiredと説明する。File uploadは帳簿設定timezoneがdefaultで異なるfile timezoneの場合は変更を求める。

```text
日時,種類,ソース,主軸通貨,取引量,価格（主軸通貨1枚あたりの価格）,決済通貨,手数料,手数料通貨,コメント
```

| Column | Official semantics | Required status |
|---|---|---|
| 日時 | `YYYY/MM/DD HH:mm:ss` | required |
| 種類 | Cryptact registered action | required |
| ソース | data source name | required |
| 主軸通貨 | supported coin / custom coin | required |
| 取引量 | base position movement | required |
| 価格（主軸通貨1枚あたりの価格） | counter amount per base unit | required field; documented cases allow blank to request Cryptact quote |
| 決済通貨 | counter currency | required |
| 手数料 | fee amount; no fee must be represented as numeric zero | required |
| 手数料通貨 | fee currency | required |
| コメント | user memo; not reflected in Cryptact transaction | optional |

CSV row values containing `'`, `"`, or `\` are prohibited by current official guide. Amount/price use decimal text, never locale separators or binary float serialization. Official CSV attachment shows UTF-8 BOM and these exact Japanese headers; updated help text may supersede it, so export version must record the official artifact revision/date.

### 10.2 Transaction and Receipt mapping

**SPEC-EXPORT-002 — Individual mode**

`mode=individual` is distinct from daily aggregate and preserves one output candidate per selected on-chain Transaction / Receipt according to the approved mapping. Cryptact action type, fee handling, recognized asset, address transfer treatment, and selection scope MUST be validated against a current official mapping. SymTax MUST NOT invent BUY/SELL/LOSS/BONUS/STAKING from protocol role or transaction direction alone.

The generic CSV contract is established, but Symbol transaction type → Cryptact action mappings are unresolved. Any selected type without approved mapping is `cryptact-mapping-unavailable`; a complete Individual file may not silently omit it.

### 10.3 Harvest mapping

**SPEC-EXPORT-003 — Harvest action**

Cryptact official material describes `STAKING` as a staking reward and describes staking rewards as profit recognized at transaction time. It does not state that Symbol `HARVEST_FEE (0x2143)` is a staking transaction or prescribe a tax action for Symbol harvesting. Therefore `HARVEST_FEE → STAKING` is not assumed. Harvest individual and daily exports are BLOCKING until Cryptact / project tax-advice confirms the accepted action mapping and processing semantics. `BONUS`, `MINING`, or other actions must not be substituted by inference.

### 10.4 Daily output and economic semantics

**SPEC-EXPORT-004 — Daily output**

Daily mode includes only approved eligible Harvest Fee Receipt groups, with one output row per approved group; date is JST. Transaction and non-Harvest Receipt compression is prohibited. Each row needs component Receipt / price references in SymTax's user-visible result, even though Cryptact comment is memo-only and cannot be relied on as machine provenance.

Official generic file docs define volume as position change and price as counter per base unit, which allows a numeric weighted price field structurally. They do not establish Symbol Harvest mapping, daily aggregation acceptance, or equivalent P/L behavior under Cryptact's average-cost methods. Actual upload / calculation comparison is not performed because a Cryptact account/service upload is unavailable in this task. Therefore file-level and economic-equivalence status are separate; daily output remains BLOCKING.

**SPEC-EXPORT-005 — Price and volume**

After Harvest mapping and OHLC selection are approved, daily `volume` is total XYM relative quantity and price would have to express `totalEvaluatedJPY / totalXYM` in JPY per XYM for the official CSV field semantics. This quotient may be repeating or affected by Cryptact decimal parsing. Exact scale, rounding, fee/counter values, and upload acceptance are unresolved. No rounded value is specified pending confirmation; do not output a row as complete.

### 10.5 Export completion

**SPEC-EXPORT-006 — Complete / incomplete / rejected**

| Status | Meaning | File delivery |
|---|---|---|
| `complete` | Every selected source record has full coverage, supported mapping, required price/eligibility, and full format validation | Deliver only after all blockers for that mode are resolved |
| `incomplete` | Source scope has unknown, unsupported, missing, or unvalued items; no complete file may be presented | No file in initial release; provide reason and counts |
| `rejected` | Request invalid, wrong network, mapping mode not approved, or unsupported file contract | No file |

Initial contract rejects full export on any missing source, unsupported type, unavailable required price, unknown eligibility, or missing mapping. No partial export mode is specified because it is not an upstream requirement. A rejected / incomplete result reports category, period, total affected count, and reason counts without silently dropping items.

**SPEC-EXPORT-007 — CSV determinism**

When mode blockers are cleared, rows are sorted by underlying UTC instant ascending, then stable transaction / receipt identity. `日時` is rendered in JST seconds; two distinct events in one second remain separate rows for individual mode. Japanese headers match the official template and output uses UTF-8 with BOM, as shown by the official CSV sample. CRLF/LF choice, decimal maximum scale, empty / zero encoding, CSV quoting, and sub-second collisions are `OPEN-SPEC-007`; they must be locked using a current official template and acceptance test before enabling downloads.

## 11. Error / Incomplete State

### 11.1 Error set

**SPEC-ERR-001 — Public state codes**

| Code | Meaning | Retry | Records displayable | Export |
|---|---|---|---|---|
| `invalid-input` | malformed address/date/page size | after correcting input | no search result | rejected |
| `unsupported-input` | hex / namespace / NEM input outside contract | no, change input format | no | rejected |
| `wrong-network` | address or node evidence conflicts with expected network | only after selecting correct environment/address | no | rejected |
| `network-identity-unavailable` | required node evidence unavailable or contradictory | after node/config recovery | no result accepted | rejected |
| `invalid-continuation` | token malformed, tampered, or bound to different query | restart first page | previously obtained standalone page may be shown incomplete | rejected for range export |
| `continuation-stale` | snapshot anchor reorged/removed | restart first page | old pages not complete together | rejected |
| `unsupported-schema` | Mongo/adapter source cannot be interpreted against supported schema | after adapter supports it | only independently normalized fields, marked incomplete | rejected |
| `history-incomplete` | requested time coverage not proven or page retrieval interrupted | retry / verify node retention | partial records marked incomplete | rejected |
| `unsupported-transaction-type` | unrecognized transaction code | after compatible spec/adapter | common identity/type code only | rejected for complete Export |
| `unsupported-receipt-type` | unrecognized Receipt code | after compatible spec/adapter | common identity/type code only | rejected |
| `block-timestamp-unavailable` | Receipt Statement → Block timestamp unresolved | retry after source recovery | Receipt details may display incomplete | reject price dependent output |
| `price-unavailable` | no approved stored / returned candle for lookup | retry only if provider data may appear | Receipt unvalued | reject valuation-dependent output |
| `price-provider-unavailable` | bitbank timeout / non-success response | retry with backoff outside contract | cached selected prices may remain usable | otherwise reject |
| `price-provider-invalid-response` | malformed JSON, decimal, pair, interval, or timestamp | retry after provider recovery | no new observation accepted | reject affected rows |
| `price-observation-conflict` | multiple differing observations without approved selected one | no automatic retry resolution | historical record visible, valuation ambiguous | reject |
| `aggregation-ineligible` | known condition prohibits grouping | no | Receipt detail display | daily row excluded only if mode is rejected/incomplete; no partial file |
| `aggregation-unknown` | eligibility cannot be established | after rule/source evidence change | Receipt detail display | reject |
| `cryptact-mapping-unavailable` | no approved action / coin / fee mapping | after official mapping decision | source and valuation display | reject |
| `export-incomplete` | not all selected data / rows pass contract | after fixing source/rules | reasons and counts display | no file |
| `internal-failure` | unexpected server failure | retry may be possible | no complete result guarantee | reject |

### 11.2 Failure precedence

**SPEC-ERR-002**

Input validation occurs before chain query. Network check occurs before returning chain data. Schema and coverage errors precede Summary/Export completion. Price errors are scoped to affected valuation, then propagate to any JPY total, aggregation, or export that requires it. Export mapping and file validation complete before delivery. A lower-level failure may not be transformed into empty successful result or zero value.

### 11.3 Retry / source persistence

**SPEC-ERR-003**

Read-only Node requests and public API GET may be retried. Retrying may add a previously absent Price observation or append a correction candidate, but may not mutate an existing observation or evaluation silently. No application-level automatic repeated retry count is externally specified. User-requested retry must return fresh completeness / provenance status.

## 12. Privacy, Resource, and Version Contract

### 12.1 Privacy / logging

**SPEC-PRIV-001 — No user-history persistence**

Initial runtime does not persist user search condition, normalized Transaction / Receipt, user-linked Receipt evaluation, Summary, Harvest aggregation, or Export archive. Market Price observation is shared persistent data and is not keyed by user address. Browser-held data is limited to displayed page / current results.

**SPEC-PRIV-002 — Log exclusions**

Application / operational logs MUST NOT include MongoDB credentials, connection strings, complete raw Transaction / Receipt, Export contents, persistent search history, or addresses except where a restricted incident diagnostic explicitly requires one and is not retained as general activity history. Do not log Harvest quantity / JPY value tied to an address. Concrete log retention and access policy remain operational decisions; numeric retention is not invented.

### 12.2 Resource contract

**SPEC-RES-001 — Bounded request output**

One detail response contains at most 100 records. Summary response contains at most 100 buckets. Continuation is required for further records / buckets. Browser must not request an unbounded all-record payload; all-record requests are invalid. This does not define an overall maximum period or Export size.

**SPEC-RES-002 — Long history workload**

Conformance workload includes multi-year Transactions, monthly hundreds to thousands of Receipts, and 700 Harvest Fee Receipts in one month as an example. Evaluation records response pagination, completeness, repeatable summary/detail membership, and absence of required browser full-history retention. Numeric response-time, memory, and full-range Export limits await representative measurements (`OPEN-SPEC-008`). Public launch of unbounded all-period Export is BLOCKING until cap / streaming completion semantics are measured and specified.

### 12.3 Compatibility versions

**SPEC-VER-001 — Contract versions**

Response and continuation payload meanings carry `contractVersion=1`; incompatible field semantics, type set, order keys, or continuation meaning require a new contract version and old continuation tokens are rejected. This is an external envelope version, not a database schema claim.

**SPEC-VER-002 — Rule versions**

Price evaluation and Harvest aggregation results MUST identify the exact price / aggregation rule version that produced them. Cryptact mapping MUST identify its approved mapping revision. These version values are intentionally undefined until blockers close; missing rule revision means result is unknown/incomplete, never implicit `v1`.

## 13. Conformance Cases

Cases below are externally observable contract checks, not an implementation unit-test plan. Test fixtures need no secret information.

| Case | Input / condition | Required result |
|---|---|---|
| CT-001 | Valid Mainnet Base32 address in Mainnet runtime | accepted; result identifies Mainnet |
| CT-002 | Valid Testnet Base32 address in Testnet runtime | accepted; result identifies Testnet |
| CT-003 | Valid address for other runtime | `wrong-network`, no records |
| CT-004 | checksum-invalid / malformed / empty address | `invalid-input` |
| CT-005 | hex address, Namespace ID, NEM address | `unsupported-input` |
| CT-006 | `fromDate == toDateExclusive`, malformed date, future date | `invalid-input` |
| CT-007 | Period starts/ends at JST 00:00 inclusive/exclusive | exact expected boundary record set |
| CT-008 | JST month-end / year-end / leap day | month/day buckets follow JST calendar |
| CT-009 | Transaction-only account period | Transaction category only; no Receipt leakage |
| CT-010 | Receipt-only period | Receipt category only; no Transaction leakage |
| CT-011 | All 25 recognized transaction type codes | correct code/name; common fields and type detail completeness declared |
| CT-012 | Known Harvest Fee `0x2143` with target address match | `harvest` classification with Block time and source reference |
| CT-013 | Inflation `0x5143` | recognized `not-harvest`; not in Harvest amount / aggregation |
| CT-014 | Known non-Harvest Receipt | `not-harvest` |
| CT-015 | Unknown Receipt type code | `unsupported-receipt-type`, no guessed amount/Harvest/export |
| CT-016 | Receipt with timestamp absent but resolvable Statement / Block | timestamp derived from Block, not Receipt |
| CT-017 | Statement or Block timestamp unresolved | `block-timestamp-unavailable`, no valuation |
| CT-018 | Multiple Harvest receipts in one Block minute | retain individual identities and order; no timestamp-only deduplication |
| CT-019 | Price Store exact observation hit | same observation reference reused without Provider call requirement |
| CT-020 | Price cache miss and bitbank successful candle | observation provenance stored; evaluation only when selection blocker is closed |
| CT-021 | bitbank timeout / malformed OHLCV | `price-provider-unavailable` / `price-provider-invalid-response`; never zero JPY |
| CT-022 | No target candle / no minute in response / zero-volume candle | explicit unavailable or unresolved price state, no interpolation |
| CT-023 | Changed candle same timestamp | append correction candidate; old observation and dependent evaluation unchanged |
| CT-024 | Same candle data retrieved repeatedly | duplicate is idempotent |
| CT-025 | Harvest candidate passes structural eligibility | remains candidate; Cryptact daily export blocked until eligibility rule accepted |
| CT-026 | Harvest group is ineligible | `aggregation-ineligible`; no grouped row |
| CT-027 | Harvest group eligibility unknown | `aggregation-unknown`; no grouped row and no silent omission |
| CT-028 | Multiple pages, same timestamp / block | stable keyset order with no duplicate / missing item |
| CT-029 | Continuation replay under same parameters | continues after prior composite key |
| CT-030 | Continuation used for another period / address / category / network | `invalid-continuation` |
| CT-031 | Snapshot anchor removed/reorged | `continuation-stale`; all joined pages incomplete |
| CT-032 | Testnet and Mainnet identity evidence mismatch/unknown | fail-closed; no chain-derived result |
| CT-033 | Node source coverage incomplete | partial records visibly incomplete; Summary/Export not complete |
| CT-034 | Cryptact individual file for a type lacking approved mapping | rejected `cryptact-mapping-unavailable` |
| CT-035 | Cryptact Harvest individual / daily mode | not enabled until mapping / price/eligibility/format blockers close |
| CT-036 | Any partial source, missing price, unknown grouping, or unsupported type in full Export | `export-incomplete` / rejected; no file |
| CT-037 | Summary value has no meaning for a record type | `not-applicable`, distinct from numeric zero |
| CT-038 | Over-range native Amount or decimal `NaN` / Infinity | rejected/incomplete; no floating point coercion or clamp |
| CT-039 | Logs and persistence observation | no search/history/evaluation/export archive; shared price data remains address-independent |
| CT-040 | Multi-year / 700 monthly Harvest sample | bounded pages, repeatable coverage, recorded measurements; no claimed numeric pass threshold until OPEN-008 is closed |

## 14. OPEN-001〜010 / Specification blockers

Status names: `RESOLVED-IN-SPEC`, `PARTIALLY-RESOLVED`, `DEFERRED-EXTERNAL-VERIFICATION`, `DEFERRED-OPERATION`, `BLOCKING`.

| OPEN | Status | Specificationで確定したこと | 未決定・根拠 / 実装開始への影響 | 関連Specification ID |
|---|---|---|---|---|
| OPEN-001 税務方式・同日集約境界 | **BLOCKING** | Aggregate責務に税務判断を持ち込まない。Harvest候補、unknown/ineligible、元Receipt保持、個別明細fallbackを定義 | 総平均法 / 移動平均法、同日売却、on-chain順序を跨ぐ集約安全性は税務上の正解をSymTaxが決められない。安全なeligible partitionが確定するまでHarvest Daily Export不可 | SPEC-AGG-001〜005、SPEC-EXPORT-004 |
| OPEN-002 Block timestamp → 1min / OHLC | **BLOCKING** | Epoch conversion、Block timeを価格lookupに使う、JST日付を使わない | bitbank docsはOHLCVとUnix ms timestampを示すがminute anchor / date basis / exact boundaryとOHLC採用値を定めない。Public endpointはこの環境から取得不可。価格評価・円Summary・Harvest Exportをcomplete実装不可 | SPEC-TIME-001〜004、SPEC-PRICE-001、005、007 |
| OPEN-003 missing / zero volume | **BLOCKING (valuation)** | missing/no candle/provider failure/timestamp unavailableを区別。初期は補間なし、0円禁止 | volume 0足の扱いとprice-freeze conditionsに外部または運用根拠がない。価格評価機能をcomplete化不可 | SPEC-PRICE-006、SPEC-ERR-001 |
| OPEN-004 observation correction / reevaluation | **PARTIALLY-RESOLVED** | 保存・再利用、duplicate idempotent、changed valueはappend-only correction候補、自動評価差替え禁止 | correction候補の選択・再評価承認・repair / capacity運用は未確定。決定前はconflictをambiguousにするので価格依存Export不可 | SPEC-PRICE-002〜004、SPEC-PRICE-007 |
| OPEN-005 Cryptact Harvest | **BLOCKING** | Official Japanese CSV fields/date/timezone behaviorsを確認。Cryptact Adapter boundary維持 | Official docsにHarvest Fee typeの取引分類・daily aggregation acceptance / equivalent P&L guidanceなし。STAKINGが別にstaking rewardsを示すのでそれへ推測mappingしない。実アップロードも未実施。Harvest Export不可 | SPEC-EXPORT-001〜007 |
| OPEN-006 Transaction / Receipt association | **RESOLVED-IN-SPEC** | カテゴリ/一覧/summary独立、Receipt source/block参照は正規化根拠に使う | 利用者向けcross-linkは初期必須にしない。関連表示機能を追加しない | SPEC-TX-001〜003、SPEC-RCPT-001〜002 |
| OPEN-007 Mongo schema / history coverage | **DEFERRED-EXTERNAL-VERIFICATION** | raw schema adapter境界、normalized IDs / source references、coverageとunsupportedの扱いを定義 | 実Mainnet/Testnet nodeのversion、statement/storage履歴、address-period coverageは接続検証していない。Mainnet公開・完全履歴claimは実node適合試験までblock。Schema field mapperはImplementation fixtureから推測不可 | SPEC-NET-004、SPEC-TX-001〜004、SPEC-RCPT-001〜004、SPEC-ERR-001 |
| OPEN-008 performance numbers | **BLOCKING (unbounded full export)** | detail / Summary response max 100、keyset paging、multi-year representative workload | response time / memory / Store / full Export byte/time capは計測根拠なし。Browser browsingはcontract可能だがunbounded full-range Export public releaseは未確定 | SPEC-PAGE-001〜005、SPEC-RES-001〜002 |
| OPEN-009 Mainnet/Testnet identity | **PARTIALLY-RESOLVED** | expected runtime fixed、observed Node identity + address network check、mismatch/unknown fail-closed、market prices separate | deployed nodeでidentity evidence availability / pin valuesを検証する必要。環境確認まで該当環境の履歴アクセスを開始できない | SPEC-NET-001〜003 |
| OPEN-010 Privacy/logging | **PARTIALLY-RESOLVED** | user search/history/valuation/Summary/aggregation/exportは利用者別に永続化しない。禁止log fieldを定義 | exact log/staging retention, incident access role, privacy noticeは運用判断。利用者へのnoticeが整備されるまで公開は不可だが基本履歴参照の局所実装は可能 | SPEC-PRIV-001〜002、SPEC-ERR-003 |

### 14.1 Other blocking decisions

| ID | Blocker | Why unresolved | Affected contract |
|---|---|---|---|
| OPEN-SPEC-001 | All 25 Transaction type-specific normalized detail mappings | REST enum lists types but live Mongo source/version and current field coverage are unverified. Need pin common typed fields that make each recognized type complete, not merely label | SPEC-TX-002〜004; FUNC-003; AC-001〜004 |
| OPEN-SPEC-002 | Effective search-period / full export resource limit | no measured max span/output size or execution environment | SPEC-IN-005, SPEC-RES-002, SPEC-EXPORT-006 |
| OPEN-SPEC-003 | JPY / Cryptact price decimal scale and rounding | Cryptact sample demonstrates 10 decimal sample values and separate higher precision spreadsheet, but not max CSV precision or exact arithmetic acceptance | SPEC-NUM-004, SPEC-EXPORT-005/007 |
| OPEN-SPEC-004 | zero-volume and missing candle policy | bitbank format shows volume but no valuation rule for volume zero / no row | SPEC-PRICE-006 |
| OPEN-SPEC-005 | Cryptact protocol/type mapping for Symbol normal Transactions / Receipts | current official generic file schema does not supply Symbol accounting classification | SPEC-EXPORT-002/003 |
| OPEN-SPEC-006 | Stable source / receipt identity contract validated against node versions | source roles are described by public REST schema, but Node storage concrete fields / Block statements not tested | SPEC-RCPT-001/002; SPEC-PAGE-002 |
| OPEN-SPEC-007 | Export CSV exact compliance: line ending/seconds/subsecond/precision behavior | Official template provides header and example, not all serialization/upload constraints. UTF-8 BOM is fixed from the official sample; remaining details require an acceptance test | SPEC-EXPORT-001/007 |
| OPEN-SPEC-008 | bounded performance thresholds and export cap | OPEN-008 | SPEC-RES-001/002 |

These open items are not silently resolved by design assumptions. Features may be built only if they do not claim compliance with a blocked contract. Because price selection, Harvest eligibility, and Cryptact Harvest mapping are required for the primary output use case, overall status is **NOT READY FOR IMPLEMENTATION**. A non-tax history-viewer prototype would be a separate narrowed implementation scope requiring explicit phase decision; it is not approved by this Specification.

## 15. Requirements → Design → Specification → Conformance Traceability

Requirements ID grouping follows the 44 IDs defined in `requirements.md`. Each row shows its Design owner / decision, this document's contract IDs, and at least one conformance case.

| Requirement ID | Design responsibility / decision | Specification ID | Conformance case |
|---|---|---|---|
| CON-001 | Symbol History Adapter / DD-002 | SPEC-NET-004, SPEC-TX-001, SPEC-RCPT-001 | CT-033 |
| CON-002 | Server-only read-only Node boundary | SPEC-NET-004, SPEC-PRIV-002 | CT-039 |
| CON-003 | Independent SymTax Data Store / DD-004 | SPEC-PRICE-004, SPEC-PRIV-001 | CT-019, CT-039 |
| CON-004 | Runtime network binding / DD-007 | SPEC-NET-001〜003 | CT-001〜003, CT-032 |
| CON-005 | Shared persistent Price Store / DD-003/010 | SPEC-PRICE-001〜004 | CT-019〜024 |
| CON-006 | JST calendar vs lookup instant | SPEC-TIME-001〜004 | CT-007〜008 |
| CON-007 | Single Next.js Server logical boundary / DD-008 | SPEC-GEN-001, SPEC-NET-004 | CT-039 |
| FUNC-001 | Input validation, guard, Browse Services | SPEC-IN-001〜005, SPEC-NET-001〜003, SPEC-PAGE-001〜005 | CT-001〜008, CT-028〜032 |
| FUNC-002 | Independent Browse models / DD-005 | SPEC-TX-001, SPEC-RCPT-001, SPEC-SUM-001 | CT-009〜010 |
| FUNC-003 | Transaction normalizer | SPEC-TX-002〜004 | CT-011 |
| FUNC-004 | Statement / Receipt normalizer and classifier | SPEC-RCPT-001〜005 | CT-012〜017 |
| FUNC-005 | Summary navigation | SPEC-SUM-001/002, SPEC-PAGE-005 | CT-007〜010 |
| FUNC-006 | JST Calendar Boundary | SPEC-TIME-003 | CT-007〜008 |
| FUNC-007 | Category Summary Service | SPEC-SUM-002〜004 | CT-009〜010, CT-037 |
| FUNC-008 | Normalized source refs | SPEC-TX-001, SPEC-RCPT-001, SPEC-SUM-004 | CT-012, CT-018 |
| FUNC-009 | Optional association; preserve independence | SPEC-TX-003, SPEC-RCPT-002, SPEC-SUM-001 | CT-009〜010 |
| EXPORT-001 | Export mode adapter | SPEC-EXPORT-001〜007 | CT-034〜036 |
| EXPORT-002 | Individual export path | SPEC-EXPORT-002, SPEC-EXPORT-006 | CT-034 |
| EXPORT-003 | Harvest scope guard | SPEC-RCPT-005, SPEC-AGG-002 | CT-012〜015 |
| EXPORT-004 | JST eligibility / partition | SPEC-TIME-003, SPEC-AGG-001/004 | CT-007〜008, CT-025〜027 |
| EXPORT-005 | Component Receipt references | SPEC-AGG-003/005 | CT-025〜027 |
| EXPORT-006 | Valuation + aggregation provenance | SPEC-PRICE-007, SPEC-AGG-003/005, SPEC-EXPORT-004/005 | CT-019〜027 |
| EXPORT-007 | Cryptact format validator | SPEC-EXPORT-001〜007 | CT-034〜036 |
| PRICE-001 | bitbank Provider adapter | SPEC-PRICE-001〜004 | CT-019〜024 |
| PRICE-002 | Block-time normalization / lookup | SPEC-TIME-001/002/004, SPEC-PRICE-005 | CT-016〜018, CT-020〜022 |
| PRICE-003 | Persistent observation store | SPEC-PRICE-002〜004 | CT-019, CT-023〜024, CT-039 |
| PRICE-004 | Receipt evaluation evidence | SPEC-PRICE-007 | CT-016〜020, CT-023 |
| PRICE-005 | Missing / ambiguous state | SPEC-PRICE-006, SPEC-ERR-001/002 | CT-021〜022 |
| DATA-001 | Raw source / derived values / DD-009 | SPEC-TX-001, SPEC-RCPT-001, SPEC-SUM-004, SPEC-AGG-005 | CT-018, CT-025 |
| DATA-002 | Coverage propagation / export completion | SPEC-ERR-001/002, SPEC-EXPORT-006 | CT-031〜036 |
| DATA-003 | Request-local user data / DD-009 | SPEC-PRIV-001/002 | CT-039 |
| PERF-001 | Filtered Symbol adapter | SPEC-IN-005, SPEC-PAGE-001〜005 | CT-028〜033 |
| PERF-002 | Chunked Browse / validation workload | SPEC-RES-001/002 | CT-040 |
| PERF-003 | Server-side normalizing / minimal payload | SPEC-GEN-002, SPEC-PAGE-001, SPEC-RES-001 | CT-028, CT-040 |
| PERF-004 | Incremental detail / bounded processing | SPEC-PAGE-001〜005, SPEC-RES-001/002 | CT-028〜031, CT-040 |
| QUAL-001 | incomplete-state propagation | SPEC-ERR-001〜003, SPEC-EXPORT-006 | CT-017, CT-021〜022, CT-033, CT-036 |
| SEC-001 | No secrets/signing capability | SPEC-GEN-003, SPEC-PRIV-001 | CT-001〜005, CT-039 |
| SEC-002 | Server-only / read-only Node adapter | SPEC-NET-004, SPEC-PRIV-002 | CT-039 |
| SEC-003 | Runtime expected/observed network guard | SPEC-NET-001〜003 | CT-001〜003, CT-032 |
| PRIV-001 | Request-local user data / minimal logs | SPEC-PRIV-001/002 | CT-039 |
| SEC-004 | Independent SymTax Store | SPEC-PRICE-004, SPEC-PRIV-001 | CT-019, CT-039 |
| EXT-001 | Price Store read-through | SPEC-PRICE-001〜006 | CT-019〜024 |
| EXT-002 | Cryptact Adapter / validation | SPEC-EXPORT-001〜007 | CT-034〜036 |
| EXT-003 | Symbol adapter compatibility boundary | SPEC-TX-001〜004, SPEC-RCPT-001〜004, SPEC-ERR-001 | CT-011, CT-015, CT-033 |

## 16. 適用資料・外部確認記録

### 16.1 承認済みプロジェクト資料

- [Concept](concept.md)
- [Requirements](requirements.md)
- [Design](design.md)
- [Concept Review 001](reviews/concept/concept-review-001.md) — READY
- [Requirements Review 001](reviews/requirements/requirements-review-001.md) — READY
- [Design Review 001](reviews/design/design-review-001.md) — READY、Required Changesなし

### 16.2 Symbol — protocol / schema / implementationの区分

- [Symbol Account](https://docs.symbol.dev/concepts/account.html): encoded addressは39文字Base32。Addressはnetwork informationを含む。
- [Symbol Cryptography](https://docs.symbol.dev/concepts/cryptography.html): raw addressは24 bytes (network byte, 160-bit key hash, 3-byte checksum)。
- [Symbol Receipt](https://docs.symbol.dev/concepts/receipt.html): Statement / Receiptの関係、`HARVEST_FEE 0x2143`はharvest blockのfee recipient/account/amount、`INFLATION 0x5143`はnetwork currency creation。
- [Symbol serialization](https://docs.symbol.dev/serialization/index.html): Symbol timestampはNemesisからのmilliseconds、network `/network/properties`のepochAdjustmentでUnix timeへ変換。NetworkType Mainnet `0x68`, Testnet `0x98`、Transaction / Receipt Type列挙。
- [Symbol network properties API schema](../../../docs/knowledge/symbol-openapi3.yml): `/network`, `/network/properties`, DTO・Type enum・Timestamp・Receipt Statement schemaを参照。Repository knowledge snapshotであり、live Node BSON schemaとは扱わない。
- `_symbol/client/catapult` checkout `14a0cc16e`: Address checksumがSHA3-256 first 3 bytesである実装、Receipt type / HarvestFeeObserver / Mongo mapperを照合。この特定Catapult checkoutの実装確認であり、全Node版のDB契約ではない。
- [Symbol XYM exchange integration](https://docs.symbol.dev/ja/guides/exchanges/exchange-integration.html): XYM divisibility 6、native unitの関係。Mainnet IDをnetwork共通IDとして扱わない。

### 16.3 bitbank Public API

- Official [Public API candle docs](https://github.com/bitbankinc/bitbank-api-docs/blob/master/public-api.md#candlestick) support pair list, `1min`, `YYYYMMDD` for minute candles, `[open, high, low, close, volume, unix timestamp milliseconds]`.
- Official [pairs](https://github.com/bitbankinc/bitbank-api-docs/blob/master/pairs.md) includes `xym_jpy`.
- Official docs do not specify minute timestamp anchor, candle time-zone/date-path basis, OHLC tax selection, zero-volume valuation, missing-candle interpolation.
- Current task environment `curl -L https://public.bitbank.cc/xym_jpy/candlestick/1min/20260923` failed DNS resolution (`Could not resolve host`). Prior Concept records user-confirmed availability for 2025-01-01 and 2026-01-01; that user verification was not independently reproduced in this task and is not an official retention guarantee.

### 16.4 Cryptact official material

- [カスタムファイルの作成方法](https://support.cryptact.com/hc/ja/articles/360002571312-%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%A0%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%81%AE%E4%BD%9C%E6%88%90%E6%96%B9%E6%B3%95), updated 2026-08-12: Japanese CSV/XLSX, 10 field order, date format, required / optional, values and custom file notes.
- [Official Japanese CSV sample attachment](https://support.cryptact.com/hc/article_attachments/16258358690713): exact Japanese header and UTF-8 BOM sample visible.
- [取引種類別の計算方法](https://support.cryptact.com/hc/ja/articles/12814753146777-%E5%8F%96%E5%BC%95%E7%A8%AE%E9%A1%9E%E5%88%A5%E3%81%AE%E8%A8%88%E7%AE%97%E6%96%B9%E6%B3%95), updated 2026-08-14: `STAKING` describes staking reward and its calculation semantics.
- [カスタムファイル upload / timezone](https://support.cryptact.com/hc/ja/articles/7557126434457-%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%A0%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%81%AE%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E6%96%B9%E6%B3%95): uploaded custom file uses ledger timezone by default; user can select timezone to match file.
- No official material located that directly classifies a Symbol Harvest Fee Receipt or approves daily Harvest aggregation/economic equivalence. No Cryptact account upload or live P/L comparison was performed.

## 17. 自己確認

- [x] Requirementsの44 IDをTraceability表へ割当てた。
- [x] Mainnet / Testnet、Transaction / Receipt、JST bucket / real instantの分離を維持した。
- [x] Receipt timestampを作らず、StatementとBlockから評価時刻を導く。
- [x] Symbol Amountはinteger string、価格・計算値はbinary floatを使わない。
- [x] Price observationとReceipt evaluationを分け、既存observationを訂正値で上書きしない。
- [x] Price missing、unknown Harvest、unsupported Type、incomplete historyを0や正常成功へ変換しない。
- [x] 初期daily compressionを`HARVEST_FEE`に限定し、原Receipt referenceを保持する契約を記載した。
- [x] Cryptact file schemaとHarvest tax/action mappingの確認事実を区別した。
- [x] MongoDB raw document / collection / queryをBrowser contractに出していない。
- [x] Search condition / user history / evaluation / exportのuser-linked persistenceを禁止し、shared market observationを区別した。
- [x] Required OHLC / Harvest eligibility / Harvest mapping / resource capsの未解決項目をBLOCKINGとした。実装開始可能と報告しない。
- [x] Formal Spec Reviewは実施していない。
