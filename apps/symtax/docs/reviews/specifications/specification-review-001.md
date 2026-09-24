# SymTax Specification Review 001

## Review Target

- **対象:** [SymTax 外部仕様書](../../specification.md)
- **確認対象リビジョン:** `64547ae` (`feature/symtax`)
- **確認日:** 2026-09-24
- **成果物:** `apps/symtax/docs/reviews/specifications/specification-review-001.md`
- **レビュー範囲:** 入出力契約、normalized model、期間・時刻、pagination、Summary、数量・価格評価、Harvest eligibility / aggregation、Cryptact interoperability、network separation、error・incomplete、性能、traceability
- **未確認範囲:** 実Symbol Mainnet / Testnet MongoDBの対象version・履歴保持範囲、bitbank実APIからの指定minute取得、Cryptactへの実アップロードと損益計算、運用環境のnetwork identity evidence。仕様書と上流資料および参照された公式資料を確認し、実環境適合は確認していない。

## Execution Audit

サブエージェントは使用せず、Reviewer A / B / Cの観点を独立したパスで確認した。

- **Reviewer A — 契約の明確性・完全性:** Address、period、record fields、ordering、pagination、state、error、number、CSV contract、適合試験を確認。
- **Reviewer B — 利用価値・運用適合性:** RequirementsのUC・FUNC・EXPORT・PRICE・PERFと受入条件を追い、閲覧から出力まで実装可能な契約か確認。
- **Reviewer C — Security / Interoperability:** `security-checklist.md`の適用範囲から、Mainnet / Testnet binding、MongoDB境界、failure behavior、serialization、privacy、Cryptact互換性を確認。
- **Chair:** findingsの重複を統合し、Specification Review GateとCritical判定条件を適用。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/specification.md` | 主対象。Specification ID、OPEN、適合試験、Traceabilityを確認 |
| `apps/symtax/docs/requirements.md` | 44 Requirement ID、UC、AC、OPEN-001〜010との適合を確認 |
| `apps/symtax/docs/design.md` | adapter責務、network trust boundary、価格・aggregation・export境界、OPEN-001〜010との整合を確認 |
| `apps/symtax/docs/concept.md` | 対象範囲、Harvest限定圧縮、JST、税務非責務を確認 |
| `concept-review-001.md`, `requirements-review-001.md`, `design-review-001.md` | 前段のREADY判定および引継ぎ事項を確認 |
| `.agents/skills/spec-review/*`, `.agents/skills/review-common/*`, `AGENTS.md` | Review Board、Critical / Gate規則、成果物形式、根拠区分を適用 |
| Symbol公式Account / Receipt資料および`docs/knowledge/symbol-openapi3.yml` | Address、Statement / Receipt、type分類に関する仕様書の根拠区分を確認 |
| [bitbank Public API](https://github.com/bitbankinc/bitbank-api-docs/blob/master/public-api.md#candlestick) | Public candle endpoint、1min表記、OHLCV tupleとUnix millisecond timestampの資料上の範囲を確認 |
| [Cryptactカスタムファイル作成方法](https://support.cryptact.com/hc/ja/articles/360002571312-%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%A0%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%81%AE%E4%BD%9C%E6%88%90%E6%96%B9%E6%B3%95)および[公式CSVサンプル](https://support.cryptact.com/hc/article_attachments/16258358690713) | 10列template、日時、volume / price意味、必須欄と公式見本を確認 |

公式bitbank資料はOHLCV tupleとmillisecond timestampを示すが、minute timestampの区間anchor、exact-boundaryの選択、評価に使うOHLC値、zero-volumeの評価規則を示さない。Cryptact資料は汎用custom-file形式・記載例を示すが、Symbol Harvest Fee Receiptのaction mappingやHarvest日次集約の損益同等性は規定しない。仕様書記載の実API取得・Cryptact upload未実施という範囲を独立確認済み事実へ格上げしていない。

## Review Result

**REVISE SPECIFICATION**

## Summary

Specificationは、Transactions / Receiptsの分離、JST calendarと価格lookup instantの分離、exact integer quantity、incomplete state、元Receiptへの追跡、Privacy境界など、主要な上流原則を維持している。44 Requirements IDのTraceability行と40件の外部適合ケースも確認した。

一方で、本書自身が必須機能をBLOCKINGと記録している。Harvestの価格選択、Harvest日次集約の最終eligibility、Cryptactへの取引mappingが確定せず、価格評価・Harvest圧縮・Cryptact出力を実装しても外部結果が一意にならない。また、runtimeのNetwork identityを何の証拠で確定するか、Symbol raw dataをどのnormalized fieldsへ対応させるかが未確定である。これらは中核Requirementの合否と安全な相互運用性を妨げるため、Critical findingとした。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| SR-001 | Critical | New | Specification Review 001 | normalized Transaction / Receiptのtype別data contractとsource mappingが未確定で、認識済みtypeの詳細表示を別実装で一致させられない |
| SR-002 | Critical | New | Specification Review 001 | expected / observed Networkを判定する独立したidentity evidenceと一致規則が一意でない |
| SR-003 | Critical | New | Specification Review 001 | block instantからcandleへの対応、OHLC選択、zero-volume規則が未確定で、必須価格評価を再現できない |
| SR-004 | Critical | New | Specification Review 001 | Harvest Receiptの日次aggregation eligibilityが候補状態に留まり、最終的にeligibleとなる条件がない |
| SR-005 | Critical | New | Specification Review 001 | CryptactのSymbol Transaction / Receipt mappingとHarvest action mappingが未確定で、要求された出力を作成できない |
| SR-006 | Major | New | Specification Review 001 | future `toDateExclusive`の判定により、今日を含む期間および当月の月navigationが拒否される |
| SR-007 | Major | New | Specification Review 001 | 全期間Exportに有限の受付条件または上限到達時の外部結果がなく、Resource contractが完結していない |

## Required Changes

次のCritical findingを解消し、仕様と適合試験を更新すること。

### SR-001 — type別Normalized modelとSymbol source mappingが未確定

- **対象箇所:** `specification.md` §5.1–5.3（特にL154–181、L201–240）、OPEN-SPEC-001 / 006（L645、L650）
- **確認事実:** Transactionは「type details」を利用者確認に必要な意味fieldとするだけで、25 typeごとのfield意味・完全性基準がない。Receiptは16 typeをrecognizedとしながら、多くの型でamount、target、source等のnormalized意味を定めていない。Statement source、receipt ordinal、page ordering keyと実際のSymbol sourceとの対応も未検証事項として残る。
- **根拠:** Requirements `FUNC-003` / `FUNC-004`、`AC-001` / `AC-002` はTransactionsおよびReceiptsを確認可能にする。Design §11.1はtype分類、raw field対応、Statement / Block参照規則をSpecificationへ引き継ぐ。
- **影響:** 実装ごとに同じTransaction / Receiptの詳細、address role、amount、identity、completenessが異なり得る。recognized typeをpartialとする条件も一意でなく、外部結果と履歴網羅性を受け入れ試験で判定できない。
- **必要な最小修正:** 初期対応typeごとにBrowser向けnormalized semantic fieldsとcomplete / partial / unsupported条件を定め、対象Symbol source/schema versionからの意味対応を確認する。Node固有のcollection/queryは固定せず、未対応Node versionやsource欠損の挙動も定義する。
- **完了条件:** 要求対象の各typeについて、同じsource recordから同じnormalized resultとcompletenessが得られる適合fixture / observable caseを提示できる。

### SR-002 — Mainnet / Testnetのidentity proofが一意でない

- **対象箇所:** `specification.md` §3.2 `SPEC-NET-002`（L89–93）、CT-032（L614）、OPEN-009（L638）
- **確認事実:** Network name、`/network/properties`、および一般的な「確認可能なchain identity情報」を照合するとするが、どのNode情報をidentity evidenceとし、expected fingerprintを何から作り、どう照合するかは環境配備時まで未定である。CT-032も「identity evidence mismatch/unknown」の結果だけを確認し、evidence自体を規定しない。
- **根拠:** Requirements `CON-004` / `SEC-003`、Design `DD-007` / OPEN-009は誤接続時にnetworkを混在させないfail-closed境界を要求し、具体的identity evidenceを後続へ残している。
- **影響:** 異なるnode identityを持つ環境をMainnet / Testnetのどちらとして受け入れるか、独立実装で異なり得る。wrong-chain dataを返す可能性を排除する条件が検証できないため、network trust boundaryが外部契約として閉じていない。
- **必要な最小修正:** 要件・Designの責任者が承認したNode identity evidenceの種類、expected値の供給・pin主体、照合条件、証拠欠落・不一致時の結果を定める。公式または運用上の根拠が確認できなければ推測せず、identity方式が確定するまで当該runtimeを利用不能とする明示的release gateを維持する。
- **完了条件:** 既知のMainnet、Testnet、誤接続、証拠欠落の外部試験で受け入れ／fail-closed結果が一意になる。

### SR-003 — Receipt時刻から市場価格を選ぶ規則が未決定

- **対象箇所:** `specification.md` `SPEC-PRICE-005` / `006`（L373–393）、`SPEC-PRICE-007`（L397–399）、OPEN-002 / 003（L631–632）
- **確認事実:** 60,000ms minute区間を候補とするが、bitbank candle timestamp anchor、exact-boundary選択、OHLC採用値を確定していない。volume 0の足も価格として使えるか未定である。仕様書はこれらをBLOCKINGとし、評価・JPY Summaryをcompleteにしない。
- **根拠:** Requirements `PRICE-002` / `PRICE-004` / `PRICE-005`、`EXT-001`、受入条件`AC-007` / `AC-008`。Design §11.2は価格足対応・OHLC・欠損扱いをSpecificationへ委譲。
- **影響:** 同一Block timestampに対する選択candle、selected price、円評価が実装によって異なるか、評価機能が一切有効化できない。要求される根拠提示と価格評価の適合を検証できない。
- **必要な最小修正:** bitbank資料・実応答または承認済み製品評価規則から、timestamp区間、境界、OHLC値、volume 0・candle欠損の決定的な規則とversionを定義する。税務上唯一の正解とは表現しない。
- **完了条件:** minute境界前後、exact boundary、OHLC値差、volume 0、欠損の各fixtureで同じPrice Observation / evaluation stateが得られ、価格sourceとrule provenanceを確認できる。

### SR-004 — Harvest日次集約の最終Eligibility規則がない

- **対象箇所:** `specification.md` §9.1–9.2（L407–419）、§9.3（L423–433）、OPEN-001（L630）
- **確認事実:** `eligible` / `ineligible` / `unknown`状態と`eligible-candidate`条件はあるが、税務方式、同日売却、取引順序を理由に、最終的にどのReceipt集合をeligibleにできるかは明示的にBLOCKINGである。現仕様からはすべてのcandidateがunknownなのか、特定groupがeligibleなのかを決定できない。
- **根拠:** Requirements `EXPORT-001` / `EXPORT-003`〜`EXPORT-006`、`AC-005` / `AC-006`、UC-004 / UC-005。Design OPEN-001は税務判断をAggregation componentへ持たせず、Specがeligibility boundaryを供給するとする。
- **影響:** Harvest日次圧縮という初期リリースの主要機能で、1行へ圧縮可能なデータがない。異なる実装で集約対象集合が変わるか、誤って全件拒否する。元Receiptを保持するだけでは要求されたCryptact向け日次集約を実現しない。
- **必要な最小修正:** 税務判断をSymTax自身が作らず、確認済みの外部・製品方針を入力として、JST日、type、asset、価格評価、同日順序・売却等の境界を含むeligible/ineligible/unknown判定表を定義する。判断根拠を確認できない条件はunknownとし、個別出力へのfallback結果を明示する。
- **完了条件:** eligible / ineligible / unknownの具体record集合に対する決定的な適合fixtureがあり、eligible集合だけが追跡可能なHarvest日次行になる。

### SR-005 — Cryptact向けmappingがなくRequired Exportが生成できない

- **対象箇所:** `specification.md` §10.1–10.5（L439–502）、OPEN-005（L634）、OPEN-SPEC-003 / 005 / 007（L647、L649、L651）
- **確認事実:** generic CSV header / column semanticsは定義されている一方、`SPEC-EXPORT-002`はSymbol typeからCryptact action、coin、volume、price、feeへのmappingを未解決とし、`SPEC-EXPORT-003`はHarvest actionを確定せず個別・日次Exportをblockする。decimal scale、rounding、serialization細部も未確定である。公式資料は汎用取引記載例を示すが、Symbol Harvest分類やaggregate計算互換性を定めない。
- **根拠:** Requirements `EXPORT-001` / `EXPORT-002` / `EXPORT-007`、`EXT-002`、受入条件`AC-005` / `AC-006`。Design OPEN-005はCryptact現行受入・Harvest mapping・aggregate result確認をSpecificationへ委譲。
- **影響:** 初期リリースのIndividual / Harvest Daily両modeに1件も規範的なmappingがなく、formatの受入とCryptactでの経済的結果も別実装から判定できない。ファイルが作れたかだけではAC-005 / AC-006を満たしたことにならない。
- **必要な最小修正:** 公式資料または承認済み利用者・税務判断により、初期対象のTransaction / Receipt / Harvestについてaction・asset・数量・price・counter・fee・date mappingとCSV精度 / serializationを確定する。日次集約のupload受入と個別登録との差は別途確認し、確認できないならHarvest Daily Exportを初期公開対象から外す Requirements decision を得る。いずれも推測で決めない。
- **完了条件:** 全ての初期選択対象にmappingがあり、公式templateに対するfile acceptanceと、日次modeに対する明示的な差分・制約の確認結果が仕様と適合試験に記録される。

## Optional Improvements

### SR-006 — exclusive endの未来日拒否が現在日を参照不能にする

- **Severity:** Major
- **対象箇所:** `SPEC-IN-005`（L105–111）
- **事実と影響:** `toDateExclusive`が現在のJST日より未来なら拒否する一方、当日を含む区間は翌日をexclusive endとする必要がある。従って今日を含む日参照および当月navigationの`toDateExclusive`が拒否される。CT-006でfuture date拒否、CT-007/008でJST境界を試すが、この組合せを扱っていない。
- **最小改善・完了条件:** future **recordsを含む区間**と、現時点までの履歴を含めるための将来側calendar boundaryを区別する規則を明確にし、今日・当月・未来record要求の期待結果を適合ケースへ追加する。

### SR-007 — 全期間Exportのresource limit / 上限時結果が未定義

- **Severity:** Major
- **対象箇所:** `SPEC-RES-001` / `002`（L559–565）、OPEN-008（L637）
- **事実と影響:** browse responseは100件にboundされるが、全期間Exportの最大期間・最大output・server-side継続処理の上限と、上限到達時の結果はない。公開時のunbounded ExportをBLOCKINGとする記述だけでは、実装者が受け付けるrequestと拒否状態を決められない。
- **根拠:** Requirements `PERF-001`〜`PERF-004` / `AC-009`、Design §8.2はbounded processingと計測後の性能目標を要求する。
- **最小改善・完了条件:** 数値を実測で合意するか、上限到達でincomplete/rejectedに終える外部契約を先に確定し、代表負荷試験と上限結果を結び付ける。任意の秒数やbyte値は追加しない。

## Resolved Findings

なし。Specification Review 001の初回レビューである。

## Upstream Feedback

### UFB-SPEC-001 — Node identity evidenceの決定責任と根拠

- **送信元フェーズ:** Specification Review
- **受領すべき上流フェーズ:** Design
- **対象となる正式資料 / decision:** `design.md` OPEN-009、DD-007、Requirements `CON-004` / `SEC-003`
- **不足・曖昧さ・矛盾:** DesignはNode identityの独立確認とfail-closed責務を確定する一方、証拠sourceとoperational validationを後続へ残している。仕様作成時にも、公式または承認済みのNode evidenceを特定できなかった。
- **下流への影響:** Specificationでの`SPEC-NET-002`規則を一意にできず、Mainnet / Testnet誤接続の受入試験と安全なrelease判断を完了できない。
- **non-normative status:** feedback only。Requirement、Design decision、Specification contract、Gate結果ではない。
- **解消条件:** Design ownerが採用可能なidentity evidenceと期待値のowner / provisioning根拠を確定または、該当runtimeを公開前に止める明示的運用制約を承認し、Specificationへ正式反映する。

## Deferred Findings

- 実Mainnet / Testnet MongoDB version、保存範囲、Statement→Block参照、source identityを実ノードで検証すること（OPEN-007、SR-001に関連）。
- bitbank実APIでの取得・保存・再取得を実環境で検証すること。今回のWeb確認は公式docsの形状確認で、指定timestampのAPI応答確認ではない。
- Cryptactに実際のfileをuploadして受理・損益計算を比較すること。アカウント操作を行わず、資料で確認できない事実を補っていない（SR-005に関連）。
- OPEN-004 Provider correction candidateの採用・修復運用、OPEN-010 retention/access policyは、記載済みの境界を維持した運用判断として後続へ残る。

## Scope and Traceability

- 対象は`apps/symtax/docs/specification.md`のみ。仕様、Concept、Requirements、Design、コード、テストは変更していない。
- Specificationのtraceability表に44 Requirement IDが並び、各行にDesign responsibility、Specification ID、Conformance caseの参照があることを確認した。
- TransactionとReceiptの独立、JST calendarとprice instant、原履歴と派生集約、価格観測とReceipt評価、SymTaxとCryptact mappingの境界は維持されている。
- Traceabilityの存在だけでは、SR-001〜005に記したnormalized field semantics、security proof、price、aggregation、exportが実装可能な詳細まで確定したことにはならない。
- Concept / Requirements / Design各ReviewはREADY。今回のREVISEは承認済み上流方針との矛盾ではなく、その必須契約が仕様で一意に閉じていないことによる。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| 要件追跡 | 部分合格 | 44 ID全てにtraceability rowがある。traceabilityは完全性を示すが、Criticalの契約不足を解消しない。 |
| Address / period validation | 要修正 | Symbol address / checksum / network分離を定義する。期間ではcurrent dayを含むend boundaryを拒否する。 |
| Normalized data contract | 不合格 | type enumerationはあるがtype-specific normalized fields、source mapping、completeness条件が未確定。 |
| Pagination / summary | 部分合格 | bounded page size、keyset、continuation binding、JST bucketを定義。一部stable key構成sourceはOPENで未検証。 |
| Price / quantity | 不合格 | exact amount規則は明確だが、candle / OHLC / zero volumeがblockingであり、価格評価を決定的にできない。 |
| Harvest aggregation | 不合格 | original referencesや派生合計は定義するが、eligible groupを決める規則がなく、daily modeが出力できない。 |
| Cryptact interoperability | 不合格 | generic headerとfield semanticsは確認済み。Symbol type mapping、Harvest mapping、rounding/upload/economic behaviorは未確定。 |
| Security / privacy / network | 不合格 | secretやDB boundary、network fail-closed結果は明示するが、observed Networkを証明するevidenceが規定されない。 |
| Error / incomplete / export completeness | 合格 | incomplete/unavailable/unsupportedを空や0へ変換せず、full exportの拒否理由も扱う。 |
| Conformance | 部分合格 | 40ケースあるが、network evidence、current-day boundary、normalized type fields、実mappingによるexport合格を閉じるfixtureがない。 |

## Validation Results

- `AGENTS.md`、spec-review Skill一式、Review Common Playbookを確認し、Phase 0〜3を適用した。
- Concept、Requirements、Design、3件の上流Review、対象SpecificationのOPEN・Traceability・Conformance表を照合した。
- bitbank Public API公式資料とCryptact公式custom CSV説明・CSV sampleを確認した。Symbol事項は仕様書に挙げた公式資料とrepository knowledge snapshotの区分を確認した。
- 44 Requirement IDがtraceability表へ存在すること、40 CT case IDがあることを確認した。
- 文書レビューなので実装test/buildを実行していない。実MongoDB / REST node、bitbank API応答、Cryptact uploadは未確認である。
- レビュー開始時のbranchは`feature/symtax`、作業treeはcleanだった。レビュー中は対象文書を変更していない。

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. 目的と範囲 | 合格 | Symbol履歴参照と出力支援、Harvest限定圧縮、税務判断非責務を維持。 | — |
| 2. 契約 | 不合格 | normalized type details、network proof、price selection、Cryptact mappingが一意でない。 | SR-001〜003、SR-005 |
| 3. 処理と例外 | 不合格 | Harvestのeligible集合を決められず、必須daily outputが実装不能。 | SR-003〜005 |
| 4. 内部整合性 | 合格（Major改善あり） | period contractは決定的だが、exclusive endを未来日拒否するため今日・当月を指定できない利用上の境界がある。 | SR-006 |
| 5. 検証可能性 | 不合格 | 必須価格・集約・export・network identity結果を異なる実装で同じfixtureから判定できない。 | SR-001〜005 |
| 6. 安全性と相互運用性 | 不合格 | network evidenceおよびCryptact mappingが不特定で、wrong-network受入とformat/actionの一意な相互運用性を確認できない。 | SR-002、SR-005 |
| 7. 上流整合性 | 部分合格 | 方針自体は保持するが、Requirementsの必須PRICE / EXPORT受入条件はblocking状態のまま。 | SR-003〜005 |

## Remaining Risks and Open Decisions

- OPEN-001〜005、OPEN-007〜010とOPEN-SPEC-001〜008のうち、必須機能を阻害するものをRequired Changesへ上げた。OPEN-004の価格訂正運用、OPEN-007の実環境検証、OPEN-010の具体的保持期間・アクセス方針は未確認のまま。
- ReviewはSymbol Node DB schemaや実data coverageが十分であると保証しない。
- Reviewはbitbank価格ruleやCryptact取引分類を決定しない。根拠不足を埋めるための税務推論はしていない。

## Automatic Changes

レビュー成果物 `apps/symtax/docs/reviews/specifications/specification-review-001.md` のみ新規作成した。対象Specification、上流資料、コード、テストは変更していない。

## Final Decision

**REVISE SPECIFICATION** — SR-001〜005のCritical findingが解消され、Required Changesの完了条件を適合試験から判定できるまで、Specificationは実装開始可能な状態ではない。
