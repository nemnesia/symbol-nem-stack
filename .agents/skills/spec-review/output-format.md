# Output Format

Review Board Chair は、対象パッケージの `docs/reviews/specifications/` に、仕様書のベース名へ `-review-<3桁連番>.md` を付加した新規ファイルだけを生成する。既存の固定名レビュー成果物および既存の連番成果物は上書きしない。Reviewer 個人の意見、討議、投票、反論、却下理由、思考過程は記載しない。

```markdown
# Specification Review Findings

## Review Target

- 対象: <仕様書のパス>
- 確認日: <YYYY-MM-DD HH:mm>
- 成果物: <対象パッケージ>/docs/reviews/specifications/<ベース名>-review-<3桁連番>.md

## Execution Audit

- 実行モード: `multi_agent_v1__spawn_agent` で起動した3つの独立した Reviewer サブエージェント
- Reviewer A agent_id: <返却された agent_id>
- Reviewer B agent_id: <返却された agent_id>
- Reviewer C agent_id: <返却された agent_id>
- Phase 1: <完了。各 Reviewer の `multi_agent_v1__wait_agent` で確認>
- Phase 2: <完了。各 Reviewer の `multi_agent_v1__wait_agent` で確認>
- Chair 統合: <完了>

3つの `agent_id` は相互に異なる値でなければならない。起動、送信、完了、または統合を確認できない場合は、この findings ファイル自体を生成しない。プロンプト、討議内容、投票、内部の思考過程は記載しない。

## Evidence Used

| 種別                           | 参照箇所                                                                       | 用途                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 仕様本文                       | <見出しまたは行>                                                               | <確認した内容>                                                         |
| コンセプト本文                 | <パス・見出しまたは未確認>                                                     | <仕様書との整合性確認>                                                 |
| コンセプトレビュー結果         | <対象パッケージ/docs/reviews/concept/<ベース名>-review-<最大3桁連番>.md のパスまたは未確認> | <対象一致、鮮度、Review Result、Required Changes、Review Gates の確認> |
| 要件本文                       | <パス・見出しまたは未確認>                                                     | <要件、制約、受け入れ条件の引継ぎ確認>                                 |
| 要件レビュー結果               | <対象パッケージ/docs/reviews/requirements/<ベース名>-review-<最大3桁連番>.md のパス、旧形式固定名または未確認> | <対象一致、鮮度、Review Result、Required Changes、Review Gates の確認> |
| 実装者からの仕様フィードバック | `<source-root>/docs/reviews/implementation/implement-spec-feedback.md`、指定パス、または未確認 | <実装で判明した仕様の曖昧さ、矛盾、欠落の確認>                         |

確認できない事実は「未確認」と記載し、推測を事実として記載しない。

## Review Result

<実装へ進める | 仕様の修正を優先する>

## Summary

<改善案を含めない総合評価を3〜10行で記載する。将来拡張や追加機能を提案しない。>

## Finding Status

対象仕様書で確認された正式指摘を、今回の状態とともに一覧化する。過去に対応済みとなった指摘も除外せず、状態を `Resolved` として記載する。該当しない場合は「なし」とする。

| ID | Priority | Status | 初出レビュー | 今回の確認 |
| --- | --- | --- | --- | --- |
| SR-001 | <Critical \| Major \| Minor> | <New \| Open \| Resolved \| Deferred \| Reopened> | <レビュー番号> | <状態の根拠> |

## Required Changes

現在対応が必要な Critical と Major の採用指摘（`New`、`Open`、`Reopened`）だけを記載する。該当しない場合は「なし」とする。

### SR-001

- Priority: <Critical | Major>
- Status: <New | Open | Reopened>
- 対象箇所: <見出しまたは行>
- 問題: <既存の要求・制約・仕様に対する具体的な欠陥>
- 根拠: <種別と参照箇所>
- 影響: <現在の対象範囲で放置した場合の具体的影響>
- 修正内容: <欠陥を解消するための必要条件。特定の実装方式や追加機能を指定しない>
- 修正完了条件: <既存要求を満たしたと判断できる最小十分な条件>

## Optional Improvements

現在対応が必要な Minor の採用指摘（`New`、`Open`、`Reopened`）だけを記載する。Minor は既存要件または仕様の明確性・一貫性に関する小さな欠陥に限定する。将来拡張、追加機能、追加防御、汎用化、ベストプラクティスの提案は記載しない。該当しない場合は「なし」とする。

### SR-010

- Priority: Minor
- Status: <New | Open | Reopened>
- 対象箇所: <見出しまたは行>
- 改善内容: <既存仕様の小さな欠陥を解消する修正>
- 根拠: <種別と参照箇所>
- 影響: <現在の対象範囲で改善する理由>

## Resolved Findings

対応済みと確認できた過去指摘だけを記載する。対応確認の根拠を必ず付ける。該当しない場合は「なし」とする。

### SR-020

- Priority: <Critical | Major | Minor>
- Status: Resolved
- 初出レビュー: <レビュー番号>
- 対象箇所: <見出しまたは行>
- 対応確認: <現在の仕様書の参照箇所>

## Deferred Findings

後工程へ引き継ぐと判定した指摘だけを記載する。該当しない場合は「なし」とする。

### SR-030

- Priority: <Critical | Major | Minor>
- Status: Deferred
- 対象箇所: <見出しまたは行>
- 引継ぎ内容: <実装以降で確認する内容>

## Review Gates

| Gate                                         | 結果  | 根拠    |
| -------------------------------------------- | ----- | ------- |
| 目的と範囲                                   | <合格 | 不合格> | <参照箇所または SR ID> |
| 機能と制約                                   | <合格 | 不合格> | <参照箇所または SR ID> |
| 処理と例外                                   | <合格 | 不合格> | <参照箇所または SR ID> |
| 内部整合性                                   | <合格 | 不合格> | <参照箇所または SR ID> |
| 検証可能性                                   | <合格 | 不合格> | <参照箇所または SR ID> |
| 不可欠な前提の現実性と安全性                 | <合格 | 不合格> | <参照箇所または SR ID> |
| コンセプト・要件定義との整合性と前段品質判定 | <合格 | 不合格> | <参照箇所または SR ID> |

## Final Decision

<Review Result と同じ判定を記載し、理由を2〜5行で記載する。>
```

指摘は抽象化せず、製作者がこのファイルだけで必要な修正または確認を実施できる内容にする。ただし「実行できる内容」とするために Reviewer が解決方式を設計してはならない。修正内容は、満たすべき条件と欠陥の解消範囲に留める。
