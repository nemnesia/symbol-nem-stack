---
name: implement-review
description: >-
  symbol-nem-wallet-core の Rust 実装、Native C ABI、WASM binding、
  テスト、fixture、差分を、仕様適合、security、Symbol / NEM
  相互運用性、所有権、異常系、テスト品質の観点でレビューする。
  コードは修正しない。
---

# Implementation Review Board

承認済み仕様、要件、設計および既存の安全性境界を、実装が実際に満たしているかを判定する。4フェーズの中で最も深い Security Review とし、source code、テスト、fixture、binding、依存 feature の具体的な挙動まで確認する。レビュー中にコード、仕様、テスト、fixture、README、設定を修正しない。設計の好みや仕様外の機能追加を指摘へ変換しない。

Implementation Review は、`Specification: what exact behavior must be observed` に対して、`Implementation Review: does the actual code satisfy that contract safely?` を確認する。レビューは、仕様に存在しない新しい製品要求、任意の hardening、将来機能、API、policy を発明しない。一方、既存の security invariant、protected asset の機密性・完全性、trust boundary、memory safety、cryptographic primitive の安全条件、言語・FFI 境界の安全条件を破る具体的な defect は、仕様に個別の防御手段が列挙されていなくても指摘する。これは新しい要求ではなく、既存の安全性を破る実装欠陥の確認である。

## 作業開始時に読む資料

1. `AGENTS.md`
2. `../review-common/review-playbook.md`
3. `reviewers.md`、`review-gates.md`、`output-format.md`、`security-checklist.md`
4. 対象の差分、`src/`、`bindings/native/`、WASM binding、テスト、fixture、`Cargo.toml` / `Cargo.lock`
5. 対応する `docs/specifications/`、`docs/requirements/`、`docs/design/`
6. 必要な `docs/knowledge/`、公式 protocol / schema / SDK 資料

`AGENTS.md` に対象フェーズの Phase Context が登録されている場合だけ、初期探索と共通前提の把握に利用する。Context は正式資料の代替や単独の finding 根拠にせず、正式資料と競合した場合は正式資料を優先する。登録がない場合は Context を探索・作成しない。

## 対象と成果物

- ユーザーが明示した crate、binding、ファイル、機能、差分、commitだけを対象にする。
- 対象が曖昧なら範囲を推測で広げず、対象確認で終了する。
- 変更範囲、直接の依存、対応仕様・要件・設計、関連テストを確定する。
- 成果物は `docs/reviews/implementation/<ベース名>-review-NNN.md` に新規作成する。既存成果物、固定名、`implement-spec-feedback.md` を移動・削除・上書きしない。正式 ID は IR 接頭辞で連番にする。

## 根拠の範囲

差分、実装、テスト、fixture、承認済み仕様、要件、`docs/design/`、必要な公式資料を照合する。既存コードやテストがそうなっていることだけを、仕様や protocol の根拠にしない。

未確認の external node、network、registry、長時間テスト、WASM runtime、C compiler は成功扱いにしない。秘密情報、復号データ、credential を成果物や出力へ含めない。

## レビュー観点

- 承認済み仕様・要件・設計への適合と外部可視動作
- 入力検証、validation、error、warning、atomicity、replacement Store、failure path
- `security-checklist.md` に基づく、対象変更に適用可能な protected asset、secret lifecycle、secret ownership、zeroization、暗号、乱数、署名、Wallet Store、parser、Native C ABI、WASM、`unsafe`、failure atomicity、concurrency、依存、テスト、fuzz、differential、known vector の確認
- 秘密情報のログ・panic・error・warning・不要なコピーへの漏えい、memory safety、具体的な side-channel、cryptographic misuse
- 暗号、KDF、AEAD、AAD、nonce、salt、zeroize、署名対象、canonical bytes、serialization、および custom cryptographic arithmetic
- Symbol / NEM、Mainnet / Testnet、SDK と protocol、address / key / signature の表現
- Rust の ownership、borrow、panic、依存、公開互換性、Native C ABI の buffer / free、WASM の型境界
- 正常、malformed、boundary、wrong password / chain / network、truncated、duplicate、tamper、unknown version、deterministic、interop のテスト

