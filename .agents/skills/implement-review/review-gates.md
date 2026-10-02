# Implementation Review Gates

各 Gate を `PASS`、`FAIL`、`NOT APPLICABLE` で判定する。具体的な finding へ追跡できない checklist 項目だけで Gate を失敗にしない。

1. **契約適合:** 実装の外部動作、入力検証、状態、error、互換性が承認済み仕様と一致する。
2. **security とprivacy:** 対象資産、権限、trust boundary、秘密情報、失敗時の安全性が維持される。
3. **data とinteroperability:** 外部形式、精度、version、標準・protocolが正しく扱われる場合、その契約に適合する。
4. **堅牢性:** malformed input、境界、resource limit、並行性、所有権、runtime境界に具体的な欠陥がない。
5. **検証:** 重要な正常系・拒否条件・失敗時の結果が、妥当な独立根拠で確認されている。

重大度は到達可能性、影響、必要条件、既存の緩和策、復旧可能性を総合して判断する。対象 Skill が4段階を使う場合、`CRITICAL` / `HIGH` の未解決指摘は `REVISE IMPLEMENTATION` を要し、`MEDIUM` / `LOW` だけなら既存方針に従って non-blocking とできる。重大度体系を新たに導入しない。
