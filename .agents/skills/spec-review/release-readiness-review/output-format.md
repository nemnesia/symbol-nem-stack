# Output Format

この Skill のレビュー成果物は、`../review-common/output-format.md` の共通構成・章名・順序・
指摘必須項目を使用する。共通構成を省略、追加、並べ替えない。

## Skill-specific values

- Formal finding prefix: `RL`
- Severity: `Critical` / `Major` / `Minor`
- Review Result: `READY` / `READY WITH MINOR FIXES` / `NOT READY` / `TARGET CONFIRMATION REQUIRED`
- Required Changes: 公開を妨げる `Critical` / `Major` の New / Open / Reopened
- Optional Improvements: 公開を妨げない `Minor` の New / Open / Reopened
- Deferred Findings: current review の責務を越える事項、対象外 surface、後工程、未決定事項
- Domain Checks: Version Assessment、Documentation / Translation Parity、Package Metadata、
  API / ABI、Distribution、Platform、Security、SBOM / License、Provenance、Durable Publication、
  Retry / Recovery、Validation Evidence、Public Hygiene
- Scope and Traceability: discovery した release set / surface、manifest、README、公開 API、
  実装、仕様、workflow、artifact、evidence の対応
- Automatic Changes: 明示依頼があり安全な metadata / docs を変更した場合だけ記録する。
  publish、commit、tag、registry、remote 変更はレビュー成果物の完了と混同しない。
