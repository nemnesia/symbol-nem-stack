---
name: design-review
description: symbol-nem-wallet-core の基本設計を、上流要求との追跡、責務・依存方向、trust boundary、秘密情報の所有・ライフサイクル、主要フロー、運用前提、実装可能性、設計判断の整合の観点でレビューする。APIや詳細実装そのものはレビューしない。
---

# Design Review Board

基本設計を実装・仕様・書き直しの代わりにせず、下位仕様と実装へ安全に進める品質かを判定する。作業開始時に次の順で全文を読む。

1. `AGENTS.md`
2. `../review-common/review-playbook.md`
3. `AGENTS.md` に対象フェーズの Phase Context が登録されている場合だけ、その Context
4. reviewers.md
5. security-checklist.md
6. review-gates.md
7. output-format.md

## 対象の確定

- ユーザーが明示した設計書、app、package、機能の範囲を優先する。
- 未指定なら `docs/design/` の候補を確認する。候補が0件または複数件なら推測で選ばず、対象確認で終了する。
- リポジトリ全体設計、機能別設計書、設計書に対応する既存レビュー成果物を区別する。レビュー対象は設計書1件とする。
- 設計書の対象機能が不明な場合は、成果物の出力先を推測しない。

成果物は対象パッケージまたはリポジトリの docs/reviews/design/<ベース名>-review-NNN.md に新規作成する。既存成果物を移動、削除、上書きしない。正式指摘の接頭辞は DR とし、対象ベース名ごとに連番にする。

## 根拠の範囲

設計本文、承認済みコンセプト、要件、`docs/design/` の既存判断、ユーザー提供資料を主な根拠とする。仕様、実装、テスト、fixture は、既存下流成果物との回帰・互換性、設計の成立性、既存境界の事実確認に必要な場合、またはユーザーが明示した場合だけ補助的に参照する。公式資料は、適用可能な技術的事実の確認に必要な範囲で参照する。下流資料を新しい Design の規範的根拠にせず、下流の詳細不足だけを設計欠陥にしない。

下位仕様に委譲されたAPI、field、wire format、暗号パラメータ、protocol byte列を、基本設計にないことだけで欠陥としない。設計判断が上位要求と矛盾する場合は、設計の責務・境界・委譲不足として指摘する。

## レビュー観点

- 目的、対象、対象外、上位要求・仕様・既存設計へのtraceability
- システムコンテキスト、外部主体、trust boundary、秘密情報の流れ
- コンポーネント責務、所有データ、依存方向、循環依存、境界漏れ
- 主要フロー、lifecycle、状態、失敗、再試行、再起動、結果対応
- Rust Core、Native C ABI、WASM binding、上位 Application、外部 node の責任分界
- Symbol / NEM、Mainnet / Testnet、Profile / Software Key の分離
- 可用性、運用、保持、監査、更新、障害時の前提が対象範囲と整合するか
- 下位仕様・実装・テストへ一意に引き渡せる設計か、判断理由と未決定事項が残っているか

## Security Review の扱い

Reviewer B は `security-checklist.md` を参照し、秘密鍵・Mnemonic を扱う Wallet Core の security architecture を Design の責務として確認する。対象は、保護対象、trust boundary、secret ownership、lifecycle、認証・認可、signing authority、失敗・置換・再起動、Core / Native / WASM / Application 境界、attacker-controlled input、chain / network separation、security invariant、下流 handoff である。全項目を機械的に成果物へ出力せず、対象へ適用した主要観点と未確認範囲だけを必要に応じて記録する。

checklist はレビューの探索補助であり、新しい Requirement、Design Decision、threat または security invariant の根拠ではない。正式な Security finding は Concept、Requirements、対象 Design、既存の適用可能な Design Decision、またはユーザー要求へ追跡できるものだけを採用する。対象範囲から合理的に追跡できない threat（例: 明示的に対象外の host compromise）を追加しない。

