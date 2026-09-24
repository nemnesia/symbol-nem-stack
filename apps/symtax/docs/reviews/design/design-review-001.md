# SymTax Design Review 001

## Review Target

- **対象:** [SymTax 基本設計書](../../design.md)
- **確認対象リビジョン:** `2cc6955` (`feature/symtax`)
- **確認日:** 2026-09-24
- **成果物:** `apps/symtax/docs/reviews/design/design-review-001.md`
- **レビュー範囲:** 承認済みRequirementsとの整合、責務・依存方向、trust boundary、データ所有とlifecycle、主要フロー、失敗・再試行、性能方針、設計判断、OPEN-001〜010、Specificationへの引継ぎ
- **未確認範囲:** 実Mainnet/Testnet Node MongoDBの接続・履歴網羅性、bitbank APIの実応答、Cryptactへの実取込と計算結果。設計書でも成立性・外部確認事項として明示されている。

## Execution Audit

サブエージェントは使用せず、次の観点を独立した自己レビューの4パスで確認した。

- **Reviewer A — 構造と責務:** コンテキスト、各コンポーネントの責務、依存方向、Symbol adapterへのMongoDB依存隔離、Transaction / Receipt分離、データ所有を確認。
- **Reviewer B — Security Reviewer:** 対象となる公開アドレス・履歴情報、Browser / Server / Node / Data Storeのtrust boundary、DB credentialとread-only境界、Mainnet / Testnet fail-closed、Privacyとログの責任を確認。秘密鍵・署名権限は対象外であることも確認。
- **Reviewer C — フローと運用:** 価格取得・保存、valuation、Harvest集約、Exportの中断・再試行・再起動、incomplete state伝播、運用上の成立性を確認。
- **Reviewer D — 追跡と下流実装可能性:** Requirements 44 ID、OPEN-001〜010、設計判断、Specification handoffの追跡と、未確定事項を下流が推測せず決められるかを確認。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/design.md` | 主対象。設計構造、各責務、失敗モデル、設計判断、OPEN、Traceabilityを確認 |
| `apps/symtax/docs/requirements.md` | 承認済み44要件、制約、受け入れ条件、OPEN項目との整合を確認 |
| `apps/symtax/docs/concept.md` | プロダクト目的、初期境界、JST、価格・Harvest集約方針との整合を確認 |
| `apps/symtax/docs/reviews/concept/concept-review-001.md` | 前段判定READYと未確認事項の引継ぎを確認 |
| `apps/symtax/docs/reviews/requirements/requirements-review-001.md` | Requirements判定READY、44要件およびOPENの扱いを確認 |
| `AGENTS.md`、`.agents/skills/design-review/`、`.agents/skills/review-common/` | 根拠区分、レビュー範囲、Severity、Gate、成果物形式を適用 |
| `docs/knowledge/symbol-openapi3.yml`、Designに記録された `_symbol` checkout確認 | Symbol Statement / Receipt用語と、MongoDB挙動を特定Catapult実装の範囲に限定していることを確認。実ノードDB契約の根拠にはしていない |

今回、外部API、実Node MongoDB、Cryptactへの実取込は再検証していない。設計書がこれらを確認済み事実として扱っていないことを確認した。

## Review Result

**READY**

## Summary

設計書は、承認済みRequirementsの範囲を変えず、単一Next.js Serverを中心に責務を分けている。BrowserからMongoDBへ接続せず、Node固有のraw表現をSymbol History Adapterで正規化し、TransactionとReceiptを独立した取得・集計経路として保つ境界が明確である。

JSTの集計日境界とblock timestampに基づく価格lookupを分離し、価格観測とReceipt別評価を区別している。Harvest日次集約は個別Receipt・個別評価を残す派生処理として扱い、unknownや欠損を正常値へ変えず、未完了のExportを完成品として渡さない責務も記載されている。

44件のRequirement IDがTraceability表に割り当てられ、OPEN-001〜010について設計で確定した責務境界とSpecification・実環境確認へ残す事項を区別している。Gate不合格となるCritical指摘は確認しなかった。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| なし | — | — | 初回レビュー | Gate不合格となるCritical指摘、および正式なMajor / Minor指摘は発行しなかった。 |

## Required Changes

なし。

## Optional Improvements

なし。

## Resolved Findings

なし。初回のDesign Reviewであり、追跡対象となる過去のDesign findingはない。

## Upstream Feedback

なし。承認済みRequirementsとConceptの間に、Designを安全に評価・完了できない不足・曖昧さ・矛盾は確認されなかった。

## Deferred Findings

以下はDesign欠陥ではなく、設計書のSpecification handoffまたはOPEN項目に沿って後続で確認・決定する事項である。

| 論点 | 後続で確認する内容 | 関連要件 / OPEN |
|---|---|---|
| 実Node MongoDBの成立性 | 対象Node version、Mainnet / Testnetのデータ範囲、保持履歴、Statement・Block参照、期間指定取得の網羅性を実環境で確認する。設計書は特定checkoutのCatapult実装と一般的なMongoDB契約を区別している。 | CON-001〜003、FUNC-001〜004、EXT-003 / OPEN-007 |
| 価格評価根拠の再現 | Receiptごとのblock timestamp、採用したimmutable price observation、Provider・粒度、評価規則を後から検証できるSpecification上の契約を定める。request-local valuationを再生成する場合も、価格観測の選択と規則が再現可能であることを確認する。 | PRICE-002〜005、EXPORT-005〜006 / OPEN-002〜004 |
| 価格観測の再取得・競合 | append-only観測を前提に、異なる再取得値の識別、標準観測の選択、訂正候補の採用・再評価手順を確定する。 | PRICE-003〜005、EXT-001 / OPEN-004 |
| Cryptact互換性 | 現行ファイル受入形式、Harvestの取引表現、集約行の計算上の扱いを公式仕様と実取込で確認する。個別明細との経済的差異を税務上の同等性と混同しない。 | EXPORT-001〜007、EXT-002 / OPEN-005 |
| 集約可能条件 | Harvestだけを初期圧縮対象とし、税務方式・同日中の売却等・取引順序に関わる条件は根拠確認後に決める。unknown / ineligible時の個別出力可能範囲も仕様化する。 | EXPORT-003〜006 / OPEN-001 |
| 運用・Privacy | network identityの独立した証拠源、実行環境の構成、ログ・一時stagingの保持期間とアクセス責任を確定する。 | CON-004、SEC-003、PRIV-001 / OPEN-009、OPEN-010 |
| 性能基準 | 数年分・月数百〜数千Receipts・月700件程度のHarvest Receiptを含む代表データで測定し、応答・メモリ・Store容量の数値合否目標を合意する。 | PERF-001〜004 / OPEN-008 |

## Scope and Traceability

- 対象はSymTax基本設計書1件。Concept、Requirements、コード、テスト、Specificationは変更していない。
- DesignのTraceability表はCON、FUNC、EXPORT、PRICE、DATA、PERF、QUAL、SEC、PRIV、EXTの44 Requirement IDを設計責務とSpecification引継ぎへ割り当てていることを確認した。
- TransactionsとReceiptsはBrowse、Normalized model、Summary、表示カテゴリで独立している。Statement / Blockの技術的関係はReceipt側の取得・時刻解決境界に閉じており、単一履歴モデルへflattenしていない。
- 初期の日次圧縮対象はHarvest関連Receiptのみ。個別Receipt・価格評価を原データから派生する結果として扱い、元履歴を置換・削除しない。
- Symbol Node MongoDBはServer側adapterからread-onlyで参照し、MongoDB schema依存を境界内へ隔離する。SymTax市場データはNode DBと分離されている。
- Mainnet / Testnetはruntime / deployment単位で固定し、identity不一致・不明の場合のfail-closed責務とmarket price dataのnetwork非依存性を区別している。
- 設計書で外部仕様・実環境を未確認とした内容を事実へ格上げしていない。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| システムコンテキスト・責務 | 合格 | Browser、Next.js Server、Symbol Node MongoDB、SymTax Data Store、bitbank、Cryptactを区別し、Cryptactを利用者がファイルを取り込む外部主体としている。 |
| 依存方向・境界 | 合格 | Browser → Server → domain / ports → adaptersの方向を記載。raw Node BSONとCryptact・bitbank形式を上位domainへ漏らさない。 |
| Transaction / Receipt | 合格 | 取得・domain・summary・表示カテゴリを独立させ、TransactionへReceiptを内包しない。 |
| データ所有・lifecycle | 合格 | raw chain data、normalized request-local data、共通価格観測、valuation、summary、aggregation、export、検索条件のownerと保持・再生成方針を表にしている。 |
| 主要フロー・失敗・再試行 | 合格 | 閲覧、階層遷移、価格hit/miss/unavailable、個別出力、Harvest集約、集約不可、履歴不完全、network不一致を扱い、欠損を0や完全成功へ変換しない。 |
| 性能・運用 | 合格 | 指定範囲参照、bounded normalization / aggregation / export、ページ単位の表示、代表負荷の検証方針を明記。数値閾値は計測後へ残す。 |
| Security — protected assets / secret ownership / signing authority | 適用対象外を確認 | SymTaxは秘密鍵・ニーモニック・署名権限を扱わず、ウォレット機能も提供しない。Node credentialはServer runtime側の接続境界に限定される。 |
| Security — trust boundary / input / failure | 合格 | Browser入力を未信頼とし、DB接続情報とraw dataを露出させない。network identity不明・不一致、schema・履歴・価格欠損は安全側で停止またはincompleteとして伝播する。 |
| Security — chain / network separation | 合格 | Testnet/Mainnetを別runtimeに束縛し、Node identityの確認不能もfail-closedとする。chain由来データと共通市場価格を分離する。 |
| Security — logs / Privacy | 合格 | 公開アドレスと履歴の関連を慎重に扱い、不要な履歴・credentialを無制限に記録しない。具体保持期間はOPEN-010として残る。 |
| Security — lifecycle / replacement / recovery | 適用範囲を確認 | secret lifecycleやsigningはない。価格再取得・Export途中失敗・再起動について、既存観測や元履歴を破壊せず再試行する責務を記載している。 |
| Specification handoff | 合格 | Type分類、raw field対応、timestamp・OHLC・価格欠損、集約適格性、Cryptact形式、UI状態、paging契約などを具体設計へ委譲し、上位で確定した境界とは区別している。 |

## Validation Results

- Design、Requirements、Concept、前段のConcept / Requirements Reviewを読み合わせた。
- Traceability表の44 Requirement IDとOPEN-001〜010の状態記録を確認した。
- `git status --short --branch`でレビュー開始時の作業ツリーがcleanであることを確認した。
- 文書レビューのためコード・API・Node DB・bitbank・Cryptactの実動作検証は実施していない。これらは未確認範囲または下流の成立性確認として記録した。
- レビュー成果物以外のファイルは変更していない。

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. 目的と範囲 | 合格 | Symbol履歴参照・整理・出力に限定し、税務計算・署名・NEM等を対象外としている。 | — |
| 2. コンテキストと責任 | 合格 | Browser、Server、Node、SymTax Store、外部Provider・Export先の責任とtrust boundaryが明確。 | — |
| 3. 依存方向 | 合格 | MongoDB、bitbank、Cryptact固有表現への依存を各adapterへ閉じている。 | — |
| 4. 主要フロー | 合格 | 正常、部分失敗、retry、restart、完成前Exportの扱いが記載されている。 | — |
| 5. データ所有 | 合格 | raw source、永続価格観測、一時的派生値、利用者検索条件のownerとlifecycleを区別している。 | — |
| 6. Securityと相互運用性 | 合格 | secret/signing capabilityを持たず、read-only Node境界、Privacy、Mainnet / Testnet分離を弱めていない。 | — |
| 7. 上流整合性 | 合格 | Harvestのみの日次圧縮、JST、元Receiptの追跡、価格根拠保持、税務判断の非責務を維持している。 | — |
| 8. 下流実装可能性 | 合格 | 44要件に責務主体があり、OPEN・仕様事項と設計確定事項を区別している。 | — |

## Remaining Risks and Open Decisions

OPEN-001〜010は設計書に記載された範囲で継続する。特に、集約条件と税務方式、block timestampからbitbank 1分足への対応、価格欠損・訂正、Cryptactの現行受入仕様、実Node MongoDBの網羅性、定量性能目標、network identityの運用証拠、Privacy保持期間はSpecificationまたは実環境・運用確認が必要である。これらはDesign Gateを妨げる欠陥ではなく、設計書のhandoff対象である。

## Automatic Changes

レビュー成果物 `apps/symtax/docs/reviews/design/design-review-001.md` のみ新規作成した。対象Design、Requirements、Concept、コード、テストは変更していない。

## Final Decision

**READY** — Specificationへ進める。
