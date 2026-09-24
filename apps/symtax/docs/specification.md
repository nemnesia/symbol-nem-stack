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
| complete / partial / incomplete | completeは必要条件が揃う、partialは識別できた型固有情報が一部欠ける、incompleteは範囲・参照関係・評価根拠が閉じていない状態 |
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

**SPEC-NET-002 — Pinned public-network identity evidence**

Runtimeのexpected identityは配備ごとにMainnetまたは公開Testnetのどちらかへ固定し、利用者入力では切り替えない。初期対応するpublic networkの期待値は次のとおり。

| runtime | NetworkType / identifier | generationHashSeed | epochAdjustment |
|---|---:|---|---:|
| Mainnet | `0x68` / 104 | `57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6` | `1615853185s` |
| Testnet | `0x98` / 152 | `3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155` | `1616694977s` |

Server MUST independently obtain observed NetworkType from Symbol `GET /network` and `generationHashSeed`, `epochAdjustment` from `GET /network/properties`. Acceptance requires the exact expected tuple `(NetworkType, generationHashSeed)`; `epochAdjustment` must also match the pinned public-network value because it controls block-time conversion. `/network/properties.identifier` is an additional consistency check, not a substitute for the tuple. Values must parse in their documented representations; seed is exactly 32 bytes / 64 hexadecimal digits, NetworkType is the known one-byte enum, and epoch adjustment is an integer number of seconds with optional documented `s` suffix.

Every returned block must also carry the same network identifier when the source representation provides it. Missing required evidence, malformed evidence, unknown expected values, an unsupported/private network, or any mismatch yields respectively `network-identity-unavailable` or `wrong-network`. The server MUST fail closed before returning chain-derived data. If mismatch is discovered during a paginated browse or export, all pages / staged output from that request are discarded and no partial success is returned. Deployment text such as `NETWORK=mainnet` alone is not evidence.

The tuple and timestamp parameters are based on Symbol's official [secure node guide](https://docs.symbol.dev/guides/network/running-a-secure-symbol-node.html) and [network API schema](../../../docs/knowledge/symbol-openapi3.yml). The `NetworkType` values are protocol identifiers; the pinned seed and epoch are public-network configuration values, not universal constants for private networks.

**SPEC-NET-003 — 結果・Continuation分離**

結果、continuation、request contextはnetworkに束縛する。別network用continuationは拒否する。Price observationはXYM/JPY市場共通でnetwork非依存だが、chain-derived Receipt / Summary / Evaluationをnetwork間で再利用しない。

**SPEC-NET-004 — Read-only境界**

Symbol Node MongoDBはServer adapterからread-onlyでのみ参照し、Browserへcredentialまたはraw BSONを渡さない。Node DBを書き換える要求は存在しない。Node schema / coverage不整合は`unsupported-schema`または`history-incomplete`。Node MongoDBとSymTax Data Storeのinstance分離および運用境界は`SPEC-STORE-001`に従う。

### 3.3 期間入力

**SPEC-IN-005 — Period契約**

検索期間はISO 8601暦日`fromDate` inclusiveと`toDateExclusive` exclusive (`YYYY-MM-DD`)。両方をJST calendar boundaryとして解釈し、対象期間は`[fromDate 00:00 JST, toDateExclusive 00:00 JST)`とする。`fromDate < toDateExclusive`が必須。日付のみの入力にUTC暗黙変換を適用しない。

要求calendar boundaryが現在日・当月の後端（翌日または翌月初日）を指すことは許可する。Request受理時の現在instantをUTCで一度固定し、実効上限を`min(toDateExclusive 00:00 JST, requestNow)`とする。したがって今日・今月を含む照会は現在までの履歴を返す。実効上限が`fromDate 00:00 JST`以下なら`future-period`で拒否する。今日以降のみの未来期間、明日だけ、完全な未来期間は拒否する。`toDateExclusive`が今日より先という理由だけでは拒否しない。

空期間・不正暦日・`fromDate >= toDateExclusive`は`invalid-input`。Requested period全体がNode保持開始より古い等、coverageを立証できない場合に自動で切り詰めず`history-incomplete`とする。最大期間を根拠なく設定しない。Month navigationは月初から翌月月初、Day navigationは当日から翌日をcalendar boundaryとして渡す。

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

Browser向けrecordはSymbol MongoDB BSONを公開せず、Symbol adapterが検証・正規化した値に限る。全recordは`network`, `identity`, `typeCode`, `typeName`, `blockReference`, `blockTimestamp`, `addressRoles`, `sourceReference`, `completeness`の意味を持つ。`completeness`は`complete`, `partial`, `incomplete`, `unsupported`のいずれか。Block timestampを解決できないrecordはtimestampを偽造せずunavailable理由とする。

`identity`は同じnetwork / category内で一意かつ継続読取でも安定するsource-derived identity。`sourceReference`は利用者が元recordの照合に使えるSymbol上のidentifier / Block / Statement sourceを含む。MongoDB collection名・内部document IDを公開仕様にしない。

### 5.2 Transaction

**SPEC-TX-002 — Common Transaction fields**

Confirmed outer transactionのcomplete recordには、expected network、32-byte transaction hash、block height/hash、Block由来UTC instant、type code/name、signer address、fee absolute units、request addressとのsource-derived role、必要なtype detail、source referenceが必要。Type detailで定義しないフィールドは`not-applicable`、required sourceが欠落すれば`partial`、identity / block / signer / feeなど共通必須値が欠落・矛盾すれば`incomplete`。recognizedであることだけではcompleteを意味しない。

Aggregate embedded transactionは外側transaction hashとblock referenceに結び、identityを`outer hash + embedded index`とする。Embedded feeは`not-applicable`（外側feeへ重複計上しない）。Embedded signer/address rolesと各type detailはembedded sourceから正規化する。Source referenceはnetwork、block height/hash、outer hash、embedded index（該当時）を含み、MongoDB ObjectIdを含めない。

| Normalized semantic | 意味・必須性 |
|---|---|
| `identity` / `sourceReference` | 上記の安定したprotocol/source identity。重複または参照矛盾はincomplete |
| `blockReference` / `timestamp` | Block height/hashと`SPEC-TIME-001`のUTC instant。Transaction自身の時刻で代替しない |
| `type` | uint16 codeと公式schema名。unknownは既知typeへ代入しない |
| `signer` / `addressRoles` | signer address必須。対象addressがsigner、recipient、target、explicit source、aggregate participant等どの役割か、型別sourceから列挙 |
| `fee` | outer confirmed transactionのnative absolute fee文字列。Embeddedは`not-applicable` |
| `mosaics` / `amounts` | type detailで意味が定義される場合だけmosaic IDとunsigned absolute integerを表す。operation deltaとtransfer amountを区別 |
| `completeness` | `complete`, `partial`, `incomplete`, `unsupported`。欠損をzero/emptyで補完しない |

**SPEC-TX-003 — Recognized Transaction type details**

以下のtypeごとに記載した意味fieldを正規化する。共通 signer、outer fee、identity、Block、sourceReferenceは各行へ適用する。Transaction表のsource member名は固定したSymbol OpenAPI DTOのproperty表記であり、Catbuffer protocol semanticsへ対応する。これらはMongoDB raw keyを意味しない。`amount/mosaic = N/A`はprotocol typeに数量移動を意味するfieldがないことを表し、0ではない。

