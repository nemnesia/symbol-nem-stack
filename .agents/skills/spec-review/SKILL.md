---
name: spec-review
description: symbol-nem-wallet-core の仕様書を、要求適合、API・データ契約、validation、error、状態、security、相互運用性、検証可能性の観点でレビューし、実装へ進める品質を判定する。
---

# Specification Review Board

仕様書を設計・実装・書き直すのではなく、実装者が推測せずに安全に実装・検証できる品質かを判定する。作業開始時に次の順で全文を読む。

1. `AGENTS.md`
2. `../review-common/review-playbook.md`
3. `AGENTS.md` に対象フェーズの Phase Context が登録されている場合だけ、その Context
4. reviewers.md
5. security-checklist.md
6. review-gates.md
7. output-format.md

## 対象と上流資料

- ユーザーが明示した仕様書1件を優先する。
- 未指定なら `docs/specifications/` の候補から `specification.md`、`spec.md`、ファイル名に `spec` または `specification` を含む Markdown の順で探す。
- reviews、コンセプト、要件、設計資料、実装コードは候補から除外する。
- 候補が0件または複数件なら推測で選ばず、対象確認で終了する。
- 対応するコンセプト、要件定義、`docs/design/` の設計が一意にある場合は本文を確認し、対応する最新レビューがあれば公開された判定と状態だけを確認する。適用可能な既存 Specification がある場合は対象との整合確認に限って確認する。候補が複数なら自動選択しない。
- 実装者からの仕様フィードバックが対象ルートの docs/reviews/implementation/implement-spec-feedback.md にある場合、またはユーザーが明示した場合だけ補助資料として確認する。

成果物は `docs/reviews/specifications/<ベース名>-review-NNN.md` に新規作成する。既存ファイルを移動、削除、上書きしない。

## 根拠の範囲

仕様本文、承認済み要件、コンセプト、`docs/design/` の設計、前段レビュー、ユーザー提供の正式資料、適用可能な既存 Specification、および必要な公式 protocol / schema を根拠とする。既存実装やテストは仕様適合の補助的な事実として扱い、実装がそうなっていることだけで仕様を正当化しない。

## レビュー観点

- 要求、プロジェクト範囲、設計、上流文書との追跡と矛盾
- 用語、対象、対象外、依存、前提、責任境界
- 入力、出力、API、データ形式、validation、error、状態、順序、determinism
- 実装者が推測せずに実装・検証できる十分な外部契約
- 秘密情報の公開範囲、認証・認可、signing authority、完全性、改ざん、replay、署名対象、canonical bytes、暗号文境界
- Symbol / NEM、Mainnet / Testnet、SDK とプロトコル、Core と binding、opaque byte 列の区別
- 受け入れ条件、境界条件、失敗条件、未決定事項

既存要求にない機能、API、field、fallback、互換性、抽象化、将来拡張を追加するよう求めない。方式未決定と仕様欠落を区別する。

## Security / Interoperability Review

Reviewer C は `security-checklist.md` を参照し、Design で確立された security invariant、責任境界、secret flow、authorization、failure model が、実装者・binding・別実装から推測不要な外部契約へ落ちているかを確認する。対象は、適用される範囲に応じた次の契約である。

- protected asset の受渡し・返却・永続化・外部公開
- authentication / authorization、Account / signing authority、signing target / canonical bytes
- chain / network binding、cryptographic contract、nonce / salt / randomness、AAD / domain separation
- Wallet Store / persistence、serialization、malformed / tampered input、fail-closed、atomic visible result
- error、Native C ABI、WASM / JavaScript、unknown / version、interoperability、security testability

ここで確認するのは `what exact behavior / contract must be observed` である。Rust の function / module、clone / copy、stack / heap temporary、zeroization の実装、`unsafe`、pointer arithmetic、実際の library call、side-channel の具体実装、parser / fuzz harness の実装、具体的な memory lifetime は Implementation Review へ委譲する。UI 方式や内部 token 方式を指定しない。

