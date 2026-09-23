# Reviewers

メインエージェントは Review Board Chair として、根拠の統合、重複排除、重大度・状態、ゲート、成果物を担当する。Phase 1 では次の3観点を独立して確認する。Reviewer C が Security primary reviewer であり、他の Reviewer は自分の担当領域に現れる security implication だけを cross-check する。

## Reviewer A: 明確性と完全性

要求の追跡性、用語、対象、対象外、責任、前提、制約、MUST / SHOULD、受け入れ条件、内部矛盾を確認する。security property の記述が明確か、protected asset / responsibility の記述が曖昧でないか、acceptance condition と security requirement が矛盾しないかを、明確性と完全性の範囲で独立に cross-check する。

## Reviewer B: 利用価値とスコープ

目的、利用者、利用場面、提供価値、ユースケース、優先度、v1境界、外部主体、コンセプトとの整合を確認する。security responsibility / threat scope が製品スコープと矛盾しないか、Security Reviewer が対象外の threat や responsibility を勝手に Requirement 化していないかを、利用価値とスコープの範囲で独立に cross-check する。

## Reviewer C: Security Reviewer（成立性と安全性、Security primary reviewer）

`security-checklist.md` を参照し、要件として不可欠な品質特性、保護対象、機密性、完全性、認証・認可、秘密情報のライフサイクル、失敗時安全性、trust / responsibility boundary、相互運用性、チェーン・network境界、法務・外部連携前提を確認する。対象は Mnemonic、private key、derived secret、Profile password、復号後の Wallet Store material、signing authority、暗号化して保存する wallet data など、既存資料で扱う資産・責任に限定する。各候補について、既存 Concept、ユーザー要求、Requirements、または明示された責任へ追跡できること、Requirements で定義すべき security property であること、下流方式だけでは安全性を一意にできないこと、外部影響または責任の不明確さを説明できることを確認する。

暗号アルゴリズム、KDF、AEAD、nonce、salt、key length、zeroizeの具体方式、memory layout、Rustのownership / lifetime、API field、CBOR key、wire format、ライブラリ、FFI / WASM実装方式、fuzz harness、test framework、UI方式は決めない。一般的な wallet best practice、実装 hardening、詳細な memory safety 手法、テスト技法、将来機能だけを根拠に新しい Requirement や finding を発明しない。

## Chair の採用基準

指摘は要件レベルの問題として、既存根拠、外部影響、完了条件を説明できる場合だけ採用する。Security checklist の項目に存在することだけでは採用しない。特に、次の全条件を満たすかを確認する。

1. Concept、ユーザー要求、既存 Requirements、または製品が明示的に扱う protected asset / responsibility へ追跡できる。
2. Requirements フェーズで定義されるべき security property である。
3. 下流 Design / Specification / Implementation だけでは安全に解決できない。
4. 欠落により、異なる security property を持ち得る合理的な下流実装が生じる。
5. 具体的な外部影響または責任の不明確さを説明できる。

設計詳細、一般的ベストプラクティス、実装上の hardening、詳細な memory safety 手法、test technique、特定方式・ライブラリ、将来拡張は finding にしない。Reviewer A / B の cross-check はそれぞれの担当領域に限定し、`security-checklist.md` 全件を再適用しない。Security / clarity / scope の重複候補は Chair が統合する。条件を満たさない観点は、必要に応じて未確認事項、未決定事項、または次工程への委譲として扱う。
