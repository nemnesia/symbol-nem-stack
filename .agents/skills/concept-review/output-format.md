# Output Format

Review Board Chair は、対象パッケージの `docs/reviews/concept/` に、コンセプトシートのベース名へ `-review-<3桁連番>.md` を付加した新規ファイルだけを生成する。既存のレビュー成果物は上書きしない。Reviewer 個人の意見、討議、投票、反論、却下理由、思考過程は記載しない。

```markdown
# Concept Review Findings

## Review Target

- 対象: <コンセプトシートのパス>
- 確認日: <YYYY-MM-DD HH:mm>
- 成果物: <対象パッケージ>/docs/reviews/concept/<ベース名>-review-<3桁連番>.md

## Execution Audit

- 実行モード: 3つの独立した Reviewer サブエージェント
- Reviewer A agent_id: <実行時に返された ID>
- Reviewer B agent_id: <実行時に返された ID>
- Reviewer C agent_id: <実行時に返された ID>
- Phase 1: <完了>
- Phase 2: <完了>
- Chair 統合: <完了>

3つの `agent_id` は相互に異なる値を記載する。起動・完了を確認できない場合は、このファイル自体を生成しない。プロンプト、個人の意見、討議、投票、却下理由、思考過程は記載しない。

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| コンセプト本文 | <見出しまたは行> | <確認した内容> |

確認できない事実は「未確認」と記載し、推測を事実として記載しない。

## Review Result

<要件定義へ進める | コンセプト整理を優先する>

## Summary

<改善案を含めない総合評価を3〜10行で記載する。>

## Finding Status

対象コンセプトで確認された正式指摘を、今回の状態とともに一覧化する。過去に対応済みとなった指摘も除外せず、状態を `Resolved` として記載する。該当しない場合は「なし」とする。

| ID | Priority | Status | 初出レビュー | 今回の確認 |
| --- | --- | --- | --- | --- |
| CR-001 | <Critical \| Major \| Minor> | <New \| Open \| Resolved \| Deferred \| Reopened> | <レビュー番号> | <状態の根拠> |

## Required Changes

現在対応が必要な Critical と Major の採用指摘（`New`、`Open`、`Reopened`）だけを記載する。該当しない場合は「なし」とする。

### CR-001

- Priority: <Critical | Major>
- Status: <New | Open | Reopened>
- 対象箇所: <見出しまたは行>
- 問題: <問題>
- 根拠: <種別と参照箇所>
- 影響: <放置した場合の影響>
- 修正内容: <製作者が実行できる修正または確認>
- 修正完了条件: <完了を判断できる条件>

## Optional Improvements

現在対応が必要な Minor の採用指摘（`New`、`Open`、`Reopened`）だけを記載する。該当しない場合は「なし」とする。

### CR-010

- Priority: Minor
- Status: <New | Open | Reopened>
- 対象箇所: <見出しまたは行>
- 改善内容: <改善提案>
- 根拠: <種別と参照箇所>
- 影響: <改善する理由>

## Resolved Findings

対応済みと確認できた過去指摘だけを記載する。対応確認の根拠を必ず付ける。該当しない場合は「なし」とする。

### CR-020

- Priority: <Critical | Major | Minor>
- Status: Resolved
- 初出レビュー: <レビュー番号>
- 対象箇所: <見出しまたは行>
- 対応確認: <現在のコンセプト本文の参照箇所>

## Deferred Findings

後工程へ引き継ぐと判定した指摘だけを記載する。該当しない場合は「なし」とする。

### CR-030

- Priority: <Critical | Major | Minor>
- Status: Deferred
- 対象箇所: <見出しまたは行>
- 引継ぎ内容: <要件定義以降で確認する内容>

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| コンセプトの明確さ | <合格 | 不合格> | <参照箇所または CR ID> |
| 課題の明確さ | <合格 | 不合格> | <参照箇所または CR ID> |
| 対象ユーザー | <合格 | 不合格> | <参照箇所または CR ID> |
| 提供価値 | <合格 | 不合格> | <参照箇所または CR ID> |
| MVP の境界 | <合格 | 不合格> | <参照箇所または CR ID> |
| 内部整合性 | <合格 | 不合格> | <参照箇所または CR ID> |
| 不可欠な前提の現実性 | <合格 | 不合格> | <参照箇所または CR ID> |

## Final Decision

<Review Result と同じ判定を記載し、理由を2〜5行で記載する。>
```

指摘は、コンセプトシートの修正として実行可能な粒度にする。

修正内容は、課題、対象ユーザー、提供価値、スコープ、MVP、
またはコンセプト成立前提の追記、削除、明確化に限定する。

要件、API、データ構造、アルゴリズム、アーキテクチャ、
暗号方式、通信方式、実装方式などの具体的解決策を要求してはならない。

詳細な決定が必要な事項は要件定義以降へ委譲し、
コンセプトレビューの指摘には含めない。
