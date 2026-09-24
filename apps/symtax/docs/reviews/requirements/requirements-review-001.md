# SymTax Requirements Review 001

## Review Target

- **対象:** [SymTax 要件定義書](../../requirements.md)
- **確認対象リビジョン:** `e17015c` (`feature/symtax`)
- **確認日:** 2026-09-24
- **成果物:** `apps/symtax/docs/reviews/requirements/requirements-review-001.md`
- **レビュー範囲:** 根拠追跡、目的・利用者・責任、対象範囲、要件・制約、受け入れ条件、性能、セキュリティ、外部連携、OPEN-001〜010の引継ぎ
- **未確認範囲:** SymbolノードMongoDBの実データ・保持履歴・スキーマ適合、個別日のbitbank API応答の独立再取得、CryptactへのHarvest出力の実取込と損益計算結果。これらは要件書でも未決定・未確認として扱われている。

## Execution Audit

独立したサブエージェントは使用せず、次の担当観点を別パスで自己レビューした。

- **Reviewer A — 明確性と完全性:** 要件ID、MUST等の意味、根拠、用語、受け入れ条件、文書内整合を確認。
- **Reviewer B — 利用価値とスコープ:** 目的・主要利用者から機能へ追跡できること、Harvestのみの初期圧縮、対象外、外部主体との責任境界を確認。
- **Reviewer C — Security Reviewer:** 対象となる保護対象・責任を限定して、公開アドレスと履歴データ、MongoDB trust boundary、read-only、Testnet/Mainnet分離、失敗時の完全性表示を確認。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/requirements.md` | 主対象。要件、受け入れ条件、OPEN、Traceabilityを確認 |
| `apps/symtax/docs/concept.md` | 承認済み目的、初期範囲、責任、確定事項、OPEN-001〜010との整合を確認 |
| `apps/symtax/docs/reviews/concept/concept-review-001.md` | 前段判定READY、ブロック指摘なし、未確認事項の引継ぎを確認 |
| `AGENTS.md`、Requirements Review SkillとReview Common Playbook | 根拠区分、レビュー範囲、判定ゲート、出力形式を適用 |
| `docs/knowledge/symbol-openapi3.yml` | Transaction Statement / Receiptの用語確認。MongoDBのデータ構造根拠には使用しない |
| 要件書に記載されたbitbank・Cryptact公式資料 | 公式資料で確認した事実と、利用者提供結果・未確認事項の区別を確認 |

要件書に記録された公式資料確認は、bitbankのXYM/JPYペアと1分足API仕様、およびCryptactのカスタムファイル案内に限られている。今回のReviewでは、その資料記載を超える外部API応答やCryptact計算動作を確認済みとは扱っていない。

## Review Result

**READY**

## Summary

要件書は、履歴ビューア・整理・出力支援という目的と、税務判断・税額計算・ウォレット操作を担わない境界を維持している。TransactionsとReceiptsの分離、月→日→個別明細、JST集計、初期のHarvest関連Receiptのみの日次圧縮、元Receiptと価格評価根拠への追跡が要件・受け入れ条件に反映されている。

主要な制約にRequirement IDがあり、受け入れ条件およびコンセプト節・OPEN項目へのTraceabilityを持つ。OPEN-001〜010は自動解決されず、各項目に論点、判断理由、最低限の制約、判断段階、影響要件が記載されている。詳細な価格選択、Cryptact形式、MongoDB構造、性能数値等は後続へ留保され、要件段階で実装方式を固定していない。

Criticalに該当する欠落・矛盾は確認しなかった。現時点で残る価格・Cryptact・MongoDB・性能・Privacy上の不確実性は、要件に反する決定事項ではなく、明示された後続判断として扱えるため、Specification / Designへ進める。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| なし | — | — | 初回レビュー | Gate不合格に該当するCritical、または正式なMajor / Minor findingは発行しなかった。 |

## Required Changes

なし。

## Optional Improvements

なし。

## Resolved Findings

なし。初回のRequirements Reviewであり、追跡対象となる過去のRequirements findingはない。

## Upstream Feedback

なし。コンセプトレビューはREADYで、要件定義を安全に評価・完了することを妨げる未解決Criticalや上流矛盾は確認されなかった。

## Deferred Findings

以下は要件書の欠陥として差し戻す事項ではなく、同書のOPEN項目および引継ぎに沿って後続工程で確認・決定する事項である。

| 論点 | 状態・後続で確認する内容 | 関連Requirement ID / OPEN |
|---|---|---|
| Harvest集約の税務上・計算上の同等性 | 総平均法・移動平均法、同日中の売却等との境界を確認する。税務上の正解をSymTaxが決定しない。 | EXPORT-004〜006 / OPEN-001 |
| 価格時刻と欠損 | Statementを含むblock timestampから1分足への対応、OHLC選択、出来高0・欠損時の扱いを確定する。 | PRICE-002〜005 / OPEN-002、OPEN-003、OPEN-004 |
| Cryptactとの相互運用 | 最新の受入形式、Harvestの表現、集約行の受入と計算上の差異を確認する。 | EXPORT-001〜007、EXT-002 / OPEN-005 |
| Transaction / Receipt関連付け | 関連表示を行う場合も、独立カテゴリを維持する範囲で関連付けの必要性を決める。 | FUNC-002、FUNC-009 / OPEN-006 |
| MongoDB参照成立性 | 実ノードでの履歴範囲、データ網羅性、バージョン依存を確認する。 | CON-001〜003、FUNC-001〜004、EXT-003 / OPEN-007 |
| 数値性能基準 | 代表データ、実行条件、応答・メモリ等の合否目標を合意する。数値根拠がない段階では設計詳細に留保する。 | PERF-001〜004 / OPEN-008 |
| ネットワーク運用・Privacy | Testnet/Mainnetの誤接続防止と、アドレス・履歴・ログ等の保持・説明責任を具体化する。 | CON-004、SEC-003、DATA-003、PRIV-001 / OPEN-009、OPEN-010 |

## Scope and Traceability

- **対象境界:** 初期対象はSymbol（XYM）の履歴参照であり、NEM、複数アドレス、他価格Provider、税務計算、署名・送信は初期スコープ外としている。
- **カテゴリ境界:** TransactionsとReceiptsを別の参照・集計対象とし、Transaction / Receipt関連付けは独立性を保つ条件付きの将来判断としている。
- **出力境界:** 個別明細とHarvest Receipt日次集約を区別し、TransactionおよびHarvest以外のReceiptの日次圧縮を除外している。
- **上流追跡:** 要件IDから受け入れ条件・concept節・該当OPENへのTraceability表がある。概念にない大きな機能追加は見当たらない。
- **前段レビュー:** `concept-review-001.md` はREADY、Required Changesなし。レビューの未確認事項は要件書のOPENまたは本レビューのDeferred Findingsに保持されている。
- **下流境界:** MongoDB query / collection / schema、API path、CSV列、価格選択・補間、集約アルゴリズム、UI構成を要件として固定していない。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| 目的・利用者・価値 | 合格 | 大量履歴の参照負荷とHarvest Receiptの出力件数課題を、指定期間参照、カテゴリ別確認、件数圧縮へ追跡できる。 |
| 要件の明確性・優先度 | 合格 | 要件IDとMUST / SHOULD / MAYの意味が定義され、要求本文は主にMUSTとして読める。 |
| 受け入れ条件 | 合格 | 主要な履歴閲覧、階層、分離、出力、価格根拠、ネットワーク分離、秘密情報非要求を利用者または外部観測者から確認可能にしている。数値性能目標はOPEN-008として識別されている。 |
| 完全性・データ追跡 | 合格 | 原履歴と派生情報を区別し、個別Harvest Receipt・価格根拠へ戻れること、不完全取得・価格欠損を成功結果と誤認させないことを定めている。 |
| 相互運用性 | 合格 | Cryptact形式の受入と計算上の同等性を区別し、未確認のHarvest分類・集約可否をOPEN-005へ引き継いでいる。 |
| Security — protected assets / confidentiality | 適用範囲を確認 | Walletではなく、秘密鍵・ニーモニック・署名権限を扱わない非目標が明示されている。公開アドレスと活動履歴の関連をPrivacy対象として認識している。 |
| Security — integrity / failure safety | 合格 | 元履歴・価格評価根拠の追跡と、取得・価格の不完全性を黙って隠さない性質がある。具体的な価格復旧方式はOPENとして分離されている。 |
| Security — authentication / authorization / lifecycle | 対象外 | SymTaxは鍵・秘密情報や署名能力を持たず、それらの生成・復元・利用主体は製品範囲にない。一般的な認証要求を追加していない。 |
| Security — responsibility / trust boundary | 合格 | MongoDBをサーバー側のみ・原則read-onlyとし、DB接続情報のブラウザ公開を禁じ、SymTax独自データとSymbolノードDBを分離している。 |
| Security — chain / network separation | 合格 | Testnet開発・検証、Mainnet公開、データ・接続先を混在させない要件と受け入れ条件がある。 |
| Security — input / resource / recovery | 未確認・対象範囲外 | 認証済みユーザーや永続アカウント状態を扱う前提がなく、具体的な攻撃面・復旧責任は要求資料に定義されていない。追加脅威モデルは本レビューで発明しない。 |

## Validation Results

- 要件定義書、コンセプト、Concept Reviewの判定・指摘状態を読み合わせた。
- OPEN-001〜010が要件書で全件保持されていること、TraceabilityにRequirement・Acceptance Criteria・OPENの参照先があることを確認した。
- レビュー中に要件書、コンセプト、コード、テストは変更していない。
- コード・API・MongoDB実データ・Cryptactへの実取込・価格APIの指定日応答は検証していない。これらはレビュー範囲外または明示された未確認事項である。

## Review Gates

| Gate | 判定 | 根拠 |
|---|---|---|
| 1. 目的と課題 | 合格 | 概要・背景から指定期間参照と高頻度Harvestの件数削減へつながる。 |
| 2. 利用者と責任 | 合格 | 利用者、SymTax、ノード運用者、bitbank、Cryptactの責任を区別し、税務判断を利用者側へ残す。 |
| 3. 対象範囲 | 合格 | Symbol/Mainnet・Testnet、初期対象外、Harvestだけの日次圧縮を区別する。 |
| 4. 要件と制約 | 合格 | 機能、性能、Security、Privacy、外部依存、前提、未決定事項を識別できる。 |
| 5. 受け入れ条件 | 合格 | 主要要求には外部から確認可能な条件が対応する。未確定の数値性能境界はOPEN-008として明示している。 |
| 6. 内部整合性 | 合格 | Transactions / Receipts、JST集計、Harvest限定圧縮、元履歴保持、税務責任の境界にブロックする矛盾は見当たらない。 |
| 7. 不可欠な前提 | 合格（後続確認あり） | bitbank仕様・Cryptactカスタムファイル案内を根拠区分付きで記録し、実ノード成立性やHarvest計算互換性はOPENとして明示する。 |
| 8. コンセプト整合性 | 合格 | 前段Concept ReviewはREADY。要件書は確定事項を保ち、コンセプトのOPENを推測で解消していない。 |

## Remaining Risks and Open Decisions

OPEN-001〜010は要件書に記載された通り継続する。特に税務計算とHarvest集約、block timestampと価格足の対応、Cryptact上の表現・計算差、MongoDB履歴の網羅性、定量性能目標、Privacy保持方針は、後続で判断・検証を終える必要がある。これらは現在のRequirements Gateを妨げる矛盾ではないが、関連するSpecificationやDesignを確定する前に解消または明示的な制約化が必要である。

## Automatic Changes

なし。レビュー対象の要件定義書、コンセプトおよびコードは変更していない。

## Final Decision

**READY** — Specification / Designへ進める。
