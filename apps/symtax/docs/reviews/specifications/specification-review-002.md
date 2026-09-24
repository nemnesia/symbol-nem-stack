# SymTax Specification Review 002

## Review Target

- **対象:** [SymTax 外部仕様書](../../specification.md)
- **確認対象リビジョン:** `1c7107f` (`feature/symtax`)
- **確認日:** 2026-09-25
- **成果物:** `apps/symtax/docs/reviews/specifications/specification-review-002.md`
- **レビュー範囲:** Specification Review 001指摘の解消状態、承認済みRequirements / Designとの整合、外部契約の明確性、timestamp anchor追記、Conformance / Traceability、Privacy・Network境界
- **未確認範囲:** 実Symbol Mainnet / Testnet nodeのsource profile・履歴coverage、Cryptactへの実取込と損益結果、bitbankの長期retentionおよび将来の過去足訂正、公開環境の性能測定

## Execution Audit

- **Reviewer A — 契約の明確性・完全性:** 入力、normalized model、timestamp、価格選択、集約、CSV、error、境界条件、未決定事項およびConformance Caseを確認した。
- **Reviewer B — 利用価値・運用適合性:** 44 Requirements ID、Acceptance Criteria、Concept / Designの責務、過去Reviewから初期スコープと公開gateへの追跡を確認した。
- **Reviewer C — Security / Interoperability:** 適用範囲に限定して、秘密情報非要求、署名・送信の禁止、Network fail-closed、MongoDB read-only境界、Privacy、出力完全性を確認した。
- **Chair:** 3観点を独立した確認パスとして実施し、重複を統合してSeverityとReview Gateを判定した。サブエージェントは使用していない。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/specification.md` | 主対象。Specification ID、OPEN状態、Conformance Case、Traceability、外部確認記録を確認 |
| `apps/symtax/docs/requirements.md` | 44 Requirement ID、Acceptance Criteria、初期scope、外部依存と未決事項を確認 |
| `apps/symtax/docs/design.md` | Symbol adapter、Price / Export境界、Network、Privacy、性能責務およびSpecification引継ぎを確認 |
| `apps/symtax/docs/concept.md` | Harvestのみの日次圧縮、JST、税務非責務などの上位方針を確認 |
| Concept / Requirements / Design Review 001 | 前段のREADY判定と引継ぎ境界を確認 |
| `apps/symtax/docs/reviews/specifications/specification-review-001.md` | SR-001〜007と各Required Changeの完了条件を照合 |
| `.agents/skills/spec-review/*`, `.agents/skills/review-common/*`, `AGENTS.md` | Review Board手順、Severity、Gate、出力形式、根拠区分を適用 |
| [bitbank Public API candle / transactions docs](https://github.com/bitbankinc/bitbank-api-docs/blob/master/public-api.md), [official pair list](https://github.com/bitbankinc/bitbank-api-docs/blob/master/pairs.md) | 仕様書に記録された公式資料の範囲を再確認。資料はOHLCV timestamp形式等を定義するがminute anchor自体は規定しない |
| Specification §16.3の2026-09-23実API照合記録 | 直近改訂で記録されたminute-start結論、比較数、coverage根拠を確認。今回新しいAPI比較は実行していない |

## Review Result

**READY**

## Summary

Specification Review 001のSR-001〜007は、現行Specification上で対応済みとして追跡できる。特にSR-003は、公式資料がanchorを定義しているとは主張せず、実API比較の範囲・件数・反対仮説との比較・exact-boundary未観測を区別して記録している。44件のRequirement IDと84件のConformance Caseがあり、Transactions / Receipts、JST calendar / price instant、個別履歴 / 派生集約の境界も維持されている。

Traceability表には、本文で定義されていない`SPEC-GEN-001`〜`SPEC-GEN-003`への参照がある。対応する責務の意味は他の節にも記述されているためGate不合格とはしないが、ID参照が解決不能なままでは後続仕様・実装Reviewの追跡を誤らせる。SR-008 Minorとして任意改善に記録する。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| SR-001 | Critical | Resolved | Specification Review 001 | typeごとのnormalized semantics、source meaning、completeness、unknown / unsupportedを§5とCT-047〜056に定義。実node profileのqualificationはDeferred |
| SR-002 | Critical | Resolved | Specification Review 001 | expected / observed NetworkType、generationHashSeed、epochAdjustmentとfail-closed結果をSPEC-NET-002、CT-041〜046に定義 |
| SR-003 | Critical | Resolved | Specification Review 001 | minute-start mapping、OHLC平均、zero-volume / missing-candle規則をSPEC-PRICE-005/006およびCT-057〜064に定義。実API検証記録とCT-084を追加 |
| SR-004 | Critical | Resolved | Specification Review 001 | opt-in、構造上のeligibility、unknown/ineligible、JST splitと個別fallbackをSPEC-AGG-001〜005、CT-065〜072に定義 |
| SR-005 | Critical | Resolved | Specification Review 001 | Harvest→`STAKING`をSymTax製品判断と明記し、individual / daily mapping、非対応type、format failureをSPEC-EXPORT-001〜007、CT-073〜076に定義。実Cryptact acceptanceはDeferred |
| SR-006 | Major | Resolved | Specification Review 001 | 今日・当月のcalendar endとfuture-only区間の扱いをSPEC-IN-005、CT-077〜080に定義 |
| SR-007 | Major | Resolved | Specification Review 001 | bounded / incremental export、resource limit時のrejected・no-file契約、release gateをSPEC-RES-001/002、CT-081〜083に定義 |
| SR-008 | Minor | New | Specification Review 002 | Traceability表が定義されていない`SPEC-GEN-001`〜`003`を参照。関連する制約の意味は本文に分散して記載されている |

## Required Changes

なし。Critical findingはない。

## Optional Improvements

### SR-008 — Traceability内の未定義Specification ID

- **Severity:** Minor
- **対象箇所:** `specification.md` §15 Traceability、CON-007（現行L693）、PERF-003（L720）、SEC-001（L723）
- **確認事実:** Traceability表はそれぞれ`SPEC-GEN-001`、`SPEC-GEN-002`、`SPEC-GEN-003`を参照するが、Specification本文に同名の契約定義がない。本文では関連する責務が別途、§1.1、SPEC-NET-004、SPEC-RES-001、SPEC-PRIV-001等に記載されている。
- **根拠:** Specification §2.2は共通結果contractVersionを定め、Requirements §15 TraceabilityおよびSpecification §15はIDによる後続追跡を目的としている。
- **影響:** 読者や下流Reviewが3つの参照先を辿れず、要件に対応する外部契約の所在を誤認する可能性がある。関連する禁止・責務の実体は他節に記載されているため、現状で別実装の動作が分岐する重大な欠落とは判定しない。
- **必要な最小改善:** 参照先を実在するSpecification IDへ置き換えるか、対応する既存契約に一意なIDを付与してTraceabilityを更新する。変更後、Specification ID参照の存在を再確認する。
- **完了条件:** Traceability表に存在しないSpecification ID参照が残らず、CON-007、PERF-003、SEC-001の各行から実際の規範記述へ到達できる。

## Resolved Findings

Specification Review 001のSR-001〜SR-007は本書の現行記述で解消を確認した。SR-001に関する実Node profile、SR-005に関するCryptact実取込、SR-007に関する定量性能thresholdは、仕様欠落ではなく公開前の別途確認gateとして引き継がれている。

## Upstream Feedback

なし。今回の確認範囲でRequirementsまたはDesignの正式な不足・矛盾に起因するSpecification blockerは確認しなかった。

## Deferred Findings

- OPEN-007: 実Mainnet / Testnet nodeのversion、MongoDB source profile、履歴coverage、Statement→Block参照は実環境でqualificationする。
- OPEN-005: Cryptactへの実ファイル取込・日次行受入・経済的挙動の検証は、サービス利用環境で別途確認する。`STAKING`はSymTaxのmapping判断であり、Cryptact公式のSymbol分類ではない。
- OPEN-008: 代表負荷で測定し、公開前に有限のperiod / record / file / time budgetと受入thresholdを承認する。
- OPEN-004 / OPEN-010: price correction candidateの採否・再評価手順、log保持期間と運用アクセス方針は記載済み制約を保って運用判断へ引き継ぐ。
- bitbank timestamp anchorは指定日のAPI照合結果として記録されている。公式資料による保証や将来のProvider動作保証とは区別する。

## Scope and Traceability

- 対象は`apps/symtax/docs/specification.md`。Concept、Requirements、Design、実装、テストは変更していない。
- SpecificationのRequirement Traceabilityは44件の正式Requirement IDすべてに行があることを確認した。
- Conformance CaseはCT-001〜CT-084の84件でID重複がない。
- OPEN-002およびSR-003の解消記録はSPEC-PRICE-001/005〜007とCT-057〜064、CT-084に結び付く。
- SR-008はTraceability参照の欠落であり、既存の責務本文を新しい仕様として解釈・補完するものではない。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| Requirement coverage | 合格 | 44/44 Requirement IDがTraceabilityに存在する。 |
| Input / period / pagination | 合格 | Address / network / JST期間、today boundary、keyset continuation、incomplete coverageの外部結果を定義している。 |
| Normalized Transaction / Receipt | 合格 | type別semantic mapping、Harvest分類、unknown / unsupported / partialを分け、Mongo BSONを上位へ漏らさない。 |
| Timestamp / price | 合格 | Receipt時刻をBlockから導き、JST bucketと実timestamp lookupを分離。minute-start規則と実測根拠を明示する。 |
| Quantity / aggregation / export | 合格 | exact arithmetic、Harvest-only集約、元Receipt参照、個別評価合計に基づくdaily value、no-partial exportを定義する。 |
| Network / Security / Privacy | 合格 | pinned identity evidence、mismatch時fail-closed、秘密鍵等を扱わない境界、server-only read-only Mongo、user-history非永続化を記載する。 |
| Interoperability / external services | 合格（Deferredあり） | bitbank資料と実応答を区別し、CryptactのSymTax mappingと公式分類を区別する。実取込とnode qualificationは別gate。 |
| IDs / traceability | 部分合格 | Requirement IDとCTは網羅されているが、Traceabilityに未定義`SPEC-GEN-001`〜`003`が残る（SR-008）。 |

## Validation Results

- `git status --short --branch`で対象Revisionと開始時の作業ツリーを確認した。
- Specification ID参照の定義有無を静的に照合し、`SPEC-GEN-001`〜`003`の未定義参照を確認した。`SPEC-ERR-002/003`は本文中に定義されている。
- relative Markdown linkを確認し、壊れたlocal linkは0件。
- Requirements正式IDとTraceability行を照合し、44/44一致、欠落・余分な行は0件。
- Conformance IDを照合し、CT-001〜CT-084の84件が一意であることを確認した。
- 公式bitbank文書を再確認した。Public API資料はCandlestickのOHLCV timestampがUnix millisecondsであること、Transactionsの日付省略時にlatest 60であること、pair一覧に`xym_jpy`があることを示す一方、minute timestamp anchor自体は規定していない。
- Reviewは文書差分の評価であり、アプリケーションの実装test/build、実Symbol Node、Cryptact account upload、今回のbitbank live response再取得は実行していない。
- Review成果物以外は変更していない。

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. 目的と範囲 | 合格 | Symbol履歴参照、Harvest限定日次圧縮、税務判断非責務を維持。 | — |
| 2. 契約 | 合格 | 入力、normalized data、price、aggregation、export、error stateが規定されている。 | — |
| 3. 処理と例外 | 合格 | pagination、欠損、network mismatch、unavailable price、集約不可、atomic export failureを区別。 | — |
| 4. 内部整合性 | 合格（改善事項あり） | Review 001指摘との矛盾なし。3つの未定義Specification ID参照はMinorで記録。 | SR-008 |
| 5. 検証可能性 | 合格 | 84件のConformance Case、anchor比較記録、44要件Traceabilityを確認。 | — |
| 6. 安全性と相互運用性 | 合格 | secrets/signingを除外し、Network fail-closed、Mongo read-only、PrivacyとExport完全性を確認。 | — |
| 7. 上流整合性 | 合格 | Requirements / Design / Conceptと前段READY判定に反する仕様は確認しなかった。 | — |

## Remaining Risks and Open Decisions

- SR-008のID参照整合性は改善推奨として残るが、意味上の契約は本文の他節で確認できるためReview Gateを不合格にしない。
- 実Nodeのcoverage、Cryptact実取込と計算結果、数値性能thresholdはSpecificationが明示した公開前または運用上のgateであり、本Reviewでは完了を確認していない。
- bitbankの実API検証は2026-09-23の対象日における事実であり、公式docsの規定や将来の過去データ保持保証ではない。

## Automatic Changes

レビュー成果物`apps/symtax/docs/reviews/specifications/specification-review-002.md`を新規作成した。Review対象、上流資料、実装、テストは変更していない。

## Final Decision

**READY** — SR-008はMinorのTraceability改善であり、Critical findingはない。正式なSpec Reviewを完了し、下流工程へ進める品質である。
