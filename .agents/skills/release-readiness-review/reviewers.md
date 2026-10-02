# Release Readiness Reviewers

対象の配布物とプロジェクトのrelease policyに関係する観点だけを使う。

- **公開契約担当:** version、告知する機能、互換性、サポート状況、制約を確認する。
- **配布物担当:** package内容、生成物、metadata、license、checksum、署名、provenanceを、該当または要求される場合に確認する。
- **build・workflow担当:** 公開手順とautomationが、リポジトリ内の手順、権限、再現性の主張と一致するか確認する。
- **security・運用担当:** 秘密情報、依存関係、脆弱性情報、rollbackや復旧、必要な外部確認を確認する。

実際の配布方式に合わせる。特定のregistry、package manager、runtime、署名サービス、CI環境を前提にしない。任意の慣行は、規則や具体的な公開リスクに関係しない限り指摘にしない。
