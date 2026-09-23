---
name: phase-context-maintainer
description: symbol-nem-wallet-core の正式資料から、任意のフェーズ用に非規範的な Phase Context を評価・作成・refresh する。Context の必要性を反復参照コストで判定し、正式資料やレビュー成果物は変更しない。
---

# Phase Context Maintainer

Concept、Requirements、Design、Specification などの正式資料を、Author と Reviewer が
毎回横断して再構築している場合に限り、探索用の Phase Context を維持する。Phase Context は
新しい開発フェーズでも、要求・設計判断・仕様でも、Source of Truth でもない。

## 責務と境界

この Skill の責務は次だけである。

- 対象フェーズの承認済み正式資料を確認する。
- 反復参照される安定した共通知識、責務境界、trust boundary、security invariant、用語および authoritative source map を抽出する。
- Context の必要性を評価し、必要な場合だけ Context を新規作成または正式資料から refresh する。
- source 間の競合、stale の疑いおよび未解決事項を報告する。

次を行わない。

- Concept / Requirements / Design / Specification 本文、レビュー成果物、コード、テストまたは fixture を変更する。
- 新しい requirement、design decision、specification、API、field、error、fallback、互換性または将来構想を作る。
- ambiguity や open decision を独断で解消する。
- review finding を自動採用する。
- Context の内容を正式資料へ逆流させる、または Context を正式資料の根拠に昇格させる。

## 作業開始と正式資料

1. `AGENTS.md` を読む。
2. 対象フェーズと、`AGENTS.md` の `Phase Contexts` 登録の有無を確認する。
3. Context の作成・refresh を依頼された場合も、既存 Context ではなく承認済み正式資料を主な入力にする。既存 Context は stale / conflict の検出対象としてのみ読む。
4. 対象フェーズの正式資料と、直接必要な承認済み上流資料を確認する。レビュー記録、実装、テストおよび技術資料は、正式資料の状態・整合性・技術的事実を確認する必要がある場合だけ補助的に読む。
5. 資料間の競合は解消せず、対象、chain / network、version、資料の役割、影響および判断が必要な段階を報告する。

対象フェーズの Context が `AGENTS.md` に登録されていない場合、既存の未登録ファイルを
自動利用しない。作成する場合は、作成後に既存の Context パスを `Phase Contexts` へ登録する。
未登録の Context ファイルだけを先に作らない。

## 必要性の評価

Context を新規作成する前に、対象フェーズ単位で次を実際の参照関係と典型的な作業から評価する。
ファイル数、行数、文字数だけを閾値や判定根拠にしない。

1. 1作業あたりに典型的に参照する正式資料の数と、横断の深さ。
2. 複数の Author / Reviewer 作業で同じ資料群を繰り返し読むか。
3. 複数資料にまたがる stable な responsibility boundary、trust boundary、security invariant、用語または lifecycle の量。
4. 必要な情報の所在を特定する探索コスト。
5. 共通 invariant / boundary を毎回再抽出する頻度。
6. Context 化によって、初期探索の負荷または参照資料の重複を実際に減らせるか。
7. 正式資料の変更に追随して Context を維持するコストが、得られる効果を上回らないか。

結果は次のいずれかを明記する。

- `NO CONTEXT NEEDED`: 正式資料を直接参照する。Context ファイルも登録も作成しない。
- `CONTEXT RECOMMENDED`: 期待する探索負荷の削減、対象とする安定知識、source set、維持コストおよび残る正式資料参照を報告する。

`CONTEXT RECOMMENDED` は作成許可そのものではない。評価のみの依頼、または作成禁止の指示では
ファイルを作成しない。作成・refresh が依頼され、評価結果も妥当な場合にだけ次の形式を作る。

## Context の作成と形式

Context は正式資料の全文要約やコピーではなく、初期探索を速くする最小の派生情報とする。
最低限、次を含める。

- `Purpose`
- `Scope`
- `Non-normative status`
- `Authoritative source precedence`
- `Source documents`
- `Refresh policy`
- `authoritative source map`

`Authoritative source precedence` には、対象フェーズの適用可能な正式資料と承認済み上流・同一
フェーズ資料が、各フェーズの既存ルールに従って Context より優先されること、レビュー記録・
実装・技術資料は補助的な根拠に留まることを明記する。`Source documents` には、正式資料の
パス、フェーズ、役割および確認範囲を列挙する。

含めてよいのは、対象フェーズの範囲、stable な cross-cutting responsibility boundary、trust
boundary、security invariant、shared terminology、shared lifecycle principle、既存の正式資料で
確定した decision、未解決 decision および authoritative source の所在である。個別の詳細、
review history、finding 全文、implementation detail、speculative decision、将来構想は原則として
含めない。

Context の source map は、例えば次のように topic、正式資料の所在および確認対象を対応付ける。

```markdown
| Topic | Authoritative source | Re-check |
| --- | --- | --- |
| responsibility boundary | `docs/design/architecture.md` §... | boundary wording |
```

Context ファイルには有効な YAML frontmatter を付け、少なくとも `phase`、`status: non-normative`
および `last_refreshed` を記録する。登録パスは `docs/context/<phase>-context.md` など、実在する
リポジトリ相対パスとする。`AGENTS.md` の登録、frontmatter、source map、見出しおよびリンクを
作成後に確認する。

Context の記載と正式資料が競合した場合は正式資料を優先する。Context に情報がない、曖昧、
鮮度が不明、security invariant / trust boundary / responsibility boundary に影響する、traceability
を確定する、または normative contract を記述する場合は、Context から正式資料へ戻る。

## Refresh policy

- 対象フェーズの重要な正式資料が READY / accepted になった後に refresh を検討する。
- refresh 時は Context ではなく、承認済み正式 source を再確認する。
- Context 自体から判断を追加しない。open / unresolved 事項はそのまま保持する。
- source conflict は解消せず、影響とともに報告する。
- stale の疑いが解消できない場合、Author / Reviewer が正式資料へフォールバックできるよう明記する。
- file hash database、dependency graph、automatic watcher、CI generator、background synchronization、stale detection service は作らない。

## 完了条件

- `NO CONTEXT NEEDED` または `CONTEXT RECOMMENDED` の判定と根拠が、対象フェーズの参照関係へ追跡できる。
- Context を作成・refresh した場合、必須情報、source map、frontmatter、登録パスが確認できる。
- 正式資料の競合、未決定事項、stale の疑いを独断で解消していない。
- 正式資料、本文、レビュー成果物、コード、テストおよび fixture を変更していない。
- Author / Reviewer が Context だけで新しい判断、Critical / Major finding または Gate 判定を確定できない。
