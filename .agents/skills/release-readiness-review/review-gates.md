# Release Readiness Gates

各 Gate を `PASS`、`FAIL`、`NOT APPLICABLE` で判定し、証拠を示す。適用外の Gate を機械的に失敗扱いしない。

1. **対象と版:** リリース対象、version、対象環境が明確で、既存ポリシーと一致する。
2. **動作と互換性:** 公開内容と互換性の主張が、実際の配布物と承認済み契約に一致する。
3. **配布物:** 必要なファイルがあり、secret、ローカル状態、無関係な生成物を含まない。
4. **完全性と由来:** 要求される署名、checksum、provenance、attestationを確認できる。
5. **buildと公開手順:** 手順、自動化、権限、復旧前提がプロジェクトのポリシーと一致する。
6. **法務とsecurity:** license、notice、依存関係、security disclosureが適用規則を満たす。
7. **外部確認:** registry、platform、productionなどリポジトリ外で必要な確認を、実施済みの証拠と区別する。

Gate failure は、適用されるルール、契約、具体的な影響を根拠にする。任意の慣行だけでは公開を阻害しない。
