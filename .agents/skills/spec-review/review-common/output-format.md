# Review Output Format

すべてのレビュー成果物は Markdown とし、以下の章構成・順序を共通で使用する。レビュー種別ごとに異なる正式指摘の接頭辞、重大度、Review Result の値、Domain Checks の内容は各 Skill の `output-format.md` に従う。該当項目がない場合も「なし」と明記する。

## 共通構成

1. `Review Target`: 対象、確認日、成果物、レビュー範囲、未確認範囲
2. `Execution Audit`: self-review の観点別パス、または実際に使用したサブエージェントと完了状態
3. `Evidence Used`: 確認資料、用途、実行結果
4. `Review Result`: 対象 Skill の Review Result 値
5. `Summary`: 総評
6. `Finding Status`: ID、Severity、Status、初出レビュー、今回の状態根拠
7. `Required Changes`: 対象 Skill で必須とされる重大度の New / Open / Reopened
8. `Optional Improvements`: 対象 Skill で任意改善とされる重大度の New / Open / Reopened
9. `Resolved Findings`: 対応確認できた過去指摘
10. `Upstream Feedback`: 上流の正式資料・decision の不足、曖昧さ、矛盾を返す記録
11. `Deferred Findings`: 下流・対象範囲外・後続検証へ引き継ぐ指摘、未決定事項、確認事項
12. `Scope and Traceability`: 対象境界、上流・下流資料との追跡、責任分界
13. `Domain Checks`: 対象 Skill 固有の評価項目
14. `Validation Results`: 実行した検証、結果、未実行・未確認範囲
15. `Review Gates`: 各ゲートの合否、根拠、対応 ID
16. `Remaining Risks and Open Decisions`: 残存リスク、未決定事項、前提
17. `Automatic Changes`: レビュー中に行った変更。変更しない場合は「なし」
18. `Final Decision`: `Review Result` と同じ最終判定

各指摘には、対象箇所（実装レビューではファイルと行）、発生条件または確認できた事実、既存の根拠、問題、影響、必要な最小修正または確認、完了条件または再確認方法を含める。レビュー本文へ討議、投票、思考過程を出力しない。秘密情報、復号データ、credential も記録しない。

## Upstream Feedback と Deferred Findings

`Upstream Feedback` は、現在のレビュー対象より上流にある正式な Requirement / Design / Specification または既存の正式な decision の不足、曖昧さ、矛盾を返すための独立した記録 lane である。各 entry は次を含める。

- `送信元フェーズ`
- `受領すべき上流フェーズ`
- `対象となる正式資料 / decision`
- `不足・曖昧さ・矛盾`
- `下流への影響`
- `non-normative status`
- `解消条件`

`Upstream Feedback` 自体は formal finding ではなく、Severity を持たず、Required Change、Gate failure、Review Result を決めない。Requirement / Design / Specification の新しい normative source、Decision、contract でもない。正式資料が変更され、必要な承認を受けるまで、feedback 自体から新しい Requirement、Design Decision、Specification contract を生成してはならない。下流 Reviewer は上流の不足を推測で補完せず、不足・曖昧さ・矛盾、影響、解消条件だけを記録する。

上流 gap が残っていても現在フェーズを安全に評価・完了できる場合は、`Upstream Feedback` のみを記録し、non-blocking とする。上流 gap により現在フェーズを安全に評価・完了できない場合は、現在フェーズ側の formal finding を別途記録し、その finding から該当する `Upstream Feedback` へ trace する。current-phase finding には「上流欠落によって現在フェーズが成立しない」という影響を記載し、Severity、Required Change、Gate failure、Review Result には現在フェーズの既存 Skill policy を適用する。`Upstream Feedback` 自体には Severity、Required Change、Gate failure、Review Result を付けない。同じ根本問題を feedback と formal finding の二重欠陥として数えず、Chair が両者の trace relationship と状態を管理する。

この関係は、Design Review から Requirements へ返す場合、Specification Review から Design / 必要時 Requirements へ返す場合、Implementation Review から Specification / 必要時 Design・Requirements へ返す場合に同じように適用する。例えば Design の Requirements gap が ownership / trust boundary / signing authority を安全に確定できなくする場合は、Requirements への `Upstream Feedback` と Design 側の formal finding を記録する。安全に確定できる場合は feedback のみとする。

通常の feedback direction は次のとおりとする。問題の発生源が本当に Requirements にある場合だけ Requirements へ返し、機械的に最上流まで遡らせない。

| 送信元レビュー        | 受領すべき上流フェーズ                              |
| --------------------- | --------------------------------------------------- |
| Requirements Review   | 通常なし                                            |
| Design Review         | Requirements                                        |
| Specification Review  | Design。必要な場合だけ Requirements                 |
| Implementation Review | Specification。必要な場合だけ Design / Requirements |

`Deferred Findings` は、downstream、current scope outside、または later verification へ引き継ぐ事項を記録する。上流の正式資料の不足・曖昧さ・矛盾は `Deferred Findings` に混在させず、`Upstream Feedback` に記録する。
