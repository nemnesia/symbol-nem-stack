# Output Format

この Skill のレビュー成果物は、`../review-common/output-format.md` の共通構成・章名・順序・指摘必須項目を使用する。共通構成を省略、追加、並べ替えない。

## Skill-specific values

- Formal finding prefix: `RR`
- Severity: `Critical` / `Major` / `Minor`
- Review Result: `READY` / `REVISE REQUIREMENTS`
- Required Changes: `Critical` の New / Open / Reopened（Gate 不合格に対応する差戻し事項）
- Optional Improvements: `Major` / `Minor` の New / Open / Reopened（Critical がなければ `READY` のまま引継ぎ可能）
- Upstream Feedback: なし（Requirements Review は通常 upstream phase を持たない）
- Deferred Findings: 仕様設計以降、対象範囲外、または後続検証へ引き継ぐ指摘。上流の正式資料の不足・曖昧さ・矛盾は含めない
- Domain Checks: 要求の完全性、責任・範囲、MUST / SHOULD、受け入れ条件、セキュリティ、相互運用性。Security Domain Check では、適用した `protected assets`、`confidentiality`、`integrity`、`authentication / authorization`、`lifecycle`、`responsibility boundary`、`failure safety`、`chain / network separation` を確認できるようにする。`input / attacker boundary`、`availability / resource safety`、`recoverability` は製品範囲・攻撃面に適用する場合だけ含める。全 checklist 項目を機械的に出力せず、適用外または未確認の範囲は必要なものだけ明示する。

Security Domain Check は `security-checklist.md` をレビュー観点として使用するが、checklist 自体を根拠に新しい Requirement や finding を作らない。正式な Security finding は、Requirements 本文、Concept、ユーザー要求、または適用可能な正式資料へ追跡できるものだけを記録する。暗号方式、KDF、AEAD、nonce、salt、key length、zeroize方式、memory layout、ownership / lifetime、API field、CBOR key、wire format、ライブラリ、FFI / WASM方式、fuzz harness、test framework 等の下流詳細は Domain Checks の欠落として扱わない。

- Scope and Traceability: 要求とコンセプト、設計、適用資料、下流工程との追跡