暗号方式や protocol の具体値が Requirements、Design、対象または既存 Specification、公式 protocol / schema から Specification で定めるべき事項として追跡できる場合は、algorithm、parameter、KDF、AEAD、nonce、salt、AAD、tag、signature encoding、wire representation 等の曖昧さを指摘してよい。ただし reviewer の好みで方式を変更したり、上流に根拠のない cryptographic policy を追加したりしない。Design が不足していて Specification が security architecture を新しく決める必要がある場合は、`upstream Design gap` として分離する。

`security-checklist.md` は探索補助であり、新しい Requirement / Design Decision / Specification policy の根拠ではない。正式 finding は Requirements、Design、対象 Specification、適用可能な既存 Specification、Concept、ユーザー提供の正式資料、または必要な公式 protocol / schema へ追跡できるものだけを採用する。

## Security finding の採用条件

Security checklist の項目があるだけでは finding にしない。正式 finding は、少なくとも次のすべてを満たす候補に限る。

1. Requirements、Design、対象 Specification、適用可能な既存 Specification、Concept、ユーザー要求または必要な公式 protocol / schema へ追跡できる。
2. Specification フェーズで一意な外部契約として定義すべき事項である。
3. Implementation だけでは互換性・安全性を一意に修正できない。
4. 現状の仕様のままだと、複数の合理的実装が異なる security behavior または wire behavior を持ち得る。
5. 具体的な input / output / state / error / cryptographic result / interoperability への影響を説明できる。
6. 必要な修正を内部実装方式、library、Rust type、memory layout、具体的 parser / fuzz framework に固定せず表現できる。

条件を満たさないものは、実装への委譲、未決定事項、未確認範囲、または改善提案として整理する。Design の owner、responsibility、trust boundary、lifecycle、allowed secret flow、authorization responsibility、failure responsibility、security invariant が不足している場合は、Specification で補完せず upstream Design gap として扱う。

## 実行と判定

`../review-common/review-playbook.md` の Phase 0〜3 を適用する。Reviewer A、B、C を独立した観点で確認し、Reviewer C は Security / Interoperability primary reviewer として `security-checklist.md` の適用可能な観点を使う。Reviewer A / B は契約の明確性・完全性、利用価値・運用適合性の各担当領域に現れる security implication だけを cross-check し、全件の checklist を再適用しない。候補を反証し、contract / operation / security / interoperability の重複候補は Chair が統合してからゲートを適用する。Design の不足・曖昧さ・矛盾は `Specification Review → Design`、問題の発生源が Requirements の場合だけ `Specification Review → Requirements` の `Upstream Feedback` に記録し、Specification で上流を再定義しない。

判定は READY または REVISE SPECIFICATION とする。品質 Gate を不合格にする finding は Critical とし、Critical が1件以上存在する場合だけ後者とする。Critical がなく Major / Minor のみの場合は READY とし、実装前の確認事項または後工程へ整理する。signing target、chain / network binding、secret exposure、cryptographic contract、tampered data、fail-closed、Wallet Store の security-sensitive encoding、Native / WASM ownership など、根拠があり安全かつ相互運用可能な実装を一意に進められない根本欠陥は、既存 Gate の impact / ambiguity / downstream blocking に照らして Critical になり得る。Checklist の項目だけで Critical にせず、Major を自動的に Gate failure にしない。

Phase Context が存在する場合も、Context 単独で Critical、Major、Gate failure または Security finding を確定しない。正式 finding は本文または確認済みの正式な上流・同一フェーズ・適用可能な公式資料へ追跡する。

レビュー中に仕様、要件、コード、テスト、fixture、READMEを変更しない。未確認範囲と未決定事項を成功扱いにしない。

## 作業完了後の Git 運用

`../review-common/review-playbook.md` の「成果物と Git」を適用する。
