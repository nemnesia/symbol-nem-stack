# Output Format

Review Board Chair は、対象パッケージの `docs/reviews/requirements/` に、要件定義書のベース名へ `-review-<3桁連番>.md` を付加した新規ファイルだけを生成する。既存の固定名レビュー成果物および既存の連番成果物は上書きしない。Reviewer 個人の意見、討議、投票、反論、却下理由、思考過程は記載しない。

```markdown
# Requirements Review Findings

## Review Target

- 対象: <要件定義書のパス>
- 確認日: <YYYY-MM-DD HH:mm>
- 成果物: <対象パッケージ>/docs/reviews/requirements/<ベース名>-review-<3桁連番>.md

## Execution Audit

- 実行モード: `multi_agent_v1__spawn_agent` で起動した3つの独立した Reviewer サブエージェント
- Reviewer A agent_id: <実行時に返された ID>
- Reviewer B agent_id: <実行時に返された ID>
- Reviewer C agent_id: <実行時に返された ID>
- Phase 1: <完了。`multi_agent_v1__wait_agent` で確認>
- Phase 2: <完了。`multi_agent_v1__wait_agent` で確認>
- Chair 統合: <完了>

3つの `agent_id` は相互に異なる値を記載する。起動・完了を確認できない場合は、このファイル自体を生成しない。プロンプト、個人の意見、討議、投票、却下理由、思考過程は記載しない。

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 要件本文 | <見出しまたは行> | <確認した内容> |
| コンセプト本文 | <コンセプトシートのパス・見出し、または未確認> | <要件定義書との整合性確認> |
| コンセプトレビュー結果 | <対象パッケージ/docs/reviews/concept/<ベース名>-review-<最大3桁連番>.md のパス、または未確認> | <対象一致、鮮度、Review Result、Required Changes、Review Gates の確認> |

確認できない事実は「未確認」と記載し、推測を事実として記載しない。

## Review Result

<仕様設計へ進める | 要件の修正を優先する>

## Summary

<改善案を含めない総合評価を3〜10行で記載する。要件定義としての品質だけを評価し、仕様・設計上の改善余地を評価に含めない。>

## Finding Status

対象要件定義書で確認された正式指摘を、今回の状態とともに一覧化する。過去に対応済みとなった指摘も除外せず、状態を `Resolved` として記載する。該当しない場合は「なし」とする。

| ID | Priority | Status | 初出レビュー | 今回の確認 |
| --- | --- | --- | --- | --- |
| RR-001 | <Critical \| Major \| Minor> | <New \| Open \| Resolved \| Deferred \| Reopened> | <レビュー番号> | <状態の根拠> |

## Required Changes

現在対応が必要な Critical と Major の採用指摘（`New`、`Open`、`Reopened`）だけを記載する。該当しない場合は「なし」とする。

### RR-001

- Priority: <Critical | Major>
- Status: <New | Open | Reopened>
- 対象箇所: <見出しまたは行>
- 問題: <要件レベルの問題>
- 根拠: <種別と参照箇所>
- 影響: <放置した場合の影響>
- 修正内容: <要件定義書に追加・修正すべき目的、制約、責任、外部契約、品質特性、受け入れ条件、前提、未決定事項のいずれか>
- 修正完了条件: <要件定義書上で完了を判断できる条件>

## Optional Improvements

現在対応が必要な Minor の採用指摘（`New`、`Open`、`Reopened`）だけを記載する。該当しない場合は「なし」とする。

### RR-010

- Priority: Minor
- Status: <New | Open | Reopened>
- 対象箇所: <見出しまたは行>
- 改善内容: <要件定義としての明確性・追跡性・検証可能性を改善する内容>
- 根拠: <種別と参照箇所>
- 影響: <改善する理由>

## Resolved Findings

対応済みと確認できた過去指摘だけを記載する。対応確認の根拠を必ず付ける。該当しない場合は「なし」とする。

### RR-020

- Priority: <Critical | Major | Minor>
- Status: Resolved
- 初出レビュー: <レビュー番号>
- 対象箇所: <見出しまたは行>
- 対応確認: <現在の要件定義書の参照箇所>

## Deferred Findings

後工程へ引き継ぐと判定した指摘だけを記載する。該当しない場合は「なし」とする。

### RR-030

- Priority: <Critical | Major | Minor>
- Status: Deferred
- 対象箇所: <見出しまたは行>
- 引継ぎ内容: <仕様設計以降で確認する内容>

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 目的と課題 | <合格 | 不合格> | <参照箇所または RR ID> |
| 利用者と関係者 | <合格 | 不合格> | <参照箇所または RR ID> |
| 対象範囲 | <合格 | 不合格> | <参照箇所または RR ID> |
| 要件と制約 | <合格 | 不合格> | <参照箇所または RR ID> |
| 受け入れ条件 | <合格 | 不合格> | <参照箇所または RR ID> |
| 内部整合性 | <合格 | 不合格> | <参照箇所または RR ID> |
| 不可欠な前提の現実性と安全性 | <合格 | 不合格> | <参照箇所または RR ID> |
| コンセプト整合性と前段品質判定 | <合格 | 不合格> | <コンセプト本文・コンセプトレビュー結果の参照箇所、未確認、または RR ID> |

## Final Decision

<Review Result と同じ判定を記載し、理由を2〜5行で記載する。>
```

指摘は抽象化せず、製作者がこのファイルだけで要件定義書の必要な修正または確認を実施できる内容にする。ただし、具体的な API、フィールド、型、アルゴリズム、ライブラリ、暗号方式、内部構造、テストケース等を修正内容として指定してはならない。それらが必要に見える場合は、要件レベルの特性・制約の欠落へ言い換えられる場合だけ記載する。
