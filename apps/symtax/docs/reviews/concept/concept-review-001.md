# SymTax Concept Review 001

## Review Target

- **対象:** [SymTax コンセプトシート](../../concept.md)
- **確認対象リビジョン:** `b6a2cd4` (`feature/symtax`)
- **確認日:** 2026-09-24
- **成果物:** `apps/symtax/docs/reviews/concept/concept-review-001.md`
- **レビュー範囲:** コンセプトの課題・価値、対象ユーザー、初期スコープ、責任境界、成立性、確定事項との整合
- **未確認範囲:** MongoDBの実データ・スキーマ、bitbank APIの独立した再取得、Cryptactの現行取込仕様と計算結果。これらはコンセプトレビューの対象外または後続確認事項とした。

## Execution Audit

独立したサブエージェントは使用せず、以下の3観点を別パスで自己レビューした。

- **Reviewer A — 品質と論理:** 用語、内部整合性、目的から価値・初期範囲への論理、初期と将来の区別を確認。
- **Reviewer B — 課題と価値:** 想定利用者、履歴参照・件数削減の課題、ユースケース、提供価値、成功条件の対応を確認。
- **Reviewer C — 境界と成立性:** 税務・ウォレットの責任境界、Testnet/Mainnet、MongoDB・価格データの前提、未決事項が後続へ適切に委譲されているかを確認。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/concept.md` | 主対象。章間の整合性、スコープ、根拠、未決事項を確認 |
| ユーザーが会話で提示したSymTax要件および追加確定事項 | 目的、Harvest日次圧縮の初期対象、JST、bitbank取得確認、Testnet/Mainnet方針との追跡 |
| `AGENTS.md` | 根拠区分、Mainnet/Testnetの明示、未確認事項の扱いを確認 |
| Concept Reviewスキルと共通Review Playbook | レビュー範囲、判定ゲート、成果物形式を適用 |

今回、外部サイトやAPIを再取得しておらず、ユーザー提供のbitbank取得確認を独立に再検証していない。レビュー判定はこの未確認範囲を前提に行った。

## Review Result

**READY**

## Summary

コンセプトは、Symbol履歴ビューアとデータ出力支援という目的を明確にし、税額計算・税務判断・署名を責務外としている。TransactionsとReceiptsの分離、各カテゴリの月・日・個別明細の閲覧、初期のCryptact日次圧縮対象をHarvest関連Receiptに限定する境界も読み取れる。

指定期間を中心とするMongoDB参照、Testnet開発・検証とMainnet公開、JST集計、bitbank価格の保存・再利用、個別履歴と価格評価根拠の保持が、成功条件と未決事項に反映されている。価格選択、税務計算上の同等性、Cryptact整合、DBスキーマ依存など、要件定義・設計で判断すべき事項も実装詳細を先取りせずに残されている。

Critical、Major、Minorの正式指摘はない。要件定義へ進める品質ゲートを満たす。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| なし | — | — | — | 初回レビューであり、正式指摘は発行しなかった。 |

## Required Changes

なし。

## Optional Improvements

なし。

## Resolved Findings

なし。過去のSymTax向けConcept Review成果物は確認されず、本レビューで追跡する過去指摘はない。

## Upstream Feedback

なし。今回提示された確定事項の間に、コンセプトの安全な評価・完了を妨げる不足や矛盾は確認されなかった。

## Deferred Findings

以下はコンセプトの欠陥ではなく、対象文書の `OPEN-001`〜`OPEN-010` に記録された要件定義・設計・外部確認事項として維持する。

- Harvest日次圧縮と総平均法・移動平均法、同日中の他取引との扱い
- Statementを含むblock timestampとbitbank 1分足の対応、OHLC選択
- 出来高0・価格欠損時の扱い、保存価格の更新やProvider停止時の扱い
- Cryptactの取込形式とHarvest Receiptの表現・計算整合
- TransactionsとReceiptsの関連表示、Symbol MongoDBのスキーマ・履歴範囲
- 性能目標、Testnet/Mainnetの接続境界、プライバシーと運用責任

## Scope and Traceability

- 対象はSymbol（XYM）のTransactionsとReceiptsを参照・整理するSymTaxに限定されている。
- 初期のCryptact日次圧縮はHarvest関連Receiptのみであり、TransactionsおよびHarvest以外のReceiptの圧縮を初期範囲に含めていない。
- 履歴参照、月次・日次サマリー、Cryptact向け出力は元の個別オンチェーン履歴から派生し、元履歴とHarvest個別価格評価の追跡可能性を維持する。
- 税務判断、損益計算の最終責任、ウォレット・署名機能はSymTaxの責任外としている。
- ユーザー提示の要件に対する明白な欠落や相反は確認されなかった。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| 課題と提供価値 | 合格 | 大量・長期間の履歴負荷と高頻度Harvest Receiptの件数問題が、軽量参照とHarvest日次圧縮の価値に結び付いている。 |
| 対象ユーザーと利用場面 | 合格 | Symbol履歴確認者、Cryptact利用者、大量履歴保有者と、独立参照・確認・出力の利用場面が示されている。 |
| 初期スコープと対象外 | 合格 | 初期の履歴範囲、Harvestのみの日次圧縮、NEM等の将来範囲、税務判断・署名等の対象外が区別されている。 |
| 責任境界 | 合格 | SymTaxは履歴確認・整理・出力を担い、税務判断、秘密鍵、署名、ノード管理を担わない。 |
| 成功条件 | 合格 | 性能、カテゴリ別閲覧、元履歴への追跡、件数削減、価格再現性、ネットワーク境界を観測可能な成果として記述している。数値目標は後続へ委譲されている。 |
| 成立性と前提 | 合格 | MongoDB接続可能性、価格データの欠損・保持、Cryptact整合、税務計算との差異など、主要な不確実性が未決事項として明示されている。 |

## Validation Results

- コンセプト本文と今回のユーザー提示事項を読み合わせた。
- 既存章の内部整合性と、初期スコープ・対象外・将来拡張・未決事項の分離を確認した。
- 実装、API、DB query、Cryptact CSV、価格選択アルゴリズムの検証は実施していない。これらは本レビューの範囲外または後続工程で扱う。
- レビュー対象の概念本文は変更していない。

## Review Gates

| Gate | 判定 | 根拠 |
|---|---|---|
| 明確さ | 合格 | プロダクトの目的と提供内容がプロジェクト概要・コアコンセプトに記載されている。 |
| 課題 | 合格 | 大量履歴、高頻度Receipt、確認・登録件数の問題が説明されている。 |
| 対象ユーザーと価値 | 合格 | 利用者、利用場面、履歴参照・出力の価値を説明できる。 |
| v1の境界 | 合格 | Harvest日次圧縮のみを初期対象とし、他カテゴリやNEM等を区別している。 |
| 責任境界 | 合格 | 税務判断、ウォレット、署名、DB接続の境界が明記されている。 |
| 内部整合性 | 合格 | Transaction/Receipt分離、JST集約、価格評価時刻、Harvestのみの圧縮が本文内で整合する。 |
| 成立性 | 合格 | MongoDB・価格データ・Cryptact・税務方式の未確定事項は残るが、コンセプト自体を成立不能にする矛盾は確認されない。 |

## Remaining Risks and Open Decisions

未決事項は `concept.md` のOPEN-001〜OPEN-010に記録されている。特にHarvest日次圧縮と平均法の整合、block timestampと1分足の対応、Cryptact上での表現、MongoDBデータの網羅性、性能目標は後続工程で具体化が必要である。これらは現在のコンセプト段階で安全に保留できる。

## Automatic Changes

なし。レビュー対象のコンセプトシートは変更していない。

## Final Decision

**READY** — 要件定義へ進める。