Design Review で確認するのは、何を守るかをどこで守るか、誰が所有・使用・破棄するか、どの境界を越えるか、失敗時に誰が状態と秘密情報を保護するか、どの invariant を Specification へ引き渡すかである。暗号方式、KDF / AEAD、nonce / salt / tag、key length、wire format、API、具体的な error code、Rust の関数・module・memory lifetime、zeroization、unsafe、C ABI / WASM の具体形式、parser / fuzz / test の方式は下流へ委譲する。

## Security finding の境界

Security checklist の観点は、次のすべてを満たす場合だけ正式 finding の候補にする。

1. Concept、Requirements、対象 Design、既存の適用可能な Design Decision、またはユーザー要求へ追跡できる。
2. Design フェーズで決定すべき ownership、responsibility、trust boundary、lifecycle、authorization boundary、failure responsibility、または invariant の問題である。
3. Specification / Implementation だけでは安全に修正できない。
4. 現状の Design のままだと、複数の合理的な下流実装が異なる security architecture を持ち得る。
5. 具体的な protected asset、trust boundary、failure または authorization への影響を説明できる。
6. API、algorithm、library、wire format 等の下流方式を固定せず、必要な Design 修正を表現できる。

「AES-GCM を使うべき」「zeroize crate を使うべき」「この ABI / UI / Rust type にすべき」「fuzz test を追加すべき」といった詳細実装、一般的 hardening、将来機能だけでは finding にしない。

Requirements Review が確認する「何を守る必要があるか、どの security property が必要か、誰に責任があるか」に対し、Design Review はそれをどの ownership、trust boundary、lifecycle、responsibility、dependency direction で成立させるかを確認する。Requirements の不足を Design Review で新しい Requirement として確定せず、必要なら upstream gap として報告する。

Specification は具体的な外部契約、API、validation、error、serialization、cryptographic contract を定め、Implementation は memory lifetime、clone / copy、zeroization、unsafe、FFI pointer safety、actual crypto usage、side-channel、parser implementation を定める。Design Review は、これらの下流詳細が安全に一意な契約へ落とせる security architecture かを確認する。

## 境界テスト

各指摘について、それが基本設計で決めるべき責務・依存・境界・ライフサイクル・不変条件なのか、下位仕様や実装で初めて決める詳細なのかを確認する。後者なら指摘せず、必要な設計原則または委譲先だけを確認する。

特に、API field、wire format、暗号パラメータ、具体的な validation / error、clone / allocation / stack temporary、zeroize の実装、unsafe、FFI pointer safety、実際の crypto usage、side-channel、parser、fuzz harness、unit test case の不足は、Design の責任・境界・invariant が明確で下流へ委譲されている限り Design finding にしない。

## 実行と判定

`../review-common/review-playbook.md` の Phase 0〜3 を適用する。Reviewer A〜D の独立パスで確認し、Reviewer B は Security primary reviewer として `security-checklist.md` の適用可能な観点を使う。Reviewer A / C / D は構造と責務、フローと運用、追跡と下流実装可能性の各担当領域に現れる security implication だけを cross-check し、全件の checklist を再適用しない。候補を根拠・影響・完了条件で反証し、Security の重複候補は Chair が統合してからゲートを適用する。Requirements の不足・曖昧さ・矛盾は `Design Review → Requirements` の `Upstream Feedback` に記録し、Design で新しい Requirement を確定しない。サブエージェントを使った場合だけ識別子と完了状態を記録し、使わない場合は自己レビューの4パスを記録する。

Phase Context を使う場合でも、Context 単独で Critical / Major、Gate failure または Security finding を確定しない。正式な根拠は Design 本文、Requirements、Concept、既存の適用可能な Design Decision またはユーザー提供の正式資料へ追跡する。

判定は READY または REVISE DESIGN とする。品質 Gate を不合格にする finding は Critical とし、Critical が1件以上存在する場合だけ後者とする。Critical がなく Major / Minor のみの場合は READY とし、下位仕様への引継ぎや改善として記録する。

レビュー中に設計、要件、仕様、コード、テスト、READMEを変更しない。

## 作業完了後の Git 運用

`../review-common/review-playbook.md` の「成果物と Git」を適用する。
