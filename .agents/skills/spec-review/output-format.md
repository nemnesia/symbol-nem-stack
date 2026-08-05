# Output Format

Review Board Chair は `.reviews/spec-review-findings.md` だけを生成する。Reviewer 個人の意見、討議、投票、反論、却下理由、思考過程は記載しない。

```markdown
# Specification Review Findings

## Review Target

- 対象: <仕様書のパス>
- 確認日: <YYYY-MM-DD>

## Evidence Used

| 種別 | 参照箇所 | 用途 |
| --- | --- | --- |
| 仕様本文 | <見出しまたは行> | <確認した内容> |

確認できない事実は「未確認」と記載し、推測を事実として記載しない。

## Review Result

<実装へ進める | 仕様の修正を優先する>

## Summary

<改善案を含めない総合評価を3〜10行で記載する。>

## Required Changes

Critical と Major の採用指摘だけを記載する。該当しない場合は「なし」とする。

### SR-001

- Priority: <Critical | Major>
- 対象箇所: <見出しまたは行>
- 問題: <問題>
- 根拠: <種別と参照箇所>
- 影響: <放置した場合の影響>
- 修正内容: <製作者が実行できる修正または確認>
- 修正完了条件: <完了を判断できる条件>

## Optional Improvements

Minor の採用指摘だけを記載する。該当しない場合は「なし」とする。

### SR-010

- Priority: Minor
- 対象箇所: <見出しまたは行>
- 改善内容: <改善提案>
- 根拠: <種別と参照箇所>
- 影響: <改善する理由>

## Review Gates

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| 目的と範囲 | <合格 | 不合格> | <参照箇所または SR ID> |
| 機能と制約 | <合格 | 不合格> | <参照箇所または SR ID> |
| 処理と例外 | <合格 | 不合格> | <参照箇所または SR ID> |
| 内部整合性 | <合格 | 不合格> | <参照箇所または SR ID> |
| 検証可能性 | <合格 | 不合格> | <参照箇所または SR ID> |
| 不可欠な前提の現実性と安全性 | <合格 | 不合格> | <参照箇所または SR ID> |

## Final Decision

<Review Result と同じ判定を記載し、理由を2〜5行で記載する。>
```

指摘は抽象化せず、製作者がこのファイルだけで必要な修正または確認を実施できる内容にする。
