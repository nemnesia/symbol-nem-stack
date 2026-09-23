# Reviewers

メインエージェントは Review Board Chair として、上流追跡、候補統合、重大度・状態、ゲート、成果物を担当する。Phase 1 では次の3観点を独立して確認する。Reviewer C が Security / Interoperability primary reviewer であり、他の Reviewer は自分の担当領域に現れる security implication だけを cross-check する。

## Reviewer A: 契約の明確性と完全性

対象範囲、用語、前提、入力、出力、API、データ形式、validation、error、状態、順序、determinism、受け入れ条件を確認する。security-sensitive input / output / error / state / validation が一意か、Security Reviewer が確認する contract の曖昧さがないかを、契約の明確性と完全性の範囲で独立に cross-check する。

## Reviewer B: 利用価値と運用適合性

要件との追跡、利用者から見える結果、外部責任、失敗時の結果、対象外、利用シナリオ、既存の責務境界との整合を確認する。failure result、external responsibility、authorization / protected operation の外部結果に security implication があれば、利用価値と運用適合性の範囲で独立に cross-check する。

## Reviewer C: Security / Interoperability Reviewer（Security primary reviewer）

`security-checklist.md` を参照し、対象に適用される protected asset exposure、authentication / authorization、Account / signing authority、signing target / canonical bytes、chain / network binding、cryptographic contract、nonce / salt / randomness、AAD / domain separation、Wallet Store / persistence、serialization、malformed / tampered input、replay、fail-closed、atomic visible result、error、Native C ABI、WASM / JavaScript、unknown / version、interoperability、security testability を確認する。Design の security invariant、責任境界、secret flow、authorization、failure model が、別実装でも一致する外部契約へ落ちているかを判定する。

確認対象は仕様上の input / output / state / error / encoding / cryptographic result であり、実装内部の memory lifetime、clone / copy、zeroization、`unsafe`、pointer arithmetic、具体的 library call、side-channel、parser、fuzz harness は Implementation Review へ委譲する。UI 方式や内部 token 方式、上流に根拠のない暗号方式の変更は要求しない。具体方式が未決定なだけの場合も、既存の Requirements / Design / Specification / 公式 protocol 等から Specification で定めるべき事項と追跡できない限り finding としない。

## Chair の採用基準

既存要求または承認資料へ追跡でき、現在の仕様を一意に実装・検証できない具体的問題だけを採用する。Security finding は、Specification で定義すべき外部契約であり、Implementation だけでは安全性・互換性を一意にできず、合理的な実装間の security / wire behavior の分岐と具体的影響を説明でき、修正を内部実装方式へ固定しない場合に限る。Design の不足を Specification で補完せず、upstream Design gap として分離する。Reviewer A / B の cross-check はそれぞれの担当領域に限定し、`security-checklist.md` 全件を再適用しない。contract / operation / security / interoperability の重複候補は Chair が統合する。より高機能・汎用的にする提案、一般的 hardening、reviewer の暗号方式の好みは却下する。
