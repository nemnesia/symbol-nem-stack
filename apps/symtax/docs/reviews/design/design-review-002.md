# SymTax Design Review 002

## Review Target

- **対象:** [基本設計書](../../design.md)
- **確認対象リビジョン:** `2d57298` (`feature/symtax`)
- **確認日:** 2026-09-25
- **成果物:** `apps/symtax/docs/reviews/design/design-review-002.md`
- **レビュー範囲:** Architecture / Trust Boundary、Symbol Node MongoDBとSymTax Data Storeのinstance分離、DD-004、データ所有、運用・lifecycle、Requirements / SpecificationへのTraceability
- **未確認範囲:** 実デプロイ、実MongoDB process / credentials / volumes、node運用およびbackup / restore手順の実地確認。具体的なport、container、hostは要件対象外。

## Execution Audit

- **Reviewer A — 構造と責務:** コンテキスト図、instanceの配置、Browser / Server / Node / Store間の依存と境界を確認した。
- **Reviewer B — Security:** Node read-only credential、独立Store書込み権限、接続情報・storage分離、誤書込み防止、Mainnet/Testnet境界を確認した。
- **Reviewer C — フローと運用:** Store障害・再起動・migration・backup/restoreとNode resync / rebuild / upgradeの相互影響、resource / lifecycle分離を確認した。
- **Reviewer D — 追跡と下流実装可能性:** `CON-003` / `SEC-004`から`DD-004`と`SPEC-STORE-001` / `CT-085`へのhandoffを確認した。
- **Chair:** 4観点を別パスで確認し、Gateと判定を適用した。サブエージェントは使用していない。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/design.md` | 主対象。図、trust boundary、data ownership、運用、DD-004、Traceabilityを確認 |
| `apps/symtax/docs/requirements.md` | 承認済み要件・ACとOPEN状態を確認 |
| `apps/symtax/docs/specification.md` | 明示的な下流補助確認として`SPEC-STORE-001`、`CT-085`、Traceabilityとの互換性を確認 |
| `apps/symtax/docs/concept.md` | 元のread-only・独自Store分離、Testnet/Mainnet方針を確認 |
| `apps/symtax/docs/reviews/design/design-review-001.md` | 前回READY判定および正式finding状態を確認 |
| Requirements / Concept / Specificationの既存Review | 公開判定と前段Criticalの解消状態を確認 |
| `.agents/skills/design-review/*`, `.agents/skills/review-common/*`, `AGENTS.md` | Review Board、Gate、Security Review、成果物形式を適用 |

## Review Result

**READY**

## Summary

Architecture図、Trust Boundary、data ownership、運用前提およびDD-004は、Symbol Node MongoDBとSymTax Data Storeを別mongod process / MongoDB instanceとして明記している。同一hostへの配置は許容しつつ、同一process内でdatabase名だけを分ける構成を排除し、connection string、credential / user、storage、lifecycle、主要resource設定を分離している。Nodeアクセスのread-only性、Store障害とNode再構築の独立性、Node DBへの誤書込み防止も責務に含む。

今回の変更についてRequirementsとの矛盾やSpecificationへのhandoff欠落は確認しなかった。新しいCritical / Major / Minor findingおよびUpstream Feedbackはない。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| なし | — | — | Review 002 | Gate不合格となる欠陥、または正式な任意改善findingは確認しなかった。 |

## Required Changes

なし。Critical findingはない。

## Optional Improvements

なし。

## Resolved Findings

なし。前回Design Reviewに正式findingはなく、READY判定を維持する。

## Upstream Feedback

なし。`CON-003`および`SEC-004`は同一host共置条件とNode read-only境界を含み、Design側で新しいRequirementを追加せずに責務へ反映されている。

## Deferred Findings

- 実運用環境でのprocess / credential / storage / resource構成の確認とbackup・restore・node resync手順は、運用適合試験としてSpecification `CT-085`および実環境qualificationへ引き継ぐ。
- 性能・resourceの具体数値は根拠なく固定せず、既存OPEN-008の代表負荷計測へ残す。

## Scope and Traceability

- Context図ではNodeとSymTax Storeを独立MongoDB instance / processとして別ノードに描き、Browserからの直接接続を示していない。
- `TB-2` / `TB-3`はread-only Node accessと別instance、別接続・credential、storage、lifecycle、resource境界を定める。
- §5.2 / §5.3と§8.1はNode sourceとSymTax価格データのowner、永続化、再生成、障害・再構築境界を区別する。
- `DD-004`は共有mongod案を比較し、同一process内の別databaseのみの構成を棄却する。別hostやDocker方式を追加要求しない。
- `CON-003` / `SEC-004`はSpecification `SPEC-STORE-001`、適合条件`CT-085`へ追跡される。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| System context / trust boundary | 合格 | Node MongoDB、SymTax Data Store、Server、Browserを分離している。 |
| Dependency / ownership | 合格 | Symbol History AdapterのみがNodeをread-only参照し、SymTax StoreをSymTaxが所有する。 |
| Instance / credential boundary | 合格 | 別mongod process、接続文字列、user / credential、storageを要求。Store write資格情報をNode access pathへ流さない。 |
| Lifecycle / failure / recovery | 合格 | Store操作とNode resync / rebuild / upgradeの影響を分け、元の価格観測をNode lifecycleから独立させる。 |
| Resource / operational boundaries | 合格 | WiredTiger cache等を含む主要resource設定を独立させ、数値は計測後へ残す。 |
| Mainnet / Testnet / Symbol boundary | 合格 | runtime network bindingとchain-derived dataの分離を維持し、市場価格データのnetwork非依存性と区別。 |
| Downstream handoff | 合格 | MongoDBの詳細構造やversionを固定せず、instance separationをSpecification上で検証可能にしている。 |
| Security scope | 適用範囲を確認 | Wallet secretやsigning authorityは対象外。Node credential、Browser境界、誤書込み防止を対象のsecurity responsibilityとして確認。 |

## Validation Results

- Requirements、Concept、Design、Specificationおよび前回公開判定を照合した。
- `DD-004`とRequirements `CON-003` / `SEC-004`、Specification `SPEC-STORE-001` / `CT-085`の整合を確認した。
- `git diff --check`相当のMarkdown差分検証をレビュー成果物作成後に実施する。実MongoDB、配置、network、アプリケーション試験は実施していない。
- 開始時に存在したImplementation関連の未コミット変更は維持し、今回のレビュー成果物以外は変更していない。

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. 目的と範囲 | 合格 | DB分離の追加が既存SymTax目的・初期scopeを変えない。 | — |
| 2. コンテキストと責任 | 合格 | Node、SymTax Store、Serverのownershipとtrust boundaryが明確。 | CON-003、SEC-004 |
| 3. 依存方向 | 合格 | Nodeへの読取はSymbol Adapterに閉じ、SymTax Storeの書込み境界を分ける。 | SEC-002、SEC-004 |
| 4. 主要フロー | 合格 | Storeの保守、失敗、再起動とNode再構築の独立性を記述。 | SEC-004 |
| 5. データ所有 | 合格 | Node raw dataとSymTax price dataのsource of truth / lifecycleを区別。 | CON-003、PRICE-003 |
| 6. Securityと相互運用性 | 合格 | Node read-only、誤書込み防止、network境界を保つ。 | SEC-002〜004 |
| 7. 上流整合性 | 合格 | 要件とSpecificationのinstance分離契約に一致。 | CON-003、SEC-004 |
| 8. 下流実装可能性 | 合格 | 同一mongod別databaseは禁止、same-host別process許可をSpec / CTへ引継ぎ。 | SPEC-STORE-001、CT-085 |

## Remaining Risks and Open Decisions

実デプロイで運用分離を立証する作業は残るが、設計契約は明確であり新たなOPENは生じていない。Nodeの実schema / coverage、性能threshold等の既存OPEN-007 / OPEN-008は引き続き該当する。

## Automatic Changes

レビュー成果物 `apps/symtax/docs/reviews/design/design-review-002.md` のみ新規作成した。Requirements、Design、Specification、Concept、Implementationは変更していない。

## Final Decision

**READY** — Requirementのinstance分離制約を責務・境界・運用へ反映し、Specificationへ検証可能な契約として引き渡している。
