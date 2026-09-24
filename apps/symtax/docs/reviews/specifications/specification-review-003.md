# SymTax Specification Review 003

## Review Target

- **対象:** [外部仕様書](../../specification.md)
- **確認対象リビジョン:** `2d57298` (`feature/symtax`)
- **確認日:** 2026-09-25
- **成果物:** `apps/symtax/docs/reviews/specifications/specification-review-003.md`
- **レビュー範囲:** 上流Requirement / Designとの整合、MongoDB instance分離契約、`SPEC-STORE-001`、`CT-085`、全体の外部契約・既存指摘状態
- **未確認範囲:** 実MongoDB配置および障害試験、実Symbol node / bitbank / Cryptact接続。これらは本書の既存OPEN / release gateに従う。

## Execution Audit

- **Reviewer A — 契約の明確性と完全性:** `SPEC-STORE-001`の必須・許容・禁止条件、運用確認条件、CTの期待結果を確認した。
- **Reviewer B — 利用価値と運用適合性:** Requirements / Designとのtraceability、same-host運用の許容、Node read-only / independent lifecycleを確認した。
- **Reviewer C — Security / Interoperability:** Node credentialのread-only、Store write credentialの分離、Browser非接続、fail-closed network境界、データ保持条件を確認した。
- **Chair:** 3観点を別パスで確認し、過去Findingの状態、Gateおよび判定を統合した。サブエージェントは使用していない。

## Evidence Used

| 資料 | 用途 |
|---|---|
| `apps/symtax/docs/specification.md` | 主対象。規範ID、instance separation、CT、OPEN、Traceabilityを確認 |
| `apps/symtax/docs/requirements.md` | `CON-003`、`SEC-004`、`AC-012`との契約整合を確認 |
| `apps/symtax/docs/design.md` | TB-2 / TB-3、DD-004、運用責務との一致を確認 |
| `apps/symtax/docs/concept.md` | Node read-only、独自データ分離、network boundaryの上位方針を確認 |
| `apps/symtax/docs/reviews/specifications/specification-review-001.md` | SR-001〜007の解決状態を確認 |
| `apps/symtax/docs/reviews/specifications/specification-review-002.md` | SR-008 Minorの既存状態を追跡 |
| Concept / Requirements / Design Reviews 001 | 前段READY判定とhandoffを確認 |
| `.agents/skills/spec-review/*`, `.agents/skills/review-common/*`, `AGENTS.md` | Review Board、Security / Interoperability、Gate、成果物形式を適用 |

## Review Result

**READY**

## Summary

新規`SPEC-STORE-001`は、Symbol Node MongoDBとSymTax Data Storeを別mongod process / instanceとし、同一processのdatabase名だけを分ける構成を拒否する。same-host配置を許容しながら、connection string、credential / user、storage、lifecycle、主要resource設定、Node read-only access、Store maintenanceとNode resyncの分離を規範化している。`CT-085`はこれらを運用構成と障害・復旧の外部確認項目へ結び付ける。

Requirements `CON-003` / `SEC-004`およびDesign `DD-004`との矛盾は確認しなかった。前回からのSR-008 Minor（Traceability上の未定義`SPEC-GEN-001`〜`003`参照）は未解消のためOpenとして維持する。Critical findingはなくREADY。

## Finding Status

| ID | Severity | Status | 初出レビュー | 今回の状態根拠 |
|---|---|---|---|---|
| SR-001〜SR-007 | Critical / Major | Resolved | Specification Review 001 | 現行本文およびCT-047〜084への既存追跡を維持。今回のStore追加は各解決を損なわない。 |
| SR-008 | Minor | Open | Specification Review 002 | Traceability表に未定義`SPEC-GEN-001`〜`SPEC-GEN-003`が残る。影響する本文契約は他節から追跡できCriticalではない。 |

## Required Changes

なし。Critical findingはない。

## Optional Improvements

### SR-008 — Traceability内の未定義Specification ID（継続）

- **Severity:** Minor
- **対象箇所:** §15 Traceabilityの`CON-007`、`PERF-003`、`SEC-001`行
- **事実と影響:** `SPEC-GEN-001`〜`SPEC-GEN-003`はSpecification本文で定義されていない。対応する意味は別契約に記載されるが、IDを用いた追跡は解決できない。
- **根拠:** Requirements / SpecificationのTraceabilityは要件から規範契約へ追跡する目的を示す。前回Review 002のSR-008がこの参照を特定している。
- **必要な最小改善:** 既存の規範記述へ正しく付け替えるか、意味のある既存契約IDを本文で定義し、該当行を更新する。新しい契約の意味をReview findingから発明しない。
- **完了条件:** Traceability内の全Specification IDが本文で定義され、3要件から対応する規範記述へ到達できる。

## Resolved Findings

- SR-001〜SR-007は前回ReviewでResolved済みで、今回の変更による回帰なし。
- `CON-003` / `SEC-004`の今回の変更は`SPEC-STORE-001` / `CT-085`で新たに追跡可能。

