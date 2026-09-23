# Output Format

この Skill のレビュー成果物は、`../review-common/output-format.md` の共通構成・章名・順序・指摘必須項目を使用する。共通構成を省略、追加、並べ替えない。

## Skill-specific values

- Formal finding prefix: `IR`
- Severity: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`
- Review Result: `READY` / `REVISE IMPLEMENTATION`
- Required Changes: `CRITICAL` または `HIGH` の New / Open / Reopened。1件以上あれば `Review Result: REVISE IMPLEMENTATION`
- Optional Improvements: `MEDIUM` / `LOW` の New / Open / Reopened。これらのみであれば `Review Result: READY` とできる。`READY` と `Required Changes: HIGH` の組み合わせは不可
- Upstream Feedback: `Implementation Review → Specification` を通常とし、問題の発生源が Design / Requirements の場合だけそれぞれへ返す。Implementation を安全に評価・完了できない場合は Implementation 側の formal finding を別途記録し、既存の Implementation Gate / Severity policy を適用して feedback へ trace する。common format の必須項目を記録し、feedback から新しい Specification contract、Design Decision、Requirement を確定せず、同じ問題を二重計上しない
- Deferred Findings: 現在のレビュー対象外、後続検証、または別途の運用・release確認等へ分離する事項。上流の正式資料の不足・曖昧さ・未決定事項は `Upstream Feedback` に記録し、そこへ混在させない
- Domain Checks: Specification Conformance、Test Evaluation、security、相互運用性、異常系、実装品質・memory safety、型・依存・公開互換性。Security では対象に適用した主要な `security-checklist.md` 項目、主要な適用外項目と理由、未確認範囲を記録する。全項目を機械的に列挙しない
- Scope and Traceability: 差分、承認済み仕様・要件・設計、実装、テスト、fixture の対応

## Finding の分類と記載

各 finding は、対象箇所（実装レビューではファイルと行）、発生条件または確認できた事実、既存の Specification / Design / Requirement / official protocol・cryptographic fact、問題、confidentiality / integrity / authorization / cryptographic correctness / memory safety / interoperability 等への影響、Severity の根拠、必要な最小修正または確認、完了条件または再確認方法を含める。

仕様にない新しい製品要求、任意の hardening、将来機能、API、policy、実装方式の好みは finding にしない。一方、既存 security invariant、protected asset、trust boundary、memory safety、cryptographic primitive の安全条件、言語・FFI 境界を具体的に破る defect は、仕様に防御方法が逐語的にないことだけを理由に除外しない。secret copy、zeroization、constant-time、fuzzing、dependency の不足は、具体的な security impact と到達可能な defect がある場合に限り finding とする。

契約自体が不足・曖昧で実装の正否を決められない場合は、`Implementation defect` と断定せず `Specification ambiguity`、`Specification gap` または `Implementation → Specification feedback` として `Upstream Feedback` へ分離する。Design / Requirements の不足が発生源なら、該当する上流フェーズへの feedback として記録する。

## 判定整合性

`CRITICAL` / `HIGH` の New / Open / Reopened finding は `Required Change` であり、`READY` を阻害し、`REVISE IMPLEMENTATION` とする。`MEDIUM` / `LOW` のみの場合は `Optional / non-blocking` として `READY` とできる。重大度は exploitability、reachability、asset impact、precondition、trust boundary、recovery、downstream effect を根拠に判定し、単に暗号コードであることだけを理由に CRITICAL / HIGH としない。仕様不足や設計選択の未決定は implementation defect と断定せず、発生源に応じた `Upstream Feedback` に分類する。ただし、secret leakage、memory unsafety、nonce reuse、AEAD authentication bypass、明確に誤った signing、custom cryptographic arithmetic の correctness defect など既存の安全性を具体的に破る defect は、個別の防御策が仕様に列挙されていなくても finding とする。
