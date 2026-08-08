# 実装から仕様書への改善依頼

- 対象仕様: `packages/symbol-nem-interchange-format/doc/spec-api.md` / `spec-format.md` v1
- 実装対象: `@nemnesia/symbol-nem-interchange-format`
- 作成日時: 2026-08-08T22:21:00+09:00
- 作成者: blockchain-implementer

## SNIF-API-ERR-001: provider失敗結果の公開error変換規則

- 分類: SECURITY
- 該当箇所: `spec-api.md` 13〜15章、20章
- 確認できた事実: `ProtectionProvider` は `SnifResult` を返せる一方、provider由来のmessage、path、causeを公開してはならない。これはAPI仕様の責任境界およびレビュー指摘SR-001で確認できる。
- 未決定または矛盾: providerが返す `SnifError.code` をどの公開codeへ変換し、pathを保持するかが規定されていない。
- 実装への影響: providerの実装ごとに公開error codeとpathが変化し得るため、利用側のエラー処理と秘密情報非開示条件を一意に保証できない。
- 仕様書作成者に求める決定: providerの失敗結果について、公開可能なcodeのallowlist、code変換規則、pathを保持する条件および固定message規則を明記する。
- 推奨案: provider例外と同様に、コアが定義したcode allowlistだけを採用し、provider由来messageとpathは常に破棄する。
- 暫定対応: 実装では `UNSUPPORTED_PROTECTION`、`INVALID_PROTECTION_PARAMETERS`、`RESOURCE_LIMIT_EXCEEDED`、`AUTHENTICATION_FAILED`、`PROTECTION_FAILED` 以外を `PROTECTION_FAILED` に変換し、provider由来path/messageを破棄した。
- 検証条件: providerが各定義済みerrorおよび秘密情報を含むmessage/pathを返した場合でも、公開結果が仕様で定義された安全なcode/path/messageだけになること。

## SNIF-API-ERR-002: 復号後のUTF-8/JSON構文エラー分類

- 分類: INTEROP
- 該当箇所: `spec-api.md` 8章、15章、24章、`spec-format.md` 6.3
- 確認できた事実: `spec-format.md` 6.3はUTF-8 decode、JSON解析、payload構造検証の失敗を受理しないと定義する。APIの `DECRYPTED_PAYLOAD_INVALID` はJSONとして解釈できたpayload構造不正として記載され、UTF-8 decodeおよびJSON構文エラーの専用分類はない。レビュー指摘SR-002でも確認される。
- 未決定または矛盾: 復号後byte列が不正UTF-8または不正JSONの場合の公開error codeとpathが一意でない。
- 実装への影響: 実装間で `INVALID_JSON`、`PROTECTION_FAILED`、`DECRYPTED_PAYLOAD_INVALID` のいずれかに分かれ得る。
- 仕様書作成者に求める決定: UTF-8 decode失敗、JSON構文解析失敗、payload構造不正それぞれの公開error codeとpathを明記する。
- 推奨案: 機密情報を含めず復号後処理の失敗を一括分類する場合は、3種類すべてを `DECRYPTED_PAYLOAD_INVALID` と定義する。
- 暫定対応: 実装では3種類すべてを `DECRYPTED_PAYLOAD_INVALID` として返す。復号済みbyte列やJSON内容はerrorへ含めない。
- 検証条件: 同一の不正UTF-8、不正JSON、構造不正plaintextに対して、公開error code/pathが仕様と一致すること。

## SNIF-API-ERR-003: version欠落の公開error分類

- 分類: INTEROP
- 該当箇所: `spec-api.md` 5章、8章、8.1、9〜10章
- 確認できた事実: `version` は必須であり、`UNSUPPORTED_VERSION` は対応versionではない場合、`MISSING_REQUIRED_FIELD` は通常の必須フィールド欠落として定義されている。レビュー指摘SR-003でも確認される。
- 未決定または矛盾: versionが欠落した場合に `UNSUPPORTED_VERSION` と `MISSING_REQUIRED_FIELD` のどちらを返すかが本文で明示されていない。
- 実装への影響: version欠落のerror codeが実装間で分かれ、利用側のエラー処理が一致しない。
- 仕様書作成者に求める決定: version欠落時の公開error codeとpathを明記する。
- 推奨案: 欠落は `MISSING_REQUIRED_FIELD` /version、存在するが1以外は `UNSUPPORTED_VERSION` /version と分離する。
- 暫定対応: 実装では推奨案の分類を採用した。
- 検証条件: version欠落とversion=2が、それぞれ仕様で定めたcode/pathに安定して分類されること。