| Code / type | 必須 type-specific semantic fields | Address roles | Amount / mosaic / fee | Type detailが欠ける場合 | Symbol source members |
|---|---|---|---|---|---|
| `0x414C AccountKeyLink` | linked public key, link action | signer account | amount/mosaic N/A; outer fee | partial | `linkedPublicKey, linkAction` |
| `0x424C NodeKeyLink` | linked public key, link action | signer account | N/A; outer fee | partial | `linkedPublicKey, linkAction` |
| `0x4243 VrfKeyLink` | linked public key, link action | signer account | N/A; outer fee | partial | `linkedPublicKey, linkAction` |
| `0x4143 VotingKeyLink` | linked public key, start/end epoch, link action | signer account | N/A; outer fee | partial | `linkedPublicKey, startEpoch, endEpoch, linkAction` |
| `0x4141 AggregateComplete` | transactions hash commitment, ordered embedded transactions, cosignature public keys; cosignature list may be empty only when source confirms none | outer signer, embedded participant signers, cosigners | no aggregate synthetic amount; child amounts remain child detail; outer fee once | partial if required child/cosignature source absent | `transactionsHash, transactions[], cosignatures[]` |
| `0x4241 AggregateBonded` | same as AggregateComplete | same | same | same | `transactionsHash, transactions[], cosignatures[]` |
| `0x414D MosaicDefinition` | nonce, mosaic flags, divisibility, duration | signer/creator | created mosaic identifier when resolved; no transfer amount; outer fee | partial | `nonce, flags, divisibility, duration` |
| `0x424D MosaicSupplyChange` | mosaic ID, unsigned amount delta, supply action (increase/decrease) | signer/issuer | supply delta is not a transfer; mosaic ID required; outer fee | partial | `mosaicId, delta, action` |
| `0x434D MosaicSupplyRevocation` | source address, mosaic ID, amount | signer and explicit source address | revoked amount, mosaic ID; outer fee | partial | `sourceAddress, mosaicId, amount` |
| `0x414E NamespaceRegistration` | registration type, namespace ID, name, parent ID when subnamespace, duration when supplied | signer/registrant | no transferred mosaic; outer fee | partial | `registrationType, id, name, parentId, duration` |
| `0x424E AddressAlias` | namespace ID, target address, alias action | signer, target address | N/A; outer fee | partial | `namespaceId, address, aliasAction` |
| `0x434E MosaicAlias` | namespace ID, target mosaic ID, alias action | signer | N/A; outer fee | partial | `namespaceId, mosaicId, aliasAction` |
| `0x4144 AccountMetadata` | target address, scoped metadata key, value size delta, value bytes | signer, target address | no transfer amount; outer fee | partial | `targetAddress, scopedMetadataKey, valueSizeDelta, valueSize, value` |
| `0x4244 MosaicMetadata` | target address, target mosaic ID, scoped key, size delta, value bytes | signer, target address | no transfer amount; outer fee | partial | `targetAddress, targetMosaicId, scopedMetadataKey, valueSizeDelta, valueSize, value` |
| `0x4344 NamespaceMetadata` | target address, target namespace ID, scoped key, size delta, value bytes | signer, target address | no transfer amount; outer fee | partial | `targetAddress, targetNamespaceId, scopedMetadataKey, valueSizeDelta, valueSize, value` |
| `0x4155 MultisigAccountModification` | min approval/removal deltas, ordered address additions/deletions | signer and each explicit modified address | N/A; outer fee | partial | `minRemovalDelta, minApprovalDelta, addressAdditions[], addressDeletions[]` |
| `0x4148 HashLock` | locked mosaic ID/amount, duration, aggregate hash | signer | lock amount is locked balance, not a transfer; outer fee | partial | `mosaicId, amount, duration, hash` |
| `0x4152 SecretLock` | recipient address, secret, hash algorithm, mosaic ID/amount, duration | signer, recipient | locked amount; outer fee | partial | `recipientAddress, secret, hashAlgorithm, mosaicId, amount, duration` |
| `0x4252 SecretProof` | recipient address, secret, hash algorithm, proof | signer, recipient | N/A; outer fee | partial | `recipientAddress, secret, hashAlgorithm, proof` |
| `0x4150 AccountAddressRestriction` | restriction flags, ordered address additions/deletions | signer, listed addresses | N/A; outer fee | partial | `restrictionFlags, restrictionAdditions[], restrictionDeletions[]` |
| `0x4250 AccountMosaicRestriction` | restriction flags, ordered mosaic additions/deletions | signer | N/A; outer fee | partial | `restrictionFlags, restrictionAdditions[], restrictionDeletions[]` |
| `0x4350 AccountOperationRestriction` | restriction flags, ordered transaction type additions/deletions | signer | N/A; outer fee | partial | `restrictionFlags, restrictionAdditions[], restrictionDeletions[]` |
| `0x4151 MosaicGlobalRestriction` | target/reference mosaic IDs, restriction key, previous/new values and restriction types | signer/creator | N/A; outer fee | partial | `mosaicId, referenceMosaicId, restrictionKey, previousRestrictionValue, newRestrictionValue, previousRestrictionType, newRestrictionType` |
| `0x4251 MosaicAddressRestriction` | mosaic ID, restriction key, previous/new values, target address | signer, target address | N/A; outer fee | partial | `mosaicId, restrictionKey, previousRestrictionValue, newRestrictionValue, targetAddress` |
| `0x4154 Transfer` | recipient address, ordered mosaics (mosaic ID + absolute amount), message bytes/type | signer/sender, recipient | transferred mosaics only; outer fee | partial | `recipientAddress, mosaics[], message` |

Optional fields are `not-applicable` only where the type schema makes them optional (for example, root namespace duration, parent ID, or absent message); they are not silently zero-filled. A known type with required detail missing is `partial` and cannot satisfy complete-detail acceptance or Export. Type code outside this recognized set is `unknown` and behavior is `unsupported-transaction-type`: only independently validated common identity/type code may be displayed, no inferred details, no complete Summary/Export.

**SPEC-TX-004 — Initial recognized code set and source profile**

Recognized code set is exactly the 25 codes in `SPEC-TX-003`, corresponding to the repository's Symbol Catbuffer `transaction_type.cats` and the pinned Symbol OpenAPI snapshot. Symbol Catbuffer defines protocol payload semantics; the `_symbol/client/catapult` checkout at `14a0cc16e` is only a concrete mapper profile. For that profile, Mongo mapper exposes transaction body plus metadata for inclusion/source linkage; this is not a universal MongoDB contract. An implementation MUST qualify its node/schema profile against these semantic records before marking it supported. Unknown schema version or unresolvable source-to-semantic mapping is `unsupported-schema`, not an alternate field guess.

### 5.3 Receipt

**SPEC-RCPT-002 — Common Receipt fields and source identity**

Receipt identityは`network + blockHeight + statementKind + sourcePrimaryId + sourceSecondaryId + receiptOrdinal`で構成する。Statement sourceのprimary/secondaryはCatbuffer `ReceiptSource`のprotocol意味（block内transaction index、aggregate inner indexの例）に対応する。Receipt自身のtimestampは存在しないものとして扱い、timestampはStatement heightとBlockから解決する。`sourceReference`はこの値に加えてBlock hashを持つ。Receipt type固有のmosaic / amount / target / sender / recipientは次の表に従う。

| Normalized semantic | 意味・必須性 |
|---|---|
| identity / type | network付きstatement sourceとreceipt ordinal、およびuint16 type code/name。Receipt BSON IDは使用しない |
| statement source | statement kind、height、primary/secondary source IDs、receipt ordinal |
| block reference / time | statement heightからBlock height/hashと`SPEC-TIME-001` UTC instantを解決。欠落時は`block-timestamp-unavailable` |
| amount / mosaic | type表に定義した場合のみmosaic IDとunsigned absolute integer string。valueはSymbol native unitで、方向をschemaにない限り推測しない |
| address roles | sender, recipient, targetは別semantic role。存在しないfieldは`not-applicable` |
| Harvest state | `harvest`, `not-harvest`, `unknown`と理由。Receipt type 0x2143単独の型名以外に、Harvest分類要件を満たす必要あり |
| completeness | `complete`, `partial`, `incomplete`, `unsupported`。identity / statement source / height / block resolution欠損はincomplete |

**SPEC-RCPT-003 — Recognized Receipt type semantic mapping**

| Code / type | Source semantic / amount & mosaic | Address roles | Harvest state / statement-block relation | Completeness condition | Catbuffer source members |
|---|---|---|---|---|---|
| `0x124D MOSAIC_RENTAL_FEE` | BalanceTransferReceipt: transferred mosaic ID + absolute amount | sender, recipient | not-harvest; Statement source and Block height required | mosaic, amount, sender, recipient and statement source present | `mosaic.id, mosaic.amount, sender_address, recipient_address` |
| `0x134E NAMESPACE_RENTAL_FEE` | BalanceTransferReceipt: transferred mosaic ID + absolute amount | sender, recipient | not-harvest | same as above | `mosaic.id, mosaic.amount, sender_address, recipient_address` |
| `0x2143 HARVEST_FEE` | BalanceChangeReceipt: credited mosaic ID + amount | target (harvester) | harvest only when `SPEC-RCPT-005` all match; Block time from statement | mosaic, amount, target, source, height, Block timestamp present | `mosaic.id, mosaic.amount, target_address` |
| `0x2248 LOCK_HASH_COMPLETED` | BalanceChangeReceipt: recorded mosaic + amount | target | not-harvest | mosaic, amount, target and source present | `mosaic.id, mosaic.amount, target_address` |
| `0x2348 LOCK_HASH_EXPIRED` | BalanceChangeReceipt: recorded mosaic + amount | target | not-harvest | same | `mosaic.id, mosaic.amount, target_address` |
| `0x3148 LOCK_HASH_CREATED` | BalanceChangeReceipt: recorded mosaic + amount | target | not-harvest | same | `mosaic.id, mosaic.amount, target_address` |
| `0x2252 LOCK_SECRET_COMPLETED` | BalanceChangeReceipt: recorded mosaic + amount | target | not-harvest | same | `mosaic.id, mosaic.amount, target_address` |
| `0x2352 LOCK_SECRET_EXPIRED` | BalanceChangeReceipt: recorded mosaic + amount | target | not-harvest | same | `mosaic.id, mosaic.amount, target_address` |
| `0x3152 LOCK_SECRET_CREATED` | BalanceChangeReceipt: recorded mosaic + amount | target | not-harvest | same | `mosaic.id, mosaic.amount, target_address` |
| `0x414D MOSAIC_EXPIRED` | artifact mosaic ID; amount not-applicable | no address role in Receipt | not-harvest | artifact ID and source/height present | `artifact_id` |
| `0x414E NAMESPACE_EXPIRED` | artifact namespace ID; amount not-applicable | none | not-harvest | artifact ID and source/height present | `artifact_id` |
| `0x424E NAMESPACE_DELETED` | artifact namespace ID; amount not-applicable | none | not-harvest | artifact ID and source/height present | `artifact_id` |
| `0x5143 INFLATION` | created mosaic ID; Receipt schema has no amount field | no target; not a harvester credit | not-harvest | mosaic and source/height present; quantity is not-applicable | `mosaic.id` |
| `0xE143 TRANSACTION_GROUP` | grouping marker only; no mosaic/amount | none | not-harvest | type and source/height present | `Receipt type/version only` |
| `0xF143 ADDRESS_ALIAS_RESOLUTION` | address resolution entry: unresolved/resolved address values in statement; no amount | no transfer role | not-harvest | resolution values and source/height present | `address resolution entry: unresolved, resolved, source` |
| `0xF243 MOSAIC_ALIAS_RESOLUTION` | mosaic resolution entry: unresolved/resolved mosaic IDs; no amount | none | not-harvest | resolution values and source/height present | `mosaic resolution entry: unresolved, resolved, source` |

