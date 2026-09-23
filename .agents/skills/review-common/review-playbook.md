# Review Playbook

レビュー系 Skill 共通の実行規則。各 Skill は、この文書に加えて対象種別の `reviewers.md`、`review-gates.md`、`output-format.md` を読む。

## このリポジトリの前提

- 対象は `symbol-nem-wallet-core` の Rust Core、Native C ABI、WASM binding、ドキュメント、テスト、fixture である。
- 作業指針はリポジトリルートの `AGENTS.md` を読む。技術的な正本は対象機能の要件、仕様、`docs/design/`、必要な公式資料である。
- 主要な資料置き場は `docs/consept/`、`docs/requirements/`、`docs/design/`、`docs/specifications/`、`docs/knowledge/`、レビュー成果物は `docs/reviews/` である。設計と設計判断は `docs/design/` に統合する。
- `Symbol / NEM`、`Mainnet / Testnet`、Core / Native / WASM、protocol / SDK を混同しない。存在しない外部サービスや別言語 package 固有の前提は、根拠がない限り持ち込まない。

## 目的と実行主体

レビューの目的は、既存の要求・設計・仕様・実装・公開契約に対する具体的な不備を検出し、次工程へ進める品質を判定することである。新しい機能、設計、互換層、抽象化を提案する場ではない。

メインエージェントは Review Board Chair として、対象確定、根拠管理、指摘統合、ゲート判定、成果物作成を担当する。サブエージェントを使える場合でも、依頼範囲と権限に適合する場合だけ使う。使わない場合は観点ごとに別パスで自己レビューし、実施していない起動や並列実行を記録しない。

## Phase Context の扱い

Phase Context は任意の非規範的な派生情報であり、レビューの圧縮キャッシュである。
対象フェーズが `AGENTS.md` の `Phase Contexts` に登録されている場合だけ、初期理解、
共通前提の把握、authoritative source の探索および cross-cutting invariant の把握に利用できる。
登録がない場合は Context を探索・作成せず、通常の正式資料参照を行う。

Context の authoritative source map は正式資料の所在を示す案内として扱う。対象文書、
承認済み上流資料、同一フェーズの正式資料および適用可能な公式資料の確認を省略しない。
`Critical`、`Major` または品質 Gate の不合格を、Context 単独を根拠に確定してはならない。
正式 finding の根拠は、対象文書または確認済みの正式な上流・同一フェーズ source へ追跡する。

Context と正式資料が競合した場合は正式資料を優先する。Context の誤り、stale または
inconsistent な状態は、それ自体をレビュー対象本文の欠陥にせず、必要に応じて別途報告する。
Phase Context の導入によって、Review Board、severity、Review Gate、フェーズ順序または
下流から上流への根拠の流れを変更しない。

## 実行フェーズ

### Phase 0: 対象・根拠・境界

1. ユーザーが明示した対象を優先する。
2. 未指定の場合は各 Skill の候補探索規則を使う。候補が0件または複数件なら推測せず、対象確認で終了する。
3. 変更対象、上流資料、補助資料、成果物の出力先を確定する。
4. レビュー種別の責務を越える資料や対象を、根拠として混ぜない。

### Phase 1: 独立レビュー

各 Reviewer は担当観点について、対象箇所、確認事実、既存根拠またはゲートとの関係、発生条件、影響、必要な修正・確認、未確認範囲を整理する。

指摘候補は、次をすべて満たす場合だけ採用候補にする。

1. 対象本文、差分、承認済み資料、公式資料のいずれかへ追跡できる。
2. 現在の対象範囲に具体的な影響がある。
3. 別の工程で初めて決めても既存要求を満たせる事項ではない。
4. 新しい要求、機能、制約、方式、将来拡張を追加していない。

### Phase 2: 反証・統合

Chair は候補の重複を除き、根拠、影響、必要条件、対象工程を再確認する。上流の正式資料・decision の不足、曖昧さ、矛盾は `Upstream Feedback` へ、下流への委譲、対象範囲外、後続検証は `Deferred Findings` へ分離する。上流 gap が current phase の安全な評価・完了を妨げる場合は、current phase の formal finding を別途記録し、既存の phase-specific Severity / Gate policy を適用したうえで `Upstream Feedback` へ trace する。feedback 自体には formal finding、Severity、Required Change、Gate 判定、Review Result を付けず、同じ問題を二重計上しない。既存仕様が未決定で正否を判定できないだけなら、実装・文書の欠陥と断定せず、発生方向に応じた lane を使用する。過去指摘は対象一致を確認し、状態だけを追跡する。

