# Review Gates

目的は、実装を完璧にすることではなく、対象範囲が承認済み Specification を安全かつ検証可能に満たすかを判断することである。Implementation Review の release-quality gate として、具体的な security defect、memory unsafety、cryptographic misuse、FFI / binding 境界の破綻を、仕様に個別の防御策が列挙されていないことだけを理由に見逃さない。一方、仕様にない新しい要求、任意の hardening、将来機能、API、policy は不合格理由にしない。

1. 仕様適合性: 入力、出力、制約、処理、状態、error、禁止事項を満たす。
2. セキュリティ: protected asset、secret ownership / lifecycle、権限、trust boundary、暗号、memory safety、失敗時の安全性を満たす。
3. 相互運用性: encoding、canonical signing bytes、数値、chain、network、Symbol / NEM、外部形式が別実装でも一致する。
4. 異常系: malformed、boundary、authentication failure、tamper、truncated、duplicate、unknown value / version、attacker-controlled input を仕様どおりに扱う。
5. テスト十分性: 重要な仕様違反、退行、非互換、暗号誤用、失敗を独立して検出できる。対象に応じて known vector、differential test、fuzzing も確認する。
6. 実装品質・memory safety: 型、ownership、依存、例外、`unsafe`、Native C ABI、WASM 境界、並行性が具体的欠陥を生じさせていない。

各ゲートの観察結果は、対象箇所、発生条件、具体的事実、根拠、影響、完了条件へ追跡する。security checklist は独立した大量の Gate へ変換せず、対象に適用した主要観点を Security、異常系、テスト十分性、実装品質・memory safety の既存 Gate へ対応付ける。仕様が曖昧で正否を決められない事項は、ゲート不合格や implementation defect と断定せず、`Specification ambiguity` / `Specification gap` / `Implementation → Specification feedback` として分離する。ただし、private key / Mnemonic の漏えい、memory unsafety、nonce reuse、AEAD authentication bypass、明確に誤った署名計算など、既存の安全条件を具体的に破る defect は、実装 finding として判定する。

## Severity と判定

Severity は固定スコアで決めず、CRITICAL / HIGH / MEDIUM / LOW の4段階を維持する。exploitability、reachability、protected asset impact、precondition、trust boundary、recovery、downstream effect、既存の緩和要因を総合する。単に暗号コード、秘密情報、`unsafe`、FFI、依存があることだけで CRITICAL / HIGH にはしない。

- `CRITICAL`: private key / Mnemonic の直接漏えい、attacker による secret recovery、arbitrary signing、重大な signature forgery / authorization bypass、cryptographic protection の実質的崩壊、攻撃者入力から重大な memory unsafety が成立し secret protection が崩壊するもの。
- `HIGH`: realistic condition での secret leakage、nonce reuse 等の重大な cryptographic misuse、wrong account / chain / network signing、重大な secret lifecycle failure、重大な FFI memory safety bug、security impact を伴う custom cryptographic arithmetic の correctness defect、攻撃者入力による重大な security property の破壊、Critical / High defect を独立検出できない security-sensitive test gap。
- `MEDIUM`: 重大な invariant を直接破らない localized robustness issue、具体的で影響が限定された hardening gap、低影響の maintainability-driven security risk。
- `LOW`: 既存の security property に関係し、影響と到達可能性が限定的な defensive / security hygiene の不足。一般論や好みだけでは採用しない。

`CRITICAL` または `HIGH` の New / Open / Reopened finding が1件以上ある場合、該当 finding は `Required Change` とし、`REVISE IMPLEMENTATION` とする。`MEDIUM` / `LOW` のみ、または解決済み・Deferred のみの場合は `Optional / non-blocking` とし、`READY` とできる。したがって、`READY` と `Required Changes: HIGH` の組み合わせは成立しない。coverage の任意の数値目標は新設しない。
