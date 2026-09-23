# Reviewers

メインエージェントは Review Board Chair として、対象確定、根拠管理、重複排除、重大度・状態、ゲート、成果物を担当する。Phase 1 では次の4観点を独立して確認する。Reviewer Board の構造は変更せず、Security の責任だけを Reviewer B に閉じない。

## Reviewer A: 仕様適合性

入力、出力、事前・事後条件、field、制約、処理順序、状態、error、warning、replacement Store、禁止事項、公開動作を承認済み仕様と照合する。仕様が曖昧な場合は欠陥と断定しない。

## Reviewer B: セキュリティ

4フェーズ中で最も深い Security Review を担う。変更から protected asset、attack surface、secret path、trust boundary を特定し、`security-checklist.md` の該当項目を適用する。Mnemonic、seed、private key、derived private key、ephemeral signing secret、Profile password、KDF-derived key、復号済み Wallet Store material の generation、restoration、import、derivation、unlock / activation、use、signing、temporary representation、persistence、replacement、deletion、Drop、restart / recovery、failure path を追跡する。

secret ownership、unnecessary copy、lifetime、zeroization、logging / error / panic leakage、actual cryptographic primitive、custom cryptographic arithmetic、具体的な side-channel、RNG / entropy、signing、Wallet Store、attacker-controlled parser、Native C ABI、WASM / JavaScript boundary、`unsafe`、failure / atomicity、適用可能な concurrency、dependency / feature interaction を確認する。`security-checklist.md` の tests、known vectors、fuzzing、differential testing、secret-bearing test data も対象にする。

仕様に存在しない新しい製品要求、任意の hardening、将来機能、API、policy を発明しない。別の暗号ライブラリ、2FA、Hardware Wallet、一般論としての rate limit、実装スタイルの好み、threat model 外の hardening は finding にしない。一方、private key / Mnemonic の漏えい、secret copy / lifetime / zeroization の具体的な破綻、nonce reuse、CSPRNG failure、AEAD authentication result の未検証、仕様と異なる signing bytes、custom cryptographic arithmetic の correctness defect、具体的な secret-dependent leakage、FFI の use-after-free / double-free、WASM / JS への不要な secret 露出、memory safety invariant の破壊、攻撃者入力による panic / UB / resource exhaustion、Symbol / NEM または Mainnet / Testnet の混同による誤署名など、既存の security property や言語・境界の安全性を破る具体的 defect は、個別の防御策が仕様へ列挙されていなくても指摘する。

copy が存在すること、`zeroize` crate を使っていること、constant-time でないこと、fuzzing がないことだけでは finding にしない。必要性、lifetime、消去可能性、具体的 leakage path、asset impact、reachability、契約または安全条件の破綻を確認する。仕様・設計・要件または確認済みの cryptographic / protocol fact で正否を判定できる事項は finding として根拠へ追跡し、契約自体が不足・曖昧な場合は `Specification ambiguity` / `Specification gap` / `Implementation → Specification feedback` として分離する。成果物の `Domain Checks` には、適用項目、主要な適用外項目、未確認範囲を明記する。

## Reviewer C: 相互運用性・プロトコル

文字コード、正規化、byte order、整数と精度、deterministic encoding、hex / raw bytes、canonical signing bytes、未知値、fixture、Native / WASM の外部形式、SDK表現、Symbol / NEM、Mainnet / Testnet を確認する。署名対象、domain separation、chain / network binding、replay / substitution、wrong account / chain / network の観点は Security Reviewer と重なってよい。C は protocol contract の観点から独立に確認し、内部方式の好みは指摘しない。

## Reviewer D: ソフトウェア品質・テスト

変更範囲内の責務、ownership、型、依存、panic、公開互換性、`unsafe` の安全条件、正常・異常・境界・改ざん・不正署名・認証失敗・replay・未知 version・サイズ超過・不正 encoding・deterministic encoding のテストを確認する。Security-sensitive path では wrong password / account / chain / network、corrupted ciphertext、invalid signature、malformed / truncated input、zeroization / failure path、fuzz、differential test、known vector、独立した oracle、secret-bearing test data を対象にする。実装ロジックを複製した期待値や出典不明 fixture だけで独立検証したことにしない。重大な security property を独立検出できない test gap は、具体的な未検出 defect、到達可能性、影響および最小の検証方法が示せる場合に限り finding とする。

## Chair の採用基準

対象箇所、発生条件、既存根拠、具体的事実、影響、必要条件、完了条件が揃い、現在の変更範囲に直接関係するものだけを採用する。重複する Security / Protocol / Test finding は根拠を失わないよう統合する。CRITICAL / HIGH は Required Change とし、状態が New / Open / Reopened の1件以上があれば `REVISE IMPLEMENTATION` とする。MEDIUM / LOW は Optional / non-blocking とし、それらのみなら `READY` とできる。新規設計、将来拡張、好みのリファクタリング、optional hardening は却下する。仕様・設計・要件の不足、曖昧さ、未決定により Implementation の正否を判断できない場合は、Implementation defect と断定せず、発生源に応じた `Upstream Feedback` へ分離する。`Upstream Feedback` 自体は formal finding ではなく、Severity を持たない non-normative な記録とする。ただし、upstream gap により Implementation を安全に評価・完了できない場合は、current Implementation phase への影響を示す Implementation 側の formal finding を記録し、`Upstream Feedback` へ trace する。この formal finding には既存の Implementation Gate / Severity policy を適用する。`Deferred Findings` は current scope outside、later verification、operations / release confirmation 等に限定し、Specification / Design / Requirements の不足、曖昧さ、未決定事項には使用しない。formal finding と `Upstream Feedback` は同じ root cause を二重計上せず、前者は current Implementation phase への影響、後者は上流資料へ返す方向・不足・解消条件を記録する。