### Phase 3: ゲート判定と成果物

1. 対象種別の `review-gates.md` を適用する。
2. 不合格ゲートを対象 Skill の必須重大度の正式指摘へ結び付ける。
3. 指摘へ正式 ID と状態を付ける。
4. 共通 `output-format.md` と対象 Skill 固有の形式で、新規成果物を作成する。既存成果物を移動・削除・上書きしない。
5. 実行していない検証を成功扱いにせず、未確認範囲へ記録する。

### Requirements / Design / Specification Review の Gate と Severity

Requirements Review、Design Review、Specification Review では、品質 Gate を不合格にする正式指摘を `Critical` とする。`Critical` が1件以上存在する場合は、それぞれ `REVISE REQUIREMENTS`、`REVISE DESIGN`、`REVISE SPECIFICATION` とする。`Critical` がなく `Major` / `Minor` のみの場合は `READY` とし、指摘を次工程への引継ぎまたは改善として記録する。

この3種類のレビューでは、対象フェーズの上流資料と同一フェーズの対象・既存成果物を主な根拠とする。下流資料は、既存下流成果物との回帰・互換性・委譲・実現可能性の確認またはユーザーの明示要求がある場合だけ補助的に参照し、下流の詳細不足だけを上流フェーズの Gate 不合格や新しい上流要求・設計として扱わない。他の Review Skill が異なる Severity 体系を定める場合は、その Skill 固有の規則を適用する。

## 境界と根拠

- 一般論、個人的好み、将来の機能、未要求の API / field / error / fallback、対象外のリファクタリングは指摘にしない。
- 方式の選択が必要な場合、レビューは必要な条件・未決定事項までに留め、アルゴリズム、ライブラリ、wire format を勝手に選ばない。
- 既存コード・テスト・SDKの挙動は現状や実現可能性の確認には使えるが、Symbol / NEM protocol の正本やプロジェクト要求の代わりにはしない。
- 資料の競合は chain、network、version、資料の役割、更新時点、影響とともに記録し、勝手に統合しない。
- 過去レビューは原則として指摘 ID と状態の追跡に使う。前段レビューの判定が必要な場合は、公開された判定と指摘状態だけを確認する。

## 機密情報と change-aware validation

秘密鍵、Mnemonic、password、復号データ、credential をログ、成果物、例、エラー、テスト出力へ含めない。

検証前に実際の変更ファイルとユーザーが依頼した検証範囲を確認し、ルート `AGENTS.md` の
`Change-aware validation` を適用する。Rust の検証は review のフェーズだけで候補になるもの
ではなく、Rust Core、WASM、Native C ABI、Node-API / npm の変更分類または明示された依頼範囲に
該当する場合だけ実行する。

docs-only では文書・リンク・traceability・整合性の確認を行い、agent / skill-only では
Skill の構造・参照・Markdown・必要な validator を確認する。いずれも Rust / WASM /
Native / Node の実装テストを自動実行しない。Concept / Requirements / Design /
Specification が外部契約を記述していても、文書だけの差分であることは実装テストの根拠に
ならない。既存 Implementation との適合確認をユーザーが明示した場合、または Release
Readiness の release gate が full validation を要求する場合だけ、必要なコード検証を追加する。

実行したコマンド、結果、対象外として skipped した検証、未実行理由を分けて記録する。
対象変更がない検証は `NOT APPLICABLE / SKIPPED (no relevant change)` と報告でき、failure
とは扱わない。network、registry、外部 node、長時間テストを未実行のまま成功と書かない。

## 成果物と Git

- レビュー中にレビュー対象のコード、要件、仕様、設計、テスト、README、設定を変更しない。
- `git status` と差分を確認し、レビュー成果物以外の既存ユーザー変更を壊さない。
- ユーザーが明示的に依頼しない限り、commit、push、tag、publish、remote変更を行わない。