## Upstream Feedback

なし。Requirementsの`CON-003` / `SEC-004`およびDesignのDD-004に対応するinstance分離契約が存在する。

## Deferred Findings

- CT-085の実環境適合、独立backup / restoreとNode resync後の保持は、運用構成が整った後に実施する。
- OPEN-007の実Node schema / coverage、OPEN-005のCryptact実取込、OPEN-008の性能thresholdなど既存の公開前確認は引き続き未実施。
- SR-008はID参照の任意改善であり、既存契約の根拠や意味を新設せず次の仕様改訂へ残す。

## Scope and Traceability

- `CON-003` → Design `DD-004` → `SPEC-STORE-001` → `CT-085`。
- `SEC-002` / `SEC-004` → Node read-only / 独立lifecycle・storage・resource境界 → `SPEC-NET-004` / `SPEC-STORE-001` → `CT-039` / `CT-085`。
- `AC-012`のsame-host co-location、same-process別database拒否、credential・storage・lifecycle分離およびdata preservation条件をCT-085が確認する。
- 本追加はSymbol MongoDBのcollection / schema、port、version、container、別hostを規範化しない。Mainnet / Testnetのruntime分離や、network非依存市場価格データの扱いを変更しない。
- Requirements Traceabilityは44 IDを維持し、Conformance CaseはCT-001〜CT-085の85件となった。

## Domain Checks

| 観点 | 判定 | 根拠 |
|---|---|---|
| Requirement / Design consistency | 合格 | Instance/process、same-host条件、readonly、lifecycle要件を上流条項と照合。 |
| MongoDB instance contract | 合格 | 同一`mongod`の別database拒否、別process必須、same-host許可が一意。 |
| Credential / authorization boundary | 合格 | Node credentialはread-only、SymTax Store書込み権限は独立Storeに限定。Browserへcredentialを渡さない。 |
| Storage / lifecycle / resource | 合格 | storage location、更新・再作成、resource limits / WiredTiger cache等の独立設定が定義される。 |
| Failure / recovery | 合格 | Store操作がNodeの再起動・再作成を要求せず、Node resync / rebuild / upgradeがSymTax観測を削除しない契約とCTを持つ。 |
| Mainnet / Testnet | 合格 | 既存runtime/network fail-closed契約に影響なし。 |
| Previous findings | 部分合格 | SR-001〜007は解決を維持。SR-008 Minorの未定義ID参照が継続。 |

## Validation Results

- Requirements、Design、Conceptと前回の公式Review結果を読み合わせた。
- `SPEC-STORE-001`、`CT-085`、`CON-003` / `SEC-004`のTraceabilityを静的に照合した。
- Documentation-only reviewのためアプリ実装テスト、実MongoDB障害試験、実外部APIは実行していない。
- レビュー成果物作成後に`git diff --check`を実行する。既存の未コミットImplementation変更は保持し、他ファイルを変更していない。

## Review Gates

| Gate | 判定 | 根拠 | 対応ID |
|---|---|---|---|
| 1. 目的と範囲 | 合格 | 新契約はdata-store分離に限定され、Symbol履歴ビューアの範囲を変えない。 | — |
| 2. 契約 | 合格 | Instance必須、禁止構成、same-host許可、独立設定とaccess権限が規定済み。 | SPEC-STORE-001 |
| 3. 処理と例外 | 合格 | Store保守・失敗およびNode resyncの期待結果を記述。 | SPEC-STORE-001、CT-085 |
| 4. 内部整合性 | 合格（Minor改善あり） | 上流とStore契約の矛盾なし。未定義SPEC-GEN ID参照はSR-008として継続。 | SR-008 |
| 5. 検証可能性 | 合格 | Deployment evidenceとlifecycle分離をCT-085で観測できる。 | CT-085 |
| 6. 安全性と相互運用性 | 合格 | Node DBのreadonly、credential境界、network fail-closedを保つ。 | SPEC-NET-004、SPEC-STORE-001 |
| 7. 上流整合性 | 合格 | RequirementsとDesignで要求されたMongoDB instance境界と一致。 | CON-003、SEC-004、DD-004 |

## Remaining Risks and Open Decisions

- SR-008の3つの未定義ID参照はMinorとして残る。
- 実デプロイを用いたCT-085、Node profile、Cryptact受入、性能測定は未確認であり、既存release gateを継続する。
- 今回のinstance分離要件による新たなOPEN事項はない。

## Automatic Changes

レビュー成果物 `apps/symtax/docs/reviews/specifications/specification-review-003.md` のみ新規作成した。Requirements、Design、Specification、Concept、実装、テストは変更していない。

## Final Decision

**READY** — Critical findingはない。SR-008はTraceabilityのMinorとして残すが、MongoDB instance分離契約は実装・運用上検証可能である。