Catbuffer member names above describe protocol semantics; actual Node Mongo projection names remain adapter-specific and are qualified under `SPEC-TX-004` / OPEN-007. Statement identity members are `height`, `source.primaryId`, `source.secondaryId`, and the receipt array ordinal; a Receipt has no timestamp field. The meanings above follow Symbol Catbuffer receipt inheritance: rental receipts are balance transfers; Harvest Fee, lock created/completed/expired receipts are balance changes; expiry/deletion receipts carry artifact IDs; Inflation carries a created mosaic; resolution receipts are statement resolution records. An amount is not assigned where the protocol shape has no amount. Where the supported Node source does not provide a required protocol semantic, completeness is `partial` or `incomplete`; it is never inferred from the initiating transaction.

**SPEC-RCPT-004 — Unknown / unsupported type**

An unrecognized numeric type code is `unknown` and `unsupported-receipt-type`; when identity and Statement/Block references remain valid, common identity, code, source and timestamp may be displayed, but type details, amount, target, Harvest classification are unavailable and complete Summary/Export is prohibited. A recognized code with missing required type-specific source is `partial`; missing identity/statement/block linkage is `incomplete`. A source schema that cannot be interpreted as the supported adapter profile is `unsupported-schema`. These states are distinct and never fallback to a known type.


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

**SPEC-NUM-004 — Exact price and valuation arithmetic**

