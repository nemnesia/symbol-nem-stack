# Review Gates

1. **正確性**: package / crate 名、install、import、API、引数、戻り値、対応環境、機能説明が manifest、実装、仕様と一致する。
2. **利用可能性**: 利用者が必要な前提を満たして最初の利用まで進める。
3. **制約の正確性**: 未実装、future、deferred、chain / network、security、capability、保証範囲を誤解なく区別できる。
4. **整合性**: README、公開 API、仕様、設定、テスト、license、関連 release docs に利用を妨げる矛盾がない。
5. **構成**: 最初の利用に必要な情報が詳細・内部仕様に埋もれていない。
6. **Translation / multi-document parity**: canonical README と translation README、root README と package README の間で public facts / contract に利用者を誤認させる意味の矛盾がない。

`ERROR` / `WARN` がなければ品質ゲート合格。`NIT` だけでは不合格にしない。ERROR / WARN が
あれば `REVISE README`、NIT だけなら `READY WITH MINOR FIXES`、指摘がなければ `READY` とする。