仕様にない API、設定、error、fallback、互換動作、将来拡張、一般論だけの防御、任意の hardening は指摘しない。例えば別の暗号ライブラリ、2FA、Hardware Wallet、一般論としての rate limit、実装スタイルの好み、threat model 外の hardening の要求は finding にしない。一方、private key / Mnemonic の漏えい、不要な secret copy、必要以上に長い lifetime、消去されない secret owner、nonce reuse、RNG failure、AEAD 認証結果の無視、仕様と違う signing bytes、custom cryptographic arithmetic の correctness defect、FFI の use-after-free / double-free、WASM への不要な secret 露出、`unsafe` による memory unsafety、攻撃者入力による panic / UB / resource exhaustion、Symbol / NEM または Mainnet / Testnet の混同による誤署名など、既存の security property を具体的に破る defect は指摘する。secret の copy、zeroization、constant-time、fuzzing、dependency の不足も、具体的な asset impact、attack path、契約違反または安全条件の破綻が確認できる場合に限って採用する。仕様が曖昧で正否を決められない場合は、実装欠陥と `Specification ambiguity` / `Specification gap` / `Implementation → Specification feedback` を分離する。

## 実行と検証

`../review-common/review-playbook.md` の Phase 0〜3 を適用する。Reviewer A〜D を別パスで確認し、各候補を根拠・影響・完了条件で反証してからゲートを適用する。Reviewer B は4フェーズ中で最も深く secret、crypto、memory、attack surface を確認し、変更から attack surface と secret path を先に特定して `security-checklist.md` の該当項目だけを適用する。ただし Security の責任を B だけに集中させない。Reviewer C は canonical bytes、chain / network、Symbol / NEM、protocol interoperability、Reviewer D は negative test、fuzz、differential、known vector、独立 oracle、`unsafe` の品質で重複確認してよい。重複 finding は Chair が統合する。仕様・設計・要件の不足や曖昧さは、発生源に応じた `Implementation Review → Specification / Design / Requirements` の `Upstream Feedback` に記録し、`Deferred Findings` と混在させない。サブエージェントを使った場合だけ実際の識別子と完了状態を監査情報へ記録し、使わない場合は自己レビューの4パスを記録する。

レビュー成果物の `Domain Checks` には、適用した主要な security checklist 項目、重要な適用外項目とその理由、未確認範囲だけを記録する。全項目を機械的なチェックボックスや新しい製品要求の一覧として出力しない。protected asset に触れない変更へ不要な secret checklist を適用しない。

必要な非破壊検証は、ルート `AGENTS.md` の `Change-aware validation` と対象の実際の
script に従う。Rust / WASM / Native / Node の検証は、実際の変更分類またはユーザーが
明示した検証範囲に該当する場合だけ実行する。docs-only または agent / skill-only の
差分では、実装テストを自動実行せず、文書・Skill の構造、参照、Markdown、必要な
validator、差分・状態を確認する。

Native C ABI の変更時は `bindings/native/tests/run_c_abi_runtime.sh`、header compile、
必要な sanitizer を対象に応じて確認する。WASM の生成・実行や外部環境の検証は、変更分類
または明示された依頼範囲に該当する場合だけ実行し、実行した場合だけ記録する。
対象変更がない検証は `NOT APPLICABLE / SKIPPED (no relevant change)` とし、レビューの
failure とは扱わない。

## 判定

判定は `READY` または `REVISE IMPLEMENTATION` とする。

- `CRITICAL` / `HIGH` の New / Open / Reopened finding が1件以上ある場合は `Required Change` とし、`REVISE IMPLEMENTATION` とする。
- `MEDIUM` / `LOW` のみ、または解決済み・Deferred のみの場合は `Optional / non-blocking` とし、`READY` とできる。

重大度は、exploitability、reachability、protected asset への影響、precondition、trust boundary、recovery、downstream effect を総合して判断する。単に暗号、秘密情報、`unsafe`、FFI を含むことだけを理由に `CRITICAL` / `HIGH` としない。固定スコア方式や任意の coverage 数値目標を新設しない。

## 作業完了後の Git 運用

`../review-common/review-playbook.md` の「成果物と Git」を適用する。
