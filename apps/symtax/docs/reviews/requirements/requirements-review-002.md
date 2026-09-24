# SymTax Requirements Review 002

## Review Target

- **対象:** [要件定義書](../../requirements.md)
- **確認対象リビジョン:** `2d57298` (`feature/symtax`)
- **確認日:** 2026-09-25
- **成果物:** `apps/symtax/docs/reviews/requirements/requirements-review-002.md`
- **レビュー範囲:** 全Requirement、利用者・責任・範囲、受け入れ条件、Conceptおよび直近の別MongoDB instance分離追記
- **未確認範囲:** 実Node / MongoDB環境、bitbankおよびCryptact実サービスの運用結果。下流Design / Specificationの正しさは本レビューの判定根拠にしない。

## Execution Audit

- **Reviewer A — 明確性と完全性:** 要件ID、規範語、対象範囲、制約、責任、OPEN項目、ACとの対応を確認した。
- **Reviewer B — 利用価値とスコープ:** Conceptとの整合、Symbol履歴参照・Harvest件数削減の価値、初期対象と対象外の境界を確認した。
- **Reviewer C — Security:** protected assetの非対象、Node DBのread-only責務、Browser境界、network分離、今回追加されたMongoDB instance・lifecycle分離要求を確認した。
- **Chair:** 3観点を別パスで確認し、候補を統合してGateと判定を適用した。サブエージェントは使用していない。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/requirements.md` | 主対象。44要件、AC、OPEN、Traceabilityを確認 |
| `apps/symtax/docs/concept.md` | 目的、初期スコープ、DB参照方針、Testnet/Mainnet境界との整合を確認 |
| `apps/symtax/docs/reviews/concept/concept-review-001.md` | 公開済みREADY判定と未解決Criticalの有無を確認 |
| `apps/symtax/docs/reviews/requirements/requirements-review-001.md` | 前回READY判定および既存OPENの引継ぎを確認 |
| `.agents/skills/requirements-review/*`, `.agents/skills/review-common/*`, `AGENTS.md` | Review Board、Gate、出力形式、根拠境界を適用 |
| ユーザー提供のMongoDB分離要件 | `CON-003`、`SEC-004`、`AC-012`の意図との一致を確認 |

## Review Result

**READY**

## Summary

要件は、SymbolのTransactionとReceiptを独立して参照・集計し、Harvest関連Receiptの根拠を保持した出力を支援する初期目的と責任境界を維持している。今回の変更では、Symbol Node MongoDBとSymTax Data Storeを別mongod process / instanceとすること、同一host共置を許容する条件、read-only接続およびデータ/lifecycle保護が既存IDに追記され、`AC-012`から第三者が運用構成を確認できる。

新しいCritical / Major / Minor findingはない。OPEN-001〜010は推測で解消されず、要件書の未決事項として保持されている。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| なし | — | — | Review 002 | Gate不合格となる欠陥、または正式な任意改善findingは確認しなかった。 |

## Required Changes

なし。Critical findingはない。

## Optional Improvements

なし。

## Resolved Findings

なし。前回Requirements Reviewに正式findingはなく、READY判定を維持する。

## Upstream Feedback

なし。Conceptの目的・Harvest限定圧縮・JST・Testnet開発/Mainnet公開の方針との矛盾は確認しなかった。

## Deferred Findings

- OPEN-001〜010は、要件書に示すDesign / Specification / 外部確認の段階へ引き継ぐ。これらは本レビューで新たに解決していない。
- MongoDBのversion、host / container構成、port、resource数値は要件で固定されていない。ユーザー指定のinstance/processと分離境界を満たす限り、後続の運用設計へ委譲する。

## Scope and Traceability

- `CON-003`はSymbol Node MongoDBとSymTax独自永続データのMongoDB instance/process分離を定め、同一mongod内のdatabase名だけの分離を禁止する。同一host共置は条件付きで許容する。
- `SEC-004`はStoreの障害・保守とNode側のresync / upgradeの相互影響防止、およびNode DBへの誤書込み防止を定める。
- `AC-012`はprocess identity、接続文字列、credential、storage、lifecycle、resource設定、Node read-onlyおよび保守・再構築時のデータ保持を確認対象にする。
- 既存要件IDを再採番せず、既存OPEN-001〜010およびMainnet/Testnet境界を変更していない。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| 要求の目的・範囲・利用者 | 合格 | Symbol履歴確認・整理・出力が中心で、税務判断やウォレット機能を含めない。 |
| 要件と受け入れ条件 | 合格 | 主要機能、性能、価格、Privacy、network境界をID化し、`AC-001`〜`AC-014`へ追跡できる。 |
| MongoDB instance境界 | 合格 | `CON-003`が別mongodを必須とし、同一process内の別databaseを明示的に不許可とする。 |
| Security / integrity / authorization | 合格 | 秘密鍵・署名を対象外とし、Node DBのread-only、Browser非接続、SymTax誤書込み防止を定める。 |
| Lifecycle / recoverability | 合格 | Storeの障害・backup/restore等とNodeのresync/rebuild/upgradeを分離し、ACで確認可能。 |
| Chain / network separation | 合格 | Testnet開発とMainnet公開の境界および混在禁止を維持している。 |
| OPENと責任分界 | 合格 | 税務・外部仕様・性能値・Node schema等は未決事項として残し、税務判断をSymTaxへ移していない。 |

## Validation Results

- RequirementsとConcept、前回の公開レビュー判定を照合した。
- `CON-003`、`SEC-004`、`AC-012`およびTraceabilityのID対応を確認した。
- 文書レビューのため実装テスト、実Node、外部サービス試験は実行していない。
- 開始時点で未コミットのImplementation変更が存在したため保持し、本レビュー成果物以外は変更していない。

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. 目的と課題 | 合格 | Symbol履歴の確認・整理とHarvest Receipt件数削減の目的が明確。 | — |
| 2. 利用者と責任 | 合格 | SymTax、利用者、Node運用者、外部Provider / Cryptactの責任を区別。 | — |
| 3. 対象範囲 | 合格 | Symbol、Testnet / Mainnet、Transaction / Receipt、初期対象外が整合。 | CON-004、SEC-003 |
| 4. 要件と制約 | 合格 | MongoDBのinstance分離を含む制約とOPEN項目を区別。 | CON-001〜007、SEC-001〜004 |
| 5. 受け入れ条件 | 合格 | 主要MUSTと独立Storeの運用条件を外部から確認できる。 | AC-001〜014 |
| 6. 内部整合性 | 合格 | Original data保持、Harvest限定集約、read-onlyおよびinstance分離に矛盾なし。 | CON-003、EXPORT-003〜006、SEC-004 |
| 7. 不可欠な前提 | 合格 | 外部確認・性能数値等の未確定をOPENへ明示。 | OPEN-001〜010 |
| 8. コンセプト整合性 | 合格 | Conceptと前段READY判定の目的・範囲を維持。 | — |

## Remaining Risks and Open Decisions

OPEN-001〜010は継続している。実node coverage、価格選定・欠損、Cryptactとの整合、性能のrelease threshold、Privacy運用等は各OPENに定める段階で判断する。別mongod instance分離について新たなOPENは発生していない。

## Automatic Changes

レビュー成果物 `apps/symtax/docs/reviews/requirements/requirements-review-002.md` のみ新規作成した。要件・Concept・Design・Specification・Implementationは変更していない。

## Final Decision

**READY** — Design / Specificationの既存成果物と整合し、要件として受け入れ可能。