All arithmetic uses exact decimal/rational values; binary floating point is forbidden. For a verified Harvest Fee Receipt, `individualEvaluationPrice = (open + high + low + close) / 4`, with the four Provider decimal values summed exactly and divided by 4 before multiplication; OHLC inputs are not pre-rounded. `individualEvaluatedJPY = (amountAbsolute / 1,000,000) × individualEvaluationPrice`. No intermediate rounding is performed. Display and internal values preserve the exact result. Cryptact CSV serialization emits exact decimal text only when every numeric value has fewer than 15 fractional digits (Cryptact's current custom-file guide directs values with 15+ fractional digits to its Excel sample). If exact representation is not possible within that CSV rule, reject the export as `cryptact-format-unavailable`; do not round to a different value. Rounding mode for accepted CSV values is therefore none. XYM quantity display has at most six exact decimal places.

**SPEC-NUM-005 — Overflow / malformed number**

UInt64範囲外、負のon-chain amount、数値文字列構文違反は`unsupported-schema`。Symbol native unitsの加算にoverflowがあればAggregateをcompleteにせず`internal-failure`。応答値の上限・任意精度実装量を超える場合も0や上限値へclampせず失敗とする。

### 7.2 Currency applicability

Price sourceはXYM/JPYのみ。他mosaicはXYMとして評価しない。円金額には`JPY`と明示し、価格・数量の単位を省略しない。

## 8. bitbank Price Observation / Evaluation

### 8.1 Provider contract

**SPEC-PRICE-001 — Market**

Initial source is bitbank Public API pair `xym_jpy`, candle `1min`. Official docs define minute request date as `YYYYMMDD` and candle tuple `[open, high, low, close, volume, unix timestamp milliseconds]`; they do not state whether entry timestamp anchors the minute start or end. The `xym_jpy` 1min timestamp anchor was verified by the live API comparison in §16.3 and is specified in `SPEC-PRICE-005`. The timestamp is compared as an absolute Unix-millisecond instant; the SymTax JST calendar is not used as a price lookup key.

**SPEC-PRICE-002 — Required observation data**

Each accepted observation carries provider `bitbank-public`, pair `XYM/JPY`, interval `1min`, provider timestamp in integer Unix milliseconds, OHLCV exact decimal strings, server `fetchedAt` UTC instant, request date, response schema/profile provenance, and an identity from market + interval + timestamp + canonical OHLCV tuple. Observation is shared market data, not address or network keyed.

**SPEC-PRICE-003 — Duplicate and changed observation**

Same market, interval, timestamp and canonical OHLCV is an idempotent duplicate. Changed OHLCV at the same market-minute key is an append-only `correction-candidate`; it never overwrites an existing observation or silently changes any evaluation. More than one value candidate makes that minute `ambiguous` (`price-observation-conflict`) until an explicit selection policy is approved. No automatic re-evaluation feature is introduced.

**SPEC-PRICE-004 — Retention / reuse**

Observations persist in the independent SymTax Price Store, are reusable during Provider outage, are market-shared, and are not deleted solely due to age. Existing chosen observation and evaluation provenance are immutable.

### 8.2 Block-to-minute and evaluation rule

**SPEC-PRICE-005 — Timestamp matching and price rule**

Lookup input is the exact UTC Block instant from `SPEC-TIME-001`; JST date is never the lookup key. For bitbank `xym_jpy` `1min`, the live API comparison recorded in §16.3 confirms that the OHLCV tuple timestamp is the start of its one-minute interval. For Block Unix milliseconds `B`, select only the row whose candle timestamp equals `minuteStart = floor(B / 60000) × 60000`; its interval is `[minuteStart, minuteStart + 60000)`. A Block instant exactly on a minute boundary belongs to the candle starting at that boundary; one millisecond before belongs to the preceding candle and one millisecond after belongs to the new candle. Do not search adjacent minutes or use a JST date as the lookup key. This is an empirical bitbank Public API finding for the observed pair/interval, not a timestamp-anchor statement made by bitbank's documentation.

SymTax evaluation rule identifier is `symtax-harvest-ohlc-arithmetic-mean-1`: `price=(O+H+L+C)/4`. This is a SymTax product valuation rule for reproducibility. It is not the price supplied directly by bitbank, tax advice, a legally unique correct market price, or a Cryptact recommendation. Exact arithmetic and no intermediate rounding follow `SPEC-NUM-004`.

**SPEC-PRICE-006 — Missing / provider failure**

| Condition | Result | Evaluation / aggregation / export |
|---|---|---|
| Verified target candle absent or response omits the minute selected by `SPEC-PRICE-005` | `price-unavailable` with reason; no interpolation or neighboring candle | no evaluation, no JPY total, no aggregation, price-dependent Export rejected |
| `volume = 0` | `price-unavailable(zero-volume-candle)` even if OHLC fields are present | no evaluation; no fallback |
| Provider timeout/non-success | `price-provider-unavailable` | reuse only an already uniquely selected immutable observation; otherwise unavailable |
| malformed response / invalid decimal / wrong pair or interval | `price-provider-invalid-response`; do not accept observation | no evaluation for affected record |
| Price Store absent/unavailable | `price-store-unavailable` | no complete evaluation |
| Block timestamp unresolved | `block-timestamp-unavailable`; do not query price | no evaluation |

No zero-yen fallback, carry-forward, interpolation, or nearest-candle search is allowed. Price missing is not numeric zero.

**SPEC-PRICE-007 — Receipt evaluation evidence**

Evaluation exposes receipt reference, absolute XYM amount, exact block instant, selected observation identity (when available), provider/pair/interval, individual evaluation price, exact evaluated JPY, rule identifier, completeness, and unavailable reason. Same inputs and versions produce identical results. Evaluation itself is request-local, while its shared observation provenance is persistent.

## 9. Harvest Eligibility / Daily Aggregation

**SPEC-AGG-001 — Explicit opt-in and warning**

Individual Harvest Receipt output is the default. Harvest daily aggregation runs only when the user explicitly selects `mode=daily-harvest`; it is an optional row-count reduction feature. Before confirmation, the application MUST show: “Harvestの日次集約は登録件数を減らす任意機能です。SymTaxは取引所等で行われたXYMの売買や保有状況を把握しません。総平均法・移動平均法その他の計算方法や売買時刻によって、個別明細で登録した場合と計算結果が異なる可能性があります。必要に応じて個別明細を利用するか、売買時刻等を基準に集約区間を分割してください。SymTaxは税務判断や計算結果を保証しません。” This is a limitation notice, not tax advice.

**SPEC-AGG-002 — Structural eligibility only**

States are `eligible`, `ineligible`, `unknown`. Eligibility MUST NOT infer same-day sales, exchange trades, holdings, tax method, cost basis or tax safety. No condition requiring “no sale that day” is allowed. A record is `eligible` only when all are true: protocol classification is verified `HARVEST_FEE (0x2143)`; mosaic is that runtime's confirmed native XYM ID; absolute quantity is valid; Statement/Block identity and timestamp resolve; exact price evaluation is complete and unambiguous; JST date and split interval resolve; source reference is unique; network and requested history coverage are complete. A known non-Harvest, non-XYM record is `ineligible`. Missing/conflicting evidence is `unknown`. User opt-in does not convert ineligible/unknown to eligible.

If any selected member in an interval is `ineligible` or `unknown`, that interval has no aggregate row and the daily export is rejected/incomplete; do not silently exclude it. User may instead choose individual Harvest output, which remains separate. This fallback does not represent tax equivalence.

**SPEC-AGG-003 — Daily partition and split points**

The user MAY pass zero or more local JST split datetimes in the selected period. Input form is `YYYY-MM-DDTHH:mm:ss[.SSS]`, interpreted in `Asia/Tokyo`; offset suffixes are not accepted. Precision is one millisecond; more than three fractional digits or malformed civil time is `invalid-input`. Split points MUST lie within the requested period; an out-of-period split is `invalid-input`. Points are normalized by their JST calendar date, sorted ascending, and deduplicated by exact instant. A split at a day boundary is a redundant boundary and creates no empty interval. For each JST day, construct `[JST 00:00, split1)`, `[split1, split2)`, …, `[lastSplit, following JST 00:00)`. If no point occurs on that day, use the single full-day interval. Points spanning multiple dates apply to the corresponding date; they are not repeated on other dates. Period clipping preserves half-open semantics. A Receipt whose Block instant equals a split point belongs to the later interval. Duplicate points are one boundary. Each interval is an independent aggregation group.

**SPEC-AGG-004 — Aggregate result and exact sums**

Each row/result identifies JST date, interval start/end, receipt count, exact total XYM absolute units, exact sum of each member's evaluated JPY, component Receipt references, component evaluation references, completeness, and rule identifier `symtax-harvest-daily-split-exact-sum-1`. No source Receipt or individual evaluation is replaced or deleted. The aggregate JPY total MUST equal the exact sum of component evaluation JPY values.

When Cryptact requires a unit price, derive `weightedAveragePrice = totalEvaluatedJPY / totalXYM`; never average individual OHLC-average prices directly. The derived price is not a new evaluation source. It is exportable only if its decimal representation is finite and exactly representable under the Cryptact CSV precision rule; otherwise daily CSV export is rejected as `cryptact-format-unavailable`, with no rounding that changes the total. Zero total XYM makes the group ineligible for export.

**SPEC-AGG-005 — Ordering and provenance**

Components retain their original exact Block instants and stable Receipt identity ordering. Aggregate result references every member and its selected observation/rule. Transaction and non-Harvest Receipt compression is forbidden in initial release.

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

**SPEC-EXPORT-002 — Initial Individual Export allowlist**

The only initially mapped Symbol item is individual `HARVEST_FEE (0x2143)` Receipt, mapping as specified in `SPEC-EXPORT-003`. No initial Transaction type or Harvest-external Receipt type is assigned a Cryptact action; such a selected record returns `cryptact-mapping-unavailable`. A requested complete file that includes any unmappable selected record is rejected and reports type/count; it never silently omits that record. Individual Harvest mode emits one line for each complete selected Receipt.

**SPEC-EXPORT-003 — SymTax Harvest product mapping**

SymTax maps Symbol `HARVEST_FEE (0x2143)` to Cryptact action `STAKING`. This is an explicit SymTax product mapping decision. Cryptact documentation defines a generic `STAKING` action for staking rewards but does not officially classify Symbol harvesting as `STAKING`; the mapping is not the unique tax-correct treatment and does not promise a tax outcome.

For an individual Harvest CSV row: `日時` is the Receipt's derived Block instant rendered in JST to whole seconds by truncating fractional seconds; `種類=STAKING`; `ソース=SymTax Symbol Mainnet` or `SymTax Symbol Testnet`; `主軸通貨=XYM`; `取引量=Receipt XYM relative quantity`; `価格=that Receipt's OHLC arithmetic-mean evaluation price`; `決済通貨=JPY`; `手数料=0`; `手数料通貨=JPY`; `コメント` is a stable human-readable Symbol source reference. The source reference is not delegated to Cryptact's comment as machine provenance.

**SPEC-EXPORT-004 — Harvest Daily Export**

Daily mode is explicitly selected, contains only eligible Harvest Fee Receipts and emits one line per JST split interval with nonempty members. `種類=STAKING`, `主軸通貨=XYM`, `取引量=exact interval total`, `価格=total individual evaluated JPY / total XYM`, `決済通貨=JPY`, fee `0` and fee currency `JPY`; other fields follow `SPEC-EXPORT-003`/`007`. Row `日時` is the earliest component's exact Block instant, truncated to seconds for CSV. The UI result, separate from CSV, exposes JST date/interval and all source/evaluation references. Cryptact generic volume/price semantics make this product mapping structurally representable, but actual upload acceptance and equivalence of Cryptact calculation results are not verified. SymTax makes no equivalence or tax correctness claim.

**SPEC-EXPORT-005 — Numeric serialization**

CSV numeric values are base-10 decimal strings with `.` decimal separator, no grouping separators, no exponent notation, and no leading `+`. Serialize exact integer/decimal values with insignificant trailing zeros removed. No arithmetic rounding occurs. If a required value needs 15 or more fractional digits or cannot be represented exactly as finite decimal text, CSV mode returns `cryptact-format-unavailable`; it MUST NOT approximate, truncate, or substitute a rounded value. This honors the current official Cryptact guide, which directs values with at least 15 decimal places to its Excel sample. XLSX is not an initial output mode.

### 10.5 Export completion

**SPEC-EXPORT-006 — Complete / incomplete / rejected**

| Status | Meaning | File delivery |
|---|---|---|
| `complete` | Every selected source record has full coverage, supported mapping, required price/eligibility, and full format validation | Deliver only after all blockers for that mode are resolved |
| `incomplete` | Source scope has unknown, unsupported, missing, or unvalued items; no complete file may be presented | No file in initial release; provide reason and counts |
| `rejected` | Request invalid, wrong network, mapping unavailable, unsupported format, or a configured resource limit reached (`export-resource-limit`) | No file |

Initial contract rejects full export on any missing source, unsupported type, unavailable required price, unknown eligibility, or missing mapping. No partial export mode is specified because it is not an upstream requirement. A rejected / incomplete result reports category, period, total affected count, and reason counts without silently dropping items. A configured runtime resource limit reached before completion returns `rejected/export-resource-limit`; staged chunks are discarded and no partial file or download token is delivered.

**SPEC-EXPORT-007 — CSV determinism**

Rows are sorted by underlying UTC instant ascending then stable source identity; daily groups sort by interval start. `日時` is rendered in JST seconds with fractional seconds truncated, not rounded. Distinct individual events within one second remain separate rows. Header is the exact 10-column Japanese official header; encoding is UTF-8 with BOM; record separator is CRLF; CSV quoting follows RFC 4180 for delimiter/newline/quote and is rejected if any field contains apostrophe, double quote, or backslash per current Cryptact guide. Empty optional comment is empty; fee is numeric `0`; other required fields cannot be empty. Numeric precision follows `SPEC-EXPORT-005`. File timezone for import is JST.

## 11. Error / Incomplete State

### 11.1 Error set

**SPEC-ERR-001 — Public state codes**

| Code | Meaning | Retry | Records displayable | Export |
|---|---|---|---|---|
| `invalid-input` | malformed address/date/page size/split datetime | after correcting input | no search result | rejected |
| `future-period` | effective requested interval starts at or after requestNow, including tomorrow-only | no; choose a current/past interval | no search result | rejected |
| `export-resource-limit` | configured bounded export budget reached before complete output | retry with smaller scope or after approved capacity change | no complete file; progress is not a deliverable | rejected |
| `cryptact-format-unavailable` | exact value cannot be serialized within initial Cryptact CSV decimal rules | no rounding retry; choose other supported output or revise range/mode | source details remain displayable | rejected |
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
| `price-store-unavailable` | SymTax Price Store unavailable, observation cannot be confirmed | after Store recovery | source record remains displayable, valuation unavailable | reject price-dependent output |
| `price-provider-invalid-response` | malformed JSON, decimal, pair, interval, or timestamp | retry after provider recovery | no new observation accepted | reject affected rows |
| `price-observation-conflict` | multiple differing observations without approved selected one | no automatic retry resolution | historical record visible, valuation ambiguous | reject |
| `aggregation-ineligible` | known condition prohibits grouping | no | Receipt detail display | selected daily export rejected/incomplete; no partial file |
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

### 12.2 MongoDB instance isolation

**SPEC-STORE-001 — Independent MongoDB instances**

Symbol Node MongoDB and SymTax Data Store MUST run as separate MongoDB instances in separate `mongod` server processes. Using separate database names within the same `mongod` process is not supported. They MAY run on the same physical or virtual host, including a VM, WSL environment, or Docker host; a separate machine or Docker deployment is not required.

Even when co-located, the instances MUST have separate connection strings, MongoDB credentials/users, storage volume or `dbpath`, lifecycle operations (start, stop, update, recreate), and independently configured major resource boundaries, including resource limits and WiredTiger cache settings. The Symbol Node MongoDB credential available to SymTax MUST be read-only; SymTax write credentials, if any, apply only to the independent SymTax Data Store. SymTax application access paths MUST NOT provide a write-capable Node credential.

Failure, restart, schema migration, backup, or restore of the SymTax Data Store MUST NOT modify or require restarting/recreating the Symbol Node MongoDB. Symbol Node resynchronization, rebuild, or upgrade MUST NOT delete or replace the SymTax Data Store or its persisted observations. Deployments MUST be inspectable to establish these boundaries. This contract does not prescribe MongoDB version, port, process/container names, host separation, or container technology.

### 12.3 Resource contract

**SPEC-RES-001 — Bounded request output**

Browse and export MUST execute server-side with bounded memory and incremental/chunked processing. Browser does not receive all raw records and does not construct the export from full history. Export generation keeps only bounded working data per chunk; when the configured runtime limit for elapsed work, record count, bytes, or another resource budget is reached, return `rejected/export-resource-limit`, discard staged partial output, and deliver no file. The limit set must be finite and configured for every deployment; missing/unbounded configuration fails closed. The Specification does not invent numeric budgets. Completion is atomic from the user's view: only after all pages, mappings, valuations, and final serialization succeed is a file made available. Retry is safe and does not mutate raw history or prior price observation provenance.

**SPEC-RES-002 — Release gate and representative workload**

Measure with multi-year records, hundreds to thousands of Receipts per month, and the user-reported example of about 700 Harvest-related Receipts in one month. Record server memory, elapsed time, completion status, price-store behavior and output size; do not claim a numeric threshold before measurement. Before public release, a finite period/record/file/time budget and acceptance threshold must be approved from these measurements. Full-range Export cannot be released before this gate. This requirement does not limit period browsing by an invented date cap.


## 13. Conformance Cases

Cases below are externally observable contract checks, not an implementation unit-test plan. Test fixtures need no secret information.

| Case | Input / condition | Required result |
|---|---|---|
| CT-001 | Valid Mainnet Base32 address in Mainnet runtime | accepted; result identifies Mainnet |
| CT-002 | Valid Testnet Base32 address in Testnet runtime | accepted; result identifies Testnet |
| CT-003 | Valid address for other runtime | `wrong-network`, no records |
| CT-004 | checksum-invalid / malformed / empty address | `invalid-input` |
| CT-005 | hex address, Namespace ID, NEM address | `unsupported-input` |
| CT-006 | `fromDate == toDateExclusive` or malformed date | `invalid-input`; future-only periods are checked by CT-077〜080 |
| CT-007 | Period starts/ends at JST 00:00 inclusive/exclusive | exact expected boundary record set |
| CT-008 | JST month-end / year-end / leap day | month/day buckets follow JST calendar |
| CT-009 | Transaction-only account period | Transaction category only; no Receipt leakage |
| CT-010 | Receipt-only period | Receipt category only; no Transaction leakage |
| CT-011 | All 25 recognized transaction type codes | exact row-specific normalized semantic fields in SPEC-TX-003; missing required type detail is `partial` |
| CT-012 | Known Harvest Fee `0x2143` with target address match | `harvest` classification with Block time and source reference |
| CT-013 | Inflation `0x5143` | recognized `not-harvest`; not in Harvest amount / aggregation |
| CT-014 | Known non-Harvest Receipt | `not-harvest` |
| CT-015 | Unknown Receipt type code | `unsupported-receipt-type`, no guessed amount/Harvest/export |
| CT-016 | Receipt with timestamp absent but resolvable Statement / Block | timestamp derived from Block, not Receipt |
| CT-017 | Statement or Block timestamp unresolved | `block-timestamp-unavailable`, no valuation |
| CT-018 | Multiple Harvest receipts in one Block minute | retain individual identities and order; no timestamp-only deduplication |
| CT-019 | Price Store exact observation hit | same observation reference reused without Provider call requirement |
| CT-020 | Price cache miss with a valid `xym_jpy` 1min observation | resolve the matching minute by `SPEC-PRICE-005`; preserve observation provenance |
| CT-021 | bitbank timeout / malformed OHLCV | `price-provider-unavailable` / `price-provider-invalid-response`; never zero JPY |
| CT-022 | No target candle / response omits minute / volume zero | `price-unavailable` with reason; no interpolation or evaluation |
| CT-023 | Changed candle same timestamp | append correction candidate; old observation and dependent evaluation unchanged |
| CT-024 | Same candle data retrieved repeatedly | duplicate is idempotent |
| CT-025 | User opts into daily mode for a Harvest Receipt passing every structural condition | `eligible`; warning shown; no tax-method or external-sale inference |
| CT-026 | Harvest group is ineligible | `aggregation-ineligible`; no grouped row |
| CT-027 | Harvest group contains unknown/incomplete member | `aggregation-unknown`; daily file rejected; individual mode remains available |
| CT-028 | Multiple pages, same timestamp / block | stable keyset order with no duplicate / missing item |
| CT-029 | Continuation replay under same parameters | continues after prior composite key |
| CT-030 | Continuation used for another period / address / category / network | `invalid-continuation` |
| CT-031 | Snapshot anchor removed/reorged | `continuation-stale`; all joined pages incomplete |
| CT-032 | Testnet and Mainnet identity evidence mismatch/unknown | fail-closed; no chain-derived result; see exact vectors CT-041〜046 |
| CT-033 | Node source coverage incomplete | partial records visibly incomplete; Summary/Export not complete |
| CT-034 | Individual export selects Transaction or non-Harvest Receipt | rejected `cryptact-mapping-unavailable`; no rows silently omitted |
| CT-035 | Individual / daily Harvest mapping and export request | both map to product action `STAKING`; complete file remains unavailable until price timestamp evidence and required validations pass |
| CT-036 | Any partial source, missing price, unknown grouping, or unsupported type in full Export | `export-incomplete` / rejected; no file |
| CT-037 | Summary value has no meaning for a record type | `not-applicable`, distinct from numeric zero |
| CT-038 | Over-range native Amount or decimal `NaN` / Infinity | rejected/incomplete; no floating point coercion or clamp |
| CT-039 | Logs and persistence observation | no search/history/evaluation/export archive; shared price data remains address-independent |
| CT-040 | Multi-year / 700 monthly Harvest sample | bounded pages/chunked export; measurements inform finite deployment limit; no numeric performance claim before release gate |
| CT-041 | Mainnet Node reports (`0x68`, Mainnet generation hash, `1615853185s`) | accepted only in Mainnet runtime |
| CT-042 | Testnet Node reports (`0x98`, Testnet generation hash, `1616694977s`) | accepted only in Testnet runtime |
| CT-043 | Mainnet runtime connected to Testnet Node | `wrong-network`; no chain result or staged file |
| CT-044 | Testnet runtime connected to Mainnet Node | `wrong-network`; no chain result or staged file |
| CT-045 | missing or malformed `/network` or `/network/properties` evidence | `network-identity-unavailable`; fail closed |
| CT-046 | valid network type but mismatched seed or epoch adjustment | `wrong-network`; discard all request pages |
| CT-047 | Each recognized Transaction source fixture from SPEC-TX-003 | identical typed semantic fields, `not-applicable` markers, roles, fee and completeness |
| CT-048 | Unknown Transaction type code | `unsupported-transaction-type`; common identity only, no inferred detail |
| CT-049 | Recognized Transaction missing required type source field | `partial`; no complete detail/export |
| CT-050 | Transaction missing identity or Block reference | `incomplete`; never substitute a time or empty identity |
| CT-051 | Each Receipt family: transfer, balance-change, artifact, inflation, group, resolution | fields/amount applicability match SPEC-RCPT-003 |
| CT-052 | Harvest Fee `0x2143` with XYM, target address, Statement and Block | `harvest`, exact Block timestamp, complete source identity |
| CT-053 | Unknown Receipt type code with valid Statement source | `unsupported-receipt-type`, no amount or Harvest inference |
| CT-054 | Receipt missing type-required source field | partial; `unknown` Harvest if classification evidence affected |
| CT-055 | Receipt missing Statement source or Block reference | incomplete / `block-timestamp-unavailable`; no evaluation |
| CT-056 | Partial or unsupported Catapult Mongo source profile | `unsupported-schema` or incomplete; never mark coverage complete |
| CT-057 | Block instant one millisecond before minute boundary | select the preceding minute-start candle |
| CT-058 | Block instant exactly at minute boundary | select the candle starting at that boundary; its interval is half-open |
| CT-059 | Block instant one millisecond after boundary | select the candle starting at that boundary |
| CT-060 | OHLC values all distinct | evaluation rule computes exact arithmetic mean `(O+H+L+C)/4`, with no OHLC pre-rounding |
| CT-061 | Volume is exactly zero with syntactically valid OHLC | `price-unavailable(zero-volume-candle)` |
| CT-062 | Expected minute candle missing | no adjacent lookup/interpolation; `price-unavailable` |
| CT-063 | Exact immutable cached observation selected after provider outage | cached observation reused with original provenance |
| CT-064 | Changed OHLCV for same market minute | append correction candidate; existing evaluation unchanged |
| CT-065 | Daily mode with no split points | one `[00:00 JST, next 00:00 JST)` group per date |
| CT-066 | One split point at 13:30 JST | intervals `[00:00,13:30)` and `[13:30,next 00:00)` |
| CT-067 | Multiple split points; out-of-order and duplicate inputs | normalized ascending; exact duplicate collapses; independent intervals |
| CT-068 | Receipt instant equals a split point | included in the later `[start,end)` interval |
| CT-069 | Split points across two or more JST dates | each point partitions only its own date; points are not repeated |
| CT-070 | Daily interval includes ineligible or unknown Receipt | no daily aggregate row; complete daily export rejected; individual path remains available |
| CT-071 | Explicitly eligible Harvest group with all exact evaluations | quantity exact sum, JPY exact sum, all component refs retained |
| CT-072 | Daily weighted price multiplied by total quantity | exact result equals summed individual JPY or export is rejected; never average OHLC means |
| CT-073 | Harvest individual export | 10 official columns; `STAKING`, XYM, exact amount/price, JPY, zero fee |
| CT-074 | Harvest aggregate export | `STAKING`; total XYM and weighted price reproduce total individual evaluation exactly |
| CT-075 | Transaction or non-Harvest Receipt mapping requested | `cryptact-mapping-unavailable`, with affected type/count |
| CT-076 | Serialization needs 15+ fractional digits or repeating aggregate price | `cryptact-format-unavailable`; no approximation/file |
| CT-077 | Today-only `[today,tomorrow)` | accepted through fixed requestNow; includes records only before requestNow |
| CT-078 | Current-month calendar range ending next month start | accepted through requestNow; no future records returned |
| CT-079 | Tomorrow-only or complete future period | `future-period`; no records |
| CT-080 | Today-to-tomorrow boundary and requestNow exactly at start boundary | first accepted if nonempty; empty/future effective interval rejected |
| CT-081 | Export resource limit reached while staged chunks exist | `export-resource-limit`; staging discarded, no partial artifact |
| CT-082 | Export fails before completion then user retries | first attempt has no file; retry starts fresh and does not alter observations/source history |
| CT-083 | Full requested data includes unmappable or incomplete records | rejected/incomplete with reason counts; never output a partial success file |
| CT-084 | Recorded bitbank live sample for `xym_jpy`, 2026-09-23: 1,440 candles and 545 date-query transactions | all 194 candles with volume > 0 match every OHLCV field under `[T,T+60,000)`; only 1 matches under `[T-60,000,T)`; summed transaction amount equals summed candle volume |
| CT-085 | Deployment evidence for Symbol Node MongoDB and SymTax Data Store, including same-host deployment | distinct `mongod` processes/instance identities, connection strings, users/credentials, storage locations, lifecycle and major resource settings are verifiable; same-host separate instances are accepted; same-process separate databases are rejected; Node credential cannot write; Store restart/migration/backup/restore leaves Node unchanged, and Node resync/rebuild/upgrade preserves SymTax data |

## 14. OPEN-001〜010 / Specification blockers

Status names: `RESOLVED-IN-SPEC`, `PARTIALLY-RESOLVED`, `DEFERRED-EXTERNAL-VERIFICATION`, `DEFERRED-OPERATION`, `BLOCKING`.

| OPEN | Status | Specificationで確定したこと | 未決定・根拠 / 実装開始への影響 | 関連Specification ID |
|---|---|---|---|---|
| OPEN-001 税務方式・同日集約境界 | **PARTIALLY-RESOLVED** | 集約は利用者opt-in。SymTaxは外部売買・保有・税務方式を判定せず、JST任意分割、注意表示、individual出力を定義 | 個別登録との税務・損益同等性は保証しない。利用者が区間を選ぶが、区間選択自体が税務上適切とは示さない。計算結果の差異を許容するこの製品境界で仕様化。税務上の解釈は対象外 | SPEC-AGG-001〜005, SPEC-EXPORT-004 |
| OPEN-002 Block timestamp → bitbank 1min | **RESOLVED-IN-SPEC** | bitbank `xym_jpy` 1min candle timestampをminute startとして実API比較で確認。`floor(B/60000)×60000`のtimestamp一致と半開区間を規定 | bitbank公式資料はtimestamp anchorを明示しない。2026-09-23の実応答照合に基づくpair/intervalの経験的確認。exact-boundary約定は当日未観測だが、境界所属は確定したminute-start区間の半開契約で決まる | SPEC-TIME-001/002/004, SPEC-PRICE-001/005/007; CT-057〜064, CT-084 |
| OPEN-003 missing / zero volume | **RESOLVED-IN-SPEC** | 選択minuteの足なし・volume zero・provider/store失敗をreason別にunavailable。補間、近傍検索、0円を禁止 | 外部資料に税務価格ルールはないため、zero volumeはSymTaxの保守的な製品規則として評価対象外。OPEN-002のanchor確認とは独立 | SPEC-PRICE-006, SPEC-ERR-001 |
| OPEN-004 observation correction / reevaluation | **PARTIALLY-RESOLVED** | duplicate idempotent、changed value append-only candidate、既存evaluationを自動差替えしない | 候補の採用/修復、再評価承認、容量・運用方針は外部仕様・運用判断。現時点で自動切替しないので既存結果の再現性は保つ | SPEC-PRICE-002〜004, SPEC-PRICE-007 |
| OPEN-005 Cryptact Harvest mapping | **PARTIALLY-RESOLVED / DEFERRED-EXTERNAL-VERIFICATION** | SymTax製品判断としてHarvest individual/dailyを`STAKING`へmapping。Generic CSV contractとweighted priceを定義 | Symbol HarvestをCryptactが公式分類する根拠なし。実アップロードとCryptact内損益比較は未実施。mappingはSymTax仕様であり税務上の唯一解ではない。公開前にformat acceptanceを確認 | SPEC-EXPORT-001〜007 |
| OPEN-006 Transaction / Receipt association | **RESOLVED-IN-SPEC** | 独立model/category/list/summary維持。技術的statement/block referenceは使用 | 初期仕様で利用者向けcross-linkは必須でない | SPEC-TX-001〜004, SPEC-RCPT-001〜004 |
| OPEN-007 Mongo schema / history coverage | **PARTIALLY-RESOLVED / DEFERRED-EXTERNAL-VERIFICATION** | Type semantic contract、adapter normalization boundary、unsupported/partial/incomplete条件を定義 | 実Mainnet/Testnet nodeのversion、実collection source completeness/history retention、Statement→Blockの実接続は未検証。node profile適合前に完全履歴をclaimしない | SPEC-NET-004, SPEC-TX-001〜004, SPEC-RCPT-001〜005, SPEC-ERR-001 |
| OPEN-008 performance numbers | **PARTIALLY-RESOLVED / DEFERRED-OPERATION** | chunked server export、finite deployment limits必須、上限到達はreject/no file。代表負荷と公開前gateを明記 | 数値上限・release thresholdは計測後の運用合意が必要。全期間Exportはgate前に公開不可 | SPEC-RES-001/002, SPEC-EXPORT-006 |
| OPEN-009 Mainnet/Testnet identity | **RESOLVED-IN-SPEC** | public networkごとのNetworkType + generationHashSeedをpin、epochAdjustment補助照合、欠損/不一致fail-closed | 配備ノードからevidence取得可能かをMainnet/Testnet実環境で公開前に確認。これは実環境適合のgateで、判定仕様自体は確定 | SPEC-NET-001〜004 |
| OPEN-010 Privacy/logging | **PARTIALLY-RESOLVED** | user search/history/evaluation/aggregation/export永続保存なし。共有market observationのみ永続化、不要logを禁止 | retention duration、incident access role、privacy noticeは運用判断 | SPEC-PRIV-001/002, SPEC-ERR-003 |

### 14.1 Other unresolved items and release gates

| ID | Status | Decision / unresolved point | Affected contract |
|---|---|---|---|
| OPEN-SPEC-001 | **PARTIALLY-RESOLVED** | All 25 Transaction semantic field contracts and completeness rules are specified from Catbuffer types. Actual Mongo source-field profile and source version must pass adapter qualification under OPEN-007 | SPEC-TX-002〜004 |
| OPEN-SPEC-002 | **PARTIALLY-RESOLVED / DEFERRED-OPERATION** | No arbitrary browse maximum is invented; exports are incrementally processed with finite configured resource budgets. Measured quantitative range/count/bytes/time caps remain a pre-release gate | SPEC-IN-005, SPEC-RES-001/002 |
| OPEN-SPEC-003 | **RESOLVED-IN-SPEC** | Exact decimal operations; no arithmetic rounding; CSV values requiring ≥15 fractional digits or non-terminating exact value are rejected under current Cryptact guide | SPEC-NUM-004, SPEC-EXPORT-005/007 |
| OPEN-SPEC-004 | **RESOLVED-IN-SPEC** | Zero-volume and missing minute are unavailable; no interpolation or zero valuation | SPEC-PRICE-006 |
| OPEN-SPEC-005 | **PARTIALLY-RESOLVED** | Harvest maps to SymTax product action `STAKING`; all Transaction/non-Harvest mappings remain explicitly unavailable rather than inferred. Actual Cryptact acceptance remains external verification | SPEC-EXPORT-002〜004 |
| OPEN-SPEC-006 | **PARTIALLY-RESOLVED / DEFERRED-EXTERNAL-VERIFICATION** | Protocol/source identity semantic contract is defined; actual Node version and Statement/source/block mapper compatibility are not tested | SPEC-RCPT-001〜004, SPEC-PAGE-002, OPEN-007 |
| OPEN-SPEC-007 | **RESOLVED-IN-SPEC / DEFERRED-EXTERNAL-VERIFICATION** | CSV header, BOM, JST datetime to seconds, CRLF, field validation and exact decimal rule are defined. Cryptact upload acceptance remains unverified | SPEC-EXPORT-001/005/007 |
| OPEN-SPEC-008 | **PARTIALLY-RESOLVED / DEFERRED-OPERATION** | bounded/atomic output and explicit rejection are defined; numeric limits require representative measurement and approval before public release | SPEC-RES-001/002, SPEC-EXPORT-006 |

**Implementation / release status:** The external contracts for network identity, type semantics, Harvest opt-in/partitioning, `STAKING` product mapping, period boundary, export resource failure, and the bitbank `xym_jpy` 1min timestamp anchor are specified. The anchor is an empirical API finding, not an official documentation guarantee. Public release additionally waits for real node-profile qualification, Cryptact upload confirmation, and measured export limits. No UI or adapter implementation may bypass those remaining gates.

## 15. Requirements → Design → Specification → Conformance Traceability

Requirements ID grouping follows the 44 IDs defined in `requirements.md`. Each row shows its Design owner / decision, this document's contract IDs, and at least one conformance case.

| Requirement ID | Design responsibility / decision | Specification ID | Conformance case | Review finding resolved / affected |
|---|---|---|---|---|
| CON-001 | Symbol History Adapter / DD-002 | SPEC-NET-004, SPEC-TX-001, SPEC-RCPT-001 | CT-033 | SR-001 |
| CON-002 | Server-only read-only Node boundary | SPEC-NET-004, SPEC-PRIV-002 | CT-039 | — |
| CON-003 | Independent mongod process / MongoDB instance, same-host co-location allowed, DD-004 | SPEC-STORE-001 | CT-085 | — |
| CON-004 | Runtime network binding / DD-007 | SPEC-NET-001〜003 | CT-001〜003, CT-032 | SR-002 |
| CON-005 | Shared persistent Price Store / DD-003/010 | SPEC-PRICE-001〜004 | CT-019〜024 | — |
| CON-006 | JST calendar vs lookup instant | SPEC-TIME-001〜004 | CT-007〜008 | — |
| CON-007 | Single Next.js Server logical boundary / DD-008 | SPEC-GEN-001, SPEC-NET-004 | CT-039 | — |
| FUNC-001 | Input validation, guard, Browse Services | SPEC-IN-001〜005, SPEC-NET-001〜003, SPEC-PAGE-001〜005 | CT-001〜008, CT-028〜032 | SR-006 |
| FUNC-002 | Independent Browse models / DD-005 | SPEC-TX-001, SPEC-RCPT-001, SPEC-SUM-001 | CT-009〜010 | — |
| FUNC-003 | Transaction normalizer | SPEC-TX-002〜004 | CT-011 | SR-001 |
| FUNC-004 | Statement / Receipt normalizer and classifier | SPEC-RCPT-001〜005 | CT-012〜017 | SR-001 |
| FUNC-005 | Summary navigation | SPEC-SUM-001/002, SPEC-PAGE-005 | CT-007〜010 | — |
| FUNC-006 | JST Calendar Boundary | SPEC-TIME-003 | CT-007〜008 | — |
| FUNC-007 | Category Summary Service | SPEC-SUM-002〜004 | CT-009〜010, CT-037 | — |
| FUNC-008 | Normalized source refs | SPEC-TX-001, SPEC-RCPT-001, SPEC-SUM-004 | CT-012, CT-018 | — |
| FUNC-009 | Optional association; preserve independence | SPEC-TX-003, SPEC-RCPT-002, SPEC-SUM-001 | CT-009〜010 | — |
| EXPORT-001 | Export mode adapter | SPEC-EXPORT-001〜007 | CT-034〜036 | SR-005 |
| EXPORT-002 | Individual export path | SPEC-EXPORT-002, SPEC-EXPORT-006 | CT-034 | SR-005 |
| EXPORT-003 | Harvest scope guard | SPEC-RCPT-005, SPEC-AGG-002 | CT-012〜015 | SR-004 |
| EXPORT-004 | JST eligibility / partition | SPEC-TIME-003, SPEC-AGG-001/004 | CT-007〜008, CT-025〜027 | SR-004 |
| EXPORT-005 | Component Receipt references | SPEC-AGG-003/005 | CT-025〜027 | SR-004 |
| EXPORT-006 | Valuation + aggregation provenance | SPEC-PRICE-007, SPEC-AGG-003/005, SPEC-EXPORT-004/005 | CT-019〜027 | SR-004 |
| EXPORT-007 | Cryptact format validator | SPEC-EXPORT-001〜007 | CT-034〜036 | SR-005 |
| PRICE-001 | bitbank Provider adapter | SPEC-PRICE-001〜004 | CT-019〜024, CT-084 | SR-003 |
| PRICE-002 | Block-time normalization / lookup | SPEC-TIME-001/002/004, SPEC-PRICE-005 | CT-016〜018, CT-020〜022, CT-084 | SR-003 |
| PRICE-003 | Persistent observation store | SPEC-PRICE-002〜004 | CT-019, CT-023〜024, CT-039 | — |
| PRICE-004 | Receipt evaluation evidence | SPEC-PRICE-007 | CT-016〜020, CT-023 | SR-003 |
| PRICE-005 | Missing / ambiguous state | SPEC-PRICE-006, SPEC-ERR-001/002 | CT-021〜022 | SR-003 |
| DATA-001 | Raw source / derived values / DD-009 | SPEC-TX-001, SPEC-RCPT-001, SPEC-SUM-004, SPEC-AGG-005 | CT-018, CT-025 | — |
| DATA-002 | Coverage propagation / export completion | SPEC-ERR-001/002, SPEC-EXPORT-006 | CT-031〜036 | — |
| DATA-003 | Request-local user data / DD-009 | SPEC-PRIV-001/002 | CT-039 | — |
| PERF-001 | Filtered Symbol adapter | SPEC-IN-005, SPEC-PAGE-001〜005 | CT-028〜033 | SR-006 |
| PERF-002 | Chunked Browse / validation workload | SPEC-RES-001/002 | CT-040 | SR-007 |
| PERF-003 | Server-side normalizing / minimal payload | SPEC-GEN-002, SPEC-PAGE-001, SPEC-RES-001 | CT-028, CT-040 | SR-007 |
| PERF-004 | Incremental detail / bounded processing | SPEC-PAGE-001〜005, SPEC-RES-001/002 | CT-028〜031, CT-040 | SR-007 |
| QUAL-001 | incomplete-state propagation | SPEC-ERR-001〜003, SPEC-EXPORT-006 | CT-017, CT-021〜022, CT-033, CT-036 | — |
| SEC-001 | No secrets/signing capability | SPEC-GEN-003, SPEC-PRIV-001 | CT-001〜005, CT-039 | — |
| SEC-002 | Server-only / read-only Node adapter | SPEC-NET-004, SPEC-STORE-001, SPEC-PRIV-002 | CT-039, CT-085 | — |
| SEC-003 | Runtime expected/observed network guard | SPEC-NET-001〜003 | CT-001〜003, CT-032 | SR-002 |
| PRIV-001 | Request-local user data / minimal logs | SPEC-PRIV-001/002 | CT-039 | — |
| SEC-004 | Independent lifecycle/storage/resource boundary and Node read-only credential, DD-004 | SPEC-STORE-001 | CT-085 | — |
| EXT-001 | Price Store read-through | SPEC-PRICE-001〜006 | CT-019〜024, CT-084 | SR-003 |
| EXT-002 | Cryptact Adapter / validation | SPEC-EXPORT-001〜007 | CT-034〜036 | SR-005 |
| EXT-003 | Symbol adapter compatibility boundary | SPEC-TX-001〜004, SPEC-RCPT-001〜004, SPEC-ERR-001 | CT-011, CT-015, CT-033 | SR-001 |

### 15.1 Specification Review 001 finding disposition

| Finding | Status in this revision | Resolution / remaining gate | Specification / cases |
|---|---|---|---|
| SR-001 Critical | **RESOLVED-IN-SPEC; node-profile gate remains** | Type-specific Transaction and Receipt semantic maps, identity, roles, quantities, source references and completeness are explicit from Catbuffer. A live Node profile still needs qualification before coverage claims | SPEC-TX-001〜004, SPEC-RCPT-001〜005; CT-047〜056 |
| SR-002 Critical | **RESOLVED-IN-SPEC** | Mainnet/Testnet network type, generation seed and epoch adjustment are pinned; observed evidence and fail-closed outcomes are exact | SPEC-NET-001〜004; CT-041〜046 |
| SR-003 Critical | **RESOLVED-IN-SPEC** | Live API reconstruction confirms minute-start anchoring for `xym_jpy` 1min; block-to-candle selection, exact boundary, OHLC arithmetic mean, zero-volume and missing-candle outcomes are specified. Official docs do not themselves declare the anchor | SPEC-PRICE-001, 005〜007; CT-057〜064, CT-084 |
| SR-004 Critical | **RESOLVED-IN-SPEC** | Eligibility is deterministic and structural only; aggregation is optional, uses user splits and does not infer external trades or tax method | SPEC-AGG-001〜005; CT-065〜072 |
| SR-005 Critical | **RESOLVED-IN-SPEC; external acceptance deferred** | Harvest individual/daily map to SymTax product action `STAKING` with explicit columns/values; other types are explicitly unmappable. This is not Cryptact's official Symbol classification; actual upload/economic behavior remains external verification | SPEC-EXPORT-001〜007; CT-073〜076 |
| SR-006 Major | **RESOLVED-IN-SPEC** | Current-day/current-month calendar end is allowed; actual end is clipped to requestNow and future-only intervals reject | SPEC-IN-005; CT-077〜080 |
| SR-007 Major | **RESOLVED-IN-SPEC; quantitative release gate remains** | Server-side bounded chunk processing, finite runtime limits, atomic no-partial-output rejection are specified. Numerical limit awaits representative measurement | SPEC-RES-001/002, SPEC-EXPORT-006; CT-081〜083 |

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
- `_symbol/catbuffer/schemas/symbol/transaction_type.cats`, `receipt_type.cats`, `receipts.cats`, `statements/receipt_source.cats`, `statements/transaction_statement.cats`をTransaction/Receipt enumとprotocol field semanticsの根拠として参照。これらはprotocol schemaでありMongo collection contractではない。
- `_symbol/client/catapult` checkout `14a0cc16e`: Address checksumがSHA3-256 first 3 bytesである実装、Receipt type / HarvestFeeObserver / TransactionStatementMapper / BlockMapper / TransactionMapperを照合。この特定Catapult checkoutの実装確認であり、全Node版のDB契約ではない。
- [Symbol XYM exchange integration](https://docs.symbol.dev/ja/guides/exchanges/exchange-integration.html): XYM divisibility 6、native unitの関係。Mainnet IDをnetwork共通IDとして扱わない。

### 16.3 bitbank Public API

- Official [Public API candle docs](https://github.com/bitbankinc/bitbank-api-docs/blob/master/public-api.md#candlestick) support pair list, `1min`, `YYYYMMDD` for minute candles, `[open, high, low, close, volume, unix timestamp milliseconds]`.
- Official [Transactions docs](https://github.com/bitbankinc/bitbank-api-docs/blob/master/public-api.md#transactions) describe `GET /{pair}/transactions/{YYYYMMDD}`, `transaction_id`, `price`, `amount`, and `executed_at`; they state that omitting the date returns the latest 60. The documentation does not explicitly describe the candle timestamp anchor or the timezone of the date path. Official [pair list](https://github.com/bitbankinc/bitbank-api-docs/blob/master/pairs.md) includes `xym_jpy`.
- **Official documentation fact:** candle tuple timestamp is Unix milliseconds and the OHLCV order is open, high, low, close, volume, timestamp. The docs do not say whether that timestamp marks the minute start or end. They also do not state a tax price recommendation or zero-volume / missing-candle valuation rule.
- **Live Public API observation (2026-09-24, query date 2026-09-23):** fetched [Candlestick](https://public.bitbank.cc/xym_jpy/candlestick/1min/20260923) and [date-specified Transactions](https://public.bitbank.cc/xym_jpy/transactions/20260923). Candlestick returned 1,440 rows from `2026-09-23T00:00:00Z` through `23:59:00Z`; Transactions returned 545 records, all with `executed_at` within that UTC date. All 194 rows with `volume > 0` were reconstructed using exact decimal strings, grouping trades into `[T,T+60000)` and ordering equal-millisecond trades by ascending `transaction_id`; open, high, low, close, and volume each matched the API row in 194/194 cases. Under `[T-60000,T)`, field match counts were O=24/194, H=23/194, L=26/194, C=28/194, volume=3/194, with only 1/194 complete OHLCV match. For the date, exact sum of all 545 transaction amounts (`6415353.7709`) equaled exact sum of all 1,440 candle volumes (`6415353.7709`). The date-omitted [Transactions endpoint](https://public.bitbank.cc/xym_jpy/transactions) returned 60 records, consistent with the official description; the date-specific response was not the latest-60 response. This cross-check supports coverage for this observed date and rules out an apparent 60-record truncation; it does not claim a permanent provider retention guarantee.
- Among same-millisecond groups, 73 groups were observed (maximum 13 records); in every such group, response order and ascending `transaction_id` agreed. No trade had `executed_at % 60000 == 0` in this sample (`exact-boundary transaction was not observed`). Exact-boundary placement therefore follows the specified `[minuteStart, minuteStart+60000)` rule rather than a directly observed trade.
- Representative live rows (UTC; all five values are exact decimal comparisons):

| Candle timestamp | API OHLCV `(O,H,L,C,V)` | `[T,T+60s)` reconstruction | `[T-60s,T)` reconstruction | Result |
|---|---|---|---|---|
| 2026-09-23 03:19Z | `0.507, 0.508, 0.507, 0.508, 0.0900` | exact match (2 trades) | no trades | start |
| 2026-09-23 03:35Z | `0.508, 0.518, 0.508, 0.518, 1077956.6716` | exact match (8 trades) | no trades | start |
| 2026-09-23 04:01Z | `0.511, 0.512, 0.509, 0.512, 319325.5454` | exact match (11 trades) | `0.508, 0.508, 0.508, 0.508, 0.0001` (1 trade) | start |
| 2026-09-23 04:41Z | `0.512, 0.519, 0.510, 0.517, 81500.7000` | exact match (9 trades) | no trades | start |
| 2026-09-23 05:04Z | `0.512, 0.512, 0.510, 0.512, 47035.5134` | exact match (5 trades) | `0.512, 0.512, 0.512, 0.512, 5815.2710` (1 trade) | start |

- **Conclusion:** for bitbank `xym_jpy` `1min`, observed API candle timestamps anchor the minute start. This conclusion is based on the above real API reconstruction, not on an official documentation statement. The SymTax OHLC arithmetic-mean rule remains a separate product valuation rule.

### 16.4 Cryptact official material

- [カスタムファイルの作成方法](https://support.cryptact.com/hc/ja/articles/360002571312-%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%A0%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%81%AE%E4%BD%9C%E6%88%90%E6%96%B9%E6%B3%95), updated 2026-08-12: Japanese CSV/XLSX, 10 field order, date format, required / optional, values and custom file notes. The guide states that 15+ fractional digits should use its Excel sample.
- [XYM opt-in history upload example](https://support.cryptact.com/hc/ja/articles/4408649916057-XYM-%E3%82%B7%E3%83%B3%E3%83%9C%E3%83%AB-%E3%81%AE%E3%82%AA%E3%83%97%E3%83%88%E3%82%A4%E3%83%B3%E3%81%AE%E5%B1%A5%E6%AD%B4%E3%82%92%E3%82%A2%E3%83%83%E3%83%97%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95), updated 2026-04-14: shows `XYM` as a base currency and uses `BONUS` for opt-in as an example; it explicitly says the treatment is not a clear rule. That is not a classification of Symbol Harvest and does not override the user-approved SymTax `STAKING` mapping.
- [Official Japanese CSV sample attachment](https://support.cryptact.com/hc/article_attachments/16258358690713): exact Japanese header and UTF-8 BOM sample visible.
- [取引種類別の計算方法](https://support.cryptact.com/hc/ja/articles/12814753146777-%E5%8F%96%E5%BC%95%E7%A8%AE%E9%A1%9E%E5%88%A5%E3%81%AE%E8%A8%88%E7%AE%97%E6%96%B9%E6%B3%95), updated 2026-08-14: `STAKING` describes staking reward and its calculation semantics.
- [カスタムファイル upload / timezone](https://support.cryptact.com/hc/ja/articles/7557126434457-%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%A0%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%81%AE%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E6%96%B9%E6%B3%95): uploaded custom file uses ledger timezone by default; user can select timezone to match file.
- Official material describes `STAKING` for staking reward semantics and the file quantity/price field meaning, but does not classify Symbol Harvest Fee Receipt as `STAKING` or approve daily aggregation/economic equivalence. `HARVEST_FEE → STAKING` is the explicit SymTax product decision, not Cryptact attribution. No Cryptact account upload or live P/L comparison was performed.

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
- [x] Symbol Node MongoDBとSymTax Data Storeは別mongod process / instanceとし、同一host共置時の分離条件と運用適合caseを定義した。
- [x] Harvest OHLC arithmetic mean, structural opt-in eligibility, arbitrary JST split points, `STAKING` product mapping, current-date periods, bounded resource rejection are specified.
- [x] bitbank `xym_jpy` 1min timestamp anchor was verified by a full-day real API OHLCV / Transactions comparison; exact-boundary trade absence is recorded separately from the half-open interval contract.
- [x] CT-001〜085 cover prior cases plus network evidence, normalized types, price, aggregation, export, period boundaries, the recorded live anchor verification, and MongoDB instance isolation.
- [x] Traceability covers all 44 Requirement IDs and SR-001〜007.
- [x] Official Cryptact format support is separated from actual upload acceptance and economic equivalence.
- [x] Formal Spec Reviewは実施していない。
