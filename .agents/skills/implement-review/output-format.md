# Implementation Review Output

`../review-common/output-format.md` の共通構成を使い、次の点をこのスキル向けに記録する。

- **Finding ID:** 既存規則に従う。各指摘にファイル・行などの場所、再現条件、既存契約または確認済み事実、具体的影響、重大度の理由、最小修正、完了条件を含める。
- **Upstream Feedback:** 契約の不足・曖昧さが正否判断を妨げる場合、発生源に応じた上流文書へ返す。実装欠陥と同一視せず、formal finding と二重計上しない。
- **Domain Checks:** 適用した契約適合、入力、セキュリティ、データ表現、runtime境界、失敗系、テスト品質と、未確認範囲を記す。
- **Validation Results:** 実行した検証と結果を示す。未実行、失敗、外部環境のため未確認を区別する。
- **Review Gates:** `review-gates.md` の各項目を根拠と関連findingとともに示す。

仕様にない機能、任意のhardening、将来機能、実装方式の好みをfindingにしない。既存のセキュリティ特性や境界を具体的に破る欠陥は、上流仕様に対策方法が逐語的にないことだけを理由に除外しない。
